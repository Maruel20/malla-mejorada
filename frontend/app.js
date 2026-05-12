/* ============================================================
   MALLA CURRICULAR v2 — Con autenticación, semestres progresivos y CRUD de notas
   ============================================================ */

const API_URL = 'http://localhost:3000/api';
const MIN_CREDITS = 12;
const MAX_CREDITS = 20;

// ── Estado global ─────────────────────────────────────────────
let currentStudent   = null;
let currentToken     = localStorage.getItem('mc_token');
let currentCurriculum = null;
let cyInstance       = null;
let activeTab        = 'malla';
let activeAreaFilter = 'all';
let enrollModalSem   = null; // semestre del modal abierto

const LINEAS = [
  { id: 'hidrica',   name: 'Recursos Hídricos',      icon: '💧', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  codes: ['453034','453043','453039'], description: 'Hidráulica · Hidrología · Contaminación del Agua' },
  { id: 'residuos',  name: 'Residuos y Suelos',       icon: '♻️', color: '#10b981', bg: 'rgba(16,185,129,0.15)', codes: ['453044','453048','453055'], description: 'Residuos Sólidos · Suelos · Evaluación de Impacto' },
  { id: 'atmosfera', name: 'Calidad del Aire',         icon: '🌫️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', codes: ['453030','453049'],          description: 'Física Ambiental · Contaminación del Aire' },
  { id: 'biotec',    name: 'Biotecnología',            icon: '🧬', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', codes: ['453109','453057','453026'], description: 'Biotecnología · Procesos Unitarios · Microbiología' },
  { id: 'gestion',   name: 'Gestión y Ordenamiento',  icon: '🗺️', color: '#ec4899', bg: 'rgba(236,72,153,0.15)',  codes: ['453033','453037','453038','453047'], description: 'Geociencias · Geomática I y II' }
];

// ── Utilidades HTTP ───────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  const response = await fetch(`${API_URL}${path}`, { headers, ...options });
  const data = await response.json();
  if (!response.ok || !data.ok) throw data;
  return data;
}

function toast(text, type = 'success', duration = 4000) {
  const zone = document.getElementById('toast-zone');
  const el   = document.createElement('div');
  el.className  = `toast ${type}`;
  el.textContent = text;
  zone.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.25s ease forwards';
    setTimeout(() => el.remove(), 260);
  }, duration);
}

function initials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
}

function setProgress(pct) {
  const circumference = 2 * Math.PI * 32;
  const fill = document.getElementById('progress-ring-fill');
  if (fill) fill.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  const pctEl = document.getElementById('progress-pct');
  if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
}

function statusLabel(s) {
  return { approved: 'Aprobada', enrolled: 'Matriculada', available: 'Disponible', blocked: 'Bloqueada', failed: 'Perdida', 'semester-locked': 'Sem. bloqueado' }[s] || s;
}

// ── Autenticación ─────────────────────────────────────────────
const authScreen   = document.getElementById('auth-screen');
const sidebar      = document.getElementById('sidebar');
const mainContent  = document.getElementById('main-content');

function showAuthScreen() {
  authScreen.hidden    = false;
  sidebar.hidden       = true;
  mainContent.hidden   = true;
}

function showMainApp() {
  authScreen.hidden  = true;
  sidebar.hidden     = false;
  mainContent.hidden = false;
}

async function checkSession() {
  if (!currentToken) { showAuthScreen(); return; }
  try {
    const data    = await apiFetch('/auth/me');
    currentStudent = data.student;
    showMainApp();
    await loadCurriculum();
  } catch {
    currentToken = null;
    localStorage.removeItem('mc_token');
    showAuthScreen();
  }
}

// Auth tabs
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.form;
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.form === target));
    document.getElementById('form-login').hidden    = target !== 'login';
    document.getElementById('form-register').hidden = target !== 'register';
    document.getElementById('login-error').hidden    = true;
    document.getElementById('register-error').hidden = true;
  });
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const cedula   = document.getElementById('login-cedula').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.hidden   = true;

  if (!cedula || !password) { showAuthError(errEl, 'Ingresa cédula y contraseña.'); return; }

  try {
    document.getElementById('login-btn').disabled = true;
    const data     = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ document_number: cedula, password }) });
    currentToken   = data.token;
    currentStudent = data.student;
    localStorage.setItem('mc_token', currentToken);
    showMainApp();
    await loadCurriculum();
  } catch (err) {
    showAuthError(errEl, err.message || 'Error al iniciar sesión.');
  } finally {
    document.getElementById('login-btn').disabled = false;
  }
});

