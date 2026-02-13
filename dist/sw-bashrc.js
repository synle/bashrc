// 1770952605408 will be replaced during build
const CACHE_VERSION = '1770952605408';
const CACHE_NAME = `bashrc-webapp-cache-${CACHE_VERSION}`;
const CACHE_TTL = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cacheable file extensions
const cachableExtensions = [
  // Images
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.avif',
  // Code/Styles
  '.js',
  '.jsx',
  '.css',
  // Data/Text
  '.txt',
  '.json',
  '.md',
  '.sh',
];

// Helper function to check if URL should be cached
function shouldCacheUrl(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Cache root paths
  if (pathname === '/' || pathname === './' || pathname === '/index.html' || pathname === './index.html') {
    return true;
  }

  // Check file extensions
  return cachableExtensions.some((ext) => pathname.endsWith(ext));
}

// Helper function to check if cached response is expired
function isCacheExpired(response) {
  if (!response) return true;

  const cachedTime = response.headers.get('sw-cache-time');
  if (!cachedTime) return true;

  const age = Date.now() - parseInt(cachedTime, 10);
  return age > CACHE_TTL;
}

// Helper function to add timestamp to response
async function addTimestampToResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());

  const blob = await response.blob();
  return new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  // Don't auto skip waiting - let the page control it
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old cache versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Clearing old cache', cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      }),
      // Clean up expired entries from current cache
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys();
        const deletionPromises = [];

        for (const request of requests) {
          const response = await cache.match(request);
          if (isCacheExpired(response)) {
            console.log('Service Worker: Removing expired cache entry:', request.url);
            deletionPromises.push(cache.delete(request));
          }
        }

        return Promise.all(deletionPromises);
      }),
    ]),
  );
  self.clients.claim();
});

// Fetch event - stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  // Only intercept requests we want to cache
  if (!shouldCacheUrl(event.request.url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Fetch from network in background to update cache
      const fetchPromise = fetch(event.request.clone())
        .then(async (networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            // Add timestamp and cache the response
            const responseWithTimestamp = await addTimestampToResponse(networkResponse.clone());

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseWithTimestamp);
              console.log('Service Worker: Updated cache in background:', event.request.url);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.log('Service Worker: Background fetch failed:', event.request.url, error);
          return null;
        });

      // If we have a cached response (even if expired), return it immediately
      // while the network request updates the cache in the background
      if (cachedResponse) {
        console.log('Service Worker: Serving from cache (revalidating in background):', event.request.url);

        // If cache is still valid, refresh the TTL in background
        if (!isCacheExpired(cachedResponse)) {
          addTimestampToResponse(cachedResponse.clone()).then((refreshedResponse) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, refreshedResponse);
            });
          });
        }

        return cachedResponse;
      }

      // No cache - wait for network response
      console.log('Service Worker: No cache, waiting for network:', event.request.url);
      return fetchPromise;
    }),
  );
});
