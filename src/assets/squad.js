/* MW4 Hub - Squad and Match Night. Player names are kept in this browser (localStorage) and travel only inside a
   squad link the user chooses to share; they are never part of the published site. */
(function () {
	'use strict';
	var dataEl = document.getElementById('mw4-team-data');
	if (!dataEl) return;
	var D;
	try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
	var SQUAD_KEY = 'mw4hub:squad', MATCH_KEY = 'mw4hub:match', MAX_PLAYERS = 8;
	var ROLE = {};
	D.roles.forEach(function (r) { ROLE[r.key] = r; });

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
	}
	function b64e(str) {
		var bytes = new TextEncoder().encode(str), bin = '';
		for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
		return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
	function b64d(s) {
		var bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder().decode(bytes);
	}
	function ls(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } }
	function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ } }
	function toast(msg) {
		var t = document.querySelector('.hub-toast');
		if (!t) { t = document.createElement('div'); t.className = 'pl-toast hub-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
		t.textContent = msg; t.classList.add('is-on');
		clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
	}
	function copy(text, msg) {
		var done = function () { toast(msg); };
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, done);
		var ta = document.createElement('textarea');
		ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
		document.body.appendChild(ta); ta.select();
		try { document.execCommand('copy'); } catch (e) { /* ignore */ }
		ta.remove(); done();
	}

	// ---------- squad store ----------
	function cleanSquad(s) {
		s = s && typeof s === 'object' ? s : {};
		var ps = Array.isArray(s.players) ? s.players : [];
		return {
			name: String(s.name || '').slice(0, 40),
			players: ps.slice(0, MAX_PLAYERS).map(function (p) { p = p || {}; return { n: String(p.n || '').slice(0, 24), r: ROLE[p.r] ? p.r : D.roles[0].key }; })
		};
	}
	function readSquad() { return cleanSquad(ls(SQUAD_KEY, null)); }
	function saveSquad(s) { lsSet(SQUAD_KEY, cleanSquad(s)); }
	function named(s) { return s.players.filter(function (p) { return p.n.trim(); }); }
	function playersFor(s, roleKey) { return named(s).filter(function (p) { return p.r === roleKey; }); }
	function squadLink(s) { var u = new URL(location.href); u.search = ''; u.hash = 's=' + b64e(JSON.stringify(cleanSquad(s))); return u.toString(); }
	function sharedSquad() {
		var m = /^#s=([A-Za-z0-9_-]+)$/.exec(location.hash);
		if (!m) return null;
		try { var s = cleanSquad(JSON.parse(b64d(m[1]))); return named(s).length ? s : null; } catch (e) { return null; }
	}
	function plans() {
		var out = [];
		D.maps.forEach(function (m) {
			m.modes.forEach(function (mode) {
				var items = ls('mw4hub:' + m.slug + ':' + mode, []);
				if (Array.isArray(items) && items.length) out.push({ map: m, mode: mode, items: items });
			});
		});
		return out;
	}
	function mapUrl(slug, mode, brief) { return '../maps/' + slug + '/?mode=' + mode + (brief ? '&view=brief' : ''); }
	function classHtml(r) {
		if (!r.cls) return '';
		return '<div class="sq-class"><span class="sq-k">Class</span><div class="sq-guns">' +
			(r.cls.builds.length ? r.cls.builds.map(function (b) { return '<a class="chip chip-brass" href="../ranked-loadouts/#' + esc(b.id) + '">' + esc(b.weapon) + ' · ' + esc(b.label) + '</a>'; }).join('') : '<span class="muted">' + esc(r.cls.guns.join(' or ')) + '</span>') +
			'</div><p class="sq-kit">' + r.cls.kit.map(function (k) { return '<span><i>' + esc(k[0]) + '</i> ' + esc(k[1]) + '</span>'; }).join('') + '</p></div>';
	}
	function badge(r) { return '<span class="role-badge" style="--role:' + esc(r.color) + '">' + esc(r.short) + '</span>'; }

	// ---------- squad page ----------
	var sq = document.querySelector('[data-squad]');
	if (sq) {
		var squad = readSquad(), incoming = sharedSquad(), openMode = {};
		if (incoming && !named(squad).length) { squad = incoming; saveSquad(squad); incoming = null; history.replaceState(null, '', location.pathname); }
		if (!squad.players.length) squad.players = D.roles.map(function (r) { return { n: '', r: r.key }; });

		var renderSquad = function (keepFocus) {
			var all = plans();
			var h = '';
			if (incoming) {
				h += '<div class="lo-stale sq-incoming"><p><b>This link carries a squad:</b> ' + esc(named(incoming).map(function (p) { return p.n + ' (' + ROLE[p.r].name + ')'; }).join(', ')) + '. You already have one saved on this device.</p><button type="button" class="btn btn-sm" data-sq-use>Use the squad from the link</button></div>';
			}
			h += '<div class="card card-pad sq-edit"><div class="sq-edit-head"><div><span class="eyebrow">Your squad</span><h3>Who plays what</h3></div><label class="sq-team"><span class="sq-k">Team name</span><input type="text" maxlength="40" data-sq-name value="' + esc(squad.name) + '" placeholder="Optional"></label></div>' +
				'<div class="sq-rows">' + squad.players.map(function (p, i) {
					return '<div class="sq-row" style="--role:' + esc(ROLE[p.r].color) + '"><span class="sq-dot"></span><input type="text" maxlength="24" data-sq-n="' + i + '" value="' + esc(p.n) + '" placeholder="Player ' + (i + 1) + '" aria-label="Player ' + (i + 1) + ' name">' +
						'<select data-sq-r="' + i + '" aria-label="Player ' + (i + 1) + ' role">' + D.roles.map(function (r) { return '<option value="' + esc(r.key) + '"' + (r.key === p.r ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select>' +
						'<button type="button" class="btn btn-sm btn-ghost" data-sq-del="' + i + '" aria-label="Remove player ' + (i + 1) + '">Remove</button></div>';
				}).join('') + '</div>' +
				'<div class="sq-actions">' + (squad.players.length < MAX_PLAYERS ? '<button type="button" class="btn btn-sm" data-sq-add>Add a player</button>' : '') +
				'<button type="button" class="btn btn-sm btn-primary" data-sq-share' + (named(squad).length ? '' : ' disabled') + '>Copy squad link</button><a class="btn btn-sm" href="../match/">Open Match Night</a></div>' +
				'<p class="muted sq-hint">Names are saved on this device only. Send the squad link to your players so they see the same line-up; nothing is posted to the site.</p></div>';
			var cards = named(squad);
			h += '<div class="grid sq-cards">' + (cards.length ? cards.map(function (p, i) {
				var r = ROLE[p.r], mode = openMode[i] || 'hp';
				var mine = all.map(function (pl) { return { pl: pl, n: pl.items.filter(function (it) { return it && it.r === p.r; }).length }; }).filter(function (x) { return x.n; });
				return '<article class="card sq-card" id="player-' + (i + 1) + '" style="--role:' + esc(r.color) + '"><div class="role-top">' + badge(r) + '<div><h3>' + esc(p.n) + '</h3><span class="muted">' + esc(r.name) + ' · ' + esc(r.tag) + '</span></div></div>' +
					'<p class="sq-sum">' + esc(r.summary) + '</p>' + classHtml(r) +
					'<div class="sq-jobs"><div class="lo-tabs" role="tablist">' + Object.keys(D.modes).map(function (m) { return '<button type="button" role="tab" data-sq-mode="' + m + '" data-sq-card="' + i + '" class="' + (m === mode ? 'is-on' : '') + '" aria-selected="' + (m === mode) + '">' + esc(D.modes[m]) + '</button>'; }).join('') + '</div>' +
					'<ul>' + ((r.jobs[mode] || []).map(function (j) { return '<li>' + esc(j) + '</li>'; }).join('') || '<li class="muted">Nothing written for this mode yet.</li>') + '</ul></div>' +
					'<div class="sq-plans"><span class="sq-k">Plans with a route for ' + esc(r.name) + '</span>' + (mine.length ? '<ul>' + mine.map(function (x) { return '<li><a href="' + esc(mapUrl(x.pl.map.slug, x.pl.mode, true)) + '">' + esc(x.pl.map.name) + ' · ' + esc(D.modes[x.pl.mode]) + '</a><span class="muted">' + x.n + (x.n === 1 ? ' item' : ' items') + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">None on this device yet. Draw one in the <a href="../maps/">map planner</a> using the ' + esc(r.name) + ' colour.</p>') + '</div>' +
					'<a class="lo-src" href="../roles/#role-' + esc(r.key) + '">How to play ' + esc(r.name) + '</a></article>';
			}).join('') : '<p class="muted sq-none">Type a name above and that player gets a card here with their class, their job in each mode and the plans drawn for their role.</p>') + '</div>';
			var active = document.activeElement, sel = keepFocus && active && active.getAttribute && (active.getAttribute('data-sq-n') !== null ? '[data-sq-n="' + active.getAttribute('data-sq-n') + '"]' : null);
			var pos = sel ? active.selectionStart : null;
			sq.innerHTML = h;
			if (sel) { var el = sq.querySelector(sel); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }
		};
		var typing = 0;
		sq.addEventListener('input', function (e) {
			var t = e.target;
			if (t.hasAttribute('data-sq-name')) squad.name = t.value;
			else if (t.hasAttribute('data-sq-n')) squad.players[+t.getAttribute('data-sq-n')].n = t.value;
			else return;
			saveSquad(squad);
			clearTimeout(typing); typing = setTimeout(function () { renderSquad(true); }, 450);
		});
		sq.addEventListener('change', function (e) {
			var t = e.target;
			if (!t.hasAttribute('data-sq-r')) return;
			squad.players[+t.getAttribute('data-sq-r')].r = t.value;
			saveSquad(squad); renderSquad();
		});
		sq.addEventListener('click', function (e) {
			var b = e.target.closest('button');
			if (!b) return;
			if (b.hasAttribute('data-sq-add')) { squad.players.push({ n: '', r: D.roles[squad.players.length % D.roles.length].key }); saveSquad(squad); renderSquad(); var ins = sq.querySelectorAll('[data-sq-n]'); ins[ins.length - 1].focus(); }
			else if (b.hasAttribute('data-sq-del')) { squad.players.splice(+b.getAttribute('data-sq-del'), 1); saveSquad(squad); renderSquad(); }
			else if (b.hasAttribute('data-sq-share')) copy(squadLink(squad), 'Squad link copied');
			else if (b.hasAttribute('data-sq-use')) { squad = incoming; incoming = null; saveSquad(squad); history.replaceState(null, '', location.pathname); renderSquad(); toast('Squad saved to this device'); }
			else if (b.hasAttribute('data-sq-mode')) { openMode[+b.getAttribute('data-sq-card')] = b.getAttribute('data-sq-mode'); renderSquad(); }
		});
		renderSquad();
	}

	// ---------- match night ----------
	var mt = document.querySelector('[data-match]');
	if (mt) {
		var q = new URLSearchParams(location.search), saved = ls(MATCH_KEY, {}) || {};
		var findMap = function (slug) { return D.maps.filter(function (m) { return m.slug === slug; })[0]; };
		var lastUsed = ls('mw4hub:last', {}) || {};
		var st = { map: findMap(q.get('map')) || findMap(saved.map) || findMap(lastUsed.slug) || D.maps[0], mode: q.get('mode') || saved.mode || lastUsed.mode || 'hp' };
		var renderMatch = function () {
			var m = st.map;
			if (m.modes.indexOf(st.mode) < 0) st.mode = m.modes[0];
			var mode = st.mode, squad = readSquad(), has = named(squad).length > 0;
			var plan = ls('mw4hub:' + m.slug + ':' + mode, []), nPlan = Array.isArray(plan) ? plan.length : 0;
			var team = ls('mw4hub:' + m.slug + ':team', null), custom = team && Array.isArray(team.callouts) ? team.callouts.length : 0;
			var rules = D.rules[mode] || {}, coach = (D.coaching[mode] || []).slice(0, 4);
			lsSet(MATCH_KEY, { map: m.slug, mode: mode });
			try { history.replaceState(null, '', '?map=' + encodeURIComponent(m.slug) + '&mode=' + mode); } catch (e) { /* ignore */ }
			var h = '<div class="lo-toolbar mt-bar"><div class="chips mt-maps" role="tablist" aria-label="Map">' + D.maps.map(function (x) { return '<button type="button" class="chip' + (x === m ? ' is-on' : '') + '" data-mt-map="' + esc(x.slug) + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' +
				'<div class="seg" role="tablist" aria-label="Mode">' + m.modes.map(function (k) { return '<button type="button" role="tab" data-mt-mode="' + k + '" class="' + (k === mode ? 'is-on' : '') + '" aria-selected="' + (k === mode) + '">' + esc(D.modes[k]) + '</button>'; }).join('') + '</div></div>';
			var notes = '<section class="card mt-notes"><header class="mt-h"><div><span class="eyebrow">Before you queue</span><h3>Team rules</h3></div></header>' +
				(coach.length ? '<ul>' + coach.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Hijack is new. See the <a href="../roles/">role guide</a> for the early read.</p>') +
				(m.tips.length ? '<span class="sq-k">On ' + esc(m.name) + '</span><ul>' + m.tips.slice(0, 3).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
			h += '<div class="mt-grid"><div class="mt-col"><section class="card mt-plan"><header class="mt-h"><div><span class="eyebrow">The plan</span><h3>' + esc(m.name) + ' · ' + esc(D.modes[mode]) + '</h3></div><div class="mt-acts"><a class="btn btn-sm btn-primary" href="' + esc(mapUrl(m.slug, mode, true)) + '">Full-screen briefing</a><a class="btn btn-sm" href="' + esc(mapUrl(m.slug, mode, false)) + '">Edit in planner</a></div></header>' +
				'<p class="muted mt-planinfo">' + (nPlan ? 'Your saved plan: ' + nPlan + (nPlan === 1 ? ' item' : ' items') + ' on this device.' : 'No plan saved on this device for this map and mode yet. The briefing shows the standard intel until you draw one.') + '</p>' +
				'<div class="mt-frame"><iframe title="' + esc(m.name + ' ' + D.modes[mode] + ' briefing') + '" loading="lazy" src="' + esc(mapUrl(m.slug, mode, true)) + '"></iframe></div></section>' + notes + '</div>';
			h += '<div class="mt-col"><section class="card mt-who"><header class="mt-h"><div><span class="eyebrow">Who does what</span><h3>' + esc(squad.name || 'Your squad') + '</h3></div><a class="btn btn-sm" href="../squad/">' + (has ? 'Edit squad' : 'Set up squad') + '</a></header>' +
				(rules.rules ? '<p class="muted mt-rules">' + esc(rules.rules) + '</p>' : '') +
				'<div class="mt-roles">' + D.roles.map(function (r) {
					var ps = playersFor(squad, r.key), jobs = (rules.jobs || []).filter(function (j) { return j.who.indexOf(r.key) >= 0; });
					var b = r.cls && r.cls.builds[0];
					return '<div class="mt-role" style="--role:' + esc(r.color) + '">' + badge(r) + '<div class="mt-role-main"><div class="mt-role-top"><b>' + (ps.length ? esc(ps.map(function (p) { return p.n; }).join(' & ')) : esc(r.name)) + '</b><span class="muted">' + (ps.length ? esc(r.name) : (has ? 'Nobody assigned' : esc(r.tag))) + '</span>' +
						jobs.map(function (j) { return '<span class="chip cls-role"><i></i>' + esc(j.job) + '</span>'; }).join('') + '</div>' +
						'<p>' + esc((jobs[0] && jobs[0].what) || (r.jobs[mode] || [])[0] || r.summary) + '</p>' +
						(b ? '<a class="mt-class" href="../ranked-loadouts/#' + esc(b.id) + '">' + esc(b.weapon) + ' · ' + esc(r.cls.kit.filter(function (k) { return /^Perk 2|^Lethal/.test(k[0]); }).map(function (k) { return k[1]; }).join(' · ')) + '</a>' : '') + '</div></div>';
				}).join('') + '</div></section>';
			h += '<section class="card mt-calls"><header class="mt-h"><div><span class="eyebrow">Callouts</span><h3>' + (mode === 'hp' && m.hills.length ? 'Hills in order' : 'Names to use') + '</h3></div></header>' +
				(mode === 'hp' && m.hills.length ? '<ol class="mt-hills">' + m.hills.map(function (x) { return '<li><b>P' + esc(x.n) + '</b><span>' + esc(x.call || x.name) + '</span>' + (x.call ? '<em>' + esc(x.name) + '</em>' : '') + '</li>'; }).join('') + '</ol>' : '') +
				(m.names.length ? '<p class="mt-names">' + m.names.map(function (n) { return '<span class="chip">' + esc(n) + '</span>'; }).join('') + '</p>' : (mode !== 'hp' || !m.hills.length ? '<p class="muted">No callout list for this map yet. The area names are on the map itself.</p>' : '')) +
				(custom ? '<p class="muted">Your team has ' + custom + ' callouts of its own on this map. They show in the briefing.</p>' : '') +
				(m.src ? '<a class="lo-src" href="' + esc(m.src.url) + '" target="_blank" rel="noopener nofollow">' + esc(m.src.label) + '</a>' : '') + '</section></div></div>';
			mt.innerHTML = h;
		};
		mt.addEventListener('click', function (e) {
			var b = e.target.closest('button');
			if (!b) return;
			if (b.hasAttribute('data-mt-map')) { st.map = findMap(b.getAttribute('data-mt-map')) || st.map; renderMatch(); }
			else if (b.hasAttribute('data-mt-mode')) { st.mode = b.getAttribute('data-mt-mode'); renderMatch(); }
		});
		renderMatch();
	}
})();
