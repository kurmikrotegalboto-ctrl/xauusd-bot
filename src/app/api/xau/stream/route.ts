import { NextRequest } from 'next/server'
import { tick, ensureStarted, snapshot, getPaperAccount } from '@/lib/xau/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory ticker — runs once per second server-side regardless of clients
let tickerInterval: NodeJS.Timeout | null = null
let lastTickTime = 0

function startTicker() {
  if (tickerInterval) return
  tickerInterval = setInterval(() => {
    tick()
    lastTickTime = Date.now()
  }, 1000)
  if (tickerInterval.unref) tickerInterval.unref()
}

ensureStarted()
startTicker()

function buildPaperData() {
  const acc = getPaperAccount()
  return {
    balance: acc.balance,
    equity: acc.equity,
    floatingPnl: acc.floatingPnl,
    freeMargin: acc.freeMargin,
    marginUsed: acc.marginUsed,
    openCount: acc.openCount,
    config: acc.config,
    openPositions: acc.openPositions,
    recentClosed: acc.recentClosed.slice(0, 20),
    equityCurve: acc.equityCurve.slice(-200),
    stats: acc.stats,
  }
}

export async function GET(_req: NextRequest) {
  const s = snapshot()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot
      const initial = {
        type: 'snapshot',
        data: {
          price: s.price,
          prevPrice: s.prevPrice,
          bid: s.bid,
          ask: s.ask,
          spread: s.spread,
          changePct:
            s.closedCandles.length > 0
              ? ((s.price - s.closedCandles[s.closedCandles.length - 1].open) /
                  s.closedCandles[s.closedCandles.length - 1].open) *
                100
              : 0,
          candles: s.closedCandles.slice(-120).concat(s.currentCandle),
          prediction: s.lastPrediction,
          history: s.predictionHistory.slice(0, 12),
          paper: buildPaperData(),
          serverTime: Date.now(),
        },
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))

      // Stream updates every second
      const interval = setInterval(() => {
        try {
          const current = snapshot()
          const payload = {
            type: 'tick',
            data: {
              price: current.price,
              prevPrice: current.prevPrice,
              bid: current.bid,
              ask: current.ask,
              spread: current.spread,
              changePct:
                current.closedCandles.length > 0
                  ? ((current.price - current.closedCandles[current.closedCandles.length - 1].open) /
                      current.closedCandles[current.closedCandles.length - 1].open) *
                    100
                  : 0,
              currentCandle: current.currentCandle,
              prediction: current.lastPrediction,
              history: current.predictionHistory.slice(0, 12),
              paper: buildPaperData(),
              ts: Date.now(),
            },
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch (e) {
          clearInterval(interval)
        }
      }, 1000)

      const cancel = () => {
        clearInterval(interval)
      }
      ;(controller as unknown as { cancel?: () => void }).cancel = cancel
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
