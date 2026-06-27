# 🎮 Roblox Player Monitor

**Dashboard pemantauan player Roblox — live saat dibuka, tanpa database, dengan ekspor data.**

## ✨ Fitur

- 🔴 **Live Saat Dibuka** — Semua data client-side, tidak perlu server/database
- 📊 **3 Tab Monitoring**: Behavior Logs, GUI Logs, NPC Interactions
- 🔍 **Pencarian & Filter** real-time
- 📈 **Visualisasi**: Timeline pergerakan & heatmap posisi (X/Y)
- 📥 **3 Format Ekspor**: CSV, Excel (XLSX), JSON
- 📄 **Pagination** dengan baris/halaman yang bisa disesuaikan
- 🌙 **Dark mode** — nyaman di mata
- 📱 **Responsif** — mobile & desktop

## 🚀 Cara Menjalankan

Cukup buka `index.html` di browser, atau deploy ke layanan static hosting:

```bash
# Local
open index.html

# Atau dengan static server
npx serve .
```

### Deploy ke Vercel (gratis)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push repo ini ke GitHub
2. Import ke [Vercel](https://vercel.com)
3. Done! 🎉

## 📁 Struktur Data

| File | Kolom | Deskripsi |
|------|-------|-----------|
| `data/behavior_logs.json` | player_id, player_name, event_type, x, y, z, timestamp, behavior_code | Log pergerakan & event player |
| `data/gui_logs.json` | player_id, player_name, player_nickname, ui_element, input_data, timestamp, … | Log interaksi GUI & jawaban form |
| `data/npc_interactions.json` | player_id, player_name, npc_target, role, message_content, timestamp | Log percakapan player ↔ NPC |

## 🔄 Format Ekspor

Hasil ekspor mengikuti format ARG_Report yang sama dengan file Excel sumber:

- **CSV** — kompatibel dengan Excel, Google Sheets
- **Excel (XLSX)** — format `.xlsx` dengan sheet `ARG_Report`
- **JSON** — struktur lengkap untuk diproses lebih lanjut

## 🛠️ Teknologi

- **HTML5 + CSS3 + Vanilla JS** — tanpa framework
- **[SheetJS](https://sheetjs.com/)** — ekspor XLSX client-side
- **[Chart.js](https://www.chartjs.org/)** — visualisasi data
- **Tanpa database** — semua data dari file JSON statis

## 📝 Catatan

- Data contoh berasal dari laporan ARG tanggal **25 Juni 2026**
- Player: **SirrushRac** (ID: 10306575664)
- Untuk mengganti data, cukup ganti file di folder `data/` dengan format yang sama
