import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { fileURLToPath as fileURLToPath2 } from 'url';
const __filename2 = fileURLToPath2(import.meta.url);
const __dirname2 = path.dirname(__filename2);
dotenv.config({ path: path.join(__dirname2, '.env') });

// Forçar porta do ambiente (EasyPanel usa PORT=80)
if (!process.env.PORT && !process.env.PAINEL_PORT) {
  process.env.PORT = '3480'; // fallback local
}

// Services
import RaioFlix from './services/raioflix.js';
import ServeX from './services/servex.js';
import db from './services/database.js';
import { authMiddleware, roleMiddleware, login, register } from './services/auth.js';
import { syncCreateReseller, syncCreateClient, getActiveProviders, getUserProviderMapping } from './services/providerSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Usar porta do ambiente ou 3480 como fallback
const PORT = process.env.PORT || process.env.PAINEL_PORT || 3480;

// Criar pasta data se não existir
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// HEALTH
// ==========================================
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'painel-iptv' });
});

// ==========================================
// AUTH - ROTAS PÚBLICAS
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username e password são obrigatórios' });
    }
    
    const result = login(username, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// ==========================================
// AUTH - ROTAS PROTEGIDAS
// ==========================================
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { password: _, ...user } = req.user;
  res.json({ success: true, user });
});

// ==========================================
// USERS - GESTÃO DE USUÁRIOS
// ==========================================

// Listar subordinados (ou todos se super_admin)
app.get('/api/users', authMiddleware, (req, res) => {
  try {
    let users;
    
    if (req.user.role === 'super_admin') {
      // Super admin vê todos
      users = db.getAllSubordinates(req.user.id);
      users.unshift(db.getUserById(req.user.id));
    } else {
      // Outros veem apenas subordinados
      users = db.getSubordinateUsers(req.user.id);
    }
    
    // Remove senhas
    const usersWithoutPasswords = users.map(u => {
      const { password: _, ...user } = u;
      return user;
    });
    
    res.json({ success: true, data: usersWithoutPasswords });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar usuário subordinado
app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    const { username, password, email, name, role, credits } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: 'Username, password e role são obrigatórios' });
    }
    
    const newUser = register(req.user, { username, password, email, name, role, credits });
    
    // Se for revenda, sincronizar com provedores
    if (role === 'revenda' || role === 'master') {
      const syncResults = await syncCreateReseller(newUser, { username, password, name, credits });
      newUser.providerSync = syncResults;
    }
    
    res.json({ success: true, data: newUser });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Buscar usuário específico
