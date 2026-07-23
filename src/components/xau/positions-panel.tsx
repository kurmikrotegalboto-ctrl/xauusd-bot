'use client'

import { useState, useMemo } from 'react'
import {
  Bot, CheckCircle2, XCircle, TrendingUp, TrendingDown, Clock,
  Target, Award, Activity, Zap, RefreshCw, Settings2, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type {
  Position, PositionStats, StrategyFilter, StrategyEval, PositionsData,
} from '@/hooks/use-xau-data'

type Props = {
  positions: PositionsData | null
  currentPrice: number
}

export function PositionsPanel({ positions, currentPrice }: Props) {
  const [showConfig, setShowConfig] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [busy, setBusy] = useState(false)

  const stats = positions?.stats
  const strategy = positions?.strategy
  const open = positions?.open ?? []
  const closed = positions?.closed ?? []
  const lastEval = positions?.lastEval

  const callApi = async (action: string, updates?: Partial<StrategyFilter>) => {
    setBusy(true)
    try {
      await fetch('/api/xau/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, updates }),
      })
    } catch {
      // ignore — UI updates via SSE anyway
    } finally {
      setBusy(false)
    }
  }

  const updateStrategy = (updates: Partial<StrategyFilter>) => {
    callApi('updateStrategy', updates)
  }

  if (!positions || !strategy || !stats) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        <Bot className="mx-auto mb-2 h-8 w-8 text-amber-400/60" />
        Menunggu data positions...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header: Auto-trade status */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border',
              strategy.enabled
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-muted-foreground/30 bg-background/30',
            )}>
              <Bot className={cn('h-4 w-4', strategy.enabled ? 'text-emerald-400' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="text-sm font-bold">Auto-Trade System</p>
              <p className="text-[11px] text-muted-foreground">
                {strategy.enabled
                  ? `AKTIF • TF ${strategy.tradeTimeframe.toUpperCase()} • min conf ${strategy.minConfidence}% • max ${strategy.maxOpenPositions} posisi`
                  : 'NONAKTIF — aktifkan untuk auto open posisi'}
              </p>
            </div>
          </div>
          <Switch
            checked={strategy.enabled}
            onCheckedChange={(checked) => updateStrategy({ enabled: checked })}
          />
        </div>
      </div>

      {/* Performance Stats */}
      <StatsBlock stats={stats} />

      {/* Open Positions */}
      <OpenPositions open={open} currentPrice={currentPrice} />

      {/* Last strategy evaluation (decision log) */}
      {lastEval && <LastEval eval={lastEval} />}

      {/* History journal */}
      <HistoryJournal
        closed={closed}
        expanded={showHistory}
        onToggle={() => setShowHistory(!showHistory)}
        onReset={() => callApi('reset')}
        onCloseAll={() => callApi('closeAll')}
        busy={busy}
      />

      {/* Strategy configuration */}
      <StrategyConfigPanel
        strategy={strategy}
        expanded={showConfig}
        onToggle={() => setShowConfig(!showConfig)}
        onUpdate={updateStrategy}
      />
    </div>
  )
}

// ============================================================
// Performance Stats
// ============================================================

