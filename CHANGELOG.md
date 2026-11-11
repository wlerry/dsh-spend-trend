# Changelog

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
