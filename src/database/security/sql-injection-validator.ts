/**
 * SQL Injection Security Validator
 * Validates all database queries in the codebase for SQL injection vulnerabilities
 */

import { glob } from "glob";
import { readFileSync } from "fs";
import { logger } from "../../utils/logger.js";

interface VulnerabilityReport {
  file: string;
  line: number;
  code: string;
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

export class SqlInjectionValidator {
  private vulnerabilities: VulnerabilityReport[] = [];

  // Patterns that indicate potential SQL injection vulnerabilities
  private readonly VULNERABILITY_PATTERNS = [
    {
      pattern: /query\s*\+\s*['"`]/g,
      issue: "String concatenation in SQL query",
      severity: "critical" as const,
      recommendation:
        "Use parameterized queries with placeholders (?) instead of string concatenation",
    },
    {
      pattern: /sql\s*\+\s*['"`]/g,
      issue: "SQL string concatenation",
      severity: "critical" as const,
      recommendation: "Use prepared statements with parameter binding",
    },
    {
      pattern: /WHERE\s+.*\$\{[^}]+\}/g,
      issue: "Template literal in WHERE clause",
      severity: "critical" as const,
      recommendation: "Replace template literals with parameterized queries",
    },
    {
      pattern: /SELECT.*FROM.*WHERE.*\+/g,
      issue: "Possible string concatenation in WHERE clause",
      severity: "high" as const,
      recommendation: "Verify that WHERE conditions use parameter binding",
    },
    {
      pattern: /\.exec\s*\(\s*[`'"].*\$\{/g,
      issue: "Template literal in exec() call",
      severity: "critical" as const,
      recommendation:
        "Use prepare() with parameters instead of exec() with interpolation",
    },
    {
      pattern: /new\s+RegExp\s*\(\s*.*user.*input/gi,
      issue: "User input in RegExp construction",
      severity: "high" as const,
      recommendation: "Escape user input before using in RegExp",
    },
    {
      pattern: /eval\s*\(/g,
      issue: "Use of eval() function",
      severity: "critical" as const,
      recommendation: "Never use eval() with user input",
    },
  ];

  // Patterns that indicate safe SQL practices
  private readonly SAFE_PATTERNS = [
    /\.prepare\s*\(/g,
    /\?\s*,\s*\?/g, // Multiple placeholders
    /VALUES\s*\(\s*\?/g,
    /WHERE\s+\w+\s*=\s*\?/g,
    /@\w+/g, // Named parameters
  ];

  /**
   * Validate all SQL queries in the codebase
   */
  async validateCodebase(rootPath: string = "src"): Promise<void> {
    logger.info("Starting SQL injection security validation", "SQL_VALIDATOR");

    const files = await glob(`${rootPath}/**/*.{ts,js}`, {
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    });

    for (const file of files) {
      await this.validateFile(file);
    }

    this.generateReport();
  }

  /**
   * Validate a single file for SQL injection vulnerabilities
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Skip files without database operations
      if (!this.hasDbOperations(content)) {
        return;
      }

      lines.forEach((line, index) => {
        this.validateLine(line, index + 1, filePath);
      });
    } catch (error) {
      logger.error(`Failed to validate file: ${filePath}`, "SQL_VALIDATOR", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if file contains database operations
   */
  private hasDbOperations(content: string): boolean {
    const dbPatterns = [
      /\.prepare\(/,
      /\.exec\(/,
      /\.run\(/,
      /\.get\(/,
      /\.all\(/,
      /SELECT/i,
      /INSERT/i,
      /UPDATE/i,
      /DELETE/i,
      /database/i,
      /repository/i,
    ];

    return dbPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Validate a single line of code
   */
  private validateLine(
    line: string,
    lineNumber: number,
    filePath: string,
  ): void {
    // Skip comments and empty lines
    if (
      line.trim().startsWith("//") ||
      line.trim().startsWith("*") ||
      !line.trim()
    ) {
      return;
    }

    // Check for vulnerabilities
    for (const vulnPattern of this.VULNERABILITY_PATTERNS) {
      if (vulnPattern.pattern.test(line)) {
        // Check if it's actually safe despite matching the pattern
        if (!this.isSafeDespitePattern(line)) {
          this.vulnerabilities.push({
            file: filePath,
            line: lineNumber,
            code: line.trim(),
            issue: vulnPattern.issue,
            severity: vulnPattern.severity,
            recommendation: vulnPattern.recommendation,
          });
        }
      }
    }
  }

  /**
   * Check if code is safe despite matching vulnerability pattern
   */
  private isSafeDespitePattern(line: string): boolean {
    // Check for safe patterns in the same line
    return this.SAFE_PATTERNS.some((pattern) => pattern.test(line));
  }

  /**
   * Generate and display vulnerability report
   */
  private generateReport(): void {
    if (this.vulnerabilities.length === 0) {
      logger.info(
        "✅ No SQL injection vulnerabilities found!",
        "SQL_VALIDATOR",
      );
      return;
    }

    logger.warn(
      `Found ${this.vulnerabilities.length} potential SQL injection vulnerabilities`,
      "SQL_VALIDATOR",
    );

    // Group by severity
    const critical = this.vulnerabilities.filter(
      (v) => v.severity === "critical",
    );
    const high = this.vulnerabilities.filter((v) => v.severity === "high");
    const medium = this.vulnerabilities.filter((v) => v.severity === "medium");
    const low = this.vulnerabilities.filter((v) => v.severity === "low");

    console.log("\n=== SQL INJECTION VULNERABILITY REPORT ===\n");

    if (critical.length > 0) {
      console.log(`\n🔴 CRITICAL (${critical.length}):`);
      critical.forEach(this.printVulnerability);
    }

    if (high.length > 0) {
      console.log(`\n🟠 HIGH (${high.length}):`);
      high.forEach(this.printVulnerability);
    }

    if (medium.length > 0) {
      console.log(`\n🟡 MEDIUM (${medium.length}):`);
      medium.forEach(this.printVulnerability);
    }

    if (low.length > 0) {
      console.log(`\n🟢 LOW (${low.length}):`);
      low.forEach(this.printVulnerability);
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Total vulnerabilities: ${this.vulnerabilities.length}`);
    console.log(`Critical: ${critical.length}`);
    console.log(`High: ${high.length}`);
    console.log(`Medium: ${medium.length}`);
    console.log(`Low: ${low.length}`);
    console.log("\n=== RECOMMENDATIONS ===");
    console.log("1. Always use parameterized queries with ? placeholders");
    console.log("2. Use prepare() instead of exec() for dynamic queries");
    console.log(
      "3. Validate and sanitize all user input before using in queries",
    );
    console.log(
      "4. Use the SqlInjectionProtection class for additional validation",
    );
    console.log("5. Review and test all database operations thoroughly");
  }

  /**
   * Print a single vulnerability
   */
  private printVulnerability(vuln: VulnerabilityReport): void {
    console.log(`\nFile: ${vuln.file}:${vuln.line}`);
    console.log(`Issue: ${vuln.issue}`);
    console.log(`Code: ${vuln.code}`);
    console.log(`Recommendation: ${vuln.recommendation}`);
  }

  /**
   * Get vulnerabilities for testing
   */
  getVulnerabilities(): VulnerabilityReport[] {
    return this.vulnerabilities;
  }
}

// Export for use in scripts
export async function runSqlInjectionValidation(): Promise<void> {
  const validator = new SqlInjectionValidator();
  await validator.validateCodebase();
}
