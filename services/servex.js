import fetch from 'node-fetch';

// Configurações
const BASE_URL = process.env.SERVEX_BASE_URL || 'https://servex.ws';
const API_KEY = process.env.SERVEX_API_KEY || 'sx_6a099e6d4486891b9fe723acdb7cc70cf2074e214623933a30b968332c0b36da';
const CATEGORY_ID = process.env.SERVEX_CATEGORY_ID || '200';

/**
 * Helper para fazer requests autenticados
 */
async function apiRequest(endpoint, options = {}) {
  console.log('[ServeX] Request para:', `${BASE_URL}${endpoint}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept:': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();
    console.log('[ServeX] Response status:', response.status);
    
    if (!response.ok) {
      console.error('[ServeX] Erro:', data.message || 'Erro desconhecido');
      throw new Error(data.message || 'Erro na API ServeX');
    }
    
    return data;
  } catch (e) {
    console.error('[ServeX] Erro na request:', e.message);
    throw e;
  }
}

// ==========================================
// CLIENTES
// ==========================================

/**
 * Lista todos os clientes
 */
export async function listClients() {
  // Buscar todos os clientes (aumentar limite para 1000)
  const data = await apiRequest('/api/clients?limit=1000');
  // ServeX retorna { clients: [...], total, page, limit }
  return data.clients || [];
}

/**
 * Obtém um cliente por ID
 */
export async function getClient(id) {
  return apiRequest(`/api/clients/${id}`);
}

/**
 * Cria um novo cliente
 * @param {Object} params
 * @param {string} params.username - Apenas letras e números (sem _ ou -)
 * @param {string} params.password - Apenas letras e números
 * @param {number} params.duration - Dias (para user) ou minutos (para test)
 * @param {string} params.type - "user" ou "test"
 * @param {number} params.connection_limit - Limite de conexões
 */
export async function createClient({ username, password, duration = 30, type = 'user', connection_limit = 1 }) {
  // Validação: apenas letras e números
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    throw new Error('Username deve conter apenas letras e números');
  }
  if (!/^[a-zA-Z0-9]+$/.test(password)) {
    throw new Error('Password deve conter apenas letras e números');
  }
  
  return apiRequest('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      category_id: parseInt(CATEGORY_ID),
      connection_limit,
      duration,
      type
    })
  });
}

/**
 * Atualiza um cliente
 */
export async function updateClient(id, data) {
  return apiRequest(`/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * Deleta um cliente
 */
export async function deleteClient(id) {
  return apiRequest(`/api/clients/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Renova um cliente
 */
export async function renewClient(id, days) {
  return apiRequest(`/api/clients/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ days })
  });
}

// ==========================================
// CATEGORIAS
// ==========================================

/**
 * Lista todas as categorias
 */
export async function listCategories() {
  const data = await apiRequest('/api/categories');
  return Array.isArray(data) ? data : data.data || [];
}

// ==========================================
// STATS
// ==========================================

/**
 * Obtém estatísticas
 */
export async function getStats() {
  const clients = await listClients();
  
  return {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    expiredClients: clients.filter(c => c.status === 'expired').length,
    testClients: clients.filter(c => c.type === 'test').length
  };
}

export default {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  renewClient,
  listCategories,
  getStats
};
