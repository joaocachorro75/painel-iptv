#!/bin/bash

# ==========================================
# SINCRONIZAÇÃO RIOFLIX -> PAINEL
# ==========================================
# Este script pega dados do RaioFlix de fora
# e envia para o painel no EasyPanel
# 
# Uso: ./sync-raioflix.sh
# ==========================================

# Configurações
RIOFLIX_PROXY="http://195.114.209.50:80"
RIOFLIX_USER="JoaoReven"
RIOFLIX_PASS="Canaisip123@"
RIOFLIX_BASE="http://raioflix.sigmab.pro"

PAINEL_URL="https://automacao-painel-tv.nfeujb.easypanel.host"
PAINEL_USER="joao"
PAINEL_PASS="Joao123@"

echo "========================================"
echo "SINCRONIZAÇÃO RIOFLIX -> PAINEL"
echo "Data: $(date)"
echo "========================================"

# 1. Login no RaioFlix
echo ""
echo "1. Login no RaioFlix..."
TOKEN=$(curl -s -x "$RIOFLIX_PROXY" \
  "$RIOFLIX_BASE/api/auth/login" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$RIOFLIX_USER\",\"password\":\"$RIOFLIX_PASS\"}" \
  --connect-timeout 30 -m 60 2>&1 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erro ao logar no RaioFlix"
  exit 1
fi
echo "✅ Token obtido"

# 2. Pegar clientes
echo ""
echo "2. Buscando clientes..."
CUSTOMERS=$(curl -s -x "$RIOFLIX_PROXY" \
  "$RIOFLIX_BASE/api/customers" \
  -H "Authorization: Bearer $TOKEN" \
  --connect-timeout 30 -m 60 2>&1)

CUSTOMERS_COUNT=$(echo "$CUSTOMERS" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
echo "✅ $CUSTOMERS_COUNT clientes encontrados"

# 3. Pegar revendas
echo ""
echo "3. Buscando revendas..."
RESELLERS=$(curl -s -x "$RIOFLIX_PROXY" \
  "$RIOFLIX_BASE/api/resellers" \
  -H "Authorization: Bearer $TOKEN" \
  --connect-timeout 30 -m 60 2>&1)

RESELLERS_COUNT=$(echo "$RESELLERS" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
echo "✅ $RESELLERS_COUNT revendas encontradas"

# 4. Login no Painel
echo ""
echo "4. Login no Painel..."
PAINEL_TOKEN=$(curl -s -X POST \
  "$PAINEL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$PAINEL_USER\",\"password\":\"$PAINEL_PASS\"}" \
  --connect-timeout 15 -m 30 2>&1 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PAINEL_TOKEN" ]; then
  echo "❌ Erro ao logar no Painel"
  exit 1
fi
echo "✅ Token obtido"

# 5. Enviar dados para o painel
echo ""
echo "5. Enviando dados para o Painel..."

# Montar JSON
SYNC_DATA=$(cat <<EOF
{
  "customers": $(echo "$CUSTOMERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',d)))"),
  "resellers": $(echo "$RESELLERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',d)))")
}
EOF
)

RESULT=$(curl -s -X POST \
  "$PAINEL_URL/api/sync/raioflix" \
  -H "Authorization: Bearer $PAINEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SYNC_DATA" \
  --connect-timeout 15 -m 30 2>&1)

echo "$RESULT"

echo ""
echo "========================================"
echo "SINCRONIZAÇÃO CONCLUÍDA!"
echo "========================================"
