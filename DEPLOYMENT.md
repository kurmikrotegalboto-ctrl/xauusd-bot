# XAUUSD Predictor Bot — Deployment Guide

Bot prediksi harga emas XAUUSD dengan paper trading virtual. Dibangun dengan Next.js 16, Server-Sent Events, 7 indikator teknikal, dan **Redis persistence** (saldo & posisi tetap ada walau server restart).

---

## 🆓 REKOMENDASI: Deploy Gratis ke Render + Upstash Redis

**Render** = gratis 750 jam/bulan (web service), **no credit card needed**.
**Upstash Redis** = gratis 10,000 commands/day (cukup untuk bot pribadi).

### Step 1: Push ke GitHub

```bash
cd /home/z/my-project
git remote add origin https://github.com/USERNAME/xauusd-bot.git
git push -u origin main
```

### Step 2: Bikin Database Redis Gratis di Upstash

1. Buka https://upstash.com → **Sign up with GitHub** (gratis, no credit card)
2. **Create Database**:
   - Name: `xauusd-redis`
   - Region: `Global` atau pilih terdekat (Singapore untuk Asia)
   - Type: **Regional** (free tier)
3. Setelah dibuat, klik database → copy **Endpoint** dan **Password**
4. Format URL-nya: `rediss://default:PASSWORD@ENDPOINT:PORT`
   - Contoh: `rediss://default:abc123@us1-xxx.upstash.io:6379`
5. Simpan dulu, akan dipakai di Step 4

### Step 3: Deploy Web App ke Render

1. Buka https://render.com → **Sign up with GitHub**
2. **New +** → **Blueprint**
3. Pilih repo `xauusd-bot` kamu
4. Render akan auto-detect `render.yaml` → konfirmasi **Apply**
5. Render mulai build (3-5 menit pertama)
6. Setelah build selesai, klik service `xauusd-bot` → **Environment** tab

### Step 4: Set Environment Variables di Render

Di service `xauusd-bot` → **Environment**:

| Key | Value |
|-----|-------|
| `REDIS_URL` | `rediss://default:PASSWORD@ENDPOINT:PORT` (dari Upstash Step 2) |
| `TWELVEDATA_API_KEY` | `2f7f8b157aee4c619ce29f293d34b1cd` (real gold price, opsional) |
| `NODE_ENV` | `production` (sudah default dari render.yaml) |

Klik **Save Changes** → Render auto-redeploy.

### Step 5: Buka Web App

1. Klik service `xauusd-bot` → URL ada di bagian atas (contoh: `https://xauusd-bot.onrender.com`)
2. Tunggu 30-60 detik (cold start di free tier)
3. Buka URL di browser → bot berjalan!

### Step 6: Verify Persistence

1. Buka tab **Paper Trade**, lihat saldo & posisi
2. Tunggu sampai ada posisi terbuka (atau deposit manual)
3. Di dashboard Render, klik **Manual Deploy** → **Clear cache & deploy**
4. Setelah redeploy, refresh web app → **saldo & posisi harus tetap ada** (karena Redis)

---

## 🚀 Alternatif: Deploy ke Railway (Trial $5/bulan)

Kalau mau lebih stabil tanpa cold start, Railway memberi $5 credit gratis/bulan:

### Step 1: Push ke GitHub (sama dengan Render Step 1)

### Step 2: Deploy di Railway
1. Buka https://railway.app → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo** → pilih `xauusd-bot`
3. Railway auto-detect Dockerfile → build dimulai

### Step 3: Tambah Redis
1. Di project → **+ (New)** → **Database** → **Add Redis**
2. Railway otomatis set `REDIS_URL` ke web service (cukup tunggu redeploy)

### Step 4: Generate Domain
- Service web → **Settings** → **Networking** → **Generate Domain**

### Step 5: (Optional) Set API Key
- Service web → **Variables** → tambah `TWELVEDATA_API_KEY=2f7f8b157aee4c619ce29f293d34b1cd`

---

## 📊 Perbandingan Opsi Gratis

| Platform | Free Tier | Credit Card | Cold Start | Redis Free | Best For |
|----------|-----------|-------------|------------|------------|----------|
| **Render** | 750 jam/bln (sleeps after 15min idle) | ❌ Tidak | ⚠️ Ya (~30-60s) | Upstash (10k cmd/day) | **Recommended** untuk trial |
| **Railway** | $5 credit/bln | ⚠️ Ya (saat trial habis) | ❌ Tidak | Built-in (~$2/bln) | Stabil, no cold start |
| **Fly.io** | 3 shared VMs | ❌ Tidak | ❌ Tidak | Upstash/redis.io | Advanced user |
| **Vercel** | Unlimited | ❌ Tidak | N/A (serverless) | Upstash | ⚠️ Tidak cocok (SSE perlu persistent connection) |

**Rekomendasi: Render + Upstash** untuk benar-benar gratis tanpa risiko biaya.

---

## ✨ Yang Persist Setelah Restart (dengan Redis)

- ✅ **Saldo virtual** — tidak reset ke $10,000
- ✅ **Posisi terbuka** — posisi yang belum close tetap ada
- ✅ **Histori trade** — semua posisi yang sudah close tetap tercatat
- ✅ **Equity curve** — grafik saldo tetap utuh
- ✅ **Konfigurasi** — settings (risk %, confidence, dll) tersimpan
- ✅ **Win rate & statistik** — semua metric tetap ada

**Tanpa Redis**: Semua di atas reset setiap restart (mode in-memory).

---

## 📊 Fitur Bot

