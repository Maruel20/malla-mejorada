import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import { pool } from './config/db.js';
import authRoutes    from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import courseRoutes  from './routes/courseRoutes.js';

dotenv.config();
const app  = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.use('/api/auth',      authRoutes);
app.use('/api/students',  studentRoutes);
app.use('/api/cursos',    courseRoutes);

app.use((_req, res) => res.status(404).json({ ok: false, msg: 'Ruta no encontrada.' }));

app.listen(PORT, () => console.log(`✅  API en http://localhost:${PORT}`));
