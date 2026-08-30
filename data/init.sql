-- Mission Control Database Schema
-- File: services/niu-mission-control/data/init.sql

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    model TEXT,
    status TEXT DEFAULT 'offline',
    color TEXT,
    last_seen TIMESTAMP,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    agent_id TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    result TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS cost_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    model TEXT,
    provider TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_created ON cost_tracking(created_at);

-- Seed agents
INSERT OR REPLACE INTO agents (id, name, role, model, status, color) VALUES
('chief', 'Hermes Chief', 'Orchestrator & Leader', 'huancheng/auto', 'online', '#00e5ff'),
('research', 'Research', 'Research & Learn', '9router/gemini', 'online', '#00e5ff'),
('programmer', 'Programmer', 'Programmer & Coder', 'opencode-zen', 'online', '#f5a623'),
('qa', 'QA Tester', 'Tester & QA', 'opus/sonar', 'online', '#34d399'),
('creator', 'Kreator', 'Content Creator', 'claude-opus', 'online', '#f5a623');