// Permitir enter en login
['login-cedula','login-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });
});

// Register
document.getElementById('register-btn').addEventListener('click', async () => {
  const first_name      = document.getElementById('reg-first-name').value.trim();
  const last_name       = document.getElementById('reg-last-name').value.trim();
  const document_number = document.getElementById('reg-cedula').value.trim();
  const password        = document.getElementById('reg-password').value;
  const confirm         = document.getElementById('reg-confirm').value;
  const errEl           = document.getElementById('register-error');
  errEl.hidden          = true;

  if (!first_name || !last_name || !document_number || !password) {
    showAuthError(errEl, 'Completa todos los campos.'); return;
  }
  if (password !== confirm) {
    showAuthError(errEl, 'Las contraseñas no coinciden.'); return;
  }
  if (password.length < 6) {
    showAuthError(errEl, 'La contraseña debe tener al menos 6 caracteres.'); return;
  }

  try {
    document.getElementById('register-btn').disabled = true;
    const data     = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ first_name, last_name, document_number, password }) });
    currentToken   = data.token;
    currentStudent = data.student;
    localStorage.setItem('mc_token', currentToken);
    showMainApp();
    await loadCurriculum();
    toast('Registro exitoso. Semestre 1 matriculado automáticamente.', 'success');
  } catch (err) {
    showAuthError(errEl, err.message || 'Error al registrarse.');
  } finally {
    document.getElementById('register-btn').disabled = false;
  }
});

function showAuthError(el, msg) {
  el.textContent = msg;
  el.hidden      = false;
}

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  currentToken     = null;
  currentStudent   = null;
  currentCurriculum = null;
  localStorage.removeItem('mc_token');
  if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
  showAuthScreen();
  toast('Sesión cerrada.', 'info');
});

// ── Navegación ────────────────────────────────────────────────
const TAB_TITLES = { malla: 'Malla Semestral', grafo: 'Grafo de Prerrequisitos', electivas: 'Electivas y Profundización' };

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;

  // Cerrar sidebar en móvil al navegar
  if (window.innerWidth < 768) closeSidebar();

  if (tab === 'grafo' && currentCurriculum) setTimeout(() => buildGraph(), 80);
  if (tab === 'electivas' && currentCurriculum) renderElectivas();
}

// Menú hamburguesa móvil
document.getElementById('menu-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('sidebar-open');
});
function closeSidebar() { sidebar.classList.remove('sidebar-open'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.sidebar') && !e.target.closest('#menu-toggle')) closeSidebar();
});

// ── Currículo ─────────────────────────────────────────────────
async function loadCurriculum() {
  if (!currentStudent) return;
  try {
    const data = await apiFetch(`/students/${currentStudent.id}/curriculum`);
    currentCurriculum = data;
    renderAll(data);
  } catch (err) {
    toast(err.message || 'Error al cargar la malla.', 'error');
  }
}

function renderAll(data) {
  updateSidebar(data);
  buildAreaFilters(data);
  renderCurriculumGrid(data);
  if (activeTab === 'grafo')    buildGraph();
  if (activeTab === 'electivas') renderElectivas();
}

// ── Sidebar ───────────────────────────────────────────────────
function updateSidebar(data) {
  const s = currentStudent;
  document.getElementById('sidebar-avatar').textContent = initials(s.first_name, s.last_name);
  document.getElementById('sidebar-name').textContent   = `${s.first_name} ${s.last_name}`;
  document.getElementById('sidebar-doc').textContent    = s.document_number;

  document.getElementById('sb-approved').textContent  = data.summary.approved;
  document.getElementById('sb-enrolled').textContent  = data.summary.enrolled + data.summary.available;
  document.getElementById('sb-blocked').textContent   = data.summary.blocked;
  document.getElementById('sb-gpa').textContent       = data.gpa.toFixed(2);

  const total = data.courses.length;
  const pct   = total ? (data.summary.approved / total) * 100 : 0;
  setProgress(pct);
}

// ── Filtros de área ───────────────────────────────────────────
function buildAreaFilters(data) {
  const areas     = [...new Set(data.courses.map(c => c.area))].sort();
  const container = document.getElementById('area-filters');
  container.innerHTML = '<button class="pill active" data-filter="all">Todas las áreas</button>';
  areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className    = 'pill';
    btn.dataset.filter = area;
    btn.textContent  = area;
    container.appendChild(btn);
  });
  container.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAreaFilter = btn.dataset.filter;
      renderCurriculumGrid(currentCurriculum);
    });
  });
}

