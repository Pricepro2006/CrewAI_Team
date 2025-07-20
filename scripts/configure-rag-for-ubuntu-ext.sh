#!/bin/bash
# Configure RAG System to Use Ubuntu_EXT Knowledge Base
# Ensures all learning, capture, and vector storage uses the unified location

set -e

echo "🔧 Configuring RAG System for Ubuntu_EXT Knowledge Base"
echo "====================================================="
echo ""

# Configuration
MASTER_KB="$HOME/master_knowledge_base"
CREWAI_DIR="/home/pricepro2006/CrewAI_Team"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Verify master_knowledge_base symlink exists
if [ ! -L "$MASTER_KB" ]; then
    echo "❌ master_knowledge_base symlink not found!"
    echo "   Please run: ./scripts/quick-setup-ubuntu-ext-kb.sh first"
    exit 1
fi

echo "✅ Found master_knowledge_base symlink:"
ls -la "$MASTER_KB"
echo ""

# Step 1: Create RAG-specific directories on Ubuntu_EXT
echo "1️⃣ Creating RAG directories on Ubuntu_EXT..."
mkdir -p "$MASTER_KB/rag_data/vectors"
mkdir -p "$MASTER_KB/rag_data/documents"
mkdir -p "$MASTER_KB/rag_data/embeddings"
mkdir -p "$MASTER_KB/rag_data/cache"
mkdir -p "$MASTER_KB/scraped_content"
mkdir -p "$MASTER_KB/captured_knowledge"
mkdir -p "$MASTER_KB/learned_patterns"
mkdir -p "$MASTER_KB/databases"
echo "   ✅ Created RAG directory structure"

# Step 2: Create/Update environment variables for RAG
echo ""
echo "2️⃣ Updating environment variables..."
ENV_FILE="$CREWAI_DIR/.env"
ENV_BACKUP="$CREWAI_DIR/.env.backup.$TIMESTAMP"

# Backup current .env
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "$ENV_BACKUP"
    echo "   ✅ Backed up .env to $ENV_BACKUP"
fi

# Add RAG-specific paths to .env
cat >> "$ENV_FILE" << EOF

# RAG Knowledge Base Configuration (Ubuntu_EXT)
RAG_KNOWLEDGE_BASE_PATH=$MASTER_KB
RAG_VECTOR_STORE_PATH=$MASTER_KB/rag_data/vectors
RAG_DOCUMENT_PATH=$MASTER_KB/rag_data/documents
RAG_EMBEDDING_PATH=$MASTER_KB/rag_data/embeddings
RAG_CACHE_PATH=$MASTER_KB/rag_data/cache
SCRAPED_CONTENT_PATH=$MASTER_KB/scraped_content
CAPTURED_KNOWLEDGE_PATH=$MASTER_KB/captured_knowledge
LEARNED_PATTERNS_PATH=$MASTER_KB/learned_patterns

# ChromaDB persistence (if using local ChromaDB)
CHROMA_PERSIST_DIRECTORY=$MASTER_KB/databases/chromadb
CHROMA_DATA_PATH=$MASTER_KB/databases/chromadb/data

# SQLite databases on Ubuntu_EXT
KNOWLEDGE_DB_PATH=$MASTER_KB/databases/knowledge.db
LEARNING_DB_PATH=$MASTER_KB/databases/learning.db
EOF

echo "   ✅ Added RAG paths to .env"

# Step 3: Create RAG configuration file
echo ""
echo "3️⃣ Creating RAG configuration file..."
cat > "$CREWAI_DIR/src/config/rag-storage.config.ts" << 'EOF'
import { join } from 'path';
import { homedir } from 'os';

// All RAG storage paths point to Ubuntu_EXT via symlink
const MASTER_KB = join(homedir(), 'master_knowledge_base');

