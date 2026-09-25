/**
 * Skema v3 → v4 — bagian yang tidak bisa diekspresikan di .sql.
 *
 * Kenapa file terpisah: SQL tidak punya `ALTER TABLE IF EXISTS` dan SQLite
 * tidak punya trigger `BEFORE ALTER` (dicek 26 Sep 2026). Jadi perubahan
 * skema harus dicek runtime, bukan di dalam file migrasi.
 *
 * Fungsi ini idempoten: aman di DB kosong (install baru) maupun DB v3 (upgrade).
 */

type ColSpec = { table: string; column: string; ddl: string }

const TASK_LIFECYCLE: ColSpec[] = [
  { table: 'tasks', column: 'instruction', ddl: 'ALTER TABLE tasks ADD COLUMN instruction TEXT' },
  { table: 'tasks', column: 'depends_on', ddl: 'ALTER TABLE tasks ADD COLUMN depends_on TEXT REFERENCES tasks(id)' },
  { table: 'tasks', column: 'idempotency_key', ddl: 'ALTER TABLE tasks ADD COLUMN idempotency_key TEXT' },
  { table: 'tasks', column: 'retry_count', ddl: 'ALTER TABLE tasks ADD COLUMN retry_count INTEGER DEFAULT 0' },
  { table: 'tasks', column: 'max_retries', ddl: 'ALTER TABLE tasks ADD COLUMN max_retries INTEGER DEFAULT 3' },
  { table: 'tasks', column: 'requires_approval', ddl: 'ALTER TABLE tasks ADD COLUMN requires_approval INTEGER DEFAULT 0' },
  { table: 'tasks', column: 'source', ddl: 'ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT \'manual\'' },
  { table: 'tasks', column: 'metadata', ddl: 'ALTER TABLE tasks ADD COLUMN metadata TEXT' },
  { table: 'tasks', column: 'error_message', ddl: 'ALTER TABLE tasks ADD COLUMN error_message TEXT' },
  { table: 'tasks', column: 'queued_at', ddl: 'ALTER TABLE tasks ADD COLUMN queued_at DATETIME' },
  { table: 'tasks', column: 'claimed_at', ddl: 'ALTER TABLE tasks ADD COLUMN claimed_at DATETIME' },
  { table: 'tasks', column: 'started_at', ddl: 'ALTER TABLE tasks ADD COLUMN started_at DATETIME' },
  { table: 'tasks', column: 'submitted_at', ddl: 'ALTER TABLE tasks ADD COLUMN submitted_at DATETIME' },
  { table: 'tasks', column: 'deadline_at', ddl: 'ALTER TABLE tasks ADD COLUMN deadline_at DATETIME' },
  { table: 'tasks', column: 'next_retry_at', ddl: 'ALTER TABLE tasks ADD COLUMN next_retry_at DATETIME' },
]

const AGENT_COLS: ColSpec[] = [
  { table: 'agents', column: 'description', ddl: 'ALTER TABLE agents ADD COLUMN description TEXT' },
  { table: 'agents', column: 'model_default', ddl: 'ALTER TABLE agents ADD COLUMN model_default TEXT' },
  { table: 'agents', column: 'system_prompt', ddl: 'ALTER TABLE agents ADD COLUMN system_prompt TEXT' },
  { table: 'agents', column: 'adapter', ddl: 'ALTER TABLE agents ADD COLUMN adapter TEXT DEFAULT \'hermes\'' },
  { table: 'agents', column: 'adapter_config', ddl: 'ALTER TABLE agents ADD COLUMN adapter_config TEXT' },
  { table: 'agents', column: 'current_task_id', ddl: 'ALTER TABLE agents ADD COLUMN current_task_id TEXT' },
  { table: 'agents', column: 'enabled', ddl: 'ALTER TABLE agents ADD COLUMN enabled INTEGER DEFAULT 1' },
  // SQLite menolak DEFAULT CURRENT_TIMESTAMP di ADD COLUMN (harus konstan)
  { table: 'agents', column: 'created_at', ddl: 'ALTER TABLE agents ADD COLUMN created_at DATETIME' },
  { table: 'agents', column: 'updated_at', ddl: 'ALTER TABLE agents ADD COLUMN updated_at DATETIME' },
]

const COST_COLS: ColSpec[] = [
  { table: 'cost_tracking', column: 'task_id', ddl: 'ALTER TABLE cost_tracking ADD COLUMN task_id TEXT REFERENCES tasks(id)' },
  { table: 'cost_tracking', column: 'agent_id', ddl: 'ALTER TABLE cost_tracking ADD COLUMN agent_id TEXT REFERENCES agents(id)' },
  { table: 'cost_tracking', column: 'cache_read_tokens', ddl: 'ALTER TABLE cost_tracking ADD COLUMN cache_read_tokens INTEGER DEFAULT 0' },
  { table: 'cost_tracking', column: 'cache_write_tokens', ddl: 'ALTER TABLE cost_tracking ADD COLUMN cache_write_tokens INTEGER DEFAULT 0' },
  { table: 'cost_tracking', column: 'currency', ddl: 'ALTER TABLE cost_tracking ADD COLUMN currency TEXT DEFAULT \'USD\'' },
  { table: 'cost_tracking', column: 'recorded_at', ddl: 'ALTER TABLE cost_tracking ADD COLUMN recorded_at DATETIME' },
]

