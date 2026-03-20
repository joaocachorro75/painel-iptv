import jwt from 'jsonwebtoken';
import db from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_mudar_em_producao';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Gera token JWT
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verifica token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware de autenticação
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token não fornecido' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
  
  // Carrega usuário completo do banco
  const user = db.getUserById(decoded.id);
  
  if (!user || user.status !== 'active') {
    return res.status(401).json({ success: false, error: 'Usuário não encontrado ou inativo' });
  }
  
  req.user = user;
  next();
}

/**
 * Middleware para verificar se pode criar determinado role
 */
export function canCreateMiddleware(targetRole) {
  return (req, res, next) => {
    if (!db.canCreateRole(req.user.role, targetRole)) {
      return res.status(403).json({ 
        success: false, 
        error: `Seu nível (${req.user.role}) não pode criar usuários do tipo ${targetRole}` 
      });
    }
    next();
  };
}

/**
 * Middleware para verificar nível mínimo
 */
export function roleMiddleware(minRole) {
  const roleLevels = {
    super_admin: 1,
    ultra_master: 2,
    master: 3,
    revenda: 4,
    cliente: 5
  };
  
  return (req, res, next) => {
    const userLevel = roleLevels[req.user.role] || 999;
    const minLevel = roleLevels[minRole] || 999;
    
    if (userLevel > minLevel) {
      return res.status(403).json({ 
        success: false, 
        error: `Acesso negado. Nível mínimo: ${minRole}` 
      });
    }
    next();
  };
}

/**
 * Login
 */
export function login(username, password) {
  const user = db.getUserByUsername(username);
  
  if (!user) {
    throw new Error('Usuário não encontrado');
  }
  
  if (!db.verifyPassword(user, password)) {
    throw new Error('Senha incorreta');
  }
  
  if (user.status !== 'active') {
    throw new Error('Usuário inativo ou bloqueado');
  }
  
  const token = generateToken(user);
  const { password: _, ...userWithoutPassword } = user;
  
  return {
    token,
    user: userWithoutPassword
  };
}

/**
 * Registro (criar usuário subordinado)
 */
export function register(creatorUser, data) {
  // Verifica se pode criar este tipo de usuário
  if (!db.canCreateRole(creatorUser.role, data.role)) {
    throw new Error(`Seu nível (${creatorUser.role}) não pode criar usuários do tipo ${data.role}`);
  }
  
  // Cria o usuário com parent_id = criador
  const newUser = db.createUser({
    ...data,
    parent_id: creatorUser.id
  });
  
  return newUser;
}

export default {
  generateToken,
  verifyToken,
  authMiddleware,
  canCreateMiddleware,
  roleMiddleware,
  login,
  register
};
