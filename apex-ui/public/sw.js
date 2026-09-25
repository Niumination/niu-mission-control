// PWA Service Worker v2 — minimal offline cache
const CACHE_VERSION = 'mc-v4.1.0'
const CACHE_NAME = `mission-control-${CACHE_VERSION}`
const OFFLINE_URLS = ['/', '/missions', '/agents', '/live-ops', '/analytics', '/audit', '/settings', '/login']
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS.map(url => new Request(url, { cache: 'no-cache' }))).catch(() => {})
    })
  )
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  )
  self.clients.claim()
})
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('/api/')) return
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
      }
      return response
    }).catch(() => caches.match(request).then(cached => cached || caches.match('/')))
  )
})
