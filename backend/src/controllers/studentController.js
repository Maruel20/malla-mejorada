import { pool } from '../config/db.js';
import { getMallaEstudiante, matricularSemestre, guardarNota, quitarMateria } from '../services/curriculumService.js';

async function getEst(id, res) {
  const [r] = await pool.query('SELECT id, nombre, apellido, cedula FROM students WHERE id = ?', [id]);
  if (!r.length) { res.status(404).json({ ok: false, msg: 'Estudiante no encontrado.' }); return null; }
  return r[0];
}

export async function malla(req, res) {
  try {
    const est = await getEst(Number(req.params.id), res);
    if (!est) return;
    const data = await getMallaEstudiante(est.id);
    res.json({ ok: true, estudiante: est, ...data });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

export async function matricular(req, res) {
  try {
    const est = await getEst(Number(req.params.id), res);
    if (!est) return;
    const { semestre, codigos } = req.body;
    if (!semestre || !Array.isArray(codigos) || !codigos.length)
      return res.status(400).json({ ok: false, msg: 'semestre y codigos[] son obligatorios.' });
    const r = await matricularSemestre(est.id, Number(semestre), codigos);
    if (!r.ok) return res.status(r.status).json({ ok: false, msg: r.msg });
    const data = await getMallaEstudiante(est.id);
    res.json({ ok: true, msg: r.msg, estudiante: est, ...data });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

export async function putNota(req, res) {
  try {
    const est = await getEst(Number(req.params.id), res);
    if (!est) return;
    const nota = parseFloat(req.body.nota);
    if (isNaN(nota) || nota < 1.0 || nota > 5.0)
      return res.status(400).json({ ok: false, msg: 'La nota debe ser entre 1.0 y 5.0' });
    const r = await guardarNota(est.id, req.params.codigo, nota);
    if (!r.ok) return res.status(r.status).json({ ok: false, msg: r.msg });
    const data = await getMallaEstudiante(est.id);
    res.json({ ok: true, msg: r.msg, estudiante: est, ...data });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

export async function deleteMateria(req, res) {
  try {
    const est = await getEst(Number(req.params.id), res);
    if (!est) return;
    const r = await quitarMateria(est.id, req.params.codigo);
    if (!r.ok) return res.status(r.status).json({ ok: false, msg: r.msg, deps: r.deps });
    const data = await getMallaEstudiante(est.id);
    res.json({ ok: true, msg: r.msg, estudiante: est, ...data });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}
