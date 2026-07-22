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
      // EventSource will auto-reconnect; no need to manually close
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
            lastUpdate: p.serverTime,
          })
        } else if (msg.type === 'tick') {
          const p = msg.data
          setData((d) => {
            // Update the forming (last) candle; push new candles when time changes
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
