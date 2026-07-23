'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Play, Loader2, TrendingUp, Target, Percent, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type BacktestResult = {
  totalTrades: number
  wins: number
  losses: number
  neutrals: number
  winRate: number
  avgChangePct: number
  bestTradePct: number
  worstTradePct: number
  expectancy: number
  equityCurve: Array<{ trade: number; equity: number }>
  signalDistribution: { signal: string; count: number; fill: string }[]
  trades: Array<{
    prediction: {
      signal: 'BUY' | 'SELL' | 'HOLD'
      confidence: number
      currentPrice: number
      targetPrice: number | null
      timeframe: string
    }
    actualChangePct: number
    correct: boolean
    timestamp: number
  }>
}

type BacktestResponse = {
  result?: BacktestResult
  error?: string
}

export function BacktestPanel() {
  const [tfId, setTfId] = useState('5m')
  const [minConfidence, setMinConfidence] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runBacktest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/xau/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tfId, minConfidence }),
      })
      const json: BacktestResponse = await res.json()
      if (json.error) {
        setError(json.error)
      } else if (json.result) {
        setResult(json.result)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold tracking-tight">Backtest Strategi</h3>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Jalankan algoritma prediksi pada 180 candle historis (1 menit) untuk melihat
        performa strategi. Hitung win rate, expectancy, dan equity curve.
      </p>

      {/* Controls */}
      <div className="mb-4 space-y-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Timeframe
          </p>
          <div className="flex gap-1">
            {[
              { id: '5m', label: '5m' },
              { id: '15m', label: '15m' },
              { id: '1h', label: '1h' },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTfId(tf.id)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                  tfId === tf.id
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-muted-foreground/20 bg-background/30 text-muted-foreground hover:text-foreground',
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min Confidence
            </p>
            <span className="font-mono text-xs font-bold text-amber-400">{minConfidence}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        <Button
          onClick={runBacktest}
          disabled={loading}
          className="w-full gap-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menjalankan backtest...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Jalankan Backtest
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      {result && (
        <BacktestResults result={result} />
      )}
    </div>
  )
}

function BacktestResults({ result }: { result: BacktestResult }) {
  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          icon={<Target className="h-3 w-3" />}
          label="Total Trades"
          value={result.totalTrades.toString()}
          accent="text-sky-400"
        />
        <Metric
          icon={<TrendingUp className="h-3 w-3" />}
          label="Win Rate"
          value={`${result.winRate.toFixed(1)}%`}
          accent={result.winRate >= 55 ? 'text-emerald-400' : result.winRate >= 45 ? 'text-amber-400' : 'text-rose-400'}
        />
        <Metric
          icon={<Percent className="h-3 w-3" />}
          label="Avg Move"
          value={`${result.avgChangePct >= 0 ? '+' : ''}${result.avgChangePct.toFixed(3)}%`}
          accent={result.avgChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <Metric
          icon={<Target className="h-3 w-3" />}
          label="Expectancy"
          value={`${result.expectancy >= 0 ? '+' : ''}${result.expectancy.toFixed(3)}%`}
          accent={result.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
      </div>

      {/* W/L breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win</p>
          <p className="font-mono text-lg font-bold text-emerald-400">{result.wins}</p>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loss</p>
          <p className="font-mono text-lg font-bold text-rose-400">{result.losses}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Neutral</p>
          <p className="font-mono text-lg font-bold text-amber-400">{result.neutrals}</p>
        </div>
      </div>

      {/* Equity curve */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Equity Curve (compounding 1% risk, 1:1.5 R:R)
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.equityCurve} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                width={40}
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

      {/* Signal distribution */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Distribusi Sinyal
        </p>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.signalDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="signal"
                tick={{ fontSize: 10, fill: '#888' }}
                axisLine={{ stroke: '#444' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#888' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(20, 20, 22, 0.95)',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best/Worst */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-2">
          <p className="text-[10px] text-muted-foreground">Best Trade</p>
          <p className="font-mono font-bold text-emerald-400">
            +{result.bestTradePct.toFixed(3)}%
          </p>
        </div>
        <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-2">
          <p className="text-[10px] text-muted-foreground">Worst Trade</p>
          <p className="font-mono font-bold text-rose-400">
            {result.worstTradePct.toFixed(3)}%
          </p>
        </div>
      </div>

      {/* Recent trades */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Trade Terbaru ({Math.min(result.trades.length, 8)} terakhir)
        </p>
        <div className="thin-scroll max-h-48 space-y-1 overflow-y-auto pr-1">
          {result.trades.slice(-8).reverse().map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-muted-foreground/15 bg-background/30 px-2 py-1 text-[11px]"
            >
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-bold',
                  t.prediction.signal === 'BUY' && 'bg-emerald-500/15 text-emerald-400',
                  t.prediction.signal === 'SELL' && 'bg-rose-500/15 text-rose-400',
                  t.prediction.signal === 'HOLD' && 'bg-amber-500/15 text-amber-400',
                )}
              >
                {t.prediction.signal}
              </span>
              <span className="text-muted-foreground">conf {t.prediction.confidence}%</span>
              <span className="ml-auto font-mono font-bold">
                <span className={t.actualChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {t.actualChangePct >= 0 ? '+' : ''}{t.actualChangePct.toFixed(3)}%
                </span>
              </span>
              <span className={cn('text-[10px]', t.correct ? 'text-emerald-400' : 'text-rose-400')}>
                {t.correct ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon, label, value, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-2">
      <div className="mb-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('font-mono text-sm font-bold', accent)}>{value}</p>
    </div>
  )
}
