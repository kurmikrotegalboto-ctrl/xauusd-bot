// ============================================================
// XAUUSD Price Engine — Vercel Serverless Edition
// All state lives in Redis. Each poll request loads → ticks → saves.
// No setInterval, no globalThis singletons, no in-memory state.
// ============================================================

import type { Candle } from './indicators'
import { generatePrediction, type Prediction, type PredictionHistoryItem } from './predictor'
import {
  maybeAutoOpenAsync,
  checkPositionsAsync,
  sampleEquityAsync,
  getAccountSnapshotAsync,
  type AccountSnapshot,
} from './positions'
import { stateGet, stateSet, withLock } from './redis-state'

const BASE_PRICE = 2380.5
const CANDLE_MS = 60 * 1000
const PREDICTION_MS = 5 * 60 * 1000
const REDIS_KEY = 'xauusd:engine:v1'
const LOCK_KEY = 'xauusd:engine:lock'

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
  lastTickTime: number
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
  state.lastCandleRoll = Math.floor(now / CANDLE_MS) * CANDLE_MS
  state.lastTickTime = now
  state.started = true
}

function freshState(): State {
  const base: State = {
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
    lastTickTime: 0,
    started: false,
  }
  seedHistory(base)
  // Issue first prediction immediately
  const workingCandles = [...base.closedCandles, base.currentCandle]
  const pred = generatePrediction(workingCandles)
  if (pred) {
    base.lastPrediction = pred
    base.predictionHistory.unshift({
      prediction: pred,
      actualChangePct: null,
      resolved: false,
      resolvedAt: null,
    })
    base.lastPredictionTime = Date.now()
  }
  return base
}

async function loadState(): Promise<State> {
  const data = await stateGet<State>(REDIS_KEY)
  if (data && typeof data.price === 'number') {
    return data
  }
  // Initialize fresh
  const fresh = freshState()
  await stateSet(REDIS_KEY, fresh)
  console.log('[engine] Seeded fresh state to Redis')
  return fresh
}

async function saveState(state: State): Promise<void> {
  await stateSet(REDIS_KEY, state)
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

export type EngineSnapshot = {
  price: number
  prevPrice: number
  bid: number
  ask: number
  spread: number
  changePct: number
  candles: Candle[]
  prediction: Prediction | null
  history: PredictionHistoryItem[]
  paper: AccountSnapshot | null
  serverTime: number
}

function buildSnapshot(s: State, paper: AccountSnapshot | null): EngineSnapshot {
  return {
    price: s.price,
    prevPrice: s.prevPrice,
    bid: s.bid,
    ask: s.ask,
    spread: s.spread,
    changePct:
      s.closedCandles.length > 0
        ? ((s.price - s.closedCandles[s.closedCandles.length - 1].open) /
            s.closedCandles[s.closedCandles.length - 1].open) * 100
        : 0,
    candles: s.closedCandles.slice(-120).concat(s.currentCandle),
    prediction: s.lastPrediction,
    history: s.predictionHistory.slice(0, 12),
    paper,
    serverTime: Date.now(),
  }
}

// ---- Public async API ----

/**
 * Tick the engine and return current snapshot.
 * Acquires a distributed lock to prevent concurrent ticks.
 * If lock unavailable, returns current state without ticking.
 */
export async function tickAsync(): Promise<EngineSnapshot> {
  return withLock(LOCK_KEY, async () => {
    const s = await loadState()
    nextPrice(s)
    updateCurrentCandle(s, s.price)
    const now = Date.now()
    const candleBucket = Math.floor(now / CANDLE_MS) * CANDLE_MS
    if (candleBucket > s.lastCandleRoll) {
      rollCandle(s)
      s.lastCandleRoll = candleBucket
      if (now - s.lastPredictionTime >= PREDICTION_MS || s.lastPredictionTime === 0) {
        issuePrediction(s)
        s.lastPredictionTime = now
      }
    }
    resolveStalePredictions(s)
    s.lastTickTime = now
    await saveState(s)

    // Paper trading integration (uses same lock context)
    if (s.lastPrediction) {
      const workingCandles = [...s.closedCandles, s.currentCandle]
      await maybeAutoOpenAsync(s.lastPrediction, workingCandles)
    }
    await checkPositionsAsync(s.price)
    await sampleEquityAsync(s.price)

    const paper = await getAccountSnapshotAsync(s.price)
    return buildSnapshot(s, paper)
  })
}

/**
 * Get current snapshot WITHOUT ticking (for paper-trade POST endpoints).
 * Still ticks once to ensure fresh price data.
 */
export async function getSnapshotAsync(): Promise<EngineSnapshot> {
  return tickAsync()
}

export type { Prediction, PredictionHistoryItem }
