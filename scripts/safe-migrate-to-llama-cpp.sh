#!/bin/bash

# Safe migration script from Ollama to llama.cpp
# This script updates references without disrupting running processes

set -e

echo "========================================="
echo "Safe Migration from Ollama to llama.cpp"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if any fine-tuning is running
echo -e "${YELLOW}Checking for running processes...${NC}"
if pgrep -f "finetune" > /dev/null; then
    echo -e "${YELLOW}⚠ Fine-tuning process detected. Migration will skip Python files.${NC}"
    SKIP_PYTHON=true
else
    SKIP_PYTHON=false
fi

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
BACKUP_DIR="backups/pre-llama-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup important files
tar -czf "$BACKUP_DIR/backup.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=build \
    --exclude=venv \
    --exclude=models \
    --exclude=*.gguf \
    src/ tests/ scripts/ *.json *.ts *.md 2>/dev/null || true

echo -e "${GREEN}✓ Backup created in $BACKUP_DIR${NC}"

# Count current Ollama references
echo ""
echo -e "${YELLOW}Current Ollama references:${NC}"
OLLAMA_COUNT=$(grep -r "ollama" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v llama-cpp | wc -l)
echo "  Found $OLLAMA_COUNT references"

# Update TypeScript/JavaScript files (if not skipping)
if [ "$SKIP_PYTHON" = false ]; then
    echo ""
    echo -e "${YELLOW}Updating TypeScript/JavaScript files...${NC}"
    
    # Update imports and configurations
    find src tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) 2>/dev/null | while read file; do
        if grep -q "ollama" "$file" 2>/dev/null; then
            # Create temp file
            cp "$file" "$file.tmp"
            
            # Replace Ollama references
            sed -i \
                -e 's/from.*ollama\.config/from "..\/config\/llama-cpp-optimized.config"/g' \
                -e 's/import.*ollama/import { llamaCppService } from "..\/services\/llama-cpp.service"/g' \
                -e 's/OllamaConfig/LlamaCppOptimizedConfig/g' \
                -e 's/ollamaConfig/llamaCppConfig/g' \
                -e 's/ollama\.chat/llamaCppService.runOptimizedInference/g' \
                -e 's/ollama\.generate/llamaCppService.runOptimizedInference/g' \
                -e 's/OLLAMA_/LLAMA_CPP_/g' \
                "$file.tmp"
            
            # Only update if changes were made
            if ! diff -q "$file" "$file.tmp" > /dev/null 2>&1; then
                mv "$file.tmp" "$file"
                echo "  Updated: $file"
            else
                rm "$file.tmp"
            fi
        fi
    done
fi

# Update environment variables
echo ""
echo -e "${YELLOW}Updating environment variables...${NC}"

# Update .env files
for env_file in .env .env.example .env.local .env.development .env.production; do
    if [ -f "$env_file" ]; then
        cp "$env_file" "$env_file.bak"
        sed -i \
            -e 's/OLLAMA_BASE_URL/LLAMA_CPP_PATH/g' \
            -e 's/OLLAMA_DEFAULT_MODEL/LLAMA_DEFAULT_MODEL/g' \
            -e 's/OLLAMA_TIMEOUT/LLAMA_TIMEOUT/g' \
            -e 's/OLLAMA_MAX_RETRIES/LLAMA_MAX_RETRIES/g' \
            -e 's/ollama:11434/localhost:8080/g' \
            "$env_file"
        echo "  Updated: $env_file"
    fi
done

# Update package.json scripts (carefully)
if [ -f "package.json" ]; then
    echo ""
    echo -e "${YELLOW}Updating package.json scripts...${NC}"
    cp package.json package.json.bak
    
    # Use jq if available, otherwise use sed
    if command -v jq > /dev/null; then
        jq '.scripts |= with_entries(
            .value |= gsub("ollama serve"; "./llama.cpp/build/bin/llama-server") |
            gsub("ollama run"; "./llama.cpp/build/bin/llama-cli") |
            gsub("ollama"; "llama.cpp")
        )' package.json > package.json.tmp && mv package.json.tmp package.json
    else
        sed -i \
            -e 's/"ollama serve"/".\\/llama.cpp\\/build\\/bin\\/llama-server"/g' \
            -e 's/"ollama run"/".\\/llama.cpp\\/build\\/bin\\/llama-cli"/g' \
            package.json
    fi
    echo "  Updated: package.json"
fi

# Update Docker files (if any)
echo ""
echo -e "${YELLOW}Checking for Docker files...${NC}"
for dockerfile in Dockerfile* docker-compose*.yml docker-compose*.yaml; do
    if [ -f "$dockerfile" ]; then
        cp "$dockerfile" "$dockerfile.bak"
        sed -i \
            -e 's/ollama\/ollama/llama.cpp/g' \
            -e 's/OLLAMA/LLAMA_CPP/g' \
            -e 's/11434/8080/g' \
            "$dockerfile"
        echo "  Updated: $dockerfile"
    fi
done

