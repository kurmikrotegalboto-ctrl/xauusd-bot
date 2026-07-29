# XAUUSD Bot — Cara Super Simpel Push ke GitHub di Windows

**Tidak perlu PowerShell.** Cukup Command Prompt biasa + double-click.

---

## 📋 Yang Perlu Disiapkan (5 menit)

### 1. Install Git for Windows (kalau belum)
- Download: https://git-scm.com/download/win
- Install (next-next aja, default OK)
- **Restart komputer** setelah install

### 2. Bikin Repo Kosong di GitHub
1. Login ke https://github.com
2. Klik tombol **+** di kanan atas → **New repository**
3. **Repository name**: `xauusd-bot`
4. Pilih **Public** (atau Private terserah)
5. **JANGAN centang** "Add a README file"
6. Klik **Create repository**
7. Akan muncul halaman dengan URL seperti `https://github.com/USERNAME/xauusd-bot`

### 3. Bikin Personal Access Token
1. Buka https://github.com/settings/tokens
2. Klik **Generate new token** → **Generate new token (classic)**
3. **Note**: `xauusd-bot push`
4. **Expiration**: 90 days
5. **Scopes**: centang `repo` (full)
6. Klik **Generate token** di bawah
7. **COPY TOKEN** sekarang! (format: `ghp_xxxxxxxxxxxx...`)
   - Token cuma muncul sekali, kalau hilang harus bikin ulang

---

## 🚀 Langkah Push (3 langkah simpel)

### Step 1: Download & Extract Bundle

Download 2 file dari folder `download/`:
- **`xauusd-bot-bundle.zip`** ← pakai yang ZIP ini (Windows native)
- **`push-to-github.bat`**

Taruh dua file ini di folder yang sama, contoh: `C:\Users\pojsb\Downloads\xauusd\`

**Extract ZIP**:
- Klik kanan `xauusd-bot-bundle.zip` → **Extract All...** → **Extract**
- Akan muncul folder `xauusd-bot` berisi semua kode

### Step 2: Pindahkan .bat ke Folder Hasil Extract

Pindahkan file `push-to-github.bat` ke DALAM folder `xauusd-bot` (hasil extract).

Struktur harus jadi begini:
```
C:\Users\pojsb\Downloads\xauusd\
├── xauusd-bot-bundle.zip        ← asal (boleh dihapus)
└── xauusd-bot\                  ← hasil extract
    ├── push-to-github.bat       ← DIPINDAHKAN KE SINI
    ├── Dockerfile
    ├── package.json
    ├── render.yaml
    ├── src\
    └── ... (file lain)
```

### Step 3: Double-Click `push-to-github.bat`

1. Buka folder `xauusd-bot` di File Explorer
2. **Double-click** `push-to-github.bat`
3. Akan muncul jendela hitam (Command Prompt)
4. Ikuti prompt:
   - Tekan Enter (setelah baca instruksi)
   - **GitHub username**: ketik username Anda (contoh: `pojsb`)
   - **Personal Access Token**: paste token dari Step 3 di atas
   - **Repository name**: tekan Enter aja (default `xauusd-bot`)
5. Tunggu proses push (10-30 detik)
6. Lihat "PUSH BERHASIL!" — selesai!

---

## ✅ Verify Push Berhasil

Buka browser ke `https://github.com/USERNAME/xauusd-bot` — harus ada semua file:
- `Dockerfile`
- `package.json`
- `render.yaml`
- folder `src/`
- dll

---

## 🆘 Troubleshooting

### "git is not recognized"
Git belum terinstall atau belum di-add ke PATH.
- Solusi: install Git for Windows, **restart komputer**, coba lagi

### "fatal: not a git repository"
Anda menjalankan .bat di luar folder `xauusd-bot`.
- Solusi: pastikan `push-to-github.bat` ada DI DALAM folder `xauusd-bot` (sejajar dengan `Dockerfile`, `package.json`, dll)

### "Authentication failed" / "403 Forbidden"
- Token salah → bikin ulang token
- Token tidak ada scope `repo` → edit token, centang `repo`
- Username salah (case-sensitive!)
- Repo sudah ada isinya (bukan kosong) → hapus repo, bikin ulang yang kosong

### "fatal: remote origin already exists"
Aman, .bat otomatis handle ini. Coba jalan lagi.

### Folder `xauusd-bot` tidak ada setelah extract
- Coba pakai 7-Zip atau WinRAR kalau Windows Explorer gagal extract
- Atau extract di folder lain

### .bat tidak jalan saat di-double-click
- Coba klik kanan → **Open**
- Atau buka Command Prompt, cd ke folder, jalankan `push-to-github.bat`

---

## 📞 Kalau Masih Sulit

Coba cara alternatif: **upload manual via GitHub web**

1. Bikin repo kosong di GitHub (tanpa README)
2. Extract ZIP bundle
3. Di halaman repo GitHub yang kosong, klik **uploading an existing file**
4. Drag & drop SEMUA file dari folder `xauusd-bot` ke browser
5. Scroll ke bawah → **Commit changes**
6. Selesai!

Cara ini lebih lambat (harus upload manual), tapi pasti jalan tanpa script apapun.

---

## 🎯 Setelah Push Berhasil → Deploy ke Render

Buka file **`DEPLOYMENT.md`** di dalam repo (`xauusd-bot/DEPLOYMENT.md`).
Ikuti section "REKOMENDASI: Deploy Gratis ke Render + Upstash Redis".

Atau langsung:
1. https://upstash.com → bikin Redis gratis → copy URL
2. https://render.com → Blueprint → pilih repo → set REDIS_URL → deploy!
