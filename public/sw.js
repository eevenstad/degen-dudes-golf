// Service Worker for The Desert Duel PWA
const CACHE_NAME = 'desert-duel-v1'
const OFFLINE_URL = '/offline'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/assets/logo.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Fail silently if some assets can't be cached
      })
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

  // For API calls, always go to network
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase.co')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response && response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Try to return from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse
          // For navigation requests, return the home page
          if (event.request.mode === 'navigate') {
            return caches.match('/') || new Response('Offline - Please reconnect', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          }
        })
      })
  )
})
