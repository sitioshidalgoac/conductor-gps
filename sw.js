// Service Worker — SITIOS HIDALGO Conductor
// Mantiene la app activa y permite GPS en segundo plano
const CACHE = 'sh-conductor-v4';
const ASSETS = ['/'];

// Instalar y cachear
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activar — limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — red primero, cache como respaldo
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cachear respuesta fresca
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Background Sync — si se pierde conexión, reintenta
self.addEventListener('sync', e => {
  if (e.tag === 'gps-sync') {
    console.log('[SW] GPS sync en segundo plano');
  }
});

// Mantener vivo el SW con un ping periódico
self.addEventListener('message', e => {
  if (e.data === 'ping') {
    e.ports[0].postMessage('pong');
  }
});
