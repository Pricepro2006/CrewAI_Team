/**
 * Comprehensive tests for Three-Phase Email Analysis Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailThreePhaseAnalysisService } from '../EmailThreePhaseAnalysisService.js';
import Database from 'better-sqlite3';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('better-sqlite3');
vi.mock('../../../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}));

// Mock email data
const mockEmail = {
  id: 'test-email-001',
  message_id: 'msg-001',
  subject: 'Urgent: Quote request for 15 ProLiant DL380 servers',
  body: 'We need a quote for 15 ProLiant DL380 Gen10 servers with Windows 2022 licenses. PO #12345678. Need by Friday. Total budget approximately $75,000.',
  sender_email: 'john.doe@keycustomer.com',
  sender_name: 'John Doe',
  recipient_emails: 'sales@tdsynnex.com',
  received_at: '2025-01-28T10:00:00Z',
  importance: 'high',
  has_attachments: false
};

describe('EmailThreePhaseAnalysisService', () => {
  let service: EmailThreePhaseAnalysisService;
  let mockDb: any;
  
  beforeEach(() => {
    // Mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        all: vi.fn().mockReturnValue([])
      }),
      exec: vi.fn(),
      close: vi.fn()
    };
    
    (Database as any).mockReturnValue(mockDb);
    
    // Create service instance
    service = new EmailThreePhaseAnalysisService(':memory:');
    
    // Reset axios mock
    vi.mocked(axios.post).mockReset();
  });
  
  afterEach(async () => {
    await service.shutdown();
    vi.clearAllMocks();
  });
  
  describe('Phase 1: Rule-based Analysis', () => {
    it('should extract entities correctly', async () => {
      // Mock LLM responses for phase 2 and 3
      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: 'Confirmed: Quote Processing',
              missed_entities: {},
              action_items: [],
              risk_assessment: 'High value quote',
              initial_response: 'Thank you for your quote request',
              confidence: 0.85,
              business_process: 'Quote_to_Order'
            })
          }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              strategic_insights: {
                opportunity: 'Large server order',
                risk: 'Time sensitive',
                relationship: 'Key customer'
              },
              executive_summary: 'Urgent quote for major customer',
              escalation_needed: true,
              revenue_impact: '$75,000'
            })
          }
        });
      
      const result = await service.analyzeEmail(mockEmail);
      
      // Verify Phase 1 extraction
      expect(result.entities.po_numbers).toContain('12345678');
      expect(result.entities.dollar_amounts).toContain('$75,000');
      expect(result.entities.part_numbers).toContain('DL380');
      expect(result.workflow_state).toBe('QUOTE_PROCESSING');
      expect(result.priority).toBe('critical');
      expect(result.sender_category).toBe('key_customer');
      expect(result.financial_impact).toBe(75000);
    });
    
    it('should calculate urgency score correctly', async () => {
      const urgentEmail = {
        ...mockEmail,
        body: 'URGENT: Critical request. Need ASAP! This is an emergency escalation.'
      };
      
      // Mock responses
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      const result = await service.analyzeEmail(urgentEmail);
      
      expect(result.urgency_score).toBeGreaterThan(5);
      expect(result.priority).toBe('critical');
    });
    
    it('should detect workflow patterns', async () => {
      const testCases = [
        { body: 'Order completed and shipped', expected: 'COMPLETION' },
        { body: 'Working on your request, will update soon', expected: 'IN_PROGRESS' },
        { body: 'Please provide a quote for', expected: 'QUOTE_PROCESSING' },
        { body: 'I want to place an order', expected: 'ORDER_MANAGEMENT' },
        { body: 'Track my shipment', expected: 'SHIPPING' },
        { body: 'I need to return this item', expected: 'RETURNS' }
      ];
      
      // Mock responses
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      for (const testCase of testCases) {
        const email = { ...mockEmail, body: testCase.body };
        const result = await service.analyzeEmail(email);
        expect(result.workflow_state).toBe(testCase.expected);
      }
    });
  });
  
  describe('Phase 2: LLM Enhancement', () => {
    it('should enhance Phase 1 results with LLM insights', async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: 'Confirmed: Quote Processing with urgency',
              missed_entities: {
                products: ['Windows 2022 licenses'],
                technical_specs: ['Gen10 specification']
              },
              action_items: [
                {
                  task: 'Generate quote for 15 servers',
                  owner: 'Sales Team',
                  deadline: 'Friday 5PM',
                  revenue_impact: '$75,000'
                }
              ],
              risk_assessment: 'High - Large deal at risk if delayed',
              initial_response: 'Thank you for your urgent quote request...',
              confidence: 0.9,
              business_process: 'Quote_to_Order'
            })
          }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: '{}' }
        });
      
      const result = await service.analyzeEmail(mockEmail);
      
      expect(result.workflow_validation).toContain('Confirmed');
      expect(result.missed_entities).toBeDefined();
      expect(result.action_items).toHaveLength(1);
      expect(result.action_items[0].task).toContain('Generate quote');
      expect(result.confidence).toBe(0.9);
      expect(result.business_process).toBe('Quote_to_Order');
    });
    
    it('should handle LLM errors gracefully', async () => {
      // Phase 2 fails, Phase 3 succeeds
      vi.mocked(axios.post)
        .mockRejectedValueOnce(new Error('LLM timeout'))
        .mockResolvedValueOnce({
          status: 200,
          data: { response: '{}' }
        });
      
      const result = await service.analyzeEmail(mockEmail);
      
      // Should still have Phase 1 results
      expect(result.workflow_state).toBeDefined();
      expect(result.entities).toBeDefined();
      
      // Phase 2 should have defaults
      expect(result.confidence).toBe(0.5);
      expect(result.risk_assessment).toContain('rule-based analysis');
    });
  });
  
  describe('Phase 3: Strategic Analysis', () => {
    it('should provide comprehensive strategic insights', async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          status: 200,
          data: { response: '{}' } // Phase 2
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              strategic_insights: {
                opportunity: 'Customer expanding infrastructure - $200k annual potential',
                risk: 'Competitor offering 15% discount - relationship at risk',
                relationship: 'Key stakeholder showing urgency - strengthen partnership',
                competitive: 'Dell mentioned as alternative',
                market: 'Server shortage driving urgency'
              },
              executive_summary: 'Critical $75k quote with expansion potential. Competitor threat. Requires immediate action.',
              escalation_needed: true,
              escalation_details: {
                to_whom: 'VP Sales',
                urgency: 'within 2 hours',
                talking_points: ['Price matching needed', 'Long-term contract opportunity']
              },
              revenue_impact: {
                immediate: '$75,000 within 30 days',
                annual: '$200,000 recurring',
                lifetime: '$1M total opportunity',
                at_risk: '$75,000 if not addressed'
              },
              cross_email_patterns: [
                'Similar server requests from 5 enterprise customers this week',
                'Supply chain constraints affecting delivery times'
              ],
              workflow_intelligence: {
                predicted_next_steps: [
                  'Customer will request financing options',
                  'Installation services will be needed',
                  'Training requirements likely'
                ],
                bottleneck_risks: [
                  'Inventory shortage (70% probability)',
                  'Credit approval for large amount (30% probability)'
                ],
                optimization_opportunities: [
                  'Pre-allocate inventory',
                  'Fast-track credit approval'
                ]
              }
            })
          }
        });
      
      const result = await service.analyzeEmail(mockEmail);
      
      expect(result.strategic_insights).toBeDefined();
      expect(result.strategic_insights.opportunity).toContain('$200k');
      expect(result.strategic_insights.risk).toContain('Competitor');
      expect(result.escalation_needed).toBe(true);
      expect(result.revenue_impact).toContain('$75,000');
      expect(result.workflow_intelligence).toBeDefined();
      expect(result.workflow_intelligence.predicted_next_steps).toHaveLength(3);
    });
  });
  
  describe('Email Processing', () => {
    it('should process all emails through three phases', async () => {
      // Mock all phases
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      const result = await service.analyzeEmail(mockEmail);
      
      // Verify all three phases ran
      expect(result.processing_time).toBeDefined(); // Phase 1
      expect(result.phase2_processing_time).toBeDefined(); // Phase 2
      expect(result.phase3_processing_time).toBeDefined(); // Phase 3
      
      // Verify axios was called twice (Phase 2 and 3)
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
    
    it('should emit correct events during processing', async () => {
      const events: any[] = [];
      
      service.on('phase:start', (data) => events.push({ type: 'start', ...data }));
      service.on('phase:complete', (data) => events.push({ type: 'complete', phase: data.phase }));
      service.on('analysis:complete', (data) => events.push({ type: 'done', email: data.email }));
      
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      await service.analyzeEmail(mockEmail);
      
      // Should have 3 starts, 3 completes, 1 done
      expect(events.filter(e => e.type === 'start')).toHaveLength(3);
      expect(events.filter(e => e.type === 'complete')).toHaveLength(3);
      expect(events.filter(e => e.type === 'done')).toHaveLength(1);
      
      // Verify phase order
      const phaseStarts = events.filter(e => e.type === 'start');
      expect(phaseStarts[0].phase).toBe(1);
      expect(phaseStarts[1].phase).toBe(2);
      expect(phaseStarts[2].phase).toBe(3);
    });
  });
  
  describe('Caching', () => {
    it('should cache Phase 1 results', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      // First call
      await service.analyzeEmail(mockEmail);
      
      // Second call with same email
      await service.analyzeEmail(mockEmail);
      
      // Phase 1 should be cached, so axios still called twice per email
      expect(axios.post).toHaveBeenCalledTimes(4); // 2 calls × 2 emails
    });
  });
  
  describe('Database Storage', () => {
    it('should save analysis results to database', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      await service.analyzeEmail(mockEmail);
      
      // Verify database insert was called
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO email_analysis'));
      expect(mockDb.prepare().run).toHaveBeenCalled();
    });
  });
  
  describe('Batch Processing', () => {
    it('should process multiple emails in batch', async () => {
      const emails = [
        mockEmail,
        { ...mockEmail, id: 'test-email-002' },
        { ...mockEmail, id: 'test-email-003' }
      ];
      
      vi.mocked(axios.post).mockResolvedValue({
        status: 200,
        data: { response: '{}' }
      });
      
      const results = await service.analyzeEmailBatch(emails);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.phase3_processing_time)).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));
      
      const result = await service.analyzeEmail(mockEmail);
      
      // Should still have Phase 1 results
      expect(result.workflow_state).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.priority).toBeDefined();
    });
    
    it('should handle malformed JSON responses', async () => {
      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          status: 200,
          data: { response: 'Invalid JSON {{{' }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: '{}' }
        });
      
      const result = await service.analyzeEmail(mockEmail);
      
      // Should handle gracefully and continue
      expect(result).toBeDefined();
      expect(result.workflow_state).toBeDefined();
    });
  });
  
  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      vi.mocked(axios.post).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              status: 200,
              data: { response: '{}' }
            });
          }, 100); // Simulate 100ms LLM response
        })
      );
      
      const startTime = Date.now();
      await service.analyzeEmail(mockEmail);
      const totalTime = Date.now() - startTime;
      
      // Should complete in under 1 second for test
      expect(totalTime).toBeLessThan(1000);
    });
  });
});