import { pool } from '../config/db.js';
import { ok, fail } from '../utils/http.js';
import {
  getCurriculumForStudent,
  enrollSemesterCourses,
  setGrade,
  removeEnrollment
} from '../services/curriculumService.js';

export async function listStudents(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, document_number, role, created_at
       FROM students ORDER BY last_name, first_name`
    );
    return ok(res, { students: rows });
  } catch (error) {
    return fail(res, 'Error al listar estudiantes.', 500, { error: error.message });
  }
}

export async function getStudentCurriculum(req, res) {
  try {
    const studentId = Number(req.params.id);

    const [studentRows] = await pool.query(
      `SELECT id, first_name, last_name, document_number FROM students WHERE id = ?`,
      [studentId]
    );
    if (!studentRows.length) return fail(res, 'Estudiante no encontrado.', 404);

    const data = await getCurriculumForStudent(studentId);
    return ok(res, { student: studentRows[0], ...data });
  } catch (error) {
    return fail(res, 'Error al consultar la malla.', 500, { error: error.message });
  }
}

export async function enrollSemester(req, res) {
  try {
    const studentId   = Number(req.params.id);
    const { semester, course_codes } = req.body;

    if (!semester || !Array.isArray(course_codes)) {
      return fail(res, 'semester y course_codes[] son obligatorios.');
    }

    const result = await enrollSemesterCourses(studentId, Number(semester), course_codes);
    if (!result.valid) return fail(res, result.message, result.status);

    const updated = await getCurriculumForStudent(studentId);
    const [studentRows] = await pool.query(
      `SELECT id, first_name, last_name, document_number FROM students WHERE id = ?`,
      [studentId]
    );
    return ok(res, { message: result.message, student: studentRows[0], ...updated });
  } catch (error) {
    return fail(res, 'Error al matricular semestre.', 500, { error: error.message });
  }
}

export async function updateGrade(req, res) {
  try {
    const studentId  = Number(req.params.id);
    const courseCode = req.params.code;
    const { grade }  = req.body;

    const numericGrade = parseFloat(grade);
    if (isNaN(numericGrade) || numericGrade < 1.0 || numericGrade > 5.0) {
      return fail(res, 'La nota debe ser entre 1.0 y 5.0', 400);
    }

    const result = await setGrade(studentId, courseCode, numericGrade);
    if (!result.valid) return fail(res, result.message, result.status);

    const updated = await getCurriculumForStudent(studentId);
    const [studentRows] = await pool.query(
      `SELECT id, first_name, last_name, document_number FROM students WHERE id = ?`,
      [studentId]
    );
    return ok(res, { message: result.message, student: studentRows[0], ...updated });
  } catch (error) {
    return fail(res, 'Error al actualizar nota.', 500, { error: error.message });
  }
}

export async function deleteCourse(req, res) {
  try {
    const studentId  = Number(req.params.id);
    const courseCode = req.params.code;

    const result = await removeEnrollment(studentId, courseCode);
    if (!result.valid) {
      return fail(res, result.message, result.status, {
        dependentCourses: result.dependentCourses || []
      });
    }

    const updated = await getCurriculumForStudent(studentId);
    const [studentRows] = await pool.query(
      `SELECT id, first_name, last_name, document_number FROM students WHERE id = ?`,
      [studentId]
    );
    return ok(res, { message: result.message, student: studentRows[0], ...updated });
  } catch (error) {
    return fail(res, 'Error al eliminar materia.', 500, { error: error.message });
  }
}
