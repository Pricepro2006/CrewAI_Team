import crypto from "crypto";
import { LRUCache } from "lru-cache";
import { logger } from "../../utils/logger.js";
import type { User } from "../trpc/context.js";
import { securityMonitor, SecurityEventType } from "./SecurityMonitoringService.js";

/**
 * Secure Guest User Service
 * Manages guest user creation with proper rate limiting, secure IDs, and restricted permissions
 */
export class GuestUserService {
  private static instance: GuestUserService;
  
  // Rate limiting for guest user creation per IP
  private rateLimitCache: LRUCache<string, number>;
  
  // Guest user session cache with TTL
  private guestUserCache: LRUCache<string, User>;
  
  // Configuration
  private readonly MAX_GUEST_USERS_PER_IP = 5; // Max guest users per IP in window
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly GUEST_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHED_GUESTS = 1000; // Max guest users in cache
  
  private constructor() {
    // Initialize rate limit cache
    this.rateLimitCache = new LRUCache<string, number>({
      max: 10000, // Max IPs to track
      ttl: this.RATE_LIMIT_WINDOW_MS,
    });
    
    // Initialize guest user cache
    this.guestUserCache = new LRUCache<string, User>({
      max: this.MAX_CACHED_GUESTS,
      ttl: this.GUEST_SESSION_TTL_MS,
      updateAgeOnGet: true, // Extend TTL on access
    });
  }
  
  static getInstance(): GuestUserService {
    if (!GuestUserService.instance) {
      GuestUserService.instance = new GuestUserService();
    }
    return GuestUserService.instance;
  }
  
  /**
   * Create or retrieve a guest user with proper security measures
   */
  async createGuestUser(ip: string, userAgent: string): Promise<User | null> {
    // Validate IP address
    const sanitizedIp = this.sanitizeIp(ip);
    if (!sanitizedIp) {
      logger.error("Invalid IP address for guest user creation", "SECURITY", { ip });
      return null;
    }
    
    // Check rate limit
    if (!this.checkRateLimit(sanitizedIp)) {
      logger.warn("Guest user creation rate limit exceeded", "SECURITY", {
        ip: sanitizedIp,
        userAgent,
      });
      return null;
    }
    
    // Generate secure guest ID
    const guestId = this.generateSecureGuestId(sanitizedIp, userAgent);
    
    // Check if guest user already exists in cache
    const existingGuest = this?.guestUserCache?.get(guestId);
    if (existingGuest) {
      logger.debug("Returning existing guest user from cache", "GUEST_USER", {
        guestId,
        ip: sanitizedIp,
      });
      return existingGuest;
    }
    
    // Create new guest user with restricted permissions
    const guestUser: User = {
      id: guestId,
      email: "", // No email for guests
      username: "guest",
      role: "user", // Guest users get default user role
      is_active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: this.getGuestPermissions(),
      lastActivity: new Date(),
      // Additional metadata for security tracking
      metadata: {
        isGuest: true,
        ip: sanitizedIp,
        userAgent: this.sanitizeUserAgent(userAgent),
        sessionStart: new Date().toISOString(),
      },
    };
    
    // Cache the guest user
    this?.guestUserCache?.set(guestId, guestUser);
    
    // Log guest user creation for security monitoring
    logger.info("Guest user created", "GUEST_USER", {
      guestId,
      ip: sanitizedIp,
      userAgent: this.sanitizeUserAgent(userAgent),
      timestamp: new Date().toISOString(),
    });
    
    // Log to security monitor
    securityMonitor.logEvent({
      type: SecurityEventType.GUEST_USER_CREATED,
      userId: guestId,
      ip: sanitizedIp,
      userAgent: this.sanitizeUserAgent(userAgent),
      metadata: {
        sessionTTL: this.GUEST_SESSION_TTL_MS,
      },
    });
    
    return guestUser;
  }
  
