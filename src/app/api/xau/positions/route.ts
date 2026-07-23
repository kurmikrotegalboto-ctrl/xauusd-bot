import { NextRequest, NextResponse } from 'next/server'
import {
  setStrategyConfig, closeAllPositions, resetPositionHistory,
  getPositions, getPositionsStats, getStrategyConfig,
} from '@/lib/xau/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/xau/positions — return current positions, stats, and strategy config
export async function GET() {
  const { open, closed } = getPositions()
  const stats = getPositionsStats()
  const strategy = getStrategyConfig()
  return NextResponse.json({ open, closed, stats, strategy })
}

// POST /api/xau/positions — update strategy config OR close-all OR reset
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action: string = body.action || 'updateStrategy'

    if (action === 'updateStrategy') {
      const updates = body.updates || {}
      const next = setStrategyConfig(updates)
      return NextResponse.json({ ok: true, strategy: next })
    }

    if (action === 'closeAll') {
      const closed = closeAllPositions()
      return NextResponse.json({ ok: true, closed: closed.length })
    }

    if (action === 'reset') {
      resetPositionHistory()
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
