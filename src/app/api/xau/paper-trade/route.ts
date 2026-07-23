import { NextRequest, NextResponse } from 'next/server'
import { snapshot } from '@/lib/xau/engine'
import {
  deposit,
  withdraw,
  resetAccount,
  updateConfig,
  closeAllManual,
  closePositionManual,
  getAccountSnapshot,
  type PaperTradeConfig,
} from '@/lib/xau/positions'
import { redisDel } from '@/lib/xau/redis-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const s = snapshot()
  const acc = getAccountSnapshot(s.price)
  return NextResponse.json(acc)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body as { action: string; [k: string]: unknown }
    const s = snapshot()
    const price = s.price

    switch (action) {
      case 'deposit': {
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        deposit(amount)
        break
      }
      case 'withdraw': {
        const amount = Number(body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        const ok = withdraw(amount)
        if (!ok) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
        break
      }
      case 'reset':
        resetAccount()
        break
      case 'wipeRedis':
        await redisDel('xauusd:paper:v1')
        resetAccount()
        break
      case 'closeAll':
        closeAllManual(price)
        break
      case 'closeOne': {
        const id = String(body.id ?? '')
        const ok = closePositionManual(id, price)
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
        updateConfig(partial)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const acc = getAccountSnapshot(price)
    return NextResponse.json({ ok: true, account: acc })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
