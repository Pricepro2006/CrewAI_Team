/**
 * Tests for Email Status Validation
 */

import { describe, it, expect } from 'vitest';
import {
  DatabaseEmailStatusSchema,
  DatabaseWorkflowStateSchema,
  ApplicationEmailStatusSchema,
  validateDatabaseEmailRecord,
  validateAPIEmailResponse,
  isDatabaseEmailStatus,
  isDatabaseWorkflowState,
  sanitizeEmailRecord,
} from '../email-status-validator.js';

describe('Email Status Validators', () => {
  describe('DatabaseEmailStatusSchema', () => {
    it('should validate correct database statuses', () => {
      const validStatuses = [
        'pending',
        'imported',
        'analyzed',
        'phase1_complete',
        'phase2_complete',
        'phase3_complete',
        'failed',
        'error',
        'active'
      ];

      validStatuses.forEach(status => {
        expect(() => DatabaseEmailStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should reject invalid database statuses', () => {
      const invalidStatuses = ['new', 'processing', 'completed', 'unknown', '', null, undefined];

      invalidStatuses.forEach(status => {
        expect(() => DatabaseEmailStatusSchema.parse(status)).toThrow();
      });
    });
  });

  describe('DatabaseWorkflowStateSchema', () => {
    it('should validate correct workflow states', () => {
      const validStates = [
        'START_POINT',
        'IN_PROGRESS',
        'COMPLETION',
        'pending',
        'in_progress',
        'completed',
        'error'
      ];

      validStates.forEach(state => {
        expect(() => DatabaseWorkflowStateSchema.parse(state)).not.toThrow();
      });
    });

    it('should reject invalid workflow states', () => {
      const invalidStates = ['STARTING', 'PROGRESSING', 'DONE', '', null, undefined];

      invalidStates.forEach(state => {
        expect(() => DatabaseWorkflowStateSchema.parse(state)).toThrow();
      });
    });
  });

  describe('validateDatabaseEmailRecord', () => {
    it('should validate a correct email record', () => {
      const validRecord = {
        id: 'email_123',
        status: 'analyzed',
        workflow_state: 'COMPLETION',
        priority: 'high',
        confidence_score: 0.85,
        subject: 'Test Email',
        sender_email: 'test@example.com',
        received_date_time: '2024-01-15T10:00:00Z',
        body_content: 'Email body',
        has_attachments: true,
        extracted_entities: JSON.stringify({ entities: [] }),
        chain_completeness_score: 0.9,
        is_chain_complete: true,
      };

      expect(() => validateDatabaseEmailRecord(validRecord)).not.toThrow();
    });

    it('should reject invalid email records', () => {
      const invalidRecord = {
        id: 'email_123',
        status: 'invalid_status', // Invalid status
        workflow_state: 'COMPLETION',
        priority: 'high',
      };

      expect(() => validateDatabaseEmailRecord(invalidRecord)).toThrow(/Invalid email record/);
    });
  });

  describe('Type Guards', () => {
    describe('isDatabaseEmailStatus', () => {
      it('should return true for valid statuses', () => {
        expect(isDatabaseEmailStatus('pending')).toBe(true);
        expect(isDatabaseEmailStatus('analyzed')).toBe(true);
        expect(isDatabaseEmailStatus('phase1_complete')).toBe(true);
      });

      it('should return false for invalid statuses', () => {
        expect(isDatabaseEmailStatus('new')).toBe(false);
        expect(isDatabaseEmailStatus('')).toBe(false);
        expect(isDatabaseEmailStatus(null)).toBe(false);
        expect(isDatabaseEmailStatus(undefined)).toBe(false);
      });
    });

    describe('isDatabaseWorkflowState', () => {
      it('should return true for valid states', () => {
        expect(isDatabaseWorkflowState('START_POINT')).toBe(true);
        expect(isDatabaseWorkflowState('IN_PROGRESS')).toBe(true);
        expect(isDatabaseWorkflowState('COMPLETION')).toBe(true);
      });

      it('should return false for invalid states', () => {
        expect(isDatabaseWorkflowState('STARTING')).toBe(false);
        expect(isDatabaseWorkflowState('')).toBe(false);
        expect(isDatabaseWorkflowState(null)).toBe(false);
      });
    });
  });

  describe('sanitizeEmailRecord', () => {
    it('should convert numeric booleans to boolean values', () => {
      const rawRecord = {
        id: 'email_123',
        status: 'analyzed',
        workflow_state: 'COMPLETION',
        priority: 'medium',
        subject: 'Test',
        sender_email: 'test@example.com',
        received_date_time: '2024-01-15T10:00:00Z',
        has_attachments: 1, // Numeric boolean
        is_chain_complete: 0, // Numeric boolean
      };

      const sanitized = sanitizeEmailRecord(rawRecord);
      expect(sanitized.has_attachments).toBe(true);
      expect(sanitized.is_chain_complete).toBe(false);
    });

    it('should preserve existing boolean values', () => {
      const rawRecord = {
        id: 'email_123',
        status: 'analyzed',
        workflow_state: 'COMPLETION',
        priority: 'medium',
        subject: 'Test',
        sender_email: 'test@example.com',
        received_date_time: '2024-01-15T10:00:00Z',
        has_attachments: true,
        is_chain_complete: false,
      };

      const sanitized = sanitizeEmailRecord(rawRecord);
      expect(sanitized.has_attachments).toBe(true);
      expect(sanitized.is_chain_complete).toBe(false);
    });
  });
});