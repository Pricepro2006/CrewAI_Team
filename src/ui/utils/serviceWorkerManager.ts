// Service Worker Manager for Walmart Grocery Agent
// Handles registration, updates, and performance monitoring

import { useState } from 'react';

// Global gtag type definition
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, eventParameters?: object) => void;
  }
}

export interface ServiceWorkerMetrics {
  cacheHits: number;
  cacheMisses: number;
  networkFallbacks: number;
  averageResponseTime: number;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private metrics: ServiceWorkerMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkFallbacks: 0,
    averageResponseTime: 0
  };

  constructor() {
    this.init();
  }

  private async init() {
    if (!this.isSupported()) {
      console.warn('[SW Manager] Service Workers not supported');
      return;
    }

    await this.register();
    this.setupUpdateHandling();
    this.setupPerformanceMonitoring();
  }

  private isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'caches' in window && 
           process.env.NODE_ENV === 'production';
  }

  private async register() {
    try {
      this.registration = await navigator?.serviceWorker?.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      console.log('[SW Manager] Service Worker registered successfully');

      // Handle registration states
      if (this?.registration?.installing) {
        console.log('[SW Manager] Service Worker installing...');
        this.trackInstallation(this?.registration?.installing);
      } else if (this?.registration?.waiting) {
        console.log('[SW Manager] Service Worker waiting to activate');
        this.updateAvailable = true;
      } else if (this?.registration?.active) {
        console.log('[SW Manager] Service Worker active');
      }

    } catch (error) {
      console.error('[SW Manager] Service Worker registration failed:', error);
    }
  }

  private trackInstallation(sw: ServiceWorker) {
    sw.addEventListener('statechange', () => {
      switch (sw.state) {
        case 'installed':
          console.log('[SW Manager] Service Worker installed');
          if (!navigator?.serviceWorker?.controller) {
            // First time installation
            this.notifyFirstInstall();
          } else {
            // Update available
            this.updateAvailable = true;
            this.notifyUpdateAvailable();
          }
          break;
        case 'activated':
          console.log('[SW Manager] Service Worker activated');
          break;
        case 'redundant':
          console.log('[SW Manager] Service Worker redundant');
          break;
      }
    });
  }

  private setupUpdateHandling() {
    if (!this.registration) return;

    // Listen for updates
    this?.registration?.addEventListener('updatefound', () => {
      console.log('[SW Manager] Update found');
      const newSW = this.registration!.installing;
      if (newSW) {
        this.trackInstallation(newSW);
      }
    });

    // Listen for controller changes
    navigator?.serviceWorker?.addEventListener('controllerchange', () => {
      console.log('[SW Manager] Controller changed - reloading page');
      window?.location?.reload();
    });

    // Check for updates periodically
    setInterval(() => {
      this.checkForUpdates();
    }, 60000); // Check every minute
  }

  private setupPerformanceMonitoring() {
    // Request metrics from service worker periodically
    setInterval(async () => {
      const metrics = await this.getMetrics();
      if (metrics) {
        this.metrics = metrics;
        this.reportPerformanceMetrics();
      }
    }, 30000); // Every 30 seconds
  }

  private async getMetrics(): Promise<ServiceWorkerMetrics | null> {
    return new Promise((resolve: any) => {
      if (!navigator?.serviceWorker?.controller) {
        resolve(null);
        return;
      }

      const messageChannel = new MessageChannel();
      
      messageChannel?.port1?.onmessage = (event: any) => {
        resolve(event.data);
      };

      navigator?.serviceWorker?.controller.postMessage(
        { type: 'GET_METRICS' },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }

  private reportPerformanceMetrics() {
    const { cacheHits, cacheMisses, networkFallbacks, averageResponseTime } = this.metrics;
    const totalRequests = cacheHits + cacheMisses + networkFallbacks;
    
    if (totalRequests === 0) return;

    const cacheHitRate = (cacheHits / totalRequests) * 100;
    
    console.group('[SW Manager] Performance Metrics');
    console.log(`Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`);
    console.log(`Average Response Time: ${averageResponseTime.toFixed(0)}ms`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Network Fallbacks: ${networkFallbacks}`);
    console.groupEnd();

    // Warn if performance is poor
    if (cacheHitRate < 50) {
      console.warn('[SW Manager] Low cache hit rate detected');
    }
    
    if (averageResponseTime > 1000) {
      console.warn('[SW Manager] High average response time detected');
    }

    // Send to analytics if available
    if (window.gtag) {
      window.gtag('event', 'service_worker_performance', {
        cache_hit_rate: cacheHitRate,
        avg_response_time: averageResponseTime,
        total_requests: totalRequests
      });
    }
  }

  private notifyFirstInstall() {
    // Show user notification about offline capabilities
    this.showNotification('🚀 App is now available offline!', {
      type: 'success',
      duration: 5000,
      action: 'Got it'
    });
  }

  private notifyUpdateAvailable() {
    // Show update notification
    this.showNotification('🔄 A new version is available!', {
      type: 'info',
      persistent: true,
      action: 'Update',
      onAction: () => this.applyUpdate()
    });
  }

  private showNotification(message: string, options: {
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
    persistent?: boolean;
    action?: string;
    onAction?: () => void;
  }) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `
      fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm
      transition-all duration-300 transform translate-x-full
      ${options.type === 'success' ? 'bg-green-500 text-white' : ''}
      ${options.type === 'info' ? 'bg-blue-500 text-white' : ''}
      ${options.type === 'warning' ? 'bg-yellow-500 text-black' : ''}
      ${options.type === 'error' ? 'bg-red-500 text-white' : ''}
    `;

    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="mr-3">${message}</span>
        ${options.action ? `
          <button class="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition-colors">
            ${options.action}
          </button>
        ` : ''}
        <button class="ml-2 text-lg font-bold hover:opacity-70 transition-opacity">&times;</button>
      </div>
    `;

    document?.body?.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification?.classList?.remove('translate-x-full');
    }, 100);

    // Setup event listeners
    const actionBtn = notification.querySelector('button:first-of-type');
    const closeBtn = notification.querySelector('button:last-of-type');

    if (actionBtn && options.onAction) {
      actionBtn.addEventListener('click', () => {
        options.onAction!();
        this.removeNotification(notification);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeNotification(notification);
      });
    }

    // Auto remove unless persistent
    if (!options.persistent) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, options.duration || 3000);
    }
  }

  private removeNotification(notification: HTMLElement) {
    notification?.classList?.add('translate-x-full');
    setTimeout(() => {
      if (notification.parentNode) {
        notification?.parentNode?.removeChild(notification);
      }
    }, 300);
  }

  // Public methods
  async checkForUpdates() {
    if (!this.registration) return;
    
    try {
      await this?.registration?.update();
      console.log('[SW Manager] Update check completed');
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error);
    }
  }

  async applyUpdate() {
    if (!this.registration?.waiting) return;

    // Send skip waiting message to service worker
    this?.registration?.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  getCacheStats(): ServiceWorkerMetrics {
    return { ...this.metrics };
  }

  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  // Preload critical routes
  async preloadRoute(path: string) {
    if (!navigator?.serviceWorker?.controller) return;

    try {
      await fetch(path, { 
        method: 'GET',
        cache: 'no-cache' 
      });
      console.log(`[SW Manager] Route preloaded: ${path}`);
    } catch (error) {
      console.warn(`[SW Manager] Failed to preload route: ${path}`, error);
    }
  }

  // Preload critical assets
  async preloadAssets(urls: string[]) {
    const promises = urls?.map(url => 
      fetch(url, { cache: 'force-cache' }).catch(err => 
        console.warn(`[SW Manager] Failed to preload asset: ${url}`, err)
      )
    );

    await Promise.allSettled(promises);
    console.log(`[SW Manager] Preloaded ${urls?.length || 0} assets`);
  }
}

// Global service worker manager instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Utility functions
export const preloadWalmartRoutes = async () => {
  await Promise.all([
    serviceWorkerManager.preloadRoute('/walmart'),
    serviceWorkerManager.preloadRoute('/walmart/grocery'),
    serviceWorkerManager.preloadRoute('/walmart/pricing')
  ]);
};

export const preloadCriticalAssets = async () => {
  const criticalAssets = [
    '/assets/css/main.css',
    '/assets/js/react-vendor.js',
    '/assets/js/ui-vendor.js'
  ];
  
  await serviceWorkerManager.preloadAssets(criticalAssets);
};

// React hook for service worker state
export const useServiceWorker = () => {
  const [isSupported] = useState(serviceWorkerManager.isUpdateAvailable);
  const [updateAvailable] = useState(serviceWorkerManager.isUpdateAvailable);
  const [cacheStats] = useState(serviceWorkerManager.getCacheStats);

  return {
    isSupported,
    updateAvailable,
    cacheStats,
    checkForUpdates: serviceWorkerManager?.checkForUpdates?.bind(serviceWorkerManager),
    applyUpdate: serviceWorkerManager?.applyUpdate?.bind(serviceWorkerManager)
  };
};