'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Radio, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  price: number
  prevPrice: number
  bid: number
  ask: number
  spread: number
  changePct: number
  connected: boolean
}

export function PriceDisplay({
  price, prevPrice, bid, ask, spread, changePct, connected,
}: Props) {
  const isUp = price > prevPrice
  const isDown = price < prevPrice
  const isFlat = price === prevPrice

  const changeAbs = changePct
  const changePositive = changeAbs >= 0

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-card to-card p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: XAUUSD label */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
            <span className="text-lg font-bold text-amber-400">Au</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">XAUUSD</h1>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Gold Spot
              </span>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Radio className={cn('h-3 w-3', connected ? 'text-emerald-400 animate-pulse' : 'text-rose-400')} />
              {connected ? 'Live • Real-time stream' : 'Koneksi terputus…'}
            </p>
          </div>
        </div>

        {/* Right: change badge */}
        <div
          className={cn(
            'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-semibold',
            changePositive
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-400',
          )}
        >
          {changePositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          <span className="font-mono">
            {changePositive ? '+' : ''}{changeAbs.toFixed(3)}%
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">1 menit</span>
        </div>
      </div>

      {/* Price */}
      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={price.toFixed(2)}
            initial={{ opacity: 0.6, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-baseline gap-2"
          >
            <span
              className={cn(
                'font-mono text-5xl font-extrabold tracking-tight transition-colors',
                isUp && 'text-emerald-400',
                isDown && 'text-rose-400',
                isFlat && 'text-foreground',
              )}
            >
              ${price.toFixed(2)}
            </span>
            <motion.span
              key={isUp ? 'up' : isDown ? 'down' : 'flat'}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className={cn(
                'text-2xl',
                isUp && 'text-emerald-400',
                isDown && 'text-rose-400',
                isFlat && 'text-muted-foreground',
              )}
            >
              {isUp ? '▲' : isDown ? '▼' : '—'}
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bid / Ask / Spread */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Quote label="BID" value={bid} accent="text-rose-400" />
        <Quote label="ASK" value={ask} accent="text-emerald-400" />
        <div className="rounded-lg border border-muted-foreground/15 bg-background/40 p-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Spread</p>
          <p className="font-mono text-base font-bold text-foreground">${spread.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{(spread * 100).toFixed(0)} pips</p>
        </div>
      </div>
    </div>
  )
}

function Quote({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/40 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('font-mono text-base font-bold', accent)}>${value.toFixed(2)}</p>
      <p className="text-[10px] text-muted-foreground">per troy oz</p>
    </div>
  )
}
