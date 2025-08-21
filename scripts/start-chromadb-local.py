#!/usr/bin/env python3
"""
Local ChromaDB Server Startup Script
Starts ChromaDB on port 8000 for development
"""

import os
import sys
import time
import subprocess
import signal

def start_chromadb():
    """Start ChromaDB server locally"""
    print("🚀 Starting local ChromaDB server...")
    
    # Kill any existing ChromaDB processes
    try:
        subprocess.run(["pkill", "-f", "uvicorn chromadb.app:app"], check=False)
        time.sleep(2)
    except:
        pass
    
    # Set environment variables
    env = os.environ.copy()
    env["CHROMA_SERVER_HOST"] = "0.0.0.0"
    env["CHROMA_SERVER_PORT"] = "8000"
    env["ANONYMIZED_TELEMETRY"] = "False"
    env["ALLOW_RESET"] = "TRUE"
    
    # Start ChromaDB server
    cmd = [
        sys.executable, "-m", "chromadb.cli.cli",
        "run", "--host", "0.0.0.0", "--port", "8000", "--path", "./data/chromadb"
    ]
    
    process = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    print(f"✅ ChromaDB process started with PID: {process.pid}")
    print("⏳ Waiting for ChromaDB to be ready...")
    
    # Wait for server to start
    import requests
    max_retries = 30
    for i in range(max_retries):
        try:
            response = requests.get("http://localhost:8000/api/v1/heartbeat", timeout=1)
            if response.status_code == 200:
                print("✅ ChromaDB is running on http://localhost:8000")
                print("📊 Heartbeat endpoint: http://localhost:8000/api/v1/heartbeat")
                print("🎯 Collections endpoint: http://localhost:8000/api/v1/collections")
                return process
        except:
            if i % 5 == 0:
                print(f"   Waiting... ({i}/{max_retries})")
            time.sleep(1)
    
    print("❌ Failed to start ChromaDB")
    process.kill()
    return None

def main():
    """Main function"""
    process = start_chromadb()
    if process:
        print("\n✅ ChromaDB is ready!")
        print("Press Ctrl+C to stop the server")
        
        # Wait for interrupt
        try:
            process.wait()
        except KeyboardInterrupt:
            print("\n🛑 Stopping ChromaDB...")
            process.terminate()
            process.wait(timeout=5)
            print("✅ ChromaDB stopped")
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()