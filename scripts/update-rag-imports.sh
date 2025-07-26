#!/bin/bash
# Add import for rag-storage.config.ts to relevant files

IMPORT_LINE="import { ragStorageConfig, getKnowledgeBasePath } from '../config/rag-storage.config';"

# Files that likely need the import
FILES=(
    "src/core/rag/VectorStore.ts"
    "src/core/rag/PineconeVectorStore.ts"
    "src/core/rag/confidence/ConfidenceRAGRetriever.ts"
    "src/core/master-orchestrator/MasterOrchestrator.ts"
)

for file in "${FILES[@]}"; do
    FILE_PATH="/home/pricepro2006/CrewAI_Team/$file"
    if [ -f "$FILE_PATH" ]; then
        # Check if import already exists
        if ! grep -q "rag-storage.config" "$FILE_PATH"; then
            echo "Adding import to: $file"
            # Add import after the first import line
            sed -i "0,/^import/s/^import/$IMPORT_LINE\nimport/" "$FILE_PATH"
        fi
    fi
done
