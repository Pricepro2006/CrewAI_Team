/**
 * Migration Script: Replace Direct Database() Instantiations
 * 
 * This script identifies and helps replace direct Database() instantiations
 * throughout the codebase with optimized DatabaseManager calls.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { logger } from '../src/utils/logger.js';

interface DatabaseInstantiation {
  file: string;
  line: number;
  content: string;
  type: 'main' | 'walmart' | 'unknown';
  suggestion: string;
}

interface MigrationReport {
  filesScanned: number;
  instantiationsFound: number;
  filesWithIssues: string[];
  suggestions: DatabaseInstantiation[];
}

class DatabaseMigrationTool {
  private basePath: string;
  private report: MigrationReport;

  constructor(basePath: string = './src') {
    this.basePath = basePath;
    this.report = {
      filesScanned: 0,
      instantiationsFound: 0,
      filesWithIssues: [],
      suggestions: []
    };
  }

  /**
   * Scan the codebase for direct Database instantiations
   */
  public scanCodebase(): MigrationReport {
    console.log('🔍 Scanning codebase for direct Database() instantiations...');
    
    this.scanDirectory(this.basePath);
    
    console.log(`\n📊 Migration Report:`);
    console.log(`Files scanned: ${this.report.filesScanned}`);
    console.log(`Database instantiations found: ${this.report.instantiationsFound}`);
    console.log(`Files with issues: ${this.report.filesWithIssues.length}`);
    
    if (this.report.suggestions.length > 0) {
      console.log('\n🔧 Suggested replacements:');
      this.report.suggestions.forEach((suggestion, index) => {
        console.log(`\n${index + 1}. ${suggestion.file}:${suggestion.line}`);
        console.log(`   Current: ${suggestion.content.trim()}`);
        console.log(`   Replace with: ${suggestion.suggestion}`);
      });
    }

    return this.report;
  }

  /**
   * Generate migration patches for automatic application
   */
  public generateMigrationPatches(): Array<{file: string, patches: Array<{old: string, new: string}>}> {
    const patches: Array<{file: string, patches: Array<{old: string, new: string}>}> = [];
    
    // Group suggestions by file
    const fileGroups = this.report.suggestions.reduce((acc, suggestion) => {
      if (!acc[suggestion.file]) {
        acc[suggestion.file] = [];
      }
      acc[suggestion.file].push(suggestion);
      return acc;
    }, {} as Record<string, DatabaseInstantiation[]>);

    Object.entries(fileGroups).forEach(([file, suggestions]) => {
      const filePatch = {
        file,
        patches: suggestions.map(suggestion => ({
          old: suggestion.content.trim(),
          new: suggestion.suggestion
        }))
      };
      patches.push(filePatch);
    });

    return patches;
  }

  private scanDirectory(dirPath: string): void {
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules, dist, and other build directories
          if (!['node_modules', 'dist', '.git', 'venv', 'playwright_env'].includes(item)) {
            this.scanDirectory(fullPath);
          }
        } else if (stat.isFile() && this.isTypeScriptFile(fullPath)) {
          this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dirPath}:`, error);
    }
  }

  private isTypeScriptFile(filePath: string): boolean {
    const ext = extname(filePath);
    return ['.ts', '.js'].includes(ext) && !filePath.includes('.test.') && !filePath.includes('.spec.');
  }

  private scanFile(filePath: string): void {
    try {
      this.report.filesScanned++;
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      let hasIssues = false;
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Look for "new Database(" patterns
        const databasePattern = /new\s+Database\s*\(/g;
        if (databasePattern.test(line)) {
          hasIssues = true;
          this.report.instantiationsFound++;
          
          const suggestion = this.generateSuggestion(filePath, line, lineNumber);
          this.report.suggestions.push(suggestion);
        }
      });
      
      if (hasIssues) {
        this.report.filesWithIssues.push(filePath);
      }
    } catch (error) {
      console.warn(`Warning: Could not scan file ${filePath}:`, error);
    }
  }

  private generateSuggestion(filePath: string, line: string, lineNumber: number): DatabaseInstantiation {
    // Determine which database based on file path and content
    let dbType: 'main' | 'walmart' | 'unknown' = 'unknown';
    let suggestion = '';

    // Check for walmart-related files or content
    if (filePath.includes('walmart') || line.includes('walmart')) {
      dbType = 'walmart';
    } else {
      dbType = 'main';
    }

    // Generate appropriate replacement suggestion
    if (line.includes('new Database(')) {
      // Simple replacement pattern
      if (dbType === 'walmart') {
        suggestion = line.replace(
          /new\s+Database\s*\([^)]*\)/g,
          `await databaseManager.execute('walmart', (db) => /* your query here */)`
        );
      } else {
        suggestion = line.replace(
          /new\s+Database\s*\([^)]*\)/g,
          `await databaseManager.execute('main', (db) => /* your query here */)`
        );
      }
    }

    // If it's a variable assignment, suggest a different pattern
    if (line.includes('const') || line.includes('let') || line.includes('var')) {
      suggestion = `// Replace direct instantiation with DatabaseManager usage:\n` +
                  `// const db = new Database(...) → await databaseManager.execute('${dbType}', (db) => {\n` +
                  `//   // Your database operations here\n` +
                  `//   return result;\n` +
                  `// });`;
    }

    return {
      file: filePath,
      line: lineNumber,
      content: line,
      type: dbType,
      suggestion: suggestion
    };
  }

  /**
   * Apply automatic migrations where safe to do so
   */
  public async applyAutomaticMigrations(dryRun: boolean = true): Promise<void> {
    console.log(`\n🔧 ${dryRun ? 'DRY RUN:' : ''} Applying automatic migrations...`);
    
    const patches = this.generateMigrationPatches();
    
    for (const filePatch of patches) {
      try {
        let content = readFileSync(filePatch.file, 'utf-8');
        let modified = false;
        
        // Check if file already imports DatabaseManager
        const needsImport = !content.includes('databaseManager') && !content.includes('DatabaseManager');
        
        for (const patch of filePatch.patches) {
          // Only apply safe, simple replacements
          if (this.isSafeReplacement(patch.old, patch.new)) {
            content = content.replace(patch.old, patch.new);
            modified = true;
            console.log(`  ✅ ${filePatch.file}: Applied safe replacement`);
          } else {
            console.log(`  ⚠️  ${filePatch.file}: Manual review needed`);
          }
        }
        
        // Add import if needed and modifications were made
        if (modified && needsImport) {
          const importStatement = `import { databaseManager } from './path/to/DatabaseManager.js';\n`;
          content = this.addImportStatement(content, importStatement);
        }
        
        if (modified && !dryRun) {
          writeFileSync(filePatch.file, content, 'utf-8');
          console.log(`  💾 Saved changes to ${filePatch.file}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing ${filePatch.file}:`, error);
      }
    }
    
    console.log(`\n${dryRun ? '🏃' : '✅'} Migration ${dryRun ? 'simulation' : 'application'} complete!`);
  }

  private isSafeReplacement(oldCode: string, newCode: string): boolean {
    // Define criteria for safe automatic replacement
    // For now, we'll be conservative and only allow simple cases
    
    // Skip complex cases that likely need manual review
    if (oldCode.includes('transaction') || 
        oldCode.includes('prepare') ||
        oldCode.includes('pragma') ||
        oldCode.includes('close')) {
      return false;
    }
    
    // Skip if the replacement looks incomplete
    if (newCode.includes('/* your query here */')) {
      return false;
    }
    
    return true;
  }

  private addImportStatement(content: string, importStatement: string): string {
    const lines = content.split('\n');
    
    // Find the best place to insert the import
    let insertIndex = 0;
    
    // Look for existing imports
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' && insertIndex > 0) {
        // Stop at first empty line after imports
        break;
      }
    }
    
    lines.splice(insertIndex, 0, importStatement);
    return lines.join('\n');
  }
}

