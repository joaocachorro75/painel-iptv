#!/usr/bin/env python3
"""Sincronização RaioFlix -> Painel + Cache local"""

import json
import subprocess
import urllib.request
import os

PROXY = "http://195.114.209.50:80"
RIOFLIX_BASE = "http://raioflix.sigmab.pro/api"
PAINEL_URL = "https://automacao-painel-tv.nfeujb.easypanel.host"
CACHE_FILE = "/tmp/raioflix_cache.json"

def curl(url, token=None, data=None):
    """Faz request via curl com proxy"""
    cmd = ["curl", "-s", "-x", PROXY, url, "--connect-timeout", "30", "-m", "60"]
    
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    
    if data:
        cmd.extend(["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(data)])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

def main():
    # 1. Login RaioFlix
    login_data = curl(f"{RIOFLIX_BASE}/auth/login", data={"username": "JoaoReven", "password": "Canaisip123@"})
    token = json.loads(login_data).get("token", "")
    
    if not token:
        print("❌ Erro no login")
        return
    
    print(f"✅ Login: {token[:20]}...")
    
    # 2. Buscar clientes (todas as páginas)
    all_customers = []
    page = 1
    while True:
        data = curl(f"{RIOFLIX_BASE}/customers?page={page}", token=token)
        try:
            parsed = json.loads(data)
            customers = parsed.get("data", parsed if isinstance(parsed, list) else [])
            if not customers:
                break
            all_customers.extend(customers)
            print(f"   Página {page}: {len(customers)} clientes")
            if len(customers) < 15:
                break
            page += 1
        except:
            break
    
    print(f"✅ Clientes: {len(all_customers)}")
    
    # 3. Buscar revendas
    resellers_data = curl(f"{RIOFLIX_BASE}/resellers", token=token)
    resellers = json.loads(resellers_data).get("data", [])
    print(f"✅ Revendas: {len(resellers)}")
    
    # 4. Buscar servidores
    servers_data = curl(f"{RIOFLIX_BASE}/servers", token=token)
    servers = json.loads(servers_data).get("data", [])
    print(f"✅ Servidores: {len(servers)}")
    
    # 5. Buscar pacotes
    packages_data = curl(f"{RIOFLIX_BASE}/packages", token=token)
    packages = json.loads(packages_data).get("data", [])
    print(f"✅ Pacotes: {len(packages)}")
    
    # 6. Salvar cache local
    cache = {
        "customers": all_customers,
        "resellers": resellers,
        "servers": servers,
        "packages": packages,
        "lastSync": __import__('datetime').datetime.now().isoformat()
    }
    
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f)
    
    # 7. Sincronizar com painel de produção
    try:
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/auth/login",
            data=json.dumps({"username": "joao", "password": "Joao123@"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            painel_token = json.loads(r.read()).get("token", "")
        
        req = urllib.request.Request(
            f"{PAINEL_URL}/api/sync/raioflix",
            data=json.dumps({"customers": all_customers, "resellers": resellers}).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {painel_token}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read())
        
        print(f"✅ Sync painel: {result.get('customers', 0)} clientes")
    except Exception as e:
        print(f"⚠️ Erro sync painel: {e}")
    
    print("✅ SINCRONIZAÇÃO CONCLUÍDA!")

if __name__ == "__main__":
    main()
