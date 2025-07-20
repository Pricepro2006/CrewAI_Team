#!/bin/bash

# Test query for irrigation specialist
QUERY="Find irrigation specialists to assist with a cracked, leaking sprinkler head from a root growing into the irrigation piping, for the area surrounding 278 Wycliff Dr. Spartanburg, SC 29301. They need to be able to travel to this location and if you can include initial visit costs, add that information as well."

# Models to test
MODELS=(
  "hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:latest"
  "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:latest"
  "alibayram/smollm3:latest"
  "qwen3:0.6b"
  "gemma3n:e2b"
  "gemma3n:e4b"
  "phi4-mini-reasoning:3.8b"
  "qwen3:1.7b"
  "qwen3:4b"
  "granite3.3:8b"
  "granite3.3:2b"
)

# Output file
OUTPUT_FILE="irrigation-test-results-$(date +%Y%m%d-%H%M%S).json"

echo "[" > "$OUTPUT_FILE"
FIRST=true

for MODEL in "${MODELS[@]}"; do
  echo "Testing model: $MODEL"
  echo "============================================"
  
  START_TIME=$(date +%s.%N)
  
  # Test the model with our query
  RESPONSE=$(curl -s http://localhost:11434/api/generate \
    -d '{
      "model": "'"$MODEL"'",
      "prompt": "'"$QUERY"'",
      "stream": false,
      "options": {
        "temperature": 0.7,
        "max_tokens": 1000
      }
    }' | jq -r '.response // empty')
  
  END_TIME=$(date +%s.%N)
  DURATION=$(echo "$END_TIME - $START_TIME" | bc)
  
  # Add comma if not first entry
  if [ "$FIRST" = false ]; then
    echo "," >> "$OUTPUT_FILE"
  fi
  FIRST=false
  
  # Save result to JSON
  jq -n \
    --arg model "$MODEL" \
    --arg response "$RESPONSE" \
    --arg duration "$DURATION" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      model: $model,
      duration: ($duration | tonumber),
      timestamp: $timestamp,
      response: $response
    }' >> "$OUTPUT_FILE"
  
  echo "Response preview (first 200 chars):"
  echo "$RESPONSE" | head -c 200
  echo -e "\n\nDuration: ${DURATION}s"
  echo "============================================"
  echo
  
  # Brief pause between models
  sleep 2
done

echo "]" >> "$OUTPUT_FILE"

echo "Test complete! Results saved to: $OUTPUT_FILE"

# Generate summary report
echo -e "\n\nSUMMARY REPORT"
echo "============================================"
echo "Models tested: ${#MODELS[@]}"
echo "Output file: $OUTPUT_FILE"

# Quick analysis using Python
python3 - <<EOF
import json
import re

with open('$OUTPUT_FILE', 'r') as f:
    results = json.load(f)

print("\nQuick Analysis:")
print("-" * 60)

for result in results:
    model = result['model'].split(':')[0].split('/')[-1]
    response = result['response'].lower()
    duration = result['duration']
    
    # Check for key elements
    has_location = 'spartanburg' in response or '29301' in response
    has_root = 'root' in response
    has_cost = '$' in response or 'cost' in response or 'price' in response
    has_search = any(term in response for term in ['search', 'find', 'google', 'directory'])
    has_contact = any(term in response for term in ['call', 'phone', 'contact', 'email'])
    
    score = sum([has_location, has_root, has_cost, has_search, has_contact])
    
    print(f"{model[:30]:<30} | Duration: {duration:>6.1f}s | Score: {score}/5")
    print(f"  Location: {'✓' if has_location else '✗'} | Root: {'✓' if has_root else '✗'} | Cost: {'✓' if has_cost else '✗'} | Search: {'✓' if has_search else '✗'} | Contact: {'✓' if has_contact else '✗'}")
    print()

EOF