/**
 * Host half of the spend-trend bundle.
 *
 * Folds every persisted session log into 15-minute buckets carrying both token
 * volume and its CNY cost under DeepSeek's peak/off-peak tariff, then serves a
 * 7-day window plus the current billing phase over an exact HTTP route.
 */

export const inject = ['webServer', 'sessionPersistence']

const SLOT_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 7
const MAX_CONCURRENCY = 4
const LIST_TTL_MS = 15_000
const MAX_OFFSET_MINUTES = 14 * 60
const BEIJING_OFFSET_MINUTES = 8 * 60

const ROUTE = '/plugin/dsh-spend-trend/daily'

/**
 * CNY per million tokens, `[off-peak, peak]`, published by DeepSeek.
 * Peak hours are Beijing time Monday to Friday 09:00-12:00 and 14:00-18:00;
 * every other hour, plus weekends, bills at the off-peak rate.
 */
const PRICING = {
  'deepseek-flash': { hit: [0.02, 0.04], miss: [1, 2], output: [4, 8] },
  'deepseek-v4-pro': { hit: [0.15, 0.3], miss: [4.5, 9], output: [13.5, 27] },
  '*': { hit: [0.02, 0.04], miss: [1, 2], output: [4, 8] },
}

/** Chinese statutory holidays removed from the peak schedule; add YYYY-MM-DD entries as needed. */
const HOLIDAYS = new Set()

function pad2(value) {
  return value < 10 ? `0${value}` : `${value}`
}

/** Local calendar date (YYYY-MM-DD) of one instant at a fixed UTC offset. */
function dayKeyAt(time, offsetMinutes) {
  return new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 10)
}

/** UTC instant (ms) of local midnight for a YYYY-MM-DD date at a fixed offset. */
function dayStartUtc(dateKey, offsetMinutes) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day) - offsetMinutes * 60_000
}

/** Beijing-time calendar fields for one instant. */
function beijingAt(time) {
  const shifted = new Date(time + BEIJING_OFFSET_MINUTES * 60_000)
  return {
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    date: shifted.toISOString().slice(0, 10),
  }
}

/** Billing phase of one instant: `peak` or `off`. */
function phaseAt(time) {
  const local = beijingAt(time)
  if (local.weekday === 0 || local.weekday === 6) return 'off'
  if (HOLIDAYS.has(local.date)) return 'off'
  const minutes = local.hour * 60 + local.minute
  const peak = (minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60)
  return peak ? 'peak' : 'off'
}

/** Next instant (ms, rounded to the next minute) whose phase differs from `time`'s. */
function nextTransition(time) {
  const start = Math.ceil(time / 60_000) * 60_000
  const current = phaseAt(start)
  for (let step = 1; step <= 3 * 24 * 60; step += 1) {
    const probe = start + step * 60_000
    if (phaseAt(probe) !== current) return probe
  }
  return start + DAY_MS
}

function priceOf(model) {
  return PRICING[model] ?? PRICING['*']
}

/** CNY cost of one provider usage report at the tariff of its own instant. */
function costOf(usage, model, time) {
  const price = priceOf(model)
  const tier = phaseAt(time) === 'peak' ? 1 : 0
  const miss = Number(usage.inputTokens) || 0
  const hit = (Number(usage.cacheReadTokens) || 0) + (Number(usage.cacheWriteTokens) || 0)
  const output = Number(usage.outputTokens) || 0
  return (miss * price.miss[tier] + hit * price.hit[tier] + output * price.output[tier]) / 1e6
}

function emptyTotals() {
  return { tokens: 0, cost: 0, input: 0, output: 0, cacheRead: 0, requests: 0 }
}

function addUsage(totals, usage, model, time) {
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const cacheRead = Number(usage.cacheReadTokens) || 0
  const total = Number(usage.totalTokens)
  totals.tokens += Number.isFinite(total) ? total : input + output
  totals.input += input
  totals.output += output
  totals.cacheRead += cacheRead
  totals.cost += costOf(usage, model, time)
  totals.requests += 1
}

/** Run `worker` over `items` with a bounded number of in-flight promises. */
async function mapLimit(items, limit, worker) {
  const results = []
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current])
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Fold persisted sessions into per-session 15-minute usage buckets, reusing a
 * session's fold while its stored revision is unchanged.
 * @param store - `{ list, open }` persistence seams.
 */