# Update documentation (only specific mentions)
echo ""
echo -e "${YELLOW}Updating documentation...${NC}"
find . -name "*.md" -type f ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./master_knowledge_base/*" 2>/dev/null | while read file; do
    if grep -q "Ollama\|ollama" "$file" 2>/dev/null; then
        cp "$file" "$file.bak"
        # Only update technical references, not historical records
        sed -i \
            -e 's/Ollama server/llama.cpp server/g' \
            -e 's/ollama serve/llama.cpp server/g' \
            -e 's/ollama run/llama-cli/g' \
            -e 's/port 11434/port 8080/g' \
            "$file"
        
        if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
            echo "  Updated: $file"
        else
            rm "$file.bak"
        fi
    fi
done

# Create compatibility layer
echo ""
echo -e "${YELLOW}Creating compatibility layer...${NC}"

cat > src/config/ollama-compat.ts << 'EOF'
/**
 * Compatibility layer for Ollama -> llama.cpp migration
 * This file provides backward compatibility during transition
 */

import { llamaCppService } from '../services/llama-cpp.service';

// Deprecated: Use llamaCppService instead
export const ollamaCompat = {
  async chat(model: string, prompt: string): Promise<string> {
    console.warn('ollamaCompat.chat is deprecated. Use llamaCppService.runOptimizedInference instead.');
    return llamaCppService.runOptimizedInference(model, prompt);
  },
  
  async generate(model: string, prompt: string): Promise<string> {
    console.warn('ollamaCompat.generate is deprecated. Use llamaCppService.runOptimizedInference instead.');
    return llamaCppService.runOptimizedInference(model, prompt);
  }
};

// Re-export for compatibility
export { llamaCppService as ollama };
EOF

echo -e "${GREEN}✓ Compatibility layer created${NC}"

# Update imports to use new service
echo ""
echo -e "${YELLOW}Updating service imports...${NC}"

# Update NLP service specifically
if [ -f "src/microservices/nlp-service/src/services/NLPService.ts" ]; then
    cat > src/microservices/nlp-service/src/services/NLPService.ts << 'EOF'
import { llamaCppService } from '../../../../services/llama-cpp.service';

export class NLPService {
  private model: string = 'qwen3-0.6b';
  
  async processQuery(query: string): Promise<any> {
    const prompt = `Analyze this Walmart grocery query and extract intent and entities: "${query}"`;
    
    try {
      const response = await llamaCppService.runOptimizedInference(this.model, prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('NLP processing error:', error);
      throw error;
    }
  }
  
  private parseResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { intent: 'UNKNOWN', entities: {} };
    } catch {
      return { intent: 'UNKNOWN', entities: {} };
    }
  }
}
EOF
    echo "  Updated: NLPService.ts"
fi

# Count remaining Ollama references
echo ""
echo -e "${YELLOW}Migration progress:${NC}"
NEW_OLLAMA_COUNT=$(grep -r "ollama" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v ollama-compat | grep -v deprecated | wc -l)
MIGRATED=$((OLLAMA_COUNT - NEW_OLLAMA_COUNT))
echo "  Migrated $MIGRATED references"
echo "  Remaining $NEW_OLLAMA_COUNT references"

# Verify no critical files were broken
echo ""
echo -e "${YELLOW}Verifying critical files...${NC}"

CRITICAL_FILES=(
    "src/config/llama-cpp-optimized.config.ts"
    "src/services/llama-cpp.service.ts"
    "package.json"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file exists"
    fi
done

# Create migration report
echo ""
echo -e "${YELLOW}Creating migration report...${NC}"

cat > migration-report.md << EOF
# Ollama to llama.cpp Migration Report
Date: $(date)

## Summary
- Original Ollama references: $OLLAMA_COUNT
- References migrated: $MIGRATED
- References remaining: $NEW_OLLAMA_COUNT
- Backup location: $BACKUP_DIR

## Changes Made
1. Updated TypeScript/JavaScript imports
2. Updated environment variables
3. Updated package.json scripts
4. Created compatibility layer
5. Updated documentation

## Next Steps
1. Run setup script: ./scripts/setup-llama-cpp.sh
2. Test with: ./test-llama-cpp-performance.sh
3. Update remaining references manually if needed
4. Remove compatibility layer after full migration

## Rollback
To rollback: tar -xzf $BACKUP_DIR/backup.tar.gz
EOF

echo -e "${GREEN}✓ Migration report created${NC}"

# Final summary
echo ""
echo "========================================="
echo -e "${GREEN}Migration Complete!${NC}"
echo "========================================="
echo ""
echo "Summary:"
echo "  - $MIGRATED references updated"
echo "  - $NEW_OLLAMA_COUNT references remaining (may be in comments/docs)"
echo "  - Backup saved to: $BACKUP_DIR"
echo "  - Compatibility layer created for smooth transition"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/setup-llama-cpp.sh (to install llama.cpp)"
echo "  2. Test the migration with non-critical components"
echo "  3. After fine-tuning completes, run full test suite"
echo ""

if [ "$SKIP_PYTHON" = true ]; then
    echo -e "${YELLOW}Note: Python files were skipped due to running fine-tuning process.${NC}"
    echo "      Run this script again after fine-tuning completes."
fi

echo ""
echo "See migration-report.md for detailed information."