import { pool } from '../config/db.js';

const MIN_CR = 12;
const MAX_CR = 20;

// ─── helpers ────────────────────────────────────────────────────────────────

async function getNotas(studentId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT codigo, nota FROM student_courses WHERE student_id = ?', [studentId]
  );
  // Map codigo → nota (number | null)
  const m = new Map();
  rows.forEach(r => m.set(r.codigo, r.nota === null ? null : Number(r.nota)));
  return m;
}

async function getPrereqs(conn = pool) {
  const [rows] = await conn.query('SELECT codigo_materia, codigo_prereq FROM prerequisites');
  const m = new Map();
  rows.forEach(r => {
    if (!m.has(r.codigo_materia)) m.set(r.codigo_materia, []);
    m.get(r.codigo_materia).push(r.codigo_prereq);
  });
  return m;
}

async function getMaterias(conn = pool) {
  const [rows] = await conn.query(`
    SELECT c.codigo, c.nombre, c.semestre, c.creditos, c.area,
           GROUP_CONCAT(p.codigo_prereq ORDER BY p.codigo_prereq SEPARATOR ',') AS prereqs
    FROM courses c
    LEFT JOIN prerequisites p ON p.codigo_materia = c.codigo
    GROUP BY c.codigo, c.nombre, c.semestre, c.creditos, c.area
    ORDER BY c.semestre, c.codigo
  `);
  return rows.map(r => ({ ...r, prereqs: r.prereqs ? r.prereqs.split(',') : [] }));
}

// Semestres desbloqueados: sem 1 siempre; sem N si sem N-1 tiene ≥12 cr aprobados
function semestresDesbloqueados(materias, notas) {
  const aprobCr = new Map();
  materias.forEach(m => {
    const n = notas.get(m.codigo);
    if (n !== null && n !== undefined && n >= 3.0)
      aprobCr.set(m.semestre, (aprobCr.get(m.semestre) || 0) + m.creditos);
  });
  const ok = new Set([1]);
  for (let s = 2; s <= 10; s++) {
    if ((aprobCr.get(s - 1) || 0) >= MIN_CR) ok.add(s);
    else break;
  }
  return ok;
}

function calcStatus(materia, notas, semDesbloq) {
  const nota = notas.get(materia.codigo);
  const matriculada = notas.has(materia.codigo);

  if (!semDesbloq.has(materia.semestre)) return { estado: 'bloqueado_sem', nota: undefined, faltanPrereqs: [] };

  if (matriculada) {
    if (nota === null) return { estado: 'matriculada', nota: null, faltanPrereqs: [] };
    return { estado: nota >= 3.0 ? 'aprobada' : 'reprobada', nota, faltanPrereqs: [] };
  }

  const faltan = materia.prereqs.filter(c => {
    const pn = notas.get(c);
    return pn === undefined || pn === null || pn < 3.0;
  });
  return { estado: faltan.length === 0 ? 'disponible' : 'bloqueada', nota: undefined, faltanPrereqs: faltan };
}

// ─── exports ─────────────────────────────────────────────────────────────────

export async function getMallaEstudiante(studentId) {
  const [notas, materias] = await Promise.all([getNotas(studentId), getMaterias()]);
  const semDesbloq = semestresDesbloqueados(materias, notas);

  const items = materias.map(m => {
    const { estado, nota, faltanPrereqs } = calcStatus(m, notas, semDesbloq);
    return { ...m, estado, nota, faltanPrereqs };
  });

  // Estadísticas por semestre
  const statsSem = {};
  materias.forEach(m => {
    if (!statsSem[m.semestre]) statsSem[m.semestre] = { total: 0, aprobados: 0 };
    statsSem[m.semestre].total += m.creditos;
    const n = notas.get(m.codigo);
    if (n !== null && n !== undefined && n >= 3.0) statsSem[m.semestre].aprobados += m.creditos;
  });

  const resumen = {
    aprobadas:   items.filter(x => x.estado === 'aprobada').length,
    reprobadas:  items.filter(x => x.estado === 'reprobada').length,
    matriculadas:items.filter(x => x.estado === 'matriculada').length,
    disponibles: items.filter(x => x.estado === 'disponible').length,
    bloqueadas:  items.filter(x => x.estado === 'bloqueada').length,
  };

  // Promedio ponderado
  let sumNotas = 0, sumCr = 0;
  items.forEach(m => {
    if (m.nota !== null && m.nota !== undefined) { sumNotas += m.nota * m.creditos; sumCr += m.creditos; }
  });
  const promedio = sumCr > 0 ? parseFloat((sumNotas / sumCr).toFixed(2)) : 0;

  return {
    materias: items,
    resumen,
    semestresDesbloqueados: [...semDesbloq].sort((a, b) => a - b),
    statsSem,
    promedio,
  };
}

