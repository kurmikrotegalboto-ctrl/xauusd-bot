import { NextResponse } from 'next/server'
import { tickAsync } from '@/lib/xau/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30  // Vercel: 30s timeout (10s free, 60s pro — 30s is safe)

// Polling endpoint — replaces SSE for serverless compatibility.
// Client polls every 2 seconds. Each request:
// 1. Loads engine state from Redis
// 2. Ticks once (updates price, checks candle roll, may issue prediction)
// 3. Updates paper trading (auto-open, check SL/TP, sample equity)
// 4. Saves state back to Redis
// 5. Returns full snapshot
export async function GET() {
  try {
    const snapshot = await tickAsync()
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Poll-Interval': '2000',
      },
    })
  } catch (e) {
    console.error('[poll] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
