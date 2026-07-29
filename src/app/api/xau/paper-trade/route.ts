import { NextRequest, NextResponse } from 'next/server'
import { tickAsync } from '@/lib/xau/engine'
import {
  depositAsync,
  withdrawAsync,
  resetAccountAsync,
  updateConfigAsync,
  closeAllManualAsync,
  closePositionManualAsync,
  getAccountSnapshotAsync,
  wipeRedisAsync,
  type PaperTradeConfig,
} from '@/lib/xau/positions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// GET — returns current account snapshot (also ticks once for fresh price)
export async function GET() {
  try {
    const snapshot = await tickAsync()
    return NextResponse.json(snapshot.paper, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

// POST — perform an action on the paper trading account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action as string

    // Tick first to get fresh price
    const snap = await tickAsync()
    const price = snap.price

    switch (action) {
      case 'deposit': {
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        await depositAsync(amount)
        break
      }
      case 'withdraw': {
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        const ok = await withdrawAsync(amount)
        if (!ok) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
        break
      }
      case 'reset':
        await resetAccountAsync()
        break
      case 'wipeRedis':
        await wipeRedisAsync()
        break
      case 'closeAll':
        await closeAllManualAsync(price)
        break
      case 'closeOne': {
        const id = String(body.id ?? '')
        const ok = await closePositionManualAsync(id, price)
        if (!ok) return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        break
      }
      case 'updateConfig': {
        const partial: Partial<PaperTradeConfig> = {}
        const fields: (keyof PaperTradeConfig)[] = [
          'startingBalance',
          'riskPerTradePct',
          'maxOpenPositions',
          'minConfidence',
          'minIndicatorAgreement',
          'atrSlMultiplier',
          'atrTpMultiplier',
          'positionExpiryMs',
          'autoTradeEnabled',
        ]
        for (const f of fields) {
          if (body[f] !== undefined) {
            if (f === 'autoTradeEnabled') {
              partial[f] = Boolean(body[f])
            } else {
              const n = Number(body[f])
              if (Number.isFinite(n)) {
                // @ts-expect-error — number field
                partial[f] = n
              }
            }
          }
        }
        await updateConfigAsync(partial)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const acc = await getAccountSnapshotAsync(price)
    return NextResponse.json({ ok: true, account: acc })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
