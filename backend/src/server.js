import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db.js';
import courseRoutes   from './routes/courseRoutes.js';
import studentRoutes  from './routes/studentRoutes.js';
import authRoutes     from './routes/authRoutes.js';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'API funcionando correctamente.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No fue posible conectar con MySQL.', error: error.message });
  }
});

app.use('/api/auth',     authRoutes);
app.use('/api/courses',  courseRoutes);
app.use('/api/students', studentRoutes);

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada.' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