// ── Grid de malla ─────────────────────────────────────────────
function renderCurriculumGrid(data) {
  const grid     = document.getElementById('curriculum-grid');
  if (!grid) return;

  const filtered = activeAreaFilter === 'all'
    ? data.courses
    : data.courses.filter(c => c.area === activeAreaFilter);

  const semesters = new Map();
  filtered.forEach(c => {
    if (!semesters.has(c.semester)) semesters.set(c.semester, []);
    semesters.get(c.semester).push(c);
  });

  const unlocked = new Set(data.unlockedSemesters);

  grid.innerHTML = '';

  [...semesters.entries()].sort((a, b) => a[0] - b[0]).forEach(([sem, courses]) => {
    const isUnlocked     = unlocked.has(sem);
    const stats          = data.semesterStats[sem] || {};
    const semApproved    = stats.approvedCredits || 0;
    const semTotal       = stats.total || 0;
    const semComplete    = isUnlocked && semApproved >= MIN_CREDITS;
    const isNextSem      = !isUnlocked && unlocked.has(sem - 1);
    const allCoursesSem  = data.courses.filter(c => c.semester === sem);

    const col = document.createElement('div');
    col.className = `semester-col ${isUnlocked ? '' : 'semester-locked-col'}`;

    // Header semestre
    const header = document.createElement('div');
    header.className = 'sem-header';

    const statusIcon = isUnlocked
      ? (semComplete ? '✓' : '◎')
      : '🔒';
    const statusClass = semComplete ? 'sem-complete' : (isUnlocked ? 'sem-active' : 'sem-locked');

    header.innerHTML = `
      <div class="sem-title-row">
        <span class="sem-num">Semestre ${sem}</span>
        <span class="sem-badge ${statusClass}">${statusIcon} ${semComplete ? 'Completado' : (isUnlocked ? 'En curso' : 'Bloqueado')}</span>
      </div>
      <div class="sem-credits-row">
        <span class="sem-credits-bar-wrap">
          <span class="sem-credits-bar" style="width:${semTotal ? Math.min(100, (semApproved/semTotal)*100) : 0}%"></span>
        </span>
        <span class="sem-credits-text">${semApproved}/${semTotal} cr. aprobados</span>
      </div>
    `;

    col.appendChild(header);

    if (!isUnlocked) {
      // Semestre bloqueado: mostrar placeholder
      const lockCard = document.createElement('div');
      lockCard.className = 'semester-lock-placeholder';
      const prevSemApproved = (data.semesterStats[sem - 1] || {}).approvedCredits || 0;
      const needed = MIN_CREDITS - prevSemApproved;
      lockCard.innerHTML = `
        <div class="lock-icon">🔒</div>
        <div class="lock-msg">Aprueba ${needed > 0 ? `${needed} crédito(s) más del semestre ${sem-1}` : `el semestre ${sem-1}`} para desbloquear</div>
      `;
      col.appendChild(lockCard);

      // Mostrar cursos en gris para que se vea qué viene
      courses.forEach(course => col.appendChild(buildCourseCard(course, false)));
    } else {
      // Check if semester needs enrollment
      const hasEnrolledOrGraded = allCoursesSem.some(c => ['enrolled','approved','failed'].includes(c.status));
      const hasAvailable        = allCoursesSem.some(c => c.status === 'available');

      if (!hasEnrolledOrGraded && hasAvailable && sem > 1) {
        const enrollBtn = document.createElement('button');
        enrollBtn.className = 'btn-enroll-sem';
        enrollBtn.innerHTML = `📋 Matricular Semestre ${sem}`;
        enrollBtn.addEventListener('click', () => openEnrollModal(sem, data));
        col.appendChild(enrollBtn);
      }

      courses.forEach(course => col.appendChild(buildCourseCard(course, true)));
    }

    grid.appendChild(col);
  });
}

