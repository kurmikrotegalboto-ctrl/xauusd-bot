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
import { createProvider, type PriceProvider, type ProviderInfo } from './providers'

const BASE_PRICE = 2380.5  // fallback only if real price fetch fails on cold start
const CANDLE_MS = 60 * 1000
const PREDICTION_MS = 5 * 60 * 1000
const REAL_PRICE_TTL_MS = 30 * 1000  // fetch real price at most every 30s
const PRICE_CACHE_KEY = 'xauusd:realprice:v1'
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
  // Real price tracking
  realPrice: number | null  // last fetched real price from API
  realPriceAt: number  // timestamp when realPrice was fetched
  realPriceSource: string  // provider name (for UI display)
  realPriceError: string | null  // last error from real price fetch
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
    realPrice: null,
    realPriceAt: 0,
    realPriceSource: 'simulation',
    realPriceError: null,
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

// Mean-reverting random walk toward real price (anchored).
// If realPrice is set, price will gradually drift toward it.
// Between fetches, micro-ticks provide realistic movement.
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

  // Mean reversion: pull price toward realPrice (if known & fresh)
  if (s.realPrice && s.realPrice > 0) {
    const ageMs = Date.now() - s.realPriceAt
    // Stronger pull when realPrice is fresh, weaker as it ages
    const reversionStrength = Math.max(0, 0.15 * (1 - ageMs / (5 * 60 * 1000)))
    const gap = s.realPrice - next
    next += gap * reversionStrength
  }

  // Wide bounds — real XAUUSD can range $1000–$5000+
  if (next < 1000) next = 1000
  if (next > 6000) next = 6000
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
  // Real price metadata for UI display
  realPrice: number | null
  realPriceAt: number | null
  realPriceSource: string
  realPriceError: string | null
  realPriceAgeMs: number | null
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
    realPrice: s.realPrice,
    realPriceAt: s.realPriceAt ? s.realPriceAt : null,
    realPriceSource: s.realPriceSource,
    realPriceError: s.realPriceError,
    realPriceAgeMs: s.realPriceAt ? Date.now() - s.realPriceAt : null,
  }
}

// ---- Real price fetching (cached in Redis) ----

let _provider: PriceProvider | null | undefined
function getProvider(): PriceProvider | null {
  if (_provider === undefined) {
    _provider = createProvider()
    if (_provider) {
      console.log(`[engine] Price provider: ${_provider.name}`)
    } else {
      console.log('[engine] No price provider configured — using simulation only')
    }
  }
  return _provider
}

type CachedPrice = {
  price: number
  timestamp: number
  source: string
  error: string | null
}

async function getCachedRealPrice(): Promise<CachedPrice | null> {
  return stateGet<CachedPrice>(PRICE_CACHE_KEY)
}

async function setCachedRealPrice(c: CachedPrice): Promise<void> {
  // TTL 5 minutes — old data is better than no data
  await stateSet(PRICE_CACHE_KEY, c, 300)
}

async function fetchRealPriceIfNeeded(s: State): Promise<void> {
  const provider = getProvider()
  if (!provider) {
    s.realPriceSource = 'simulation'
    return
  }

  const now = Date.now()
  const ageMs = s.realPriceAt ? now - s.realPriceAt : Infinity
  if (ageMs < REAL_PRICE_TTL_MS && s.realPrice) {
    // Still fresh — no fetch needed
    return
  }

  // Check shared cache first (multiple serverless instances share Redis)
  const cached = await getCachedRealPrice()
  if (cached && now - cached.timestamp < REAL_PRICE_TTL_MS) {
    s.realPrice = cached.price
    s.realPriceAt = cached.timestamp
    s.realPriceSource = cached.source
    s.realPriceError = cached.error
    return
  }

  // Fetch fresh from provider (with timeout)
  try {
    const result = await provider.fetchPrice('XAU/USD')
    if (result && typeof result.price === 'number' && result.price > 0) {
      s.realPrice = result.price
      s.realPriceAt = result.timestamp || now
      s.realPriceSource = provider.name
      s.realPriceError = null
      await setCachedRealPrice({
        price: result.price,
        timestamp: s.realPriceAt,
        source: s.realPriceSource,
        error: null,
      })
      console.log(`[engine] Fetched real price: $${result.price} from ${provider.name}`)
    } else {
      // Provider returned null (error) — keep last known real price if any
      s.realPriceSource = provider.name
      s.realPriceError = provider.getInfo().lastError
      // If we never had a real price, snap to it on first failure (cold start)
      if (!s.realPrice && cached) {
        s.realPrice = cached.price
        s.realPriceAt = cached.timestamp
        s.realPriceSource = cached.source
      }
    }
  } catch (e) {
    s.realPriceError = (e as Error).message
    console.error('[engine] Real price fetch error:', s.realPriceError)
  }
}

/**
 * Tick the engine and return current snapshot.
 * Acquires a distributed lock to prevent concurrent ticks.
 * If lock unavailable, returns current state without ticking.
 */
export async function tickAsync(): Promise<EngineSnapshot> {
  return withLock(LOCK_KEY, async () => {
    const s = await loadState()
    
    // Fetch real price (cached, no-op if fresh) BEFORE ticking
    // so mean-reversion uses the latest anchor
    await fetchRealPriceIfNeeded(s)
    
    // On cold start with real price fetched, snap immediately
    if (s.realPrice && s.realPriceAt && !s.started && s.price === BASE_PRICE) {
      const diff = Math.abs(s.price - s.realPrice)
      if (diff > 50) {  // only snap if simulation is way off
        console.log(`[engine] Cold start snap: $${s.price} → $${s.realPrice}`)
        s.price = s.realPrice
        s.prevPrice = s.realPrice
        s.bid = s.realPrice - s.spread / 2
        s.ask = s.realPrice + s.spread / 2
        s.currentCandle = freshCandle(Math.floor(Date.now() / CANDLE_MS) * CANDLE_MS, s.realPrice)
      }
    }
    
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
