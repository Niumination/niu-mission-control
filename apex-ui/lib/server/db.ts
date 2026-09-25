/**
 * Database layer — better-sqlite3 (synchronous, WAL mode).
 *
 * Why synchronous better-sqlite3 instead of an async driver or ORM?
 * - SQLite sendiri adalah single-writer; async driver hanya menambah overhead.
 * - Next.js Route Handlers berjalan di thread pool terpisah, blocking sync
 *   driver TIDAK memblokir event loop utama jika Route Handler dideklarasi
 *   `dynamic` dan berjalan di server runtime (bukan edge).
 * - Digunakan oleh Builderz/mission-control dengan model yang sama dan
 *   performanya sangat baik untuk single-node control plane.
 *
 * Catatan: File ini HANYA BOLEH di-import di server code
 * (Route Handlers, lib/server/*, scripts). JANGAN import dari client component.
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { ensureV3Columns } from './ensure-v3-columns'

// ── Config ──────────────────────────────────────────────────────────

// DB path bisa diset via env (untuk Docker/testing).
// Default di luar apex-ui/ di folder data/ (menjaga struktur repo existing).
const DB_PATH = process.env.MC_DB_PATH || path.resolve(process.cwd(), '..', 'data', 'swarm_state.db')
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations')

// Pastikan folder data ada
const DB_DIR = path.dirname(DB_PATH)
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// ── Connect — singleton via globalThis survive HMR (Next 16 webpack) ────

function createDb() {
  const db = new Database(DB_PATH)
  // WAL + foreign keys untuk keamanan dan performa
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL') // aman untuk WAL dengan backup
  db.pragma('busy_timeout = 5000') // tunggu sampai 5 detik jika writer terkunci
  return db
}

const g = globalThis as unknown as { __mc_db__?: Database.Database; __mc_db_path__?: string }
// Recreate jika path berubah (env MC_DB_PATH berubah)
const db: Database.Database = (() => {
  if (!g.__mc_db__ || g.__mc_db_path__ !== DB_PATH) {
    try { g.__mc_db__?.close() } catch {}
    g.__mc_db__ = createDb()
    g.__mc_db_path__ = DB_PATH
  }
  return g.__mc_db__!
})()

// ── Migrations ──────────────────────────────────────────────────────

/**
 * Jalankan semua file SQL di migrations/ yang namanya NNN_*.sql
 * dan belum tercatat di schema_migrations. Dipanggil sekali saat startup.
 */
export function runMigrations(): { applied: number; currentVersion: number } {
  // Pastikan tabel schema_migrations ada
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ambil versi yang sudah ter-apply
  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  const applied = new Set(appliedRows.map(r => r.version))

  // Baca folder migrations, urut NNN
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true })
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_.*\.sql$/.test(f))
    .sort()

  // Skema v3 → v4 harus ditutup SEBELUM 001_initial.sql, karena 001 memakai
  // CREATE TABLE IF NOT EXISTS (tabel v3 dilewati) tapi CREATE INDEX tetap
  // jalan dan gagal: no such column: assigned_agent. Lihat ensure-v3-columns.ts.
  ensureV3Columns(db)

  let appliedCount = 0
  // INSERT OR IGNORE: Next.js build menjalankan route handler di banyak worker
  // paralel ("Collecting page data using N workers"). Semua worker membaca
  // `applied` pada waktu yang hampir bersamaan, lalu semuanya mencoba insert
  // baris yang sama → UNIQUE constraint failed: schema_migrations.version.
  // Cek ulang di dalam transaksi (lalu masukkan) menjadikan ini optimistic:
  // worker yang kalah tetap melihat barisnya sudah ada dan melewati migrasi.
  const insertMig = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)')

  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10)
    if (applied.has(version)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    const migName = file.replace(/^\d{3}_/, '').replace(/\.sql$/, '')

    // Jalankan dalam transaksi. `claimed` = worker ini yang-installed
    // migrasi; kalau sudah ada, worker lain menang dan SQL-nya dilewati.
    let claimed = false
    const tx = db.transaction(() => {
      const res = insertMig.run(version, migName)
      // changes === 0 → worker lain sudah lebih dulu, jangan jalankan SQL.
      if (res.changes === 0) return
      db.exec(sql)
      claimed = true
    })
    tx()
    if (!claimed) continue
    applied.add(version)
    console.log(`[db] Applied migration ${file}`)
    appliedCount++
  }

  const currentVersionRow = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as { v: number | null }
  return {
    applied: appliedCount,
    currentVersion: currentVersionRow?.v ?? 0,
  }
}

// ── Health check ────────────────────────────────────────────────────

export function dbHealthy(): boolean {
  try {
    db.prepare('SELECT 1').get()
    return true
  } catch {
    return false
  }
}

// ── Seed initial data (5 default agent) ────────────────────────────

export function seedDefaultsIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }
  if (count.c > 0) return

  const insertAgent = db.prepare(`
    INSERT INTO agents (id, name, role, description, color, model_default, adapter, status)
    VALUES (@id, @name, @role, @description, @color, @model_default, @adapter, 'offline')
  `)

  const agents = [
    // Chief default memakai adapter 'mock' agar development berjalan tanpa
    // Hermes terinstall. Di production, user bisa mengganti adapter di DB
    // atau UI Settings setelah Hermes CLI tersedia.
    { id: 'chief',      name: 'Hermes Chief', role: 'Orchestrator & Leader', description: 'Chief coordinator yang memecah instruksi dan me-route ke specialist.', color: '#00e5ff', model_default: 'huancheng/auto', adapter: 'mock' },
    { id: 'research',   name: 'Research',      role: 'Research & Learn',      description: 'Web scraping, dokumentasi, analisis referensi dan literatur.',     color: '#00e5ff', model_default: '9router/gemini',    adapter: 'hermes' },
    { id: 'programmer', name: 'Programmer',    role: 'Programmer & Coder',    description: 'Tulis, modifikasi, dan refactor source code.',                      color: '#f5a623', model_default: 'opencode-zen',      adapter: 'hermes' },
    { id: 'qa',         name: 'QA Tester',     role: 'Tester & QA',           description: 'Jalankan test suite, verifikasi build, audit kualitas.',            color: '#34d399', model_default: 'opus/sonar',        adapter: 'hermes' },
    { id: 'creator',    name: 'Kreator',       role: 'Content Creator',       description: 'Drafting laporan, ringkasan, narasi, dan dokumentasi publik.',      color: '#f5a623', model_default: 'claude-opus',       adapter: 'hermes' },
  ]

  const tx = db.transaction(() => {
    for (const a of agents) insertAgent.run(a)
  })
  tx()
  console.log(`[db] Seeded ${agents.length} default agents`)
}

// ── Inisialisasi saat import ───────────────────────────────────────

const migResult = runMigrations()
seedDefaultsIfEmpty()
console.log(`[db] Connected to ${DB_PATH} (version ${migResult.currentVersion}, ${migResult.applied} new migrations applied)`)

export default db