// ── Card de materia ───────────────────────────────────────────
function buildCourseCard(course, isUnlocked) {
  const div = document.createElement('div');
  div.className  = `course-card ${course.status}`;
  div.dataset.code = course.code;

  const reqs    = course.prerequisites.length ? course.prerequisites.join(', ') : 'Sin prerrequisitos';
  const missing = course.missingPrerequisites?.length
    ? `<div class="c-missing">⚠ Faltan: ${course.missingPrerequisites.join(', ')}</div>`
    : '';

  let gradeSection = '';

  if (isUnlocked && course.status !== 'semester-locked' && course.status !== 'blocked') {
    if (course.status === 'approved' || course.status === 'failed' || course.status === 'enrolled') {
      // CRUD: mostrar nota actual + editar/eliminar
      const gradeColor = course.grade === null ? '#94a3b8' : (course.grade >= 3.0 ? '#10b981' : '#ef4444');
      const gradeDisplay = course.grade !== null ? `★ ${course.grade}` : 'Sin nota';
      gradeSection = `
        <div class="grade-section">
          <span class="grade-badge" style="color:${gradeColor}">${gradeDisplay}</span>
          <div class="grade-actions">
            <button class="btn-grade-edit" data-code="${course.code}" title="Editar nota">✏</button>
            <button class="btn-grade-delete" data-code="${course.code}" title="Quitar materia">✕</button>
          </div>
        </div>
        <div class="grade-edit-row" id="edit-${course.code}" hidden>
          <input type="number" class="grade-input" step="0.1" min="1.0" max="5.0"
                 placeholder="Nota (1.0-5.0)" value="${course.grade ?? ''}"
                 data-code="${course.code}" />
          <button class="btn-grade-save" data-code="${course.code}">✓</button>
          <button class="btn-grade-cancel" data-code="${course.code}">✕</button>
        </div>
      `;
    } else if (course.status === 'available') {
      // Disponible pero no matriculada: mostrar entrada directa de nota (matrícula implícita)
      gradeSection = `
        <div class="grade-section">
          <span class="grade-badge" style="color:#94a3b8">Sin matricular</span>
          <div class="grade-actions">
            <button class="btn-grade-enroll" data-code="${course.code}" title="Matricular y registrar nota">+ Nota</button>
          </div>
        </div>
        <div class="grade-edit-row" id="edit-${course.code}" hidden>
          <input type="number" class="grade-input" step="0.1" min="1.0" max="5.0"
                 placeholder="Nota (1.0-5.0)" data-code="${course.code}" />
          <button class="btn-grade-save" data-code="${course.code}">✓</button>
          <button class="btn-grade-cancel" data-code="${course.code}">✕</button>
        </div>
      `;
    }
  }

  div.innerHTML = `
    <div class="c-header">
      <span class="c-code">${course.code}</span>
      <span class="status-dot ${course.status}" title="${statusLabel(course.status)}"></span>
    </div>
    <div class="c-name">${course.name}</div>
    <div class="c-meta">
      <span class="c-credits">◆ ${course.credits} cr.</span>
      <span class="c-area-badge">${course.area.replace('ÁREA ', '').replace('CIENCIAS BÁSICA DE ', '')}</span>
    </div>
    <div class="c-reqs" title="Prerrequisitos: ${reqs}">Prereq: ${reqs}</div>
    ${missing}
    ${gradeSection}
  `;

  // Wire up grade CRUD events
  wireCardEvents(div, course);

  return div;
}

function wireCardEvents(div, course) {
  // Edit button
  const editBtn = div.querySelector('.btn-grade-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      div.querySelector(`#edit-${course.code}`).hidden = false;
      editBtn.style.display = 'none';
    });
  }

  // Enroll quick button
  const enrollBtn = div.querySelector('.btn-grade-enroll');
  if (enrollBtn) {
    enrollBtn.addEventListener('click', () => {
      div.querySelector(`#edit-${course.code}`).hidden = false;
      enrollBtn.style.display = 'none';
    });
  }

  // Cancel edit
  const cancelBtn = div.querySelector('.btn-grade-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      div.querySelector(`#edit-${course.code}`).hidden = true;
      if (editBtn)   editBtn.style.display   = '';
      if (enrollBtn) enrollBtn.style.display = '';
    });
  }

  // Save grade
  const saveBtn = div.querySelector('.btn-grade-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const input = div.querySelector(`.grade-input[data-code="${course.code}"]`);
      const grade = parseFloat(input.value);
      if (isNaN(grade) || grade < 1.0 || grade > 5.0) {
        toast('Nota inválida. Ingresa un valor entre 1.0 y 5.0', 'error'); return;
      }
      await submitGrade(course.code, grade, course.semester);
    });
  }

  // Allow enter key in grade input
  const gradeInput = div.querySelector(`.grade-input[data-code="${course.code}"]`);
  if (gradeInput) {
    gradeInput.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        const grade = parseFloat(gradeInput.value);
        if (!isNaN(grade) && grade >= 1.0 && grade <= 5.0) {
          await submitGrade(course.code, grade, course.semester);
        }
      }
    });
  }

  // Delete / remove
  const deleteBtn = div.querySelector('.btn-grade-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`¿Quitar "${course.name}" del historial?`)) return;
      await removeCourse(course.code);
    });
  }
}

