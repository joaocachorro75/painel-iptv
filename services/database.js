import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Banco SQLite para usuários e hierarquia
const dbPath = path.join(__dirname, '..', 'data', 'painel.db');
const db = new Database(dbPath);

// Criar tabelas
db.exec(`
  -- Usuários do painel
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'revenda',
    parent_id INTEGER,
    credits REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id)
  );

  -- Transações de créditos
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    related_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (related_user_id) REFERENCES users(id)
  );

  -- Preços por nível
  CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    package_id TEXT NOT NULL,
    role TEXT NOT NULL,
    price REAL NOT NULL,
    UNIQUE(provider, package_id, role)
  );
`);

// Criar super admin se não existir
const superAdminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('super_admin');

if (!superAdminExists) {
  const hashedPassword = bcrypt.hashSync('Joao123@', 10);
  db.prepare(`
    INSERT INTO users (username, password, email, name, role, credits, status)
    VALUES (?, ?, ?, ?, 'super_admin', 999999, 'active')
  `).run('joao', hashedPassword, 'joao@to-ligado.com', 'João');
  
  console.log('✅ Super Admin criado: joao / Joao123@');
}

// Criar tabelas de mapeamento de provedores se não existirem
db.exec(`
  -- Mapeamento de usuários nos provedores externos
  CREATE TABLE IF NOT EXISTS user_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider VARCHAR(50) NOT NULL,
    external_id VARCHAR(100),
    external_username VARCHAR(100),
    external_password VARCHAR(100),
    external_token TEXT,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, provider)
  );

  -- Configuração de provedores ativos
  CREATE TABLE IF NOT EXISTS active_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    config JSON
  );
`);

// Inserir provedores padrão
db.prepare(`
  INSERT OR IGNORE INTO active_providers (name, type, enabled, priority) VALUES
  ('raioflix', 'tv', 1, 1),
  ('servex', 'internet', 1, 2)
`).run();

// ==========================================
// FUNÇÕES DE USUÁRIO
// ==========================================

export function createUser(data) {
  const { username, password, email, name, role, parent_id, credits, status } = data;
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  try {
    const result = db.prepare(`
      INSERT INTO users (username, password, email, name, role, parent_id, credits, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, email, name, role, parent_id || null, credits || 0, status || 'active');
    
    return { id: result.lastInsertRowid, username, email, name, role, credits: credits || 0, status: status || 'active' };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Usuário já existe');
    }
    throw error;
  }
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT id, username, email, name, role, parent_id, credits, status, created_at FROM users WHERE id = ?').get(id);
}

export function updateUser(id, data) {
  const fields = [];
  const values = [];
  
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.credits !== undefined) { fields.push('credits = ?'); values.push(data.credits); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
  
  if (fields.length === 0) return null;
  
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(id);
}

export function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function listUsers() {
  return db.prepare('SELECT id, username, email, name, role, parent_id, credits, status, created_at FROM users').all();
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

// ==========================================
// HIERARQUIA
// ==========================================

const ROLE_LEVELS = {
  super_admin: 1,
  ultra_master: 2,
  master: 3,
  revenda: 4,
  cliente: 5
};

const ROLE_CAN_CREATE = {
  super_admin: ['ultra_master', 'master', 'revenda', 'cliente'],
  ultra_master: ['master', 'revenda', 'cliente'],
  master: ['revenda', 'cliente'],
  revenda: ['cliente'],
  cliente: []
};

export function canCreateRole(userRole, targetRole) {
  return ROLE_CAN_CREATE[userRole]?.includes(targetRole) || false;
}

export function getSubordinateUsers(parentId) {
  return db.prepare(`
    SELECT id, username, email, name, role, credits, status, created_at
    FROM users WHERE parent_id = ?
    ORDER BY created_at DESC
  `).all(parentId);
}

export function getAllSubordinates(userId, role) {
  // Recursivamente busca todos os subordinados
  const subordinates = [];
  
  function collectSubordinates(parentId) {
    const children = db.prepare(`
      SELECT id, username, email, name, role, credits, status, parent_id
      FROM users WHERE parent_id = ?
    `).all(parentId);
    
    for (const child of children) {
      subordinates.push(child);
      collectSubordinates(child.id);
    }
  }
  
  collectSubordinates(userId);
  return subordinates;
}

// ==========================================
// CRÉDITOS
// ==========================================

export function addCredits(userId, amount, description, relatedUserId = null) {
  const user = getUserById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  
  const newCredits = (user.credits || 0) + amount;
  
  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newCredits, userId);
  
  db.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, description, related_user_id)
    VALUES (?, 'purchase', ?, ?, ?)
  `).run(userId, amount, description, relatedUserId);
  
  return getUserById(userId);
}

export function useCredits(userId, amount, description, relatedUserId = null) {
  const user = getUserById(userId);
  if (!user) throw new Error('Usuário não encontrado');
  
  if (user.credits < amount) {
    throw new Error('Créditos insuficientes');
  }
  
  const newCredits = user.credits - amount;
  
  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newCredits, userId);
  
  db.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, description, related_user_id)
    VALUES (?, 'usage', ?, ?, ?)
  `).run(userId, -amount, description, relatedUserId);
  
  return getUserById(userId);
}

export function transferCredits(fromUserId, toUserId, amount) {
  const fromUser = getUserById(fromUserId);
  const toUser = getUserById(toUserId);
  
  if (!fromUser || !toUser) throw new Error('Usuário não encontrado');
  if (fromUser.credits < amount) throw new Error('Créditos insuficientes');
  
  // Debita
  db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, fromUserId);
  db.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, description, related_user_id)
    VALUES (?, 'transfer_out', ?, ?, ?)
  `).run(fromUserId, -amount, `Transferido para ${toUser.username}`, toUserId);
  
  // Credita
  db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, toUserId);
  db.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, description, related_user_id)
    VALUES (?, 'transfer_in', ?, ?, ?)
  `).run(toUserId, amount, `Recebido de ${fromUser.username}`, fromUserId);
  
  return { from: getUserById(fromUserId), to: getUserById(toUserId) };
}

export function getCreditHistory(userId, limit = 50) {
  return db.prepare(`
    SELECT * FROM credit_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);
}

// ==========================================
// PREÇOS
// ==========================================

export function setPrice(provider, packageId, role, price) {
  db.prepare(`
    INSERT INTO prices (provider, package_id, role, price)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider, package_id, role) DO UPDATE SET price = excluded.price
  `).run(provider, packageId, role, price);
}

export function getPrice(provider, packageId, role) {
  return db.prepare(`
    SELECT price FROM prices WHERE provider = ? AND package_id = ? AND role = ?
  `).get(provider, packageId, role)?.price;
}

export function getPricesByProvider(provider) {
  return db.prepare(`
    SELECT package_id, role, price FROM prices WHERE provider = ?
  `).all(provider);
}

// ==========================================
// STATS
// ==========================================

export function getStats() {
  const users = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
  const totalCredits = db.prepare('SELECT SUM(credits) as total FROM users').get();
  
  return {
    users: Object.fromEntries(users.map(u => [u.role, u.count])),
    totalCredits: totalCredits.total || 0
  };
}

export default {
  createUser,
  getUserByUsername,
  getUserById,
  updateUser,
  deleteUser,
  listUsers,
  verifyPassword,
  canCreateRole,
  getSubordinateUsers,
  getAllSubordinates,
  addCredits,
  useCredits,
  transferCredits,
  getCreditHistory,
  setPrice,
  getPrice,
  getPricesByProvider,
  getStats,
  ROLE_LEVELS,
  ROLE_CAN_CREATE
};
