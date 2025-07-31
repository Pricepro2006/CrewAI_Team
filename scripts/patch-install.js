#!/usr/bin/env node

/**
 * Patch Installation Script
 * Temporarily removes problematic dependencies during installation
 * and restores them afterward
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const BACKUP_PATH = path.join(__dirname, '..', 'package.json.backup');

// Dependencies that might have compilation issues
const PROBLEMATIC_DEPS = ['better-sqlite3', 'sqlite3'];

class InstallPatcher {
    constructor() {
        this.originalPackage = null;
        this.modifiedPackage = null;
    }

    backup() {
        console.log('📦 Backing up package.json...');
        this.originalPackage = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
        fs.writeFileSync(BACKUP_PATH, JSON.stringify(this.originalPackage, null, 2));
        console.log('✅ Backup created');
    }

    removeDependencies() {
        console.log('🔧 Removing problematic dependencies...');
        this.modifiedPackage = { ...this.originalPackage };
        
        let removed = [];
        
        PROBLEMATIC_DEPS.forEach(dep => {
            if (this.modifiedPackage.dependencies && this.modifiedPackage.dependencies[dep]) {
                delete this.modifiedPackage.dependencies[dep];
                removed.push(dep);
            }
            if (this.modifiedPackage.devDependencies && this.modifiedPackage.devDependencies[dep]) {
                delete this.modifiedPackage.devDependencies[dep];
                removed.push(dep + ' (dev)');
            }
        });

        fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(this.modifiedPackage, null, 2));
        console.log(`✅ Removed: ${removed.join(', ')}`);
    }

    restore() {
        console.log('🔄 Restoring original package.json...');
        if (fs.existsSync(BACKUP_PATH)) {
            fs.copyFileSync(BACKUP_PATH, PACKAGE_JSON_PATH);
            fs.unlinkSync(BACKUP_PATH);
            console.log('✅ Restored');
        }
    }

    installDependencies() {
        console.log('📥 Installing dependencies...');
        try {
            execSync('npm install --no-optional', { stdio: 'inherit' });
            console.log('✅ Dependencies installed');
        } catch (error) {
            console.error('❌ Installation failed:', error.message);
            throw error;
        }
    }

    checkBetterSqlite3() {
        console.log('🔍 Checking better-sqlite3...');
        try {
            require('better-sqlite3');
            console.log('✅ better-sqlite3 is already working!');
            return true;
        } catch (error) {
            console.log('⚠️  better-sqlite3 not available');
            return false;
        }
    }

    installBetterSqlite3Workaround() {
        console.log('🛠️  Installing better-sqlite3 with workaround...');
        
        // Try different installation methods
        const methods = [
            // Method 1: Try with ignore-scripts
            () => {
                console.log('  Method 1: Installing with --ignore-scripts...');
                try {
                    execSync('npm install better-sqlite3@9.6.0 --ignore-scripts', { stdio: 'inherit' });
                    return true;
                } catch (e) {
                    return false;
                }
            },
            
            // Method 2: Try copying from cache
            () => {
                console.log('  Method 2: Looking for cached version...');
                const cacheDir = path.join(process.env.HOME, '.npm/_cacache');
                // This would need more implementation
                return false;
            },
            
            // Method 3: Download prebuilt binary
            () => {
                console.log('  Method 3: Downloading prebuilt binary...');
                const script = path.join(__dirname, 'install-workaround.sh');
                if (fs.existsSync(script)) {
                    try {
                        execSync(script, { stdio: 'inherit' });
                        return true;
                    } catch (e) {
                        return false;
                    }
                }
                return false;
            }
        ];

        for (const method of methods) {
            if (method() && this.checkBetterSqlite3()) {
                console.log('✅ better-sqlite3 installed successfully!');
                return true;
            }
        }

        console.log('❌ Failed to install better-sqlite3');
        return false;
    }

    run() {
        try {
            // Check if better-sqlite3 already works
            if (this.checkBetterSqlite3()) {
                console.log('🎉 No installation needed - better-sqlite3 is already working!');
                
                // Just install other dependencies if needed
                console.log('📥 Installing/updating other dependencies...');
                execSync('npm install --no-optional', { stdio: 'inherit' });
                return;
            }

            // Backup and patch installation
            this.backup();
            this.removeDependencies();
            this.installDependencies();
            this.restore();
            
            // Try to install better-sqlite3 separately
            this.installBetterSqlite3Workaround();
            
            console.log('\n🎉 Installation complete!');
            console.log('You can now run: npm run start-email-pipeline');
            
        } catch (error) {
            console.error('❌ Installation failed:', error);
            this.restore();
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const patcher = new InstallPatcher();
    patcher.run();
}

module.exports = InstallPatcher;