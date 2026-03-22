#!/usr/bin/env python3
"""Sincronização RaioFlix -> Painel (roda continuamente)"""
import json
import urllib.request
import subprocess
import time

RAIOFLIX_TOKEN = "1144|pheGJmNyk52gve7KnuiLzoeLBkBQKzJHLWt6AG9I77cfbf8a"
PROXY = "http://195.114.209.50:80"
PAINEL_URL = "https://automacao-painel-tv.nfeujb.easypanel.host"
INTERVAL_MINUTES = 5

def curl(url, token=None):
    cmd = ["curl", "-s", "-x", PROXY, url, "--connect-timeout", "30", "-m", "60"]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)

def sync():
    print(f"\n[{time.strftime('%H:%M:%S')}] Sincronizando...")
    
    try:
        # Buscar clientes
        all_customers = []
        for page in range(1, 5):
            try:
                data = curl(f"http://raioflix.sigmab.pro/api/customers?page={page}", RAIOFLIX_TOKEN)
                customers = data.get("data", [])
                if not customers:
                    break
                all_customers.extend(customers)
            except Exception as e:
                print(f"  ⚠️ Erro página {page}: {e}")
                break
        
        # Buscar outros dados
        resellers = curl("http://raioflix.sigmab.pro/api/resellers", RAIOFLIX_TOKEN).get("data", [])
        servers = curl("http://raioflix.sigmab.pro/api/servers", RAIOFLIX_TOKEN).get("data", [])
        packages = curl("http://raioflix.sigmab.pro/api/packages", RAIOFLIX_TOKEN).get("data", [])
        
        print(f"  📥 RaioFlix: {len(all_customers)} clientes, {len(resellers)} revendas")
        
        # Login no painel
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/auth/login",
            data=json.dumps({"username": "joao", "password": "Joao123@"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            token = json.loads(r.read())["token"]
        
        # Sincronizar
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/sync/raioflix",
            data=json.dumps({
                "customers": all_customers, 
                "resellers": resellers, 
                "servers": servers, 
                "packages": packages
            }).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read())
        
        print(f"  ✅ Sync: {result.get('customers', 0)} clientes")
        
    except Exception as e:
        print(f"  ❌ Erro: {e}")

if __name__ == "__main__":
    print(f"🔄 Iniciando sync automático (a cada {INTERVAL_MINUTES} min)")
    print(f"   Painel: {PAINEL_URL}")
    print(f"   Proxy: {PROXY}")
    
    # Primeira sync
    sync()
    
    # Loop infinito
    while True:
        time.sleep(INTERVAL_MINUTES * 60)
        sync()
