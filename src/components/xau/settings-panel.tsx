'use client'

import { Bell, BellOff, Volume2, VolumeX, Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'

type Settings = {
  notificationsEnabled: boolean
  soundEnabled: boolean
  minConfidence: number
  signalFilter: 'ALL' | 'BUY_SELL_ONLY'
}

type Props = {
  open: boolean
  onClose: () => void
  settings: Settings
  permission: 'default' | 'granted' | 'denied' | 'unsupported'
  onUpdate: (updates: Partial<Settings>) => void
  onRequestPermission: () => void
}

export function SettingsPanel({
  open, onClose, settings, permission, onUpdate, onRequestPermission,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-amber-500/30 bg-[#0a0a0b] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold tracking-tight">Pengaturan Bot</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {/* Notifications */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.notificationsEnabled ? (
                  <Bell className="h-4 w-4 text-emerald-400" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Notifikasi Browser</span>
              </div>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => {
                  if (checked && permission !== 'granted') {
                    onRequestPermission()
                  } else {
                    onUpdate({ notificationsEnabled: checked })
                  }
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {permission === 'unsupported'
                ? 'Browser tidak mendukung notifikasi.'
                : permission === 'denied'
                  ? 'Izin notifikasi ditolak. Aktifkan via pengaturan browser.'
                  : permission === 'granted'
                    ? 'Notifikasi aktif untuk sinyal baru.'
                    : 'Klik toggle untuk meminta izin notifikasi.'}
            </p>
          </section>

          {/* Sound */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {settings.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Sound Alert</span>
              </div>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onUpdate({ soundEnabled: checked })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bunyikan beep saat sinyal BUY/SELL baru muncul. Nada naik = BUY, nada turun = SELL.
            </p>
          </section>

          {/* Min confidence */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Min Confidence Alert</span>
              <span className="font-mono text-xs font-bold text-amber-400">
                {settings.minConfidence}%
              </span>
            </div>
            <Slider
              value={[settings.minConfidence]}
              onValueChange={(v) => onUpdate({ minConfidence: v[0] })}
              min={30}
              max={90}
              step={5}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hanya kirim alert jika confidence sinyal &ge; ambang ini.
            </p>
          </section>

          {/* Signal filter */}
          <section>
            <p className="mb-2 text-sm font-medium">Filter Sinyal</p>
            <div className="flex gap-1">
              <button
                onClick={() => onUpdate({ signalFilter: 'BUY_SELL_ONLY' })}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                  settings.signalFilter === 'BUY_SELL_ONLY'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-muted-foreground/20 bg-background/30 text-muted-foreground hover:text-foreground',
                )}
              >
                BUY/SELL saja
              </button>
              <button
                onClick={() => onUpdate({ signalFilter: 'ALL' })}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                  settings.signalFilter === 'ALL'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-muted-foreground/20 bg-background/30 text-muted-foreground hover:text-foreground',
                )}
              >
                Semua sinyal
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pilih apakah HOLD juga memicu notifikasi.
            </p>
          </section>

          {/* Test buttons */}
          <section className="rounded-lg border border-muted-foreground/15 bg-background/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Tes Alert
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (settings.soundEnabled) {
                    // Play buy beep (test)
                    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
                    if (AudioCtx) {
                      const ctx = new AudioCtx()
                      const osc = ctx.createOscillator()
                      const gain = ctx.createGain()
                      osc.type = 'sine'
                      osc.frequency.setValueAtTime(523.25, ctx.currentTime)
                      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1)
                      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2)
                      gain.gain.setValueAtTime(0, ctx.currentTime)
                      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
                      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35)
                      osc.connect(gain)
                      gain.connect(ctx.destination)
                      osc.start()
                      osc.stop(ctx.currentTime + 0.4)
                      setTimeout(() => ctx.close(), 500)
                    }
                  }
                  if (settings.notificationsEnabled && permission === 'granted') {
                    new Notification('📈 Test BUY • 75%', {
                      body: 'Notifikasi BUY berhasil. Harga target: $2450.00',
                      tag: 'test-buy',
                    })
                  }
                }}
                className="flex-1 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Volume2 className="h-3 w-3" />
                Tes BUY
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (settings.soundEnabled) {
                    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
                    if (AudioCtx) {
                      const ctx = new AudioCtx()
                      const osc = ctx.createOscillator()
                      const gain = ctx.createGain()
                      osc.type = 'sine'
                      osc.frequency.setValueAtTime(783.99, ctx.currentTime)
                      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1)
                      osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2)
                      gain.gain.setValueAtTime(0, ctx.currentTime)
                      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
                      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35)
                      osc.connect(gain)
                      gain.connect(ctx.destination)
                      osc.start()
                      osc.stop(ctx.currentTime + 0.4)
                      setTimeout(() => ctx.close(), 500)
                    }
                  }
                  if (settings.notificationsEnabled && permission === 'granted') {
                    new Notification('📉 Test SELL • 75%', {
                      body: 'Notifikasi SELL berhasil. Harga target: $2350.00',
                      tag: 'test-sell',
                    })
                  }
                }}
                className="flex-1 gap-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                <Volume2 className="h-3 w-3" />
                Tes SELL
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
