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
const gunImages = read('gun-images.json');

// Freshness. Anything not re-checked within these many days is left off the site, so a stale build can never be
// shown as current. TODAY can be pinned (TODAY=2026-11-17 node build.js) for a repeatable build.
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const MAX_AGE = { classes: 14, warzone: 3 };
const ageDays = (iso) => (iso ? Math.floor((Date.parse(TODAY) - Date.parse(iso)) / 86400000) : 9999);
const pages = read('pages.json');
const changelog = read('changelog.json');

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

const NAV = [['maps', 'Maps'], ['match', 'Match Night'], ['bomb-sites', 'Bomb Sites'], ['ranked-loadouts', 'Loadouts'], ['warzone', 'Warzone'], ['roles', 'Roles']];
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#d8a94b" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle cx="12" cy="12" r="1.6" fill="#d8a94b" stroke="none"/></svg>';
const ICO = {
	map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
	gun: '<path d="M3 10h14l2-2h2v4h-3l-1 2h-4l-1 4H8l1-4H5l-2-2z"/>',
	drop: '<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/><path d="M9 12l2 2 4-4"/>',
	tactical: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
	lethal: '<rect x="7" y="9" width="10" height="12" rx="4"/><path d="M10 9V6h4v3M14 6h3.5l1 3"/>',
	fieldUpgrade: '<path d="M12 3.5v9.5M7 20.5l5-7.5 5 7.5M8 7h8"/><circle cx="12" cy="7" r="1.2"/>',
	perk1: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M10.6 10l1.7-1.2v6.4"/>',
	perk2: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M10 10.2c.3-1.9 3.8-1.9 3.8.2 0 1.6-2.4 2.6-3.9 4.8h4.2"/>',
	perk3: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M10 9.2h3.8l-2.2 2.7c3.4 0 3 3.6.4 3.6-1.1 0-1.9-.5-2.2-1.2"/>',
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
		'<link rel="manifest" href="' + r + 'manifest.webmanifest">\n<link rel="apple-touch-icon" href="' + r + 'images/icons/apple-touch-icon.png">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="MW4 Hub">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
		"<script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');</script>\n" +
		'<title>' + esc(o.title) + '</title>\n' + (o.description ? '<meta name="description" content="' + esc(o.description) + '">\n' : '') +
		'<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#12160c"/>' + LOGO.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace('<circle cx="12" cy="12" r="7.5"/>', '<circle cx="12" cy="12" r="7.5" fill="none" stroke="#d8a94b" stroke-width="2"/>').replace('<path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>', '<path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="#d8a94b" stroke-width="2" stroke-linecap="round"/>') + '</svg>') + '">\n' +
		css.map((f) => '<link rel="stylesheet" href="' + r + 'assets/' + f + '?v=' + assetVer(f) + '">').join('\n') + '\n</head>\n' +
		'<body class="' + esc(o.bodyClass || '') + '">\n<a class="skip-link" href="#main">Skip to content</a>\n' +
		'<header class="site-header" id="top">\n\t<div class="header-inner">\n\t\t<a class="brand" href="' + url('') + '" aria-label="MW4 Hub home">' + brand + '</a>\n' +
		'\t\t<nav class="main-nav" aria-label="Primary"><ul>' + nav(true) + '</ul></nav>\n' +
		'\t\t<div class="header-actions"><a class="btn btn-ghost btn-sm" href="' + url('my-plans') + '">My Plans</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Menu"><span></span><span></span></button></div>\n\t</div>\n' +
		'\t<div class="mobile-nav" id="mobile-nav" hidden><ul>' + nav(false) + '<li><a href="' + url('squad') + '">Squad</a></li><li><a href="' + url('my-plans') + '">My Plans</a></li></ul></div>\n</header>\n' +
		'<main id="main" class="site-main">\n' + o.content + '\n</main>\n' +
		'<footer class="site-footer">\n\t<div class="container footer-inner">\n\t\t<div class="footer-brand"><a class="brand" href="' + url('') + '">' + brand + '</a><p>Ranked game plans, pro loadouts and interactive maps for Modern Warfare 4. Built for 4v4.</p></div>\n' +
		'\t\t<nav class="footer-links" aria-label="Footer">' + NAV.map(([slug, label]) => '<a href="' + url(slug) + '">' + esc(label) + '</a>').join('') + '<a href="' + url('squad') + '">Squad</a><a href="' + url('my-plans') + '">My Plans</a><a href="' + url('credits') + '">Sources &amp; Credits</a></nav>\n' +
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
// ---------- loadout screen: laid out like the in-game class editor (numbered class list, a stacked column of
// slots with the weapon pictured, details beside it), without the operator ----------
const KIT_ICON = { tactical: 'tactical', lethal: 'lethal', fieldUpgrade: 'fieldUpgrade', perk1: 'perk1', perk2: 'perk2', perk3: 'perk3' };
const MAX_ATTACHMENTS = 5;
function buildWho(bd) {
	return bd.kind === 'pro' ? (bd.players && bd.players.length ? bd.players.join(' & ') + (bd.team ? ' · ' + bd.team : '') : 'Pro build') : 'Creator variant';
}
// Official weapon graphic, shown by link and cropped to the weapon with CSS (see data/gun-images.json).
function gunPic(name, cls) {
	const key = Object.keys(gunImages.images).find((k) => same(k, name));
	if (!key) return '';
	const g = gunImages.images[key], c = g.crop || gunImages.defaultCrop, pct = (n) => (Math.round(n * 1e4) / 100) + '%';
	const ar = Math.round((c[2] * gunImages.size[0]) / (c[3] * gunImages.size[1]) * 1000) / 1000;
	return '<span class="gun-pic' + (cls ? ' ' + cls : '') + '" style="--ar:' + ar + '"><img src="' + esc(gunImages.base + g.file + gunImages.ext) + '" alt="' + esc(g.name || name) + '" width="' + gunImages.size[0] + '" height="' + gunImages.size[1] + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="width:' + pct(1 / c[2]) + ';left:' + pct(-c[0] / c[2]) + ';top:' + pct(-c[1] / c[3]) + '"></span>';
}
const pips = (n) => '<span class="ld-pips" role="img" aria-label="' + n + ' of ' + MAX_ATTACHMENTS + ' attachments">' + Array.from({ length: MAX_ATTACHMENTS }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>';
function gunSlot(label, name, cls, n, slotCls) {
	return '<div class="ld-slot ld-gun ' + slotCls + '"><div class="ld-slot-top"><span class="ld-k">' + esc(label) + '</span>' + (n === null ? '' : pips(n)) + '</div>' + gunPic(name) +
		'<div class="ld-slot-name">' + (cls ? '<span class="ld-s">' + esc(cls) + '</span>' : '') + '<b class="ld-n">' + esc(name) + '</b></div></div>';
}
function rowSlot(kit, k, label) {
	const it = kit[k];
	if (!it) return '';
	return '<div class="ld-slot ld-row ld-' + k + '"><div><span class="ld-k">' + esc(label) + '</span><b class="ld-n">' + esc(it.name) + '</b>' + (it.alt && it.alt.length ? '<span class="ld-s">or ' + esc(it.alt.join(', ')) + '</span>' : '') + '</div><span class="ld-ico">' + ico(KIT_ICON[k]) + '</span></div>';
}
function rolePicks(key) {
	const cfg = classData.roles[key];
	const picks = (cfg.builds || []).map((id) => liveBuilds.find((x) => x.id === id)).filter(Boolean);
	return picks.length ? picks : liveBuilds.filter((x) => inList(cfg.guns, x.weapon)).slice(0, 2);
}
function loadoutView(id, bd, kit, role, first) {
	const who = buildWho(bd), atts = bd.attachments || [], effects = classData.effects || {};
	const runBy = role ? [] : roleData.roles.filter((r) => classData.roles[r.key] && inList(classData.roles[r.key].guns, bd.weapon));
	const secClass = kit.secondary ? ((weaponList.find((x) => same(x.name, kit.secondary.name)) || {}).class || '') : '';
	const perks = ['perk1', 'perk2', 'perk3'].filter((k) => kit[k]);
	let h = '<article class="card ld-view" data-ld-view="' + esc(id) + '" data-build="' + esc(bd.id) + '"' + (role ? ' style="--role:' + esc(role.color) + '"' : '') + (first ? '' : ' hidden') + '>';
	h += '<header class="ld-head"><div class="ld-title">' + (role ? '<span class="role-badge">' + esc(role.short) + '</span>' : '') + '<div><span class="ld-eyebrow">' + esc(role ? role.tag + ' class' : bd.weapon + (who !== bd.label ? ' · ' + who : '')) + '</span><h2>' + esc(role ? role.name : bd.label) + '</h2></div></div>' +
		'<div class="ld-actions">' + legalChips(bd.legal) + '<button class="btn btn-sm lo-copy" type="button" data-copy="' + esc(classCopyText(bd, kit)) + '">Copy class</button></div></header>';
	if (role) h += '<p class="ld-note ld-rolenote">' + esc(classData.roles[role.key].note) + '</p>';
	// Slot column
	h += '<div class="ld-stack">' + gunSlot('Primary', bd.weapon, bd.class, atts.length, 'ld-primary') +
		(kit.secondary ? gunSlot('Secondary', kit.secondary.name, secClass, 0, 'ld-secondary') : '') +
		(kit.melee ? gunSlot('Melee', kit.melee.name, '', null, 'ld-melee') : '') +
		rowSlot(kit, 'tactical', 'Tactical') + rowSlot(kit, 'lethal', 'Lethal') + rowSlot(kit, 'fieldUpgrade', 'Field upgrade') +
		'<div class="ld-slot ld-perks"><span class="ld-k">Perks</span><div class="ld-perkrow">' + perks.map((k) => '<span class="ld-perk"><span class="ld-ico">' + ico(KIT_ICON[k]) + '</span><b>' + esc(kit[k].name) + '</b></span>').join('') + '</div></div></div>';
	h += '<div class="ld-detail">';
	const hero = gunPic(bd.weapon, 'gun-hero');
	h += '<section class="ld-sec ld-gunsmith"><div class="ld-hero">' + hero + '<div class="ld-hero-name"><span class="ld-s">' + esc(bd.class) + (role ? ' · ' + esc(bd.label) + (who !== bd.label ? ' · ' + esc(who) : '') : '') + '</span><b>' + esc(bd.weapon) + '</b></div>' +
		(hero ? '<span class="ld-credit">Image: ' + esc(gunImages.credit) + '</span>' : '') + '</div>' +
		'<h3>Attachments <span>' + atts.length + ' of ' + MAX_ATTACHMENTS + '</span></h3><ol class="ld-atts">' + atts.map((x) => '<li class="ld-att"><span class="ld-k">' + esc(x.slot || 'Attachment') + '</span><b class="ld-n">' + esc(x.name || x.type || '') + '</b><span class="ld-s">' + esc(x.name ? (x.type && !same(x.type, x.slot) ? x.type : '') : 'Name not given by the source') + '</span></li>').join('') + '</ol>' +
		bd.legal.ga.map((g) => '<p class="cls-ga">' + esc(g.text) + ' It is still legal in Ranked and CMG Arena as the rules are written.</p>').join('') +
		(bd.note ? '<p class="ld-note">' + esc(bd.note) + '</p>' : '') + '</section>';
	h += '<section class="ld-sec ld-perkinfo"><h3>Perks</h3>' + perks.map((k, i) => '<div class="ld-pi"><b>' + esc(kit[k].name) + '</b><span class="ld-k">Perk ' + (i + 1) + (kit[k].alt && kit[k].alt.length ? ' · or ' + esc(kit[k].alt.join(', ')) : '') + '</span>' +
		'<p>' + [effects[Object.keys(effects).find((e) => same(e, kit[k].name))] || '', kit[k].note || ''].filter(Boolean).map(esc).join(' <i>' ) .replace(/ <i>(.*)$/, ' <i>$1</i>') + '</p></div>').join('') + '</section>';
	if (runBy.length) h += '<div class="ld-runby"><span>Run by</span>' + runBy.map((r) => '<button type="button" class="chip cls-role" style="--role:' + esc(r.color) + '" data-ld-open="r-' + esc(r.key) + '-' + esc(bd.id) + '" data-ld-fallback="r-' + esc(r.key) + '"><i></i>' + esc(r.name) + '</button>').join('') + '</div>';
	h += '<details class="ld-why"><summary>Why this equipment</summary><ul>' + KIT_SLOTS.filter(([k]) => kit[k] && kit[k].note && !/^perk/.test(k)).map(([k, label]) => '<li><b>' + esc(label) + '</b> ' + esc(kit[k].note) + '</li>').join('') + '</ul>' +
		'<div class="cls-srcs"><span class="lo-date">Perks and equipment from</span>' + srcLinks(classData.kit.sources) + '</div></details>';
	h += '<footer class="ld-foot"><span class="lo-date">Seen in use ' + esc(fmtDate(bd.verified)) + '</span><div class="cls-srcs">' + srcLinks(bd.sources) + (role ? '<a class="lo-src" href="../roles/#role-' + esc(role.key) + '">How to play ' + esc(role.name) + '</a>' : '') + '</div></footer>';
	return h + '</div></article>';
}
function loadoutScreen() {
	const guns = [], views = [], two = (n) => (n < 10 ? '0' : '') + n;
	liveBuilds.forEach((x) => { if (guns.indexOf(x.weapon) < 0) guns.push(x.weapon); });
	const item = (id, n, title, sub, on) => '<button type="button" class="ld-item' + (on ? ' is-on' : '') + '" data-ld-open="' + esc(id) + '"' + (on ? ' aria-current="true"' : '') + '><span class="ld-num">' + two(n) + '</span><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></button>';
	let gunList = '', roleList = '', gi = 0, ri = 0;
	guns.forEach((g) => {
		const bs = liveBuilds.filter((x) => x.weapon === g);
		gunList += '<div class="ld-group"><div class="ld-gh"><b>' + esc(g) + '</b><span>' + esc(bs[0].class) + '</span></div><div class="ld-items">' +
			bs.map((x) => { const id = 'g-' + x.id; views.push(loadoutView(id, x, kitFor(null), null, !views.length)); return item(id, ++gi, x.label, buildWho(x) !== x.label ? buildWho(x) : 'Seen ' + fmtDate(x.verified), views.length === 1); }).join('') + '</div></div>';
	});
	roleData.roles.forEach((r) => {
		if (!classData.roles[r.key]) return;
		const bs = rolePicks(r.key), kit = kitFor(r.key);
		roleList += '<div class="ld-group" data-ld-role="' + esc(r.key) + '" style="--role:' + esc(r.color) + '"><div class="ld-gh"><b><i></i>' + esc(r.name) + '</b><span>' + esc(r.tag) + '</span></div><div class="ld-items">' +
			(bs.length ? bs.map((x) => { const id = 'r-' + r.key + '-' + x.id; views.push(loadoutView(id, x, kit, r, false)); return item(id, ++ri, x.weapon, x.label, false); }).join('') : '<p class="muted ld-empty">No current build for this role. It will be back after the next refresh.</p>') + '</div></div>';
	});
	if (!views.length) return '<p class="lo-none muted">No current classes right now. They will be back after the next refresh.</p>';
	return '<div class="ld" data-ld><aside class="ld-side" aria-label="Loadouts"><div class="seg ld-sw" role="tablist"><button type="button" role="tab" class="is-on" aria-selected="true" data-ld-group="gun">By gun</button><button type="button" role="tab" aria-selected="false" data-ld-group="role">By role</button></div>' +
		'<nav class="ld-list" data-ld-list="gun">' + gunList + '</nav><nav class="ld-list" data-ld-list="role" hidden>' + roleList + '</nav></aside>' +
		'<div class="ld-main">' + views.join('') + '</div></div>';
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
	const lastChange = (rules.cmg.changes[0] || {}).date;
	let h = '<div class="lo-app cls-app" data-lo-app data-checked="' + esc(classData.updated) + '" data-max-age="' + MAX_AGE.classes + '">';
	h += '<div class="lo-toolbar"><div class="seg" role="tablist" data-seg>' +
		'<button type="button" role="tab" data-tab="loadouts" class="is-on" aria-selected="true">Loadouts <span>' + liveBuilds.length + '</span></button>' +
		'<button type="button" role="tab" data-tab="rules" aria-selected="false">Rules &amp; bans</button></div>' +
		'<span class="ld-checked">Checked <b data-ago="' + esc(classData.updated) + '">' + esc(fmtDate(classData.updated)) + '</b></span></div>';
	h += '<section data-panel="loadouts">' + loadoutScreen() +
		'<div class="cls-status card"><div><span class="eyebrow">What changed</span><p>' + esc(classData.summary) + '</p><p class="muted">Every class is checked against both rule sets when the site is built, and a build nobody has been seen using for ' + MAX_AGE.classes + ' days drops off the page.</p></div>' +
		'<div class="cls-status-rules"><span class="chip chip-sage">' + esc(rules.cdl.title) + '</span><span class="chip chip-sage">' + esc(rules.cmg.title) + (lastChange ? ' · changed ' + esc(fmtDate(lastChange)) : '') + '</span><span class="chip">Rules read ' + esc(fmtDate(rules.checked)) + '</span></div></div></section>';
	h += '<section data-panel="rules" hidden><p class="lo-note">The two rule sets every class is checked against. Rules were last read on ' + esc(fmtDate(rules.checked)) + '.</p>' + rulesPanel() + '</section>';
	return h + '</div>';
}
// Warzone: the same class-screen layout as Ranked Loadouts, one view per weapon, listed by tier or by range.
const WZ_TIERS = { S: 'Meta', A: 'Strong picks', B: 'Viable', C: 'Situational', D: 'Off meta' };
function warzoneView(id, d, first) {
	const builds = d.builds || [], st = d.sources_tier || {};
	const tierChips = Object.keys(st).map((k) => '<span class="chip">' + esc(k + ' ' + st[k]) + '</span>').join('');
	let h = '<article class="card ld-view wz-view" data-ld-view="' + esc(id) + '"' + (first ? '' : ' hidden') + '>';
	h += '<header class="ld-head"><div class="ld-title"><span class="tier tier-' + esc(d.tier || 'C') + '" title="Tier ' + esc(d.tier || 'C') + '">' + esc(d.tier || 'C') + '</span><div><span class="ld-eyebrow">' + esc((WZ_TIERS[d.tier] || 'Tier ' + d.tier) + (d.category ? ' · ' + d.category : '')) + '</span><h2>' + esc(d.weapon) + '</h2></div></div>' +
		'<div class="ld-actions"><div class="cls-legal">' + tierChips + '</div></div></header>';
	h += '<div class="ld-stack">' + gunSlot('Primary', d.weapon, d.class, Math.min(MAX_ATTACHMENTS, ((builds[0] || {}).attachments || []).length), 'ld-primary') +
		'<div class="ld-slot ld-row"><div><span class="ld-k">Best at</span><b class="ld-n">' + esc(d.category || 'All ranges') + '</b></div></div>' +
		'<div class="ld-slot ld-row"><div><span class="ld-k">Tier on each tracker</span><b class="ld-n">' + esc(Object.keys(st).map((k) => st[k]).join(' / ') || d.tier || '') + '</b><span class="ld-s">' + esc(Object.keys(st).join(' / ')) + '</span></div><span class="tier tier-' + esc(d.tier || 'C') + '">' + esc(d.tier || 'C') + '</span></div>' +
		'<div class="ld-slot ld-row"><div><span class="ld-k">Checked</span><b class="ld-n">' + esc(fmtDate(d.verified)) + '</b></div></div></div>';
	const hero = gunPic(d.weapon, 'gun-hero');
	h += '<div class="ld-detail"><section class="ld-sec ld-gunsmith"><div class="ld-hero' + (hero ? '' : ' ld-hero-bare') + '">' + hero + '<div class="ld-hero-name"><span class="ld-s">' + esc(d.class || '') + '</span><b>' + esc(d.weapon) + '</b></div>' + (hero ? '<span class="ld-credit">Image: ' + esc(gunImages.credit) + '</span>' : '') + '</div>';
	if (builds.length > 1) h += '<div class="lo-tabs" role="tablist">' + builds.map((b, i) => '<button type="button" role="tab" data-b="' + i + '" class="' + (i === 0 ? 'is-on' : '') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + esc(b.name || ('Build ' + (i + 1))) + '</button>').join('') + '</div>';
	builds.forEach((b, i) => {
		const atts = b.attachments || [];
		h += '<div class="lo-build" data-b="' + i + '"' + (i ? ' hidden' : '') + '><h3>Attachments <span>' + atts.length + '</span>' + (builds.length === 1 && b.name ? ' <em>' + esc(b.name) + '</em>' : '') + '</h3><ol class="ld-atts">' +
			atts.map((a) => '<li class="ld-att"><span class="ld-k">' + esc(a.slot || 'Attachment') + '</span><b class="ld-n">' + esc(a.name || '') + '</b><span class="ld-s"></span></li>').join('') + '</ol>' +
			'<div class="ld-foot"><button class="btn btn-sm lo-copy" type="button" data-copy="' + esc(buildCopyText(d, b)) + '">Copy build</button>' +
			(b.source && b.source.url ? '<a class="lo-bsrc" href="' + esc(b.source.url) + '" target="_blank" rel="noopener nofollow">' + esc((b.both ? 'Same build on both trackers · ' : '') + b.source.label) + '</a>' : '') + '</div></div>';
	});
	if (!builds.length) h += '<p class="muted lo-empty">Full build not published by our sources yet.</p>';
	h += '</section>' + (d.video ? ytLite(d.video) : '');
	if (d.source && d.source.url) h += '<footer class="ld-foot"><a class="lo-src" href="' + esc(d.source.url) + '" target="_blank" rel="noopener nofollow">' + esc('Source: ' + (d.source.label || 'link')) + '</a></footer>';
	return h + '</div></article>';
}
function warzoneScreen(wz) {
	const two = (n) => (n < 10 ? '0' : '') + n, idOf = (d) => 'w-' + String(d.weapon).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const item = (d, n, sub, on) => '<button type="button" class="ld-item' + (on ? ' is-on' : '') + '" data-ld-open="' + esc(idOf(d)) + '"' + (on ? ' aria-current="true"' : '') + '><span class="ld-num">' + two(n) + '</span><b>' + esc(d.weapon) + '</b><span>' + esc(sub) + '</span></button>';
	const ordered = [];
	let tierList = '', rangeList = '', n = 0;
	for (const t of ['S', 'A', 'B', 'C', 'D']) {
		const list = wz.filter((d) => (d.tier || 'C') === t);
		if (!list.length) continue;
		tierList += '<div class="ld-group"><div class="ld-gh"><b><span class="tier tier-sm tier-' + t + '">' + t + '</span>' + esc(WZ_TIERS[t]) + '</b><span>' + list.length + '</span></div><div class="ld-items">' + list.map((d) => { ordered.push(d); return item(d, ++n, [d.class, d.category].filter(Boolean).join(' · '), n === 1); }).join('') + '</div></div>';
	}
	const cats = [];
	wz.forEach((d) => { const c = d.category || 'Other'; if (cats.indexOf(c) < 0) cats.push(c); });
	n = 0;
	cats.forEach((c) => {
		const list = ordered.filter((d) => (d.category || 'Other') === c);
		rangeList += '<div class="ld-group"><div class="ld-gh"><b>' + esc(c) + '</b><span>' + list.length + '</span></div><div class="ld-items">' + list.map((d) => item(d, ++n, 'Tier ' + (d.tier || 'C') + (d.class ? ' · ' + d.class : ''), false)).join('') + '</div></div>';
	});
	return '<div class="ld" data-ld><aside class="ld-side" aria-label="Warzone weapons"><div class="seg ld-sw" role="tablist"><button type="button" role="tab" class="is-on" aria-selected="true" data-ld-group="tier">By tier</button><button type="button" role="tab" aria-selected="false" data-ld-group="range">By range</button></div>' +
		'<nav class="ld-list" data-ld-list="tier">' + tierList + '</nav><nav class="ld-list" data-ld-list="range" hidden>' + rangeList + '</nav></aside>' +
		'<div class="ld-main">' + ordered.map((d, i) => warzoneView(idOf(d), d, i === 0)).join('') + '</div></div>';
}
function warzone(r) {
	const wz = liveWarzone;
	const wzChecked = wz.map((d) => d.verified).sort().pop() || '';
	const long = wz.find((d) => d.tier === 'S' && d.category === 'Long Range');
	const close = wz.find((d) => d.tier === 'S' && d.category === 'Close Range');
	let h = '<div class="lo-app" data-lo-app data-checked="' + esc(wzChecked) + '" data-max-age="' + MAX_AGE.warzone + '">' +
		'<div class="lo-toolbar"><div class="seg" role="tablist" data-seg><button type="button" role="tab" data-tab="meta" class="is-on" aria-selected="true">Meta loadouts <span>' + wz.length + '</span></button><button type="button" role="tab" data-tab="maps" aria-selected="false">Newest maps <span>' + wzmaps.length + '</span></button></div>' +
		'<span class="ld-checked">Checked <b data-ago="' + esc(wzChecked) + '">' + esc(fmtDate(wzChecked)) + '</b></span></div><section data-panel="meta">';
	if (long && close) h += '<div class="wz-pair card"><span class="eyebrow">Meta pairing</span><div class="wz-pair-row"><div><b>' + esc(long.weapon) + '</b><span class="muted">Long range primary</span></div><span class="wz-plus">+</span><div><b>' + esc(close.weapon) + '</b><span class="muted">Close range secondary</span></div></div></div>';
	h += wz.length ? warzoneScreen(wz) : '<p class="lo-empty muted">No Warzone builds have been re-checked in the last ' + MAX_AGE.warzone + ' days, so none are shown. They return after the next refresh.</p>';
	h += '<p class="lo-note wz-note">Tiers combine today’s rankings from wzstats.gg and warzoneloadout.games: weapons rated highly on both rank highest, and each weapon shows its tier on each site. Where the two sites build a gun differently you get both builds. Anything not re-checked for ' + MAX_AGE.warzone + ' days is taken off the page.</p>';
	h += '</section><section data-panel="maps" hidden><div class="grid grid-3 wz-maps">';
	for (const m of wzmaps) {
		h += '<article class="card wz-map"><div class="wz-thumb">' + (m.image ? '<img src="' + r + esc(m.image) + '" alt="' + esc(m.name + ' map') + '" loading="lazy" decoding="async">' : '<div class="wz-thumb-empty">' + esc(m.name) + '</div>');
		h += '<span class="chip ' + (m.status === 'New' ? 'chip-brass' : 'chip-sage') + '">' + esc(m.status || '') + '</span></div>';
		h += '<div class="card-pad"><h3>' + esc(m.name) + '</h3><div class="lo-meta"><span class="chip">' + esc(m.type || '') + '</span><span class="chip">' + esc(m.released || '') + '</span></div><p class="muted">' + esc(m.description || '') + '</p>';
		if (m.url) h += '<a class="lo-src" href="' + esc(m.url) + '" target="_blank" rel="noopener nofollow">Full map layout and POIs on GamesAtlas</a>';
		h += '</div></article>';
	}
	return h + '</div></section></div>';
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
		['Call of Duty (Activision): Weapons Detail', 'https://www.callofduty.com/blog/2026/10/call-of-duty-modern-warfare-4-launch-multiplayer-operators-weapons-equipment-create-a-class', 'The weapon pictures on the Ranked Loadouts page. They are Activision\u2019s official graphics, shown by link from callofduty.com rather than copied.'],
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
// ---------- what changed (data/changelog.json; the daily refresh adds an entry per run) ----------
function whatChanged() {
	const entries = (changelog.entries || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
	if (!entries.length) return '';
	return '<div class="chg card" data-refresh="' + esc(entries[0].date) + '" data-max-age="2"><div class="chg-head"><div><span class="eyebrow">What changed</span><h2>Checked <span data-ago="' + esc(entries[0].date) + '">' + esc(fmtDate(entries[0].date)) + '</span></h2></div>' +
		'<p class="muted">Loadouts and rules are re-read every morning. Anything that moved shows up here.</p></div><ol class="chg-list">' +
		entries.map((e) => '<li><time datetime="' + esc(e.date) + '">' + esc(fmtDate(e.date)) + '</time><ul>' + (e.items || []).map((it) => '<li><span class="chip chg-' + esc(String(it.area || 'site').toLowerCase()) + '">' + esc(it.area || 'Site') + '</span>' + esc(it.text) + '</li>').join('') + '</ul></li>').join('') + '</ol></div>';
}
// ---------- squad and match night (rendered in the browser by squad.js from this data; player names never leave the device) ----------
const MODE_NAMES = { hp: 'Hardpoint', snd: 'Search & Destroy', hj: 'Hijack' };
function teamData() {
	return {
		modes: MODE_NAMES,
		roles: roleData.roles.map((r) => {
			const g = (guide.roles || {})[r.key] || {}, cfg = classData.roles[r.key];
			return { key: r.key, name: r.name, short: r.short, color: r.color, tag: r.tag, summary: r.summary, jobs: { hp: g.hp || r.hp || [], snd: g.snd || r.snd || [], hj: g.hj || [] },
				cls: cfg ? { guns: cfg.guns, note: cfg.note, builds: rolePicks(r.key).map((b) => ({ id: 'r-' + r.key + '-' + b.id, weapon: b.weapon, label: b.label })), kit: KIT_SLOTS.filter(([k]) => kitFor(r.key)[k]).map(([k, label]) => [label, kitFor(r.key)[k].name]) } : null };
		}),
		rules: (guide.modes || []).reduce((o, m) => { o[m.key] = { rules: m.rules, jobs: (m.jobs || []).map((j) => ({ job: j.job, who: j.who || [], what: j.what })) }; return o; }, {}),
		coaching: roleData.coaching || {},
		maps: maps.map((m) => {
			const ex = extras[m.slug] || {}, calls = ex.hillCalls || {};
			return { slug: m.slug, name: m.name, modes: m.modes, img: (m.image && m.image.file) || '', hills: has(m, 'hp') ? ((m.hp && m.hp.hills) || []).map((h) => ({ n: h.n, name: h.name, call: calls[h.n] || '' })) : [], names: ex.names || [], tips: ex.tips || [], src: ex.source || null };
		}),
	};
}
const teamDataScript = () => '\n<script type="application/json" id="mw4-team-data">' + jsonForScript(teamData()) + '</script>';
function squadPage() {
	return '<div class="sq" data-squad><noscript><p class="muted">Turn on JavaScript to set up your squad.</p></noscript></div>' + teamDataScript();
}
function matchPage() {
	return '<div class="mt" data-match><noscript><p class="muted">Turn on JavaScript to use Match Night.</p></noscript></div>' + teamDataScript();
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
		'\t\t<div class="hero-actions reveal d3"><a class="btn btn-primary" href="' + r + 'maps/">' + ico('map') + ' Open the map planner</a><a class="btn" href="' + r + 'match/">Match Night</a><a class="btn" href="' + r + 'ranked-loadouts/">Pro loadouts</a></div>\n' +
		'\t\t<div class="stats reveal">' + stats.map((s) => '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>').join('') + '</div>\n\t</div>\n</section>\n\n' +
		'<section class="section"><div class="container"><div class="grid grid-3">' +
		feature('maps', 'map', '', 'Interactive maps', 'Zoom into every Ranked Play map. See hardpoint rotations, S&D bomb sites and bomb spawns, then draw routes, strong points and enemy paths for your team of four.', 'Plan a map') +
		feature('ranked-loadouts', 'gun', ' d1', 'Ranked loadouts', 'Current competitive classes by gun and by role, with perks and equipment, checked against the Ranked and CMG rules every day.', 'See builds') +
		feature('warzone', 'drop', ' d2', 'Warzone', 'A ranked Warzone meta built from multiple trackers, with full builds and the newest 2026 maps.', 'Warzone meta') +
		'</div></div></section>\n\n' +
		'<section class="section section-tight"><div class="container"><div data-continue hidden></div>' + whatChanged() + '<p class="install muted" data-install hidden></p></div></section>\n\n' +
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
for (const f of fs.readdirSync(path.join(SRC, 'images/icons'))) used.add('images/icons/' + f);
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
// Installable on a phone: manifest and a small offline fallback. The service worker always asks the network
// first, so a visitor who is online never sees an old copy; the cache is only used when there is no connection.
write('manifest.webmanifest', JSON.stringify({
	name: site.name, short_name: site.name, description: site.tagline, start_url: './?source=app', scope: './', display: 'standalone', background_color: '#07090a', theme_color: '#07090a',
	icons: [{ src: 'images/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'images/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'images/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
	shortcuts: [{ name: 'Match Night', url: './match/' }, { name: 'Maps', url: './maps/' }, { name: 'Loadouts', url: './ranked-loadouts/' }],
}, null, 1));
write('sw.js', "/* MW4 Hub offline fallback. Network first; the cache is only read when the network fails. */\n" +
	"var CACHE = 'mw4hub-v1';\n" +
	"self.addEventListener('install', function () { self.skipWaiting(); });\n" +
	"self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });\n" +
	"self.addEventListener('fetch', function (e) {\n" +
	"\tvar req = e.request;\n" +
	"\tif (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;\n" +
	"\te.respondWith(fetch(req).then(function (res) {\n" +
	"\t\tif (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }\n" +
	"\t\treturn res;\n" +
	"\t}).catch(function () { return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) { return hit || Response.error(); }); }));\n" +
	"});\n");
write('match/index.html', standardPage('match', matchPage(), { scripts: ['squad.js'] }));
write('squad/index.html', standardPage('squad', squadPage(), { scripts: ['squad.js'] }));
for (const m of maps) {
	write('maps/' + m.slug + '/index.html', layout({
		depth: 2, active: 'maps', bodyClass: 'is-planner', planner: true, scripts: ['planner.js'],
		title: m.name + ' Map Planner: ' + m.modes.map((k) => ({ hp: 'Hardpoint', snd: 'S&D', hj: 'Hijack' })[k]).join(', ') + ' \u2013 ' + site.name, description: m.description, content: planner(m, '../../'),
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
