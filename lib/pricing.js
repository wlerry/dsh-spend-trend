/**
 * DeepSeek peak/off-peak tariff: the published CNY rates, the Beijing-time
 * phase schedule, and the per-call cost of one provider usage report.
 *
 * Rates are CNY per million tokens, `[off-peak, peak]`. DeepSeek bills peak
 * hours as Beijing time Monday to Friday 09:00-12:00 and 14:00-18:00; every
 * other hour, weekends, and Chinese statutory holidays bill off-peak.
 */

/** CNY per million tokens, `[off-peak, peak]`. Update here when DeepSeek reprices. */
export const PRICING = {
  'deepseek-flash': { hit: [0.02, 0.04], miss: [1, 2], output: [4, 8] },
  'deepseek-v4-pro': { hit: [0.15, 0.3], miss: [4.5, 9], output: [13.5, 27] },
  '*': { hit: [0.02, 0.04], miss: [1, 2], output: [4, 8] },
}

/** Fallback model id when a session names none. */
export const DEFAULT_MODEL = 'deepseek-flash'

const BEIJING_OFFSET_MINUTES = 8 * 60
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD entries that bill off-peak all day (Chinese statutory holidays). */
const holidays = new Set()

/**
 * Replace the holiday calendar.
 * @param dates - YYYY-MM-DD Beijing dates treated as off-peak all day.
 */
export function setHolidays(dates) {
  holidays.clear()
  for (const date of dates ?? []) {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) holidays.add(date)
  }
}

/** Beijing-time calendar fields for one instant. */
export function beijingAt(time) {
  const shifted = new Date(time + BEIJING_OFFSET_MINUTES * MINUTE_MS)
  return {
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    date: shifted.toISOString().slice(0, 10),
  }
}

/**
 * Billing phase of one instant.
 * @param time - Unix milliseconds.
 * @returns `peak` or `off`.
 */
export function phaseAt(time) {
  const local = beijingAt(time)
  if (local.weekday === 0 || local.weekday === 6) return 'off'
  if (holidays.has(local.date)) return 'off'
  const minutes = local.hour * 60 + local.minute
  const peak = (minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60)
  return peak ? 'peak' : 'off'
}

/**
 * First instant whose phase differs, rounded up to the next minute.
 * @param time - Unix milliseconds.
 */
export function nextTransition(time) {
  const start = Math.ceil(time / MINUTE_MS) * MINUTE_MS
  const current = phaseAt(start)
  for (let step = 1; step <= 3 * 24 * 60; step += 1) {
    const probe = start + step * MINUTE_MS
    if (phaseAt(probe) !== current) return probe
  }
  return start + DAY_MS
}

/** Tariff row for one model id, falling back to the `*` row. */
export function priceOf(model, pricing = PRICING) {
  return pricing[model] ?? pricing['*']
}

/**
 * CNY cost of one provider usage report at the tariff of its own instant.
 * @param usage - provider usage block (`inputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`).
 * @param model - model id named by the request header in effect.
 * @param time - Unix milliseconds of the usage report.
 * @param pricing - tariff table; defaults to {@link PRICING}.
 * @returns cost in CNY.
 */
export function costOf(usage, model, time, pricing = PRICING) {
  const price = priceOf(model, pricing)
  const tier = phaseAt(time) === 'peak' ? 1 : 0
  const miss = Number(usage?.inputTokens) || 0
  const hit = (Number(usage?.cacheReadTokens) || 0) + (Number(usage?.cacheWriteTokens) || 0)
  const output = Number(usage?.outputTokens) || 0
  return (miss * price.miss[tier] + hit * price.hit[tier] + output * price.output[tier]) / 1e6
}

/**
 * Current phase, the next switch, and the tariff rows a panel shows.
 * @param now - Unix milliseconds.
 * @param model - model id to price.
 */
export function phaseStatus(now, model = DEFAULT_MODEL) {
  const price = priceOf(model)
  return {
    kind: phaseAt(now),
    until: nextTransition(now),
    model,
    offPeak: { hit: price.hit[0], miss: price.miss[0], output: price.output[0] },
    peak: { hit: price.hit[1], miss: price.miss[1], output: price.output[1] },
  }
}
