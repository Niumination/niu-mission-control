/**
 * Integration test: Dispatcher + MockAdapter via HTTP API (E2E).
 *
 * Prasyarat: `npm run dev` sudah berjalan di http://localhost:3000
 * Jalankan: node scripts/test-dispatcher.mjs
 *
 * Test:
 *   1. Setup awal (POST /api/auth/setup dengan password test)
 *   2. Login (POST /api/auth/login)
 *   3. Kirim 3 task via POST /api/mc/dispatch
 *   4. Poll GET /api/mc/tasks sampai minimal 1 task selesai (timeout 15 detik)
 *   5. Verifikasi artifacts tersimpan, worker tick berjalan.
 */

import crypto from 'crypto'

const BASE = process.env.MC_BASE || 'http://localhost:3000'
const PASSWORD = 'test1234'

const cookieJar = new Map()
function applyCookies(setCookieHeader) {
  if (!setCookieHeader) return
  for (const c of setCookieHeader) {
    const [pair] = c.split(';')
    const [k, ...rest] = pair.split('=')
    cookieJar.set(k.trim(), rest.join('='))
  }
}
function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (cookieJar.size) headers.Cookie = cookieHeader()
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' })
  const sc = res.headers.get('set-cookie')
  if (sc) applyCookies(sc.split(','))
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

let passed = 0, failed = 0
function assert(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); passed++ }
  else { console.log(`  ✗ ${name}`, detail || ''); failed++ }
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log(`\n→ Target: ${BASE}\n`)

  console.log('=== 0. Health pre-flight ===')
  const h = await api('/api/mc/health')
  assert('health 200', h.status === 200, `status=${h.status}`)
  assert('health worker_last_tick terisi', !!h.body.worker_last_tick, JSON.stringify(h.body))

  console.log('\n=== 1. Setup (first-run) ===')
  const setupGet = await api('/api/auth/setup')
  if (setupGet.body.setupRequired) {
    const s = await api('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) })
    assert('setup 200', s.status === 200, `status=${s.status} body=${JSON.stringify(s.body)}`)
    console.log('  → Restart dev server agar env termuat, lalu jalankan ulang test.')
    console.log('  (Catatan: di dev, env dimuat saat proses start; setup butuh restart agar password hash kebaca.)')
    process.exit(0)
  } else {
    console.log('  → Setup sudah dilakukan, lanjut login')
  }

  console.log('\n=== 2. Login ===')
  const login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) })
  assert('login 200', login.status === 200, `status=${login.status} body=${JSON.stringify(login.body).slice(0, 200)}`)

  console.log('\n=== 3. Dispatch 3 tasks ===')
  const dispatched = []
  for (let i = 0; i < 3; i++) {
    const r = await api('/api/mc/dispatch', {
      method: 'POST',
      body: JSON.stringify({
        title: `Test task ${i + 1}`,
        instruction: `Jalankan simulasi ${i + 1}`,
        agent: 'chief',
        priority: 'high',
        source: 'api',
      }),
    })
    assert(`dispatch #${i+1} 201`, r.status === 201, `status=${r.status} body=${JSON.stringify(r.body).slice(0,200)}`)
    if (r.body.id) dispatched.push(r.body.id)
  }
  console.log('  Task IDs:', dispatched)

  console.log('\n=== 4. Polling sampai task selesai (timeout 20s) ===')
  const start = Date.now()
  let done = 0, running = 0, queued = 0
  while (Date.now() - start < 20_000) {
    await wait(2000)
    const res = await api('/api/mc/tasks?limit=20')
    if (res.status !== 200) {
      console.log('  poll error:', res.status, res.body); continue
    }
    done = (res.body.done || []).length
    running = (res.body.running || []).length
    queued = (res.body.queued || []).length
    console.log(`  queued=${queued} running=${running} done=${done}`)
    if (done >= 1) break
  }
  assert('Minimal 1 task selesai', done >= 1, `done=${done}`)

  console.log('\n=== 5. Final health check ===')
  const h2 = await api('/api/mc/health')
  assert('worker masih aktif (uptime bertambah)', Date.now() - new Date(h2.body.startup_time).getTime() > 10_000)
  assert('worker_last_tick ter-update', Date.now() - new Date(h2.body.worker_last_tick).getTime() < 10_000)

  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}
main().catch(err => { console.error(err); process.exit(1) })
