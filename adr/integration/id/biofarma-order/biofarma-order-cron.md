# ADR: Eksekusi Cron Job Biofarma Order Controller (v3.0)

## Status

Diterima

## Konteks

Biofarma Order Controller (`biofarmaOrderController.js`) di layanan `apps/3.0/main-api` bertanggung jawab untuk memproses pesanan dari Biofarma. Controller ini berinteraksi dengan API eksternal untuk membuat, memperbarui, dan membatalkan pesanan di sistem Smile berdasarkan data Biofarma.

Untuk memastikan sinkronisasi pesanan tepat waktu, fungsi utama controller ini dijalankan secara berkala melalui cron job.

## Keputusan

Biofarma Order Controller dijadwalkan untuk berjalan otomatis menggunakan cron job yang dikonfigurasi dalam skrip `package.json` pada layanan `apps/3.0/main-api`. Secara spesifik:

- **Eksekusi Per Jam:**  
  Skrip: `cmd:biofarma-hourly`  
  Perintah: `npm-run-all build && node dist/command.js checkBiofarmaOrder --isV2=false --monthly=true`  
  Ini menjalankan proses pengecekan pesanan setiap jam untuk menjaga data tetap terbaru.

- **Eksekusi Harian:**  
  Skrip: `cmd:biofarma`  
  Perintah: `npm-run-all build && node dist/command.js checkBiofarmaOrder --isV2=false`  
  Ini menjalankan proses pengecekan pesanan penuh setiap hari.

Skrip-skrip ini dimaksudkan untuk dipicu oleh scheduler cron eksternal atau task runner untuk mengotomatisasi proses sinkronisasi pesanan.

## Konsekuensi

- Sistem menjaga sinkronisasi pesanan Biofarma dengan platform Smile hampir secara real-time.
- Menjalankan proses baik per jam maupun harian memastikan konsistensi data dan pembaruan tepat waktu.
- Cron job bergantung pada variabel lingkungan untuk konfigurasi seperti URL API dan kredensial.
- Monitoring dan logging yang tepat sangat penting untuk mendeteksi dan menangani kegagalan selama eksekusi terjadwal ini.

---

# Panduan Kompatibilitas Maju: Migrasi Biofarma Order Controller dari v3.0 ke v5.0

## Ikhtisar

Panduan ini menguraikan pertimbangan dan langkah yang direkomendasikan untuk memastikan kompatibilitas maju saat memigrasi Biofarma Order Controller dan eksekusi cron job-nya dari versi 3.0 ke versi 5.0 layanan `main-api`.

---

_Dokumen ADR dan panduan ini mendokumentasikan setup cron job saat ini dan memberikan panduan kompatibilitas maju untuk upgrade di masa depan._
