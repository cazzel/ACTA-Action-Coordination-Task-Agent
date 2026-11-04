# ACTA — Product Requirements (Step 1)

**Versi:** 0.1 — Draft untuk disetujui tim  
**Nama:** ACTA (*Action Coordination & Task Agent*)  
**Tagline:** *From Meeting Decisions to Executed Work.*  
**Perusahaan demo:** NOVA, perusahaan SaaS B2B fiktif  
**Kategori:** AI Agent — Enterprise & Industry

## Problem
Setelah rapat, tim masih harus membaca catatan, menemukan keputusan dan action items, menentukan pemilik serta tenggat, membuat task, mengirim notifikasi, dan memantau tindak lanjut secara manual. Hal ini membuang waktu dan dapat menyebabkan tugas terlewat, salah penanggung jawab, atau tenggat yang saling bertentangan.

## Target User
Project Manager, Operations Lead, dan Team Lead yang mengoordinasikan pekerjaan lintas divisi. Demo menggunakan perusahaan fiktif NOVA dengan delapan divisi: Product & Strategy, Engineering, UI/UX, Marketing, Sales & Business Development, Finance, People & Operations, dan Customer Success.

## Solusi / Product Vision
ACTA mengubah **audio rapat + dokumen proyek + data organisasi** menjadi tugas yang direkomendasikan, ditugaskan, dan ditindaklanjuti. Ringkasan rapat hanya output pendukung; tujuan utamanya adalah memastikan keputusan berubah menjadi pekerjaan yang benar-benar tercatat dan dieksekusi.

## Input → Output
**Input:** rekaman audio rapat, PPT/dokumen proyek, serta data divisi, karyawan, job description, skills, dan proyek.

**Output:** transkrip; keputusan dan action items; deskripsi tugas; tenggat dan proyek terkait; orang/divisi yang disebut; kandidat penanggung jawab dengan confidence dan alasan; peringatan konflik/ambiguitas; serta status eksekusi yang didukung hasil API.

## Core Workflow (MVP)
1. Upload audio dan dokumen proyek.
2. Transkripsikan audio dan ekstrak konteks dari dokumen.
3. Ekstrak keputusan, action items, tenggat, nama, dan proyek ke data terstruktur.
4. Ambil konteks organisasi menggunakan retrieval/RAG dan cocokkan tugas dengan divisi/karyawan berdasarkan semantic match, kata/skill, peran, dan konteks proyek.
5. Tampilkan confidence dan alasan. Kasus ambigu atau konflik harus meminta tinjauan manusia.
6. Setelah layak dieksekusi/disetujui, buat task nyata di Trello dan kirim notifikasi Slack.
7. Verifikasi respons tool dan tampilkan status berhasil/gagal; jangan mengklaim sukses tanpa bukti dari API.

**Confidence awal untuk diuji:** ≥80% tanpa konflik kritis → kandidat eksekusi otomatis; 60–79% → perlu konfirmasi; <60% → jangan auto-assign. Konflik tenggat material selalu memerlukan konfirmasi manusia. Ambang ini harus divalidasi, bukan dianggap hasil akurasi.

## Differentiator
- Menggabungkan audio, dokumen proyek, dan konteks organisasi.
- Menjelaskan alasan rekomendasi penanggung jawab.
- Mendeteksi ambiguitas/konflik dan tidak menebak diam-diam.
- Menjalankan integrasi eksternal sungguhan dan memverifikasi hasilnya—bukan hanya membuat ringkasan atau UI simulasi.

## Scope dan Non-Goals
**Wajib untuk MVP:** transkripsi, ekstraksi action/deadline, PPT/document understanding, RAG organisasi, responsibility matching, confidence/human review, Trello, Slack, log eksekusi, dan dashboard empat layar: Upload Meeting → Meeting Analysis → Action Items → Execution.

**Di luar MVP:** kalender/email, transkripsi real-time, aplikasi mobile, multi-company, dan analitik lanjutan. Jangan menambahkannya sebelum alur inti stabil.

## Ukuran Keberhasilan (Target Uji, Belum Hasil)
- ≥85% ketepatan ekstraksi action items dan tenggat eksplisit pada dataset uji tim.
- ≥80% ketepatan rekomendasi divisi pada kasus dengan penanggung jawab yang jelas.
- Semua konflik tenggat yang sengaja dimasukkan ke dataset uji ditandai untuk tinjauan manusia.
- Keberhasilan Trello/Slack dihitung dari respons API aktual.
- Setiap rekomendasi bisa ditelusuri ke bukti dari rapat, dokumen, atau data organisasi.

## Stack Kerja yang Diusulkan
Next.js/React; Python + FastAPI; LangGraph; OpenAI API untuk model/transkripsi; Supabase PostgreSQL + pgvector; Trello API; Slack webhook; Vercel untuk frontend; Railway/Render untuk backend; GitHub untuk repository. Simpan API key dalam environment variables, jangan commit ke repository publik, dan gunakan data fiktif untuk demo.

## Keputusan Tim yang Perlu Dikunci
- [ ] Setujui nama ACTA dan skenario NOVA.
- [ ] Setujui scope MVP dan fitur yang ditunda.
- [ ] Setujui stack teknis.
- [ ] Setujui pembagian peran: AI/Agent, Backend/Data/Integration, dan Frontend/Product/QA.

**Status:** Draft v0.1. Perubahan scope perlu disepakati bersama agar MVP tetap realistis untuk tenggat lomba.
