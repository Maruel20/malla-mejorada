import jwt from 'jsonwebtoken';
import { fail } from '../utils/http.js';

const JWT_SECRET = process.env.JWT_SECRET || 'malla_curricular_secret_dev_2024';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Autenticación requerida.', 401);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return fail(res, 'Token inválido o expirado.', 401);
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
