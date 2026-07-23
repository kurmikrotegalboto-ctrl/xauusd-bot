# XAUUSD Predictor Bot — Deployment Guide

Bot prediksi harga emas XAUUSD dengan paper trading virtual. Dibangun dengan Next.js 16, Server-Sent Events, dan 7 indikator teknikal.

## 🚀 Quick Deploy ke Railway (Recommended)

### Step 1: Push ke GitHub

```bash
# Dari folder project, kalau belum ada remote
git remote add origin https://github.com/USERNAME/xauusd-bot.git
git push -u origin main
```

### Step 2: Deploy di Railway

1. **Buka** https://railway.app → Login dengan GitHub
2. **New Project** → **Deploy from GitHub repo**
3. **Pilih repo** `xauusd-bot` kamu
4. Railway akan otomatis detect `Dockerfile` dan build
5. **Settings → Networking → Generate Domain**
6. Selesai! URL: `https://xauusd-bot-production.up.railway.app`

### Step 3: (Optional) Set Environment Variables

Di Railway dashboard → **Variables** tab:

```
TWELVEDATA_API_KEY=your_key_here  # Optional, untuk real gold prices
PORT=3000                          # Railway set otomatis
NODE_ENV=production                # Auto set
```

Bot tetap jalan tanpa API key (pakai simulasi harga real-time).

---

## 📊 Fitur

- **Dashboard**: Real-time price, signal BUY/SELL/HOLD, 7 indikator (RSI, MACD, EMA Cross, EMA50, Bollinger, Stochastic, ROC)
- **Paper Trade**: Auto-open posisi dengan saldo virtual $10,000, SL/TP otomatis dari ATR, equity curve, statistik lengkap
- **Multi-tab**: Switch antara Dashboard dan Paper Trade

---

## 🔧 Dev Lokal

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Production build
npm run start        # Jalankan production server
```

---

## 🐳 Docker (Alternative: VPS/Cloud Run/etc)

```bash
# Build
docker build -t xauusd-bot .

# Run
docker run -p 3000:3000 --name xauusd-bot xauusd-bot

# Dengan env vars
docker run -p 3000:3000 -e TWELVEDATA_API_KEY=xxx xauusd-bot
```

---

## 💡 Notes

- **State in-memory**: Saldo virtual & posisi disimpan di RAM server. Restart = reset. Untuk persistensi, perlu tambah database (Redis/PostgreSQL).
- **Free tier Railway**: $5 credit/bulan, cukup untuk 1 app kecil selalu-on.
- **SSE support**: Railway mendukung Server-Sent Events dengan baik (tidak seperti Vercel).
- **Background ticker**: Engine jalan terus selama proses hidup (1 tick/detik).

---

## 🆘 Troubleshooting

**Bot loading terus?**
- Cek Railway logs di dashboard
- Pastikan build sukses (tidak ada TypeScript error)
- Tunggu 30-60 detik untuk first deploy (cold start)

**Saldo reset ke $10,000?**
- Itu normal — state in-memory hilang saat restart
- Untuk persistensi, perlu database

**Harga tidak update?**
- Cek koneksi ke TwelveData API (kalau pakai API key)
- Tanpa API key, bot pakai simulasi (tetap berfungsi)

---

Bot ini untuk **edukasi**, bukan saran finansial. Trading XAUUSD berisiko tinggi.
