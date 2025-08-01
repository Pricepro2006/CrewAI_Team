export interface UserFeedback {
  id: string;
  timestamp: Date;
  query: string;
  validationResult: {
    isValid: boolean;
    hasActionableInfo: boolean;
    confidence: number;
  };
  userRating: 1 | 2 | 3 | 4 | 5;
  feedbackType:
    | "missing_info"
    | "incorrect_info"
    | "incomplete"
    | "perfect"
    | "other";
  specificIssues?: {
    incorrectPhone?: boolean;
    incorrectAddress?: boolean;
    missingHours?: boolean;
    wrongBusiness?: boolean;
    other?: string;
  };
  suggestedCorrection?: {
    phone?: string;
    address?: string;
    hours?: string;
    businessName?: string;
  };
  additionalComments?: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  commonIssues: { issue: string; count: number }[];
  improvementTrend: { date: string; rating: number }[];
}

export class UserFeedbackCollector {
  private feedback: Map<string, UserFeedback[]> = new Map();
  private improvementSuggestions: Map<string, string[]> = new Map();

  /**
   * Collect user feedback for a validation result
   */
  public collectFeedback(
    feedback: Omit<UserFeedback, "id" | "timestamp">,
  ): UserFeedback {
    const fullFeedback: UserFeedback = {
      ...feedback,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Store feedback by query
    if (!this.feedback.has(feedback.query)) {
      this.feedback.set(feedback.query, []);
    }
    this.feedback.get(feedback.query)!.push(fullFeedback);

    // Process suggested corrections
    if (feedback.suggestedCorrection) {
      this.processSuggestedCorrections(
        feedback.query,
        feedback.suggestedCorrection,
      );
    }

    // Learn from feedback
    this.learnFromFeedback(fullFeedback);

    return fullFeedback;
  }

  /**
   * Get feedback statistics
   */
  public getStats(timeRange?: { start: Date; end: Date }): FeedbackStats {
    const allFeedback = Array.from(this.feedback.values()).flat();

    let relevantFeedback = allFeedback;
    if (timeRange) {
      relevantFeedback = allFeedback.filter(
        (f) => f.timestamp >= timeRange.start && f.timestamp <= timeRange.end,
      );
    }

    // Calculate average rating
    const ratings = relevantFeedback.map((f) => f.userRating);
    const averageRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    // Count common issues
    const issueCounts = new Map<string, number>();
    relevantFeedback.forEach((f) => {
      issueCounts.set(
        f.feedbackType,
        (issueCounts.get(f.feedbackType) || 0) + 1,
      );

      if (f.specificIssues) {
        Object.entries(f.specificIssues).forEach(([issue, hasIssue]) => {
          if (hasIssue) {
            issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
          }
        });
      }
    });

    const commonIssues = Array.from(issueCounts.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate improvement trend (daily average)
    const dailyRatings = new Map<string, number[]>();
    relevantFeedback.forEach((f) => {
      const dateKey = f.timestamp.toISOString().split("T")[0] || "";
      if (dateKey && !dailyRatings.has(dateKey)) {
        dailyRatings.set(dateKey, []);
      }
      if (dateKey) {
        dailyRatings.get(dateKey)!.push(f.userRating);
      }
    });

    const improvementTrend = Array.from(dailyRatings.entries())
      .map(([date, ratings]) => ({
        date,
        rating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalFeedback: relevantFeedback.length,
      averageRating,
      commonIssues,
      improvementTrend,
    };
  }

  /**
   * Get feedback for a specific query
   */
  public getFeedbackForQuery(query: string): UserFeedback[] {
    return this.feedback.get(query) || [];
  }

  /**
   * Get improvement suggestions for a query
   */
  public getSuggestions(query: string): string[] {
    return this.improvementSuggestions.get(query) || [];
  }

  /**
   * Generate feedback form structure
   */
  public generateFeedbackForm(
    query: string,
    validationResult: UserFeedback["validationResult"],
  ): {
    fields: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
      options?: string[];
    }>;
    prefilled: Partial<UserFeedback>;
  } {
    return {
      fields: [
        {
          name: "userRating",
          type: "rating",
          label: "How helpful was this information?",
          required: true,
          options: ["1", "2", "3", "4", "5"],
        },
        {
          name: "feedbackType",
          type: "select",
          label: "What type of issue did you experience?",
          required: true,
          options: [
            "missing_info",
            "incorrect_info",
            "incomplete",
            "perfect",
            "other",
          ],
        },
        {
          name: "specificIssues",
          type: "checkboxes",
          label: "Select specific issues (if any):",
          required: false,
          options: [
            "incorrectPhone",
            "incorrectAddress",
            "missingHours",
            "wrongBusiness",
          ],
        },
        {
          name: "suggestedCorrection",
          type: "fieldset",
          label: "Provide correct information (optional):",
          required: false,
        },
        {
          name: "additionalComments",
          type: "textarea",
          label: "Additional comments:",
          required: false,
        },
      ],
      prefilled: {
        query,
        validationResult,
      },
    };
  }

  /**
   * Process suggested corrections to improve future results
   */
  private processSuggestedCorrections(
    query: string,
    corrections: UserFeedback["suggestedCorrection"],
  ): void {
    if (!corrections) return;

    const suggestions: string[] = [];

    if (corrections.phone) {
      suggestions.push(`Correct phone: ${corrections.phone}`);
    }
    if (corrections.address) {
      suggestions.push(`Correct address: ${corrections.address}`);
    }
    if (corrections.hours) {
      suggestions.push(`Correct hours: ${corrections.hours}`);
    }
    if (corrections.businessName) {
      suggestions.push(`Correct business name: ${corrections.businessName}`);
    }

    if (suggestions.length > 0) {
      this.improvementSuggestions.set(query, suggestions);
    }
  }

  /**
   * Learn from user feedback to improve future validations
   */
  private learnFromFeedback(feedback: UserFeedback): void {
    // In a real implementation, this would:
    // 1. Update pattern confidence scores
    // 2. Add new patterns based on corrections
    // 3. Adjust validation thresholds
    // 4. Update data source priorities

    // For now, we'll just log the learning opportunity
    if (feedback.userRating <= 2 && feedback.suggestedCorrection) {
      console.log("Learning opportunity:", {
        query: feedback.query,
        issues: feedback.specificIssues,
        corrections: feedback.suggestedCorrection,
      });
    }
  }

  /**
   * Export feedback data for analysis
   */
  public exportFeedback(format: "json" | "csv" = "json"): string {
    const allFeedback = Array.from(this.feedback.values()).flat();

    if (format === "json") {
      return JSON.stringify(allFeedback, null, 2);
    } else {
      // CSV export
      const headers = [
        "id",
        "timestamp",
        "query",
        "rating",
        "feedbackType",
        "isValid",
        "hasActionableInfo",
        "confidence",
        "comments",
      ];

      const rows = allFeedback.map((f) => [
        f.id,
        f.timestamp.toISOString(),
        f.query,
        f.userRating,
        f.feedbackType,
        f.validationResult.isValid,
        f.validationResult.hasActionableInfo,
        f.validationResult.confidence,
        f.additionalComments || "",
      ]);

      return [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
    }
  }

  /**
   * Generate unique ID for feedback
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get feedback insights for improving validation
   */
  public getInsights(): {
    lowConfidencePatterns: string[];
    frequentlyIncorrectFields: string[];
    reliableDataSources: string[];
    suggestedPatternImprovements: Array<{
      field: string;
      currentPattern: string;
      suggestedPattern: string;
      confidence: number;
    }>;
  } {
    // Analyze feedback to provide actionable insights
    const allFeedback = Array.from(this.feedback.values()).flat();

    // Find patterns that frequently result in low ratings
    const lowRatedQueries = allFeedback
      .filter((f) => f.userRating <= 2)
      .map((f) => f.query);

    // Identify frequently incorrect fields
    const fieldIssues = new Map<string, number>();
    allFeedback.forEach((f) => {
      if (f.specificIssues) {
        Object.entries(f.specificIssues).forEach(([field, hasIssue]) => {
          if (hasIssue) {
            fieldIssues.set(field, (fieldIssues.get(field) || 0) + 1);
          }
        });
      }
    });

    const frequentlyIncorrectFields = Array.from(fieldIssues.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([field]) => field);

    return {
      lowConfidencePatterns: [...new Set(lowRatedQueries)].slice(0, 5),
      frequentlyIncorrectFields,
      reliableDataSources: [], // Would be populated from actual data source feedback
      suggestedPatternImprovements: [], // Would be generated from pattern analysis
    };
  }
}
