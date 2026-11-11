import test from 'node:test'
import assert from 'node:assert/strict'
import { phaseAt, nextTransition, costOf, priceOf, phaseStatus, setHolidays } from '../lib/pricing.js'

/** Unix ms of one Beijing wall-clock instant. */
const beijing = (year, month, day, hour, minute = 0) =>
  Date.UTC(year, month - 1, day, hour, minute) - 8 * 60 * 60 * 1000

test('weekday peak windows follow Beijing time', () => {
  assert.equal(phaseAt(beijing(2026, 11, 11, 8, 59)), 'off')
  assert.equal(phaseAt(beijing(2026, 11, 11, 9, 0)), 'peak')
  assert.equal(phaseAt(beijing(2026, 11, 11, 11, 59)), 'peak')
  assert.equal(phaseAt(beijing(2026, 11, 11, 12, 0)), 'off')
  assert.equal(phaseAt(beijing(2026, 11, 11, 13, 59)), 'off')
  assert.equal(phaseAt(beijing(2026, 11, 11, 14, 0)), 'peak')
  assert.equal(phaseAt(beijing(2026, 11, 11, 17, 59)), 'peak')
  assert.equal(phaseAt(beijing(2026, 11, 11, 18, 0)), 'off')
  assert.equal(phaseAt(beijing(2026, 11, 11, 23, 30)), 'off')
})

test('weekends bill off-peak all day', () => {
  assert.equal(phaseAt(beijing(2026, 11, 14, 10, 0)), 'off')
  assert.equal(phaseAt(beijing(2026, 11, 15, 15, 0)), 'off')
})

test('holidays bill off-peak and can be cleared', () => {
  setHolidays(['2026-11-11'])
  assert.equal(phaseAt(beijing(2026, 11, 11, 10, 0)), 'off')
  setHolidays([])
  assert.equal(phaseAt(beijing(2026, 11, 11, 10, 0)), 'peak')
})

test('the next switch is the boundary that changes the phase', () => {
  assert.equal(nextTransition(beijing(2026, 11, 11, 10, 30)), beijing(2026, 11, 11, 12, 0))
  assert.equal(nextTransition(beijing(2026, 11, 11, 12, 30)), beijing(2026, 11, 11, 14, 0))
  assert.equal(nextTransition(beijing(2026, 11, 11, 18, 30)), beijing(2026, 11, 12, 9, 0))
  // Friday evening runs through the weekend to Monday 09:00.
  assert.equal(nextTransition(beijing(2026, 11, 13, 18, 5)), beijing(2026, 11, 16, 9, 0))
})

test('cost follows the tariff tier of each call instant', () => {
  const usage = { inputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
  assert.equal(costOf(usage, 'deepseek-flash', beijing(2026, 11, 11, 10, 0)), 2) // peak miss
  assert.equal(costOf(usage, 'deepseek-flash', beijing(2026, 11, 11, 13, 0)), 1) // off-peak miss

  const cached = { inputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, outputTokens: 0 }
  assert.equal(costOf(cached, 'deepseek-flash', beijing(2026, 11, 11, 10, 0)), 0.04)

  const output = { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 1_000_000 }
  assert.equal(costOf(output, 'deepseek-v4-pro', beijing(2026, 11, 11, 10, 0)), 27)
  assert.equal(costOf(output, 'deepseek-v4-pro', beijing(2026, 11, 11, 20, 0)), 13.5)
})

test('unknown models fall back to the wildcard tariff', () => {
  assert.deepEqual(priceOf('some-future-model'), priceOf('*'))
})

test('phaseStatus reports the tier and both rate rows', () => {
  const status = phaseStatus(beijing(2026, 11, 11, 10, 0), 'deepseek-flash')
  assert.equal(status.kind, 'peak')
  assert.equal(status.model, 'deepseek-flash')
  assert.deepEqual(status.peak, { hit: 0.04, miss: 2, output: 8 })
  assert.deepEqual(status.offPeak, { hit: 0.02, miss: 1, output: 4 })
  assert.equal(typeof status.until, 'number')
})
