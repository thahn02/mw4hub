# MW4 Hub: working notes for Claude

Static site for a small group of Modern Warfare 4 players. Live at https://thahn02.github.io/mw4hub/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`). The owner is not a developer: make changes end to end, then say plainly what changed.

## How it fits together

- `data/*.json` is all content. `build.js` (Node, no dependencies) renders it into `dist/`. Never edit `dist/`.
- `src/assets/` holds the styles and scripts. `planner.js` is the interactive map planner; it reads a JSON blob that `build.js` embeds in each map page.
- `src/images/` holds minimaps (`<slug>-map.webp`, square), cover images (`<slug>-hero.webp`, 16:9) and Warzone map images.
- Links are relative so the site works under any base path. Only `404.html` needs the base, passed as `BASE=/mw4hub/`.

## Before every push

```
node build.js && node tools/check-site.js
```

`check-site.js` opens every page in headless Chromium (Playwright) and exercises the planner, filters and share links. It must print "All checks passed."

## Updating content

- Loadouts are refreshed every day by a scheduled task that follows `tools/DAILY-LOADOUTS.md`. Read that file before touching any of this.
  - `data/loadouts.json` is Warzone only: one entry per weapon with `tier`, `sources_tier` (tier on wzstats.gg and warzoneloadout.games), `builds[{name, attachments[{slot, name}], source{label, url, date}, both?}]` and `verified`.
  - `data/classes.json` is competitive multiplayer: `builds[]` by gun (attachments carry `slot`, `name`, `type`), the shared `kit` (secondary, melee, tactical, lethal, field upgrade, perks), `roles` (which guns, builds and perk picks each of the four roles runs), `summary` and `updated`.
  - `data/rules.json` holds the two rule sets (`cdl` = CDL Competitive Settings, which Ranked follows; `cmg` = CMG MW4 Arena rules) and pro `ga` agreements. `build.js` checks every class against both (`buildLegality()`, `kitLegality()`) and exits with a list if one fails, so an illegal class cannot be published. `data/weapons.json` lists guns with their class and `battlePass` flag for the gun-check table.
  - Page layout: the Ranked Loadouts page is arranged like the in-game class editor, minus the operator (`loadoutScreen()` and `loadoutView()` in `build.js`, `.ld-*` and `.gun-pic` styles in `hub.css`, the `[data-ld]` block in `hub.js`). A numbered list on the left groups the same builds by gun or by role; the picked loadout shows a stacked column of slots (primary, secondary and melee pictured, then tactical, lethal, field upgrade, perks) with the large weapon picture, attachment list and perk write-ups beside it. Every view is rendered at build time; the open one is kept in the address (`#g-<buildId>` or `#r-<role>-<buildId>`). The styling is the site's own.
  - Weapon pictures: `data/gun-images.json` maps a weapon name to one of Activision's official launch-blog graphics (1920x1080) and a `crop` box that picks out the weapon. The pictures are shown by link from `imgs.callofduty.com`, not copied into the repo; `gunPic()` crops them with CSS and `hub.js` hides any that fail to load. A weapon with no entry simply shows no picture. Entries marked `checked` had their crop looked at in a browser; the rest use `defaultCrop`. `tools/check-site.js` never calls the image host: it serves a stand-in picture.
  - Perk write-ups: `effects` in `data/classes.json` is one plain sentence per perk on what it does (own wording, sources in `effectsSources`); the per-slot `note` says why it is picked.
  - Freshness: `MAX_AGE` in `build.js` (14 days for classes, 3 for Warzone) drops anything not re-checked. `TODAY=YYYY-MM-DD node build.js` pins the date. The page also hides loadouts in the browser when `data-checked` is older than `data-max-age`, so a stalled refresh never shows old builds as current.
