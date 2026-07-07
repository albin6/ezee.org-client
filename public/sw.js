const CACHE_NAME = 'pwa-cache-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We just pass through all requests for now to satisfy PWA criteria.
  // Real offline caching can be added later if needed.
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.warn('[Service Worker] Fetch failed:', error);
      throw error;
    })
  );
});
