# Telegram GoFile Upload Bot

Bot Telegram untuk mengupload file langsung ke [GoFile.io](https://gofile.io/). Dibangun dengan Cloudflare Workers.

![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 🚀 Fitur

- ✅ Upload file langsung dari Telegram ke GoFile
- ✅ Ukuran file maksimal 25MB
- ✅ Pengaturan token GoFile per pengguna
- ✅ Informasi status akun GoFile
- ✅ Tidak memerlukan server, berjalan di edge dengan Cloudflare Workers

## 📋 Persyaratan

- Token Bot Telegram (dari [@BotFather](https://t.me/BotFather))
- Akun dan token API GoFile ([dapatkan di sini](https://gofile.io/myProfile))
- Akun Cloudflare (untuk men-deploy Workers)

## 🛠️ Cara Menggunakan

### 1. Deploy ke Cloudflare Workers

1. Buat akun di [Cloudflare Workers](https://workers.cloudflare.com/) (jika belum punya)
2. Instal Wrangler CLI: `npm install -g wrangler`
3. Login ke Cloudflare: `wrangler login`
4. Buat project baru: `wrangler init gofile-upload-bot`
5. Copy file `worker.js` dari repositori ini ke direktori project Anda
6. Buat KV namespace: `wrangler kv:namespace create "KV"`
7. Tambahkan konfigurasi KV di `wrangler.toml`:
```toml
kv_namespaces = [
  { binding = "KV", id = "ID_NAMESPACE_ANDA" }
]
```
8. Tambahkan variabel lingkungan untuk token bot Telegram di `wrangler.toml`:
```toml
[vars]
TELEGRAM_TOKEN = "TOKEN_BOT_TELEGRAM_ANDA"
```
9. Deploy worker: `wrangler publish`

### 2. Atur Webhook Telegram

Setelah men-deploy worker, Anda perlu mengatur webhook Telegram ke URL worker Anda:

```
https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook?url={URL_WORKER_ANDA}
```

Ganti `{TELEGRAM_TOKEN}` dengan token bot Telegram Anda dan `{URL_WORKER_ANDA}` dengan URL worker yang baru di-deploy.

### 3. Mulai Menggunakan Bot

1. Mulai chat dengan bot Telegram Anda
2. Gunakan perintah `/start` untuk memulai
3. Atur token GoFile dengan perintah `/settoken [TOKEN_GOFILE_ANDA]`
4. Kirim file untuk upload ke GoFile

## 📜 Perintah Bot

- `/start` - Memulai bot
- `/help` - Menampilkan bantuan
- `/settoken [TOKEN]` - Mengatur token GoFile Anda
- `/status` - Memeriksa informasi akun GoFile Anda

## 🔒 Keamanan

- Token GoFile disimpan per pengguna di Cloudflare KV
- Tidak ada data yang disimpan di server kecuali token pengguna
- Semua komunikasi dilakukan melalui HTTPS

## ⚠️ Batasan

- **Ukuran file maksimal: 25MB** (batasan dari API Telegram)
- Hanya mendukung file yang didukung oleh GoFile
- Tidak mendukung upload folder

## 🤝 Kontribusi

Kontribusi selalu diterima! Silakan buat issue atau pull request jika Anda menemukan bug atau ingin menambahkan fitur baru.

## 📝 Lisensi

Proyek ini dilisensikan di bawah lisensi MIT - lihat file [LICENSE](LICENSE) untuk detail.

## 🙏 Terima Kasih

- [GoFile](https://gofile.io/) untuk layanan hosting file gratis
- [Telegram Bot API](https://core.telegram.org/bots/api) untuk API yang luar biasa
- [Cloudflare Workers](https://workers.cloudflare.com/) untuk hosting serverless

---

Dibuat dengan ❤️ oleh Adrian