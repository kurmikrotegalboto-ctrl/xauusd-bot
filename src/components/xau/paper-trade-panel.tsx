'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, TrendingUp, TrendingDown, RotateCcw, Power,
  ArrowUpCircle, ArrowDownCircle, X, Settings2,
  Trophy, AlertCircle, Activity, Clock, Target,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { PaperData, Position, ExitReason } from '@/hooks/use-xau-data'

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '$0.00'
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '0.00'
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '+0.00%'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '0.00'
  return v.toFixed(digits)
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function exitReasonBadge(reason: ExitReason | null) {
  switch (reason) {
    case 'TP':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">TP HIT</Badge>
    case 'SL':
      return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/20">SL HIT</Badge>
    case 'EXPIRED':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">EXPIRED</Badge>
    case 'MANUAL':
      return <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/20">MANUAL</Badge>
    default:
      return <Badge variant="outline">—</Badge>
  }
}

type PaperTradePanelProps = {
  paper: PaperData | null
  currentPrice: number
}

export function PaperTradePanel({ paper, currentPrice }: PaperTradePanelProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [localConfig, setLocalConfig] = useState<PaperData['config'] | null>(null)

  const cfg = localConfig ?? paper?.config
  const stats = paper?.stats
  const open = paper?.openPositions ?? []
  const closed = paper?.recentClosed ?? []
  const curve = paper?.equityCurve ?? []
  const balance = paper?.balance ?? 0
  const equity = paper?.equity ?? 0
  const floating = paper?.floatingPnl ?? 0

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch('/api/xau/paper-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      return json
    } catch (e) {
      console.error('paper-trade api error', e)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const handleDeposit = () => callApi({ action: 'deposit', amount: Number(depositAmount) })
  const handleWithdraw = () => callApi({ action: 'withdraw', amount: Number(depositAmount) })
  const handleReset = () => {
    if (confirm('Reset akun? Semua histori posisi akan dihapus.')) {
      callApi({ action: 'reset' })
    }
  }
  const handleCloseAll = () => callApi({ action: 'closeAll' })
  const handleCloseOne = (id: string) => callApi({ action: 'closeOne', id })
  const handleToggleAuto = (enabled: boolean) => {
    callApi({ action: 'updateConfig', autoTradeEnabled: enabled })
  }
  const handleSaveConfig = () => {
    if (!cfg) return
    callApi({ action: 'updateConfig', ...cfg })
    setShowSettings(false)
    setLocalConfig(null)
  }

  if (!paper) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Memuat data paper trading...
      </div>
    )
  }

  const pnlColor = floating >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const winRateColor =
    stats && stats.winRate >= 60 ? 'text-emerald-400' : stats && stats.winRate >= 40 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="space-y-4">
      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-3"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400/70">
            <Wallet className="h-3 w-3" /> Balance
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-200">{fmtMoney(balance)}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-sky-500/5 p-3"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-400/70">
            <Activity className="h-3 w-3" /> Equity
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-sky-200">{fmtMoney(equity)}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-muted-foreground/20 bg-card/40 p-3"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {floating >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Floating P&L
          </div>
          <div className={`mt-1 font-mono text-lg font-bold ${pnlColor}`}>
            {fmtMoney(floating)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400/70">
            <Trophy className="h-3 w-3" /> Win Rate
          </div>
          <div className={`mt-1 font-mono text-lg font-bold ${winRateColor}`}>
            {stats ? fmtNum(stats.winRate, 1) : '0.0'}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {stats ? stats.wins : 0}W / {stats ? stats.losses : 0}L
          </div>
        </motion.div>
      </div>

      {/* Equity Curve */}
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold tracking-tight">Equity Curve</h3>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {curve.length} points • Sampled every 30s
          </div>
        </div>
        <div className="h-40">
          {curve.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  width={45}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleString('id-ID')}
                  formatter={(v: number) => [fmtMoney(v), 'Equity']}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fill="url(#equityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
              Menunggu data...
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {stats && stats.totalTrades > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total Trades" value={String(stats.totalTrades ?? 0)} />
          <StatCard label="Total P&L" value={fmtMoney(stats.totalPnl)} valueColor={(stats.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          <StatCard label="Profit Factor" value={fmtNum(stats.profitFactor)} valueColor={(stats.profitFactor ?? 0) >= 1.5 ? 'text-emerald-400' : (stats.profitFactor ?? 0) >= 1 ? 'text-amber-400' : 'text-rose-400'} />
          <StatCard label="Avg R" value={`${(stats.avgRMultiple ?? 0) >= 0 ? '+' : ''}${fmtNum(stats.avgRMultiple)}R`} valueColor={(stats.avgRMultiple ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          <StatCard label="Best" value={fmtMoney(stats.bestTrade)} valueColor="text-emerald-400" />
          <StatCard label="Worst" value={fmtMoney(stats.worstTrade)} valueColor="text-rose-400" />
          <StatCard label="Avg Win" value={fmtMoney(stats.avgWin)} valueColor="text-emerald-400" />
          <StatCard label="Avg Loss" value={fmtMoney(stats.avgLoss)} valueColor="text-rose-400" />
          <StatCard
            label="Streak"
            value={(stats.currentStreak ?? 0) === 0 ? '—' : `${(stats.currentStreak ?? 0) > 0 ? '+' : ''}${stats.currentStreak}`}
            valueColor={(stats.currentStreak ?? 0) > 0 ? 'text-emerald-400' : (stats.currentStreak ?? 0) < 0 ? 'text-rose-400' : 'text-muted-foreground'}
          />
          <StatCard label="Max Win Streak" value={String(stats.maxWinStreak ?? 0)} valueColor="text-emerald-400" />
          <StatCard label="Max Loss Streak" value={String(stats.maxLossStreak ?? 0)} valueColor="text-rose-400" />
          <StatCard label="Total Risked" value={fmtMoney(stats.totalRisked)} />
        </div>
      )}

      {/* Exit Reason & Side breakdown */}
      {stats && stats.totalTrades > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Exit Reasons</div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline" className="border-emerald-500/30">TP: {stats.byExitReason.TP}</Badge>
              <Badge variant="outline" className="border-rose-500/30">SL: {stats.byExitReason.SL}</Badge>
              <Badge variant="outline" className="border-amber-500/30">EXPIRED: {stats.byExitReason.EXPIRED}</Badge>
              <Badge variant="outline" className="border-sky-500/30">MANUAL: {stats.byExitReason.MANUAL}</Badge>
            </div>
          </div>
          <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">By Side</div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline" className="border-emerald-500/30">BUY: {stats.bySide.BUY}</Badge>
              <Badge variant="outline" className="border-rose-500/30">SELL: {stats.bySide.SELL}</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold tracking-tight">Auto Trade</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {cfg?.autoTradeEnabled ? 'AKTIF' : 'MATI'}
            </span>
            <Switch
              checked={cfg?.autoTradeEnabled ?? false}
              onCheckedChange={handleToggleAuto}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</label>
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="h-9 font-mono text-sm"
              placeholder="1000"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeposit}
            disabled={busy}
            className="h-9 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" /> Deposit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleWithdraw}
            disabled={busy}
            className="h-9 gap-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
          >
            <ArrowDownCircle className="h-3.5 w-3.5" /> Withdraw
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
            className="h-9 gap-1"
          >
            <Settings2 className="h-3.5 w-3.5" /> Settings
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCloseAll}
            disabled={busy || open.length === 0}
            className="h-9 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <X className="h-3.5 w-3.5" /> Close All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={busy}
            className="h-9 gap-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        <AnimatePresence>
          {showSettings && cfg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-muted-foreground/20 pt-4 md:grid-cols-2">
                <SettingSlider
                  label="Risk per Trade"
                  value={cfg.riskPerTradePct}
                  min={0.1}
                  max={5}
                  step={0.1}
                  unit="%"
                  onChange={(v) => setLocalConfig({ ...cfg, riskPerTradePct: v })}
                />
                <SettingSlider
                  label="Min Confidence"
                  value={cfg.minConfidence}
                  min={40}
                  max={90}
                  step={5}
                  unit="%"
                  onChange={(v) => setLocalConfig({ ...cfg, minConfidence: v })}
                />
                <SettingSlider
                  label="Min Indicator Agreement"
                  value={cfg.minIndicatorAgreement}
                  min={3}
                  max={7}
                  step={1}
                  unit="/7"
                  onChange={(v) => setLocalConfig({ ...cfg, minIndicatorAgreement: v })}
                />
                <SettingSlider
                  label="Max Open Positions"
                  value={cfg.maxOpenPositions}
                  min={1}
                  max={10}
                  step={1}
                  unit=""
                  onChange={(v) => setLocalConfig({ ...cfg, maxOpenPositions: v })}
                />
                <SettingSlider
                  label="ATR SL Multiplier"
                  value={cfg.atrSlMultiplier}
                  min={0.5}
                  max={3}
                  step={0.1}
                  unit="x"
                  onChange={(v) => setLocalConfig({ ...cfg, atrSlMultiplier: v })}
                />
                <SettingSlider
                  label="ATR TP Multiplier"
                  value={cfg.atrTpMultiplier}
                  min={0.5}
                  max={5}
                  step={0.1}
                  unit="x"
                  onChange={(v) => setLocalConfig({ ...cfg, atrTpMultiplier: v })}
                />
                <SettingSlider
                  label="Position Expiry"
                  value={cfg.positionExpiryMs / 60000}
                  min={5}
                  max={120}
                  step={5}
                  unit="min"
                  onChange={(v) => setLocalConfig({ ...cfg, positionExpiryMs: v * 60000 })}
                />
                <SettingSlider
                  label="Starting Balance"
                  value={cfg.startingBalance}
                  min={1000}
                  max={100000}
                  step={1000}
                  unit="$"
                  onChange={(v) => setLocalConfig({ ...cfg, startingBalance: v })}
                />
                <div className="md:col-span-2 flex justify-end">
                  <Button size="sm" onClick={handleSaveConfig} disabled={busy}>
                    Simpan Settings
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Open Positions */}
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold tracking-tight">Open Positions</h3>
            <Badge variant="outline" className="text-[10px]">{open.length}</Badge>
          </div>
        </div>

        {open.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-muted-foreground">
            {cfg?.autoTradeEnabled
              ? 'Menunggu sinyal yang memenuhi kriteria strategi...'
              : 'Auto trade dimatikan. Aktifkan untuk membuka posisi otomatis.'}
          </div>
        ) : (
          <div className="space-y-2">
            {open.map((p) => (
              <OpenPositionRow key={p.id} p={p} currentPrice={currentPrice} onClose={() => handleCloseOne(p.id)} busy={busy} />
            ))}
          </div>
        )}
      </div>

      {/* History Journal */}
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold tracking-tight">Trade History (Journal)</h3>
            <Badge variant="outline" className="text-[10px]">{closed.length}</Badge>
          </div>
        </div>

        {closed.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-muted-foreground">
            Belum ada posisi yang ditutup. Biarkan bot berjalan untuk kumpul histori.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-muted-foreground/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Side</th>
                  <th className="py-2 pr-2 text-right">Entry</th>
                  <th className="py-2 pr-2 text-right">Exit</th>
                  <th className="py-2 pr-2 text-right">SL</th>
                  <th className="py-2 pr-2 text-right">TP</th>
                  <th className="py-2 pr-2 text-right">Lot</th>
                  <th className="py-2 pr-2 text-right">P&L</th>
                  <th className="py-2 pr-2 text-right">R</th>
                  <th className="py-2 pr-2">Exit</th>
                  <th className="py-2 pr-2 text-right">Dur</th>
                  <th className="py-2 pr-2 text-right">Conf</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p) => {
                  const pnl = p.pnl ?? 0
                  const r = p.pnlPct ?? 0
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-muted-foreground/10 hover:bg-muted/30 ${pnl >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'}`}
                    >
                      <td className="py-1.5 pr-2 text-muted-foreground">{fmtTime(p.openTime)}</td>
                      <td className="py-1.5 pr-2">
                        <Badge
                          variant="outline"
                          className={
                            p.side === 'BUY'
                              ? 'border-emerald-500/30 text-emerald-400'
                              : 'border-rose-500/30 text-rose-400'
                          }
                        >
                          {p.side}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono">{fmtPrice(p.entryPrice)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{p.exitPrice ? fmtPrice(p.exitPrice) : '—'}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-rose-400/70">{fmtPrice(p.stopLoss)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-emerald-400/70">{fmtPrice(p.takeProfit)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{fmtNum(p.lotSize, 2)}</td>
                      <td className={`py-1.5 pr-2 text-right font-mono font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtMoney(pnl)}
                      </td>
                      <td className={`py-1.5 pr-2 text-right font-mono ${r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r >= 0 ? '+' : ''}{fmtNum(r)}R
                      </td>
                      <td className="py-1.5 pr-2">{exitReasonBadge(p.exitReason)}</td>
                      <td className="py-1.5 pr-2 text-right text-muted-foreground">
                        {p.durationMs ? fmtDuration(p.durationMs) : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-muted-foreground">{p.confidence}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[10px] leading-relaxed text-amber-200/80">
            <strong className="font-semibold text-amber-300">Paper Trading:</strong> Akun ini menggunakan saldo virtual (${(cfg?.startingBalance ?? 0).toLocaleString()}). Posisi dibuka otomatis saat prediksi memenuhi: confidence ≥ {cfg?.minConfidence ?? 0}%, agreement ≥ {cfg?.minIndicatorAgreement ?? 0}/7 indikator, ATR ≥ 0.3. SL & TP dihitung dari ATR. Gunakan jurnal di atas sebagai literatur belajar trading real.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-lg border border-muted-foreground/20 bg-card/30 p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${valueColor ?? 'text-foreground'}`}>
        {value}
      </div>
    </div>
  )
}

function SettingSlider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">{label}</label>
        <span className="font-mono text-[11px] text-amber-400">
          {fmtNum(value, unit === '%' || unit === 'x' ? 1 : 0)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  )
}

function OpenPositionRow({
  p, currentPrice, onClose, busy,
}: {
  p: Position
  currentPrice: number
  onClose: () => void
  busy: boolean
}) {
  const diff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
  const pnl = diff * (p.lotSize ?? 0) * 100
  const rPct = p.riskAmount > 0 ? (pnl / p.riskAmount) * 100 : 0
  const ageMs = Date.now() - (p.openTime ?? Date.now())
  const ageMin = Math.floor(ageMs / 60000)
  const ageSec = Math.floor((ageMs % 60000) / 1000)

  const distToSl = Math.abs(currentPrice - (p.stopLoss ?? currentPrice))
  const distToTp = Math.abs(currentPrice - (p.takeProfit ?? currentPrice))
  const slDenom = Math.abs((p.entryPrice ?? 0) - (p.stopLoss ?? 0))
  const tpDenom = Math.abs((p.entryPrice ?? 0) - (p.takeProfit ?? 0))

  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                p.side === 'BUY'
                  ? 'border-emerald-500/30 text-emerald-400'
                  : 'border-rose-500/30 text-rose-400'
              }
            >
              {p.side} {fmtNum(p.lotSize, 2)} lot
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Conf {p.confidence}% • {ageMin}m {ageSec}s
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-2 text-[10px] font-mono">
            <div>
              <div className="text-muted-foreground">Entry</div>
              <div>{fmtPrice(p.entryPrice)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">SL</div>
              <div className="text-rose-400/80">{fmtPrice(p.stopLoss)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">TP</div>
              <div className="text-emerald-400/80">{fmtPrice(p.takeProfit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cur</div>
              <div>{fmtPrice(currentPrice)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground">
              → SL: {fmtPrice(distToSl)} ({slDenom > 0 ? fmtNum((distToSl / slDenom) * 100, 0) : '0'}%)
            </span>
            <span className="text-muted-foreground">
              → TP: {fmtPrice(distToTp)} ({tpDenom > 0 ? fmtNum((distToTp / tpDenom) * 100, 0) : '0'}%)
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmtMoney(pnl)}
          </div>
          <div className={`font-mono text-[10px] ${rPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmtPct(rPct)}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="mt-1 h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
