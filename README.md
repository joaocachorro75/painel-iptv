# Painel IPTV - RaioFlix + ServeX

Painel unificado para gerenciar clientes de TV (RaioFlix) e Internet (ServeX).

## Status

| Sistema | Status | Obs |
|---------|--------|-----|
| ServeX | ✅ Funcionando | API direta, sem proxy |
| RaioFlix | ⚠️ Proxy offline | Requer proxy 5.161.155.252:80 |

## Instalação

```bash
npm install
cp .env.example .env
# Editar .env com suas credenciais
npm start
```

## Porta

Padrão: 3480 (configurável via PAINEL_PORT no .env)

## Endpoints

### RaioFlix (TV)
- `GET /api/raioflix/customers` - Lista clientes
- `POST /api/raioflix/customers` - Cria cliente
- `DELETE /api/raioflix/customers/:id` - Deleta cliente
- `GET /api/raioflix/servers` - Lista servidores
- `GET /api/raioflix/packages` - Lista pacotes
- `GET /api/raioflix/resellers` - Lista revendas

### ServeX (Internet)
- `GET /api/servex/clients` - Lista clientes
- `POST /api/servex/clients` - Cria cliente
- `DELETE /api/servex/clients/:id` - Deleta cliente

### Stats
- `GET /api/stats` - Estatísticas gerais

## Funcionalidades

- ✅ Dashboard com estatísticas
- ✅ Gerenciamento de clientes ServeX
- ✅ Interface responsiva
- ⏳ Gerenciamento de clientes RaioFlix (aguardando proxy)

## Credenciais

Configure no `.env`:

```env
# RaioFlix
RAIOFLIX_BASE_URL=http://raioflix.sigmab.pro
RAIOFLIX_PROXY=http://5.161.155.252:80
RAIOFLIX_USERNAME=seu_usuario
RAIOFLIX_PASSWORD=sua_senha

# ServeX
SERVEX_BASE_URL=https://servex.ws
SERVEX_API_KEY=sua_api_key
SERVEX_CATEGORY_ID=200
```

## Próximos passos

1. [ ] Resolver proxy RaioFlix
2. [ ] Implementar revendas
3. [ ] Sincronização automática
4. [ ] Notificações de expiração
