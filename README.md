# Software de Malla Curricular

Proyecto base funcional en **JavaScript + MySQL** para registrar materias aprobadas de un estudiante y calcular automáticamente qué materias puede cursar después.

## Qué hace

- Registrar estudiantes sin login.
- Cargar la malla curricular en MySQL.
- Marcar materias como aprobadas.
- Calcular materias habilitadas según prerrequisitos.
- Bloquear materias que no cumplen requisitos.
- Evitar inconsistencias como aprobar **Cálculo II** sin haber aprobado **Cálculo I**.
- Evitar borrar una materia si ya existe otra aprobada que depende de ella.

## Estructura

```text
malla-curricular-app/
  backend/
    package.json
    .env.example
    sql/
      schema.sql
      seed.sql
    src/
      config/db.js
      controllers/
      routes/
      services/
      utils/
      server.js
  frontend/
    index.html
    styles.css
    app.js
```

## Requisitos

- Node.js 18 o superior
- MySQL 8 o MariaDB compatible
- Un servidor estático simple para abrir el frontend

## Paso 1. Crear la base de datos

En MySQL ejecuta:

```sql
SOURCE ruta/backend/sql/schema.sql;
SOURCE ruta/backend/sql/seed.sql;
```

O copia y pega ambos archivos en tu cliente MySQL.

## Paso 2. Configurar el backend

Dentro de `backend/`:

```bash
npm install
```

Copia `.env.example` a `.env` y cambia los datos de tu MySQL.

Ejemplo:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=malla_curricular
```

## Paso 3. Encender el backend

```bash
cd backend
npm install
npm run dev
```

API:

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `GET /api/students/:id/curriculum`
- `POST /api/students/:id/approved-courses`
- `DELETE /api/students/:id/approved-courses/:courseCode`
- `GET /api/courses`

## Paso 4. Abrir el frontend

Abre `frontend/index.html` con Live Server en VS Code o con un servidor estático.

Si usas VS Code:

1. Instala la extensión **Live Server**.
2. Abre la carpeta `frontend`.
3. Clic derecho sobre `index.html`.
4. **Open with Live Server**.

## Lógica central del sistema

El sistema maneja la malla como un **grafo dirigido**:

- cada materia es un nodo
- cada prerrequisito es una arista
- ejemplo: `Cálculo I -> Cálculo II`

Una materia queda **disponible** solo si **todos** sus prerrequisitos ya están aprobados.

## Regla importante implementada

No permite este error:

- aprobar `Cálculo II` sin `Cálculo I`
- borrar `Cálculo I` si `Cálculo II` ya está aprobada

Eso fue exactamente lo que pediste.

## Nota sobre la malla cargada

La semilla fue armada con la información legible del PDF de Ingeniería Ambiental. Hay un código `453035` que en la extracción del PDF no quedó con nombre claro; por eso quedó como marcador para que lo reemplaces por el nombre correcto directamente en `seed.sql`.

## Siguiente mejora recomendada

- agregar búsqueda por código o nombre
- exportar reporte PDF del estudiante
- agregar visualización del grafo con Cytoscape.js o D3.js
- manejar electivas por línea de profundización de forma más precisa
