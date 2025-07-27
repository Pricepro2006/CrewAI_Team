#!/usr/bin/env node

/**
 * Validate commit message format
 * Enforces conventional commit format: type(scope): subject
 */

const fs = require('fs');

// Read commit message
const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error('No commit message file provided');
  process.exit(1);
}

let commitMsg;
try {
  commitMsg = fs.readFileSync(commitMsgFile, 'utf8').trim();
} catch (error) {
  console.error('Error reading commit message:', error.message);
  process.exit(1);
}

// Skip merge commits
if (commitMsg.startsWith('Merge')) {
  process.exit(0);
}

// Commit message format
const commitTypes = [
  'feat',     // New feature
  'fix',      // Bug fix
  'docs',     // Documentation only changes
  'style',    // Changes that don't affect code meaning (formatting, etc)
  'refactor', // Code change that neither fixes a bug nor adds a feature
  'perf',     // Performance improvements
  'test',     // Adding or updating tests
  'build',    // Changes that affect build system or dependencies
  'ci',       // CI configuration changes
  'chore',    // Other changes that don't modify src or test files
  'revert',   // Reverts a previous commit
  'security', // Security improvements or fixes
];

// Conventional commit regex
const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\(.+\))?: .{1,100}$/;
const typeRegex = /^(\w+)(\(.+\))?:/;

// Validate format
const firstLine = commitMsg.split('\n')[0];

if (!conventionalCommitRegex.test(firstLine)) {
  console.log('\n❌ Invalid commit message format!\n');
  console.log('Your commit message:', firstLine);
  console.log('\nExpected format: type(scope): subject');
  console.log('Example: feat(auth): add user login functionality\n');
  
  // Try to provide specific feedback
  const typeMatch = firstLine.match(typeRegex);
  if (typeMatch) {
    const type = typeMatch[1];
    if (!commitTypes.includes(type)) {
      console.log(`❌ Invalid commit type: "${type}"`);
      console.log(`✅ Valid types: ${commitTypes.join(', ')}\n`);
    }
  } else {
    console.log('❌ Missing commit type and colon');
  }
  
  if (firstLine.length > 100) {
    console.log(`❌ First line too long (${firstLine.length} chars). Maximum: 100 chars\n`);
  }
  
  console.log('📚 Commit message guidelines:');
  console.log('- Use present tense ("add feature" not "added feature")');
  console.log('- Use imperative mood ("move cursor to..." not "moves cursor to...")');
  console.log('- First line should be 100 characters or less');
  console.log('- Reference issues and PRs after first line\n');
  
  console.log('Valid commit types:');
  commitTypes.forEach(type => {
    const descriptions = {
      'feat': 'A new feature',
      'fix': 'A bug fix',
      'docs': 'Documentation only changes',
      'style': 'Formatting, missing semicolons, etc; no code change',
      'refactor': 'Refactoring production code',
      'perf': 'Performance improvements',
      'test': 'Adding missing tests, refactoring tests; no production code change',
      'build': 'Changes to build system or external dependencies',
      'ci': 'Changes to CI configuration files and scripts',
      'chore': 'Updating grunt tasks etc; no production code change',
      'revert': 'Reverting a previous commit',
      'security': 'Security improvements or fixes'
    };
    console.log(`  ${type}: ${descriptions[type]}`);
  });
  
  console.log('\n💡 To edit your commit message: git commit --amend');
  console.log('💡 To bypass (not recommended): git commit --no-verify\n');
  
  process.exit(1);
}

// Additional checks
const subject = firstLine.replace(typeRegex, '').trim();

// Check for common issues
const issues = [];

if (subject[0] !== subject[0].toLowerCase()) {
  issues.push('Subject should start with lowercase letter');
}

if (subject.endsWith('.')) {
  issues.push('Subject should not end with a period');
}

if (subject.length < 10) {
  issues.push('Subject is too short. Be more descriptive');
}

// Security-specific checks for security commits
if (firstLine.startsWith('security')) {
  if (!commitMsg.toLowerCase().includes('cve') && 
      !commitMsg.toLowerCase().includes('vulnerability') &&
      !commitMsg.toLowerCase().includes('security')) {
    issues.push('Security commits should reference the vulnerability or security issue');
  }
}

if (issues.length > 0) {
  console.log('\n⚠️  Commit message warnings:\n');
  issues.forEach(issue => {
    console.log(`  - ${issue}`);
  });
  console.log('\nConsider addressing these issues for better commit history.\n');
}

console.log('✅ Commit message validation passed\n');
process.exit(0);