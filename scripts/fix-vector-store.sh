#!/bin/bash
# Fix Vector Store Implementation Script
# This script addresses the vector store issues and prepares for multi-store integration

set -e

CREWAI_DIR="/home/pricepro2006/CrewAI_Team"
MASTER_KB="/home/pricepro2006/master_knowledge_base"

echo "🔧 CrewAI Vector Store Fix Script"
echo "================================="
echo ""

# Function to check if ChromaDB is running
check_chromadb() {
    echo "🔍 Checking ChromaDB status..."
    if curl -f -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
        echo "✅ ChromaDB is running"
        return 0
    else
        echo "❌ ChromaDB is not running"
        return 1
    fi
}

# Function to start ChromaDB
start_chromadb() {
    echo "🚀 Starting ChromaDB..."
    
    # Check if docker-compose file exists
    if [ -f "$CREWAI_DIR/docker/docker-compose.yml" ]; then
        cd "$CREWAI_DIR"
        
        # Start only ChromaDB service
        docker-compose -f docker/docker-compose.yml up -d chromadb
        
        # Wait for ChromaDB to be ready
        echo "⏳ Waiting for ChromaDB to start..."
        for i in {1..30}; do
            if check_chromadb; then
                return 0
            fi
            sleep 2
        done
        
        echo "❌ ChromaDB failed to start after 60 seconds"
        return 1
    else
        echo "❌ docker-compose.yml not found"
        return 1
    fi
}

# Function to create necessary directories
setup_directories() {
    echo "📁 Setting up directories..."
    
    # Create ChromaDB data directory
    mkdir -p "$CREWAI_DIR/data/chroma"
    echo "✅ Created ChromaDB data directory"
    
    # Create vector store backup directory
    mkdir -p "$MASTER_KB/CrewAI_Team/vector_store_backups"
    echo "✅ Created vector store backup directory"
}

# Function to check source files
check_source_files() {
    echo "📄 Checking source files..."
    
    local vector_store_src="$CREWAI_DIR/src/core/rag/VectorStore.ts"
    local rag_system_src="$CREWAI_DIR/src/core/rag/RAGSystem.ts"
    
    if [ ! -s "$vector_store_src" ]; then
        echo "⚠️  VectorStore.ts is empty or missing"
        echo "   Attempting to restore from git..."
        
        cd "$CREWAI_DIR"
        # Try to restore from git
        if git show HEAD:src/core/rag/VectorStore.ts > /tmp/VectorStore.ts.tmp 2>/dev/null; then
            if [ -s /tmp/VectorStore.ts.tmp ]; then
                cp /tmp/VectorStore.ts.tmp "$vector_store_src"
                echo "✅ Restored VectorStore.ts from git history"
            else
                echo "❌ VectorStore.ts not found in git history"
            fi
        fi
    else
        echo "✅ VectorStore.ts exists"
    fi
    
    if [ ! -s "$rag_system_src" ]; then
        echo "⚠️  RAGSystem.ts is empty or missing"
        echo "   Attempting to restore from git..."
        
        cd "$CREWAI_DIR"
        # Try to restore from git
        if git show HEAD:src/core/rag/RAGSystem.ts > /tmp/RAGSystem.ts.tmp 2>/dev/null; then
            if [ -s /tmp/RAGSystem.ts.tmp ]; then
                cp /tmp/RAGSystem.ts.tmp "$rag_system_src"
                echo "✅ Restored RAGSystem.ts from git history"
            else
                echo "❌ RAGSystem.ts not found in git history"
            fi
        fi
    else
        echo "✅ RAGSystem.ts exists"
    fi
}

# Function to test MCP vectorize
test_mcp_vectorize() {
    echo "🧪 Testing MCP Vectorize connection..."
    
    # Create a test script
    cat > /tmp/test_mcp_vectorize.js << 'EOF'
const testDoc = "This is a test document for MCP Vectorize";
const base64Doc = Buffer.from(testDoc).toString('base64');

console.log("Testing MCP Vectorize...");
console.log("Base64 document:", base64Doc);
console.log("\nTo test, use the MCP tool: mcp__vectorize__extract with:");
console.log(JSON.stringify({
    base64Document: base64Doc,
    contentType: "text/plain"
}, null, 2));
EOF
    
    node /tmp/test_mcp_vectorize.js
    
    echo ""
    echo "📝 Note: You can test MCP Vectorize using Claude's MCP tools"
}

