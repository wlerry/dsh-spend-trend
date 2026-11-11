import test from 'node:test'
import assert from 'node:assert/strict'
import { createUsageCollector, WINDOW_DAYS } from '../lib/usage.js'

/** Unix ms of one Beijing wall-clock instant. */
const beijing = (year, month, day, hour, minute = 0) =>
  Date.UTC(year, month - 1, day, hour, minute) - 8 * 60 * 60 * 1000

function usage(input, output = 0, cacheRead = 0) {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: 0,
    totalTokens: input + output + cacheRead,
  }
}

function session(events, id = 's1') {
  return {
    header: { id, createdAt: events[0]?.time ?? 0 },
    revision: `r-${id}`,
    location: { kind: 'jsonl' },
    events,
  }
}

function storeOf(sessions) {
  const opened = []
  return {
    opened,
    list: async () => sessions.map(({ events, header, revision, location }) => ({ header, revision, location })),
    open: async (id) => {
      const found = sessions.find((item) => item.header.id === id)
      opened.push(id)
      return { read: async () => ({ events: found.events }), close: async () => {} }
    },
  }
}

test('a day window sums tokens and prices each call at its own instant', async () => {
  const events = [
    { type: 'request/header', time: beijing(2026, 11, 11, 9, 50), data: { header: { config: { model: 'deepseek-flash' } } } },
    { type: 'assistant/message', time: beijing(2026, 11, 11, 9, 55), data: { usage: usage(1_000_000) } },
    { type: 'request/header', time: beijing(2026, 11, 11, 13, 0), data: { header: { config: { model: 'deepseek-flash' } } } },
    { type: 'assistant/message', time: beijing(2026, 11, 11, 13, 5), data: { usage: usage(0, 1_000_000) } },
  ]
  const store = storeOf([session(events)])
  const collector = createUsageCollector(store)
  await collector.refresh()

  const { today, days } = collector.window(480, beijing(2026, 11, 11, 20, 0))
  assert.equal(today, '2026-11-11')
  assert.equal(days.length, WINDOW_DAYS)
  const last = days.at(-1)
  assert.equal(last.tokens, 2_000_000)
  assert.equal(last.requests, 2)
  // 1M miss tokens at peak (¥2) + 1M output tokens off-peak (¥4).
  assert.equal(last.cost, 6)
  assert.equal(days.slice(0, -1).reduce((sum, day) => sum + day.cost, 0), 0)
})

test('sessions keep their own model for pricing', async () => {
  const events = [
    { type: 'request/header', time: beijing(2026, 11, 11, 10, 0), data: { header: { config: { model: 'deepseek-v4-pro' } } } },
    { type: 'assistant/message', time: beijing(2026, 11, 11, 10, 1), data: { usage: usage(0, 1_000_000) } },
  ]
  const collector = createUsageCollector(storeOf([session(events)]))
  await collector.refresh()
  const { days } = collector.window(480, beijing(2026, 11, 11, 12, 0))
  assert.equal(days.at(-1).cost, 27) // pro output at peak
})

test('an unchanged revision is not re-read', async () => {
  const events = [
    { type: 'assistant/message', time: beijing(2026, 11, 11, 10, 0), data: { usage: usage(1000) } },
  ]
  const store = storeOf([session(events)])
  const collector = createUsageCollector(store)
  await collector.refresh()
  await collector.refresh()
  assert.deepEqual(store.opened, ['s1'])
})

test('a pending session without durable events contributes nothing', async () => {
  const pending = { header: { id: 'pending' }, revision: 'r-pending' }
  const store = {
    list: async () => [pending],
    open: async () => {
      throw new Error('should not open a pending session')
    },
  }
  const collector = createUsageCollector(store)
  await collector.refresh()
  const { days } = collector.window(480, beijing(2026, 11, 11, 12, 0))
  assert.equal(days.every((day) => day.tokens === 0), true)
})
