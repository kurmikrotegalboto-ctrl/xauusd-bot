# XAUUSD Bot — Cara Push ke GitHub di Windows

Ada 2 cara: **otomatis (pakai script PowerShell)** atau **manual (lebih kontrol)**.

---

## 🚀 Cara 1: Pakai Script PowerShell (Paling Mudah)

### Prasyarat
- Windows 10 atau 11 (sudah ada PowerShell bawaan)
- **Git for Windows** terinstall — kalau belum, download dari https://git-scm.com/download/win

### Langkah

1. **Download 2 file** dari folder `download/`:
   - `xauusd-bot-bundle.tar.gz`
   - `push-to-github.ps1`

2. **Buka PowerShell** (bukan Command Prompt):
   - Tekan `Win + R` → ketik `powershell` → Enter
   - Atau klik kanan di folder → "Open in Terminal"

3. **Pindah ke folder download** (ganti path sesuai lokasi file):
   ```powershell
   cd "C:\Users\pojsb\Downloads"
   ```
   (atau di mana pun Anda menyimpan file download-nya)

4. **Jalankan script**:
   ```powershell
   .\push-to-github.ps1
   ```

5. **Ikuti prompt**:
   - Masukkan GitHub username
   - Masukkan Personal Access Token (akan tersembunyi)
     - Bikin token di: https://github.com/settings/tokens
     - Pilih **Generate new token (classic)** → centang **repo** → Generate
   - Tekan Enter untuk nama repo default (`xauusd-bot`)

6. **Selesai!** Script akan otomatis:
   - Extract bundle
   - Buat repo di GitHub
   - Push semua kode

### ⚠️ Kalau Script Gagal Jalan (Policy Restriction)

PowerShell mungkin tolak script karena security policy. Fix:

```powershell
# Lihat policy saat ini:
Get-ExecutionPolicy

# Ubah ke RemoteSigned (ijinkan script lokal):
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Coba jalankan lagi:
.\push-to-github.ps1
```

Atau bypass sementara (hanya untuk run ini):
```powershell
powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1
```

---

## ✋ Cara 2: Manual (Tanpa Script)

Kalau script error atau Anda mau kontrol penuh:

### Step 1: Bikin Repo di GitHub.com
1. Buka https://github.com/new
2. Repository name: `xauusd-bot`
3. Pilih **Public** (atau Private terserah)
4. **Jangan centang** "Add a README"
5. Klik **Create repository**

### Step 2: Extract Bundle
```powershell
# Di PowerShell, pindah ke folder download
cd "C:\Users\pojsb\Downloads"

# Extract (Windows 10+ sudah ada tar built-in)
tar xzf xauusd-bot-bundle.tar.gz

# Masuk ke folder
cd xauusd-bot
```

### Step 3: Push ke GitHub
Ganti `USERNAME` dengan username GitHub Anda:
```powershell
git remote add origin https://github.com/USERNAME/xauusd-bot.git
git branch -M main
git push -u origin main
```

Git akan minta login. Pakai:
- **Username**: username GitHub
- **Password**: Personal Access Token (BUKAN password akun GitHub!)
  - Bikin di https://github.com/settings/tokens (classic, scope: `repo`)

### Step 4: Verify
Buka `https://github.com/USERNAME/xauusd-bot` — harus ada semua file project.

---

## 📋 Setelah Push Berhasil — Deploy Gratis ke Render

1. **Buat Redis gratis di Upstash** (https://upstash.com)
   - Sign up with GitHub
   - Create Database → copy URL `rediss://default:PASSWORD@HOST:PORT`

2. **Deploy ke Render** (https://render.com)
   - Sign up with GitHub
   - New + → Blueprint → pilih repo `xauusd-bot`
   - render.yaml akan otomatis dipakai → klik **Apply**

3. **Set Environment Variables** di Render:
   - `REDIS_URL` = URL Upstash tadi
   - `TWELVEDATA_API_KEY` = `2f7f8b157aee4c619ce29f293d34b1cd`

4. **Buka URL** Render — done!

📖 Panduan lengkap: baca `DEPLOYMENT.md` di dalam repo setelah push.

---

## 🆘 Troubleshooting Windows

**"git is not recognized"**
- Install Git for Windows: https://git-scm.com/download/win
- Restart PowerShell setelah install

**"tar is not recognized"**
- Upgrade ke Windows 10 (1803+) atau Windows 11
- Atau pakai 7-Zip untuk extract file `.tar.gz`

**"curl is not recognized"**
- Windows 10 (1803+) sudah ada curl bawaan
- Atau pakai **Cara 2: Manual** di atas

**PowerShell script ditolak (policy error)**
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Push minta password terus, padahal sudah masukkan token**
- Pastikan pakai **token** bukan **password akun**
- Bikin token: https://github.com/settings/tokens (classic, scope: `repo`)
- Token harus fresh (tidak expired)

**Push gagal dengan "Authentication failed"**
- Token mungkin tidak punya scope `repo` — bikin ulang token
- Atau username salah — cek case-sensitive