async function submitGrade(courseCode, grade, semester) {
  try {
    // If course is 'available' (not enrolled), first enroll it for this semester
    const courseData = currentCurriculum?.courses.find(c => c.code === courseCode);
    if (courseData?.status === 'available') {
      // Enroll single course implicitly - check credits
      const semCourses = currentCurriculum.courses.filter(c => c.semester === semester && ['enrolled','approved','failed'].includes(c.status));
      const enrolledCredits = semCourses.reduce((s, c) => s + c.credits, 0) + (courseData?.credits || 0);
      if (enrolledCredits > MAX_CREDITS) {
        toast(`Superarías el máximo de ${MAX_CREDITS} créditos en el semestre.`, 'error'); return;
      }
      // Enroll the course
      const codes = [...semCourses.map(c => c.code), courseCode];
      await apiFetch(`/students/${currentStudent.id}/enroll-semester`, {
        method: 'POST',
        body: JSON.stringify({ semester, course_codes: codes })
      });
    }

    const data = await apiFetch(`/students/${currentStudent.id}/courses/${courseCode}`, {
      method: 'PUT',
      body: JSON.stringify({ grade })
    });
    currentCurriculum = data;
    toast(data.message, grade >= 3.0 ? 'success' : 'warning');
    renderAll(currentCurriculum);
  } catch (err) {
    toast(err.message || 'Error al guardar nota.', 'error');
  }
}

async function removeCourse(courseCode) {
  try {
    const data = await apiFetch(`/students/${currentStudent.id}/courses/${courseCode}`, { method: 'DELETE' });
    currentCurriculum = data;
    toast(data.message, 'success');
    renderAll(currentCurriculum);
  } catch (err) {
    const deps = err.dependentCourses?.length
      ? ' Dependen: ' + err.dependentCourses.map(d => d.code).join(', ')
      : '';
    toast((err.message || 'Error.') + deps, 'error');
  }
}

// ── Modal de matrícula ────────────────────────────────────────
function openEnrollModal(sem, data) {
  enrollModalSem = sem;
  const modal    = document.getElementById('enroll-modal');
  document.getElementById('modal-title').textContent = `Matricular Semestre ${sem}`;
  document.getElementById('enroll-feedback').hidden  = true;

  const semCourses   = data.courses.filter(c => c.semester === sem && (c.status === 'available' || c.status === 'blocked'));
  const listEl       = document.getElementById('enroll-course-list');
  listEl.innerHTML   = '';

  semCourses.forEach(c => {
    const row = document.createElement('label');
    row.className = `enroll-row ${c.status === 'blocked' ? 'enroll-blocked' : ''}`;
    row.innerHTML = `
      <input type="checkbox" class="enroll-check" value="${c.code}"
             data-credits="${c.credits}"
             ${c.status === 'blocked' ? 'disabled' : 'checked'} />
      <div class="enroll-info">
        <span class="enroll-code">${c.code}</span>
        <span class="enroll-name">${c.name}</span>
        ${c.status === 'blocked' ? `<span class="enroll-blocked-hint">Prerrequisitos pendientes</span>` : ''}
      </div>
      <span class="enroll-credits">${c.credits} cr.</span>
    `;
    listEl.appendChild(row);
  });

  updateCreditsCount();
  listEl.querySelectorAll('.enroll-check').forEach(cb => cb.addEventListener('change', updateCreditsCount));

  modal.hidden = false;
}

function updateCreditsCount() {
  const checks   = document.querySelectorAll('.enroll-check:checked:not(:disabled)');
  const total    = [...checks].reduce((s, cb) => s + Number(cb.dataset.credits), 0);
  const el       = document.getElementById('selected-credits-count');
  el.textContent = total;
  el.className   = `credits-num ${total < MIN_CREDITS ? 'credits-low' : total > MAX_CREDITS ? 'credits-high' : 'credits-ok'}`;
}

document.getElementById('modal-close').addEventListener('click', closeEnrollModal);
document.getElementById('enroll-cancel').addEventListener('click', closeEnrollModal);
document.getElementById('modal-backdrop').addEventListener('click', closeEnrollModal);

