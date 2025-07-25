#!/usr/bin/env python3
import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI
from chromadb.server.fastapi import app as chroma_app

# Configure ChromaDB with authentication
settings = Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./data/chromadb",
    anonymized_telemetry=False,
    chroma_server_auth_provider="chromadb.auth.token.TokenAuthServerProvider",
    chroma_server_auth_credentials="test-token",
    chroma_server_auth_token_header_name="X-Chroma-Token"
)

if __name__ == "__main__":
    print("Starting ChromaDB server on http://localhost:8000")
    print("Authentication token: test-token")
    uvicorn.run(chroma_app, host="0.0.0.0", port=8000, log_level="info")