# dsh-spend-trend

<img src="assets/icon-180.png" width="72" height="72" alt="dsh-spend-trend icon" align="right">

[English](README.en.md) | [中文](README.md)

A DeepSeek Harness sidebar plugin: **peak/off-peak billing phase, account balance and 7-day CNY spend**.

[![npm](https://img.shields.io/npm/v/@apecube/dsh-spend-trend)](https://www.npmjs.com/package/@apecube/dsh-spend-trend)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

One badge at the bottom of the sidebar, directly above the account entry:

- **Current billing phase**: `● Peak` / `● Off-peak` under DeepSeek's official time-of-day pricing, followed by a countdown to the next switch, with the **account balance** on the right.
- Click it to open a panel with a **7-day CNY spend bar chart**, the current model's rates, today's spend, total and daily average, the balance breakdown, and the peak/off-peak schedule.

## Screenshots

![Sidebar badge](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/01-badge.png)

![Expanded panel](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/02-panel.png)

## Platform support

Works on macOS, Windows and Linux: the plugin is plain JavaScript, the host half only uses cross-platform Node APIs (`fs`, `os`, `path`), and the browser half is an ordinary web component — no shell commands, native dependencies or platform checks. CI runs the suite on Ubuntu, Windows and macOS across Node 20/22/24.

## Billing model

DeepSeek has charged peak/off-peak time-of-day rates since 2026-08-17. Every call is priced at the tier in effect **when that call actually happened** — not per day, and not at the current instant:

| Model | Cache hit (off-peak/peak) | Cache miss (off-peak/peak) | Output (off-peak/peak) |
|---|---|---|---|
| deepseek-flash | ¥0.02 / ¥0.04 | ¥1 / ¥2 | ¥4 / ¥8 |
| deepseek-v4-pro | ¥0.15 / ¥0.30 | ¥4.5 / ¥9 | ¥13.5 / ¥27 |

Unit: CNY per million tokens ([official price list](https://api-docs.deepseek.com/quick_start/pricing/)).

- Peak: **Beijing time, Monday to Friday, 09:00–12:00 and 14:00–18:00**; every other hour, plus all of Saturday and Sunday, bills off-peak.
- Cost = uncached input × miss rate + (cache read + cache write) × hit rate + output × output rate, using the tier of that usage's own timestamp.
- Unknown models fall back to the deepseek-flash rates.
- **Chinese statutory holidays** are not built in; configure them through `$DSH_HOME/spend-trend-holidays.json` (see below).

## Statutory holidays

Under the official rules, Chinese statutory holidays bill off-peak all day. No holiday calendar is bundled by default (holiday shifts and repricing both change over time), so drop a file in place to keep the classification accurate:

```sh
# Path: $DSH_HOME/spend-trend-holidays.json (defaults to ~/.dsh/spend-trend-holidays.json)
["2026-10-01", "2026-10-02", "2026-10-03"]
```

A missing or malformed file means "no holidays"; it never blocks startup.

## Data sources

- **Spend**: the host reads the persisted session logs, takes the model-reported `usage` from `assistant/message`, prices each event at its own tier, and folds the result into 15-minute buckets over a 7-day window.
- **Balance**: reuses the account plugin's `account.getBalance` remote call (topped-up plus granted balance).

## Refresh model

| Content | Mechanism | Frequency |
|---|---|---|
| Spend and current tier | Polls `GET /plugin/dsh-spend-trend/daily` | Every 60 seconds |
| Balance | Remote `account.getBalance` | Every 180 seconds |
| Countdown | Local timer only | Every second, no request |

A backgrounded page makes no extra requests and refreshes once when it becomes visible again. When the countdown reaches zero (a tier switch), the plugin refetches immediately instead of waiting for the next 60-second poll.

## Files

| File | Role |
|---|---|
| `index.js` | Plugin entry: route wiring and holiday-file loading |
| `lib/pricing.js` | Rate table, peak/off-peak schedule, per-call pricing |
| `lib/usage.js` | Session-log aggregation |
| `client.js` | Browser half: the badge and popover in the `sidebar.footer.action` slot |
| `cordis.patch.yml` | Inserts the `spend-trend` plugin row |
| `locale/*.json` | Title and description shown by the plugin manager |
| `icon.svg` | Plugin-list icon (vector: royal blue tile, violet corner highlights, a wave, peak/valley dots) |
| `assets/icon-180.png` | 180×180 raster tile for the plugin market card |
| `assets/icon-source.png` | Original icon artwork (1254×1254, not shipped in the npm package) |
| `assets/screenshots/*.png` | Market detail-page screenshots |
| `screenshots.json` | Declares the screenshot order the market shows |

## Install / uninstall

From npm (restart `dsh web`, or refresh the desktop app):

```sh
dsh plugin --profile <profile> add @apecube/dsh-spend-trend
```

Straight from GitHub:

```sh
dsh plugin --profile <profile> add github:wlerry/dsh-spend-trend
```

On DSH Desktop you can also use the install entry under **Settings → Plugins**. To remove it:

```sh
dsh plugin --profile <profile> remove @apecube/dsh-spend-trend
```

While developing you can link a local directory: `dsh plugin --profile <profile> add link:/path/to/dsh-spend-trend`. Browser-half changes only load after reinstalling (or restarting).

## Development

```sh
node --test test/     # 11 cases: phase boundaries, weekends/holidays, tariff tiers, day-window folding, revision cache
```

Layering:

| File | Responsibility |
|---|---|
| `lib/pricing.js` | Rate table, Beijing-time phase schedule, per-call pricing (pure, no I/O) |
| `lib/usage.js` | Folds session logs into 15-minute buckets and a 7-day window |
| `index.js` | Plugin entry and route wiring |
| `client.js` | Browser bundle (hand-written, no build step) |
| `test/` | Unit tests for the pure functions and aggregation |

CI runs syntax checks, the test suite and a manifest check on Node 20, 22 and 24.

## Known limitations

- The rate table lives in `lib/pricing.js`; when DeepSeek reprices, update that file (display and billing share one constant).
- Only persisted session logs are counted; the last batch in a running process can lag by a few tens of milliseconds.
- The route listens on the loopback address only and is unauthenticated; it exposes aggregate numbers, never session content.
