# XAUUSD Predictor Bot — Deployment Guide

Bot prediksi harga emas XAUUSD dengan paper trading virtual. Dibangun dengan Next.js 16, Server-Sent Events, 7 indikator teknikal, dan **Redis persistence** (saldo & posisi tetap ada walau server restart).

## 🚀 Quick Deploy ke Railway (5 menit)

### Step 1: Push ke GitHub

```bash
cd /home/z/my-project
git remote add origin https://github.com/USERNAME/xauusd-bot.git
git push -u origin main
```

### Step 2: Bikin Project di Railway

1. Buka https://railway.app → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. Pilih repo `xauusd-bot` kamu
4. Railway auto-detect Dockerfile → build dimulai (2-3 menit)

### Step 3: Tambah Redis Database (PENTING untuk persistence)

1. Di project Railway, klik **+ (New)** → **Database** → **Add Redis**
2. Railway otomatis bikin Redis instance
3. Klik Redis service → tab **Variables** → copy value `REDIS_URL` (format: `rediss://default:xxx@xxx.railway.app:xxx`)
4. Klik service **web** (app kamu) → tab **Variables** → **Add Variable**
   - Name: `REDIS_URL`
   - Value: paste dari Redis
5. Railway auto-redeploy setelah variable ditambah

### Step 4: Generate Domain

1. Klik service **web** → **Settings** → **Networking**
2. Klik **Generate Domain**
3. Selesai! URL: `https://xauusd-bot-production.up.railway.app`

### Step 5: (Optional) Set API Key untuk Real Prices

Di **web** service → **Variables**:
```
TWELVEDATA_API_KEY=2f7f8b157aee4c619ce29f293d34b1cd
```

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

### Biaya Railway
- **App (web service)**: ~$0.05/hour = ~$5/bulan (free $5 credit cukup)
- **Redis**: ~$0.05/hour = ~$5/bulan (free credit juga dipakai)
- **Total**: ~$10/bulan, free credit ~$5 covers ~half month
- **Tip**: Kalau mau gratis terus, pakai [Render free tier](https://render.com) atau [Fly.io free allowance](https://fly.io)

### Cold Start
- Railway: ~5-10 detik untuk first load setelah idle (rare)
- Setelah loaded, response time ~50-200ms

### Backup
- Redis di Railway auto-backup harian
- Untuk backup manual: `redis-cli -u REDIS_URL SAVE` lalu download `dump.rdb`

### Scaling
- Bot ini cukup untuk 1-50 concurrent users (single instance)
- Kalau butuh lebih, hapus in-memory state sepenuhnya, pindah semua ke Redis (sudah sebagian dilakukan)

---

## 🆘 Troubleshooting

**Saldo tetap reset ke $10,000 walau Redis aktif?**
- Cek Railway logs: harus ada `[paper] Loaded from Redis: balance=$X`
- Kalau tidak ada, cek `REDIS_URL` benar (format `rediss://...` untuk TLS)
- Redis status harus "ready" — cek di Railway dashboard

**Bot loading terus / crash?**
- Cek Railway **Deploy Logs**
- Pastikan build sukses tanpa TypeScript error
- Cek healthcheck: `curl https://your-app.up.railway.app/api/xau/paper-trade`

**Harga tidak update?**
- Tanpa API key: bot pakai simulasi (tetap berfungsi)
- Dengan API key: cek TwelveData quota (free tier 800 calls/day)

**Redis connection error?**
- Pastikan `REDIS_URL` di set di **web service** (bukan Redis service)
- Format benar: `rediss://default:PASSWORD@HOST:PORT` (perhatikan `rediss://` untuk TLS)
- Cek Railway Redis service status: harus "Active"

---

## 📦 Struktur Project

```
xauusd-bot/
├── Dockerfile              # Multi-stage build untuk production
├── railway.json            # Railway config (healthcheck, restart policy)
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
