// ============================================================
// Paper Trading System for XAUUSD Bot
// Virtual balance + auto-open positions + P&L tracking
// Singleton store — survives across requests in dev server
// ============================================================

import type { Prediction, Signal } from './predictor'
import { atr } from './indicators'
import type { Candle } from './indicators'
import { redisGet, redisSet, redisDel } from './redis-client'

// ---- Types ----

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
  lotSize: number // 1 lot = 100 oz
  riskAmount: number // $ at risk if SL hit
  pnl: number | null // realized $ P&L
  pnlPct: number | null // % of risk (R-multiple)
  exitReason: ExitReason | null
  confidence: number
  summary: string
  maxFavorablePct: number // best R during life
  maxAdversePct: number // worst R during life
  durationMs: number | null
}

export type EquityPoint = {
  time: number
  equity: number
  balance: number
}

export type PaperTradeConfig = {
  startingBalance: number
  riskPerTradePct: number // % of balance risked per trade
  maxOpenPositions: number
  minConfidence: number // 0-100
  minIndicatorAgreement: number // count of agreeing indicators
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
  profitFactor: number // sum wins / sum losses
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  currentStreak: number // + win streak, - loss streak
  maxWinStreak: number
  maxLossStreak: number
  avgRMultiple: number
  byExitReason: Record<ExitReason, number>
  bySide: { BUY: number; SELL: number }
}

export type AccountSnapshot = {
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

// ---- Default config ----

export const DEFAULT_CONFIG: PaperTradeConfig = {
  startingBalance: 10000,
  riskPerTradePct: 1.0,
  maxOpenPositions: 3,
  minConfidence: 60,
  minIndicatorAgreement: 4,
  atrSlMultiplier: 1.2,
  atrTpMultiplier: 1.8,
  positionExpiryMs: 30 * 60 * 1000, // 30 minutes
  autoTradeEnabled: true,
}

// ---- Singleton store ----

const REDIS_KEY = 'xauusd:paper:v1'

type Store = {
  balance: number
  config: PaperTradeConfig
  openPositions: Position[]
  closedPositions: Position[]
  equityCurve: EquityPoint[]
  lastEquitySample: number
  lastSignalTime: number // dedupe: don't open same side within 60s
  lastAutoTradePrice: number
  _loaded: boolean
}

const globalForPaper = globalThis as unknown as {
  __xauPaper?: Store
  __xauPaperLoadPromise?: Promise<void>
}

function createStore(): Store {
  return {
    balance: DEFAULT_CONFIG.startingBalance,
    config: { ...DEFAULT_CONFIG },
    openPositions: [],
    closedPositions: [],
    equityCurve: [],
    lastEquitySample: 0,
    lastSignalTime: 0,
    lastAutoTradePrice: 0,
    _loaded: false,
  }
}

const store: Store = globalForPaper.__xauPaper ?? createStore()
if (!globalForPaper.__xauPaper) {
  globalForPaper.__xauPaper = store
  // Kick off async load from Redis on first module import
  if (!globalForPaper.__xauPaperLoadPromise) {
    globalForPaper.__xauPaperLoadPromise = loadFromRedis()
  }
}

// Load persisted state from Redis (called once on startup)
async function loadFromRedis(): Promise<void> {
  const data = await redisGet<Partial<Store>>(REDIS_KEY)
  if (data) {
    if (typeof data.balance === 'number') store.balance = data.balance
    if (data.config) store.config = { ...DEFAULT_CONFIG, ...data.config }
    if (Array.isArray(data.openPositions)) store.openPositions = data.openPositions
    if (Array.isArray(data.closedPositions)) store.closedPositions = data.closedPositions
    if (Array.isArray(data.equityCurve)) store.equityCurve = data.equityCurve
    if (typeof data.lastEquitySample === 'number') store.lastEquitySample = data.lastEquitySample
    if (typeof data.lastSignalTime === 'number') store.lastSignalTime = data.lastSignalTime
    if (typeof data.lastAutoTradePrice === 'number') store.lastAutoTradePrice = data.lastAutoTradePrice
    console.log(`[paper] Loaded from Redis: balance=$${store.balance}, open=${store.openPositions.length}, closed=${store.closedPositions.length}`)
  } else {
    // Seed initial equity point if nothing in Redis
    if (store.equityCurve.length === 0) {
      store.equityCurve.push({
        time: Date.now(),
        equity: store.balance,
        balance: store.balance,
      })
    }
    console.log('[paper] No data in Redis, starting fresh')
  }
  store._loaded = true
}

// Debounced save (avoid spamming Redis on every tick)
let saveTimer: NodeJS.Timeout | null = null
let lastSaveTime = 0
const SAVE_DEBOUNCE_MS = 3000 // save at most every 3 seconds

export function saveToRedis(force = false): void {
  const now = Date.now()
  if (!force && now - lastSaveTime < SAVE_DEBOUNCE_MS) {
    // Schedule a save after debounce window
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null
        saveToRedis(true)
      }, SAVE_DEBOUNCE_MS)
    }
    return
  }
  lastSaveTime = now
  // Fire-and-forget async save
  void (async () => {
    await redisSet(REDIS_KEY, {
      balance: store.balance,
      config: store.config,
      openPositions: store.openPositions,
      closedPositions: store.closedPositions.slice(-500), // cap to last 500
      equityCurve: store.equityCurve.slice(-500),
      lastEquitySample: store.lastEquitySample,
      lastSignalTime: store.lastSignalTime,
      lastAutoTradePrice: store.lastAutoTradePrice,
    })
  })()
}

