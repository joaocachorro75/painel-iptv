// Cloudflare Worker - Relay para RaioFlix
// Deploy: wrangler deploy

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Relay para RaioFlix
    const targetUrl = 'http://raioflix.sigmab.pro' + url.pathname.replace('/relay', '');
    
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'Accept': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      const data = await response.text();
      
      return new Response(data, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
