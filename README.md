# Painel IPTV Unificado

Painel para gerenciar clientes RaioFlix (TV/IPTV) e ServeX (Internet/VPN) em um só lugar.

## Funcionalidades

- 📊 Dashboard com estatísticas unificadas
- 📺 Gerenciamento de clientes RaioFlix
- 📡 Gerenciamento de clientes ServeX
- ➕ Criar, listar e excluir clientes
- 🔄 Sincronização em tempo real

## Deploy no EasyPanel

1. Crie um novo app no EasyPanel
2. Conecte este repositório
3. Configure as variáveis de ambiente:
   - `RAIOFLIX_USERNAME` - Usuário RaioFlix
   - `RAIOFLIX_PASSWORD` - Senha RaioFlix
   - `RAIOFLIX_RELAY` - (opcional) URL do Cloudflare Worker
   - `SERVEX_API_KEY` - API key do ServeX
   - `SERVEX_CATEGORY_ID` - Categoria (padrão: 200)
   - `PAINEL_PORT` - Porta (padrão: 3480)

4. Deploy!

## Cloudflare Worker (para RaioFlix)

O RaioFlix bloqueia IPs brasileiros. Use o Cloudflare Worker como relay:

```bash
# Instalar wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
cd painel-iptv
wrangler deploy

# Adicione no .env:
RAIOFLIX_RELAY=https://raioflix-relay.seu-usuario.workers.dev
```

## Desenvolvimento Local

```bash
npm install
cp .env.example .env
# Edite .env com suas credenciais
npm start
```

Acesse: http://localhost:3480

## Estrutura

```
painel-iptv/
├── server.js              # Backend Express
├── services/
│   ├── raioflix.js        # API RaioFlix
│   └── servex.js          # API ServeX
├── public/
│   └── index.html         # Frontend React
├── cloudflare-worker.js   # Relay para RaioFlix
├── Dockerfile             # Deploy EasyPanel
└── wrangler.toml          # Config Cloudflare
```
