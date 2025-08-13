/**
 * Browser Detection and Feature Support Utilities
 * Comprehensive browser capability detection for compatibility testing
 */

export interface BrowserCapabilities {
  name: string;
  version: string;
  engine: string;
  features: {
    webSpeechAPI: boolean;
    webSocket: boolean;
    serviceWorker: boolean;
    pushNotifications: boolean;
    geolocation: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
    webGL: boolean;
    webRTC: boolean;
    mediaDevices: boolean;
    clipboard: boolean;
    intersectionObserver: boolean;
    resizeObserver: boolean;
    mutationObserver: boolean;
    customElements: boolean;
    shadowDOM: boolean;
    modules: boolean;
    dynamicImports: boolean;
    asyncAwait: boolean;
    promises: boolean;
    fetch: boolean;
    webWorkers: boolean;
    sharedArrayBuffer: boolean;
    webAssembly: boolean;
    css: {
      grid: boolean;
      flexbox: boolean;
      customProperties: boolean;
      animation: boolean;
      transform3d: boolean;
      filter: boolean;
      backdropFilter: boolean;
    };
  };
}

/**
 * Detect browser capabilities and features
 */
export async function detectBrowserCapabilities(page: any): Promise<BrowserCapabilities> {
  return await page.evaluate(() => {
    const userAgent = navigator.userAgent;
    const capabilities: BrowserCapabilities = {
      name: getBrowserName(),
      version: getBrowserVersion(),
      engine: getEngine(),
      features: {
        // Web APIs
        webSpeechAPI: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
        webSocket: 'WebSocket' in window,
        serviceWorker: 'serviceWorker' in navigator,
        pushNotifications: 'PushManager' in window,
        geolocation: 'geolocation' in navigator,
        localStorage: 'localStorage' in window,
        sessionStorage: 'sessionStorage' in window,
        indexedDB: 'indexedDB' in window,
        webGL: hasWebGL(),
        webRTC: hasWebRTC(),
        mediaDevices: 'mediaDevices' in navigator,
        clipboard: 'clipboard' in navigator,
        
        // Observers
        intersectionObserver: 'IntersectionObserver' in window,
        resizeObserver: 'ResizeObserver' in window,
        mutationObserver: 'MutationObserver' in window,
        
        // Web Components
        customElements: 'customElements' in window,
        shadowDOM: 'attachShadow' in Element.prototype,
        
        // Modern JS Features
        modules: 'import' in HTMLScriptElement.prototype,
        dynamicImports: supportsDynamicImports(),
        asyncAwait: supportsAsyncAwait(),
        promises: 'Promise' in window,
        fetch: 'fetch' in window,
        webWorkers: 'Worker' in window,
        sharedArrayBuffer: 'SharedArrayBuffer' in window,
        webAssembly: 'WebAssembly' in window,
        
        // CSS Features
        css: {
          grid: supportsCSSGrid(),
          flexbox: supportsCSSFlexbox(),
          customProperties: supportsCSSCustomProperties(),
          animation: supportsCSSAnimation(),
          transform3d: supportsCSS3DTransforms(),
          filter: supportsCSSFilter(),
          backdropFilter: supportsCSSBackdropFilter()
        }
      }
    };

    function getBrowserName(): string {
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
      if (userAgent.includes('Edg')) return 'Edge';
      if (userAgent.includes('Opera')) return 'Opera';
      return 'Unknown';
    }

    function getBrowserVersion(): string {
      const match = userAgent.match(/(?:Chrome|Firefox|Safari|Edg|Opera)\/(\d+)/);
      return match ? match[1] : 'Unknown';
    }

    function getEngine(): string {
      if (userAgent.includes('WebKit')) return 'WebKit';
      if (userAgent.includes('Gecko')) return 'Gecko';
      if (userAgent.includes('Blink')) return 'Blink';
      return 'Unknown';
    }

    function hasWebGL(): boolean {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          canvas.getContext('webgl') || 
          canvas.getContext('experimental-webgl')
        );
      } catch {
        return false;
      }
    }

    function hasWebRTC(): boolean {
      return !!(
        (window as any).RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection
      );
    }

    function supportsDynamicImports(): boolean {
      try {
        new Function('import("")');
        return true;
      } catch {
        return false;
      }
    }

    function supportsAsyncAwait(): boolean {
      try {
        new Function('return (async function(){})();');
        return true;
      } catch {
        return false;
      }
    }

    function supportsCSSGrid(): boolean {
      return CSS.supports('display', 'grid');
    }

    function supportsCSSFlexbox(): boolean {
      return CSS.supports('display', 'flex');
    }

    function supportsCSSCustomProperties(): boolean {
      return CSS.supports('--custom', 'property');
    }

    function supportsCSSAnimation(): boolean {
      return CSS.supports('animation-duration', '1s');
    }

    function supportsCSS3DTransforms(): boolean {
      return CSS.supports('transform', 'translateZ(0)');
    }

    function supportsCSSFilter(): boolean {
      return CSS.supports('filter', 'blur(1px)');
    }

    function supportsCSSBackdropFilter(): boolean {
      return CSS.supports('backdrop-filter', 'blur(1px)');
    }

    return capabilities;
  });
}