# Function to create vector store interface
create_vector_store_interface() {
    echo "🏗️  Creating vector store interface..."
    
    # Create the interface file if it doesn't exist
    cat > "$CREWAI_DIR/src/core/rag/IVectorStore.ts" << 'EOF'
import type { ProcessedDocument, QueryResult, Document } from './types';

export interface IVectorStore {
  initialize(): Promise<void>;
  addDocuments(documents: ProcessedDocument[]): Promise<void>;
  search(query: string, limit?: number): Promise<QueryResult[]>;
  searchWithFilter(query: string, filter: Record<string, any>, limit?: number): Promise<QueryResult[]>;
  getDocument(documentId: string): Promise<Document | null>;
  deleteBySourceId(sourceId: string): Promise<void>;
  getAllDocuments(limit?: number, offset?: number): Promise<Document[]>;
  getDocumentCount(): Promise<number>;
  getChunkCount(): Promise<number>;
  clear(): Promise<void>;
}

export interface VectorStoreHealth {
  isHealthy: boolean;
  message: string;
  details?: Record<string, any>;
}
EOF
    
    echo "✅ Created IVectorStore interface"
}

# Function to create configuration update
create_config_update() {
    echo "📝 Creating configuration update..."
    
    cat > "$CREWAI_DIR/src/config/vector-store.config.ts" << 'EOF'
export const vectorStoreConfig = {
  // Local ChromaDB for development
  local: {
    type: 'chromadb' as const,
    baseUrl: process.env.CHROMA_URL || 'http://localhost:8000',
    collectionName: 'crewai_local',
    path: './data/chroma'
  },
  
  // MCP Vectorize for cloud storage
  mcpVectorize: {
    type: 'mcp-vectorize' as const,
    pipelineId: process.env.VECTORIZE_PIPELINE_ID || 'aipadf43-891f-4b5c-89aa-7d6f70cba7f9',
    orgId: process.env.VECTORIZE_ORG_ID || '9dcdd948-0619-4c58-bf9b-f5674e2180ec'
  },
  
  // Pinecone for production (to be configured)
  pinecone: {
    type: 'pinecone' as const,
    apiKey: process.env.PINECONE_API_KEY || '',
    environment: process.env.PINECONE_ENV || 'us-east-1',
    indexName: process.env.PINECONE_INDEX || 'crewai-production'
  },
  
  // Hybrid configuration
  hybrid: {
    primary: 'chromadb',
    secondary: ['mcp-vectorize'],
    syncInterval: 3600000, // 1 hour
    syncOnStartup: true
  }
};
EOF
    
    echo "✅ Created vector store configuration"
}

# Function to generate summary report
generate_report() {
    echo ""
    echo "📊 Vector Store Fix Summary"
    echo "==========================="
    
    # Check ChromaDB status
    if check_chromadb; then
        echo "✅ ChromaDB: Running"
    else
        echo "❌ ChromaDB: Not running"
    fi
    
    # Check directories
    if [ -d "$CREWAI_DIR/data/chroma" ]; then
        echo "✅ Data directory: Created"
    else
        echo "❌ Data directory: Missing"
    fi
    
    # Check source files
    if [ -s "$CREWAI_DIR/src/core/rag/VectorStore.ts" ]; then
        echo "✅ VectorStore.ts: Present"
    else
        echo "❌ VectorStore.ts: Empty/Missing"
    fi
    
    if [ -s "$CREWAI_DIR/src/core/rag/RAGSystem.ts" ]; then
        echo "✅ RAGSystem.ts: Present"
    else
        echo "❌ RAGSystem.ts: Empty/Missing"
    fi
    
    echo ""
    echo "📋 Next Steps:"
    echo "1. Install Pinecone SDK: pnpm add @pinecone-database/pinecone"
    echo "2. Configure Pinecone API key in .env"
    echo "3. Implement MCPVectorizeStore class"
    echo "4. Implement PineconeVectorStore class"
    echo "5. Update RAGSystem to use VectorStoreFactory"
    echo "6. Test multi-store functionality"
    echo ""
    echo "📚 Documentation: $MASTER_KB/CrewAI_Team/VECTOR_STORE_ANALYSIS.md"
}

# Main execution
main() {
    echo "Starting vector store fix process..."
    echo ""
    
    # Step 1: Setup directories
    setup_directories
    echo ""
    
    # Step 2: Check and start ChromaDB
    if ! check_chromadb; then
        start_chromadb
    fi
    echo ""
    
    # Step 3: Check source files
    check_source_files
    echo ""
    
    # Step 4: Create interfaces and configs
    create_vector_store_interface
    create_config_update
    echo ""
    
    # Step 5: Test MCP Vectorize
    test_mcp_vectorize
    echo ""
    
    # Step 6: Generate report
    generate_report
}

# Run main function
main