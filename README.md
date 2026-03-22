# Painel IPTV Unificado

Painel para gerenciar clientes RaioFlix (TV/IPTV) e ServeX (Internet/VPN) em um só lugar.

## Funcionalidades

- 📊 Dashboard com estatísticas unificadas
- 📺 Gerenciamento de clientes RaioFlix (TV)
- 📡 Gerenciamento de clientes ServeX (Internet)
- 🔐 Sistema de login com hierarquia multi-nível
- 👥 Criação automática de revendas em todos os provedores
- 💰 Sistema de créditos unificado
- ➕ Criar, listar e excluir clientes
- 🔄 Sincronização automática entre provedores

## Hierarquia

```
Super Admin (João)
    │
    ├── Master
    │       │
    │       ├── Revenda
    │       │       └── Clientes
    │       │
    │       └── Clientes
    │
    └── Revenda
            └── Clientes
```

## Provedores Suportados

| Provedor | Tipo | Status |
|----------|------|--------|
| RaioFlix | TV/IPTV | ✅ Ativo |
| ServeX | Internet/VPN | ✅ Ativo |

**Fácil de adicionar novos provedores no futuro!**

## Login Padrão

```
Usuário: joao
Senha: Joao123@
```

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
   - `JWT_SECRET` - Chave secreta para tokens JWT

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
│   ├── servex.js          # API ServeX
│   ├── database.js        # Banco SQLite + funções de usuário
│   ├── auth.js            # Autenticação JWT
│   └── providerSync.js    # Sincronização entre provedores
├── public/
│   └── index.html         # Frontend React
├── cloudflare-worker.js   # Relay para RaioFlix
├── Dockerfile             # Deploy EasyPanel
└── wrangler.toml          # Config Cloudflare
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário logado

### Usuários
- `GET /api/users` - Listar subordinados
- `POST /api/users` - Criar usuário (sincroniza com provedores)
- `GET /api/users/:id` - Detalhes do usuário
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário

### Créditos
- `GET /api/credits` - Saldo atual
- `GET /api/credits/history` - Histórico
- `POST /api/credits/transfer` - Transferir para subordinado

### Provedores
- `GET /api/providers` - Listar provedores ativos
- `POST /api/providers/:provider/customers` - Criar cliente em provedor específico

---

## 🔧 Proxy Worker para RaioFlix

O RaioFlix bloqueia IPs de datacenter. O Proxy Worker permite criar/deletar clientes de fora do container.

### Como funciona:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Painel    │────▶│   Proxy Worker   │────▶│  RaioFlix   │
│  EasyPanel  │     │  (IP residencial)│     │    API      │
└─────────────┘     └──────────────────┘     └─────────────┘
```

### Rodar o Proxy Worker:

```bash
# No servidor com IP residencial (ou onde proxy funciona)
cd painel-iptv/workers
npm install
RAIOFLIX_PROXY=http://195.114.209.50:80 PROXY_WORKER_PORT=3001 node raioflix-proxy.js
```

### Configurar no Painel:

Adicione no `.env` do painel:

```
RAIOFLIX_PROXY_WORKER=http://ip-do-worker:3001
RAIOFLIX_PROXY_KEY=rf_proxy_key_2026
```

### Endpoints do Worker:

- `GET /customers` - Listar clientes
- `POST /customers` - Criar cliente
- `PUT /customers/:id` - Atualizar cliente
- `DELETE /customers/:id` - Deletar cliente
- `GET /resellers` - Listar revendas
- `GET /servers` - Listar servidores
- `GET /packages` - Listar pacotes
- `POST /sync` - Sincronizar dados

---

*Última atualização: 2026-03-20*
