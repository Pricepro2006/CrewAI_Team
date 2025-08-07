#!/usr/bin/env tsx

/**
 * Browser Compatibility Test Runner
 * Automated parallel execution of browser compatibility tests
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface TestResult {
  browser: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  exitCode: number;
}

interface TestConfig {
  browsers: string[];
  parallel: boolean;
  headless: boolean;
  timeout: number;
  retries: number;
  outputDir: string;
}

class BrowserCompatibilityTestRunner {
  private config: TestConfig;
  private results: Map<string, TestResult> = new Map();
  private startTime: number = 0;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      browsers: ['chrome-desktop', 'firefox-desktop', 'safari-desktop', 'edge-desktop'],
      parallel: true,
      headless: true,
      timeout: 300000, // 5 minutes per browser
      retries: 1,
      outputDir: 'browser-compatibility-results',
      ...config
    };
  }

  async run(): Promise<void> {
    console.log(chalk.cyan.bold('🚀 Starting Browser Compatibility Test Suite'));
    console.log(chalk.gray(`Configuration:`));
    console.log(chalk.gray(`  Browsers: ${this.config.browsers.join(', ')}`));
    console.log(chalk.gray(`  Parallel: ${this.config.parallel}`));
    console.log(chalk.gray(`  Headless: ${this.config.headless}`));
    console.log(chalk.gray(`  Timeout: ${this.config.timeout / 1000}s per browser`));
    console.log('');

    this.startTime = Date.now();

    // Ensure output directory exists
    await this.ensureOutputDir();

    // Check prerequisites
    await this.checkPrerequisites();

    // Run tests
    if (this.config.parallel) {
      await this.runParallel();
    } else {
      await this.runSequential();
    }

    // Generate reports
    await this.generateReports();

    // Display summary
    this.displaySummary();
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.config.outputDir, { recursive: true });
      
      // Create browser-specific directories
      for (const browser of this.config.browsers) {
        const browserName = browser.split('-')[0];
        await fs.promises.mkdir(
          path.join(this.config.outputDir, browserName), 
          { recursive: true }
        );
      }
      
      console.log(chalk.green(`✅ Output directory prepared: ${this.config.outputDir}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create output directory:`, error));
      process.exit(1);
    }
  }

  private async checkPrerequisites(): Promise<void> {
    console.log(chalk.yellow('🔍 Checking prerequisites...'));

    // Check if Playwright is installed
    try {
      const { execSync } = require('child_process');
      execSync('npx playwright --version', { stdio: 'pipe' });
      console.log(chalk.green('✅ Playwright is installed'));
    } catch {
      console.error(chalk.red('❌ Playwright not found. Run: npm install @playwright/test'));
      process.exit(1);
    }

    // Check if browsers are installed
    for (const browser of this.config.browsers) {
      const browserName = browser.split('-')[0];
      try {
        const { execSync } = require('child_process');
        execSync(`npx playwright install ${browserName}`, { stdio: 'pipe' });
        console.log(chalk.green(`✅ ${browserName} browser available`));
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ ${browserName} may not be installed`));
      }
    }

    // Check if server is running
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        console.log(chalk.green('✅ Development server is running'));
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Development server may not be running on port 5173'));
      console.warn(chalk.yellow('   Tests will attempt to start the server automatically'));
    }

    console.log('');
  }

  private async runParallel(): Promise<void> {
    console.log(chalk.cyan('🔄 Running tests in parallel...'));
    
    const promises = this.config.browsers.map(browser => this.runBrowserTest(browser));
    await Promise.allSettled(promises);
  }

  private async runSequential(): Promise<void> {
    console.log(chalk.cyan('🔄 Running tests sequentially...'));
    
    for (const browser of this.config.browsers) {
      await this.runBrowserTest(browser);
    }
  }

  private async runBrowserTest(browser: string): Promise<void> {
    const browserName = browser.split('-')[0];
    const startTime = Date.now();
    
    console.log(chalk.blue(`\n🌐 Testing ${browserName}...`));

    return new Promise((resolve) => {
      const args = [
        'test',
        `--project=${browser}`,
        '--reporter=json',
        `--output-dir=test-results-${browserName}`,
        this.config.headless ? '--headless' : '--headed',
        `--timeout=${this.config.timeout}`,
        `--retries=${this.config.retries}`
      ];

      const playwrightProcess = spawn('npx', ['playwright', ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TEST_BASE_URL: 'http://localhost:5173',
          BROWSER_NAME: browserName
        }
      });

      let stdout = '';
      let stderr = '';

      playwrightProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      playwrightProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        console.log(chalk.red(`⏰ ${browserName} tests timed out`));
        playwrightProcess.kill();
      }, this.config.timeout + 10000); // Add 10s buffer

      playwrightProcess.on('close', async (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        // Parse results from stdout
        const result = await this.parseTestResults(browserName, stdout, stderr, code || 0, duration);
        this.results.set(browser, result);

        if (code === 0) {
          console.log(chalk.green(`✅ ${browserName} tests completed successfully`));
        } else {
          console.log(chalk.red(`❌ ${browserName} tests failed (exit code: ${code})`));
        }

        // Save raw output
        await this.saveTestOutput(browserName, stdout, stderr);

        resolve();
      });

      playwrightProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(chalk.red(`❌ Failed to run ${browserName} tests:`), error.message);
        
        const result: TestResult = {
          browser: browserName,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: Date.now() - startTime,
          exitCode: 1
        };
        
        this.results.set(browser, result);
        resolve();
      });
    });
  }

  private async parseTestResults(
    browser: string, 
    stdout: string, 
    stderr: string, 
    exitCode: number,
    duration: number
  ): Promise<TestResult> {
    const result: TestResult = {
      browser,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      exitCode
    };

    try {
      // Try to parse JSON output
      const lines = stdout.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('stats'));
      
      if (jsonLine) {
        const testResults = JSON.parse(jsonLine);
        
        if (testResults.stats) {
          result.passed = testResults.stats.expected || 0;
          result.failed = testResults.stats.unexpected || 0;
          result.skipped = testResults.stats.skipped || 0;
        }
      } else {
        // Fall back to parsing text output
        const passedMatch = stdout.match(/(\d+) passed/);
        const failedMatch = stdout.match(/(\d+) failed/);
        const skippedMatch = stdout.match(/(\d+) skipped/);

        result.passed = passedMatch ? parseInt(passedMatch[1]) : 0;
        result.failed = failedMatch ? parseInt(failedMatch[1]) : 0;
        result.skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not parse test results for ${browser}`));
      
      // If parsing fails but exit code is 0, assume some tests passed
      if (exitCode === 0) {
        result.passed = 1;
      } else {
        result.failed = 1;
      }
    }

    return result;
  }

  private async saveTestOutput(browser: string, stdout: string, stderr: string): Promise<void> {
    try {
      const outputPath = path.join(this.config.outputDir, browser);
      
      await fs.promises.writeFile(
        path.join(outputPath, 'stdout.log'),
        stdout
      );
      
      await fs.promises.writeFile(
        path.join(outputPath, 'stderr.log'),
        stderr
      );
      
      // Save timestamp
      await fs.promises.writeFile(
        path.join(outputPath, 'timestamp.txt'),
        new Date().toISOString()
      );
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not save output for ${browser}:`, error));
    }
  }

  private async generateReports(): Promise<void> {
    console.log(chalk.cyan('\n📊 Generating compatibility reports...'));

    const summary = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      browserResults: {} as Record<string, TestResult>,
      overallStats: {
        totalPassed: 0,
        totalFailed: 0,
        totalSkipped: 0,
        successRate: 0,
        browsersWithIssues: [] as string[]
      }
    };

    // Collect results
    this.results.forEach((result, browser) => {
      summary.browserResults[browser] = result;
      summary.overallStats.totalPassed += result.passed;
      summary.overallStats.totalFailed += result.failed;
      summary.overallStats.totalSkipped += result.skipped;

      if (result.failed > 0 || result.exitCode !== 0) {
        summary.overallStats.browsersWithIssues.push(result.browser);
      }
    });

    const totalTests = summary.overallStats.totalPassed + summary.overallStats.totalFailed;
    summary.overallStats.successRate = totalTests > 0 
      ? Math.round((summary.overallStats.totalPassed / totalTests) * 100)
      : 0;

    // Save JSON report
    await fs.promises.writeFile(
      path.join(this.config.outputDir, 'compatibility-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Generate markdown report
    await this.generateMarkdownReport(summary);

    console.log(chalk.green('✅ Reports generated'));
  }

  private async generateMarkdownReport(summary: any): Promise<void> {
    let markdown = `# Browser Compatibility Test Report

Generated: ${new Date(summary.timestamp).toLocaleString()}  
Duration: ${Math.round(summary.totalDuration / 1000)}s

## Overall Results

- **Success Rate**: ${summary.overallStats.successRate}%
- **Total Passed**: ${summary.overallStats.totalPassed}
- **Total Failed**: ${summary.overallStats.totalFailed}
- **Total Skipped**: ${summary.overallStats.totalSkipped}

## Browser Results

| Browser | Passed | Failed | Skipped | Duration | Status |
|---------|--------|---------|---------|----------|--------|
`;

    Object.entries(summary.browserResults).forEach(([browser, result]: [string, any]) => {
      const status = result.exitCode === 0 && result.failed === 0 ? '✅' : '❌';
      const duration = Math.round(result.duration / 1000);
      
      markdown += `| ${result.browser} | ${result.passed} | ${result.failed} | ${result.skipped} | ${duration}s | ${status} |\n`;
    });

    if (summary.overallStats.browsersWithIssues.length > 0) {
      markdown += `\n## Browsers with Issues

The following browsers had test failures or errors:

`;
      summary.overallStats.browsersWithIssues.forEach((browser: string) => {
        markdown += `- **${browser}**: Check detailed logs in \`${this.config.outputDir}/${browser}/\`\n`;
      });
    }

    markdown += `\n## Recommendations

${summary.overallStats.successRate >= 95
  ? '🎉 Excellent compatibility! All major browsers are well supported.'
  : summary.overallStats.successRate >= 80
  ? '⚠️ Good compatibility with some issues. Review failed tests for improvements.'
  : '❌ Significant compatibility issues detected. Immediate attention required.'
}

## Next Steps

1. Review detailed test results in the \`browser-compatibility-report/\` directory
2. Address any failing tests, prioritizing widely-used browsers
3. Consider implementing polyfills for unsupported features
4. Run tests regularly in your CI/CD pipeline

---
*Generated by Browser Compatibility Test Suite*
`;

    await fs.promises.writeFile(
      path.join(this.config.outputDir, 'COMPATIBILITY_REPORT.md'),
      markdown
    );
  }

  private displaySummary(): void {
    const totalDuration = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log(chalk.cyan.bold('\n🏁 Browser Compatibility Test Summary'));
    console.log(chalk.gray('='.repeat(50)));
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    this.results.forEach((result) => {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;

      const status = result.exitCode === 0 && result.failed === 0
        ? chalk.green('✅ PASS')
        : chalk.red('❌ FAIL');
      
      const duration = Math.round(result.duration / 1000);
      
      console.log(`${status} ${chalk.bold(result.browser.padEnd(10))} | ` +
        `${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped | ${duration}s`);
    });

    const totalTests = totalPassed + totalFailed;
    const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    console.log(chalk.gray('-'.repeat(50)));
    console.log(chalk.bold(`Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`));
    console.log(chalk.bold(`Success Rate: ${successRate}%`));
    console.log(chalk.bold(`Duration: ${totalDuration}s`));
    
    if (successRate >= 95) {
      console.log(chalk.green.bold('\n🎉 Excellent browser compatibility!'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow.bold('\n⚠️  Good compatibility with some issues'));
    } else {
      console.log(chalk.red.bold('\n❌ Significant compatibility issues detected'));
    }

    console.log(chalk.cyan(`\n📊 Detailed reports: ${this.config.outputDir}/`));
    console.log(chalk.cyan(`📝 Summary report: ${this.config.outputDir}/COMPATIBILITY_REPORT.md`));

    // Exit with error code if there were failures
    const hasFailures = Array.from(this.results.values()).some(r => r.failed > 0 || r.exitCode !== 0);
    if (hasFailures) {
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const config: Partial<TestConfig> = {
    parallel: !args.includes('--sequential'),
    headless: !args.includes('--headed'),
    browsers: []
  };

  // Parse browser selection
  if (args.includes('--chrome-only')) {
    config.browsers = ['chrome-desktop'];
  } else if (args.includes('--firefox-only')) {
    config.browsers = ['firefox-desktop'];
  } else if (args.includes('--safari-only')) {
    config.browsers = ['safari-desktop'];
  } else if (args.includes('--edge-only')) {
    config.browsers = ['edge-desktop'];
  }

  // Parse timeout
  const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
  if (timeoutArg) {
    config.timeout = parseInt(timeoutArg.split('=')[1]) * 1000;
  }

  const runner = new BrowserCompatibilityTestRunner(config);
  
  try {
    await runner.run();
  } catch (error) {
    console.error(chalk.red('❌ Test runner failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { BrowserCompatibilityTestRunner };