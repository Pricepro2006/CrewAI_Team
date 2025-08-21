#!/bin/bash

# Test script for tRPC endpoints
BASE_URL="http://localhost:3001/trpc"
echo "Testing tRPC Endpoints..."
echo "========================="

# Test health endpoints
echo -e "\n1. Testing health.status (GET)..."
curl -s -X GET "$BASE_URL/health.status?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test chat endpoints
echo -e "\n2. Testing chat.create (POST)..."
curl -s -X POST "$BASE_URL/chat.create" \
  -H "Content-Type: application/json" \
  -d '{"json":{"message":"Test","priority":"medium"}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n3. Testing chat.list (GET)..."
curl -s -X GET "$BASE_URL/chat.list?input=%7B%22json%22%3A%7B%22limit%22%3A5%7D%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test auth endpoints
echo -e "\n4. Testing auth.csrf (GET)..."
curl -s -X GET "$BASE_URL/auth.csrf?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n5. Testing auth.login (POST)..."
curl -s -X POST "$BASE_URL/auth.login" \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"test@example.com","password":"password123"}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test agent endpoints
echo -e "\n6. Testing agent.list (GET)..."
curl -s -X GET "$BASE_URL/agent.list?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n7. Testing agent.status (GET)..."
curl -s -X GET "$BASE_URL/agent.status?input=%7B%22json%22%3A%7B%22agentId%22%3A%22ResearchAgent%22%7D%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test task endpoints
echo -e "\n8. Testing task.list (GET)..."
curl -s -X GET "$BASE_URL/task.list?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test rag endpoints
echo -e "\n9. Testing rag.search (POST)..."
curl -s -X POST "$BASE_URL/rag.search" \
  -H "Content-Type: application/json" \
  -d '{"json":{"query":"test query","limit":5}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n10. Testing rag.status (GET)..."
curl -s -X GET "$BASE_URL/rag.status?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test orchestrator endpoints
echo -e "\n11. Testing orchestrator.processQuery (POST)..."
curl -s -X POST "$BASE_URL/orchestrator.processQuery" \
  -H "Content-Type: application/json" \
  -d '{"json":{"text":"What is the weather?"}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test metrics endpoints
echo -e "\n12. Testing metrics.performance (GET)..."
curl -s -X GET "$BASE_URL/metrics.performance?input=%7B%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n13. Testing metrics.rateLimit (GET)..."
curl -s -X GET "$BASE_URL/metrics.rateLimit?input=%7B%22json%22%3A%7B%22clientId%22%3A%22test%22%7D%7D" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

# Test walmart endpoints
echo -e "\n14. Testing walmartGrocery.searchProducts (POST)..."
curl -s -X POST "$BASE_URL/walmartGrocery.searchProducts" \
  -H "Content-Type: application/json" \
  -d '{"json":{"query":"milk","limit":5}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n15. Testing walmartPrice.getLivePrice (POST)..."
curl -s -X POST "$BASE_URL/walmartPrice.getLivePrice" \
  -H "Content-Type: application/json" \
  -d '{"json":{"productId":"123456"}}' | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅ WORKING' if 'result' in data else '❌ FAILED: ' + str(data.get('error', {}).get('json', {}).get('message', 'Unknown')))"

echo -e "\n========================="
echo "Test Complete!"