function closeEnrollModal() {
  document.getElementById('enroll-modal').hidden = true;
  enrollModalSem = null;
}

document.getElementById('enroll-confirm').addEventListener('click', async () => {
  const checks = [...document.querySelectorAll('.enroll-check:checked:not(:disabled)')];
  const codes  = checks.map(cb => cb.value);
  const total  = checks.reduce((s, cb) => s + Number(cb.dataset.credits), 0);
  const fbEl   = document.getElementById('enroll-feedback');

  if (total < MIN_CREDITS) {
    fbEl.textContent = `Mínimo ${MIN_CREDITS} créditos requeridos. Tienes ${total}.`;
    fbEl.className   = 'enroll-feedback error';
    fbEl.hidden      = false;
    return;
  }
  if (total > MAX_CREDITS) {
    fbEl.textContent = `Máximo ${MAX_CREDITS} créditos permitidos. Tienes ${total}.`;
    fbEl.className   = 'enroll-feedback error';
    fbEl.hidden      = false;
    return;
  }

  try {
    document.getElementById('enroll-confirm').disabled = true;
    const data = await apiFetch(`/students/${currentStudent.id}/enroll-semester`, {
      method: 'POST',
      body: JSON.stringify({ semester: enrollModalSem, course_codes: codes })
    });
    currentCurriculum = data;
    toast(data.message, 'success');
    closeEnrollModal();
    renderAll(currentCurriculum);
  } catch (err) {
    fbEl.textContent = err.message || 'Error al matricular.';
    fbEl.className   = 'enroll-feedback error';
    fbEl.hidden      = false;
  } finally {
    document.getElementById('enroll-confirm').disabled = false;
  }
});

// ── Búsqueda ──────────────────────────────────────────────────
const searchInput    = document.getElementById('course-search');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q || !currentCurriculum) { searchDropdown.hidden = true; return; }

  const matches = currentCurriculum.courses.filter(c =>
    c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );

  searchDropdown.innerHTML = '';
  if (!matches.length) {
    searchDropdown.innerHTML = '<div class="search-item"><div class="search-item-name" style="color:var(--text3)">Sin resultados</div></div>';
    searchDropdown.hidden = false;
    return;
  }

  matches.slice(0, 10).forEach(c => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `
      <div class="search-item-code">${c.code}</div>
      <div class="search-item-name">${c.name}</div>
      <div class="search-item-meta">Sem. ${c.semester} · ${c.credits} cr.
        <span class="status-badge ${c.status}">${statusLabel(c.status)}</span>
      </div>`;
    item.addEventListener('click', () => {
      searchDropdown.hidden = true;
      searchInput.value    = '';
      if (activeTab !== 'malla') switchTab('malla');
      setTimeout(() => {
        const card = document.querySelector(`.course-card[data-code="${c.code}"]`);
        if (card) { card.classList.add('highlight-search'); card.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => card.classList.remove('highlight-search'), 3000); }
      }, 150);
    });
    searchDropdown.appendChild(item);
  });
  searchDropdown.hidden = false;
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) searchDropdown.hidden = true;
});

