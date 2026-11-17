/* MW4 Hub - My Plans: lists the plans saved in this browser by the map planner */
(function () {
	'use strict';
	var box = document.querySelector('[data-local-plans]');
	var mapsEl = document.getElementById('mw4-maps');
	if (!box || !mapsEl) return;
	var maps = [];
	try { maps = JSON.parse(mapsEl.textContent); } catch (e) { return; }
	var rows = box.querySelector('[data-plan-rows]');
	var count = box.querySelector('[data-plan-count]');
	var emptyHtml = rows.innerHTML;

	function esc(s) {
		return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
	}
	function b64e(str) {
		var bytes = new TextEncoder().encode(str), bin = '';
		for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
		return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
	function key(slug, mode) { return 'mw4hub:' + slug + ':' + mode; }
	function load() {
		var list = [];
		maps.forEach(function (m) {
			['hp', 'snd'].forEach(function (mode) {
				var items = [];
				try { items = JSON.parse(localStorage.getItem(key(m.slug, mode)) || '[]'); } catch (e) { items = []; }
				if (Array.isArray(items) && items.length) list.push({ map: m, mode: mode, items: items });
			});
		});
		return list;
	}
	function render() {
		var list = load();
		count.textContent = list.length;
		if (!list.length) { rows.innerHTML = emptyHtml; return; }
		rows.innerHTML = list.map(function (p) {
			var u = new URL('../maps/' + p.map.slug + '/', location.href);
			if (p.mode === 'snd') u.searchParams.set('mode', 'snd');
			var open = u.toString();
			u.hash = 'p=' + b64e(JSON.stringify({ v: 1, d: p.mode, i: p.items }));
			var n = p.items.length;
			return '<div class="plan-row card"><div class="plan-main"><b>' + esc(p.map.name) + ' ' + (p.mode === 'snd' ? 'S&amp;D' : 'Hardpoint') + ' plan</b><span class="muted">' + n + (n === 1 ? ' item' : ' items') + ' · saved on this device</span></div><div class="plan-actions">' +
				'<a class="btn btn-sm btn-primary" href="' + esc(open) + '">Open</a><button type="button" class="btn btn-sm" data-copy="' + esc(u.toString()) + '">Copy link</button>' +
				'<button type="button" class="btn btn-sm btn-ghost" data-local-del="' + esc(p.map.slug + ':' + p.mode) + '">Delete</button></div></div>';
		}).join('');
	}
	box.addEventListener('click', function (e) {
		var del = e.target.closest('[data-local-del]');
		if (!del) return;
		if (!window.confirm('Delete this plan from this device? This cannot be undone.')) return;
		var parts = del.getAttribute('data-local-del').split(':');
		try { localStorage.removeItem(key(parts[0], parts[1])); } catch (err) { /* ignore */ }
		render();
	});
	render();
})();
