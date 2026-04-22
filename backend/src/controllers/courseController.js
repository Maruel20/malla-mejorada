import { pool } from '../config/db.js';
import { ok, fail } from '../utils/http.js';

export async function listCourses(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.code, c.name, c.semester, c.credits, c.area,
              GROUP_CONCAT(p.prerequisite_code ORDER BY p.prerequisite_code SEPARATOR ',') AS prerequisites
       FROM courses c
       LEFT JOIN prerequisites p ON p.course_code = c.code
       GROUP BY c.code, c.name, c.semester, c.credits, c.area
       ORDER BY c.semester, c.code`
    );

    const courses = rows.map((row) => ({
      ...row,
      prerequisites: row.prerequisites ? row.prerequisites.split(',') : []
    }));

    return ok(res, { courses });
  } catch (error) {
    return fail(res, 'Error al listar materias.', 500, { error: error.message });
  }
}

export async function searchCourses(req, res) {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const [rows] = await pool.query(
      `SELECT code, name, semester, credits, area FROM courses
       WHERE code LIKE ? OR name LIKE ?
       ORDER BY semester, code LIMIT 20`,
      [q, q]
    );
    return ok(res, { courses: rows });
  } catch (error) {
    return fail(res, 'Error al buscar materias.', 500, { error: error.message });
  }
}
