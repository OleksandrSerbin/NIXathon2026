#!/bin/bash

# Basic endpoint tests using curl
# Make sure server is running: npm run dev

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🧪 Testing Kingdom Wars API Endpoints"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1. Testing GET /healthz"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/healthz")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
  echo "✅ Health check passed (200 OK)"
  echo "   Response: $body"
else
  echo "❌ Health check failed (HTTP $http_code)"
  echo "   Response: $body"
fi
echo ""

# Test 2: Bot Info
echo "2. Testing GET /info"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/info")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
  echo "✅ Info endpoint passed (200 OK)"
  echo "   Response: $body"
else
  echo "❌ Info endpoint failed (HTTP $http_code)"
  echo "   Response: $body"
fi
echo ""

# Test 3: Negotiation
echo "3. Testing POST /negotiate"
negotiate_request='{
  "gameId": 123,
  "turn": 1,
  "playerTower": {
    "playerId": 101,
    "hp": 100,
    "armor": 0,
    "resources": 20,
    "level": 1
  },
  "enemyTowers": [
    {"playerId": 102, "hp": 95, "armor": 3, "level": 1},
    {"playerId": 103, "hp": 80, "armor": 10, "level": 2},
    {"playerId": 104, "hp": 90, "armor": 5, "level": 1}
  ],
  "combatActions": []
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/negotiate" \
  -H "Content-Type: application/json" \
  -d "$negotiate_request")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
  echo "✅ Negotiation endpoint passed (200 OK)"
  echo "   Response: $body"
else
  echo "❌ Negotiation endpoint failed (HTTP $http_code)"
  echo "   Response: $body"
fi
echo ""

# Test 4: Combat
echo "4. Testing POST /combat"
combat_request='{
  "gameId": 123,
  "turn": 1,
  "playerTower": {
    "playerId": 101,
    "hp": 100,
    "armor": 0,
    "resources": 20,
    "level": 1
  },
  "enemyTowers": [
    {"playerId": 102, "hp": 95, "armor": 3, "level": 1},
    {"playerId": 103, "hp": 80, "armor": 10, "level": 2},
    {"playerId": 104, "hp": 90, "armor": 5, "level": 1}
  ],
  "diplomacy": [],
  "previousAttacks": []
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/combat" \
  -H "Content-Type: application/json" \
  -d "$combat_request")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
  echo "✅ Combat endpoint passed (200 OK)"
  echo "   Response: $body"
else
  echo "❌ Combat endpoint failed (HTTP $http_code)"
  echo "   Response: $body"
fi
echo ""

# Test 5: Response Time
echo "5. Testing Response Times"
start=$(date +%s%N)
curl -s "$BASE_URL/healthz" > /dev/null
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))
echo "   Health check: ${duration}ms"

start=$(date +%s%N)
curl -s -X POST "$BASE_URL/negotiate" \
  -H "Content-Type: application/json" \
  -d "$negotiate_request" > /dev/null
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))
echo "   Negotiation: ${duration}ms (should be < 1000ms)"

start=$(date +%s%N)
curl -s -X POST "$BASE_URL/combat" \
  -H "Content-Type: application/json" \
  -d "$combat_request" > /dev/null
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))
echo "   Combat: ${duration}ms (should be < 1000ms)"
echo ""

echo "======================================"
echo "✅ All tests completed!"
