import { pool } from '../config/db.js';

async function getApprovedCourseCodes(studentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT course_code FROM student_approved_courses WHERE student_id = ?`,
    [studentId]
  );
  return new Set(rows.map((row) => row.course_code));
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

function computeCourseStatus(course, approvedSet) {
  const missingPrerequisites = course.prerequisites.filter((code) => !approvedSet.has(code));

  let status = 'blocked';
  if (approvedSet.has(course.code)) {
    status = 'approved';
  } else if (missingPrerequisites.length === 0) {
    status = 'available';
  }

  return {
    ...course,
    status,
    missingPrerequisites
  };
}

export async function getCurriculumForStudent(studentId) {
  const approvedSet = await getApprovedCourseCodes(studentId);
  const courses = await getCourses();
  const evaluatedCourses = courses.map((course) => computeCourseStatus(course, approvedSet));

  const summary = {
    approved: evaluatedCourses.filter((course) => course.status === 'approved').length,
    available: evaluatedCourses.filter((course) => course.status === 'available').length,
    blocked: evaluatedCourses.filter((course) => course.status === 'blocked').length
  };

  return { approvedCodes: [...approvedSet], courses: evaluatedCourses, summary };
}

export async function validateCanApproveCourse(studentId, courseCode, connection = pool) {
  const [courseRows] = await connection.query(`SELECT code, name FROM courses WHERE code = ?`, [courseCode]);
  if (courseRows.length === 0) {
    return { valid: false, status: 404, message: 'La materia no existe.' };
  }

  const [alreadyRows] = await connection.query(
    `SELECT id FROM student_approved_courses WHERE student_id = ? AND course_code = ?`,
    [studentId, courseCode]
  );

  if (alreadyRows.length > 0) {
    return { valid: false, status: 409, message: 'La materia ya está marcada como aprobada.' };
  }

  const prerequisitesMap = await getPrerequisitesMap(connection);
  const approvedSet = await getApprovedCourseCodes(studentId, connection);
  const prerequisites = prerequisitesMap.get(courseCode) || [];
  const missing = prerequisites.filter((code) => !approvedSet.has(code));

  if (missing.length > 0) {
    const [missingRows] = await connection.query(
      `SELECT code, name FROM courses WHERE code IN (${missing.map(() => '?').join(',')}) ORDER BY semester, code`,
      missing
    );

    return {
      valid: false,
      status: 400,
      message: 'No se puede aprobar esta materia porque todavía le faltan prerrequisitos.',
      missingPrerequisites: missingRows
    };
  }

  return { valid: true, course: courseRows[0] };
}

export async function approveCourseForStudent(studentId, courseCode) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const validation = await validateCanApproveCourse(studentId, courseCode, connection);
    if (!validation.valid) {
      await connection.rollback();
      return validation;
    }

    await connection.query(
      `INSERT INTO student_approved_courses (student_id, course_code) VALUES (?, ?)`,
      [studentId, courseCode]
    );

    await connection.commit();
    return { valid: true, message: 'Materia aprobada correctamente.' };
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

    const approvedSet = await getApprovedCourseCodes(studentId, connection);
    if (!approvedSet.has(courseCode)) {
      await connection.rollback();
      return { valid: false, status: 404, message: 'La materia no está aprobada para este estudiante.' };
    }

    const [dependentRows] = await connection.query(
      `SELECT c.code, c.name
       FROM prerequisites p
       INNER JOIN student_approved_courses sac ON sac.course_code = p.course_code AND sac.student_id = ?
       INNER JOIN courses c ON c.code = p.course_code
       WHERE p.prerequisite_code = ?`,
      [studentId, courseCode]
    );

    if (dependentRows.length > 0) {
      await connection.rollback();
      return {
        valid: false,
        status: 400,
        message: 'No se puede quitar esta materia porque hay materias aprobadas que dependen de ella.',
        dependentCourses: dependentRows
      };
    }

    await connection.query(
      `DELETE FROM student_approved_courses WHERE student_id = ? AND course_code = ?`,
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
