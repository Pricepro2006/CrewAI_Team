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
