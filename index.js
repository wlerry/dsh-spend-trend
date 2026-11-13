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
import { createGuardState } from './lib/guard.js'
import { phaseStatus, setHolidays } from './lib/pricing.js'
import { importSound, listSounds, MAX_SOUND_BYTES, removeSound, resolveSound, soundsDir } from './lib/sounds.js'
import { createUsageCollector } from './lib/usage.js'

export const inject = ['webServer', 'sessionPersistence', 'tools']

const ROUTE = '/plugin/dsh-spend-trend/daily'
const SOUND_ROUTE = '/plugin/dsh-spend-trend/sound'
const SOUND_LIST_ROUTE = '/plugin/dsh-spend-trend/sounds'
const CUSTOM_SOUND_ROUTE = '/plugin/dsh-spend-trend/sound/custom'
const SOUND_IMPORT_ROUTE = '/plugin/dsh-spend-trend/sounds/import'
const GUARD_ROUTE = '/plugin/dsh-spend-trend/guard'
const SOUND_DIR = new URL('./assets/sounds/', import.meta.url)
const MAX_OFFSET_MINUTES = 14 * 60

/** Bundled alarm clips, served one exact route each. */
const SOUND_FILES = ['valley-mature.m4a', 'valley-cute.m4a', 'valley-slack.m4a']

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

  const guard = createGuardState()

  // The page reads the account balance; it reports the total here so the host
  // can refuse tool calls once the account runs low.
  ctx.on?.('tools/execute', async (exec, next) => {
    if (!guard.blocking(exec?.name)) return next()
    const { guard: settings, total } = guard.snapshot()
    throw new Error(
      `余额不足（¥${Number(total).toFixed(2)} 低于 ¥${settings.threshold}），已暂停执行。` +
        '充值后打开「消耗峰谷图」面板点「重新检查」即可继续。',
    )
  })

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

  // One route, two verbs: GET returns the state, POST records the balance.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: GUARD_ROUTE,
    handler: (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        const body = JSON.stringify({ ok: true, ...guard.snapshot() })
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }
      if (req.method !== 'POST' || req.headers['x-spend-trend'] !== '1') {
        res.writeHead(403, { 'content-type': 'text/plain' })
        res.end('forbidden')
        return
      }
      const chunks = []
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > 4096) {
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          guard.configure(parsed)
          guard.report(parsed?.total)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ ok: true, ...guard.snapshot() }))
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
        }
      })
    },
  }))

  // The user's own clips: list them, and serve any one by file name.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SOUND_LIST_ROUTE,
    resource: async () => json(200, { ok: true, dir: soundsDir(), sounds: listSounds(soundsDir()) }),
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SOUND_IMPORT_ROUTE,
    handler: (req, res) => {
      // A custom header keeps cross-origin forms out: browsers must preflight it,
      // and this server sends no CORS headers.
      if (req.method !== 'POST' || req.headers['x-spend-trend'] !== '1') {
        res.writeHead(403, { 'content-type': 'text/plain' })
        res.end('forbidden')
        return
      }
      let name
      try {
        name = decodeURIComponent(String(req.headers['x-sound-name'] ?? ''))
      } catch {
        name = ''
      }
      const chunks = []
      let size = 0
      let tooLarge = false
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_SOUND_BYTES) {
          tooLarge = true
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        if (tooLarge) return
        try {
          const stored = importSound(soundsDir(), name, Buffer.concat(chunks))
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ ok: true, id: `custom:${stored.name}`, name: stored.name }))
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
        }
      })
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: SOUND_LIST_ROUTE,
    handler: (req, res) => {
      if (req.method !== 'DELETE' || req.headers['x-spend-trend'] !== '1') {
        res.writeHead(403, { 'content-type': 'text/plain' })
        res.end('forbidden')
        return
      }
      let name
      try {
        name = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname.slice(SOUND_LIST_ROUTE.length + 1))
      } catch {
        name = ''
      }
      try {
        const removed = removeSound(soundsDir(), name)
        res.writeHead(removed ? 200 : 404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(removed ? { ok: true, name } : { ok: false, error: 'not found' }))
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: CUSTOM_SOUND_ROUTE,
    resource: async (request) => {
      const url = new URL(request.url)
      let name
      try {
        name = decodeURIComponent(url.pathname.slice(CUSTOM_SOUND_ROUTE.length + 1))
      } catch {
        return new Response('not found', { status: 404 })
      }
      const resolved = resolveSound(soundsDir(), name)
      if (resolved === undefined) return new Response('not found', { status: 404 })
      try {
        const data = readFileSync(resolved.path)
        return new Response(data, {
          headers: {
            'content-type': resolved.type,
            'cache-control': 'public, max-age=3600',
          },
        })
      } catch {
        return new Response('not found', { status: 404 })
      }
    },
  }))

  for (const file of SOUND_FILES) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: `${SOUND_ROUTE}/${file}`,
      resource: soundResource(file),
    }))
  }
}