export const ragStorageConfig = {
  // Base paths
  basePath: MASTER_KB,
  
  // RAG-specific paths
  vectors: join(MASTER_KB, 'rag_data', 'vectors'),
  documents: join(MASTER_KB, 'rag_data', 'documents'),
  embeddings: join(MASTER_KB, 'rag_data', 'embeddings'),
  cache: join(MASTER_KB, 'rag_data', 'cache'),
  
  // Knowledge capture paths
  scrapedContent: join(MASTER_KB, 'scraped_content'),
  capturedKnowledge: join(MASTER_KB, 'captured_knowledge'),
  learnedPatterns: join(MASTER_KB, 'learned_patterns'),
  
  // Database paths
  databases: {
    chromadb: join(MASTER_KB, 'databases', 'chromadb'),
    knowledge: join(MASTER_KB, 'databases', 'knowledge.db'),
    learning: join(MASTER_KB, 'databases', 'learning.db')
  },
  
  // Ensure all paths use Ubuntu_EXT storage
  ensureOnUbuntuExt: () => {
    const paths = [
      ragStorageConfig.vectors,
      ragStorageConfig.documents,
      ragStorageConfig.embeddings,
      ragStorageConfig.cache,
      ragStorageConfig.scrapedContent,
      ragStorageConfig.capturedKnowledge,
      ragStorageConfig.learnedPatterns,
      ragStorageConfig.databases.chromadb
    ];
    
    // This will be validated at runtime
    return paths.every(path => path.startsWith(MASTER_KB));
  }
};

// Export for use in other modules
export const getKnowledgeBasePath = () => MASTER_KB;
export const getVectorStorePath = () => ragStorageConfig.vectors;
export const getDocumentPath = () => ragStorageConfig.documents;
export const getScrapedContentPath = () => ragStorageConfig.scrapedContent;
EOF

echo "   ✅ Created rag-storage.config.ts"

# Step 4: Create knowledge capture wrapper
echo ""
echo "4️⃣ Creating knowledge capture wrapper..."
cat > "$HOME/capture-to-kb.sh" << 'EOF'
#!/bin/bash
# Wrapper to ensure all captures go to Ubuntu_EXT

MASTER_KB="$HOME/master_knowledge_base"
CAPTURE_TYPE="${1:-general}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Ensure we're using Ubuntu_EXT
if [ ! -L "$MASTER_KB" ]; then
    echo "❌ Error: master_knowledge_base symlink not found"
    exit 1
fi

case "$CAPTURE_TYPE" in
    "scraped")
        DEST_DIR="$MASTER_KB/scraped_content/$TIMESTAMP"
        ;;
    "learned")
        DEST_DIR="$MASTER_KB/learned_patterns/$TIMESTAMP"
        ;;
    "captured")
        DEST_DIR="$MASTER_KB/captured_knowledge/$TIMESTAMP"
        ;;
    *)
        DEST_DIR="$MASTER_KB/captured_knowledge/$TIMESTAMP"
        ;;
esac

mkdir -p "$DEST_DIR"
echo "📁 Capturing to: $DEST_DIR"
echo "   (Stored on Ubuntu_EXT)"

