#!/bin/bash
# ==========================================
# SINCRONIZAÇÃO DIRETA - Sem Worker
# ==========================================

PROXY="http://195.114.209.50:80"
RIOFLIX_BASE="http://raioflix.sigmab.pro/api"
PAINEL_URL="${PAINEL_URL:-https://automacao-painel-tv.nfeujb.easypanel.host}"
USERNAME="JoaoReven"
PASSWORD="Canaisip123@"

echo "========================================"
echo "SINCRONIZAÇÃO RIOFLIX -> PAINEL"
echo "Data: $(date)"
echo "========================================"

# 1. Login RaioFlix
echo ""
echo "1. Login RaioFlix..."
TOKEN=$(curl -s -x "$PROXY" "$RIOFLIX_BASE/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  --connect-timeout 30 -m 60 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erro no login"
  exit 1
fi
echo "✅ Token obtido"

# 2. Buscar TODAS as páginas de clientes
echo ""
echo "2. Buscando clientes (todas as páginas)..."
ALL_CUSTOMERS="[]"
PAGE=1
while true; do
  DATA=$(curl -s -x "$PROXY" "$RIOFLIX_BASE/customers?page=$PAGE" \
    -H "Authorization: Bearer $TOKEN" \
    --connect-timeout 30 -m 60)
  
  CUSTOMERS=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',d)))" 2>/dev/null)
  COUNT=$(echo "$CUSTOMERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  
  if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
    break
  fi
  
  ALL_CUSTOMERS=$(python3 -c "import json; a=json.loads('$ALL_CUSTOMERS'); b=json.loads('$CUSTOMERS'); print(json.dumps(a+b))")
  echo "   Página $PAGE: $COUNT clientes"
  
  if [ "$COUNT" -lt 15 ]; then
    break
  fi
  PAGE=$((PAGE+1))
done

TOTAL_CUSTOMERS=$(echo "$ALL_CUSTOMERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "✅ Total: $TOTAL_CUSTOMERS clientes"

# 3. Buscar revendas
echo ""
echo "3. Buscando revendas..."
RESELLERS=$(curl -s -x "$PROXY" "$RIOFLIX_BASE/resellers" \
  -H "Authorization: Bearer $TOKEN" \
  --connect-timeout 30 -m 60 | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',d)))" 2>/dev/null)

TOTAL_RESELLERS=$(echo "$RESELLERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "✅ $TOTAL_RESELLERS revendas"

# 4. Login no Painel
echo ""
echo "4. Login no Painel..."
PAINEL_TOKEN=$(curl -s -X POST "$PAINEL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"joao","password":"Joao123@"}' \
  --connect-timeout 15 -m 30 | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$PAINEL_TOKEN" ]; then
  echo "❌ Erro no login do painel"
  exit 1
fi
echo "✅ Token obtido"

# 5. Enviar para o painel
echo ""
echo "5. Enviando dados para o Painel..."
RESULT=$(curl -s -X POST "$PAINEL_URL/api/sync/raioflix" \
  -H "Authorization: Bearer $PAINEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customers\": $ALL_CUSTOMERS, \"resellers\": $RESELLERS}" \
  --connect-timeout 30 -m 60)

echo "$RESULT"

echo ""
echo "========================================"
echo "SINCRONIZAÇÃO CONCLUÍDA!"
echo "========================================"
