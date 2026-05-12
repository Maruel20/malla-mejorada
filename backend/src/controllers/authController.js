import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { ok, fail } from '../utils/http.js';
import { signToken } from '../middleware/auth.js';

const SEMESTER1_CODES = ['453007', '453058', '453001', '453004', '453005', '453003', '453002'];

export async function register(req, res) {
  try {
    const { first_name, last_name, document_number, password } = req.body;

    if (!first_name || !last_name || !document_number || !password) {
      return fail(res, 'Todos los campos son obligatorios.');
    }
    if (password.length < 6) {
      return fail(res, 'La contraseña debe tener al menos 6 caracteres.');
    }

    const password_hash = await bcrypt.hash(password, 10);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO students (first_name, last_name, document_number, password_hash)
         VALUES (?, ?, ?, ?)`,
        [first_name.trim(), last_name.trim(), document_number.trim(), password_hash]
      );

      const studentId = result.insertId;

      // Auto-enroll semester 1 courses
      const insertValues = SEMESTER1_CODES.map(code => [studentId, code]);
      await conn.query(
        `INSERT INTO student_courses (student_id, course_code) VALUES ?`,
        [insertValues]
      );

      await conn.commit();

      const [rows] = await conn.query(
        `SELECT id, first_name, last_name, document_number FROM students WHERE id = ?`,
        [studentId]
      );
      const student = rows[0];
      const token = signToken({ id: studentId, document_number: student.document_number });

      return ok(res, { student, token, message: 'Registro exitoso. Semestre 1 matriculado automáticamente.' }, 201);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return fail(res, 'Ya existe un estudiante con esa cédula.', 409);
    }
    return fail(res, 'Error al registrar estudiante.', 500, { error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { document_number, password } = req.body;

    if (!document_number || !password) {
      return fail(res, 'Cédula y contraseña son obligatorios.');
    }

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, document_number, password_hash
       FROM students WHERE document_number = ?`,
      [document_number.trim()]
    );

    if (!rows.length) {
      return fail(res, 'Cédula o contraseña incorrectos.', 401);
    }

    const student = rows[0];
    const valid = await bcrypt.compare(password, student.password_hash);
    if (!valid) {
      return fail(res, 'Cédula o contraseña incorrectos.', 401);
    }

    const token = signToken({ id: student.id, document_number: student.document_number });
    const { password_hash, ...studentData } = student;

    return ok(res, { student: studentData, token, message: 'Inicio de sesión exitoso.' });
  } catch (error) {
    return fail(res, 'Error al iniciar sesión.', 500, { error: error.message });
  }
}

export async function me(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, document_number, role FROM students WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return fail(res, 'Estudiante no encontrado.', 404);
    return ok(res, { student: rows[0] });
  } catch (error) {
    return fail(res, 'Error al obtener perfil.', 500, { error: error.message });
  }
}
