#!/usr/bin/env node
/* Serves ./dist (optionally under a sub-path) and smoke-tests every page in a headless browser. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', process.env.OUT || 'dist');
const PREFIX = process.env.PREFIX || '';
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
	let p = decodeURIComponent(req.url.split('?')[0]);
	if (PREFIX && !p.startsWith(PREFIX)) { res.writeHead(404); return res.end('outside prefix'); }
	p = p.slice(PREFIX.length) || '/';
	let f = path.join(DIST, p);
	if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
	if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
	res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
	res.end(fs.readFileSync(f));
});
(async () => {
	await new Promise((r) => server.listen(0, r));
	const base = 'http://127.0.0.1:' + server.address().port + PREFIX + '/';
	const allMaps = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'maps.json'), 'utf8'));
	const maps = allMaps.filter((m) => m.modes && m.modes.length);
	const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
	// Weapon pictures are loaded by link from callofduty.com. The checks never call out to it: a stand-in picture
	// is served instead, and one context refuses the request to prove the page copes without the pictures.
	const GUN_HOST = /^https:\/\/imgs\.callofduty\.com\//;
	let standIn = null;
	{
		const sp = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
		await sp.setContent('<body style="margin:0;background:#000"><div style="position:absolute;left:15%;top:22%;width:70%;height:20%;background:linear-gradient(90deg,#777,#bbb);border-radius:14px"></div><div style="position:absolute;left:44%;top:40%;width:7%;height:16%;background:#999"></div></body>');
		standIn = await sp.screenshot({ type: 'png' });
		await sp.close();
	}
	const newContext = browser.newContext.bind(browser);
	browser.newContext = async (o) => { const c = await newContext(Object.assign({ serviceWorkers: 'block' }, o)); await c.route(GUN_HOST, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: standIn })); return c; };
	const problems = [];
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	let where = '';
	page.on('console', (m) => { if (m.type() === 'error' && !/does-not-exist/.test(where)) problems.push(where + ': console: ' + m.text()); });
	page.on('pageerror', (e) => problems.push(where + ': error: ' + e.message));
	page.on('requestfailed', (r) => problems.push(where + ': failed: ' + r.url()));
	page.on('response', (r) => { if (r.status() >= 400 && !/does-not-exist/.test(r.url())) problems.push(where + ': ' + r.status() + ' ' + r.url()); });
	const shot = async (name, full) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); };
	const go = async (p) => { where = p || '/'; await page.goto(base + p, { waitUntil: 'networkidle' }); };
	const expect = (ok, msg) => { if (!ok) problems.push(where + ': ' + msg); };

	await go('');
	expect(await page.locator('.map-card').count() === maps.length, 'home map cards');
	expect(await page.locator('.role-card').count() === 4, 'home role cards');
	expect(await page.locator('.chg .chg-list > li').count() > 0 && await page.locator('.chg-warn').count() === 0, 'home: what-changed list, no stale warning on a fresh build');
	expect(await page.locator('[data-continue]').isHidden(), 'home: no continue card before any map was opened');
	expect((await ctx.request.get(base + 'manifest.webmanifest')).status() === 200 && (await ctx.request.get(base + 'sw.js')).status() === 200 && (await ctx.request.get(base + 'images/icons/icon-192.png')).status() === 200, 'install files are published');
	await shot('home', true);
	// Every internal link on every top page resolves.
	const seen = new Set();
	for (const p of ['', 'maps/', 'match/', 'squad/', 'bomb-sites/', 'ranked-loadouts/', 'warzone/', 'roles/', 'my-plans/', 'credits/']) {
		await go(p);
		for (const href of await page.$$eval('a[href]', (as) => as.map((a) => a.href))) if (href.startsWith(base)) seen.add(href.split('#')[0]);
		await shot(p.replace(/\//g, '') || 'index', true);
	}
	for (const href of seen) { const r = await ctx.request.get(href); if (r.status() !== 200) problems.push('broken link ' + href); }

	await go('ranked-loadouts/');
	// Loadout screen: a list on the left, the picked loadout on the right as slot tiles.
	const views = await page.locator('.ld-view').count();
	expect(views > 0 && await page.locator('.ld-view:visible').count() === 1, 'loadout screen shows one loadout at a time');
	expect(await page.locator('[data-ld-list=gun] .ld-item').count() + await page.locator('[data-ld-list=role] .ld-item').count() === views, 'every list entry has a loadout view');
	expect(await page.locator('.ld-view:visible .ld-att').count() === 5 && await page.locator('.ld-view:visible .ld-stack .ld-slot').count() === 7 && await page.locator('.ld-view:visible .ld-perk').count() === 3 && await page.locator('.ld-view:visible .ld-pi').count() === 3,
		'a loadout shows five attachments, the seven slots (primary, secondary, melee, tactical, lethal, field upgrade, perks) and three perk write-ups');
	await page.waitForFunction(() => { const i = document.querySelector('.ld-view:not([hidden]) .ld-primary .gun-pic img'); return i && i.complete && i.naturalWidth > 0; });
	expect(await page.locator('.ld-view:visible .ld-stack .gun-pic:visible').count() === 3 && await page.locator('.ld-view:visible .ld-hero .gun-pic:visible').count() === 1, 'primary, secondary and melee are pictured, plus the large weapon picture');
	expect(await page.$$eval('.gun-pic img', (is) => is.every((i) => /^https:\/\/imgs\.callofduty\.com\//.test(i.src) && i.alt && i.referrerPolicy === 'no-referrer')), 'weapon pictures come from the official source and are labelled');
	expect(await page.locator('.ld-view:visible .ld-primary .ld-pips i.on').count() === 5 && await page.locator('.ld-view:visible .ld-secondary .ld-pips i.on').count() === 0, 'attachment pips: five on the primary, none on the sidearm');
	expect(await page.locator('.ld-view .cls-legal').count() === views && await page.locator('.ld-view .chip-ok').count() === views * 2, 'every loadout shows Ranked and CMG legal');
	expect(await page.locator('.lo-stale').count() === 0, 'loadouts are not flagged stale on a fresh build');
	const second = page.locator('[data-ld-list=gun] .ld-item').nth(1);
	const secondId = await second.getAttribute('data-ld-open');
	await second.click();
	expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === secondId && page.url().endsWith('#' + secondId), 'picking a loadout opens it and puts it in the address');
	const tiles = await page.$$eval('.ld-view:not([hidden]) .ld-slot, .ld-view:not([hidden]) .ld-att', (ts) => ts.filter((t) => t.scrollWidth > t.clientWidth + 1 || !(t.querySelector('.ld-n, .ld-perk b') || {}).textContent).length);
	expect(tiles === 0, 'no slot is empty or overflowing');
	await shot('loadouts-gun', true);
	await page.click('[data-ld-group=role]');
	expect(await page.locator('[data-ld-list=role]').isVisible() && !(await page.locator('[data-ld-list=gun]').isVisible()) && await page.locator('[data-ld-list=role] .ld-group').count() === 4, 'by role lists four roles');
	expect((await page.locator('.ld-view:visible').getAttribute('data-ld-view')).startsWith('r-') && await page.locator('.ld-view:visible .role-badge').count() === 1, 'by role opens a role class');
	expect(await page.locator('.ld-view:visible .lo-copy').getAttribute('data-copy').then((t) => /Perk 1: /.test(t) && /Tactical: /.test(t)), 'copy text carries the whole class');
	await page.locator('[data-ld-list=role] .ld-item').first().focus();
	await page.keyboard.press('ArrowDown');
	expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === await page.locator('[data-ld-list=role] .ld-item').nth(1).getAttribute('data-ld-open'), 'arrow keys move through the list');
	await shot('loadouts-role', true);
	await page.click('[data-ld-group=gun]');
	expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === secondId, 'switching back to by gun returns to the loadout that was open');
	await page.click('.ld-view:visible .ld-runby [data-ld-open]');
	expect((await page.locator('.ld-view:visible').getAttribute('data-ld-view')).startsWith('r-'), 'Run by chip opens that role class');
	const deep = await page.locator('[data-ld-list=role] .ld-item').last().getAttribute('data-ld-open');
	await page.goto(base + 'ranked-loadouts/#' + deep, { waitUntil: 'networkidle' });
	expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === deep && await page.locator('.ld-item.is-on:visible').count() === 1, 'a link to one loadout opens it');
	await page.click('[data-seg] [data-tab=rules]');
	expect(await page.locator('[data-panel=rules] .rl-row').count() > 20 && await page.locator('.rl-card').count() === 2 && !(await page.locator('.ld').isVisible()), 'rules panel: gun check and both rule sets');
	await page.click('[data-seg] [data-tab=loadouts]');
	expect(await page.locator('.ld-view:visible').count() === 1, 'back to the loadout screen');
	// Detailed callouts: on-map switch (All, Main, Off), rename from the map, and older team lists get the new names.
	if (maps.some((m) => m.slug === 'lotus')) {
		const cc = await browser.newContext({ viewport: { width: 1360, height: 900 } });
		const cp = await cc.newPage();
		cp.on('pageerror', (e) => problems.push('callouts: error: ' + e.message));
		const exc = (ok, what) => { if (!ok) problems.push('callouts: ' + what); };
		const openMap = async () => { await cp.goto(base + 'maps/lotus/', { waitUntil: 'networkidle' }); await cp.waitForSelector('.mw4-planner.is-ready'); };
		const n = (sel) => cp.locator(sel).count();
		await openMap();
		const all = await n('.pl-svg .co'), det = await n('.pl-svg .co-detail');
		exc(det >= 15 && all > det, 'detailed callouts are drawn with the main ones (' + det + ' of ' + all + ')');
		exc((await cp.locator('[data-co-cycle]').innerText()) === 'Callouts: All' && (await cp.locator('[data-co-edit]').innerText()) === 'Edit names', 'on-map callout buttons show');
		await cp.click('[data-co-cycle]');
		exc((await cp.locator('[data-co-cycle]').innerText()) === 'Callouts: Main' && await n('.pl-svg .co-detail') === 0 && await n('.pl-svg .co') === all - det, 'Main hides only the detailed callouts');
		await cp.click('[data-co-cycle]');
		exc((await cp.locator('[data-co-cycle]').innerText()) === 'Callouts: Off' && await n('.pl-svg .co') === 0, 'Off hides every callout');
		await openMap();
		exc(await n('.pl-svg .co') === 0 && (await cp.locator('[data-co-cycle]').innerText()) === 'Callouts: Off', 'the callout choice is remembered');
		await cp.click('[data-co-cycle]');
		exc(await n('.pl-svg .co') === all, 'All brings them back');
		await cp.click('[data-co-edit]');
		exc((await cp.locator('[data-co-edit]').innerText()) === 'Done', 'Edit names starts editing');
		const box = await cp.locator('.pl-svg .co-detail').first().boundingBox();
		await cp.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await cp.fill('.pl-pop-co input', 'Renamed Spot');
		await cp.keyboard.press('Enter');
		exc((await cp.locator('.pl-svg').innerHTML()).includes('RENAMED SPOT'), 'a callout can be renamed from the map');
		await cp.click('[data-co-edit]');
		if (SHOTS) await cp.screenshot({ path: path.join(SHOTS, 'callouts.png') });
		await openMap();
		exc((await cp.locator('.pl-svg').innerHTML()).includes('RENAMED SPOT') && await n('.pl-svg .co') === all, 'the new name is kept after reload');
		await cp.evaluate(() => localStorage.setItem('mw4hub:lotus:team', JSON.stringify({ callouts: [{ id: 'c1', s: 'Only One', x: 0.5, y: 0.5, k: 'team' }], spawns: {} })));
		await openMap();
		exc(await n('.pl-svg .co') === det + 1, 'a team list saved before gets the detailed callouts added');
		await cp.click('[data-co-edit]'); await cp.click('[data-co-edit]');
		await openMap();
		exc(await n('.pl-svg .co') === det + 1, 'and they are not added twice');
		await cc.close();
	}
	// Squad: names live on the device, each named player gets a card, and the squad travels by link.
	{
		const sc = await browser.newContext({ viewport: { width: 1360, height: 900 } });
		const sp = await sc.newPage();
		sp.on('pageerror', (e) => problems.push('squad: error: ' + e.message));
		await sp.goto(base + 'squad/', { waitUntil: 'networkidle' });
		expect(await sp.locator('[data-sq-n]').count() === 4 && await sp.locator('.sq-card').count() === 0, 'squad: four empty rows to start');
		const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
		for (let i = 0; i < 4; i++) await sp.fill('[data-sq-n="' + i + '"]', names[i]);
		await sp.waitForFunction(() => document.querySelectorAll('.sq-card').length === 4);
		expect(await sp.locator('.sq-card .sq-guns a').count() >= 4 && await sp.locator('.sq-card .sq-jobs li').count() >= 8, 'squad: each player card has a class and jobs');
		await sp.locator('.sq-card').first().locator('[data-sq-mode=snd]').click();
		expect(await sp.locator('.sq-card').first().locator('[data-sq-mode=snd].is-on').count() === 1, 'squad: mode tabs switch the jobs');
		await sp.selectOption('[data-sq-r="0"]', 'entry');
		expect((await sp.locator('.sq-card').first().innerText()).includes('Entry SMG'), 'squad: changing a role updates the card');
		await sp.reload({ waitUntil: 'networkidle' });
		expect(await sp.inputValue('[data-sq-n="2"]') === 'Charlie', 'squad: saved on the device');
		const link = await sp.evaluate(() => { const s = JSON.parse(localStorage.getItem('mw4hub:squad')); const b = new TextEncoder().encode(JSON.stringify(s)); let bin = ''; b.forEach((x) => { bin += String.fromCharCode(x); }); return location.pathname + '#s=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); });
		if (SHOTS) await sp.screenshot({ path: path.join(SHOTS, 'squad.png'), fullPage: true });
		// Match Night picks up the squad and the map that was open last.
		await sp.goto(base + 'maps/' + maps[1].slug + '/', { waitUntil: 'networkidle' });
		await sp.goto(base + 'match/', { waitUntil: 'networkidle' });
		expect((await sp.locator('.mt-plan h3').innerText()).startsWith(maps[1].name), 'match night opens on the map used last');
		expect(await sp.locator('.mt-role').count() === 4 && (await sp.locator('.mt-who').innerText()).includes('Bravo'), 'match night shows the squad against the roles');
		expect(await sp.locator('.mt-frame iframe').count() === 1 && /view=brief/.test(await sp.locator('.mt-frame iframe').getAttribute('src')), 'match night embeds the briefing');
		const frame = sp.frameLocator('.mt-frame iframe');
		await frame.locator('.mw4-planner.is-ready').waitFor({ timeout: 15000 }).catch(() => problems.push('match night: briefing did not load'));
		const other = maps.find((m) => m.slug !== maps[1].slug && m.modes.length > 1) || maps[0];
		await sp.click('[data-mt-map="' + other.slug + '"]');
		await sp.click('[data-mt-mode="' + other.modes[1] + '"]');
		expect(sp.url().includes('map=' + other.slug) && sp.url().includes('mode=' + other.modes[1]) && (await sp.locator('.mt-plan h3').innerText()).startsWith(other.name), 'match night: map and mode switch and are kept in the address');
		expect(await sp.locator('.mt-role .mt-class').count() === 4, 'match night links each role to its class');
		if (SHOTS) await sp.screenshot({ path: path.join(SHOTS, 'match.png'), fullPage: true });
		await sp.goto(base, { waitUntil: 'networkidle' });
		expect(await sp.locator('.continue').isVisible() && (await sp.locator('.continue b').innerText()).includes(maps[1].name), 'home offers the map used last');
		// A second device opens the squad link.
		const sc2 = await browser.newContext();
		const sp2 = await sc2.newPage();
		await sp2.goto(base.replace(/\/$/, '') + link.replace(PREFIX, ''), { waitUntil: 'networkidle' });
		expect(await sp2.locator('.sq-card').count() === 4 && await sp2.inputValue('[data-sq-n="3"]') === 'Delta', 'squad link carries the line-up to another device');
		await sc2.close(); await sc.close();
	}
	// Installed copy: pages already seen still open with no connection.
	{
		const oc = await newContext({ viewport: { width: 390, height: 844 } });
		await oc.route(GUN_HOST, (r) => r.abort());
		const op = await oc.newPage();
		await op.goto(base, { waitUntil: 'networkidle' });
		await op.evaluate(() => navigator.serviceWorker.ready);
		await op.reload({ waitUntil: 'networkidle' });
		await op.goto(base + 'match/', { waitUntil: 'networkidle' });
		await oc.setOffline(true);
		const ok = await op.goto(base, { waitUntil: 'load' }).then((r) => !!r && r.ok()).catch(() => false);
		expect(ok && await op.locator('.chg').count() === 1, 'offline: the home page opens from the saved copy');
		const ok2 = await op.goto(base + 'match/', { waitUntil: 'load' }).then((r) => !!r && r.ok()).catch(() => false);
		expect(ok2 && await op.locator('.mt-role').count() === 4, 'offline: match night opens from the saved copy');
		await oc.close();
	}
	// If the weapon pictures cannot be loaded, the slots still show the names.
	{
		const bare = await newContext({ viewport: { width: 1280, height: 800 } });
		await bare.route(GUN_HOST, (r) => r.abort());
		const bp = await bare.newPage();
		await bp.goto(base + 'ranked-loadouts/', { waitUntil: 'networkidle' });
		await bp.waitForFunction(() => document.querySelectorAll('.ld-view:not([hidden]) .gun-pic.is-missing').length === 4).catch(() => {});
		expect(await bp.locator('.ld-view:visible .gun-pic:visible').count() === 0 && (await bp.locator('.ld-view:visible .ld-primary .ld-n').innerText()).trim().length > 0, 'loadouts still read without the weapon pictures');
		await bare.close();
	}
	// If the daily refresh stops, old loadouts are hidden rather than shown as current.
	{
		const late = await browser.newContext();
		const lp = await late.newPage();
		await lp.clock.install({ time: new Date(Date.now() + 40 * 86400000) });
		await lp.goto(base + 'ranked-loadouts/', { waitUntil: 'networkidle' });
		expect(await lp.locator('.lo-stale').count() === 1 && await lp.locator('.ld-view:visible').count() === 0 && !(await lp.locator('.ld').isVisible()), 'stale loadouts are hidden');
		await lp.click('.lo-stale button');
		expect(await lp.locator('.ld-view:visible').count() === 1, 'stale loadouts can be shown on request');
		await lp.goto(base + 'warzone/', { waitUntil: 'networkidle' });
		expect(await lp.locator('.lo-stale').count() === 1, 'stale Warzone builds are flagged');
		await late.close();
	}

	await go('warzone/');
	const wzViews = await page.locator('[data-panel=meta] .ld-view').count();
	expect(wzViews > 0 && await page.locator('.lo-stale').count() === 0, 'warzone builds listed and current');
	expect(await page.locator('[data-ld-list=tier] .ld-item').count() === wzViews && await page.locator('[data-ld-list=range] .ld-item').count() === wzViews, 'warzone: every weapon is in both lists');
	expect(await page.locator('.ld-view:visible').count() === 1 && await page.locator('.ld-view:visible .ld-att').count() > 0 && await page.locator('.ld-view:visible .lo-copy:visible').count() === 1, 'warzone: one weapon shown with its attachments and a copy button');
	{
		const third = page.locator('[data-ld-list=tier] .ld-item').nth(2), id = await third.getAttribute('data-ld-open');
		await third.click();
		expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === id, 'warzone: picking a weapon opens it');
		await page.click('[data-ld-group=range]');
		expect(await page.locator('[data-ld-list=range]').isVisible() && await page.locator('.ld-view:visible').getAttribute('data-ld-view') === id && await page.locator('[data-ld-list=range] .ld-item.is-on').getAttribute('data-ld-open') === id, 'warzone: switching to by range keeps the same weapon open');
		const multi = page.locator('.ld-view:has(.lo-tabs)').first();
		if (await multi.count()) {
			await page.click('[data-ld-list=range] .ld-item[data-ld-open="' + await multi.getAttribute('data-ld-view') + '"]');
			const before = await page.locator('.ld-view:visible .lo-build:visible .lo-copy').getAttribute('data-copy');
			await page.locator('.ld-view:visible .lo-tabs button').nth(1).click();
			expect(await page.locator('.ld-view:visible .lo-build:visible').count() === 1 && await page.locator('.ld-view:visible .lo-build:visible .lo-copy').getAttribute('data-copy') !== before, 'warzone: build tabs switch the build');
		}
		await shot('warzone', true);
	}
	await go('roles/');
	expect(await page.locator('.role-deep').count() === 4, 'role guide: four roles');
	expect(await page.locator('.rg-mode').count() === 3, 'role guide: three modes');
	expect(await page.locator('.rg-sources ol li').count() >= 15, 'role guide: sources listed');
	const refTargets = await page.$$eval('.rg a[href^="#"]', (as) => as.map((x) => x.getAttribute('href').slice(1)).filter((id) => !document.getElementById(id)));
	expect(refTargets.length === 0, 'role guide: in-page links resolve ' + refTargets.join());
	await shot('roles-guide', true);

	await go('warzone/');
	await page.click('[data-seg] [data-tab=maps]');
	expect(await page.locator('.wz-map').first().isVisible(), 'warzone maps panel');
	await shot('warzone-maps', true);

	const NAMES = { hp: 'Hardpoint', snd: 'Search & Destroy', hj: 'Hijack' };
	for (const m of maps) {
		await go('maps/' + m.slug + '/');
		expect(await page.locator('.mw4-planner.is-ready').count() === 1, 'planner ready');
		expect(await page.locator('[data-tab=roles], [data-pane=roles]').count() === 0, 'planner has no roles tab');
		expect(await page.locator('.pl-tabs [data-tab]').count() === 2, 'planner tabs are Intel and Plan');
		expect(await page.locator('.pl-title').innerText() === m.name, 'planner title');
		expect(await page.evaluate(() => { const i = document.getElementById('pl-img'); return !!i && i.naturalWidth > 0; }), 'map image loaded');
		const btns = await page.$$eval('.pl-modes [data-mode]', (bs) => bs.map((b) => b.getAttribute('data-mode')));
		expect(btns.join() === m.modes.join(), 'mode buttons ' + btns.join() + ' vs ' + m.modes.join());
		for (const mode of m.modes) {
			await page.click('.pl-modes [data-mode=' + mode + ']');
			const nSteps = mode === 'hp' ? m.hp.hills.length : 2;
			expect(await page.locator('.pl-steps [data-step]').count() === nSteps + 1, mode + ' step bar has All + ' + nSteps + ' steps on ' + m.slug);
			expect(await page.locator('.pl-svg .co').count() > 0, mode + ' callouts drawn on ' + m.slug);
			expect((await page.locator('.pl-badge span').innerText()).toLowerCase() === NAMES[mode].toLowerCase(), 'badge for ' + mode);
			expect(await page.locator('.mk-hill').count() === (mode === 'hp' ? m.hp.hills.length : 0), mode + ' hill markers');
			expect(await page.locator('.mk-site').count() === (mode === 'snd' ? 2 : 0), mode + ' site markers');
			expect(await page.locator('.mk-spawn').count() === (mode === 'hj' && m.hj ? m.hj.spawns.length : 0), mode + ' spawn markers');
			expect(await page.locator('.mk-comm').count() === (mode === 'hj' && m.hj ? (m.hj.commStations || []).length : 0), mode + ' comm station markers');
		}
	}
	for (const m of allMaps.filter((x) => !(x.modes && x.modes.length))) {
		const r = await ctx.request.get(base + 'maps/' + m.slug + '/');
		if (r.status() !== 404) problems.push('removed map still published: ' + m.slug);
	}
	await go('bomb-sites/');
	const sndCount = maps.filter((m) => m.modes.indexOf('snd') >= 0).length;
	expect(await page.locator('.bs-card').count() === sndCount, 'bomb-site cards');
	expect(await page.locator('.bs-pin.bs-a').count() === sndCount && await page.locator('.bs-pin.bs-b').count() === sndCount, 'bomb-site pins');
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
	await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
	await shot('bomb-sites-top');
	// Planner layers, steps, team callouts and the briefing view (own browser context so nothing leaks into My Plans).
	{
		const c3 = await browser.newContext({ viewport: { width: 1360, height: 860 } });
		const p3 = await c3.newPage();
		p3.on('pageerror', (e) => problems.push('planner script error: ' + e.message));
		const hpMap = maps.find((x) => x.modes.indexOf('hp') >= 0);
		const open = async (q) => { await p3.goto(base + 'maps/' + hpMap.slug + '/' + (q || ''), { waitUntil: 'networkidle' }); await p3.waitForSelector('.mw4-planner.is-ready'); };
		const ex3 = (ok, msg) => { if (!ok) problems.push('planner: ' + msg); };
		await open();
		ex3(await p3.locator('.pl-svg .is-ghost').count() === 0, 'no starter before a step is picked');
		await p3.click('.pl-steps [data-step="1"]');
		ex3(await p3.locator('.pl-svg .is-ghost').count() === 4, 'starter shows four players on P1');
		ex3(await p3.locator('.pl-svg .mk-sp[data-sp]').count() === 2, 'hold and break spawn zones on P1');
		ex3(await p3.locator('.pl-svg .mk-hill.is-dim').count() === hpMap.hp.hills.length - 2, 'other hills dimmed');
		for (const k of ['starter', 'spawns', 'callouts']) await p3.locator('.pl-toggle:has([data-layer=' + k + '])').click();
		ex3(await p3.locator('.pl-svg .is-ghost, .pl-svg .mk-sp, .pl-svg .co').count() === 0, 'starter, spawns and callouts switch off');
		await open();
		await p3.click('.pl-steps [data-step="1"]');
		ex3(await p3.locator('.pl-svg .is-ghost, .pl-svg .mk-sp, .pl-svg .co').count() === 0, 'layer switches are remembered');
		for (const k of ['starter', 'spawns', 'callouts']) await p3.locator('.pl-toggle:has([data-layer=' + k + '])').click();
		const nCo = await p3.locator('.pl-svg .co').count();
		await p3.click('.pl-tabs [data-tab=plan]');
		await p3.click('[data-copy-starter]');
		ex3(await p3.locator('.pl-svg .is-ghost').count() === 0 && await p3.locator('.pl-svg .it-icon[data-idx]').count() === 4, 'starter copied into the plan');
		await p3.click('.pl-steps [data-step="2"]');
		ex3(await p3.locator('.pl-svg .it-icon[data-idx]').count() === 0, 'P1 plan is hidden on P2');
		await p3.click('.pl-steps [data-step=""]');
		ex3(await p3.locator('.pl-svg .it-icon[data-idx]').count() === 4, 'All shows every step');
		await p3.click('[data-edit-layers]');
		const b3 = await p3.locator('#pl-stage').boundingBox();
		await p3.mouse.click(b3.x + b3.width * 0.5, b3.y + b3.height * 0.93);
		await p3.fill('.pl-pop-co input', 'Test Callout');
		await p3.keyboard.press('Enter');
		ex3(await p3.locator('.pl-svg .co').count() === nCo + 1, 'custom callout added');
		await p3.click('[data-edit-layers]');
		await open();
		ex3(await p3.locator('.pl-svg .co').count() === nCo + 1 && await p3.locator('.pl-svg .co-team').count() === 1, 'custom callout kept after reload');
		await p3.click('.pl-hud [data-brief]');
		ex3(await p3.locator('.mw4-planner.is-brief').count() === 1 && await p3.locator('.pl-brief').isVisible() && !(await p3.locator('.pl-panel').isVisible()), 'briefing view opens');
		await p3.click('[data-brief-next]');
		ex3((await p3.locator('.pl-brief-step .pl-num').innerText()) === 'P1' && await p3.locator('.pl-svg .it-icon').count() === 4, 'briefing steps to P1');
		ex3(/view=brief/.test(p3.url()), 'briefing view is in the address');
		await p3.click('[data-brief-exit]');
		ex3(await p3.locator('.mw4-planner.is-brief').count() === 0 && await p3.locator('.pl-panel').isVisible(), 'briefing view closes');
		// Toggling any layer must not move the planner: scroll the panel so the switches sit lower down, then flip each one.
		await p3.setViewportSize({ width: 1180, height: 620 });
		await open();
		const frame = () => p3.evaluate(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return JSON.stringify([r('mw4-planner'), r('pl-stage'), r('pl-panel'), document.getElementById('mw4-planner').scrollTop, scrollY]); });
		const frame0 = await frame();
		for (const k of await p3.$$eval('[data-layer]', (els) => els.map((e) => e.getAttribute('data-layer')))) {
			const lab = p3.locator('.pl-toggle:has([data-layer=' + k + '])');
			await lab.scrollIntoViewIfNeeded();
			for (let n = 0; n < 2; n++) { await lab.click(); await p3.waitForTimeout(120); ex3(await frame() === frame0, 'toggling "' + k + '" moved the planner'); }
		}
		await p3.keyboard.press('Tab'); await p3.keyboard.press('Tab');
		ex3(await frame() === frame0, 'keyboard focus moved the planner');
		await p3.setViewportSize({ width: 1360, height: 860 });
		// A team link replaces the callouts on the device that opens it.
		const pack = Buffer.from(JSON.stringify({ v: 1, m: hpMap.slug, cv: 2, c: [['Link Callout', 0.5, 0.5, 0]], sp: { 1: { own: [0.2, 0.2] } } })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		await open('#t=' + pack);
		ex3(await p3.locator('.pl-svg .co').count() === 1 && !/#t=/.test(p3.url()), 'team link loads its callouts');
		await open('?view=brief');
		ex3(await p3.locator('.mw4-planner.is-brief').count() === 1, 'briefing link opens straight into the briefing view');
		if (SHOTS) await p3.screenshot({ path: path.join(SHOTS, 'planner-brief.png') });
		await c3.close();
	}
	// Draw a route on the first map, check it persists and shows on My Plans.
	const m0 = maps[0];
	await go('maps/' + m0.slug + '/');
	await page.click('.pl-tabs [data-tab=plan]');
	await page.click('.pl-tools [data-tool=route]');
	const box = await page.locator('#pl-stage').boundingBox();
	await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
	await page.mouse.down();
	for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.3 + i * 0.03), box.y + box.height * (0.3 + i * 0.02));
	await page.mouse.up();
	await page.waitForTimeout(500);
	expect(await page.locator('.it-route').count() >= 1, 'route drawn');
	expect(await page.locator('[data-save]').count() === 0 && await page.locator('text=Sign in to save').count() === 0, 'no sign-in button');
	await shot('planner-plan');
	await go('maps/lotus/?mode=hj'); await shot('planner-hijack');
	await go('my-plans/');
	expect(await page.locator('.plan-row').count() === 1, 'plan listed on My Plans');
	const share = await page.locator('[data-copy]').first().getAttribute('data-copy');
	await shot('my-plans-with-plan');
	const ctx2 = await browser.newContext();
	const p2 = await ctx2.newPage();
	await p2.goto(share, { waitUntil: 'networkidle' });
	if (await p2.locator('.it-route').count() < 1) problems.push('share link did not load the plan');
	await ctx2.close();
	await go('this-page-does-not-exist/deeper/');
	expect(await page.locator('.notfound').count() === 1, '404 page');
	if (PREFIX || true) { const href = await page.locator('.notfound a').getAttribute('href'); const r = await ctx.request.get(new URL(href, base).href); if (r.status() !== 200) problems.push('404 home link broken: ' + href); }
	// Mobile layout
	const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const mp = await mob.newPage();
	await mp.goto(base, { waitUntil: 'networkidle' });
	await mp.click('.nav-toggle');
	if (!(await mp.locator('#mobile-nav').isVisible())) problems.push('mobile nav does not open');
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-home.png') });
	await mp.goto(base + 'maps/' + m0.slug + '/', { waitUntil: 'networkidle' });
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-planner.png') });
	await mp.goto(base + 'ranked-loadouts/', { waitUntil: 'networkidle' });
	if (await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push('loadout screen is wider than a phone');
	await mp.locator('[data-ld-list=gun] .ld-item').last().scrollIntoViewIfNeeded();
	await mp.locator('[data-ld-list=gun] .ld-item').last().tap();
	if (await mp.locator('.ld-view:visible').getAttribute('data-ld-view') !== await mp.locator('[data-ld-list=gun] .ld-item').last().getAttribute('data-ld-open')) problems.push('loadout list does not work on a phone');
	if (await mp.$$eval('.ld-view:not([hidden]) .ld-slot, .ld-view:not([hidden]) .ld-att', (ts) => ts.filter((t) => t.scrollWidth > t.clientWidth + 1).length)) problems.push('a slot overflows on a phone');
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-loadouts.png'), fullPage: true });
	await browser.close(); server.close();
	console.log('Checked ' + (12 + maps.length) + ' pages and ' + seen.size + ' internal links at ' + (PREFIX || '/'));
	console.log(problems.length ? 'PROBLEMS (' + problems.length + '):\n  ' + [...new Set(problems)].join('\n  ') : 'All checks passed.');
	process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
