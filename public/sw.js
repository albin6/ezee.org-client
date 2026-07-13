const CACHE_NAME = 'pwa-cache-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  event.waitUntil(self.clients.claim());
});



self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Notification';
  const options = {
    body: data.body,
    icon: '/pwa-icons/manifest-icon-192.maskable.png',
    badge: '/pwa-icons/manifest-icon-192.maskable.png',
    data: data.url || '/'
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isFocused = clientList.some((client) => client.visibilityState === 'visible');
      
      // If the app is open and visible, rely on the in-app SSE notification Toast
      if (isFocused) {
        return null;
      }
      
      // Otherwise, show the native OS push notification
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(event.notification.data);
        }
      })
    );
  }
});
