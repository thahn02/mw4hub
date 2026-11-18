/* MW4 Hub - interactive map planner */
(function () {
	'use strict';

	var root = document.getElementById('mw4-planner');
	var dataEl = document.getElementById('mw4-planner-data');
	if (!root || !dataEl) return;
	var D;
	try { D = JSON.parse(dataEl.textContent); } catch (err) { return; }

	var MAP = D.map;
	var stage = document.getElementById('pl-stage');
	var img = document.getElementById('pl-img');
	var svg = document.getElementById('pl-svg');
	var panel = document.getElementById('pl-panel');
	if (!stage || !svg || !panel) return;

	var NS = 'http://www.w3.org/2000/svg';
	var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, Arial, sans-serif';
	var HAS_SND = !!(MAP.snd && MAP.snd.sites && MAP.snd.sites.length === 2);
	var MODE_NAMES = { hp: 'Hardpoint', snd: 'Search & Destroy', hj: 'Hijack' };
	var MODES = (MAP.modes && MAP.modes.length ? MAP.modes : ['hp', 'snd']).filter(function (m) { return !!MODE_NAMES[m]; });
	if (!MODES.length) MODES = ['hp', 'snd'];
	function pickMode(m) { return MODES.indexOf(m) >= 0 ? m : MODES[0]; }
	function modeParam(u, m) { if (m !== MODES[0]) u.searchParams.set('mode', m); else u.searchParams.delete('mode'); }

	var ROLE = {
		ar: { label: 'AR', name: 'Main AR', color: '#4fc3f7', ink: '#04202c' },
		flex: { label: 'FX', name: 'Flex', color: '#b388ff', ink: '#1c0d33' },
		entry: { label: 'EN', name: 'Entry SMG', color: '#ffb74d', ink: '#2e1a00' },
		sub: { label: 'S2', name: 'Second SMG', color: '#81c784', ink: '#0b240f' },
		team: { label: 'TM', name: 'Whole team', color: '#e9ecdf', ink: '#14160f' }
	};
	var ICONS = {
		ar: ROLE.ar, flex: ROLE.flex, entry: ROLE.entry, sub: ROLE.sub,
		enemy: { label: '\u2715', name: 'Enemy', color: '#ff5a5a', ink: '#2b0505' },
		smoke: { label: 'SMK', name: 'Smoke', color: '#b9bfb0', ink: '#16180f' },
		flash: { label: 'FLS', name: 'Flash', color: '#f6f6ef', ink: '#16180f' },
		stun: { label: 'STN', name: 'Stun', color: '#ffe082', ink: '#2b2300' },
		frag: { label: 'FRG', name: 'Frag', color: '#ff8a65', ink: '#2b0d03' },
		semtex: { label: 'SEM', name: 'Semtex', color: '#ff7043', ink: '#2b0a01' },
		trophy: { label: 'TRP', name: 'Trophy', color: '#80cbc4', ink: '#04211e' },
		spawn: { label: 'SP', name: 'Spawn', color: '#cbbd8f', ink: '#221d0b' }
	};
	var TOOLS = [
		{ k: 'pan', name: 'Move', key: 'v' },
		{ k: 'route', name: 'Route', key: 'r' },
		{ k: 'enemy', name: 'Enemy route', key: 'e' },
		{ k: 'strong', name: 'Strong point', key: 's' },
		{ k: 'icon', name: 'Icon', key: 'i' },
		{ k: 'text', name: 'Label', key: 't' },
		{ k: 'note', name: 'Coach note', key: 'n' },
		{ k: 'erase', name: 'Erase', key: 'x' }
	];
	var IC = {
		pan: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
		route: '<path d="M4 19c3-8 8-12 15-13"/><path d="M15 3l4 3-3 4"/>',
		enemy: '<path d="M4 19c3-8 8-12 15-13" stroke-dasharray="3 3"/><path d="M15 3l4 3-3 4"/>',
		strong: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
		icon: '<circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/>',
		text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
		note: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
		erase: '<path d="M7 21h10M5 15l8-8 6 6-6 6H9z"/>',
		undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
		redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
		link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
		download: '<path d="M12 3v12M8 11l4 4 4-4M4 19h16"/>',
		save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		minus: '<path d="M5 12h14"/>',
		fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
		expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
		back: '<path d="M15 18l-6-6 6-6"/>',
		bomb: '<circle cx="11" cy="14" r="6"/><path d="M15 9l2-2M18 4l1 1M20 7h1"/>',
		brief: '<path d="M4 5h16v11H4z"/><path d="M9 20h6M12 16v4"/><path d="M10 8.2l4.4 2.3-4.4 2.3z"/>'
	};
	function ico(n) {
		return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
	}

	// ---------- helpers ----------
	function esc(s) {
		return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}
	function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
	function lerp(a, b, t) { return a + (b - a) * t; }
	function r2(v) { return Math.round(v * 100) / 100; }
	function r4(v) { return Math.round(v * 10000) / 10000; }
	function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
	function s(tag, attrs, text) {
		var e = document.createElementNS(NS, tag);
		if (attrs) {
			Object.keys(attrs).forEach(function (k) {
				if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
			});
		}
		if (text !== undefined) e.textContent = text;
		return e;
	}
	function h(tag, cls, html) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (html) e.innerHTML = html;
		return e;
	}
	function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
	function modeName(m) { return MODE_NAMES[m || S.mode] || 'Hardpoint'; }
	function visName(v) { return v === 'private' ? 'Only me' : (v === 'team' ? 'My team' : 'Anyone with link'); }
	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
		return new Promise(function (resolve) {
			var ta = document.createElement('textarea');
			ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
			document.body.appendChild(ta); ta.select();
			try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
			ta.remove(); resolve();
		});
	}
	function b64e(str) {
		var bytes = new TextEncoder().encode(str), bin = '';
		for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
		return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
	function b64d(b) {
		b = b.replace(/-/g, '+').replace(/_/g, '/');
		while (b.length % 4) b += '=';
		var bin = atob(b), bytes = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder().decode(bytes);
	}
	function api(path, opts) {
		opts = opts || {};
		var url = D.rest.root + path;
		if (opts.query) {
			var qs = Object.keys(opts.query).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(opts.query[k]); }).join('&');
			url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
		}
		var headers = { Accept: 'application/json' };
		if (opts.body) headers['Content-Type'] = 'application/json';
		if (D.rest.nonce) headers['X-WP-Nonce'] = D.rest.nonce;
		return fetch(url, { method: opts.method || 'GET', headers: headers, credentials: 'same-origin', body: opts.body ? JSON.stringify(opts.body) : undefined })
			.then(function (r) {
				return r.json().catch(function () { return {}; }).then(function (j) {
					if (!r.ok) throw new Error((j && j.message) || ('Request failed (' + r.status + ')'));
					return j;
				});
			});
	}

	// ---------- state ----------
	var params = new URLSearchParams(location.search);
	var S = {
		mode: pickMode(params.get('mode')),
		cam: { x: 500, y: 500, k: 1 }, vw: 1, vh: 1, kMin: 0.5, kMax: 4,
		anim: null, vel: null, raf: 0, lastT: 0,
		layers: { obj: true, rot: true, route: true, enemy: true, strong: true, note: true, plan: true, callouts: true, detail: true, starter: true, spawns: true },
		tool: 'pan', role: 'entry', icon: 'ar', sel: null,
		plans: { hp: [], snd: [], hj: [] },
		intel: { hp: (MAP.intel && MAP.intel.hp) ? MAP.intel.hp.slice() : [], snd: (MAP.intel && MAP.intel.snd) ? MAP.intel.snd.slice() : [], hj: (MAP.intel && MAP.intel.hj) ? MAP.intel.hj.slice() : [] },
		editIntel: false, intelDirty: false,
		history: [], future: [],
		planMeta: { code: null, title: '', visibility: 'unlisted', canEdit: true },
		tab: 'intel',
		step: null, brief: false, coPick: ''
	};
	var lastK = -1, spaceDown = false, tipTimer = 0, saveTimer = 0, pop = null;
	var lastTap = { t: 0, x: 0, y: 0 };

	function lsKey(m) { return 'mw4hub:' + MAP.slug + ':' + m; }
	['hp', 'snd', 'hj'].forEach(function (m) {
		try {
			var v = JSON.parse(localStorage.getItem(lsKey(m)) || '[]');
			if (Array.isArray(v)) S.plans[m] = v;
		} catch (e3) { /* ignore */ }
	});
	// Team edits to the map layers (callouts, corrected spawn zones) and the layer switches stay on this device.
	var TEAM_KEY = 'mw4hub:' + MAP.slug + ':team', LAYER_KEY = 'mw4hub:layers', PREF_LAYERS = ['callouts', 'detail', 'starter', 'spawns'], CALLOUT_VER = 2;
	var TEAM = { callouts: null, spawns: {}, cv: CALLOUT_VER };
	function readTeam(raw) {
		var t = { callouts: null, spawns: {}, cv: raw && raw.cv >= 1 ? +raw.cv : 1 };
		if (raw && Array.isArray(raw.callouts)) {
			t.callouts = raw.callouts.filter(function (c) { return c && typeof c.s === 'string' && c.s && isFinite(c.x) && isFinite(c.y); })
				.slice(0, 120).map(function (c, i) { return { id: String(c.id || ('c' + i)), s: c.s.slice(0, 40), x: clamp(+c.x, 0, 1), y: clamp(+c.y, 0, 1), k: (c.k === 'official' || c.k === 'hill' || c.k === 'detail') ? c.k : 'team' }; });
		}
		if (raw && raw.spawns && typeof raw.spawns === 'object') {
			Object.keys(raw.spawns).slice(0, 12).forEach(function (n) {
				var v = raw.spawns[n], o = {};
				['own', 'enemy'].forEach(function (w) { if (v && Array.isArray(v[w]) && isFinite(v[w][0]) && isFinite(v[w][1])) o[w] = [clamp(+v[w][0], 0, 1), clamp(+v[w][1], 0, 1)]; });
				if (o.own || o.enemy) t.spawns[String(n).slice(0, 4)] = o;
			});
		}
		// A team list saved before the detailed callouts existed gets them added once (by name, so nothing doubles up).
		if (t.callouts && t.cv < CALLOUT_VER) {
			var have = {};
			t.callouts.forEach(function (c) { have[c.s.toLowerCase()] = 1; });
			(MAP.callouts || []).forEach(function (c) { if (c.k === 'detail' && !have[c.s.toLowerCase()] && t.callouts.length < 120) t.callouts.push({ id: c.id, s: c.s, x: c.x, y: c.y, k: 'detail' }); });
		}
		t.cv = CALLOUT_VER;
		return t;
	}
	function saveTeam() {
		try {
			if (!TEAM.callouts && !Object.keys(TEAM.spawns).length) localStorage.removeItem(TEAM_KEY);
			else localStorage.setItem(TEAM_KEY, JSON.stringify(TEAM));
		} catch (e9) { /* storage full */ }
	}
	function teamEdited() { return !!TEAM.callouts || Object.keys(TEAM.spawns).length > 0; }
	function callouts() { return TEAM.callouts || MAP.callouts || []; }
	function nDetail() { return callouts().filter(function (c) { return c.k === 'detail'; }).length; }
	function editCallouts() { if (!TEAM.callouts) TEAM.callouts = JSON.parse(JSON.stringify(MAP.callouts || [])); return TEAM.callouts; }
	function packTeam() {
		return { v: 1, m: MAP.slug, cv: CALLOUT_VER, c: TEAM.callouts ? TEAM.callouts.map(function (c) { return [c.s, c.x, c.y, c.k === 'official' ? 1 : (c.k === 'hill' ? 2 : (c.k === 'detail' ? 3 : 0))]; }) : null, sp: TEAM.spawns };
	}
	function unpackTeam(pk) {
		return readTeam({
			callouts: Array.isArray(pk.c) ? pk.c.map(function (c, i) { return { id: 'c' + i, s: String(c[0]), x: c[1], y: c[2], k: c[3] === 1 ? 'official' : (c[3] === 2 ? 'hill' : (c[3] === 3 ? 'detail' : 'team')) }; }) : null,
			cv: pk.cv,
			spawns: pk.sp
		});
	}
	try { TEAM = readTeam(JSON.parse(localStorage.getItem(TEAM_KEY) || 'null')); } catch (e7) { /* ignore */ }
	try {
		var lp = JSON.parse(localStorage.getItem(LAYER_KEY) || '{}');
		PREF_LAYERS.forEach(function (k) { if (lp && typeof lp[k] === 'boolean') S.layers[k] = lp[k]; });
	} catch (e8) { /* ignore */ }

	if (location.hash.indexOf('#p=') === 0) {
		try {
			var shared = JSON.parse(b64d(location.hash.slice(3)));
			if (shared && Array.isArray(shared.i)) {
				S.mode = pickMode(shared.d);
				S.plans[S.mode] = shared.i;
				S.sharedLoaded = true;
				// A plan link carries the sender's callouts. Use them unless this device already has its own.
				if (Array.isArray(shared.c) && !TEAM.callouts) { TEAM.callouts = unpackTeam({ c: shared.c }).callouts; saveTeam(); }
			}
		} catch (e4) { /* ignore bad links */ }
	}
	if (location.hash.indexOf('#t=') === 0) {
		try {
			var tp = JSON.parse(b64d(location.hash.slice(3)));
			if (tp && tp.m === MAP.slug) {
				try { var prevT = localStorage.getItem(TEAM_KEY); if (prevT) localStorage.setItem(TEAM_KEY + ':prev', prevT); } catch (e10) { /* ignore */ }
				TEAM = unpackTeam(tp); saveTeam(); S.teamLoaded = true;
			}
		} catch (e11) { /* ignore bad links */ }
	}

	function currentItems() { return S.editIntel ? S.intel[S.mode] : S.plans[S.mode]; }
	function setCurrentItems(a) { if (S.editIntel) S.intel[S.mode] = a; else S.plans[S.mode] = a; }
	function sortedHills() { return ((MAP.hp && MAP.hp.hills) || []).slice().sort(function (a, b) { return a.n - b.n; }); }

	// ---------- steps: one per hill (Hardpoint), per side of the round (S&D), per starting spawn (Hijack) ----------
	function compass(pt) {
		var dx = pt.x - 0.5, dy = pt.y - 0.5, ns = dy < -0.12 ? 'north' : (dy > 0.12 ? 'south' : ''), ew = dx < -0.12 ? 'west' : (dx > 0.12 ? 'east' : '');
		return (ns && ew) ? ns + '-' + ew : (ns || ew || 'middle');
	}
	function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
	function steps(m) {
		m = m || S.mode;
		if (m === 'hp') return sortedHills().map(function (hl) { return { k: String(hl.n), label: 'P' + hl.n, name: hl.name, x: hl.x, y: hl.y }; });
		if (m === 'snd') return [{ k: 'atk', label: 'Attack', name: 'Attacking rounds' }, { k: 'def', label: 'Defense', name: 'Defending rounds' }];
		if (m === 'hj' && (MAP.spawns || []).length === 2) {
			return MAP.spawns.map(function (sp, i) { return { k: 't' + (i + 1), label: cap(compass(sp)) + ' start', name: 'Rounds starting from the ' + compass(sp) + ' spawn', x: sp.x, y: sp.y }; });
		}
		return [];
	}
	function stepObj(k) { k = k === undefined ? S.step : k; return steps().filter(function (x) { return x.k === k; })[0] || null; }
	function inStep(it) { return !S.step || !it.st || it.st === S.step; }
	function stepItems() { return (S.plans[S.mode] || []).filter(function (it) { return !!S.step && it.st === S.step; }); }

	// Spawn zones for a hill. Nobody has published per-hill spawns, so these are estimates: the team holding tends to
	// spawn on the side it set up on (nearest spawn area), the team breaking on the far side. A team can drag them.
	function hillSpawns(n) {
		var hl = sortedHills().filter(function (x) { return x.n === +n; })[0];
		if (!hl) return null;
		var cands = (MAP.spawns || []).map(function (sp) { return { x: sp.x, y: sp.y }; });
		(MAP.dom || []).forEach(function (d) { if (d.id !== 'B') cands.push({ x: d.x, y: d.y }); });
		if (cands.length < 2) return null;
		cands.sort(function (a, b) { return dist(a, hl) - dist(b, hl); });
		var own = cands.filter(function (c) { return dist(c, hl) >= 0.13; })[0] || cands[0], enemy = cands[cands.length - 1];
		var ov = TEAM.spawns[String(n)] || {};
		return {
			own: ov.own ? { x: ov.own[0], y: ov.own[1], set: true } : { x: own.x, y: own.y },
			enemy: ov.enemy ? { x: ov.enemy[0], y: ov.enemy[1], set: true } : { x: enemy.x, y: enemy.y }
		};
	}

	// Starter setups: a shape to begin from. Players are placed by formula (hill, spawn zones, next hill), not on real cover.
	function toward(a, b, d) {
		var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, t = Math.min(d, L * 0.8) / L;
		return { x: a.x + dx * t, y: a.y + dy * t };
	}
	function spread(pts, pt) {
		for (var n = 0; n < 6; n++) {
			var hit = null;
			for (var j = 0; j < pts.length; j++) { if (dist(pt, pts[j]) < 0.05) { hit = pts[j]; break; } }
			if (!hit) break;
			var dx = pt.x - hit.x, dy = pt.y - hit.y, L = Math.hypot(dx, dy);
			if (L < 0.001) { dx = 0.7; dy = 0.7; L = 1; }
			pt = { x: clamp(pt.x + dx / L * 0.035, 0.02, 0.98), y: clamp(pt.y + dy / L * 0.035, 0.02, 0.98) };
		}
		pts.push(pt);
		return pt;
	}
	function ghost(i, pt, tipText) { return { t: 'icon', i: i, x: r4(pt.x), y: r4(pt.y), ghost: 1, tip: 'Starter \u00b7 ' + tipText }; }
	function starterItems() {
		var st = stepObj(), out = [], pts = [];
		if (!st) return out;
		if (S.mode === 'hp') {
			var hills = sortedHills(), i = hills.map(function (x) { return String(x.n); }).indexOf(st.k);
			var hl = hills[i], nx = hills[(i + 1) % hills.length], sp = hl ? hillSpawns(hl.n) : null;
			if (!hl || !sp) return out;
			out.push(ghost('sub', spread(pts, { x: hl.x + 0.03, y: hl.y + 0.008 }), 'Second SMG takes the hill. One player inside is enough.'));
			out.push(ghost('ar', spread(pts, toward(hl, sp.own, 0.12)), 'Main AR overlooks the hill with your spawn behind them and blocks the back.'));
			out.push(ghost('entry', spread(pts, toward(hl, sp.enemy, 0.11)), 'Entry SMG pushes out toward the enemy spawn and closes a lane.'));
			var f = spread(pts, toward(hl, nx, 0.1));
			out.push(ghost('flex', f, 'Flex sets up on the P' + nx.n + ' side and leaves first, with about 20 seconds left.'));
			out.push({ t: 'route', r: 'flex', p: [[r4(f.x), r4(f.y)], [r4(nx.x), r4(nx.y)]], ghost: 1 });
		} else if (S.mode === 'hj' && MAP.hj && MAP.hj.spike && (MAP.spawns || []).length === 2) {
			var ti = st.k === 't2' ? 1 : 0, mine = MAP.spawns[ti], theirs = MAP.spawns[1 - ti], cs = MAP.hj.commStations || [];
			if (cs.length < 2) return out;
			var near = function (q) { return cs.slice().sort(function (a, b) { return dist(a, q) - dist(b, q); })[0]; };
			var myCs = near(mine), enCs = near(theirs), k = MAP.hj.spike;
			var car = spread(pts, { x: k.x + 0.03, y: k.y + 0.008 });
			out.push(ghost('sub', car, 'Second SMG carries the Spike. Pass it before you die with it.'));
			out.push({ t: 'route', r: 'sub', p: [[r4(car.x), r4(car.y)], [r4(enCs.x), r4(enCs.y)]], ghost: 1 });
			out.push(ghost('entry', spread(pts, toward(k, enCs, dist(k, enCs) * 0.7)), 'Entry SMG leads forward and wins the fight at the enemy Comm Station before the Spike arrives.'));
			var mid = toward(k, enCs, dist(k, enCs) * 0.35), ex = enCs.x - k.x, ey = enCs.y - k.y, eL = Math.hypot(ex, ey) || 1;
			out.push(ghost('flex', spread(pts, { x: clamp(mid.x - ey / eL * 0.08, 0.02, 0.98), y: clamp(mid.y + ex / eL * 0.08, 0.02, 0.98) }), 'Flex escorts off to the side, trades, and picks up the Spike if the carrier falls.'));
			out.push(ghost('ar', spread(pts, toward(k, myCs, dist(k, myCs) * 0.45)), 'Main AR anchors between the middle and your own Comm Station.'));
		}
		return out;
	}

	// ---------- DOM: svg layers, hud ----------
	var gRot = s('g'), gSpawn = s('g'), gStart = s('g'), gIntel = s('g'), gPlan = s('g'), gObj = s('g'), gCall = s('g'), gTemp = s('g');
	[gRot, gSpawn, gStart, gIntel, gPlan, gObj, gCall, gTemp].forEach(function (g) { svg.appendChild(g); });
	var SC = { obj: [], rot: [], spawn: [], start: [], intel: [], plan: [], call: [], temp: [] };

	var hud = h('div', 'pl-hud', '<button type="button" data-zoom="in" aria-label="Zoom in">' + ico('plus') + '</button><button type="button" data-zoom="out" aria-label="Zoom out">' + ico('minus') + '</button><button type="button" data-zoom="fit" aria-label="Reset view">' + ico('fit') + '</button><button type="button" data-fs aria-label="Full screen">' + ico('expand') + '</button><button type="button" data-brief aria-label="Briefing view" title="Briefing view">' + ico('brief') + '</button>');
	var badge = h('div', 'pl-badge');
	var tip = h('div', 'pl-tip'); tip.hidden = true;
	var toastEl = h('div', 'pl-toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
	var stepBar = h('div', 'pl-steps'); stepBar.setAttribute('role', 'tablist'); stepBar.setAttribute('aria-label', 'Plan step'); stepBar.hidden = true;
	var briefBar = h('div', 'pl-brief'); briefBar.hidden = true;
	var coBar = h('div', 'pl-cobar', '<button type="button" data-co-cycle title="Show all callouts, only the main ones, or none"></button><button type="button" data-co-edit title="Rename, move, add or remove callouts"></button>');
	stage.appendChild(coBar);
	stage.appendChild(hud); stage.appendChild(badge); stage.appendChild(stepBar); stage.appendChild(tip); root.appendChild(briefBar); root.appendChild(toastEl);

	function toast(msg) {
		toastEl.textContent = msg;
		toastEl.classList.add('is-on');
		clearTimeout(toastEl._t);
		toastEl._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
	}
	function updateBadge() {
		badge.innerHTML = '<span>' + esc(modeName()) + '</span>' + (S.editIntel ? '<b>Editing official intel</b>' : '');
		badge.classList.toggle('is-edit', S.editIntel);
	}

	// ---------- camera ----------
	function measure() {
		var r = stage.getBoundingClientRect();
		var atMin = Math.abs(S.cam.k - S.kMin) < 1e-6 || lastK < 0;
		S.vw = Math.max(1, r.width); S.vh = Math.max(1, r.height);
		S.kMin = Math.min(S.vw, S.vh) / 1000 * 0.96;
		var nat = (MAP.image && MAP.image.w) ? MAP.image.w / 1000 : 2;
		S.kMax = Math.max(S.kMin * 4, nat * 2.2);
		if (atMin || S.cam.k < S.kMin) S.cam.k = S.kMin;
		svg.setAttribute('width', S.vw); svg.setAttribute('height', S.vh);
		lastK = -1; clampCam(); applyCam();
	}
	function clampCam() {
		S.cam.k = clamp(S.cam.k, S.kMin, S.kMax);
		S.cam.x = clamp(S.cam.x, 0, 1000);
		S.cam.y = clamp(S.cam.y, 0, 1000);
	}
	function clampTarget(t) { return { x: clamp(t.x, 0, 1000), y: clamp(t.y, 0, 1000), k: clamp(t.k, S.kMin, S.kMax) }; }
	function place(o, k) {
		o.el.setAttribute('transform', 'translate(' + r2(o.x) + ',' + r2(o.y) + ')' + (o.rot ? ' rotate(' + r2(o.rot) + ')' : '') + ' scale(' + (o.sc / k).toFixed(5) + ')');
	}
	function track(list, el, x, y, rot, sc) {
		var o = { el: el, x: x, y: y, rot: rot || 0, sc: sc || 1 };
		el.setAttribute('data-x', r2(x)); el.setAttribute('data-y', r2(y));
		if (rot) el.setAttribute('data-rot', r2(rot));
		if (sc && sc !== 1) el.setAttribute('data-sc', sc);
		list.push(o); place(o, S.cam.k);
		return o;
	}
	function applyCam() {
		var c = S.cam;
		if (img) img.style.transform = 'translate3d(' + (S.vw / 2 - c.x * c.k).toFixed(2) + 'px,' + (S.vh / 2 - c.y * c.k).toFixed(2) + 'px,0) scale(' + c.k.toFixed(5) + ')';
		svg.setAttribute('viewBox', (c.x - S.vw / (2 * c.k)).toFixed(3) + ' ' + (c.y - S.vh / (2 * c.k)).toFixed(3) + ' ' + (S.vw / c.k).toFixed(3) + ' ' + (S.vh / c.k).toFixed(3));
		if (Math.abs(c.k - lastK) > 1e-7) {
			lastK = c.k;
			Object.keys(SC).forEach(function (g) { var L = SC[g]; for (var i = 0; i < L.length; i++) place(L[i], c.k); });
			svg.classList.toggle('show-labels', c.k > S.kMin * 1.45);
		}
	}
	function startLoop() { if (!S.raf) { S.lastT = performance.now(); S.raf = requestAnimationFrame(tick); } }
	function stopAnim() { S.anim = null; S.vel = null; }
	function tick(t) {
		var dt = Math.min(48, t - S.lastT || 16), moving = false;
		S.lastT = t;
		if (S.anim) {
			var p = Math.min(1, (t - S.anim.t0) / S.anim.dur);
			var e = S.anim.dur > 400 ? (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2) : 1 - Math.pow(1 - p, 3);
			S.cam.x = lerp(S.anim.from.x, S.anim.to.x, e);
			S.cam.y = lerp(S.anim.from.y, S.anim.to.y, e);
			S.cam.k = Math.exp(lerp(Math.log(S.anim.from.k), Math.log(S.anim.to.k), e));
			if (p >= 1) S.anim = null; else moving = true;
		} else if (S.vel) {
			S.cam.x -= S.vel.x * dt / S.cam.k;
			S.cam.y -= S.vel.y * dt / S.cam.k;
			var f = Math.pow(0.93, dt / 16);
			S.vel.x *= f; S.vel.y *= f;
			if (Math.hypot(S.vel.x, S.vel.y) < 0.02) S.vel = null; else moving = true;
		}
		clampCam(); applyCam();
		S.raf = moving ? requestAnimationFrame(tick) : 0;
	}
	function animateTo(to, dur) {
		S.vel = null;
		S.anim = { from: { x: S.cam.x, y: S.cam.y, k: S.cam.k }, to: clampTarget(to), t0: performance.now(), dur: dur || 300 };
		startLoop();
	}
	function zoomAt(pt, factor, dur) {
		var base = S.anim ? S.anim.to : S.cam;
		var k = clamp(base.k * factor, S.kMin, S.kMax);
		var mx = base.x + (pt.x - S.vw / 2) / base.k, my = base.y + (pt.y - S.vh / 2) / base.k;
		animateTo({ x: mx - (pt.x - S.vw / 2) / k, y: my - (pt.y - S.vh / 2) / k, k: k }, dur || 260);
	}
	function fitView() { animateTo({ x: 500, y: 500, k: S.kMin }, 520); }
	function flyTo(x, y, kf) { animateTo({ x: x, y: y, k: Math.max(S.cam.k, S.kMin * (kf || 2.4)) }, 650); }
	function center() { return { x: S.vw / 2, y: S.vh / 2 }; }
	function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
	function toMap(pt) { return { x: S.cam.x + (pt.x - S.vw / 2) / S.cam.k, y: S.cam.y + (pt.y - S.vh / 2) / S.cam.k }; }

	// ---------- geometry ----------
	function smoothPath(pts) {
		var f = function (v) { return r2(v); };
		if (pts.length < 2) return '';
		var d = 'M' + f(pts[0][0]) + ',' + f(pts[0][1]);
		if (pts.length === 2) return d + 'L' + f(pts[1][0]) + ',' + f(pts[1][1]);
		for (var i = 0; i < pts.length - 1; i++) {
			var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
			d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ',' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
				f(p2[0] - (p3[0] - p1[0]) / 6) + ',' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ',' + f(p2[1]);
		}
		return d;
	}
	function segDist(p, a, b) {
		var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
		if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
		var t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
		return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
	}
	function simplify(pts, eps) {
		if (pts.length < 3) return pts;
		var dmax = 0, idx = 0, a = pts[0], b = pts[pts.length - 1];
		for (var i = 1; i < pts.length - 1; i++) {
			var d = segDist(pts[i], a, b);
			if (d > dmax) { dmax = d; idx = i; }
		}
		if (dmax > eps) {
			var l = simplify(pts.slice(0, idx + 1), eps), r = simplify(pts.slice(idx), eps);
			return l.slice(0, -1).concat(r);
		}
		return [a, b];
	}
	function pathLen(pts) {
		var L = 0;
		for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
		return L;
	}

	// ---------- rendering ----------
	function renderObj() {
		clear(gObj); SC.obj = [];
		if (!S.layers.obj) return;
		if (S.mode === 'hp') {
			var hsAll = sortedHills(), curI = S.step ? hsAll.map(function (x) { return String(x.n); }).indexOf(S.step) : -1;
			var nextN = curI >= 0 ? hsAll[(curI + 1) % hsAll.length].n : 0;
			hsAll.forEach(function (hl) {
				var x = hl.x * 1000, y = hl.y * 1000, sel = S.sel === 'h' + hl.n, dim = curI >= 0 && String(hl.n) !== S.step && hl.n !== nextN;
				var g = s('g', { 'class': 'mk mk-hill' + (sel ? ' is-sel' : '') + (dim ? ' is-dim' : ''), 'data-tip': 'P' + hl.n + ' \u00b7 ' + hl.name + (curI >= 0 && hl.n === nextN ? ' \u00b7 next hill' : ''), 'data-hill': hl.n });
				g.appendChild(s('circle', { r: 22, fill: 'rgba(216,169,75,0.22)', 'class': 'mk-halo' }));
				g.appendChild(s('circle', { r: 14.5, fill: '#d8a94b', stroke: '#1b1608', 'stroke-width': 2 }));
				g.appendChild(s('text', { y: 4.6, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, fill: '#1b1608', 'font-family': FONT }, 'P' + hl.n));
				gObj.appendChild(g); track(SC.obj, g, x, y);
				var lb = s('g', { 'class': 'mk-label' + (sel ? ' is-sel' : '') + (dim ? ' is-dim' : '') });
				lb.appendChild(s('text', { y: 34, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 650, fill: '#f3f1e6', stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 3.2, 'paint-order': 'stroke', 'font-family': FONT }, hl.name));
				gObj.appendChild(lb); track(SC.obj, lb, x, y);
			});
		} else if (S.mode === 'snd' && HAS_SND) {
			MAP.snd.sites.forEach(function (st) {
				var col = st.id === 'A' ? '#ff6b4a' : '#4fc3f7';
				var x = st.x * 1000, y = st.y * 1000;
				var g = s('g', { 'class': 'mk mk-site' + (S.sel === 's' + st.id ? ' is-sel' : ''), 'data-tip': st.id + ' bomb site' });
				g.appendChild(s('rect', { x: -24, y: -24, width: 48, height: 48, rx: 14, fill: col, opacity: 0.22, 'class': 'mk-halo' }));
				g.appendChild(s('rect', { x: -17, y: -17, width: 34, height: 34, rx: 10, fill: col, stroke: 'rgba(0,0,0,0.65)', 'stroke-width': 2 }));
				g.appendChild(s('text', { y: 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, fill: '#0b0d0a', 'font-family': FONT }, st.id));
				gObj.appendChild(g); track(SC.obj, g, x, y);
			});
			if (MAP.snd.bomb) {
				var b = MAP.snd.bomb, bx = b.x * 1000, by = b.y * 1000;
				var g2 = s('g', { 'class': 'mk mk-bomb', 'data-tip': 'Bomb spawn (attackers)' + (b.approx ? ' \u00b7 approximate' : '') });
				g2.appendChild(s('circle', { r: 16, fill: '#1a1c16', stroke: '#cbbd8f', 'stroke-width': 2 }));
				g2.appendChild(s('circle', { cx: -1, cy: 2, r: 7, fill: '#cbbd8f' }));
				g2.appendChild(s('path', { d: 'M4,-3 L8,-8 M9,-11 L10,-10 M11,-7 L12,-7', stroke: '#ffb74d', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }));
				gObj.appendChild(g2); track(SC.obj, g2, bx, by);
			}
		}
		if (S.mode === 'hj' && MAP.hj) {
			if (MAP.hj.spike) {
				var kx = MAP.hj.spike.x * 1000, ky = MAP.hj.spike.y * 1000;
				gObj.appendChild(s('circle', { cx: r2(kx), cy: r2(ky), r: 75, fill: 'rgba(216,169,75,0.12)', stroke: '#f0c66b', 'stroke-width': 2, 'stroke-dasharray': '8 7', 'vector-effect': 'non-scaling-stroke' }));
				var gk = s('g', { 'class': 'mk mk-spike', 'data-tip': 'Data Spike starts around the central area (approximate)' });
				gk.appendChild(s('circle', { r: 15, fill: '#d8a94b', stroke: '#1b1608', 'stroke-width': 2 }));
				gk.appendChild(s('text', { y: 4.2, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 850, fill: '#1b1608', 'font-family': FONT }, 'DS'));
				gObj.appendChild(gk); track(SC.obj, gk, kx, ky);
			}
			(MAP.hj.commStations || []).forEach(function (cs, i) {
				var ccol = i ? '#ff6b4a' : '#4fc3f7', cx0 = cs.x * 1000, cy0 = cs.y * 1000;
				if (cs.r) gObj.appendChild(s('circle', { cx: r2(cx0), cy: r2(cy0), r: r2(cs.r * 1000), fill: ccol, 'fill-opacity': 0.1, stroke: ccol, 'stroke-width': 2, 'stroke-dasharray': '8 7', 'vector-effect': 'non-scaling-stroke' }));
				var gc = s('g', { 'class': 'mk mk-comm', 'data-tip': cs.estimated ? 'Comm Station area \u00b7 estimated, not confirmed' : 'Comm Station' });
				gc.appendChild(s('path', { d: 'M0,-17 L15,-8.5 L15,8.5 L0,17 L-15,8.5 L-15,-8.5 Z', fill: '#12160c', stroke: ccol, 'stroke-width': 2.4 }));
				gc.appendChild(s('text', { y: 4.2, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 850, fill: ccol, 'font-family': FONT }, cs.estimated ? 'CS?' : 'CS'));
				gObj.appendChild(gc); track(SC.obj, gc, cx0, cy0);
			});
			(MAP.hj.spawns || []).forEach(function (sp, i) {
				var scol = i ? '#ff6b4a' : '#4fc3f7';
				var gs = s('g', { 'class': 'mk mk-spawn', 'data-tip': 'Team spawn \u00b7 official tac map' });
				gs.appendChild(s('rect', { x: -24, y: -24, width: 48, height: 48, rx: 14, fill: scol, opacity: 0.22, 'class': 'mk-halo' }));
				gs.appendChild(s('rect', { x: -17, y: -17, width: 34, height: 34, rx: 10, fill: scol, stroke: 'rgba(0,0,0,0.65)', 'stroke-width': 2 }));
				gs.appendChild(s('text', { y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 900, fill: '#0b0d0a', 'font-family': FONT }, 'SP'));
				gObj.appendChild(gs); track(SC.obj, gs, sp.x * 1000, sp.y * 1000);
			});
		}
	}

	function renderRot() {
		clear(gRot); SC.rot = [];
		if (S.mode !== 'hp' || !S.layers.rot || !S.layers.obj) return;
		var hl = sortedHills();
		for (var i = 0; i < hl.length; i++) {
			var a = hl[i], b = hl[(i + 1) % hl.length], last = !S.step && i === hl.length - 1;
			if (S.step && String(a.n) !== S.step) continue;
			var x1 = a.x * 1000, y1 = a.y * 1000, x2 = b.x * 1000, y2 = b.y * 1000;
			var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
			var cx = (x1 + x2) / 2 - dy / len * len * 0.13, cy = (y1 + y2) / 2 + dx / len * len * 0.13;
			var col = last ? 'rgba(216,169,75,0.38)' : 'rgba(240,198,107,0.9)';
			gRot.appendChild(s('path', { d: 'M' + r2(x1) + ',' + r2(y1) + ' Q' + r2(cx) + ',' + r2(cy) + ' ' + r2(x2) + ',' + r2(y2), fill: 'none', stroke: 'rgba(0,0,0,0.5)', 'stroke-width': 5, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }));
			gRot.appendChild(s('path', { d: 'M' + r2(x1) + ',' + r2(y1) + ' Q' + r2(cx) + ',' + r2(cy) + ' ' + r2(x2) + ',' + r2(y2), fill: 'none', stroke: col, 'stroke-width': 2.4, 'stroke-dasharray': '8 7', 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'class': 'rot-dash' }));
			var t = 0.55, it = 1 - t;
			var px = it * it * x1 + 2 * it * t * cx + t * t * x2, py = it * it * y1 + 2 * it * t * cy + t * t * y2;
			var tx = 2 * it * (cx - x1) + 2 * t * (x2 - cx), ty = 2 * it * (cy - y1) + 2 * t * (y2 - cy);
			var ar = s('path', { d: 'M7,0 L-6,-6.5 L-3,0 L-6,6.5 Z', fill: last ? 'rgba(216,169,75,0.5)' : '#f0c66b', stroke: 'rgba(0,0,0,0.65)', 'stroke-width': 1.2 });
			gRot.appendChild(ar); track(SC.rot, ar, px, py, Math.atan2(ty, tx) * 180 / Math.PI);
		}
	}

	function layerOn(t) {
		if (t === 'route' || t === 'icon') return S.layers.route;
		if (t === 'enemy') return S.layers.enemy;
		if (t === 'strong') return S.layers.strong;
		if (t === 'note' || t === 'text') return S.layers.note;
		return true;
	}

	function drawItem(parent, list, it, idx) {
		var ia = idx >= 0 ? idx : null;
		if (it.t === 'route' || it.t === 'enemy') {
			var pts = (it.p || []).map(function (q) { return [q[0] * 1000, q[1] * 1000]; });
			if (pts.length < 2) return;
			var col = it.t === 'enemy' ? '#ff5a5a' : ((ROLE[it.r] || ROLE.team).color);
			var d = smoothPath(pts);
			var g = s('g', { 'class': 'it it-' + it.t, 'data-idx': ia });
			g.appendChild(s('path', { d: d, fill: 'none', stroke: 'rgba(0,0,0,0.6)', 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }));
			g.appendChild(s('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': it.t === 'enemy' ? '10 8' : (it.ghost ? '3 8' : null), 'vector-effect': 'non-scaling-stroke' }));
			if (it.ghost) g.setAttribute('opacity', '0.7');
			if (ia !== null) g.appendChild(s('path', { d: d, fill: 'none', stroke: 'rgba(0,0,0,0)', 'stroke-width': 20, 'vector-effect': 'non-scaling-stroke', 'class': 'hit' }));
			parent.appendChild(g);
			var n = pts.length, b = pts[n - 1], a = pts[n - 2];
			for (var j = n - 2; j >= 0; j--) { if (Math.hypot(b[0] - pts[j][0], b[1] - pts[j][1]) > 3) { a = pts[j]; break; } }
			var head = s('path', { d: 'M10,0 L-6,-7.5 L-2.5,0 L-6,7.5 Z', fill: col, stroke: 'rgba(0,0,0,0.65)', 'stroke-width': 1.3, 'data-idx': ia, opacity: it.ghost ? 0.7 : null });
			parent.appendChild(head); track(list, head, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI);
			return;
		}
		var x = it.x * 1000, y = it.y * 1000, g2;
		if (it.t === 'strong') {
			g2 = s('g', { 'class': 'it it-strong', 'data-idx': ia, 'data-tip': it.s ? 'Strong point \u00b7 ' + it.s : 'Strong point' });
			g2.appendChild(s('path', { d: 'M0,-15 L12,-10 L12,0 C12,8 6.5,13 0,16 C-6.5,13 -12,8 -12,0 L-12,-10 Z', fill: '#d8a94b', stroke: '#1b1608', 'stroke-width': 2 }));
			g2.appendChild(s('path', { d: 'M0,-7 L2.4,-2 L7.6,-1.6 L3.6,1.8 L4.8,7 L0,4.2 L-4.8,7 L-3.6,1.8 L-7.6,-1.6 L-2.4,-2 Z', fill: '#1b1608' }));
		} else if (it.t === 'icon') {
			var c = ICONS[it.i] || ICONS.ar;
			g2 = s('g', { 'class': 'it it-icon', 'data-idx': ia, 'data-tip': c.name });
			if (it.ghost) g2.appendChild(s('circle', { r: 20, fill: 'rgba(0,0,0,0.35)', stroke: c.color, 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }));
			g2.appendChild(s('circle', { r: 14, fill: c.color, stroke: 'rgba(0,0,0,0.7)', 'stroke-width': 2 }));
			g2.appendChild(s('text', { y: c.label.length > 2 ? 3.6 : 4.4, 'text-anchor': 'middle', 'font-size': c.label.length > 2 ? 9.5 : 12, 'font-weight': 850, fill: c.ink, 'font-family': FONT }, c.label));
		} else if (it.t === 'text') {
			var txt = String(it.s || '');
			var w = Math.min(260, txt.length * 6.7 + 18);
			g2 = s('g', { 'class': 'it it-text', 'data-idx': ia });
			g2.appendChild(s('rect', { x: -w / 2, y: -12, width: w, height: 24, rx: 12, fill: 'rgba(10,12,9,0.88)', stroke: 'rgba(240,198,107,0.6)', 'stroke-width': 1.2 }));
			g2.appendChild(s('text', { y: 4.2, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 650, fill: '#f3f1e6', 'font-family': FONT }, txt));
		} else if (it.t === 'note') {
			g2 = s('g', { 'class': 'it it-note', 'data-idx': ia, 'data-tip': 'Coach: ' + (it.s || '') });
			g2.appendChild(s('path', { d: 'M-13,-13 H13 V7 H-2 L-9,14 V7 H-13 Z', fill: '#a3b37c', stroke: '#13170c', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
			g2.appendChild(s('text', { y: 1.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 900, fill: '#13170c', 'font-family': FONT }, 'i'));
		} else {
			return;
		}
		if (it.tip) g2.setAttribute('data-tip', it.tip);
		if (it.ghost) g2.setAttribute('class', g2.getAttribute('class') + ' is-ghost');
		parent.appendChild(g2); track(list, g2, x, y);
	}

	function renderItems() {
		clear(gIntel); clear(gPlan); SC.intel = []; SC.plan = [];
		(S.intel[S.mode] || []).forEach(function (it, i) { if (layerOn(it.t) && inStep(it)) drawItem(gIntel, SC.intel, it, S.editIntel ? i : -1); });
		if (S.layers.plan) (S.plans[S.mode] || []).forEach(function (it, i) { if (inStep(it)) drawItem(gPlan, SC.plan, it, S.editIntel ? -1 : i); });
		gPlan.setAttribute('opacity', S.editIntel ? '0.35' : '1');
	}
	// Starter setup: shown for the picked step until the team has drawn its own plan for that step.
	function renderStarter() {
		clear(gStart); SC.start = [];
		if (!S.layers.starter || !S.step || S.editIntel || S.brief || stepItems().length) return;
		starterItems().forEach(function (it) { drawItem(gStart, SC.start, it, -1); });
	}
	function spawnMark(x, y, col, label, tipText, which) {
		var g = s('g', { 'class': 'mk mk-sp', 'data-tip': tipText, 'data-sp': which || null });
		g.appendChild(s('rect', { x: -21, y: -11, width: 42, height: 22, rx: 7, fill: '#10140c', stroke: col, 'stroke-width': 2 }));
		g.appendChild(s('text', { y: 3.8, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 850, 'letter-spacing': 0.3, fill: col, 'font-family': FONT }, label));
		gSpawn.appendChild(g); track(SC.spawn, g, x * 1000, y * 1000);
	}
	function renderSpawns() {
		clear(gSpawn); SC.spawn = [];
		if (!S.layers.spawns) return;
		var sp = MAP.spawns || [], zones = (S.mode === 'hp' && S.step) ? hillSpawns(S.step) : null;
		if (zones) {
			[['own', '#4fc3f7', 'HOLD', 'Likely spawn for the team holding P' + S.step], ['enemy', '#ff5a5a', 'BREAK', 'Likely spawn for the team breaking P' + S.step]].forEach(function (d) {
				var z = zones[d[0]];
				gSpawn.appendChild(s('circle', { cx: r2(z.x * 1000), cy: r2(z.y * 1000), r: 62, fill: d[1], 'fill-opacity': 0.09, stroke: d[1], 'stroke-width': 2, 'stroke-dasharray': z.set ? null : '8 7', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
				spawnMark(z.x, z.y, d[1], d[2], d[3] + (z.set ? ' \u00b7 set by your team' : ' \u00b7 estimate, not confirmed'), d[0]);
			});
		}
		if (S.mode === 'hj' && S.layers.obj && MAP.hj) return; // Hijack already draws the team spawns as objectives
		var atk = -1;
		if (S.mode === 'snd' && MAP.snd && MAP.snd.bomb && sp.length === 2) atk = dist(sp[0], MAP.snd.bomb) <= dist(sp[1], MAP.snd.bomb) ? 0 : 1;
		sp.forEach(function (q, i) {
			if (zones && (dist(q, zones.own) < 0.045 || dist(q, zones.enemy) < 0.045)) return;
			var label = atk < 0 ? 'START' : (i === atk ? 'ATK' : 'DEF');
			var tipText = (atk < 0 ? 'Team ' + q.team + ' starts here' : (i === atk ? 'Attackers start here' : 'Defenders start here')) + ' \u00b7 official tac map';
			spawnMark(q.x, q.y, i ? '#ffb38a' : '#9bdcf7', label, tipText);
		});
	}
	function renderCallouts() {
		clear(gCall); SC.call = [];
		var edit = S.tool === 'layers';
		if (!S.layers.callouts && !edit) return;
		callouts().forEach(function (c, i) {
			var det = c.k === 'detail';
			if (det && !S.layers.detail && !edit) return;
			var txt = String(c.s || '').toUpperCase(), fs = det ? 8.4 : 10.4, hh = det ? 15 : 20, w = Math.min(240, txt.length * (det ? 5.4 : 6.6) + (det ? 11 : 16)), team = c.k === 'team';
			var g = s('g', { 'class': 'co' + (team ? ' co-team' : '') + (det ? ' co-detail' : '') + (edit ? ' is-edit' : ''), 'data-co': edit ? i : null });
			g.appendChild(s('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: det ? 4.5 : 6, fill: det ? 'rgba(8,10,7,0.66)' : 'rgba(8,10,7,0.82)', stroke: team ? 'rgba(240,198,107,0.8)' : (det ? 'rgba(163,179,124,0.42)' : 'rgba(233,236,223,0.3)'), 'stroke-width': det ? 0.9 : 1.1, 'stroke-dasharray': edit ? '3 2' : null }));
			g.appendChild(s('text', { y: det ? 3 : 3.7, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': det ? 700 : 750, 'letter-spacing': 0.5, fill: team ? '#f0c66b' : (det ? '#cdd6b4' : '#e9ecdf'), 'font-family': FONT }, txt));
			gCall.appendChild(g); track(SC.call, g, c.x * 1000, c.y * 1000);
		});
	}
	function renderAll() { renderRot(); renderSpawns(); renderObj(); renderStarter(); renderItems(); renderCallouts(); lastK = -1; applyCam(); syncCoBar(); }

	function renderTemp(pts, tool) {
		clear(gTemp); SC.temp = [];
		var col = tool === 'enemy' ? '#ff5a5a' : (ROLE[S.role] || ROLE.team).color;
		gTemp.appendChild(s('path', { d: smoothPath(pts), fill: 'none', stroke: col, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': tool === 'enemy' ? '10 8' : null, 'vector-effect': 'non-scaling-stroke', opacity: 0.9 }));
	}
	function cancelTemp() { clear(gTemp); SC.temp = []; }

	// ---------- edits ----------
	function pushHistory() {
		S.history.push(JSON.stringify(currentItems()));
		if (S.history.length > 80) S.history.shift();
		S.future = [];
	}
	function changed() {
		renderItems(); renderStarter(); lastK = -1; applyCam();
		renderSteps(); if (S.brief) renderBrief();
		if (S.editIntel) {
			S.intelDirty = true;
		} else {
			clearTimeout(saveTimer);
			saveTimer = setTimeout(function () {
				try { localStorage.setItem(lsKey(S.mode), JSON.stringify(S.plans[S.mode])); } catch (e5) { /* storage full */ }
			}, 250);
		}
		refreshCounts();
	}
	function undo() {
		if (!S.history.length) return;
		S.future.push(JSON.stringify(currentItems()));
		setCurrentItems(JSON.parse(S.history.pop()));
		changed();
	}
	function redo() {
		if (!S.future.length) return;
		S.history.push(JSON.stringify(currentItems()));
		setCurrentItems(JSON.parse(S.future.pop()));
		changed();
	}
	function eraseIdx(i) {
		var items = currentItems();
		if (i < 0 || i >= items.length) return;
		pushHistory(); items.splice(i, 1); changed();
	}
	function isPointItem(i) { var it = currentItems()[i]; return !!(it && it.t !== 'route' && it.t !== 'enemy'); }
	function addItem(it) { if (S.step && !S.editIntel && !it.st) it.st = S.step; pushHistory(); currentItems().push(it); changed(); }

	function closePop() { if (pop) { pop.remove(); pop = null; } }
	function openPop(pt, placeholder, cb) {
		closePop();
		pop = h('form', 'pl-pop', '<input type="text" maxlength="140" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '"><button type="submit" class="btn btn-sm btn-primary">Add</button>');
		pop.style.left = Math.round(clamp(pt.x - 20, 8, S.vw - 270)) + 'px';
		pop.style.top = Math.round(clamp(pt.y + 16, 8, S.vh - 64)) + 'px';
		stage.appendChild(pop);
		var inp = pop.querySelector('input');
		setTimeout(function () { inp.focus(); }, 10);
		pop.addEventListener('submit', function (e) {
			e.preventDefault();
			var v = inp.value.trim();
			closePop(); stage.focus({ preventScroll: true });
			if (v) cb(v);
		});
		inp.addEventListener('keydown', function (e) {
			e.stopPropagation();
			if (e.key === 'Escape') { e.preventDefault(); closePop(); stage.focus({ preventScroll: true }); }
		});
	}
	function refreshLayers() { renderSpawns(); renderStarter(); renderCallouts(); lastK = -1; applyCam(); syncCoBar(); }
	function openCalloutPop(pt, idx) {
		closePop();
		var cur = idx >= 0 ? callouts()[idx] : null, mp = toMap(pt), was = cur ? cur.s : '';
		pop = h('form', 'pl-pop pl-pop-co', '<input type="text" maxlength="40" placeholder="Callout name" aria-label="Callout name" value="' + esc(cur ? cur.s : S.coPick) + '"><button type="submit" class="btn btn-sm btn-primary">' + (cur ? 'Save' : 'Add') + '</button>' +
			(cur ? '<button type="button" class="btn btn-sm btn-ghost" data-co-del aria-label="Delete callout" title="Delete callout">' + ico('trash') + '</button>' : ''));
		pop.style.left = Math.round(clamp(pt.x - 20, 8, S.vw - 330)) + 'px';
		pop.style.top = Math.round(clamp(pt.y + 16, 8, S.vh - 64)) + 'px';
		stage.appendChild(pop);
		var inp = pop.querySelector('input');
		setTimeout(function () { inp.focus(); inp.select(); }, 10);
		var done = function () { closePop(); stage.focus({ preventScroll: true }); saveTeam(); refreshLayers(); renderPlanPane(); };
		pop.addEventListener('submit', function (e) {
			e.preventDefault();
			var v = inp.value.trim().slice(0, 40);
			if (!v) { closePop(); return; }
			var list = editCallouts();
			if (cur) { if (v !== was) { list[idx].s = v; list[idx].k = 'team'; } }
			else list.push({ id: 'c' + Date.now().toString(36), s: v, x: r4(clamp(mp.x / 1000, 0, 1)), y: r4(clamp(mp.y / 1000, 0, 1)), k: 'team' });
			if (S.coPick === v) S.coPick = '';
			done();
		});
		pop.addEventListener('click', function (e) { if (e.target.closest('[data-co-del]')) { editCallouts().splice(idx, 1); done(); } });
		inp.addEventListener('keydown', function (e) {
			e.stopPropagation();
			if (e.key === 'Escape') { e.preventDefault(); closePop(); stage.focus({ preventScroll: true }); }
		});
	}
	function tapLayers(pt) {
		if (!S.coPick) { openCalloutPop(pt, -1); return; }
		var mp = toMap(pt), name = S.coPick;
		editCallouts().push({ id: 'c' + Date.now().toString(36), s: name, x: r4(clamp(mp.x / 1000, 0, 1)), y: r4(clamp(mp.y / 1000, 0, 1)), k: 'team' });
		S.coPick = ''; saveTeam(); refreshLayers(); renderPlanPane();
		toast('Added \u201c' + name + '\u201d');
	}
	function placeAt(mp, pt) {
		var x = r4(clamp(mp.x / 1000, 0, 1)), y = r4(clamp(mp.y / 1000, 0, 1));
		if (S.tool === 'strong') addItem({ t: 'strong', x: x, y: y });
		else if (S.tool === 'icon') addItem({ t: 'icon', x: x, y: y, i: S.icon });
		else if (S.tool === 'text') openPop(pt, 'Label text', function (v) { addItem({ t: 'text', x: x, y: y, s: v }); });
		else if (S.tool === 'note') openPop(pt, 'Coaching note', function (v) { addItem({ t: 'note', x: x, y: y, s: v }); });
	}

	// ---------- tooltips ----------
	function showTip(text, pt) {
		tip.textContent = text; tip.hidden = false;
		tip.style.transform = 'translate(' + Math.round(clamp(pt.x + 14, 8, S.vw - 240)) + 'px,' + Math.round(clamp(pt.y + 14, 8, S.vh - 44)) + 'px)';
	}
	function hideTip() { tip.hidden = true; }

	function selectHill(n) {
		if (S.mode === 'hp' && !S.editIntel && S.step !== String(n)) { setStep(String(n), false); return; }
		S.sel = 'h' + n; renderObj(); lastK = -1; applyCam();
		Array.prototype.forEach.call(panel.querySelectorAll('[data-fly-hill]'), function (b) { b.classList.toggle('is-sel', +b.getAttribute('data-fly-hill') === n); });
	}

	// ---------- pointer input ----------
	var pointers = new Map(), gesture = null;
	stage.addEventListener('pointerdown', function (e) {
		if (e.button === 2 || (e.target.closest && e.target.closest('.pl-hud,.pl-cobar,.pl-pop,.pl-steps'))) return;
		var pt = local(e);
		var target = e.target.closest ? e.target.closest('[data-idx]') : null;
		pointers.set(e.pointerId, pt);
		try { stage.setPointerCapture(e.pointerId); } catch (e6) { /* ignore */ }
		stage.focus({ preventScroll: true });
		hideTip(); closePop();
		S.anim = null; S.vel = null;
		if (pointers.size === 2) {
			cancelTemp();
			var ps = Array.from(pointers.values());
			gesture = { type: 'pinch', d0: Math.max(10, dist(ps[0], ps[1])), k0: S.cam.k, c0: { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }, cam0: { x: S.cam.x, y: S.cam.y } };
			return;
		}
		if (pointers.size > 2) return;
		var mp = toMap(pt);
		if (S.tool === 'layers' && e.button === 0 && !spaceDown && e.target.closest) {
			var coEl = e.target.closest('[data-co]'), spEl = e.target.closest('[data-sp]');
			if (coEl) { gesture = { type: 'codrag', idx: +coEl.getAttribute('data-co'), start: pt, moved: false }; return; }
			if (spEl && S.mode === 'hp' && S.step) { gesture = { type: 'spdrag', which: spEl.getAttribute('data-sp'), start: pt, moved: false }; return; }
		}
		if (S.tool === 'erase' && e.button === 0 && !spaceDown) {
			gesture = { type: 'erase', target: e.target };
			if (target) eraseIdx(+target.getAttribute('data-idx'));
			return;
		}
		if (S.tool === 'pan' || S.tool === 'layers' || e.button === 1 || spaceDown) {
			if (target && S.tool === 'pan' && !spaceDown && isPointItem(+target.getAttribute('data-idx'))) {
				pushHistory();
				gesture = { type: 'drag', idx: +target.getAttribute('data-idx'), start: pt, moved: false, target: e.target };
			} else {
				gesture = { type: 'pan', start: pt, last: pt, t: performance.now(), vx: 0, vy: 0, moved: false, target: e.target };
				stage.classList.add('is-grabbing');
			}
			return;
		}
		if (S.tool === 'route' || S.tool === 'enemy') {
			gesture = { type: 'draw', pts: [[mp.x, mp.y]], last: pt, tool: S.tool };
			renderTemp(gesture.pts, S.tool);
			return;
		}
		gesture = { type: 'place', start: pt, mp: mp, target: e.target };
	});
	stage.addEventListener('pointermove', function (e) {
		var pt = local(e);
		if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pt);
		if (!gesture) {
			if (e.pointerType === 'mouse') {
				var t = e.target.closest ? e.target.closest('[data-tip]') : null;
				if (t) showTip(t.getAttribute('data-tip'), pt); else hideTip();
			}
			return;
		}
		if (gesture.type === 'pinch') {
			if (pointers.size < 2) return;
			var ps = Array.from(pointers.values());
			var d = dist(ps[0], ps[1]), c = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
			var k = clamp(gesture.k0 * d / gesture.d0, S.kMin, S.kMax);
			var mx = gesture.cam0.x + (gesture.c0.x - S.vw / 2) / gesture.k0, my = gesture.cam0.y + (gesture.c0.y - S.vh / 2) / gesture.k0;
			S.cam.k = k; S.cam.x = mx - (c.x - S.vw / 2) / k; S.cam.y = my - (c.y - S.vh / 2) / k;
			clampCam(); applyCam();
			return;
		}
		if (gesture.type === 'pan') {
			var now = performance.now(), dt = Math.max(1, now - gesture.t);
			var dx = pt.x - gesture.last.x, dy = pt.y - gesture.last.y;
			if (Math.abs(pt.x - gesture.start.x) + Math.abs(pt.y - gesture.start.y) > 4) gesture.moved = true;
			S.cam.x -= dx / S.cam.k; S.cam.y -= dy / S.cam.k;
			gesture.vx = 0.8 * (dx / dt) + 0.2 * gesture.vx; gesture.vy = 0.8 * (dy / dt) + 0.2 * gesture.vy;
			gesture.last = pt; gesture.t = now;
			clampCam(); applyCam();
			return;
		}
		if (gesture.type === 'drag') {
			if (dist(pt, gesture.start) < 3 && !gesture.moved) return;
			var m2 = toMap(pt), it2 = currentItems()[gesture.idx];
			if (it2) { it2.x = r4(clamp(m2.x / 1000, 0, 1)); it2.y = r4(clamp(m2.y / 1000, 0, 1)); gesture.moved = true; renderItems(); lastK = -1; applyCam(); }
			return;
		}
		if (gesture.type === 'codrag') {
			if (dist(pt, gesture.start) < 3 && !gesture.moved) return;
			var mc = toMap(pt), cl = editCallouts()[gesture.idx];
			if (cl) { cl.x = r4(clamp(mc.x / 1000, 0, 1)); cl.y = r4(clamp(mc.y / 1000, 0, 1)); gesture.moved = true; renderCallouts(); lastK = -1; applyCam(); }
			return;
		}
		if (gesture.type === 'spdrag') {
			if (dist(pt, gesture.start) < 3 && !gesture.moved) return;
			var ms = toMap(pt), ov = TEAM.spawns[S.step] || (TEAM.spawns[S.step] = {});
			ov[gesture.which] = [r4(clamp(ms.x / 1000, 0, 1)), r4(clamp(ms.y / 1000, 0, 1))];
			gesture.moved = true; renderSpawns(); renderStarter(); lastK = -1; applyCam();
			return;
		}
		if (gesture.type === 'draw') {
			if (dist(pt, gesture.last) > 3) {
				var m3 = toMap(pt);
				gesture.pts.push([m3.x, m3.y]); gesture.last = pt;
				renderTemp(gesture.pts, gesture.tool);
			}
			return;
		}
		if (gesture.type === 'erase' && e.buttons) {
			var el = document.elementFromPoint(e.clientX, e.clientY);
			var t2 = el && el.closest ? el.closest('[data-idx]') : null;
			if (t2 && svg.contains(t2)) eraseIdx(+t2.getAttribute('data-idx'));
		}
	});
	function endPointer(e) {
		var pt = local(e);
		pointers.delete(e.pointerId);
		if (!gesture) return;
		var g = gesture;
		if (g.type === 'pinch') { if (pointers.size < 2) gesture = null; return; }
		gesture = null;
		stage.classList.remove('is-grabbing');
		if (g.type === 'codrag') {
			if (!g.moved) openCalloutPop(pt, g.idx); else { saveTeam(); renderPlanPane(); }
			return;
		}
		if (g.type === 'spdrag') {
			if (g.moved) { saveTeam(); renderPlanPane(); toast('Spawn zone saved for your team'); }
			return;
		}
		if (g.type === 'pan') {
			if (!g.moved && S.tool === 'layers' && e.type !== 'pointercancel' && !(g.target && g.target.closest && g.target.closest('.mk,[data-co]'))) { tapLayers(pt); return; }
			if (!g.moved) { handleTap(pt, g.target); return; }
			if (Math.hypot(g.vx, g.vy) > 0.2 && performance.now() - g.t < 90) { S.vel = { x: g.vx, y: g.vy }; startLoop(); }
			return;
		}
		if (g.type === 'drag') {
			if (!g.moved) { S.history.pop(); handleTap(pt, g.target); } else { changed(); }
			return;
		}
		if (g.type === 'draw') {
			cancelTemp();
			if (e.type === 'pointercancel') return;
			var simp = simplify(g.pts, 1.6 / S.cam.k);
			if (simp.length < 2 || pathLen(simp) < 10 / S.cam.k) return;
			addItem({ t: g.tool, p: simp.map(function (q) { return [r4(clamp(q[0] / 1000, 0, 1)), r4(clamp(q[1] / 1000, 0, 1))]; }), r: g.tool === 'route' ? S.role : 'enemy' });
			return;
		}
		if (g.type === 'place' && e.type !== 'pointercancel' && dist(pt, g.start) < 7) placeAt(g.mp, pt);
	}
	stage.addEventListener('pointerup', endPointer);
	stage.addEventListener('pointercancel', endPointer);
	stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !gesture) hideTip(); });
	function handleTap(pt, targetEl) {
		var now = performance.now();
		if (now - lastTap.t < 320 && dist(pt, lastTap) < 24) { zoomAt(pt, 2, 340); lastTap.t = 0; return; }
		lastTap = { t: now, x: pt.x, y: pt.y };
		var t = targetEl && targetEl.closest ? targetEl.closest('[data-tip]') : null;
		if (t) {
			showTip(t.getAttribute('data-tip'), pt);
			clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 2600);
			var hl = t.closest('[data-hill]');
			if (hl) selectHill(+hl.getAttribute('data-hill'));
		}
	}
	stage.addEventListener('wheel', function (e) {
		if (e.target.closest && e.target.closest('.pl-pop')) return;
		e.preventDefault();
		var pt = local(e);
		var dy = e.deltaY * (e.deltaMode === 1 ? 33 : (e.deltaMode === 2 ? 400 : 1));
		var dx = e.deltaX * (e.deltaMode === 1 ? 33 : (e.deltaMode === 2 ? 400 : 1));
		if (!e.ctrlKey && Math.abs(dx) > 0.5 && Math.abs(dx) >= Math.abs(dy) * 0.5) {
			S.anim = null; S.vel = null;
			S.cam.x += dx / S.cam.k; S.cam.y += dy / S.cam.k;
			clampCam(); applyCam();
			return;
		}
		zoomAt(pt, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), 180);
	}, { passive: false });
	stage.addEventListener('dblclick', function (e) { e.preventDefault(); });

	function coState() { return !S.layers.callouts ? 0 : (nDetail() && S.layers.detail ? 2 : 1); }
	function syncCoBar() {
		var st = coState(), edit = S.tool === 'layers', b = coBar.children;
		b[0].textContent = 'Callouts: ' + (st === 0 ? 'Off' : (st === 2 ? 'All' : (nDetail() ? 'Main' : 'On')));
		b[0].classList.toggle('is-off', st === 0);
		b[1].textContent = edit ? 'Done' : 'Edit names';
		b[1].classList.toggle('is-on', edit);
		b[1].hidden = !!S.brief;
	}
	coBar.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		if (b.hasAttribute('data-co-cycle')) {
			// All -> Main -> Off -> All (maps without detailed callouts just go On -> Off).
			var st = coState();
			if (st === 2) { S.layers.detail = false; } else if (st === 1) { S.layers.callouts = false; } else { S.layers.callouts = true; S.layers.detail = true; }
			saveLayerPrefs(); refreshLayers();
			if (paneEl('intel')) renderIntelPane();
		} else if (b.hasAttribute('data-co-edit')) {
			setTool(S.tool === 'layers' ? 'pan' : 'layers');
			if (S.tool === 'layers') { root.classList.remove('panel-open'); toast('Tap a callout to rename it, drag to move it, tap the map to add one'); }
		}
		syncCoBar();
	});
	hud.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		var z = b.getAttribute('data-zoom');
		if (z === 'in') zoomAt(center(), 1.6, 320);
		else if (z === 'out') zoomAt(center(), 1 / 1.6, 320);
		else if (z === 'fit') fitView();
		else if (b.hasAttribute('data-brief')) setBrief(!S.brief);
		else if (b.hasAttribute('data-fs')) {
			if (document.fullscreenElement) { document.exitFullscreen(); }
			else if (root.requestFullscreen) { root.requestFullscreen().catch(function () { toast('Full screen not available'); }); }
			else if (root.webkitRequestFullscreen) { root.webkitRequestFullscreen(); }
		}
	});

	// ---------- keyboard ----------
	root.addEventListener('keydown', function (e) {
		var tag = (e.target.tagName || '').toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
		var k = e.key;
		if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
		if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (tag === 'button' && (k === ' ' || k === 'Enter')) return;
		if (k === '+' || k === '=') { e.preventDefault(); zoomAt(center(), 1.5, 280); }
		else if (k === '-' || k === '_') { e.preventDefault(); zoomAt(center(), 1 / 1.5, 280); }
		else if (k === '0') { e.preventDefault(); fitView(); }
		else if (k === 'Escape') { cancelTemp(); closePop(); hideTip(); gesture = null; if (S.brief && !document.fullscreenElement) setBrief(false); }
		else if (k === '[' || k === ']') { e.preventDefault(); stepMove(k === ']' ? 1 : -1); }
		else if (S.brief && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); stepMove(k === 'ArrowRight' ? 1 : -1); }
		else if (k === ' ') { e.preventDefault(); spaceDown = true; stage.classList.add('is-space'); }
		else if (k.indexOf('Arrow') === 0) {
			e.preventDefault();
			var step = 90 / S.cam.k;
			animateTo({ x: S.cam.x + (k === 'ArrowRight' ? step : (k === 'ArrowLeft' ? -step : 0)), y: S.cam.y + (k === 'ArrowDown' ? step : (k === 'ArrowUp' ? -step : 0)), k: S.cam.k }, 200);
		} else {
			var tl = TOOLS.filter(function (x) { return x.key === k.toLowerCase(); })[0];
			if (tl) { e.preventDefault(); setTool(tl.k); if (S.tab !== 'plan') setTab('plan'); }
		}
	});
	root.addEventListener('keyup', function (e) { if (e.key === ' ') { spaceDown = false; stage.classList.remove('is-space'); } });

	// ---------- panel ----------
	function paneEl(name) { return panel.querySelector('[data-pane="' + name + '"]'); }
	function srcLine(list) {
		var seen = {}, out = [];
		list.forEach(function (src) {
			if (src && src.url && !seen[src.url]) { seen[src.url] = 1; out.push('<a href="' + esc(src.url) + '" target="_blank" rel="noopener nofollow">' + esc(src.label) + '</a>'); }
		});
		return out.length ? '<p class="pl-src">Source: ' + out.join(', ') + '</p>' : '';
	}
	function countOf(t) { return (S.intel[S.mode] || []).filter(function (it) { return it.t === t; }).length; }
	function layerToggle(key, label, count) {
		return '<label class="pl-toggle"><input type="checkbox" data-layer="' + key + '"' + (S.layers[key] ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span class="pl-tl">' + esc(label) + '</span>' + (count !== undefined ? '<em data-count="' + key + '">' + count + '</em>' : '') + '</label>';
	}

	function buildPanel() {
		var mapOpts = (D.maps || []).map(function (m) { return '<option value="' + esc(m.url) + '"' + (m.slug === MAP.slug ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
		panel.innerHTML =
			'<button class="pl-grab" type="button" aria-label="Show or hide the planner panel"><span></span></button>' +
			'<div class="pl-head">' +
				'<div class="pl-crumbs"><a href="' + esc(D.links.maps) + '">' + ico('back') + 'All maps</a><select data-map-switch aria-label="Switch map">' + mapOpts + '</select></div>' +
				'<h1 class="pl-title">' + esc(MAP.name) + '</h1>' +
				'<div class="pl-chips">' + (MAP.location ? '<span class="chip">' + esc(MAP.location) + '</span>' : '') + (MAP.size ? '<span class="chip">' + esc(MAP.size) + '</span>' : '') + (MAP.ranked ? '<span class="chip chip-sage">Ranked pool</span>' : '') + '<span class="chip chip-brass">4v4</span></div>' +
				'<div class="seg pl-modes" role="tablist" aria-label="Game mode">' + MODES.map(function (m) { return '<button type="button" role="tab" data-mode="' + m + '">' + esc(MODE_NAMES[m]) + '</button>'; }).join('') + '</div>' +
			'</div>' +
			'<div class="pl-tabs" role="tablist" aria-label="Panel"><button type="button" role="tab" data-tab="intel">Intel</button><button type="button" role="tab" data-tab="plan">Plan</button></div>' +
			'<div class="pl-body"><section data-pane="intel"></section><section data-pane="plan" hidden></section></div>';
	}

	function renderIntelPane() {
		var html = '';
		if (S.mode === 'hp') {
			var hills = sortedHills();
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Hardpoint rotation</h3><span class="muted">' + hills.length + ' hills</span></div><ol class="pl-hills">';
			hills.forEach(function (hl, i) {
				var nx = hills[(i + 1) % hills.length];
				html += '<li><button type="button" data-fly-hill="' + hl.n + '" class="' + ((S.sel === 'h' + hl.n || S.step === String(hl.n)) ? 'is-sel' : '') + '"><span class="pl-num">P' + hl.n + '</span><span class="pl-hname">' + esc(hl.name) + '</span><span class="pl-next">next P' + nx.n + '</span></button></li>';
			});
			html += '</ol>' + srcLine([MAP.sources && MAP.sources.hp, MAP.sources && MAP.sources.rot]) + '</div>';
		} else if (S.mode === 'hj') {
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Hijack</h3></div>';
			if (MAP.hj) {
				html += '<div class="pl-sites">' + (MAP.hj.spawns || []).map(function (sp, i) {
					return '<button type="button" class="pl-site pl-site-' + (i ? 'A' : 'B') + '" data-fly-xy="' + sp.x + ',' + sp.y + '"><b>SP</b><span>Team spawn</span></button>';
				}).join('');
				if (MAP.hj.spike) html += '<button type="button" class="pl-site pl-site-bomb" data-fly-xy="' + MAP.hj.spike.x + ',' + MAP.hj.spike.y + '"><b>DS</b><span>Data Spike start area (approx.)</span></button>';
				html += (MAP.hj.commStations || []).map(function (cs, i) {
					return '<button type="button" class="pl-site pl-site-' + (i ? 'A' : 'B') + '" data-fly-xy="' + cs.x + ',' + cs.y + '"><b>CS</b><span>Comm Station' + (cs.estimated ? ' (est.)' : '') + '</span></button>';
				}).join('');
				var est = (MAP.hj.commStations || []).some(function (cs) { return cs.estimated; });
				html += '</div><p class="pl-empty" style="margin-top:10px">Each team plants at the enemy Comm Station on the other side of the map.' + (est ? ' Exact Comm Station positions for ' + esc(MAP.name) + ' have not been published, so the dashed zones are estimates: each covers a team spawn and the nearest Domination flag.' : '') + '</p>' + srcLine([MAP.sources && MAP.sources.hj]);
			} else {
				html += '<p class="pl-empty">Comm Station and Data Spike positions for ' + esc(MAP.name) + ' have not been mapped yet. You can still plan here and mark them with labels.</p>';
			}
			html += '</div>';
		} else {
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Bomb sites</h3></div>';
			if (HAS_SND) {
				html += '<div class="pl-sites">' + MAP.snd.sites.map(function (st) {
					return '<button type="button" class="pl-site pl-site-' + st.id + '" data-fly-site="' + st.id + '"><b>' + st.id + '</b><span>' + st.id + ' site</span></button>';
				}).join('');
				if (MAP.snd.bomb) html += '<button type="button" class="pl-site pl-site-bomb" data-fly-bomb="1"><b>' + ico('bomb') + '</b><span>Bomb spawn' + (MAP.snd.bomb.approx ? ' (approx.)' : '') + '</span></button>';
				html += '</div>' + srcLine([MAP.sources && MAP.sources.snd]);
				if (D.links.bombSites) html += '<p class="pl-src"><a href="' + esc(D.links.bombSites) + '#' + esc(MAP.slug) + '">Bomb site layout and photos</a></p>';
			} else {
				html += '<p class="pl-empty">Bomb-site positions for ' + esc(MAP.name) + ' have not been published by our sources yet. You can still plan here and mark the sites with labels.</p>';
			}
			html += '</div>';
		}
		html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Layers</h3></div><div class="pl-layers">' +
			(S.mode === 'hj' ? (MAP.hj ? layerToggle('obj', 'Spawns, Comm Stations & Data Spike') : '') : layerToggle('obj', S.mode === 'hp' ? 'Hardpoints' : 'Bomb sites & bomb spawn')) +
			(S.mode === 'hp' ? layerToggle('rot', 'Rotation path') : '') +
			layerToggle('route', 'Team routes & setups', countOf('route') + countOf('icon')) +
			layerToggle('strong', 'Strong points to hold', countOf('strong')) +
			layerToggle('enemy', 'Common enemy routes', countOf('enemy')) +
			layerToggle('note', 'Coach notes', countOf('note') + countOf('text')) +
			layerToggle('plan', 'My plan', (S.plans[S.mode] || []).length) +
			layerToggle('callouts', 'Callouts', callouts().length) +
			(nDetail() ? layerToggle('detail', 'Detailed callouts', nDetail()) : '') +
			(steps().length && S.mode !== 'snd' ? layerToggle('starter', S.mode === 'hp' ? 'Starter setup per hill' : 'Starter setup per side') : '') +
			((MAP.spawns || []).length ? layerToggle('spawns', S.mode === 'hp' ? 'Spawns & spawn zones' : 'Team spawns') : '') +
			'</div>' +
			(steps().length && S.mode !== 'snd' ? '<p class="muted pl-hint">Pick a ' + (S.mode === 'hp' ? 'hill' : 'side') + ' in the bar above the map to see its starter setup' + (S.mode === 'hp' ? ' and spawn zones' : '') + '. Starters are a shape placed by formula, not real cover' + (S.mode === 'hp' ? ', and spawn zones marked as estimates follow one rule: the team holding spawns on the side it set up on' : '') + '.</p>' : '') +
			'</div>';
		if ((MAP.tips || []).length) {
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Map notes</h3></div><ul class="pl-tips">' + MAP.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' + srcLine([MAP.tipSource]) + '</div>';
		}
		var intel = S.intel[S.mode] || [];
		var notes = intel.filter(function (it) { return it.t === 'note' && it.s; });
		html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Coaching</h3></div>';
		if (!intel.length) {
			html += '<p class="pl-empty">No official routes, strong points or enemy paths for ' + esc(MAP.name) + ' ' + esc(modeName()) + ' yet. Open <b>Plan</b> to draw your own and share it with your team.</p>';
		} else if (notes.length) {
			html += '<ul class="pl-notes">' + notes.map(function (n) { return '<li><button type="button" data-fly-xy="' + n.x + ',' + n.y + '">' + esc(n.s) + '</button></li>'; }).join('') + '</ul>';
		}
		var tips = (D.coaching && D.coaching[S.mode]) || [];
		html += (tips.length ? '<h4>General ' + esc(modeName()) + ' tips</h4><ol class="pl-tips">' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') + '</div>';
		paneEl('intel').innerHTML = html;
	}

	function renderPlanPane() {
		var html = '';
		if (D.user.canEdit) {
			html += '<div class="pl-sec pl-admin"><label class="pl-toggle"><input type="checkbox" data-edit-intel' + (S.editIntel ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span class="pl-tl">Edit official intel</span></label>' +
				'<p class="muted">' + (S.editIntel ? 'You are editing what every visitor sees for ' + esc(modeName()) + '. Press Publish when you are done.' : 'Admins only: switch on to draw the official routes, strong points, enemy routes and coach notes for this map.') + '</p>' +
				(S.editIntel ? '<button type="button" class="btn btn-primary btn-sm" data-publish>' + ico('save') + 'Publish intel' + (S.intelDirty ? ' \u2022' : '') + '</button>' : '') + '</div>';
		}
		html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Tools</h3><span class="muted">' + (S.editIntel ? 'Official intel' : 'My plan') + '</span></div><div class="pl-tools">' +
			TOOLS.map(function (t) { return '<button type="button" data-tool="' + t.k + '" title="' + t.name + ' (' + t.key.toUpperCase() + ')">' + ico(t.k) + '<span>' + t.name + '</span></button>'; }).join('') + '</div>' +
			'<div class="pl-sub" data-for="route icon"><span class="pl-lbl">Player</span><div class="pl-roles">' +
			['ar', 'flex', 'entry', 'sub', 'team'].map(function (k) { var r = ROLE[k]; return '<button type="button" data-role="' + k + '" style="--c:' + r.color + '"><i></i>' + esc(r.name) + '</button>'; }).join('') + '</div></div>' +
			'<div class="pl-sub" data-for="icon"><span class="pl-lbl">Icon</span><div class="pl-icons">' +
			Object.keys(ICONS).map(function (k) { var c = ICONS[k]; return '<button type="button" data-icon="' + k + '" title="' + esc(c.name) + '" style="--c:' + c.color + ';--ink:' + c.ink + '"><b>' + esc(c.label) + '</b><span>' + esc(c.name) + '</span></button>'; }).join('') + '</div></div>' +
			'<div class="pl-actions"><button type="button" class="btn btn-sm" data-undo title="Undo (Ctrl+Z)" aria-label="Undo">' + ico('undo') + '</button><button type="button" class="btn btn-sm" data-redo title="Redo (Ctrl+Shift+Z)" aria-label="Redo">' + ico('redo') + '</button><button type="button" class="btn btn-sm btn-ghost" data-clear>' + ico('trash') + 'Clear</button></div></div>';
		if (!S.editIntel) {
			var stp = stepObj(), edit = S.tool === 'layers', used = {};
			callouts().forEach(function (c) { used[String(c.s).toLowerCase()] = 1; });
			var sugg = (MAP.calloutNames || []).filter(function (n) { return !used[n.toLowerCase()]; });
			if (steps().length) {
				html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Step</h3><span class="muted">' + esc(stp ? stp.label + (S.mode === 'hp' ? ' \u00b7 ' + stp.name : '') : 'All steps') + '</span></div>' +
					'<p class="muted pl-hint" style="margin-top:0">' + (stp ? 'What you draw now belongs to ' + esc(stp.label) + ' only.' : 'What you draw now shows on every step. Pick a ' + (S.mode === 'hp' ? 'hill' : 'step') + ' in the bar above the map to plan it on its own.') + '</p>' +
					(stp && S.mode !== 'snd' && !stepItems().length && starterItems().length ? '<div class="pl-share" style="margin-top:10px"><button type="button" class="btn btn-sm" data-copy-starter>' + ico('plus') + 'Copy the starter setup into my plan</button></div>' : '') + '</div>';
			}
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Callouts</h3><span class="muted">' + (TEAM.callouts ? 'Your team\u2019s' : 'Default') + ' \u00b7 ' + callouts().length + '</span></div>' +
				'<div class="pl-share"><button type="button" class="btn btn-sm' + (edit ? ' btn-primary' : '') + '" data-edit-layers>' + (edit ? 'Done editing' : 'Edit callouts') + '</button>' +
				(teamEdited() ? '<button type="button" class="btn btn-sm" data-share-team>' + ico('link') + 'Copy team link</button><button type="button" class="btn btn-sm btn-ghost" data-reset-team>Reset</button>' : '') + '</div>' +
				(edit ? '<p class="muted pl-hint">Tap the map to add a callout. Tap one to rename or delete it, drag to move it.' + (S.mode === 'hp' ? ' With a hill picked, the HOLD and BREAK spawn zones can be dragged too.' : '') + '</p>' +
					(sugg.length ? '<span class="pl-lbl" style="margin-top:12px">Names players use' + (MAP.tipSource ? ' (' + esc(MAP.tipSource.label.split(' ')[0]) + ')' : '') + ' \u00b7 tap one, then tap the map</span><div class="pl-names">' + sugg.map(function (n) { return '<button type="button" data-co-pick="' + esc(n) + '"' + (S.coPick === n ? ' class="is-on"' : '') + '>' + esc(n) + '</button>'; }).join('') + '</div>' : '')
					: '<p class="muted pl-hint">Add your own names and move the defaults. Edits stay on this device. Send the team link so everyone sees the same map.</p>') + '</div>';
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Share</h3></div><div class="pl-share">' +
				'<button type="button" class="btn btn-sm" data-share>' + ico('link') + 'Copy link</button>' +
				'<button type="button" class="btn btn-sm" data-share-brief>' + ico('brief') + 'Copy briefing link</button>' +
				'<button type="button" class="btn btn-sm" data-open-brief>' + ico('brief') + 'Briefing view</button>' +
				'<button type="button" class="btn btn-sm" data-export>' + ico('download') + 'Export image</button>' +
				(D.user.loggedIn ? '<button type="button" class="btn btn-sm btn-primary" data-save>' + ico('save') + (S.planMeta.code && S.planMeta.canEdit ? 'Save changes' : 'Save to account') + '</button>' : (D.user.loginUrl ? '<a class="btn btn-sm btn-primary" href="' + esc(D.user.loginUrl) + '">Sign in to save</a>' : '')) +
				'</div>' + (S.planMeta.code ? '<p class="muted pl-current">Plan: <b>' + esc(S.planMeta.title) + '</b> \u00b7 ' + esc(visName(S.planMeta.visibility)) + (S.planMeta.canEdit ? '' : ' \u00b7 view only, saving creates your own copy') + ' <button type="button" class="pl-link" data-new-plan>Start new</button></p>' : '') +
				'<p class="muted pl-hint">Your plan saves on this device automatically.</p></div>';
			if (D.user.loggedIn) html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Saved plans</h3><button type="button" class="pl-link" data-load-plans>Load</button></div><div class="pl-saved" data-saved><p class="muted">Load your plans and your team\u2019s plans for this map.</p></div></div>';
		}
		html += '<div class="pl-sec pl-keys"><h4>Controls</h4><p class="muted">Drag to pan \u00b7 scroll or pinch to zoom \u00b7 double-click to zoom in \u00b7 drag icons to move them \u00b7 keys V R E S I T N X pick tools \u00b7 [ and ] change step \u00b7 Ctrl+Z undo \u00b7 0 resets the view</p></div>';
		paneEl('plan').innerHTML = html;
		syncToolUI();
	}

	function renderPanels() {
		var body = panel.querySelector('.pl-body'), top = body ? body.scrollTop : 0;
		renderIntelPane(); renderPlanPane();
		if (body) body.scrollTop = top;
		Array.prototype.forEach.call(panel.querySelectorAll('[data-mode]'), function (b) {
			var on = b.getAttribute('data-mode') === S.mode;
			b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
		});
		setTab(S.tab);
		updateBadge();
	}
	function refreshCounts() {
		var map = { route: countOf('route') + countOf('icon'), strong: countOf('strong'), enemy: countOf('enemy'), note: countOf('note') + countOf('text'), plan: (S.plans[S.mode] || []).length };
		Object.keys(map).forEach(function (k) { var el = panel.querySelector('[data-count="' + k + '"]'); if (el) el.textContent = map[k]; });
		var pb = panel.querySelector('[data-publish]');
		if (pb) pb.innerHTML = ico('save') + 'Publish intel' + (S.intelDirty ? ' \u2022' : '');
	}
	function setTab(t) {
		S.tab = t;
		Array.prototype.forEach.call(panel.querySelectorAll('[data-tab]'), function (b) {
			var on = b.getAttribute('data-tab') === t;
			b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
		});
		Array.prototype.forEach.call(panel.querySelectorAll('[data-pane]'), function (p) { p.hidden = p.getAttribute('data-pane') !== t; });
		if (t !== 'plan' && S.tool !== 'pan') setTool('pan');
	}
	function setTool(t) {
		var was = S.tool;
		S.tool = t;
		stage.setAttribute('data-tool', t);
		syncToolUI();
		if ((was === 'layers') !== (t === 'layers')) { S.coPick = ''; closePop(); renderCallouts(); lastK = -1; applyCam(); if (paneEl('plan')) renderPlanPane(); syncCoBar(); }
	}
	function syncToolUI() {
		Array.prototype.forEach.call(panel.querySelectorAll('[data-tool]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-tool') === S.tool); });
		Array.prototype.forEach.call(panel.querySelectorAll('[data-role]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-role') === S.role); });
		Array.prototype.forEach.call(panel.querySelectorAll('[data-icon]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-icon') === S.icon); });
		Array.prototype.forEach.call(panel.querySelectorAll('.pl-sub[data-for]'), function (el) { el.hidden = el.getAttribute('data-for').split(' ').indexOf(S.tool) < 0; });
	}
	function setMode(m, silent) {
		if (S.editIntel && S.intelDirty && !silent && !window.confirm('You have unpublished intel changes. Switch mode anyway?')) return;
		S.mode = m; S.sel = null; S.history = []; S.future = []; S.step = null; S.coPick = '';
		if (!silent) {
			S.planMeta = { code: null, title: '', visibility: 'unlisted', canEdit: true };
			var u = new URL(location.href);
			u.searchParams.delete('plan');
			modeParam(u, m);
			u.hash = '';
			history.replaceState(null, '', u.toString());
		}
		renderAll(); renderPanels(); renderSteps();
		if (S.brief) { renderBrief(); frameStep(); }
	}

	// ---------- steps bar and briefing view ----------
	function renderSteps() {
		var st = steps();
		stepBar.hidden = !st.length;
		stepBar.innerHTML = !st.length ? '' : '<button type="button" role="tab" data-step=""' + (!S.step ? ' class="is-on" aria-selected="true"' : '') + '>All</button>' + st.map(function (x) {
			var n = (S.plans[S.mode] || []).filter(function (it) { return it.st === x.k; }).length;
			return '<button type="button" role="tab" data-step="' + esc(x.k) + '" title="' + esc(x.name) + '"' + (S.step === x.k ? ' class="is-on" aria-selected="true"' : '') + '>' + esc(x.label) + (n ? '<i aria-hidden="true"></i>' : '') + '</button>';
		}).join('');
	}
	function setStep(k, fly) {
		if (k && !stepObj(k)) k = null;
		S.step = k || null;
		S.sel = (S.step && S.mode === 'hp') ? 'h' + S.step : null;
		closePop(); renderAll(); renderSteps(); renderPanels();
		if (S.brief) renderBrief();
		if (fly) frameStep();
	}
	function stepMove(d) {
		var seq = [null].concat(steps().map(function (x) { return x.k; }));
		if (seq.length < 2) return;
		setStep(seq[(seq.indexOf(S.step) + d + seq.length) % seq.length], true);
	}
	function frameStep() {
		var st = stepObj(), pts = [];
		if (!st) { fitView(); return; }
		if (st.x !== undefined) pts.push([st.x, st.y]);
		if (S.mode === 'hp') {
			var hs = sortedHills(), i = hs.map(function (x) { return String(x.n); }).indexOf(st.k), nx = hs[(i + 1) % hs.length];
			if (nx) pts.push([nx.x, nx.y]);
			var z = S.layers.spawns ? hillSpawns(st.k) : null;
			if (z) { pts.push([z.own.x, z.own.y]); pts.push([z.enemy.x, z.enemy.y]); }
		}
		var add = function (it) { if (it.p) it.p.forEach(function (q) { pts.push(q); }); else if (isFinite(it.x)) pts.push([it.x, it.y]); };
		stepItems().forEach(add);
		if (S.layers.starter && !S.brief && !stepItems().length) starterItems().forEach(add);
		if (pts.length < 2) { fitView(); return; }
		var x0 = 1, y0 = 1, x1 = 0, y1 = 0;
		pts.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
		var w = Math.max(0.24, x1 - x0 + 0.18) * 1000, hh = Math.max(0.24, y1 - y0 + 0.18) * 1000;
		animateTo({ x: (x0 + x1) / 2 * 1000, y: (y0 + y1) / 2 * 1000, k: Math.min(S.vw / w, S.vh / hh) }, 600);
	}
	stepBar.addEventListener('click', function (e) {
		var b = e.target.closest('[data-step]');
		if (b) setStep(b.getAttribute('data-step') || null, true);
	});
	function briefNotes() {
		var out = [];
		(S.intel[S.mode] || []).concat(S.plans[S.mode] || []).forEach(function (it) {
			if ((it.t === 'note' || it.t === 'text') && it.s && (S.step ? it.st === S.step : !it.st)) out.push(it.s);
		});
		return out;
	}
	function renderBrief() {
		briefBar.hidden = !S.brief;
		if (!S.brief) { briefBar.innerHTML = ''; return; }
		var st = steps(), i = st.map(function (x) { return x.k; }).indexOf(S.step), cur = i >= 0 ? st[i] : null, sub;
		if (S.mode === 'hp' && cur) { var nx = st[(i + 1) % st.length]; sub = 'Next is ' + nx.label + ' \u00b7 ' + nx.name + '. Send the first player with about 20 seconds left.'; }
		else if (cur) sub = cur.name;
		else sub = st.length ? 'Everything on one map. Use the arrows to step through.' : 'Everything on one map.';
		var n = cur ? stepItems().length : (S.plans[S.mode] || []).length, notes = briefNotes();
		briefBar.innerHTML =
			'<div class="pl-brief-top"><b>' + esc(MAP.name) + '</b>' +
			(MODES.length > 1 ? '<div class="seg">' + MODES.map(function (m) { return '<button type="button" data-brief-mode="' + m + '"' + (m === S.mode ? ' class="is-on"' : '') + '>' + (m === 'snd' ? 'S&amp;D' : esc(MODE_NAMES[m])) + '</button>'; }).join('') + '</div>' : '<span class="muted">' + esc(modeName()) + '</span>') +
			'<button type="button" class="btn btn-sm" data-brief-exit>Exit</button></div>' +
			'<div class="pl-brief-main"><button type="button" class="pl-brief-nav" data-brief-prev aria-label="Previous step"' + (st.length ? '' : ' disabled') + '>' + ico('back') + '</button>' +
			'<div class="pl-brief-step"><span class="pl-num">' + esc(cur ? (S.mode === 'hp' ? cur.label : String(i + 1)) : 'All') + '</span><div><b>' + esc(cur ? (S.mode === 'hp' ? cur.name : cur.label) : 'Whole plan') + '</b><em>' + esc(sub) + '</em></div></div>' +
			'<button type="button" class="pl-brief-nav pl-brief-next" data-brief-next aria-label="Next step"' + (st.length ? '' : ' disabled') + '>' + ico('back') + '</button></div>' +
			(notes.length ? '<ul class="pl-brief-notes">' + notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
				: '<p class="pl-brief-empty">' + (n ? n + (n === 1 ? ' item' : ' items') + ' drawn for this ' + (cur ? 'step' : 'mode') + '.' : 'Nothing drawn for this ' + (cur ? 'step' : 'mode') + ' yet.') + '</p>');
	}
	function setBrief(on) {
		S.brief = !!on;
		root.classList.toggle('is-brief', S.brief);
		syncCoBar();
		root.classList.remove('panel-open');
		closePop(); setTool('pan');
		var u = new URL(location.href);
		if (S.brief) u.searchParams.set('view', 'brief'); else u.searchParams.delete('view');
		history.replaceState(null, '', u.toString());
		renderBrief(); refreshLayers();
		setTimeout(function () { measure(); frameStep(); }, 80);
	}
	briefBar.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		if (b.hasAttribute('data-brief-exit')) setBrief(false);
		else if (b.hasAttribute('data-brief-prev')) stepMove(-1);
		else if (b.hasAttribute('data-brief-next')) stepMove(1);
		else if (b.hasAttribute('data-brief-mode')) setMode(b.getAttribute('data-brief-mode'));
	});
	function copyStarter() {
		var items = starterItems();
		if (!items.length || !S.step) return;
		pushHistory();
		items.forEach(function (it) { var c = JSON.parse(JSON.stringify(it)); delete c.ghost; delete c.tip; c.st = S.step; currentItems().push(c); });
		setTool('pan'); changed(); renderPlanPane();
		toast('Starter copied. Drag each player onto real cover.');
	}
	function saveLayerPrefs() {
		var o = {};
		PREF_LAYERS.forEach(function (k) { o[k] = !!S.layers[k]; });
		try { localStorage.setItem(LAYER_KEY, JSON.stringify(o)); } catch (e12) { /* ignore */ }
	}

	panel.addEventListener('click', function (e) {
		var b = e.target.closest('button,a');
		if (!b || !panel.contains(b)) return;
		if (b.classList.contains('pl-grab')) { root.classList.toggle('panel-open'); return; }
		if (b.hasAttribute('data-mode')) { setMode(b.getAttribute('data-mode')); return; }
		if (b.hasAttribute('data-tab')) { setTab(b.getAttribute('data-tab')); root.classList.add('panel-open'); return; }
		if (b.hasAttribute('data-tool')) { setTool(b.getAttribute('data-tool')); return; }
		if (b.hasAttribute('data-role')) { S.role = b.getAttribute('data-role'); if (S.tool !== 'route' && S.tool !== 'icon') setTool('route'); syncToolUI(); return; }
		if (b.hasAttribute('data-icon')) { S.icon = b.getAttribute('data-icon'); setTool('icon'); return; }
		if (b.hasAttribute('data-fly-hill')) {
			var n = +b.getAttribute('data-fly-hill');
			var hl = sortedHills().filter(function (x) { return x.n === n; })[0];
			if (hl) { selectHill(n); flyTo(hl.x * 1000, hl.y * 1000, 2.6); }
			return;
		}
		if (b.hasAttribute('data-edit-layers')) {
			setTool(S.tool === 'layers' ? 'pan' : 'layers');
			if (S.tool === 'layers') root.classList.remove('panel-open');
			renderPlanPane();
			return;
		}
		if (b.hasAttribute('data-co-pick')) {
			var nm = b.getAttribute('data-co-pick');
			S.coPick = S.coPick === nm ? '' : nm;
			renderPlanPane();
			if (S.coPick) { root.classList.remove('panel-open'); toast('Tap the map where \u201c' + nm + '\u201d is'); }
			return;
		}
		if (b.hasAttribute('data-share-team')) { shareTeam(); return; }
		if (b.hasAttribute('data-reset-team')) {
			if (window.confirm('Remove your team\u2019s callouts and spawn-zone edits for ' + MAP.name + ' on this device and go back to the defaults?')) {
				TEAM = { callouts: null, spawns: {} }; saveTeam(); renderAll(); renderPanels(); toast('Back to the default callouts');
			}
			return;
		}
		if (b.hasAttribute('data-copy-starter')) { copyStarter(); return; }
		if (b.hasAttribute('data-share-brief')) { sharePlan(true); return; }
		if (b.hasAttribute('data-open-brief')) { setBrief(true); return; }
		if (b.hasAttribute('data-fly-site')) {
			var id = b.getAttribute('data-fly-site');
			var st = MAP.snd.sites.filter(function (x) { return x.id === id; })[0];
			if (st) { S.sel = 's' + id; renderObj(); lastK = -1; flyTo(st.x * 1000, st.y * 1000, 2.6); }
			return;
		}
		if (b.hasAttribute('data-fly-bomb') && MAP.snd && MAP.snd.bomb) { flyTo(MAP.snd.bomb.x * 1000, MAP.snd.bomb.y * 1000, 2.4); return; }
		if (b.hasAttribute('data-fly-xy')) { var xy = b.getAttribute('data-fly-xy').split(','); flyTo(+xy[0] * 1000, +xy[1] * 1000, 2.4); return; }
		if (b.hasAttribute('data-undo')) { undo(); return; }
		if (b.hasAttribute('data-redo')) { redo(); return; }
		if (b.hasAttribute('data-clear')) {
			if (S.step && !S.editIntel) {
				if (stepItems().length && window.confirm('Clear your plan for ' + stepObj().label + '? Other steps are kept.')) {
					pushHistory(); setCurrentItems(currentItems().filter(function (it) { return it.st !== S.step; })); changed(); renderPlanPane();
				}
				return;
			}
			if (!currentItems().length) return;
			if (window.confirm(S.editIntel ? 'Clear all official intel for this mode? (Not published until you press Publish.)' : 'Clear your plan for this mode?')) { pushHistory(); setCurrentItems([]); changed(); }
			return;
		}
		if (b.hasAttribute('data-share')) { sharePlan(); return; }
		if (b.hasAttribute('data-export')) { exportPng(); return; }
		if (b.hasAttribute('data-save')) { openSaveDialog(); return; }
		if (b.hasAttribute('data-load-plans')) { loadPlans(); return; }
		if (b.hasAttribute('data-open-plan')) { openPlan(b.getAttribute('data-open-plan')); return; }
		if (b.hasAttribute('data-new-plan')) {
			S.planMeta = { code: null, title: '', visibility: 'unlisted', canEdit: true };
			var u = new URL(location.href); u.searchParams.delete('plan'); history.replaceState(null, '', u.toString());
			renderPlanPane(); toast('New plan started (your drawing was kept)');
			return;
		}
		if (b.hasAttribute('data-publish')) { publishIntel(); return; }
	});
	panel.addEventListener('change', function (e) {
		var t = e.target;
		if (t.hasAttribute('data-layer')) {
			var lk = t.getAttribute('data-layer');
			S.layers[lk] = t.checked; renderAll();
			if (PREF_LAYERS.indexOf(lk) >= 0) saveLayerPrefs();
			return;
		}
		if (t.hasAttribute('data-map-switch')) { location.href = t.value + '?mode=' + S.mode; return; }
		if (t.hasAttribute('data-edit-intel')) {
			if (!t.checked && S.intelDirty && !window.confirm('Discard unpublished intel changes?')) { t.checked = true; return; }
			if (!t.checked && S.intelDirty) { S.intel = { hp: (MAP.intel.hp || []).slice(), snd: (MAP.intel.snd || []).slice(), hj: (MAP.intel.hj || []).slice() }; S.intelDirty = false; }
			S.editIntel = t.checked; S.history = []; S.future = [];
			renderAll(); renderPanels();
		}
	});

	// ---------- share / save ----------
	function shareTeam() {
		var u = new URL(location.href);
		u.searchParams.delete('plan'); u.searchParams.delete('view');
		modeParam(u, S.mode);
		u.hash = 't=' + b64e(JSON.stringify(packTeam()));
		copyText(u.toString()).then(function () { toast('Team link copied. Opening it loads these callouts on that device.'); });
	}
	function sharePlan(brief) {
		var items = S.plans[S.mode] || [];
		if (S.planMeta.code && S.planMeta.visibility !== 'private') {
			var u0 = new URL(location.href); u0.hash = '';
			copyText(u0.toString()).then(function () { toast('Link to your saved plan copied'); });
			return;
		}
		if (!items.length) { toast('Draw something first'); return; }
		var u = new URL(location.href);
		u.searchParams.delete('plan');
		modeParam(u, S.mode);
		if (brief) u.searchParams.set('view', 'brief'); else u.searchParams.delete('view');
		var pay = { v: 1, d: S.mode, i: items };
		if (TEAM.callouts) pay.c = packTeam().c;
		u.hash = 'p=' + b64e(JSON.stringify(pay));
		var url = u.toString();
		copyText(url).then(function () {
			toast(brief ? 'Briefing link copied. It opens straight into the step-through view.' : (url.length > 7000 ? 'Link copied. It is a long one because the plan is big.' : 'Share link copied'));
		});
	}
	function publishIntel() {
		var btn = panel.querySelector('[data-publish]');
		if (btn) btn.disabled = true;
		api('maps/' + MAP.id + '/intel', { method: 'POST', body: { mode: S.mode, items: S.intel[S.mode] } }).then(function (r) {
			MAP.intel[S.mode] = S.intel[S.mode].slice();
			S.intelDirty = false; refreshCounts(); renderIntelPane();
			toast('Published ' + r.count + ' intel items for ' + modeName());
		}).catch(function (err) { toast(err.message); }).then(function () { if (btn) btn.disabled = false; });
	}
	function radio(v, label, cur) {
		return '<label class="pl-radio"><input type="radio" name="vis" value="' + v + '"' + (v === cur ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
	}
	function genTeam() { return 'squad-' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6); }
	function openSaveDialog() {
		var vis = S.planMeta.visibility || 'unlisted';
		var m = h('div', 'pl-modal');
		m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Save plan');
		m.innerHTML = '<form class="pl-dialog card"><h3>' + (S.planMeta.code && S.planMeta.canEdit ? 'Save changes' : 'Save plan') + '</h3>' +
			'<label class="pl-field"><span>Title</span><input type="text" name="title" maxlength="80" required value="' + esc(S.planMeta.title || (MAP.name + ' ' + modeName() + ' plan')) + '"></label>' +
			'<fieldset class="pl-field"><legend>Who can see it</legend>' + radio('private', 'Only me', vis) + radio('unlisted', 'Anyone with the link', vis) + radio('team', 'My team (private team board)', vis) + '</fieldset>' +
			'<div class="pl-teamrow" hidden><label class="pl-field"><span>Team code</span><input type="text" name="team" minlength="6" maxlength="32" pattern="[A-Za-z0-9-]{6,32}" placeholder="squad-xxxxxx" value="' + esc(D.user.team || '') + '"></label><button type="button" class="btn btn-sm" data-gen>Generate</button><p class="muted">Share this code with your teammates. Anyone who enters it sees your team board.</p></div>' +
			'<div class="pl-dialog-actions"><button type="button" class="btn btn-sm btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div></form>';
		document.body.appendChild(m);
		var form = m.querySelector('form'), teamRow = m.querySelector('.pl-teamrow');
		var syncTeam = function () { var v = form.querySelector('input[name="vis"]:checked'); teamRow.hidden = !(v && v.value === 'team' && !D.user.team); };
		syncTeam();
		form.addEventListener('change', syncTeam);
		var close = function () { m.remove(); document.removeEventListener('keydown', onKey); };
		var onKey = function (e) { if (e.key === 'Escape') close(); };
		document.addEventListener('keydown', onKey);
		m.addEventListener('click', function (e) {
			if (e.target === m || e.target.closest('[data-cancel]')) close();
			if (e.target.closest('[data-gen]')) form.querySelector('input[name="team"]').value = genTeam();
		});
		setTimeout(function () { form.querySelector('input[name="title"]').focus(); }, 20);
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var visv = form.querySelector('input[name="vis"]:checked').value;
			var title = form.querySelector('input[name="title"]').value.trim();
			var teamv = form.querySelector('input[name="team"]').value.trim();
			var pre = Promise.resolve();
			if (visv === 'team' && !D.user.team) {
				if (!/^[A-Za-z0-9-]{6,32}$/.test(teamv)) { toast('Enter a team code (6-32 letters, numbers or dashes)'); return; }
				pre = api('me/team', { method: 'POST', body: { team: teamv } }).then(function (r) { D.user.team = r.team; });
			}
			var submit = form.querySelector('[type="submit"]');
			submit.disabled = true;
			pre.then(function () {
				return api('plans', { method: 'POST', body: { code: S.planMeta.code || '', map: MAP.slug, mode: S.mode, title: title, visibility: visv, items: S.plans[S.mode] || [] } });
			}).then(function (p) {
				S.planMeta = { code: p.code, title: p.title, visibility: p.visibility, canEdit: !!p.canEdit };
				var u = new URL(location.href); u.searchParams.set('plan', p.code);
				modeParam(u, S.mode);
				u.hash = ''; history.replaceState(null, '', u.toString());
				close(); renderPlanPane();
				toast('Saved \u201c' + p.title + '\u201d');
			}).catch(function (err) { submit.disabled = false; toast(err.message); });
		});
	}
	function loadPlans() {
		var box = panel.querySelector('[data-saved]');
		if (!box) return;
		box.innerHTML = '<p class="muted">Loading\u2026</p>';
		api('plans', { query: { map: MAP.slug } }).then(function (res) {
			var rows = function (list, own) {
				return list.map(function (p) {
					return '<button type="button" class="pl-plan" data-open-plan="' + esc(p.code) + '"><b>' + esc(p.title) + '</b><span>' + (p.mode === 'snd' ? 'S&amp;D' : 'Hardpoint') + ' \u00b7 ' + esc(visName(p.visibility)) + (own ? '' : ' \u00b7 ' + esc(p.author)) + '</span></button>';
				}).join('');
			};
			var html = '<h4>Mine</h4>' + (res.mine.length ? rows(res.mine, true) : '<p class="muted">No saved plans for this map yet.</p>');
			if (res.teamCode) html += '<h4>Team</h4>' + (res.team.length ? rows(res.team, false) : '<p class="muted">No team plans for this map yet.</p>');
			else html += '<p class="muted">Set a team code on <a href="' + esc(D.links.myPlans) + '">My Plans</a> to share a private board with your squad.</p>';
			box.innerHTML = html;
		}).catch(function (err) { box.innerHTML = '<p class="muted">' + esc(err.message) + '</p>'; });
	}
	function applyPlan(p) {
		if (p.map && p.map !== MAP.slug && p.url) { location.href = p.url; return; }
		S.editIntel = false; S.mode = pickMode(p.mode);
		S.plans[S.mode] = Array.isArray(p.items) ? p.items.slice() : [];
		S.planMeta = { code: p.code, title: p.title, visibility: p.visibility, canEdit: !!p.canEdit };
		S.history = []; S.future = []; S.sel = null;
		var u = new URL(location.href); u.searchParams.set('plan', p.code);
		modeParam(u, S.mode);
		u.hash = ''; history.replaceState(null, '', u.toString());
		renderAll(); renderPanels();
	}
	function openPlan(code) {
		api('plans/' + encodeURIComponent(code)).then(function (p) { applyPlan(p); toast('Loaded \u201c' + p.title + '\u201d'); }).catch(function (err) { toast(err.message); });
	}

	// ---------- export ----------
	function exportPng() {
		if (!MAP.image) return;
		toast('Rendering image\u2026');
		var size = 2048, cv = document.createElement('canvas');
		cv.width = size; cv.height = size;
		var ctx = cv.getContext('2d');
		var base = new Image();
		base.onload = function () {
			ctx.drawImage(base, 0, 0, size, size);
			var clone = svg.cloneNode(true);
			clone.setAttribute('viewBox', '0 0 1000 1000');
			clone.setAttribute('width', size); clone.setAttribute('height', size);
			clone.setAttribute('xmlns', NS);
			clone.removeAttribute('class');
			var sc = 1000 / size * 1.7;
			Array.prototype.forEach.call(clone.querySelectorAll('[data-x]'), function (el) {
				var rot = +el.getAttribute('data-rot') || 0, s0 = +el.getAttribute('data-sc') || 1;
				el.setAttribute('transform', 'translate(' + el.getAttribute('data-x') + ',' + el.getAttribute('data-y') + ')' + (rot ? ' rotate(' + rot + ')' : '') + ' scale(' + (s0 * sc).toFixed(5) + ')');
			});
			Array.prototype.forEach.call(clone.querySelectorAll('[vector-effect]'), function (el) {
				el.setAttribute('stroke-width', ((+el.getAttribute('stroke-width') || 2) * 1.7).toFixed(2));
			});
			Array.prototype.forEach.call(clone.querySelectorAll('.hit'), function (el) { el.remove(); });
			var str = new XMLSerializer().serializeToString(clone);
			var ov = new Image();
			ov.onload = function () {
				ctx.drawImage(ov, 0, 0, size, size);
				var label = 'MW4 HUB \u00b7 ' + MAP.name + ' \u00b7 ' + modeName() + (stepObj() ? ' \u00b7 ' + stepObj().label : '');
				ctx.font = '700 30px ' + FONT;
				var w = ctx.measureText(label).width + 36;
				ctx.fillStyle = 'rgba(7,9,10,0.78)';
				ctx.fillRect(24, size - 76, w, 52);
				ctx.fillStyle = '#f0c66b';
				ctx.fillText(label, 42, size - 40);
				cv.toBlob(function (blob) {
					if (!blob) { toast('Export failed'); return; }
					var a = document.createElement('a');
					a.href = URL.createObjectURL(blob);
					a.download = 'mw4hub-' + MAP.slug + '-' + S.mode + (S.step ? '-' + S.step : '') + '.png';
					document.body.appendChild(a); a.click();
					setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
					toast('Image downloaded');
				}, 'image/png');
			};
			ov.onerror = function () { toast('Export failed in this browser'); };
			ov.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
		};
		base.onerror = function () { toast('Could not load the map image'); };
		base.src = MAP.image.url;
	}

	window.addEventListener('beforeunload', function (e) {
		if (S.editIntel && S.intelDirty) { e.preventDefault(); e.returnValue = ''; }
	});

	// The planner frame, map stage and panel shell must never scroll. Focus or scrollIntoView on something inside
	// them can still nudge an overflow-hidden box, so put it straight back.
	[root, stage, panel].forEach(function (el) {
		el.addEventListener('scroll', function () { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });
	});

	// ---------- boot ----------
	buildPanel();
	setTool('pan');
	if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); }).observe(stage);
	else window.addEventListener('resize', measure);
	measure();
	renderAll();
	renderPanels();
	renderSteps();
	var ready = function () { root.classList.add('is-ready'); };
	if (!img || img.complete) ready(); else { img.addEventListener('load', ready); img.addEventListener('error', ready); }
	if (S.sharedLoaded) { setTab('plan'); toast('Shared plan loaded'); }
	if (S.teamLoaded) {
		var ut = new URL(location.href); ut.hash = ''; history.replaceState(null, '', ut.toString());
		setTab('plan'); toast('Team callouts loaded on this device');
	}
	if (params.get('view') === 'brief') setBrief(true);
	// A plan or team link pasted into a tab that already has this map open only changes the hash, so reload to apply it.
	window.addEventListener('hashchange', function () { if (/^#[pt]=/.test(location.hash)) location.reload(); });
	var planCode = params.get('plan');
	if (planCode && D.rest && D.rest.root) openPlan(planCode);
})();
