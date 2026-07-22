'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Activity, Target, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Prediction } from '@/hooks/use-xau-data'
import { cn } from '@/lib/utils'

type Props = {
  prediction: Prediction | null
  currentPrice: number
}

function useCountdown(validUntil: number | undefined) {
  const computeRemaining = () => {
    if (!validUntil) return 0
    return Math.max(0, validUntil - Date.now())
  }
  const [remaining, setRemaining] = useState<number>(computeRemaining)

  useEffect(() => {
    if (!validUntil) return
    const t = setInterval(() => {
      setRemaining(Math.max(0, validUntil - Date.now()))
    }, 250)
    return () => clearInterval(t)
  }, [validUntil])

  const totalSec = 5 * 60 * 1000
  const pct = totalSec > 0 ? (1 - remaining / totalSec) * 100 : 0
  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  return { remaining, pct, label: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` }
}

export function SignalCard({ prediction, currentPrice }: Props) {
  const countdown = useCountdown(prediction?.validUntil)

  if (!prediction) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-8 text-center">
        <Activity className="mx-auto mb-3 h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Menunggu data candle cukup untuk menghasilkan prediksi…
        </p>
      </div>
    )
  }

  const isBuy = prediction.signal === 'BUY'
  const isSell = prediction.signal === 'SELL'
  const isHold = prediction.signal === 'HOLD'

  const theme = isBuy
    ? {
        text: 'text-emerald-400',
        bg: 'from-emerald-500/15 to-emerald-500/5',
        border: 'border-emerald-500/40',
        ring: 'ring-emerald-500/30',
        glow: 'shadow-emerald-500/20',
        Icon: TrendingUp,
        label: 'NAIK / BUY',
        accent: '#10b981',
      }
    : isSell
      ? {
          text: 'text-rose-400',
          bg: 'from-rose-500/15 to-rose-500/5',
          border: 'border-rose-500/40',
          ring: 'ring-rose-500/30',
          glow: 'shadow-rose-500/20',
          Icon: TrendingDown,
          label: 'TURUN / SELL',
          accent: '#f43f5e',
        }
      : {
          text: 'text-amber-400',
          bg: 'from-amber-500/15 to-amber-500/5',
          border: 'border-amber-500/40',
          ring: 'ring-amber-500/30',
          glow: 'shadow-amber-500/20',
          Icon: Minus,
          label: 'TUNGGU / HOLD',
          accent: '#f59e0b',
        }

  const { Icon } = theme
  const potentialPct =
    prediction.targetPrice !== null
      ? ((prediction.targetPrice - currentPrice) / currentPrice) * 100
      : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br p-6 shadow-lg ring-1',
        theme.bg, theme.border, theme.ring, theme.glow,
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', theme.border, theme.bg)}>
            <Activity className={cn('h-4 w-4', theme.text)} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sinyal Prediksi 5 Menit
            </p>
            <p className="text-[11px] text-muted-foreground/70">XAUUSD • Algoritma Multi-Indikator</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Berlaku hingga</p>
          <p className={cn('font-mono text-sm font-semibold', theme.text)}>{countdown.label}</p>
        </div>
      </div>

      {/* Main signal */}
      <div className="flex items-center gap-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={prediction.signal}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn('flex h-20 w-20 items-center justify-center rounded-2xl border-2', theme.border)}
            style={{ background: `${theme.accent}15` }}
          >
            <Icon className={cn('h-10 w-10', theme.text)} strokeWidth={2.5} />
          </motion.div>
        </AnimatePresence>

        <div className="flex-1">
          <motion.h2
            key={prediction.signal + prediction.confidence}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('text-4xl font-extrabold tracking-tight', theme.text)}
          >
            {theme.label}
          </motion.h2>
          <p className="mt-1 text-sm text-muted-foreground">{prediction.summary}</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tingkat Keyakinan</span>
          <span className={cn('font-mono font-bold', theme.text)}>{prediction.confidence}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
          <motion.div
            className={cn('h-full rounded-full', theme.text)}
            style={{ background: theme.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${prediction.confidence}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat
          icon={<Target className="h-3.5 w-3.5" />}
          label="Harga Target"
          value={prediction.targetPrice ? `$${prediction.targetPrice.toFixed(2)}` : '—'}
          sub={potentialPct !== null ? `${potentialPct >= 0 ? '+' : ''}${potentialPct.toFixed(3)}%` : ''}
          accent={theme.text}
        />
        <Stat
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Skor Sinyal"
          value={prediction.score.toFixed(3)}
          sub={prediction.score > 0 ? 'bullish' : prediction.score < 0 ? 'bearish' : 'netral'}
          accent={theme.text}
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Timeframe"
          value="5 Menit"
          sub={`${prediction.votes.length} indikator`}
          accent={theme.text}
        />
      </div>

      {/* Countdown progress */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Progress Window</span>
          <span>{countdown.pct.toFixed(0)}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className={cn('h-full rounded-full transition-all', theme.text)}
            style={{ width: `${countdown.pct}%`, background: theme.accent }}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/40 p-2.5">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('font-mono text-sm font-bold', accent)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
