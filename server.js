import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Services
import RaioFlix from './services/raioflix.js';
import ServeX from './services/servex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PAINEL_PORT || 3480;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// HEALTH
// ==========================================
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'painel-iptv' });
});

// ==========================================
// RIOFLIX - CLIENTES
// ==========================================
app.get('/api/raioflix/customers', async (req, res) => {
  try {
    const customers = await RaioFlix.listCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raioflix/customers', async (req, res) => {
  try {
    const customer = await RaioFlix.createCustomer(req.body);
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/raioflix/customers/:id', async (req, res) => {
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
app.get('/api/raioflix/resellers', async (req, res) => {
  try {
    const resellers = await RaioFlix.listResellers();
    res.json({ success: true, data: resellers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/raioflix/resellers', async (req, res) => {
  try {
    const reseller = await RaioFlix.createReseller(req.body);
    res.json({ success: true, data: reseller });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// RIOFLIX - SERVIDORES E PACOTES
// ==========================================
app.get('/api/raioflix/servers', async (req, res) => {
  try {
    const servers = await RaioFlix.listServers();
    res.json({ success: true, data: servers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/raioflix/packages', async (req, res) => {
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
app.get('/api/servex/clients', async (req, res) => {
  try {
    const clients = await ServeX.listClients();
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/servex/clients', async (req, res) => {
  try {
    const client = await ServeX.createClient(req.body);
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/servex/clients/:id', async (req, res) => {
  try {
    await ServeX.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// STATS GERAL
// ==========================================
app.get('/api/stats', async (req, res) => {
  try {
    const [raioflixStats, servexStats] = await Promise.all([
      RaioFlix.getStats(),
      ServeX.getStats()
    ]);
    
    res.json({
      success: true,
      data: {
        raioflix: raioflixStats,
        servex: servexStats,
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
// FRONTEND
// ==========================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Painel IPTV rodando na porta ${PORT}`);
  console.log(`📡 RaioFlix: ${process.env.RAIOFLIX_BASE_URL}`);
  console.log(`🌐 ServeX: ${process.env.SERVEX_BASE_URL}`);
});