// ---- Helpers ----

const CONTRACT_SIZE = 100 // 1 lot XAUUSD = 100 oz, $1 move = $100 per lot

function calcLotSize(balance: number, riskPct: number, slDistance: number): number {
  if (slDistance <= 0) return 0
  const riskAmount = balance * (riskPct / 100)
  const lossPerLot = slDistance * CONTRACT_SIZE
  if (lossPerLot <= 0) return 0
  return Math.max(0.01, riskAmount / lossPerLot)
}

function calcFloatingPnl(currentPrice: number): number {
  return store.openPositions.reduce((sum, p) => {
    const diff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
    return sum + diff * p.lotSize * CONTRACT_SIZE
  }, 0)
}

function calcMarginUsed(): number {
  // Rough margin estimate: 1% of notional per lot (leverage 1:100)
  return store.openPositions.reduce((sum, p) => {
    return sum + p.entryPrice * p.lotSize * CONTRACT_SIZE * 0.01
  }, 0)
}

function calcStats(): PositionStats {
  const closed = store.closedPositions
  if (closed.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl: 0,
      totalRisked: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      currentStreak: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      avgRMultiple: 0,
      byExitReason: { TP: 0, SL: 0, EXPIRED: 0, MANUAL: 0 },
      bySide: { BUY: 0, SELL: 0 },
    }
  }

  const wins = closed.filter((p) => (p.pnl ?? 0) > 0)
  const losses = closed.filter((p) => (p.pnl ?? 0) <= 0)
  const totalPnl = closed.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const totalRisked = closed.reduce((s, p) => s + p.riskAmount, 0)
  const grossWin = wins.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + (p.pnl ?? 0), 0))
  const winRate = (wins.length / closed.length) * 100
  const avgRMultiple =
    closed.reduce((s, p) => s + (p.pnlPct ?? 0), 0) / closed.length

  // Streaks
  let currentStreak = 0
  for (let i = closed.length - 1; i >= 0; i--) {
    const pnl = closed[i].pnl ?? 0
    if (pnl > 0) {
      if (currentStreak >= 0) currentStreak++
      else break
    } else {
      if (currentStreak <= 0) currentStreak--
      else break
    }
  }

  let maxWinStreak = 0
  let maxLossStreak = 0
  let curWin = 0
  let curLoss = 0
  for (const p of closed) {
    if ((p.pnl ?? 0) > 0) {
      curWin++
      curLoss = 0
      if (curWin > maxWinStreak) maxWinStreak = curWin
    } else {
      curLoss++
      curWin = 0
      if (curLoss > maxLossStreak) maxLossStreak = curLoss
    }
  }

  const byExitReason: Record<ExitReason, number> = { TP: 0, SL: 0, EXPIRED: 0, MANUAL: 0 }
  for (const p of closed) {
    if (p.exitReason) byExitReason[p.exitReason]++
  }
  const bySide = { BUY: 0, SELL: 0 }
  for (const p of closed) {
    bySide[p.side]++
  }

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    totalRisked,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99.99 : 0,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    bestTrade: Math.max(0, ...closed.map((p) => p.pnl ?? 0)),
    worstTrade: Math.min(0, ...closed.map((p) => p.pnl ?? 0)),
    currentStreak,
    maxWinStreak,
    maxLossStreak,
    avgRMultiple,
    byExitReason,
    bySide,
  }
}

