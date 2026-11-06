# ACTA — Clean replacement package

Paket ini adalah satu struktur proyek ACTA yang konsisten. Backend utama hanya berada di `ACTA_step5_backend/backend`; jangan gunakan folder `backend` lain di root.

## Cara mengganti folder lama dengan aman (Windows)

1. Tutup VS Code dan hentikan server ACTA yang sedang berjalan (`Ctrl+C`).
2. Ubah nama folder lama `C:\Users\USER\Desktop\ACTA` menjadi `ACTA_BACKUP`. Jangan langsung hapus backup.
3. Ekstrak folder `ACTA` dari ZIP ini ke Desktop. Hasil akhirnya harus `C:\Users\USER\Desktop\ACTA`.
4. Jika backup lama memiliki `ACTA_step5_backend\backend\.env`, salin file itu ke lokasi yang sama pada folder ACTA baru. Jangan tempel kredensial ke chat atau GitHub.
5. Jika ada `.acta_google_calendar_token.json` lama, jangan salin kecuali diperlukan; jika OAuth perlu disambungkan ulang, lakukan Connect Google Calendar dari aplikasi. Token lama bersifat privat.
6. Buka folder baru `ACTA` di VS Code. Pilih interpreter dari `ACTA_step5_backend\backend\.venv\Scripts\python.exe` setelah membuat virtual environment (langkah di bawah).

## Setup backend

```powershell
cd C:\Users\USER\Desktop\ACTA\ACTA_step5_backend\backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Buka `.env` dan isi kredensial Supabase, OpenRouter, Telegram, Google Calendar, dan transcription provider sesuai kebutuhan. Jangan pernah commit `.env`.

Jalankan backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs: `http://127.0.0.1:8000/docs`

## Setup frontend (terminal baru)

```powershell
cd C:\Users\USER\Desktop\ACTA\frontend
npm install
npm run dev
```

Buka `http://localhost:5173/`.

## Supabase

Periksa project Supabase yang benar, lalu jalankan `database/ACTA_FULL_SUPABASE_SETUP.sql` melalui SQL Editor jika skema belum diterapkan. Pastikan bucket `acta-meeting-files` bersifat private. Jangan menjalankan SQL berulang pada project produksi tanpa memeriksa dampaknya.

## Catatan penting

- ZIP ini sengaja tidak membawa `.env`, OAuth token, `.venv`, `node_modules`, atau `.git`.
- Google Calendar dan Telegram memerlukan kredensial milik Anda dan pengujian OAuth/API secara langsung.
- `ACTA_step5_backend/backend` adalah satu-satunya backend utama. Tidak ada folder `backend` duplikat di root.
- Jangan hapus `ACTA_BACKUP` sampai frontend, backend, Supabase, Telegram, dan Google Calendar sudah Anda verifikasi.
