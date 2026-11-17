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

- Loadouts: edit `data/loadouts.json`. Fields: `game` (`ranked` or `warzone`), `kind` (`pro` or `meta`), `weapon`, `class`, `tier` (S to D), `category`, `players`, `team`, `builds[{name, attachments[{slot, name}]}]`, `source{label, url}`, `sources_tier` (tier per tracker, Warzone), `verified` (YYYY-MM-DD). Order in the file is display order within a tier.
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

## Not built yet

Accounts, cloud-saved plans and a live shared team board (the owner has approved building it; it needs a free backend and a sign-in from them). Plans live in each visitor's browser (`localStorage` keys `mw4hub:<map>:<mode>`) and are shared by link (`#p=` payload) or exported image.
