import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// 2025 Best Practice: Load Testing with k6 for modern applications

// Custom metrics
const emailLoadTime = new Trend('email_load_time');
const filterResponseTime = new Trend('filter_response_time');
const exportGenerationTime = new Trend('export_generation_time');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '3m', target: 200 },  // Peak load at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    errors: ['rate<0.05'],             // Error rate under 5%
    email_load_time: ['p(90)<2000'],   // 90% load under 2s
    filter_response_time: ['p(90)<1000'], // 90% filter under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Helper function to generate auth token
function getAuthToken() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'test_user',
    password: 'test_password'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return loginRes.json('token');
}

export default function() {
  const token = getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Load Email Dashboard
  const dashboardStart = Date.now();
  const dashboardRes = http.get(`${BASE_URL}/api/emails`, { headers });
  emailLoadTime.add(Date.now() - dashboardStart);
  
  check(dashboardRes, {
    'dashboard loaded successfully': (r) => r.status === 200,
    'emails returned': (r) => JSON.parse(r.body).emails.length > 0,
  });
  
  if (dashboardRes.status !== 200) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  
  sleep(1);

  // Test 2: Apply Filters
  const filterStart = Date.now();
  const filterRes = http.post(`${BASE_URL}/api/emails/filter`, JSON.stringify({
    status: 'pending',
    dateRange: { start: '2025-01-01', end: '2025-01-31' },
    searchTerm: 'urgent'
  }), { headers });
  filterResponseTime.add(Date.now() - filterStart);
  
  check(filterRes, {
    'filter applied successfully': (r) => r.status === 200,
    'filtered results returned': (r) => r.json('filtered') !== undefined,
  });
  
  sleep(0.5);

  // Test 3: Update Email Status (simulating real user action)
  const emails = JSON.parse(dashboardRes.body).emails;
  if (emails && emails.length > 0) {
    const emailId = emails[0].id;
    const updateRes = http.patch(`${BASE_URL}/api/emails/${emailId}/status`, JSON.stringify({
      status: 'in_progress',
      comment: 'Processing email'
    }), { headers });
    
    check(updateRes, {
      'status updated successfully': (r) => r.status === 200,
    });
  }
  
  sleep(1);

  // Test 4: Export Data
  const exportStart = Date.now();
  const exportRes = http.post(`${BASE_URL}/api/emails/export`, JSON.stringify({
    format: 'csv',
    columns: ['emailAlias', 'subject', 'status', 'requestedBy'],
    filters: { status: 'pending' }
  }), { headers });
  exportGenerationTime.add(Date.now() - exportStart);
  
  check(exportRes, {
    'export generated successfully': (r) => r.status === 200,
    'export URL provided': (r) => r.json('exportUrl') !== undefined,
  });
  
  sleep(2);

  // Test 5: Real-time WebSocket Connection (simulated)
  const wsRes = http.get(`${BASE_URL}/api/ws/health`, { headers });
  check(wsRes, {
    'WebSocket endpoint healthy': (r) => r.status === 200,
  });

  // Test 6: Concurrent Operations
  const batch = http.batch([
    ['GET', `${BASE_URL}/api/emails/stats`, null, { headers }],
    ['GET', `${BASE_URL}/api/emails/recent`, null, { headers }],
    ['GET', `${BASE_URL}/api/audit/recent`, null, { headers }],
  ]);
  
  check(batch[0], { 'stats loaded': (r) => r.status === 200 });
  check(batch[1], { 'recent emails loaded': (r) => r.status === 200 });
  check(batch[2], { 'audit trail loaded': (r) => r.status === 200 });
  
  sleep(1);
}

// Stress Test Scenario
export function stressTest() {
  const token = getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Simulate heavy concurrent usage
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(['GET', `${BASE_URL}/api/emails?page=${i}`, null, { headers }]);
  }
  
  const batchRes = http.batch(requests);
  
  batchRes.forEach((res, index) => {
    check(res, {
      [`page ${index} loaded`]: (r) => r.status === 200,
    });
  });
}

// Database Connection Pool Test
export function connectionPoolTest() {
  const token = getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Rapid fire requests to test connection pooling
  for (let i = 0; i < 50; i++) {
    const res = http.get(`${BASE_URL}/api/emails/count`, { headers });
    check(res, {
      'count retrieved': (r) => r.status === 200,
    });
    // No sleep - testing rapid requests
  }
}

// Memory Leak Detection Test
export function memoryTest() {
  const token = getAuthToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Continuously create and destroy large data sets
  for (let i = 0; i < 100; i++) {
    const res = http.get(`${BASE_URL}/api/emails?limit=1000`, { headers });
    check(res, {
      'large dataset loaded': (r) => r.status === 200,
    });
    
    // Force garbage collection simulation
    sleep(0.1);
  }
}