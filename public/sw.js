
const CACHE_NAME = 'streampay-static-v3';
const VIDEO_CACHE_NAME = 'streampay-videos-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== VIDEO_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Helper para manejar el buffer de video parcial (Range Requests)
async function handleRangeRequest(request) {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (!cachedResponse) return fetch(request);

  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) return cachedResponse;

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const totalSize = arrayBuffer.byteLength;
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
  const chunkSize = (end - start) + 1;

  const slicedBuffer = arrayBuffer.slice(start, end + 1);
  return new Response(slicedBuffer, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Interceptar streaming de video
  if (url.searchParams.get('action') === 'stream' || event.request.headers.get('Range')) {
    event.respondWith(handleRangeRequest(event.request));
    return;
  }

  // Cache estática regular
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && event.request.method === 'GET' && !url.searchParams.has('action')) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
