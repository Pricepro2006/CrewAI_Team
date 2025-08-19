// Service Worker Registration and Management
// Handles registration, updates, and communication with the service worker

import * as React from 'react';

const isLocalhost = Boolean(
  window?.location?.hostname === 'localhost' ||
  window?.location?.hostname === '[::1]' ||
  window?.location?.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
};

export function register(config?: Config) {
  if ('serviceWorker' in navigator) {
    // Only register in production or localhost
    if (process.env.NODE_ENV === 'production' || isLocalhost) {
      const publicUrl = new URL(process.env.PUBLIC_URL || '', window?.location?.href);
      if (publicUrl.origin !== window?.location?.origin) {
        return;
      }

      window.addEventListener('load', () => {
        const swUrl = `${process.env.PUBLIC_URL}/sw.js`;

        if (isLocalhost) {
          // In localhost, check if service worker exists
          checkValidServiceWorker(swUrl, config);
          navigator?.serviceWorker?.ready.then(() => {
            console.log('Service worker is running in development mode.');
          });
        } else {
          // Register service worker in production
          registerValidSW(swUrl, config);
        }
      });
    }
  }
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration: any) => {
      console.log('Service Worker registered successfully');
      
      registration.onupdatefound = () => {
        const installingWorker = registration?.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator?.serviceWorker?.controller) {
              // New content is available; please refresh
              console.log('New content is available and will be used when all tabs for this page are closed.');
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // Content is cached for offline use
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
              if (config && config.onOfflineReady) {
                config.onOfflineReady();
              }
            }
          }
        };
      };
    })
    .catch((error: any) => {
      console.error('Service Worker registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  // Check if the service worker can be found
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response: any) => {
      const contentType = response?.headers?.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Service worker not found; reload the page
        navigator?.serviceWorker?.ready.then((registration: any) => {
          registration.unregister().then(() => {
            window?.location?.reload();
          });
        });
      } else {
        // Service worker found; proceed with registration
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator?.serviceWorker?.ready
      .then((registration: any) => {
        registration.unregister();
        console.log('Service Worker unregistered');
      })
      .catch((error: any) => {
        console.error('Service Worker unregistration failed:', error);
      });
  }
}

// Get performance metrics from service worker
export async function getServiceWorkerMetrics(): Promise<any> {
  if (!('serviceWorker' in navigator) || !navigator?.serviceWorker?.controller) {
    return null;
  }

  return new Promise((resolve: any) => {
    const messageChannel = new MessageChannel();
    
    // Fix: Cannot assign to optional property - use proper null check
    if (messageChannel.port1) {
      messageChannel.port1.onmessage = (event: any) => {
        resolve(event.data);
      };
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_METRICS' },
        [messageChannel.port2]
      );
    } else {
      resolve(null);
    }

    // Timeout after 3 seconds
    setTimeout(() => resolve(null), 3000);
  });
}

// Update service worker
export function updateServiceWorker() {
  if ('serviceWorker' in navigator && navigator?.serviceWorker?.controller) {
    navigator?.serviceWorker?.controller.postMessage({ type: 'SKIP_WAITING' });
    window?.location?.reload();
  }
}

// Check if app is running offline
export function isOffline(): boolean {
  return !navigator.onLine;
}

// Monitor network status
export function monitorNetworkStatus(
  onOnline?: () => void,
  onOffline?: () => void
) {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log('App is back online');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('App is offline');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// React hook for service worker status
export function useServiceWorker() {
  const [swStatus, setSwStatus] = React.useState<'loading' | 'ready' | 'offline' | 'update-available'>('loading');
  const [metrics, setMetrics] = React.useState<any>(null);

  React.useEffect(() => {
    // Register service worker
    register({
      onSuccess: () => setSwStatus('ready'),
      onUpdate: () => setSwStatus('update-available'),
      onOfflineReady: () => setSwStatus('offline'),
    });

    // Monitor network status
    const cleanup = monitorNetworkStatus(
      () => setSwStatus('ready'),
      () => setSwStatus('offline')
    );

    // Get metrics periodically
    const metricsInterval = setInterval(async () => {
      const swMetrics = await getServiceWorkerMetrics();
      if (swMetrics) {
        setMetrics(swMetrics);
      }
    }, 10000);

    return () => {
      cleanup?.();
      clearInterval(metricsInterval);
    };
  }, []);

  return {
    status: swStatus,
    metrics,
    updateServiceWorker,
    isOffline: isOffline()
  };
}