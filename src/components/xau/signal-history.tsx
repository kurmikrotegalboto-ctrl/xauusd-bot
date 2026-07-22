'use client'

import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { PredictionHistoryItem } from '@/hooks/use-xau-data'
import { cn } from '@/lib/utils'

type Props = {
  history: PredictionHistoryItem[]
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function outcome(pred: PredictionHistoryItem): 'win' | 'loss' | 'pending' {
  if (!pred.resolved || pred.actualChangePct === null) return 'pending'
  const expectedUp = pred.prediction.signal === 'BUY'
  const expectedDown = pred.prediction.signal === 'SELL'
  if (pred.prediction.signal === 'HOLD') {
    // HOLD is "win" if change is small (< 0.05%)
    return Math.abs(pred.actualChangePct) < 0.05 ? 'win' : 'loss'
  }
  if (expectedUp && pred.actualChangePct > 0) return 'win'
  if (expectedDown && pred.actualChangePct < 0) return 'win'
  return 'loss'
}

export function SignalHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4 text-center text-sm text-muted-foreground">
        Belum ada riwayat sinyal. Sinyal baru diterbitkan setiap 5 menit.
      </div>
    )
  }

  const wins = history.filter((h) => outcome(h) === 'win').length
  const losses = history.filter((h) => outcome(h) === 'loss').length
  const pending = history.filter((h) => outcome(h) === 'pending').length
  const resolved = wins + losses
  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Riwayat Sinyal</h3>
          <p className="text-[11px] text-muted-foreground">Prediksi 5 menit terakhir & hasil aktual</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-400">
            Win: {wins}
          </span>
          <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-400">
            Loss: {losses}
          </span>
          <span className="rounded border border-muted-foreground/20 bg-muted/30 px-1.5 py-0.5 font-mono text-muted-foreground">
            {pending} pending
          </span>
        </div>
      </div>

      {/* Win rate bar */}
      {resolved > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Win Rate (resolved)</span>
            <span className="font-mono font-bold text-foreground">{winRate.toFixed(1)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/30">
            <div className="bg-emerald-500" style={{ width: `${winRate}%` }} />
            <div className="bg-rose-500" style={{ width: `${100 - winRate}%` }} />
          </div>
        </div>
      )}

      {/* History list */}
      <div className="thin-scroll max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {history.map((item, i) => {
          const sig = item.prediction.signal
          const result = outcome(item)
          const sigTheme =
            sig === 'BUY'
              ? { text: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: TrendingUp }
              : sig === 'SELL'
                ? { text: 'text-rose-400', bg: 'bg-rose-500/10', Icon: TrendingDown }
                : { text: 'text-amber-400', bg: 'bg-amber-500/10', Icon: Minus }
          const { Icon } = sigTheme
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-muted-foreground/15 bg-background/30 px-2.5 py-1.5"
            >
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', sigTheme.bg)}>
                <Icon className={cn('h-3.5 w-3.5', sigTheme.text)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-xs font-bold', sigTheme.text)}>{sig}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {fmtTime(item.prediction.validUntil - 5 * 60 * 1000)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                  <span>
                    conf {item.prediction.confidence}% • entry ${item.prediction.currentPrice.toFixed(2)}
                  </span>
                  {result === 'pending' ? (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Clock className="h-2.5 w-2.5" /> pending
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 font-mono',
                        result === 'win' ? 'text-emerald-400' : 'text-rose-400',
                      )}
                    >
                      {result === 'win' ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : (
                        <XCircle className="h-2.5 w-2.5" />
                      )}
                      {item.actualChangePct! >= 0 ? '+' : ''}
                      {item.actualChangePct!.toFixed(3)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
