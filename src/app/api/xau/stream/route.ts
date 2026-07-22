import { NextRequest } from 'next/server'
import { tick, ensureStarted, snapshot } from '@/lib/xau/engine'

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
  // Don't keep the process alive just for the ticker
  if (tickerInterval.unref) tickerInterval.unref()
}

// Start on first module load
ensureStarted()
startTicker()

export async function GET(_req: NextRequest) {
  const s = snapshot()

  // SSE stream
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
              ts: Date.now(),
            },
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch (e) {
          // client disconnected
          clearInterval(interval)
        }
      }, 1000)

      // Cleanup on cancel
      const cancel = () => {
        clearInterval(interval)
      }
      // ReadableStream cancel hook
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
