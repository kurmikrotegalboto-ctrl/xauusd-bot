'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Prediction, IndicatorVote, Signal } from '@/hooks/use-xau-data'
import { cn } from '@/lib/utils'

type Props = {
  prediction: Prediction | null
}

function signalTheme(s: Signal) {
  if (s === 'BUY') {
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      Icon: TrendingUp,
      label: 'BUY',
    }
  }
  if (s === 'SELL') {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      Icon: TrendingDown,
      label: 'SELL',
    }
  }
  return {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    Icon: Minus,
    label: 'HOLD',
  }
}

export function IndicatorPanel({ prediction }: Props) {
  if (!prediction || prediction.votes.length === 0) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4 text-center text-sm text-muted-foreground">
        Menunggu data indikator…
      </div>
    )
  }

  const bullCount = prediction.votes.filter((v) => v.signal === 'BUY').length
  const bearCount = prediction.votes.filter((v) => v.signal === 'SELL').length
  const holdCount = prediction.votes.filter((v) => v.signal === 'HOLD').length

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Indikator Teknikal</h3>
          <p className="text-[11px] text-muted-foreground">{prediction.votes.length} indikator • voting berbobot</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
            <TrendingUp className="h-3 w-3" /> {bullCount}
          </span>
          <span className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
            <TrendingDown className="h-3 w-3" /> {bearCount}
          </span>
          <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
            <Minus className="h-3 w-3" /> {holdCount}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {prediction.votes.map((v) => (
          <VoteRow key={v.name} vote={v} />
        ))}
      </div>

      {/* Weight legend */}
      <div className="mt-4 border-t border-muted-foreground/10 pt-3">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Distribusi Bobot</p>
        <div className="flex h-2 overflow-hidden rounded-full">
          {prediction.votes
            .filter((v) => v.signal !== 'HOLD')
            .map((v, i) => (
              <div
                key={i}
                className={cn(
                  v.signal === 'BUY' ? 'bg-emerald-500/70' : 'bg-rose-500/70',
                )}
                style={{ width: `${v.weight * 100}%` }}
                title={`${v.name} (${v.signal}, w=${v.weight})`}
              />
            ))}
          <div className="flex-1 bg-amber-500/30" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Bearish</span>
          <span>Netral</span>
          <span>Bullish</span>
        </div>
      </div>
    </div>
  )
}

function VoteRow({ vote }: { vote: IndicatorVote }) {
  const theme = signalTheme(vote.signal)
  const { Icon } = theme
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-background/30 px-3 py-2 transition-colors',
        theme.border,
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', theme.bg)}>
        <Icon className={cn('h-4 w-4', theme.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{vote.name}</p>
          <span className="font-mono text-[11px] text-muted-foreground">{vote.value}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{vote.reason}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', theme.text)}>
          {theme.label}
        </span>
        <span className="text-[9px] text-muted-foreground">w={vote.weight.toFixed(2)}</span>
      </div>
    </div>
  )
}
