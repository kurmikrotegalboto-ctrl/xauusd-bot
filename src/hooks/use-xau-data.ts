'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================================
// XAUUSD data hook — Polling-based (Vercel serverless compatible)
// Polls /api/xau/poll every 2 seconds. Falls back to in-memory only
// if Redis not configured (still works, just no persistence).
// ============================================================

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
  timeframe: string
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

const POLL_INTERVAL_MS = 2000
const RECONNECT_DELAY_MS = 5000

export function useXauData() {
  const [data, setData] = useState<XauData>(initial)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/xau/poll', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const p = await res.json()
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
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Poll failed')
      setData((d) => ({ ...d, connected: false }))
    }
  }, [])

  const start = useCallback(() => {
    if (timerRef.current) return
    stoppedRef.current = false
    poll()  // immediate first poll
    timerRef.current = setInterval(() => {
      if (stoppedRef.current) return
      poll()
    }, POLL_INTERVAL_MS)
  }, [poll])

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reconnect = useCallback(() => {
    stop()
    setTimeout(() => start(), 100)
  }, [start, stop])

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return { data, error, reconnect }
}
