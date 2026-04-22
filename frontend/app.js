/* ============================================================
   MALLA CURRICULAR — Enhanced Frontend
   Features: Search, PDF export, Cytoscape graph, Electivas
   ============================================================ */

const API_URL = 'http://localhost:3000/api';

// ──────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────
let currentStudentId = null;
let currentCurriculum = null;
let cyInstance = null;
let activeTab = 'estudiante';
let activeAreaFilter = 'all';

// Líneas de profundización (predefined lines for the Ambiental curriculum)
const LINEAS = [
  {
    id: 'hidrica',
    name: 'Recursos Hídricos',
    icon: '💧',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    codes: ['453034', '453043', '453039'],
    description: 'Hidráulica, Hidrología y Contaminación del Agua'
  },
  {
    id: 'residuos',
    name: 'Residuos y Suelos',
    icon: '♻️',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.15)',
    codes: ['453044', '453048', '453055'],
    description: 'Residuos Sólidos, Suelos y Evaluación de Impacto'
  },
  {
    id: 'atmosfera',
    name: 'Calidad del Aire',
    icon: '🌫️',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.15)',
    codes: ['453030', '453049'],
    description: 'Física Ambiental y Contaminación del Aire'
  },
  {
    id: 'biotec',
    name: 'Biotecnología',
    icon: '🧬',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.15)',
    codes: ['453109', '453057', '453026'],
    description: 'Biotecnología, Procesos Unitarios, Microbiología'
  },
  {
    id: 'gestion',
    name: 'Gestión y Ordenamiento',
    icon: '🗺️',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.15)',
    codes: ['453033', '453037', '453038', '453047'],
    description: 'Geociencias, Geomática I y II'
  }
];

// Electivas slots
const ELECTIVA_SLOTS = {
  'ELECTIVA DE CARRERA I':       ['453036'],
  'ELECTIVA DE CARRERA II':      ['453041'],
  'ELECTIVA DE PROFUNDIZACIÓN I':['453045'],
  'ELECTIVA DE PROFUNDIZACIÓN II':['453050'],
  'ELECTIVA DE PROFUNDIZACIÓN III':['453056'],
  'ELECTIVA LIBRE I':            ['453042'],
  'ELECTIVA LIBRE II':           ['453051'],
};

// ──────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw data;
  return data;
}

function toast(text, type = 'success', duration = 4000) {
  const zone = document.getElementById('toast-zone');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  zone.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.25s ease forwards';
    setTimeout(() => el.remove(), 260);
  }, duration);
}

function initials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

function setProgress(pct) {
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (pct / 100) * circumference;
  const fill = document.getElementById('progress-ring-fill');
  if (fill) fill.style.strokeDashoffset = offset;
  const pctEl = document.getElementById('progress-pct');
  if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
}

// ──────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────
const TAB_TITLES = {
  estudiante: 'Gestión de Estudiante',
  malla:      'Malla Semestral',
  grafo:      'Grafo de Prerrequisitos',
  electivas:  'Electivas y Profundización'
};

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  document.getElementById('page-title').textContent = TAB_TITLES[tab] || tab;

  if (tab === 'grafo' && currentCurriculum) {
    setTimeout(() => buildGraph(), 100);
  }
  if (tab === 'electivas' && currentCurriculum) {
    renderElectivas();
  }
}

