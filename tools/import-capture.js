#!/usr/bin/env node
/*
 * Converts a content capture of the old WordPress site (data.json + images/) into ./data and ./src/images.
 *   node tools/import-capture.js <capture-folder>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CAP = path.resolve(process.argv[2] || path.join(ROOT, 'capture'));
const X = JSON.parse(fs.readFileSync(path.join(CAP, 'data.json'), 'utf8'));
const out = (f, o) => fs.writeFileSync(path.join(ROOT, 'data', f), JSON.stringify(o, null, 2) + '\n');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function toIso(s) {
	const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(s.trim());
	return m ? m[3] + '-' + String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0') + '-' + m[2].padStart(2, '0') : s.trim();
}
const warn = [];

// Pages
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pages.json'), 'utf8'));
for (const slug of ['maps', 'ranked-loadouts', 'warzone', 'roles', 'credits']) {
	const p = X.pages['/' + slug + '/'];
	if (p && p.h1) pages[slug] = { title: p.h1, eyebrow: p.eyebrow || '', lead: p.lead || '' };
}
out('pages.json', pages);

// Maps
const maps = X.maps.slice().sort((a, b) => a.order - b.order).map((m) => ({
	id: m.id, slug: m.slug, name: m.name, location: m.location, size: m.size, description: m.description, ranked: !!m.ranked,
	image: m.image && m.image.file ? { file: m.image.file, w: m.image.w, h: m.image.h } : null, hero: m.heroFile || null,
	hp: m.hp, snd: m.snd, intel: m.intel, sources: m.sources,
}));
out('maps.json', maps);
out('roster.json', (X.shared && X.shared.roster) || {});

// Loadouts
function rec(c, game, kind, tier) {
	const chip = (cls) => (c.chips.find((x) => x[0] === cls) || [])[1] || '';
	const ps = chip('chip chip-brass');
	const players = ps ? ps.split(' & ') : [];
	const who = players.length ? ' (' + players.join(' & ') + ')' : '';
	const d = { game, kind, weapon: c.weapon, class: c.cls || chip('chip'), tier: tier || c.tier || '', category: chip('chip chip-sage'), players, team: chip('chip chip-optic') };
	d.builds = c.builds.map((b) => {
		const rest = (b.copy || '').slice((c.weapon + who).length);
		const m = /^ \[(.*?)\] - /.exec(rest);
		return { name: m ? m[1] : '', attachments: b.atts.map((a) => ({ slot: a.slot || '', name: a.name || '' })) };
	});
	d.source = c.src ? { label: c.src.text.replace(/^Source: /, ''), url: c.src.href } : { label: '', url: '' };
	d.verified = '';
	if (c.date && c.date.title) {
		d.sources_tier = {};
		c.date.text.split(' · ').forEach((bit) => { const i = bit.lastIndexOf(' '); d.sources_tier[bit.slice(0, i)] = bit.slice(i + 1); });
	} else if (c.date && /^Checked /.test(c.date.text)) d.verified = toIso(c.date.text.replace(/^Checked /, ''));
	d.video = c.video || '';
	// Self-check against what the old site rendered.
	c.builds.forEach((b, i) => {
		const parts = d.builds[i].attachments.map((a) => (a.slot ? a.slot + ': ' : '') + a.name);
		const copy = c.weapon + who + (d.builds[i].name ? ' [' + d.builds[i].name + ']' : '') + ' - ' + parts.join(' | ') + ' - via MW4 Hub';
		if (b.copy !== copy) warn.push('copy text differs: ' + c.weapon);
		if (c.tabs.length > 1 && c.tabs[i] !== (d.builds[i].name || 'Build ' + (i + 1))) warn.push('tab name differs: ' + c.weapon);
	});
	const search = [d.weapon, d.class, d.category, d.team].concat(players).join(' ').toLowerCase();
	if (c.search !== search) warn.push('search text differs: ' + c.weapon);
	return d;
}
const loadouts = [];
(X.ranked.pro || []).forEach((c) => loadouts.push(rec(c, 'ranked', 'pro', '')));
(X.ranked.meta || []).forEach((t) => t.cards.forEach((c) => loadouts.push(rec(c, 'ranked', 'meta', t.tier))));
(X.warzone.meta || []).forEach((t) => t.cards.forEach((c) => loadouts.push(rec(c, 'warzone', 'meta', t.tier))));
out('loadouts.json', loadouts);

// Warzone maps
const wzmaps = (X.warzone.maps || []).map((m) => ({ name: m.name, slug: m.slug, status: m.status || '', type: (m.chips || [])[0] || '', released: (m.chips || [])[1] || '', description: m.text || '', url: m.url || '', image: m.file || null }));
out('warzone-maps.json', wzmaps);

// Images
let n = 0;
(function copy(from, to) {
	if (!fs.existsSync(from)) return;
	fs.mkdirSync(to, { recursive: true });
	for (const e of fs.readdirSync(from, { withFileTypes: true })) {
		if (e.isDirectory()) copy(path.join(from, e.name), path.join(to, e.name)); else { fs.copyFileSync(path.join(from, e.name), path.join(to, e.name)); n++; }
	}
})(path.join(CAP, 'images'), path.join(ROOT, 'src', 'images'));

const hills = maps.reduce((a, m) => a + ((m.hp && m.hp.hills) || []).length, 0);
const snd = maps.filter((m) => m.snd && m.snd.sites && m.snd.sites.length).length;
console.log('Imported ' + maps.length + ' maps (' + hills + ' hardpoints, ' + snd + ' S&D layouts), ' + loadouts.length + ' loadouts, ' + wzmaps.length + ' Warzone maps, ' + n + ' images.');
const old = X.pages['/'] && X.pages['/'].stats;
if (old) {
	const now = [maps.length, hills, snd, loadouts.length].map(String);
	console.log('Old site stats: ' + old.map((s) => s[0]).join(' / ') + '  new: ' + now.join(' / ') + (old.map((s) => s[0]).join() === now.join() ? '  (match)' : '  (DIFFERENT)'));
}
console.log(warn.length ? 'Warnings (' + warn.length + '):\n  ' + warn.join('\n  ') : 'No warnings.');
