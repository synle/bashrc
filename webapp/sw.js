const CACHE_NAME = 'bashrc-webapp-v1';
const RUNTIME_CACHE = 'bashrc-runtime-v1';
const CACHE_METADATA = 'bashrc-metadata-v1';
const CACHE_TTL = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.jsx',
  '/index.css',
  '/base.css',
];

// Cacheable file extensions
const cachableExtensions = [
  // Images
  '.ico', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.avif',
  // Code/Styles
  '.js', '.jsx', '.css',
  // Data/Text
  '.txt', '.json', '.md', '.sh'
];

// Check if URL should be cached
function shouldCache(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  return cachableExtensions.some(ext => pathname.endsWith(ext));
}

// Get cache metadata
async function getCacheMetadata(url) {
  const cache = await caches.open(CACHE_METADATA);
  const response = await cache.match(url);
  if (response) {
    return await response.json();
  }
  return null;
}

// Set cache metadata
async function setCacheMetadata(url, timestamp) {
  const cache = await caches.open(CACHE_METADATA);
  const metadata = { timestamp };
  const response = new Response(JSON.stringify(metadata));
  await cache.put(url, response);
}

// Check if cache is still valid
async function isCacheValid(url) {
  const metadata = await getCacheMetadata(url);
  if (!metadata) {
    return false;
  }
  const age = Date.now() - metadata.timestamp;
  return age < CACHE_TTL;
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== CACHE_METADATA) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);

      // Fetch from network in the background (don't await)
      const fetchPromise = (async () => {
        try {
          console.log('[SW] Fetching from network (background):', request.url);
          const response = await fetch(request);

          // Cache successful responses
          if (response && response.status === 200 && response.type !== 'error') {
            // Only cache if the URL has a cacheable extension
            if (shouldCache(request.url)) {
              const responseToCache = response.clone();
              const cache = await caches.open(RUNTIME_CACHE);
              await cache.put(request, responseToCache);
              await setCacheMetadata(request.url, Date.now());
              console.log('[SW] Cache updated in background:', request.url);
            }
          }

          return response;
        } catch (error) {
          console.error('[SW] Background fetch failed:', error);
          return null;
        }
      })();

      // If we have a cached response, return it immediately
      if (cachedResponse) {
        console.log('[SW] Serving from cache (stale-while-revalidate):', request.url);

        // Check if cache is expired (but still serve it)
        const isValid = await isCacheValid(request.url);
        if (!isValid) {
          console.log('[SW] Cache expired, will update in background:', request.url);
        }

        // Don't await - let the background fetch update the cache
        fetchPromise.catch(() => {}); // Prevent unhandled rejection

        return cachedResponse;
      }

      // No cache - wait for network response
      console.log('[SW] No cache, fetching from network:', request.url);
      try {
        const response = await fetchPromise;
        if (response) {
          return response;
        }
        // Fallback if fetch failed
        return await caches.match('/index.html');
      } catch (error) {
        console.error('[SW] Fetch failed:', error);
        return await caches.match('/index.html');
      }
    })()
  );
});
