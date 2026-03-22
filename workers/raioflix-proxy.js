/**
 * RaioFlix Proxy Worker - Versão 3.0 (Python wrapper)
 * Usa script Python externo para buscar dados
 */

import express from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PROXY_WORKER_PORT || 3001;
const API_KEY = process.env.PROXY_WORKER_API_KEY || 'rf_proxy_key_2026';

app.use(express.json({ limit: '10mb' }));

// Auth middleware
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sincronizar TUDO via Python
app.get('/sync', authMiddleware, async (req, res) => {
  try {
    console.log('[Worker] Sincronização via Python...');
    
    // Executar script Python
    const result = execSync('python3 /tmp/sync_raioflix.py 2>&1', { 
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, OUTPUT_JSON: '1' }
    });
    
    // Ler dados do cache
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Worker] Erro:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clientes
app.get('/customers', authMiddleware, async (req, res) => {
  try {
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    res.json({ success: true, data: data.customers || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Revendas
app.get('/resellers', authMiddleware, async (req, res) => {
  try {
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    res.json({ success: true, data: data.resellers || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servidores
app.get('/servers', authMiddleware, async (req, res) => {
  try {
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    res.json({ success: true, data: data.servers || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pacotes
app.get('/packages', authMiddleware, async (req, res) => {
  try {
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    res.json({ success: true, data: data.packages || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stats
app.get('/stats', authMiddleware, async (req, res) => {
  try {
    const cacheData = execSync('cat /tmp/raioflix_cache.json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(cacheData);
    const customers = data.customers || [];
    
    res.json({
      success: true,
      data: {
        totalClients: customers.length,
        activeClients: customers.filter(c => c.status === 'ACTIVE' || c.status === 'active').length,
        expiredClients: customers.filter(c => c.status === 'EXPIRED' || c.status === 'expired').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 RaioFlix Proxy Worker v3 rodando na porta ${PORT}`);
});
