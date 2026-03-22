#!/bin/bash
# Sync rápido - Worker -> Painel

WORKER_URL="http://localhost:3001"
PAINEL_URL="http://localhost:3480"
API_KEY="rf_proxy_key_2026"

echo "🔄 Sincronizando..."

# Pegar dados do worker
SYNC_DATA=$(curl -s -H "X-API-Key: $API_KEY" "$WORKER_URL/sync")

# Extrair clientes e revendas
CUSTOMERS=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data']['customers']))" 2>/dev/null)
RESELLERS=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data']['resellers']))" 2>/dev/null)

CUST_COUNT=$(echo "$CUSTOMERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
RES_COUNT=$(echo "$RESELLERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

echo "📊 $CUST_COUNT clientes, $RES_COUNT revendas"

# Login no painel
PAINEL_TOKEN=$(curl -s -X POST "$PAINEL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"joao","password":"Joao123@"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Enviar pro painel
RESULT=$(curl -s -X POST "$PAINEL_URL/api/sync/raioflix" \
  -H "Authorization: Bearer $PAINEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customers\": $CUSTOMERS, \"resellers\": $RESELLERS}")

echo "✅ $RESULT"
