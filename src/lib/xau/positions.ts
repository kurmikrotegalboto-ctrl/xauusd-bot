// ============================================================
// Paper Trading System for XAUUSD Bot — Vercel Serverless Edition
// All state in Redis. Every operation: load → mutate → save.
// No globalThis singletons, no in-memory cache.
// ============================================================

import type { Prediction, Signal } from './predictor'
import { atr } from './indicators'
import type { Candle } from './indicators'
import { stateGet, stateSet, stateDel } from './redis-state'

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

export type EquityPoint = {
  time: number
  equity: number
  balance: number
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

export const DEFAULT_CONFIG: PaperTradeConfig = {
  startingBalance: 10000,
  riskPerTradePct: 1.0,
  maxOpenPositions: 3,
  minConfidence: 60,
  minIndicatorAgreement: 4,
  atrSlMultiplier: 1.2,
  atrTpMultiplier: 1.8,
  positionExpiryMs: 30 * 60 * 1000,
  autoTradeEnabled: true,
}

// ---- Redis-backed store ----

const REDIS_KEY = 'xauusd:paper:v1'

type Store = {
  balance: number
  config: PaperTradeConfig
  openPositions: Position[]
  closedPositions: Position[]
  equityCurve: EquityPoint[]
  lastEquitySample: number
  lastSignalTime: number
  lastAutoTradePrice: number
}

function freshStore(): Store {
  const store: Store = {
    balance: DEFAULT_CONFIG.startingBalance,
    config: { ...DEFAULT_CONFIG },
    openPositions: [],
    closedPositions: [],
    equityCurve: [
      { time: Date.now(), equity: DEFAULT_CONFIG.startingBalance, balance: DEFAULT_CONFIG.startingBalance },
    ],
    lastEquitySample: 0,
    lastSignalTime: 0,
    lastAutoTradePrice: 0,
  }
  return store
}

async function loadStore(): Promise<Store> {
  const data = await stateGet<Partial<Store>>(REDIS_KEY)
  if (data && typeof data.balance === 'number') {
    return {
      balance: data.balance,
      config: { ...DEFAULT_CONFIG, ...(data.config ?? {}) },
      openPositions: Array.isArray(data.openPositions) ? data.openPositions : [],
      closedPositions: Array.isArray(data.closedPositions) ? data.closedPositions : [],
      equityCurve: Array.isArray(data.equityCurve) ? data.equityCurve : [],
      lastEquitySample: typeof data.lastEquitySample === 'number' ? data.lastEquitySample : 0,
      lastSignalTime: typeof data.lastSignalTime === 'number' ? data.lastSignalTime : 0,
      lastAutoTradePrice: typeof data.lastAutoTradePrice === 'number' ? data.lastAutoTradePrice : 0,
    }
  }
  // Fresh init
  const fresh = freshStore()
  await stateSet(REDIS_KEY, fresh)
  console.log('[paper] Seeded fresh store to Redis')
  return fresh
}

async function saveStore(store: Store): Promise<void> {
  await stateSet(REDIS_KEY, {
    balance: store.balance,
    config: store.config,
    openPositions: store.openPositions,
    closedPositions: store.closedPositions.slice(-500),
    equityCurve: store.equityCurve.slice(-500),
    lastEquitySample: store.lastEquitySample,
    lastSignalTime: store.lastSignalTime,
    lastAutoTradePrice: store.lastAutoTradePrice,
  })
}

// ---- Helpers (operate on a store instance) ----

const CONTRACT_SIZE = 100

function calcLotSize(balance: number, riskPct: number, slDistance: number): number {
  if (slDistance <= 0) return 0
  const riskAmount = balance * (riskPct / 100)
  const lossPerLot = slDistance * CONTRACT_SIZE
  if (lossPerLot <= 0) return 0
  return Math.max(0.01, riskAmount / lossPerLot)
}

function calcFloatingPnl(store: Store, currentPrice: number): number {
  return store.openPositions.reduce((sum, p) => {
    const diff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
    return sum + diff * p.lotSize * CONTRACT_SIZE
  }, 0)
}

function calcMarginUsed(store: Store): number {
  return store.openPositions.reduce((sum, p) => {
    return sum + p.entryPrice * p.lotSize * CONTRACT_SIZE * 0.01
  }, 0)
}

function calcStats(store: Store): PositionStats {
  const closed = store.closedPositions
  if (closed.length === 0) {
    return {
      totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, totalRisked: 0,
      profitFactor: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0,
      currentStreak: 0, maxWinStreak: 0, maxLossStreak: 0, avgRMultiple: 0,
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
  const avgRMultiple = closed.reduce((s, p) => s + (p.pnlPct ?? 0), 0) / closed.length

  let currentStreak = 0
  for (let i = closed.length - 1; i >= 0; i--) {
    const pnl = closed[i].pnl ?? 0
    if (pnl > 0) { if (currentStreak >= 0) currentStreak++; else break }
    else { if (currentStreak <= 0) currentStreak--; else break }
  }
  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0
  for (const p of closed) {
    if ((p.pnl ?? 0) > 0) { curWin++; curLoss = 0; if (curWin > maxWinStreak) maxWinStreak = curWin }
    else { curLoss++; curWin = 0; if (curLoss > maxLossStreak) maxLossStreak = curLoss }
  }
  const byExitReason: Record<ExitReason, number> = { TP: 0, SL: 0, EXPIRED: 0, MANUAL: 0 }
  for (const p of closed) { if (p.exitReason) byExitReason[p.exitReason]++ }
  const bySide = { BUY: 0, SELL: 0 }
  for (const p of closed) { bySide[p.side]++ }

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

function buildSnapshot(store: Store, currentPrice: number): AccountSnapshot {
  const floating = calcFloatingPnl(store, currentPrice)
  const marginUsed = calcMarginUsed(store)
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
    stats: calcStats(store),
  }
}

// ---- Public Async API ----

export async function maybeAutoOpenAsync(
  prediction: Prediction | null,
  candles: Candle[],
): Promise<Position | null> {
  if (!prediction) return null
  const store = await loadStore()
  if (!store.config.autoTradeEnabled) return null
  if (prediction.signal === 'HOLD') return null
  if (store.openPositions.length >= store.config.maxOpenPositions) return null
  if (prediction.confidence < store.config.minConfidence) return null

  const agreeCount = prediction.votes.filter((v) => v.signal === prediction.signal).length
  if (agreeCount < store.config.minIndicatorAgreement) return null

  const now = Date.now()
  if (now - store.lastSignalTime < 60 * 1000) return null

  const atrVal = atr(candles, 14)
  if (!atrVal || atrVal < 0.3) return null

  const currentPrice = prediction.currentPrice
  const side: PositionSide = prediction.signal as PositionSide
  const slDistance = atrVal * store.config.atrSlMultiplier
  const tpDistance = atrVal * store.config.atrTpMultiplier
  const sl = side === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance
  const tp = side === 'BUY' ? currentPrice + tpDistance : currentPrice - tpDistance
  const lotSize = calcLotSize(store.balance, store.config.riskPerTradePct, slDistance)
  if (lotSize < 0.01) return null
  const riskAmount = store.balance * (store.config.riskPerTradePct / 100)

  const position: Position = {
    id: `P-${now}-${Math.random().toString(36).slice(2, 7)}`,
    side, openTime: now, closeTime: null,
    entryPrice: currentPrice, exitPrice: null,
    stopLoss: sl, takeProfit: tp,
    lotSize, riskAmount,
    pnl: null, pnlPct: null, exitReason: null,
    confidence: prediction.confidence, summary: prediction.summary,
    maxFavorablePct: 0, maxAdversePct: 0, durationMs: null,
  }

  store.openPositions.push(position)
  store.lastSignalTime = now
  store.lastAutoTradePrice = currentPrice
  await saveStore(store)
  return position
}

export async function checkPositionsAsync(currentPrice: number): Promise<Position[]> {
  const store = await loadStore()
  const now = Date.now()
  const justClosed: Position[] = []
  let changed = false

  for (let i = store.openPositions.length - 1; i >= 0; i--) {
    const p = store.openPositions[i]
    let exitPrice: number | null = null
    let reason: ExitReason | null = null

    if (p.side === 'BUY') {
      if (currentPrice <= p.stopLoss) { exitPrice = p.stopLoss; reason = 'SL' }
      else if (currentPrice >= p.takeProfit) { exitPrice = p.takeProfit; reason = 'TP' }
    } else {
      if (currentPrice >= p.stopLoss) { exitPrice = p.stopLoss; reason = 'SL' }
      else if (currentPrice <= p.takeProfit) { exitPrice = p.takeProfit; reason = 'TP' }
    }

    if (!exitPrice && now - p.openTime >= store.config.positionExpiryMs) {
      exitPrice = currentPrice
      reason = 'EXPIRED'
    }

    if (exitPrice && reason) {
      const diff = p.side === 'BUY' ? exitPrice - p.entryPrice : p.entryPrice - exitPrice
      const pnl = diff * p.lotSize * CONTRACT_SIZE
      const pnlPct = (pnl / p.riskAmount) * 100

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
      store.balance += pnl
      store.closedPositions.push(p)
      justClosed.push(p)
      store.openPositions.splice(i, 1)
      changed = true
    } else {
      const favorableDiff = p.side === 'BUY' ? currentPrice - p.entryPrice : p.entryPrice - currentPrice
      const adverseDiff = -favorableDiff
      const favorablePct = (favorableDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      const adversePct = (adverseDiff * p.lotSize * CONTRACT_SIZE / p.riskAmount) * 100
      if (favorablePct > p.maxFavorablePct) { p.maxFavorablePct = favorablePct; changed = true }
      if (adversePct > p.maxAdversePct) { p.maxAdversePct = adversePct; changed = true }
    }
  }

  if (changed) await saveStore(store)
  return justClosed
}

export async function sampleEquityAsync(currentPrice: number): Promise<void> {
  const store = await loadStore()
  const now = Date.now()
  if (now - store.lastEquitySample < 30 * 1000) return
  store.lastEquitySample = now
  const floating = calcFloatingPnl(store, currentPrice)
  store.equityCurve.push({
    time: now,
    equity: store.balance + floating,
    balance: store.balance,
  })
  if (store.equityCurve.length > 500) store.equityCurve.shift()
  await saveStore(store)
}

export async function closeAllManualAsync(currentPrice: number): Promise<number> {
  const store = await loadStore()
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
  if (count > 0) await saveStore(store)
  return count
}

export async function closePositionManualAsync(id: string, currentPrice: number): Promise<boolean> {
  const store = await loadStore()
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
  await saveStore(store)
  return true
}

export async function resetAccountAsync(): Promise<void> {
  const store = freshStore()
  await saveStore(store)
}

export async function depositAsync(amount: number): Promise<void> {
  if (amount <= 0) return
  const store = await loadStore()
  store.balance += amount
  store.equityCurve.push({
    time: Date.now(),
    equity: store.balance + calcFloatingPnl(store, 0),
    balance: store.balance,
  })
  await saveStore(store)
}

export async function withdrawAsync(amount: number): Promise<boolean> {
  if (amount <= 0) return false
  const store = await loadStore()
  if (amount > store.balance) return false
  store.balance -= amount
  store.equityCurve.push({
    time: Date.now(),
    equity: store.balance + calcFloatingPnl(store, 0),
    balance: store.balance,
  })
  await saveStore(store)
  return true
}

export async function updateConfigAsync(partial: Partial<PaperTradeConfig>): Promise<void> {
  const store = await loadStore()
  store.config = { ...store.config, ...partial }
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
  await saveStore(store)
}

export async function getAccountSnapshotAsync(currentPrice: number): Promise<AccountSnapshot> {
  const store = await loadStore()
  return buildSnapshot(store, currentPrice)
}

export async function wipeRedisAsync(): Promise<void> {
  await stateDel(REDIS_KEY)
}

// ---- Backward-compat for old callers (still used by old paper-trade/route.ts) ----
// These are DEPRECATED — use Async versions instead
export const deposit = depositAsync
export const withdraw = withdrawAsync
export const resetAccount = resetAccountAsync
export const updateConfig = updateConfigAsync
export const closeAllManual = closeAllManualAsync
export const closePositionManual = closePositionManualAsync
export const getAccountSnapshot = getAccountSnapshotAsync
