# Daily loadout refresh: runbook

This is what the daily scheduled task does. The owner wants loadouts that are current every day and never out of date, multiplayer classes that come from what Call of Duty League pros are running, and every class legal under both the Ranked (CDL) rules and the Checkmate Gaming (CMG) rules. They do not want to do any of the work themselves.

Work through the steps in order. Change only `data/loadouts.json`, `data/classes.json`, `data/rules.json` and `data/weapons.json` unless something is broken.

## Ground rules

- **Only write what a source shows.** Never invent or guess an attachment, perk or tier. If a source gives the category but not the name ("long barrel"), record the `type` and leave `name` empty.
- **Dates are honest.** `verified` on a build is the date of the newest source that shows it in use, or today only when you re-read the source today. Do not bump a date you did not re-check. Old entries drop off the site on their own (`MAX_AGE` in `build.js`: 14 days for classes, 3 days for Warzone), and the page hides everything if it has not been refreshed, so leaving a date alone is always safe.
- **Rules are not negotiable.** `node build.js` refuses to build if a class breaks `data/rules.json`. Fix or remove the class. Never loosen a rule to make a class pass.
- Text you write for the site is short and plain, in your own words. Do not copy passages from a source.
- If a source cannot be read, skip it and say so in the commit message. Do not work around a blocked site.

## 1. Warzone (`data/loadouts.json`)

Sources, both re-read every day:

1. `https://warzoneloadout.games/warzone-meta`: tier (S, A, B, C), class, playstyle and attachments per weapon, plus its "last updated" time.
2. `https://wzstats.gg/`: the home page is the Warzone tier list (META, then A tier, in page order) with its "Updated" date. Each weapon's build is at `https://wzstats.gg/best-loadouts/<slug>-mw4`; the slugs already in use are in each build's `source.url`. Use the first Battle Royale build on that page.

For each weapon:

- `sources_tier`: the tier on each site (`wzstats`: `META` or `A`; `warzoneloadout`: `S`, `A`, `B` or `C`). Leave a site out if it does not list the weapon.
- `tier`: score wzstats META = 4, A = 3 and warzoneloadout S = 4, A = 3, B = 2, C = 1; average the scores you have. 3.5 or more is `S`, 2.5 or more `A`, 1.5 or more `B`, otherwise `C`.
- `builds`: one per site, each with its own `source` (`label`, `url`, `date`). If both sites give the same five attachments keep one build and set `"both": true`.
- `verified`: today, for every weapon you re-read today.
- Remove a weapon that neither site lists any more. Add new weapons the same way, and add them to `data/weapons.json` with their class (and `"battlePass": true` if they are unlocked through the Battle Pass, which matters for CMG).
- Keep the list ordered S, A, B, C, and inside a tier in the sites' own order.

## 2. Rules (`data/rules.json`)