// ---- Public API ----

export function maybeAutoOpen(prediction: Prediction | null, candles: Candle[]): Position | null {
  if (!prediction) return null
  if (!store.config.autoTradeEnabled) return null
  if (prediction.signal === 'HOLD') return null
  if (store.openPositions.length >= store.config.maxOpenPositions) return null

  // Strategy filter — confidence
  if (prediction.confidence < store.config.minConfidence) return null

  // Indicator agreement
  const agreeCount = prediction.votes.filter(
    (v) => v.signal === prediction.signal,
  ).length
  if (agreeCount < store.config.minIndicatorAgreement) return null

  // Dedupe — don't open same side within 60 seconds
  const now = Date.now()
  if (now - store.lastSignalTime < 60 * 1000) return null

  // Need ATR for SL/TP
  const atrVal = atr(candles, 14)
  if (!atrVal || atrVal < 0.3) return null

  const currentPrice = prediction.currentPrice
  const side: PositionSide = prediction.signal as PositionSide

  // Calculate SL/TP based on ATR
  const slDistance = atrVal * store.config.atrSlMultiplier
  const tpDistance = atrVal * store.config.atrTpMultiplier
  const sl = side === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance
  const tp = side === 'BUY' ? currentPrice + tpDistance : currentPrice - tpDistance

  // Lot size based on risk
  const lotSize = calcLotSize(store.balance, store.config.riskPerTradePct, slDistance)
  if (lotSize < 0.01) return null
  const riskAmount = store.balance * (store.config.riskPerTradePct / 100)

  const position: Position = {
    id: `P-${now}-${Math.random().toString(36).slice(2, 7)}`,
    side,
    openTime: now,
    closeTime: null,
    entryPrice: currentPrice,
    exitPrice: null,
    stopLoss: sl,
    takeProfit: tp,
    lotSize,
    riskAmount,
    pnl: null,
    pnlPct: null,
    exitReason: null,
    confidence: prediction.confidence,
    summary: prediction.summary,
    maxFavorablePct: 0,
    maxAdversePct: 0,
    durationMs: null,
  }

  store.openPositions.push(position)
  store.lastSignalTime = now
  store.lastAutoTradePrice = currentPrice
  saveToRedis()
  return position
}