// ──────────────────────────────────────────────────────────
// STUDENTS
// ──────────────────────────────────────────────────────────
async function loadStudents() {
  const data = await apiFetch('/students');
  const sel = document.getElementById('student-select');
  sel.innerHTML = '<option value="">— Selecciona un estudiante —</option>';
  data.students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.full_name} — ${s.document_number}`;
    sel.appendChild(opt);
  });
}

document.getElementById('create-student-btn').addEventListener('click', async () => {
  const full_name = document.getElementById('full_name').value.trim();
  const document_number = document.getElementById('document_number').value.trim();
  if (!full_name || !document_number) { toast('Completa todos los campos.', 'error'); return; }

  try {
    const data = await apiFetch('/students', {
      method: 'POST',
      body: JSON.stringify({ full_name, document_number })
    });
    toast(data.message, 'success');
    document.getElementById('full_name').value = '';
    document.getElementById('document_number').value = '';
    await loadStudents();
    document.getElementById('student-select').value = data.student.id;
    await loadStudentCurriculum(data.student.id);
  } catch (err) {
    toast(err.message || 'Error al crear estudiante.', 'error');
  }
});

document.getElementById('load-student-btn').addEventListener('click', async () => {
  const id = document.getElementById('student-select').value;
  if (!id) { toast('Selecciona un estudiante.', 'error'); return; }
  try {
    await loadStudentCurriculum(id);
  } catch (err) {
    toast(err.message || 'Error al cargar estudiante.', 'error');
  }
});

async function loadStudentCurriculum(studentId) {
  const data = await apiFetch(`/students/${studentId}/curriculum`);
  currentStudentId = studentId;
  currentCurriculum = data;
  renderAll(data);
}

// ──────────────────────────────────────────────────────────
// RENDER ALL
// ──────────────────────────────────────────────────────────
function renderAll(data) {
  updateSidebar(data);
  renderApprovePanel(data);
  renderCurriculumGrid(data);
  buildAreaFilters(data);
  if (activeTab === 'grafo') buildGraph();
  if (activeTab === 'electivas') renderElectivas();
}

// ──────────────────────────────────────────────────────────
// SIDEBAR
// ──────────────────────────────────────────────────────────
function updateSidebar(data) {
  const panel = document.getElementById('sidebar-student');
  panel.hidden = false;

  document.getElementById('sidebar-avatar').textContent = initials(data.student.full_name);
  document.getElementById('sidebar-name').textContent = data.student.full_name;
  document.getElementById('sidebar-doc').textContent = data.student.document_number;
  document.getElementById('sb-approved').textContent = data.summary.approved;
  document.getElementById('sb-available').textContent = data.summary.available;
  document.getElementById('sb-blocked').textContent = data.summary.blocked;

  const total = data.courses.length;
  const pct = total ? (data.summary.approved / total) * 100 : 0;
  setProgress(pct);
}

// ──────────────────────────────────────────────────────────
// APPROVE PANEL
// ──────────────────────────────────────────────────────────
function renderApprovePanel(data) {
  const panel = document.getElementById('approve-panel');
  panel.hidden = false;

  const sel = document.getElementById('available-course-select');
  const available = data.courses.filter(c => c.status === 'available');
  sel.innerHTML = '<option value="">— Selecciona materia disponible —</option>';
  available.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.code} — ${c.name}`;
    sel.appendChild(opt);
  });
}

document.getElementById('approve-course-btn').addEventListener('click', async () => {
  const code = document.getElementById('available-course-select').value;
  if (!currentStudentId) { toast('Carga un estudiante primero.', 'error'); return; }
  if (!code) { toast('Selecciona una materia.', 'error'); return; }

  try {
    const data = await apiFetch(`/students/${currentStudentId}/approved-courses`, {
      method: 'POST',
      body: JSON.stringify({ course_code: code })
    });
    currentCurriculum = { ...data, student: currentCurriculum.student };
    toast(data.message, 'success');
    renderAll(currentCurriculum);
  } catch (err) {
    const missing = err.missingPrerequisites?.length
      ? ' Faltan: ' + err.missingPrerequisites.map(i => i.code).join(', ')
      : '';
    toast((err.message || 'Error.') + missing, 'error');
  }
});

