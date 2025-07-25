# Local Service Setup Guide 2025 (Without Docker)

This guide provides instructions for running Redis, ChromaDB, Ollama, and SearXNG alternatives locally without Docker in 2025.

## 1. Redis Installation (From Source)

### Prerequisites
```bash
sudo apt-get install build-essential tcl wget
```

### Installation Steps
```bash
# Download Redis source
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable

# Build Redis
make
sudo make install

# The installation creates a service called redis_6379
sudo systemctl start redis_6379
sudo systemctl enable redis_6379
```

### Configuration
- Config file location: `/etc/redis/6379.conf`
- Default port: 6379

### Testing Installation
```bash
redis-cli ping
# Should return: PONG
```

## 2. ChromaDB Installation (Python Package)

### Requirements
- Python 3.8 or later
- SQLite 3.35 or higher

### Installation
```bash
# Basic installation
pip install chromadb

# Or install specific version
pip install chromadb==0.4.24

# For development
pip install chromadb-client  # Thin client alternative
```

### Basic Usage Example
```python
import chromadb

# In-memory client (for development)
client = chromadb.Client()

# Persistent storage
from chromadb.config import Settings
client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_db/"
))

# Create collection
collection = client.create_collection("my_collection")
```

### Troubleshooting
- For Python 3.11 issues, consider downgrading to Python 3.10
- Windows users may need Microsoft Visual Studio Build Tools

## 3. Ollama Installation (Binary)

### Method 1: Direct Binary Download
```bash
# Download and install (AMD64)
sudo curl -L https://ollama.com/download/ollama-linux-amd64 -o /usr/bin/ollama
sudo chmod +x /usr/bin/ollama

# Alternative architectures:
# ARM64: https://ollama.com/download/ollama-linux-arm64
# AMD64 with ROCm: https://ollama.com/download/ollama-linux-amd64-rocm
```

### Method 2: Install as System Service
```bash
# Create dedicated user
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama

# Create service file
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Testing Ollama
```bash
# Check if running
ollama list

# Pull a model
ollama pull granite3.2:2b

# Run a model
ollama run granite3.2:2b "Hello, how are you?"
```

## 4. Search Service Alternatives

### Option A: Mock Search Service (Development)

Create a simple mock search service using FastAPI:

```python
# mock_search_service.py
from fastapi import FastAPI, Query
from typing import List, Dict, Any
import random

app = FastAPI()

# Mock search results
MOCK_RESULTS = [
    {
        "title": "Example Result 1",
        "url": "https://example.com/1",
        "snippet": "This is a mock search result for testing."
    },
    {
        "title": "Example Result 2", 
        "url": "https://example.com/2",
        "snippet": "Another mock result for development purposes."
    },
    # Add more mock results as needed
]

@app.get("/search")
async def search(
    q: str = Query(..., description="Search query"),
    format: str = Query("json", description="Output format"),
    limit: int = Query(10, description="Number of results")
) -> Dict[str, Any]:
    # Simulate search results
    results = random.sample(MOCK_RESULTS, min(limit, len(MOCK_RESULTS)))
    
    return {
        "query": q,
        "number_of_results": len(results),
        "results": results
    }

# Run with: uvicorn mock_search_service:app --port 8888
```

### Option B: Local Search Engines Supported by SearXNG

If you want to use actual search functionality locally:

1. **Elasticsearch**
```bash
# Download and extract
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.11.3-linux-x86_64.tar.gz
tar -xzf elasticsearch-8.11.3-linux-x86_64.tar.gz
cd elasticsearch-8.11.3/

# Run Elasticsearch
./bin/elasticsearch
```

2. **Meilisearch**
```bash
# Download binary
curl -L https://install.meilisearch.com | sh

# Run Meilisearch
./meilisearch --http-addr '127.0.0.1:7700'
```

3. **Apache Solr**
```bash
# Download and extract
wget https://dlcdn.apache.org/solr/solr/9.4.1/solr-9.4.1.tgz
tar -xzf solr-9.4.1.tgz
cd solr-9.4.1/

# Start Solr
bin/solr start
```

## 5. Environment Configuration

Create a `.env` file for your CrewAI Team project:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# ChromaDB Configuration
CHROMADB_PERSIST_DIRECTORY=./chroma_db
CHROMADB_IN_MEMORY=false

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434

# Search Service Configuration
SEARCH_SERVICE_URL=http://localhost:8888
SEARCH_SERVICE_TYPE=mock  # or 'elasticsearch', 'meilisearch', 'solr'
```

## 6. Verification Script

Create a script to verify all services are running:

```python
# verify_services.py
import redis
import chromadb
import requests
import sys

def check_redis():
    try:
        r = redis.Redis(host='localhost', port=6379)
        r.ping()
        print("✓ Redis is running")
        return True
    except Exception as e:
        print(f"✗ Redis is not running: {e}")
        return False

def check_chromadb():
    try:
        client = chromadb.Client()
        client.list_collections()
        print("✓ ChromaDB is available")
        return True
    except Exception as e:
        print(f"✗ ChromaDB error: {e}")
        return False

def check_ollama():
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            print("✓ Ollama is running")
            return True
        else:
            print("✗ Ollama is not responding correctly")
            return False
    except Exception as e:
        print(f"✗ Ollama is not running: {e}")
        return False

def check_search_service():
    try:
        response = requests.get("http://localhost:8888/search?q=test")
        if response.status_code == 200:
            print("✓ Search service is running")
            return True
        else:
            print("✗ Search service is not responding correctly")
            return False
    except Exception as e:
        print(f"✗ Search service is not running: {e}")
        return False

if __name__ == "__main__":
    services_ok = all([
        check_redis(),
        check_chromadb(),
        check_ollama(),
        check_search_service()
    ])
    
    sys.exit(0 if services_ok else 1)
```

## 7. Starting Services Script

Create a convenience script to start all services:

```bash
#!/bin/bash
# start_services.sh

echo "Starting local services..."

# Start Redis
sudo systemctl start redis_6379
echo "✓ Redis started"

# Start Ollama
sudo systemctl start ollama
echo "✓ Ollama started"

# Start mock search service (in background)
nohup python -m uvicorn mock_search_service:app --port 8888 > search_service.log 2>&1 &
echo "✓ Search service started"

# Verify all services
sleep 5
python verify_services.py
```

## Notes

1. **Performance**: Running services natively (without Docker) typically provides better performance due to reduced overhead.

2. **Resource Usage**: Monitor system resources, especially when running multiple LLM models with Ollama.

3. **Security**: These configurations are for development. For production, implement proper security measures.

4. **Persistence**: Ensure data directories are properly backed up, especially for Redis and ChromaDB.

5. **Updates**: Keep services updated by periodically checking for new versions and following upgrade procedures.

## Troubleshooting

### Redis Issues
- Check if port 6379 is already in use: `sudo lsof -i :6379`
- View Redis logs: `sudo journalctl -u redis_6379 -f`

### ChromaDB Issues
- Ensure SQLite version is 3.35+: `sqlite3 --version`
- Try in-memory mode first for testing

### Ollama Issues
- Check Ollama logs: `sudo journalctl -u ollama -f`
- Ensure sufficient disk space for models

### Search Service Issues
- Check if port 8888 is available: `sudo lsof -i :8888`
- Review mock service logs in `search_service.log`