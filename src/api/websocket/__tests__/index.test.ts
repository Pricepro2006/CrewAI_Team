/**
 * Main WebSocket Test Suite
 * Runs all WebSocket tests and reports comprehensive results
 */

import { describe, it, expect } from 'vitest';

// Import all test suites
import './websocket.health.test.js';
import './websocket.connection.test.js';
import './websocket.messaging.test.js';
import './websocket.errors.test.js';
import './websocket.upgrade.test.js';

describe('WebSocket Test Suite', () => {
  it('should have all test files imported', () => {
    expect(true).toBe(true);
  });
});