// ──────────────────────────────────────────────────────────
// CURRICULUM GRID
// ──────────────────────────────────────────────────────────
function buildAreaFilters(data) {
  const areas = [...new Set(data.courses.map(c => c.area))].sort();
  const container = document.getElementById('area-filters');
  container.innerHTML = '<button class="pill active" data-filter="all">Todas las áreas</button>';
  areas.forEach(area => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.dataset.filter = area;
    btn.textContent = area;
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

function renderCurriculumGrid(data) {
  const grid = document.getElementById('curriculum-grid');
  const filtered = activeAreaFilter === 'all'
    ? data.courses
    : data.courses.filter(c => c.area === activeAreaFilter);

  const semesters = new Map();
  filtered.forEach(c => {
    if (!semesters.has(c.semester)) semesters.set(c.semester, []);
    semesters.get(c.semester).push(c);
  });

  grid.innerHTML = '';
  [...semesters.entries()].sort((a,b) => a[0]-b[0]).forEach(([sem, courses]) => {
    const col = document.createElement('div');
    col.className = 'semester-col';

    const header = document.createElement('h3');
    header.textContent = `Semestre ${sem}`;
    col.appendChild(header);

    courses.forEach(course => {
      col.appendChild(buildCourseCard(course));
    });

    grid.appendChild(col);
  });
}

function buildCourseCard(course) {
  const div = document.createElement('div');
  div.className = `course-card ${course.status}`;
  div.dataset.code = course.code;

  const reqs = course.prerequisites.length
    ? course.prerequisites.join(', ')
    : 'Sin prerrequisitos';

  const missing = course.missingPrerequisites.length
    ? `<div class="c-missing">⚠ Faltan: ${course.missingPrerequisites.join(', ')}</div>`
    : '';

  const removeBtn = course.status === 'approved'
    ? `<button class="btn-danger remove-btn" data-code="${course.code}">✕ Quitar aprobación</button>`
    : '';

  div.innerHTML = `
    <div class="c-code">${course.code}</div>
    <div class="c-name">${course.name}</div>
    <div class="c-meta">
      <span class="c-credits">◆ ${course.credits} cr.</span>
    </div>
    <div class="c-reqs">Prerreq: ${reqs}</div>
    ${missing}
    <div class="c-area">${course.area}</div>
    ${removeBtn}
  `;

  const btn = div.querySelector('.remove-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const data = await apiFetch(`/students/${currentStudentId}/approved-courses/${course.code}`, { method: 'DELETE' });
        currentCurriculum = { ...data, student: currentCurriculum.student };
        toast(data.message, 'success');
        renderAll(currentCurriculum);
      } catch (err) {
        const deps = err.dependentCourses?.length
          ? ' Dependen: ' + err.dependentCourses.map(i => i.code).join(', ')
          : '';
        toast((err.message || 'Error.') + deps, 'error');
      }
    });
  }

  return div;
}

