#!/bin/bash
# ==========================================
# SINCRONIZAÇÃO RIOFLIX -> PAINEL (via Worker)
# ==========================================

WORKER_URL="http://localhost:3001"
WORKER_KEY="rf_proxy_key_2026"
PAINEL_URL="${PAINEL_URL:-https://automacao-painel-tv.nfeujb.easypanel.host}"

echo "========================================"
echo "SINCRONIZAÇÃO RIOFLIX -> PAINEL"
echo "Data: $(date)"
echo "========================================"

# 1. Pegar dados do Worker (já busca todas as páginas)
echo ""
echo "1. Buscando dados do Worker..."
SYNC_DATA=$(curl -s -H "X-API-Key: $WORKER_KEY" "$WORKER_URL/sync" --connect-timeout 120 -m 180)

if [ -z "$SYNC_DATA" ]; then
  echo "❌ Erro ao buscar dados do Worker"
  exit 1
fi

# Extrair contagem
CUSTOMERS_COUNT=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('customers',[])))" 2>/dev/null || echo "0")
RESELLERS_COUNT=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('resellers',[])))" 2>/dev/null || echo "0")

echo "✅ $CUSTOMERS_COUNT clientes encontrados"
echo "✅ $RESELLERS_COUNT revendas encontradas"

# 2. Login no Painel
echo ""
echo "2. Login no Painel..."
PAINEL_TOKEN=$(curl -s -X POST \
  "$PAINEL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"joao","password":"Joao123@"}' \
  --connect-timeout 15 -m 30 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$PAINEL_TOKEN" ]; then
  echo "❌ Erro ao logar no Painel"
  exit 1
fi
echo "✅ Token obtido"

# 3. Enviar dados para o painel
echo ""
echo "3. Enviando dados para o Painel..."

# Extrair arrays
CUSTOMERS=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',{}).get('customers',[])))" 2>/dev/null)
RESELLERS=$(echo "$SYNC_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',{}).get('resellers',[])))" 2>/dev/null)

RESULT=$(curl -s -X POST \
  "$PAINEL_URL/api/sync/raioflix" \
  -H "Authorization: Bearer $PAINEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customers\": $CUSTOMERS, \"resellers\": $RESELLERS}" \
  --connect-timeout 30 -m 60 2>&1)

echo "$RESULT"

echo ""
echo "========================================"
echo "SINCRONIZAÇÃO CONCLUÍDA!"
echo "========================================"
