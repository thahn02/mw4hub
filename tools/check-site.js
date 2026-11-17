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
	await shot('home', true);
	// Every internal link on every top page resolves.
	const seen = new Set();
	for (const p of ['', 'maps/', 'bomb-sites/', 'ranked-loadouts/', 'warzone/', 'roles/', 'my-plans/', 'credits/']) {
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
	expect(await page.locator('.ld-view:visible .ld-att').count() === 5 && await page.locator('.ld-view:visible .ld-kit').count() === 8, 'a loadout shows five attachments plus sidearm, melee, tactical, lethal, field upgrade and three perks');
	expect(await page.locator('.ld-view .cls-legal').count() === views && await page.locator('.ld-view .chip-ok').count() === views * 2, 'every loadout shows Ranked and CMG legal');
	expect(await page.locator('.lo-stale').count() === 0, 'loadouts are not flagged stale on a fresh build');
	const second = page.locator('[data-ld-list=gun] .ld-item').nth(1);
	const secondId = await second.getAttribute('data-ld-open');
	await second.click();
	expect(await page.locator('.ld-view:visible').getAttribute('data-ld-view') === secondId && page.url().endsWith('#' + secondId), 'picking a loadout opens it and puts it in the address');
	const tiles = await page.$$eval('.ld-view:not([hidden]) .ld-tile', (ts) => ts.filter((t) => t.scrollWidth > t.clientWidth + 1 || !t.querySelector('.ld-n').textContent.trim()).length);
	expect(tiles === 0, 'no slot tile is empty or overflowing');
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
	expect(await page.locator('[data-panel=meta] .lo-card').count() > 0 && await page.locator('.lo-stale').count() === 0, 'warzone builds listed and current');
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
		const pack = Buffer.from(JSON.stringify({ v: 1, m: hpMap.slug, c: [['Link Callout', 0.5, 0.5, 0]], sp: { 1: { own: [0.2, 0.2] } } })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
	if (await mp.$$eval('.ld-view:not([hidden]) .ld-tile', (ts) => ts.filter((t) => t.scrollWidth > t.clientWidth + 1).length)) problems.push('a slot tile overflows on a phone');
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-loadouts.png'), fullPage: true });
	await browser.close(); server.close();
	console.log('Checked ' + (10 + maps.length) + ' pages and ' + seen.size + ' internal links at ' + (PREFIX || '/'));
	console.log(problems.length ? 'PROBLEMS (' + problems.length + '):\n  ' + [...new Set(problems)].join('\n  ') : 'All checks passed.');
	process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
