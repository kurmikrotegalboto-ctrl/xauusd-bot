import type { Candle } from '../indicators'

// ============================================================
// Price Provider Interface
// Implementations: TwelveData, Alpha Vantage, Polygon, GoldAPI
// Plus a built-in Simulator for fallback when no API key is set.
// ============================================================

export type ProviderInfo = {
  name: string
  mode: 'live' | 'simulation'
  symbol: string
  interval: string // polling interval
  lastFetch: number | null
  lastError: string | null
  callsToday: number
  callsLimit: number | null
}

export type PriceProvider = {
  name: string
  /** Fetch the latest spot price. Returns null on error. */
  fetchPrice(symbol: string): Promise<{ price: number; timestamp: number } | null>
  /** Fetch historical candles for backtest. */
  fetchCandles(symbol: string, interval: string, outputsize: number): Promise<Candle[] | null>
  /** Get current provider info for UI display */
  getInfo(): ProviderInfo
}

// ============================================================
// Provider 1: TwelveData (https://twelvedata.com)
// - Free tier: 8 API calls/min, 800 calls/day
// - Supported intervals: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, ...
// - Symbol for XAUUSD: "XAU/USD"
// - How to get key:
//   1. Daftar di https://twelvedata.com/pricing (klik "Get free API key")
//   2. Verifikasi email
//   3. Key tersedia di dashboard https://twelvedata.com/account/api-keys
//   4. Set env var: TWELVEDATA_API_KEY=your_key_here
// ============================================================

