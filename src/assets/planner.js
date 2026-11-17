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
		bomb: '<circle cx="11" cy="14" r="6"/><path d="M15 9l2-2M18 4l1 1M20 7h1"/>'
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
		layers: { obj: true, rot: true, route: true, enemy: true, strong: true, note: true, plan: true },
		tool: 'pan', role: 'entry', icon: 'ar', sel: null,
		plans: { hp: [], snd: [], hj: [] },
		intel: { hp: (MAP.intel && MAP.intel.hp) ? MAP.intel.hp.slice() : [], snd: (MAP.intel && MAP.intel.snd) ? MAP.intel.snd.slice() : [], hj: (MAP.intel && MAP.intel.hj) ? MAP.intel.hj.slice() : [] },
		editIntel: false, intelDirty: false,
		history: [], future: [],
		planMeta: { code: null, title: '', visibility: 'unlisted', canEdit: true },
		tab: 'intel'
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
	if (location.hash.indexOf('#p=') === 0) {
		try {
			var shared = JSON.parse(b64d(location.hash.slice(3)));
			if (shared && Array.isArray(shared.i)) {
				S.mode = pickMode(shared.d);
				S.plans[S.mode] = shared.i;
				S.sharedLoaded = true;
			}
		} catch (e4) { /* ignore bad links */ }
	}

	function currentItems() { return S.editIntel ? S.intel[S.mode] : S.plans[S.mode]; }
	function setCurrentItems(a) { if (S.editIntel) S.intel[S.mode] = a; else S.plans[S.mode] = a; }
	function sortedHills() { return ((MAP.hp && MAP.hp.hills) || []).slice().sort(function (a, b) { return a.n - b.n; }); }

	// ---------- DOM: svg layers, hud ----------
	var gRot = s('g'), gIntel = s('g'), gPlan = s('g'), gObj = s('g'), gTemp = s('g');
	svg.appendChild(gRot); svg.appendChild(gIntel); svg.appendChild(gPlan); svg.appendChild(gObj); svg.appendChild(gTemp);
	var SC = { obj: [], rot: [], intel: [], plan: [], temp: [] };

	var hud = h('div', 'pl-hud', '<button type="button" data-zoom="in" aria-label="Zoom in">' + ico('plus') + '</button><button type="button" data-zoom="out" aria-label="Zoom out">' + ico('minus') + '</button><button type="button" data-zoom="fit" aria-label="Reset view">' + ico('fit') + '</button><button type="button" data-fs aria-label="Full screen">' + ico('expand') + '</button>');
	var badge = h('div', 'pl-badge');
	var tip = h('div', 'pl-tip'); tip.hidden = true;
	var toastEl = h('div', 'pl-toast'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
	stage.appendChild(hud); stage.appendChild(badge); stage.appendChild(tip); root.appendChild(toastEl);

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
			sortedHills().forEach(function (hl) {
				var x = hl.x * 1000, y = hl.y * 1000, sel = S.sel === 'h' + hl.n;
				var g = s('g', { 'class': 'mk mk-hill' + (sel ? ' is-sel' : ''), 'data-tip': 'P' + hl.n + ' \u00b7 ' + hl.name, 'data-hill': hl.n });
				g.appendChild(s('circle', { r: 22, fill: 'rgba(216,169,75,0.22)', 'class': 'mk-halo' }));
				g.appendChild(s('circle', { r: 14.5, fill: '#d8a94b', stroke: '#1b1608', 'stroke-width': 2 }));
				g.appendChild(s('text', { y: 4.6, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, fill: '#1b1608', 'font-family': FONT }, 'P' + hl.n));
				gObj.appendChild(g); track(SC.obj, g, x, y);
				var lb = s('g', { 'class': 'mk-label' + (sel ? ' is-sel' : '') });
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
	}

	function renderRot() {
		clear(gRot); SC.rot = [];
		if (S.mode !== 'hp' || !S.layers.rot || !S.layers.obj) return;
		var hl = sortedHills();
		for (var i = 0; i < hl.length; i++) {
			var a = hl[i], b = hl[(i + 1) % hl.length], last = i === hl.length - 1;
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
			g.appendChild(s('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': it.t === 'enemy' ? '10 8' : null, 'vector-effect': 'non-scaling-stroke' }));
			if (ia !== null) g.appendChild(s('path', { d: d, fill: 'none', stroke: 'rgba(0,0,0,0)', 'stroke-width': 20, 'vector-effect': 'non-scaling-stroke', 'class': 'hit' }));
			parent.appendChild(g);
			var n = pts.length, b = pts[n - 1], a = pts[n - 2];
			for (var j = n - 2; j >= 0; j--) { if (Math.hypot(b[0] - pts[j][0], b[1] - pts[j][1]) > 3) { a = pts[j]; break; } }
			var head = s('path', { d: 'M10,0 L-6,-7.5 L-2.5,0 L-6,7.5 Z', fill: col, stroke: 'rgba(0,0,0,0.65)', 'stroke-width': 1.3, 'data-idx': ia });
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
		parent.appendChild(g2); track(list, g2, x, y);
	}

	function renderItems() {
		clear(gIntel); clear(gPlan); SC.intel = []; SC.plan = [];
		(S.intel[S.mode] || []).forEach(function (it, i) { if (layerOn(it.t)) drawItem(gIntel, SC.intel, it, S.editIntel ? i : -1); });
		if (S.layers.plan) (S.plans[S.mode] || []).forEach(function (it, i) { drawItem(gPlan, SC.plan, it, S.editIntel ? -1 : i); });
		gPlan.setAttribute('opacity', S.editIntel ? '0.35' : '1');
	}
	function renderAll() { renderRot(); renderObj(); renderItems(); lastK = -1; applyCam(); }

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
		renderItems(); lastK = -1; applyCam();
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
	function addItem(it) { pushHistory(); currentItems().push(it); changed(); }

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
		S.sel = 'h' + n; renderObj(); lastK = -1; applyCam();
		Array.prototype.forEach.call(panel.querySelectorAll('[data-fly-hill]'), function (b) { b.classList.toggle('is-sel', +b.getAttribute('data-fly-hill') === n); });
	}

	// ---------- pointer input ----------
	var pointers = new Map(), gesture = null;
	stage.addEventListener('pointerdown', function (e) {
		if (e.button === 2 || (e.target.closest && e.target.closest('.pl-hud,.pl-pop'))) return;
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
		if (S.tool === 'erase' && e.button === 0 && !spaceDown) {
			gesture = { type: 'erase', target: e.target };
			if (target) eraseIdx(+target.getAttribute('data-idx'));
			return;
		}
		if (S.tool === 'pan' || e.button === 1 || spaceDown) {
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
		if (g.type === 'pan') {
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

	hud.addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		var z = b.getAttribute('data-zoom');
		if (z === 'in') zoomAt(center(), 1.6, 320);
		else if (z === 'out') zoomAt(center(), 1 / 1.6, 320);
		else if (z === 'fit') fitView();
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
		else if (k === 'Escape') { cancelTemp(); closePop(); hideTip(); gesture = null; }
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
			'<div class="pl-tabs" role="tablist" aria-label="Panel"><button type="button" role="tab" data-tab="intel">Intel</button><button type="button" role="tab" data-tab="plan">Plan</button><button type="button" role="tab" data-tab="roles">Roles</button></div>' +
			'<div class="pl-body"><section data-pane="intel"></section><section data-pane="plan" hidden></section><section data-pane="roles" hidden></section></div>';
	}

	function renderIntelPane() {
		var html = '';
		if (S.mode === 'hp') {
			var hills = sortedHills();
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Hardpoint rotation</h3><span class="muted">' + hills.length + ' hills</span></div><ol class="pl-hills">';
			hills.forEach(function (hl, i) {
				var nx = hills[(i + 1) % hills.length];
				html += '<li><button type="button" data-fly-hill="' + hl.n + '" class="' + (S.sel === 'h' + hl.n ? 'is-sel' : '') + '"><span class="pl-num">P' + hl.n + '</span><span class="pl-hname">' + esc(hl.name) + '</span><span class="pl-next">next P' + nx.n + '</span></button></li>';
			});
			html += '</ol>' + srcLine([MAP.sources && MAP.sources.hp, MAP.sources && MAP.sources.rot]) + '</div>';
		} else if (S.mode === 'hj') {
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Hijack</h3></div><p class="pl-empty">Comm Station and Data Spike positions for ' + esc(MAP.name) + ' have not been mapped yet. You can still plan here and mark them with labels.</p></div>';
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
			(S.mode === 'hj' ? '' : layerToggle('obj', S.mode === 'hp' ? 'Hardpoints' : 'Bomb sites & bomb spawn')) +
			(S.mode === 'hp' ? layerToggle('rot', 'Rotation path') : '') +
			layerToggle('route', 'Team routes & setups', countOf('route') + countOf('icon')) +
			layerToggle('strong', 'Strong points to hold', countOf('strong')) +
			layerToggle('enemy', 'Common enemy routes', countOf('enemy')) +
			layerToggle('note', 'Coach notes', countOf('note') + countOf('text')) +
			layerToggle('plan', 'My plan', (S.plans[S.mode] || []).length) +
			'</div></div>';
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
			html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Share</h3></div><div class="pl-share">' +
				'<button type="button" class="btn btn-sm" data-share>' + ico('link') + 'Copy link</button>' +
				'<button type="button" class="btn btn-sm" data-export>' + ico('download') + 'Export image</button>' +
				(D.user.loggedIn ? '<button type="button" class="btn btn-sm btn-primary" data-save>' + ico('save') + (S.planMeta.code && S.planMeta.canEdit ? 'Save changes' : 'Save to account') + '</button>' : (D.user.loginUrl ? '<a class="btn btn-sm btn-primary" href="' + esc(D.user.loginUrl) + '">Sign in to save</a>' : '')) +
				'</div>' + (S.planMeta.code ? '<p class="muted pl-current">Plan: <b>' + esc(S.planMeta.title) + '</b> \u00b7 ' + esc(visName(S.planMeta.visibility)) + (S.planMeta.canEdit ? '' : ' \u00b7 view only, saving creates your own copy') + ' <button type="button" class="pl-link" data-new-plan>Start new</button></p>' : '') +
				'<p class="muted pl-hint">Your plan saves on this device automatically.</p></div>';
			if (D.user.loggedIn) html += '<div class="pl-sec"><div class="pl-sec-h"><h3>Saved plans</h3><button type="button" class="pl-link" data-load-plans>Load</button></div><div class="pl-saved" data-saved><p class="muted">Load your plans and your team\u2019s plans for this map.</p></div></div>';
		}
		html += '<div class="pl-sec pl-keys"><h4>Controls</h4><p class="muted">Drag to pan \u00b7 scroll or pinch to zoom \u00b7 double-click to zoom in \u00b7 drag icons to move them \u00b7 keys V R E S I T N X pick tools \u00b7 Ctrl+Z undo \u00b7 0 resets the view</p></div>';
		paneEl('plan').innerHTML = html;
		syncToolUI();
	}

	function renderRolesPane() {
		var roster = D.roster || {}, team = roster.team || 'OpTic Texas';
		paneEl('roles').innerHTML = '<div class="pl-sec"><p class="muted">Ranked Play is 4v4. These roles are modeled on ' + esc(team) + '. Draw each player\u2019s route in their colour on the Plan tab.</p>' +
			(D.roles || []).map(function (r) {
				var pros = roster[r.group] || [];
				return '<article class="pl-role" style="--role:' + r.color + '"><div class="pl-role-h"><span class="role-badge">' + esc(r.short) + '</span><div><b>' + esc(r.name) + '</b><span class="muted">' + esc(r.tag) + '</span></div></div><ul>' +
					(r[S.mode] || r.hp || []).map(function (li) { return '<li>' + esc(li) + '</li>'; }).join('') + '</ul>' +
					(pros.length ? '<div class="pl-role-pros">' + esc(team) + ' ' + (r.group === 'ar' ? 'AR' : 'SMG') + ': <b>' + esc(pros.join(' \u00b7 ')) + '</b></div>' : '') + '</article>';
			}).join('') + '<a class="pl-link" href="' + esc(D.links.roles) + '">Open the full role guide</a></div>';
	}

	function renderPanels() {
		renderIntelPane(); renderPlanPane(); renderRolesPane();
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
		S.tool = t;
		stage.setAttribute('data-tool', t);
		syncToolUI();
	}
	function syncToolUI() {
		Array.prototype.forEach.call(panel.querySelectorAll('[data-tool]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-tool') === S.tool); });
		Array.prototype.forEach.call(panel.querySelectorAll('[data-role]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-role') === S.role); });
		Array.prototype.forEach.call(panel.querySelectorAll('[data-icon]'), function (b) { b.classList.toggle('is-on', b.getAttribute('data-icon') === S.icon); });
		Array.prototype.forEach.call(panel.querySelectorAll('.pl-sub[data-for]'), function (el) { el.hidden = el.getAttribute('data-for').split(' ').indexOf(S.tool) < 0; });
	}
	function setMode(m, silent) {
		if (S.editIntel && S.intelDirty && !silent && !window.confirm('You have unpublished intel changes. Switch mode anyway?')) return;
		S.mode = m; S.sel = null; S.history = []; S.future = [];
		if (!silent) {
			S.planMeta = { code: null, title: '', visibility: 'unlisted', canEdit: true };
			var u = new URL(location.href);
			u.searchParams.delete('plan');
			modeParam(u, m);
			u.hash = '';
			history.replaceState(null, '', u.toString());
		}
		renderAll(); renderPanels();
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
		if (t.hasAttribute('data-layer')) { S.layers[t.getAttribute('data-layer')] = t.checked; renderAll(); return; }
		if (t.hasAttribute('data-map-switch')) { location.href = t.value + '?mode=' + S.mode; return; }
		if (t.hasAttribute('data-edit-intel')) {
			if (!t.checked && S.intelDirty && !window.confirm('Discard unpublished intel changes?')) { t.checked = true; return; }
			if (!t.checked && S.intelDirty) { S.intel = { hp: (MAP.intel.hp || []).slice(), snd: (MAP.intel.snd || []).slice(), hj: (MAP.intel.hj || []).slice() }; S.intelDirty = false; }
			S.editIntel = t.checked; S.history = []; S.future = [];
			renderAll(); renderPanels();
		}
	});

	// ---------- share / save ----------
	function sharePlan() {
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
		u.hash = 'p=' + b64e(JSON.stringify({ v: 1, d: S.mode, i: items }));
		var url = u.toString();
		copyText(url).then(function () {
			toast(url.length > 7000 ? 'Link copied. It is long: saving to your account gives a short link.' : 'Share link copied');
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
				var label = 'MW4 HUB \u00b7 ' + MAP.name + ' \u00b7 ' + modeName();
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
					a.download = 'mw4hub-' + MAP.slug + '-' + S.mode + '.png';
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

	// ---------- boot ----------
	buildPanel();
	setTool('pan');
	if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); }).observe(stage);
	else window.addEventListener('resize', measure);
	measure();
	renderAll();
	renderPanels();
	var ready = function () { root.classList.add('is-ready'); };
	if (!img || img.complete) ready(); else { img.addEventListener('load', ready); img.addEventListener('error', ready); }
	if (S.sharedLoaded) { setTab('plan'); toast('Shared plan loaded'); }
	var planCode = params.get('plan');
	if (planCode && D.rest && D.rest.root) openPlan(planCode);
})();