### Dashboard Tab
- Real-time price (simulasi atau real TwelveData API)
- Signal BUY/SELL/HOLD dengan confidence %
- 7 indikator: RSI, MACD, EMA Cross, EMA50, Bollinger, Stochastic, ROC
- Price chart dengan candlestick
- Signal history dengan resolusi

### Paper Trade Tab
- Saldo virtual $10,000 (bisa di-deposit/withdraw)
- Auto-open posisi saat sinyal memenuhi kriteria strategi
- SL/TP otomatis dari ATR (1.2x SL, 1.8x TP)
- Equity curve real-time (sampled tiap 30 detik)
- Statistik lengkap: win rate, profit factor, R-multiple, streaks, exit reasons
- Trade history journal dengan detail setiap posisi
- Settings panel: risk %, confidence threshold, agreement count, SL/TP multipliers, expiry, max positions
- Manual close all / close one
- Reset account

---

## 🔧 Dev Lokal

### Tanpa Redis (in-memory only)
```bash
npm install
npm run dev          # http://localhost:3000
```

### Dengan Redis (recommended untuk testing persistence)
```bash
# Install Redis dulu (macOS: brew install redis, Linux: sudo apt install redis-server)
redis-server --daemonize yes --port 6379

# Bikin .env.local
echo "REDIS_URL=redis://localhost:6379" > .env.local

# Run dev
npm run dev
```

---

## 🐳 Docker (VPS / Cloud Run / etc)

```bash
# Build
docker build -t xauusd-bot .

# Run tanpa Redis (in-memory)
docker run -p 3000:3000 --name xauusd-bot xauusd-bot

# Run dengan Redis
docker run -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  --name xauusd-bot xauusd-bot

# Run dengan Redis container terpisah
docker network create xau-net
docker run -d --name redis --network xau-net redis:7-alpine
docker run -d --name xauusd-bot --network xau-net -p 3000:3000 \
  -e REDIS_URL=redis://redis:6379 xauusd-bot
```

---

## 💡 Notes & Tips

### Render Free Tier Limitations
- **Cold start**: ~30-60 detik setelah 15 menit tidak ada request
- Untuk hindari cold start: pasang uptime monitor (cron-job.org, gratis) yang ping URL tiap 10 menit
- RAM: 512MB (cukup untuk bot ini)
- Bandwidth: 100GB/bulan (cukup untuk ratusan user)

### Upstash Redis Free Tier
- 10,000 commands/day (bot ini pakai ~1,000-3,000/day tergantung traffic)
- Max 256MB storage (bot ini pakai <5MB)
- Untuk lebih: $0.2 per 100k commands (sangat murah)

### Backup
- Upstash: auto-backup harian (free tier)
- Render: tidak backup web service (state ada di Redis, bukan di web)

### Scaling
- Bot ini cukup untuk 1-50 concurrent users (single instance)
- Kalau butuh lebih, scale up plan Render (Starter $7/bulan = no cold start)

---

## 🆘 Troubleshooting

**Saldo tetap reset ke $10,000 walau Redis aktif?**
- Cek Render logs: harus ada `[paper] Loaded from Redis: balance=$X`
- Kalau tidak ada, cek `REDIS_URL` benar (format `rediss://...` untuk Upstash)
- Upstash status harus "Active" — cek di dashboard Upstash

**Bot loading terus / crash?**
- Cek Render **Deploy Logs**
- Pastikan build sukses tanpa TypeScript error
- Cek healthcheck: `curl https://your-app.onrender.com/api/xau/paper-trade`

**Harga tidak update?**
- Tanpa API key: bot pakai simulasi (tetap berfungsi)
- Dengan API key: cek TwelveData quota (free tier 800 calls/day)

**Redis connection error?**
- Pastikan `REDIS_URL` di set di **Environment** Render (bukan di Upstash)
- Format benar: `rediss://default:PASSWORD@HOST:PORT` (perhatikan `rediss://` untuk TLS)
- Cek Upstash dashboard: harus ada traffic (jika tidak ada, koneksi gagal)

**Cold start lama?**
- Render free tier memang sleep setelah 15min idle
- Pasang ping tiap 10 menit dari [cron-job.org](https://cron-job.org) (gratis) ke URL kamu
- Atau upgrade ke Render Starter ($7/bulan) — no sleep

---

## 📦 Struktur Project

```
xauusd-bot/
├── Dockerfile              # Multi-stage build untuk production
├── render.yaml             # Render Blueprint (free tier config)
├── railway.json            # Railway config (alternatif)
├── .dockerignore           # Exclude node_modules, .next, dll
├── .env.example            # Template env vars
├── DEPLOYMENT.md           # File ini
├── package.json
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main page (Dashboard + Paper Trade tabs)
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── xau/stream/route.ts     # SSE endpoint
│   │       └── xau/paper-trade/route.ts # REST endpoint
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   └── xau/                        # Bot-specific components
│   │       ├── price-display.tsx
│   │       ├── signal-card.tsx
│   │       ├── indicator-panel.tsx
│   │       ├── price-chart.tsx
│   │       ├── signal-history.tsx
│   │       └── paper-trade-panel.tsx   # Paper trading UI
│   ├── hooks/
│   │   └── use-xau-data.ts             # SSE client hook
│   └── lib/
│       └── xau/
│           ├── engine.ts               # Price engine singleton
│           ├── predictor.ts            # 7-indicator voting system
│           ├── indicators.ts           # RSI, MACD, EMA, Bollinger, dll
│           ├── positions.ts            # Paper trading logic + Redis persistence
│           └── redis-client.ts         # Redis wrapper with graceful fallback
└── public/
```

---

Bot ini untuk **edukasi**, bukan saran finansial. Trading XAUUSD berisiko tinggi.