const DISPATCH_COLS: ColSpec[] = [
  { table: 'dispatches', column: 'target_agent', ddl: 'ALTER TABLE dispatches ADD COLUMN target_agent TEXT' },
  { table: 'dispatches', column: 'reply_task_id', ddl: 'ALTER TABLE dispatches ADD COLUMN reply_task_id TEXT REFERENCES tasks(id)' },
  { table: 'dispatches', column: 'sent_at', ddl: 'ALTER TABLE dispatches ADD COLUMN sent_at DATETIME' },
]

const LOG_COLS: ColSpec[] = [
  { table: 'system_logs', column: 'task_id', ddl: 'ALTER TABLE system_logs ADD COLUMN task_id TEXT REFERENCES tasks(id)' },
  { table: 'system_logs', column: 'metadata', ddl: 'ALTER TABLE system_logs ADD COLUMN metadata TEXT' },
]

function tableExists(db: any, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
}

function columnsOf(db: any, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name))
}

function addMissing(db: any, specs: ColSpec[]): number {
  let n = 0
  for (const spec of specs) {
    if (!tableExists(db, spec.table)) continue
    if (columnsOf(db, spec.table).has(spec.column)) continue
    db.exec(spec.ddl)
    n++
  }
  return n
}

/**
 * Jalankan SEBELUM 001_initial.sql.
 *
 * 001 memakai `CREATE TABLE IF NOT EXISTS`, jadi kalau tabel v3 sudah ada
 * statement-nya dilewati — tapi CREATE INDEX di file yang sama tetap jalan dan
 * gagal karena kolom v4 belum ada:
 *
 *   CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent);
 *   → SQLITE_ERROR: no such column: assigned_agent
 *
 * Fungsi ini menutup celah itu: tambah kolom v4 yang belum ada, dan rename
 * kolom yang berubah nama. Aman di DB kosong (semua dilewati) maupun DB v3.
 */
export function ensureV3Columns(db: any): void {
  // tasks: v3 `agent_id` → v4 `assigned_agent`
  if (tableExists(db, 'tasks')) {
    const cols = columnsOf(db, 'tasks')
    if (cols.has('agent_id') && !cols.has('assigned_agent')) {
      db.exec('ALTER TABLE tasks RENAME COLUMN agent_id TO assigned_agent')
    }
  }

  let n = 0
  n += addMissing(db, TASK_LIFECYCLE)
  n += addMissing(db, AGENT_COLS)
  n += addMissing(db, COST_COLS)
  n += addMissing(db, DISPATCH_COLS)
  n += addMissing(db, LOG_COLS)

  // cost_tracking: v4 pakai recorded_at; created_at v3 tidak dibuang, di-rename
  // supaya data lama tetap bisa diaudit.
  if (tableExists(db, 'cost_tracking')) {
    let cols = columnsOf(db, 'cost_tracking')
    // Salin DULU ke recorded_at, baru rename — kalau dibalik, `created_at`
    // sudah tidak ada saat UPDATE dan muncul "no such column: created_at".
    if (cols.has('created_at')) {
      if (cols.has('recorded_at')) {
        db.exec('UPDATE cost_tracking SET recorded_at = created_at WHERE recorded_at IS NULL')
      }
      db.exec('ALTER TABLE cost_tracking RENAME COLUMN created_at TO created_at_v3_legacy')
    }
  }

  // ── Transformasi DATA v3 → v4 ──────────────────────────────────
  // Idempoten (sudah dijamin WHERE-nya) dan dicek keberadaan tabelnya.

  if (tableExists(db, 'tasks')) {
    // v3 'pending' → v4 'inbox'
    db.exec("UPDATE tasks SET status = 'inbox' WHERE status = 'pending'")
  }

  if (tableExists(db, 'agents')) {
    // v3 'active' → v4 'idle' (v4: online|idle|working|offline|error)
    db.exec("UPDATE agents SET status = 'idle' WHERE status = 'active'")
    // chief: 'hermes' → 'mock'
    //
    // Seed v4 memakai adapter 'mock' supaya development jalan tanpa Hermes CLI
    // terinstall. DB v3 punya 'hermes' untuk semua agent → worker claim task
    // lalu menggantung (Hermes CLI tidak tersedia, tidak ada retry:
    // next_retry_at NULL). Empat agent lain tetap 'hermes', sama seperti
    // seed v4 — jadi hanya chief yang diubah.
    db.exec("UPDATE agents SET adapter = 'mock' WHERE id = 'chief'")
  }

  if (n > 0) console.log(`[db] ensureV3Columns: ${n} kolom v4 ditambahkan`)
}
