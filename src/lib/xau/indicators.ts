// Technical Analysis Indicators (shared between client and server)
// Pure functions operating on arrays of numbers

export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
  }
  return prev
}

export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  if (values.length < period) return values.map(() => null)
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null)
      continue
    }
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period
      prev = seed
      out.push(seed)
    } else {
      prev = values[i] * k + prev * (1 - k)
      out.push(prev)
    }
  }
  return out
}

export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export type MacdResult = {
  macd: number | null
  signal: number | null
  histogram: number | null
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (values.length < slow + signalPeriod) {
    return { macd: null, signal: null, histogram: null }
  }
  const fastSeries = emaSeries(values, fast)
  const slowSeries = emaSeries(values, slow)
  const macdLine: (number | null)[] = fastSeries.map((f, i) => {
    const s = slowSeries[i]
    if (f === null || s === null) return null
    return f - s
  })
  const macdValues: number[] = []
  macdLine.forEach((v) => {
    if (v !== null) macdValues.push(v)
  })
  const signalEma = emaSeries(macdValues, signalPeriod)
  const lastSignal = signalEma[signalEma.length - 1]
  const lastMacd = macdValues[macdValues.length - 1]
  return {
    macd: lastMacd ?? null,
    signal: lastSignal ?? null,
    histogram:
      lastMacd !== undefined && lastSignal !== null && lastSignal !== undefined
        ? lastMacd - lastSignal
        : null,
  }
}

export type BollingerResult = {
  upper: number | null
  middle: number | null
  lower: number | null
  bandwidth: number | null
  percentB: number | null
}

export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  if (values.length < period) {
    return { upper: null, middle: null, lower: null, bandwidth: null, percentB: null }
  }
  const slice = values.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const sd = Math.sqrt(variance)
  const upper = mean + mult * sd
  const lower = mean - mult * sd
  const last = values[values.length - 1]
  return {
    upper,
    middle: mean,
    lower,
    bandwidth: sd === 0 ? 0 : (upper - lower) / mean,
    percentB: sd === 0 ? 0.5 : (last - lower) / (upper - lower),
  }
}

export type StochasticResult = { k: number | null; d: number | null }

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): StochasticResult {
  if (candles.length < kPeriod + dPeriod - 1) {
    return { k: null, d: null }
  }
  const ks: number[] = []
  for (let i = 0; i < dPeriod; i++) {
    const idx = candles.length - dPeriod + i
    const window = candles.slice(idx - kPeriod + 1, idx + 1)
    const highs = window.map((c) => c.high)
    const lows = window.map((c) => c.low)
    const hh = Math.max(...highs)
    const ll = Math.min(...lows)
    const close = candles[idx].close
    const k = hh === ll ? 50 : ((close - ll) / (hh - ll)) * 100
    ks.push(k)
  }
  const k = ks[ks.length - 1]
  const d = ks.reduce((a, b) => a + b, 0) / ks.length
  return { k, d }
}

export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const prev = candles[i - 1]
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    )
    trs.push(tr)
  }
  const lastTrs = trs.slice(-period)
  return lastTrs.reduce((a, b) => a + b, 0) / period
}

export function roc(values: number[], period = 10): number | null {
  if (values.length < period + 1) return null
  const a = values[values.length - 1]
  const b = values[values.length - 1 - period]
  if (b === 0) return null
  return ((a - b) / b) * 100
}
