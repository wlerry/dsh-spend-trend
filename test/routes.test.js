import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { apply } from '../index.js'

function registered() {
  const routes = []
  const handlers = []
  const ctx = {
    effect: (fn) => fn(),
    on: (event, fn) => { handlers.push({ event, fn }) },
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    sessionPersistence: {
      list: async () => [],
      open: async () => ({ read: async () => ({ events: [] }), close: async () => {} }),
    },
    logger: { warn() {} },
  }
  apply(ctx)
  return { routes, handlers }
}

function registeredRoutes() {
  return registered().routes
}

/** Drive a raw handler with a request body, returning status and payload. */
function callHandler(route, { method, body, headers = {} } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)])
  req.method = method
  req.headers = headers
  return new Promise((resolve) => {
    const res = {
      code: 0,
      writeHead(code) { this.code = code },
      end(payload) { resolve({ code: this.code, body: String(payload ?? '') }) },
    }
    route.handler(req, res)
  })
}

test('the host registers the daily, listing, import and sound routes', () => {
  const routes = registeredRoutes()
  const paths = routes.map((route) => route.path)
  assert.ok(paths.includes('/plugin/dsh-spend-trend/daily'))
  assert.ok(paths.includes('/plugin/dsh-spend-trend/sounds'))
  assert.ok(paths.includes('/plugin/dsh-spend-trend/sounds/import'))
  assert.ok(paths.includes('/plugin/dsh-spend-trend/sound/valley-mature.m4a'))
})

test('the custom sound prefix has no trailing slash, or the host never matches it', () => {
  const prefix = registeredRoutes()
    .find((route) => route.kind === 'prefix' && route.path.startsWith('/plugin/dsh-spend-trend/sound/custom'))
  assert.ok(prefix !== undefined, 'custom sound prefix is missing')
  // The host matches a prefix with `pathname === prefix || pathname.startsWith(`${prefix}/`)`,
  // so a trailing slash in the registered path would never match a file request.
  assert.equal(prefix.path.endsWith('/'), false)
  assert.ok('/plugin/dsh-spend-trend/sound/custom/audio.wav'.startsWith(`${prefix.path}/`))
})

test('the delete prefix is registered without a trailing slash', () => {
  const prefix = registeredRoutes()
    .find((route) => route.kind === 'prefix' && route.path === '/plugin/dsh-spend-trend/sounds')
  assert.ok(prefix !== undefined, 'sounds prefix is missing')
  assert.equal(prefix.path.endsWith('/'), false)
  assert.ok('/plugin/dsh-spend-trend/sounds/audio.wav'.startsWith(`${prefix.path}/`))
})

test('the guard route records a balance and blocks tools below the threshold', async () => {
  const { routes, handlers } = registered()
  const route = routes.find((item) => item.kind === 'exact' && item.path === '/plugin/dsh-spend-trend/guard')
  assert.ok(route !== undefined, 'guard route is missing')

  const posted = await callHandler(route, {
    method: 'POST',
    headers: { 'x-spend-trend': '1' },
    body: JSON.stringify({ enabled: true, threshold: 5, action: 'stop', total: 3 }),
  })
  assert.equal(posted.code, 200)
  const state = JSON.parse(posted.body)
  assert.equal(state.total, 3)
  assert.equal(state.guard.action, 'stop')

  const read = await callHandler(route, { method: 'GET' })
  assert.equal(read.code, 200)
  assert.equal(JSON.parse(read.body).total, 3)

  const hook = handlers.find((entry) => entry.event === 'tools/execute')
  assert.ok(hook !== undefined, 'tools/execute hook is missing')
  let ran = false
  await assert.rejects(
    async () => hook.fn({ name: 'bash' }, async () => { ran = true }),
    /余额不足/,
  )
  assert.equal(ran, false, 'the tool must not run while blocked')

  await hook.fn({ name: 'ask_user_question' }, async () => { ran = true })
  assert.equal(ran, true, 'the question tool must stay available')
})

test('the guard route rejects unauthenticated writes', async () => {
  const { routes } = registered()
  const route = routes.find((item) => item.kind === 'exact' && item.path === '/plugin/dsh-spend-trend/guard')
  const response = await callHandler(route, {
    method: 'POST',
    body: JSON.stringify({ enabled: true, threshold: 5, action: 'stop', total: 0 }),
  })
  assert.equal(response.code, 403)
})
