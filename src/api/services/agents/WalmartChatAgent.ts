import { logger } from "../../utils/logger.js";
import { WalmartAgentOrchestrator } from "../walmart/WalmartAgentOrchestrator.js";
import type { 
  ProcessMessageRequest, 
  ProcessMessageResponse,
  GroceryList,
  Deal,
  MatchedProduct 
} from "../walmart/types.js";

/**
 * WalmartChatAgent - Legacy wrapper for the new microservices architecture
 * 
 * This class now acts as a thin wrapper around WalmartAgentOrchestrator,
 * maintaining backward compatibility while using the new microservices design.
 * 
 * The original 1181-line monolithic class has been refactored into focused services:
 * - NLPParsingService: Natural language understanding
 * - ProductMatchingService: Product discovery and matching
 * - PriceCalculationService: Pricing logic and calculations
 * - DealDetectionService: Deal discovery and application
 * - SessionManagementService: Conversation context management
 * - WalmartPreferenceLearningService: Enhanced preference handling
 * - WalmartAgentOrchestrator: Service coordination
 * 
 * Benefits of the new architecture:
 * - Single responsibility principle for each service
 * - Dependency injection instead of singletons
 * - Request-scoped context management
 * - Memory leak prevention with proper cleanup
 * - Better testability and maintainability
 * 
 * @deprecated Direct usage discouraged - use WalmartAgentOrchestrator for new code
 */
export class WalmartChatAgent {
  private static instance: WalmartChatAgent;
  private orchestrator: WalmartAgentOrchestrator;

  private constructor() {
    // Initialize the new orchestrator with all services
    this.orchestrator = new WalmartAgentOrchestrator();
    
    logger.info("WalmartChatAgent initialized with new microservices architecture", {
      services: [
        "NLPParsingService",
        "ProductMatchingService", 
        "PriceCalculationService",
        "DealDetectionService",
        "SessionManagementService",
        "WalmartPreferenceLearningService",
        "WalmartAgentOrchestrator"
      ]
    });
  }

  static getInstance(): WalmartChatAgent {
    if (!WalmartChatAgent.instance) {
      WalmartChatAgent.instance = new WalmartChatAgent();
    }
    return WalmartChatAgent.instance;
  }

  /**
   * Process a chat message and handle grocery list building with live pricing
   * 
   * This method maintains backward compatibility with the original API while
   * delegating to the new microservices architecture internally.
   * 
   * @deprecated Use WalmartAgentOrchestrator.processMessage for new implementations
   */
  async processMessage(
    conversationId: string,
    userId: string,
    message: string,
    location?: { zipCode: string; city: string; state: string }
  ): Promise<{
    response: string;
    list?: GroceryList;
    suggestions?: string[];
    deals?: Deal[];
    alternatives?: MatchedProduct[];
  }> {
    try {
      const request: ProcessMessageRequest = {
        conversationId,
        userId,
        message,
        location
      };

      const result = await this?.orchestrator?.processMessage(request);
      
      // Map response to legacy format for backward compatibility
      return {
        response: result.response,
        list: result.list,
        suggestions: result.suggestions,
        deals: result.deals,
        alternatives: result.alternatives
      };
    } catch (error) {
      logger.error("WalmartChatAgent processMessage error", { error, conversationId });
      return {
        response: "I'm sorry, I encountered an error processing your message. Please try again."
      };
    }
  }

  /**
   * Handle deal interaction (accept/reject deals)
   * 
   * @deprecated Use WalmartAgentOrchestrator.handleDealInteraction for new implementations
   */
  async handleDealInteraction(
    conversationId: string,
    userId: string,
    dealId: string,
    action: 'accept' | 'reject',
    reason?: string
  ): Promise<string> {
    try {
      return await this?.orchestrator?.handleDealInteraction(
        conversationId,
        userId,
        dealId,
        action,
        reason
      );
    } catch (error) {
      logger.error("WalmartChatAgent handleDealInteraction error", { error, dealId });
      return "Sorry, I had trouble processing that deal interaction. Please try again.";
    }
  }

  /**
   * Learn from purchase completion
   * 
   * @deprecated Use WalmartAgentOrchestrator.completePurchase for new implementations
   */
  async completePurchase(
    conversationId: string,
    userId: string,
    purchaseDetails: {
      totalAmount: number;
      items: Array<{ productId: string; quantity: number; price: number }>;
      paymentMethod?: string;
    }
  ): Promise<void> {
    try {
      await this?.orchestrator?.completePurchase(
        conversationId,
        userId,
        purchaseDetails
      );
    } catch (error) {
      logger.error("WalmartChatAgent completePurchase error", { error, userId });
    }
  }

  /**
   * Get user preference summary for external systems
   * 
   * @deprecated Use WalmartAgentOrchestrator.getUserPreferences for new implementations
   */
  async getUserPreferences(userId: string) {
    try {
      return await this?.orchestrator?.getUserPreferences(userId);
    } catch (error) {
      logger.error("WalmartChatAgent getUserPreferences error", { error, userId });
      return null;
    }
  }

  /**
   * Clear conversation context
   * 
   * @deprecated Use WalmartAgentOrchestrator.clearConversation for new implementations
   */
  clearConversation(conversationId: string): void {
    try {
      this?.orchestrator?.clearConversation(conversationId);
    } catch (error) {
      logger.error("WalmartChatAgent clearConversation error", { error, conversationId });
    }
  }

  /**
   * Get the underlying orchestrator instance
   * 
   * This method provides access to the new orchestrator for migration purposes.
   * New code should use WalmartAgentOrchestrator directly instead of this wrapper.
   * 
   * @internal For migration and advanced usage only
   */
  getOrchestrator(): WalmartAgentOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get service health status
   * 
   * Provides health information for all underlying microservices.
   */
  getHealthStatus() {
    try {
      return this?.orchestrator?.getHealthStatus();
    } catch (error) {
      logger.error("WalmartChatAgent getHealthStatus error", { error });
      return {
        status: 'unhealthy' as const,
        services: {},
        sessionStats: { activeSessions: 0, totalSessions: 0, averageSessionAge: 0 }
      };
    }
  }

  /**
   * Shutdown cleanup
   * 
   * Properly cleans up all resources and stops background processes.
   */
  shutdown(): void {
    try {
      this?.orchestrator?.shutdown();
      logger.info("WalmartChatAgent shutdown completed");
    } catch (error) {
      logger.error("WalmartChatAgent shutdown error", { error });
    }
  }
}