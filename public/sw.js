
const CACHE_NAME = 'streampay-static-v2';
const VIDEO_CACHE_NAME = 'streampay-videos-v1'; // Dedicated cache for large files
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .catch((err) => console.log('Cache init failed', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== VIDEO_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// --- HELPER: Handle Range Requests for Video (Critical for Offline Playback) ---
const readBuffer = async (response) => {
    if (response.body) {
        const reader = response.body.getReader();
        const chunks = [];
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        // Merge chunks
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }
    return await response.arrayBuffer();
}

const createRangeResponse = (arrayBuffer, headers) => {
    const totalSize = arrayBuffer.byteLength;
    const rangeHeader = headers.get('Range');
    
    if (!rangeHeader) {
        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': totalSize,
                'Accept-Ranges': 'bytes'
            }
        });
    }

    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunksize = (end - start) + 1;

    const slicedBuffer = arrayBuffer.slice(start, end + 1);

    return new Response(slicedBuffer, {
        status: 206,
        headers: {
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4'
        }
    });
};

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests: Network First (or Stale logic handled in App)
  if (url.pathname.includes('/api/')) {
      // If it's a stream action, we might have it cached in VIDEO_CACHE
      if (url.searchParams.get('action') === 'stream') {
          // Fall through to video handling
      } else {
          return; // Let browser handle normal API calls (App handles offline fallback via IndexedDB)
      }
  }

  // 2. Video Streaming Logic (Range Requests)
  if (event.request.headers.get('Range') || url.searchParams.get('action') === 'stream') {
      event.respondWith(
          caches.open(VIDEO_CACHE_NAME).then(async (cache) => {
              // CRITICAL FIX: Removed { ignoreSearch: true } so we distinguish between different video IDs (id=1 vs id=2)
              const cachedResponse = await cache.match(event.request); 
              
              if (cachedResponse) {
                  // We have the full video blob, but browser wants a Range
                  // We must manually slice the blob to satisfy the 206 Partial Content request
                  const buffer = await readBuffer(cachedResponse.clone());
                  return createRangeResponse(buffer, event.request.headers);
              }
              
              // Not in cache, fetch from network
              return fetch(event.request);
          })
      );
      return;
  }

  // 3. Static Assets: Cache First, then Network
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((networkResponse) => {
            // Cache new static assets
            if (networkResponse.ok && event.request.method === 'GET') {
                 const clone = networkResponse.clone();
                 caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResponse;
        });
      })
  );
});

// --- BACKGROUND FETCH API HANDLERS ---
// This allows downloading GBs of video in the background even if the app closes

self.addEventListener('backgroundfetchsuccess', async (event) => {
    const bgFetch = event.registration;
    
    event.waitUntil(
        (async () => {
            const cache = await caches.open(VIDEO_CACHE_NAME);
            const records = await bgFetch.matchAll();
            
            const promises = records.map(async (record) => {
                const response = await record.responseReady;
                if (response && response.ok) {
                    // Use the ID (URL) as the key
                    await cache.put(record.request.url, response);
                }
            });
            
            await Promise.all(promises);
            
            // Notify UI (Optional, via postMessage)
            if (self.clients) {
                const clients = await self.clients.matchAll();
                clients.forEach(client => client.postMessage({
                    type: 'DOWNLOAD_COMPLETE',
                    id: bgFetch.id
                }));
            }
        })()
    );
});

self.addEventListener('backgroundfetchfail', async (event) => {
    console.error('Background Fetch failed', event);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