- What changed: `data/changelog.json` (newest first, one entry per day with `items[{area, text}]`). The home page shows the newest five and warns in the browser if the newest is over two days old. The daily refresh writes an entry on every run; add one yourself for any change a player would notice.
- Warzone page: same class-screen layout as Ranked Loadouts (`warzoneScreen()`, `warzoneView()`), one view per weapon, listed by tier or by range; both lists open the same views. Pictures come from `data/gun-images.json` when the weapon has one.
- Match Night (`/match/`) and Squad (`/squad/`) are rendered in the browser by `src/assets/squad.js` from the JSON that `teamData()` in `build.js` embeds (roles, jobs per mode, each role's class, maps, callouts, tips). Player names are typed in by the visitor and kept in `localStorage` key `mw4hub:squad` (`{name, players[{n, r}]}`); they travel only inside a squad link (`#s=` payload) and must never be put in the repo. Match Night embeds the map's briefing (`../maps/<slug>/?mode=<mode>&view=brief`) in an iframe, so it shows the plan saved on that device; its state is `mw4hub:match` and `?map=&mode=`.
- Installable: `build.js` writes `manifest.webmanifest` and `sw.js`; icons are in `src/images/icons/` (drawn from the logo). The service worker is network-first and only reads its cache when offline, so it cannot serve a stale page to someone who is online. `hub.js` remembers the last map and mode in `mw4hub:last`; the home page offers it, and the installed app (start URL `?source=app`) goes straight there once per launch.
- Map pool: each map in `data/maps.json` has `modes` (`hp`, `snd`, `hj` for Hijack). A map with an empty `modes` list is kept in the data but not published. The pool follows the CDL 2027 Competitive Maps & Modes (checked 2026-11-17).
- Bomb-site photos: put the image in `src/images/bombsites/` and add `{ "file": "images/bombsites/<name>", "label": "A site" }` to that map's `snd.photos`. They show on the Bomb Sites page.
- Hijack: `hj.spawns` are official tac-map team spawns, `hj.spike` is an approximate start area, and `hj.commStations` are ESTIMATED zones (`estimated: true`, radius `r`) because no source had published Comm Station positions as of 2026-11-17. When a source appears, replace each with exact `x`,`y` and remove `r` and `estimated`; the planner then draws a plain confirmed marker.
- Maps: edit `data/maps.json`. Coordinates run 0 to 1 from the top-left of the minimap. `hp.hills[{n, name, x, y}]` in rotation order; `snd.sites[{id: A|B, x, y}]` plus `snd.bomb`; `intel.hp` and `intel.snd` are official routes and notes in the planner's item format.
- Roles: the Roles page is its own section, built by `rolesGuide()` in `build.js` from `data/role-guide.json` (in-depth guide: `roles.<key>` per role, `modes` with the jobs per mode, `shifts`, `assign`, `teamMistakes`, numbered `sources`; `src` arrays point at source numbers) plus `data/roles.json` (names, colours, one-line summaries used on the home page, and the per-mode `coaching` tips) and `data/roster.json`. Roles are deliberately NOT in the map planner: it has only Intel and Plan tabs. The planner keeps the four role colours for drawing each player's route. Hijack role advice is an early read (no pro playbook as of 2026-11-17); update it when CDL play settles.
- Planner layers (all switchable in the Intel tab; the three new switches are remembered per device in `localStorage` key `mw4hub:layers`):
  - Steps: a plan item may carry `st` (`"1"`..`"6"` for a hill, `atk`/`def` for S&D, `t1`/`t2` for the Hijack starting spawn). Items without `st` show on every step. The bar above the map picks the step; `[` and `]` move through them.
  - Callouts: defaults are built in `defaultCallouts()` in `build.js` from `official.pois` (tac-map area names) plus `data/map-extras.json` `hillCalls` (the short name for each hill, drawn just above it). `names` in that file are callouts whose position nobody published as data, so the planner offers them as suggestions to place. A team's edits live in `localStorage` key `mw4hub:<map>:team` (`callouts`, `spawns`) and travel by team link (`#t=` payload) or inside a plan link (`c`).
  - Spawns: `official.spawns` and `official.dom` in `data/maps.json` come from `tools/tacmap-official.json` via `node tools/import-tacmap.js` (affine fit on the shared hills; it prints the fit error per map). Per-hill HOLD and BREAK zones are ESTIMATES computed in `hillSpawns()` in `planner.js`; a team can drag them and the override is stored with the callouts. Replace the estimate with real data if a readable source appears (Scout Drop has pro hold and spawn data but disallows automated reading).
  - Starter setups: computed in `starterItems()` in `planner.js` from the hill, the spawn zones and the next hill (Hardpoint) or the Spike and Comm Stations (Hijack). They are a shape, not sourced positions, and say so in the UI. None for S&D.
  - Briefing view: `?view=brief` or the screen button on the map. Read-only, covers the page, steps through the plan.
- Always record where data came from (`source`, `sources`) and update `verified` when a build is re-checked.

## Not built, by the owner's choice

A live shared team board with accounts or cloud-saved plans. The owner was offered it on 2026-11-17 and chose to skip it, so do not sign up for a backend unless they ask again. (Their Chrome is signed into a work Google account; never create anything there.) Plans live in each visitor's browser (`localStorage` keys `mw4hub:<map>:<mode>`) and are shared by link (`#p=` payload) or exported image; team callouts go by team link (`#t=`), squads by squad link (`#s=`).
