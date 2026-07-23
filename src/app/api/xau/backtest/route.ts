import { NextRequest, NextResponse } from 'next/server'
import { snapshot, backtest, TIMEFRAMES } from '@/lib/xau/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tfId: string = body.tfId || '5m'
    const minConfidence: number = body.minConfidence || 0

    const tf = TIMEFRAMES.find((t) => t.id === tfId)
    if (!tf) {
      return NextResponse.json(
        { error: `Timeframe tidak dikenal: ${tfId}` },
        { status: 400 },
      )
    }

    const s = snapshot()
    // Use full base candles (180 minutes) + current candle
    const allCandles = [...s.baseCandles, s.currentCandle]

    // Run backtest
    const results = backtest(allCandles, tf.aggregator, tf.id, tf.validMinutes, minConfidence)

    if (results.length === 0) {
      return NextResponse.json({
        result: {
          totalTrades: 0,
          wins: 0,
          losses: 0,
          neutrals: 0,
          winRate: 0,
          avgChangePct: 0,
          bestTradePct: 0,
          worstTradePct: 0,
          expectancy: 0,
          equityCurve: [{ trade: 0, equity: 1000 }],
          signalDistribution: [],
          trades: [],
        },
      })
    }

    // Aggregate stats
    const wins = results.filter((r) => r.correct && r.prediction.signal !== 'HOLD').length
    const losses = results.filter((r) => !r.correct && r.prediction.signal !== 'HOLD').length
    const neutrals = results.filter((r) => r.prediction.signal === 'HOLD').length
    const actionable = wins + losses
    const winRate = actionable > 0 ? (wins / actionable) * 100 : 0
    const avgChangePct = results.reduce((a, b) => a + b.actualChangePct, 0) / results.length
    const bestTradePct = Math.max(...results.map((r) => r.actualChangePct))
    const worstTradePct = Math.min(...results.map((r) => r.actualChangePct))
    // Expectancy = average P/L per trade assuming 1% risk, 1.5 R:R
    const expectancy =
      results.reduce((a, r) => {
        if (r.prediction.signal === 'HOLD') return a
        const rMultiple = r.correct ? 1.5 : -1
        return a + rMultiple
      }, 0) / Math.max(actionable, 1) * 1 // in %

    // Equity curve: start $1000, risk 1% per trade, win = +1.5%, loss = -1%
    let equity = 1000
    const equityCurve = [{ trade: 0, equity }]
    for (const r of results) {
      if (r.prediction.signal === 'HOLD') continue
      const pnl = r.correct ? 0.015 : -0.01
      equity = equity * (1 + pnl)
      equityCurve.push({ trade: equityCurve.length, equity: Math.round(equity * 100) / 100 })
    }

    // Signal distribution
    const buyCount = results.filter((r) => r.prediction.signal === 'BUY').length
    const sellCount = results.filter((r) => r.prediction.signal === 'SELL').length
    const holdCount = results.filter((r) => r.prediction.signal === 'HOLD').length
    const signalDistribution = [
      { signal: 'BUY', count: buyCount, fill: '#10b981' },
      { signal: 'SELL', count: sellCount, fill: '#f43f5e' },
      { signal: 'HOLD', count: holdCount, fill: '#f59e0b' },
    ]

    return NextResponse.json({
      result: {
        totalTrades: results.length,
        wins,
        losses,
        neutrals,
        winRate,
        avgChangePct,
        bestTradePct,
        worstTradePct,
        expectancy,
        equityCurve,
        signalDistribution,
        trades: results.slice(-50).map((r) => ({
          prediction: {
            signal: r.prediction.signal,
            confidence: r.prediction.confidence,
            currentPrice: r.prediction.currentPrice,
            targetPrice: r.prediction.targetPrice,
            timeframe: r.prediction.timeframe,
          },
          actualChangePct: r.actualChangePct,
          correct: r.correct,
          timestamp: r.timestamp,
        })),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

// Suppress unused
