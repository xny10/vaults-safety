# Telegram Account Panel (Vercel + Upstash)

Bot Telegram untuk menyimpan & mengelola akun (website, email, password, tanggal dibuat) dengan:

- **Frontend panel**: Telegram inline keyboard
- **Backend**: Vercel Serverless Function (`/api/telegram`)
- **Database**: Upstash Redis
- **Security**: admin allow-list (Telegram ID) + password terenkripsi AES-256-GCM + webhook secret

> ⚠️ Sistem ini untuk mengelola akun milik sendiri / tim sendiri. Password disimpan dalam bentuk terenkripsi, bukan plaintext.

## Alur

```
User Telegram → Webhook Vercel (/api/telegram) → Upstash Redis → balik ke Telegram
```

Flow utama: **List Website → pilih Website → List Account → pilih Account → Detail → Show Password**

## Struktur Project

```
telegram-account-panel/
├── api/
│   ├── telegram.js          # webhook utama
│   └── health.js            # cek kesiapan env
├── lib/
│   ├── bot.js               # Telegram API (fetch)
│   ├── upstash.js           # Redis client + key builder
│   ├── crypto.js            # AES-256-GCM encrypt/decrypt
│   ├── auth.js              # admin allow-list + webhook secret
│   ├── keyboard.js          # inline keyboard + callback format
│   ├── render.js            # teks pesan
│   ├── router.js            # routing message & callback + state flow
│   ├── state.service.js     # state percakapan step-by-step
│   ├── website.service.js   # CRUD website + stats
│   ├── account.service.js   # CRUD account + auto-sync
│   ├── stats.service.js     # statistik
│   ├── sync.service.js      # rebuild index / integrity
│   └── log.service.js       # activity log
├── scripts/
│   ├── set-webhook.js       # set/info/delete webhook
│   └── smoke-test.js        # tes lokal crypto + import
├── package.json
├── vercel.json
└── .env.example
```

## Environment Variables

Salin `.env.example` ke `.env` (lokal) atau isi di dashboard Vercel:

| Variable | Fungsi |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token dari @BotFather |
| `TELEGRAM_ADMIN_IDS` | Telegram user ID yang boleh akses (pisah koma) |
| `UPSTASH_REDIS_REST_URL` | URL Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token Upstash Redis |
| `ENCRYPTION_SECRET` | Kunci enkripsi password (minimal 32 karakter) |
| `WEBHOOK_SECRET` | Secret pengaman webhook |
| `PUBLIC_URL` | URL publik app Vercel, dipakai script set-webhook (tidak dipakai saat runtime) |

Cara cari Telegram ID kamu: chat ke `@userinfobot`.

## Deploy

1. **Buat bot** di @BotFather, ambil token.
2. **Buat Upstash Redis**, ambil REST URL + token.
3. **Deploy ke Vercel** (CLI `vercel` atau connect GitHub repo).
4. **Isi semua ENV** di Vercel project settings.
5. **Set webhook** (lihat di bawah).

### Set Webhook

Pakai script (Node 20+, `.env` berisi `TELEGRAM_BOT_TOKEN`, `WEBHOOK_SECRET`, dan `PUBLIC_URL` = domain Vercel kamu):

```bash
node --env-file=.env scripts/set-webhook.js          # set
node --env-file=.env scripts/set-webhook.js --info    # cek
node --env-file=.env scripts/set-webhook.js --delete  # hapus
```

Atau manual via URL:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<app>.vercel.app/api/telegram?secret=<WEBHOOK_SECRET>
```

Script juga mengirim `secret_token`, sehingga Telegram menyertakan header
`X-Telegram-Bot-Api-Secret-Token` yang divalidasi backend.

## Tes Lokal

```bash
npm install
node scripts/smoke-test.js
```

Cek kesiapan deploy: buka `https://<app>.vercel.app/api/health`.

## Cara Pakai

Kirim `/start` ke bot. Menu:

- 📁 **Website** — list & detail website
- ➕ **Add Website** — tambah website
- ➕ **Add Account** — tambah account (step-by-step: email → password → tanggal → catatan)
- 🔍 **Search** — cari by email/keyword
- 📊 **Stats** — statistik
- 🔄 **Sync** — rebuild index & hitung ulang

Command lain: `/menu`, `/cancel`.

## Data Model (Upstash)

| Key | Isi |
|---|---|
| `websites:{userId}` | array websiteId |
| `website:{userId}:{websiteId}` | detail website |
| `accounts:{userId}:{websiteId}` | array accountId |
| `account:{userId}:{accountId}` | detail account (password terenkripsi) |
| `email_index:{userId}:{email}` | accountId (untuk search cepat) |
| `logs:{userId}` | list activity log |
| `state:{userId}` | state percakapan (TTL 30 menit) |

## Catatan Keamanan

- Hanya `TELEGRAM_ADMIN_IDS` yang bisa akses; selain itu ditolak.
- Password disimpan format `iv:authTag:cipherText` (AES-256-GCM), tidak pernah plaintext di DB.
- Password tidak pernah tampil di list; hanya lewat tombol **Show Password** (muncul sebagai popup alert, tidak tersimpan di riwayat chat) dan setiap akses dicatat di log.
- Webhook divalidasi dengan `WEBHOOK_SECRET`.
- Ganti `ENCRYPTION_SECRET` setelah deploy akan membuat password lama tidak bisa didekripsi — set sekali di awal dan simpan dengan aman.