export function createUsageCollector(store) {
  const sessions = new Map()
  let listedAt = 0
  let listed = null

  async function listEntries() {
    const now = Date.now()
    if (listed !== null && now - listedAt < LIST_TTL_MS) return listed
    const entries = await store.list()
    listed = entries
    listedAt = now
    return entries
  }

  async function foldEntry(entry) {
    const id = entry.header?.id
    if (typeof id !== 'string') return undefined
    const revision = entry.revision
    const cached = sessions.get(id)
    if (cached !== undefined && revision !== undefined && cached.revision === revision) return cached
    if (entry.location === undefined && entry.formatStatus === undefined) return undefined

    const handle = await store.open(id)
    try {
      const slice = await handle.read(0, Number.MAX_SAFE_INTEGER)
      const buckets = new Map()
      let model = 'deepseek-flash'
      for (const event of slice?.events ?? []) {
        if (event?.type === 'request/header') {
          const configured = event.data?.header?.config?.model
          if (typeof configured === 'string' && configured !== '') model = configured
          continue
        }
        if (event?.type !== 'assistant/message') continue
        const usage = event.data?.usage
        if (usage === undefined || usage === null || typeof usage !== 'object') continue
        const time = Number(event.time)
        if (!Number.isFinite(time)) continue
        const slot = Math.floor(time / SLOT_MS)
        let totals = buckets.get(slot)
        if (totals === undefined) {
          totals = emptyTotals()
          buckets.set(slot, totals)
        }
        addUsage(totals, usage, model, time)
      }
      const folded = { revision, buckets }
      sessions.set(id, folded)
      return folded
    } finally {
      await handle.close()
    }
  }

  async function refresh(onError) {
    const entries = await listEntries()
    await mapLimit(entries, MAX_CONCURRENCY, async (entry) => {
      try {
        await foldEntry(entry)
      } catch (error) {
        onError?.(entry.header?.id, error)
      }
    })
    return sessions
  }

  /** Sum the buckets of every cached session into a 7-day window. */
  function window(offsetMinutes, now) {
    const today = dayKeyAt(now, offsetMinutes)
    const days = []
    for (let shift = WINDOW_DAYS - 1; shift >= 0; shift -= 1) {
      const start = dayStartUtc(today, offsetMinutes) - shift * DAY_MS
      const date = new Date(start + offsetMinutes * 60_000).toISOString().slice(0, 10)
      const totals = emptyTotals()
      const firstSlot = Math.round(start / SLOT_MS)
      for (const session of sessions.values()) {
        for (let slot = 0; slot < DAY_MS / SLOT_MS; slot += 1) {
          const bucket = session.buckets.get(firstSlot + slot)
          if (bucket === undefined) continue
          totals.tokens += bucket.tokens
          totals.cost += bucket.cost
          totals.input += bucket.input
          totals.output += bucket.output
          totals.cacheRead += bucket.cacheRead
          totals.requests += bucket.requests
        }
      }
      days.push({
        date,
        tokens: totals.tokens,
        cost: Math.round(totals.cost * 1e6) / 1e6,
        input: totals.input,
        output: totals.output,
        cacheRead: totals.cacheRead,
        requests: totals.requests,
      })
    }
    return { today, days }
  }

  return { refresh, window }
}

function clampOffset(value) {
  if (!Number.isFinite(value)) return undefined
  const rounded = Math.round(value)
  if (Math.abs(rounded) > MAX_OFFSET_MINUTES) return undefined
  return rounded
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/** Current phase, next switch, and the tariff rows the panel shows. */
export function phaseStatus(now, model = 'deepseek-flash') {
  const price = priceOf(model)
  return {
    kind: phaseAt(now),
    until: nextTransition(now),
    model,
    offPeak: { hit: price.hit[0], miss: price.miss[0], output: price.output[0] },
    peak: { hit: price.hit[1], miss: price.miss[1], output: price.output[1] },
  }
}

export function apply(ctx) {
  const collector = createUsageCollector({
    list: () => ctx.sessionPersistence.list(),
    open: (id) => ctx.sessionPersistence.open(id, 'read'),
  })

  async function respond(request) {
    let offset
    try {
      const url = new URL(request.url)
      offset = clampOffset(Number(url.searchParams.get('offset') ?? Number.NaN))
    } catch {
      offset = undefined
    }
    if (offset === undefined) offset = -new Date().getTimezoneOffset()

    try {
      await collector.refresh((id, error) => {
        ctx.logger?.warn?.(`spend-trend: could not read session ${String(id)}: ${String(error?.message ?? error)}`)
      })
      const now = Date.now()
      const { today, days } = collector.window(offset, now)
      return json(200, {
        ok: true,
        generatedAt: now,
        offsetMinutes: offset,
        today,
        days,
        phase: phaseStatus(now),
        currency: 'CNY',
      })
    } catch (error) {
      ctx.logger?.warn?.(`spend-trend: usage aggregation failed: ${String(error?.message ?? error)}`)
      return json(200, { ok: false, error: String(error?.message ?? error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    resource: respond,
  }))
}
