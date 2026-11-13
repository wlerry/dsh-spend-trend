/**
 * Client half of the spend-trend bundle: a sidebar foot badge showing the live
 * DeepSeek billing phase (peak or off-peak), the countdown to the next switch,
 * and the account balance, plus a 7-day CNY spend chart in a popover.
 *
 * The popover also carries the switch alarm: an optional sound at the moment a
 * phase changes (voice when entering off-peak, a short ping when entering
 * peak), an optional two-minute heads-up, and a quiet window that replaces the
 * voice with a tone between 22:00 and 06:00 Beijing time.
 */
window.__ModuleLoader__.load({
  id: '@apecube/dsh-spend-trend',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ROUTE = '/plugin/dsh-spend-trend/daily'
    const SOUND_BASE = '/plugin/dsh-spend-trend/sound/'
    const CUSTOM_SOUND_BASE = '/plugin/dsh-spend-trend/sound/custom/'
    const BALANCE_WARNING_SOUND = 'balance-warning.m4a'
    const SOUND_LIST_ROUTE = '/plugin/dsh-spend-trend/sounds'
    const SOUND_IMPORT_ROUTE = '/plugin/dsh-spend-trend/sounds/import'
    const DAY_MS = 24 * 60 * 60 * 1000
    const DATA_REFRESH_MS = 60_000
    const BALANCE_REFRESH_MS = 60_000
    const ADVANCE_MS = 2 * 60 * 1000
    const SWITCH_DEDUPE_MS = 90_000
    const GLOBAL_CLAIMS = '__dshSpendTrendClaims'
    const STALE_SWITCH_MS = 10 * 60 * 1000
    const ALARM_KEY = 'dsh-spend-trend:alarm'
    const GUARD_KEY = 'dsh-spend-trend:guard'
    const GUARD_ROUTE = '/plugin/dsh-spend-trend/guard'
    const TOPUP_URL = 'https://platform.deepseek.com/top_up'
    const DEFAULT_GUARD = { enabled: false, threshold: 5, action: 'warn', voice: true }
    const QUIET_START_HOUR = 22
    const QUIET_END_HOUR = 6

    const TEXT = {
      zh: {
        peak: '峰期',
        off: '谷期',
        nextOff: '距谷时',
        nextPeak: '距峰时',
        toOff: '距谷',
        toPeak: '距峰',
        title: '消耗与计费时段',
        schedule: '高峰：周一至周五 09:00–12:00、14:00–18:00（北京时间），其余及周末为谷时',
        price: '当前单价',
        perMillion: '元/百万 tokens',
        cacheHit: '缓存命中',
        cacheMiss: '未命中',
        output: '输出',
        week: '近 7 天花费',
        total: '合计',
        average: '日均',
        today: '今天',
        balance: '余额',
        balanceNone: '余额不可用',
        loading: '读取中',
        empty: '近 7 天还没有消耗记录',
        close: '关闭',
        toppingUp: '充值',
        bonus: '赠送',
        alarmTitle: '峰谷切换提醒',
        alarmSwitch: '开启提醒',
        alarmSound: '提醒音',
        alarmPreview: '试听',
        alarmAdvance: '提前 2 分钟',
        alarmQuiet: '22:00–06:00 不播语音',
        alarmDenied: '通知被拒绝，只响铃；可在系统设置里允许',
        alarmPending: '通知未开启，点一下面板授权',
        guardTitle: '余额保护',
        guardSwitch: '开启',
        guardThreshold: '余额阈值（¥）',
        guardAction: '触发时',
        guardWarn: '只提醒',
        guardStop: '暂停执行',
        guardNote: '余额到达预设值暂停所有工作',
        guardVoice: '语音播报',
        guardVoiceFailed: '语音播放失败，请把这段错误发我',
        guardBarWarn: (total, threshold) => `余额 ${total} 已低于 ${threshold}，请注意充值`,
        guardBarStop: (total, threshold) => `余额 ${total} 已低于 ${threshold}，已暂停执行`,
        topup: '充值',
        topupBack: '返回 DeepSeek Harness',
        topupFailed: (reason) => `充值页没在应用内打开：${reason}`,
        guardNotifyTitle: '余额不足',
        guardNotifyBody: (total, threshold) => `余额 ${total} 低于 ${threshold}，请注意充值`, 
        guardNotifyStop: (total, threshold) => `余额 ${total} 低于 ${threshold}，已暂停执行`, 
        alarmPeak: '切到峰期',
        alarmOff: '切到谷期',
        notifyOffTitle: '已切换到谷期',
        notifyOffBody: '现在开始半价，可以干活了',
        notifyPeakTitle: '已切换到峰期',
        notifyPeakBody: '现在是高峰价，注意用量',
        notifyAdvanceTitle: '2 分钟后切换',
        notifyAdvanceOffBody: '即将进入谷期',
        notifyAdvancePeakBody: '即将进入峰期',
        soundVoiceMature: '御姐音',
        soundVoiceCute: '萝莉音',
        soundVoiceSlack: '别摸鱼了',
        soundPing: 'Ping',
        soundChime: 'Chime',
        soundBell: 'Bell',
        soundNone: '静音',
        alarmImport: '导入音频',
        alarmDelete: '删除',
        alarmImportFailed: '导入失败',
      },
      en: {
        peak: 'Peak',
        off: 'Off-peak',
        nextOff: 'to off-peak',
        nextPeak: 'to peak',
        toOff: 'to off-peak',
        toPeak: 'to peak',
        title: 'Spend and billing phase',
        schedule: 'Peak: Mon–Fri 09:00–12:00, 14:00–18:00 Beijing time; all other hours and weekends are off-peak',
        price: 'Current rate',
        perMillion: 'CNY / 1M tokens',
        cacheHit: 'Cache hit',
        cacheMiss: 'Cache miss',
        output: 'Output',
        week: 'Spend, last 7 days',
        total: 'Total',
        average: 'Avg',
        today: 'Today',
        balance: 'Balance',
        balanceNone: 'Balance unavailable',
        loading: 'Loading',
        empty: 'No usage recorded in the last 7 days',
        close: 'Close',
        toppingUp: 'Topped up',
        bonus: 'Granted',
        alarmTitle: 'Phase alarm',
        alarmSwitch: 'Enable',
        alarmSound: 'Sound',
        alarmPreview: 'Preview',
        alarmAdvance: '2-minute heads-up',
        alarmQuiet: 'No voice 22:00–06:00',
        alarmDenied: 'Notifications denied, sound only — allow them in system settings',
        alarmPending: 'Notifications off — click the panel to grant',
        guardTitle: 'Balance guard',
        guardSwitch: 'Enable',
        guardThreshold: 'Threshold (¥)',
        guardAction: 'When triggered',
        guardWarn: 'Warn only',
        guardStop: 'Pause work',
        guardNote: 'Pauses all work when the balance reaches the threshold.',
        guardVoice: 'Voice alert',
        guardVoiceFailed: 'The clip failed to play — please share this error',
        guardBarWarn: (total, threshold) => `Balance ${total} is below ${threshold} — consider topping up`,
        guardBarStop: (total, threshold) => `Balance ${total} is below ${threshold} — work is paused`,
        topup: 'Top up',
        topupBack: 'Back to DeepSeek Harness',
        topupFailed: (reason) => `The top-up page did not open in the app: ${reason}`,
        guardNotifyTitle: 'Low balance',
        guardNotifyBody: (total, threshold) => `Balance ${total} is below ${threshold} — consider topping up`,
        guardNotifyStop: (total, threshold) => `Balance ${total} is below ${threshold} — work is paused`,
        alarmPeak: 'Switch to peak',
        alarmOff: 'Switch to off-peak',
        notifyOffTitle: 'Off-peak started',
        notifyOffBody: 'Half price from now on — time to work',
        notifyPeakTitle: 'Peak started',
        notifyPeakBody: 'Peak rates are in effect — mind your usage',
        notifyAdvanceTitle: 'Switch in 2 minutes',
        notifyAdvanceOffBody: 'Off-peak is about to start',
        notifyAdvancePeakBody: 'Peak is about to start',
        soundVoiceMature: 'Mature voice',
        soundVoiceCute: 'Cute voice',
        soundVoiceSlack: 'Stop slacking',
        soundPing: 'Ping',
        soundChime: 'Chime',
        soundBell: 'Bell',
        soundNone: 'Silent',
        alarmImport: 'Import audio',
        alarmDelete: 'Delete',
        alarmImportFailed: 'Import failed',
      },
    }

    /** Alarm sounds, in menu order. `voice` presets are only used when entering off-peak. */
    const SOUNDS = [
      { id: 'voice-mature', kind: 'voice', file: 'valley-mature.m4a', labelKey: 'soundVoiceMature' },
      { id: 'voice-cute', kind: 'voice', file: 'valley-cute.m4a', labelKey: 'soundVoiceCute' },
      { id: 'voice-slack', kind: 'voice', file: 'valley-slack.m4a', labelKey: 'soundVoiceSlack' },
      { id: 'ping', kind: 'tone', labelKey: 'soundPing' },
      { id: 'chime', kind: 'tone', labelKey: 'soundChime' },
      { id: 'bell', kind: 'tone', labelKey: 'soundBell' },
      { id: 'none', kind: 'none', labelKey: 'soundNone' },
    ]

    const DEFAULT_ALARM = { enabled: false, sound: 'voice-mature', advance: false }

    const WEEKDAYS = {
      zh: ['日', '一', '二', '三', '四', '五', '六'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    }

    /** Beijing hour (0-23) of one instant. */
    function beijingHour(time) {
      return new Date(time + 8 * 60 * 60 * 1000).getUTCHours()
    }

    /** Whether the quiet window (22:00-06:00 Beijing) covers this instant. */
    function isQuietHours(time) {
      const hour = beijingHour(time)
      return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR
    }

    /**
     * Resolve the sound to play for one switch.
     * @param preset - the selected preset id.
     * @param nextPhase - the phase being entered (`off` or `peak`).
     * @param time - the instant of the switch.
     */
    function chooseSound(preset, nextPhase, time) {
      if (preset === 'none') return null
      const entry = SOUNDS.find((sound) => sound.id === preset)
      const custom = preset.startsWith('custom:')
      // Peak entry always uses a short tone: the voice line is about off-peak.
      if (nextPhase !== 'off') return 'ping'
      if (entry === undefined && !custom) return 'ping'
      const isVoice = custom || entry?.kind === 'voice'
      if (isVoice && isQuietHours(time)) return 'ping'
      return preset
    }

    /**
     * Whether a freshly polled phase means a switch we have not announced yet.
     * @param previous - last payload's `{ kind, until }`, or null before the first payload.
     * @param phase - the new payload's phase.
     * @param now - current time in ms.
     * @param enabled - whether the alarm is on.
     */
    function detectsSwitch(previous, phase, now, enabled) {
      if (!enabled || previous === null || previous === undefined) return false
      if (previous.kind === phase.kind) return false
      return now - previous.until <= STALE_SWITCH_MS
    }

    /**
     * Claim one reminder per page, not per component. A hot reload can leave a
     * second badge mounted; without this both would notify for the same boundary.
     * @param key - boundary identity, e.g. `advance:1794547200000`.
     */
    function claimOnce(key) {
      const store = globalThis[GLOBAL_CLAIMS] ?? (globalThis[GLOBAL_CLAIMS] = new Set())
      if (store.has(key)) return false
      store.add(key)
      if (store.size > 50) store.delete(store.values().next().value)
      return true
    }

    /**
     * Keep only digits and a single decimal point, at most two decimals and
     * nine characters overall, so a stray paste cannot produce garbage.
     * @param raw - whatever the user typed or pasted.
     */
    function sanitizeMoney(raw) {
      let out = ''
      let dot = false
      for (const char of String(raw ?? '')) {
        if (char >= '0' && char <= '9') out += char
        else if (char === '.' && !dot) {
          out += char
          dot = true
        }
        if (out.length >= 9) break
      }
      if (out.startsWith('.')) out = `0${out}`
      const [whole, fraction] = out.split('.')
      if (fraction !== undefined && fraction.length > 2) return `${whole}.${fraction.slice(0, 2)}`
      return out
    }

    function pickLocale(ctx) {
      try {
        const active = String(ctx.locale?.getSnapshot?.().active ?? '')
        if (active !== '') return active.toLowerCase().startsWith('zh') ? 'zh' : 'en'
      } catch {
        /* locale is optional */
      }
      const fallback = String(globalThis.navigator?.language ?? 'zh')
      return fallback.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    async function readCustomSounds() {
      try {
        const response = await fetch(SOUND_LIST_ROUTE, {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) return { dir: '', sounds: [], loaded: true }
        const payload = await response.json()
        return {
          dir: typeof payload?.dir === 'string' ? payload.dir : '',
          sounds: Array.isArray(payload?.sounds) ? payload.sounds : [],
          loaded: true,
        }
      } catch {
        return { dir: '', sounds: [], loaded: true }
      }
    }

    /** Upload one picked file into the user's sound directory. */
    async function uploadSound(file) {
      const response = await fetch(SOUND_IMPORT_ROUTE, {
        method: 'POST',
        headers: {
          'x-spend-trend': '1',
          'x-sound-name': encodeURIComponent(file.name),
          'content-type': 'application/octet-stream',
        },
        body: file,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? `import failed (${response.status})`)
      }
      return payload
    }

    /** Delete one imported clip from the user's folder. */
    async function removeClip(name) {
      const response = await fetch(`${SOUND_LIST_ROUTE}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'x-spend-trend': '1' },
      })
      if (!response.ok) throw new Error(`delete failed (${response.status})`)
    }

    function loadAlarm() {
      try {
        const raw = globalThis.localStorage?.getItem(ALARM_KEY)
        if (raw === null || raw === undefined) return { ...DEFAULT_ALARM }
        const parsed = JSON.parse(raw)
        return {
          enabled: parsed?.enabled === true,
          sound: SOUNDS.some((sound) => sound.id === parsed?.sound) ? parsed.sound : DEFAULT_ALARM.sound,
          advance: parsed?.advance === true,
        }
      } catch {
        return { ...DEFAULT_ALARM }
      }
    }

    function saveAlarm(value) {
      try {
        globalThis.localStorage?.setItem(ALARM_KEY, JSON.stringify(value))
      } catch {
        /* storage can be unavailable; the setting then lasts for this page */
      }
    }

    function loadGuard() {
      try {
        const raw = globalThis.localStorage?.getItem(GUARD_KEY)
        if (raw === null || raw === undefined) return { ...DEFAULT_GUARD }
        const parsed = JSON.parse(raw)
        const threshold = Number(parsed?.threshold)
        return {
          enabled: parsed?.enabled === true,
          threshold: Number.isFinite(threshold) ? Math.max(0, threshold) : DEFAULT_GUARD.threshold,
          action: parsed?.action === 'stop' ? 'stop' : 'warn',
          voice: parsed?.voice !== false,
        }
      } catch {
        return { ...DEFAULT_GUARD }
      }
    }

    function saveGuard(value) {
      try {
        globalThis.localStorage?.setItem(GUARD_KEY, JSON.stringify(value))
      } catch {
        /* storage can be unavailable; the setting then lasts for this page */
      }
    }

    /** Send the current settings and balance to the host guard. */
    async function reportGuard(value, total) {
      try {
        await fetch(GUARD_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-spend-trend': '1' },
          body: JSON.stringify({
            enabled: value.enabled,
            threshold: value.threshold,
            action: value.action,
            voice: value.voice !== false,
            total: Number.isFinite(total) ? total : undefined,
          }),
        })
      } catch {
        /* the host keeps the previous value */
      }
    }

    /**
     * Open the Platform top-up page inside the desktop shell, reusing the same
     * bridge the account settings use. Returns false when no bridge exists, so
     * the caller lets the plain link open instead.
     */
    function openPlatformTopUp(labels, onFailure) {
      const platform = globalThis.dshPlatform
      if (platform?.open === undefined) {
        const where = `${globalThis.location?.protocol}//${globalThis.location?.hostname}`
        console.info('[spend-trend] no desktop bridge; dshPlatform =', typeof globalThis.dshPlatform, 'at', where)
        return { ok: false, reason: `dshPlatform ${typeof globalThis.dshPlatform} @ ${where}` }
      }
      if (document.getElementById('dsh-spend-trend-topup') !== null) return true

      const overlay = document.createElement('div')
      overlay.id = 'dsh-spend-trend-topup'
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483000', 'display:flex',
        'flex-direction:column', 'background:var(--dsw-alias-bg-layer-1,#111)',
      ].join(';')

      const mac = document.documentElement.dataset.platform === 'darwin' ||
        /Mac/.test(globalThis.navigator?.userAgent ?? '')
      const header = document.createElement('div')
      header.style.cssText = [
        'display:flex', 'align-items:center', 'height:44px', 'flex:none',
        `padding:0 12px 0 ${mac ? 84 : 12}px`,
        'border-bottom:0.5px solid var(--dsw-alias-border-l2)',
        'color:var(--dsw-alias-label-primary)', 'font-size:13px',
        '-webkit-app-region:drag',
      ].join(';')

      const back = document.createElement('button')
      back.type = 'button'
      back.style.cssText = [
        'font:inherit', 'font-size:13px', 'cursor:pointer', 'line-height:1',
        'display:inline-flex', 'align-items:center', 'gap:4px',
        'padding:4px 8px', 'border-radius:6px',
        'color:var(--dsw-alias-label-primary)',
        'background:transparent', 'border:0',
        '-webkit-app-region:no-drag',
      ].join(';')
      const chevron = document.createElement('span')
      chevron.textContent = '\u2039'
      chevron.style.cssText = 'font-size:18px;line-height:1;opacity:.75'
      const label = document.createElement('span')
      label.textContent = labels.back
      back.append(chevron, label)

      const view = document.createElement('div')
      view.style.cssText = 'flex:1;min-height:0;'
      header.append(back)
      overlay.append(header, view)
      document.body.appendChild(overlay)

      const bounds = () => {
        const rect = view.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
      let closed = false
      let failure = ''
      const close = () => {
        if (closed) return
        closed = true
        window.removeEventListener('resize', onResize)
        platform.close?.().catch?.(() => {})
        overlay.remove()
        labels.onClosed?.()
      }
      const onResize = () => platform.setBounds?.(bounds())?.catch?.(() => {})
      back.addEventListener('click', close)
      window.addEventListener('resize', onResize)

      platform.open('top-up', bounds()).catch((error) => {
        failure = String(error?.message ?? error)

        close()
        onFailure?.(failure)
      })
      return { ok: true, get failure() { return failure } }
    }

    function utcOffsetMinutes() {
      return -new Date().getTimezoneOffset()
    }

    async function readDaily() {
      const response = await fetch(`${ROUTE}?offset=${utcOffsetMinutes()}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`spend-trend: HTTP ${response.status}`)
      const payload = await response.json()
      if (payload?.ok !== true || Array.isArray(payload.days) === false) {
        throw new Error(payload?.error ?? 'spend-trend: invalid payload')
      }
      return payload
    }

    async function readBalance(ctx, locale) {
      const remote = ctx.get?.('remote.account') ?? ctx.get?.('remote')?.account
      if (remote?.getBalance === undefined) return { status: 'unavailable' }
      try {
        const result = await remote.getBalance({
          version: '0.2.2-rc.1',
          locale,
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        })
        if (result?.ok !== true) return { status: 'unavailable' }
        const value = result.value
        if (value?.status !== 'ready') return { status: 'unavailable' }
        return {
          status: 'ready',
          toppedUp: Array.isArray(value.value) ? value.value : [],
          bonus: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
        }
      } catch {
        return { status: 'unavailable' }
      }
    }

    function formatMoney(amount, digits = 2) {
      const n = Number(amount)
      if (!Number.isFinite(n)) return String(amount)
      if (n > 0 && n < 0.005) return '<0.01'
      const [whole, cents] = Math.abs(n).toFixed(digits).split('.')
      const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `${n < 0 ? '-' : ''}${grouped}${cents === undefined ? '' : `.${cents}`}`
    }

    function formatCost(value) {
      const n = Number(value) || 0
      if (n === 0) return '0'
      return n < 0.01 ? '<0.01' : n.toFixed(2)
    }

    function formatTokens(value, locale) {
      const n = Number(value) || 0
      if (locale === 'zh') {
        if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
        if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
      } else {
        if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
      }
      return n.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
    }

    function currencySymbol(currency) {
      return currency === 'CNY' ? '¥' : '$'
    }

    function summarize(balance) {
      if (balance?.status !== 'ready') return null
      const wallets = [...balance.toppedUp, ...balance.bonus]
      if (wallets.length === 0) return null
      const totals = new Map()
      for (const wallet of wallets) {
        const key = String(wallet?.currency ?? 'CNY')
        totals.set(key, (totals.get(key) ?? 0) + Number(wallet?.balance ?? 0))
      }
      const primary = totals.has('CNY') ? 'CNY' : [...totals.keys()][0]
      const sumOf = (list) => list
        .filter((wallet) => wallet?.currency === primary)
        .reduce((sum, wallet) => sum + Number(wallet.balance ?? 0), 0)
      return {
        primary,
        total: Number(totals.get(primary)),
        text: `${currencySymbol(primary)}${formatMoney(totals.get(primary))}`,
        toppedUp: `${currencySymbol(primary)}${formatMoney(sumOf(balance.toppedUp))}`,
        bonus: `${currencySymbol(primary)}${formatMoney(sumOf(balance.bonus))}`,
      }
    }

    /** Remaining time until a switch, as h:mm or mm:ss. */
    function remaining(until, now, compact = false) {
      const total = Math.max(0, Math.floor((until - now) / 1000))
      const hours = Math.floor(total / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const seconds = total % 60
      if (hours > 0) {
        const head = `${hours}:${String(minutes).padStart(2, '0')}`
        return compact ? head : `${head}:${String(seconds).padStart(2, '0')}`
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    }

    const PHASE_COLOR = {
      peak: 'var(--dsw-alias-state-warn-primary)',
      off: 'var(--dsw-alias-state-success-primary)',
    }

    const styles = {
      button: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 30,
        padding: '0 8px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '18px',
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      },
      row: { display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, width: '100%' },
      dot: { flex: 'none', width: 6, height: 6, borderRadius: '50%' },
      phase: { flex: 'none', color: 'var(--dsw-alias-label-secondary)' },
      countdown: {
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 11,
      },
      balance: {
        marginLeft: 'auto',
        color: 'var(--dsw-alias-label-primary)',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      panel: {
        position: 'fixed',
        zIndex: 60,
        width: 312,
        boxSizing: 'border-box',
        padding: '12px 14px 10px',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-lg)',
        background: 'var(--dsw-alias-bg-layer-2)',
        boxShadow: 'var(--dsw-shadow-lv3)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '18px',
      },
      panelHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
      panelTitle: { fontSize: 13, fontWeight: 500 },
      phaseChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 },
      closeButton: {
        marginLeft: 'auto',
        width: 20,
        height: 20,
        padding: 0,
        border: 'none',
        borderRadius: 'var(--dsw-radius-sm)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: '20px',
      },
      meta: { color: 'var(--dsw-alias-label-tertiary)', marginBottom: 6 },
      hero: { display: 'flex', flexDirection: 'column', margin: '10px 0 0' },
      heroLabel: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' },
      heroValue: {
        fontSize: 24,
        fontWeight: 600,
        lineHeight: '30px',
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      },
      subStats: {
        display: 'flex',
        gap: 10,
        margin: '2px 0 4px',
        fontSize: 11,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      disclosure: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        margin: '2px 0 0',
        padding: 0,
        border: 'none',
        background: 'transparent',
        font: 'inherit',
        fontSize: 11,
        color: 'var(--dsw-alias-label-tertiary)',
        cursor: 'pointer',
      },
      ratesBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        margin: '4px 0 0',
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      balanceValue: { fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
      chart: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: 112,
        marginTop: 6,
        borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
      },
      column: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        height: '100%',
      },
      value: { fontSize: 9, lineHeight: '12px', color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap' },
      track: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        height: 92,
      },
      bar: { width: 18, maxWidth: '100%', borderRadius: '4px 4px 2px 2px' },
      dayLabel: { fontSize: 10, lineHeight: '14px', color: 'var(--dsw-alias-label-tertiary)' },
      todayLabel: { color: 'var(--dsw-alias-label-primary)' },
      divider: { height: 0, borderTop: '0.5px solid var(--dsw-alias-border-l2)', margin: '10px 0 8px' },
      footRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      footLabel: { color: 'var(--dsw-alias-label-tertiary)' },
      footValue: { fontVariantNumeric: 'tabular-nums' },
      hint: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, marginTop: 4, whiteSpace: 'normal' },
      empty: { color: 'var(--dsw-alias-label-tertiary)', textAlign: 'center', padding: '20px 0 12px' },
      settings: {
        marginTop: 10,
        paddingTop: 8,
        borderTop: '0.5px solid var(--dsw-alias-border-l2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      settingRow: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
      settingLabel: { color: 'var(--dsw-alias-label-secondary)' },
      control: {
        font: 'inherit',
        fontSize: 11,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
        padding: '2px 4px',
      },
      smallButton: {
        font: 'inherit',
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
        padding: '1px 6px',
        cursor: 'pointer',
      },
      note: { fontSize: 10, color: 'var(--dsw-alias-label-tertiary)', marginTop: 2 },
      guardBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        margin: '6px 0 2px',
        padding: '4px 6px',
        fontSize: 11,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-state-business-tertiary)',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
      },
    }

    const CSS = `
      .dsh-spend-trend-panel input[type="checkbox"] { accent-color: var(--dsw-alias-state-business-primary); }
      .dsh-spend-trend-panel input, .dsh-spend-trend-panel select { outline-offset: 1px; }
      .dsh-spend-trend-badge:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dsh-spend-trend-badge:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
      .dsh-spend-trend-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dsh-spend-trend-flash { animation: dsh-spend-trend-flash 0.9s ease-in-out 4; }
      @keyframes dsh-spend-trend-flash {
        0%, 100% { background: transparent; }
        50% { background: var(--dsw-alias-state-business-tertiary); }
      }
    `

    /** Web Audio engine: synthesised tones plus the bundled voice clips. */
    function createAudio() {
      let context = null
      let lastAudioError = null
      const buffers = new Map()

      function audioContext() {
        if (context !== null) return context
        const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
        if (Ctor === undefined) return null
        context = new Ctor()
        return context
      }

      /** Resume the context after a user gesture; called when the panel opens. */
      function unlock() {
        const audio = audioContext()
        if (audio === null) return
        if (audio.state === 'suspended') audio.resume().catch(() => {})
        // A silent buffer marks the first user gesture on some platforms.
        const buffer = audio.createBuffer(1, 1, 22050)
        const source = audio.createBufferSource()
        source.buffer = buffer
        source.connect(audio.destination)
        source.start(0)
      }

      function tone(kind) {
        const audio = audioContext()
        if (audio === null) return
        const now = audio.currentTime
        const notes = kind === 'chime'
          ? [[523.25, 0], [659.25, 0.14], [783.99, 0.28]]
          : kind === 'bell'
            ? [[440, 0], [880, 0]]
            : [[880, 0]]
        const duration = kind === 'bell' ? 1.4 : kind === 'chime' ? 1.0 : 0.45
        const master = audio.createGain()
        master.gain.value = 0.18
        master.connect(audio.destination)
        for (const [frequency, offset] of notes) {
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = kind === 'bell' ? 'triangle' : 'sine'
          oscillator.frequency.value = frequency
          gain.gain.setValueAtTime(0, now + offset)
          gain.gain.linearRampToValueAtTime(kind === 'bell' ? 0.25 : 0.5, now + offset + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration)
          oscillator.connect(gain)
          gain.connect(master)
          oscillator.start(now + offset)
          oscillator.stop(now + offset + duration + 0.05)
        }
      }

      async function voice(url, key) {
        const audio = audioContext()
        if (audio === null) return false
        try {
          let buffer = buffers.get(key)
          if (buffer === undefined) {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const bytes = await response.arrayBuffer()
            buffer = await audio.decodeAudioData(bytes)
            buffers.set(key, buffer)
          }
          const source = audio.createBufferSource()
          source.buffer = buffer
          source.connect(audio.destination)
          source.start(0)
          return true
        } catch (error) {
          // A missing or undecodable clip must not silence the reminder: fall
          // back to a tone and remember why, so the panel can say it.
          lastAudioError = `${key}: ${String(error?.message ?? error)}`
          console.warn('[spend-trend] clip failed, falling back to a tone:', lastAudioError)
          tone('ping')
          return false
        }
      }

      /** Current context state, or `unavailable` when the platform has no Web Audio. */
      function state() {
        const audio = audioContext()
        return audio === null ? 'unavailable' : audio.state
      }

      function play(soundId) {
        if (soundId === null || soundId === undefined) return
        const audio = audioContext()
        if (audio !== null && audio.state === 'suspended') audio.resume().catch(() => {})
        if (soundId.startsWith('custom:')) {
          const name = soundId.slice('custom:'.length)
          voice(`${CUSTOM_SOUND_BASE}${encodeURIComponent(name)}`, soundId).catch(() => {})
          return
        }
        const entry = SOUNDS.find((sound) => sound.id === soundId)
        if (entry === undefined || entry.kind === 'none') return
        if (entry.kind === 'voice') {
          voice(`${SOUND_BASE}${entry.file}`, entry.id).catch(() => {})
          return
        }
        tone(entry.id)
      }

      return { unlock, play, state, voice }
    }

    function notify(title, body) {
      try {
        if (globalThis.Notification?.permission !== 'granted') {
          console.log('[spend-trend] notification skipped, permission =', globalThis.Notification?.permission)
          return
        }
        // eslint-disable-next-line no-new -- the notification is fire-and-forget
        new globalThis.Notification(title, { body, silent: true })
      } catch {
        /* notifications are best effort */
      }
    }

    function apply(ctx) {
      const locale = pickLocale(ctx)
      const text = TEXT[locale]
      const audio = createAudio()

      function Bars({ daily }) {
        const days = daily.days
        const max = Math.max(...days.map((day) => Number(day.cost) || 0), 0.000001)
        return h('div', { style: styles.chart, role: 'img', 'aria-label': text.week }, days.map((day, index) => {
          const cost = Number(day.cost) || 0
          const isToday = day.date === daily.today || index === days.length - 1
          const height = cost > 0 ? Math.max(3, Math.round((cost / max) * 82)) : 2
          const weekday = WEEKDAYS[locale][new Date(`${day.date}T00:00:00`).getDay()]
          return h('div', {
            key: day.date,
            style: styles.column,
            title: `${day.date} · ¥${formatCost(cost)} · ${formatTokens(day.tokens, locale)} tokens`,
          }, [
            h('div', { key: 't', style: styles.track }, [
              h('span', { key: 'v', style: styles.value }, cost > 0 ? formatCost(cost) : ''),
              h('div', {
                key: 'b',
                style: {
                  ...styles.bar,
                  height,
                  background: isToday ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-state-business-tertiary)',
                },
              }),
            ]),
            h('span', {
              key: 'd',
              style: isToday ? { ...styles.dayLabel, ...styles.todayLabel } : styles.dayLabel,
            }, isToday ? text.today : weekday),
          ])
        }))
      }

      function rateLine(prices) {
        return `${text.cacheHit} ¥${prices.hit} · ${text.cacheMiss} ¥${prices.miss} · ${text.output} ¥${prices.output}`
      }

      function SoundPicker({ alarm, custom, onChange }) {
        const options = [
          ...SOUNDS.map((sound) => ({ id: sound.id, label: text[sound.labelKey] })),
          ...custom.sounds.map((sound) => ({ id: sound.id, label: sound.name })),
        ]
        return h('select', {
          className: 'dsh-spend-trend-select',
          style: styles.control,
          value: alarm.sound,
          'aria-label': text.alarmSound,
          onChange: (event) => onChange({ ...alarm, sound: event.target.value }),
        }, options.map((option) => h('option', { key: option.id, value: option.id }, option.label)))
      }

      function AlarmSettings({ alarm, custom, onChange, onImport, onDelete, denied, notificationState }) {
        const enable = async (next) => {
          if (next) {
            audio.unlock()
            try {
              if (globalThis.Notification?.permission === 'default') await globalThis.Notification.requestPermission()
            } catch {
              /* a refused prompt leaves sound-only mode */
            }
          }
          onChange({ ...alarm, enabled: next })
        }
        return h('div', { style: styles.settings }, [
          h('div', { key: 'switch', style: styles.settingRow }, [
            h('span', { key: 'l', style: { ...styles.settingLabel, color: 'var(--dsw-alias-label-primary)' } }, text.alarmTitle),
            h('label', { key: 'c', style: { ...styles.settingRow, gap: 6, cursor: 'pointer' } }, [
              h('span', { key: 't', style: styles.settingLabel }, text.alarmSwitch),
              h('input', {
                key: 'i',
                type: 'checkbox',
                checked: alarm.enabled,
                'aria-label': text.alarmSwitch,
                onChange: (event) => enable(event.target.checked),
              }),
            ]),
          ]),
          alarm.enabled ? h('div', { key: 'sound', style: styles.settingRow }, [
            h('span', { key: 'l', style: styles.settingLabel }, text.alarmSound),
            h('span', { key: 'c', style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
              h(SoundPicker, { key: 's', alarm, custom, onChange }),
              h('button', {
                key: 'p',
                type: 'button',
                style: styles.smallButton,
                onClick: () => { audio.unlock(); audio.play(alarm.sound) },
              }, text.alarmPreview),
              alarm.sound.startsWith('custom:') ? h('button', {
                key: 'd',
                type: 'button',
                style: styles.smallButton,
                title: text.alarmDelete,
                onClick: () => onDelete(alarm.sound.slice('custom:'.length)),
              }, text.alarmDelete) : null,
              h('label', {
                key: 'i',
                style: { ...styles.smallButton, display: 'inline-flex', alignItems: 'center' },
                title: text.alarmImport,
              }, [
                text.alarmImport,
                h('input', {
                  key: 'f',
                  type: 'file',
                  accept: '.mp3,.m4a,.wav,.ogg,audio/*',
                  style: { display: 'none' },
                  onChange: (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file !== undefined) onImport(file)
                  },
                }),
              ]),
            ]),
          ]) : null,
          alarm.enabled ? h('div', { key: 'advance', style: styles.settingRow }, [
            h('span', { key: 'l', style: styles.settingLabel }, text.alarmAdvance),
            h('input', {
              key: 'i',
              type: 'checkbox',
              checked: alarm.advance,
              'aria-label': text.alarmAdvance,
              onChange: (event) => onChange({ ...alarm, advance: event.target.checked }),
            }),
          ]) : null,
          alarm.enabled ? h('div', { key: 'note', style: styles.note }, [
            text.alarmQuiet,
            denied ? ` · ${text.alarmDenied}` : (notificationState === 'default' ? ` · ${text.alarmPending}` : ''),
          ].join('')) : null,
        ])
      }

      function GuardSettings({ guard, onChange }) {
        // Keep the raw text while typing: a number input would turn an empty
        // field into 0 and the next keystroke into "028".
        const [draft, setDraft] = React.useState(String(guard.threshold))
        React.useEffect(() => {
          if (Number(draft) !== guard.threshold) setDraft(String(guard.threshold))
        }, [guard.threshold])

        const commitThreshold = (raw) => {
          const cleaned = sanitizeMoney(raw)
          setDraft(cleaned)
          if (cleaned === '' || cleaned === '.') return
          const next = Number(cleaned)
          if (!Number.isFinite(next)) return
          onChange({ ...guard, threshold: Math.min(Math.max(0, next), 1_000_000) })
        }

        return h('div', { key: 'guard', style: styles.settings }, [
          h('div', { key: 't', style: styles.settingRow }, [
            h('span', { key: 'l', style: { ...styles.settingLabel, color: 'var(--dsw-alias-label-primary)' } },
              text.guardTitle),
            h('label', { key: 's', style: { ...styles.settingRow, gap: 6 } }, [
              h('span', { key: 't', style: styles.settingLabel }, text.guardSwitch),
              h('input', {
                key: 'i',
                type: 'checkbox',
                checked: guard.enabled,
                'aria-label': text.guardSwitch,
                onChange: (event) => onChange({ ...guard, enabled: event.target.checked }),
              }),
            ]),
          ]),
          guard.enabled
            ? h('div', { key: 'th', style: styles.settingRow }, [
              h('span', { key: 'l', style: styles.settingLabel }, text.guardThreshold),
              h('input', {
                key: 'i',
                type: 'text',
                inputMode: 'decimal',
                value: draft,
                style: { ...styles.control, width: 72 },
                'aria-label': text.guardThreshold,
                onChange: (event) => commitThreshold(event.target.value),
                onBlur: () => setDraft(String(guard.threshold)),
              }),
            ])
            : null,
          guard.enabled
            ? h('div', { key: 'ac', style: styles.settingRow }, [
              h('span', { key: 'l', style: styles.settingLabel }, text.guardAction),
              h('select', {
                key: 'i',
                style: styles.control,
                value: guard.action,
                'aria-label': text.guardAction,
                onChange: (event) => onChange({ ...guard, action: event.target.value === 'stop' ? 'stop' : 'warn' }),
              }, [
                h('option', { key: 'w', value: 'warn' }, text.guardWarn),
                h('option', { key: 's', value: 'stop' }, text.guardStop),
              ]),
            ])
            : null,
          guard.enabled
            ? h('div', { key: 'voice', style: styles.settingRow }, [
              h('span', { key: 'l', style: styles.settingLabel }, text.guardVoice),
              h('input', {
                key: 'i',
                type: 'checkbox',
                checked: guard.voice !== false,
                'aria-label': text.guardVoice,
                onChange: (event) => onChange({ ...guard, voice: event.target.checked }),
              }),
            ])
            : null,
          guard.enabled && guard.action === 'stop'
            ? h('div', { key: 'n', style: styles.note }, text.guardNote)
            : null,
        ])
      }

      function Panel({
        daily,
        balance,
        phase,
        alarm,
        custom,
        notice,
        setAlarm,
        guard,
        setGuard,
        guardWarn,
        onTopUpFailed,
        onRefreshBalance,
        onImport,
        onDelete,
        position,
        panelRef,
        onClose,
      }) {
        const days = daily?.days ?? []
        const weekTotal = days.reduce((sum, day) => sum + (Number(day.cost) || 0), 0)
        const previous = days.slice(0, -1)
        const baseline = previous.length === 0
          ? 0
          : previous.reduce((sum, day) => sum + (Number(day.cost) || 0), 0) / previous.length
        const todayCost = Number(days[days.length - 1]?.cost) || 0
        const money = summarize(balance)
        const kind = phase.kind
        const prices = kind === 'peak' ? phase.peak ?? null : phase.offPeak ?? null
        const notificationState = globalThis.Notification?.permission ?? 'unavailable'
        const denied = notificationState === 'denied'

        const [showRates, setShowRates] = React.useState(false)

        return h('div', {
          ref: panelRef,
          style: { ...styles.panel, left: position.left, bottom: position.bottom },
          role: 'dialog',
          className: 'dsh-spend-trend-panel',
          'aria-label': text.title,
        }, [
          h('div', { key: 'head', style: styles.panelHead }, [
            h('span', { key: 't', style: styles.panelTitle }, text.title),
            h('span', { key: 'p', style: { ...styles.phaseChip, color: PHASE_COLOR[kind] } }, [
              h('span', { key: 'd', style: { ...styles.dot, background: PHASE_COLOR[kind] } }),
              text[kind],
            ]),
            typeof phase.until === 'number'
              ? h('span', { key: 'c', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 } },
                `${kind === 'peak' ? text.toOff : text.toPeak} ${remaining(phase.until, Date.now())}`)
              : null,
            h('button', {
              key: 'x',
              type: 'button',
              className: 'dsh-spend-trend-close',
              style: styles.closeButton,
              onClick: onClose,
              'aria-label': text.close,
              title: text.close,
            }, '×'),
          ]),
          guardWarn
            ? h('div', { key: 'guardbar', style: styles.guardBar, role: 'alert' },
              guard.action === 'stop'
                ? text.guardBarStop(money.text, `¥${guard.threshold}`)
                : text.guardBarWarn(money.text, `¥${guard.threshold}`))
            : null,
          h('div', { key: 'hero', style: styles.hero }, [
            h('span', { key: 'l', style: styles.heroLabel }, text.today),
            h('span', { key: 'v', style: styles.heroValue }, `¥${formatMoney(todayCost)}`),
          ]),
          h('div', { key: 'sub', style: styles.subStats }, [
            h('span', { key: 'w' }, `${text.total} ¥${formatMoney(weekTotal)}`),
            h('span', { key: 'a' }, `${text.average} ¥${formatMoney(baseline)}`),
          ]),
          days.length === 0
            ? h('div', { key: 'empty', style: styles.empty }, text.empty)
            : h(Bars, { key: 'chart', daily }),
          h('div', { key: 'div', style: styles.divider }),
          h('div', { key: 'foot', style: styles.footRow }, [
            h('span', { key: 'l', style: styles.footLabel }, text.balance),
            h('span', { key: 'v', style: { display: 'inline-flex', alignItems: 'center', gap: 6 } }, [
              h('span', {
                key: 'b',
                style: money !== null && guardWarn ? { ...styles.balanceValue, color: 'var(--dsw-alias-state-error-primary, #D93025)' } : styles.balanceValue,
              }, money === null
                ? (balance?.status === 'unavailable' ? text.balanceNone : text.loading)
                : money.text),
              h('a', {
                key: 'topup',
                href: TOPUP_URL,
                target: '_blank',
                rel: 'noopener noreferrer',
                style: { ...styles.smallButton, textDecoration: 'none' },
                title: text.topup,
                onClick: (event) => {
                  event.preventDefault()
                  const report = (reason) => onTopUpFailed?.(text.topupFailed(reason))
                  const result = openPlatformTopUp({ back: text.topupBack, onClosed: onRefreshBalance }, report)
                  if (!result.ok) {
                    // No desktop bridge (the web build): fall back to the site.
                    globalThis.open?.(TOPUP_URL, '_blank', 'noopener,noreferrer')
                    report(result.reason)
                  }
                },
              }, text.topup),
            ]),
          ]),
          h('button', {
            key: 'rates',
            type: 'button',
            style: styles.disclosure,
            'aria-expanded': showRates,
            onClick: () => setShowRates(!showRates),
          }, [
            h('span', { key: 'l' }, text.price),
            h('span', { key: 'i', style: { fontSize: 9, opacity: 0.7 } }, showRates ? '\u2303' : '\u2304'),
          ]),
          showRates
            ? h('div', { key: 'ratesbox', style: styles.ratesBox }, [
              h('span', { key: 'r' }, prices === null ? text.loading : `${phase.model} · ${rateLine(prices)}`),
              money === null
                ? null
                : h('span', { key: 'd' }, `${text.toppingUp} ${money.toppedUp} · ${text.bonus} ${money.bonus}`),
              h('span', { key: 's' }, text.schedule),
            ])
            : null,
          h(AlarmSettings, {
            key: 'alarm',
            alarm,
            custom,
            denied,
            notificationState,
            onChange: setAlarm,
            onImport,
            onDelete,
          }),
          h(GuardSettings, { key: 'guard', guard, onChange: setGuard }),
          notice === '' ? null : h('div', { key: 'notice', style: styles.note }, notice),
        ])
      }

      function SpendTrendBadge(props) {
        const wide = props?.wide !== false
        const [daily, setDaily] = React.useState(null)
        const [balance, setBalance] = React.useState(null)
        const [open, setOpen] = React.useState(false)
        const [position, setPosition] = React.useState(null)
        const [now, setNow] = React.useState(() => Date.now())
        const [alarm, setAlarmState] = React.useState(loadAlarm)
        const [guard, setGuardState] = React.useState(loadGuard)
        const [custom, setCustom] = React.useState({ dir: '', sounds: [], loaded: false })
        const [notice, setNotice] = React.useState('')
        const [flash, setFlash] = React.useState(false)
        const buttonRef = React.useRef(null)
        const panelRef = React.useRef(null)
        const loadedAt = React.useRef(0)
        const fired = React.useRef({ until: 0, advance: false, switched: false })
        const pendingSound = React.useRef(null)
        const lastPhase = React.useRef(null)
        const lastSwitchAt = React.useRef(0)
        const refreshBalance = React.useRef(null)

        const setAlarm = (next) => {
          setAlarmState(next)
          saveAlarm(next)
        }

        const deleteClip = async (name) => {
          try {
            await removeClip(name)
            setCustom(await readCustomSounds())
            if (alarm.sound === `custom:${name}`) setAlarm({ ...alarm, sound: DEFAULT_ALARM.sound })
            setNotice('')
          } catch (error) {
            setNotice(`${text.alarmImportFailed}：${String(error?.message ?? error)}`)
          }
        }

        const importClip = async (file) => {
          try {
            const payload = await uploadSound(file)
            setCustom(await readCustomSounds())
            setAlarm({ ...alarm, enabled: true, sound: payload.id })
            setNotice('')
          } catch (error) {
            setNotice(`${text.alarmImportFailed}：${String(error?.message ?? error)}`)
          }
        }

        const load = React.useCallback(() => {
          let cancelled = false
          readDaily().then((payload) => {
            if (cancelled) return
            loadedAt.current = Date.now()
            setDaily(payload)
            setNow(Date.now())
          }).catch(() => {})
          return () => { cancelled = true }
        }, [])

        React.useEffect(() => {
          const cancel = load()
          const timer = setInterval(() => { load() }, DATA_REFRESH_MS)
          const onVisible = () => {
            if (document.visibilityState === 'visible') load()
          }
          document.addEventListener('visibilitychange', onVisible)
          return () => {
            cancel()
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisible)
          }
        }, [load])

        React.useEffect(() => {
          const tick = setInterval(() => setNow(Date.now()), 1000)
          return () => clearInterval(tick)
        }, [])

        React.useEffect(() => {
          let cancelled = false
          readCustomSounds().then((value) => { if (!cancelled) setCustom(value) })
          return () => { cancelled = true }
        }, [])

        // A custom clip the user deleted falls back to the default voice.
        React.useEffect(() => {
          if (!custom.loaded) return
          if (!alarm.sound.startsWith('custom:')) return
          if (custom.sounds.some((sound) => sound.id === alarm.sound)) return
          setAlarm({ ...alarm, sound: DEFAULT_ALARM.sound })
        }, [custom, alarm])

        React.useEffect(() => {
          let cancelled = false
          const run = async () => {
            const value = await readBalance(ctx, locale)
            if (!cancelled) setBalance(value)
          }
          refreshBalance.current = run
          run()
          const timer = setInterval(run, BALANCE_REFRESH_MS)
          // Coming back from the top-up page (a focus change) usually means the
          // balance moved, so re-read it without waiting for the next tick.
          const onFocus = () => { run() }
          const onVisible = () => {
            if (document.visibilityState === 'visible') run()
          }
          window.addEventListener?.('focus', onFocus)
          document.addEventListener?.('visibilitychange', onVisible)
          return () => {
            cancelled = true
            clearInterval(timer)
            window.removeEventListener?.('focus', onFocus)
            document.removeEventListener?.('visibilitychange', onVisible)
            refreshBalance.current = null
          }
        }, [])

        // A phase switch at the countdown's zero re-reads the tariff instead of
        // waiting for the next poll.
        React.useEffect(() => {
          const until = daily?.phase?.until
          if (typeof until !== 'number' || now < until) return
          if (Date.now() - loadedAt.current < 2_000) return
          load()
        }, [now, daily, load])

        /**
         * Sound, notification and flash for one switch. The guard drops a repeat
         * when both the wall clock and a fresh poll notice the same boundary.
         */
        const fireSwitch = (nextPhase, at) => {
          if (at - lastSwitchAt.current < SWITCH_DEDUPE_MS) return
          lastSwitchAt.current = at
          const sound = chooseSound(alarm.sound, nextPhase, at)
          audio.unlock()
          audio.play(sound)
          // A page with no interaction since load keeps the context suspended:
          // remember the sound and replay it on the next gesture.
          setTimeout(() => {
            if (sound !== null && audio.state() !== 'running') pendingSound.current = sound
          }, 400)
          notify(
            nextPhase === 'off' ? text.notifyOffTitle : text.notifyPeakTitle,
            nextPhase === 'off' ? text.notifyOffBody : text.notifyPeakBody,
          )
          setFlash(true)
          setTimeout(() => setFlash(false), 4000)
        }

        // A phase change observed directly in a fresh payload. This covers the
        // case where the poll lands on the boundary before the one-second tick,
        // and a page that was asleep across the switch.
        React.useEffect(() => {
          const phase = daily?.phase
          if (phase === undefined || typeof phase.until !== 'number') return
          const previous = lastPhase.current
          lastPhase.current = { kind: phase.kind, until: phase.until }
          // Ignore a switch noticed long after the fact, e.g. a laptop that woke
          // up hours later.
          if (!detectsSwitch(previous, phase, Date.now(), alarm.enabled)) return
          // Key on the boundary that was crossed, so a second badge mounting
          // later in the same page cannot announce the same switch again.
          if (!claimOnce(`switch:${previous.until}`)) return
          fireSwitch(phase.kind, Date.now())
        }, [daily, alarm, text])

        // Switch alarm: fires once per phase boundary for the sound and once
        // for the optional heads-up.
        React.useEffect(() => {
          const phase = daily?.phase
          if (phase === undefined || typeof phase.until !== 'number') return
          if (fired.current.until !== phase.until) {
            fired.current = { until: phase.until, advance: false, switched: false }
          }
          if (!alarm.enabled) return
          const nextPhase = phase.kind === 'peak' ? 'off' : 'peak'
          if (alarm.advance && !fired.current.advance && now >= phase.until - ADVANCE_MS && now < phase.until) {
            fired.current.advance = true
            if (!claimOnce(`advance:${phase.until}`)) return
            audio.play('chime')
            notify(
              text.notifyAdvanceTitle,
              nextPhase === 'off' ? text.notifyAdvanceOffBody : text.notifyAdvancePeakBody,
            )
          }
          if (!fired.current.switched && now >= phase.until) {
            fired.current.switched = true
            if (!claimOnce(`switch:${phase.until}`)) return
            fireSwitch(nextPhase, now)
          }
        }, [now, daily, alarm, text])

        React.useEffect(() => {
          if (!alarm.enabled && guard.enabled !== true) return undefined
          const unlock = () => {
            audio.unlock()
            const pending = pendingSound.current
            pendingSound.current = null
            if (pending !== null) audio.play(pending)
            if (pendingGuardVoice.current) {
              pendingGuardVoice.current = false
              audio.voice(`${SOUND_BASE}${BALANCE_WARNING_SOUND}`, BALANCE_WARNING_SOUND)
            }
          }
          document.addEventListener('pointerdown', unlock, { once: true })
          return () => document.removeEventListener('pointerdown', unlock)
        }, [alarm.enabled, guard.enabled])

        // Permission granted only while the alarm switch was flipped. A setting
        // restored from localStorage never asked, so ask when the panel opens.
        React.useEffect(() => {
          if (!open || !alarm.enabled) return
          if (globalThis.Notification?.permission !== 'default') return
          try {
            globalThis.Notification.requestPermission?.()
          } catch {
            /* a refused prompt leaves sound-only mode */
          }
        }, [open, alarm.enabled])

        React.useEffect(() => {
          if (!open) return undefined
          const onPointerDown = (event) => {
            const insidePanel = panelRef.current?.contains?.(event.target)
            const insideButton = buttonRef.current?.contains?.(event.target)
            if (!insidePanel && !insideButton) setOpen(false)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false)
          }
          document.addEventListener('mousedown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('mousedown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open])

        const phase = daily?.phase ?? { kind: 'off', until: null, model: 'deepseek-flash', peak: {}, offPeak: {} }
        const money = summarize(balance)
        const guardWarn = guard.enabled && guard.threshold > 0 &&
          Number.isFinite(money?.total) && money.total < guard.threshold

        const setGuard = (next) => {
          setGuardState(next)
          saveGuard(next)
          reportGuard(next, Number.isFinite(money?.total) ? money.total : undefined)
        }

        // Re-report on a timer even when the value did not change: the host
        // treats an old report as unknown, and a silent page must not leave a
        // stale number in charge.
        const guardRef = React.useRef(guard)
        guardRef.current = guard
        const totalRef = React.useRef(undefined)
        totalRef.current = Number.isFinite(money?.total) ? money.total : undefined
        React.useEffect(() => {
          const timer = setInterval(() => reportGuard(guardRef.current, totalRef.current), 60_000)
          return () => clearInterval(timer)
        }, [])

        // Keep the host guard in sync with the latest balance and announce the
        // single moment the balance drops below the threshold.
        const lastGuardBelow = React.useRef(null)
        const pendingGuardVoice = React.useRef(false)
        React.useEffect(() => {
          try {
            const total = Number.isFinite(money?.total) ? money.total : undefined
            reportGuard(guard, total)
            if (total === undefined) return
            if (!guard.enabled || guard.threshold <= 0) {
              lastGuardBelow.current = null
              return
            }
            // Watch the state, not only the moment it flips: raising the
            // threshold above the current balance must warn immediately.
            const below = total < guard.threshold
            const wasBelow = lastGuardBelow.current
            lastGuardBelow.current = below
            if (wasBelow === null || wasBelow || !below) return
            notify(
              text.guardNotifyTitle,
              guard.action === 'stop'
                ? text.guardNotifyStop(money.text, `¥${guard.threshold}`)
                : text.guardNotifyBody(money.text, `¥${guard.threshold}`),
            )
            // The warning voice is part of the feature, not a selectable preset.
            if (guard.voice !== false) {
              audio.unlock()
              if (isQuietHours(now)) {
                audio.play('ping')
                setTimeout(() => {
                  if (audio.state() !== 'running') pendingGuardVoice.current = true
                }, 400)
              } else {
                audio.voice(`${SOUND_BASE}${BALANCE_WARNING_SOUND}`, BALANCE_WARNING_SOUND)
                // A page opened after the last click cannot start audio; replay the
                // warning on the next gesture instead of losing it.
                setTimeout(() => {
                  if (audio.state() !== 'running') pendingGuardVoice.current = true
                }, 400)
              }
            }
            setFlash(true)
            setTimeout(() => setFlash(false), 4000)
          } catch (error) {
            console.warn('[spend-trend] guard reminder failed:', String(error?.message ?? error))
          }
        }, [money?.total, guard, text])

        const kind = phase.kind
        const countdown = typeof phase.until === 'number' ? remaining(phase.until, now, true) : '—'
        const title = `${text[kind]} · ${text.balance} ${money === null ? '—' : money.text}`

        const recheck = () => {
          refreshBalance.current?.()
        }

        const toggle = () => {
          if (open) {
            setOpen(false)
            return
          }
          const rect = buttonRef.current?.getBoundingClientRect?.()
          if (rect !== undefined) {
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320))
            setPosition({ left, bottom: Math.max(8, window.innerHeight - rect.top + 8) })
          }
          audio.unlock()
          readCustomSounds().then(setCustom).catch(() => {})
          recheck()
          setOpen(true)
          setNow(Date.now())
        }

        return h(React.Fragment, null, [
          h('style', { key: 'css' }, CSS),
          h('button', {
            key: 'badge',
            ref: buttonRef,
            type: 'button',
            className: `dsh-spend-trend-badge${flash ? ' dsh-spend-trend-flash' : ''}`,
            style: styles.button,
            onClick: toggle,
            title,
            'aria-label': title,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
          }, h('span', { style: styles.row }, [
            h('span', {
              key: 'd',
              style: guardWarn ? { ...styles.dot, background: '#E0A800' } : { ...styles.dot, background: PHASE_COLOR[kind] },
            }),
            h('span', { key: 'p', style: styles.phase }, text[kind]),
            wide
              ? h('span', { key: 'c', style: styles.countdown }, `${kind === 'peak' ? text.toOff : text.toPeak} ${countdown}`)
              : null,
            h('span', {
              key: 'b',
              style: {
                ...styles.balance,
                fontSize: wide ? 12 : 10,
                ...(guardWarn ? { color: 'var(--dsw-alias-state-error-primary, #D93025)' } : {}),
              },
            }, money === null ? '—' : money.text),
          ])),
          open && position !== null
            ? h(Panel, {
              key: 'panel',
              daily,
              balance,
              phase,
              alarm,
              custom,
              notice,
              setAlarm,
              guard,
              setGuard,
              guardWarn,
              onTopUpFailed: (reason) => setNotice(reason),
              onRefreshBalance: recheck,
              onImport: importClip,
              onDelete: deleteClip,
              position,
              panelRef,
              onClose: () => setOpen(false),
            })
            : null,
        ])
      }

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'spend-trend',
        order: 10,
      }, SpendTrendBadge))
    }

    return {
      inject: ['slots'],
      apply,
      __test: { isQuietHours, chooseSound, detectsSwitch, claimOnce, sanitizeMoney, SOUNDS, DEFAULT_ALARM },
    }
  },
})
