'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Candle, Prediction } from '@/hooks/use-xau-data'

type Props = {
  candles: Candle[]
  prediction: Prediction | null
}

type ChartPoint = {
  time: number
  label: string
  close: number
  high: number
  low: number
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PriceChart({ candles, prediction }: Props) {
  if (candles.length === 0) {
    return (
      <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4 text-center text-sm text-muted-foreground">
        Menunggu data harga…
      </div>
    )
  }

  // Use last 60 candles for chart clarity
  const recent = candles.slice(-60)
  const data: ChartPoint[] = recent.map((c) => ({
    time: c.time,
    label: fmtTime(c.time),
    close: c.close,
    high: c.high,
    low: c.low,
  }))

  const prices = data.map((d) => d.close)
  const min = Math.min(...prices, ...(prediction?.targetPrice ? [prediction.targetPrice] : []))
  const max = Math.max(...prices, ...(prediction?.targetPrice ? [prediction.targetPrice] : []))
  const pad = (max - min) * 0.15 || 1
  const yMin = min - pad
  const yMax = max + pad

  const lastClose = prices[prices.length - 1]
  const firstClose = prices[0]
  const trendUp = lastClose >= firstClose
  const lineColor = trendUp ? '#10b981' : '#f43f5e'
  const gradientId = trendUp ? 'goldGradUp' : 'goldGradDown'

  const targetPrice = prediction?.targetPrice ?? null
  const isBuyTarget = targetPrice !== null && targetPrice > lastClose
  const isSellTarget = targetPrice !== null && targetPrice < lastClose

  return (
    <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Chart Harga 1 Menit</h3>
          <p className="text-[11px] text-muted-foreground">
            {recent.length} candle • area chart close price
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: lineColor }}
            />
            <span className="text-muted-foreground">Close</span>
          </div>
          {targetPrice !== null && (
            <div className="flex items-center gap-1">
              <span
                className={cnDot(
                  'inline-block h-2 w-2 rounded-full',
                  isBuyTarget ? 'bg-emerald-400' : 'bg-rose-400',
                )}
              />
              <span className="text-muted-foreground">Target 5m</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGradUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="goldGradDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#888' }}
              interval={Math.floor(data.length / 6)}
              axisLine={{ stroke: '#444' }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: '#888' }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(20, 20, 22, 0.95)',
                border: '1px solid #444',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#aaa', fontSize: '11px' }}
              formatter={(value: number, name: string) => [
                `$${value.toFixed(2)}`,
                name === 'close' ? 'Close' : name,
              ]}
            />
            {targetPrice !== null && (
              <ReferenceLine
                y={targetPrice}
                stroke={isBuyTarget ? '#10b981' : '#f43f5e'}
                strokeDasharray="4 4"
                label={{
                  value: `Target $${targetPrice.toFixed(2)}`,
                  position: 'right',
                  fill: isBuyTarget ? '#10b981' : '#f43f5e',
                  fontSize: 10,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function cnDot(...args: string[]) {
  return args.filter(Boolean).join(' ')
}
