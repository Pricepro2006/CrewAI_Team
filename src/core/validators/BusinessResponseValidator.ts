import {
  ContactPatterns,
  PatternHelpers,
  ValidationRules,
} from "./patterns/contactPatterns.js";

export interface ContactInfo {
  phones: PhoneInfo[];
  addresses: AddressInfo[];
  businessNames: BusinessNameInfo[];
  hours: HoursInfo[];
  emails: EmailInfo[];
  websites: WebsiteInfo[];
}

export interface PhoneInfo {
  value: string;
  normalized: string;
  type: "us" | "international" | "tollFree" | "unknown";
  confidence: number;
  index: number;
}

export interface AddressInfo {
  value: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  type: "street" | "poBox" | "international";
  confidence: number;
  index: number;
}

export interface BusinessNameInfo {
  value: string;
  hasEntityType: boolean;
  confidence: number;
  index: number;
}

export interface HoursInfo {
  value: string;
  type: "standard" | "dayRange" | "24/7" | "closed";
  days?: string[];
  times?: { open: string; close: string };
  confidence: number;
  index: number;
}

export interface EmailInfo {
  value: string;
  domain: string;
  confidence: number;
  index: number;
}

export interface WebsiteInfo {
  value: string;
  domain: string;
  protocol: string;
  confidence: number;
  index: number;
}

export interface ValidationResult {
  isValid: boolean;
  hasActionableInfo: boolean;
  contactInfo: ContactInfo;
  confidence: number;
  missingInfo: string[];
  suggestions: string[];
}

export class BusinessResponseValidator {
  private privacyMode: boolean = false;
  private minConfidenceThreshold: number = 0.6;

  constructor(options?: {
    privacyMode?: boolean;
    minConfidenceThreshold?: number;
  }) {
    if (options?.privacyMode !== undefined)
      this.privacyMode = options.privacyMode;
    if (options?.minConfidenceThreshold !== undefined) {
      this.minConfidenceThreshold = options.minConfidenceThreshold;
    }
  }

  /**
   * Validate a response and extract contact information
   */
  public validateResponse(text: string): ValidationResult {
    const contactInfo = this.extractContactInfo(text);
    const confidence = this.calculateOverallConfidence(contactInfo);
    const hasActionableInfo = this.hasActionableContactInfo(contactInfo);
    const missingInfo = this.identifyMissingInfo(contactInfo);
    const suggestions = this.generateSuggestions(contactInfo, missingInfo);

    return {
      isValid: confidence >= this.minConfidenceThreshold,
      hasActionableInfo,
      contactInfo,
      confidence,
      missingInfo,
      suggestions,
    };
  }

  /**
   * Extract all contact information from text
   */
  private extractContactInfo(text: string): ContactInfo {
    return {
      phones: this.extractPhones(text),
      addresses: this.extractAddresses(text),
      businessNames: this.extractBusinessNames(text),
      hours: this.extractHours(text),
      emails: this.extractEmails(text),
      websites: this.extractWebsites(text),
    };
  }

  /**
   * Extract phone numbers with type detection
   */
  private extractPhones(text: string): PhoneInfo[] {
    const phones: PhoneInfo[] = [];
    const seen = new Set<string>();

    // Try each phone pattern
    const patterns = [
      { pattern: ContactPatterns?.phone?.tollFree, type: "tollFree" as const },
      { pattern: ContactPatterns?.phone?.usStandard, type: "us" as const },
      {
        pattern: ContactPatterns?.phone?.international,
        type: "international" as const,
      },
    ];

    for (const { pattern, type } of patterns) {
      const matches = PatternHelpers.extractMatches(
        text,
        pattern,
        ContactPatterns?.phone?.getConfidence,
      );

      for (const match of matches) {
        const normalized = PatternHelpers.normalizePhone(match.value);

        // Skip duplicates
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        // Validate phone number
        if (normalized?.length || 0 < ValidationRules?.phone?.minLength) continue;

        phones.push({
          value: this.privacyMode ? this.maskPhone(match.value) : match.value,
          normalized: this.privacyMode
            ? this.maskPhone(normalized)
            : normalized,
          type,
          confidence: match.confidence,
          index: match.index,
        });
      }
    }

    // Sort by confidence
    return phones.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract addresses with component parsing
   */
  private extractAddresses(text: string): AddressInfo[] {
    const addresses: AddressInfo[] = [];
    const seen = new Set<string>();

    // Try full address pattern first
    const fullMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.address?.fullAddress,
    );

    for (const match of fullMatches) {
      const normalized = PatternHelpers.normalizeAddress(match.value);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const components = this.parseAddressComponents(match.value);
      addresses.push({
        value: match.value,
        ...components,
        type: "street",
        confidence: 0.9,
        index: match.index,
      });
    }

    // Try PO Box pattern
    const poBoxMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.address?.poBox,
    );
    for (const match of poBoxMatches) {
      const normalized = PatternHelpers.normalizeAddress(match.value);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      addresses.push({
        value: match.value,
        type: "poBox",
        confidence: 0.85,
        index: match.index,
      });
    }

