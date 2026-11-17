#!/usr/bin/env node
/*
 * Registers the official Call of Duty tac-map markers (tools/tacmap-official.json)
 * onto this site's minimaps and writes them into data/maps.json as `official`:
 *   official.pois   [{ s, x, y }]      named areas (used as the default callouts)
 *   official.spawns [{ team, x, y }]   each team's main spawn
 *   official.dom    [{ id, x, y }]     Domination flags (used to estimate spawn sides)
 *   official.fit    { points, maxErr } how well the registration fits
 *
 * The two images are not pixel-identical, so each map gets an affine fit using the
 * Hardpoint hills that both sources have. Run: node tools/import-tacmap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'tacmap-official.json'), 'utf8'));
const mapsFile = path.join(ROOT, 'data', 'maps.json');
const maps = JSON.parse(fs.readFileSync(mapsFile, 'utf8'));
const NUM = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6 };
const r4 = (v) => Math.round(v * 10000) / 10000;

function solve3(A, b) { // 3x3 linear system, Gaussian elimination
	const M = A.map((row, i) => row.concat(b[i]));
	for (let i = 0; i < 3; i++) {
		let p = i;
		for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
		[M[i], M[p]] = [M[p], M[i]];
		for (let j = i + 1; j < 3; j++) { const f = M[j][i] / M[i][i]; for (let k = i; k < 4; k++) M[j][k] -= f * M[i][k]; }
	}
	const x = [0, 0, 0];
	for (let i = 2; i >= 0; i--) { let s = M[i][3]; for (let k = i + 1; k < 3; k++) s -= M[i][k] * x[k]; x[i] = s / M[i][i]; }
	return x;
}
function fit(pairs) { // pairs: [[sx, sy, tx, ty]] -> { X: [a, b, c], Y: [d, e, f] }
	const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
	for (const [x, y, tx, ty] of pairs) {
		const v = [x, y, 1];
		for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; bx[i] += v[i] * tx; by[i] += v[i] * ty; }
	}
	return { X: solve3(A.map((r) => r.slice()), bx), Y: solve3(A.map((r) => r.slice()), by) };
}
const apply = (T, x, y) => [T.X[0] * x + T.X[1] * y + T.X[2], T.Y[0] * x + T.Y[1] * y + T.Y[2]];

let ok = true;
for (const m of maps) {
	const rows = raw.maps[m.slug];
	if (!rows) continue;
	const size = raw.size[m.slug] || raw.size.default;
	const hills = {}; ((m.hp && m.hp.hills) || []).forEach((h) => { hills[h.n] = h; });
	const seen = new Set();
	let pairs = [];
	for (const [cat, name, x, y] of rows) {
		if (cat !== 'H' || !NUM[name] || !hills[NUM[name]]) continue;
		const key = x + ',' + y;
		if (seen.has(key)) continue; // official data repeats a marker on some maps
		seen.add(key);
		pairs.push([x / size, y / size, hills[NUM[name]].x, hills[NUM[name]].y, NUM[name]]);
	}
	let T = null, err = [];
	for (;;) {
		if (pairs.length < 4) break;
		T = fit(pairs);
		err = pairs.map((p) => { const q = apply(T, p[0], p[1]); return Math.hypot(q[0] - p[2], q[1] - p[3]); });
		const worst = err.indexOf(Math.max.apply(null, err));
		if (err[worst] > 0.03 && pairs.length > 4) pairs.splice(worst, 1); else break;
	}
	if (!T) { console.log(m.slug + ': not enough shared hills to register, skipped'); ok = false; continue; }
	const maxErr = Math.max.apply(null, err);
	const conv = (x, y) => { const q = apply(T, x / size, y / size); return { x: r4(Math.min(1, Math.max(0, q[0]))), y: r4(Math.min(1, Math.max(0, q[1]))) }; };
	m.official = {
		pois: rows.filter((r) => r[0] === 'P').map((r) => Object.assign({ s: r[1] }, conv(r[2], r[3]))),
		spawns: rows.filter((r) => r[0] === 'M').map((r) => Object.assign({ team: /1/.test(r[1]) ? 1 : 2 }, conv(r[2], r[3]))).sort((a, b) => a.team - b.team),
		dom: rows.filter((r) => r[0] === 'D').map((r) => Object.assign({ id: r[1] }, conv(r[2], r[3]))),
		fit: { points: pairs.length, maxErr: r4(maxErr) },
	};
	m.sources = m.sources || {};
	m.sources.tac = { label: 'Call of Duty tac map', url: 'https://www.callofduty.com/guides/modernwarfare4/multiplayer-maps/launch/' + m.slug };
	console.log(m.slug.padEnd(12) + ' hills used ' + pairs.map((p) => 'P' + p[4]).join(' ') + '  max error ' + (maxErr * 100).toFixed(1) + '% of map width' + (maxErr > 0.03 ? '  <-- CHECK' : ''));
	if (maxErr > 0.03) ok = false;
}
fs.writeFileSync(mapsFile, JSON.stringify(maps, null, 2) + '\n');
console.log(ok ? 'Wrote data/maps.json' : 'Wrote data/maps.json, but check the warnings above');
