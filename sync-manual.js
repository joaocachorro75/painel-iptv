import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const RAIOFLIX_TOKEN = '1144|pheGJmNyk52gve7KnuiLzoeLBkBQKzJHLWt6AG9I77cfbf8a';
const PAINEL_URL = 'https://automacao-painel-tv.nfeujb.easypanel.host';
const PROXY = 'http://195.114.209.50:80';
const agent = new HttpsProxyAgent(PROXY);

async function sync() {
  console.log('🔄 Buscando dados RaioFlix...');
  
  // Buscar todas as páginas de clientes
  let allCustomers = [];
  for (let page = 1; page <= 5; page++) {
    const url = `http://raioflix.sigmab.pro/api/customers?page=${page}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${RAIOFLIX_TOKEN}` },
      agent
    });
    const data = await res.json();
    const customers = data.data || [];
    if (customers.length === 0) break;
    allCustomers = allCustomers.concat(customers);
    console.log(`   Página ${page}: ${customers.length} clientes`);
  }
  console.log(`✅ Total clientes: ${allCustomers.length}`);
  
  // Buscar revendas
  const resResellers = await fetch('http://raioflix.sigmab.pro/api/resellers', {
    headers: { 'Authorization': `Bearer ${RAIOFLIX_TOKEN}`},
    agent
  });
  const resellersData = await resResellers.json();
  const resellers = resellersData.data || [];
  console.log(`✅ Revendas: ${resellers.length}`);
  
  // Buscar servidores
  const resServers = await fetch('http://raioflix.sigmab.pro/api/servers', {
    headers: { 'Authorization': `Bearer ${RAIOFLIX_TOKEN}`},
    agent
  });
  const serversData = await resServers.json();
  const servers = serversData.data || [];
  console.log(`✅ Servidores: ${servers.length}`);
  
  // Buscar pacotes
  const resPackages = await fetch('http://raioflix.sigmab.pro/api/packages', {
    headers: { 'Authorization': `Bearer ${RAIOFLIX_TOKEN}`},
    agent
  });
  const packagesData = await resPackages.json();
  const packages = packagesData.data || [];
  console.log(`✅ Pacotes: ${packages.length}`);
  
  // Login no painel
  console.log('\n🔄 Logando no painel...');
  const loginRes = await fetch(`${PAINEL_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'joao', password: 'Joao123@' })
  });
  const loginData = await loginRes.json();
  const painelToken = loginData.token;
  console.log(`✅ Logado como: ${loginData.user?.name}`);
  
  // Sincronizar com painel
  console.log('\n🔄 Enviando dados para painel...');
  const syncRes = await fetch(`${PAINEL_URL}/api/sync/raioflix`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${painelToken}`
    },
    body: JSON.stringify({ 
      customers: allCustomers, 
      resellers: resellers,
      servers: servers,
      packages: packages
    })
  });
  const syncData = await syncRes.json();
  console.log('✅ Sync resultado:', JSON.stringify(syncData, null, 2));
  
  console.log('\n✅ SINCRONIZAÇÃO COMPLETA!');
}

sync().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
