import { Router } from 'express';
import { registrar, login, verificarToken, perfil } from '../controllers/authController.js';

const r = Router();
r.post('/registrar', registrar);
r.post('/login',     login);
r.get('/perfil',     verificarToken, perfil);
export default r;