// ──────────────────────────────────────────────────────────
// SEARCH
// ──────────────────────────────────────────────────────────
const searchInput = document.getElementById('course-search');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q || !currentCurriculum) {
    searchDropdown.hidden = true;
    clearHighlights();
    return;
  }

  const matches = currentCurriculum.courses.filter(c =>
    c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );

  if (!matches.length) {
    searchDropdown.innerHTML = '<div class="search-item"><div class="search-item-name" style="color:var(--text3)">Sin resultados</div></div>';
    searchDropdown.hidden = false;
    return;
  }

  searchDropdown.innerHTML = '';
  matches.slice(0, 10).forEach(c => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `
      <div class="search-item-code">${c.code}</div>
      <div class="search-item-name">${c.name}</div>
      <div class="search-item-meta">
        Sem. ${c.semester} · ${c.credits} cr.
        <span class="status-badge ${c.status}">${statusLabel(c.status)}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      searchDropdown.hidden = true;
      searchInput.value = '';
      highlightCourse(c.code);
      // Switch to malla tab
      if (activeTab !== 'malla') switchTab('malla');
      setTimeout(() => scrollToCourse(c.code), 150);
    });
    searchDropdown.appendChild(item);
  });
  searchDropdown.hidden = false;
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    searchDropdown.hidden = true;
  }
});

function statusLabel(s) {
  return { approved: 'Aprobada', available: 'Disponible', blocked: 'Bloqueada' }[s] || s;
}

function highlightCourse(code) {
  clearHighlights();
  setTimeout(() => {
    const card = document.querySelector(`.course-card[data-code="${code}"]`);
    if (card) {
      card.classList.add('highlight-search');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('highlight-search'), 3000);
    }
  }, 100);
}

function scrollToCourse(code) {
  const card = document.querySelector(`.course-card[data-code="${code}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearHighlights() {
  document.querySelectorAll('.course-card.highlight-search').forEach(c => c.classList.remove('highlight-search'));
}

// ──────────────────────────────────────────────────────────
// CYTOSCAPE GRAPH
// ──────────────────────────────────────────────────────────
function buildGraph() {
  if (!currentCurriculum) return;

  const container = document.getElementById('cy-container');
  const emptyMsg = document.getElementById('grafo-empty');
  if (emptyMsg) emptyMsg.remove();

  const statusColor = {
    approved: '#10b981',
    available: '#f59e0b',
    blocked: '#4b5563'
  };

  const nodes = currentCurriculum.courses.map(c => ({
    data: {
      id: c.code,
      label: c.code,
      fullName: c.name,
      credits: c.credits,
      semester: c.semester,
      status: c.status,
      area: c.area,
      color: statusColor[c.status] || '#4b5563'
    }
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
      {
        selector: 'node',
        style: {
          'background-color': 'ele(color)',
          'label': 'data(label)',
          'color': '#e2e8f0',
          'font-family': 'Space Mono, monospace',
          'font-size': '9px',
          'font-weight': '700',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 46,
          'height': 46,
          'border-width': 2,
          'border-color': 'ele(color)',
          'border-opacity': 0.6,
          'text-outline-color': '#080c14',
          'text-outline-width': 2,
        }
      },
      {
        selector: 'node[status="approved"]',
        style: {
          'background-color': '#10b981',
          'border-color': '#6ee7b7',
          'border-width': 2,
        }
      },
      {
        selector: 'node[status="available"]',
        style: {
          'background-color': '#d97706',
          'border-color': '#fcd34d',
          'border-width': 2,
        }
      },
      {
        selector: 'node[status="blocked"]',
        style: {
          'background-color': '#334155',
          'border-color': '#475569',
          'border-width': 1,
          'opacity': 0.7,
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#3b82f6',
          'box-shadow': '0 0 0 4px rgba(59,130,246,0.4)',
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#334155',
          'target-arrow-color': '#475569',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 0.8,
          'opacity': 0.6,
        }
      },
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': '#3b82f6',
          'target-arrow-color': '#3b82f6',
          'width': 2.5,
          'opacity': 1,
        }
      },
      {
        selector: 'node.faded',
        style: { 'opacity': 0.2 }
      },
      {
        selector: 'edge.faded',
        style: { 'opacity': 0.1 }
      }
    ],
    layout: {
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.6,
      padding: 30,
      avoidOverlap: true,
    },
    wheelSensitivity: 0.3,
    userZoomingEnabled: true,
    userPanningEnabled: true,
  });

  // Tooltip on hover
  const tooltip = document.getElementById('cy-tooltip');

  cyInstance.on('mouseover', 'node', e => {
    const node = e.target;
    const data = node.data();
    tooltip.hidden = false;
    tooltip.innerHTML = `
      <div class="tt-code">${data.id}</div>
      <div class="tt-name">${data.fullName}</div>
      <div class="tt-row">Semestre: ${data.semester} &nbsp;·&nbsp; Créditos: ${data.credits}</div>
      <div class="tt-row">Área: ${data.area}</div>
      <div class="tt-row">Estado: <span class="status-badge ${data.status}">${statusLabel(data.status)}</span></div>
    `;

    // Highlight neighbors
    cyInstance.elements().addClass('faded');
    node.removeClass('faded');
    node.connectedEdges().removeClass('faded').addClass('highlighted');
    node.neighborhood('node').removeClass('faded');
  });

  cyInstance.on('mousemove', e => {
    if (!tooltip.hidden) {
      tooltip.style.left = (e.originalEvent.clientX + 16) + 'px';
      tooltip.style.top  = (e.originalEvent.clientY + 16) + 'px';
    }
  });

  cyInstance.on('mouseout', 'node', () => {
    tooltip.hidden = true;
    cyInstance.elements().removeClass('faded highlighted');
  });

  // Controls
  document.getElementById('grafo-fit').onclick = () => cyInstance.fit(undefined, 40);
  document.getElementById('grafo-layout').onclick = () => {
    cyInstance.layout({
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.6,
      padding: 30,
      avoidOverlap: true,
    }).run();
  };
}

// ──────────────────────────────────────────────────────────
// ELECTIVAS
// ──────────────────────────────────────────────────────────
function renderElectivas() {
  const grid = document.getElementById('lineas-grid');
  grid.innerHTML = '';

  LINEAS.forEach(linea => {
    const card = document.createElement('div');
    card.className = 'linea-card';

    const courses = linea.codes.map(code => {
      const c = currentCurriculum?.courses.find(x => x.code === code);
      return c || { code, name: code, status: 'blocked', credits: 0 };
    });

    card.innerHTML = `
      <div class="linea-header">
        <div class="linea-icon" style="background:${linea.bg}; color:${linea.color}">${linea.icon}</div>
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
            <span class="elec-status">
              <span class="status-badge ${c.status}">${statusLabel(c.status)}</span>
            </span>
          </div>
        `).join('')}
      </div>
    `;
    grid.appendChild(card);
  });

  // Electivas slots
  if (currentCurriculum) {
    const minePanel = document.getElementById('electivas-mine');
    const status = document.getElementById('electivas-status');
    minePanel.hidden = false;

    const electivaCodes = ['453036','453041','453042','453045','453050','453051','453056'];
    const myElectivas = currentCurriculum.courses.filter(c => electivaCodes.includes(c.code));

    if (!myElectivas.length) {
      status.innerHTML = '<p style="color:var(--text3);font-size:13px">No hay electivas en la malla cargada.</p>';
      return;
    }

    status.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${myElectivas.map(c => `
          <div class="course-card ${c.status}" style="min-width:220px;flex:1">
            <div class="c-code">${c.code}</div>
            <div class="c-name">${c.name}</div>
            <div class="c-meta"><span class="c-credits">◆ ${c.credits} cr.</span></div>
            <div class="c-area">${c.area}</div>
            <div style="margin-top:6px"><span class="status-badge ${c.status}">${statusLabel(c.status)}</span></div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// ──────────────────────────────────────────────────────────
// PDF EXPORT
// ──────────────────────────────────────────────────────────
document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);

