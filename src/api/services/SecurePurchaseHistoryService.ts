/**
 * Secure Purchase History Service
 * Implements field-level encryption and comprehensive audit logging
 * Ensures PCI DSS compliance for payment data
 */

import { PurchaseHistoryService } from "./PurchaseHistoryService.js";
import { DataEncryptionService } from "../../database/security/DataEncryption.js";
import { AuditLogger, PIIRedactor } from "../middleware/security/enhanced-security.js";
import { logger } from "../../utils/logger.js";
import type { 
  PurchaseRecord, 
  PurchaseFilters, 
  PurchasePattern,
  ReorderSuggestion,
  ProductFrequency,
  PurchaseAnalytics 
} from "./PurchaseHistoryService.js";

/**
 * Secure wrapper for PurchaseHistoryService with encryption and audit logging
 */
export class SecurePurchaseHistoryService {
  private static secureInstance: SecurePurchaseHistoryService;
  private encryption: DataEncryptionService;
  private purchaseService: PurchaseHistoryService;

  private constructor() {
    this.purchaseService = PurchaseHistoryService.getInstance();
    this.encryption = DataEncryptionService.getInstance();
  }

  static getInstance(): SecurePurchaseHistoryService {
    if (!SecurePurchaseHistoryService.secureInstance) {
      SecurePurchaseHistoryService.secureInstance = new SecurePurchaseHistoryService();
    }
    return SecurePurchaseHistoryService.secureInstance;
  }

  /**
   * Track purchase with encryption and audit logging
   */
  async trackPurchase(
    purchase: Omit<PurchaseRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PurchaseRecord> {
    try {
      // Audit the purchase tracking attempt
      await AuditLogger.logSecurityEvent({
        action: "track_purchase",
        userId: purchase.userId,
        success: true,
        metadata: {
          category: purchase.category,
          amount: purchase.totalPrice,
          // Don't log sensitive data
          storeId: purchase.storeId,
        },
      });

      // Encrypt sensitive fields before storage
      const encryptedPurchase = {
        ...purchase,
        paymentMethod: purchase.paymentMethod 
          ? this.encryption.encryptPaymentMethod(purchase.paymentMethod) as PurchaseRecord["paymentMethod"]
          : undefined,
        // Tokenize rather than encrypt for better security
        sessionId: purchase.sessionId 
          ? this.encryption.tokenize(purchase.sessionId, "sess")
          : undefined,
      };

      // Call delegate method with encrypted data
      const result = await this.purchaseService.trackPurchase(encryptedPurchase);

      // Decrypt for response (but mask sensitive data)
      const decryptedResult = {
        ...result,
        paymentMethod: purchase.paymentMethod 
          ? this.maskPaymentMethod(purchase.paymentMethod)
          : undefined,
        sessionId: "[TOKENIZED]",
      };

      logger.info("Secure purchase tracked", "SECURE_PURCHASE", {
        purchaseId: result.id,
        userId: purchase.userId,
        encrypted: true,
      });

      return decryptedResult as PurchaseRecord;
    } catch (error) {
      await AuditLogger.logSecurityEvent({
        action: "track_purchase_failed",
        userId,
        result: "FAILURE",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          requestId,
        },
      });

      throw error;
    }
  }

