import { Router } from 'express';
import { malla, matricular, putNota, deleteMateria } from '../controllers/studentController.js';

const r = Router();
r.get('/:id/malla',              malla);
r.post('/:id/matricular',        matricular);
r.put('/:id/nota/:codigo',       putNota);
r.delete('/:id/materia/:codigo', deleteMateria);
export default r;
