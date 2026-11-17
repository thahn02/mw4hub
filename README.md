# MW4 Hub

Ranked game plans, pro loadouts and interactive maps for Modern Warfare 4. A static site: no server, no database.

## Layout

| Path | What it holds |
| --- | --- |
| `data/maps.json` | Maps: which modes each is played on, hardpoints, S&D sites, bomb spawn, bomb-site photos, official intel, sources |
| `data/loadouts.json` | Every build: ranked pro builds, ranked meta tiers, Warzone meta tiers |
| `data/warzone-maps.json` | Warzone map cards |
| `data/roster.json`, `data/roles.json` | Pro roster, the four roles and general coaching |
| `data/role-guide.json` | The in-depth role guide shown on the Roles page, with its sources |
| `data/map-extras.json` | Callout names, hill callouts and map notes per map (RankKD) |
| `tools/tacmap-official.json`, `tools/import-tacmap.js` | Official tac-map markers and the script that registers them onto the minimaps |
| `data/pages.json`, `data/site.json` | Page titles and intros, site name |
| `src/assets/` | Styles and scripts (`planner.js` is the map planner) |
| `src/images/` | Minimaps, map cover images, Warzone map images |
| `build.js` | Turns the data into the pages in `dist/` |

## Update content

Edit the JSON in `data/`, then:

```
node build.js            # builds dist/
node tools/check-site.js # opens every page in a headless browser and checks it
```

Pushing to `main` rebuilds and publishes the site through GitHub Pages (`.github/workflows/pages.yml`).

Coordinates in `maps.json` run 0 to 1 from the top-left corner of the minimap.

## Saved plans

Plans are kept in each visitor's browser and shared by link or exported image. There are no accounts yet.
