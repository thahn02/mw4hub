#!/usr/bin/env node
/*
 * MW4 Hub static site builder. No dependencies.
 *   node build.js            -> writes ./dist
 *   OUT=docs node build.js   -> writes ./docs
 * Content lives in ./data/*.json, styles and scripts in ./src/assets, images in ./src/images.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, process.env.OUT || 'dist');

const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const site = read('site.json');
if (process.env.BASE) site.base = process.env.BASE; // e.g. BASE=/mw4hub/ for a GitHub Pages project site
const allMaps = read('maps.json');
const maps = allMaps.filter((m) => m.modes && m.modes.length); // only maps in the Ranked pool are published
const has = (m, mode) => m.modes.indexOf(mode) >= 0;
const sndMaps = maps.filter((m) => has(m, 'snd') && m.snd && m.snd.sites && m.snd.sites.length);
const loadouts = read('loadouts.json');
const wzmaps = read('warzone-maps.json');
const roleData = read('roles.json');
const roster = read('roster.json');
const guide = read('role-guide.json');
const extras = read('map-extras.json');
const rules = read('rules.json');
const classData = read('classes.json');
const weaponList = read('weapons.json');

// Freshness. Anything not re-checked within these many days is left off the site, so a stale build can never be
// shown as current. TODAY can be pinned (TODAY=2026-11-17 node build.js) for a repeatable build.
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const MAX_AGE = { classes: 14, warzone: 3 };
const ageDays = (iso) => (iso ? Math.floor((Date.parse(TODAY) - Date.parse(iso)) / 86400000) : 9999);
const pages = read('pages.json');

// ---------- helpers ----------
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const up = (depth) => (depth ? '../'.repeat(depth) : './');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
	return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : String(iso || '');
}
function assetVer(file) {
	return crypto.createHash('sha1').update(fs.readFileSync(path.join(SRC, 'assets', file))).digest('hex').slice(0, 8);
}
function write(rel, html) {
	const dst = path.join(OUT, rel);
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.writeFileSync(dst, html);
}
function copyDir(from, to) {
	if (!fs.existsSync(from)) return 0;
	let n = 0;
	fs.mkdirSync(to, { recursive: true });
	for (const e of fs.readdirSync(from, { withFileTypes: true })) {
		const a = path.join(from, e.name), b = path.join(to, e.name);
		if (e.isDirectory()) n += copyDir(a, b); else { fs.copyFileSync(a, b); n++; }
	}
	return n;
}
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026');

const NAV = [['maps', 'Maps'], ['bomb-sites', 'Bomb Sites'], ['ranked-loadouts', 'Ranked Loadouts'], ['warzone', 'Warzone'], ['roles', 'Roles']];
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#d8a94b" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle cx="12" cy="12" r="1.6" fill="#d8a94b" stroke="none"/></svg>';
const ICO = {
	map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
	gun: '<path d="M3 10h14l2-2h2v4h-3l-1 2h-4l-1 4H8l1-4H5l-2-2z"/>',
	drop: '<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/><path d="M9 12l2 2 4-4"/>',
};
const ico = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[n] || '') + '</svg>';

// ---------- layout ----------
function layout(o) {
	const r = o.base !== undefined ? o.base : up(o.depth);
	const url = (slug) => (slug ? r + slug + '/' : r);
	const css = ['hub.css'].concat(o.planner ? ['planner.css'] : [], ['theme.css']);
	const nav = (cls) => NAV.map(([slug, label]) => {
		const on = o.active === slug;
		return '<li><a href="' + url(slug) + '" class="' + (on ? 'is-active' : '') + '"' + (on && cls ? ' aria-current="page"' : '') + '>' + esc(label) + '</a></li>';
	}).join('');
	const brand = '<span class="brand-mark">' + LOGO + '</span><span class="brand-word">MW4<span>HUB</span></span>';
	return '<!doctype html>\n<html lang="en-US" class="no-js">\n<head>\n<meta charset="UTF-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#07090a">\n<meta name="color-scheme" content="dark">\n' +
		"<script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');</script>\n" +
		'<title>' + esc(o.title) + '</title>\n' + (o.description ? '<meta name="description" content="' + esc(o.description) + '">\n' : '') +
		'<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#12160c"/>' + LOGO.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace('<circle cx="12" cy="12" r="7.5"/>', '<circle cx="12" cy="12" r="7.5" fill="none" stroke="#d8a94b" stroke-width="2"/>').replace('<path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>', '<path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="#d8a94b" stroke-width="2" stroke-linecap="round"/>') + '</svg>') + '">\n' +
		css.map((f) => '<link rel="stylesheet" href="' + r + 'assets/' + f + '?v=' + assetVer(f) + '">').join('\n') + '\n</head>\n' +
		'<body class="' + esc(o.bodyClass || '') + '">\n<a class="skip-link" href="#main">Skip to content</a>\n' +
		'<header class="site-header" id="top">\n\t<div class="header-inner">\n\t\t<a class="brand" href="' + url('') + '" aria-label="MW4 Hub home">' + brand + '</a>\n' +
		'\t\t<nav class="main-nav" aria-label="Primary"><ul>' + nav(true) + '</ul></nav>\n' +
		'\t\t<div class="header-actions"><a class="btn btn-ghost btn-sm" href="' + url('my-plans') + '">My Plans</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Menu"><span></span><span></span></button></div>\n\t</div>\n' +
		'\t<div class="mobile-nav" id="mobile-nav" hidden><ul>' + nav(false) + '<li><a href="' + url('my-plans') + '">My Plans</a></li></ul></div>\n</header>\n' +
		'<main id="main" class="site-main">\n' + o.content + '\n</main>\n' +
		'<footer class="site-footer">\n\t<div class="container footer-inner">\n\t\t<div class="footer-brand"><a class="brand" href="' + url('') + '">' + brand + '</a><p>Ranked game plans, pro loadouts and interactive maps for Modern Warfare 4. Built for 4v4.</p></div>\n' +
		'\t\t<nav class="footer-links" aria-label="Footer">' + NAV.map(([slug, label]) => '<a href="' + url(slug) + '">' + esc(label) + '</a>').join('') + '<a href="' + url('my-plans') + '">My Plans</a><a href="' + url('credits') + '">Sources &amp; Credits</a></nav>\n' +
		'\t\t<p class="disclaimer">MW4 Hub is an independent fan site. It is not affiliated with or endorsed by Activision. Call of Duty and Modern Warfare are trademarks of Activision Publishing, Inc. Map imagery and game data belong to their respective owners; see Sources &amp; Credits.</p>\n\t</div>\n</footer>\n' +
		'<script>var MW4HUB = {"rest":"","nonce":""};</script>\n' +
		'<script src="' + r + 'assets/hub.js?v=' + assetVer('hub.js') + '" defer></script>\n' +
		'<script src="' + r + 'assets/theme.js?v=' + assetVer('theme.js') + '" defer></script>\n' +
		(o.scripts || []).map((f) => '<script src="' + r + 'assets/' + f + '?v=' + assetVer(f) + '"' + (f === 'planner.js' ? '' : ' defer') + '></script>\n').join('') +
		'</body>\n</html>\n';
}
function pageHero(p) {
	return '<section class="page-hero">\n\t<div class="container">\n' +
		(p.eyebrow ? '\t\t<span class="eyebrow reveal">' + esc(p.eyebrow) + '</span>\n' : '') +
		'\t\t<h1 class="reveal d1">' + esc(p.title) + '</h1>\n' +
		(p.lead ? '\t\t<p class="lead reveal d2">' + esc(p.lead) + '</p>\n' : '') + '\t</div>\n</section>\n';
}
function standardPage(slug, body, extra) {
	const p = pages[slug];
	return layout(Object.assign({
		depth: 1, active: slug, title: p.title + ' \u2013 ' + site.name, description: p.lead,
		content: pageHero(p) + '<div class="container">\n\t<div class="entry-content">\n' + body + '\n\t</div>\n</div>',
	}, extra || {}));
}

// ---------- components (ported from the WordPress shortcodes) ----------
function buildCopyText(d, b) {
	const parts = (b.attachments || []).map((a) => (a.slot ? a.slot + ': ' : '') + a.name);
	const who = d.players && d.players.length ? ' (' + d.players.join(' & ') + ')' : '';
	const bn = b.name ? ' [' + b.name + ']' : '';
	return (d.weapon || '') + who + bn + ' - ' + parts.join(' | ') + ' - via MW4 Hub';
}
function ytLite(id) {
	if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return '';
	return '<button type="button" class="yt-lite" data-id="' + esc(id) + '" aria-label="Play video" style="background-image:url(https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg)"><span class="yt-play" aria-hidden="true"></span></button>';
}
function loadoutCard(d, showTier) {
	const builds = d.builds || [], players = d.players || [];
	const search = [d.weapon || '', d.class || '', d.category || '', d.team || ''].concat(players).join(' ').toLowerCase();
	let h = '<article class="lo-card card" data-class="' + esc(d.class || '') + '" data-search="' + esc(search) + '">';
	h += '<header class="lo-head"><div class="lo-title"><h3 class="lo-weapon">' + esc(d.weapon || '') + '</h3><div class="lo-meta">';
	if (d.class) h += '<span class="chip">' + esc(d.class) + '</span>';
	if (d.category && !players.length) h += '<span class="chip chip-sage">' + esc(d.category) + '</span>';
	if (players.length) h += '<span class="chip chip-brass">' + esc(players.join(' & ')) + '</span>';
	if (d.team) h += '<span class="chip chip-optic">' + esc(d.team) + '</span>';
	h += '</div></div>';
	if (showTier && d.tier) h += '<span class="tier tier-' + esc(d.tier) + '" title="Tier ' + esc(d.tier) + '">' + esc(d.tier) + '</span>';
	h += '</header>';
	if (builds.length > 1) {
		h += '<div class="lo-tabs" role="tablist">' + builds.map((b, i) => '<button type="button" role="tab" data-b="' + i + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(b.name || ('Build ' + (i + 1))) + '</button>').join('') + '</div>';
	}
	builds.forEach((b, i) => {
		h += '<div class="lo-build" data-b="' + i + '"' + (i ? ' hidden' : '') + '>';
		if (builds.length === 1 && b.name && (b.name !== (d.category || '') || players.length)) h += '<div class="lo-bname">' + esc(b.name) + '</div>';
		h += '<ol class="lo-atts">' + (b.attachments || []).map((a) => '<li><span class="lo-slot">' + esc(a.slot || '') + '</span><span class="lo-att">' + esc(a.name || '') + '</span></li>').join('');
		h += '</ol>';
		if (b.source && b.source.url) h += '<a class="lo-bsrc" href="' + esc(b.source.url) + '" target="_blank" rel="noopener nofollow">' + esc((b.both ? 'Same build on both trackers \u00b7 ' : '') + b.source.label) + '</a>';
		h += '<button class="btn btn-sm lo-copy" type="button" data-copy="' + esc(buildCopyText(d, b)) + '">Copy build</button></div>';
	});
	if (!builds.length) h += '<p class="muted lo-empty">Full build not published by our sources yet.</p>';
	if (d.video) h += ytLite(d.video);
	h += '<footer class="lo-foot">';
	if (d.source && d.source.url) h += '<a class="lo-src" href="' + esc(d.source.url) + '" target="_blank" rel="noopener nofollow">' + esc('Source: ' + (d.source.label || 'link')) + '</a>';
	const st = d.sources_tier && Object.keys(d.sources_tier);
	if (st && st.length) h += '<span class="lo-date" title="Tier on each source site">' + esc(st.map((k) => k + ' ' + d.sources_tier[k]).join(' \u00b7 ')) + '</span>';
	if (d.verified) h += '<span class="lo-date">' + esc('Checked ' + fmtDate(d.verified)) + '</span>';
	return h + '</footer></article>';
}
function tierSections(items, labels) {
	let h = '';
	for (const t of ['S', 'A', 'B', 'C', 'D']) {
		const list = items.filter((d) => (d.tier || 'C') === t);
		if (!list.length) continue;
		h += '<div class="tier-block"><div class="tier-head"><span class="tier tier-' + t + '">' + t + '</span><div><h3>' + esc(labels[t] || '') + '</h3><span class="muted">' + list.length + (list.length === 1 ? ' weapon' : ' weapons') + '</span></div></div><div class="grid lo-grid">' + list.map((d) => loadoutCard(d, true)).join('') + '</div></div>';
	}
	return h;
}
function filtersBar(items, tabs) {
	const classes = [];
	items.forEach((d) => { if (d.class && classes.indexOf(d.class) < 0) classes.push(d.class); });
	return '<div class="lo-toolbar"><div class="seg" role="tablist" data-seg>' +
		tabs.map(([key, label, n], i) => '<button type="button" role="tab" data-tab="' + key + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(label) + ' <span>' + n + '</span></button>').join('') +
		'</div><div class="lo-filters" data-filters><div class="chips" data-filter-class><button type="button" class="chip is-on" data-v="">All</button>' +
		classes.map((c) => '<button type="button" class="chip" data-v="' + esc(c) + '">' + esc(c) + '</button>').join('') +
		'</div><input type="search" placeholder="Search weapon or player" data-filter-search aria-label="Search builds"></div></div>';
}
const NONE = '<p class="lo-none muted" hidden>No builds match that filter.</p></div>';
// ---------- competitive classes: legality against the Ranked (CDL) and CMG rule sets ----------
const same = (x, y) => String(x || '').toLowerCase() === String(y || '').toLowerCase();
const inList = (list, v) => (list || []).some((x) => same(x, v));
function gunLegality(name, cls) {
	const w = weaponList.find((x) => same(x.name, name)) || { name, class: cls };
	const out = { cdl: [], cmg: [] };
	if (inList(rules.cdl.weaponClasses, w.class)) out.cdl.push('All ' + w.class + 's are restricted');
	if (inList(rules.cdl.weapons, w.name)) out.cdl.push(w.name + ' is restricted');
	if (inList(rules.cmg.weaponClasses, w.class)) out.cmg.push('All ' + w.class + 's are banned');
	if (inList(rules.cmg.weapons, w.name)) out.cmg.push(w.name + ' is banned');
	if (rules.cmg.battlePassBanned && w.battlePass) out.cmg.push('Battle Pass weapons are banned');
	return out;
}
function buildLegality(bd) {
	const out = gunLegality(bd.weapon, bd.class);
	out.ga = [];
	const C = rules.cdl, M = rules.cmg;
	for (const at of bd.attachments || []) {
		const label = at.name || at.type || at.slot, text = (at.type || '') + ' ' + (at.name || '');
		if (inList(C.attachmentSlots, at.slot)) out.cdl.push(at.slot + ' attachments are restricted (' + label + ')');
		if (at.name && Object.keys(C.attachments).some((k) => inList(C.attachments[k], at.name))) out.cdl.push(at.name + ' is restricted');
		if (inList(M.attachmentSlots, at.slot)) out.cmg.push(at.slot + ' attachments are banned (' + label + ')');
		if (/silenc|suppress/i.test(text)) out.cmg.push('Silencers are banned (' + label + ')');
		if (/rapid fire/i.test(text)) out.cmg.push('Rapid fire attachments are banned (' + label + ')');
		if (/akimbo/i.test(text)) out.cmg.push('Akimbo is banned');
		if (/headshot/i.test(text)) out.cmg.push('Headshot multiplier barrels are banned (' + label + ')');
		if (at.slot === 'Underbarrel' && /launcher|40mm/i.test(text)) out.cmg.push('Launcher underbarrels are banned (' + label + ')');
		if (at.slot === 'Ammunition' && (M.bannedAmmo || []).some((x) => text.toLowerCase().indexOf(x.toLowerCase()) >= 0)) out.cmg.push(label + ' ammunition is banned');
		if (at.slot === 'Optic' && !(inList(M.optics1x, at.name) || /reflex|red dot|\b1x\b|1\.0x/i.test(at.type || ''))) out.cmg.push('Optic not confirmed as 1.0x (' + label + ')');
		if (at.slot === 'Muzzle' && !at.type) out.cmg.push('Muzzle type not recorded, so it cannot be checked against the silencer ban (' + label + ')');
		for (const g of rules.ga.items || []) if (g.match && same(g.match.weapon, bd.weapon) && same(g.match.attachment, at.name)) out.ga.push(g);
	}
	return out;
}
function kitLegality(kit) {
	const out = { cdl: [], cmg: [] }, C = rules.cdl.banned, A = rules.cmg.allowed;
	for (const slot of ['tactical', 'lethal', 'fieldUpgrade', 'perk1', 'perk2', 'perk3', 'melee']) {
		const it = kit[slot];
		if (!it) continue;
		for (const name of [it.name].concat(it.alt || [])) {
			if (inList(C[slot], name)) out.cdl.push(name + ' is restricted');
			if (A[slot] && !inList(A[slot], name)) out.cmg.push(name + ' is not on the allowed list');
		}
	}
	const sec = kit.secondary && kit.secondary.name;
	if (sec) { const g = gunLegality(sec, 'Pistol'); out.cdl.push.apply(out.cdl, g.cdl); out.cmg.push.apply(out.cmg, g.cmg); }
	return out;
}
// Only current, legal classes are published. A class that breaks either rule set stops the build, so the daily
// refresh cannot put an illegal class on the site by accident.
const classProblems = [];
const liveBuilds = classData.builds.filter((bd) => {
	const lg = buildLegality(bd);
	bd.legal = lg;
	if (lg.cdl.length || lg.cmg.length) classProblems.push(bd.id + ': ' + lg.cdl.map((x) => 'Ranked: ' + x).concat(lg.cmg.map((x) => 'CMG: ' + x)).join('; '));
	if (ageDays(bd.verified) > MAX_AGE.classes) { console.log('  hidden as stale (' + ageDays(bd.verified) + ' days): class ' + bd.id); return false; }
	return true;
});
const kitLegal = kitLegality(classData.kit);
if (kitLegal.cdl.length || kitLegal.cmg.length) classProblems.push('kit: ' + kitLegal.cdl.concat(kitLegal.cmg).join('; '));
for (const rk of Object.keys(classData.roles)) {
	const r = classData.roles[rk], k = { perk2: { name: r.perk2, alt: r.perk2Alt ? [r.perk2Alt] : [] }, lethal: { name: r.lethal } };
	const lg = kitLegality(k);
	if (lg.cdl.length || lg.cmg.length) classProblems.push('role ' + rk + ': ' + lg.cdl.concat(lg.cmg).join('; '));
}
if (classProblems.length) { console.error('Classes that break the rules in data/rules.json (fix or remove them in data/classes.json):\n  ' + classProblems.join('\n  ')); process.exit(1); }
const liveWarzone = loadouts.filter((d) => {
	if (d.game !== 'warzone') return false;
	if (ageDays(d.verified) > MAX_AGE.warzone) { console.log('  hidden as stale (' + ageDays(d.verified) + ' days): warzone ' + d.weapon); return false; }
	return true;
});

const KIT_SLOTS = [['secondary', 'Secondary'], ['melee', 'Melee'], ['tactical', 'Tactical'], ['lethal', 'Lethal'], ['fieldUpgrade', 'Field upgrade'], ['perk1', 'Perk 1'], ['perk2', 'Perk 2'], ['perk3', 'Perk 3']];
function kitFor(roleKey) {
	const r = roleKey ? classData.roles[roleKey] : null, out = {};
	for (const [k] of KIT_SLOTS) {
		const it = classData.kit[k];
		if (!it) continue;
		out[k] = { name: it.name, alt: (it.alt || []).slice(), note: it.note || '' };
		if (r && r[k]) { out[k].alt = [it.name].concat(it.alt || []).filter((x) => !same(x, r[k])); out[k].name = r[k]; if (k === 'perk2' && r.perk2Alt) out[k].alt = [r.perk2Alt]; if (k === 'lethal') out[k].alt = out[k].alt.slice(0, 1); }
	}
	return out;
}
function kitText(kit) { return KIT_SLOTS.filter(([k]) => kit[k]).map(([k, label]) => label + ': ' + kit[k].name).join(' | '); }
function classCopyText(bd, kit) {
	return bd.weapon + ' [' + bd.label + '] - ' + (bd.attachments || []).map((x) => x.slot + ': ' + (x.name || x.type)).join(' | ') + ' - ' + kitText(kit) + ' - via MW4 Hub';
}
function legalChips(lg) {
	let h = '<div class="cls-legal"><span class="chip chip-ok" title="Passes ' + esc(rules.cdl.title) + '">Ranked legal</span><span class="chip chip-ok" title="Passes ' + esc(rules.cmg.title) + '">CMG legal</span>';
	for (const g of lg.ga || []) h += '<span class="chip chip-warn" title="' + esc(g.text) + '">Pros agreed not to use</span>';
	return h + '</div>';
}
function srcLinks(list) {
	return (list || []).map((x) => '<a class="lo-src" href="' + esc(x.url) + '" target="_blank" rel="noopener nofollow">' + esc((x.kind ? x.kind + ': ' : '') + x.label.replace(/^[^:]+: /, (m) => m)) + '</a>').join('');
}
function attList(bd) {
	return '<ol class="lo-atts">' + (bd.attachments || []).map((x) => '<li><span class="lo-slot">' + esc(x.slot || '') + '</span><span class="lo-att">' + esc(x.name || x.type || '') + (x.name && x.type && !same(x.type, x.slot) ? '<em>' + esc(x.type) + '</em>' : (!x.name ? '<em>name not given by the source</em>' : '')) + '</span></li>').join('') + '</ol>';
}
function gunCard(weapon, builds) {
	const cls = builds[0].class, players = [].concat.apply([], builds.map((x) => x.players || []));
	const search = [weapon, cls].concat(players, builds.map((x) => x.label), builds.map((x) => x.team || '')).join(' ').toLowerCase();
	const roleKeys = Object.keys(classData.roles).filter((k) => inList(classData.roles[k].guns, weapon));
	const newest = builds.map((x) => x.verified).sort().pop();
	let h = '<article class="lo-card card cls-gun" id="gun-' + esc(weapon.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) + '" data-class="' + esc(cls) + '" data-search="' + esc(search) + '" data-verified="' + esc(newest) + '">';
	h += '<header class="lo-head"><div class="lo-title"><h3 class="lo-weapon">' + esc(weapon) + '</h3><div class="lo-meta"><span class="chip">' + esc(cls) + '</span>' +
		roleKeys.map((k) => { const r = roleData.roles.find((x) => x.key === k); return r ? '<span class="chip cls-role" style="--role:' + esc(r.color) + '"><i></i>' + esc(r.name) + '</span>' : ''; }).join('') + '</div></div></header>';
	if (builds.length > 1) h += '<div class="lo-tabs" role="tablist">' + builds.map((x, i) => '<button type="button" role="tab" data-b="' + i + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(x.label) + '</button>').join('') + '</div>';
	builds.forEach((x, i) => {
		h += '<div class="lo-build" data-b="' + i + '" data-build="' + esc(x.id) + '"' + (i ? ' hidden' : '') + '>';
		h += '<div class="cls-bhead"><span class="lo-bname">' + esc(x.label) + '</span><span class="chip ' + (x.kind === 'pro' ? 'chip-brass' : '') + '">' + esc(x.kind === 'pro' ? (x.players && x.players.length ? x.players.join(' & ') + (x.team ? ' \u00b7 ' + x.team : '') : 'Pro build') : 'Creator variant') + '</span></div>';
		h += attList(x) + (x.note ? '<p class="cls-note">' + esc(x.note) + '</p>' : '') + legalChips(x.legal);
		for (const g of x.legal.ga) h += '<p class="cls-ga">' + esc(g.text) + ' It is still legal in Ranked and CMG Arena as the rules are written.</p>';
		h += '<div class="cls-foot"><button class="btn btn-sm lo-copy" type="button" data-copy="' + esc(classCopyText(x, kitFor(roleKeys[0]))) + '">Copy class</button><span class="lo-date">Seen in use ' + esc(fmtDate(x.verified)) + '</span></div>';
		h += '<div class="cls-srcs">' + srcLinks(x.sources) + '</div></div>';
	});
	return h + '</article>';
}
function kitBlock(kit, title, sub) {
	return '<div class="cls-kit card"><div class="cls-kit-h"><div><span class="eyebrow">' + esc(sub) + '</span><h3>' + esc(title) + '</h3></div>' + legalChips({}) + '</div><dl class="cls-slots">' +
		KIT_SLOTS.filter(([k]) => kit[k]).map(([k, label]) => '<div><dt>' + esc(label) + '</dt><dd><b>' + esc(kit[k].name) + '</b>' + (kit[k].alt && kit[k].alt.length ? '<span class="cls-alt">or ' + esc(kit[k].alt.join(', ')) + '</span>' : '') + (kit[k].note ? '<small>' + esc(kit[k].note) + '</small>' : '') + '</dd></div>').join('') +
		'</dl><div class="cls-srcs">' + srcLinks(classData.kit.sources) + '</div></div>';
}
function roleClassCard(r) {
	const cfg = classData.roles[r.key];
	if (!cfg) return '';
	const kit = kitFor(r.key);
	const picks = (cfg.builds || []).map((id) => liveBuilds.find((x) => x.id === id)).filter(Boolean);
	const builds = picks.length ? picks : liveBuilds.filter((x) => inList(cfg.guns, x.weapon)).slice(0, 2);
	let h = '<article class="card cls-rolecard" id="class-' + esc(r.key) + '" style="--role:' + esc(r.color) + '"><div class="role-top"><span class="role-badge">' + esc(r.short) + '</span><div><h3>' + esc(r.name) + '</h3><span class="muted">' + esc(r.tag) + ' \u00b7 ' + esc(cfg.guns.join(' or ')) + '</span></div></div>';
	h += '<p class="cls-note">' + esc(cfg.note) + '</p>';
	if (builds.length > 1) h += '<div class="lo-tabs" role="tablist">' + builds.map((x, i) => '<button type="button" role="tab" data-b="' + i + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(x.weapon + ' \u00b7 ' + x.label) + '</button>').join('') + '</div>';
	builds.forEach((x, i) => {
		h += '<div class="lo-build" data-b="' + i + '"' + (i ? ' hidden' : '') + '><div class="cls-bhead"><span class="lo-bname">' + esc(x.weapon + ' \u00b7 ' + x.label) + '</span></div>' + attList(x) + legalChips(x.legal) +
			x.legal.ga.map((g) => '<p class="cls-ga">' + esc(g.text) + '</p>').join('') +
			'<button class="btn btn-sm lo-copy" type="button" data-copy="' + esc(classCopyText(x, kit)) + '">Copy full class</button></div>';
	});
	if (!builds.length) h += '<p class="muted lo-empty">No current build for this role right now. It will be back after the next refresh.</p>';
	h += '<dl class="cls-slots cls-slots-tight">' + KIT_SLOTS.filter(([k]) => kit[k]).map(([k, label]) => '<div><dt>' + esc(label) + '</dt><dd><b>' + esc(kit[k].name) + '</b>' + (kit[k].alt && kit[k].alt.length ? '<span class="cls-alt">or ' + esc(kit[k].alt.join(', ')) + '</span>' : '') + '</dd></div>').join('') + '</dl>';
	return h + '<a class="lo-src" href="../roles/#role-' + esc(r.key) + '">How to play ' + esc(r.name) + '</a></article>';
}
function rulesPanel() {
	const C = rules.cdl, M = rules.cmg, li = (xs) => xs.map((x) => '<li>' + esc(x) + '</li>').join('');
	const group = (title, xs) => (xs && xs.length ? '<div class="rl-group"><h4>' + esc(title) + '</h4><ul>' + li(xs) + '</ul></div>' : '');
	const mark = (issues) => (issues.length ? '<span class="chip chip-red" title="' + esc(issues.join('. ')) + '">' + esc(issues[0].replace(/^All /, '')) + '</span>' : '<span class="chip chip-ok">Legal</span>');
	let h = '<div class="card card-pad rl-guns"><span class="eyebrow">Gun check</span><h3>Which guns you can bring</h3><div class="rl-table" role="table"><div class="rl-row rl-head" role="row"><span>Gun</span><span>Ranked / CDL</span><span>CMG Arena</span></div>' +
		weaponList.map((w) => { const g = gunLegality(w.name, w.class); return '<div class="rl-row" role="row"><span><b>' + esc(w.name) + '</b><em>' + esc(w.class) + '</em></span><span>' + mark(g.cdl) + '</span><span>' + mark(g.cmg) + '</span></div>'; }).join('') + '</div>' +
		'<p class="muted">A legal gun still has to be built from legal attachments. Every class on this page already is.</p></div>';
	h += '<div class="grid rl-grid"><article class="card card-pad rl-card rl-cdl"><span class="eyebrow">' + esc(C.name) + '</span><h3>' + esc(C.title) + '</h3><p class="muted">' + esc(C.note) + '</p><p class="rl-kind">Everything listed is restricted. Anything not listed is allowed.</p>' +
		group('Primary weapons', C.weaponClasses.filter((x) => x !== 'Launcher').map((x) => 'All ' + x + 's').concat(C.weapons)) + group('Secondary weapons', ['All Launchers']) +
		group('Attachments', C.attachmentSlots.map((x) => 'All ' + x + ' attachments')) + Object.keys(C.attachments).map((k) => group(k + (k.slice(-1) === 's' ? '' : 's'), C.attachments[k])).join('') +
		group('Tactical', C.banned.tactical) + group('Lethal', C.banned.lethal) + group('Field upgrades', C.banned.fieldUpgrade) + group('Perk 1', C.banned.perk1) + group('Perk 2', C.banned.perk2) + group('Perk 3', C.banned.perk3) + group('Killstreaks', C.banned.killstreaks) +
		'<a class="lo-src" href="' + esc(C.source.url) + '" target="_blank" rel="noopener nofollow">Source: ' + esc(C.source.label) + '</a></article>';
	h += '<article class="card card-pad rl-card"><span class="eyebrow">' + esc(M.name) + '</span><h3>' + esc(M.title) + '</h3><p class="muted">' + esc(M.note) + '</p><p class="rl-kind">Weapons and attachments are ban lists. Equipment and perks are allow lists: only what is named is legal.</p>' +
		group('Banned weapons', M.weaponClasses.map((x) => 'All ' + x + 's').concat(M.weapons, M.battlePassBanned ? ['All Battle Pass weapons (' + weaponList.filter((w) => w.battlePass).map((w) => w.name).join(', ') + ')'] : [])) +
		group('Banned attachments', M.attachmentRules) +
		group('Allowed lethals', M.allowed.lethal) + group('Allowed tacticals', M.allowed.tactical.map((x) => x + (M.conditions[x] ? ': ' + M.conditions[x] : ''))) + group('Allowed field upgrades', M.allowed.fieldUpgrade) +
		group('Allowed Perk 1', M.allowed.perk1) + group('Allowed Perk 2', M.allowed.perk2) + group('Allowed Perk 3', M.allowed.perk3) + group('Also', M.notes) +
		group('Recent rule changes', M.changes.map((x) => fmtDate(x.date) + ': ' + x.text)) +
		'<a class="lo-src" href="' + esc(M.source.url) + '" target="_blank" rel="noopener nofollow">Source: ' + esc(M.source.label) + '</a></article></div>';
	h += '<div class="card card-pad rl-ga"><span class="eyebrow">' + esc(rules.ga.name) + '</span><p class="muted">' + esc(rules.ga.note) + '</p><ul>' + rules.ga.items.map((g) => '<li>' + esc(g.text) + ' <a class="lo-src" href="' + esc(g.source.url) + '" target="_blank" rel="noopener nofollow">' + esc(g.source.label) + '</a></li>').join('') + '</ul></div>';
	return h;
}
function rankedLoadouts() {
	const guns = [];
	liveBuilds.forEach((x) => { if (guns.indexOf(x.weapon) < 0) guns.push(x.weapon); });
	const lastChange = (rules.cmg.changes[0] || {}).date;
	let h = '<div class="lo-app cls-app" data-lo-app data-checked="' + esc(classData.updated) + '" data-max-age="' + MAX_AGE.classes + '">' +
		'<div class="cls-status card"><div><span class="eyebrow">Checked <span data-ago="' + esc(classData.updated) + '">' + esc(fmtDate(classData.updated)) + '</span></span><p>' + esc(classData.summary) + '</p></div>' +
		'<div class="cls-status-rules"><span class="chip chip-sage">' + esc(rules.cdl.title) + '</span><span class="chip chip-sage">' + esc(rules.cmg.title) + (lastChange ? ' \u00b7 changed ' + esc(fmtDate(lastChange)) : '') + '</span><span class="chip">Rules read ' + esc(fmtDate(rules.checked)) + '</span></div></div>';
	h += filtersBar(liveBuilds, [['guns', 'By gun', guns.length], ['roles', 'By role', Object.keys(classData.roles).length], ['rules', 'Rules & bans', '']]);
	h += '<section data-panel="guns"><p class="lo-note">Classes pros are running now, one card per gun. Every build is checked against both rule sets when the site is built, and a build nobody has been seen using for ' + MAX_AGE.classes + ' days drops off the page.</p>' +
		kitBlock(kitFor(null), 'The rest of the class', 'Same on every gun') +
		'<div class="grid lo-grid cls-grid">' + guns.map((g) => gunCard(g, liveBuilds.filter((x) => x.weapon === g))).join('') + '</div></section>';
	h += '<section data-panel="roles" hidden><p class="lo-note">One full class per role: the gun, its attachments, perks and equipment. Tap Copy full class to send it to your squad.</p><div class="grid cls-roles">' + roleData.roles.map(roleClassCard).join('') + '</div></section>';
	h += '<section data-panel="rules" hidden><p class="lo-note">The two rule sets every class above is checked against. Rules were last read on ' + esc(fmtDate(rules.checked)) + '.</p>' + rulesPanel() + '</section>';
	return h + NONE;
}
function warzone(r) {
	const wz = liveWarzone;
	const wzChecked = wz.map((d) => d.verified).sort().pop() || '';
	const long = wz.find((d) => d.tier === 'S' && d.category === 'Long Range');
	const close = wz.find((d) => d.tier === 'S' && d.category === 'Close Range');
	let h = '<div class="lo-app" data-lo-app data-checked="' + esc(wzChecked) + '" data-max-age="' + MAX_AGE.warzone + '">' + filtersBar(wz, [['meta', 'Meta loadouts', wz.length], ['maps', 'Newest maps', wzmaps.length]]) + '<section data-panel="meta">';
	if (long && close) h += '<div class="wz-pair card"><span class="eyebrow">Meta pairing</span><div class="wz-pair-row"><div><b>' + esc(long.weapon) + '</b><span class="muted">Long range primary</span></div><span class="wz-plus">+</span><div><b>' + esc(close.weapon) + '</b><span class="muted">Close range secondary</span></div></div></div>';
	h += '<p class="lo-note">Checked <b data-ago="' + esc(wzChecked) + '">' + esc(fmtDate(wzChecked)) + '</b>. Tiers combine today\u2019s rankings from wzstats.gg and warzoneloadout.games: weapons rated highly on both rank highest, and each card shows the tier on each site. Where the two sites build a gun differently you get both builds. Anything not re-checked for ' + MAX_AGE.warzone + ' days is taken off the page.</p>';
	if (!wz.length) h += '<p class="lo-empty muted">No Warzone builds have been re-checked in the last ' + MAX_AGE.warzone + ' days, so none are shown. They return after the next refresh.</p>';
	h += tierSections(wz, { S: 'Meta: top of the two trackers', A: 'Strong picks', B: 'Viable', C: 'Situational' });
	h += '</section><section data-panel="maps" hidden><div class="grid grid-3 wz-maps">';
	for (const m of wzmaps) {
		h += '<article class="card wz-map"><div class="wz-thumb">' + (m.image ? '<img src="' + r + esc(m.image) + '" alt="' + esc(m.name + ' map') + '" loading="lazy" decoding="async">' : '<div class="wz-thumb-empty">' + esc(m.name) + '</div>');
		h += '<span class="chip ' + (m.status === 'New' ? 'chip-brass' : 'chip-sage') + '">' + esc(m.status || '') + '</span></div>';
		h += '<div class="card-pad"><h3>' + esc(m.name) + '</h3><div class="lo-meta"><span class="chip">' + esc(m.type || '') + '</span><span class="chip">' + esc(m.released || '') + '</span></div><p class="muted">' + esc(m.description || '') + '</p>';
		if (m.url) h += '<a class="lo-src" href="' + esc(m.url) + '" target="_blank" rel="noopener nofollow">Full map layout and POIs on GamesAtlas</a>';
		h += '</div></article>';
	}
	return h + '</div></section>' + NONE;
}
function mapsGrid(r) {
	if (!maps.length) return '<p class="muted">Maps are being added.</p>';
	return '<div class="map-grid">' + maps.map((m) => {
		const hills = ((m.hp && m.hp.hills) || []).length;
		let h = '<a class="map-card card reveal" href="' + r + 'maps/' + m.slug + '/"><div class="map-thumb">' + (m.hero ? '<img src="' + r + esc(m.hero) + '" alt="" loading="lazy" decoding="async">' : '') + '<span class="map-loc chip">' + esc(m.location || '') + '</span></div>';
		h += '<div class="map-body"><h3>' + esc(m.name) + '</h3><div class="map-tags">';
		if (has(m, 'hp')) h += '<span class="chip chip-brass">Hardpoint \u00b7 ' + hills + ' hills</span>';
		if (has(m, 'snd')) h += '<span class="chip chip-red">S&amp;D \u00b7 A / B</span>';
		if (has(m, 'hj')) h += '<span class="chip chip-sage">Hijack</span>';
		return h + '</div></div></a>';
	}).join('') + '</div>';
}
function rolesBlock(compact) {
	const team = roster.team || 'OpTic Texas';
	let h = '<div class="roles' + (compact ? ' roles-compact' : '') + '"><div class="grid grid-4">';
	for (const r of roleData.roles) {
		const players = roster[r.group] || [];
		h += '<article class="card role-card reveal" style="--role:' + esc(r.color) + '"><div class="role-top"><span class="role-badge">' + esc(r.short) + '</span><div><h3>' + esc(r.name) + '</h3><span class="muted">' + esc(r.tag) + '</span></div></div><p>' + esc(r.summary) + '</p>';
		if (!compact) h += '<h4>Hardpoint</h4><ul>' + r.hp.map((li) => '<li>' + esc(li) + '</li>').join('') + '</ul><h4>Search &amp; Destroy</h4><ul>' + r.snd.map((li) => '<li>' + esc(li) + '</li>').join('') + '</ul>';
		if (players.length) h += '<div class="role-pros"><span>' + esc(team + ' ' + (r.group === 'ar' ? 'AR' : 'SMG') + ' players') + '</span><b>' + esc(players.join(' \u00b7 ')) + '</b></div>';
		h += '</article>';
	}
	h += '</div>';
	if (!compact) {
		h += '<div class="grid roster-grid"><article class="card card-pad roster reveal"><span class="eyebrow">Modeled on</span><h3>' + esc(team) + '</h3><dl><dt>AR</dt><dd>' + esc((roster.ar || []).join(', ')) + '</dd><dt>SMG</dt><dd>' + esc((roster.smg || []).join(', ')) + '</dd><dt>Coach</dt><dd>' + esc(roster.coach || '') + '</dd></dl>';
		h += '<p class="muted">Roster and AR/SMG positions from Breaking Point. Ranked Play is 4v4, the same format as the Call of Duty League, so these roles map directly onto your squad.</p>';
		if (roster.source) h += '<a class="lo-src" href="' + esc(roster.source) + '" target="_blank" rel="noopener nofollow">Source: Breaking Point</a>';
		h += '</article>';
		for (const mode of ['hp', 'snd']) {
			h += '<article class="card card-pad coach reveal"><span class="eyebrow">General coaching</span><h3>' + (mode === 'hp' ? 'Hardpoint' : 'Search &amp; Destroy') + '</h3><ol>' + roleData.coaching[mode].map((t) => '<li>' + esc(t) + '</li>').join('') + '</ol></article>';
		}
		h += '</div>';
	}
	return h + '</div>';
}
// The standalone role guide (data/role-guide.json). Roles live here only, not in the map planner.
function rolesGuide() {
	const g = guide, team = roster.team || 'OpTic Texas';
	const byKey = {}; roleData.roles.forEach((r) => { byKey[r.key] = r; });
	const list = (items, tag) => '<' + (tag || 'ul') + '>' + items.map((li) => '<li>' + esc(li) + '</li>').join('') + '</' + (tag || 'ul') + '>';
	const refs = (ids) => (ids && ids.length ? '<p class="rg-refs">Sources ' + ids.map((n) => '<a href="#src-' + n + '">' + n + '</a>').join('') + '</p>' : '');
	const roleChip = (k) => '<a class="rg-who" href="#role-' + k + '" style="--role:' + esc(byKey[k].color) + '"><i></i>' + esc(byKey[k].name) + '</a>';
	const sec = (id, eyebrow, h2, body) => '<section class="rg-sec" id="' + id + '"><div class="rg-head reveal"><span class="eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(h2) + '</h2></div>' + body + '</section>';
	const modeNames = { hp: 'Hardpoint', snd: 'Search & Destroy', hj: 'Hijack' };

	let h = '<div class="rg">';
	h += '<nav class="rg-nav chips reveal" aria-label="On this page">' + [['summary', 'The short version'], ['the-roles', 'The four roles'], ['by-mode', 'Jobs by mode'], ['shifts', 'When roles shift'], ['build', 'Build your four'], ['mistakes', 'Team mistakes'], ['sources', 'Sources']]
		.map((x) => '<a class="chip" href="#' + x[0] + '">' + esc(x[1]) + '</a>').join('') + '</nav>';

	// Summary
	let b = '<div class="card card-pad rg-sum reveal"><p class="rg-lead">' + esc(g.summary.lead) + '</p><ol class="rg-points">' +
		g.summary.points.map((p) => '<li><b>' + esc(p.t) + '</b> ' + esc(p.d) + ' ' + (p.src || []).map((n) => '<a class="rg-ref" href="#src-' + n + '">' + n + '</a>').join('') + '</li>').join('') + '</ol></div>';
	b += '<div class="grid rg-pairs">' + g.pairs.map((p) => '<article class="card card-pad reveal"><h3>' + esc(p.name) + '</h3><div class="rg-whos">' + p.roles.map(roleChip).join('') + '</div><p class="muted">' + esc(p.text) + '</p></article>').join('') + '</div>';
	h += sec('summary', 'The short version', 'Two pairs, four starting jobs', b);

	// The four roles
	b = '';
	for (const r of roleData.roles) {
		const d = g.roles[r.key], players = roster[r.group] || [];
		b += '<article class="card role-card role-deep reveal" id="role-' + r.key + '" style="--role:' + esc(r.color) + '">' +
			'<div class="role-top"><span class="role-badge">' + esc(r.short) + '</span><div><h3>' + esc(r.name) + '</h3><span class="muted">' + esc(r.tag) + '</span></div>' +
			'<div class="rg-aka">' + d.aka.map((a) => '<span class="chip">' + esc(a) + '</span>').join('') + '</div></div>' +
			'<p class="rg-job">' + esc(d.job) + '</p>' +
			'<div class="rg-cols rg-cols-3">' + ['hp', 'snd', 'hj'].map((m) => '<section><h4>' + esc(modeNames[m]) + '</h4>' + list(d[m]) + '</section>').join('') + '</div>' +
			'<div class="rg-cols rg-cols-4 rg-soft">' +
				'<section><h4>What good looks like</h4>' + list(d.traits) + '</section>' +
				'<section><h4>Calls to make</h4>' + list(d.comms) + '</section>' +
				'<section><h4>Common mistakes</h4>' + list(d.mistakes) + '</section>' +
				'<section><h4>How to practice</h4>' + list(d.practice) + '</section></div>' +
			'<p class="rg-measure"><b>How to judge it</b> ' + esc(d.measure) + '</p>' +
			(players.length ? '<div class="role-pros"><span>' + esc(team + ' ' + (r.group === 'ar' ? 'AR' : 'SMG') + ' players') + '</span><b>' + esc(players.join(' \u00b7 ')) + '</b></div>' : '') +
			refs(d.src) + '</article>';
	}
	h += sec('the-roles', 'Role by role', 'The four roles in depth', b);

	// Jobs by mode
	b = '<p class="muted rg-intro">A role is who you are on the team. A job is what needs doing right now. Each mode has its own set of jobs, and this is who usually starts on each.</p>';
	for (const m of g.modes) {
		const habits = m.habits || roleData.coaching[m.key] || [];
		b += '<article class="card card-pad rg-mode reveal" id="mode-' + m.key + '"><h3>' + esc(m.name) + '</h3><p class="muted">' + esc(m.rules) + '</p>' +
			(m.caveat ? '<p class="rg-caveat"><b>Early read.</b> ' + esc(m.caveat) + '</p>' : '') +
			'<div class="rg-jobs">' + m.jobs.map((j) => '<div class="rg-jobrow"><b>' + esc(j.job) + '</b><div class="rg-whos">' + j.who.map(roleChip).join('') + (j.alt ? '<span class="muted">' + esc(j.alt) + '</span>' : '') + '</div><p>' + esc(j.what) + '</p></div>').join('') + '</div>' +
			'<div class="rg-cols rg-cols-2"><section><h4>Keep in mind</h4>' + list(m.notes) + '</section>' +
			(habits.length ? '<section><h4>Team habits</h4>' + list(habits) + '</section>' : '') + '</div>' + refs(m.src) + '</article>';
	}
	h += sec('by-mode', 'Mode by mode', 'Jobs by mode', b);

	// Shifts
	b = '<div class="card card-pad rg-shifts reveal">' + g.shifts.map((x) => '<div class="rg-shift"><b>' + esc(x.when) + '</b><p>' + esc(x.then) + '</p></div>').join('') + '</div>';
	h += sec('shifts', 'Fluid roles', 'When roles shift', b);

	// Build your four
	b = '<div class="grid rg-build"><article class="card card-pad reveal"><h3>Who plays what</h3><ol class="rg-steps">' + g.assign.map((x) => '<li><b>' + esc(x.t) + '</b> ' + esc(x.d) + '</li>').join('') + '</ol>' + refs([1, 2, 15]) + '</article>' +
		'<div class="rg-stack"><article class="card card-pad reveal"><h3>Line-ups that do not work</h3>' + list(g.mismatches) + '</article>' +
		'<article class="card card-pad roster reveal"><span class="eyebrow">Modeled on</span><h3>' + esc(team) + '</h3><dl><dt>AR</dt><dd>' + esc((roster.ar || []).join(', ')) + '</dd><dt>SMG</dt><dd>' + esc((roster.smg || []).join(', ')) + '</dd><dt>Coach</dt><dd>' + esc(roster.coach || '') + '</dd></dl>' +
		'<p class="muted">Ranked Play is 4v4, the same format as the Call of Duty League, so these roles map straight onto your squad.</p>' +
		(roster.source ? '<a class="lo-src" href="' + esc(roster.source) + '" target="_blank" rel="noopener nofollow">Roster source: Breaking Point</a>' : '') + '</article></div></div>';
	h += sec('build', 'Your squad', 'Build your four', b);

	// Team mistakes
	b = '<div class="grid grid-3">' + g.teamMistakes.map((x) => '<article class="card card-pad rg-miss reveal"><h3>' + esc(x.t) + '</h3><p class="muted">' + esc(x.d) + '</p></article>').join('') + '</div>' + refs([2, 6, 7, 14]);
	h += sec('mistakes', 'What loses games', 'Team mistakes', b);

	// Sources
	b = '<div class="card card-pad rg-sources reveal"><ol>' + g.sources.map((x) => '<li id="src-' + x.n + '" value="' + x.n + '"><span class="chip">' + esc(x.kind) + '</span> <a href="' + esc(x.url) + '" target="_blank" rel="noopener nofollow">' + esc(x.title) + '</a> <span class="muted">' + esc(x.by) + '</span><p class="muted">' + esc(x.used) + '</p></li>').join('') + '</ol>' +
		'<h4>What this guide could not check</h4>' + list(g.limits) + '<p class="muted">Last reviewed ' + esc(g.updated) + '.</p></div>';
	h += sec('sources', 'Where this comes from', 'Sources', b);
	return h + '</div>';
}
function credits() {
	const rows = [
		['GamesAtlas', 'https://www.gamesatlas.com/cod-modern-warfare-4/maps/', 'Map list, minimap layouts and cover images, hardpoint names and rotation order, Warzone map info.'],
		['Breaking Point', 'https://breakingpoint.gg/posts/modern-warfare-4-search-destroy-bombsites', 'Search & Destroy bomb-site layouts, hardpoint rotation graphics and the OpTic Texas roster.'],
		['warzoneloadout.games', 'https://warzoneloadout.games/', 'Warzone tier rankings and attachment builds, re-read daily.'],
		['wzstats.gg', 'https://wzstats.gg/', 'Warzone meta tier list and builds used in our combined Warzone rankings, re-read daily.'],
		['Call of Duty League', 'https://callofdutyleague.com/en-us/competitive-settings', 'CDL 2027 Competitive Maps & Modes: the Hardpoint, Search & Destroy and Hijack map pool used for the Ranked maps shown here.'],
		['Call of Duty (Activision)', 'https://www.callofduty.com/blog/2026/10/call-of-duty-modern-warfare-4-ready-for-launch-maps-modes', 'Official launch map and mode announcement, and the tac maps used for team spawn positions, area names and Domination flags in the planner.'],
		['Call of Duty League: Competitive Settings', 'https://callofdutyleague.com/en-us/competitive-settings', 'The restricted weapons, attachments, perks and equipment every Ranked class is checked against.'],
		['Checkmate Gaming', 'https://www.checkmategaming.com/cmg-arena/ladders/01a169a6-4c72-7a28-85a7-4e633f8baefc/rules', 'CMG MW4 Arena rules: the banned and allowed lists every class is also checked against.'],
		['BoomKid, Apathy and Harrz (YouTube)', 'https://www.youtube.com/watch?v=LP-1qApCG3s', 'Breakdowns of the classes Call of Duty League pros are running, used for the competitive builds, perks and equipment. Each build links to the video it came from.'],
		['RankKD', 'https://www.rankkd.com/guides-tools/call-of-duty-modern-warfare-4/', 'Callout names, the short names for each Hardpoint hill and the map notes in the planner, plus the Hardpoint and Hijack job breakdowns in the role guide.'],
	];
	return '<div class="credits prose"><p>MW4 Hub combines and reworks public information into its own tools. Map marker positions were plotted onto the minimaps from the sources below; tiers and builds were cross-checked across sites. Please support these creators.</p><div class="grid">' +
		rows.map((r) => '<a class="card card-pad credit" href="' + esc(r[1]) + '" target="_blank" rel="noopener nofollow"><h3>' + esc(r[0]) + '</h3><p class="muted">' + esc(r[2]) + '</p></a>').join('') +
		'</div><p class="muted">Call of Duty, Modern Warfare and Warzone are trademarks of Activision Publishing, Inc. MW4 Hub is not affiliated with Activision.</p></div>';
}
function myPlans() {
	return '<div class="plans" data-local-plans>' +
		'<div class="card card-pad team-card"><div><span class="eyebrow">How saving works</span><h3>Plans save on this device</h3><p class="muted">Every plan you draw in the map planner is kept in this browser automatically. To send one to your squad, open it and use Copy link or Export image. Team boards with sign-in are planned.</p></div>' +
		'<div class="hero-actions" style="margin-top:0"><a class="btn btn-primary" href="../maps/">Open the map planner</a></div></div>' +
		'<section class="plans-list"><h3>My plans <span class="muted" data-plan-count>0</span></h3><div class="plans-rows" data-plan-rows><p class="muted">Nothing saved yet. Open a map and draw your plan; it is saved here as you go.</p></div></section>' +
		'</div>\n<script type="application/json" id="mw4-maps">' + jsonForScript(maps.map((m) => ({ slug: m.slug, name: m.name, modes: m.modes }))) + '</script>';
}
// Default callouts for a map: the official tac-map area names, plus the short name players use for
// each Hardpoint hill (placed just above the hill marker). A team can replace these in the planner.
function defaultCallouts(m) {
	const ex = extras[m.slug] || {}, calls = ex.hillCalls || {}, off = m.official || {}, out = [];
	const hills = has(m, 'hp') ? ((m.hp && m.hp.hills) || []).filter((h) => calls[h.n]) : [];
	hills.forEach((h) => out.push({ id: 'h' + h.n, s: calls[h.n], x: h.x, y: Math.max(0.02, +(h.y - 0.036).toFixed(4)), k: 'hill' }));
	(off.pois || []).forEach((p, i) => {
		if (hills.some((h) => Math.hypot(h.x - p.x, h.y - p.y) < 0.055)) return; // the hill's own callout already names this spot
		out.push({ id: 'p' + i, s: p.s, x: p.x, y: p.y, k: 'official' });
	});
	return out;
}
function planner(m, r) {
	const ex = extras[m.slug] || {}, off = m.official || {};
	const data = {
		map: {
			id: m.id || 0, slug: m.slug, name: m.name, url: r + 'maps/' + m.slug + '/', location: m.location || '', size: m.size || '', description: m.description || '',
			image: m.image ? { url: r + m.image.file, w: m.image.w, h: m.image.h } : null,
			hp: m.hp || { hills: [] }, snd: m.snd || null, intel: { hp: (m.intel && m.intel.hp) || [], snd: (m.intel && m.intel.snd) || [] }, sources: m.sources || [], ranked: !!m.ranked, modes: m.modes, hj: m.hj ? { spawns: m.hj.spawns, spike: m.hj.spike, commStations: m.hj.commStations || [] } : null,
			callouts: defaultCallouts(m), calloutNames: ex.names || [], tips: ex.tips || [], tipSource: ex.source || null,
			spawns: off.spawns || [], dom: off.dom || [],
		},
		maps: maps.map((x) => ({ slug: x.slug, name: x.name, url: r + 'maps/' + x.slug + '/' })),
		coaching: roleData.coaching,
		user: { loggedIn: false, name: '', canEdit: false, team: '', loginUrl: '', registerUrl: '' },
		rest: { root: '', nonce: '' },
		links: { maps: r + 'maps/', myPlans: r + 'my-plans/', bombSites: r + 'bomb-sites/' },
	};
	let h = '<div class="mw4-planner" id="mw4-planner"><div class="pl-stage" id="pl-stage" tabindex="0" role="application" aria-label="' + esc(m.name + ' map. Drag to pan, scroll or pinch to zoom.') + '">';
	if (m.image) h += '<img class="pl-img" id="pl-img" src="' + r + esc(m.image.file) + '" width="' + (+m.image.w) + '" height="' + (+m.image.h) + '" alt="' + esc(m.name + ' minimap') + '" draggable="false" decoding="async" fetchpriority="high">';
	h += '<svg class="pl-svg" id="pl-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg><div class="pl-loading" aria-hidden="true"><span></span></div></div>';
	h += '<aside class="pl-panel" id="pl-panel" aria-label="Planner"><div class="pl-fallback"><h1>' + esc(m.name) + '</h1><p>' + esc(m.description || '') + '</p><noscript><p>Turn on JavaScript to use the interactive planner.</p></noscript></div></aside></div>';
	return h + '<script type="application/json" id="mw4-planner-data">' + jsonForScript(data) + '</script>';
}
function bombSites(r) {
	const pin = (cls, pt, label, title) => '<span class="bs-pin ' + cls + '" style="left:' + (pt.x * 100).toFixed(2) + '%;top:' + (pt.y * 100).toFixed(2) + '%" title="' + esc(title) + '">' + label + '</span>';
	let h = '<div class="bs-grid">';
	for (const m of sndMaps) {
		const thumb = 'images/maps/' + m.slug + '-map-900.webp';
		const img = fs.existsSync(path.join(SRC, thumb)) ? thumb : (m.image && m.image.file);
		const src = m.sources && m.sources.snd;
		const photos = (m.snd.photos || []);
		h += '<article class="card bs-card reveal" id="' + esc(m.slug) + '"><div class="bs-map">' + (img ? '<img src="' + r + esc(img) + '" alt="' + esc(m.name + ' minimap with the A and B bomb sites marked') + '" loading="lazy" decoding="async">' : '');
		for (const st of m.snd.sites) h += pin(st.id === 'A' ? 'bs-a' : 'bs-b', st, esc(st.id), st.id + ' bomb site');
		if (m.snd.bomb) h += pin('bs-bomb', m.snd.bomb, '', 'Bomb spawn (attackers)' + (m.snd.bomb.approx ? ', approximate' : ''));
		h += '</div><div class="card-pad"><h3>' + esc(m.name) + '</h3><div class="lo-meta"><span class="chip chip-red">A site</span><span class="chip" style="color:#4fc3f7;border-color:rgba(79,195,247,.3)">B site</span>' + (m.snd.bomb ? '<span class="chip">Bomb spawn' + (m.snd.bomb.approx ? ' (approx.)' : '') + '</span>' : '') + '</div>';
		h += photos.length
			? '<div class="bs-photos">' + photos.map((p) => '<a href="' + r + esc(p.file) + '" target="_blank" rel="noopener"><img src="' + r + esc(p.file) + '" alt="' + esc(m.name + ' ' + (p.label || 'bomb site')) + '" loading="lazy" decoding="async">' + (p.label ? '<span>' + esc(p.label) + '</span>' : '') + '</a>').join('') + '</div>'
			: '<p class="bs-empty muted">No site photos uploaded yet.</p>';
		h += '<div class="bs-actions"><a class="btn btn-sm btn-primary" href="' + r + 'maps/' + m.slug + '/?mode=snd">Plan this map</a>' + (src && src.url ? '<a class="lo-src" href="' + esc(src.url) + '" target="_blank" rel="noopener nofollow">Source: ' + esc(src.label || 'link') + '</a>' : '') + '</div></div></article>';
	}
	return h + '</div>';
}
function home() {
	const r = './';
	const hills = maps.reduce((a, m) => a + (has(m, 'hp') ? ((m.hp && m.hp.hills) || []).length : 0), 0);
	const snd = sndMaps.length;
	const stats = [[maps.length, 'Ranked maps'], [hills, 'Hardpoints mapped'], [snd, 'S&D bomb-site layouts'], [liveBuilds.length + liveWarzone.reduce((n, d) => n + d.builds.length, 0), 'Current builds']];
	const feature = (slug, icon, cls, title, text, more) => '<a class="card feature reveal' + cls + '" href="' + r + slug + '/"><span class="ico">' + ico(icon) + '</span><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><span class="more">' + esc(more) + '</span></a>';
	const head = (eyebrow, h2, slug, btn) => '<div class="section-head reveal"><div><span class="eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(h2) + '</h2></div><a class="btn btn-sm" href="' + r + slug + '/">' + esc(btn) + '</a></div>';
	return '<section class="hero">\n\t<div class="hero-art" aria-hidden="true"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="sweep"></div><div class="cross"></div><span class="blip" style="left:62%;top:34%"></span><span class="blip b2" style="left:30%;top:58%"></span><span class="blip b3" style="left:70%;top:68%"></span></div>\n' +
		'\t<div class="container">\n\t\t<span class="eyebrow reveal">Modern Warfare 4 \u00b7 Ranked 4v4</span>\n\t\t<h1 class="reveal d1">Game-plan Ranked <em>like the pros.</em></h1>\n' +
		'\t\t<p class="lead reveal d2">Interactive maps with every hardpoint and bomb site, a planner for routes and setups, pro-sourced loadouts and the current Warzone meta, all in one place.</p>\n' +
		'\t\t<div class="hero-actions reveal d3"><a class="btn btn-primary" href="' + r + 'maps/">' + ico('map') + ' Open the map planner</a><a class="btn" href="' + r + 'ranked-loadouts/">Pro loadouts</a></div>\n' +
		'\t\t<div class="stats reveal">' + stats.map((s) => '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>').join('') + '</div>\n\t</div>\n</section>\n\n' +
		'<section class="section"><div class="container"><div class="grid grid-3">' +
		feature('maps', 'map', '', 'Interactive maps', 'Zoom into every Ranked Play map. See hardpoint rotations, S&D bomb sites and bomb spawns, then draw routes, strong points and enemy paths for your team of four.', 'Plan a map') +
		feature('ranked-loadouts', 'gun', ' d1', 'Ranked loadouts', 'Current competitive classes by gun and by role, with perks and equipment, checked against the Ranked and CMG rules every day.', 'See builds') +
		feature('warzone', 'drop', ' d2', 'Warzone', 'A ranked Warzone meta built from multiple trackers, with full builds and the newest 2026 maps.', 'Warzone meta') +
		'</div></div></section>\n\n' +
		'<section class="section"><div class="container">' + head('Ranked map pool', 'Pick a map. Build the plan.', 'maps', 'All maps') + mapsGrid(r) + '</div></section>\n\n' +
		'<section class="section"><div class="container">' + head('Pro structure', 'Four players. Four jobs.', 'roles', 'Role guide') + rolesBlock(true) + '</div></section>\n\n' +
		'<section class="section"><div class="container"><div class="cta reveal"><span class="eyebrow">Squad up</span><h2>Save plans and share them with your team.</h2>' +
		'<p class="lead">Plans save on your device as you draw. Copy a link or export an image and send it to your squad before you queue.</p>' +
		'<div class="hero-actions" style="justify-content:center"><a class="btn btn-primary" href="' + r + 'my-plans/">Go to My Plans</a><a class="btn" href="' + r + 'maps/">Open the map planner</a></div></div></div></section>';
}

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const nAssets = copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
const used = new Set();
for (const m of maps) {
	[m.hero, m.image && m.image.file].concat(((m.snd && m.snd.photos) || []).map((p) => p.file)).forEach((f) => f && used.add(f));
	if (fs.existsSync(path.join(SRC, 'images/maps/' + m.slug + '-map-900.webp'))) used.add('images/maps/' + m.slug + '-map-900.webp');
}
for (const m of wzmaps) if (m.image) used.add(m.image);
let nImages = 0;
for (const f of used) {
	if (!fs.existsSync(path.join(SRC, f))) continue;
	fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
	fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
	nImages++;
}
for (const f of ['CNAME', 'robots.txt']) if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

write('index.html', layout({ depth: 0, bodyClass: 'home', title: site.name + ' \u2013 ' + site.tagline, description: site.tagline, content: home() }));
write('maps/index.html', standardPage('maps', mapsGrid('../')));
write('bomb-sites/index.html', standardPage('bomb-sites', bombSites('../')));
write('ranked-loadouts/index.html', standardPage('ranked-loadouts', rankedLoadouts()));
write('warzone/index.html', standardPage('warzone', warzone('../')));
write('roles/index.html', standardPage('roles', rolesGuide()));
write('my-plans/index.html', standardPage('my-plans', myPlans(), { scripts: ['plans-local.js'] }));
write('credits/index.html', standardPage('credits', credits()));
for (const m of maps) {
	write('maps/' + m.slug + '/index.html', layout({
		depth: 2, active: 'maps', bodyClass: 'is-planner', planner: true, scripts: ['planner.js'],
		title: m.name + ' Map Planner: Hardpoint & S&D \u2013 ' + site.name, description: m.description, content: planner(m, '../../'),
	}));
}
write('404.html', layout({
	base: site.base || '/', title: 'Page not found \u2013 ' + site.name,
	content: '<div class="container notfound">\n\t<b>404</b>\n\t<h1 style="font-size:2rem;margin-top:.4em">Off the map.</h1>\n\t<p class="muted">That page was not found. Head back to base.</p>\n\t<p><a class="btn btn-primary" href="' + (site.base || '/') + '">Back home</a></p>\n</div>',
}));

console.log('Built ' + (9 + maps.length) + ' pages, ' + nAssets + ' assets, ' + nImages + ' images -> ' + path.relative(ROOT, OUT) + '/');
console.log('  maps: ' + maps.length + ', classes: ' + liveBuilds.length + ', warzone weapons: ' + liveWarzone.length + ', warzone maps: ' + wzmaps.length + ', built for ' + TODAY);
const missing = [];
for (const f of used) if (!fs.existsSync(path.join(SRC, f))) missing.push(f);
if (missing.length) console.log('  MISSING IMAGES (' + missing.length + '): ' + missing.join(', '));
