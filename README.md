# XAUUSD Trading Bot 📈

Bot prediksi harga emas (XAUUSD) untuk timeframe 5 menit, lengkap dengan **paper trading** (saldo virtual $10,000) dan **Redis persistence**.

![Status](https://img.shields.io/badge/status-production--ready-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20Redis-orange)

## ✨ Fitur

- **Real-time price stream** via SSE (Server-Sent Events)
- **7 indikator teknikal**: RSI, MACD, EMA Cross, EMA50, Bollinger Bands, Stochastic, ROC
- **Multi-timeframe analysis** (M5, M15, M30, H1)
- **Auto paper trading** — buka posisi otomatis berdasarkan sinyal
- **Saldo virtual $10,000** — reset kapan saja
- **ATR-based SL/TP** dengan R:R 1:1.5
- **Risk management** — 1% risk per trade, max 3 posisi terbuka
- **Trade journal** — lengkap dengan P&L, R-multiple, exit reason
- **Redis persistence** — saldo & posisi tetap ada walau server restart
- **Equity curve** — visualisasi pertumbuhan akun
- **Bahasa Indonesia UI** dengan dark trading theme

## 🚀 Quick Start (Gratis 100%)

### Stack gratis yang direkomendasikan:
| Komponen | Service | Free Tier |
|----------|---------|-----------|
| **Web App** | [Render.com](https://render.com) | 750 jam/bulan, 512MB RAM |
| **Database** | [Upstash Redis](https://upstash.com) | 10,000 command/hari, 256MB |
| **Source Code** | [GitHub](https://github.com) | Unlimited public repos |

> Total biaya: **$0/bulan** untuk penggunaan pribadi.

## 📦 Deploy dalam 5 Langkah

### Langkah 1: Push ke GitHub

```bash
# Di folder project:
git init  # kalau belum
git add .
git commit -m "Initial commit: XAUUSD bot"

# Buat repo di github.com (new repository, jangan centang README)
git remote add origin https://github.com/USERNAME/xauusd-bot.git
git branch -M main
git push -u origin main
```

### Langkah 2: Buat Redis Database Gratis di Upstash

1. Buka [console.upstash.com](https://console.upstash.com) → Login dengan GitHub
2. **Create Database** → Pilih:
   - Name: `xauusd-bot`
   - Region: `Global` (atau terdekat)
   - TLS: **Enable** (wajib)
3. Copy **Endpoint URL** — formatnya: `rediss://default:PASSWORD@HOST:PORT`
4. Simpan dulu, akan dipakai di Langkah 4

### Langkah 3: Deploy Web App ke Render.com

1. Buka [dashboard.render.com](https://dashboard.render.com) → Login dengan GitHub
2. **New +** → **Web Service** → Pilih repo `xauusd-bot`
3. Konfigurasi:
   - **Name**: `xauusd-bot`
   - **Region**: Singapore (atau terdekat)
   - **Branch**: `main`
   - **Runtime**: Docker (auto-detect dari Dockerfile)
   - **Instance Type**: **Free** ($0/bulan)
4. Scroll ke **Environment Variables**, tambah:

   | Key | Value |
   |-----|-------|
   | `REDIS_URL` | `rediss://default:PASSWORD@HOST:PORT` (dari Langkah 2) |
   | `TWELVEDATA_API_KEY` | `2f7f8b157aee4c619ce29f293d34b1cd` (sudah ada) |
   | `NODE_ENV` | `production` |

5. **Create Web Service** → tunggi build 5-10 menit
6. Render kasih URL: `https://xauusd-bot.onrender.com` → buka di browser!

### Langkah 4: Verifikasi Redis Connection

Setelah app berjalan, cek log di Render dashboard. Harus muncul:
```
[redis] Connected
[paper] Restored from Redis: balance=10000, openPositions=0
```

Kalau muncul `REDIS_URL not set`, periksa Environment Variables.

### Langkah 5: Test Persistence

1. Buka web app → lihat saldo & posisi
2. Tunggu beberapa saat sampai ada posisi terbuka
3. Manual deploy ulang di Render (Settings → Manual Deploy → Restart)
4. Setelah restart, saldo & posisi harus **tetap ada**!

## 🛠️ Development (Local)

```bash
# Install dependencies
npm install --legacy-peer-deps

# Setup env
cp .env.example .env.local
# Edit .env.local, isi REDIS_URL (bisa pakai local Redis atau Upstash)

# Run dev server
npm run dev
# Buka http://localhost:3000
```

## 📁 Struktur Project

```
src/
├── app/
│   ├── api/
│   │   ├── xau/
│   │   │   ├── stream/route.ts       # SSE endpoint
│   │   │   └── paper-trade/route.ts  # Paper trading API
│   │   └── ...
│   └── page.tsx                      # Main UI (tabs: Dashboard, Paper Trade)
├── components/xau/
│   └── paper-trade-panel.tsx         # Paper trading UI
├── hooks/
│   └── use-xau-data.ts               # SSE client hook
└── lib/xau/
    ├── engine.ts                     # Price & prediction engine
    ├── indicators.ts                 # 7 technical indicators
    ├── positions.ts                  # Paper trading logic
    └── redis-client.ts               # Redis singleton
```

## ⚙️ Konfigurasi Paper Trading

Bisa diubah lewat UI (tab Paper Trade → Settings):

| Parameter | Default | Fungsi |
|-----------|---------|--------|
| `startingBalance` | $10,000 | Saldo awal |
| `riskPerTradePct` | 1% | Risk per trade dari balance |
| `maxOpenPositions` | 3 | Maksimal posisi simultan |
| `minConfidence` | 60% | Minimum confidence untuk entry |
| `minIndicatorAgreement` | 4/7 | Min indikator yang agree |
| `atrSlMultiplier` | 1.2x | SL = 1.2 × ATR |
| `atrTpMultiplier` | 1.8x | TP = 1.8 × ATR |
| `positionExpiryMs` | 30 min | Auto-close kalau sudah 30 menit |
| `autoTradeEnabled` | true | Auto-open positions |

## ⚠️ Disclaimer

Bot ini untuk **tujuan edukasi & simulasi** saja. Prediksi tidak menjamin profit. Trading XAUUSD dengan uang asli memiliki risiko kehilangan modal. Selalu lakukan riset sendiri.

## 📜 License

MIT — bebas pakai, ubah, dan distribusi.
