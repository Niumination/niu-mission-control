# PRD: Niu-MissionControl Evolution

> **Status:** Final
> **Pemilik:** Afrizal Munthe (Niumination)
> **Diperbarui:** 17 Juli 2026
> **Dokumen Terkait:** MASTERPLAN.md, TECHSPEC.md, UX.md, TIMELINE.md

---

## 1. Pernyataan Masalah

Niu-MissionControl saat ini sudah memiliki fondasi yang kuat — 6 agen spesialis, dashboard widget, aturan operasi yang matang, dan runbook. Namun, sistem komando ini masih beroperasi di **satu thread Telegram** tanpa pemisahan topik yang jelas, dashboard masih berupa **widget grid satu halaman** tanpa navigasi tab, dan tidak ada **pencatatan aktivitas** yang terstruktur. Akibatnya:

1. **Kebisingan di Telegram** — semua percakapan agent bercampur di satu thread, menyulitkan tracking
2. **Dashboard terbatas** — informasi agent, aktivitas, dan jadwal tidak terorganisir dengan baik
3. **Tidak ada histori** — aktivitas agent tidak tercatat, tidak bisa dianalisis untuk optimasi
4. **Tidak ada akses remote** — dashboard hanya bisa diakses dari localhost

Kita perlu **evolusi**, bukan revolusi. Semua yang sudah berjalan harus tetap berfungsi, sementara fitur baru ditambahkan secara additive.

---

## 2. Target Audiens

| Tipe | Deskripsi | Kebutuhan Utama |
|------|-----------|----------------|
| **Pengguna Utama** | Afrizal Munthe — operator Niu-MC, Pranata Komputer | Antarmuka komando yang cepat, terorganisir, bisa diakses dari mana saja |
| **Agen AI** | Builder, Pengawas, Arsitek, Penjaga, Scribe, Reach | Routing pesan yang tepat ke profil masing-masing |
| **Pengguna Kedua** | Anggota grup Niu-MissionControl (jika ada di masa depan) | Antarmuka yang jelas dengan topik terpisah |

---

## 3. Fitur Inti

| Prioritas | Fitur | Deskripsi | Upaya |
|-----------|-------|-----------|-------|
| **P0** | **Topic Router** | Routing pesan Telegram berdasarkan Topic ID ke agent yang sesuai | S |
| **P0** | **Activity Log Database** | Catat setiap aksi agent: waktu, agent, task, model, token, status | S |
| **P0** | **Overview Dashboard Tab** | Status gateway + aktivitas terkini + beban sistem + token usage | M |
| **P1** | **Agents Tab** | Kartu per agent, heatmap aktivitas, pie chart distribusi tugas | M |
| **P1** | **Chat Tab Dashboard** | Chat agent langsung dari browser via Hermes API bridge | L |
| **P1** | **Content Library** | Auto-save dokumen per agent, filter, cari | M |
| **P1** | **Schedule Tab** | Visual cron jobs: lihat, trigger, hapus dari dashboard | M |
| **P1** | **Token Usage Tracker** | Monitoring konsumsi token per model per sesi | S |
| **P1** | **Tailscale Remote Access** | Akses dashboard dari luar via Tailscale tunnel | S |
| **P2** | **Office 3D Tab** | Visualisasi 3D agent status (Three.js / CSS fallback) | XL |
| **P2** | **Docs Tab** | Dokumentasi proyek langsung di dashboard | S |
| **P3** | **Activity Heatmap Detail** | Heatmap granular: breakdown per jam, per agent | M |
| **P3** | **Model Selector Dropdown** | Ganti model agent dari dashboard (config bridge) | M |

---

## 4. Metrik Kesuksesan

| Metrik | Target | Cara Ukur |
|--------|--------|-----------|
| **Topic Routing Akurat** | 100% pesan ter-routing ke agent yang benar | Log routing, audit sampling |
| **Dashboard Tab Response** | < 1 detik untuk semua tab | `curl -w %{time_total}` |
| **Activity Log Coverage** | 100% aktivitas agent tercatat | Bandingkan log dengan jumlah delegasi |
| **Chat Response Time** | < 10 detik dari dashboard | `time curl -X POST /api/mc/chat` |
| **Zero Destruction** | 0 bug pada sistem existing | Semua endpoint lama masih return 200 |
| **Uptime Dashboard** | > 99% setelah migrasi | Cron health check tiap 15 menit |
| **Dokumen Foundation Lengkap** | 6/6 dokumen DOX terisi | `ls DOX/*.md` |

---

## 5. Pemangku Kepentingan

| Peran | Nama | Tanggung Jawab |
|-------|------|----------------|
| Pemilik Produk | Afrizal Munthe | Keputusan akhir, prioritas fitur |
| Arsitek | Hermes Agent (Arsitek) | Desain sistem, dokumentasi teknis |
| Developer | Builder (via herdr) | Implementasi kode |
| Reviewer | Pengawas (via herdr) | Code review, quality gate |
| Ops | Penjaga (via herdr) | Monitoring, cron, kesehatan sistem |
| Dokumentasi | Scribe (via herdr) | Dokumentasi pengguna |

---

## 6. Batasan

| Batasan | Detail |
|---------|--------|
| **Teknis** | Tidak ada database relasional selain SQLite. Server Python http.server murni (bukan Flask/Django — should not change). ExFAT USB tidak support Unix socket (herdr symlink workaround sudah ada) |
| **Waktu** | Estimasi total ~7 jam, tersebar dalam 3 minggu |
| **Infrastruktur** | Tidak ada VPS terpisah — semua berjalan di Mac lokal (HermesAgent USB) |
| **Regulasi** | Tidak ada regulasi eksternal. Data bersifat internal Niumination |
| **Biaya** | $0 untuk software (semua open source / free tier). $0 untuk hosting (lokal) |

---

## 7. Di Luar Lingkup

| Fitur | Alasan Tidak Dibangun |
|-------|----------------------|
| **Login/auth dashboard** | Hanya diakses via Tailscale pribadi. Tidak perlu auth tambahan |
| **Multi-user dashboard** | Hanya 1 operator. Tidak perlu multi-session |
| **Notifikasi email/SMS** | Semua notifikasi via Telegram. Cukup |
| **Docker container** | Berjalan langsung di macOS. Container = overhead tidak perlu |
| **CI/CD pipeline** | Belum diperlukan untuk project single-developer. Deploy manual via git |
| **API rate limiting** | Hanya 1 pengguna. Belum perlu |

---

*Dokumen ini mengikuti template project-foundation skill.*