export function checkPositions(currentPrice: number): Position[] {
  const now = Date.now()
  const justClosed: Position[] = []

  for (let i = store.openPositions.length - 1; i >= 0; i--) {
    const p = store.openPositions[i]
    let exitPrice: number | null = null
    let reason: ExitReason | null = null

    // Check SL/TP hit
    if (p.side === 'BUY') {
      if (currentPrice <= p.stopLoss) {
        exitPrice = p.stopLoss
        reason = 'SL'
      } else if (currentPrice >= p.takeProfit) {
        exitPrice = p.takeProfit
        reason = 'TP'
      }
    } else {
      if (currentPrice >= p.stopLoss) {
        exitPrice = p.stopLoss
        reason = 'SL'
      } else if (currentPrice <= p.takeProfit) {
        exitPrice = p.takeProfit
        reason = 'TP'
      }
    }

    // Check expiry
    if (!exitPrice && now - p.openTime >= store.config.positionExpiryMs) {
      exitPrice = currentPrice
      reason = 'EXPIRED'
    }

    if (exitPrice && reason) {
      const diff = p.side === 'BUY' ? exitPrice - p.entryPrice : p.entryPrice - exitPrice
      const pnl = diff * p.lotSize * CONTRACT_SIZE
      const pnlPct = (pnl / p.riskAmount) * 100 // R-multiple as %

      // Update max favorable/adverse
      const favorableDiff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
      const adverseDiff = -favorableDiff
      const favorablePct = (favorableDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      const adversePct = (adverseDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      if (favorablePct > p.maxFavorablePct) p.maxFavorablePct = favorablePct
      if (adversePct > p.maxAdversePct) p.maxAdversePct = adversePct

      p.closeTime = now
      p.exitPrice = exitPrice
      p.exitReason = reason
      p.pnl = pnl
      p.pnlPct = pnlPct
      p.durationMs = now - p.openTime

      // Update balance
      store.balance += pnl

      store.closedPositions.push(p)
      justClosed.push(p)
      store.openPositions.splice(i, 1)
    } else {
      // Update running favorable/adverse for open positions
      const favorableDiff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
      const adverseDiff = -favorableDiff
      const favorablePct = (favorableDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      const adversePct = (adverseDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      if (favorablePct > p.maxFavorablePct) p.maxFavorablePct = favorablePct
      if (adversePct > p.maxAdversePct) p.maxAdversePct = adversePct
    }
  }

  if (justClosed.length > 0) saveToRedis()
  return justClosed
}

export function sampleEquity(currentPrice: number) {
  const now = Date.now()
  if (now - store.lastEquitySample < 30 * 1000) return // 30s sampling
  store.lastEquitySample = now
  const floating = calcFloatingPnl(currentPrice)
  store.equityCurve.push({
    time: now,
    equity: store.balance + floating,
    balance: store.balance,
  })
  if (store.equityCurve.length > 500) store.equityCurve.shift()
  saveToRedis()
}

export function closeAllManual(currentPrice: number): number {
  let count = 0
  for (let i = store.openPositions.length - 1; i >= 0; i--) {
    const p = store.openPositions[i]
    const diff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
    const pnl = diff * p.lotSize * CONTRACT_SIZE
    const pnlPct = (pnl / p.riskAmount) * 100
    p.closeTime = Date.now()
    p.exitPrice = currentPrice
    p.exitReason = 'MANUAL'
    p.pnl = pnl
    p.pnlPct = pnlPct
    p.durationMs = p.closeTime - p.openTime
    store.balance += pnl
    store.closedPositions.push(p)
    store.openPositions.splice(i, 1)
    count++
  }
  if (count > 0) saveToRedis(true)
  return count
}

export function closePositionManual(id: string, currentPrice: number): boolean {
  const idx = store.openPositions.findIndex((p) => p.id === id)
  if (idx === -1) return false
  const p = store.openPositions[idx]
  const diff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
  const pnl = diff * p.lotSize * CONTRACT_SIZE
  const pnlPct = (pnl / p.riskAmount) * 100
  p.closeTime = Date.now()
  p.exitPrice = currentPrice
  p.exitReason = 'MANUAL'
  p.pnl = pnl
  p.pnlPct = pnlPct
  p.durationMs = p.closeTime - p.openTime
  store.balance += pnl
  store.closedPositions.push(p)
  store.openPositions.splice(idx, 1)
  saveToRedis(true)
  return true
}

export function resetAccount() {
  store.balance = store.config.startingBalance
  store.openPositions = []
  store.closedPositions = []
  store.equityCurve = [
    { time: Date.now(), equity: store.balance, balance: store.balance },
  ]
  store.lastSignalTime = 0
  store.lastAutoTradePrice = 0
  saveToRedis(true)
}

export function deposit(amount: number) {
  if (amount <= 0) return
  store.balance += amount
  store.equityCurve.push({
    time: Date.now(),
    equity: store.balance + calcFloatingPnl(0),
    balance: store.balance,
  })
  saveToRedis(true)
}

export function withdraw(amount: number): boolean {
  if (amount <= 0 || amount > store.balance) return false
  store.balance -= amount
  store.equityCurve.push({
    time: Date.now(),
    equity: store.balance + calcFloatingPnl(0),
    balance: store.balance,
  })
  saveToRedis(true)
  return true
}

export function updateConfig(partial: Partial<PaperTradeConfig>) {
  store.config = { ...store.config, ...partial }
  // If startingBalance changed and no trades yet, reset balance
  if (
    partial.startingBalance !== undefined &&
    store.closedPositions.length === 0 &&
    store.openPositions.length === 0
  ) {
    store.balance = partial.startingBalance
    store.equityCurve = [
      { time: Date.now(), equity: store.balance, balance: store.balance },
    ]
  }
  saveToRedis(true)
}

export function getAccountSnapshot(currentPrice: number): AccountSnapshot {
  const floating = calcFloatingPnl(currentPrice)
  const marginUsed = calcMarginUsed()
  return {
    balance: store.balance,
    equity: store.balance + floating,
    floatingPnl: floating,
    freeMargin: store.balance + floating - marginUsed,
    marginUsed,
    openCount: store.openPositions.length,
    config: { ...store.config },
    openPositions: [...store.openPositions],
    recentClosed: store.closedPositions.slice(-30).reverse(),
    equityCurve: [...store.equityCurve],
    stats: calcStats(),
  }
}

export function getOpenPositions(): Position[] {
  return [...store.openPositions]
}

export function getClosedPositions(limit = 50): Position[] {
  return store.closedPositions.slice(-limit).reverse()
}

export function getConfig(): PaperTradeConfig {
  return { ...store.config }
}
