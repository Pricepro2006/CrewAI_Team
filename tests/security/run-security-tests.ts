#!/usr/bin/env tsx
/**
 * Security Test Runner
 * Comprehensive security test suite runner for CI/CD integration
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  coverage?: number;
}

interface SecurityTestReport {
  timestamp: string;
  environment: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  overallResult: 'PASS' | 'FAIL';
  testResults: TestResult[];
  criticalIssues: string[];
  recommendations: string[];
  executionTime: number;
}

class SecurityTestRunner {
  private report: SecurityTestReport;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      overallResult: 'PASS',
      testResults: [],
      criticalIssues: [],
      recommendations: [],
      executionTime: 0
    };
  }

  private async runTest(testName: string, command: string): Promise<TestResult> {
    const testStart = Date.now();
    console.log(`\n🔒 Running ${testName}...`);
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000 // 2 minutes timeout
      });
      
      const duration = Date.now() - testStart;
      console.log(`✅ ${testName} passed (${duration}ms)`);
      
      return {
        name: testName,
        passed: true,
        duration,
        coverage: this.extractCoverage(output)
      };
    } catch (error: any) {
      const duration = Date.now() - testStart;
      console.log(`❌ ${testName} failed (${duration}ms)`);
      console.error(error.stdout || error.message);
      
      return {
        name: testName,
        passed: false,
        duration,
        error: error.stdout || error.message
      };
    }
  }

  private extractCoverage(output: string): number | undefined {
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    return coverageMatch ? parseFloat(coverageMatch[1]) : undefined;
  }

  private analyzeCriticalIssues(): void {
    const failedTests = this.report.testResults.filter(test => !test.passed);
    
    failedTests.forEach(test => {
      if (test.name.includes('authentication')) {
        this.report.criticalIssues.push('CRITICAL: Authentication security vulnerabilities detected');
      }
      if (test.name.includes('websocket') && test.error?.includes('unauthorized')) {
        this.report.criticalIssues.push('CRITICAL: WebSocket accepts unauthorized connections');
      }
      if (test.name.includes('input-validation') && test.error?.includes('SQL injection')) {
        this.report.criticalIssues.push('CRITICAL: SQL injection vulnerabilities detected');
      }
      if (test.name.includes('headers') && test.error?.includes('X-Frame-Options')) {
        this.report.criticalIssues.push('HIGH: Missing security headers detected');
      }
      if (test.name.includes('rate-limiting')) {
        this.report.criticalIssues.push('MEDIUM: Rate limiting not properly configured');
      }
    });
  }

  private generateRecommendations(): void {
    const failedTests = this.report.testResults.filter(test => !test.passed);
    
    if (failedTests.length === 0) {
      this.report.recommendations.push('All security tests passed. Continue regular security testing.');
      return;
    }

    this.report.recommendations.push('Immediate Actions Required:');
    
    if (failedTests.some(test => test.name.includes('authentication'))) {
      this.report.recommendations.push('- Review and strengthen JWT authentication implementation');
      this.report.recommendations.push('- Implement proper token validation and expiry handling');
    }
    
    if (failedTests.some(test => test.name.includes('websocket'))) {
      this.report.recommendations.push('- Implement WebSocket authentication before accepting connections');
      this.report.recommendations.push('- Add rate limiting and message validation for WebSocket connections');
    }
    
    if (failedTests.some(test => test.name.includes('input-validation'))) {
      this.report.recommendations.push('- Implement parameterized queries to prevent SQL injection');
      this.report.recommendations.push('- Add input sanitization for all user inputs');
      this.report.recommendations.push('- Validate and escape all data before database operations');
    }
    
    if (failedTests.some(test => test.name.includes('headers'))) {
      this.report.recommendations.push('- Configure security headers (CSP, HSTS, X-Frame-Options)');
      this.report.recommendations.push('- Remove information disclosure headers (X-Powered-By, Server)');
    }
    
    if (failedTests.some(test => test.name.includes('rate-limiting'))) {
      this.report.recommendations.push('- Implement rate limiting for API endpoints');
      this.report.recommendations.push('- Configure authentication rate limiting to prevent brute force attacks');
    }

    this.report.recommendations.push('');
    this.report.recommendations.push('General Security Improvements:');
    this.report.recommendations.push('- Regular security audits and penetration testing');
    this.report.recommendations.push('- Implement automated security scanning in CI/CD pipeline');
    this.report.recommendations.push('- Monitor and log security events');
    this.report.recommendations.push('- Keep dependencies updated and scan for vulnerabilities');
  }

  private saveReport(): void {
    const reportsDir = join(process.cwd(), 'tests/security/reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(reportsDir, `security-test-report-${timestamp}.json`);
    
    writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    
    // Also save a latest report
    const latestReportPath = join(reportsDir, 'latest-security-report.json');
    writeFileSync(latestReportPath, JSON.stringify(this.report, null, 2));
    
    console.log(`\n📊 Security test report saved to: ${reportPath}`);
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔒 SECURITY TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Environment: ${this.report.environment}`);
    console.log(`Timestamp: ${this.report.timestamp}`);
    console.log(`Execution Time: ${this.report.executionTime}ms`);
    console.log('');
    console.log(`Total Tests: ${this.report.totalTests}`);
    console.log(`✅ Passed: ${this.report.passedTests}`);
    console.log(`❌ Failed: ${this.report.failedTests}`);
    console.log(`⏭️ Skipped: ${this.report.skippedTests}`);
    console.log(`Overall Result: ${this.report.overallResult}`);

    if (this.report.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL SECURITY ISSUES:');
      this.report.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (this.report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('\n' + '='.repeat(80));
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Walmart Grocery Agent Security Test Suite');
    console.log(`Environment: ${this.report.environment}`);
    console.log(`Timestamp: ${this.report.timestamp}`);

    const tests = [
      {
        name: 'Authentication Security',
        command: 'vitest run tests/security/authentication.test.ts --reporter=verbose'
      },
      {
        name: 'Input Validation Security',
        command: 'vitest run tests/security/input-validation.test.ts --reporter=verbose'
      },
      {
        name: 'Rate Limiting Security',
        command: 'vitest run tests/security/rate-limiting.test.ts --reporter=verbose'
      },
      {
        name: 'WebSocket Security',
        command: 'vitest run tests/security/websocket-security.test.ts --reporter=verbose'
      },
      {
        name: 'Security Headers',
        command: 'vitest run tests/security/security-headers.test.ts --reporter=verbose'
      }
    ];

    this.report.totalTests = tests.length;

    for (const test of tests) {
      const result = await this.runTest(test.name, test.command);
      this.report.testResults.push(result);
      
      if (result.passed) {
        this.report.passedTests++;
      } else {
        this.report.failedTests++;
      }
    }

    this.report.executionTime = Date.now() - this.startTime;
    this.report.overallResult = this.report.failedTests === 0 ? 'PASS' : 'FAIL';

    this.analyzeCriticalIssues();
    this.generateRecommendations();
    this.saveReport();
    this.printSummary();

    // Exit with error code if tests failed (for CI/CD)
    if (this.report.overallResult === 'FAIL') {
      process.exit(1);
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new SecurityTestRunner();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Security Test Runner for Walmart Grocery Agent

Usage:
  npm run test:security:ci     # Run all security tests with CI output
  tsx tests/security/run-security-tests.ts

Options:
  --help, -h                   Show this help message

Environment Variables:
  NODE_ENV                     Set environment (test, development, production)
  CI                          Set to 'true' for CI mode

Examples:
  # Run all security tests
  tsx tests/security/run-security-tests.ts
  
  # Run in CI mode
  CI=true tsx tests/security/run-security-tests.ts
    `);
    return;
  }

  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Fatal error running security tests:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { SecurityTestRunner };