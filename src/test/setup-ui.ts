import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock console methods to reduce noise in tests
const consoleMethods = ['log', 'info', 'warn', 'error'] as const;
consoleMethods.forEach(method => {
  vi.spyOn(console, method).mockImplementation(() => {});
});

// Global test setup
beforeAll(() => {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock window.getComputedStyle
  window.getComputedStyle = vi.fn().mockImplementation(() => ({
    getPropertyValue: vi.fn(),
  }));

  // Mock scrollTo
  window.scrollTo = vi.fn();

  // Mock location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000/',
      hostname: 'localhost',
      port: '3000',
      protocol: 'http:',
      pathname: '/',
      search: '',
      hash: '',
      reload: vi.fn(),
      assign: vi.fn(),
      replace: vi.fn(),
    },
    writable: true,
  });

  // Mock WebSocket for real-time features
  const MockWebSocketClass = vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
  }));
  
  // Add static constants to the constructor function
  (MockWebSocketClass as any).CONNECTING = 0;
  (MockWebSocketClass as any).OPEN = 1;
  (MockWebSocketClass as any).CLOSING = 2;
  (MockWebSocketClass as any).CLOSED = 3;
  
  global.WebSocket = MockWebSocketClass as any;

  // Mock fetch for API calls
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      headers: new Headers(),
    } as Response)
  );

  // Mock performance API
  global.performance = {
    ...global.performance,
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn().mockReturnValue([]),
    getEntriesByName: vi.fn().mockReturnValue([]),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn().mockImplementation(cb => {
    return setTimeout(() => cb(Date.now()), 16);
  });

  global.cancelAnimationFrame = vi.fn().mockImplementation(id => {
    clearTimeout(id);
  });

  // Mock Element.scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();

  // Mock Element.getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(() => ({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: vi.fn(),
  }));

  // Mock HTMLElement.offsetHeight and offsetWidth
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 100,
  });

  // Mock createRange for text selection
  global.Range = function Range() {} as any;
  global.Range.prototype.createContextualFragment = vi.fn().mockImplementation((html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div as unknown as DocumentFragment;
  });

  document.createRange = vi.fn().mockImplementation(() => ({
    selectNodeContents: vi.fn(),
    setStart: vi.fn(),
    setEnd: vi.fn(),
    commonAncestorContainer: document.body,
    collapsed: false,
    endContainer: document.body,
    endOffset: 0,
    startContainer: document.body,
    startOffset: 0,
    deleteContents: vi.fn(),
    extractContents: vi.fn(),
    insertNode: vi.fn(),
    surroundContents: vi.fn(),
    cloneRange: vi.fn(),
    collapse: vi.fn(),
    compareBoundaryPoints: vi.fn(),
    createContextualFragment: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    }),
    getClientRects: vi.fn().mockReturnValue([]),
    isPointInRange: vi.fn(),
    selectNode: vi.fn(),
    toString: vi.fn().mockReturnValue(''),
  }));

  // Suppress React 18 warnings in tests
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  
  // Clean up any remaining timers
  vi.runOnlyPendingTimers();
  vi.clearAllTimers();
});

// Global cleanup
afterAll(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
});