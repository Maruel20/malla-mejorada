import { pool } from '../config/db.js';

// Ahora traemos las notas exactas del estudiante
async function getStudentGrades(studentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT course_code, grade FROM student_courses WHERE student_id = ?`,
    [studentId]
  );
  const map = new Map();
  rows.forEach((row) => map.set(row.course_code, Number(row.grade)));
  return map;
}

async function getPrerequisitesMap(connection = pool) {
  const [rows] = await connection.query(`SELECT course_code, prerequisite_code FROM prerequisites`);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.course_code)) map.set(row.course_code, []);
    map.get(row.course_code).push(row.prerequisite_code);
  }
  return map;
}

async function getCourses(connection = pool) {
  const [rows] = await connection.query(
    `SELECT c.code, c.name, c.semester, c.credits, c.area,
            GROUP_CONCAT(p.prerequisite_code ORDER BY p.prerequisite_code SEPARATOR ',') AS prerequisites
     FROM courses c
     LEFT JOIN prerequisites p ON p.course_code = c.code
     GROUP BY c.code, c.name, c.semester, c.credits, c.area
     ORDER BY c.semester, c.code`
  );
  return rows.map((row) => ({
    ...row,
    prerequisites: row.prerequisites ? row.prerequisites.split(',') : []
  }));
}

function computeCourseStatus(course, gradesMap) {
  const grade = gradesMap.get(course.code);
  const isApproved = grade !== undefined && grade >= 3.0;

  // Un prerrequisito está cumplido SOLO si tiene nota y es >= 3.0
  const missingPrerequisites = course.prerequisites.filter((code) => {
    const pGrade = gradesMap.get(code);
    return pGrade === undefined || pGrade < 3.0;
  });

  let status = 'blocked';
  if (isApproved) {
    status = 'approved';
  } else if (grade !== undefined && grade < 3.0) {
    status = 'failed'; // Perdida, se debe repetir
  } else if (missingPrerequisites.length === 0) {
    status = 'available';
  }

  return { ...course, status, grade, missingPrerequisites };
}

export async function getCurriculumForStudent(studentId) {
  const gradesMap = await getStudentGrades(studentId);
  const courses = await getCourses();
  const evaluatedCourses = courses.map((course) => computeCourseStatus(course, gradesMap));

  const summary = {
    approved: evaluatedCourses.filter((c) => c.status === 'approved').length,
    failed: evaluatedCourses.filter((c) => c.status === 'failed').length,
    available: evaluatedCourses.filter((c) => c.status === 'available').length,
    blocked: evaluatedCourses.filter((c) => c.status === 'blocked').length
  };

  // Convertir a array de materias aprobadas para compatibilidad del front
  const approvedCodes = evaluatedCourses.filter(c => c.status === 'approved').map(c => c.code);

  return { approvedCodes, courses: evaluatedCourses, summary };
}

export async function validateCanApproveCourse(studentId, courseCode, connection = pool) {
  const [courseRows] = await connection.query(`SELECT code, name FROM courses WHERE code = ?`, [courseCode]);
  if (courseRows.length === 0) {
    return { valid: false, status: 404, message: 'La materia no existe.' };
  }

  // Si ya está aprobada (>=3.0), no la puede volver a registrar
  const gradesMap = await getStudentGrades(studentId, connection);
  const currentGrade = gradesMap.get(courseCode);
  if (currentGrade !== undefined && currentGrade >= 3.0) {
    return { valid: false, status: 409, message: 'La materia ya está aprobada.' };
  }

  const prerequisitesMap = await getPrerequisitesMap(connection);
  const prerequisites = prerequisitesMap.get(courseCode) || [];
  
  // Validar si faltan prerrequisitos (o si los perdieron)
  const missing = prerequisites.filter((code) => {
    const pGrade = gradesMap.get(code);
    return pGrade === undefined || pGrade < 3.0;
  });

  if (missing.length > 0) {
    const [missingRows] = await connection.query(
      `SELECT code, name FROM courses WHERE code IN (${missing.map(() => '?').join(',')}) ORDER BY semester, code`,
      missing
    );
    return {
      valid: false,
      status: 400,
      message: 'Todavía le faltan prerrequisitos o tiene prerrequisitos perdidos.',
      missingPrerequisites: missingRows
    };
  }

  return { valid: true, course: courseRows[0] };
}

export async function approveCourseForStudent(studentId, courseCode, grade) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const validation = await validateCanApproveCourse(studentId, courseCode, connection);
    if (!validation.valid) {
      await connection.rollback();
      return validation;
    }

    // ON DUPLICATE KEY UPDATE: Si el estudiante repite la materia, se actualiza la nota
    await connection.query(
      `INSERT INTO student_courses (student_id, course_code, grade) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), approved_at = CURRENT_TIMESTAMP`,
      [studentId, courseCode, grade]
    );

    await connection.commit();
    return { valid: true, message: grade >= 3.0 ? 'Materia aprobada registrada.' : 'Materia perdida registrada.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeApprovedCourse(studentId, courseCode) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const gradesMap = await getStudentGrades(studentId, connection);
    if (!gradesMap.has(courseCode)) {
      await connection.rollback();
      return { valid: false, status: 404, message: 'La materia no está registrada para este estudiante.' };
    }

    // Comprobar si hay materias aprobadas que dependan de esta
    const [dependentRows] = await connection.query(
      `SELECT c.code, c.name
       FROM prerequisites p
       INNER JOIN student_courses sc ON sc.course_code = p.course_code AND sc.student_id = ?
       INNER JOIN courses c ON c.code = p.course_code
       WHERE p.prerequisite_code = ? AND sc.grade >= 3.0`,
      [studentId, courseCode]
    );

    if (dependentRows.length > 0) {
      await connection.rollback();
      return {
        valid: false,
        status: 400,
        message: 'No se puede quitar esta materia porque hay otras aprobadas que dependen de ella.',
        dependentCourses: dependentRows
      };
    }

    await connection.query(
      `DELETE FROM student_courses WHERE student_id = ? AND course_code = ?`,
      [studentId, courseCode]
    );

    await connection.commit();
    return { valid: true, message: 'Materia removida del historial del estudiante.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}