function StatsBlock({ stats }: { stats: PositionStats }) {
  const winRateColor = stats.winRate >= 60
    ? 'text-emerald-400'
    : stats.winRate >= 45 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold tracking-tight">Performa Auto-Trade</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          icon={<Activity className="h-3 w-3" />}
          label="Total Trade"
          value={stats.total.toString()}
          sub={`${stats.open} open`}
          accent="text-sky-400"
        />
        <Metric
          icon={<Target className="h-3 w-3" />}
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wins}W / ${stats.losses}L`}
          accent={winRateColor}
        />
        <Metric
          icon={<TrendingUp className="h-3 w-3" />}
          label="Avg R"
          value={`${stats.avgRMultiple >= 0 ? '+' : ''}${stats.avgRMultiple.toFixed(2)}`}
          sub={`best ${stats.bestRMultiple.toFixed(2)}R`}
          accent={stats.avgRMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <Metric
          icon={<Zap className="h-3 w-3" />}
          label="Total PnL"
          value={`${stats.totalPnlPct >= 0 ? '+' : ''}${stats.totalPnlPct.toFixed(2)}%`}
          sub={`avg ${stats.avgPnlPct.toFixed(3)}%`}
          accent={stats.totalPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Win Streak</p>
          <p className="font-mono text-sm font-bold text-emerald-400">{stats.longestWinStreak}</p>
        </div>
        <div className="rounded border border-rose-500/30 bg-rose-500/5 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Loss Streak</p>
          <p className="font-mono text-sm font-bold text-rose-400">{stats.longestLossStreak}</p>
        </div>
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Current</p>
          <p className={cn(
            'font-mono text-sm font-bold',
            stats.currentStreak > 0 ? 'text-emerald-400' : stats.currentStreak < 0 ? 'text-rose-400' : 'text-amber-400',
          )}>
            {stats.currentStreak > 0 ? `+${stats.currentStreak}` : stats.currentStreak}
          </p>
        </div>
      </div>

      {/* By timeframe */}
      {Object.keys(stats.byTimeframe).length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Performa per Timeframe
          </p>
          <div className="space-y-1">
            {Object.entries(stats.byTimeframe).map(([tf, s]) => (
              <div key={tf} className="flex items-center gap-2 rounded border border-muted-foreground/15 bg-background/30 px-2 py-1 text-[11px]">
                <span className="font-mono font-bold text-amber-400">{tf}</span>
                <span className="text-muted-foreground">{s.total} trades</span>
                <span className={cn(
                  'ml-auto font-mono font-bold',
                  s.winRate >= 60 ? 'text-emerald-400' : s.winRate >= 45 ? 'text-amber-400' : 'text-rose-400',
                )}>
                  {s.winRate.toFixed(0)}%
                </span>
                <span className="text-muted-foreground">avg {s.avgR.toFixed(2)}R</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exit reason distribution */}
      {stats.total > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Distribusi Exit Reason
          </p>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            {[
              { key: 'take_profit', label: 'TP', color: 'text-emerald-400' },
              { key: 'stop_loss', label: 'SL', color: 'text-rose-400' },
              { key: 'expiry', label: 'Expiry', color: 'text-amber-400' },
              { key: 'manual_close', label: 'Manual', color: 'text-sky-400' },
            ].map(({ key, label, color }) => (
              <div key={key} className="rounded border border-muted-foreground/15 bg-background/30 p-1.5 text-center">
                <p className="text-muted-foreground">{label}</p>
                <p className={cn('font-mono font-bold', color)}>{stats.byExitReason[key as keyof typeof stats.byExitReason]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-2">
      <div className="mb-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('font-mono text-sm font-bold', accent)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

// ============================================================
// Open Positions
// ============================================================

function OpenPositions({ open, currentPrice }: { open: Position[]; currentPrice: number }) {
  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-tight">Posisi Terbuka</h3>
        </div>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
          {open.length} OPEN
        </span>
      </div>

      {open.length === 0 ? (
        <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-4 text-center text-xs text-muted-foreground">
          Tidak ada posisi terbuka. Sistem akan otomatis open saat sinyal memenuhi kriteria strategi.
        </div>
      ) : (
        <div className="space-y-2">
          {open.map((pos) => {
            const livePnl = (pos.direction === 'BUY'
              ? currentPrice - pos.entryPrice
              : pos.entryPrice - currentPrice)
            const livePnlPct = (livePnl / pos.entryPrice) * 100
            const slDist = Math.abs(pos.entryPrice - pos.stopLoss)
            const liveR = slDist > 0 ? livePnl / slDist : 0
            // Progress to TP (0-100%)
            const tpDist = Math.abs(pos.takeProfit - pos.entryPrice)
            const tpProgress = tpDist > 0
              ? Math.min(100, Math.max(0, (Math.abs(livePnl) / tpDist) * 100))
              : 0
            const towardsTp = livePnl >= 0

            return (
              <div
                key={pos.id}
                className={cn(
                  'rounded-lg border p-3',
                  pos.direction === 'BUY'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-rose-500/30 bg-rose-500/5',
                )}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {pos.direction === 'BUY'
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-bold',
                        pos.direction === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400',
                      )}>
                        {pos.direction}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        TF {pos.timeframe.toUpperCase()} • conf {pos.confidence}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs">
                      Entry: <span className="font-bold">${pos.entryPrice.toFixed(2)}</span>
                      <span className="ml-2 text-muted-foreground">
                        SL ${pos.stopLoss.toFixed(2)} / TP ${pos.takeProfit.toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-mono text-sm font-bold',
                      livePnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}>
                      {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)}
                    </p>
                    <p className={cn(
                      'text-[10px]',
                      livePnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}>
                      {livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(3)}% • {liveR.toFixed(2)}R
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative h-1.5 overflow-hidden rounded-full bg-background/50">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/30" />
                  <div
                    className={cn(
                      'absolute inset-y-0 transition-all',
                      towardsTp
                        ? 'bg-emerald-500/60'
                        : 'bg-rose-500/60',
                      towardsTp ? 'left-1/2' : 'right-1/2',
                    )}
                    style={{ width: `${tpProgress / 2}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>SL ${pos.stopLoss.toFixed(2)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDuration(Date.now() - pos.entryTime)}
                  </span>
                  <span>TP ${pos.takeProfit.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Last Strategy Evaluation (decision log)
// ============================================================

function LastEval({ eval: ev }: { eval: StrategyEval }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      ev.approve
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-muted-foreground/20 bg-card/40',
    )}>
      <div className="mb-2 flex items-center gap-2">
        {ev.approve
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          : <XCircle className="h-4 w-4 text-muted-foreground" />}
        <h3 className="text-sm font-semibold tracking-tight">Evaluasi Sinyal Terakhir</h3>
        <span className={cn(
          'ml-auto rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
          ev.approve
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : 'border-muted-foreground/30 bg-background/30 text-muted-foreground',
        )}>
          {ev.approve ? 'APPROVED' : 'REJECTED'}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{ev.reason}</p>
      <div className="space-y-1">
        {ev.checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
              c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400',
            )}>
              {c.passed ? '✓' : '✗'}
            </span>
            <span className="font-mono font-bold text-foreground">{c.name}</span>
            <span className="text-muted-foreground">{c.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// History Journal
// ============================================================

function HistoryJournal({
  closed, expanded, onToggle, onReset, onCloseAll, busy,
}: {
  closed: Position[]
  expanded: boolean
  onToggle: () => void
  onReset: () => void
  onCloseAll: () => void
  busy: boolean
}) {
  // Build equity curve from closed positions (compounding 1R risk per trade)
  const equityData = useMemo(() => {
    let equity = 1000
    const data = [{ trade: 0, equity }]
    for (const p of closed.slice().reverse()) {
      const r = p.rMultiple ?? 0
      equity = equity * (1 + r * 0.01)  // 1R = 1% of equity
      data.push({ trade: data.length, equity: Math.round(equity * 100) / 100 })
    }
    return data
  }, [closed])

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:text-amber-400"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Bot className="h-4 w-4 text-amber-400" />
          Journal Histori ({closed.length})
        </button>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onCloseAll}
            className="h-7 text-[10px] text-muted-foreground hover:text-amber-400"
          >
            Close All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onReset}
            className="h-7 text-[10px] text-muted-foreground hover:text-rose-400"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          {closed.length === 0 ? (
            <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-4 text-center text-xs text-muted-foreground">
              Belum ada trade yang ditutup. Tunggu sistem auto-close di SL/TP/expiry.
            </div>
          ) : (
            <>
              {/* Equity curve */}
              <div className="mb-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Equity Curve ($1000 start, 1% risk per trade)
                </p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid stroke="#333" strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="trade"
                        tick={{ fontSize: 9, fill: '#888' }}
                        axisLine={{ stroke: '#444' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#888' }}
                        tickFormatter={(v) => `${v.toFixed(0)}`}
                        axisLine={false}
                        tickLine={false}
                        width={35}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(20, 20, 22, 0.95)',
                          border: '1px solid #444',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
                        labelFormatter={(l) => `Trade #${l}`}
                      />
                      <ReferenceLine y={1000} stroke="#666" strokeDasharray="2 2" />
                      <Line
                        type="monotone"
                        dataKey="equity"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trade list */}
              <div className="thin-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
                {closed.map((p, i) => (
                  <TradeRow key={p.id || i} pos={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function TradeRow({ pos }: { pos: Position }) {
  const isWin = pos.win === true
  const isLoss = pos.win === false
  return (
    <div
      className={cn(
        'rounded border bg-background/30 px-2 py-1.5 text-[11px]',
        isWin && 'border-emerald-500/20',
        isLoss && 'border-rose-500/20',
        !isWin && !isLoss && 'border-muted-foreground/15',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'rounded px-1 py-0.5 text-[9px] font-bold',
          pos.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400',
        )}>
          {pos.direction}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{pos.timeframe.toUpperCase()}</span>
        <span className="text-[10px] text-muted-foreground">conf {pos.confidence}%</span>
        <span className={cn(
          'ml-auto font-mono text-xs font-bold',
          isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-amber-400',
        )}>
          {pos.pnlPct !== null ? `${pos.pnlPct >= 0 ? '+' : ''}${pos.pnlPct.toFixed(3)}%` : '—'}
          <span className="ml-1 text-muted-foreground">
            ({pos.rMultiple !== null ? `${pos.rMultiple >= 0 ? '+' : ''}${pos.rMultiple.toFixed(2)}R` : ''})
          </span>
        </span>
        <span className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
          isWin ? 'bg-emerald-500/20 text-emerald-400' : isLoss ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400',
        )}>
          {isWin ? 'W' : isLoss ? 'L' : '='}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>entry ${pos.entryPrice.toFixed(2)}</span>
        <span>→</span>
        <span>exit ${pos.exitPrice?.toFixed(2) ?? '—'}</span>
        <span className="ml-auto">
          {pos.exitReason === 'take_profit' ? 'TP hit'
            : pos.exitReason === 'stop_loss' ? 'SL hit'
            : pos.exitReason === 'expiry' ? 'expired'
            : pos.exitReason === 'manual_close' ? 'manual'
            : '—'}
        </span>
        <span>•</span>
        <span>{formatDuration(pos.durationSec ? pos.durationSec * 1000 : 0)}</span>
      </div>
    </div>
  )
}

// ============================================================
// Strategy Configuration Panel
// ============================================================

function StrategyConfigPanel({
  strategy, expanded, onToggle, onUpdate,
}: {
  strategy: StrategyFilter
  expanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<StrategyFilter>) => void
}) {
  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <button
        onClick={onToggle}
        className="mb-2 flex w-full items-center gap-2 text-sm font-semibold tracking-tight hover:text-amber-400"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Settings2 className="h-4 w-4 text-amber-400" />
        Konfigurasi Strategi
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Trade timeframe */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Trade Timeframe
            </p>
            <div className="flex gap-1">
              {[
                { id: '5m', label: '5m' },
                { id: '15m', label: '15m' },
                { id: '1h', label: '1h' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => onUpdate({ tradeTimeframe: tf.id })}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                    strategy.tradeTimeframe === tf.id
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                      : 'border-muted-foreground/20 bg-background/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              TF utama untuk open posisi. 15m = balance terbaik, 1h = akurasi tertinggi tapi trade sedikit.
            </p>
          </div>

          {/* Higher TF for trend alignment */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Higher TF (Trend Confirm)
            </p>
            <div className="flex gap-1">
              {[
                { id: '15m', label: '15m' },
                { id: '1h', label: '1h' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => onUpdate({ higherTf: tf.id })}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                    strategy.higherTf === tf.id
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                      : 'border-muted-foreground/20 bg-background/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tf.label}
                </button>
              ))}
              <label className="flex flex-1 items-center justify-center gap-1 text-[10px] text-muted-foreground">
                <Switch
                  checked={strategy.requireTrendAlignment}
                  onCheckedChange={(c) => onUpdate({ requireTrendAlignment: c })}
                />
                align
              </label>
            </div>
          </div>

          {/* Min confidence */}
          <SliderControl
            label="Min Confidence"
            value={strategy.minConfidence}
            min={50}
            max={95}
            step={5}
            onChange={(v) => onUpdate({ minConfidence: v })}
            hint={`${strategy.minConfidence}% — makin tinggi makin selektif, trade sedikit tapi akurat`}
          />

          {/* Min indicator agreement */}
          <SliderControl
            label="Min Indicator Agreement"
            value={strategy.minIndicatorAgreement}
            min={5}
            max={11}
            step={1}
            onChange={(v) => onUpdate({ minIndicatorAgreement: v })}
            hint={`${strategy.minIndicatorAgreement}/12 indikator harus sepakat — makin tinggi makin konsensus`}
          />

          {/* Min ADX */}
          <SliderControl
            label="Min ADX (Trend Strength)"
            value={strategy.minAdx}
            min={15}
            max={40}
            step={1}
            onChange={(v) => onUpdate({ minAdx: v })}
            hint={`ADX ≥ ${strategy.minAdx} = ${strategy.minAdx >= 25 ? 'tren kuat' : strategy.minAdx >= 20 ? 'tren mulai' : 'tren lemah'}`}
          />

          {/* R:R */}
          <div className="grid grid-cols-2 gap-3">
            <SliderControl
              label="ATR × SL"
              value={strategy.atrSlMultiplier}
              min={0.5}
              max={3}
              step={0.1}
              onChange={(v) => onUpdate({ atrSlMultiplier: v })}
              hint={`SL distance = ${strategy.atrSlMultiplier.toFixed(1)} × ATR`}
            />
            <SliderControl
              label="ATR × TP"
              value={strategy.atrTpMultiplier}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(v) => onUpdate({ atrTpMultiplier: v })}
              hint={`TP distance = ${strategy.atrTpMultiplier.toFixed(1)} × ATR (R:R 1:${(strategy.atrTpMultiplier / strategy.atrSlMultiplier).toFixed(2)})`}
            />
          </div>

          {/* Max positions */}
          <SliderControl
            label="Max Open Positions"
            value={strategy.maxOpenPositions}
            min={1}
            max={5}
            step={1}
            onChange={(v) => onUpdate({ maxOpenPositions: v })}
            hint={`${strategy.maxOpenPositions} posisi concurrent — makin banyak makin diversified tapi susah manage`}
          />

          {/* RSI extreme filter */}
          <div className="flex items-center justify-between rounded-lg border border-muted-foreground/15 bg-background/30 p-2">
            <div>
              <p className="text-xs font-medium">Avoid RSI Extreme</p>
              <p className="text-[10px] text-muted-foreground">
                Skip BUY jika RSI &gt; 80, skip SELL jika RSI &lt; 20
              </p>
            </div>
            <Switch
              checked={strategy.avoidRsiExtreme}
              onCheckedChange={(c) => onUpdate({ avoidRsiExtreme: c })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SliderControl({
  label, value, min, max, step, onChange, hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  hint: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs font-bold text-amber-400">
          {step < 1 ? value.toFixed(1) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
