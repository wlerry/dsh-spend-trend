import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

function registeredRoutes() {
  const routes = []
  const ctx = {
    effect: (fn) => fn(),
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    sessionPersistence: {
      list: async () => [],
      open: async () => ({ read: async () => ({ events: [] }), close: async () => {} }),
    },
    logger: { warn() {} },
  }
  apply(ctx)
  return routes
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
