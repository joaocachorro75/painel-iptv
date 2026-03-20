/**
 * Provider Sync Service
 * Sincroniza usuários entre os provedores ativos (RaioFlix, ServeX)
 */

import db from './database.js';
import RaioFlix from './raioflix.js';
import ServeX from './servex.js';

// Mapeamento de provedores
const PROVIDERS = {
  raioflix: {
    name: 'RaioFlix',
    type: 'tv',
    service: RaioFlix,
    createReseller: async (data) => {
      return RaioFlix.createReseller({
        username: data.username,
        password: data.password,
        name: data.name,
        credits: data.credits || 0,
        servers: data.servers || ['BV4D3rLaqZ', 'rlKWO3Wzo7', 'RYAWRk1jlx']
      });
    },
    createClient: async (data) => {
      return RaioFlix.createCustomer(data);
    }
  },
  servex: {
    name: 'ServeX',
    type: 'internet',
    service: ServeX,
    createReseller: async (data) => {
      return ServeX.createReseller?.({
        name: data.name,
        username: data.username,
        password: data.password,
        max_users: data.max_users || 10,
        category_ids: data.category_ids || [200],
        account_type: 'credit'
      });
    },
    createClient: async (data) => {
      return ServeX.createClient(data);
    }
  }
};

/**
 * Retorna provedores ativos
 */
export function getActiveProviders() {
  const rows = db.prepare('SELECT * FROM active_providers WHERE enabled = 1 ORDER BY priority').all();
  return rows.map(row => ({
    ...row,
    config: row.config ? JSON.parse(row.config) : {}
  }));
}

/**
 * Sincroniza criação de revenda em todos os provedores ativos
 */
export async function syncCreateReseller(user, userData) {
  const providers = getActiveProviders();
  const results = [];

  for (const providerConfig of providers) {
    const provider = PROVIDERS[providerConfig.name];
    
    if (!provider) {
      console.warn(`Provider ${providerConfig.name} não implementado`);
      continue;
    }

    try {
      console.log(`Criando revenda em ${provider.name}...`);
      
      const result = await provider.createReseller({
        username: userData.username,
        password: userData.password,
        name: userData.name || userData.username,
        credits: userData.credits || 0,
        ...providerConfig.config
      });

      // Salvar mapeamento
      const externalId = result.id || result._id || result.reseller_id;
      
      db.prepare(`
        INSERT OR REPLACE INTO user_providers 
        (user_id, provider, external_id, external_username, external_password, synced_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(user.id, providerConfig.name, externalId, userData.username, userData.password);

      results.push({
        provider: providerConfig.name,
        type: provider.type,
        success: true,
        externalId,
        result
      });

      console.log(`✅ Revenda criada em ${provider.name}: ${externalId}`);
    } catch (error) {
      console.error(`❌ Erro ao criar em ${provider.name}:`, error.message);
      
      results.push({
        provider: providerConfig.name,
        type: provider.type,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Sincroniza criação de cliente em provedor específico
 */
export async function syncCreateClient(userId, providerName, clientData) {
  const provider = PROVIDERS[providerName];
  
  if (!provider) {
    throw new Error(`Provider ${providerName} não encontrado`);
  }

  try {
    console.log(`Criando cliente em ${provider.name}...`);
    
    const result = await provider.createClient(clientData);
    
    const externalId = result.id || result._id || result.client_id;
    
    // Salvar mapeamento
    db.prepare(`
      INSERT OR REPLACE INTO user_providers 
      (user_id, provider, external_id, external_username, external_password, synced_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, providerName, externalId, clientData.username, clientData.password);

    console.log(`✅ Cliente criado em ${provider.name}: ${externalId}`);
    
    return {
      success: true,
      provider: providerName,
      externalId,
      result
    };
  } catch (error) {
    console.error(`❌ Erro ao criar cliente em ${provider.name}:`, error.message);
    throw error;
  }
}

/**
 * Busca mapeamento de usuário em um provedor
 */
export function getUserProviderMapping(userId, providerName) {
  return db.prepare(`
    SELECT * FROM user_providers 
    WHERE user_id = ? AND provider = ?
  `).get(userId, providerName);
}

/**
 * Busca todos os mapeamentos de um usuário
 */
export function getUserProviderMappings(userId) {
  return db.prepare(`
    SELECT * FROM user_providers WHERE user_id = ?
  `).all(userId);
}

/**
 * Atualiza configuração de provedor
 */
export function updateProviderConfig(providerName, config) {
  db.prepare(`
    UPDATE active_providers 
    SET config = ?, enabled = ?
    WHERE name = ?
  `).run(JSON.stringify(config), config.enabled ? 1 : 0, providerName);
}

/**
 * Adiciona novo provedor
 */
export function addProvider(name, type, config = {}) {
  db.prepare(`
    INSERT OR REPLACE INTO active_providers (name, type, enabled, priority, config)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, type, config.enabled ? 1 : 0, config.priority || 99, JSON.stringify(config));
}

/**
 * Remove provedor
 */
export function removeProvider(name) {
  db.prepare('DELETE FROM active_providers WHERE name = ?').run(name);
}

export default {
  getActiveProviders,
  syncCreateReseller,
  syncCreateClient,
  getUserProviderMapping,
  getUserProviderMappings,
  updateProviderConfig,
  addProvider,
  removeProvider,
  PROVIDERS
};
