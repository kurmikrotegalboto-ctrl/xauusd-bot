import type { Candle } from './indicators'
import {
  rsi, macd, bollinger, stochastic, atr, ema, roc,
} from './indicators'

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

const UPPER = 0.18

export function generatePrediction(candles: Candle[]): Prediction | null {
  if (candles.length < 50) return null

  const closes = candles.map((c) => c.close)
  const last = candles[candles.length - 1]
  const currentPrice = last.close

  const votes: IndicatorVote[] = []

  // RSI(14)
  const rsiVal = rsi(closes, 14)
  if (rsiVal !== null) {
    let sig: Signal = 'HOLD'
    let reason = `RSI ${rsiVal.toFixed(1)} di zona netral`
    if (rsiVal < 30) {
      sig = 'BUY'
      reason = `RSI ${rsiVal.toFixed(1)} — oversold, kemungkinan rebound`
    } else if (rsiVal > 70) {
      sig = 'SELL'
      reason = `RSI ${rsiVal.toFixed(1)} — overbought, kemungkinan koreksi`
    } else if (rsiVal < 45) {
      sig = 'BUY'
      reason = `RSI ${rsiVal.toFixed(1)} — momentum bullish ringan`
    } else if (rsiVal > 55) {
      sig = 'SELL'
      reason = `RSI ${rsiVal.toFixed(1)} — momentum bearish ringan`
    }
    votes.push({
      name: 'RSI (14)',
      signal: sig,
      weight: 0.18,
      reason,
      value: rsiVal.toFixed(2),
    })
  }

  // MACD
  const m = macd(closes, 12, 26, 9)
  if (m.macd !== null && m.signal !== null && m.histogram !== null) {
    let sig: Signal = 'HOLD'
    let reason = 'MACD di sekitar garis sinyal'
    if (m.histogram > 0 && m.macd > m.signal) {
      sig = 'BUY'
      reason = `Histogram +${m.histogram.toFixed(2)}, MACD di atas sinyal — bullish`
    } else if (m.histogram < 0 && m.macd < m.signal) {
      sig = 'SELL'
      reason = `Histogram ${m.histogram.toFixed(2)}, MACD di bawah sinyal — bearish`
    }
    votes.push({
      name: 'MACD (12,26,9)',
      signal: sig,
      weight: 0.2,
      reason,
      value: `${m.macd.toFixed(2)} / ${m.signal.toFixed(2)}`,
    })
  }

  // EMA crossover (9 vs 21)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)
  if (ema9 !== null && ema21 !== null) {
    const diff = ema9 - ema21
    const pct = (diff / ema21) * 100
    let sig: Signal = 'HOLD'
    let reason = `EMA9 ≈ EMA21 (selisih ${pct.toFixed(3)}%)`
    if (pct > 0.05) {
      sig = 'BUY'
      reason = `EMA9 di atas EMA21 +${pct.toFixed(3)}% — tren naik`
    } else if (pct < -0.05) {
      sig = 'SELL'
      reason = `EMA9 di bawah EMA21 ${pct.toFixed(3)}% — tren turun`
    }
    votes.push({
      name: 'EMA Cross (9/21)',
      signal: sig,
      weight: 0.18,
      reason,
      value: `${ema9.toFixed(2)} / ${ema21.toFixed(2)}`,
    })
  }

  // EMA50 trend filter
  const ema50 = ema(closes, 50)
  if (ema50 !== null) {
    const diff = ((currentPrice - ema50) / ema50) * 100
    let sig: Signal = 'HOLD'
    let reason = `Harga dekat EMA50 (selisih ${diff.toFixed(3)}%)`
    if (diff > 0.15) {
      sig = 'BUY'
      reason = `Harga di atas EMA50 +${diff.toFixed(2)}% — tren mayor bullish`
    } else if (diff < -0.15) {
      sig = 'SELL'
      reason = `Harga di bawah EMA50 ${diff.toFixed(2)}% — tren mayor bearish`
    }
    votes.push({
      name: 'EMA50 Trend',
      signal: sig,
      weight: 0.14,
      reason,
      value: ema50.toFixed(2),
    })
  }

  // Bollinger Bands
  const bb = bollinger(closes, 20, 2)
  if (bb.upper !== null && bb.lower !== null && bb.percentB !== null) {
    let sig: Signal = 'HOLD'
    let reason = `Harga di tengah band (%B ${bb.percentB.toFixed(2)})`
    if (bb.percentB < 0.1) {
      sig = 'BUY'
      reason = `Harga menyentuh lower band (%B ${bb.percentB.toFixed(2)}) — oversold`
    } else if (bb.percentB > 0.9) {
      sig = 'SELL'
      reason = `Harga menyentuh upper band (%B ${bb.percentB.toFixed(2)}) — overbought`
    } else if (bb.percentB < 0.35) {
      sig = 'BUY'
      reason = `Harga cenderung lower band (%B ${bb.percentB.toFixed(2)})`
    } else if (bb.percentB > 0.65) {
      sig = 'SELL'
      reason = `Harga cenderung upper band (%B ${bb.percentB.toFixed(2)})`
    }
    votes.push({
      name: 'Bollinger (20,2)',
      signal: sig,
      weight: 0.12,
      reason,
      value: `${bb.lower.toFixed(2)} / ${bb.middle!.toFixed(2)} / ${bb.upper.toFixed(2)}`,
    })
  }

  // Stochastic
  const st = stochastic(candles, 14, 3)
  if (st.k !== null && st.d !== null) {
    let sig: Signal = 'HOLD'
    let reason = `Stochastic netral (K ${st.k.toFixed(1)} / D ${st.d.toFixed(1)})`
    if (st.k < 20 && st.k > st.d) {
      sig = 'BUY'
      reason = `Stochastic oversold & K>D (${st.k.toFixed(1)}) — bullish cross`
    } else if (st.k > 80 && st.k < st.d) {
      sig = 'SELL'
      reason = `Stochastic overbought & K<D (${st.k.toFixed(1)}) — bearish cross`
    } else if (st.k < 30) {
      sig = 'BUY'
      reason = `Stochastic mendekati oversold (${st.k.toFixed(1)})`
    } else if (st.k > 70) {
      sig = 'SELL'
      reason = `Stochastic mendekati overbought (${st.k.toFixed(1)})`
    }
    votes.push({
      name: 'Stochastic (14,3)',
      signal: sig,
      weight: 0.1,
      reason,
      value: `${st.k.toFixed(2)} / ${st.d.toFixed(2)}`,
    })
  }

  // ROC
  const roc10 = roc(closes, 10)
  if (roc10 !== null) {
    let sig: Signal = 'HOLD'
    let reason = `ROC ${roc10.toFixed(3)}% — flat`
    if (roc10 > 0.15) {
      sig = 'BUY'
      reason = `ROC +${roc10.toFixed(3)}% — momentum naik`
    } else if (roc10 < -0.15) {
      sig = 'SELL'
      reason = `ROC ${roc10.toFixed(3)}% — momentum turun`
    }
    votes.push({
      name: 'ROC (10)',
      signal: sig,
      weight: 0.08,
      reason,
      value: `${roc10.toFixed(3)}%`,
    })
  }

  // Aggregate
  let weighted = 0
  let totalWeight = 0
  for (const v of votes) {
    const s = v.signal === 'BUY' ? 1 : v.signal === 'SELL' ? -1 : 0
    weighted += s * v.weight
    totalWeight += v.weight
  }
  const score = totalWeight > 0 ? weighted / totalWeight : 0
  const absScore = Math.abs(score)
  let signal: Signal = 'HOLD'
  if (score > UPPER) signal = 'BUY'
  else if (score < -UPPER) signal = 'SELL'

  const confidence = Math.min(95, Math.round(absScore * 100 * 1.6 + 25))
  const atrVal = atr(candles, 14)
  const direction = signal === 'BUY' ? 1 : signal === 'SELL' ? -1 : 0
  const expectedMove = atrVal ? atrVal * 0.6 * Math.sqrt(5) * direction : 0
  const targetPrice = atrVal ? currentPrice + expectedMove : null

  const bullCount = votes.filter((v) => v.signal === 'BUY').length
  const bearCount = votes.filter((v) => v.signal === 'SELL').length
  const summary =
    signal === 'HOLD'
      ? `Sinyal netral — ${bullCount} bullish vs ${bearCount} bearish dari ${votes.length} indikator. Tunggu konfirmasi.`
      : signal === 'BUY'
        ? `Bias BULLISH — ${bullCount}/${votes.length} indikator naik. Target 5 menit: ${targetPrice ? targetPrice.toFixed(2) : '—'}`
        : `Bias BEARISH — ${bearCount}/${votes.length} indikator turun. Target 5 menit: ${targetPrice ? targetPrice.toFixed(2) : '—'}`

  return {
    signal,
    confidence,
    score,
    targetPrice,
    currentPrice,
    timeframe: '5m',
    validUntil: Date.now() + 5 * 60 * 1000,
    votes,
    summary,
  }
}
