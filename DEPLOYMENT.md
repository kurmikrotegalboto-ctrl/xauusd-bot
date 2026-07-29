# XAUUSD Predictor Bot — Deployment Guide

Bot prediksi harga emas XAUUSD dengan paper trading virtual + Redis persistence. Deploy ke **Vercel** (gratis, no credit card) + **Upstash Redis** (gratis 10k commands/day).

---

## 🆓 REKOMENDASI: Vercel + Upstash (No Credit Card)

### Step 1: Bikin Redis Gratis di Upstash

1. Buka https://upstash.com → **Login with GitHub**
2. **Create Database**:
   - Name: `xauusd-redis`
   - Primary Region: `Global` atau `us-east-1`
   - Type: **Regional** (free tier — 10k commands/day)
3. Setelah dibuat, copy **Redis URL**:
   - Format: `rediss://default:PASSWORD@HOST.upstash.io:6379`
   - Penting: `rediss://` (2 s) untuk TLS, bukan `redis://`

### Step 2: Deploy ke Vercel

1. Buka https://vercel.com → **Sign Up with GitHub** (no credit card needed)
2. Klik **Add New...** → **Project**
3. Import repository: `kurmikrotegalboto-ctrl/xauusd-bot`
4. Vercel auto-detect Next.js → klik **Deploy** (default settings OK)
5. Tunggu build 1-3 menit

### Step 3: Set Environment Variables

Setelah deploy pertama selesai:

1. Buka dashboard Vercel → project `xauusd-bot`
2. Tab **Settings** → **Environment Variables**
3. Klik **Add New** — isi 2 variables:

| Name | Value | Environment |
|------|-------|-------------|
| `REDIS_URL` | (paste dari Upstash Step 1) | Production, Preview, Development |
| `TWELVEDATA_API_KEY` | `2f7f8b157aee4c619ce29f293d34b1cd` | Production, Preview, Development |

4. Klik **Save**
5. Tab **Deployments** → klik titik 3 di deploy terakhir → **Redeploy**

### Step 4: Buka Web App

- URL: `https://xauusd-bot.vercel.app` (atau `https://xauusd-bot-xxx.vercel.app`)
- Tunggu 1-2 detik (cold start serverless)
- Bot berjalan! 🎉

### Step 5: Verify Persistence

1. Buka tab **Paper Trade** → lihat saldo $10,000
2. Klik **Deposit** → tambah $1000 → balance jadi $11,000
3. Di Vercel dashboard → **Redeploy** (tanpa ubah apapun)
4. Setelah redeploy selesai (~1 menit), refresh web app
5. **Saldo harus tetap $11,000** (karena Redis di Upstash) ✅

---

## 🏗️ Arsitektur (Vercel Serverless)

```
┌────────────────────┐     ┌──────────────────────┐
│  Browser Client    │     │  Vercel (Next.js)    │
│  (use-xau-data)    │     │  /api/xau/poll       │
│                    │     │  /api/xau/paper-trade│
│  Poll tiap 2 detik │◄───►│                      │
│                    │     │  Stateless function  │
└────────────────────┘     └──────────┬───────────┘
                                      │
                                      │ load/save
                                      ▼
                           ┌──────────────────────┐
                           │  Upstash Redis       │
                           │  (state persistent)  │
                           │                      │
                           │  - engine state      │
                           │  - paper positions   │
                           │  - equity curve      │
                           │  - config            │
                           └──────────────────────┘
```

### Kenapa Polling bukan SSE?

Vercel serverless punya max 10s timeout (free) / 60s (pro). SSE butuh koneksi persistent yang tidak bisa di-handle serverless. Makanya kita pakai polling 2 detik — sama cepatnya, lebih reliable di serverless.

### Apa yang Persist (dengan Redis Upstash)?

- ✅ Saldo virtual (tidak reset ke $10,000)
- ✅ Posisi terbuka (survive restart/redeploy)
- ✅ Histori trade (semua posisi yang sudah close)
- ✅ Equity curve
- ✅ Konfigurasi (risk %, confidence, dll)
- ✅ Win rate & statistik

**Tanpa Redis**: Semua reset setiap cold start (mode in-memory).

---

## 📊 Fitur Bot

### Dashboard Tab
- Real-time price (simulasi — bisa di-upgrade ke TwelveData API)
- Signal BUY/SELL/HOLD dengan confidence %
- 7 indikator: RSI, MACD, EMA Cross, EMA50, Bollinger, Stochastic, ROC
- Price chart dengan candlestick
- Signal history dengan resolusi