function exportPDF() {
  if (!currentCurriculum) { toast('Carga un estudiante primero.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const student = currentCurriculum.student;
  const summary = currentCurriculum.summary;
  const courses = currentCurriculum.courses;
  const total = courses.length;
  const pct = total ? Math.round((summary.approved / total) * 100) : 0;

  // Header block
  doc.setFillColor(8, 12, 20);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(20, 29, 46);
  doc.roundedRect(10, 10, 190, 40, 4, 4, 'F');

  doc.setTextColor(227, 232, 240);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MALLA CURRICULAR', 20, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Ingeniería Ambiental', 20, 31);

  doc.setFontSize(11);
  doc.setTextColor(227, 232, 240);
  doc.setFont('helvetica', 'bold');
  doc.text(student.full_name, 20, 41);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Doc: ${student.document_number}  ·  Generado: ${new Date().toLocaleDateString('es-CO')}`, 20, 47);

  // Summary boxes
  const boxes = [
    { label: 'Aprobadas', value: summary.approved, color: [16, 185, 129] },
    { label: 'Disponibles', value: summary.available, color: [245, 158, 11] },
    { label: 'Bloqueadas', value: summary.blocked, color: [75, 85, 99] },
    { label: 'Progreso', value: `${pct}%`, color: [59, 130, 246] }
  ];

  boxes.forEach((box, i) => {
    const x = 10 + i * 48;
    doc.setFillColor(...box.color, 30);
    doc.roundedRect(x, 54, 44, 20, 3, 3, 'F');
    doc.setDrawColor(...box.color);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, 54, 44, 20, 3, 3, 'S');

    doc.setTextColor(...box.color);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(box.value), x + 22, 63, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(box.label.toUpperCase(), x + 22, 70, { align: 'center' });
  });

  // Table data grouped by semester
  const semesters = new Map();
  courses.forEach(c => {
    if (!semesters.has(c.semester)) semesters.set(c.semester, []);
    semesters.get(c.semester).push(c);
  });

  const tableRows = [];
  [...semesters.entries()].sort((a,b) => a[0]-b[0]).forEach(([sem, cList]) => {
    cList.forEach(c => {
      const statusLbl = { approved: 'Aprobada', available: 'Disponible', blocked: 'Bloqueada' }[c.status];
      tableRows.push([
        `Sem. ${sem}`,
        c.code,
        c.name,
        String(c.credits),
        statusLbl
      ]);
    });
  });

  doc.autoTable({
    startY: 80,
    head: [['Sem.', 'Código', 'Materia', 'Cr.', 'Estado']],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
      textColor: [227, 232, 240],
      fillColor: [13, 18, 32],
      lineColor: [26, 37, 64],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [20, 29, 46],
      textColor: [148, 163, 184],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [20, 29, 46],
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 22, font: 'courier', fontSize: 7 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const val = data.cell.raw;
        if (val === 'Aprobada')   { data.cell.styles.textColor = [110, 231, 183]; }
        if (val === 'Disponible') { data.cell.styles.textColor = [252, 211, 77]; }
        if (val === 'Bloqueada')  { data.cell.styles.textColor = [100, 116, 139]; }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // Footer
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Software de Malla Curricular · Ingeniería Ambiental', 105, pageH - 8, { align: 'center' });

  doc.save(`malla-${student.document_number}-${Date.now()}.pdf`);
  toast('PDF exportado correctamente.', 'success');
}

// ──────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────
loadStudents().catch(() => {
  toast('No se pudieron cargar los estudiantes. Verifica que el backend esté activo.', 'error');
});
