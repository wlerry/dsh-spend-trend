# Changelog

## 1.4.0 — 2026-11-13

- Added the **balance guard**: a threshold (default ¥5) that turns the badge amber and notifies once when the balance crosses it, and can optionally pause work by refusing tool calls (asking stays allowed) until the balance recovers.
- Crossing the threshold now plays a recorded voice warning (“余额预警，请关注账户”), replaced by a short tone during the quiet window.
- The balance row now carries a **Top up** link that opens the official recharge page.
- The host keeps the last reported balance behind a new `guard` route and evaluates it in a `tools/execute` hook; the guard fails open when no fresh report arrives for ten minutes, and the page re-reports every minute even when the value is unchanged. Ten new tests cover the thresholds, the crossing detection, staleness and the route (41 total).

## 1.3.3 — 2026-11-13

- Added the Bilibili demo link to both READMEs.

## 1.3.2 — 2026-11-13

- Removed the hint under the sound picker that printed the host's absolute clips directory, so the panel no longer leaks a local path.

## 1.3.1 — 2026-11-13

- The switch alarm now also fires when a fresh poll shows the phase changed, not only when the one-second countdown reaches zero. This covers a poll landing exactly on the boundary before the tick, and a page that was asleep across the switch; a switch noticed more than ten minutes late is ignored instead of ringing mid-afternoon.
- The panel now asks for notification permission whenever it opens with the alarm already on (previously only the enable switch asked), and reports when notifications are off instead of silently skipping.
- Two tests cover the payload-based detection (33 total).

## 1.3.0 — 2026-11-11

- Added custom alarm sounds: an **Import audio** button opens the system file picker and copies the clip into `$DSH_HOME/spend-trend-sounds/`; files copied there by hand appear in the picker too, re-scanned whenever the panel opens.
- Imported clips can be removed again from the panel, which falls back to the default voice.
- The host lists, serves and deletes those clips through three routes, rejecting hidden files, path traversal, unknown extensions and files over 4 MB.
- Fixed the custom-clip route registering with a trailing slash, which the host's prefix matcher never matched — newly imported clips could not play.
- The switch alarm now resumes the audio context before playing and replays a blocked sound on the next click, so a page that sat untouched since load no longer misses the alarm silently.
- Fourteen new tests cover the directory rules, the routes and the custom-preset behaviour (31 total).

## 1.2.0 — 2026-11-11

- Added the phase alarm: a configurable sound when the billing phase flips, an optional two-minute heads-up, and a notification when permission is granted.
- Three bundled voice presets (mature, cute and stop-slacking), served by the host from `assets/sounds/`, plus synthesised Ping, Chime and Bell tones.
- Entering off-peak plays the selected voice, entering peak uses Ping, and the quiet window 22:00–06:00 Beijing time downgrades the voice to Ping.
- Client rule helpers are exported through `__test` and covered by six new tests (17 total).

## 1.1.1 — 2026-11-11

- Moved the repository to `github.com/wlerry/dsh-spend-trend` and updated every reference: package metadata, the GitHub install command, and the README screenshots.
- CI now runs the suite on Ubuntu, Windows and macOS across Node 20, 22 and 24; the README documents platform support.

## 1.1.0 — 2026-11-11

- Split the host half into `lib/pricing.js` (tariff table, Beijing-time peak/off-peak schedule, per-call cost) and `lib/usage.js` (session-log folding and day window), leaving `index.js` as the route wiring.
- Added a Node test suite (`npm test`, 11 cases) covering phase boundaries, weekend and holiday handling, tariff tiers, day-window aggregation and the revision cache.
- Added GitHub Actions CI on Node 20, 22 and 24: syntax checks, tests and a manifest check.
- Added an optional holiday calendar at `$DSH_HOME/spend-trend-holidays.json` (array of `YYYY-MM-DD` Beijing dates) so statutory holidays bill off-peak, per the official pricing rules.
- Documented the tariff sources, the refresh model and the publishing steps.

## 1.0.1 — 2026-11-11

- Fixed the client bundle registering its factory under the pre-rename package id, which made the web boot fail with `import failed` after the package was renamed for publishing.

## 1.0.0 — 2026-11-11

- First release: sidebar badge with the current DeepSeek peak/off-peak billing phase, the countdown to the next switch, the account balance, and a 7-day CNY spend chart priced per call at the tariff of its own instant.
