/**
 * Load Test Configuration and Profiles
 * Defines different load testing profiles and scenarios
 */

export interface LoadProfile {
  name: string;
  description: string;
  stages: Stage[];
  thresholds: Thresholds;
  options?: TestOptions;
}

export interface Stage {
  duration: string;
  target: number; // Virtual users or RPS
  rampUp?: boolean;
}

export interface Thresholds {
  http_req_duration: string[];  // Response time thresholds
  http_req_failed: string;      // Error rate threshold
  http_reqs: string;            // Throughput threshold
}

export interface TestOptions {
  scenarios?: Record<string, any>;
  tags?: Record<string, string>;
  env?: Record<string, string>;
}

// Predefined load profiles
export const LOAD_PROFILES: Record<string, LoadProfile> = {
  // Development testing profile
  development: {
    name: 'Development Load Test',
    description: 'Light load for development environment testing',
    stages: [
      { duration: '30s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '30s', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: 'rate<0.05',
      http_reqs: 'rate>10'
    }
  },

  // Smoke test - minimal load
  smoke: {
    name: 'Smoke Test',
    description: 'Minimal load to verify system is working',
    stages: [
      { duration: '1m', target: 1 },
      { duration: '2m', target: 1 },
      { duration: '1m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: 'rate<0.01',
      http_reqs: 'rate>1'
    }
  },

  // Average load test
  average: {
    name: 'Average Load Test',
    description: 'Test with typical production load',
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(90)<400', 'p(95)<600', 'p(99)<1500'],
      http_req_failed: 'rate<0.01',
      http_reqs: 'rate>100'
    }
  },

  // Stress test - beyond normal capacity
  stress: {
    name: 'Stress Test',
    description: 'Push system beyond normal capacity',
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '5m', target: 400 },
      { duration: '10m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(90)<800', 'p(95)<1500', 'p(99)<3000'],
      http_req_failed: 'rate<0.05',
      http_reqs: 'rate>200'
    }
  },

  // Spike test - sudden increase
  spike: {
    name: 'Spike Test',
    description: 'Test system response to sudden traffic spikes',
    stages: [
      { duration: '1m', target: 10 },
      { duration: '30s', target: 500 },
      { duration: '3m', target: 500 },
      { duration: '30s', target: 10 },
      { duration: '3m', target: 10 },
      { duration: '30s', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: 'rate<0.05',
      http_reqs: 'rate>100'
    }
  },

  // Soak test - extended duration
  soak: {
    name: 'Soak Test',
    description: 'Extended duration test for memory leaks and stability',
    stages: [
      { duration: '5m', target: 100 },
      { duration: '4h', target: 100 },
      { duration: '5m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed: 'rate<0.01',
      http_reqs: 'rate>100'
    }
  },

  // Breakpoint test - find the limit
  breakpoint: {
    name: 'Breakpoint Test',
    description: 'Gradually increase load until system breaks',
    stages: [
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 600 },
      { duration: '2m', target: 700 },
      { duration: '2m', target: 800 },
      { duration: '2m', target: 900 },
      { duration: '2m', target: 1000 },
      { duration: '2m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000', 'p(99)<5000'],
      http_req_failed: 'rate<0.10',
      http_reqs: 'rate>50'
    }
  },

  // Grocery-specific scenarios
  grocery_morning_rush: {
    name: 'Grocery Morning Rush',
    description: 'Simulate morning shopping rush (7-9 AM)',
    stages: [
      { duration: '5m', target: 50 },   // Early shoppers
      { duration: '10m', target: 200 }, // Rush begins
      { duration: '20m', target: 400 }, // Peak rush
      { duration: '10m', target: 200 }, // Rush ends
      { duration: '5m', target: 50 },   // Normal traffic
      { duration: '2m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(90)<500', 'p(95)<800', 'p(99)<1500'],
      http_req_failed: 'rate<0.02',
      http_reqs: 'rate>150'
    }
  },

  grocery_weekend_pattern: {
    name: 'Grocery Weekend Pattern',
    description: 'Simulate weekend shopping patterns',
    stages: [
      { duration: '10m', target: 100 },  // Morning
      { duration: '15m', target: 300 },  // Late morning peak
      { duration: '10m', target: 200 },  // Lunch dip
      { duration: '20m', target: 400 },  // Afternoon peak
      { duration: '15m', target: 250 },  // Early evening
      { duration: '10m', target: 150 },  // Evening
      { duration: '5m', target: 50 },    // Late evening
      { duration: '2m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(90)<600', 'p(95)<1000', 'p(99)<2000'],
      http_req_failed: 'rate<0.03',
      http_reqs: 'rate>100'
    }
  },

  grocery_flash_sale: {
    name: 'Grocery Flash Sale',
    description: 'Simulate flash sale traffic pattern',
    stages: [
      { duration: '2m', target: 50 },    // Normal traffic
      { duration: '30s', target: 800 },  // Sale announcement spike
      { duration: '5m', target: 800 },   // Sustained high traffic
      { duration: '2m', target: 600 },   // Gradual decrease
      { duration: '3m', target: 400 },   // Still elevated
      { duration: '5m', target: 200 },   // Returning to normal
      { duration: '2m', target: 50 },    // Normal traffic
      { duration: '1m', target: 0 }
    ],
    thresholds: {
      http_req_duration: ['p(90)<800', 'p(95)<1500', 'p(99)<3000'],
      http_req_failed: 'rate<0.05',
      http_reqs: 'rate>200'
    }
  }
};

