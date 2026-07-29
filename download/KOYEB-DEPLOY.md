# XAUUSD Bot — Deploy Gratis ke Koyeb + Upstash (NO Credit Card)

Panduan step-by-step untuk deploy bot XAUUSD ke Koyeb (web hosting) + Upstash (Redis database) — semuanya gratis, tanpa kartu kredit.

---

## 📋 Prasyarat

- ✅ Repo GitHub sudah ada: `https://github.com/kurmikrotegalboto-ctrl/xauusd-bot`
- ✅ Tidak perlu kartu kredit
- ✅ Hanya butuh: akun GitHub (sudah punya)

---

## 🚀 Step 1: Bikin Redis Gratis di Upstash (3 menit)

### 1.1 Signup
1. Buka https://upstash.com
2. Klik **Login with GitHub** (atas kanan)
3. Authorize Upstash untuk akses GitHub
4. Setelah login, klik **Create Database**

### 1.2 Isi Form Database
| Field | Isi |
|-------|-----|
| Database Name | `xauusd-redis` |
| Primary Region | `Global` (default, gratis) |
| Type | **Regional** (free tier — 10k commands/day) |

### 1.3 Create & Copy URL
1. Klik **Create** di bawah
2. Database dibuat — masuk ke halaman detail
3. Cari bagian **"Endpoint"** / **"Connection Details"**
4. Cari tombol **"Copy"** di sebelah **"REST URL"** atau **"Redis URL"**
5. URL format-nya: `rediss://default:PASSWORD@HOST.upstash.io:6379`

**SIMPAN URL INI** — kita pakai di Step 3.

### Verifikasi URL format:
```
rediss://default:abc123xyz@us1-cool-dog-12345.upstash.io:6379
        ↑       ↑              ↑                  ↑
      protocol  password       host               port
```

- ✅ Format benar: `rediss://default:...@xxx.upstash.io:6379`
- ❌ Salah: `redis://` (harus `rediss://` dengan 2 s untuk TLS)
- ❌ Salah: tanpa `default:` sebelum password

---

## 🚀 Step 2: Deploy Web App ke Koyeb (5 menit)

### 2.1 Signup Koyeb
1. Buka https://www.koyeb.com
2. Klik **Sign Up** (atas kanan)
3. Pilih **Sign Up with GitHub**
4. Authorize Koyeb untuk akses GitHub
5. Pilih: **Deploy from GitHub** (bukan Docker Hub)

### 2.2 Pilih Repo
1. Klik **Add GitHub Account** kalau muncul — authorize
2. Cari repo: `kurmikrotegalboto-ctrl/xauusd-bot`
3. Klik repo tersebut → klik **Next**

### 2.3 Konfigurasi Service
Isi form:

| Field | Value |
|-------|-------|
| **Service Name** | `xauusd-bot` (default) |
| **Service Type** | `Web Service` (default) |
| **Builder** | `Buildpacks` atau `Dockerfile` (auto-detect) |
| **Dockerfile Path** | `./Dockerfile` (otomatis terisi) |
| **Port** | `3000` (bisa juga kosong, auto) |
| **Instance Type** | `Free` (512MB RAM) |
| **Regions** | `fra` (Frankfurt) atau `sin` (Singapore) — pilih terdekat |

### 2.4 Set Environment Variables
Scroll ke bawah sampai **Environment Variables**:

Klik **Add Variable** — isi:

**Variable 1:**
- **Key**: `REDIS_URL`
- **Value**: (paste URL Upstash dari Step 1.3)

**Variable 2:**
- **Key**: `TWELVEDATA_API_KEY`
- **Value**: `2f7f8b157aee4c619ce29f293d34b1cd`

**Variable 3 (optional, recommended):**
- **Key**: `NODE_ENV`
- **Value**: `production`

### 2.5 Deploy!
1. Cek semua sudah benar
2. Klik tombol **Create Service** di bawah
3. Koyeb mulai build (3-7 menit pertama)

