# Worker RaioFlix

Microserviço Node.js responsável por sincronizar dados com o RaioFlix via proxy na Espanha.

---

## O que é o Worker
- **Função:** Realiza requisições ao RaioFlix e retorna dados (clientes, revendas, servidores, pacotes).
- **Tecnologia:** Node.js + `curl` (evita bloqueio de IP brasileiro)
- **Porta:** 3001
- **Proxy:** Geonode Espanha (195.114.209.50:80)

---

## Como funciona

1. **Requisição:** Recebe requisição do Painel
2. **Processamento:** Usa curl com proxy para chamar API RaioFlix
3. **Cache:** Armazena dados em memória
4. **Retorno:** Devolve JSON para o Painel

---

## Variáveis de Ambiente

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `RAIOFLIX_BASE_URL` | `http://raioflix.sigmab.pro` | URL da API RaioFlix |
| `RAIOFLIX_PROXY` | `http://195.114.209.50:80` | Proxy Geonode Espanha |
| `RAIOFLIX_USERNAME` | `JoaoReven` | Usuário RaioFlix |
| `RAIOFLIX_PASSWORD` | `Canaisip123@` | Senha RaioFlix |
| `RAIOFLIX_PROXY_KEY` | `rf_proxy_key_2026` | Chave API do Worker |
| `PORT` | `3001` | Porta do Worker |

---

## Endpoints

### Health Check
```
GET /health
```

### Sincronizar
```
GET /sync
Headers: X-API-Key: rf_proxy_key_2026
```

### Clientes
```
GET /customers
Headers: X-API-Key: rf_proxy_key_2026
```

### Revendas
```
GET /resellers
Headers: X-API-Key: rf_proxy_key_2026
```

---

## Como Fazer Deploy Separado

### **1. Build Docker**
```bash
cd workers
docker build -t raioflix-worker .
```

### **2. Rodar Container**
```bash
docker run -d -p 3001:3001 \
  -e RAIOFLIX_BASE_URL=http://raioflix.sigmab.pro \
  -e RAIOFLIX_PROXY=http://195.114.209.50:80 \
  -e RAIOFLIX_USERNAME=JoaoReven \
  -e RAIOFLIX_PASSWORD=Canaisip123@ \
  -e RAIOFLIX_PROXY_KEY=rf_proxy_key_2026 \
  --name raioflix-worker \
  raioflix-worker
```

### **3. No EasyPanel**
1. Crie um serviço novo
2. Build path: `./workers`
3. Porta: 3001
4. Configure as variáveis de ambiente
5. Link com o Painel: `http://nome-do-servico:3001`

---

## Troubleshooting

### Worker não inicia
- Verifique logs: `docker logs raioflix-worker`
- Confirme variáveis de ambiente

### Erro 500 do RaioFlix
- Proxy pode estar down
- Tente outro proxy da Geonode

### Dados não atualizam
- Verifique se Worker está rodando
- Teste endpoint `/health`

---

*Mentalista - Documentação técnica*
