'use client'

import { useState, useMemo } from 'react'
import { Calculator, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import type { Prediction } from '@/hooks/use-xau-data'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

type Props = {
  prediction: Prediction | null
  currentPrice: number
}

export function RiskCalculator({ prediction, currentPrice }: Props) {
  const [accountBalance, setAccountBalance] = useState(10000)
  const [riskPct, setRiskPct] = useState(1)
  const [leverage, setLeverage] = useState(100)

  const calc = useMemo(() => {
    if (!prediction || !prediction.atrValue || !prediction.stopLoss) {
      return null
    }

    const riskAmount = accountBalance * (riskPct / 100)
    // Stop distance in price
    const stopDistance = Math.abs(currentPrice - prediction.stopLoss)
    if (stopDistance === 0) return null

    // For XAUUSD: 1 lot = 100 oz, so $1 move = $100 P/L per lot
    // Position size in oz = riskAmount / stopDistance
    const positionOz = riskAmount / stopDistance
    // Convert to lots (100 oz per lot)
    const positionLots = positionOz / 100
    // Notional value
    const notional = positionOz * currentPrice
    // Margin required
    const margin = notional / leverage
    // Margin level %
    const marginLevel = (accountBalance / margin) * 100
    // Take profit amount
    const tpDistance = prediction.takeProfit
      ? Math.abs(prediction.takeProfit - currentPrice)
      : 0
    const potentialProfit = positionOz * tpDistance
    // Risk-to-reward
    const rr = tpDistance > 0 ? tpDistance / stopDistance : 0

    return {
      riskAmount,
      stopDistance,
      positionOz,
      positionLots,
      notional,
      margin,
      marginLevel,
      potentialProfit,
      rr,
    }
  }, [prediction, accountBalance, riskPct, leverage, currentPrice])

  const isBuy = prediction?.signal === 'BUY'
  const isSell = prediction?.signal === 'SELL'

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold tracking-tight">Kalkulator Manajemen Risiko</h3>
      </div>

      <div className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="balance" className="text-[11px] text-muted-foreground">
              Saldo Akun ($)
            </Label>
            <Input
              id="balance"
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(Math.max(0, Number(e.target.value)))}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="leverage" className="text-[11px] text-muted-foreground">
              Leverage (1:X)
            </Label>
            <Input
              id="leverage"
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(Math.max(1, Number(e.target.value)))}
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">
              Risk Per Trade
            </Label>
            <span className="font-mono text-xs font-bold text-amber-400">{riskPct.toFixed(1)}%</span>
          </div>
          <Slider
            value={[riskPct]}
            onValueChange={(v) => setRiskPct(v[0])}
            min={0.5}
            max={5}
            step={0.5}
            className="mt-2"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0.5% (aman)</span>
            <span>2% (standar)</span>
            <span>5% (agresif)</span>
          </div>
        </div>

        {/* Current signal reference */}
        {prediction && (
          <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Berdasarkan Sinyal Aktif
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Entry</p>
                <p className="font-mono text-sm font-bold">${currentPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Stop Loss</p>
                <p className={cn('font-mono text-sm font-bold', 'text-rose-400')}>
                  ${prediction.stopLoss?.toFixed(2) ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Take Profit</p>
                <p className={cn('font-mono text-sm font-bold', 'text-emerald-400')}>
                  ${prediction.takeProfit?.toFixed(2) ?? '—'}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px]">
              {isBuy ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : isSell ? (
                <TrendingDown className="h-3 w-3 text-rose-400" />
              ) : null}
              <span className={cn(
                'font-semibold',
                isBuy && 'text-emerald-400',
                isSell && 'text-rose-400',
                !isBuy && !isSell && 'text-amber-400',
              )}>
                {prediction.signal}
              </span>
              <span className="text-muted-foreground">
                • ATR ${prediction.atrValue?.toFixed(2) ?? '—'} • R:R {prediction.riskRewardRatio?.toFixed(2) ?? '—'}
              </span>
            </div>
          </div>
        )}

        {/* Results */}
        {calc ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ResultCard
                label="Risk / Trade"
                value={`$${calc.riskAmount.toFixed(2)}`}
                accent="text-rose-400"
              />
              <ResultCard
                label="Potensi Profit"
                value={`$${calc.potentialProfit.toFixed(2)}`}
                accent="text-emerald-400"
              />
              <ResultCard
                label="Position Size"
                value={`${calc.positionOz.toFixed(2)} oz`}
                sub={`${calc.positionLots.toFixed(3)} lot`}
                accent="text-amber-400"
              />
              <ResultCard
                label="Margin Req."
                value={`$${calc.margin.toFixed(2)}`}
                sub={`Leverage 1:${leverage}`}
                accent="text-sky-400"
              />
              <ResultCard
                label="Stop Distance"
                value={`$${calc.stopDistance.toFixed(2)}`}
                sub={`${(calc.stopDistance * 100).toFixed(0)} pips`}
                accent="text-muted-foreground"
              />
              <ResultCard
                label="R:R Ratio"
                value={`1:${calc.rr.toFixed(2)}`}
                sub={calc.rr >= 1.5 ? 'good' : calc.rr >= 1 ? 'ok' : 'poor'}
                accent={calc.rr >= 1.5 ? 'text-emerald-400' : calc.rr >= 1 ? 'text-amber-400' : 'text-rose-400'}
              />
            </div>

            {/* Notional & margin level */}
            <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Notional Value</span>
                <span className="font-mono font-bold">${calc.notional.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Margin Level</span>
                <span className={cn(
                  'font-mono font-bold',
                  calc.marginLevel > 500 ? 'text-emerald-400' : calc.marginLevel > 200 ? 'text-amber-400' : 'text-rose-400',
                )}>
                  {calc.marginLevel.toFixed(0)}%
                </span>
              </div>
            </div>

            {riskPct > 2 && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-[11px] leading-relaxed text-rose-200/80">
                  Risk per trade &gt; 2% dianggap agresif. Professional trader umumnya risk 0.5–1%
                  per posisi untuk survive dalam jangka panjang.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-4 text-center text-xs text-muted-foreground">
            Menunggu sinyal aktif untuk perhitungan otomatis…
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-muted-foreground/15 bg-background/30 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('font-mono text-sm font-bold', accent)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