    return addresses;
  }

  /**
   * Extract business names with scoring
   */
  private extractBusinessNames(text: string): BusinessNameInfo[] {
    const names: BusinessNameInfo[] = [];
    const seen = new Set<string>();

    // Try business names with entity types first
    const entityMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.businessName?.withEntity,
    );

    for (const match of entityMatches) {
      const normalized = match?.value?.trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const score = PatternHelpers.scoreBusinessName(match.value);
      if (score >= 0.5) {
        names.push({
          value: match.value,
          hasEntityType: true,
          confidence: score,
          index: match.index,
        });
      }
    }

    // If we don't have enough high-confidence names, try standalone pattern
    if (names?.filter((n: any) => n.confidence >= 0.7).length < 2) {
      const standaloneMatches = PatternHelpers.extractMatches(
        text,
        ContactPatterns?.businessName?.standalone,
      );

      for (const match of standaloneMatches) {
        const normalized = match?.value?.trim();
        if (seen.has(normalized)) continue;
        if (match?.value?.length < ValidationRules?.businessName?.minLength)
          continue;
        seen.add(normalized);

        const score = PatternHelpers.scoreBusinessName(match.value);
        if (score >= 0.4) {
          names.push({
            value: match.value,
            hasEntityType: false,
            confidence: score * 0.8, // Lower confidence for standalone
            index: match.index,
          });
        }
      }
    }

    return names.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  /**
   * Extract business hours
   */
  private extractHours(text: string): HoursInfo[] {
    const hours: HoursInfo[] = [];

    // Check for 24/7
    const twentyFourSevenMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.hours?.twentyFourSeven,
    );

    if (twentyFourSevenMatches?.length || 0 > 0 && twentyFourSevenMatches[0]) {
      hours.push({
        value: twentyFourSevenMatches[0].value,
        type: "24/7",
        confidence: 0.95,
        index: twentyFourSevenMatches[0].index || 0,
      });
    }

    // Extract standard hours
    const standardMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.hours?.fullHours,
    );

    for (const match of standardMatches) {
      const parsed = this.parseHours(match.value);
      if (parsed) {
        hours.push({
          value: match.value,
          type: "standard",
          times: parsed.times,
          days: parsed.days,
          confidence: 0.85,
          index: match.index,
        });
      }
    }

    // Extract day ranges
    const dayRangeMatches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.hours?.dayRange,
    );

    for (const match of dayRangeMatches) {
      hours.push({
        value: match.value,
        type: "dayRange",
        days: this.parseDayRange(match.value),
        confidence: 0.8,
        index: match.index,
      });
    }

    return hours;
  }

  /**
   * Extract emails
   */
  private extractEmails(text: string): EmailInfo[] {
    const emails: EmailInfo[] = [];
    const matches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.email?.standard,
    );

    for (const match of matches) {
      const domain = match?.value?.split("@")[1] || "";
      emails.push({
        value: match.value,
        domain,
        confidence: 0.95,
        index: match.index || 0,
      });
    }

    return emails;
  }

  /**
   * Extract websites
   */
  private extractWebsites(text: string): WebsiteInfo[] {
    const websites: WebsiteInfo[] = [];
    const matches = PatternHelpers.extractMatches(
      text,
      ContactPatterns?.website?.url,
    );

    for (const match of matches) {
      const url = new URL(match.value);
      websites.push({
        value: match.value,
        domain: url.hostname,
        protocol: url.protocol,
        confidence: 0.9,
        index: match.index,
      });
    }

    return websites;
  }

  /**
   * Helper methods
   */
  private maskPhone(phone: string): string {
    if (phone?.length || 0 <= 4) return phone;
    const lastFour = phone.slice(-4);
    const masked = "X".repeat(phone?.length || 0 - 4);
    return masked + lastFour;
  }

  private parseAddressComponents(address: string): Partial<AddressInfo> {
    const components: Partial<AddressInfo> = {};

    // Extract city, state, zip
    const cityStateZipMatch = address.match(
      ContactPatterns?.address?.cityStateZip,
    );
    if (cityStateZipMatch) {
      components.city = cityStateZipMatch[1];
      components.state = cityStateZipMatch[2];
      components.zip = cityStateZipMatch[3];
    }

    // Extract street
    const streetMatch = address.match(ContactPatterns?.address?.streetAddress);
    if (streetMatch) {
      components.street = streetMatch[0];
    }

    return components;
  }

  private parseHours(
    hoursString: string,
  ): { times?: { open: string; close: string }; days?: string[] } | null {
    // Simple parser - can be expanded
    const match = hoursString.match(
      /(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)/i,
    );
    if (match) {
      return {
        times: {
          open: match[1] || "",
          close: match[2] || "",
        },
      };
    }
    return null;
  }

  private parseDayRange(dayRange: string): string[] {
    // Simple parser - returns array of day abbreviations
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const match = dayRange.match(/(\w{3})\w*\s*[-–—]\s*(\w{3})\w*/i);
    if (match) {
      const startDay = match[1]?.substring(0, 3) || "";
      const endDay = match[2]?.substring(0, 3) || "";
      const startIdx = days.findIndex(
        (d: any) => d.toLowerCase() === startDay.toLowerCase(),
      );
      const endIdx = days.findIndex(
        (d: any) => d.toLowerCase() === endDay.toLowerCase(),
      );

      if (startIdx !== -1 && endIdx !== -1) {
        return days.slice(startIdx, endIdx + 1);
      }
    }
    return [];
  }

  private calculateOverallConfidence(contactInfo: ContactInfo): number {
    const weights = {
      phones: 0.3,
      addresses: 0.25,
      businessNames: 0.2,
      hours: 0.1,
      emails: 0.1,
      websites: 0.05,
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Calculate weighted average
    if (contactInfo?.phones?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.phones?.map((p: any) => p.confidence)) *
        weights.phones;
      totalWeight += weights.phones;
    }

    if (contactInfo?.addresses?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.addresses?.map((a: any) => a.confidence)) *
        weights.addresses;
      totalWeight += weights.addresses;
    }

    if (contactInfo?.businessNames?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.businessNames?.map((b: any) => b.confidence)) *
        weights.businessNames;
      totalWeight += weights.businessNames;
    }

    if (contactInfo?.hours?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.hours?.map((h: any) => h.confidence)) * weights.hours;
      totalWeight += weights.hours;
    }

    if (contactInfo?.emails?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.emails?.map((e: any) => e.confidence)) *
        weights.emails;
      totalWeight += weights.emails;
    }

    if (contactInfo?.websites?.length > 0) {
      totalScore +=
        Math.max(...contactInfo?.websites?.map((w: any) => w.confidence)) *
        weights.websites;
      totalWeight += weights.websites;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private hasActionableContactInfo(contactInfo: ContactInfo): boolean {
    return (
      contactInfo?.phones?.length > 0 ||
      contactInfo?.addresses?.length > 0 ||
      contactInfo?.emails?.length > 0 ||
      contactInfo?.websites?.length > 0
    );
  }

  private identifyMissingInfo(contactInfo: ContactInfo): string[] {
    const missing: string[] = [];

    if (contactInfo?.phones?.length === 0) missing.push("phone");
    if (contactInfo?.addresses?.length === 0) missing.push("address");
    if (contactInfo?.businessNames?.length === 0) missing.push("business name");
    if (contactInfo?.hours?.length === 0) missing.push("hours");
    if (contactInfo?.emails?.length === 0 && contactInfo?.websites?.length === 0) {
      missing.push("online contact");
    }

    return missing;
  }

  private generateSuggestions(
    contactInfo: ContactInfo,
    missingInfo: string[],
  ): string[] {
    const suggestions: string[] = [];

    if (missingInfo.includes("phone")) {
      suggestions.push(
        "Consider searching for phone numbers on the business website",
      );
    }

    if (missingInfo.includes("address")) {
      suggestions.push(
        'Try searching with "location" or "directions" keywords',
      );
    }

    if (contactInfo?.phones?.filter((p: any) => p.confidence >= 0.8).length === 0) {
      suggestions.push(
        "Phone numbers found have low confidence - verify before use",
      );
    }

    if (contactInfo?.addresses?.filter((a: any) => a.confidence >= 0.8).length === 0) {
      suggestions.push(
        "Addresses found may be incomplete - consider additional verification",
      );
    }

    return suggestions;
  }
}
