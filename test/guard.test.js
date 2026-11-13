import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createGuardState,
  crossedBelow,
  DEFAULT_GUARD,
  normalizeGuard,
  shouldBlock,
  GUARD_WHITELIST,
  GUARD_STALE_MS,
} from '../lib/guard.js'

test('settings are clamped to a usable shape', () => {
  assert.deepEqual(normalizeGuard(undefined), DEFAULT_GUARD)
  assert.deepEqual(normalizeGuard({ enabled: true, threshold: -5, action: 'nuke' }), {
    enabled: true,
    threshold: 0,
    action: 'warn',
  })
  assert.deepEqual(normalizeGuard({ enabled: 'yes', threshold: '3.5', action: 'stop' }), {
    enabled: false,
    threshold: 3.5,
    action: 'stop',
  })
  assert.equal(normalizeGuard({ threshold: Number.POSITIVE_INFINITY }).threshold, DEFAULT_GUARD.threshold)
})

test('only stop mode blocks, and only below the threshold', () => {
  const stop = { enabled: true, threshold: 5, action: 'stop' }
  assert.equal(shouldBlock(3, stop, 'bash'), true)
  assert.equal(shouldBlock(5, stop, 'bash'), false)
  assert.equal(shouldBlock(9, stop, 'bash'), false)
  assert.equal(shouldBlock(3, { ...stop, action: 'warn' }, 'bash'), false)
  assert.equal(shouldBlock(3, { ...stop, enabled: false }, 'bash'), false)
  assert.equal(shouldBlock(3, { ...stop, threshold: 0 }, 'bash'), false)
  assert.equal(shouldBlock(null, stop, 'bash'), false)
  assert.equal(shouldBlock(Number.NaN, stop, 'bash'), false)
})

test('the question tool is always allowed while blocked', () => {
  for (const tool of GUARD_WHITELIST) {
    assert.equal(shouldBlock(1, { enabled: true, threshold: 5, action: 'stop' }, tool), false)
  }
})

test('the notification fires only on the crossing read', () => {
  const guard = { enabled: true, threshold: 5, action: 'stop' }
  assert.equal(crossedBelow(null, 3, guard), false)
  assert.equal(crossedBelow(6, 3, guard), true)
  assert.equal(crossedBelow(3, 2, guard), false)
  assert.equal(crossedBelow(2, 9, guard), false)
  assert.equal(crossedBelow(6, 3, { ...guard, enabled: false }), false)
})

test('the shared state records reports and settings', () => {
  const state = createGuardState()
  assert.deepEqual(state.snapshot().guard, DEFAULT_GUARD)
  assert.equal(state.blocking('bash'), false)

  state.configure({ enabled: true, threshold: 5, action: 'stop' })
  state.report(3, 1000)
  assert.equal(state.blocking('bash', 1000), true)
  assert.equal(state.blocking('ask_user_question', 1000), false)

  const snapshot = state.snapshot()
  assert.equal(snapshot.total, 3)
  assert.equal(snapshot.checkedAt, 1000)

  state.report(8, 2000)
  assert.equal(state.blocking('bash', 2000), false)
})

test('a stale report never blocks, so a closed page cannot lock the session', () => {
  const state = createGuardState()
  state.configure({ enabled: true, threshold: 5, action: 'stop' })
  state.report(3, 1000)
  assert.equal(state.blocking('bash', 1000 + 1000), true)
  assert.equal(state.blocking('bash', 1000 + GUARD_STALE_MS + 1), false)

  const fresh = createGuardState()
  fresh.configure({ enabled: true, threshold: 5, action: 'stop' })
  assert.equal(fresh.blocking('bash'), false, 'a guard with no report must fail open')
})

test('turning the guard off resumes work immediately', () => {
  const state = createGuardState()
  state.configure({ enabled: true, threshold: 5, action: 'stop' })
  state.report(2, 1000)
  assert.equal(state.blocking('bash', 1000), true)

  state.configure({ enabled: false })
  assert.equal(state.blocking('bash', 1000), false, 'disabling must unblock without a top-up')

  state.configure({ enabled: true, threshold: 1 })
  assert.equal(state.blocking('bash', 1000), false, 'a threshold below the balance must not block either')
})
