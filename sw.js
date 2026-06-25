// IDS-Abs Service Worker v1.0.1
const CACHE_NAME = 'IDS-Abs-v3';
const ASSETS_CACHE = 'IDS-Abs-assets-v3';

// File lokal yang di-cache
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// CDN resources to cache
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// INSTALL — cache semua asset statis
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(STATIC_ASSETS).catch(e => console.log('[SW] Static cache partial fail:', e));
      }),
      caches.open(ASSETS_CACHE).then(cache => {
        console.log('[SW] Caching CDN assets');
        return Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
      })
    ])
  );
  self.skipWaiting();
});

// ACTIVATE — hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    )
  );
  self.clients.claim();
});

// FETCH — strategi cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Firebase, Google APIs, non-GET
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('firestore') || url.hostname.includes('googleapis.com')) return;

  // Skip map tile servers — biarkan lewat langsung ke network, jangan di-intercept SW
  // (mencegah peta blank karena opaque response / gagal cache cross-origin)
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.endsWith('.tile.openstreetmap.org')) return;

  // CDN assets — Cache First
  if (url.hostname.includes('cdnjs') || url.hostname.includes('unpkg') || url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(ASSETS_CACHE).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // App files — Network First, fallback to cache
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Default — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => cached))
  );
});

// SKIP WAITING message dari halaman
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// BACKGROUND SYNC (untuk absensi offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-absensi') {
    event.waitUntil(syncOfflineAbsensi());
  }
});

async function syncOfflineAbsensi() {
  // Placeholder — implementasi sync data offline ke Firestore
  console.log('[SW] Background sync: absensi');
}
