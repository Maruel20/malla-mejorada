import { pool } from '../config/db.js';
import { ok, fail } from '../utils/http.js';
import {
  approveCourseForStudent,
  getCurriculumForStudent,
  removeApprovedCourse
} from '../services/curriculumService.js';

export async function listStudents(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, document_number, created_at
       FROM students
       ORDER BY full_name`
    );
    return ok(res, { students: rows });
  } catch (error) {
    return fail(res, 'Error al listar estudiantes.', 500, { error: error.message });
  }
}

export async function createStudent(req, res) {
  try {
    const { full_name, document_number } = req.body;

    if (!full_name || !document_number) {
      return fail(res, 'full_name y document_number son obligatorios.');
    }

    const [result] = await pool.query(
      `INSERT INTO students (full_name, document_number) VALUES (?, ?)`,
      [full_name.trim(), document_number.trim()]
    );

    const [rows] = await pool.query(`SELECT id, full_name, document_number FROM students WHERE id = ?`, [result.insertId]);
    return ok(res, { student: rows[0], message: 'Estudiante creado correctamente.' }, 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return fail(res, 'Ya existe un estudiante con ese documento.', 409);
    }
    return fail(res, 'Error al crear estudiante.', 500, { error: error.message });
  }
}

export async function getStudentCurriculum(req, res) {
  try {
    const studentId = Number(req.params.id);

    const [studentRows] = await pool.query(`SELECT id, full_name, document_number FROM students WHERE id = ?`, [studentId]);
    if (studentRows.length === 0) {
      return fail(res, 'Estudiante no encontrado.', 404);
    }

    const data = await getCurriculumForStudent(studentId);
    return ok(res, { student: studentRows[0], ...data });
  } catch (error) {
    return fail(res, 'Error al consultar la malla del estudiante.', 500, { error: error.message });
  }
}

export async function approveCourse(req, res) {
  try {
    const studentId = Number(req.params.id);
    const { course_code, grade } = req.body;

    if (!course_code) {
      return fail(res, 'course_code es obligatorio.');
    }
    
    const numericGrade = parseFloat(grade);
    if (isNaN(numericGrade) || numericGrade < 1.0 || numericGrade > 5.0) {
      return fail(res, 'La nota debe ser un número entre 1.0 y 5.0', 400);
    }

    const result = await approveCourseForStudent(studentId, course_code, numericGrade);
    if (!result.valid) {
      return fail(res, result.message, result.status, {
        missingPrerequisites: result.missingPrerequisites || []
      });
    }

    const updated = await getCurriculumForStudent(studentId);
    return ok(res, { message: result.message, ...updated });
  } catch (error) {
    return fail(res, 'Error al procesar la materia.', 500, { error: error.message });
  }
}

export async function deleteApprovedCourse(req, res) {
  try {
    const studentId = Number(req.params.id);
    const courseCode = req.params.courseCode;

    const result = await removeApprovedCourse(studentId, courseCode);
    if (!result.valid) {
      return fail(res, result.message, result.status, {
        dependentCourses: result.dependentCourses || []
      });
    }

    const updated = await getCurriculumForStudent(studentId);
    return ok(res, { message: result.message, ...updated });
  } catch (error) {
    return fail(res, 'Error al eliminar materia aprobada.', 500, { error: error.message });
  }
}
