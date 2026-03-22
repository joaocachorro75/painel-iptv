import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configurações
const ENABLED = process.env.RAIOFLIX_ENABLED !== 'false';
const BASE_URL = process.env.RAIOFLIX_BASE_URL || 'http://raioflix.sigmab.pro';
const PROXY_URL = process.env.RAIOFLIX_PROXY || '';
const PROXY_WORKER_URL = process.env.RAIOFLIX_PROXY_WORKER || '';
const PROXY_WORKER_KEY = process.env.RAIOFLIX_PROXY_KEY || 'rf_proxy_key_2026';
const USERNAME = process.env.RAIOFLIX_USERNAME || 'JoaoReven';
const PASSWORD = process.env.RAIOFLIX_PASSWORD || 'Canaisip123@';

console.log('[RaioFlix] Config:', { 
  ENABLED, 
  BASE_URL, 
  PROXY_URL: PROXY_URL || 'nenhum',
  PROXY_WORKER_URL: PROXY_WORKER_URL || 'nenhum'
});

// Cache do token
let cachedToken = null;
let tokenExpires = null;

/**
 * Verifica se RaioFlix está habilitado
 */
export function isEnabled() {
  return ENABLED && BASE_URL;
}

/**
 * Faz request via Proxy Worker externo
 */
async function fetchViaProxyWorker(endpoint, options = {}) {
  if (!PROXY_WORKER_URL) {
    throw new Error('Proxy worker não configurado');
  }
  
  // Mapear endpoints do worker
  const endpointMap = {
    '/api/customers': '/customers',
    '/api/resellers': '/resellers',
    '/api/servers': '/servers',
    '/api/packages': '/packages',
    '/sync': '/sync'
  };
  
  const mappedEndpoint = endpointMap[endpoint] || endpoint;
  
  // Construir URL
  const url = `${PROXY_WORKER_URL}${mappedEndpoint}`;
  
  console.log('[RaioFlix] Via Proxy Worker:', url);
  
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PROXY_WORKER_KEY,
      ...options.headers
    },
    timeout: 60000
  };
  
  // Adicionar body se for POST/PUT
  if (options.body) {
    fetchOptions.body = options.body;
  }
  
  const response = await fetch(url, fetchOptions);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Erro no proxy worker');
  }
  
  return data.data;
}

/**
 * Faz request direto com proxy
 */
async function fetchDirect(endpoint, options = {}) {
  const url = BASE_URL + endpoint;
  console.log('[RaioFlix] Request direto:', url);
  
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.headers
    },
    timeout: 60000
  };

  // Adiciona proxy se configurado
  if (PROXY_URL) {
    try {
      fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
    } catch (e) {
      console.error('[RaioFlix] Erro ao criar proxy agent:', e.message);
    }
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();
  console.log('[RaioFlix] Response status:', response.status);
  
  // Tenta parsear JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('[RaioFlix] Erro ao parsear JSON:', text.substring(0, 100));
    throw new Error('Resposta inválida: ' + text.substring(0, 50));
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
    const data = await fetchDirect('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });
    
    if (data.token) {
      cachedToken = data.token;
      tokenExpires = Date.now() + 3600000; // 1 hora
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
 * Tenta primeiro via proxy worker, depois direto
 */
async function apiRequest(endpoint, options = {}) {
  // Se tem proxy worker configurado, prioriza ele
  if (PROXY_WORKER_URL) {
    try {
      return await fetchViaProxyWorker(endpoint, options);
    } catch (error) {
      console.error('[RaioFlix] Proxy worker falhou:', error.message);
      // Continua tentando direto
    }
  }
  
  // Tenta direto
  try {
    const token = await authenticate();
    return await fetchDirect(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('[RaioFlix] Request direto falhou:', error.message);
    throw error;
  }
}

// ==========================================
// CLIENTES
// ==========================================

export async function listCustomers() {
  // Se não tem proxy E não tem proxy worker, lança erro para usar cache
  if (!PROXY_URL && !PROXY_WORKER_URL) {
    throw new Error('RaioFlix sem proxy - use cache');
  }
  
  console.log('[RaioFlix] Listando clientes...');
  
  try {
    const data = await apiRequest('/api/customers');
    
    let customers = [];
    if (Array.isArray(data)) {
      customers = data;
    } else if (data.data && Array.isArray(data.data)) {
      customers = data.data;
    }
    
    // Filtrar apenas clientes do revendedor
    const filtered = customers.filter(c => c.reseller === USERNAME);
    console.log('[RaioFlix] Clientes do JoaoReven:', filtered.length);
    
    return filtered;
  } catch (e) {
    console.error('[RaioFlix] Erro ao listar clientes:', e.message);
    throw e;
  }
}

export async function getCustomer(id) {
  return apiRequest(`/api/customers/${id}`);
}

export async function createCustomer({ username, password, server_id, package_id, connections = 1 }) {
  console.log('[RaioFlix] Criando cliente:', username);
  
  const data = await apiRequest('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ username, password, server_id, package_id, connections })
  });
  
  console.log('[RaioFlix] Cliente criado:', data.username || data.id);
  return data;
}

export async function updateCustomer(id, data) {
  return apiRequest(`/api/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteCustomer(id) {
  console.log('[RaioFlix] Deletando cliente:', id);
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

export async function updateReseller(id, data) {
  return apiRequest(`/api/resellers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function renewCustomer(id, days) {
  // Busca cliente atual
  const customer = await getCustomer(id);
  if (!customer) throw new Error('Cliente não encontrado');
  
  // Calcula nova data de expiração
  const currentExp = customer.exp_date ? new Date(customer.exp_date) : new Date();
  const newExp = new Date(currentExp.getTime() + days * 24 * 60 * 60 * 1000);
  
  return updateCustomer(id, { exp_date: newExp.toISOString() });
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
    const customers = await listCustomers();
    const resellers = await listResellers();
    
    return {
      enabled: true,
      totalClients: customers.length,
      activeClients: customers.filter(c => c.status === 'ACTIVE' || c.status === 'active').length,
      expiredClients: customers.filter(c => c.status === 'EXPIRED' || c.status === 'expired').length,
      totalResellers: resellers.length
    };
  } catch (e) {
    console.error('⚠️ RaioFlix indisponível:', e.message);
    throw e; // Lança erro para usar cache
  }
}

/**
 * Sincroniza todos os dados de uma vez via worker
 * Retorna { customers, resellers, servers, packages }
 */
export async function syncAll() {
  if (!PROXY_WORKER_URL) {
    throw new Error('Proxy worker não configurado para sync');
  }
  
  return await fetchViaProxyWorker('/sync');
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
  getStats,
  syncAll
};
