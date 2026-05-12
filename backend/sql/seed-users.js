/**
 * Inserta estudiantes de prueba con historial académico variado.
 * Ejecutar: npm run seed-users
 * Contraseña de todos: Test1234!
 */
import mysql   from 'mysql2/promise';
import bcrypt  from 'bcryptjs';
import dotenv  from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'malla_curricular',
});

const PASSWORD = 'Test1234!';

// [codigo, nota]  — nota null = matriculada sin calificar
const ESTUDIANTES = [
  {
    nombre: 'Ana', apellido: 'García Ruiz', cedula: '1000001',
    // Semestre 1 completo (13 cr aprobados → desbloquea sem 2)
    // Semestre 2 en progreso
    materias: [
      ['453007',4.2],['453058',4.0],['453001',3.8],['453004',4.5],
      ['453005',4.0],['453003',4.3],['453002',3.5],
      ['453008',3.2],['453009',3.8],['453010',2.5],
      ['453011',4.0],['453012',3.1],['453013',null],
    ]
  },
  {
    nombre: 'Carlos', apellido: 'Rodríguez Mora', cedula: '1000002',
    // Semestres 1-3 completos → desbloquea sem 4
    materias: [
      ['453007',4.5],['453058',4.0],['453001',4.2],['453004',4.8],
      ['453005',3.9],['453003',4.6],['453002',4.1],
      ['453012',4.0],['453011',3.7],['453008',3.9],['453009',4.2],
      ['453010',3.5],['453013',4.0],
      ['453016',3.8],['453014',4.0],['453015',3.6],['453017',4.1],
      ['453019',4.3],['453018',4.0],
      ['453021',3.5],['453022',4.0],['453020',null],['453023',null],
    ]
  },
  {
    nombre: 'María', apellido: 'López Hernández', cedula: '1000003',
    // Semestres 1-8 completos, sem 9 en progreso
    materias: [
      ['453007',5.0],['453058',5.0],['453001',4.8],['453004',4.9],
      ['453005',4.7],['453003',5.0],['453002',4.6],
      ['453012',4.5],['453011',4.8],['453008',4.6],['453009',4.7],
      ['453010',4.5],['453013',4.9],
      ['453016',4.4],['453014',4.6],['453015',4.5],['453017',4.7],
      ['453019',4.8],['453018',4.6],
      ['453021',4.3],['453022',4.5],['453020',4.4],['453025',4.6],
      ['453024',4.2],['453023',4.3],
      ['453026',4.5],['453031',4.7],['453030',4.4],['453029',4.3],
      ['453028',4.6],['453027',4.2],
      ['453032',4.1],['453033',4.4],['453034',4.3],['453035',4.2],
      ['453036',4.5],['453057',4.0],
      ['453037',4.2],['453038',4.4],['453039',4.3],['453040',4.5],
      ['453041',4.1],['453042',4.6],
      ['453047',4.0],['453043',4.3],['453044',4.2],['453045',4.4],
      ['453046',4.1],
      ['453052',4.0],['453053',null],['453049',null],['453048',null],
    ]
  },
  {
    nombre: 'Pedro', apellido: 'Martínez Cano', cedula: '1000004',
    // Nuevo estudiante: sem 1 matriculado sin notas
    materias: [
      ['453007',null],['453058',null],['453001',null],['453004',null],
      ['453005',null],['453003',null],['453002',null],
    ]
  },
  {
    nombre: 'Laura', apellido: 'Sánchez Torres', cedula: '1000005',
    // Sem 1-2 completos, sem 3 con una perdida
    materias: [
      ['453007',3.6],['453058',4.0],['453001',3.2],['453004',3.9],
      ['453005',3.5],['453003',3.8],['453002',3.4],
      ['453012',3.5],['453011',3.8],['453008',3.0],['453009',3.7],
      ['453010',3.2],['453013',3.9],
      ['453016',2.8],['453014',3.5],['453015',null],['453017',null],
    ]
  },
];

async function run() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  console.log('\n🔐 Insertando estudiantes de prueba...\n');

  for (const s of ESTUDIANTES) {
    try {
      await db.query('DELETE FROM students WHERE cedula = ?', [s.cedula]);
      const [r] = await db.query(
        'INSERT INTO students (nombre, apellido, cedula, password_hash) VALUES (?,?,?,?)',
        [s.nombre, s.apellido, s.cedula, hash]
      );
      const sid = r.insertId;
      for (const [codigo, nota] of s.materias) {
        await db.query(
          'INSERT INTO student_courses (student_id, codigo, nota) VALUES (?,?,?)',
          [sid, codigo, nota]
        );
      }
      console.log(`  ✅  ${s.nombre} ${s.apellido} — cédula ${s.cedula} — ${s.materias.length} materias`);
    } catch (e) {
      console.error(`  ❌  ${s.cedula}: ${e.message}`);
    }
  }

  console.log(`
┌─────────────────────────────┬──────────┬────────────┐
│ Estudiante                  │ Cédula   │ Contraseña │
├─────────────────────────────┼──────────┼────────────┤
│ Ana García Ruiz             │ 1000001  │ Test1234!  │
│ Carlos Rodríguez Mora       │ 1000002  │ Test1234!  │
│ María López Hernández       │ 1000003  │ Test1234!  │
│ Pedro Martínez Cano         │ 1000004  │ Test1234!  │
│ Laura Sánchez Torres        │ 1000005  │ Test1234!  │
└─────────────────────────────┴──────────┴────────────┘
`);
  await db.end();
}

run().catch(e => { console.error(e); process.exit(1); });