// Service-specific test configurations
export const SERVICE_CONFIGS = {
  nlp: {
    endpoint: '/api/nlp/process',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payloads: [
      { text: 'I need milk, eggs, and bread' },
      { text: 'Buy 2 pounds of chicken breast and some vegetables' },
      { text: 'Get me the cheapest pasta and tomato sauce' },
      { text: 'I want organic fruits and gluten-free bread' },
      { text: 'Stock up on paper towels, toilet paper, and cleaning supplies' }
    ]
  },

  pricing: {
    endpoint: '/api/prices/compare',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payloads: [
      { products: ['milk', 'eggs', 'bread'] },
      { products: ['chicken', 'beef', 'pork'] },
      { products: ['apples', 'bananas', 'oranges'] },
      { products: ['pasta', 'rice', 'quinoa'] },
      { products: ['yogurt', 'cheese', 'butter'] }
    ]
  },

  matching: {
    endpoint: '/api/match',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payloads: [
      { query: 'organic whole milk' },
      { query: 'gluten free bread' },
      { query: 'grass fed beef' },
      { query: 'free range eggs' },
      { query: 'extra virgin olive oil' }
    ]
  },

  cache: {
    endpoints: {
      set: '/api/cache/set',
      get: '/api/cache/get/:key',
      delete: '/api/cache/delete/:key'
    },
    operations: [
      { type: 'set', weight: 0.3 },
      { type: 'get', weight: 0.6 },
      { type: 'delete', weight: 0.1 }
    ]
  },

  analytics: {
    endpoint: '/api/analytics/track',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    events: [
      { event: 'search', properties: { query: 'milk', results: 10 } },
      { event: 'add_to_cart', properties: { product: 'eggs', quantity: 12 } },
      { event: 'purchase', properties: { total: 45.99, items: 8 } },
      { event: 'page_view', properties: { page: '/products/dairy' } }
    ]
  }
};

// Performance baselines and SLAs
export const PERFORMANCE_BASELINES = {
  response_times: {
    nlp: {
      p50: 200,
      p90: 400,
      p95: 600,
      p99: 1000
    },
    pricing: {
      p50: 100,
      p90: 200,
      p95: 300,
      p99: 500
    },
    matching: {
      p50: 150,
      p90: 300,
      p95: 450,
      p99: 800
    },
    cache: {
      p50: 10,
      p90: 20,
      p95: 30,
      p99: 50
    }
  },
  
  throughput: {
    nlp: 100,        // requests per second
    pricing: 200,
    matching: 150,
    cache: 1000,
    overall: 500
  },

  error_rates: {
    acceptable: 0.01,  // 1%
    warning: 0.05,     // 5%
    critical: 0.10     // 10%
  },

  resource_usage: {
    cpu: {
      normal: 50,      // percentage
      warning: 70,
      critical: 90
    },
    memory: {
      normal: 60,      // percentage
      warning: 80,
      critical: 95
    }
  }
};

// Chaos engineering scenarios
export const CHAOS_SCENARIOS = {
  service_failure: {
    name: 'Random Service Failure',
    description: 'Kill a random service and measure recovery',
    services: ['nlp', 'pricing', 'matching', 'cache', 'analytics'],
    failure_duration: 30, // seconds
    recovery_timeout: 60  // seconds
  },

  network_latency: {
    name: 'Network Latency Injection',
    description: 'Add artificial network latency',
    latency: {
      base: 100,      // ms
      variation: 50,  // ms
      loss: 0.05      // 5% packet loss
    }
  },

  resource_exhaustion: {
    name: 'Resource Exhaustion',
    description: 'Consume system resources',
    scenarios: [
      { type: 'cpu', usage: 90, duration: 60 },
      { type: 'memory', usage: 85, duration: 60 },
      { type: 'disk_io', operations: 1000, duration: 30 }
    ]
  },

  dependency_failure: {
    name: 'Dependency Failure',
    description: 'Simulate external dependency failures',
    dependencies: [
      { name: 'database', failure_rate: 0.5, duration: 30 },
      { name: 'redis', failure_rate: 1.0, duration: 20 },
      { name: 'ollama', failure_rate: 0.3, duration: 40 }
    ]
  },

  cascading_failure: {
    name: 'Cascading Failure',
    description: 'Trigger cascading failures across services',
    sequence: [
      { service: 'cache', delay: 0 },
      { service: 'pricing', delay: 5 },
      { service: 'matching', delay: 10 },
      { service: 'nlp', delay: 15 }
    ]
  }
};

// Export utility functions
export function getProfile(name: string): LoadProfile {
  const profile = LOAD_PROFILES[name];
  if (!profile) {
    throw new Error(`Load profile '${name}' not found`);
  }
  return profile;
}

export function getServiceConfig(service: string): any {
  const config = SERVICE_CONFIGS[service];
  if (!config) {
    throw new Error(`Service config for '${service}' not found`);
  }
  return config;
}

export function getChaosScenario(name: string): any {
  const scenario = CHAOS_SCENARIOS[name];
  if (!scenario) {
    throw new Error(`Chaos scenario '${name}' not found`);
  }
  return scenario;
}