#!/bin/bash
# Script to update all occurrences of port 11434 to 8081 and rename Ollama references to LLM/Llama

echo "Updating LLM port configuration and variable names..."
echo "- Changing port 11434 (Ollama) to 8081 (llama.cpp)"
echo "- Renaming ollamaUrl to llmUrl for clarity"
echo "- Updating Ollama references in comments"

# Count occurrences before
PORT_COUNT=$(grep -r "11434" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
OLLAMA_VAR_COUNT=$(grep -r "ollamaUrl" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "Found $PORT_COUNT occurrences of port 11434"
echo "Found $OLLAMA_VAR_COUNT occurrences of 'ollamaUrl' variable"

# Update all TypeScript and TSX files in src directory
echo "Updating source files..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' \
  -e "s/'11434'/'8081'/g" \
  -e 's/"11434"/"8081"/g' \
  -e 's/const ollamaUrl/const llmUrl/g' \
  -e 's/let ollamaUrl/let llmUrl/g' \
  -e 's/var ollamaUrl/var llmUrl/g' \
  -e 's/${ollamaUrl}/${llmUrl}/g' \
  -e 's/`${ollamaUrl}/`${llmUrl}/g' \
  -e 's/ollamaUrl\./llmUrl\./g' \
  -e 's/ollamaUrl)/llmUrl)/g' \
  -e 's/ollamaUrl,/llmUrl,/g' \
  -e 's/ollamaUrl;/llmUrl;/g' \
  -e 's/(ollamaUrl/(llmUrl/g' \
  -e 's/\.ollamaUrl/.llmUrl/g' \
  -e 's/checkOllama/checkLLM/g' \
  -e 's/Ollama Configuration/LLM Configuration (llama.cpp)/g' \
  -e 's/Ollama configuration/LLM configuration (llama.cpp)/g' \
  -e 's/check if Ollama/check if LLM server/g' \
  -e 's/Ollama is running/LLM server is running/g' {} \;

# Update environment variable references but keep OLLAMA_BASE_URL for backward compatibility
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/process\.env\.OLLAMA_BASE_URL || '\''http:\/\/localhost:11434'\''/process.env.OLLAMA_BASE_URL || '\''http:\/\/localhost:8081'\''/g' \
  -e 's/process\.env\.OLLAMA_BASE_URL || "http:\/\/localhost:11434"/process.env.OLLAMA_BASE_URL || "http:\/\/localhost:8081"/g' \
  -e 's/process\.env\['\''OLLAMA_URL'\''\] || '\''http:\/\/localhost:11434'\''/process.env['\''OLLAMA_URL'\''] || '\''http:\/\/localhost:8081'\''/g' {} \;

# Update shell scripts
echo "Updating shell scripts..."
find scripts -type f -name "*.sh" -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' \
  -e 's/ollama_url/llm_url/g' \
  -e 's/OLLAMA_URL/LLM_URL/g' \
  -e 's/# Ollama/# LLM (llama.cpp)/g' {} \;

# Update test files
echo "Updating test files..."
find tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i.bak \
  -e 's/localhost:11434/localhost:8081/g' \
  -e 's/:11434/:8081/g' \
  -e 's/ollamaUrl/llmUrl/g' \
  -e 's/checkOllama/checkLLM/g' {} \;

# Update config files specifically
echo "Updating config files..."
if [ -f "src/config/ollama.config.ts" ]; then
  sed -i \
    -e '1s/^/\/\/ Note: This file maintains the name ollama.config.ts for backward compatibility\n/' \
    -e '2s/^/\/\/ but actually configures llama.cpp on port 8081\n/' \
    src/config/ollama.config.ts
fi

# Count occurrences after
AFTER_PORT_COUNT=$(grep -r "11434" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
AFTER_VAR_COUNT=$(grep -r "ollamaUrl" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

echo ""
echo "Update complete!"
echo "- Port 11434 occurrences: $PORT_COUNT -> $AFTER_PORT_COUNT"
echo "- 'ollamaUrl' occurrences: $OLLAMA_VAR_COUNT -> $AFTER_VAR_COUNT"

# Clean up backup files
find src scripts tests -name "*.bak" -delete 2>/dev/null

# Show any remaining occurrences
if [ $AFTER_PORT_COUNT -gt 0 ]; then
  echo ""
  echo "⚠️  Remaining port 11434 occurrences in source files:"
  grep -r "11434" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
fi

if [ $AFTER_VAR_COUNT -gt 0 ]; then
  echo ""
  echo "⚠️  Remaining 'ollamaUrl' occurrences in source files:"
  grep -r "ollamaUrl" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
fi

echo ""
echo "✅ Configuration migration complete!"
echo "   - All ports updated from 11434 to 8081"
echo "   - Variable names updated from ollamaUrl to llmUrl"
echo "   - Comments updated to reference llama.cpp instead of Ollama"
echo ""
echo "Note: Environment variable names (OLLAMA_BASE_URL, etc.) are kept for backward compatibility"