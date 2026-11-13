# Changelog

## 1.4.0 — 2026-11-13

- Added the **balance guard**: a threshold (default ¥5) that watches the account and either warns or pauses work by refusing tool calls (`ask_user_question` stays allowed) until the balance recovers. It also fires when the threshold is raised above the current balance, not only on the moment the balance drops.
- The guard speaks a recorded clip (“余额预警，请关注账户”) with a **Voice alert** switch (on by default); the quiet window replaces the voice with a short tone.
- After a top-up the balance refreshes on its own — closing the in-app top-up page, the window regaining focus, or the once-a-minute poll — so no manual re-check is needed.
- The balance row carries a **Top up** button that opens the official recharge page inside the desktop window, falling back to the browser when the desktop bridge is unavailable.
- Redesigned the panel around one headline number: rates and schedule folded behind a disclosure, the chart gets a baseline and a highlighted today bar, and the card picks up a sapphire-to-violet gradient.
- Fixed the warning voice silently doing nothing because `createAudio()` never exposed `voice`; the panel no longer unmounts when a reminder throws.
- Guard state lives behind a `guard` route and a `tools/execute` hook that fails open after ten minutes without a fresh balance report. Sixteen new tests cover thresholds, staleness, the routes and the panel helpers (44 total).

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
