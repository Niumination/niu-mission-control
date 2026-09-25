-- Migration 000: Baseline v3 → v4 (Niumination Mission Control Aether)
--
-- KENAPA PERLU MIGRASI INI
-- 001_initial.sql memakai `CREATE TABLE IF NOT EXISTS`. Kalau DB sudah punya
-- tabel v3 (agents/tasks/cost_tracking/dispatches/system_logs), statement itu
-- DILEWATI — tapi statement CREATE INDEX setelahnya tetap jalan dan gagal:
--
--   CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent);
--   → SQLITE_ERROR: no such column: assigned_agent
--
-- Skema v3 vs v4 tidak kompatibel:
--   tasks : v3 punya `agent_id`; v4 pakai `assigned_agent` (nama berubah)
--           v3 tidak punya 14 kolom lifecycle v4
--   agents: v3 tidak punya description/adapter/system_prompt/enabled/created_at
--
-- Migrasi ini TIDAK menghapus apa pun. Untuk setiap tabel v3:
--   1. samakan nama kolom yang berubah (ALTER ... RENAME COLUMN)
--   2. tambah kolom v4 yang belum ada (ALTER ... ADD COLUMN)
-- 001_initial.sql lalu jalan normal untuk tabel yang benar-benar baru
-- (events/artifacts/approvals/audit_log/schedules/app_settings) dan membuat
-- index yang tadi gagal.
--
-- CATATAN: statement ALTER di bawah TIDAK idempoten. Kalau migrasi ini
-- sudah tercatat di schema_migrations, runner tidak akan menjalankannya lagi.
-- Jangan hapus baris di schema_migrations secara manual.

-- ──────────────────────────────────────────────────────────────────
-- TASKS: rename agent_id → assigned_agent
ALTER TABLE tasks RENAME COLUMN agent_id TO assigned_agent;

-- Kolom lifecycle v4 yang belum ada di v3
ALTER TABLE tasks ADD COLUMN instruction TEXT;
ALTER TABLE tasks ADD COLUMN depends_on TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN idempotency_key TEXT;
ALTER TABLE tasks ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE tasks ADD COLUMN requires_approval INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN metadata TEXT;
ALTER TABLE tasks ADD COLUMN error_message TEXT;
ALTER TABLE tasks ADD COLUMN queued_at DATETIME;
ALTER TABLE tasks ADD COLUMN claimed_at DATETIME;
ALTER TABLE tasks ADD COLUMN started_at DATETIME;
ALTER TABLE tasks ADD COLUMN submitted_at DATETIME;
ALTER TABLE tasks ADD COLUMN deadline_at DATETIME;
ALTER TABLE tasks ADD COLUMN next_retry_at DATETIME;

-- Status v3: pending → v4: inbox
UPDATE tasks SET status = 'inbox' WHERE status = 'pending';

-- ──────────────────────────────────────────────────────────────────
-- AGENTS: tambah kolom v4 yang belum ada
ALTER TABLE agents ADD COLUMN description TEXT;
ALTER TABLE agents ADD COLUMN model_default TEXT;
ALTER TABLE agents ADD COLUMN system_prompt TEXT;
ALTER TABLE agents ADD COLUMN adapter TEXT DEFAULT 'hermes';
ALTER TABLE agents ADD COLUMN adapter_config TEXT;
ALTER TABLE agents ADD COLUMN current_task_id TEXT;
ALTER TABLE agents ADD COLUMN enabled INTEGER DEFAULT 1;
-- SQLite menolak DEFAULT CURRENT_TIMESTAMP di ADD COLUMN (harus konstan).
-- created_at/updated_at diisi di 001 atau trigger; default dibiarkan NULL.
ALTER TABLE agents ADD COLUMN created_at DATETIME;
ALTER TABLE agents ADD COLUMN updated_at DATETIME;

-- v3 'active' → v4 'idle' (v4: online|idle|working|offline|error)
UPDATE agents SET status = 'idle' WHERE status = 'active';

-- Seed v4 (lib/server/db.ts) memakai adapter 'mock' untuk chief supaya
-- development jalan tanpa Hermes CLI terinstall. DB v3 punya 'hermes' untuk
-- semua agent — worker lalu claim task lalu menggantung karena hermes CLI
-- tidak tersedia / tidak ada kredensial, dan tidak ada retry (next_retry_at
-- NULL). Samakan ke 'mock' = persis DB kosong yang lulus test-sse 10/10.
--
-- Ini hanya mengubah chief. Empat agent lain (research/programmer/qa/
-- creator) tetap 'hermes' di seed v4 juga, jadi biarkan apa adanya.
UPDATE agents SET adapter = 'mock' WHERE id = 'chief';

-- ──────────────────────────────────────────────────────────────────
-- COST_TRACKING: v3 punya session_id/model/provider/input_tokens/output_tokens/
-- cost_usd/created_at. v4 menambah task_id/agent_id/cache_*/currency dan
-- mengganti created_at → recorded_at. created_at v3 dibuang setelah disalin.
ALTER TABLE cost_tracking ADD COLUMN task_id TEXT REFERENCES tasks(id);
ALTER TABLE cost_tracking ADD COLUMN agent_id TEXT REFERENCES agents(id);
ALTER TABLE cost_tracking ADD COLUMN cache_read_tokens INTEGER DEFAULT 0;
ALTER TABLE cost_tracking ADD COLUMN cache_write_tokens INTEGER DEFAULT 0;
ALTER TABLE cost_tracking ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE cost_tracking ADD COLUMN recorded_at DATETIME;
UPDATE cost_tracking SET recorded_at = created_at;
ALTER TABLE cost_tracking RENAME COLUMN created_at TO created_at_v3_legacy;

-- ──────────────────────────────────────────────────────────────────
-- DISPATCHES: v4 menambah target_agent, reply_task_id, sent_at
ALTER TABLE dispatches ADD COLUMN target_agent TEXT;
ALTER TABLE dispatches ADD COLUMN reply_task_id TEXT REFERENCES tasks(id);
ALTER TABLE dispatches ADD COLUMN sent_at DATETIME;

-- ──────────────────────────────────────────────────────────────────
-- SYSTEM_LOGS: v3 (id/level/message/source/created_at) → v4 menambah
-- task_id + metadata. Tanpa ini CREATE INDEX di 001 gagal.
ALTER TABLE system_logs ADD COLUMN task_id TEXT REFERENCES tasks(id);
ALTER TABLE system_logs ADD COLUMN metadata TEXT;