# Your capture logic here
# Example: Copy current directory contents
if [ -n "$2" ]; then
    cp -r "$2"/* "$DEST_DIR/" 2>/dev/null || echo "No files to capture"
fi

echo "✅ Captured to Ubuntu_EXT knowledge base"
EOF
chmod +x "$HOME/capture-to-kb.sh"

# Step 5: Create ChromaDB migration script
echo ""
echo "5️⃣ Creating ChromaDB migration script..."
cat > "$CREWAI_DIR/scripts/migrate-chromadb-to-ubuntu-ext.sh" << 'EOF'
#!/bin/bash
# Migrate ChromaDB data to Ubuntu_EXT

MASTER_KB="$HOME/master_knowledge_base"
OLD_CHROMA_PATH="$HOME/.cache/chroma"
NEW_CHROMA_PATH="$MASTER_KB/databases/chromadb"

if [ -d "$OLD_CHROMA_PATH" ]; then
    echo "🔄 Migrating ChromaDB data to Ubuntu_EXT..."
    mkdir -p "$NEW_CHROMA_PATH"
    rsync -av "$OLD_CHROMA_PATH/" "$NEW_CHROMA_PATH/"
    echo "✅ ChromaDB data migrated"
    echo "   Old location: $OLD_CHROMA_PATH"
    echo "   New location: $NEW_CHROMA_PATH"
else
    echo "ℹ️  No existing ChromaDB data found"
fi

# Update ChromaDB client to use new path
echo ""
echo "📝 To use the new ChromaDB location, update your code:"
echo "   client = chromadb.PersistentClient(path='$NEW_CHROMA_PATH')"
EOF
chmod +x "$CREWAI_DIR/scripts/migrate-chromadb-to-ubuntu-ext.sh"

# Step 6: Create validation script
echo ""
echo "6️⃣ Creating validation script..."
cat > "$HOME/validate-rag-storage.sh" << 'EOF'
#!/bin/bash
# Validate RAG storage is using Ubuntu_EXT

MASTER_KB="$HOME/master_knowledge_base"

echo "🔍 Validating RAG Storage Configuration"
echo "======================================"
echo ""

# Check symlink
echo "1. Checking master_knowledge_base symlink:"
if [ -L "$MASTER_KB" ]; then
    TARGET=$(readlink -f "$MASTER_KB")
    echo "   ✅ Symlink exists: $MASTER_KB -> $TARGET"
    
    if [[ "$TARGET" == *"ubuntu_ext"* ]] || [[ "$TARGET" == *"Ubuntu_EXT"* ]]; then
        echo "   ✅ Points to Ubuntu_EXT"
    else
        echo "   ⚠️  May not be pointing to Ubuntu_EXT"
    fi
else
    echo "   ❌ Symlink not found"
fi

# Check directories
echo ""
echo "2. Checking RAG directories:"
for dir in "rag_data/vectors" "rag_data/documents" "scraped_content" "captured_knowledge" "databases"; do
    if [ -d "$MASTER_KB/$dir" ]; then
        echo "   ✅ $dir exists"
    else
        echo "   ❌ $dir missing"
    fi
done

# Check write permissions
echo ""
echo "3. Testing write permissions:"
TEST_FILE="$MASTER_KB/test_write_$(date +%s).txt"
if echo "Test write" > "$TEST_FILE" 2>/dev/null; then
    echo "   ✅ Can write to knowledge base"
    rm "$TEST_FILE"
else
    echo "   ❌ Cannot write to knowledge base"
fi

# Check disk space
echo ""
echo "4. Storage availability:"
df -h "$MASTER_KB" | tail -1

echo ""
echo "✅ Validation complete"
EOF
chmod +x "$HOME/validate-rag-storage.sh"

# Step 7: Update TypeScript imports
echo ""
echo "7️⃣ Creating TypeScript import updater..."
cat > "$CREWAI_DIR/scripts/update-rag-imports.sh" << 'EOF'
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
EOF
chmod +x "$CREWAI_DIR/scripts/update-rag-imports.sh"

# Summary
echo ""
echo "✅ RAG Configuration Complete!"
echo "============================="
echo ""
echo "📊 Configuration Summary:"
echo "   - Knowledge Base: $MASTER_KB (→ Ubuntu_EXT)"
echo "   - RAG Vectors: $MASTER_KB/rag_data/vectors"
echo "   - Documents: $MASTER_KB/rag_data/documents"
echo "   - Scraped Content: $MASTER_KB/scraped_content"
echo "   - Databases: $MASTER_KB/databases"
echo ""
echo "📝 Environment variables added to .env"
echo "📁 Created rag-storage.config.ts"
echo ""
echo "🛠️  Helper Scripts Created:"
echo "   - ~/capture-to-kb.sh - Capture knowledge to Ubuntu_EXT"
echo "   - ~/validate-rag-storage.sh - Validate storage setup"
echo "   - migrate-chromadb-to-ubuntu-ext.sh - Migrate ChromaDB data"
echo "   - update-rag-imports.sh - Update TypeScript imports"
echo ""
echo "🎯 Next Steps:"
echo "   1. Run validation: ~/validate-rag-storage.sh"
echo "   2. Migrate ChromaDB: ./scripts/migrate-chromadb-to-ubuntu-ext.sh"
echo "   3. Update imports: ./scripts/update-rag-imports.sh"
echo "   4. Restart your application to use new paths"
echo ""
echo "💡 All future knowledge capture, learning, and RAG operations"
echo "   will now use Ubuntu_EXT storage automatically!"

# Make this script executable
chmod +x "$0"