app.get('/api/users/:id', authMiddleware, (req, res) => {
  try {
    const user = db.getUserById(parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    
    // Verifica se tem permissão (é o próprio ou é subordinado)
    const subordinates = db.getAllSubordinates(req.user.id);
    const isSubordinate = subordinates.some(s => s.id === user.id);
    
    if (user.id !== req.user.id && !isSubordinate && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Sem permissão' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar usuário
app.put('/api/users/:id', authMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    
    // Verifica permissão
    const subordinates = db.getAllSubordinates(req.user.id);
    const isSubordinate = subordinates.some(s => s.id === userId);
    
    if (userId !== req.user.id && !isSubordinate && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Sem permissão' });
    }
    
    const updated = db.updateUser(userId, req.body);
    const { password: _, ...userWithoutPassword } = updated;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deletar usuário
app.delete('/api/users/:id', authMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    
    // Não pode deletar a si mesmo
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Não pode deletar a si mesmo' });
    }
    
    // Verifica permissão
    const subordinates = db.getAllSubordinates(req.user.id);
    const isSubordinate = subordinates.some(s => s.id === userId);
    
    if (!isSubordinate && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Sem permissão' });
    }
    
    db.deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CRÉDITOS
// ==========================================

// Ver saldo
app.get('/api/credits', authMiddleware, (req, res) => {
  res.json({ success: true, credits: req.user.credits || 0 });
});

// Histórico
app.get('/api/credits/history', authMiddleware, (req, res) => {
  try {
    const history = db.getCreditHistory(req.user.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transferir créditos
app.post('/api/credits/transfer', authMiddleware, (req, res) => {
  try {
    const { toUserId, amount } = req.body;
    
    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'toUserId e amount são obrigatórios' });
    }
    
    // Verifica se o destinatário é subordinado
    const subordinates = db.getAllSubordinates(req.user.id);
    const isSubordinate = subordinates.some(s => s.id === toUserId);
    
    if (!isSubordinate && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Só pode transferir para subordinados' });
    }
    
    const result = db.transferCredits(req.user.id, toUserId, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Adicionar créditos (apenas super_admin)
app.post('/api/credits/add', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'userId e amount são obrigatórios' });
    }
    
    const result = db.addCredits(userId, amount, 'Créditos adicionados pelo Super Admin');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// RIOFLIX - CLIENTES
// ==========================================
app.get('/api/raioflix/customers', authMiddleware, async (req, res) => {
  try {
    // Tentar API direta
    try {
      const customers = await RaioFlix.listCustomers();
      res.json({ success: true, data: customers });
    } catch (e) {
      // Usar cache se falhar
      res.json({ 
        success: true, 
        data: raioFlixCache.customers,
        fromCache: true,
        lastSync: raioFlixCache.lastSync
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raioflix/customers', authMiddleware, async (req, res) => {
  try {
    // Verifica créditos se não for super_admin
    const price = db.getPrice('raioflix', req.body.package_id, req.user.role) || 0;
    
    if (price > 0 && req.user.credits < price && req.user.role !== 'super_admin') {
      return res.status(400).json({ success: false, error: 'Créditos insuficientes' });
    }
    
    const customer = await RaioFlix.createCustomer(req.body);
    
    // Debita créditos
    if (price > 0 && req.user.role !== 'super_admin') {
      db.useCredits(req.user.id, price, `Criou cliente RaioFlix: ${req.body.username}`);
    }
    
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/raioflix/customers/:id', authMiddleware, async (req, res) => {
  try {
    await RaioFlix.deleteCustomer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// RIOFLIX - REVENDAS
// ==========================================
app.get('/api/raioflix/resellers', authMiddleware, async (req, res) => {
  try {
    // Tentar API direta
    try {
      const resellers = await RaioFlix.listResellers();
      res.json({ success: true, data: resellers });
    } catch (e) {
      // Usar cache se falhar
      res.json({ 
        success: true, 
        data: raioFlixCache.resellers,
        fromCache: true,
        lastSync: raioFlixCache.lastSync
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raioflix/resellers', authMiddleware, async (req, res) => {
  try {
    const reseller = await RaioFlix.createReseller(req.body);
    res.json({ success: true, data: reseller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/raioflix/resellers/:id', authMiddleware, async (req, res) => {
  try {
    const result = await RaioFlix.updateReseller(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Renovar cliente
app.put('/api/raioflix/customers/:id/renew', authMiddleware, async (req, res) => {
  try {
    const { days } = req.body;
    const result = await RaioFlix.renewCustomer(req.params.id, days);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// RIOFLIX - SERVIDORES E PACOTES
// ==========================================
app.get('/api/raioflix/servers', authMiddleware, async (req, res) => {
  try {
    const servers = await RaioFlix.listServers();
    res.json({ success: true, data: servers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/raioflix/packages', authMiddleware, async (req, res) => {
  try {
    const packages = await RaioFlix.listPackages();
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SERVEX - CLIENTES
// ==========================================
app.get('/api/servex/clients', authMiddleware, async (req, res) => {
  try {
    const clients = await ServeX.listClients();
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/servex/clients', authMiddleware, async (req, res) => {
  try {
    // Verifica créditos se não for super_admin
    const price = db.getPrice('servex', req.body.type || 'user', req.user.role) || 0;
    
    if (price > 0 && req.user.credits < price && req.user.role !== 'super_admin') {
      return res.status(400).json({ success: false, error: 'Créditos insuficientes' });
    }
    
    const client = await ServeX.createClient(req.body);
    
    // Debita créditos
    if (price > 0 && req.user.role !== 'super_admin') {
      db.useCredits(req.user.id, price, `Criou cliente ServeX: ${req.body.username}`);
    }
    
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/servex/clients/:id', authMiddleware, async (req, res) => {
  try {
    await ServeX.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PROVIDERS - GESTÃO DE PROVEDORES
// ==========================================

// Listar provedores ativos
app.get('/api/providers', authMiddleware, (req, res) => {
  try {
    const providers = getActiveProviders();
    res.json({ success: true, data: providers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Criar cliente em provedor específico
app.post('/api/providers/:provider/customers', authMiddleware, async (req, res) => {
  try {
    const { provider } = req.params;
    const clientData = req.body;
    
    const result = await syncCreateClient(req.user.id, provider, clientData);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// STATS GERAL
// ==========================================
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    // Tentar RaioFlix direto, senão usar cache
    let raioflixStats;
    try {
      raioflixStats = await RaioFlix.getStats();
      // Se retornou vazio (erro), usar cache
      if (raioflixStats.totalClients === 0 && raioFlixCache.customers.length > 0) {
        raioflixStats = {
          enabled: true,
          totalClients: raioFlixCache.customers.length,
          activeClients: raioFlixCache.customers.filter(c => c.status === 'ACTIVE' || c.status === 'active').length,
          expiredClients: raioFlixCache.customers.filter(c => c.status === 'EXPIRED' || c.status === 'expired').length,
          totalResellers: raioFlixCache.resellers.length,
          fromCache: true,
          lastSync: raioFlixCache.lastSync
        };
      }
    } catch (e) {
      // Usar cache se API falhar
      raioflixStats = {
        enabled: true,
        totalClients: raioFlixCache.customers.length,
        activeClients: raioFlixCache.customers.filter(c => c.status === 'ACTIVE' || c.status === 'active').length,
        expiredClients: raioFlixCache.customers.filter(c => c.status === 'EXPIRED' || c.status === 'expired').length,
        totalResellers: raioFlixCache.resellers.length,
        fromCache: true,
        lastSync: raioFlixCache.lastSync
      };
    }
    
    const servexStats = await ServeX.getStats();
    const userStats = db.getStats();
    
    res.json({
      success: true,
      data: {
        raioflix: raioflixStats,
        servex: servexStats,
        users: userStats,
        total: {
          clients: raioflixStats.totalClients + servexStats.totalClients,
          active: raioflixStats.activeClients + servexStats.activeClients
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SINCRONIZAÇÃO EXTERNA (para quando proxy não funciona no container)
// ==========================================

// Cache de dados do RaioFlix (atualizado externamente ou via worker)
const CACHE_FILE = path.join(__dirname, 'data', 'raioflix_cache.json');

// Carrega cache do arquivo se existir
let raioFlixCache = { customers: [], resellers: [], servers: [], packages: [], lastSync: null };
if (fs.existsSync(CACHE_FILE)) {
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    raioFlixCache = cached;
    console.log(`✅ Cache carregado: ${raioFlixCache.customers?.length || 0} clientes`);
  } catch (e) {
    console.log('⚠️ Erro ao carregar cache:', e.message);
  }
}

// Função para salvar cache
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(raioFlixCache, null, 2));
  } catch (e) {
    console.error('Erro ao salvar cache:', e.message);
  }
}

// Endpoint para sincronizar via Proxy Worker
app.post('/api/sync/raioflix', authMiddleware, roleMiddleware('super_admin'), async (req, res) => {
  try {
    const { customers, resellers, servers, packages } = req.body;
    
    // Se vier dados no body, usa eles (script externo)
    if (customers && customers.length > 0) {
      raioFlixCache.customers = customers;
    }
    if (resellers && resellers.length > 0) {
      raioFlixCache.resellers = resellers;
    }
    if (servers && servers.length > 0) {
      raioFlixCache.servers = servers;
    }
    if (packages && packages.length > 0) {
      raioFlixCache.packages = packages;
    }
    raioFlixCache.lastSync = new Date().toISOString();
    
    // Salva cache em arquivo
    saveCache();
    
    console.log(`✅ RaioFlix sincronizado: ${raioFlixCache.customers.length} clientes, ${raioFlixCache.resellers.length} revendas`);
    
    res.json({ 
      success: true, 
      message: 'Dados sincronizados',
      customers: raioFlixCache.customers.length,
      resellers: raioFlixCache.resellers.length,
      lastSync: raioFlixCache.lastSync
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para sincronizar automaticamente via Proxy Worker
app.get('/api/sync/auto', authMiddleware, roleMiddleware('super_admin'), async (req, res) => {
  try {
    console.log('[Painel] Iniciando sincronização automática...');
    
    const data = await RaioFlix.syncAll();
    
    raioFlixCache.customers = data.customers || [];
    raioFlixCache.resellers = data.resellers || [];
    raioFlixCache.lastSync = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Sincronização automática concluída',
      customers: raioFlixCache.customers.length,
      resellers: raioFlixCache.resellers.length,
      servers: data.servers?.length || 0,
      packages: data.packages?.length || 0,
      lastSync: raioFlixCache.lastSync
    });
  } catch (error) {
    console.error('[Painel] Erro na sincronização:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obter dados em cache
app.get('/api/sync/raioflix', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: raioFlixCache
  });
});

// Endpoint para sincronizar AGORA via Worker (chamado pelo frontend)
app.post('/api/sync/now', authMiddleware, async (req, res) => {
  try {
    console.log('[Painel] Sincronização solicitada...');
    
    const { execSync } = await import('child_process');
    
    // Roda o script Python de sincronização
    const scriptPath = path.join(__dirname, 'scripts', 'sync_now.py');
    
    if (fs.existsSync(scriptPath)) {
      console.log('[Painel] Executando script Python...');
      
      try {
        const output = execSync(`python3 ${scriptPath} 2>&1`, { 
          timeout: 120000,
          env: { ...process.env },
          encoding: 'utf8'
        });
        
        console.log('[Painel] Script output:\n' + output);
      } catch (scriptError) {
        console.error('[Painel] Erro no script:', scriptError.stdout || scriptError.message);
      }
    } else {
      console.log('[Painel] Script não encontrado:', scriptPath);
    }
    
    // Se mesmo após sync não tem dados, usa cache existente
    const customerCount = raioFlixCache.customers?.length || 0;
    
    res.json({
      success: true,
      message: customerCount > 0 ? 'Sincronizado' : 'Verifique os logs',
      customers: customerCount,
      resellers: raioFlixCache.resellers?.length || 0,
      lastSync: raioFlixCache.lastSync
    });
  } catch (error) {
    console.error('[Painel] Erro na sincronização:', error.message);
    res.json({
      success: false,
      error: error.message,
      customers: raioFlixCache.customers?.length || 0,
      fromCache: true
    });
  }
});

// ==========================================
// FRONTEND
// ==========================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Painel IPTV rodando na porta ${PORT}`);
  console.log(`📡 RaioFlix: ${process.env.RAIOFLIX_BASE_URL}`);
  console.log(`🌐 ServeX: ${process.env.SERVEX_BASE_URL}`);
  console.log(`👤 Login padrão: joao / Joao123@`);
  console.log(`⚠️ Worker deve rodar em container separado na porta 3001`);
});
