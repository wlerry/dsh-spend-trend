/**
 * Host half of the spend-trend bundle.
 *
 * Serves the 7-day spend window (CNY, priced per call under DeepSeek's
 * peak/off-peak tariff) and the current billing phase over one exact HTTP
 * route that the browser badge polls.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { phaseStatus, setHolidays } from './lib/pricing.js'
import { createUsageCollector } from './lib/usage.js'

export const inject = ['webServer', 'sessionPersistence']

const ROUTE = '/plugin/dsh-spend-trend/daily'
const SOUND_ROUTE = '/plugin/dsh-spend-trend/sound'
const SOUND_DIR = new URL('./assets/sounds/', import.meta.url)
const MAX_OFFSET_MINUTES = 14 * 60

/** Bundled alarm clips, served one exact route each. */
const SOUND_FILES = ['valley-mature.m4a', 'valley-cute.m4a']

/**
 * Optional holiday calendar at `$DSH_HOME/spend-trend-holidays.json`, one
 * `YYYY-MM-DD` Beijing date per array entry. Absent means no exceptions.
 */
function holidaysPath() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'spend-trend-holidays.json')
}

function loadHolidays() {
  try {
    const parsed = JSON.parse(readFileSync(holidaysPath(), 'utf8'))
    if (Array.isArray(parsed)) setHolidays(parsed)
  } catch {
    /* absent or malformed file: no holiday exceptions */
  }
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

/** Serve one bundled voice clip, or 404 for anything else. */
function soundResource(file) {
  let cached = null
  return async () => {
    try {
      if (cached === null) cached = readFileSync(new URL(file, SOUND_DIR))
    } catch {
      return new Response('not found', { status: 404 })
    }
    return new Response(cached, {
      headers: {
        'content-type': 'audio/mp4',
        'cache-control': 'public, max-age=86400',
      },
    })
  }
}

export function apply(ctx) {
  loadHolidays()

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

  for (const file of SOUND_FILES) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: `${SOUND_ROUTE}/${file}`,
      resource: soundResource(file),
    }))
  }
}
