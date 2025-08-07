// Service Worker for aggressive caching and performance optimization
// Version 1.0.0 - Walmart Grocery Agent

const CACHE_NAME = 'walmart-grocery-v1.0.0';
const STATIC_CACHE = 'walmart-static-v1.0.0';
const DYNAMIC_CACHE = 'walmart-dynamic-v1.0.0';

// Static assets that rarely change
const STATIC_ASSETS = [
  '/',
  '/walmart',
  '/assets/css/main.css',
  '/assets/js/react-vendor.js',
  '/assets/js/ui-vendor.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Dynamic assets with different caching strategies
const DYNAMIC_PATTERNS = {
  // API requests - short cache with network fallback
  api: /^https?:\/\/[^\/]+\/(?:api|trpc)\//,
  // Images - long cache
  images: /\.(?:png|jpg|jpeg|svg|webp|avif|gif)$/,
  // JS/CSS - long cache with revalidation
  assets: /\/assets\//,
  // Walmart product data - medium cache
  walmart: /walmart.*(?:product|price|inventory)/
};

// Performance monitoring
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkFallbacks: 0,
  averageResponseTime: 0
};

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => {
        console.error('[SW] Failed to cache static assets:', err);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              // Remove old caches
              return cacheName.startsWith('walmart-') && 
                     cacheName !== CACHE_NAME && 
                     cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE;
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(handleRequest(request));
});

// Main request handler with intelligent caching
async function handleRequest(request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  try {
    // Static assets - Cache First strategy
    if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // API requests - Network First with timeout
    if (DYNAMIC_PATTERNS.api.test(request.url)) {
      return await networkFirst(request, DYNAMIC_CACHE, { timeout: 5000 });
    }
    
    // Images - Cache First with network fallback
    if (DYNAMIC_PATTERNS.images.test(request.url)) {
      return await cacheFirst(request, DYNAMIC_CACHE, { maxAge: 86400000 }); // 24 hours
    }
    
    // Walmart data - Stale While Revalidate for better UX
    if (DYNAMIC_PATTERNS.walmart.test(request.url)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE, { maxAge: 300000 }); // 5 minutes
    }
    
    // JS/CSS assets - Cache First with long TTL
    if (DYNAMIC_PATTERNS.assets.test(request.url)) {
      return await cacheFirst(request, STATIC_CACHE, { maxAge: 31536000000 }); // 1 year
    }
    
    // Default - Network First
    return await networkFirst(request, DYNAMIC_CACHE, { timeout: 3000 });
    
  } catch (error) {
    console.error('[SW] Request failed:', error);
    
    // Try to return offline fallback
    if (request.mode === 'navigate') {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network Error', { status: 503 });
  } finally {
    // Track performance
    const duration = Date.now() - startTime;
    updateMetrics(duration);
  }
}

// Cache First strategy
async function cacheFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached && !isExpired(cached, options.maxAge)) {
    performanceMetrics.cacheHits++;
    return cached;
  }
  
  performanceMetrics.cacheMisses++;
  const response = await fetch(request);
  
  if (response.ok) {
    cache.put(request, response.clone());
  }
  
  return response;
}

// Network First strategy
async function networkFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  
  try {
    // Try network with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 5000);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    performanceMetrics.networkFallbacks++;
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Always fetch in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => {
    console.warn('[SW] Background fetch failed:', err);
    return null;
  });
  
  // Return cached if available and not expired
  if (cached && !isExpired(cached, options.maxAge)) {
    performanceMetrics.cacheHits++;
    fetchPromise.catch(() => {}); // Prevent unhandled rejection
    return cached;
  }
  
  // Wait for network response
  performanceMetrics.cacheMisses++;
  return await fetchPromise || cached || new Response('Offline', { status: 503 });
}

// Check if cached response is expired
function isExpired(response, maxAge) {
  if (!maxAge) return false;
  
  const date = response.headers.get('date');
  if (!date) return false;
  
  const responseTime = new Date(date).getTime();
  return Date.now() - responseTime > maxAge;
}

// Update performance metrics
function updateMetrics(duration) {
  const totalRequests = performanceMetrics.cacheHits + performanceMetrics.cacheMisses + performanceMetrics.networkFallbacks;
  performanceMetrics.averageResponseTime = 
    (performanceMetrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'walmart-sync') {
    event.waitUntil(syncWalmartData());
  }
});

async function syncWalmartData() {
  try {
    // Sync any pending Walmart grocery list updates
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('walmart') && request.method === 'POST') {
        await fetch(request);
      }
    }
    
    console.log('[SW] Walmart data synced successfully');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Message handler for performance metrics
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_METRICS') {
    event.ports[0].postMessage(performanceMetrics);
  }
});

console.log('[SW] Service Worker loaded successfully');