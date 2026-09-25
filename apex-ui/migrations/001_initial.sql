-- Migration 001: Initial schema — Niumination Mission Control v4.0
-- Berdasarkan PRD §12.2. Menggantikan schema legacy di data/init.sql.

-- ──────────────────────────────────────────────────────────────────
-- AGENTS
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#00e5ff',
  model_default TEXT,
  system_prompt TEXT,
  adapter TEXT NOT NULL DEFAULT 'hermes',
  adapter_config TEXT,
  status TEXT NOT NULL DEFAULT 'offline', -- online|idle|working|offline|error
  last_seen DATETIME,
  current_task_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- ──────────────────────────────────────────────────────────────────
-- TASKS
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instruction TEXT,
  assigned_agent TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'inbox', -- inbox|queued|running|review|done|failed|cancelled
  priority TEXT NOT NULL DEFAULT 'medium', -- high|medium|low
  progress INTEGER DEFAULT 0,
  depends_on TEXT REFERENCES tasks(id),
  idempotency_key TEXT UNIQUE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  requires_approval INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual', -- manual|telegram|webhook|schedule|api
  metadata TEXT,
  result TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  queued_at DATETIME,
  claimed_at DATETIME,
  started_at DATETIME,
  submitted_at DATETIME,
  completed_at DATETIME,
  failed_at DATETIME,
  deadline_at DATETIME,
  next_retry_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_depends ON tasks(depends_on);

-- ──────────────────────────────────────────────────────────────────
-- EVENTS (event sourcing — tulang punggung realtime)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  actor TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_agg ON events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ──────────────────────────────────────────────────────────────────
-- DISPATCHES
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatches (
  id TEXT PRIMARY KEY,
  target_topic TEXT NOT NULL,
  target_agent TEXT,
  message TEXT NOT NULL,
  source_agent TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending', -- pending|sent|delivered|failed
  reply_task_id TEXT REFERENCES tasks(id),
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);

-- ──────────────────────────────────────────────────────────────────
-- COST TRACKING
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT REFERENCES tasks(id),
  agent_id TEXT REFERENCES agents(id),
  session_id TEXT,
  model TEXT NOT NULL,
  provider TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cost_task ON cost_tracking(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_time ON cost_tracking(recorded_at);
CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_tracking(agent_id);

-- ──────────────────────────────────────────────────────────────────
-- ARTIFACTS
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  agent_id TEXT REFERENCES agents(id),
  type TEXT NOT NULL, -- file|diff|text|image|url|log
  path TEXT,
  name TEXT NOT NULL,
  content TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id);

-- ──────────────────────────────────────────────────────────────────
-- APPROVALS (human-in-the-loop gates)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  action_type TEXT NOT NULL, -- shell_exec|external_send|deploy|file_delete|db_mutation
  payload TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending|approved|rejected|expired
  decided_by TEXT,
  decision_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME,
  expires_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);

-- ──────────────────────────────────────────────────────────────────
-- AUDIT LOG (immutable, append-only)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- user|agent|system
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL, -- success|failure|rejected
  details TEXT,
  client_ip TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);

-- ──────────────────────────────────────────────────────────────────
-- SYSTEM LOGS
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL, -- debug|info|warn|error
  message TEXT NOT NULL,
  source TEXT,
  task_id TEXT REFERENCES tasks(id),
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_time ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_task ON system_logs(task_id);

-- ──────────────────────────────────────────────────────────────────
-- SCHEDULES (disiapkan untuk M11 — tidak dipakai dulu di v4 awal)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  prompt TEXT NOT NULL,
  target_agent TEXT,
  priority TEXT DEFAULT 'medium',
  enabled INTEGER DEFAULT 1,
  last_run_at DATETIME,
  next_run_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────
-- APP SETTINGS (key-value JSON)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────
-- Trigger: update updated_at pada agents & dispatches saat row diubah
-- ──────────────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS agents_updated_at
AFTER UPDATE ON agents
BEGIN
  UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS dispatches_updated_at
AFTER UPDATE ON dispatches
BEGIN
  UPDATE dispatches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