// Main execution
async function main() {
  console.log('🚀 Database Migration Tool\n');
  
  const migrationTool = new DatabaseMigrationTool();
  
  // Scan the codebase
  const report = migrationTool.scanCodebase();
  
  if (report.instantiationsFound === 0) {
    console.log('\n✅ No direct Database instantiations found. Codebase is already optimized!');
    return;
  }
  
  console.log(`\n📝 Generated migration suggestions for ${report.instantiationsFound} instantiations`);
  
  // Show dry run
  console.log('\n🏃 Running dry run to preview changes...');
  await migrationTool.applyAutomaticMigrations(true);
  
  // Ask user if they want to apply changes (in a real scenario)
  console.log('\n💡 To apply changes:');
  console.log('  1. Review the suggestions above');
  console.log('  2. Update your code to use DatabaseManager');
  console.log('  3. Add proper imports: import { databaseManager } from "../../core/database/DatabaseManager.js"');
  console.log('  4. Replace new Database() calls with databaseManager.execute() calls');
  
  console.log('\n📚 Example migration:');
  console.log('  Before: const db = new Database("./data/app.db"); const result = db.prepare("SELECT * FROM table").all();');
  console.log('  After:  const result = await databaseManager.execute("main", (db) => db.prepare("SELECT * FROM table").all());');
}

// Run the migration tool
if (import.meta.url.endsWith(process.argv[1])) {
  main().catch(console.error);
}

export { DatabaseMigrationTool };