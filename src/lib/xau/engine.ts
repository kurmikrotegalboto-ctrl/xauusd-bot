import type { Candle } from './indicators'
import { generatePrediction, type Prediction, type PredictionHistoryItem } from './predictor'
import {
  maybeAutoOpen,
  checkPositions,
  sampleEquity,
  getAccountSnapshot,
  type AccountSnapshot,
} from './positions'

// ============================================================
// XAUUSD Price Engine — singleton, kept alive in module scope
// while the Next.js dev server is running. Drives price ticks,
// 1-minute OHLC candles, and 5-minute predictions.
// ============================================================

const BASE_PRICE = 2380.5
const TICK_MS = 1000
const CANDLE_MS = 60 * 1000
const PREDICTION_MS = 5 * 60 * 1000

type State = {
  price: number
  prevPrice: number
  bid: number
  ask: number
  spread: number
  drift: number
  driftRemaining: number
  currentCandle: Candle
  closedCandles: Candle[]
  lastPrediction: Prediction | null
  predictionHistory: PredictionHistoryItem[]
  lastCandleRoll: number
  lastPredictionTime: number
  started: boolean
}

function freshCandle(time: number, price: number): Candle {
  return { time, open: price, high: price, low: price, close: price, volume: 0 }
}

function seedHistory(state: State) {
  const now = Date.now()
  const startCandleTime = Math.floor(now / CANDLE_MS) * CANDLE_MS - 120 * CANDLE_MS
  let p = BASE_PRICE - 5
  for (let i = 0; i < 120; i++) {
    const t = startCandleTime + i * CANDLE_MS
    const open = p
    let high = p
    let low = p
    let close = p
    const drift = (Math.random() - 0.5) * 0.8
    for (let s = 0; s < 30; s++) {
      const step = (Math.random() - 0.5) * 1.2 + drift * 0.05
      close += step
      if (close > high) high = close
      if (close < low) low = close
    }
    state.closedCandles.push({
      time: t, open, high, low, close,
      volume: Math.floor(500 + Math.random() * 2000),
    })
    p = close
  }
  state.price = p
  state.prevPrice = p
  state.spread = 0.3
  state.bid = p - state.spread / 2
  state.ask = p + state.spread / 2
  state.currentCandle = freshCandle(Math.floor(now / CANDLE_MS) * CANDLE_MS, p)
}

// Singleton state — survives across requests in dev server
const globalForXau = globalThis as unknown as { __xauState?: State }
const state: State = globalForXau.__xauState ?? {
  price: BASE_PRICE,
  prevPrice: BASE_PRICE,
  bid: BASE_PRICE - 0.15,
  ask: BASE_PRICE + 0.15,
  spread: 0.3,
  drift: 0,
  driftRemaining: 0,
  currentCandle: freshCandle(0, BASE_PRICE),
  closedCandles: [],
  lastPrediction: null,
  predictionHistory: [],
  lastCandleRoll: 0,
  lastPredictionTime: 0,
  started: false,
}
if (!globalForXau.__xauState) {
  globalForXau.__xauState = state
  seedHistory(state)
  state.lastCandleRoll = Math.floor(Date.now() / CANDLE_MS) * CANDLE_MS
}

function nextPrice(s: State): number {
  const vol = 0.45
  if (s.driftRemaining <= 0) {
    if (Math.random() < 0.35) {
      s.drift = (Math.random() - 0.5) * 0.18
      s.driftRemaining = Math.floor(20 + Math.random() * 60)
    } else {
      s.drift = 0
      s.driftRemaining = Math.floor(10 + Math.random() * 30)
    }
  }
  s.driftRemaining -= 1
  const noise = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * vol
  let next = s.price + s.drift + noise
  if (Math.random() < 0.004) {
    next += (Math.random() - 0.5) * 6
  }
  if (next < 1500) next = 1500
  if (next > 3500) next = 3500
  s.prevPrice = s.price
  s.price = next
  s.bid = next - s.spread / 2
  s.ask = next + s.spread / 2
  return next
}

function updateCurrentCandle(s: State, price: number) {
  const c = s.currentCandle
  c.close = price
  if (price > c.high) c.high = price
  if (price < c.low) c.low = price
  c.volume += Math.floor(50 + Math.random() * 200)
}

function rollCandle(s: State) {
  s.closedCandles.push(s.currentCandle)
  if (s.closedCandles.length > 500) s.closedCandles.shift()
  s.currentCandle = freshCandle(Math.floor(Date.now() / CANDLE_MS) * CANDLE_MS, s.price)
}

function issuePrediction(s: State) {
  const workingCandles = [...s.closedCandles, s.currentCandle]
  const pred = generatePrediction(workingCandles)
  if (!pred) return
  s.lastPrediction = pred
  s.predictionHistory.unshift({
    prediction: pred,
    actualChangePct: null,
    resolved: false,
    resolvedAt: null,
  })
  if (s.predictionHistory.length > 30) s.predictionHistory.pop()
}

function resolveStalePredictions(s: State) {
  const now = Date.now()
  for (const item of s.predictionHistory) {
    if (item.resolved) continue
    if (now >= item.prediction.validUntil) {
      const change =
        ((s.price - item.prediction.currentPrice) / item.prediction.currentPrice) * 100
      item.actualChangePct = change
      item.resolved = true
      item.resolvedAt = now
    }
  }
}

// Tick function — called by SSE route on each client poll interval
// Returns the latest snapshot
export function tick(): State {
  const s = state
  nextPrice(s)
  updateCurrentCandle(s, s.price)
  const now = Date.now()
  const candleBucket = Math.floor(now / CANDLE_MS) * CANDLE_MS
  let newPrediction = false
  if (candleBucket > s.lastCandleRoll) {
    rollCandle(s)
    s.lastCandleRoll = candleBucket
    if (now - s.lastPredictionTime >= PREDICTION_MS || s.lastPredictionTime === 0) {
      issuePrediction(s)
      s.lastPredictionTime = now
      newPrediction = true
    }
  }
  resolveStalePredictions(s)

  // Paper trading integration — check on every tick, dedupe handled in maybeAutoOpen
  if (s.lastPrediction) {
    const workingCandles = [...s.closedCandles, s.currentCandle]
    maybeAutoOpen(s.lastPrediction, workingCandles)
  }
  checkPositions(s.price)
  sampleEquity(s.price)

  return s
}

// Get paper trading account snapshot
export function getPaperAccount(): AccountSnapshot {
  return getAccountSnapshot(state.price)
}

// Get current snapshot WITHOUT ticking (for first load)
export function snapshot() {
  return state
}

// Issue first prediction if needed (called on first SSE connect)
export function ensureStarted() {
  const s = state
  if (s.lastPredictionTime === 0) {
    issuePrediction(s)
    s.lastPredictionTime = Date.now()
  }
}

export type { Prediction, PredictionHistoryItem }
