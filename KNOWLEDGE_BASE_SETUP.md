# Knowledge Base Setup Guide - CrewAI Team

**Date:** January 21, 2025  
**Issue:** Accessing master_knowledge_base from ubuntu_ext distro

## Current Situation

1. **Configuration Expectation**: The project expects `master_knowledge_base` at `~/master_knowledge_base`
2. **Intended Location**: Should be on ubuntu_ext distro for space savings
3. **Current State**: Symbolic link exists but target is not accessible

## Access Methods Between WSL Distros

### Option 1: Direct Mount Access (Requires Admin)
```bash
# From Windows PowerShell (as Administrator):
wsl --mount \\wsl$\ubuntu_ext\home\pricepro2006\master_knowledge_base

# Then in Ubuntu:
ln -s /mnt/ubuntu_ext/home/pricepro2006/master_knowledge_base ~/master_knowledge_base
```

### Option 2: Network Share Access
```bash
# Access through WSL network path
ln -s //wsl$/ubuntu_ext/home/pricepro2006/master_knowledge_base ~/master_knowledge_base
```

### Option 3: Temporary Local Setup (Current Solution)
Since we cannot directly access ubuntu_ext from the current Ubuntu distro without additional setup, we can:

1. **Create a temporary local knowledge base** for testing
2. **Document the proper setup** for production deployment
3. **Use ChromaDB HTTP API** instead of file-based storage

## Temporary Local Setup

```bash
# Create local knowledge base structure
mkdir -p ~/temp_knowledge_base/{rag_data/{vectors,documents,embeddings,cache},scraped_content,captured_knowledge,learned_patterns,databases}

# Update the symlink
rm -f ~/master_knowledge_base
ln -s ~/temp_knowledge_base ~/master_knowledge_base
```

## Configuration Updates Needed

### 1. Update RAG Storage Config
Modify `/src/config/rag-storage.config.ts` to support configurable paths:

```typescript
const MASTER_KB = process.env.KNOWLEDGE_BASE_PATH || 
                  join(homedir(), 'master_knowledge_base');
```

### 2. Use ChromaDB HTTP Mode
Instead of file-based storage, use ChromaDB in HTTP mode:

```typescript
// In VectorStore.ts
this.client = new ChromaClient({
  path: "http://localhost:8000" // HTTP mode, no file access needed
});
```

## Production Setup Instructions

### For Ubuntu_Ext Access:

1. **Install ubuntu_ext distro** (if not already installed)
2. **Start ubuntu_ext** and create the directory structure:
   ```bash
   wsl -d ubuntu_ext
   mkdir -p ~/master_knowledge_base/{rag_data/{vectors,documents,embeddings,cache},scraped_content,captured_knowledge,learned_patterns,databases}
   ```

3. **From main Ubuntu distro**, set up access:
   - Option A: Use network path (if supported)
   - Option B: Set up shared volume in Docker
   - Option C: Use a shared mount point

### Alternative: Docker Volume
```yaml
version: '3.8'
services:
  app:
    volumes:
      - knowledge_base:/app/master_knowledge_base
      
volumes:
  knowledge_base:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/ubuntu_ext/master_knowledge_base
```

## Current Workaround

For immediate testing, we're using a local directory with the understanding that:
1. This is temporary for development
2. Production will use the ubuntu_ext setup
3. ChromaDB HTTP mode eliminates most file storage needs
4. Only document storage requires actual file system access

## Next Steps

1. ✅ Create temporary local knowledge base
2. ✅ Add initial documentation
3. 🔄 Configure ChromaDB for HTTP mode
4. 🔄 Test 4-step MO RAG system with local setup
5. 📋 Document production ubuntu_ext setup process