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
- Always record where data came from (`source`, `sources`) and update `verified` when a build is re-checked.

## Not built yet

Accounts, cloud-saved plans and team boards. Plans live in each visitor's browser (`localStorage` keys `mw4hub:<map>:<mode>`) and are shared by link (`#p=` payload) or exported image.
