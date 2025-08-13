/**
 * Preference Learning Service - Dynamic user preference learning and adaptation
 * Learns from user interactions, purchase decisions, and feedback
 * Continuously adapts recommendations and matching algorithms
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { PurchaseHistoryService } from "./PurchaseHistoryService.js";
import type { PurchaseRecord, ProductFrequency } from "./PurchaseHistoryService.js";
import type { Deal } from "./DealRecommendationEngine.js";
import type { MatchedProduct, SmartMatchingOptions } from "./SmartMatchingService.js";
import type Database from "better-sqlite3";

export interface UserPreference {
  id: string;
  userId: string;
  category: string;
  preferenceType: 'brand' | 'price_sensitivity' | 'dietary' | 'size' | 'frequency' | 'quality';
  value: string;
  confidence: number;
  strength: number; // 0-1 scale
  source: 'explicit' | 'implicit' | 'inferred';
  createdAt: string;
  updatedAt: string;
  lastReinforced: string;
  reinforcementCount: number;
}

export interface LearningEvent {
  id: string;
  userId: string;
  eventType: 'purchase' | 'search' | 'recommendation_click' | 'recommendation_dismiss' | 'deal_accept' | 'deal_reject' | 'explicit_feedback';
  productId?: string;
  productName?: string;
  category?: string;
  brand?: string;
  price?: number;
  searchQuery?: string;
  recommendationId?: string;
  dealId?: string;
  feedback?: 'positive' | 'negative' | 'neutral';
  metadata: Record<string, any>;
  timestamp: string;
}

export interface PreferenceSummary {
  userId: string;
  brandPreferences: Record<string, number>; // brand -> preference score
  categoryPreferences: Record<string, number>;
  priceRanges: Record<string, { min: number; max: number; preferred: number }>;
  dietaryRestrictions: string[];
  shoppingPatterns: {
    averageBasketSize: number;
    preferredShoppingDays: string[];
    budgetConsciousness: 'high' | 'medium' | 'low';
    qualityVsPrice: 'quality_focused' | 'balanced' | 'price_focused';
  };
  discoveredTastes: {
    preferredSizes: Record<string, string>; // category -> preferred size
    flavorProfiles: string[];
    packagingPreferences: string[];
  };
  adaptiveParameters: SmartMatchingOptions;
}

export interface PreferenceLearningConfig {
  learningRate: number;
  decayRate: number;
  minConfidenceThreshold: number;
  maxPreferencesPerCategory: number;
  reinforcementWindow: number; // days
}

export class PreferenceLearningService {
  private static instance: PreferenceLearningService;
  private db: Database.Database;
  private historyService: PurchaseHistoryService;
  private config: PreferenceLearningConfig;

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    this.historyService = PurchaseHistoryService.getInstance();
    
    this.config = {
      learningRate: 0.1,
      decayRate: 0.05,
      minConfidenceThreshold: 0.3,
      maxPreferencesPerCategory: 10,
      reinforcementWindow: 30
    };

    this.initializeTables();
  }

  static getInstance(): PreferenceLearningService {
    if (!PreferenceLearningService.instance) {
      PreferenceLearningService.instance = new PreferenceLearningService();
    }
    return PreferenceLearningService.instance;
  }

  /**
   * Initialize database tables for preference learning
   */
  private initializeTables(): void {
    try {
      // User preferences table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          category TEXT NOT NULL,
          preference_type TEXT NOT NULL,
          value TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.5,
          strength REAL NOT NULL DEFAULT 0.5,
          source TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_reinforced TEXT NOT NULL,
          reinforcement_count INTEGER DEFAULT 1,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Learning events table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          product_id TEXT,
          product_name TEXT,
          category TEXT,
          brand TEXT,
          price REAL,
          search_query TEXT,
          recommendation_id TEXT,
          deal_id TEXT,
          feedback TEXT,
          metadata TEXT,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Preference evolution history
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS preference_evolution (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          preference_id TEXT NOT NULL,
          old_confidence REAL,
          new_confidence REAL,
          old_strength REAL,
          new_strength REAL,
          change_reason TEXT NOT NULL,
          changed_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (preference_id) REFERENCES user_preferences(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_preferences_user_category 
        ON user_preferences(user_id, category)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_learning_events_user_timestamp 
        ON learning_events(user_id, timestamp DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_preference_evolution_user 
        ON preference_evolution(user_id, changed_at DESC)
      `);

      logger.info("Preference learning tables initialized", "PREFERENCE_LEARNING");
    } catch (error) {
      logger.error("Failed to initialize preference learning tables", "PREFERENCE_LEARNING", { error });
      throw error;
    }
  }

  /**
   * Learn from a user action
   */
  async learnFromAction(
    userId: string,
    action: Omit<LearningEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      // Record the learning event
      const event: LearningEvent = {
        ...action,
        id: `event_${userId}_${Date.now()}`,
        userId,
        timestamp: new Date().toISOString()
      };

      await this.recordLearningEvent(event);

      // Process the event to update preferences
      await this.processLearningEvent(event);

      logger.debug("Learned from user action", "PREFERENCE_LEARNING", {
        userId,
        eventType: action.eventType,
        productId: action.productId
      });

    } catch (error) {
      logger.error("Failed to learn from user action", "PREFERENCE_LEARNING", { error, userId });
      throw error;
    }
  }

  /**
   * Get comprehensive user preference summary
   */
  async getUserPreferenceSummary(userId: string): Promise<PreferenceSummary | null> {
    try {
      // Get all user preferences
      const preferences = await this.getUserPreferences(userId);
      if (preferences.length === 0) {
        return null;
      }

      // Get purchase history for additional insights
      const purchaseHistory = await this.historyService.getUserHistory({ userId, limit: 100 });
      const purchases = purchaseHistory.purchases;

      // Calculate brand preferences
      const brandPreferences = this.calculateBrandPreferences(preferences, purchases);

      // Calculate category preferences
      const categoryPreferences = this.calculateCategoryPreferences(preferences, purchases);

      // Calculate price ranges by category
      const priceRanges = this.calculatePriceRanges(purchases);

      // Extract dietary restrictions
      const dietaryRestrictions = preferences
        .filter(p => p.preferenceType === 'dietary')
        .map(p => p.value);

      // Analyze shopping patterns
      const shoppingPatterns = this.analyzeShoppingPatterns(purchases);

      // Discover taste preferences
      const discoveredTastes = this.discoverTastes(preferences, purchases);

      // Generate adaptive parameters for matching algorithms
      const adaptiveParameters = this.generateAdaptiveParameters(preferences, purchases);

      return {
        userId,
        brandPreferences,
        categoryPreferences,
        priceRanges,
        dietaryRestrictions,
        shoppingPatterns,
        discoveredTastes,
        adaptiveParameters
      };

    } catch (error) {
      logger.error("Failed to get user preference summary", "PREFERENCE_LEARNING", { error, userId });
      return null;
    }
  }

  /**
   * Learn from purchase decision
   */
  async learnFromPurchase(userId: string, purchase: PurchaseRecord): Promise<void> {
    const metadata = {
      quantity: purchase.quantity,
      unitPrice: purchase.unitPrice,
      totalPrice: purchase.totalPrice,
      paymentMethod: purchase.paymentMethod
    };

    await this.learnFromAction(userId, {
      eventType: 'purchase',
      productId: purchase.productId,
      productName: purchase.productName,
      category: purchase.category,
      brand: purchase.brand,
      price: purchase.unitPrice,
      feedback: 'positive', // Purchase is implicit positive feedback
      metadata
    });
  }

  /**
   * Learn from search behavior
   */
  async learnFromSearch(
    userId: string,
    searchQuery: string,
    selectedProduct?: MatchedProduct,
    dismissedProducts?: MatchedProduct[]
  ): Promise<void> {
    // Learn from search query
    await this.learnFromAction(userId, {
      eventType: 'search',
      searchQuery,
      metadata: { query: searchQuery }
    });

    // Learn from product selection
    if (selectedProduct) {
      await this.learnFromAction(userId, {
        eventType: 'recommendation_click',
        productId: selectedProduct.product.walmartId || selectedProduct.product.id,
        productName: selectedProduct.product.name,
        searchQuery,
        feedback: 'positive',
        metadata: {
          matchScore: selectedProduct.matchScore,
          matchReason: selectedProduct.matchReason,
          confidence: selectedProduct.confidence
        }
      });
    }

    // Learn from dismissed products
    if (dismissedProducts?.length) {
      for (const dismissed of dismissedProducts) {
        await this.learnFromAction(userId, {
          eventType: 'recommendation_dismiss',
          productId: dismissed.product.walmartId || dismissed.product.id,
          productName: dismissed.product.name,
          searchQuery,
          feedback: 'negative',
          metadata: {
            matchScore: dismissed.matchScore,
            matchReason: dismissed.matchReason,
            dismissReason: 'user_preference'
          }
        });
      }
    }
  }

  /**
   * Learn from deal interactions
   */
  async learnFromDealInteraction(
    userId: string,
    deal: Deal,
    action: 'accept' | 'reject' | 'ignore',
    reason?: string
  ): Promise<void> {
    const eventType = action === 'accept' ? 'deal_accept' : 'deal_reject';
    const feedback = action === 'accept' ? 'positive' : action === 'reject' ? 'negative' : 'neutral';

    await this.learnFromAction(userId, {
      eventType,
      productId: deal.productId,
      productName: deal.product.name,
      dealId: deal.id,
      price: deal.currentPrice,
      feedback,
      metadata: {
        dealType: deal.dealType,
        savings: deal.savings,
        savingsPercentage: deal.savingsPercentage,
        dealScore: deal.dealScore,
        reason: reason || action
      }
    });
  }

  /**
   * Record explicit user feedback
   */
  async recordExplicitFeedback(
    userId: string,
    feedback: {
      type: 'brand_preference' | 'dietary_restriction' | 'price_sensitivity' | 'quality_preference';
      value: string;
      sentiment: 'like' | 'dislike' | 'neutral';
      context?: string;
    }
  ): Promise<void> {
    await this.learnFromAction(userId, {
      eventType: 'explicit_feedback',
      feedback: feedback.sentiment === 'like' ? 'positive' : feedback.sentiment === 'dislike' ? 'negative' : 'neutral',
      metadata: {
        feedbackType: feedback.type,
        value: feedback.value,
        context: feedback.context
      }
    });

    // Directly update preferences for explicit feedback
    await this.updatePreferenceFromExplicitFeedback(userId, feedback);
  }

  /**
   * Adapt matching options based on learned preferences
   */
  async adaptMatchingOptions(userId: string, baseOptions: SmartMatchingOptions): Promise<SmartMatchingOptions> {
    try {
      const summary = await this.getUserPreferenceSummary(userId);
      if (!summary) {
        return baseOptions;
      }

      return {
        ...baseOptions,
        ...summary.adaptiveParameters,
        userId,
        prioritizeHistory: true,
        includeAlternatives: true,
        personalized: true
      };

    } catch (error) {
      logger.warn("Failed to adapt matching options", "PREFERENCE_LEARNING", { error, userId });
      return baseOptions;
    }
  }

  /**
   * Get decay-adjusted preferences
   */
  async getActivePreferences(userId: string): Promise<UserPreference[]> {
    const preferences = await this.getUserPreferences(userId);
    const now = Date.now();

    return preferences.map(pref => {
      // Apply time decay to preferences
      const daysSinceReinforced = (now - new Date(pref.lastReinforced).getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-daysSinceReinforced * this.config.decayRate / 30);
      const adjustedConfidence = Math.max(0.1, pref.confidence * decayFactor);

      return {
        ...pref,
        confidence: adjustedConfidence
      };
    }).filter(pref => pref.confidence >= this.config.minConfidenceThreshold);
  }

  // Private helper methods

  private async recordLearningEvent(event: LearningEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO learning_events (
        id, user_id, event_type, product_id, product_name, category, brand,
        price, search_query, recommendation_id, deal_id, feedback, metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id, event.userId, event.eventType, event.productId, event.productName,
      event.category, event.brand, event.price, event.searchQuery, event.recommendationId,
      event.dealId, event.feedback, JSON.stringify(event.metadata), event.timestamp
    );
  }

  private async processLearningEvent(event: LearningEvent): Promise<void> {
    switch (event.eventType) {
      case 'purchase':
        await this.processPurchase(event);
        break;
      case 'search':
        await this.processSearch(event);
        break;
      case 'recommendation_click':
        await this.processRecommendationClick(event);
        break;
      case 'recommendation_dismiss':
        await this.processRecommendationDismiss(event);
        break;
      case 'deal_accept':
        await this.processDealAccept(event);
        break;
      case 'deal_reject':
        await this.processDealReject(event);
        break;
      case 'explicit_feedback':
        await this.processExplicitFeedback(event);
        break;
    }
  }

  private async processPurchase(event: LearningEvent): Promise<void> {
    // Reinforce brand preference
    if (event.brand) {
      await this.reinforcePreference(event.userId, 'brand', event.brand, event.category);
    }

    // Learn price sensitivity
    if (event.price && event.category) {
      await this.updatePriceSensitivity(event.userId, event.category, event.price);
    }

    // Learn category preference
    if (event.category) {
      await this.reinforcePreference(event.userId, 'frequency', 'regular', event.category);
    }
  }

  private async processSearch(event: LearningEvent): Promise<void> {
    if (!event.searchQuery) return;

    // Extract intent from search query
    const intent = this.extractSearchIntent(event.searchQuery);
    if (intent.dietaryKeywords.length > 0) {
      for (const keyword of intent.dietaryKeywords) {
        await this.reinforcePreference(event.userId, 'dietary', keyword, 'general');
      }
    }
  }

  private async processRecommendationClick(event: LearningEvent): Promise<void> {
    // Positive signal - reinforce preferences that led to this match
    if (event.brand) {
      await this.reinforcePreference(event.userId, 'brand', event.brand, event.category);
    }
  }

  private async processRecommendationDismiss(event: LearningEvent): Promise<void> {
    // Negative signal - weaken preferences that led to this match
    if (event.brand) {
      await this.weakenPreference(event.userId, 'brand', event.brand, event.category);
    }
  }

  private async processDealAccept(event: LearningEvent): Promise<void> {
    // Learn price sensitivity and deal preferences
    const dealType = event.metadata?.dealType;
    if (dealType) {
      await this.reinforcePreference(event.userId, 'price_sensitivity', dealType, event.category);
    }
  }

  private async processDealReject(event: LearningEvent): Promise<void> {
    // Learn what deals user doesn't want
    const dealType = event.metadata?.dealType;
    if (dealType) {
      await this.weakenPreference(event.userId, 'price_sensitivity', dealType, event.category);
    }
  }

  private async processExplicitFeedback(event: LearningEvent): Promise<void> {
    const feedbackType = event.metadata?.feedbackType;
    const value = event.metadata?.value;
    const sentiment = event.feedback;

    if (feedbackType && value) {
      if (sentiment === 'positive') {
        await this.reinforcePreference(event.userId, feedbackType, value, 'general');
      } else if (sentiment === 'negative') {
        await this.weakenPreference(event.userId, feedbackType, value, 'general');
      }
    }
  }

  private async reinforcePreference(
    userId: string,
    preferenceType: UserPreference['preferenceType'],
    value: string,
    category: string
  ): Promise<void> {
    const existing = await this.findPreference(userId, preferenceType, value, category);

    if (existing) {
      // Strengthen existing preference
      const newConfidence = Math.min(1.0, existing.confidence + this.config.learningRate);
      const newStrength = Math.min(1.0, existing.strength + this.config.learningRate * 0.5);
      
      await this.updatePreference(existing.id, {
        confidence: newConfidence,
        strength: newStrength,
        lastReinforced: new Date().toISOString(),
        reinforcementCount: existing.reinforcementCount + 1
      });
    } else {
      // Create new preference
      await this.createPreference({
        userId,
        category,
        preferenceType,
        value,
        confidence: this.config.learningRate * 2,
        strength: this.config.learningRate,
        source: 'implicit'
      });
    }
  }

  private async weakenPreference(
    userId: string,
    preferenceType: UserPreference['preferenceType'],
    value: string,
    category: string
  ): Promise<void> {
    const existing = await this.findPreference(userId, preferenceType, value, category);

    if (existing) {
      const newConfidence = Math.max(0.0, existing.confidence - this.config.learningRate);
      const newStrength = Math.max(0.0, existing.strength - this.config.learningRate * 0.5);
      
      await this.updatePreference(existing.id, {
        confidence: newConfidence,
        strength: newStrength,
        lastReinforced: new Date().toISOString()
      });
    }
  }

  private async updatePriceSensitivity(userId: string, category: string, price: number): Promise<void> {
    // Simplified price sensitivity learning
    let sensitivity = 'medium';
    
    if (price < 5) {
      sensitivity = 'high';
    } else if (price > 20) {
      sensitivity = 'low';
    }

    await this.reinforcePreference(userId, 'price_sensitivity', sensitivity, category);
  }

  private extractSearchIntent(query: string): {
    dietaryKeywords: string[];
    brandHints: string[];
    sizeHints: string[];
  } {
    const lower = query.toLowerCase();
    
    const dietaryKeywords = [];
    const dietaryTerms = ['organic', 'gluten-free', 'sugar-free', 'low-fat', 'fat-free', 'vegan', 'vegetarian', 'keto', 'low-carb'];
    for (const term of dietaryTerms) {
      if (lower.includes(term.replace('-', ' ')) || lower.includes(term)) {
        dietaryKeywords.push(term);
      }
    }

    const brandHints = [];
    // Would implement brand detection logic here

    const sizeHints = [];
    // Would implement size detection logic here

    return { dietaryKeywords, brandHints, sizeHints };
  }

  private async getUserPreferences(userId: string): Promise<UserPreference[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_preferences 
      WHERE user_id = ?
      ORDER BY confidence DESC, strength DESC
    `);

    return stmt.all(userId).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      preferenceType: row.preference_type,
      value: row.value,
      confidence: row.confidence,
      strength: row.strength,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReinforced: row.last_reinforced,
      reinforcementCount: row.reinforcement_count
    }));
  }

  private async findPreference(
    userId: string,
    preferenceType: string,
    value: string,
    category: string
  ): Promise<UserPreference | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_preferences 
      WHERE user_id = ? AND preference_type = ? AND value = ? AND category = ?
    `);

    const row = stmt.get(userId, preferenceType, value, category);
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      preferenceType: row.preference_type,
      value: row.value,
      confidence: row.confidence,
      strength: row.strength,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReinforced: row.last_reinforced,
      reinforcementCount: row.reinforcement_count
    };
  }

  private async createPreference(data: Omit<UserPreference, 'id' | 'createdAt' | 'updatedAt' | 'lastReinforced' | 'reinforcementCount'>): Promise<void> {
    const now = new Date().toISOString();
    const id = `pref_${data.userId}_${Date.now()}`;

    const stmt = this.db.prepare(`
      INSERT INTO user_preferences (
        id, user_id, category, preference_type, value, confidence, strength,
        source, created_at, updated_at, last_reinforced, reinforcement_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, data.userId, data.category, data.preferenceType, data.value,
      data.confidence, data.strength, data.source, now, now, now, 1
    );
  }

  private async updatePreference(preferenceId: string, updates: Partial<UserPreference>): Promise<void> {
    const fields = Object.keys(updates).map(key => 
      `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`
    ).join(', ');
    
    const values = Object.values(updates);
    values.push(new Date().toISOString()); // updated_at
    values.push(preferenceId);

    const stmt = this.db.prepare(`
      UPDATE user_preferences 
      SET ${fields}, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  private async updatePreferenceFromExplicitFeedback(
    userId: string,
    feedback: {
      type: string;
      value: string;
      sentiment: 'like' | 'dislike' | 'neutral';
    }
  ): Promise<void> {
    const preferenceType = feedback.type as UserPreference['preferenceType'];
    const strength = feedback.sentiment === 'like' ? 0.8 : feedback.sentiment === 'dislike' ? -0.8 : 0;
    const confidence = 0.9; // High confidence for explicit feedback

    if (feedback.sentiment === 'like') {
      await this.reinforcePreference(userId, preferenceType, feedback.value, 'general');
    } else if (feedback.sentiment === 'dislike') {
      await this.weakenPreference(userId, preferenceType, feedback.value, 'general');
    }
  }

  // Complex analysis methods for generating preference summaries

  private calculateBrandPreferences(preferences: UserPreference[], purchases: PurchaseRecord[]): Record<string, number> {
    const brandScores: Record<string, number> = {};
    
    // From explicit preferences
    preferences
      .filter(p => p.preferenceType === 'brand')
      .forEach(p => {
        brandScores[p.value] = (brandScores[p.value] || 0) + p.confidence * p.strength;
      });
    
    // From purchase history
    const brandCounts: Record<string, number> = {};
    purchases.forEach(p => {
      if (p.brand) {
        brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
      }
    });
    
    const maxCount = Math.max(...Object.values(brandCounts));
    Object.entries(brandCounts).forEach(([brand, count]) => {
      const score = count / maxCount * 0.5; // Normalize to 0-0.5 range
      brandScores[brand] = (brandScores[brand] || 0) + score;
    });
    
    return brandScores;
  }

  private calculateCategoryPreferences(preferences: UserPreference[], purchases: PurchaseRecord[]): Record<string, number> {
    const categoryScores: Record<string, number> = {};
    
    // From purchases - frequency indicates preference
    const categoryCounts: Record<string, number> = {};
    purchases.forEach(p => {
      if (p.category) {
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      }
    });
    
    const maxCount = Math.max(...Object.values(categoryCounts));
    Object.entries(categoryCounts).forEach(([category, count]) => {
      categoryScores[category] = count / maxCount;
    });
    
    return categoryScores;
  }

  private calculatePriceRanges(purchases: PurchaseRecord[]): Record<string, { min: number; max: number; preferred: number }> {
    const categoryPrices: Record<string, number[]> = {};
    
    purchases.forEach(p => {
      if (p.category && p.unitPrice > 0) {
        if (!categoryPrices[p.category]) {
          categoryPrices[p.category] = [];
        }
        categoryPrices[p.category].push(p.unitPrice);
      }
    });
    
    const priceRanges: Record<string, { min: number; max: number; preferred: number }> = {};
    
    Object.entries(categoryPrices).forEach(([category, prices]) => {
      if (prices.length > 0) {
        const sorted = prices.sort((a, b) => a - b);
        priceRanges[category] = {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          preferred: this.calculateMedian(sorted)
        };
      }
    });
    
    return priceRanges;
  }

  private analyzeShoppingPatterns(purchases: PurchaseRecord[]): PreferenceSummary['shoppingPatterns'] {
    const totalSpent = purchases.reduce((sum, p) => sum + p.totalPrice, 0);
    const averageBasketSize = totalSpent / Math.max(1, purchases.length);
    
    // Analyze shopping days
    const dayFrequency: Record<string, number> = {};
    purchases.forEach(p => {
      const day = new Date(p.purchaseDate).toLocaleDateString('en-US', { weekday: 'long' });
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    });
    
    const preferredShoppingDays = Object.entries(dayFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([day]) => day);
    
    // Determine budget consciousness
    const prices = purchases.map(p => p.unitPrice);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    let budgetConsciousness: 'high' | 'medium' | 'low' = 'medium';
    if (avgPrice < 10) budgetConsciousness = 'high';
    else if (avgPrice > 25) budgetConsciousness = 'low';
    
    return {
      averageBasketSize,
      preferredShoppingDays,
      budgetConsciousness,
      qualityVsPrice: 'balanced' // Would need more sophisticated analysis
    };
  }

  private discoverTastes(preferences: UserPreference[], purchases: PurchaseRecord[]): PreferenceSummary['discoveredTastes'] {
    const preferredSizes: Record<string, string> = {};
    const flavorProfiles: string[] = [];
    const packagingPreferences: string[] = [];
    
    // Extract from preferences
    preferences.forEach(p => {
      if (p.preferenceType === 'size') {
        preferredSizes[p.category] = p.value;
      }
    });
    
    return {
      preferredSizes,
      flavorProfiles,
      packagingPreferences
    };
  }

  private generateAdaptiveParameters(preferences: UserPreference[], purchases: PurchaseRecord[]): SmartMatchingOptions {
    // Extract brand preferences
    const preferredBrands = preferences
      .filter(p => p.preferenceType === 'brand' && p.confidence > 0.5)
      .map(p => p.value);
    
    const avoidBrands = preferences
      .filter(p => p.preferenceType === 'brand' && p.confidence < -0.3)
      .map(p => p.value);
    
    // Extract dietary restrictions
    const dietaryRestrictions = preferences
      .filter(p => p.preferenceType === 'dietary')
      .map(p => p.value);
    
    // Determine brand loyalty
    const brandLoyalty: 'high' | 'medium' | 'low' = preferredBrands.length > 3 ? 'high' : 
                                                     preferredBrands.length > 1 ? 'medium' : 'low';
    
    return {
      preferredBrands,
      avoidBrands,
      dietaryRestrictions,
      brandLoyalty,
      prioritizeHistory: purchases.length > 5
    };
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
}