/**
 * Generate compatibility score based on required features
 */
export function calculateCompatibilityScore(
  capabilities: BrowserCapabilities, 
  requiredFeatures: string[]
): number {
  const total = requiredFeatures.length;
  let supported = 0;

  requiredFeatures.forEach(feature => {
    if (hasFeature(capabilities, feature)) {
      supported++;
    }
  });

  return total > 0 ? (supported / total) * 100 : 100;
}

/**
 * Check if browser has specific feature
 */
export function hasFeature(capabilities: BrowserCapabilities, feature: string): boolean {
  const parts = feature.split('.');
  let current: any = capabilities.features;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  
  return Boolean(current);
}

/**
 * Get polyfills needed for unsupported features
 */
export function getRequiredPolyfills(
  capabilities: BrowserCapabilities, 
  requiredFeatures: string[]
): string[] {
  const polyfills: string[] = [];

  requiredFeatures.forEach(feature => {
    if (!hasFeature(capabilities, feature)) {
      const polyfill = getPolyfillFor(feature);
      if (polyfill && !polyfills.includes(polyfill)) {
        polyfills.push(polyfill);
      }
    }
  });

  return polyfills;
}

/**
 * Get polyfill package for specific feature
 */
function getPolyfillFor(feature: string): string | null {
  const polyfillMap: Record<string, string> = {
    'fetch': '@github/fetch',
    'promises': 'es6-promise',
    'webSpeechAPI': 'speech-recognition-polyfill',
    'intersectionObserver': 'intersection-observer',
    'resizeObserver': 'resize-observer-polyfill',
    'customElements': '@webcomponents/custom-elements',
    'shadowDOM': '@webcomponents/shadydom',
    'css.customProperties': 'css-vars-ponyfill',
    'css.grid': 'css-grid-polyfill'
  };

  return polyfillMap[feature] || null;
}

/**
 * Required features for Walmart Grocery Agent
 */
export const WALMART_REQUIRED_FEATURES = [
  'fetch',
  'promises',
  'localStorage',
  'sessionStorage',
  'webSocket',
  'geolocation',
  'mediaDevices',
  'intersectionObserver',
  'css.flexbox',
  'css.grid',
  'css.customProperties',
  'css.animation'
];

/**
 * Optional features that enhance functionality
 */
export const WALMART_OPTIONAL_FEATURES = [
  'webSpeechAPI',
  'serviceWorker',
  'pushNotifications',
  'webGL',
  'webRTC',
  'clipboard',
  'customElements',
  'shadowDOM',
  'webWorkers',
  'css.backdropFilter'
];