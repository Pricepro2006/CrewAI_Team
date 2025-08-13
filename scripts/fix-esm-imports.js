#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");

// Path alias mappings from tsconfig.json
const pathAliases = {
  "@/": "",
  "@core/": "core/",
  "@api/": "api/",
  "@ui/": "ui/",
  "@utils/": "utils/",
  "@config/": "config/",
};

// Check if a path is a relative import
function isRelativeImport(importPath) {
  return importPath.startsWith("./") || importPath.startsWith("../");
}

// Check if a path is a path alias
function isPathAlias(importPath) {
  return Object.keys(pathAliases).some((alias) => importPath.startsWith(alias));
}

// Check if import is a node module or built-in
function isNodeModule(importPath) {
  return (
    !importPath.startsWith(".") &&
    !importPath.startsWith("/") &&
    !isPathAlias(importPath)
  );
}

// Resolve path alias to relative path
function resolvePathAlias(importPath, currentFilePath) {
  for (const [alias, replacement] of Object.entries(pathAliases)) {
    if (importPath.startsWith(alias)) {
      const resolvedPath = importPath.replace(alias, replacement);
      const absoluteImportPath = path.join(srcDir, resolvedPath);
      const relativeImportPath = path.relative(
        path.dirname(currentFilePath),
        absoluteImportPath,
      );
      return relativeImportPath.startsWith(".")
        ? relativeImportPath
        : "./" + relativeImportPath;
    }
  }
  return importPath;
}

// Add .js extension if needed
function addJsExtension(importPath) {
  // Don't add extension to node modules or if it already has an extension
  if (
    isNodeModule(importPath) ||
    importPath.endsWith(".js") ||
    importPath.endsWith(".json") ||
    importPath.endsWith(".css") ||
    importPath.endsWith(".scss")
  ) {
    return importPath;
  }

  // Check if it's a directory import (ends with /)
  if (importPath.endsWith("/")) {
    return importPath + "index.js";
  }

  return importPath + ".js";
}

// Process import/export statements in a file
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);

  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Regex patterns for different import/export types
  const patterns = [
    // import statements
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:\{[^}]*\}|\w+))?\s*from\s*["']([^"']+)["']/g,
    // export statements
    /export\s+(?:type\s+)?(?:\{[^}]*\}|\*)?\s*from\s*["']([^"']+)["']/g,
    // dynamic imports
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    // require statements (in case any exist)
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  patterns.forEach((pattern) => {
    content = content.replace(pattern, (match, importPath) => {
      let newImportPath = importPath;

      // Skip node modules and built-ins
      if (isNodeModule(importPath) && !isPathAlias(importPath)) {
        return match;
      }

      // Resolve path aliases first
      if (isPathAlias(importPath)) {
        newImportPath = resolvePathAlias(importPath, filePath);
        modified = true;
      }

      // Add .js extension to relative imports
      if (isRelativeImport(newImportPath)) {
        const withExtension = addJsExtension(newImportPath);
        if (withExtension !== newImportPath) {
          newImportPath = withExtension;
          modified = true;
        }
      }

      if (newImportPath !== importPath) {
        console.log(`  ${importPath} -> ${newImportPath}`);
        return match.replace(importPath, newImportPath);
      }

      return match;
    });
  });

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  ✓ Updated`);
  } else {
    console.log(`  ✓ No changes needed`);
  }
}

// Recursively process all TypeScript files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (
      stat.isDirectory() &&
      !file.startsWith(".") &&
      file !== "node_modules"
    ) {
      processDirectory(filePath);
    } else if (
      stat.isFile() &&
      (file.endsWith(".ts") || file.endsWith(".tsx"))
    ) {
      processFile(filePath);
    }
  });
}

// Process JavaScript files in dist directory
function processDistDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Distribution directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith(".")) {
      processDistDirectory(filePath);
    } else if (stat.isFile() && file.endsWith(".js")) {
      processFile(filePath);
    }
  });
}

// Main execution
console.log("🔧 Fixing ESM imports...\n");

const mode = process.argv[2] || "src";

if (mode === "dist" || mode === "both") {
  console.log("📁 Processing distribution files...\n");
  processDistDirectory(distDir);
}

if (mode === "src" || mode === "both") {
  console.log("\n📁 Processing source files...\n");
  processDirectory(srcDir);
}

console.log("\n✅ ESM import fixing complete!");
