<p align="center">
  <img src="assets/icon-180.png" width="132" height="132" alt="Spend peak/off-peak chart">
</p>

<h1 align="center">Spend peak/off-peak chart · dsh-spend-trend</h1>

<p align="center"><b>Think during peak, do the heavy lifting off-peak — so every cent buys real work.</b></p>

<p align="center">
  <a href="README.md">中文</a> ·
  <a href="https://www.npmjs.com/package/@apecube/dsh-spend-trend"><img src="https://img.shields.io/npm/v/@apecube/dsh-spend-trend" alt="npm"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
</p>

## Why install it

- 💰 **Shifting work off-peak is the point**: the same generation costs half as much off-peak — output ¥8 → ¥4 per million tokens, cache hit ¥0.04 → ¥0.02. The badge turns “is it expensive right now, and how long until it isn't” into one line you can always see.
- ⏰ **The alarm exists to catch the cheap window**: when off-peak starts, a voice tells you to get going — that is the slot for long runs, batch generation and refactors, while peak is for lighter work (requirements, prompts, copy edits, review). Whether the voice is pleasant does not matter; **not doing heavy work at peak prices does**.
- 📊 **The bill at a glance**: account balance, today's spend, a 7-day bar chart and the current model's two-tier rates, one click away.
- 🪶 **Small and local**: plain JavaScript, no runtime dependencies, no outbound network — it only reads token usage from your local session logs.
- 🪟 **One row, no clutter**: fits a 13-inch screen; collapse the sidebar and only a dot and an amount remain, taking no working space.

## Install

**DSH Desktop**: open **Plugins → Add plugin**, enter

```
@apecube/dsh-spend-trend
```

then **Install**, **Enable now**, and refresh the page.

**Plain `dsh web` profile**:

```sh
dsh plugin --profile <profile> add @apecube/dsh-spend-trend
```

Straight from GitHub:

```sh
dsh plugin --profile <profile> add github:wlerry/dsh-spend-trend
```

Remove it with `dsh plugin --profile <profile> remove @apecube/dsh-spend-trend`.

## Screenshots

![Sidebar badge](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/01-badge.png)

![Expanded panel](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/02-panel.png)

## How to use it: the off-peak rhythm

| Window | Do this | Why |
|---|---|---|
| **Peak** (weekdays 09:00–12:00, 14:00–18:00) | Requirements, prompts, reading plans, copy edits, code review | Many turns, few tokens — the premium barely matters |
| **Off-peak** (all other hours + weekends) | Long runs, batch generation, refactors, long documents, multi-turn agents | Half the unit price, twice the work for the same budget |
| **Before bed** | Queue heavy jobs after midnight | The whole night is off-peak |

In one line: **think when it is expensive, work when it is cheap.**

## What it shows

One badge at the bottom of the sidebar, directly above the account entry:

- **Current billing phase**: `● Peak` / `● Off-peak`, followed by the countdown to the next switch, with the **account balance** on the right.
- Click it for a **7-day CNY spend bar chart**, the current model's rates, today's spend, total and daily average, the balance breakdown, and the peak/off-peak schedule.

## Phase alarm

The popover can notify you when the billing phase flips (off by default):

| Setting | Meaning |
|---|---|
| Enable | Master switch; asks for notification permission on first use and falls back to sound only when denied |
| Sound | Mature voice / Cute voice / Ping / Chime / Bell / Silent, with a preview button |
| 2-minute heads-up | Off by default; plays a light chime two minutes before the switch |

Rules: entering **off-peak** plays the selected voice, entering **peak** always uses Ping, and between **22:00 and 06:00 Beijing time** the voice is replaced by Ping. Settings live in browser `localStorage` (per device). The page must stay open for the alarm to fire; a sleeping machine stays silent and catches up once on wake.

## Billing model

DeepSeek has charged peak/off-peak time-of-day rates since 2026-08-17. Every call is priced at the tier in effect **when that call actually happened** — not per day, and not at the current instant:

