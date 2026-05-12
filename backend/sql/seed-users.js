/**
 * seed-users.js — Inserta estudiantes de prueba con contraseñas hasheadas.
 * Ejecutar: npm run seed-users
 *
 * Todos los estudiantes usan la contraseña: Test1234!
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'malla_curricular',
  waitForConnections: true,
  connectionLimit: 5
});

const PASSWORD = 'Test1234!';

// Grades per student: [course_code, grade]
const TEST_STUDENTS = [
  {
    first_name: 'Ana',
    last_name:  'García Ruiz',
    document_number: '1000001',
    // Semestre 1 completo con buenas notas → desbloquea semestre 2
    // Semestre 2 en progreso (algunas materias con nota, una perdida)
    courses: [
      // Semestre 1 — TODOS aprobados (13 créditos ≥ 12 → desbloquea sem. 2)
      ['453007', 4.2], ['453058', 4.0], ['453001', 3.8], ['453004', 4.5],
      ['453005', 4.0], ['453003', 4.3], ['453002', 3.5],
      // Semestre 2 — en progreso: 4 aprobadas, 1 perdida, 1 sin nota
      ['453008', 3.2], ['453009', 3.8], ['453010', 2.5], // QUÍMICA ORG perdida
      ['453011', 4.0], ['453012', 3.1],
    ]
  },
  {
    first_name: 'Carlos',
    last_name:  'Rodríguez Mora',
    document_number: '1000002',
    // Semestres 1-3 completos → desbloquea semestre 4
    courses: [
      // Semestre 1
      ['453007', 4.5], ['453058', 4.0], ['453001', 4.2], ['453004', 4.8],
      ['453005', 3.9], ['453003', 4.6], ['453002', 4.1],
      // Semestre 2
      ['453012', 4.0], ['453011', 3.7], ['453008', 3.9], ['453009', 4.2],
      ['453010', 3.5], ['453013', 4.0],
      // Semestre 3
      ['453016', 3.8], ['453014', 4.0], ['453015', 3.6], ['453017', 4.1],
      ['453019', 4.3], ['453018', 4.0],
      // Semestre 4 — en progreso
      ['453021', 3.5], ['453022', 4.0], ['453020', null], ['453023', null],
    ]
  },
  {
    first_name: 'María',
    last_name:  'López Hernández',
    document_number: '1000003',
    // Semestres 1-8 completos → casi al final
    courses: [
      // Semestre 1
      ['453007', 5.0], ['453058', 5.0], ['453001', 4.8], ['453004', 4.9],
      ['453005', 4.7], ['453003', 5.0], ['453002', 4.6],
      // Semestre 2
      ['453012', 4.5], ['453011', 4.8], ['453008', 4.6], ['453009', 4.7],
      ['453010', 4.5], ['453013', 4.9],
      // Semestre 3
      ['453016', 4.4], ['453014', 4.6], ['453015', 4.5], ['453017', 4.7],
      ['453019', 4.8], ['453018', 4.6],
      // Semestre 4
      ['453021', 4.3], ['453022', 4.5], ['453020', 4.4], ['453025', 4.6],
      ['453024', 4.2], ['453023', 4.3],
      // Semestre 5
      ['453026', 4.5], ['453031', 4.7], ['453030', 4.4], ['453029', 4.3],
      ['453028', 4.6], ['453027', 4.2],
      // Semestre 6
      ['453032', 4.1], ['453033', 4.4], ['453034', 4.3], ['453035', 4.2],
      ['453036', 4.5], ['453057', 4.0],
      // Semestre 7
      ['453037', 4.2], ['453038', 4.4], ['453039', 4.3], ['453040', 4.5],
      ['453041', 4.1], ['453042', 4.6],
      // Semestre 8
      ['453047', 4.0], ['453043', 4.3], ['453044', 4.2], ['453045', 4.4],
      ['453046', 4.1],
      // Semestre 9 — en progreso
      ['453052', 4.0], ['453053', null], ['453049', null], ['453048', null],
    ]
  },
  {
    first_name: 'Pedro',
    last_name:  'Martínez Cano',
    document_number: '1000004',
    // Estudiante nuevo: semestre 1 matriculado, sin notas aún
    courses: [
      ['453007', null], ['453058', null], ['453001', null], ['453004', null],
      ['453005', null], ['453003', null], ['453002', null],
    ]
  },
  {
    first_name: 'Laura',
    last_name:  'Sánchez Torres',
    document_number: '1000005',
    // Semestres 1-2 completos, 3 en progreso con una materia perdida
    courses: [
      // Semestre 1
      ['453007', 3.6], ['453058', 4.0], ['453001', 3.2], ['453004', 3.9],
      ['453005', 3.5], ['453003', 3.8], ['453002', 3.4],
      // Semestre 2
      ['453012', 3.5], ['453011', 3.8], ['453008', 3.0], ['453009', 3.7],
      ['453010', 3.2], ['453013', 3.9],
      // Semestre 3 — 2 aprobadas, 1 perdida, resto sin nota
      ['453016', 2.8], // Cálculo III — PERDIDA
      ['453014', 3.5], ['453015', null], ['453017', null],
    ]
  }
];

async function run() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  console.log(`\n🔐 Hash generado para "${PASSWORD}"`);

  for (const s of TEST_STUDENTS) {
    try {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Upsert student (delete if exists first for clean seed)
        await conn.query(`DELETE FROM students WHERE document_number = ?`, [s.document_number]);

        const [ins] = await conn.query(
          `INSERT INTO students (first_name, last_name, document_number, password_hash)
           VALUES (?, ?, ?, ?)`,
          [s.first_name, s.last_name, s.document_number, hash]
        );
        const sid = ins.insertId;

        for (const [code, grade] of s.courses) {
          await conn.query(
            `INSERT INTO student_courses (student_id, course_code, grade) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE grade = VALUES(grade)`,
            [sid, code, grade]
          );
        }

        await conn.commit();
        console.log(`✅  ${s.first_name} ${s.last_name} (${s.document_number}) — ${s.courses.length} materias`);
      } catch (err) {
        await conn.rollback();
        console.error(`❌  Error con ${s.document_number}:`, err.message);
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error(`❌  Conexión fallida:`, err.message);
    }
  }

  console.log(`\n📋 Estudiantes de prueba:
  ┌─────────────────────────────┬────────────┬────────────┐
  │ Estudiante                  │ Cédula     │ Contraseña │
  ├─────────────────────────────┼────────────┼────────────┤
  │ Ana García Ruiz             │ 1000001    │ Test1234!  │
  │ Carlos Rodríguez Mora       │ 1000002    │ Test1234!  │
  │ María López Hernández       │ 1000003    │ Test1234!  │
  │ Pedro Martínez Cano         │ 1000004    │ Test1234!  │
  │ Laura Sánchez Torres        │ 1000005    │ Test1234!  │
  └─────────────────────────────┴────────────┴────────────┘\n`);

  await pool.end();
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
