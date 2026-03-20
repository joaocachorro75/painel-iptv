import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

// Configurações
const BASE_URL = process.env.RAIOFLIX_BASE_URL || 'http://raioflix.sigmab.pro';
const PROXY_URL = process.env.RAIOFLIX_PROXY || 'http://5.161.155.252:80';
const RELAY_URL = process.env.RAIOFLIX_RELAY || null; // Ex: https://raioflix-relay.seu-usuario.workers.dev
const USERNAME = process.env.RAIOFLIX_USERNAME || 'JoaoReven';
const PASSWORD = process.env.RAIOFLIX_PASSWORD || 'Canaisip123@';

// Cache do token
let cachedToken = null;
let tokenExpires = null;

// Agent para proxy (fallback)
let proxyAgent = null;
try {
  proxyAgent = new HttpsProxyAgent(PROXY_URL);
} catch (e) {
  console.log('Proxy não disponível:', e.message);
}

/**
 * Decide qual URL usar (relay ou direta)
 */
function getBaseUrl() {
  if (RELAY_URL) {
    // Worker repassa direto, sem /relay
    return RELAY_URL;
  }
  return BASE_URL;
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
    const url = getBaseUrl() + '/api/auth/login';
    
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    };

    // Se não tem relay, usa proxy
    if (!RELAY_URL && proxyAgent) {
      options.agent = proxyAgent;
    }

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.token) {
      cachedToken = data.token;
      // Token expira em 1 hora
      tokenExpires = Date.now() + 3600000;
      return cachedToken;
    }
    
    throw new Error(data.message || 'Token não recebido');
  } catch (error) {
    console.error('Erro ao autenticar RaioFlix:', error.message);
    throw error;
  }
}

/**
 * Helper para fazer requests autenticados
 */
async function apiRequest(endpoint, options = {}) {
  const token = await authenticate();
  const url = getBaseUrl() + endpoint;
  
  const fetchOptions = {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  };

  // Se não tem relay, usa proxy
  if (!RELAY_URL && proxyAgent) {
    fetchOptions.agent = proxyAgent;
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na API RaioFlix');
  }
  
  return data;
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
  try {
    const [customers, resellers] = await Promise.all([
      listCustomers(),
      listResellers()
    ]);
    
    return {
      totalClients: customers.length,
      activeClients: customers.filter(c => c.status === 'active').length,
      expiredClients: customers.filter(c => c.status === 'expired').length,
      totalResellers: resellers.length
    };
  } catch (e) {
    return {
      totalClients: 0,
      activeClients: 0,
      expiredClients: 0,
      totalResellers: 0,
      error: e.message
    };
  }
}

export default {
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
