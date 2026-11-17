/* MW4 Hub - loadouts, filters, copy buttons, video embeds, My Plans */
(function () {
	'use strict';
	var CFG = window.MW4HUB || {};
	var ROOT = '';
	try { ROOT = new URL('../', document.currentScript.src).href; } catch (e0) { /* ignore */ }

	// Installable: offline fallback, and an install hint on the home page.
	if (ROOT && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
		window.addEventListener('load', function () { navigator.serviceWorker.register(ROOT + 'sw.js', { scope: ROOT }).catch(function () { /* not available */ }); });
	}
	var installEl = document.querySelector('[data-install]');
	if (installEl) {
		var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
		if (!isStandalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
			installEl.textContent = 'Put MW4 Hub on your home screen: tap Share, then Add to Home Screen.';
			installEl.hidden = false;
		}
		window.addEventListener('beforeinstallprompt', function (e) {
			e.preventDefault();
			installEl.innerHTML = 'Use it like an app. <button type="button" class="btn btn-sm">Install MW4 Hub</button>';
			installEl.hidden = false;
			installEl.querySelector('button').addEventListener('click', function () { e.prompt(); installEl.hidden = true; });
		});
		window.addEventListener('appinstalled', function () { installEl.hidden = true; });
	}

	function toast(msg) {
		var t = document.querySelector('.hub-toast');
		if (!t) {
			t = document.createElement('div');
			t.className = 'pl-toast hub-toast';
			t.setAttribute('role', 'status');
			document.body.appendChild(t);
		}
		t.textContent = msg;
		t.classList.add('is-on');
		clearTimeout(t._t);
		t._t = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
	}
	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
		return new Promise(function (resolve) {
			var ta = document.createElement('textarea');
			ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
			document.body.appendChild(ta); ta.select();
			try { document.execCommand('copy'); } catch (e) { /* ignore */ }
			ta.remove(); resolve();
		});
	}
	function api(path, method, body) {
		var headers = { Accept: 'application/json' };
		if (body) headers['Content-Type'] = 'application/json';
		if (CFG.nonce) headers['X-WP-Nonce'] = CFG.nonce;
		return fetch(CFG.rest + path, { method: method || 'GET', headers: headers, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined })
			.then(function (r) {
				return r.json().catch(function () { return {}; }).then(function (j) {
					if (!r.ok) throw new Error((j && j.message) || 'Request failed');
					return j;
				});
			});
	}

	// Freshness: say how long ago each list was checked, and if the daily refresh has stopped, hide the list
	// instead of showing old builds as if they were current.
	function daysSince(iso) {
		var t = Date.parse(iso + 'T00:00:00Z');
		return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
	}
	Array.prototype.forEach.call(document.querySelectorAll('[data-ago]'), function (el) {
		var d = daysSince(el.getAttribute('data-ago'));
		if (d === null) return;
		el.textContent = (d <= 0 ? 'today' : (d === 1 ? 'yesterday' : d + ' days ago')) + ' (' + el.textContent + ')';
	});
	Array.prototype.forEach.call(document.querySelectorAll('[data-lo-app][data-checked]'), function (app) {
		var d = daysSince(app.getAttribute('data-checked')), max = +app.getAttribute('data-max-age') || 0;
		if (d === null || !max || d <= max) return;
		var bar = document.createElement('div');
		bar.className = 'lo-stale';
		bar.innerHTML = '<p><b>These loadouts are out of date.</b> They were last checked ' + d + ' days ago, so they are hidden until the next refresh.</p><button type="button" class="btn btn-sm">Show them anyway</button>';
		app.classList.add('is-stale');
		app.insertBefore(bar, app.firstChild);
		bar.querySelector('button').addEventListener('click', function () { app.classList.remove('is-stale'); bar.querySelector('button').remove(); });
	});

	// Home: warn if the daily refresh has stopped, and offer the map that was open last.
	Array.prototype.forEach.call(document.querySelectorAll('[data-refresh]'), function (box) {
		var d = daysSince(box.getAttribute('data-refresh')), max = +box.getAttribute('data-max-age') || 2;
		if (d === null || d <= max) return;
		var w = document.createElement('p');
		w.className = 'chg-warn';
		w.textContent = 'The daily refresh has not run for ' + d + ' days, so loadouts and rules may be behind.';
		box.insertBefore(w, box.querySelector('.chg-list'));
	});
	var LAST_KEY = 'mw4hub:last', MODES = { hp: 'Hardpoint', snd: 'Search & Destroy', hj: 'Hijack' };
	function readLast() { try { var v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return v && /^[a-z0-9-]+$/.test(v.slug || '') && MODES[v.mode] ? v : null; } catch (e) { return null; } }
	var plannerEl = document.getElementById('mw4-planner');
	if (plannerEl && window.self === window.top) { // not when embedded as the Match Night briefing
		var slug = location.pathname.replace(/\/+$/, '').split('/').pop();
		var remember = function (mode) {
			if (!MODES[mode]) return;
			try { localStorage.setItem(LAST_KEY, JSON.stringify({ slug: slug, mode: mode, name: document.title.split(/ Map Planner| \u2013 /)[0], t: Date.now() })); } catch (e) { /* private mode */ }
		};
		var prev = readLast();
		remember(new URLSearchParams(location.search).get('mode') || (prev && prev.slug === slug ? prev.mode : '') || 'hp');
		plannerEl.addEventListener('click', function (e) { var b = e.target.closest('.pl-modes [data-mode]'); if (b) remember(b.getAttribute('data-mode')); });
	}
	var cont = document.querySelector('[data-continue]'), last = readLast();
	if (cont && last) {
		var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
		var target = 'maps/' + last.slug + '/?mode=' + last.mode;
		// Opened from the home-screen icon: go straight back to the last map, once per launch.
		if (standalone && /[?&]source=app/.test(location.search) && !sessionStorage.getItem('mw4hub:launched')) {
			try { sessionStorage.setItem('mw4hub:launched', '1'); } catch (e) { /* ignore */ }
			location.replace(target);
		} else {
			cont.className = 'continue';
			cont.innerHTML = '<div><span class="eyebrow">Pick up where you left off</span><b></b></div><div class="hero-actions"><a class="btn btn-primary btn-sm">Open the planner</a><a class="btn btn-sm">Match Night</a></div>';
			cont.querySelector('b').textContent = (last.name || last.slug) + ' \u00b7 ' + MODES[last.mode];
			var links = cont.querySelectorAll('a');
			links[0].href = target;
			links[1].href = 'match/?map=' + encodeURIComponent(last.slug) + '&mode=' + last.mode;
			cont.hidden = false;
		}
	}

	// Loadout apps: tabs, filters, search.
	Array.prototype.forEach.call(document.querySelectorAll('[data-lo-app]'), function (app) {
		var seg = app.querySelector('[data-seg]');
		var filters = app.querySelector('[data-filters]');
		var none = app.querySelector('.lo-none');
		var state = { cls: '', q: '' };
		function activePanel() {
			var on = seg ? seg.querySelector('.is-on') : null;
			return on ? app.querySelector('[data-panel="' + on.getAttribute('data-tab') + '"]') : app;
		}
		function apply() {
			var panel = activePanel();
			if (!panel) return;
			var cards = panel.querySelectorAll('.lo-card');
			var shown = 0;
			Array.prototype.forEach.call(cards, function (c) {
				var ok = (!state.cls || c.getAttribute('data-class') === state.cls) && (!state.q || (c.getAttribute('data-search') || '').indexOf(state.q) >= 0);
				c.hidden = !ok;
				if (ok) shown++;
			});
			Array.prototype.forEach.call(panel.querySelectorAll('.tier-block'), function (b) {
				b.hidden = !b.querySelector('.lo-card:not([hidden])');
			});
			if (none) none.hidden = !cards.length || shown > 0;
		}
		if (seg) {
			seg.addEventListener('click', function (e) {
				var b = e.target.closest('button[data-tab]');
				if (!b) return;
				Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) {
					x.classList.toggle('is-on', x === b);
					x.setAttribute('aria-selected', x === b ? 'true' : 'false');
				});
				Array.prototype.forEach.call(app.querySelectorAll('[data-panel]'), function (p) {
					p.hidden = p.getAttribute('data-panel') !== b.getAttribute('data-tab');
				});
				var panel = activePanel();
				if (filters) filters.hidden = !(panel && panel.querySelector('.lo-card'));
				apply();
			});
		}
		var chips = app.querySelector('[data-filter-class]');
		if (chips) {
			chips.addEventListener('click', function (e) {
				var b = e.target.closest('button[data-v]');
				if (!b) return;
				Array.prototype.forEach.call(chips.querySelectorAll('button'), function (x) { x.classList.toggle('is-on', x === b); });
				state.cls = b.getAttribute('data-v');
				apply();
			});
		}
		var search = app.querySelector('[data-filter-search]');
		if (search) {
			search.addEventListener('input', function () {
				state.q = search.value.trim().toLowerCase();
				apply();
			});
		}
	});

	// Weapon pictures are official graphics loaded by link. If one does not load, drop it and keep the name.
	function picMissing(img) { var p = img.closest && img.closest('.gun-pic'); if (p) p.classList.add('is-missing'); }
	document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') picMissing(e.target); }, true);
	Array.prototype.forEach.call(document.querySelectorAll('.gun-pic img'), function (img) { if (img.complete && !img.naturalWidth && img.currentSrc) picMissing(img); });

	// Loadout screen: pick a loadout from the list, shown as slot tiles. The open loadout is kept in the address
	// so a link to it can be shared.
	Array.prototype.forEach.call(document.querySelectorAll('[data-ld]'), function (ld) {
		var last = {};
		function item(id, list) { return (list || ld).querySelector('.ld-item[data-ld-open="' + id + '"]'); }
		function listEl(key) { return ld.querySelector('[data-ld-list="' + key + '"]'); }
		function shown() { var l = ld.querySelector('[data-ld-list]:not([hidden])'); return l ? l.getAttribute('data-ld-list') : ''; }
		// A loadout can sit in more than one list (Warzone: by tier and by range). Stay in the list being shown if it has it.
		function groupOf(id) { var cur = shown(); if (cur && item(id, listEl(cur))) return cur; var it = item(id); return it ? it.closest('[data-ld-list]').getAttribute('data-ld-list') : cur; }
		function setGroup(g) {
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-group]'), function (b) {
				var on = b.getAttribute('data-ld-group') === g;
				b.classList.toggle('is-on', on);
				b.setAttribute('aria-selected', on ? 'true' : 'false');
			});
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-list]'), function (l) { l.hidden = l.getAttribute('data-ld-list') !== g; });
		}
		function current() { var v = ld.querySelector('[data-ld-view]:not([hidden])'); return v ? v.getAttribute('data-ld-view') : ''; }
		function open(id, remember, group) {
			id = String(id || '').replace(/[^a-z0-9-]/gi, '');
			var view = id && ld.querySelector('[data-ld-view="' + id + '"]');
			if (!view) return false;
			if (group) setGroup(group);
			var g = groupOf(id);
			setGroup(g);
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-view]'), function (v) { v.hidden = v !== view; });
			Array.prototype.forEach.call(ld.querySelectorAll('.ld-item'), function (b) {
				var on = b.getAttribute('data-ld-open') === id;
				b.classList.toggle('is-on', on);
				if (on) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView && b.offsetParent) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else b.removeAttribute('aria-current');
			});
			last[g] = id;
			if (remember && window.history && history.replaceState) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } }
			return true;
		}
		ld.addEventListener('click', function (e) {
			var g = e.target.closest('[data-ld-group]');
			if (g) {
				var key = g.getAttribute('data-ld-group'), list = listEl(key), cur = current();
				var first = list && list.querySelector('.ld-item');
				// Same loadout if the other list has it, else the one last open there, else its first.
				var want = (item(cur, list) && cur) || last[key] || (first && first.getAttribute('data-ld-open'));
				if (!open(want, true, key)) setGroup(key);
				return;
			}
			var b = e.target.closest('[data-ld-open]');
			if (!b) return;
			if (!open(b.getAttribute('data-ld-open'), true)) {
				// "Run by" chip for a role that does not list this exact build: open that role's first class.
				var alt = ld.querySelector('.ld-item[data-ld-open^="' + (b.getAttribute('data-ld-fallback') || '~') + '-"]');
				if (alt) open(alt.getAttribute('data-ld-open'), true);
			}
			if (!b.classList.contains('ld-item')) { var main = ld.querySelector('.ld-main'); if (main && main.getBoundingClientRect().top < 0) main.scrollIntoView({ block: 'start' }); }
		});
		ld.addEventListener('keydown', function (e) {
			if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
			var cur = e.target.closest('.ld-item');
			if (!cur) return;
			var items = Array.prototype.slice.call(cur.closest('.ld-list').querySelectorAll('.ld-item'));
			var next = items[items.indexOf(cur) + (e.key === 'ArrowDown' ? 1 : -1)];
			if (!next) return;
			e.preventDefault();
			next.focus();
			open(next.getAttribute('data-ld-open'), true);
		});
		open(location.hash.slice(1), false);
		window.addEventListener('hashchange', function () { open(location.hash.slice(1), false); });
	});

	document.addEventListener('click', function (e) {
		// Build variant tabs inside a card.
		var tab = e.target.closest('.lo-tabs button[data-b]');
		if (tab) {
			var card = tab.closest('.lo-card, .ld-view');
			Array.prototype.forEach.call(card.querySelectorAll('.lo-tabs button'), function (x) {
				x.classList.toggle('is-on', x === tab);
				x.setAttribute('aria-selected', x === tab ? 'true' : 'false');
			});
			Array.prototype.forEach.call(card.querySelectorAll('.lo-build'), function (bd) {
				bd.hidden = bd.getAttribute('data-b') !== tab.getAttribute('data-b');
			});
			return;
		}
		// Copy buttons.
		var cp = e.target.closest('[data-copy]');
		if (cp && !cp.closest('#mw4-planner')) {
			copyText(cp.getAttribute('data-copy')).then(function () {
				if (cp.classList.contains('lo-copy')) {
					var old = cp.textContent;
					cp.textContent = 'Copied';
					cp.classList.add('is-done');
					setTimeout(function () { cp.textContent = old; cp.classList.remove('is-done'); }, 1600);
				} else {
					toast('Link copied');
				}
			});
			return;
		}
		// Lite YouTube embeds.
		var yt = e.target.closest('.yt-lite');
		if (yt && !yt.querySelector('iframe')) {
			var id = yt.getAttribute('data-id');
			var f = document.createElement('iframe');
			f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
			f.title = yt.getAttribute('aria-label') || 'YouTube video';
			f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
			f.allowFullscreen = true;
			yt.innerHTML = '';
			yt.appendChild(f);
			return;
		}
		// My Plans: delete.
		var del = e.target.closest('[data-del]');
		if (del) {
			if (!window.confirm('Delete this plan? This cannot be undone.')) return;
			del.disabled = true;
			api('plans/' + encodeURIComponent(del.getAttribute('data-del')), 'DELETE').then(function () {
				var row = del.closest('.plan-row');
				if (row) { row.style.transition = 'opacity .3s, transform .3s'; row.style.opacity = '0'; row.style.transform = 'scale(.98)'; setTimeout(function () { row.remove(); }, 300); }
				toast('Plan deleted');
			}).catch(function (err) { del.disabled = false; toast(err.message); });
			return;
		}
		// My Plans: generate team code.
		var gen = e.target.closest('[data-team-gen]');
		if (gen) {
			var inp = gen.closest('form').querySelector('input[name="team"]');
			inp.value = 'squad-' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
		}
	});

	Array.prototype.forEach.call(document.querySelectorAll('[data-team-form]'), function (form) {
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var val = form.querySelector('input[name="team"]').value.trim();
			api('me/team', 'POST', { team: val }).then(function (r) {
				toast(r.team ? 'Team code saved' : 'Team code removed');
				setTimeout(function () { location.reload(); }, 700);
			}).catch(function (err) { toast(err.message); });
		});
	});
})();
