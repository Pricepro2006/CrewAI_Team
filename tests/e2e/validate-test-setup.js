#!/usr/bin/env node

/**
 * Test Setup Validation Script
 * Validates that all prerequisites for running E2E tests are met
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Helper functions
const log = (message, color = colors.reset) => console.log(`${color}${message}${colors.reset}`);
const success = (message) => log(`✅ ${message}`, colors.green);
const error = (message) => log(`❌ ${message}`, colors.red);
const warning = (message) => log(`⚠️ ${message}`, colors.yellow);
const info = (message) => log(`ℹ️ ${message}`, colors.blue);

// Validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

// Helper to run command and get output
function runCommand(command, args = []) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: 'pipe' });
    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, output, error });
    });
  });
}

// Check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.listen(port, () => {
      server.once('close', () => {
        resolve(false); // Port is available
      });
      server.close();
    });

    server.on('error', () => {
      resolve(true); // Port is in use
    });
  });
}

// Validation functions
async function validateNodejs() {
  info('Checking Node.js installation...');
  
  try {
    const result = await runCommand('node', ['--version']);
    if (result.code === 0) {
      const version = result.output.trim();
      const majorVersion = parseInt(version.substring(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        success(`Node.js ${version} is installed and compatible`);
        results.passed++;
      } else {
        error(`Node.js ${version} is too old. Version 18+ required`);
        results.failed++;
        results.issues.push('Upgrade Node.js to version 18 or higher');
      }
    } else {
      error('Node.js is not installed or not in PATH');
      results.failed++;
      results.issues.push('Install Node.js version 18 or higher');
    }
  } catch (err) {
    error(`Failed to check Node.js: ${err.message}`);
    results.failed++;
    results.issues.push('Install Node.js version 18 or higher');
  }
}

async function validatePackageManager() {
  info('Checking package manager...');
  
  // Check for pnpm first, then npm
  const managers = [
    { cmd: 'pnpm', name: 'pnpm' },
    { cmd: 'npm', name: 'npm' }
  ];

  let foundManager = null;
  
  for (const manager of managers) {
    try {
      const result = await runCommand(manager.cmd, ['--version']);
      if (result.code === 0) {
        foundManager = manager;
        break;
      }
    } catch (err) {
      // Continue checking other managers
    }
  }

  if (foundManager) {
    success(`${foundManager.name} is available`);
    results.passed++;
    return foundManager.cmd;
  } else {
    error('No package manager found (npm or pnpm required)');
    results.failed++;
    results.issues.push('Install npm (comes with Node.js) or pnpm');
    return null;
  }
}

async function validateProjectStructure() {
  info('Validating project structure...');
  
  const projectRoot = path.resolve(__dirname, '../..');
  const requiredPaths = [
    'package.json',
    'src',
    'tests/e2e',
    'playwright.config.ts'
  ];

  let allPathsExist = true;

  for (const requiredPath of requiredPaths) {
    const fullPath = path.join(projectRoot, requiredPath);
    if (fs.existsSync(fullPath)) {
      success(`Found: ${requiredPath}`);
    } else {
      error(`Missing: ${requiredPath}`);
      allPathsExist = false;
      results.issues.push(`Create missing file/directory: ${requiredPath}`);
    }
  }

  if (allPathsExist) {
    results.passed++;
  } else {
    results.failed++;
  }
}

async function validateDependencies() {
  info('Checking dependencies...');
  
  const projectRoot = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    error('package.json not found');
    results.failed++;
    results.issues.push('Create package.json file');
    return;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = {
      '@playwright/test': 'devDependencies',
      'playwright': 'devDependencies'
    };

    let allDepsFound = true;

    for (const [dep, section] of Object.entries(requiredDeps)) {
      if (packageJson[section] && packageJson[section][dep]) {
        success(`Found dependency: ${dep}`);
      } else {
        error(`Missing dependency: ${dep} in ${section}`);
        allDepsFound = false;
        results.issues.push(`Install ${dep}: npm install --save-dev ${dep}`);
      }
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      success('node_modules directory exists');
    } else {
      warning('node_modules directory not found');
      results.warnings++;
      results.issues.push('Run npm install or pnpm install');
    }

    if (allDepsFound) {
      results.passed++;
    } else {
      results.failed++;
    }

  } catch (err) {
    error(`Failed to read package.json: ${err.message}`);
    results.failed++;
    results.issues.push('Fix package.json syntax errors');
  }
}

async function validatePlaywright() {
  info('Checking Playwright installation...');
  
  try {
    const result = await runCommand('npx', ['playwright', '--version']);
    if (result.code === 0) {
      success(`Playwright is installed: ${result.output.trim()}`);
      results.passed++;

      // Check if browsers are installed
      info('Checking Playwright browsers...');
      const browserCheck = await runCommand('npx', ['playwright', 'install-deps', '--dry-run']);
      
      if (browserCheck.code === 0) {
        success('Playwright browsers appear to be installed');
        results.passed++;
      } else {
        warning('Playwright browsers may need installation');
        results.warnings++;
        results.issues.push('Run: npx playwright install');
      }

    } else {
      error('Playwright is not installed or not working');
      results.failed++;
      results.issues.push('Install Playwright: npm install --save-dev @playwright/test');
    }
  } catch (err) {
    error(`Failed to check Playwright: ${err.message}`);
    results.failed++;
    results.issues.push('Install Playwright: npm install --save-dev @playwright/test');
  }
}

async function validateServices() {
  info('Checking application services...');
  
  // Check backend service
  const backendRunning = await checkPort(3000);
  if (backendRunning) {
    success('Backend service is running on port 3000');
    results.passed++;
  } else {
    warning('Backend service is not running on port 3000');
    results.warnings++;
    results.issues.push('Start backend service: npm run dev:server');
  }

  // Check frontend service
  const frontendRunning = await checkPort(5173);
  if (frontendRunning) {
    success('Frontend service is running on port 5173');
    results.passed++;
  } else {
    warning('Frontend service is not running on port 5173');
    results.warnings++;
    results.issues.push('Start frontend service: npm run dev:client');
  }
}

async function validateTestFiles() {
  info('Validating test files...');
  
  const testDir = __dirname;
  const requiredTestFiles = [
    'walmart-grocery-agent.spec.ts',
    'websocket-realtime.spec.ts',
    'integration-workflows.spec.ts',
    'visual-regression.spec.ts',
    'utils/test-helpers.ts',
    'fixtures/mock-data.ts',
    'global-setup.ts',
    'global-teardown.ts'
  ];

  let allTestFilesExist = true;

  for (const testFile of requiredTestFiles) {
    const fullPath = path.join(testDir, testFile);
    if (fs.existsSync(fullPath)) {
      success(`Found test file: ${testFile}`);
    } else {
      error(`Missing test file: ${testFile}`);
      allTestFilesExist = false;
      results.issues.push(`Create missing test file: ${testFile}`);
    }
  }

  if (allTestFilesExist) {
    results.passed++;
  } else {
    results.failed++;
  }
}

async function validateConfiguration() {
  info('Validating configuration files...');
  
  const projectRoot = path.resolve(__dirname, '../..');
  const configFiles = [
    'playwright.config.ts',
    'package.json'
  ];

  let allConfigsValid = true;

  for (const configFile of configFiles) {
    const configPath = path.join(projectRoot, configFile);
    if (fs.existsSync(configPath)) {
      try {
        if (configFile.endsWith('.json')) {
          JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        success(`Valid configuration: ${configFile}`);
      } catch (err) {
        error(`Invalid configuration: ${configFile} - ${err.message}`);
        allConfigsValid = false;
        results.issues.push(`Fix syntax errors in ${configFile}`);
      }
    } else {
      error(`Missing configuration: ${configFile}`);
      allConfigsValid = false;
      results.issues.push(`Create configuration file: ${configFile}`);
    }
  }

  if (allConfigsValid) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Main validation function
async function runValidation() {
  log('\n🔍 Walmart Grocery Agent E2E Test Setup Validation', colors.bold);
  log('=' .repeat(60), colors.blue);

  // Run all validations
  await validateNodejs();
  await validatePackageManager();
  await validateProjectStructure();
  await validateDependencies();
  await validatePlaywright();
  await validateServices();
  await validateTestFiles();
  await validateConfiguration();

  // Summary
  log('\n📊 Validation Summary', colors.bold);
  log('-'.repeat(30), colors.blue);
  success(`Passed: ${results.passed}`);
  
  if (results.warnings > 0) {
    warning(`Warnings: ${results.warnings}`);
  }
  
  if (results.failed > 0) {
    error(`Failed: ${results.failed}`);
  }

  // Show issues if any
  if (results.issues.length > 0) {
    log('\n🔧 Issues to Fix:', colors.bold);
    log('-'.repeat(20), colors.blue);
    
    results.issues.forEach((issue, index) => {
      log(`${index + 1}. ${issue}`, colors.yellow);
    });
  }

  // Final recommendation
  log('\n🎯 Recommendation:', colors.bold);
  
  if (results.failed === 0) {
    if (results.warnings === 0) {
      success('✅ All checks passed! Your test setup is ready.');
      success('You can run the E2E tests with: ./tests/e2e/run-all-tests.sh');
    } else {
      warning('⚠️ Setup is mostly ready, but some optional services are not running.');
      warning('Start the services for best test results, or run tests anyway.');
    }
  } else {
    error('❌ Setup has issues that must be resolved before running tests.');
    error('Please fix the issues listed above and run this validation again.');
  }

  log('\n' + '='.repeat(60), colors.blue);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
  runValidation().catch(err => {
    error(`Validation failed with error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runValidation };