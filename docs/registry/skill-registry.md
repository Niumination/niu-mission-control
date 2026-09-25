# Skill Registry — Niu-Mission-Control

> Registry lengkap 121 skill ada di `~/Desktop/Niumination/docs/registry/skill-registry.md` (auto-generated via `skills/sync-to-agents.sh` + `scripts/skill-manifest.py`).

## Skill Relevan untuk Mission-Control

| Skill | Trigger | Level | Deskripsi |
|---|---|---|---|
| `external-pr-audit` | PR dari arena.ai, designarena.ai, GitHub App pihak ketiga | P0 | Audit PR luar sebelum merge ke ekosistem — memeriksa lalu melaporkan, bukan eksekusi otomatis |
| `secret-scan-staged` | pre-commit hook | P0 | Scan rahasia di staged files via `scripts/secret-scan-staged.py` + `.githooks/pre-commit` |
| `model-mapping` | `docs/registry/model-mapping.md` | P1 | Auto-discovery model mapping via probe HTTP-200 |
| `ecosystem-health` | `scripts/ecosystem-health.mjs` | P1 | Cek health semua services termasuk mission-control `/api/mc/health` + push ke `niu-dash` |
| `backup-verify` | `scripts/backup.ts` | P1 | Verify backup integrity via `VACUUM INTO` + `PRAGMA integrity_check` |
| `dispatch-approval` | approval gate | P1 | HITL approval flow untuk aksi berbahaya |

## Sync

Skill sync HANYA via tool resmi:
```bash
python3 ~/Desktop/Niumination/scripts/skill-manifest.py
~/Desktop/Niumination/skills/sync-to-agents.sh
```

Jangan copy-paste manual antar agent target (Hermes/USB).
