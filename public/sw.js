// Service Worker for The Desert Duel PWA
// v2 — expanded offline support (app shell + /scores route)
const CACHE_NAME = 'desert-duel-v2'

// Core app shell assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/scores',
  '/manifest.json',
  '/assets/logo.jpg',
  '/assets/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each asset individually so one failure doesn't block the rest
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err.message)
          })
        )
      )
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) return

  // API calls and Supabase: always network-only (never cache)
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase.co')
  ) {
    return
  }

  const url = new URL(event.request.url)

  // Next.js build chunks and static assets: cache-first
  const isNextStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/')

  if (isNextStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation requests (HTML pages): network-first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful page responses for offline use
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline: return cached version of this page if available
          return caches.match(event.request).then(cached => {
            if (cached) return cached
            // Fall back to cached home page for any unrecognized route
            return caches.match('/').then(home => {
              if (home) return home
              return new Response(
                '<!DOCTYPE html><html><body style="background:#1A1A0A;color:#F5E6C3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>You\'re offline</h2><p>Reconnect to load the app</p></div></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html' } }
              )
            })
          })
        })
    )
    return
  }

  // All other requests: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