### Paper Trade Tab
- Saldo virtual $10,000 (bisa di-deposit/withdraw)
- Auto-open posisi saat sinyal memenuhi kriteria strategi
- SL/TP otomatis dari ATR (1.2x SL, 1.8x TP)
- Equity curve real-time (sampled tiap 30 detik)
- Statistik lengkap: win rate, profit factor, R-multiple, streaks
- Trade history journal
- Settings: risk %, confidence threshold, agreement count, SL/TP multipliers
- Manual close all / close one
- Reset account

---

## 🔧 Dev Lokal

### Tanpa Redis (in-memory fallback, otomatis aktif)
```bash
npm install
npm run dev          # http://localhost:3000
```
Bot berjalan normal, tapi state reset tiap restart.

### Dengan Redis lokal (recommended untuk testing persistence)
```bash
# Install Redis (macOS: brew install redis, Linux: sudo apt install redis-server)
redis-server --daemonize yes --port 6379

# Bikin .env.local
echo "REDIS_URL=redis://localhost:6379" > .env.local

npm run dev
```

---

## 📋 Vercel Free Tier Limits

- **Bandwidth**: 100GB/bulan (cukup untuk ratusan user)
- **Function executions**: 1M/bulan (bot pakai ~50k/bulan)
- **Build time**: 45 menit/bulan (build ~2 menit per deploy, cukup)
- **No credit card required**
- **Custom domain**: supported di free tier

## 📋 Upstash Free Tier Limits

- **10,000 commands/day** (bot pakai ~1,000-3,000/day tergantung traffic)
- **256MB storage** (bot pakai <5MB)
- **Auto-backup harian**
- **No credit card required**
- Untuk lebih: $0.20 per 100k commands (sangat murah)

---

## 🆘 Troubleshooting

**Saldo tetap reset ke $10,000 walau Redis aktif?**
- Buka Vercel → tab **Logs** → cari pesan `[paper] Loaded from Redis`
- Kalau tidak ada, cek `REDIS_URL` benar (format `rediss://...`)
- Cek Upstash dashboard: harus ada traffic (Commands counter naik)
- Pastikan environment = "Production" di setting variable

**Bot loading terus / Application error?**
- Buka Vercel → tab **Logs** → scroll ke error
- Cek `REDIS_URL` format benar: `rediss://default:PASSWORD@HOST:PORT`
- Test ping: `curl https://xauusd-bot.vercel.app/api/xau/poll` → harus JSON response

**Harga tidak update?**
- Tanpa API key: bot pakai simulasi (tetap berfungsi, prices berubah random walk)
- Dengan API key: cek TwelveData quota (free tier 800 calls/day)

**Cold start lama (~1-2s)?**
- Itu normal di Vercel free tier
- Setelah cold start, response ~50-200ms
- Untuk eliminate cold start: upgrade ke Vercel Pro ($20/bulan)

**Polling menggangu battery di mobile?**
- 2 detik polling = 30 request/menit, ringan
- Bisa di-pause: tutup tab → polling stop otomatis

---

## 📦 Struktur Project

```
xauusd-bot/
├── vercel.json            # Vercel config (region: sin1, maxDuration: 30s)
├── next.config.ts         # Next.js 16 config
├── package.json
├── .env.example           # Template env vars
├── DEPLOYMENT.md          # File ini
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main page (Dashboard + Paper Trade tabs)
│   │   ├── layout.tsx
│   │   └── api/xau/
│   │       ├── poll/route.ts           # Polling endpoint (replaces SSE)
│   │       ├── paper-trade/route.ts     # Paper trading REST API
│   │       └── stream/route.ts         # Legacy SSE (deprecated, returns 410)
│   ├── components/xau/
│   │   ├── price-display.tsx
│   │   ├── signal-card.tsx
│   │   ├── indicator-panel.tsx
│   │   ├── price-chart.tsx
│   │   ├── signal-history.tsx
│   │   └── paper-trade-panel.tsx       # Paper trading UI panel
│   ├── hooks/
│   │   └── use-xau-data.ts              # Polling hook (2s interval)
│   └── lib/xau/
│       ├── engine.ts                   # Price engine (Redis-backed)
│       ├── predictor.ts                # 7-indicator voting system
│       ├── indicators.ts               # RSI, MACD, EMA, Bollinger, dll
│       ├── positions.ts                # Paper trading logic (Redis-backed)
│       ├── redis-client.ts              # ioredis wrapper with graceful fallback
│       └── redis-state.ts              # Generic state store + lock + memory fallback
└── public/
```

---

Bot ini untuk **edukasi**, bukan saran finansial. Trading XAUUSD berisiko tinggi.