- **CDL**: `https://callofdutyleague.com/en-us/competitive-settings`. The restricted lists are filled in by script, so a plain fetch usually returns only the page header. If browser tools are available in the session, open the page and read the RESTRICTED ITEMS section; otherwise search the news for a new settings version ("CDL competitive settings" plus the current month). The version is in `cdl.title`.
- **CMG**: `https://www.checkmategaming.com/cmg-arena/ladders/01a169a6-4c72-7a28-85a7-4e633f8baefc/rules`. Same problem: the sections are collapsed and need a browser. Without one, a web search for "CMG MW4 Arena Rules" shows the "Recent changes" lines in the result snippet, and `https://esportsagent.gg/rules/modern-warfare-4` carries a copy of the ban list. New dated lines go at the top of `cmg.changes`.
- **GAs** (gentlemen's agreements between pros): add each one you find to `ga.items` with its date, a source, and a `match` (`weapon` + `attachment` name) so the site can flag builds that use it.
- Set `checked` to today **only** if you re-read at least one of the two rule pages or found a dated report about them today. The page shows this date as "Rules read".
- After any rule change, run the build: it will list every class the change makes illegal.

## 3. Competitive classes (`data/classes.json`)

Look for what pros are running **now**. Search first, then read:

- Web searches (add the current month and year): `MW4 pro class setups`, `MW4 ranked class after GA`, `MW4 CDL class HAN 86`, `MW4 VEL 46 pro class`, `MW4 GA gentlemen's agreement`, `site:youtube.com MW4 pro class`, `site:tiktok.com MW4 pro class`.
- YouTube: creators often list every build in the video description or a pinned comment (BoomKid does). Fetch one video page at a time; several at once gets rate limited. If browser tools are available, the transcript panel has the full spoken breakdown. Channels that have been reliable: BoomKid, Apathy, Harrz, OpTic Gaming, and pros' own channels.
- TikTok: captions and upload dates are readable on hashtag pages (`https://www.tiktok.com/tag/mw4class`), but the videos themselves need a signed-in account. Use TikTok to learn that something changed, then confirm the build somewhere readable.
- `https://thecodlocker.com/classes.html`: pro builds captured from streams, with the attachment category for each slot.

Then:

- Add or update a build only when a source dated within the last 14 days names the attachments. Every build needs `id`, `weapon`, `class`, `label`, `kind` (`pro` or `creator`), `attachments` (`slot`, `name`, `type`), a one-line `note`, `verified` and `sources` (`label`, `url`, `kind`, `date`).
- `type` is the in-game category (Long Barrel, Light Barrel, Balanced Comp, Mini Reflex, Light Stock, High Velocity...). The CMG checks for silencers, magnified optics and banned ammunition read it, so always fill it in for muzzles, optics and ammunition. A 1x optic the checker does not know yet goes in `cmg.optics1x` in `rules.json`, and only if a source confirms it is a 1x sight.
- A build that pros have stopped using gets no new date. Let it age out, or remove it if a source says it is gone.
- If a build uses a gun that has no picture yet, add it to `data/gun-images.json` only if it is in that file's source article (use the same numbered graphic naming); otherwise leave it out and the page shows the name alone. If a perk appears that is not in `effects` in `data/classes.json`, add one plain sentence on what it does, in your own words, and note the source in `effectsSources`.
- `kit` is the rest of the class (secondary, melee, tactical, lethal, field upgrade, three perks). `roles` maps the four team roles to guns, builds (by `id`) and perk picks. Update both when the sources change, and keep every `roles.*.builds` id pointing at a build that exists.
- Set `updated` to today and rewrite `summary`: two or three plain sentences on what pros are running and what changed since yesterday. If nothing changed, say so.

## 4. Write what changed (`data/changelog.json`)

Every run adds one entry for today at the top of `entries`, even when nothing moved. The home page shows the newest entries and warns visitors when the newest one is more than two days old, so a missing entry looks like a stalled refresh.

- One item per real change, in plain words a player would use: a tier that moved, a build that changed, a new or dropped gun, a rule change, a pro agreement. Set `area` to `Loadouts`, `Warzone`, `Rules`, `Maps` or `Site`.
- If nothing changed, write a single item: `{ "area": "Loadouts", "text": "Re-checked. No changes." }`.
- If a source could not be read, say so in an item (for example "wzstats.gg could not be read today; Warzone tiers are from yesterday").
- If today already has an entry, add to it instead of making a second one. Keep the newest 30 entries.

## 5. Check and publish

```
node build.js && node tools/check-site.js
```

- `build.js` prints anything it hid as stale and stops with a list if a class breaks the rules.
- `check-site.js` must print `All checks passed.`
- Commit as `Daily loadout refresh YYYY-MM-DD: <what changed>` (list any source you could not read) and push to `main`. The site deploys itself.
- If the checks fail and you cannot fix the cause, do not push. Leave the site as it is: it hides stale loadouts on its own.

## 6. Report

End with three or four lines: what changed in Warzone, what changed in the competitive classes or rules, and anything you could not read today.
