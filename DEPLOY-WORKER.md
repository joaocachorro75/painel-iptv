# Deploy do Cloudflare Worker

## Passo a Passo

### 1. Acesse o Cloudflare
- URL: https://dash.cloudflare.com
- Login com sua conta

### 2. Vá em Workers & Pages
- Menu lateral → **Workers & Pages**
- Clique **Create application**
- Clique **Create Worker**
- Nome: `raioflix-relay`
- Clique **Deploy**

### 3. Edite o código
- Clique em **Edit code**
- Apague todo o código que tem lá
- Cole o código do arquivo `cloudflare-worker.js`
- Clique **Save and Deploy**

### 4. Copie a URL
- A URL será algo como: `https://raioflix-relay.SEU-USUARIO.workers.dev`
- Copie essa URL

### 5. Configure no EasyPanel
- Adicione a variável de ambiente no container:
  ```
  RAIOFLIX_RELAY=https://raioflix-relay.SEU-USUARIO.workers.dev
  ```
- Reinicie o container

## Testando

Depois de configurado, teste:
```bash
curl https://raioflix-relay.SEU-USUARIO.workers.dev/api/customers?page=1&perPage=5 \
  -H "Authorization: Bearer SEU_TOKEN"
```

Se retornar JSON, funciona!

---

## Código do Worker

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const targetUrl = 'https://raioflix.sigmab.pro' + url.pathname + url.search;
    
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'Accept': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: request.method !== 'GET' && request.method !== 'OPTIONS' 
          ? await request.text() 
          : undefined,
      });

      const data = await response.text();
      
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
```
