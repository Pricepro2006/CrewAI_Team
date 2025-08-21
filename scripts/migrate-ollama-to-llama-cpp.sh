#!/bin/bash

# Migrate from Ollama to llama.cpp
# This script updates all references in the codebase

echo "========================================="
echo "Migrating from Ollama to llama.cpp"
echo "========================================="

# Backup first
echo "Creating backup..."
tar -czf backup-before-llama-migration-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=build \
  src/ tests/ scripts/ *.md *.json *.ts

echo "✅ Backup created"

# Count current references
echo ""
echo "Current Ollama references:"
grep -r "ollama" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md" . 2>/dev/null | grep -v node_modules | wc -l

# Update TypeScript/JavaScript files
echo ""
echo "Updating TypeScript/JavaScript files..."

# Update imports
find src tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i \
  -e 's/from.*ollama\.config/from "..\/config\/llama-cpp.config"/g' \
  -e 's/import.*ollama/import llamaCpp/g' \
  -e 's/OllamaConfig/LlamaCppConfig/g' \
  -e 's/ollamaConfig/llamaCppConfig/g' \
  {} \;

# Update function calls
find src tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i \
  -e 's/ollama\.chat/llamaCpp.inference/g' \
  -e 's/ollama\.generate/llamaCpp.generate/g' \
  -e 's/OLLAMA_/LLAMA_CPP_/g' \
  {} \;

# Update environment variables
echo ""
echo "Updating environment variables..."
if [ -f .env ]; then
  sed -i \
    -e 's/OLLAMA_BASE_URL/LLAMA_CPP_PATH/g' \
    -e 's/OLLAMA_DEFAULT_MODEL/LLAMA_DEFAULT_MODEL/g' \
    -e 's/OLLAMA_TIMEOUT/LLAMA_TIMEOUT/g' \
    -e 's/OLLAMA_MAX_RETRIES/LLAMA_MAX_RETRIES/g' \
    .env
fi

if [ -f .env.example ]; then
  sed -i \
    -e 's/OLLAMA_BASE_URL/LLAMA_CPP_PATH/g' \
    -e 's/OLLAMA_DEFAULT_MODEL/LLAMA_DEFAULT_MODEL/g' \
    -e 's/OLLAMA_TIMEOUT/LLAMA_TIMEOUT/g' \
    -e 's/OLLAMA_MAX_RETRIES/LLAMA_MAX_RETRIES/g' \
    .env.example
fi

# Update package.json scripts
echo ""
echo "Updating package.json scripts..."
if [ -f package.json ]; then
  sed -i \
    -e 's/"ollama/"llama.cpp/g' \
    -e 's/ollama serve/\.\/llama.cpp\/build\/bin\/llama-server/g' \
    package.json
fi

# Update Docker files
echo ""
echo "Updating Docker files..."
for dockerfile in Dockerfile* docker-compose*.yml; do
  if [ -f "$dockerfile" ]; then
    sed -i \
      -e 's/ollama\/ollama/llama.cpp/g' \
      -e 's/OLLAMA/LLAMA_CPP/g' \
      -e 's/11434/8080/g' \
      "$dockerfile"
  fi
done

# Update documentation
echo ""
echo "Updating documentation..."
find . -name "*.md" -type f ! -path "./node_modules/*" ! -path "./.git/*" -exec sed -i \
  -e 's/Ollama/llama.cpp/g' \
  -e 's/ollama/llama.cpp/g' \
  -e 's/OLLAMA/LLAMA_CPP/g' \
  {} \;

# Special case: Update NLP service
echo ""
echo "Updating NLP service specifically..."
if [ -f src/microservices/nlp-service/src/services/NLPService.ts ]; then
  cat > src/microservices/nlp-service/src/services/NLPService.ts.new << 'EOF'
import { runLlamaCppInference } from '../../../../config/llama-cpp.config';

export class NLPService {
  private model: string = 'qwen3-0.6b-instruct.Q8_0.gguf';
  
  async processQuery(query: string): Promise<any> {
    const prompt = `Analyze this Walmart grocery query and extract intent and entities: "${query}"`;
    
    try {
      const response = await runLlamaCppInference(this.model, prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('NLP processing error:', error);
      throw error;
    }
  }
  
  private parseResponse(response: string): any {
    try {
      // Extract JSON from response
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
  mv src/microservices/nlp-service/src/services/NLPService.ts.new \
     src/microservices/nlp-service/src/services/NLPService.ts
fi

# Remove old Ollama config file
echo ""
echo "Removing old Ollama config..."
if [ -f src/config/ollama.config.ts ]; then
  mv src/config/ollama.config.ts src/config/ollama.config.ts.deprecated
  echo "✅ Moved ollama.config.ts to ollama.config.ts.deprecated"
fi

# Final count
echo ""
echo "Remaining Ollama references after migration:"
grep -r "ollama" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v deprecated | wc -l

echo ""
echo "========================================="
echo "Migration complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Install llama.cpp: git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp && make"
echo "2. Download GGUF models to ./models directory"
echo "3. Update .env with LLAMA_CPP_PATH"
echo "4. Run tests to verify migration"
echo ""
echo "Backup saved as: backup-before-llama-migration-*.tar.gz"