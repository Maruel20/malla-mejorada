import { pool } from '../config/db.js';

const MIN_CREDITS_TO_ADVANCE = 12;
const MIN_ENROLL_CREDITS     = 12;
const MAX_ENROLL_CREDITS     = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getStudentEnrollments(studentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT course_code, grade FROM student_courses WHERE student_id = ?`,
    [studentId]
  );
  // Map: code → { grade: number|null }
  const map = new Map();
  rows.forEach(r => map.set(r.course_code, { grade: r.grade === null ? null : Number(r.grade) }));
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

async function getAllCourses(connection = pool) {
  const [rows] = await connection.query(
    `SELECT c.code, c.name, c.semester, c.credits, c.area,
            GROUP_CONCAT(p.prerequisite_code ORDER BY p.prerequisite_code SEPARATOR ',') AS prerequisites
     FROM courses c
     LEFT JOIN prerequisites p ON p.course_code = c.code
     GROUP BY c.code, c.name, c.semester, c.credits, c.area
     ORDER BY c.semester, c.code`
  );
  return rows.map(r => ({
    ...r,
    prerequisites: r.prerequisites ? r.prerequisites.split(',') : []
  }));
}

// ── Semester unlock logic ─────────────────────────────────────────────────────

function computeUnlockedSemesters(courses, enrollments) {
  // Group approved credits by curriculum semester
  const approvedBySem = new Map();
  courses.forEach(c => {
    const entry = enrollments.get(c.code);
    const isApproved = entry && entry.grade !== null && entry.grade >= 3.0;
    if (isApproved) {
      approvedBySem.set(c.semester, (approvedBySem.get(c.semester) || 0) + c.credits);
    }
  });

  const unlocked = new Set([1]);
  for (let sem = 2; sem <= 10; sem++) {
    const prevApproved = approvedBySem.get(sem - 1) || 0;
    if (prevApproved >= MIN_CREDITS_TO_ADVANCE) {
      unlocked.add(sem);
    } else {
      break; // don't unlock semesters beyond first gap
    }
  }
  return unlocked;
}

function computeCourseStatus(course, enrollments, unlockedSemesters) {
  const entry = enrollments.get(course.code);
  const isEnrolled = entry !== undefined;
  const grade = entry ? entry.grade : undefined;

  if (!unlockedSemesters.has(course.semester)) {
    return { status: 'semester-locked', grade: undefined, missingPrerequisites: [] };
  }

  if (isEnrolled) {
    if (grade === null || grade === undefined) {
      return { status: 'enrolled', grade: null, missingPrerequisites: [] };
    }
    return {
      status: grade >= 3.0 ? 'approved' : 'failed',
      grade,
      missingPrerequisites: []
    };
  }

  // Not enrolled — check prerequisites
  const missing = course.prerequisites.filter(code => {
    const prereqEntry = enrollments.get(code);
    return !prereqEntry || prereqEntry.grade === null || prereqEntry.grade < 3.0;
  });

  return {
    status: missing.length === 0 ? 'available' : 'blocked',
    grade: undefined,
    missingPrerequisites: missing
  };
}

// ── Exported service functions ────────────────────────────────────────────────

export async function getCurriculumForStudent(studentId) {
  const [enrollments, courses] = await Promise.all([
    getStudentEnrollments(studentId),
    getAllCourses()
  ]);

  const unlockedSemesters = computeUnlockedSemesters(courses, enrollments);

  const evaluated = courses.map(course => {
    const { status, grade, missingPrerequisites } = computeCourseStatus(course, enrollments, unlockedSemesters);
    return { ...course, status, grade, missingPrerequisites };
  });

  // Per-semester stats
  const semesterStats = {};
  courses.forEach(c => {
    if (!semesterStats[c.semester]) {
      semesterStats[c.semester] = { total: 0, approvedCredits: 0, enrolledCount: 0 };
    }
    semesterStats[c.semester].total += c.credits;
    const entry = enrollments.get(c.code);
    if (entry) semesterStats[c.semester].enrolledCount++;
    if (entry && entry.grade !== null && entry.grade >= 3.0) {
      semesterStats[c.semester].approvedCredits += c.credits;
    }
  });

  const summary = {
    approved:       evaluated.filter(c => c.status === 'approved').length,
    failed:         evaluated.filter(c => c.status === 'failed').length,
    enrolled:       evaluated.filter(c => c.status === 'enrolled').length,
    available:      evaluated.filter(c => c.status === 'available').length,
    blocked:        evaluated.filter(c => c.status === 'blocked').length,
    semesterLocked: evaluated.filter(c => c.status === 'semester-locked').length
  };

  // Weighted GPA
  let weightedSum = 0, creditsTried = 0;
  evaluated.forEach(c => {
    if (c.grade !== null && c.grade !== undefined) {
      weightedSum  += c.grade * c.credits;
      creditsTried += c.credits;
    }
  });
  const gpa = creditsTried > 0 ? (weightedSum / creditsTried) : 0;

  return {
    courses: evaluated,
    summary,
    unlockedSemesters: [...unlockedSemesters].sort((a, b) => a - b),
    semesterStats,
    gpa: parseFloat(gpa.toFixed(2))
  };
}

export async function enrollSemesterCourses(studentId, semester, courseCodes) {
  if (!Array.isArray(courseCodes) || courseCodes.length === 0) {
    return { valid: false, status: 400, message: 'Debes seleccionar al menos una materia.' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify semester is unlocked
    const enrollments = await getStudentEnrollments(studentId, conn);
    const courses     = await getAllCourses(conn);
    const unlocked    = computeUnlockedSemesters(courses, enrollments);

    if (!unlocked.has(semester)) {
      await conn.rollback();
      return { valid: false, status: 403, message: `El semestre ${semester} aún no está desbloqueado.` };
    }

    // Get the requested courses and validate they belong to this semester
    const semCourses = courses.filter(c => c.semester === semester && courseCodes.includes(c.code));
    if (semCourses.length !== courseCodes.length) {
      await conn.rollback();
      return { valid: false, status: 400, message: 'Algunos códigos no pertenecen a este semestre.' };
    }

    // Credit validation
    const totalCredits = semCourses.reduce((s, c) => s + c.credits, 0);
    if (totalCredits < MIN_ENROLL_CREDITS) {
      await conn.rollback();
      return { valid: false, status: 400, message: `Debes matricular mínimo ${MIN_ENROLL_CREDITS} créditos. Seleccionaste ${totalCredits}.` };
    }
    if (totalCredits > MAX_ENROLL_CREDITS) {
      await conn.rollback();
      return { valid: false, status: 400, message: `No puedes matricular más de ${MAX_ENROLL_CREDITS} créditos. Seleccionaste ${totalCredits}.` };
    }

    // Check prerequisites for each course
    const prereqMap = await getPrerequisitesMap(conn);
    for (const c of semCourses) {
      const prereqs = prereqMap.get(c.code) || [];
      const missing = prereqs.filter(code => {
        const e = enrollments.get(code);
        return !e || e.grade === null || e.grade < 3.0;
      });
      if (missing.length > 0) {
        await conn.rollback();
        return {
          valid: false,
          status: 400,
          message: `La materia ${c.name} tiene prerrequisitos pendientes: ${missing.join(', ')}`
        };
      }
    }

    // Insert enrollments (ignore already enrolled)
    const values = semCourses.map(c => [studentId, c.code]);
    await conn.query(
      `INSERT IGNORE INTO student_courses (student_id, course_code) VALUES ?`,
      [values]
    );

    await conn.commit();
    return { valid: true, message: `Semestre ${semester} matriculado con ${totalCredits} créditos.`, totalCredits };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function setGrade(studentId, courseCode, grade) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Course must exist
    const [courseRows] = await conn.query(`SELECT code, name FROM courses WHERE code = ?`, [courseCode]);
    if (!courseRows.length) {
      await conn.rollback();
      return { valid: false, status: 404, message: 'Materia no encontrada.' };
    }

    // Must be enrolled
    const [enrolled] = await conn.query(
      `SELECT id FROM student_courses WHERE student_id = ? AND course_code = ?`,
      [studentId, courseCode]
    );
    if (!enrolled.length) {
      await conn.rollback();
      return { valid: false, status: 404, message: 'El estudiante no está matriculado en esta materia.' };
    }

    await conn.query(
      `UPDATE student_courses SET grade = ?, updated_at = CURRENT_TIMESTAMP
       WHERE student_id = ? AND course_code = ?`,
      [grade, studentId, courseCode]
    );

    await conn.commit();
    return { valid: true, message: grade >= 3.0 ? 'Materia aprobada.' : 'Materia reprobada registrada.' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function removeEnrollment(studentId, courseCode) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const enrollments = await getStudentEnrollments(studentId, conn);
    if (!enrollments.has(courseCode)) {
      await conn.rollback();
      return { valid: false, status: 404, message: 'Materia no registrada para este estudiante.' };
    }

    // Check if approved courses depend on this one
    const [dependentRows] = await conn.query(
      `SELECT c.code, c.name
       FROM prerequisites p
       INNER JOIN student_courses sc ON sc.course_code = p.course_code AND sc.student_id = ?
       INNER JOIN courses c ON c.code = p.course_code
       WHERE p.prerequisite_code = ? AND sc.grade >= 3.0`,
      [studentId, courseCode]
    );

    if (dependentRows.length > 0) {
      await conn.rollback();
      return {
        valid: false,
        status: 400,
        message: 'No se puede quitar: hay materias aprobadas que dependen de esta.',
        dependentCourses: dependentRows
      };
    }

    await conn.query(
      `DELETE FROM student_courses WHERE student_id = ? AND course_code = ?`,
      [studentId, courseCode]
    );

    await conn.commit();
    return { valid: true, message: 'Materia removida del historial.' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Legacy helper kept for compatibility
export async function validateCanApproveCourse(studentId, courseCode, connection = pool) {
  const [courseRows] = await connection.query(`SELECT code, name FROM courses WHERE code = ?`, [courseCode]);
  if (!courseRows.length) return { valid: false, status: 404, message: 'La materia no existe.' };

  const enrollments = await getStudentEnrollments(studentId, connection);
  const entry = enrollments.get(courseCode);
  if (entry && entry.grade !== null && entry.grade >= 3.0) {
    return { valid: false, status: 409, message: 'La materia ya está aprobada.' };
  }

  const prereqMap = await getPrerequisitesMap(connection);
  const prereqs   = prereqMap.get(courseCode) || [];
  const missing   = prereqs.filter(code => {
    const e = enrollments.get(code);
    return !e || e.grade === null || e.grade < 3.0;
  });

  if (missing.length > 0) {
    const [missingRows] = await connection.query(
      `SELECT code, name FROM courses WHERE code IN (${missing.map(() => '?').join(',')}) ORDER BY semester, code`,
      missing
    );
    return { valid: false, status: 400, message: 'Faltan prerrequisitos.', missingPrerequisites: missingRows };
  }
  return { valid: true, course: courseRows[0] };
}
