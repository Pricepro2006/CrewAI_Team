/**
 * Type Guards Test Suite
 * Tests type guard utility functions
 */

import { describe, it, expect } from "vitest";

// Mock type guard functions that might exist in the codebase
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

interface Email {
  id: string;
  subject: string;
  body: string;
  timestamp: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Type guard functions
const isUser = (obj: unknown): obj is User => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as User).id === "string" &&
    typeof (obj as User).name === "string" &&
    typeof (obj as User).email === "string" &&
    ["admin", "user", "guest"].includes((obj as User).role)
  );
};

const isEmail = (obj: unknown): obj is Email => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Email).id === "string" &&
    typeof (obj as Email).subject === "string" &&
    typeof (obj as Email).body === "string" &&
    typeof (obj as Email).timestamp === "string"
  );
};

const isApiResponse = <T>(obj: unknown): obj is ApiResponse<T> => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as ApiResponse).success === "boolean"
  );
};

const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

const isNumber = (value: unknown): value is number => {
  return typeof value === "number" && !isNaN(value);
};

const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

const isNonEmptyString = (value: unknown): value is string => {
  return isString(value) && value.trim().length > 0;
};

const isValidEmail = (value: unknown): value is string => {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

describe("Type Guards", () => {
  describe("User Type Guard", () => {
    it("should validate valid user objects", () => {
      const validUser: User = {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
        role: "user",
      };

      expect(isUser(validUser)).toBe(true);
    });

    it("should reject invalid user objects", () => {
      const invalidUsers = [
        null,
        undefined,
        {},
        { id: "user-1" }, // Missing fields
        { id: "user-1", name: "John", email: "john@example.com", role: "invalid" },
        { id: 123, name: "John", email: "john@example.com", role: "user" }, // Wrong type
      ];

      invalidUsers.forEach((user: any) => {
        expect(isUser(user)).toBe(false);
      });
    });

    it("should validate all valid user roles", () => {
      const roles: User["role"][] = ["admin", "user", "guest"];

      roles.forEach((role: any) => {
        const user = {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          role,
        };
        expect(isUser(user)).toBe(true);
      });
    });
  });

  describe("Email Type Guard", () => {
    it("should validate valid email objects", () => {
      const validEmail: Email = {
        id: "email-1",
        subject: "Test Subject",
        body: "Test email body",
        timestamp: "2025-01-20T10:00:00Z",
      };

      expect(isEmail(validEmail)).toBe(true);
    });

    it("should reject invalid email objects", () => {
      const invalidEmails = [
        null,
        undefined,
        {},
        { id: "email-1" }, // Missing fields
        { id: 123, subject: "Test", body: "Test", timestamp: "2025-01-01" }, // Wrong type
      ];

      invalidEmails.forEach((email: any) => {
        expect(isEmail(email)).toBe(false);
      });
    });
  });

  describe("API Response Type Guard", () => {
    it("should validate valid API responses", () => {
      const validResponses = [
        { success: true, data: { result: "test" } },
        { success: false, error: "Something went wrong" },
        { success: true },
      ];

      validResponses.forEach((response: any) => {
        expect(isApiResponse(response)).toBe(true);
      });
    });

    it("should reject invalid API responses", () => {
      const invalidResponses = [
        null,
        undefined,
        {},
        { success: "true" }, // Wrong type
        { data: "test" }, // Missing success field
      ];

      invalidResponses.forEach((response: any) => {
        expect(isApiResponse(response)).toBe(false);
      });
    });
  });

  describe("Primitive Type Guards", () => {
    it("should validate strings", () => {
      expect(isString("hello")).toBe(true);
      expect(isString("")).toBe(true);
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });

    it("should validate numbers", () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-1)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber("123")).toBe(false);
      expect(isNumber(null)).toBe(false);
    });

    it("should validate arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(["a", "b"])).toBe(true);
      expect(isArray({})).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray("array")).toBe(false);
    });
  });

  describe("Specialized Type Guards", () => {
    it("should validate non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("a")).toBe(true);
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
    });

    it("should validate email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain?.co?.uk",
        "user+tag@example.org",
      ];

      const invalidEmails = [
        "invalid-email",
        "@example.com",
        "user@",
        "user space@example.com",
        "",
        123,
        null,
      ];

      validEmails.forEach((email: any) => {
        expect(isValidEmail(email)).toBe(true);
      });

      invalidEmails.forEach((email: any) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe("Type Guard Composition", () => {
    it("should work with type narrowing", () => {
      const processValue = (value: unknown): string => {
        if (isString(value)) {
          // TypeScript should now know value is a string
          return value.toUpperCase();
        }
        if (isNumber(value)) {
          // TypeScript should now know value is a number
          return value.toString();
        }
        return "unknown";
      };

      expect(processValue("hello")).toBe("HELLO");
      expect(processValue(123)).toBe("123");
      expect(processValue(null)).toBe("unknown");
    });

    it("should work with array type guards", () => {
      const processArray = (value: unknown): number => {
        if (isArray<string>(value)) {
          // TypeScript should know this is string[]
          return value?.length || 0;
        }
        return 0;
      };

      expect(processArray(["a", "b", "c"])).toBe(3);
      expect(processArray([])).toBe(0);
      expect(processArray("not an array")).toBe(0);
    });
  });
});