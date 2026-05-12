import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import { pool } from '../config/db.js';

const SECRET = process.env.JWT_SECRET || 'malla_jwt_secret_2024';
const token  = p => jwt.sign(p, SECRET, { expiresIn: '7d' });

export async function registrar(req, res) {
  const { nombre, apellido, cedula, password } = req.body;
  if (!nombre || !apellido || !cedula || !password)
    return res.status(400).json({ ok: false, msg: 'Todos los campos son obligatorios.' });
  if (password.length < 6)
    return res.status(400).json({ ok: false, msg: 'La contraseña debe tener mínimo 6 caracteres.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [r] = await conn.query(
        'INSERT INTO students (nombre, apellido, cedula, password_hash) VALUES (?,?,?,?)',
        [nombre.trim(), apellido.trim(), cedula.trim(), hash]
      );
      const sid = r.insertId;

      // Auto-matricular semestre 1
      const SEM1 = ['453007','453058','453001','453004','453005','453003','453002'];
      for (const c of SEM1) {
        await conn.query('INSERT INTO student_courses (student_id, codigo) VALUES (?,?)', [sid, c]);
      }

      await conn.commit();
      const estudiante = { id: sid, nombre, apellido, cedula };
      return res.status(201).json({ ok: true, estudiante, token: token({ id: sid, cedula }), msg: 'Registro exitoso. Semestre 1 matriculado automáticamente.' });
    } catch (e) {
      await conn.rollback(); throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ ok: false, msg: 'Ya existe un estudiante con esa cédula.' });
    return res.status(500).json({ ok: false, msg: 'Error al registrar.', error: e.message });
  }
}

export async function login(req, res) {
  const { cedula, password } = req.body;
  if (!cedula || !password)
    return res.status(400).json({ ok: false, msg: 'Cédula y contraseña son obligatorias.' });

  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, apellido, cedula, password_hash FROM students WHERE cedula = ?',
      [cedula.trim()]
    );
    if (!rows.length)
      return res.status(401).json({ ok: false, msg: 'Cédula o contraseña incorrectos.' });

    const s = rows[0];
    const valido = await bcrypt.compare(password, s.password_hash);
    if (!valido)
      return res.status(401).json({ ok: false, msg: 'Cédula o contraseña incorrectos.' });

    const { password_hash, ...est } = s;
    return res.json({ ok: true, estudiante: est, token: token({ id: s.id, cedula: s.cedula }) });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Error al iniciar sesión.', error: e.message });
  }
}

export function verificarToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const tk   = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!tk) return res.status(401).json({ ok: false, msg: 'Token requerido.' });
  try {
    req.user = jwt.verify(tk, SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, msg: 'Token inválido o expirado.' });
  }
}

export async function perfil(req, res) {
  const [rows] = await pool.query(
    'SELECT id, nombre, apellido, cedula FROM students WHERE id = ?', [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ ok: false, msg: 'Estudiante no encontrado.' });
  return res.json({ ok: true, estudiante: rows[0] });
}