### 2.6 Monitor Build
- Status: `Building` → `Starting` → `Healthy`
- Kalau ada error build, klik **Logs** untuk lihat detail
- Build selesai = status **Healthy** + URL aktif

---

## ✅ Step 3: Buka Bot Online

1. Setelah status **Healthy**, lihat bagian atas halaman service
2. URL format: `https://xauusd-bot-xxxx.koyeb.app`
3. Klik URL → bot berjalan! 🎉

### Verifikasi Persistence:
1. Buka tab **Paper Trade** — lihat saldo & posisi
2. Tunggu 5-10 menit sampai ada posisi terbuka (auto)
3. Di Koyeb dashboard, klik **Restart** service
4. Setelah restart, refresh web app → **saldo & posisi harus tetap ada** (karena Redis)

---

## 🆘 Troubleshooting

### "Build Failed" di Koyeb
- Klik **Logs** → scroll ke error
- Penyebab umum:
  - ❌ Dockerfile path salah — pastikan `./Dockerfile`
  - ❌ Memory OOM — free tier cuma 512MB, build heavy
  - ❌ npm install gagal — cek internet Koyeb

### "Application Error" saat buka URL
- Cek **Logs** service Koyeb
- Penyebab umum:
  - ❌ REDIS_URL format salah (harus `rediss://` bukan `redis://`)
  - ❌ Port salah — pastikan Dockerfile `EXPOSE 3000`
  - ❌ Redis connection gagal — cek Upstash dashboard, harus "Active"

### Saldo tetap reset ke $10,000 walau Redis aktif
- Cek Logs Koyeb: harus ada `[paper] Loaded from Redis: balance=$X`
- Kalau tidak ada, cek `REDIS_URL` benar
- Cek Upstash dashboard: harus ada traffic (Commands counter naik)

### Cold start lama
- Koyeb free tier tidak sleep (beda dengan Render)
- Tapi first deploy emang lama (build Docker dari awal)
- Setelah Live, response ~50-200ms

### Build OOM (Out of Memory) di Free Tier
Free tier Koyeb cuma 512MB. Kalau build Next.js OOM:
1. Tambah variable `NODE_OPTIONS=--max-old-space-size=460`
2. Atau build lokal, lalu push image ke Docker Hub (lebih advanced)

### "Cannot find module 'ioredis'"
- Build gagal install dependencies
- Cek `package.json` ada `ioredis` di dependencies (sudah ada di repo kita)

---

## 📊 Free Tier Limits

### Koyeb Free
- 1 web service (512MB RAM)
- 1 instance only
- ~150GB bandwidth/bulan
- No SSL certificate issues (auto-managed)
- Bot idle tidak sleep (beda dengan Render)

### Upstash Free
- 10,000 commands/day (bot pakai ~1,000-3,000/day tergantung traffic)
- 256MB storage (bot pakai <5MB)
- Auto-backup harian
- Untuk lebih: $0.20 per 100k commands (sangat murah)

---

## 🎯 Tips Optimasi

### Hindari OOM Build
1. Build lokal di laptop, push Docker image ke Docker Hub
2. Deploy dari Docker Hub (lebih cepat, tidak OOM)

### Keep Free Forever
- Koyeb free tier tidak ada batas waktu (selama quota tidak exceed)
- Bot kita pakai RAM rendah (~150MB saat jalan, 512MB saat build)
- Bandwidth 150GB cukup untuk ratusan user

### Add Custom Domain (Opsional)
- Koyeb support custom domain di free tier
- Tambah di: Service → Settings → Domains
- Format: `bot-anda.com` (perlu beli domain dulu)

---

## 📞 Kalau Masih Bingung

Kirim ke saya:
1. Screenshot error di Koyeb (bagian Logs)
2. Status service (Building/Healthy/Error)
3. URL yang muncul (kalau sudah ada)

Saya bantu debug sampai bot online.
