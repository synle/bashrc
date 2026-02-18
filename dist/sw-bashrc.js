// 1771450924455 will be replaced during build
const CACHE_VERSION = '1771450924455';
const CACHE_NAME = `bashrc-webapp-cache-${CACHE_VERSION}`;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Resources to pre-cache during installation
const PRECACHE_URLS = ['/', '/index.html', '/sw-bashrc.js'];

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper function to check if URL should be cached
// Cache everything from the same origin
function shouldCacheUrl(url) {
  try {
    const urlObj = new URL(url);

    // Only cache HTTP/HTTPS requests
    if (!urlObj.protocol.startsWith('http')) {
      return false;
    }

    // Cache everything from same origin
    if (urlObj.origin === self.location.origin) {
      return true;
    }

    // Don't cache external resources (CDNs, APIs, etc.)
    return false;
  } catch (e) {
    return false;
  }
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

// Install event - pre-cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing version', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: Pre-caching essential resources');

      // Try to cache each URL, but don't fail if one fails
      const cachePromises = PRECACHE_URLS.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const responseWithTimestamp = await addTimestampToResponse(response);
            await cache.put(url, responseWithTimestamp);
            console.log('Service Worker: Pre-cached', url);
          }
        } catch (error) {
          console.warn('Service Worker: Failed to pre-cache', url, error);
        }
      });

      await Promise.all(cachePromises);
      console.log('Service Worker: Pre-caching complete');
    }),
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
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

// Fetch event - Cache first, then network with background update
self.addEventListener('fetch', (event) => {
  // Only intercept requests we want to cache
  if (!shouldCacheUrl(event.request.url)) {
    // For external resources, just fetch normally
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to get from cache first
      const cachedResponse = await cache.match(event.request);

      // Fetch from network and update cache in background
      const fetchPromise = fetch(event.request.clone())
        .then(async (networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            // Add timestamp and cache the response
            const responseWithTimestamp = await addTimestampToResponse(networkResponse.clone());
            await cache.put(event.request, responseWithTimestamp);
            console.log('Service Worker: Cached:', event.request.url);
          }
          return networkResponse;
        })
        .catch((error) => {
          console.log('Service Worker: Network fetch failed for:', event.request.url, error);
          return null;
        });

      // If we have a cached response, return it immediately
      // while updating cache in the background
      if (cachedResponse) {
        // Check if cache is expired
        if (isCacheExpired(cachedResponse)) {
          console.log('Service Worker: Cache expired, waiting for network:', event.request.url);
          // Cache expired - try to get fresh from network
          const networkResponse = await fetchPromise;
          if (networkResponse) {
            return networkResponse;
          }
          // Network failed, return stale cache as fallback
          console.log('Service Worker: Network failed, serving stale cache:', event.request.url);
          return cachedResponse;
        } else {
          // Cache is fresh, return it and update in background
          console.log('Service Worker: Serving from cache:', event.request.url);
          fetchPromise.catch(() => {}); // Update cache in background, ignore errors
          return cachedResponse;
        }
      }

      // No cache - wait for network response
      console.log('Service Worker: No cache, fetching from network:', event.request.url);
      const networkResponse = await fetchPromise;

      if (networkResponse) {
        return networkResponse;
      }

      // Network failed and no cache - return error page for navigation requests
      if (event.request.mode === 'navigate') {
        console.log('Service Worker: Offline and no cache for navigation');
        return new Response('<html><body><h1>Offline</h1><p>Unable to load the page. Please check your connection.</p></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // For other requests, return a network error
      return new Response('Network error', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }),
  );
});
