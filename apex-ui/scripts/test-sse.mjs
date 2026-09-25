/**
 * Test: SSE stream + multi-tab sync + Last-Event-ID replay.
 *
 * Jalankan saat dev server berjalan:
 *   MC_PASSWORD=test1234 node scripts/test-sse.mjs
 */

const BASE = process.env.MC_BASE || 'http://localhost:3000'
const PASSWORD = process.env.MC_PASSWORD || 'test1234'

const cookieJar = new Map()
function applyCookies(sc) {
  if (!sc) return
  for (const c of sc) {
    const [pair] = c.split(';')
    const [k, ...rest] = pair.split('=')
    cookieJar.set(k.trim(), rest.join('='))
  }
}
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (cookieJar.size) headers.Cookie = [...cookieJar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  const sc = res.headers.get('set-cookie')
  if (sc) applyCookies(sc.split(','))
  return res
}

function openSSE(lastEventId, onEvent, signal) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/mc/events', BASE)
    const headers = { Accept: 'text/event-stream' }
    if (cookieJar.size) headers.Cookie = [...cookieJar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')
    if (lastEventId) headers['Last-Event-ID'] = String(lastEventId)

    fetch(url, { headers, signal }).then(async res => {
      if (!res.ok || !res.body) { reject(new Error(`SSE ${res.status}`)); return }
      resolve(res)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let currentEvent = { type: 'message', data: '', id: null }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (line === '') {
            if (currentEvent.type && currentEvent.data) onEvent({ ...currentEvent })
            currentEvent = { type: 'message', data: '', id: null }
          } else if (line.startsWith(':')) {
            // comment/heartbeat
          } else if (line.startsWith('event:')) {
            currentEvent.type = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            currentEvent.data += (currentEvent.data ? '\n' : '') + line.slice(5).trim()
          } else if (line.startsWith('id:')) {
            currentEvent.id = line.slice(3).trim()
          }
        }
      }
    }).catch(reject)
  })
}

let pass=0,fail=0
function ok(name, c, d='') { if (c) { console.log(`  ✓ ${name}`); pass++ } else { console.log(`  ✗ ${name}`, d); fail++ } }

async function wait(ms) { return new Promise(r=>setTimeout(r,ms)) }

async function main() {
  console.log(`Target: ${BASE}\n`)
  console.log('=== 1. Login ===')
  const login = await api('/api/auth/login', { method:'POST', body: JSON.stringify({password:PASSWORD}) })
  ok('login 200', login.status===200, `status=${login.status}`)

  console.log('\n=== 2. SSE connect + receive snapshot ===')
  const events1 = []
  const ac1 = new AbortController()
  openSSE(0, ev => events1.push(ev), ac1.signal)
  await wait(1500)
  ok('snapshot diterima', events1.some(e => e.type === 'snapshot'))

  console.log('\n=== 3. Dispatch task, verifikasi lifecycle event ===')
  await api('/api/mc/dispatch', { method:'POST', body: JSON.stringify({ title:'SSE test', instruction:'x', agent:'chief', priority:'high', source:'api' }) })
  await wait(15000)
  const types = events1.map(e => e.type)
  ok('task.queued diterima', types.includes('task.queued'))
  ok('task.claimed diterima', types.includes('task.claimed'))
  ok('task.started diterima', types.includes('task.started'))
  ok('task.completed diterima', types.includes('task.completed'))

  console.log('\n=== 4. Second client (multi-tab) ===')
  const events2 = []
  const ac2 = new AbortController()
  openSSE(0, ev => events2.push(ev), ac2.signal)
  await wait(1000)
  await api('/api/mc/dispatch', { method:'POST', body: JSON.stringify({ title:'multi-tab', instruction:'y', agent:'chief', priority:'high', source:'api' }) })
  await wait(15000)
  ok('kedua client terima task.queued',
    events1.some(e => e.type==='task.queued' && e.data.includes('multi-tab')) &&
    events2.some(e => e.type==='task.queued' && e.data.includes('multi-tab')))

  console.log('\n=== 5. Last-Event-ID replay ===')
  // Ambil event terakhir yang kita punya
  const lastId = events1.filter(e => e.id && e.id !== '-1').pop()?.id
  ok('punya last event id', !!lastId, `lastId=${lastId}`)
  const replay = []
  const ac3 = new AbortController()
  openSSE(parseInt(lastId) - 1, ev => replay.push(ev), ac3.signal)
  await wait(2000)
  ok('replay.done event diterima', replay.some(e => e.type === 'replay.done'))
  ok('replay mengandung event yang terlewat', replay.length >= 2, `count=${replay.length}`)

  ac1.abort(); ac2.abort(); ac3.abort()
  await wait(500)

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`)
  if (fail) process.exit(1)
}
main().catch(err => { console.error(err); process.exit(1) })
