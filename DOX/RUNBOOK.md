# Niu-MissionControl — RUNBOOK

> **Tujuan:** SOP untuk operasi harian, troubleshooting, dan recovery
> **Versi:** 1.0

---

## 1. Startup Routine

Saat sistem baru nyala / reboot, komponen yang perlu dicek:

```bash
# 1. Verifikasi HermesAgent USB termount
ls /Volumes/HermesAgent/         # Harus muncul

# 2. Cek gateway (launchd auto-restart)
launchctl list | grep hermes     # PID harus ada
# Jika mati:
launchctl kickstart -kp gui/$(id -u)/ai.hermes.gateway

# 3. Cek herdr server
HOME=/Users/zaryu herdr status   # Socket harus connect
# Jika socket broken (ExFAT):
ln -sf /Users/zaryu/.config/herdr/herdr.sock $HOME/.config/herdr/herdr.sock

# 4. Cek cron jobs
cronjob action=list               # 3 jobs harus enabled

# 5. Cek dashboard
curl http://localhost:5199        # Kalau jalan → OK
# Jika mati:
cd /Users/zaryu/Desktop/Niumination/projects/niu-kanban-dash && pnpm start &
```

---

## 2. Menu Harian

### Pagi (08:00 WIB)

1. **Cek kanban task baru** — `kanban list ready` atau cek dashboard
2. **Cek cron semalam** — brain-capture jam 21:00, apa outputnya?
3. **Cek herdr agents** — `herdr agent list` — pastikan semua idle
4. **Cek project git status** — ada uncommitted dari hari sebelumnya?

### Sepanjang Hari

1. Proses task berdasarkan prioritas (label `[Urgent]` > lainnya)
2. Untuk task multi-step: tampilkan plan → tunggu approval → execute → report
3. Untuk task single: langsung gas

### Malam (21:00 WIB)

1. Pastikan brain-capture sudah jalan (cek output cron)
2. Pastikan tidak ada task yang stalled
3. Briefing: ringkasan progress hari ini (opsional, sesuai permintaan)

---

## 3. Troubleshooting Reference

### 3.1 Herdr Socket Error

**Gejala:** `herdr status` atau `herdr agent list` error "connection refused"
**Penyebab:** HOME override ke ExFAT (tidak support Unix socket)
**Fix:**
```bash
ln -sf /Users/zaryu/.config/herdr/herdr.sock $HOME/.config/herdr/herdr.sock
ln -sf /Users/zaryu/.config/herdr/herdr-client.sock $HOME/.config/herdr/herdr-client.sock
```

### 3.2 Dashboard 500 Error

**Gejala:** Kanban dashboard muncul 500
**Penyebab 1:** Kanban DB ter-lock oleh proses lain
**Fix 1:**
```bash
lsof /Users/zaryu/.hermes/kanban.db   # Cek proses yang lock
kill <PID>                            # Kill stale process
```

**Penyebab 2:** Server.js crash
**Fix 2:**
```bash
cd /Users/zaryu/Desktop/Niumination/projects/niu-kanban-dash && pnpm start &
```

### 3.3 Gateway Down

**Gejala:** Model tidak bisa dipanggil, response error
**Penyebab:** Gateway crash
**Fix:**
```bash
# launchd auto-restart, tapi kalau tidak:
launchctl kickstart -kp gui/$(id -u)/ai.hermes.gateway
# Cek log:
cat /Volumes/HermesAgent/HermesAgentUSB/data/logs/gateway.error.log | tail -50
```

### 3.4 Agent Hang / Stuck

**Gejala:** Agent status "working" >5 menit
**Fix:**
```bash
herdr agent kill <nama>
# Tunggu 2 detik
herdr agent start <nama> --tab <tab_id> -- opencode
# Kirim ulang definisi karakter
herdr agent send <nama> "KARAKTER KAMU: [definisi]"
```

### 3.5 Cron Job Missed

**Gejala:** Cron job tidak jalan sesuai schedule
**Cek:**
```bash
cronjob action=list    # Lihat status + last_run
cronjob action=run --job-id <id>   # Run manual
```

### 3.6 Disk Almost Full

**Cek:**
```bash
df -h /Volumes/HermesAgent/
# Jika >85%:
find /Volumes/HermesAgent/HermesAgentUSB/data/logs/ -name "*.log" -mtime +7 -delete
```

---

## 4. Quick Command Reference

```bash
# ===== AGENT MANAGEMENT =====
herdr agent list                  # Status semua agent
herdr agent send <name> "<task>"  # Kirim task ke agent
herdr agent kill <name>           # Force stop agent
herdr agent start <name> --tab <tab> -- opencode  # Start agent

# ===== DASHBOARD =====
# Kanban server
cd ~/Desktop/Niumination/projects/niu-kanban-dash && pnpm start
# MC dashboard (widgets)
open ~/Desktop/Niumination/projects/niu-mission-control/dashboard/index.html

# ===== PROJECT STATUS =====
cd ~/Desktop/Niumination/Production/Niumination && git status
# Atau pake aggregator:
bash ~/Desktop/Niumination/projects/niu-mission-control/scripts/aggregator.sh

# ===== GATEWAY =====
launchctl list | grep hermes
launchctl kickstart -kp gui/$(id -u)/ai.hermes.gateway

# ===== CRON =====
cronjob action=list
cronjob action=run --job-id <id>

# ===== SYSTEM =====
df -h /Volumes/HermesAgent/       # Cek disk usage
```

---

## 5. Recovery Checklist

Jika terjadi system failure, urutan recovery:

```
1. HermesAgent USB mount?       → `ls /Volumes/HermesAgent/`
2. Gateway running?              → `launchctl list | grep hermes`
3. Herdr socket?                 → `herdr status` (fix symlink)
4. Agents alive?                 → `herdr agent list`
5. Kanban DB accessible?         → `curl localhost:5199/api/tasks`
6. Cron jobs enabled?            → `cronjob action=list`
```

Jangan lanjut ke step N+1 sebelum step N verified ✅.

---

*RUNBOOK v1.0 — 16 Juli 2026*
