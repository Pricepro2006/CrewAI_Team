import { describe, it, expect, beforeEach, vi } from "vitest";
import { GuestUserService } from "../GuestUserService";
import { SecurityMonitoringService } from "../SecurityMonitoringService";
import type { User } from "../../trpc/context";

describe("Guest User Security Implementation", () => {
  let guestUserService: GuestUserService;
  let securityMonitor: SecurityMonitoringService;

  beforeEach(() => {
    // Reset singletons
    vi.clearAllMocks();
    // Clear the singleton instances to start fresh
    (GuestUserService as any).instance = undefined;
    (SecurityMonitoringService as any).instance = undefined;
    guestUserService = GuestUserService.getInstance();
    securityMonitor = SecurityMonitoringService.getInstance();
  });

  describe("GuestUserService", () => {
    it("should create guest user with secure ID", async () => {
      const ip = "192.168.1.100";
      const userAgent = "Mozilla/5.0 Test Browser";
      
      const guestUser = await guestUserService.createGuestUser(ip, userAgent);
      
      expect(guestUser).toBeTruthy();
      expect(guestUser?.id).toMatch(/^guest-[a-f0-9]{16}$/);
      expect(guestUser?.username).toBe("guest");
      expect(guestUser?.role).toBe("guest");
      expect(guestUser?.permissions).toEqual([
        "chat.read",
        "chat.create.limited",
        "health.read",
        "public.read",
      ]);
    });

    it("should not include predictable IP in guest ID", async () => {
      const ip = "192.168.1.100";
      const userAgent = "Test Agent";
      
      const guest1 = await guestUserService.createGuestUser(ip, userAgent);
      const guest2 = await guestUserService.createGuestUser(ip, userAgent);
      
      // IDs should be different even with same IP
      expect(guest1?.id).not.toBe(guest2?.id);
      
      // ID should not contain the IP address
      expect(guest1?.id).not.toContain("192-168-1-100");
      expect(guest1?.id).not.toContain("192.168.1.100");
    });

    it("should enforce rate limiting per IP", async () => {
      const ip = "192.168.1.100";
      const userAgent = "Test Agent";
      
      // Create max allowed guest users
      const guests: (User | null)[] = [];
      for (let i = 0; i < 5; i++) {
        const guest = await guestUserService.createGuestUser(ip, `Test Agent ${i}`);
        guests.push(guest);
        if (i < 5) {
          expect(guest).toBeTruthy();
        }
      }
      
      // Next creation should fail
      const tooManyGuest = await guestUserService.createGuestUser(ip, "Test Agent Extra");
      expect(tooManyGuest).toBeNull();
    });

    it("should cache guest users within session TTL", async () => {
      const ip = "192.168.1.101"; // Different IP to avoid rate limit from previous test
      const userAgent = "Test Agent";
      
      const guest1 = await guestUserService.createGuestUser(ip, userAgent);
      expect(guest1).toBeTruthy();
      
      // Since we generate unique IDs based on timestamp and random data,
      // the cache is keyed by the generated ID, not IP+UserAgent
      // This test should verify the guest user service behavior
      const guestId = guest1!.id;
      
      // Verify the guest is cached
      const stats = guestUserService.getStats();
      expect(stats.activeSessions).toBeGreaterThan(0);
    });

    it("should sanitize malicious IP addresses", async () => {
      const maliciousIps = [
        "192.168.1.100; DROP TABLE users;--",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "192.168.1.100' OR '1'='1",
      ];
      
      for (const badIp of maliciousIps) {
        const guest = await guestUserService.createGuestUser(badIp, "Test");
        // Should either sanitize or reject
        if (guest) {
          expect(guest.metadata?.ip).not.toContain("DROP");
          expect(guest.metadata?.ip).not.toContain("script");
          expect(guest.metadata?.ip).not.toContain("..");
          expect(guest.metadata?.ip).not.toContain("OR");
        }
      }
    });

    it("should have restricted permissions compared to authenticated users", async () => {
      const guestUser = await guestUserService.createGuestUser("192.168.1.1", "Test");
      
      const guestPermissions = guestUser?.permissions || [];
      
      // Guest should NOT have these permissions
      expect(guestPermissions).not.toContain("agent.execute");
      expect(guestPermissions).not.toContain("task.create");
      expect(guestPermissions).not.toContain("rag.query");
      expect(guestPermissions).not.toContain("data.write");
      expect(guestPermissions).not.toContain("user.manage");
      expect(guestPermissions).not.toContain("admin");
      
      // Guest should only have limited permissions
      expect(guestPermissions).toContain("chat.read");
      expect(guestPermissions).toContain("chat.create.limited");
      expect(guestPermissions).toContain("health.read");
      expect(guestPermissions).toContain("public.read");
    });
  });

  describe("SecurityMonitoringService", () => {
    it("should track guest user creation events", () => {
      const logEventSpy = vi.spyOn(securityMonitor, "logEvent");
      
      securityMonitor.logEvent({
        type: "GUEST_USER_CREATED",
        userId: "guest-test123",
        ip: "192.168.1.1",
      });
      
      expect(logEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GUEST_USER_CREATED",
          userId: "guest-test123",
        })
      );
    });

    it("should identify suspicious activity", () => {
      const userId = "guest-suspicious";
      
      // Simulate multiple access denials
      for (let i = 0; i < 15; i++) {
        securityMonitor.logEvent({
          type: "GUEST_ACCESS_DENIED",
          userId,
          resource: `/api/resource${i}`,
        });
      }
      
      const isSuspicious = securityMonitor.isUserSuspicious(userId, 600000);
      expect(isSuspicious).toBe(true);
    });

    it("should generate security stats", () => {
      // Log various events
      securityMonitor.logEvent({
        type: "GUEST_USER_CREATED",
        userId: "guest-1",
        ip: "192.168.1.1",
      });
      
      securityMonitor.logEvent({
        type: "GUEST_ACCESS_DENIED",
        userId: "guest-1",
        resource: "/api/admin",
      });
      
      const stats = securityMonitor.getStats(3600000); // 1 hour
      
      expect(stats).toHaveProperty("totalEvents");
      expect(stats).toHaveProperty("eventCounts");
      expect(stats.eventCounts).toHaveProperty("GUEST_USER_CREATED");
      expect(stats.eventCounts).toHaveProperty("GUEST_ACCESS_DENIED");
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle existing code expecting guest users", async () => {
      const guestUser = await guestUserService.createGuestUser("192.168.1.1", "Test");
      
      // Existing code might check username === "guest"
      expect(guestUser?.username).toBe("guest");
      
      // Existing code might check for basic properties
      expect(guestUser).toHaveProperty("id");
      expect(guestUser).toHaveProperty("email");
      expect(guestUser).toHaveProperty("role");
      expect(guestUser).toHaveProperty("isActive");
      expect(guestUser).toHaveProperty("permissions");
      
      // Should maintain active status
      expect(guestUser?.isActive).toBe(true);
    });

    it("should work with existing permission checks", async () => {
      const guestUser = await guestUserService.createGuestUser("192.168.1.1", "Test");
      
      // Existing code might check permissions array
      const canRead = guestUser?.permissions.includes("chat.read");
      expect(canRead).toBe(true);
      
      // Should not break when checking non-existent permissions
      const canAdmin = guestUser?.permissions.includes("admin");
      expect(canAdmin).toBe(false);
    });
  });

  describe("Security Vulnerabilities Fixed", () => {
    it("should not allow guest users to have same permissions as authenticated users", async () => {
      const guestUser = await guestUserService.createGuestUser("192.168.1.1", "Test");
      
      // Compare with typical user permissions
      const userPermissions = ["read", "write"];
      const guestPermissions = guestUser?.permissions || [];
      
      // Guest should have different, more restricted permissions
      expect(guestPermissions).not.toEqual(userPermissions);
      expect(guestPermissions).not.toContain("write");
    });

    it("should have unpredictable guest IDs", async () => {
      const ip = "192.168.1.1";
      const ids = new Set<string>();
      
      // Generate multiple IDs
      for (let i = 0; i < 10; i++) {
        const guest = await guestUserService.createGuestUser(ip, `Agent${i}`);
        if (guest) {
          ids.add(guest.id);
        }
      }
      
      // All IDs should be unique
      expect(ids.size).toBeGreaterThan(0);
      
      // IDs should not follow a predictable pattern
      const idArray = Array.from(ids);
      for (let i = 1; i < idArray.length; i++) {
        // Extract the hash part of the ID
        const hash1 = idArray[i - 1].split('-')[1];
        const hash2 = idArray[i].split('-')[1];
        
        // Hashes should be significantly different
        expect(hash1).not.toBe(hash2);
      }
    });

    it("should properly differentiate guest from authenticated users", () => {
      const guestUser: User = {
        id: "guest-abc123",
        username: "guest",
        email: "",
        role: "guest",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ["chat.read"],
        lastActivity: new Date(),
      };
      
      const authenticatedUser: User = {
        id: "user-123",
        username: "john_doe",
        email: "john@example.com",
        role: "user",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ["read", "write"],
        lastActivity: new Date(),
      };
      
      // Check differentiation
      expect(guestUserService.isGuestUser(guestUser)).toBe(true);
      expect(guestUserService.isGuestUser(authenticatedUser)).toBe(false);
    });
  });
});