// ── Grafo Cytoscape ───────────────────────────────────────────
function buildGraph() {
  if (!currentCurriculum) return;

  const container = document.getElementById('cy-container');
  const emptyMsg  = document.getElementById('grafo-empty');
  if (emptyMsg) emptyMsg.remove();

  const statusColor = { approved:'#10b981', enrolled:'#3b82f6', available:'#f59e0b', failed:'#ef4444', blocked:'#4b5563', 'semester-locked':'#1e293b' };

  const nodes = currentCurriculum.courses.map(c => ({
    data: { id: c.code, label: c.code, fullName: c.name, credits: c.credits, semester: c.semester, status: c.status, area: c.area, color: statusColor[c.status] || '#4b5563' }
  }));

  const edges = [];
  currentCurriculum.courses.forEach(c => {
    c.prerequisites.forEach(prereq => {
      edges.push({ data: { source: prereq, target: c.code, id: `${prereq}-${c.code}` } });
    });
  });

  if (cyInstance) cyInstance.destroy();

  cyInstance = cytoscape({
    container,
    elements: { nodes, edges },
    style: [
      { selector: 'node',                   style: { 'background-color':'data(color)', 'label':'data(label)', 'color':'#e2e8f0', 'font-family':'Space Mono, monospace', 'font-size':'9px', 'font-weight':'bold', 'text-valign':'center', 'text-halign':'center', 'width':46, 'height':46, 'border-width':2, 'border-color':'data(color)', 'text-outline-color':'#080c14', 'text-outline-width':2 } },
      { selector: 'node[status="approved"]',        style: { 'background-color':'#10b981', 'border-color':'#6ee7b7' } },
      { selector: 'node[status="enrolled"]',        style: { 'background-color':'#3b82f6', 'border-color':'#93c5fd' } },
      { selector: 'node[status="available"]',       style: { 'background-color':'#d97706', 'border-color':'#fcd34d' } },
      { selector: 'node[status="failed"]',          style: { 'background-color':'#ef4444', 'border-color':'#f87171' } },
      { selector: 'node[status="blocked"]',         style: { 'background-color':'#334155', 'border-color':'#475569', 'opacity':0.7 } },
      { selector: 'node[status="semester-locked"]', style: { 'background-color':'#1e293b', 'border-color':'#334155', 'opacity':0.4 } },
      { selector: 'node:selected',                  style: { 'border-width':3, 'border-color':'#3b82f6', 'underlay-color':'#3b82f6', 'underlay-padding':4, 'underlay-opacity':0.4 } },
      { selector: 'edge',                           style: { 'width':1.5, 'line-color':'#334155', 'target-arrow-color':'#475569', 'target-arrow-shape':'triangle', 'curve-style':'bezier', 'arrow-scale':0.8, 'opacity':0.6 } },
      { selector: 'edge.highlighted',               style: { 'line-color':'#3b82f6', 'target-arrow-color':'#3b82f6', 'width':2.5, 'opacity':1 } },
      { selector: 'node.faded',                     style: { 'opacity':0.15 } },
      { selector: 'edge.faded',                     style: { 'opacity':0.08 } }
    ],
    layout: { name:'breadthfirst', directed:true, spacingFactor:1.6, padding:30, avoidOverlap:true },
    userZoomingEnabled: true,
    userPanningEnabled: true
  });

  const tooltip = document.getElementById('cy-tooltip');
  cyInstance.on('mouseover', 'node', e => {
    const d = e.target.data();
    tooltip.hidden  = false;
    tooltip.innerHTML = `<div class="tt-code">${d.id}</div><div class="tt-name">${d.fullName}</div><div class="tt-row">Sem. ${d.semester} &nbsp;·&nbsp; ${d.credits} cr.</div><div class="tt-row"><span class="status-badge ${d.status}">${statusLabel(d.status)}</span></div>`;
    cyInstance.elements().addClass('faded');
    e.target.removeClass('faded').connectedEdges().removeClass('faded').addClass('highlighted');
    e.target.neighborhood('node').removeClass('faded');
  });
  cyInstance.on('mousemove', e => {
    if (!tooltip.hidden) { tooltip.style.left = (e.originalEvent.clientX + 16) + 'px'; tooltip.style.top = (e.originalEvent.clientY + 16) + 'px'; }
  });
  cyInstance.on('mouseout', 'node', () => { tooltip.hidden = true; cyInstance.elements().removeClass('faded highlighted'); });

  document.getElementById('grafo-fit').onclick    = () => cyInstance.fit(undefined, 40);
  document.getElementById('grafo-layout').onclick = () => cyInstance.layout({ name:'breadthfirst', directed:true, spacingFactor:1.6, padding:30, avoidOverlap:true }).run();
}

// ── Electivas ─────────────────────────────────────────────────
function renderElectivas() {
  const grid = document.getElementById('lineas-grid');
  grid.innerHTML = '';

  LINEAS.forEach(linea => {
    const card    = document.createElement('div');
    card.className = 'linea-card';

    const courses = linea.codes.map(code => {
      const c = currentCurriculum?.courses.find(x => x.code === code);
      return c || { code, name: code, status:'semester-locked', credits: 0 };
    });

    card.innerHTML = `
      <div class="linea-header">
        <div class="linea-icon" style="background:${linea.bg};color:${linea.color}">${linea.icon}</div>
        <div>
          <div class="linea-title">${linea.name}</div>
          <div class="linea-count" style="color:${linea.color}">${linea.description}</div>
        </div>
      </div>
      <div class="linea-body">
        ${courses.map(c => `
          <div class="elec-course-row">
            <span class="elec-code">${c.code}</span>
            <span class="elec-name">${c.name}</span>
            <span class="status-badge ${c.status}">${statusLabel(c.status)}</span>
          </div>`).join('')}
      </div>`;
    grid.appendChild(card);
  });
}

