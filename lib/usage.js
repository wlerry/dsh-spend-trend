/**
 * Fold persisted session logs into 15-minute usage buckets carrying token
 * volume and CNY cost, then aggregate them into a day window.
 */
import { costOf, DEFAULT_MODEL } from './pricing.js'

const SLOT_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_CONCURRENCY = 4
const LIST_TTL_MS = 15_000

export const WINDOW_DAYS = 7

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

/** Local calendar date (YYYY-MM-DD) of one instant at a fixed UTC offset. */
function dayKeyAt(time, offsetMinutes) {
  return new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 10)
}

/** UTC instant (ms) of local midnight for a YYYY-MM-DD date at a fixed offset. */
function dayStartUtc(dateKey, offsetMinutes) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day) - offsetMinutes * 60_000
}

/**
 * Build a collector over the session-persistence seams.
 * @param store - `{ list, open }`: list stored sessions, open one for reading.
 */
export function createUsageCollector(store) {
  /** @type {Map<string, { revision: unknown, buckets: Map<number, object> }>} */
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
    // A pending session has no durable events yet, so it contributes nothing.
    if (entry.location === undefined && entry.formatStatus === undefined) return undefined

    const handle = await store.open(id)
    try {
      const slice = await handle.read(0, Number.MAX_SAFE_INTEGER)
      const buckets = new Map()
      let model = DEFAULT_MODEL
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

  /**
   * Refresh the fold for every listed session, re-reading only changed ones.
   * @param onError - receives a session id and its read failure.
   */
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

  /**
   * Sum every cached session into the last `windowDays` local days.
   * @param offsetMinutes - caller's UTC offset, minutes east of UTC.
   * @param now - Unix milliseconds.
   */
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