  /**
   * Get user history with decryption and PII protection
   */
  async getUserHistory(
    filters: PurchaseFilters,
    requesterId: string,
    requireOwnership: boolean = true
  ): Promise<{
    purchases: PurchaseRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      // Verify requester has access to this data
      if (requireOwnership && filters.userId !== requesterId) {
        await AuditLogger.logSecurityEvent({
          type: "ACCESS",
          action: "unauthorized_history_access",
          userId: requesterId,
          targetId: filters.userId,
          result: "FAILURE",
        });

        throw new Error("Unauthorized access to purchase history");
      }

      // Audit the access
      await AuditLogger.logSecurityEvent({
        type: "ACCESS",
        action: "view_purchase_history",
        userId: requesterId,
        targetId: filters.userId,
        result: "SUCCESS",
        metadata: {
          dateRange: {
            from: filters.dateFrom,
            to: filters.dateTo,
          },
        },
      });

      // Get history from parent
      const result = await super.getUserHistory(filters);

      // Decrypt and mask sensitive fields
      const secureResult = {
        ...result,
        purchases: result.purchases.map(purchase => this.sanitizePurchaseRecord(purchase)),
      };

      return secureResult;
    } catch (error) {
      logger.error("Failed to get secure purchase history", "SECURE_PURCHASE", {
        error,
        userId: filters.userId,
      });
      throw error;
    }
  }

  /**
   * Analyze patterns with privacy protection
   */
  async analyzePurchasePatterns(
    userId: string,
    requesterId: string
  ): Promise<PurchasePattern[]> {
    // Verify access
    if (userId !== requesterId) {
      await AuditLogger.logSecurityEvent({
        type: "ACCESS",
        action: "unauthorized_pattern_analysis",
        userId: requesterId,
        targetId: userId,
        result: "FAILURE",
      });

      throw new Error("Unauthorized access to purchase patterns");
    }

    // Audit the analysis
    await AuditLogger.logSecurityEvent({
      type: "ACCESS",
      action: "analyze_patterns",
      userId: requesterId,
      result: "SUCCESS",
    });

    const patterns = await super.analyzePurchasePatterns(userId);

    // Remove or aggregate sensitive patterns
    return patterns.map(pattern => ({
      ...pattern,
      // Aggregate store information for privacy
      preferredStore: pattern.preferredStore ? "***" : undefined,
    }));
  }

  /**
   * Get reorder suggestions with privacy considerations
   */
  async suggestReorders(
    userId: string,
    requesterId: string,
    daysAhead: number = 7
  ): Promise<ReorderSuggestion[]> {
    // Verify access
    if (userId !== requesterId) {
      throw new Error("Unauthorized access to reorder suggestions");
    }

    const suggestions = await super.suggestReorders(userId, daysAhead);

    // Log access to recommendations
    await AuditLogger.logSecurityEvent({
      type: "ACCESS",
      action: "view_reorder_suggestions",
      userId: requesterId,
      result: "SUCCESS",
      metadata: {
        suggestionCount: suggestions.length,
        daysAhead,
      },
    });

    return suggestions;
  }

  /**
   * Get purchase analytics with aggregation for privacy
   */
  async getPurchaseAnalytics(
    userId: string,
    requesterId: string,
    useCache: boolean = true
  ): Promise<PurchaseAnalytics> {
    // Verify access
    if (userId !== requesterId) {
      await AuditLogger.logSecurityEvent({
        type: "ACCESS",
        action: "unauthorized_analytics_access",
        userId: requesterId,
        targetId: userId,
        result: "FAILURE",
      });

      throw new Error("Unauthorized access to purchase analytics");
    }

    // Audit analytics access
    await AuditLogger.logSecurityEvent({
      type: "ACCESS",
      action: "view_purchase_analytics",
      userId: requesterId,
      result: "SUCCESS",
    });

    const analytics = await super.getPurchaseAnalytics(userId, useCache);

    // Aggregate sensitive information
    return {
      ...analytics,
      // Round financial data to protect exact spending
      totalSpent: Math.round(analytics.totalSpent / 10) * 10,
      averageBasketSize: Math.round(analytics.averageBasketSize / 5) * 5,
    };
  }

  /**
   * Sanitize purchase record for output
   */
  private sanitizePurchaseRecord(purchase: PurchaseRecord): PurchaseRecord {
    return {
      ...purchase,
      // Mask payment method
      paymentMethod: purchase.paymentMethod 
        ? this.maskPaymentMethod(purchase.paymentMethod)
        : undefined,
      // Remove session ID completely
      sessionId: undefined,
      // Mask store location for privacy
      storeLocation: purchase.storeLocation 
        ? this.maskLocation(purchase.storeLocation)
        : undefined,
      // Redact notes that might contain PII
      notes: purchase.notes 
        ? PIIRedactor.redact(purchase.notes)
        : undefined,
    };
  }

  /**
   * Mask payment method for display
   */
  private maskPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      cash: "Cash",
      card: "****Card",
      digital: "Digital",
      ebt: "EBT",
    };

    return methodMap[method] || "****";
  }

  /**
   * Mask location for privacy
   */
  private maskLocation(location: string): string {
    // Keep only city/state, remove specific addresses
    const parts = location.split(",");
    if (parts.length >= 2) {
      return parts.slice(-2).join(",").trim();
    }
    return "***";
  }

  /**
   * Delete user data (GDPR compliance)
   */
  async deleteUserData(
    userId: string,
    requesterId: string,
    reason: string
  ): Promise<{ deleted: number }> {
    try {
      // Verify ownership or admin role
      if (userId !== requesterId) {
        // Check if requester is admin (implement based on your auth)
        throw new Error("Unauthorized data deletion request");
      }

      // Audit the deletion request
      await AuditLogger.logSecurityEvent({
        type: "DELETE",
        action: "delete_user_purchase_data",
        userId: requesterId,
        targetId: userId,
        result: "SUCCESS",
        metadata: { reason },
      });

      // Execute deletion
      const stmt = this.db.prepare(`
        DELETE FROM purchase_records WHERE user_id = ?
      `);
      
      const result = stmt.run(userId);

      // Also delete from receipts
      const receiptStmt = this.db.prepare(`
        DELETE FROM purchase_receipts WHERE user_id = ?
      `);
      
      receiptStmt.run(userId);

      logger.info("User purchase data deleted", "SECURE_PURCHASE", {
        userId,
        recordsDeleted: result.changes,
        reason,
      });

      return { deleted: result.changes };
    } catch (error) {
      await AuditLogger.logSecurityEvent({
        action: "delete_user_data_failed",
        userId: requesterId,
        targetId: userId,
        result: "FAILURE",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(
    userId: string,
    requesterId: string
  ): Promise<{
    purchases: any[];
    patterns: any[];
    analytics: any;
  }> {
    try {
      // Verify ownership
      if (userId !== requesterId) {
        throw new Error("Unauthorized data export request");
      }

      // Audit the export
      await AuditLogger.logSecurityEvent({
        type: "ACCESS",
        action: "export_user_data",
        userId: requesterId,
        result: "SUCCESS",
      });

      // Gather all user data
      const purchases = await this.getUserHistory({ userId }, requesterId);
      const patterns = await this.analyzePurchasePatterns(userId, requesterId);
      const analytics = await this.getPurchaseAnalytics(userId, requesterId);

      // Redact sensitive information
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        purchases: purchases.purchases.map(p => PIIRedactor.redact(p)),
        patterns: patterns.map(p => PIIRedactor.redact(p)),
        analytics: PIIRedactor.redact(analytics),
      };

      logger.info("User data exported", "SECURE_PURCHASE", {
        userId,
        recordCount: purchases.total,
      });

      return exportData;
    } catch (error) {
      await AuditLogger.logSecurityEvent({
        action: "export_user_data_failed",
        userId: requesterId,
        result: "FAILURE",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  /**
   * Anonymize old purchase data
   */
  async anonymizeOldData(olderThanDays: number = 730): Promise<{ anonymized: number }> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

      // Update records to remove PII but keep aggregate data
      const stmt = this.db.prepare(`
        UPDATE purchase_records 
        SET 
          notes = NULL,
          session_id = NULL,
          cashier_id = 'ANONYMIZED',
          store_location = substr(store_location, -10)
        WHERE purchase_date < ?
      `);

      const result = stmt.run(cutoffDate);

      await AuditLogger.logSecurityEvent({
        type: "MODIFY",
        action: "anonymize_old_data",
        userId: "system",
        result: "SUCCESS",
        metadata: {
          olderThanDays,
          recordsAnonymized: result.changes,
        },
      });

      logger.info("Old purchase data anonymized", "SECURE_PURCHASE", {
        cutoffDate,
        anonymized: result.changes,
      });

      return { anonymized: result.changes };
    } catch (error) {
      logger.error("Failed to anonymize old data", "SECURE_PURCHASE", { error });
      throw error;
    }
  }
}

// Export singleton instance
export const securePurchaseHistory = SecurePurchaseHistoryService.getInstance();