// ── Exportar PDF ──────────────────────────────────────────────
document.getElementById('export-pdf-btn').addEventListener('click', () => {
  if (!currentCurriculum) { toast('Carga la malla primero.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc       = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const student   = currentStudent;
  const summary   = currentCurriculum.summary;
  const courses   = currentCurriculum.courses;
  const total     = courses.length;
  const pct       = total ? Math.round((summary.approved / total) * 100) : 0;

  doc.setFillColor(8,12,20);    doc.rect(0,0,210,297,'F');
  doc.setFillColor(20,29,46);   doc.roundedRect(10,10,190,40,4,4,'F');
  doc.setTextColor(227,232,240); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('MALLA CURRICULAR', 20, 25);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  doc.text('Ingeniería Ambiental', 20, 31);
  doc.setFontSize(11); doc.setTextColor(227,232,240); doc.setFont('helvetica','bold');
  doc.text(`${student.first_name} ${student.last_name}`, 20, 41);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(148,163,184);
  doc.text(`Cédula: ${student.document_number}  ·  Promedio: ${currentCurriculum.gpa}  ·  ${new Date().toLocaleDateString('es-CO')}`, 20, 47);

  const boxes = [
    { label:'Aprobadas',  value: summary.approved,  color:[16,185,129] },
    { label:'Matriculadas',value: summary.enrolled, color:[59,130,246] },
    { label:'Disponibles',value: summary.available, color:[245,158,11] },
    { label:'Progreso',   value:`${pct}%`,           color:[139,92,246] }
  ];
  boxes.forEach((box, i) => {
    const x = 10 + i * 48;
    doc.setFillColor(...box.color, 30); doc.roundedRect(x,54,44,20,3,3,'F');
    doc.setDrawColor(...box.color); doc.setLineWidth(0.4); doc.roundedRect(x,54,44,20,3,3,'S');
    doc.setTextColor(...box.color); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(String(box.value), x+22, 63, { align:'center' });
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
    doc.text(box.label.toUpperCase(), x+22, 70, { align:'center' });
  });

  const tableRows = [];
  [...new Map(courses.map(c => [c.semester, courses.filter(x => x.semester === c.semester)])).entries()]
    .sort((a,b) => a[0]-b[0])
    .forEach(([sem, cList]) => {
      cList.forEach(c => {
        tableRows.push([`Sem. ${sem}`, c.code, c.name, String(c.credits),
          c.grade !== null && c.grade !== undefined ? String(c.grade) : '—',
          { approved:'Aprobada', failed:'Perdida', enrolled:'Matriculada', available:'Disponible', blocked:'Bloqueada', 'semester-locked':'Bloqueado' }[c.status] || c.status
        ]);
      });
    });

  doc.autoTable({
    startY: 80,
    head: [['Sem.','Código','Materia','Cr.','Nota','Estado']],
    body: tableRows,
    styles: { fontSize:8, cellPadding:2.5, textColor:[227,232,240], fillColor:[13,18,32], lineColor:[26,37,64], lineWidth:0.3 },
    headStyles: { fillColor:[20,29,46], textColor:[148,163,184], fontStyle:'bold', fontSize:7 },
    alternateRowStyles: { fillColor:[20,29,46] },
    columnStyles: { 0:{cellWidth:14}, 1:{cellWidth:20,font:'courier',fontSize:7}, 2:{cellWidth:'auto'}, 3:{cellWidth:8,halign:'center'}, 4:{cellWidth:12,halign:'center'}, 5:{cellWidth:22,halign:'center'} },
    didParseCell: d => {
      if (d.column.index === 5 && d.section === 'body') {
        const v = d.cell.raw;
        if (v==='Aprobada')   d.cell.styles.textColor=[110,231,183];
        if (v==='Perdida')    d.cell.styles.textColor=[248,113,113];
        if (v==='Matriculada')d.cell.styles.textColor=[147,197,253];
        if (v==='Disponible') d.cell.styles.textColor=[252,211,77];
        if (v==='Bloqueada')  d.cell.styles.textColor=[100,116,139];
      }
    },
    margin: { left:10, right:10 }
  });

  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7); doc.setTextColor(71,85,105);
  doc.text('Malla Curricular · Ingeniería Ambiental', 105, pageH-8, { align:'center' });

  doc.save(`malla-${student.document_number}-${Date.now()}.pdf`);
  toast('PDF exportado.', 'success');
});

// ── Init ──────────────────────────────────────────────────────
checkSession();
