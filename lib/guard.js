/**
 * Balance guard: the last-resort stop that keeps a forgotten session from
 * draining the whole account.
 *
 * The client is the only place that can read the account balance, so it reports
 * the latest total here; the host keeps a single number and refuses tool calls
 * once that number drops below the configured threshold.
 *
 * This is deliberately *not* a budget planner. A budget stops work to save
 * money and leaves the task unfinished; the guard only steps in when the
 * account itself is running out.
 */

/** Defaults used when the user never opened the guard settings. */
export const DEFAULT_GUARD = Object.freeze({ enabled: false, threshold: 5, action: 'warn' })

/** `warn` only notifies; `stop` also refuses tool calls. */
export const GUARD_ACTIONS = Object.freeze(['warn', 'stop'])

/** The one tool that stays allowed while blocked, so the user can still answer. */
export const GUARD_WHITELIST = Object.freeze(['ask_user_question'])

const MAX_THRESHOLD = 1_000_000

/**
 * How long a balance report stays trustworthy. An old report means the page is
 * gone or asleep, so the guard fails open instead of locking the session.
 */
export const GUARD_STALE_MS = 10 * 60 * 1000

/**
 * Coerce a stored or posted guard setting into a safe shape.
 * @param input - partial settings from the client.
 */
export function normalizeGuard(input) {
  const enabled = input?.enabled === true
  const raw = Number(input?.threshold)
  const threshold = Number.isFinite(raw)
    ? Math.min(Math.max(raw, 0), MAX_THRESHOLD)
    : DEFAULT_GUARD.threshold
  const action = GUARD_ACTIONS.includes(input?.action) ? input.action : DEFAULT_GUARD.action
  return { enabled, threshold, action }
}

/**
 * Whether a tool call must be refused right now.
 * @param total - last reported balance, or null when unavailable.
 * @param guard - normalized settings.
 * @param toolName - the tool about to run.
 */
export function shouldBlock(total, guard, toolName) {
  if (guard?.enabled !== true || guard.action !== 'stop') return false
  if (guard.threshold <= 0) return false
  if (!Number.isFinite(total)) return false
  if (GUARD_WHITELIST.includes(toolName)) return false
  return total < guard.threshold
}

/**
 * Whether this report is the moment the balance dropped below the threshold.
 * Used to fire a single notification rather than one per poll.
 * @param previous - previously reported total, or null before the first read.
 * @param total - the new total.
 * @param guard - normalized settings.
 */
export function crossedBelow(previous, total, guard) {
  if (guard?.enabled !== true || guard.threshold <= 0) return false
  if (!Number.isFinite(total) || total >= guard.threshold) return false
  return Number.isFinite(previous) && previous >= guard.threshold
}

/**
 * Mutable holder shared by the HTTP routes and the tool hook.
 */
export function createGuardState() {
  let guard = { ...DEFAULT_GUARD }
  let total = null
  let checkedAt = 0

  return {
    /** Merge a settings update from the client. */
    configure(input) {
      guard = normalizeGuard({ ...guard, ...input })
    },
    /** Record the latest balance the page read. */
    report(value, at = Date.now()) {
      if (Number.isFinite(value)) {
        total = value
        checkedAt = at
      }
    },
    /** What the HTTP layer returns. */
    snapshot() {
      return { guard: { ...guard }, total, checkedAt }
    },
    /** Whether this tool call should be refused. A stale report never blocks. */
    blocking(toolName, now = Date.now()) {
      if (checkedAt === 0 || now - checkedAt > GUARD_STALE_MS) return false
      return shouldBlock(total, guard, toolName)
    },
  }
}
