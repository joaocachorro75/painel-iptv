import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configurações
const ENABLED = process.env.RAIOFLIX_ENABLED !== 'false';
const BASE_URL = process.env.RAIOFLIX_BASE_URL || 'http://raioflix.sigmab.pro';
const PROXY_URL = process.env.RAIOFLIX_PROXY || '';
const USERNAME = process.env.RAIOFLIX_USERNAME || 'JoaoReven';
const PASSWORD = process.env.RAIOFLIX_PASSWORD || 'Canaisip123@';

// Cache do token
let cachedToken = null;
let tokenExpires = null;

/**
 * Verifica se RaioFlix está habilitado
 */
function isEnabled() {
  return ENABLED && BASE_URL;
}

/**
 * Limpa resposta do proxy (remove headers de erro do ScraperAPI)
 */
function cleanProxyResponse(text) {
  // Remove linhas como "Proxy Authentication Required" ou "Request failed"
  const lines = text.split('\n');
  const jsonLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('{') || 
           trimmed.startsWith('[') || 
           trimmed.startsWith('"') ||
           (trimmed && !trimmed.includes('Proxy') && !trimmed.includes('Request failed'));
  });
  return jsonLines.join('\n');
}

/**
 * Faz request com proxy, tratando resposta
 */
async function fetchWithProxy(url, options = {}) {
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.headers
    }
  };

  // Adiciona proxy se configurado
  if (PROXY_URL) {
    try {
      fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    } catch (e) {
      console.log('⚠️ Proxy não disponível:', e.message);
    }
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();
  
  // Limpa resposta do proxy
  const cleanText = cleanProxyResponse(text);
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error('❌ Resposta inválida:', text.substring(0, 100));
    throw new Error('Resposta inválida da API');
  }
}

/**
 * Autentica e retorna token Bearer
 */
async function authenticate() {
  // Se token ainda é válido, retorna do cache
  if (cachedToken && tokenExpires && Date.now() < tokenExpires) {
    return cachedToken;
  }

  try {
    const url = BASE_URL + '/api/auth/login';
    
    const data = await fetchWithProxy(url, {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    
    if (data.token) {
      cachedToken = data.token;
      // Token expira em 1 hora
      tokenExpires = Date.now() + 3600000;
      console.log('✅ RaioFlix autenticado! Créditos:', data.credits);
      return cachedToken;
    }
    
    throw new Error(data.message || 'Token não recebido');
  } catch (error) {
    console.error('❌ Erro ao autenticar RaioFlix:', error.message);
    throw error;
  }
}

/**
 * Helper para fazer requests autenticados
 */
async function apiRequest(endpoint, options = {}) {
  const token = await authenticate();
  const url = BASE_URL + endpoint;
  
  return fetchWithProxy(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
}

// ==========================================
// CLIENTES
// ==========================================

export async function listCustomers() {
  const data = await apiRequest('/api/customers');
  if (Array.isArray(data)) {
    return data.filter(c => c.reseller === USERNAME);
  }
  return data.data?.filter(c => c.reseller === USERNAME) || [];
}

export async function getCustomer(id) {
  return apiRequest(`/api/customers/${id}`);
}

export async function createCustomer({ username, password, server_id, package_id, connections = 1 }) {
  return apiRequest('/api/customers', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      server_id,
      package_id,
      connections
    })
  });
}

export async function updateCustomer(id, data) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteCustomer(id) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'DELETE'
  });
}

// ==========================================
// REVENDAS
// ==========================================

export async function listResellers() {
  const data = await apiRequest('/api/resellers');
  return Array.isArray(data) ? data : data.data || [];
}

export async function createReseller({ username, password, credits = 0 }) {
  return apiRequest('/api/resellers', {
    method: 'POST',
    body: JSON.stringify({ username, password, credits })
  });
}

export async function sellCredits(resellerId, amount) {
  return apiRequest(`/api/resellers/${resellerId}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

// ==========================================
// SERVIDORES E PACOTES
// ==========================================

export async function listServers() {
  const data = await apiRequest('/api/servers');
  return Array.isArray(data) ? data : data.data || [];
}

export async function listPackages() {
  const data = await apiRequest('/api/packages');
  return Array.isArray(data) ? data : data.data || [];
}

// ==========================================
// STATS
// ==========================================

export async function getStats() {
  // Se desabilitado, retorna vazio
  if (!ENABLED) {
    return {
      enabled: false,
      totalClients: 0,
      activeClients: 0,
      expiredClients: 0,
      totalResellers: 0
    };
  }
  
  try {
    const [customers, resellers] = await Promise.all([
      listCustomers(),
      listResellers()
    ]);
    
    return {
      enabled: true,
      totalClients: customers.length,
      activeClients: customers.filter(c => c.status === 'active').length,
      expiredClients: customers.filter(c => c.status === 'expired').length,
      totalResellers: resellers.length
    };
  } catch (e) {
    console.error('⚠️ RaioFlix indisponível:', e.message);
    return {
      enabled: false,
      error: e.message,
      totalClients: 0,
      activeClients: 0,
      expiredClients: 0,
      totalResellers: 0
    };
  }
}

export default {
  isEnabled,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listResellers,
  createReseller,
  sellCredits,
  listServers,
  listPackages,
  getStats
};