export class TwelveDataProvider implements PriceProvider {
  name = 'TwelveData'
  private apiKey: string
  private callsToday = 0
  private lastFetch: number | null = null
  private lastError: string | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetchPrice(symbol: string) {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.status === 'error') {
        this.lastError = json.message || 'Unknown error'
        return null
      }
      this.lastError = null
      return { price: parseFloat(json.price), timestamp: Date.now() }
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  async fetchCandles(symbol: string, interval: string, outputsize: number) {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${this.apiKey}&format=JSON`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.status === 'error') {
        this.lastError = json.message || 'Unknown error'
        return null
      }
      this.lastError = null
      const values: Array<{
        datetime: string
        open: string
        high: string
        low: string
        close: string
        volume?: string
      }> = json.values || []
      // Reverse to chronological order
      const candles: Candle[] = values
        .slice()
        .reverse()
        .map((v) => ({
          time: new Date(v.datetime + 'Z').getTime(),
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: v.volume ? parseFloat(v.volume) : 0,
        }))
      return candles
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  getInfo(): ProviderInfo {
    return {
      name: this.name,
      mode: 'live',
      symbol: 'XAU/USD',
      interval: '15s polling',
      lastFetch: this.lastFetch,
      lastError: this.lastError,
      callsToday: this.callsToday,
      callsLimit: 800,
    }
  }
}

// ============================================================
// Provider 2: Alpha Vantage (https://www.alphavantage.co)
// - Free tier: 25 API calls per day
// - XAUUSD via CURRENCY_EXCHANGE_RATE (real-time spot)
// - How to get key:
//   1. Daftar di https://www.alphavantage.co/support/#api-key
//   2. Isi form sederhana (email, org)
//   3. Key dikirim ke email
//   4. Set env var: ALPHAVANTAGE_API_KEY=your_key_here
// ============================================================

export class AlphaVantageProvider implements PriceProvider {
  name = 'Alpha Vantage'
  private apiKey: string
  private callsToday = 0
  private lastFetch: number | null = null
  private lastError: string | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetchPrice(symbol: string) {
    // Alpha Vantage uses separate "from" and "to" currencies
    // For XAU/USD: from=XAU, to=USD
    const [from, to] = symbol.split('/')
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${this.apiKey}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.Note) {
        this.lastError = 'Rate limit reached (25/day free)'
        return null
      }
      const rate = json['Realtime Currency Exchange Rate']
      if (!rate) {
        this.lastError = 'No exchange rate in response'
        return null
      }
      this.lastError = null
      return {
        price: parseFloat(rate['5. Exchange Rate']),
        timestamp: Date.now(),
      }
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  async fetchCandles(symbol: string, _interval: string, outputsize: number) {
    const [from, to] = symbol.split('/')
    const fn = outputsize <= 100 ? 'FX_INTRADAY' : 'FX_DAILY'
    const url =
      fn === 'FX_INTRADAY'
        ? `https://www.alphavantage.co/query?function=${fn}&from_symbol=${from}&to_symbol=${to}&interval=1min&outputsize=compact&apikey=${this.apiKey}`
        : `https://www.alphavantage.co/query?function=${fn}&from_symbol=${from}&to_symbol=${to}&outputsize=full&apikey=${this.apiKey}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.Note) {
        this.lastError = 'Rate limit reached'
        return null
      }
      const seriesKey = Object.keys(json).find((k) => k.includes('Time Series'))
      if (!seriesKey) {
        this.lastError = 'No time series in response'
        return null
      }
      const series = json[seriesKey]
      this.lastError = null
      const candles: Candle[] = Object.entries(series)
        .map(([datetime, ohlc]: [string, any]) => ({
          time: new Date(datetime + 'Z').getTime(),
          open: parseFloat(ohlc['1. open']),
          high: parseFloat(ohlc['2. high']),
          low: parseFloat(ohlc['3. low']),
          close: parseFloat(ohlc['4. close']),
          volume: 0,
        }))
        .sort((a, b) => a.time - b.time)
      return candles
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  getInfo(): ProviderInfo {
    return {
      name: this.name,
      mode: 'live',
      symbol: 'XAU/USD',
      interval: '60s polling',
      lastFetch: this.lastFetch,
      lastError: this.lastError,
      callsToday: this.callsToday,
      callsLimit: 25,
    }
  }
}

// ============================================================
// Provider 3: Polygon.io (https://polygon.io)
// - Free tier: 5 API calls/min, unlimited delayed data (15-min)
// - XAUUSD via "C:XAUUSD" (forex) or "O:XAUUSD" (options)
// - How to get key:
//   1. Daftar di https://polygon.io/products/forex (klik "Get Started")
//   2. Pilih "Free" plan
//   3. Key tersedia di dashboard https://polygon.io/dashboard/api-keys
//   4. Set env var: POLYGON_API_KEY=your_key_here
// ============================================================

export class PolygonProvider implements PriceProvider {
  name = 'Polygon.io'
  private apiKey: string
  private callsToday = 0
  private lastFetch: number | null = null
  private lastError: string | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetchPrice(symbol: string) {
    // Last trade for forex
    const url = `https://api.polygon.io/v1/last_quote/currencies/XAU/USD?apiKey=${this.apiKey}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.status === 'ERROR') {
        this.lastError = json.error || 'Unknown error'
        return null
      }
      const last = json.last
      if (!last) {
        this.lastError = 'No last quote'
        return null
      }
      this.lastError = null
      return {
        price: last.bid ?? last.ask ?? last.exchange_rate,
        timestamp: last.timestamp ? last.timestamp * 1000 : Date.now(),
      }
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  async fetchCandles(symbol: string, interval: string, outputsize: number) {
    // Aggregate bars: /v2/aggs/ticker/{ticker}/range/{mult}/{timespan}/{from}/{to}
    // Map interval: "1min" -> mult=1, timespan=minute
    const match = interval.match(/^(\d+)(min|h|day)$/)
    if (!match) return null
    const mult = match[1]
    const timespan = match[2] === 'min' ? 'minute' : match[2] === 'h' ? 'hour' : 'day'
    const ticker = `C:${symbol.replace('/', '')}`
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - outputsize * 60 * 60 * 1000).toISOString().slice(0, 10)
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${mult}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${outputsize}&apiKey=${this.apiKey}`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.status === 'ERROR') {
        this.lastError = json.error || 'Unknown error'
        return null
      }
      this.lastError = null
      const results: Array<{
        t: number
        o: number
        h: number
        l: number
        c: number
        v: number
      }> = json.results || []
      return results.map((r) => ({
        time: r.t,
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
      }))
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  getInfo(): ProviderInfo {
    return {
      name: this.name,
      mode: 'live',
      symbol: 'C:XAUUSD',
      interval: '20s polling',
      lastFetch: this.lastFetch,
      lastError: this.lastError,
      callsToday: this.callsToday,
      callsLimit: null,
    }
  }
}

// ============================================================
// Provider 4: GoldAPI.io (https://goldapi.io)
// - Free tier: 100 API calls per month (good for spot gold only)
// - How to get key:
//   1. Daftar di https://goldapi.io/
//   2. Pilih "Free" plan (100 req/month)
//   3. Key tersedia di dashboard https://www.goldapi.io/api.html
//   4. Set env var: GOLDAPI_API_KEY=your_key_here
// ============================================================

export class GoldApiProvider implements PriceProvider {
  name = 'GoldAPI.io'
  private apiKey: string
  private callsToday = 0
  private lastFetch: number | null = null
  private lastError: string | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetchPrice(symbol: string) {
    const url = `https://www.goldapi.io/api/XAU/USD`
    try {
      const res = await fetch(url, {
        headers: { 'x-access-token': this.apiKey, 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      this.lastFetch = Date.now()
      this.callsToday++
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`
        return null
      }
      const json = await res.json()
      if (json.error) {
        this.lastError = json.error
        return null
      }
      this.lastError = null
      return {
        price: json.price,
        timestamp: json.timestamp ? json.timestamp * 1000 : Date.now(),
      }
    } catch (e) {
      this.lastError = (e as Error).message
      return null
    }
  }

  async fetchCandles(): Promise<Candle[] | null> {
    // GoldAPI doesn't provide historical candles on free tier
    this.lastError = 'GoldAPI historical candles not supported on free tier'
    return null
  }

  getInfo(): ProviderInfo {
    return {
      name: this.name,
      mode: 'live',
      symbol: 'XAU/USD',
      interval: '60s polling',
      lastFetch: this.lastFetch,
      lastError: this.lastError,
      callsToday: this.callsToday,
      callsLimit: 100,
    }
  }
}

// ============================================================
// Factory: read env vars and return the configured provider
// Falls back to null (simulation) if no key is set
// ============================================================

export function createProvider(): PriceProvider | null {
  if (process.env.TWELVEDATA_API_KEY) {
    return new TwelveDataProvider(process.env.TWELVEDATA_API_KEY)
  }
  if (process.env.ALPHAVANTAGE_API_KEY) {
    return new AlphaVantageProvider(process.env.ALPHAVANTAGE_API_KEY)
  }
  if (process.env.POLYGON_API_KEY) {
    return new PolygonProvider(process.env.POLYGON_API_KEY)
  }
  if (process.env.GOLDAPI_API_KEY) {
    return new GoldApiProvider(process.env.GOLDAPI_API_KEY)
  }
  return null
}

export type ConfiguredProvider = {
  provider: PriceProvider | null
  available: ReturnType<typeof createProvider>
}