| Model | Cache hit (off-peak/peak) | Cache miss (off-peak/peak) | Output (off-peak/peak) |
|---|---|---|---|
| deepseek-flash | ¥0.02 / ¥0.04 | ¥1 / ¥2 | ¥4 / ¥8 |
| deepseek-v4-pro | ¥0.15 / ¥0.30 | ¥4.5 / ¥9 | ¥13.5 / ¥27 |

Unit: CNY per million tokens ([official price list](https://api-docs.deepseek.com/quick_start/pricing/)).

- Peak: **Beijing time, Monday to Friday, 09:00–12:00 and 14:00–18:00**; every other hour, plus all weekend hours, bills off-peak.
- Cost = uncached input × miss rate + (cache read + cache write) × hit rate + output × output rate, using the tier of that usage's own timestamp.
- Unknown models fall back to the deepseek-flash rates.
- **Chinese statutory holidays** are not built in; configure them through `$DSH_HOME/spend-trend-holidays.json` (see below).

## Platform support

Works on macOS, Windows and Linux: the plugin is plain JavaScript, the host half only uses cross-platform Node APIs (`fs`, `os`, `path`), and the browser half is an ordinary web component — no shell commands, native dependencies or platform checks. CI runs the suite on Ubuntu, Windows and macOS across Node 20/22/24.

## Statutory holidays

Under the official rules, Chinese statutory holidays bill off-peak all day. No holiday calendar is bundled by default (holiday shifts and repricing both change over time), so drop a file in place to keep the classification accurate:

```sh
# Path: $DSH_HOME/spend-trend-holidays.json (defaults to ~/.dsh/spend-trend-holidays.json)
["2026-10-01", "2026-10-02", "2026-10-03"]
```

A missing or malformed file means “no holidays”; it never blocks startup.

## Data sources

- **Spend**: the host reads the persisted session logs, takes the model-reported `usage` from `assistant/message`, prices each event at its own tier, and folds the result into 15-minute buckets over a 7-day window.
- **Balance**: reuses the account plugin's `account.getBalance` remote call (topped-up plus granted balance).
- **Voices**: the two clips in `assets/sounds/` are served by a read-only host route and played locally; nothing is uploaded.

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
| `index.js` | Plugin entry: route wiring, holiday-file loading, voice routes |
| `lib/pricing.js` | Rate table, peak/off-peak schedule, per-call pricing |
| `lib/usage.js` | Session-log aggregation |
| `client.js` | Browser half: the badge, popover and alarm settings in the `sidebar.footer.action` slot |
| `cordis.patch.yml` | Inserts the `spend-trend` plugin row |
| `locale/*.json` | Title and description shown by the plugin manager |
| `icon.svg` | Plugin-list icon (vector) |
| `assets/icon-180.png` | 180×180 raster tile for the plugin market card |
| `assets/icon-source.png` | Original icon artwork (1254×1254, not shipped in the npm package) |
| `assets/screenshots/*.png` | Market detail-page screenshots |
| `assets/sounds/*.m4a` | Phase-alarm voices (mature / cute) |
| `screenshots.json` | Declares the screenshot order the market shows |

## Development

```sh
node --test test/     # 17 cases: phase boundaries, weekends/holidays, tariff tiers, day-window folding, revision cache, alarm rules
```

Layering:

| File | Responsibility |
|---|---|
| `lib/pricing.js` | Rate table, Beijing-time phase schedule, per-call pricing (pure, no I/O) |
| `lib/usage.js` | Folds session logs into 15-minute buckets and a 7-day window |
| `index.js` | Plugin entry and route wiring |
| `client.js` | Browser bundle (hand-written, no build step) |
| `test/` | Unit tests for the pure functions, aggregation and alarm rules |

CI runs syntax checks, the test suite and a manifest check on Ubuntu, Windows and macOS across Node 20/22/24.

## Known limitations

- The rate table lives in `lib/pricing.js`; when DeepSeek reprices, update that file (display and billing share one constant).
- Only persisted session logs are counted; the last batch in a running process can lag by a few tens of milliseconds.
- The route listens on the loopback address only and is unauthenticated; it exposes aggregate numbers, never session content.
- The alarm needs a live page: closing the DSH window silences it.
