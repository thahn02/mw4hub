/* MW4 Hub - loadouts, filters, copy buttons, video embeds, My Plans */
(function () {
	'use strict';
	var CFG = window.MW4HUB || {};

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

	// Loadout screen: pick a loadout from the list, shown as slot tiles. The open loadout is kept in the address
	// so a link to it can be shared.
	Array.prototype.forEach.call(document.querySelectorAll('[data-ld]'), function (ld) {
		var last = {};
		function groupOf(id) { return id.charAt(0) === 'r' ? 'role' : 'gun'; }
		function setGroup(g) {
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-group]'), function (b) {
				var on = b.getAttribute('data-ld-group') === g;
				b.classList.toggle('is-on', on);
				b.setAttribute('aria-selected', on ? 'true' : 'false');
			});
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-list]'), function (l) { l.hidden = l.getAttribute('data-ld-list') !== g; });
		}
		function open(id, remember) {
			var view = id && ld.querySelector('[data-ld-view="' + id.replace(/[^a-z0-9-]/gi, '') + '"]');
			if (!view) return false;
			Array.prototype.forEach.call(ld.querySelectorAll('[data-ld-view]'), function (v) { v.hidden = v !== view; });
			Array.prototype.forEach.call(ld.querySelectorAll('.ld-item'), function (b) {
				var on = b.getAttribute('data-ld-open') === id;
				b.classList.toggle('is-on', on);
				if (on) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView && b.offsetParent) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else b.removeAttribute('aria-current');
			});
			setGroup(groupOf(id));
			last[groupOf(id)] = id;
			if (remember && window.history && history.replaceState) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } }
			return true;
		}
		ld.addEventListener('click', function (e) {
			var g = e.target.closest('[data-ld-group]');
			if (g) {
				var key = g.getAttribute('data-ld-group');
				var first = ld.querySelector('[data-ld-list="' + key + '"] .ld-item');
				if (!open(last[key] || (first && first.getAttribute('data-ld-open')), true)) setGroup(key);
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
			var card = tab.closest('.lo-card');
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