export async function matricularSemestre(studentId, semestre, codigos) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [notas, materias] = await Promise.all([getNotas(studentId, conn), getMaterias(conn)]);
    const semDesbloq = semestresDesbloqueados(materias, notas);

    if (!semDesbloq.has(semestre))
      return { ok: false, status: 403, msg: `El semestre ${semestre} aún no está desbloqueado.` };

    const matSem = materias.filter(m => m.semestre === semestre && codigos.includes(m.codigo));
    if (matSem.length !== codigos.length)
      return { ok: false, status: 400, msg: 'Algunos códigos no pertenecen a este semestre.' };

    const totalCr = matSem.reduce((s, m) => s + m.creditos, 0);
    if (totalCr < MIN_CR) return { ok: false, status: 400, msg: `Mínimo ${MIN_CR} créditos. Seleccionaste ${totalCr}.` };
    if (totalCr > MAX_CR) return { ok: false, status: 400, msg: `Máximo ${MAX_CR} créditos. Seleccionaste ${totalCr}.` };

    const prereqs = await getPrereqs(conn);
    for (const m of matSem) {
      const ps = prereqs.get(m.codigo) || [];
      const faltan = ps.filter(c => { const n = notas.get(c); return n === undefined || n === null || n < 3.0; });
      if (faltan.length) return { ok: false, status: 400, msg: `${m.nombre}: faltan prerrequisitos (${faltan.join(', ')})` };
    }

    for (const m of matSem) {
      await conn.query(
        'INSERT IGNORE INTO student_courses (student_id, codigo) VALUES (?, ?)',
        [studentId, m.codigo]
      );
    }

    await conn.commit();
    return { ok: true, msg: `Semestre ${semestre} matriculado con ${totalCr} créditos.` };
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
}

export async function guardarNota(studentId, codigo, nota) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cr] = await conn.query('SELECT codigo, semestre FROM courses WHERE codigo = ?', [codigo]);
    if (!cr.length) return { ok: false, status: 404, msg: 'Materia no encontrada.' };

    const notas = await getNotas(studentId, conn);
    const materias = await getMaterias(conn);
    const semDesbloq = semestresDesbloqueados(materias, notas);

    if (!semDesbloq.has(cr[0].semestre))
      return { ok: false, status: 403, msg: `Semestre ${cr[0].semestre} no desbloqueado.` };

    // Verificar prerrequisitos
    const prereqs = await getPrereqs(conn);
    const ps = prereqs.get(codigo) || [];
    const faltan = ps.filter(c => { const n = notas.get(c); return n === undefined || n === null || n < 3.0; });
    if (faltan.length) return { ok: false, status: 400, msg: `Faltan prerrequisitos: ${faltan.join(', ')}` };

    // Auto-matricular si no existe + poner nota
    await conn.query(
      `INSERT INTO student_courses (student_id, codigo, nota) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE nota = VALUES(nota), actualizado = CURRENT_TIMESTAMP`,
      [studentId, codigo, nota]
    );

    await conn.commit();
    return { ok: true, msg: nota >= 3.0 ? 'Materia aprobada.' : 'Materia reprobada registrada.' };
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
}

export async function quitarMateria(studentId, codigo) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const notas = await getNotas(studentId, conn);
    if (!notas.has(codigo)) return { ok: false, status: 404, msg: 'Materia no registrada.' };

    // No quitar si hay materias aprobadas que dependen de esta
    const [deps] = await conn.query(
      `SELECT c.codigo, c.nombre
       FROM prerequisites p
       JOIN student_courses sc ON sc.codigo = p.codigo_materia AND sc.student_id = ?
       JOIN courses c ON c.codigo = p.codigo_materia
       WHERE p.codigo_prereq = ? AND sc.nota >= 3.0`,
      [studentId, codigo]
    );
    if (deps.length)
      return { ok: false, status: 400, msg: 'No se puede quitar: hay materias aprobadas que dependen de esta.', deps };

    await conn.query('DELETE FROM student_courses WHERE student_id = ? AND codigo = ?', [studentId, codigo]);
    await conn.commit();
    return { ok: true, msg: 'Materia removida.' };
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
}
