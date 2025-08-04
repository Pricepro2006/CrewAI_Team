/**
 * Comprehensive Tests for Chain Completeness Scoring in EmailChainAnalyzer
 *
 * This test suite validates the gradual scoring system that addresses the critical
 * binary scoring issue where 50% of conversations scored 100% and 50% scored 0%.
 *
 * Tests ensure:
 * - Scores can be anywhere from 0-100% (not just binary)
 * - Single emails never get 100% scores
 * - Long chains can achieve high scores through workflow progression
 * - Gradual scoring based on chain characteristics
 * - Prevention of the 50/50 binary split pattern
 *
 * CRITICAL: These tests prevent regression of the binary scoring bug
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailChainAnalyzer } from "./EmailChainAnalyzer.js";
import Database from "better-sqlite3";

// Create a shared mock db instance that can be accessed in mocks
const mockDbData: any[] = [];

// Global shared mock database instance
const sharedMockDb = {
  prepare: vi.fn().mockImplementation((query: string) => {
    // Create fresh mock implementations for each prepare call
    return {
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockImplementation((id?: string) => {
        if (!mockDbData || mockDbData.length === 0) return null;
        if (id) {
          const found = mockDbData.find((item: any) => item.id === id);
          if (found) {
            return {
              id: found.id,
              internet_message_id: found.message_id || found.internet_message_id,
              subject: found.subject,
              sender_email: found.from_address || found.sender_email,
              recipient_emails: found.to_addresses || found.recipient_emails || '',
              received_date_time: found.received_time || found.received_date_time,
              conversation_id: found.conversation_id || found.thread_id,
              thread_id: found.conversation_id || found.thread_id, // SQL alias maps conversation_id as thread_id
              body_content: found.body_text || found.body_content,
              body: found.body_text || found.body_content // Support both field names
            };
          }
        }
        return null;
      }),
      all: vi.fn().mockImplementation((...params: any[]) => {
        if (!mockDbData) return [];
        
        let filteredData = mockDbData;
        
        if (params.length === 1 && typeof params[0] === "string") {
          // Handle single param queries like conversation_id
          const conversationId = params[0];
          filteredData = mockDbData.filter(
            (email: any) =>
              email.thread_id === conversationId || email.conversation_id === conversationId,
          );
        } else if (params.length === 6) {
          // Handle complex subject + sender matching queries
          // params: [subjectPattern1, subjectPattern2, subjectPattern3, subjectPattern4, senderEmail, senderPattern]
          const [pattern1, pattern2, pattern3, pattern4, senderEmail, senderPattern] = params;
          
          filteredData = mockDbData.filter((email: any) => {
            const subject = email.subject || '';
            const sender = email.from_address || email.sender_email || '';
            
            // Check subject patterns (remove % wildcards for simple matching)
            const subjectMatches = [
              pattern1?.replace(/%/g, ''),
              pattern2?.replace(/%/g, ''),
              pattern3?.replace(/%/g, ''),
              pattern4?.replace(/%/g, '')
            ].some(pattern => {
              if (!pattern) return false;
              return subject.toLowerCase().includes(pattern.toLowerCase());
            });
            
            // Check sender patterns
            const senderMatches = (
              sender === senderEmail ||
              sender.toLowerCase().includes((senderPattern || senderEmail || '').toLowerCase())
            );
            
            return subjectMatches && senderMatches;
          });
        }
        
        // Map results to expected database schema
        return filteredData.map((item: any) => ({
          id: item.id,
          internet_message_id: item.message_id || item.internet_message_id,
          subject: item.subject,
          sender_email: item.from_address || item.sender_email,
          recipient_emails: item.to_addresses || item.recipient_emails || '',
          received_date_time: item.received_time || item.received_date_time,
          conversation_id: item.conversation_id || item.thread_id,
          body_content: item.body_text || item.body_content,
          body: item.body_text || item.body_content // Support both field names
        }));
      }),
    };
  }),
  exec: vi.fn(),
  pragma: vi.fn(),
  close: vi.fn().mockReturnValue(undefined),
};

// Mock the Database constructor from better-sqlite3
vi.mock("better-sqlite3", () => ({
  default: vi.fn().mockImplementation(() => sharedMockDb),
}));

// Test data factory for creating email chains with various completeness levels
const createEmailChain = (scenario: string) => {
  const baseTime = new Date("2024-01-01T10:00:00Z");

  switch (scenario) {
    case "single_email":
      return [
        {
          id: "single-1",
          internet_message_id: "msg-single-1",
          message_id: "msg-single-1",
          subject: "Quote Request for Server Hardware",
          sender_email: "customer@company.com",
          from_address: "customer@company.com",
          to_addresses: "sales@supplier.com",
          recipient_emails: "sales@supplier.com",
          received_date_time: baseTime.toISOString(),
          received_time: baseTime.toISOString(),
          body_content: "We need a quote for 10 server units. Please provide pricing.",
          body_text: "We need a quote for 10 server units. Please provide pricing.",
          conversation_id: "chain-single",
          thread_id: "chain-single",
        },
      ];

    case "incomplete_chain_no_resolution":
      return [
        {
          id: "incomplete-1",
          message_id: "msg-incomplete-1",
          subject: "Urgent: Server Quote Needed",
          from_address: "customer@company.com",
          to_addresses: "sales@supplier.com",
          received_time: baseTime.toISOString(),
          body_text:
            "We urgently need a quote for enterprise servers for our data center expansion.",
          conversation_id: "chain-incomplete",
        },
        {
          id: "incomplete-2",
          message_id: "msg-incomplete-2",
          subject: "RE: Urgent: Server Quote Needed",
          from_address: "sales@supplier.com",
          to_addresses: "customer@company.com",
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(), // +1 hour
          body_text:
            "Thank you for your inquiry. We're working on your quote request.",
          conversation_id: "chain-incomplete",
        },
      ];

    case "moderate_chain_with_progress":
      return [
        {
          id: "moderate-1",
          message_id: "msg-moderate-1",
          subject: "Hardware Quote Request - Quote #123456",
          from_address: "procurement@company.com",
          to_addresses: "sales@supplier.com",
          received_time: baseTime.toISOString(),
          body_text:
            "Please provide quote for 50 HPE ProLiant servers with 3-year support.",
          conversation_id: "chain-moderate",
        },
        {
          id: "moderate-2",
          message_id: "msg-moderate-2",
          subject: "RE: Hardware Quote Request - Quote #123456",
          from_address: "sales@supplier.com",
          to_addresses: "procurement@company.com",
          received_time: new Date(baseTime.getTime() + 7200000).toISOString(), // +2 hours
          body_text:
            "Working on your quote. Technical team is reviewing specifications.",
          conversation_id: "chain-moderate",
        },
        {
          id: "moderate-3",
          message_id: "msg-moderate-3",
          subject: "RE: Hardware Quote Request - Quote #123456",
          from_address: "sales@supplier.com",
          to_addresses: "procurement@company.com",
          received_time: new Date(baseTime.getTime() + 86400000).toISOString(), // +1 day
          body_text:
            "Quote #123456 is ready. Total cost: $2.5M. Please review attached proposal.",
          conversation_id: "chain-moderate",
        },
        {
          id: "moderate-4",
          message_id: "msg-moderate-4",
          subject: "RE: Hardware Quote Request - Quote #123456",
          from_address: "procurement@company.com",
          to_addresses: "sales@supplier.com",
          received_time: new Date(baseTime.getTime() + 172800000).toISOString(), // +2 days
          body_text:
            "Thank you for the quote. We are reviewing with our technical team.",
          conversation_id: "chain-moderate",
        },
      ];

    case "complete_chain_full_workflow":
      return [
        {
          id: "complete-1",
          message_id: "msg-complete-1",
          subject: "RFQ: Data Center Equipment - PO #789012",
          from_address: "buyer@enterprise.com",
          to_addresses: "sales@supplier.com",
          received_time: baseTime.toISOString(),
          body_text:
            "Request for Quote: Need complete data center solution including servers, storage, networking. Budget: $5M.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-2",
          message_id: "msg-complete-2",
          subject: "RE: RFQ: Data Center Equipment - PO #789012",
          from_address: "sales@supplier.com",
          to_addresses: "buyer@enterprise.com",
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(), // +1 hour
          body_text:
            "Received your RFQ. Our technical team is preparing a comprehensive proposal.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-3",
          message_id: "msg-complete-3",
          subject: "RE: RFQ: Data Center Equipment - PO #789012",
          from_address: "technical@supplier.com",
          to_addresses: "buyer@enterprise.com",
          received_time: new Date(baseTime.getTime() + 86400000).toISOString(), // +1 day
          body_text:
            "Technical specifications review complete. Working on pricing with our partners.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-4",
          message_id: "msg-complete-4",
          subject: "RE: RFQ: Data Center Equipment - PO #789012",
          from_address: "sales@supplier.com",
          to_addresses: "buyer@enterprise.com",
          received_time: new Date(baseTime.getTime() + 259200000).toISOString(), // +3 days
          body_text:
            "Complete proposal ready. Quote #789012 total: $4.8M. Includes 5-year support and implementation.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-5",
          message_id: "msg-complete-5",
          subject: "RE: RFQ: Data Center Equipment - PO #789012",
          from_address: "buyer@enterprise.com",
          to_addresses: "sales@supplier.com",
          received_time: new Date(baseTime.getTime() + 432000000).toISOString(), // +5 days
          body_text:
            "Quote approved. Proceeding with PO #789012. Thank you for the comprehensive proposal.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-6",
          message_id: "msg-complete-6",
          subject:
            "RE: RFQ: Data Center Equipment - PO #789012 - Order Confirmed",
          from_address: "sales@supplier.com",
          to_addresses: "buyer@enterprise.com",
          received_time: new Date(baseTime.getTime() + 518400000).toISOString(), // +6 days
          body_text:
            "Order confirmed. Equipment will ship in 4-6 weeks. Project manager assigned for implementation.",
          conversation_id: "chain-complete",
        },
        {
          id: "complete-7",
          message_id: "msg-complete-7",
          subject:
            "RE: RFQ: Data Center Equipment - PO #789012 - Delivery Complete",
          from_address: "fulfillment@supplier.com",
          to_addresses: "buyer@enterprise.com",
          received_time: new Date(
            baseTime.getTime() + 2592000000,
          ).toISOString(), // +30 days
          body_text:
            "Data center equipment delivered and installed successfully. Project completed. Thank you for your business.",
          conversation_id: "chain-complete",
        },
      ];

    case "long_chain_no_resolution":
      return [
        {
          id: "long-1",
          message_id: "msg-long-1",
          subject: "Support Case #555666 - Critical System Issue",
          from_address: "support@customer.com",
          to_addresses: "help@vendor.com",
          received_time: baseTime.toISOString(),
          body_text:
            "Critical: Our production servers are experiencing random crashes. Need immediate assistance.",
          conversation_id: "chain-long",
        },
        {
          id: "long-2",
          message_id: "msg-long-2",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "help@vendor.com",
          to_addresses: "support@customer.com",
          received_time: new Date(baseTime.getTime() + 1800000).toISOString(), // +30 min
          body_text:
            "Case #555666 created. Level 1 support reviewing logs you provided.",
          conversation_id: "chain-long",
        },
        {
          id: "long-3",
          message_id: "msg-long-3",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "support@customer.com",
          to_addresses: "help@vendor.com",
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(), // +1 hour
          body_text:
            "Issue persists. Crashes occurred 3 more times in the last hour. This is affecting production.",
          conversation_id: "chain-long",
        },
        {
          id: "long-4",
          message_id: "msg-long-4",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "help@vendor.com",
          to_addresses: "support@customer.com",
          received_time: new Date(baseTime.getTime() + 5400000).toISOString(), // +1.5 hours
          body_text:
            "Escalating to Level 2. Senior engineer will review hardware diagnostics.",
          conversation_id: "chain-long",
        },
        {
          id: "long-5",
          message_id: "msg-long-5",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "engineer@vendor.com",
          to_addresses: "support@customer.com",
          received_time: new Date(baseTime.getTime() + 7200000).toISOString(), // +2 hours
          body_text:
            "Hardware diagnostics show memory errors. Recommend running memory test on affected servers.",
          conversation_id: "chain-long",
        },
        {
          id: "long-6",
          message_id: "msg-long-6",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "support@customer.com",
          to_addresses: "engineer@vendor.com",
          received_time: new Date(baseTime.getTime() + 10800000).toISOString(), // +3 hours
          body_text:
            "Memory tests completed. Found faulty RAM modules in Server-03 and Server-07.",
          conversation_id: "chain-long",
        },
        {
          id: "long-7",
          message_id: "msg-long-7",
          subject: "RE: Support Case #555666 - Critical System Issue",
          from_address: "engineer@vendor.com",
          to_addresses: "support@customer.com",
          received_time: new Date(baseTime.getTime() + 14400000).toISOString(), // +4 hours
          body_text:
            "RMA process initiated for faulty RAM. Replacement modules will ship overnight.",
          conversation_id: "chain-long",
        },
        // Missing resolution - chain ends without completion
      ];

    case "mixed_participants_chain":
      return [
        {
          id: "mixed-1",
          message_id: "msg-mixed-1",
          subject: "Project Alpha - Server Procurement",
          from_address: "pm@company.com",
          to_addresses: "procurement@company.com",
          received_time: baseTime.toISOString(),
          body_text:
            "Need servers for Project Alpha. Deadline is end of quarter.",
          conversation_id: "chain-mixed",
        },
        {
          id: "mixed-2",
          message_id: "msg-mixed-2",
          subject: "RE: Project Alpha - Server Procurement",
          from_address: "procurement@company.com",
          to_addresses: "sales@supplier.com,pm@company.com",
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(), // +1 hour
          body_text:
            "Forwarding to supplier. PM, please provide detailed specifications.",
          conversation_id: "chain-mixed",
        },
        {
          id: "mixed-3",
          message_id: "msg-mixed-3",
          subject: "RE: Project Alpha - Server Procurement",
          from_address: "sales@supplier.com",
          to_addresses: "procurement@company.com,pm@company.com",
          received_time: new Date(baseTime.getTime() + 7200000).toISOString(), // +2 hours
          body_text:
            "Received your inquiry. Can you provide more details on compute requirements?",
          conversation_id: "chain-mixed",
        },
        {
          id: "mixed-4",
          message_id: "msg-mixed-4",
          subject: "RE: Project Alpha - Server Procurement",
          from_address: "architect@company.com",
          to_addresses:
            "sales@supplier.com,procurement@company.com,pm@company.com",
          received_time: new Date(baseTime.getTime() + 86400000).toISOString(), // +1 day
          body_text:
            "Technical requirements: 64 cores, 512GB RAM, NVMe storage. Need 20 units.",
          conversation_id: "chain-mixed",
        },
      ];

    default:
      return [];
  }
};

describe("EmailChainAnalyzer - Chain Completeness Scoring Tests", () => {
  let analyzer: EmailChainAnalyzer;

  beforeEach(() => {
    // Clear the mockDbData array
    mockDbData.length = 0;
    
    // Reset all mock functions to ensure clean state
    vi.clearAllMocks();
    
    // Ensure prepare mock is properly set up
    sharedMockDb.prepare = vi.fn().mockImplementation((query: string) => {
      return {
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        get: vi.fn().mockImplementation((id?: string) => {
          if (!mockDbData || mockDbData.length === 0) return null;
          if (id) {
            const found = mockDbData.find((item: any) => item.id === id);
            if (found) {
              return {
                id: found.id,
                internet_message_id: found.message_id || found.internet_message_id,
                subject: found.subject,
                sender_email: found.from_address || found.sender_email,
                recipient_emails: found.to_addresses || found.recipient_emails || '',
                received_date_time: found.received_time || found.received_date_time,
                conversation_id: found.conversation_id || found.thread_id,
                thread_id: found.conversation_id || found.thread_id,
                body_content: found.body_text || found.body_content,
                body: found.body_text || found.body_content
              };
            }
          }
          return null;
        }),
        all: vi.fn().mockImplementation((...params: any[]) => {
          if (!mockDbData) return [];
          
          let filteredData = mockDbData;
          
          if (params.length === 1 && typeof params[0] === "string") {
            const conversationId = params[0];
            filteredData = mockDbData.filter(
              (email: any) =>
                email.thread_id === conversationId || email.conversation_id === conversationId,
            );
          } else if (params.length === 6) {
            const [pattern1, pattern2, pattern3, pattern4, senderEmail, senderPattern] = params;
            
            filteredData = mockDbData.filter((email: any) => {
              const subject = email.subject || '';
              const sender = email.from_address || email.sender_email || '';
              
              const subjectMatches = [
                pattern1?.replace(/%/g, ''),
                pattern2?.replace(/%/g, ''),
                pattern3?.replace(/%/g, ''),
                pattern4?.replace(/%/g, '')
              ].some(pattern => {
                if (!pattern) return false;
                return subject.toLowerCase().includes(pattern.toLowerCase());
              });
              
              const senderMatches = sender === senderEmail || 
                (senderPattern && sender.toLowerCase().includes(senderPattern.replace(/%/g, '').toLowerCase()));
              
              return subjectMatches && senderMatches;
            });
          }
          
          return filteredData.map((item: any) => ({
            id: item.id,
            message_id: item.message_id || item.internet_message_id,
            subject: item.subject,
            sender_email: item.from_address || item.sender_email,
            to_addresses: item.to_addresses || item.recipient_emails || '',
            received_at: item.received_time || item.received_date_time,
            conversation_id: item.conversation_id || item.thread_id,
            thread_id: item.conversation_id || item.thread_id,
            body_text: item.body_text || item.body_content,
            body: item.body_text || item.body_content,
            workflow_state: item.workflow_state || 'pending'
          }));
        })
      };
    });
    
    // Create new analyzer instance with mock database
    analyzer = new EmailChainAnalyzer(":memory:", sharedMockDb);
  });

  afterEach(() => {
    // Clean up after each test
    mockDbData.length = 0;
  });

  describe("Gradual Scoring System (0-100%)", () => {
    it("should assign low scores (0-30%) to single emails", async () => {
      const singleEmailChain = createEmailChain("single_email");
      mockDbData.length = 0;
      mockDbData.push(...singleEmailChain);

      const analysis = await analyzer.analyzeChain("single-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(0);
      expect(analysis.completeness_score).toBeLessThanOrEqual(30);
      expect(analysis.chain_length).toBe(1);
      expect(analysis.is_complete).toBe(false);
      expect(analysis.missing_elements).toContain(
        "Multiple emails for context",
      );
    });

    it("should assign moderate scores (30-60%) to incomplete chains", async () => {
      const incompleteChain = createEmailChain(
        "incomplete_chain_no_resolution",
      );
      mockDbData.length = 0;
      mockDbData.push(...incompleteChain);

      const analysis = await analyzer.analyzeChain("incomplete-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(30);
      expect(analysis.completeness_score).toBeLessThanOrEqual(60);
      expect(analysis.chain_length).toBe(2);
      expect(analysis.is_complete).toBe(false);
      expect(analysis.missing_elements).toContain(
        "Completion/resolution confirmation",
      );
    });

    it("should assign good scores (60-80%) to chains with progress but no resolution", async () => {
      const moderateChain = createEmailChain("moderate_chain_with_progress");
      mockDbData.length = 0;
      mockDbData.push(...moderateChain);

      const analysis = await analyzer.analyzeChain("moderate-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(60);
      expect(analysis.completeness_score).toBeLessThanOrEqual(80);
      expect(analysis.chain_length).toBe(4);
      expect(analysis.is_complete).toBe(false); // No completion signal despite good score
      expect(analysis.has_start_point).toBe(true);
      expect(analysis.has_middle_correspondence).toBe(true);
      expect(analysis.has_completion).toBe(false); // No resolution in the chain
    });

    it("should assign high scores (80-100%) to complete workflow chains", async () => {
      const completeChain = createEmailChain("complete_chain_full_workflow");
      mockDbData.length = 0;
      mockDbData.push(...completeChain);

      const analysis = await analyzer.analyzeChain("complete-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(80);
      expect(analysis.completeness_score).toBeLessThanOrEqual(100);
      expect(analysis.chain_length).toBe(7);
      expect(analysis.is_complete).toBe(true);
      expect(analysis.has_start_point).toBe(true);
      expect(analysis.has_middle_correspondence).toBe(true);
      expect(analysis.has_completion).toBe(true);
      expect(analysis.missing_elements).toHaveLength(0);
    });

    it("should handle long chains without resolution (medium-high scores)", async () => {
      const longChain = createEmailChain("long_chain_no_resolution");
      mockDbData.length = 0;
      mockDbData.push(...longChain);

      const analysis = await analyzer.analyzeChain("long-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(50);
      expect(analysis.completeness_score).toBeLessThanOrEqual(75);
      expect(analysis.chain_length).toBe(7);
      expect(analysis.is_complete).toBe(false); // No resolution
      expect(analysis.has_start_point).toBe(true);
      expect(analysis.has_middle_correspondence).toBe(true);
      expect(analysis.has_completion).toBe(false);
    });
  });

  describe("Scoring Components Validation", () => {
    it("should give base points for start point detection", async () => {
      const chains = [
        createEmailChain("single_email"),
        createEmailChain("incomplete_chain_no_resolution"),
        createEmailChain("complete_chain_full_workflow"),
      ];

      for (const chain of chains) {
        mockDbData.length = 0;
        mockDbData.push(...chain);
        const analysis = await analyzer.analyzeChain(chain[0].id);

        expect(analysis.has_start_point).toBe(true);
        expect(analysis.completeness_score).toBeGreaterThanOrEqual(30); // Base points for start
      }
    });

    it("should award points for middle correspondence", async () => {
      const moderateChain = createEmailChain("moderate_chain_with_progress");
      mockDbData.length = 0;
      mockDbData.push(...moderateChain);

      const analysis = await analyzer.analyzeChain("moderate-1");

      expect(analysis.has_middle_correspondence).toBe(true);
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(60); // Start + Middle points
    });

    it("should award maximum points for completion detection", async () => {
      const completeChain = createEmailChain("complete_chain_full_workflow");
      mockDbData.length = 0;
      mockDbData.push(...completeChain);

      const analysis = await analyzer.analyzeChain("complete-1");

      expect(analysis.has_completion).toBe(true);
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(85); // All base points
    });

    it("should award bonus points for chain length", async () => {
      const longChain = createEmailChain("long_chain_no_resolution");
      const shortChain = createEmailChain("incomplete_chain_no_resolution");

      // Test long chain
      mockDbData.length = 0;
      mockDbData.push(...longChain);
      const longAnalysis = await analyzer.analyzeChain("long-1");

      // Test short chain
      mockDbData.length = 0;
      mockDbData.push(...shortChain);
      const shortAnalysis = await analyzer.analyzeChain("incomplete-1");

      expect(longAnalysis.completeness_score).toBeGreaterThan(
        shortAnalysis.completeness_score,
      );
      expect(longAnalysis.chain_length).toBeGreaterThan(
        shortAnalysis.chain_length,
      );
    });

    it("should penalize single emails appropriately", async () => {
      const singleChain = createEmailChain("single_email");
      mockDbData.length = 0;
      mockDbData.push(...singleChain);

      const analysis = await analyzer.analyzeChain("single-1");

      expect(analysis.completeness_score).toBeLessThanOrEqual(30); // Should be penalized
      expect(analysis.missing_elements).toContain(
        "Multiple emails for context",
      );
    });
  });

  describe("Chain Type Specific Scoring", () => {
    it("should apply quote-specific scoring rules", async () => {
      const quoteChain = [
        {
          id: "quote-1",
          message_id: "msg-quote-1",
          subject: "Quote Request - Quote #987654",
          from_address: "buyer@company.com",
          to_addresses: "sales@vendor.com",
          received_time: new Date().toISOString(),
          body_text:
            "Please provide quote #987654 for 20 HPE servers with support.",
          conversation_id: "quote-chain",
        },
        {
          id: "quote-2",
          message_id: "msg-quote-2",
          subject: "RE: Quote Request - Quote #987654",
          from_address: "sales@vendor.com",
          to_addresses: "buyer@company.com",
          received_time: new Date(Date.now() + 3600000).toISOString(),
          body_text:
            "Working on quote #987654. Will have pricing ready shortly.",
          conversation_id: "quote-chain",
        },
      ];

      mockDbData.length = 0;
      mockDbData.push(...quoteChain);
      const analysis = await analyzer.analyzeChain("quote-1");

      expect(analysis.chain_type).toBe("quote_request");
      expect(analysis.key_entities.quote_numbers).toContain("987654");
      // Should not be penalized for missing quote number since it has one
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(40);
    });

    it("should apply order-specific scoring rules", async () => {
      const orderChain = [
        {
          id: "order-1",
          message_id: "msg-order-1",
          subject: "New Order - PO #456789",
          from_address: "procurement@company.com",
          to_addresses: "orders@vendor.com",
          received_time: new Date().toISOString(),
          body_text: "Placing order with PO #456789. Please confirm receipt.",
          conversation_id: "order-chain",
        },
        {
          id: "order-2",
          message_id: "msg-order-2",
          subject: "RE: New Order - PO #456789",
          from_address: "orders@vendor.com",
          to_addresses: "procurement@company.com",
          received_time: new Date(Date.now() + 1800000).toISOString(),
          body_text: "Order received for PO #456789. Processing now.",
          conversation_id: "order-chain",
        },
      ];

      mockDbData.length = 0;
      mockDbData.push(...orderChain);
      const analysis = await analyzer.analyzeChain("order-1");

      expect(analysis.chain_type).toBe("order_processing");
      expect(analysis.key_entities.po_numbers).toContain("456789");
      // Should not be penalized since it has PO number
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(40);
    });
  });

  describe("Workflow State Detection", () => {
    it("should detect completion signals correctly", async () => {
      const completionChain = [
        {
          id: "comp-1",
          message_id: "msg-comp-1",
          subject: "Order Status Update",
          from_address: "customer@company.com",
          to_addresses: "support@vendor.com",
          received_time: new Date().toISOString(),
          body_text: "What's the status of our recent order?",
          conversation_id: "completion-chain",
        },
        {
          id: "comp-2",
          message_id: "msg-comp-2",
          subject: "RE: Order Status Update",
          from_address: "support@vendor.com",
          to_addresses: "customer@company.com",
          received_time: new Date(Date.now() + 3600000).toISOString(),
          body_text:
            "Your order has been completed and shipped. Tracking number: ABC123. Thank you for your business.",
          conversation_id: "completion-chain",
        },
      ];

      mockDbData.length = 0;
      mockDbData.push(...completionChain);
      const analysis = await analyzer.analyzeChain("comp-1");

      expect(analysis.has_completion).toBe(true);
      expect(analysis.workflow_states).toContain("COMPLETION");
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(70); // Should get completion bonus
    });

    it("should detect in-progress signals", async () => {
      const progressChain = [
        {
          id: "prog-1",
          message_id: "msg-prog-1",
          subject: "Project Update Request",
          from_address: "pm@company.com",
          to_addresses: "team@vendor.com",
          received_time: new Date().toISOString(),
          body_text: "Can you provide an update on the project status?",
          conversation_id: "progress-chain",
        },
        {
          id: "prog-2",
          message_id: "msg-prog-2",
          subject: "RE: Project Update Request",
          from_address: "team@vendor.com",
          to_addresses: "pm@company.com",
          received_time: new Date(Date.now() + 7200000).toISOString(),
          body_text:
            "Project is in progress. We're currently working on phase 2 implementation.",
          conversation_id: "progress-chain",
        },
      ];

      mockDbData.length = 0;
      mockDbData.push(...progressChain);
      const analysis = await analyzer.analyzeChain("prog-1");

      expect(analysis.has_middle_correspondence).toBe(true);
      expect(analysis.workflow_states).toContain("IN_PROGRESS");
    });
  });

  describe("Anti-Binary Scoring Regression Tests", () => {
    it("should never produce only 0% and 100% scores across varied chains", async () => {
      const testScenarios = [
        "single_email",
        "incomplete_chain_no_resolution",
        "moderate_chain_with_progress",
        "complete_chain_full_workflow",
        "long_chain_no_resolution",
        "mixed_participants_chain",
      ];

      const scores: number[] = [];

      for (const scenario of testScenarios) {
        const chain = createEmailChain(scenario);
        if (chain.length > 0) {
          mockDbData.length = 0;
          mockDbData.push(...chain);
          const analysis = await analyzer.analyzeChain(chain[0].id);
          scores.push(analysis.completeness_score);
        }
      }

      // Verify we have scores across the range, not just 0 and 100
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeGreaterThan(2); // More than just 0 and 100

      // Check for scores in different ranges
      const hasLowScores = scores.some((score) => score > 0 && score < 40);
      const hasMidRangeScores = scores.some(
        (score) => score >= 40 && score < 70,
      );
      const hasHighScores = scores.some((score) => score >= 70 && score < 100);

      expect(hasLowScores || hasMidRangeScores || hasHighScores).toBe(true);

      // Ensure no score is exactly 0 or 100 for these test cases
      const noExtremeScores = scores.every((score) => score > 0 && score < 100);
      expect(noExtremeScores).toBe(true);
    });

    it("should produce distributed scores across 10 similar incomplete chains", async () => {
      const scores: number[] = [];

      // Create 10 variations of incomplete chains
      for (let i = 0; i < 10; i++) {
        const baseChain = createEmailChain("incomplete_chain_no_resolution");
        // Slightly modify each chain
        const modifiedChain = baseChain.map((email, index) => ({
          ...email,
          id: `test-${i}-${index}`,
          conversation_id: `chain-test-${i}`,
          body_text: email.body_text + ` Variation ${i + 1}.`,
        }));

        mockDbData.length = 0;
        mockDbData.push(...modifiedChain);
        const analysis = await analyzer.analyzeChain(`test-${i}-0`);
        scores.push(analysis.completeness_score);
      }

      // Should not have exactly 50% at one score and 50% at another
      const scoreCounts = scores.reduce(
        (acc, score) => {
          acc[score] = (acc[score] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );

      const maxCount = Math.max(...Object.values(scoreCounts));
      const totalScores = scores.length;

      // No single score should represent exactly 50% of results
      expect(maxCount / totalScores).not.toBe(0.5);

      // Should have reasonable distribution
      expect(Object.keys(scoreCounts).length).toBeGreaterThan(1);
    });

    it("should ensure single emails never get 100% scores", async () => {
      const singleEmailVariations = [
        {
          id: "single-urgent",
          subject: "URGENT: Critical Server Failure",
          body_text:
            "Our production server has failed. Need immediate assistance with quote for replacement.",
        },
        {
          id: "single-large-order",
          subject: "Large Order Request - $1M Budget",
          body_text:
            "We have $1M budget for data center equipment. Please provide comprehensive quote.",
        },
        {
          id: "single-vip",
          subject: "VIP Customer - Enterprise Quote Request",
          body_text:
            "This is from our top customer requesting enterprise-level equipment quote.",
        },
      ];

      for (const variation of singleEmailVariations) {
        const singleChain = [
          {
            id: variation.id,
            message_id: `msg-${variation.id}`,
            subject: variation.subject,
            from_address: "vip@company.com",
            to_addresses: "sales@vendor.com",
            received_time: new Date().toISOString(),
            body_text: variation.body_text,
            conversation_id: `chain-${variation.id}`,
          },
        ];

        mockDbData.length = 0;
        mockDbData.push(...singleChain);
        const analysis = await analyzer.analyzeChain(variation.id);

        expect(analysis.completeness_score).toBeLessThan(100);
        expect(analysis.completeness_score).toBeLessThanOrEqual(30); // Single emails should be low-scored
        expect(analysis.chain_length).toBe(1);
        expect(analysis.is_complete).toBe(false);
      }
    });

    it("should ensure long chains can achieve high scores without being 100%", async () => {
      const completeChain = createEmailChain("complete_chain_full_workflow");
      mockDbData.length = 0;
      mockDbData.push(...completeChain);

      const analysis = await analyzer.analyzeChain("complete-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(80);
      expect(analysis.completeness_score).toBeLessThanOrEqual(100);
      expect(analysis.chain_length).toBeGreaterThan(5);
      expect(analysis.is_complete).toBe(true);

      // Even complete chains might not be perfect 100% due to various factors
      if (analysis.completeness_score === 100) {
        // If it is 100%, it should have no missing elements
        expect(analysis.missing_elements).toHaveLength(0);
      }
    });
  });

  describe("Edge Cases and Validation", () => {
    it("should handle empty chains gracefully", async () => {
      mockDbData.length = 0;

      const analysis = await analyzer.analyzeChain("nonexistent");

      expect(analysis.completeness_score).toBe(0);
      expect(analysis.chain_length).toBe(0);
      expect(analysis.is_complete).toBe(false);
      expect(analysis.missing_elements).toContain("No emails found");
    });

    it("should handle chains with missing data", async () => {
      const incompleteDataChain = [
        {
          id: "incomplete-data-1",
          message_id: "msg-incomplete-1",
          subject: null, // Missing subject
          from_address: "test@example.com",
          to_addresses: null, // Missing recipients
          received_time: new Date().toISOString(),
          body_text: "Some body text",
          conversation_id: "incomplete-data-chain",
        },
      ];

      mockDbData.length = 0;
      mockDbData.push(...incompleteDataChain);
      const analysis = await analyzer.analyzeChain("incomplete-data-1");

      expect(analysis.completeness_score).toBeGreaterThanOrEqual(0);
      expect(analysis.completeness_score).toBeLessThanOrEqual(100);
      expect(analysis.chain_length).toBe(1);
    });

    it("should handle very long chains appropriately", async () => {
      // Create a 15-email chain
      const veryLongChain = Array.from({ length: 15 }, (_, i) => ({
        id: `long-${i + 1}`,
        message_id: `msg-long-${i + 1}`,
        subject: `Long Discussion Thread - Message ${i + 1}`,
        from_address:
          i % 2 === 0 ? "customer@company.com" : "support@vendor.com",
        to_addresses:
          i % 2 === 0 ? "support@vendor.com" : "customer@company.com",
        received_time: new Date(Date.now() + i * 3600000).toISOString(),
        body_text: `This is message ${i + 1} in a very long email chain discussion.`,
        conversation_id: "very-long-chain",
      }));

      mockDbData.length = 0;
      mockDbData.push(...veryLongChain);
      const analysis = await analyzer.analyzeChain("long-1");

      expect(analysis.chain_length).toBe(15);
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(0);
      expect(analysis.completeness_score).toBeLessThanOrEqual(100);
      // Long chains should get bonus points but might still lack completion
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Performance and Consistency", () => {
    it("should produce consistent scores for identical chains", async () => {
      const testChain = createEmailChain("moderate_chain_with_progress");

      const scores: number[] = [];

      // Run same analysis multiple times
      for (let i = 0; i < 5; i++) {
        mockDbData.length = 0;
        mockDbData.push(...testChain);
        const analysis = await analyzer.analyzeChain("moderate-1");
        scores.push(analysis.completeness_score);
      }

      // All scores should be identical
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBe(1);
    });

    it("should complete analysis within reasonable time", async () => {
      const largeChain = createEmailChain("complete_chain_full_workflow");
      mockDbData.length = 0;
      mockDbData.push(...largeChain);

      const startTime = Date.now();
      const analysis = await analyzer.analyzeChain("complete-1");
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(analysis.completeness_score).toBeDefined();
    });
  });

  describe("Statistical Distribution Validation", () => {
    it("should produce reasonable score distribution across diverse scenarios", async () => {
      const scenarios = [
        "single_email",
        "incomplete_chain_no_resolution",
        "moderate_chain_with_progress",
        "complete_chain_full_workflow",
        "long_chain_no_resolution",
        "mixed_participants_chain",
      ];

      const allScores: number[] = [];

      // Run each scenario multiple times with variations
      for (const scenario of scenarios) {
        for (let variation = 0; variation < 3; variation++) {
          const chain = createEmailChain(scenario);
          if (chain.length > 0) {
            // Add variation to avoid identical chains
            const variedChain = chain.map((email, index) => ({
              ...email,
              id: `${email.id}-var-${variation}`,
              body_text: `${email.body_text} Variation ${variation}.`,
              conversation_id: `${email.conversation_id}-var-${variation}`,
            }));

            mockDbData.length = 0;
            mockDbData.push(...variedChain);
            const analysis = await analyzer.analyzeChain(variedChain[0].id);
            allScores.push(analysis.completeness_score);
          }
        }
      }

      // Statistical validation
      expect(allScores.length).toBeGreaterThan(10);

      // Calculate basic statistics
      const average =
        allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
      const min = Math.min(...allScores);
      const max = Math.max(...allScores);

      expect(average).toBeGreaterThan(0);
      expect(average).toBeLessThan(100);
      expect(max - min).toBeGreaterThan(20); // Should have range > 20 points

      // Should not have binary distribution (all scores at two values)
      const uniqueScores = new Set(allScores);
      expect(uniqueScores.size).toBeGreaterThan(2);
    });
  });
});
