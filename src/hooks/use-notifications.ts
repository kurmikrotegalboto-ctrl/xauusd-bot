'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Prediction } from './use-xau-data'

type NotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported'

type Settings = {
  notificationsEnabled: boolean
  soundEnabled: boolean
  minConfidence: number // only notify if confidence >= threshold
  signalFilter: 'ALL' | 'BUY_SELL_ONLY' // skip HOLD
}

const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: false,
  soundEnabled: false,
  minConfidence: 60,
  signalFilter: 'BUY_SELL_ONLY',
}

const STORAGE_KEY = 'xau-settings'

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: Settings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

// Web Audio API beep generator (no asset needed)
function playBeep(isBuy: boolean) {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    // BUY = ascending tone (C5 -> E5 -> G5)
    // SELL = descending tone (G5 -> E5 -> C5)
    const freqs = isBuy ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25]
    osc.frequency.setValueAtTime(freqs[0], ctx.currentTime)
    osc.frequency.setValueAtTime(freqs[1], ctx.currentTime + 0.1)
    osc.frequency.setValueAtTime(freqs[2], ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), 500)
  } catch {
    // audio not supported
  }
}

export function useNotifications() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission as NotificationPermission
  })
  const lastSignalRef = useRef<string | null>(null)

  useEffect(() => {
    // No setState here; permission is read lazily on first render above.
    // If permission was 'default' on first render, we leave it to the user
    // to request via requestPermission().
  }, [])

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates }
      saveSettings(next)
      return next
    })
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)
      if (result === 'granted') {
        updateSettings({ notificationsEnabled: true })
      }
    } catch {
      setPermission('denied')
    }
  }, [updateSettings])

  // Watch for new predictions and fire notifications
  const watchPrediction = useCallback(
    (prediction: Prediction | null) => {
      if (!prediction) return
      // Check if signal is new (different from last seen)
      const sigKey = `${prediction.timeframe}-${prediction.validUntil}`
      if (sigKey === lastSignalRef.current) return
      lastSignalRef.current = sigKey

      // Apply filters
      if (settings.signalFilter === 'BUY_SELL_ONLY' && prediction.signal === 'HOLD') return
      if (prediction.confidence < settings.minConfidence) return

      // Sound
      if (settings.soundEnabled) {
        playBeep(prediction.signal === 'BUY')
      }

      // Browser notification
      if (settings.notificationsEnabled && permission === 'granted') {
        try {
          const isBuy = prediction.signal === 'BUY'
          const emoji = isBuy ? '📈' : prediction.signal === 'SELL' ? '📉' : '⏸️'
          const title = `${emoji} XAUUSD ${prediction.signal} • ${prediction.confidence}%`
          const body = `${prediction.summary}\nEntry: $${prediction.currentPrice.toFixed(2)}\nTarget: ${prediction.targetPrice ? '$' + prediction.targetPrice.toFixed(2) : '—'}`
          new Notification(title, {
            body,
            tag: sigKey,
            icon: '/logo.svg',
          })
        } catch {
          // notification failed
        }
      }
    },
    [settings, permission],
  )

  return {
    settings,
    permission,
    updateSettings,
    requestPermission,
    watchPrediction,
  }
}
