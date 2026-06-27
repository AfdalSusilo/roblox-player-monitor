# 🎮 Roblox Player Monitor v2.0

**Dashboard pemantauan multi-player Roblox — live saat dibuka, tanpa database.**

## ✨ Fitur

- 🔴 **Live Saat Dibuka** — Tanpa server/database, semua client-side
- 🔄 **Auto-Refresh** — Data diperbarui berkala (10s / 30s / 60s / 5m / off)
- 🎯 **Multi-Player** — Monitor semua player, pilih spesifik
- 📅 **Filter Tanggal** — Rentang tanggal mulai & akhir
- 🔍 **Pencarian & Filter Event** — Real-time
- 📊 **4 Tab**: Behavior, GUI, NPC, **Overview** (chart aktivitas per player)
- 📈 **Visualisasi**: Timeline, Heatmap, Bar chart, Doughnut chart
- 📄 **Sorting** — Klik header kolom untuk sort asc/desc
- 📥 **3 Format Ekspor**: CSV, Excel (XLSX), JSON — format ARG_Report
- 📑 **Pagination** fleksibel (25/50/100/200/500 baris)
- 🌙 **Dark mode**
- 📱 **Responsif**

## 🚀 Cara Menjalankan

Cukup buka `index.html` di browser, atau deploy:

```bash
# Local
open index.html

# Atau deploy ke Vercel (gratis) — langsung production
```

## 🔗 Live Demo

[https://roblox-player-monitor.vercel.app](https://roblox-player-monitor.vercel.app)

## 📁 Struktur Data

| File | Deskripsi |
|------|-----------|
| `data/behavior_logs.json` | Log pergerakan & event player |
| `data/gui_logs.json` | Log interaksi GUI & form |
| `data/npc_interactions.json` | Log percakapan player ↔ NPC |

Setiap file berisi array objek dengan format yang sama seperti sheet `ARG_Report` di Excel sumber.

## 🔄 Cara Update Data

Ganti file di folder `data/` dengan data baru (format JSON yang sama), lalu redeploy atau tekan tombol **Reset** + **Terapkan** di halaman.

## 🛠️ Teknologi

- **Vanilla JS** — Tanpa framework
- **[SheetJS](https://sheetjs.com/)** — Ekspor XLSX
- **[Chart.js](https://www.chartjs.org/)** — Visualisasi
- **Tanpa database** — Semua dari file JSON statis
