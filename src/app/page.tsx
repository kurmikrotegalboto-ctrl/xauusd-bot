'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Bot, Zap, ShieldAlert, Wallet } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useXauData } from '@/hooks/use-xau-data'
import { PriceDisplay } from '@/components/xau/price-display'
import { SignalCard } from '@/components/xau/signal-card'
import { IndicatorPanel } from '@/components/xau/indicator-panel'
import { PriceChart } from '@/components/xau/price-chart'
import { SignalHistory } from '@/components/xau/signal-history'
import { PaperTradePanel } from '@/components/xau/paper-trade-panel'
import { Button } from '@/components/ui/button'

export default function Home() {
  const { data, error, reconnect } = useXauData()

  useEffect(() => {
    if (!data.connected && !error) {
      const t = setTimeout(() => reconnect(), 2000)
      return () => clearTimeout(t)
    }
  }, [data.connected, error, reconnect])

  return (
    <div className="min-h-screen bg-grid bg-[#0a0a0b] text-foreground">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-amber-500/15 bg-[#0a0a0b]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10">
              <Bot className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">XAUUSD Predictor Bot</h1>
              <p className="text-[11px] text-muted-foreground">
                Bot prediksi Gold • Timeframe 5 menit • Multi-Indikator • Paper Trading
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.paper && (
              <div className="hidden items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] sm:flex">
                <Wallet className="h-3 w-3 text-amber-400" />
                <span className="font-mono text-amber-300">
                  ${(data.paper.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`font-mono ${(data.paper.floatingPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(data.paper.floatingPnl ?? 0) >= 0 ? '+' : ''}{(data.paper.floatingPnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                data.connected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  data.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {data.connected ? 'CONNECTED' : 'OFFLINE'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reconnect}
              className="h-8 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Reconnect
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Disclaimer banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            <strong className="font-semibold text-amber-300">Disclaimer:</strong>{' '}
            Bot ini menggunakan simulasi harga real-time dan algoritma analisis teknikal untuk tujuan
            edukasi. Paper trading dengan saldo virtual untuk belajar. Bukan saran finansial. Trading
            XAUUSD berisiko tinggi — selalu lakukan riset mandiri.
          </p>
        </motion.div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-rose-400">
            <span className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Koneksi WebSocket gagal: {error}
            </span>
            <Button size="sm" variant="ghost" onClick={reconnect} className="h-7 text-xs">
              Coba lagi
            </Button>
          </div>
        )}

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="paper" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Paper Trade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Left column: Price + Signal */}
              <div className="space-y-4 lg:col-span-7">
                <PriceDisplay
                  price={data.price}
                  prevPrice={data.prevPrice}
                  bid={data.bid}
                  ask={data.ask}
                  spread={data.spread}
                  changePct={data.changePct}
                  connected={data.connected}
                />
                <SignalCard prediction={data.prediction} currentPrice={data.price} />
                <PriceChart candles={data.candles} prediction={data.prediction} />
              </div>

              {/* Right column: Indicators + History */}
              <div className="space-y-4 lg:col-span-5">
                <IndicatorPanel prediction={data.prediction} />
                <SignalHistory history={data.history} />

                {/* How it works card */}
                <div className="rounded-xl border border-muted-foreground/20 bg-card/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold tracking-tight">Cara Kerja Bot</h3>
                  </div>
                  <ol className="space-y-1.5 text-[11px] text-muted-foreground">
                    <li>
                      <span className="font-mono text-amber-400">1.</span> Harga XAUUSD disimulasikan
                      tick-by-tick (Geometric Brownian Motion + micro-trends + jumps).
                    </li>
                    <li>
                      <span className="font-mono text-amber-400">2.</span> Candle 1 menit dibentuk dari
                      tick dan dijadikan input 7 indikator: RSI, MACD, EMA9/21, EMA50, Bollinger,
                      Stochastic, ROC.
                    </li>
                    <li>
                      <span className="font-mono text-amber-400">3.</span> Tiap indikator memberi voting
                      BUY/SELL/HOLD dengan bobot (MACD paling tinggi 0.20, ROC paling rendah 0.08).
                    </li>
                    <li>
                      <span className="font-mono text-amber-400">4.</span> Skor dijumlahkan → sinyal 5
                      menit dengan confidence % dan harga target berbasis ATR.
                    </li>
                    <li>
                      <span className="font-mono text-amber-400">5.</span> Sinyal baru diterbitkan setiap
                      5 menit; hasil sebelumnya di-update otomatis setelah window berakhir.
                    </li>
                    <li>
                      <span className="font-mono text-amber-400">6.</span> Tab <strong className="text-amber-300">Paper Trade</strong> auto-buka
                      posisi virtual saat sinyal memenuhi kriteria strategi.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paper">
            <PaperTradePanel paper={data.paper} currentPrice={data.price} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-amber-500/15 bg-[#0a0a0b]/80">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            XAUUSD Predictor Bot • Dibangun dengan Next.js + Server-Sent Events •{' '}
            <span className="text-amber-400/80">Untuk edukasi, bukan saran finansial</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
