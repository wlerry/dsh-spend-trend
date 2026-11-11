/**
 * Client half of the spend-trend bundle: a sidebar foot badge showing the live
 * DeepSeek billing phase (peak or off-peak), the countdown to the next switch,
 * and the account balance, plus a 7-day CNY spend chart in a popover.
 */
window.__ModuleLoader__.load({
  id: 'dsh-spend-trend',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ROUTE = '/plugin/dsh-spend-trend/daily'
    const DAY_MS = 24 * 60 * 60 * 1000
    const DATA_REFRESH_MS = 60_000
    const BALANCE_REFRESH_MS = 180_000

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
        toppedUp: '充值',
        bonus: '赠送',
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
        toppedUp: 'Topped up',
        bonus: 'Granted',
      },
    }

    const WEEKDAYS = {
      zh: ['日', '一', '二', '三', '四', '五', '六'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
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
        text: `${currencySymbol(primary)}${formatMoney(totals.get(primary))}`,
        toppedUp: `${currencySymbol(primary)}${formatMoney(sumOf(balance.toppedUp))}`,
        bonus: `${currencySymbol(primary)}${formatMoney(sumOf(balance.bonus))}`,
      }
    }

    /** Remaining time until the next phase switch, as h:mm or mm:ss. */
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
      chart: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 108, marginTop: 4 },
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
      track: { width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 82 },
      bar: { width: 18, maxWidth: '100%', borderRadius: '4px 4px 2px 2px' },
      dayLabel: { fontSize: 10, lineHeight: '14px', color: 'var(--dsw-alias-label-tertiary)' },
      todayLabel: { color: 'var(--dsw-alias-label-primary)' },
      divider: { height: 0, borderTop: '0.5px solid var(--dsw-alias-border-l2)', margin: '10px 0 8px' },
      footRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      footLabel: { color: 'var(--dsw-alias-label-tertiary)' },
      footValue: { fontVariantNumeric: 'tabular-nums' },
      hint: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, marginTop: 4, whiteSpace: 'normal' },
      empty: { color: 'var(--dsw-alias-label-tertiary)', textAlign: 'center', padding: '20px 0 12px' },
    }

    const CSS = `
      .dsh-spend-trend-badge:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dsh-spend-trend-badge:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
      .dsh-spend-trend-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
    `

    function apply(ctx) {
      const locale = pickLocale(ctx)
      const text = TEXT[locale]

      function Bars({ daily }) {
        const days = daily.days
        const max = Math.max(...days.map((day) => Number(day.cost) || 0), 0.000001)
        return h('div', { style: styles.chart, role: 'img', 'aria-label': text.week }, days.map((day, index) => {
          const cost = Number(day.cost) || 0
          const isToday = day.date === daily.today || index === days.length - 1
          const height = cost > 0 ? Math.max(3, Math.round((cost / max) * 78)) : 2
          const weekday = WEEKDAYS[locale][new Date(`${day.date}T00:00:00`).getDay()]
          return h('div', {
            key: day.date,
            style: styles.column,
            title: `${day.date} · ¥${formatCost(cost)} · ${formatTokens(day.tokens, locale)} tokens`,
          }, [
            h('span', { key: 'v', style: styles.value }, cost > 0 ? formatCost(cost) : ''),
            h('div', { key: 't', style: styles.track }, h('div', {
              style: {
                ...styles.bar,
                height,
                background: isToday ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-state-business-tertiary)',
              },
            })),
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

      function Panel({ daily, balance, phase, position, panelRef, onClose }) {
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

        return h('div', {
          ref: panelRef,
          style: { ...styles.panel, left: position.left, bottom: position.bottom },
          role: 'dialog',
          'aria-label': text.title,
        }, [
          h('div', { key: 'head', style: styles.panelHead }, [
            h('span', { key: 't', style: styles.panelTitle }, text.title),
            h('span', { key: 'p', style: { ...styles.phaseChip, color: PHASE_COLOR[kind] } }, [
              h('span', { key: 'd', style: { ...styles.dot, background: PHASE_COLOR[kind] } }),
              `${text[kind]}`,
            ]),
            typeof phase.until === 'number'
              ? h('span', { key: 'c', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 } },
                `${kind === 'peak' ? text.nextOff : text.nextPeak} ${remaining(phase.until, Date.now())}`)
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
          h('div', { key: 'rate', style: styles.meta },
            prices === null
              ? text.loading
              : `${text.price}（${phase.model}，${text.perMillion}）：${rateLine(prices)}`),
          days.length === 0
            ? h('div', { key: 'empty', style: styles.empty }, text.empty)
            : h('div', { key: 'body' }, [
              h('div', { key: 'sum', style: styles.meta },
                `${text.total} ¥${formatMoney(weekTotal)} · ${text.average} ¥${formatMoney(baseline)}`),
              h(Bars, { key: 'chart', daily }),
            ]),
          h('div', { key: 'div', style: styles.divider }),
          h('div', { key: 'today', style: styles.footRow }, [
            h('span', { key: 'l', style: styles.footLabel }, text.today),
            h('span', { key: 'v', style: styles.footValue }, `¥${formatMoney(todayCost)}`),
          ]),
          h('div', { key: 'foot', style: { ...styles.footRow, marginTop: 2 } }, [
            h('span', { key: 'l', style: styles.footLabel }, text.balance),
            h('span', { key: 'v', style: styles.footValue }, money === null
              ? (balance?.status === 'unavailable' ? text.balanceNone : text.loading)
              : money.text),
          ]),
          money === null ? null : h('div', {
            key: 'detail',
            style: { ...styles.footRow, marginTop: 2, color: 'var(--dsw-alias-label-tertiary)' },
          }, [
            h('span', { key: 'l', style: styles.footLabel }, text.toppedUp),
            h('span', { key: 'v', style: styles.footValue }, `${money.toppedUp} · ${text.bonus} ${money.bonus}`),
          ]),
          h('div', { key: 'hint', style: styles.hint }, text.schedule),
        ])
      }

      function SpendTrendBadge(props) {
        const wide = props?.wide !== false
        const [daily, setDaily] = React.useState(null)
        const [balance, setBalance] = React.useState(null)
        const [open, setOpen] = React.useState(false)
        const [position, setPosition] = React.useState(null)
        const [now, setNow] = React.useState(() => Date.now())
        const buttonRef = React.useRef(null)
        const panelRef = React.useRef(null)
        const loadedAt = React.useRef(0)

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
          const run = async () => {
            const value = await readBalance(ctx, locale)
            if (!cancelled) setBalance(value)
          }
          run()
          const timer = setInterval(run, BALANCE_REFRESH_MS)
          return () => {
            cancelled = true
            clearInterval(timer)
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
        const kind = phase.kind
        const countdown = typeof phase.until === 'number' ? remaining(phase.until, now, true) : '—'
        const hint = typeof phase.until === 'number'
          ? `${kind === 'peak' ? text.nextOff : text.nextPeak} ${remaining(phase.until, now)}`
          : ''
        const title = `${text[kind]} · ${hint} · ${text.balance} ${money === null ? '—' : money.text}`

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
          setOpen(true)
          setNow(Date.now())
        }

        return h(React.Fragment, null, [
          h('style', { key: 'css' }, CSS),
          h('button', {
            key: 'badge',
            ref: buttonRef,
            type: 'button',
            className: 'dsh-spend-trend-badge',
            style: styles.button,
            onClick: toggle,
            title,
            'aria-label': title,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
          }, h('span', { style: styles.row }, [
            h('span', { key: 'd', style: { ...styles.dot, background: PHASE_COLOR[kind] } }),
            h('span', { key: 'p', style: styles.phase }, text[kind]),
            wide
              ? h('span', { key: 'c', style: styles.countdown }, `${kind === 'peak' ? text.toOff : text.toPeak} ${countdown}`)
              : null,
            h('span', { key: 'b', style: { ...styles.balance, fontSize: wide ? 12 : 10 } }, money === null ? '—' : money.text),
          ])),
          open && position !== null
            ? h(Panel, {
              key: 'panel',
              daily,
              balance,
              phase,
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

    return { inject: ['slots'], apply }
  },
})
