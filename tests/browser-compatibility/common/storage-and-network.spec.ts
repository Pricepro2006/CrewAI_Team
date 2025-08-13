import { test, expect, Page } from '@playwright/test';
import { detectBrowserCapabilities, BrowserCapabilities } from '../utils/browser-detector';

test.describe('Storage and Network Compatibility Tests', () => {
  let capabilities: BrowserCapabilities;

  test.beforeEach(async ({ page }) => {
    capabilities = await detectBrowserCapabilities(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should test localStorage functionality', async ({ page }) => {
    const localStorageTest = await page.evaluate(() => {
      const results: any = {
        supported: false,
        quota: null,
        operations: {
          setItem: false,
          getItem: false,
          removeItem: false,
          clear: false,
          key: false
        },
        events: false,
        errors: []
      };

      try {
        if ('localStorage' in window && window.localStorage !== null) {
          results.supported = true;

          // Test basic operations
          const testKey = 'browser-compat-test';
          const testValue = 'test-value-12345';

          // Set item
          localStorage.setItem(testKey, testValue);
          results.operations.setItem = true;

          // Get item
          const retrievedValue = localStorage.getItem(testKey);
          results.operations.getItem = retrievedValue === testValue;

          // Key access
          const keyIndex = localStorage.key(0);
          results.operations.key = keyIndex !== null;

          // Length
          const length = localStorage.length;
          results.length = length;

          // Remove item
          localStorage.removeItem(testKey);
          results.operations.removeItem = localStorage.getItem(testKey) === null;

          // Test storage events
          const testEventHandler = () => {
            results.events = true;
          };
          
          window.addEventListener('storage', testEventHandler);
          
          // Set an item to trigger storage event (won't fire in same window, but tests API)
          localStorage.setItem('event-test', 'value');
          localStorage.removeItem('event-test');
          
          window.removeEventListener('storage', testEventHandler);

          // Test quota (approximate)
          try {
            const testData = 'x'.repeat(1024); // 1KB
            let quota = 0;
            for (let i = 0; i < 10000; i++) { // Test up to ~10MB
              localStorage.setItem(`quota-test-${i}`, testData);
              quota += testData.length;
              if (quota > 5 * 1024 * 1024) break; // Stop at 5MB to avoid browser freeze
            }
            results.quota = quota;
            
            // Cleanup quota test
            for (let i = 0; i < 10000; i++) {
              localStorage.removeItem(`quota-test-${i}`);
            }
          } catch (e) {
            results.quota = 'limit-reached';
          }

          // Test clear
          localStorage.setItem('clear-test', 'value');
          localStorage.clear();
          results.operations.clear = localStorage.getItem('clear-test') === null;

        }
      } catch (error) {
        results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      return results;
    });

    console.log(`localStorage Test Results for ${capabilities.name}:`, localStorageTest);

    expect(localStorageTest.supported).toBe(true);
    expect(localStorageTest.operations.setItem).toBe(true);
    expect(localStorageTest.operations.getItem).toBe(true);
    expect(localStorageTest.operations.removeItem).toBe(true);
    expect(localStorageTest.operations.clear).toBe(true);

    if (localStorageTest.quota) {
      console.log(`Estimated localStorage quota: ${localStorageTest.quota} bytes`);
    }

    if (localStorageTest.errors.length > 0) {
      console.log('localStorage errors:', localStorageTest.errors);
    }
  });

  test('should test sessionStorage functionality', async ({ page }) => {
    const sessionStorageTest = await page.evaluate(() => {
      const results: any = {
        supported: false,
        operations: {
          setItem: false,
          getItem: false,
          removeItem: false,
          clear: false
        },
        persistence: false,
        errors: []
      };

      try {
        if ('sessionStorage' in window && window.sessionStorage !== null) {
          results.supported = true;

          const testKey = 'session-compat-test';
          const testValue = 'session-test-value';

          // Basic operations
          sessionStorage.setItem(testKey, testValue);
          results.operations.setItem = true;

          const retrieved = sessionStorage.getItem(testKey);
          results.operations.getItem = retrieved === testValue;

          sessionStorage.removeItem(testKey);
          results.operations.removeItem = sessionStorage.getItem(testKey) === null;

          // Test clear
          sessionStorage.setItem('clear-test', 'value');
          sessionStorage.clear();
          results.operations.clear = sessionStorage.getItem('clear-test') === null;

          // Test persistence within session
          sessionStorage.setItem('persistence-test', 'persistent-value');
          results.persistence = sessionStorage.getItem('persistence-test') === 'persistent-value';
        }
      } catch (error) {
        results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      return results;
    });

    console.log(`sessionStorage Test Results for ${capabilities.name}:`, sessionStorageTest);

    expect(sessionStorageTest.supported).toBe(true);
    expect(sessionStorageTest.operations.setItem).toBe(true);
    expect(sessionStorageTest.operations.getItem).toBe(true);
    expect(sessionStorageTest.operations.removeItem).toBe(true);
    expect(sessionStorageTest.operations.clear).toBe(true);
    expect(sessionStorageTest.persistence).toBe(true);

    if (sessionStorageTest.errors.length > 0) {
      console.log('sessionStorage errors:', sessionStorageTest.errors);
    }
  });

  test('should test IndexedDB functionality', async ({ page }) => {
    const indexedDBTest = await page.evaluate(async () => {
      const results: any = {
        supported: false,
        operations: {
          open: false,
          createObjectStore: false,
          add: false,
          get: false,
          delete: false
        },
        errors: []
      };

      return new Promise((resolve) => {
        try {
          if ('indexedDB' in window) {
            results.supported = true;

            const dbName = 'compat-test-db';
            const request = indexedDB.open(dbName, 1);

            request.onerror = () => {
              results.errors.push('Failed to open IndexedDB');
              resolve(results);
            };

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              
              try {
                const objectStore = db.createObjectStore('test-store', { keyPath: 'id' });
                results.operations.createObjectStore = true;
              } catch (error) {
                results.errors.push('Failed to create object store');
              }
            };

            request.onsuccess = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              results.operations.open = true;

              try {
                const transaction = db.transaction(['test-store'], 'readwrite');
                const objectStore = transaction.objectStore('test-store');

                // Add data
                const addRequest = objectStore.add({ id: 1, name: 'Test Item' });
                addRequest.onsuccess = () => {
                  results.operations.add = true;

                  // Get data
                  const getRequest = objectStore.get(1);
                  getRequest.onsuccess = () => {
                    results.operations.get = getRequest.result?.name === 'Test Item';

                    // Delete data
                    const deleteRequest = objectStore.delete(1);
                    deleteRequest.onsuccess = () => {
                      results.operations.delete = true;
                      
                      // Close and delete database
                      db.close();
                      const deleteDBRequest = indexedDB.deleteDatabase(dbName);
                      deleteDBRequest.onsuccess = () => resolve(results);
                      deleteDBRequest.onerror = () => resolve(results);
                    };
                    deleteRequest.onerror = () => resolve(results);
                  };
                  getRequest.onerror = () => resolve(results);
                };
                addRequest.onerror = () => resolve(results);

              } catch (error) {
                results.errors.push('Transaction failed');
                resolve(results);
              }
            };

            // Timeout for the test
            setTimeout(() => {
              resolve(results);
            }, 5000);

          } else {
            resolve(results);
          }
        } catch (error) {
          results.errors.push(error instanceof Error ? error.message : 'Unknown error');
          resolve(results);
        }
      });
    });

    console.log(`IndexedDB Test Results for ${capabilities.name}:`, indexedDBTest);

    if (indexedDBTest.supported) {
      expect(indexedDBTest.operations.open).toBe(true);
      console.log('✅ IndexedDB is supported and functional');
      
      if (indexedDBTest.operations.createObjectStore) console.log('✅ Object store creation works');
      if (indexedDBTest.operations.add) console.log('✅ Data addition works');
      if (indexedDBTest.operations.get) console.log('✅ Data retrieval works');
      if (indexedDBTest.operations.delete) console.log('✅ Data deletion works');
    } else {
      console.log('❌ IndexedDB not supported');
    }

    if (indexedDBTest.errors.length > 0) {
      console.log('IndexedDB errors:', indexedDBTest.errors);
    }
  });

  test('should test fetch API and network requests', async ({ page }) => {
    const networkTest = await page.evaluate(async () => {
      const results: any = {
        fetchSupported: false,
        xhrSupported: false,
        corsSupport: false,
        requestTypes: {
          get: false,
          post: false,
          put: false,
          delete: false
        },
        responseTypes: {
          json: false,
          text: false,
          blob: false,
          arrayBuffer: false
        },
        errors: []
      };

      // Test fetch support
      if ('fetch' in window) {
        results.fetchSupported = true;

        try {
          // Test GET request
          const getResponse = await fetch('data:application/json,{"test":"value"}');
          results.requestTypes.get = getResponse.ok;

          // Test response types
          const jsonData = await getResponse.clone().json();
          results.responseTypes.json = jsonData.test === 'value';

          const textData = await getResponse.clone().text();
          results.responseTypes.text = typeof textData === 'string';

          const blobData = await getResponse.clone().blob();
          results.responseTypes.blob = blobData instanceof Blob;

          const bufferData = await getResponse.clone().arrayBuffer();
          results.responseTypes.arrayBuffer = bufferData instanceof ArrayBuffer;

        } catch (error) {
          results.errors.push('Fetch test failed: ' + (error as Error).message);
        }

        // Test POST request (data URL)
        try {
          const postResponse = await fetch('data:application/json,{"success":true}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: 'data' })
          });
          results.requestTypes.post = true;
        } catch (error) {
          results.errors.push('POST test failed: ' + (error as Error).message);
        }
      }

      // Test XMLHttpRequest
      if ('XMLHttpRequest' in window) {
        results.xhrSupported = true;

        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', 'data:application/json,{"xhr":"test"}', false);
          xhr.send();
          results.xhrSuccess = xhr.status === 200;
        } catch (error) {
          results.errors.push('XHR test failed: ' + (error as Error).message);
        }
      }

      return results;
    });

    console.log(`Network Test Results for ${capabilities.name}:`, networkTest);

    expect(networkTest.fetchSupported).toBe(true);
    expect(networkTest.xhrSupported).toBe(true);

    if (networkTest.requestTypes.get) console.log('✅ GET requests work');
    if (networkTest.responseTypes.json) console.log('✅ JSON response parsing works');
    if (networkTest.responseTypes.text) console.log('✅ Text response parsing works');
    if (networkTest.responseTypes.blob) console.log('✅ Blob response handling works');
    if (networkTest.responseTypes.arrayBuffer) console.log('✅ ArrayBuffer response handling works');

    if (networkTest.errors.length > 0) {
      console.log('Network errors:', networkTest.errors);
    }
  });

  test('should test CORS policy handling', async ({ page }) => {
    // Navigate to Walmart agent to test real network requests
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    const corsTest = await page.evaluate(async () => {
      const results: any = {
        corsHeaders: {},
        preflightSupport: false,
        credentialsSupport: false,
        errors: []
      };

      try {
        // Test CORS headers in a real request (if possible)
        const testRequest = new Request('/', {
          method: 'GET',
          headers: { 'X-Custom-Header': 'test' }
        });

        // Check if request can be created with CORS headers
        results.corsHeaderCreation = !!testRequest.headers.get('X-Custom-Header');

        // Test credentials support
        const credentialsRequest = new Request('/', { 
          credentials: 'include' 
        });
        results.credentialsSupport = credentialsRequest.credentials === 'include';

        // Test preflight handling
        try {
          const preflightResponse = await fetch('/', {
            method: 'OPTIONS',
            headers: {
              'Access-Control-Request-Method': 'POST',
              'Access-Control-Request-Headers': 'Content-Type'
            }
          });
          results.preflightSupport = preflightResponse.status < 400;
        } catch (error) {
          results.errors.push('Preflight test error: ' + (error as Error).message);
        }

      } catch (error) {
        results.errors.push('CORS test error: ' + (error as Error).message);
      }

      return results;
    });

    console.log(`CORS Test Results for ${capabilities.name}:`, corsTest);

    if (corsTest.corsHeaderCreation) console.log('✅ CORS header creation works');
    if (corsTest.credentialsSupport) console.log('✅ Credentials mode supported');
    if (corsTest.preflightSupport) console.log('✅ Preflight requests handled');

    if (corsTest.errors.length > 0) {
      console.log('CORS errors:', corsTest.errors);
    }
  });

  test('should test storage persistence and cleanup', async ({ page }) => {
    // Test storage persistence across page reloads
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    // Set test data
    await page.evaluate(() => {
      localStorage.setItem('persistence-test', 'persistent-data');
      sessionStorage.setItem('session-test', 'session-data');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    const persistenceTest = await page.evaluate(() => {
      const results = {
        localStoragePersisted: localStorage.getItem('persistence-test') === 'persistent-data',
        sessionStoragePersisted: sessionStorage.getItem('session-test') === 'session-data',
        cleanupSuccess: false
      };

      // Cleanup test data
      try {
        localStorage.removeItem('persistence-test');
        sessionStorage.removeItem('session-test');
        results.cleanupSuccess = true;
      } catch (error) {
        console.error('Cleanup failed:', error);
      }

      return results;
    });

    console.log(`Storage Persistence Test for ${capabilities.name}:`, persistenceTest);

    expect(persistenceTest.localStoragePersisted).toBe(true);
    expect(persistenceTest.sessionStoragePersisted).toBe(true);
    expect(persistenceTest.cleanupSuccess).toBe(true);

    console.log('✅ Storage data persisted across page reload');
    console.log('✅ Storage cleanup successful');
  });

  test('should provide storage and network recommendations', async ({ page }) => {
    const recommendations = await page.evaluate(() => {
      const support = {
        localStorage: 'localStorage' in window,
        sessionStorage: 'sessionStorage' in window,
        indexedDB: 'indexedDB' in window,
        fetch: 'fetch' in window,
        xhr: 'XMLHttpRequest' in window,
        serviceWorker: 'serviceWorker' in navigator,
        cacheAPI: 'caches' in window
      };

      const recommendations = [];
      const fallbacks = [];

      // Storage recommendations
      if (support.indexedDB) {
        recommendations.push('Use IndexedDB for complex data storage');
      } else if (support.localStorage) {
        recommendations.push('Fallback to localStorage for simple data');
        fallbacks.push({ feature: 'IndexedDB', fallback: 'localStorage with JSON serialization' });
      }

      if (support.localStorage) {
        recommendations.push('Use localStorage for persistent simple data');
      } else {
        fallbacks.push({ feature: 'localStorage', fallback: 'Server-side storage or cookies' });
      }

      if (support.sessionStorage) {
        recommendations.push('Use sessionStorage for temporary data');
      } else {
        fallbacks.push({ feature: 'sessionStorage', fallback: 'In-memory storage or server sessions' });
      }

      // Network recommendations
      if (support.fetch) {
        recommendations.push('Use fetch API for modern network requests');
      } else if (support.xhr) {
        recommendations.push('Fallback to XMLHttpRequest for network requests');
        fallbacks.push({ feature: 'fetch', fallback: 'XMLHttpRequest with polyfill' });
      }

      if (support.serviceWorker) {
        recommendations.push('Implement service worker for offline functionality');
      }

      if (support.cacheAPI) {
        recommendations.push('Use Cache API for request/response caching');
      }

      return { support, recommendations, fallbacks };
    });

    console.log(`Storage & Network Recommendations for ${capabilities.name}:`);
    console.log('\nFeature Support:');
    Object.entries(recommendations.support).forEach(([feature, supported]) => {
      console.log(`  ${feature}: ${supported ? '✅' : '❌'}`);
    });

    console.log('\nRecommendations:');
    recommendations.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });

    if (recommendations.fallbacks.length > 0) {
      console.log('\nRequired Fallbacks:');
      recommendations.fallbacks.forEach(fallback => {
        console.log(`  ${fallback.feature}: ${fallback.fallback}`);
      });
    }

    // Save recommendations
    await page.evaluate((data) => {
      (window as any).storageNetworkReport = data;
    }, recommendations);

    await page.screenshot({ 
      path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/storage-network.png`,
      fullPage: true 
    });
  });
});