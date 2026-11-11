import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

/** Load the browser bundle in a bare sandbox and grab its rule helpers. */
function loadRules() {
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  let definition
  const sandbox = {
    window: { __ModuleLoader__: { load: (loaded) => { definition = loaded } } },
    document: { addEventListener() {}, removeEventListener() {} },
    console,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)

  const React = {
    createElement() {},
    Fragment: Symbol('fragment'),
    useState() {},
    useEffect() {},
    useRef() {},
    useCallback: (fn) => fn,
  }
  const plugin = definition.factory(() => React)
  return plugin.__test
}

/** Unix ms of one Beijing wall-clock instant. */
const beijing = (year, month, day, hour, minute = 0) =>
  Date.UTC(year, month - 1, day, hour, minute) - 8 * 60 * 60 * 1000

const rules = loadRules()

test('the quiet window covers 22:00 to 06:00 Beijing time', () => {
  assert.equal(rules.isQuietHours(beijing(2026, 11, 11, 21, 59)), false)
  assert.equal(rules.isQuietHours(beijing(2026, 11, 11, 22, 0)), true)
  assert.equal(rules.isQuietHours(beijing(2026, 11, 12, 2, 30)), true)
  assert.equal(rules.isQuietHours(beijing(2026, 11, 12, 5, 59)), true)
  assert.equal(rules.isQuietHours(beijing(2026, 11, 12, 6, 0)), false)
})

test('entering off-peak plays the chosen voice in the daytime', () => {
  const noon = beijing(2026, 11, 11, 12, 30)
  assert.equal(rules.chooseSound('voice-mature', 'off', noon), 'voice-mature')
  assert.equal(rules.chooseSound('voice-cute', 'off', noon), 'voice-cute')
  assert.equal(rules.chooseSound('bell', 'off', noon), 'bell')
})

test('the quiet window downgrades a voice to the ping tone', () => {
  const night = beijing(2026, 11, 11, 23, 0)
  assert.equal(rules.chooseSound('voice-mature', 'off', night), 'ping')
  assert.equal(rules.chooseSound('voice-cute', 'off', night), 'ping')
  assert.equal(rules.chooseSound('bell', 'off', night), 'bell')
})

test('entering peak always uses the ping tone', () => {
  const noon = beijing(2026, 11, 11, 12, 30)
  assert.equal(rules.chooseSound('voice-mature', 'peak', noon), 'ping')
  assert.equal(rules.chooseSound('chime', 'peak', noon), 'ping')
})

test('custom clips follow the same rules as the bundled voices', () => {
  const noon = beijing(2026, 11, 11, 12, 30)
  const night = beijing(2026, 11, 11, 23, 0)
  assert.equal(rules.chooseSound('custom:我的提示音.mp3', 'off', noon), 'custom:我的提示音.mp3')
  assert.equal(rules.chooseSound('custom:我的提示音.mp3', 'off', night), 'ping')
  assert.equal(rules.chooseSound('custom:我的提示音.mp3', 'peak', noon), 'ping')
})

test('the silent preset plays nothing', () => {
  const noon = beijing(2026, 11, 11, 12, 30)
  assert.equal(rules.chooseSound('none', 'off', noon), null)
  assert.equal(rules.chooseSound('none', 'peak', noon), null)
})

test('every preset is unique and both voices are bundled', () => {
  const ids = rules.SOUNDS.map((sound) => sound.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...ids].slice(0, 2), ['voice-mature', 'voice-cute'])
  assert.equal(ids.includes('none'), true)
})