  /**
   * Check if IP has exceeded rate limit
   */
  private checkRateLimit(ip: string): boolean {
    const currentCount = this?.rateLimitCache?.get(ip) || 0;
    
    if (currentCount >= this.MAX_GUEST_USERS_PER_IP) {
      // Log rate limit event
      securityMonitor.logEvent({
        type: SecurityEventType.GUEST_RATE_LIMITED,
        ip,
        reason: `Guest creation rate limit exceeded: ${currentCount}/${this.MAX_GUEST_USERS_PER_IP}`,
        metadata: {
          currentCount,
          maxAllowed: this.MAX_GUEST_USERS_PER_IP,
          windowMs: this.RATE_LIMIT_WINDOW_MS,
        },
      });
      return false;
    }
    
    // Increment counter
    this?.rateLimitCache?.set(ip, currentCount + 1);
    return true;
  }
  
  /**
   * Generate a secure, unpredictable guest ID
   */
  private generateSecureGuestId(ip: string, userAgent: string): string {
    // Use crypto-secure random bytes
    const randomBytes = crypto.randomBytes(16).toString('hex');
    
    // Create a hash incorporating multiple factors for uniqueness
    const factors = [
      randomBytes,
      Date.now().toString(),
      ip,
      userAgent,
      process?.hrtime?.bigint().toString(), // High-resolution time
    ];
    
    const hash = crypto
      .createHash('sha256')
      .update(factors.join('|'))
      .digest('hex')
      .substring(0, 16); // Take first 16 chars for readability
    
    return `guest-${hash}`;
  }
  
  /**
   * Get restricted permissions for guest users
   */
  private getGuestPermissions(): string[] {
    return [
      "chat.read",          // Can read chat messages
      "chat?.create?.limited", // Limited chat creation (rate limited)
      "health.read",        // Can check system health
      "public.read",        // Can access public resources
      // Explicitly NOT included:
      // - agent.execute
      // - task.create
      // - rag.query
      // - data.write
      // - user.manage
      // - admin.*
    ];
  }
  
  /**
   * Sanitize IP address to prevent injection
   */
  private sanitizeIp(ip: string): string | null {
    // Remove any potential injected content
    const cleaned = ip.trim().toLowerCase();
    
    // Basic validation for IPv4 or IPv6
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
    
    if (ipv4Regex.test(cleaned) || ipv6Regex.test(cleaned) || cleaned === "::1") {
      return cleaned;
    }
    
    // Handle forwarded IPs (take first valid IP)
    const forwarded = cleaned.split(',')[0]?.trim();
    if (forwarded && (ipv4Regex.test(forwarded) || ipv6Regex.test(forwarded))) {
      return forwarded;
    }
    
    return null;
  }
  
  /**
   * Sanitize user agent string
   */
  private sanitizeUserAgent(userAgent: string): string {
    return userAgent
      .substring(0, 200) // Limit length
      .replace(/[^\w\s\-.,;:()/]/g, '') // Remove special chars
      .trim();
  }
  
  /**
   * Check if a user is a guest
   */
  isGuestUser(user: User): boolean {
    return user.metadata?.isGuest === true || user?.id?.startsWith("guest-");
  }
  
  /**
   * Revoke a guest session (for security incidents)
   */
  revokeGuestSession(guestId: string, reason?: string): void {
    const user = this?.guestUserCache?.get(guestId);
    this?.guestUserCache?.delete(guestId);
    
    logger.warn("Guest session revoked", "SECURITY", { guestId, reason });
    
    // Log to security monitor
    if (user) {
      securityMonitor.logEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        userId: guestId,
        ip: user.metadata?.ip,
        userAgent: user.metadata?.userAgent,
        reason: reason || "Guest session manually revoked",
        metadata: {
          action: "session_revoked",
        },
      });
    }
  }
  
  /**
   * Get guest user statistics for monitoring
   */
  getStats() {
    return {
      activeSessions: this?.guestUserCache?.size,
      rateLimitedIps: this?.rateLimitCache?.size,
      maxSessionsPerIp: this.MAX_GUEST_USERS_PER_IP,
      sessionTtlMinutes: this.GUEST_SESSION_TTL_MS / 60000,
    };
  }
  
  /**
   * Clean up expired sessions (called periodically)
   */
  cleanup(): void {
    // LRU cache handles TTL automatically, but we can force cleanup
    this?.guestUserCache?.forEach((user, key) => {
      // Additional cleanup logic if needed
    });
    
    logger.debug("Guest user cleanup completed", "MAINTENANCE", this.getStats());
  }
}

// Export singleton instance
export const guestUserService = GuestUserService.getInstance();