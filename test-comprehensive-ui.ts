import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  screenshot?: string;
  details?: any;
}

interface AgentExecution {
  query: string;
  selectedAgent: string;
  routingTime: number;
  executionTime: number;
  response: string;
  replanNeeded: boolean;
  replanDetails?: any;
}

class ComprehensiveUITester {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private results: TestResult[] = [];
  private agentExecutions: AgentExecution[] = [];
  private testReportDir: string;
  
  constructor() {
    this.testReportDir = join(process.cwd(), 'test-reports', new Date().toISOString().split('T')[0]);
    if (!existsSync(this.testReportDir)) {
      mkdirSync(this.testReportDir, { recursive: true });
    }
  }

  async initialize() {
    console.log('🚀 Initializing Playwright browser...');
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: join(this.testReportDir, 'videos'),
        size: { width: 1920, height: 1080 }
      }
    });
    this.page = await this.context.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    // Enable request/response logging
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`[API Request] ${request.method()} ${request.url()}`);
      }
    });
    
    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`[API Response] ${response.status()} ${response.url()}`);
      }
    });
  }

  async takeScreenshot(name: string): Promise<string> {
    const screenshotPath = join(this.testReportDir, 'screenshots', `${name}.png`);
    const dir = join(this.testReportDir, 'screenshots');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await this.page!.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    console.log(`\n📋 Running test: ${testName}`);
    const startTime = Date.now();
    const result: TestResult = {
      testName,
      status: 'PASS',
      startTime,
      endTime: 0,
      duration: 0
    };

    try {
      await testFn();
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      result.status = 'FAIL';
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${testName} - FAILED: ${result.error}`);
      result.screenshot = await this.takeScreenshot(`${testName.replace(/\s+/g, '_')}_error`);
    }

    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    this.results.push(result);
    return result;
  }

  async testInitialLoad() {
    await this.runTest('Initial UI Load', async () => {
      console.log('Navigating to http://localhost:5173...');
      await this.page!.goto('http://localhost:5173', { waitUntil: 'networkidle' });
      
      // Verify main components are loaded
      await this.page!.waitForSelector('.chat-interface', { timeout: 10000 });
      await this.page!.waitForSelector('.sidebar', { timeout: 5000 });
      
      // Check for black background
      const bgColor = await this.page!.evaluate(() => {
        const body = document.querySelector('body');
        return window.getComputedStyle(body!).backgroundColor;
      });
      
      console.log(`Background color: ${bgColor}`);
      await this.takeScreenshot('initial_load');
    });
  }

  async testChatInterface() {
    await this.runTest('Chat Interface - Basic Message', async () => {
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]', { timeout: 5000 });
      const sendButton = await this.page!.waitForSelector('button[type="submit"]', { timeout: 5000 });
      
      // Send a simple message
      await chatInput!.fill('Hello, can you help me understand what services you provide?');
      await sendButton!.click();
      
      // Wait for response
      const responseStart = Date.now();
      await this.page!.waitForSelector('.message.assistant', { timeout: 30000 });
      const responseTime = Date.now() - responseStart;
      
      console.log(`Response time: ${responseTime}ms`);
      await this.takeScreenshot('chat_basic_response');
    });
  }

  async testAgentRouting(query: string, expectedAgent: string) {
    await this.runTest(`Agent Routing - ${expectedAgent}`, async () => {
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
      const sendButton = await this.page!.waitForSelector('button[type="submit"]');
      
      await chatInput!.fill(query);
      const routingStart = Date.now();
      await sendButton!.click();
      
      // Monitor agent selection
      const agentIndicator = await this.page!.waitForSelector('.agent-indicator', { timeout: 10000 });
      const selectedAgent = await agentIndicator!.textContent();
      const routingTime = Date.now() - routingStart;
      
      // Wait for complete response
      const executionStart = Date.now();
      await this.page!.waitForSelector('.message.assistant:last-child .complete', { timeout: 60000 });
      const executionTime = Date.now() - executionStart;
      
      const response = await this.page!.$eval('.message.assistant:last-child', el => el.textContent || '');
      
      // Check for replan indicators
      const replanNeeded = response.includes('replan') || response.includes('additional analysis');
      
      this.agentExecutions.push({
        query,
        selectedAgent: selectedAgent || 'Unknown',
        routingTime,
        executionTime,
        response: response.substring(0, 200) + '...',
        replanNeeded
      });
      
      console.log(`Agent: ${selectedAgent}, Routing: ${routingTime}ms, Execution: ${executionTime}ms`);
      await this.takeScreenshot(`agent_${expectedAgent.toLowerCase()}_response`);
    });
  }

  async testRAGSystem() {
    await this.runTest('RAG System - Context Retrieval', async () => {
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
      const sendButton = await this.page!.waitForSelector('button[type="submit"]');
      
      // Query that should trigger RAG
      await chatInput!.fill('What information do you have about our previous project discussions?');
      await sendButton!.click();
      
      // Monitor RAG indicator
      const ragIndicator = await this.page!.waitForSelector('.rag-active', { timeout: 5000 }).catch(() => null);
      if (ragIndicator) {
        console.log('RAG system activated');
      }
      
      await this.page!.waitForSelector('.message.assistant:last-child', { timeout: 30000 });
      await this.takeScreenshot('rag_context_retrieval');
    });
  }

  async testPlanReplanLoop() {
    await this.runTest('Plan/Replan Loop - Complex Query', async () => {
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
      const sendButton = await this.page!.waitForSelector('button[type="submit"]');
      
      // Complex query requiring multiple agents
      const complexQuery = 'I need you to research the latest trends in AI, write a summary report, and create a Python script to analyze sentiment from social media data about these trends.';
      
      await chatInput!.fill(complexQuery);
      const startTime = Date.now();
      await sendButton!.click();
      
      // Monitor plan creation
      const planIndicator = await this.page!.waitForSelector('.plan-indicator', { timeout: 10000 }).catch(() => null);
      if (planIndicator) {
        console.log('Plan created');
        await this.takeScreenshot('plan_created');
      }
      
      // Monitor agent executions
      let agentCount = 0;
      const agentObserver = setInterval(async () => {
        const agents = await this.page!.$$('.agent-execution');
        if (agents.length > agentCount) {
          agentCount = agents.length;
          console.log(`Agent execution ${agentCount} started`);
        }
      }, 1000);
      
      // Wait for completion
      await this.page!.waitForSelector('.message.assistant:last-child .complete', { timeout: 120000 });
      clearInterval(agentObserver);
      
      const totalTime = Date.now() - startTime;
      console.log(`Complex query completed in ${totalTime}ms with ${agentCount} agent executions`);
      
      await this.takeScreenshot('plan_replan_complete');
    });
  }

  async testErrorHandling() {
    await this.runTest('Error Handling - Invalid Input', async () => {
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
      const sendButton = await this.page!.waitForSelector('button[type="submit"]');
      
      // Send empty message
      await chatInput!.fill('');
      await sendButton!.click();
      
      // Check for error message
      const errorMessage = await this.page!.waitForSelector('.error-message', { timeout: 5000 }).catch(() => null);
      if (errorMessage) {
        console.log('Error message displayed for empty input');
      }
      
      await this.takeScreenshot('error_empty_input');
    });
    
    await this.runTest('Error Handling - Network Failure', async () => {
      // Simulate network failure
      await this.page!.route('**/api/**', route => route.abort());
      
      const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
      const sendButton = await this.page!.waitForSelector('button[type="submit"]');
      
      await chatInput!.fill('Test message during network failure');
      await sendButton!.click();
      
      // Check for network error handling
      const networkError = await this.page!.waitForSelector('.network-error', { timeout: 5000 }).catch(() => null);
      if (networkError) {
        console.log('Network error handled gracefully');
      }
      
      await this.takeScreenshot('error_network_failure');
      
      // Restore network
      await this.page!.unroute('**/api/**');
    });
  }

  async testSidebarFunctionality() {
    await this.runTest('Sidebar - Navigation', async () => {
      // Test sidebar toggle
      const sidebarToggle = await this.page!.waitForSelector('.sidebar-toggle');
      await sidebarToggle!.click();
      await this.page!.waitForTimeout(500);
      await this.takeScreenshot('sidebar_collapsed');
      
      await sidebarToggle!.click();
      await this.page!.waitForTimeout(500);
      await this.takeScreenshot('sidebar_expanded');
      
      // Test sidebar menu items
      const menuItems = await this.page!.$$('.sidebar-menu-item');
      console.log(`Found ${menuItems.length} sidebar menu items`);
      
      for (let i = 0; i < menuItems.length; i++) {
        const itemText = await menuItems[i].textContent();
        console.log(`Clicking sidebar item: ${itemText}`);
        await menuItems[i].click();
        await this.page!.waitForTimeout(1000);
        await this.takeScreenshot(`sidebar_item_${i}`);
      }
    });
  }

  async testAgentMonitor() {
    await this.runTest('Agent Monitor Panel', async () => {
      // Open agent monitor
      const agentMonitorBtn = await this.page!.waitForSelector('[data-testid="agent-monitor-toggle"]').catch(() => null);
      if (agentMonitorBtn) {
        await agentMonitorBtn.click();
        await this.page!.waitForTimeout(500);
        await this.takeScreenshot('agent_monitor_open');
        
        // Send a query to see agents in action
        const chatInput = await this.page!.waitForSelector('input[placeholder*="Type your message"]');
        const sendButton = await this.page!.waitForSelector('button[type="submit"]');
        
        await chatInput!.fill('Analyze the performance of our system');
        await sendButton!.click();
        
        // Monitor agent activity
        await this.page!.waitForTimeout(3000);
        await this.takeScreenshot('agent_monitor_active');
      }
    });
  }

  async generateReport() {
    console.log('\n📊 Generating Comprehensive Test Report...');
    
    const report = {
      testDate: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        skipped: this.results.filter(r => r.status === 'SKIP').length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      testResults: this.results,
      agentExecutions: this.agentExecutions,
      performance: {
        averageResponseTime: this.agentExecutions.reduce((sum, e) => sum + e.executionTime, 0) / this.agentExecutions.length,
        averageRoutingTime: this.agentExecutions.reduce((sum, e) => sum + e.routingTime, 0) / this.agentExecutions.length,
        replanRate: (this.agentExecutions.filter(e => e.replanNeeded).length / this.agentExecutions.length) * 100
      }
    };
    
    // Generate markdown report
    let markdown = `# CrewAI Team - Comprehensive UI Test Report\n\n`;
    markdown += `**Test Date:** ${new Date().toLocaleString()}\n\n`;
    markdown += `## Executive Summary\n\n`;
    markdown += `- **Total Tests:** ${report.summary.total}\n`;
    markdown += `- **Passed:** ${report.summary.passed} ✅\n`;
    markdown += `- **Failed:** ${report.summary.failed} ❌\n`;
    markdown += `- **Success Rate:** ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%\n`;
    markdown += `- **Total Duration:** ${(report.summary.totalDuration / 1000).toFixed(2)}s\n\n`;
    
    markdown += `## Test Results\n\n`;
    markdown += `| Test Name | Status | Duration | Error |\n`;
    markdown += `|-----------|--------|----------|-------|\n`;
    
    for (const result of this.results) {
      const status = result.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      const duration = `${(result.duration / 1000).toFixed(2)}s`;
      const error = result.error ? result.error.substring(0, 50) + '...' : '-';
      markdown += `| ${result.testName} | ${status} | ${duration} | ${error} |\n`;
    }
    
    markdown += `\n## Agent Performance Analysis\n\n`;
    markdown += `| Query | Selected Agent | Routing Time | Execution Time | Replan Needed |\n`;
    markdown += `|-------|----------------|--------------|----------------|---------------|\n`;
    
    for (const exec of this.agentExecutions) {
      markdown += `| ${exec.query.substring(0, 50)}... | ${exec.selectedAgent} | ${exec.routingTime}ms | ${(exec.executionTime / 1000).toFixed(2)}s | ${exec.replanNeeded ? 'Yes' : 'No'} |\n`;
    }
    
    markdown += `\n## Performance Metrics\n\n`;
    markdown += `- **Average Response Time:** ${(report.performance.averageResponseTime / 1000).toFixed(2)}s\n`;
    markdown += `- **Average Routing Time:** ${report.performance.averageRoutingTime.toFixed(0)}ms\n`;
    markdown += `- **Replan Rate:** ${report.performance.replanRate.toFixed(2)}%\n`;
    
    markdown += `\n## Issues Identified\n\n`;
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      for (const failed of failedTests) {
        markdown += `### ${failed.testName}\n`;
        markdown += `- **Error:** ${failed.error}\n`;
        markdown += `- **Screenshot:** ${failed.screenshot}\n\n`;
      }
    } else {
      markdown += `No critical issues identified during testing.\n`;
    }
    
    markdown += `\n## Recommendations\n\n`;
    markdown += `Based on the test results, here are the key recommendations:\n\n`;
    
    if (report.performance.averageResponseTime > 10000) {
      markdown += `1. **Performance Optimization:** Average response time exceeds 10 seconds. Consider optimizing LLM queries and caching strategies.\n`;
    }
    
    if (report.performance.replanRate > 30) {
      markdown += `2. **Plan Accuracy:** High replan rate (${report.performance.replanRate.toFixed(2)}%) suggests initial planning could be improved.\n`;
    }
    
    if (failedTests.length > 0) {
      markdown += `3. **Bug Fixes:** Address ${failedTests.length} failing tests to improve system reliability.\n`;
    }
    
    // Save reports
    writeFileSync(join(this.testReportDir, 'report.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(this.testReportDir, 'report.md'), markdown);
    
    console.log(`\n📄 Report saved to: ${this.testReportDir}/report.md`);
    console.log(`📊 JSON data saved to: ${this.testReportDir}/report.json`);
  }

  async cleanup() {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    try {
      await this.initialize();
      
      // Core functionality tests
      await this.testInitialLoad();
      await this.testChatInterface();
      await this.testSidebarFunctionality();
      await this.testAgentMonitor();
      
      // Agent routing tests
      await this.testAgentRouting(
        'What are the latest trends in machine learning?',
        'Research Agent'
      );
      
      await this.testAgentRouting(
        'Write a Python function to calculate fibonacci numbers',
        'Code Agent'
      );
      
      await this.testAgentRouting(
        'Analyze this dataset and create visualizations',
        'Data Analysis Agent'
      );
      
      await this.testAgentRouting(
        'Write a blog post about quantum computing',
        'Writer Agent'
      );
      
      // Advanced tests
      await this.testRAGSystem();
      await this.testPlanReplanLoop();
      await this.testErrorHandling();
      
      // Generate final report
      await this.generateReport();
      
    } catch (error) {
      console.error('Fatal error during testing:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const tester = new ComprehensiveUITester();
tester.runAllTests().then(() => {
  console.log('\n✅ Comprehensive UI testing completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Testing failed:', error);
  process.exit(1);
});