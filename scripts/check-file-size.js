#!/usr/bin/env node

/**
 * Check file sizes to prevent large files from being committed
 */

const fs = require('fs');
const path = require('path');

// Get all staged files from command line arguments
const files = process.argv.slice(2);

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const WARNING_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const LARGE_IMAGE_SIZE = 500 * 1024; // 500KB for images

let hasErrors = false;
const issues = [];

// File extensions that should be smaller
const strictSizeExtensions = {
  '.js': 100 * 1024,   // 100KB
  '.ts': 100 * 1024,   // 100KB
  '.jsx': 100 * 1024,  // 100KB
  '.tsx': 100 * 1024,  // 100KB
  '.json': 100 * 1024, // 100KB
  '.css': 50 * 1024,   // 50KB
  '.md': 50 * 1024,    // 50KB
};

// Binary file extensions to check
const binaryExtensions = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.mp4', '.mp3', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib'
];

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check each file
files.forEach(file => {
  try {
    const stats = fs.statSync(file);
    const fileSize = stats.size;
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file);
    
    // Skip directories
    if (stats.isDirectory()) {
      return;
    }
    
    // Check if it's a binary file that shouldn't be committed
    if (binaryExtensions.includes(ext)) {
      if (fileSize > LARGE_IMAGE_SIZE) {
        issues.push({
          file,
          size: fileSize,
          message: `Binary file is too large (${formatFileSize(fileSize)}). Consider using Git LFS.`,
          severity: 'error'
        });
        hasErrors = true;
      }
    }
    
    // Check absolute maximum size
    if (fileSize > MAX_FILE_SIZE) {
      issues.push({
        file,
        size: fileSize,
        message: `File exceeds maximum size limit of ${formatFileSize(MAX_FILE_SIZE)}`,
        severity: 'error'
      });
      hasErrors = true;
    }
    
    // Check strict size limits for code files
    if (strictSizeExtensions[ext] && fileSize > strictSizeExtensions[ext]) {
      issues.push({
        file,
        size: fileSize,
        message: `${ext} file is larger than recommended (${formatFileSize(fileSize)} > ${formatFileSize(strictSizeExtensions[ext])})`,
        severity: 'warning'
      });
    }
    
    // General warning for large files
    if (fileSize > WARNING_FILE_SIZE && !hasErrors) {
      issues.push({
        file,
        size: fileSize,
        message: `Large file detected (${formatFileSize(fileSize)}). Consider if this needs to be committed.`,
        severity: 'warning'
      });
    }
    
    // Check for common files that shouldn't be committed
    const suspiciousFiles = [
      '.env.local', '.env.production', '.env.development',
      'npm-debug.log', 'yarn-error.log', '.DS_Store',
      'Thumbs.db', '*.swp', '*.swo', '*.log'
    ];
    
    if (suspiciousFiles.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(basename);
      }
      return basename === pattern;
    })) {
      issues.push({
        file,
        size: fileSize,
        message: 'This file type should typically not be committed',
        severity: 'warning'
      });
    }
    
  } catch (error) {
    console.error(`Error checking file ${file}:`, error.message);
  }
});

// Output results
if (issues.length > 0) {
  console.log('\n📏 File Size Check Results:\n');
  
  issues.forEach(issue => {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`${icon} ${issue.file}`);
    console.log(`   Size: ${formatFileSize(issue.size)}`);
    console.log(`   ${issue.message}\n`);
  });
  
  if (hasErrors) {
    console.log('❌ Large files detected. Please remove or use Git LFS.');
    console.log('💡 To setup Git LFS: git lfs track "*.{extension}"');
    console.log('💡 To bypass (use with caution): git commit --no-verify\n');
    process.exit(1);
  } else {
    console.log('⚠️  File size warnings detected. Consider addressing them.\n');
  }
}

process.exit(0);