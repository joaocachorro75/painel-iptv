#!/usr/bin/env python3
"""Script de sincronização RaioFlix -> Painel"""
import json
import urllib.request
import os

# URL do painel: usa variável de ambiente ou localhost (quando roda no container)
# EasyPanel define PORT=80, então usamos localhost:80 dentro do container
PAINEL_PORT = os.environ.get("PORT", "80")
PAINEL_URL = os.environ.get("PAINEL_URL", f"http://localhost:{PAINEL_PORT}")
RAIOFLIX_PROXY = os.environ.get("RAIOFLIX_PROXY", "http://195.114.209.50:80")
RAIOFLIX_TOKEN = "1144|pheGJmNyk52gve7KnuiLzoeLBkBQKzJHLWt6AG9I77cfbf8a"

print(f"[Sync] Painel URL: {PAINEL_URL}")
print(f"[Sync] Proxy: {RAIOFLIX_PROXY}")

def curl_with_proxy(url, token=None):
    """Faz request com proxy"""
    import subprocess
    cmd = ["curl", "-s", "-x", RAIOFLIX_PROXY, url, "--connect-timeout", "30", "-m", "60"]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Debug
    if result.returncode != 0:
        print(f"   ⚠️ Curl error: {result.stderr}")
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"   ⚠️ JSON error: {result.stdout[:100]}")
        raise

def main():
    print(f"🔄 Buscando dados RaioFlix...")
    
    # Buscar clientes (todas as páginas)
    all_customers = []
    for page in range(1, 5):
        try:
            data = curl_with_proxy(
                f"http://raioflix.sigmab.pro/api/customers?page={page}",
                RAIOFLIX_TOKEN
            )
            customers = data.get("data", [])
            if not customers:
                break
            all_customers.extend(customers)
            print(f"   Página {page}: {len(customers)} clientes")
        except Exception as e:
            print(f"   ⚠️ Erro página {page}: {e}")
            break
    print(f"✅ Total: {len(all_customers)} clientes")
    
    # Buscar revendas
    data = curl_with_proxy("http://raioflix.sigmab.pro/api/resellers", RAIOFLIX_TOKEN)
    resellers = data.get("data", [])
    print(f"✅ Revendas: {len(resellers)}")
    
    # Buscar servidores
    data = curl_with_proxy("http://raioflix.sigmab.pro/api/servers", RAIOFLIX_TOKEN)
    servers = data.get("data", [])
    print(f"✅ Servidores: {len(servers)}")
    
    # Buscar pacotes
    data = curl_with_proxy("http://raioflix.sigmab.pro/api/packages", RAIOFLIX_TOKEN)
    packages = data.get("data", [])
    print(f"✅ Pacotes: {len(packages)}")
    
    # Login no painel
    print(f"\n🔄 Logando no painel ({PAINEL_URL})...")
    try:
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/auth/login",
            data=json.dumps({"username": "joao", "password": "Joao123@"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            token = json.loads(r.read())["token"]
        print(f"✅ Token: {token[:20]}...")
    except Exception as e:
        print(f"❌ Erro no login: {e}")
        return
    
    # Sincronizar
    print("\n🔄 Sincronizando...")
    payload = {"customers": all_customers, "resellers": resellers, "servers": servers, "packages": packages}
    try:
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/sync/raioflix",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read())
        print(f"✅ Resultado: {result}")
        print("\n✅ SINCRONIZAÇÃO COMPLETA!")
    except Exception as e:
        print(f"❌ Erro no sync: {e}")

if __name__ == "__main__":
    main()
