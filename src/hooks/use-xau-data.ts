'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Signal = 'BUY' | 'SELL' | 'HOLD'

export type IndicatorVote = {
  name: string
  signal: Signal
  weight: number
  reason: string
  value: string
}

export type Prediction = {
  signal: Signal
  confidence: number
  score: number
  targetPrice: number | null
  currentPrice: number
  timeframe: '5m'
  validUntil: number
  votes: IndicatorVote[]
  summary: string
}

export type PredictionHistoryItem = {
  prediction: Prediction
  actualChangePct: number | null
  resolved: boolean
  resolvedAt: number | null
}

// Paper trading types (mirror of server-side positions.ts)
export type PositionSide = 'BUY' | 'SELL'
export type ExitReason = 'TP' | 'SL' | 'EXPIRED' | 'MANUAL'

export type Position = {
  id: string
  side: PositionSide
  openTime: number
  closeTime: number | null
  entryPrice: number
  exitPrice: number | null
  stopLoss: number
  takeProfit: number
  lotSize: number
  riskAmount: number
  pnl: number | null
  pnlPct: number | null
  exitReason: ExitReason | null
  confidence: number
  summary: string
  maxFavorablePct: number
  maxAdversePct: number
  durationMs: number | null
}

export type PaperTradeConfig = {
  startingBalance: number
  riskPerTradePct: number
  maxOpenPositions: number
  minConfidence: number
  minIndicatorAgreement: number
  atrSlMultiplier: number
  atrTpMultiplier: number
  positionExpiryMs: number
  autoTradeEnabled: boolean
}

export type PositionStats = {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  totalRisked: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  currentStreak: number
  maxWinStreak: number
  maxLossStreak: number
  avgRMultiple: number
  byExitReason: Record<ExitReason, number>
  bySide: { BUY: number; SELL: number }
}

export type EquityPoint = {
  time: number
  equity: number
  balance: number
}

export type PaperData = {
  balance: number
  equity: number
  floatingPnl: number
  freeMargin: number
  marginUsed: number
  openCount: number
  config: PaperTradeConfig
  openPositions: Position[]
  recentClosed: Position[]
  equityCurve: EquityPoint[]
  stats: PositionStats
}

export type XauData = {
  connected: boolean
  price: number
  prevPrice: number
  bid: number
  ask: number
  spread: number
  changePct: number
  candles: Candle[]
  prediction: Prediction | null
  history: PredictionHistoryItem[]
  paper: PaperData | null
  lastUpdate: number
}

const initial: XauData = {
  connected: false,
  price: 0,
  prevPrice: 0,
  bid: 0,
  ask: 0,
  spread: 0,
  changePct: 0,
  candles: [],
  prediction: null,
  history: [],
  paper: null,
  lastUpdate: 0,
}

export function useXauData() {
  const [data, setData] = useState<XauData>(initial)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    const es = new EventSource('/api/xau/stream')
    esRef.current = es

    es.onopen = () => {
      setError(null)
      setData((d) => ({ ...d, connected: true }))
    }

    es.onerror = () => {
      setError('Koneksi SSE terputus, mencoba reconnect...')
      setData((d) => ({ ...d, connected: false }))
    }

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'snapshot') {
          const p = msg.data
          setData({
            connected: true,
            price: p.price,
            prevPrice: p.prevPrice,
            bid: p.bid,
            ask: p.ask,
            spread: p.spread,
            changePct: p.changePct,
            candles: p.candles,
            prediction: p.prediction,
            history: p.history,
            paper: p.paper ?? null,
            lastUpdate: p.serverTime,
          })
        } else if (msg.type === 'tick') {
          const p = msg.data
          setData((d) => {
            const candles = [...d.candles]
            const lastCandle = candles[candles.length - 1]
            if (lastCandle && p.currentCandle.time === lastCandle.time) {
              candles[candles.length - 1] = p.currentCandle
            } else if (lastCandle && p.currentCandle.time > lastCandle.time) {
              candles.push(p.currentCandle)
              if (candles.length > 200) candles.shift()
            }
            return {
              ...d,
              connected: true,
              price: p.price,
              prevPrice: p.prevPrice,
              bid: p.bid,
              ask: p.ask,
              spread: p.spread,
              changePct: p.changePct,
              candles,
              prediction: p.prediction ?? d.prediction,
              history: p.history ?? d.history,
              paper: p.paper ?? d.paper,
              lastUpdate: p.ts,
            }
          })
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  return { data, error, reconnect }
}
