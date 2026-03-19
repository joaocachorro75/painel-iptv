import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

// Configurações
const BASE_URL = process.env.RAIOFLIX_BASE_URL || 'http://raioflix.sigmab.pro';
const PROXY_URL = process.env.RAIOFLIX_PROXY || 'http://5.161.155.252:80';
const USERNAME = process.env.RAIOFLIX_USERNAME || 'JoaoReven';
const PASSWORD = process.env.RAIOFLIX_PASSWORD || 'Canaisip123@';

// Cache do token
let cachedToken = null;
let tokenExpires = null;

// Agent para proxy
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

/**
 * Autentica e retorna token Bearer
 */
async function authenticate() {
  // Se token ainda é válido, retorna do cache
  if (cachedToken && tokenExpires && Date.now() < tokenExpires) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      agent: proxyAgent,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });

    const data = await response.json();
    
    if (data.token) {
      cachedToken = data.token;
      // Token expira em 1 hora (3600000ms)
      tokenExpires = Date.now() + 3600000;
      return cachedToken;
    }
    
    throw new Error('Token não recebido');
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
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    agent: proxyAgent,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na API RaioFlix');
  }
  
  return data;
}

// ==========================================
// CLIENTES
// ==========================================

/**
 * Lista todos os clientes (filtra pelo revendedor)
 */
export async function listCustomers() {
  const data = await apiRequest('/api/customers');
  // Filtra apenas clientes do nosso revendedor
  if (Array.isArray(data)) {
    return data.filter(c => c.reseller === USERNAME);
  }
  return data.data?.filter(c => c.reseller === USERNAME) || [];
}

/**
 * Obtém um cliente por ID
 */
export async function getCustomer(id) {
  return apiRequest(`/api/customers/${id}`);
}

/**
 * Cria um novo cliente
 */
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

/**
 * Atualiza um cliente
 */
export async function updateCustomer(id, data) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * Deleta um cliente
 */
export async function deleteCustomer(id) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'DELETE'
  });
}

// ==========================================
// REVENDAS
// ==========================================

/**
 * Lista todas as revendas
 */
export async function listResellers() {
  const data = await apiRequest('/api/resellers');
  return Array.isArray(data) ? data : data.data || [];
}

/**
 * Cria uma nova revenda
 */
export async function createReseller({ username, password, credits = 0 }) {
  return apiRequest('/api/resellers', {
    method: 'POST',
    body: JSON.stringify({ username, password, credits })
  });
}

/**
 * Vende créditos para uma revenda
 */
export async function sellCredits(resellerId, amount) {
  return apiRequest(`/api/resellers/${resellerId}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

// ==========================================
// SERVIDORES E PACOTES
// ==========================================

/**
 * Lista todos os servidores
 */
export async function listServers() {
  const data = await apiRequest('/api/servers');
  return Array.isArray(data) ? data : data.data || [];
}

/**
 * Lista todos os pacotes
 */
export async function listPackages() {
  const data = await apiRequest('/api/packages');
  return Array.isArray(data) ? data : data.data || [];
}

// ==========================================
// STATS
// ==========================================

/**
 * Obtém estatísticas do painel
 */
export async function getStats() {
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
