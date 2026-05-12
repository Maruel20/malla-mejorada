/* =====================================================
   MALLA CURRICULAR v3 — app.js
   ===================================================== */

const API = 'http://localhost:3000/api';

// ── Estado ───────────────────────────────────────────
let token      = localStorage.getItem('mc_token') || '';
let estudiante = null;
let malla      = null;
let cy         = null;
let tabActual  = 'malla';
let areaFiltro = 'todas';
let modalSem   = null;

// ── Utilidades ───────────────────────────────────────
async function api(path, opts = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  try {
    const r = await fetch(API + path, { headers: h, ...opts });
    const d = await r.json();
    if (!r.ok) throw new Error(d.msg || 'Error del servidor');
    return d;
  } catch (e) {
    if (e instanceof TypeError) throw new Error('No se pudo conectar al servidor (puerto 3000).');
    throw e;
  }
}

function toast(msg, tipo = 'ok', ms = 4000) {
  const z = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = msg;
  z.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, ms);
}

function ocultar(id)  { document.getElementById(id).classList.add('oculto'); }
function mostrar(id)  { document.getElementById(id).classList.remove('oculto'); }
function getEl(id)    { return document.getElementById(id); }
function setEl(id, v) { getEl(id).textContent = v; }

function iniciales(nombre, apellido) {
  return ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase();
}

// ── Auth — Tabs ───────────────────────────────────────
function mostrarLogin() {
  mostrar('form-login'); ocultar('form-registro');
  getEl('tab-login').classList.add('activo');
  getEl('tab-registro').classList.remove('activo');
  ocultar('error-login'); ocultar('error-registro');
}

function mostrarRegistro() {
  mostrar('form-registro'); ocultar('form-login');
  getEl('tab-registro').classList.add('activo');
  getEl('tab-login').classList.remove('activo');
  ocultar('error-login'); ocultar('error-registro');
}

function mostrarErrorAuth(id, msg) {
  const el = getEl(id);
  el.textContent = msg;
  el.classList.remove('oculto');
}

// ── Auth — Login ──────────────────────────────────────
getEl('btn-login').addEventListener('click', async () => {
  const cedula   = getEl('login-cedula').value.trim();
  const password = getEl('login-pass').value;
  ocultar('error-login');
  if (!cedula || !password) { mostrarErrorAuth('error-login', 'Ingresa cédula y contraseña.'); return; }

  const btn = getEl('btn-login');
  btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ cedula, password }) });
    token = d.token;
    estudiante = d.estudiante;
    localStorage.setItem('mc_token', token);
    iniciarApp();
  } catch (e) {
    mostrarErrorAuth('error-login', e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
});

['login-cedula','login-pass'].forEach(id =>
  getEl(id).addEventListener('keydown', e => { if (e.key === 'Enter') getEl('btn-login').click(); })
);

// ── Auth — Registro ───────────────────────────────────
getEl('btn-registro').addEventListener('click', async () => {
  const nombre   = getEl('reg-nombre').value.trim();
  const apellido = getEl('reg-apellido').value.trim();
  const cedula   = getEl('reg-cedula').value.trim();
  const password = getEl('reg-pass').value;
  const confirm  = getEl('reg-confirm').value;
  ocultar('error-registro');

  if (!nombre || !apellido || !cedula || !password)
    return mostrarErrorAuth('error-registro', 'Completa todos los campos.');
  if (password !== confirm)
    return mostrarErrorAuth('error-registro', 'Las contraseñas no coinciden.');
  if (password.length < 6)
    return mostrarErrorAuth('error-registro', 'La contraseña debe tener mínimo 6 caracteres.');

  const btn = getEl('btn-registro');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  try {
    const d = await api('/auth/registrar', { method: 'POST', body: JSON.stringify({ nombre, apellido, cedula, password }) });
    token = d.token;
    estudiante = d.estudiante;
    localStorage.setItem('mc_token', token);
    iniciarApp();
    toast(d.msg, 'ok');
  } catch (e) {
    mostrarErrorAuth('error-registro', e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Crear cuenta';
  }
});

// ── Arranque ──────────────────────────────────────────
async function arrancar() {
  if (!token) { mostrar('pantalla-auth'); return; }
  try {
    const d = await api('/auth/perfil');
    estudiante = d.estudiante;
    iniciarApp();
  } catch {
    token = '';
    localStorage.removeItem('mc_token');
    mostrar('pantalla-auth');
  }
}

async function iniciarApp() {
  ocultar('pantalla-auth');
  mostrar('app');
  await cargarMalla();
}

// ── Logout ────────────────────────────────────────────
getEl('btn-logout').addEventListener('click', () => {
  token = ''; estudiante = null; malla = null;
  localStorage.removeItem('mc_token');
  if (cy) { cy.destroy(); cy = null; }
  ocultar('app');
  mostrar('pantalla-auth');
  mostrarLogin();
  toast('Sesión cerrada.', 'info');
});

// ── Navegación ────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
});

function cambiarTab(tab) {
  tabActual = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => {
    if (p.id === 'tab-' + tab) p.classList.remove('oculto');
    else p.classList.add('oculto');
  });
  const titulos = { malla: 'Malla Semestral', grafo: 'Grafo de Prerrequisitos', electivas: 'Electivas y Profundización' };
  setEl('page-titulo', titulos[tab] || tab);

  if (tab === 'grafo' && malla) setTimeout(construirGrafo, 80);
  if (tab === 'electivas' && malla) pintarElectivas();

  if (window.innerWidth < 768) cerrarSidebar();
}

// ── Sidebar móvil ─────────────────────────────────────
function toggleSidebar() { getEl('sidebar').classList.toggle('abierto'); }
function cerrarSidebar() { getEl('sidebar').classList.remove('abierto'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.sidebar') && !e.target.closest('#menu-toggle')) cerrarSidebar();
});

// ── Carga de malla ────────────────────────────────────
async function cargarMalla() {
  try {
    const d = await api(`/students/${estudiante.id}/malla`);
    malla = d;
    pintarTodo(d);
  } catch (e) { toast(e.message, 'error'); }
}

function pintarTodo(d) {
  actualizarSidebar(d);
  construirFiltros(d);
  pintarGrid(d);
  if (tabActual === 'grafo')    setTimeout(construirGrafo, 80);
  if (tabActual === 'electivas') pintarElectivas();
}

// ── Sidebar datos ─────────────────────────────────────
function actualizarSidebar(d) {
  setEl('avatar',         iniciales(estudiante.nombre, estudiante.apellido));
  setEl('perfil-nombre',  `${estudiante.nombre} ${estudiante.apellido}`);
  setEl('perfil-cedula',  estudiante.cedula);
  setEl('st-aprobadas',   d.resumen.aprobadas);
  setEl('st-matriculadas',d.resumen.matriculadas);
  setEl('st-bloqueadas',  d.resumen.bloqueadas);
  setEl('st-promedio',    d.promedio.toFixed(2));

  const pct = d.materias.length ? (d.resumen.aprobadas / d.materias.length) * 100 : 0;
  const circ = 2 * Math.PI * 32;
  const fill = getEl('anillo-fill');
  fill.style.strokeDashoffset = circ - (pct / 100) * circ;
  setEl('anillo-pct', Math.round(pct) + '%');
}

// ── Filtros de área ───────────────────────────────────
function construirFiltros(d) {
  const areas = [...new Set(d.materias.map(m => m.area))].sort();
  const cont = getEl('filtros-area');
  cont.innerHTML = '<button class="pill activo" data-area="todas">Todas las áreas</button>';
  areas.forEach(a => {
    const b = document.createElement('button');
    b.className = 'pill'; b.dataset.area = a; b.textContent = a;
    cont.appendChild(b);
  });
  cont.querySelectorAll('.pill').forEach(b => b.addEventListener('click', () => {
    cont.querySelectorAll('.pill').forEach(x => x.classList.remove('activo'));
    b.classList.add('activo');
    areaFiltro = b.dataset.area;
    pintarGrid(malla);
  }));
}

// ── Grid principal ────────────────────────────────────
function pintarGrid(d) {
  const grid = getEl('grid-malla');
  const filtradas = areaFiltro === 'todas' ? d.materias : d.materias.filter(m => m.area === areaFiltro);
  const semMap = new Map();
  filtradas.forEach(m => {
    if (!semMap.has(m.semestre)) semMap.set(m.semestre, []);
    semMap.get(m.semestre).push(m);
  });
  const desbloq = new Set(d.semestresDesbloqueados);
  grid.innerHTML = '';

  [...semMap.entries()].sort((a, b) => a[0] - b[0]).forEach(([sem, lista]) => {
    const unlocked  = desbloq.has(sem);
    const stats     = d.statsSem[sem] || { total: 0, aprobados: 0 };
    const completo  = unlocked && stats.aprobados >= 12;

    const col = document.createElement('div');
    col.className = 'sem-col' + (unlocked ? '' : ' sem-bloqueado');

    // Cabecera del semestre
    const badgeClass = completo ? 'badge-ok' : unlocked ? 'badge-activo' : 'badge-lock';
    const badgeTxt   = completo ? '✓ Completado' : unlocked ? '◎ En curso' : '🔒 Bloqueado';
    const pctBar     = stats.total ? Math.min(100, (stats.aprobados / stats.total) * 100) : 0;

    col.innerHTML = `
      <div class="sem-header">
        <div class="sem-fila-titulo">
          <span class="sem-num">Semestre ${sem}</span>
          <span class="sem-badge ${badgeClass}">${badgeTxt}</span>
        </div>
        <div class="sem-barra-wrap">
          <div class="sem-barra-fill" style="width:${pctBar}%"></div>
        </div>
        <div class="sem-cr-txt">${stats.aprobados}/${stats.total} cr. aprobados</div>
      </div>
    `;

    if (!unlocked) {
      const prev = d.statsSem[sem - 1] || { aprobados: 0 };
      const needed = Math.max(0, 12 - prev.aprobados);
      col.innerHTML += `<div class="sem-lock-msg">🔒 Necesitas ${needed} cr. más del semestre ${sem - 1}</div>`;
      lista.forEach(m => col.appendChild(tarjetaMateria(m, false)));
    } else {
      // Botón matricular (solo si hay materias disponibles y es sem > 1)
      const hayDisp   = d.materias.filter(m => m.semestre === sem && m.estado === 'disponible').length > 0;
      const hayInscritas = d.materias.filter(m => m.semestre === sem && ['matriculada','aprobada','reprobada'].includes(m.estado)).length > 0;
      if (sem > 1 && hayDisp && !hayInscritas) {
        const btn = document.createElement('button');
        btn.className = 'btn-matricular-sem';
        btn.textContent = `📋 Matricular Semestre ${sem}`;
        btn.onclick = () => abrirModal(sem, d);
        col.appendChild(btn);
      }
      lista.forEach(m => col.appendChild(tarjetaMateria(m, true)));
    }

    grid.appendChild(col);
  });
}

// ── Tarjeta de materia ────────────────────────────────
function tarjetaMateria(m, desbloqueado) {
  const div = document.createElement('div');
  div.className = `materia-card ${m.estado}`;
  div.dataset.codigo = m.codigo;

  const prereqsTxt = m.prereqs.length ? m.prereqs.join(', ') : 'Sin prerrequisitos';
  const faltanHtml = m.faltanPrereqs?.length
    ? `<div class="mat-falta">⚠ Prereqs: ${m.faltanPrereqs.join(', ')}</div>` : '';

  let notaHtml = '';
  if (desbloqueado && m.estado !== 'bloqueada' && m.estado !== 'bloqueado_sem') {
    if (m.estado === 'aprobada' || m.estado === 'reprobada' || m.estado === 'matriculada') {
      const color = m.nota === null ? '#94a3b8' : m.nota >= 3.0 ? '#10b981' : '#ef4444';
      const txt   = m.nota !== null ? `★ ${m.nota}` : 'Sin nota';
      notaHtml = `
        <div class="nota-seccion">
          <span class="nota-badge" style="color:${color}">${txt}</span>
          <div class="nota-acciones">
            <button class="btn-editar-nota" data-codigo="${m.codigo}">✏ Editar</button>
            <button class="btn-quitar"      data-codigo="${m.codigo}">✕ Quitar</button>
          </div>
        </div>
        <div class="nota-form oculto" id="nf-${m.codigo}">
          <input type="number" class="nota-input" step="0.1" min="1.0" max="5.0"
                 placeholder="1.0 – 5.0" value="${m.nota ?? ''}"/>
          <button class="btn-guardar-nota" data-codigo="${m.codigo}">✓</button>
          <button class="btn-cancelar-nota" data-codigo="${m.codigo}">✕</button>
        </div>`;
    } else if (m.estado === 'disponible') {
      notaHtml = `
        <div class="nota-seccion">
          <span class="nota-badge" style="color:#94a3b8">Sin nota</span>
          <div class="nota-acciones">
            <button class="btn-agregar-nota" data-codigo="${m.codigo}">+ Nota</button>
          </div>
        </div>
        <div class="nota-form oculto" id="nf-${m.codigo}">
          <input type="number" class="nota-input" step="0.1" min="1.0" max="5.0" placeholder="1.0 – 5.0"/>
          <button class="btn-guardar-nota" data-codigo="${m.codigo}">✓</button>
          <button class="btn-cancelar-nota" data-codigo="${m.codigo}">✕</button>
        </div>`;
    }
  }

  div.innerHTML = `
    <div class="mat-cab">
      <span class="mat-cod">${m.codigo}</span>
      <span class="dot-estado ${m.estado}"></span>
    </div>
    <div class="mat-nombre">${m.nombre}</div>
    <div class="mat-meta">
      <span class="mat-cr">◆ ${m.creditos} cr.</span>
      <span class="mat-area">${m.area}</span>
    </div>
    <div class="mat-prereq" title="${prereqsTxt}">Prereq: ${prereqsTxt}</div>
    ${faltanHtml}
    ${notaHtml}
  `;

  // Eventos CRUD
  div.querySelector('.btn-editar-nota')?.addEventListener('click', () => {
    mostrar('nf-' + m.codigo);
    div.querySelector('.btn-editar-nota').style.display = 'none';
  });
  div.querySelector('.btn-agregar-nota')?.addEventListener('click', () => {
    mostrar('nf-' + m.codigo);
    div.querySelector('.btn-agregar-nota').style.display = 'none';
  });
  div.querySelector('.btn-cancelar-nota')?.addEventListener('click', () => {
    ocultar('nf-' + m.codigo);
    div.querySelector('.btn-editar-nota')  && (div.querySelector('.btn-editar-nota').style.display  = '');
    div.querySelector('.btn-agregar-nota') && (div.querySelector('.btn-agregar-nota').style.display = '');
  });
  div.querySelector('.btn-guardar-nota')?.addEventListener('click', () => {
    const input = div.querySelector('.nota-input');
    const nota  = parseFloat(input.value);
    if (isNaN(nota) || nota < 1 || nota > 5) { toast('Nota inválida (1.0 – 5.0)', 'error'); return; }
    enviarNota(m.codigo, nota);
  });
  div.querySelector('.nota-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') div.querySelector('.btn-guardar-nota')?.click();
  });
  div.querySelector('.btn-quitar')?.addEventListener('click', () => {
    if (confirm(`¿Quitar "${m.nombre}"?`)) quitarMateria(m.codigo);
  });

  return div;
}

async function enviarNota(codigo, nota) {
  try {
    const d = await api(`/students/${estudiante.id}/nota/${codigo}`,
      { method: 'PUT', body: JSON.stringify({ nota }) });
    malla = d;
    toast(d.msg, nota >= 3 ? 'ok' : 'warn');
    pintarTodo(malla);
  } catch (e) { toast(e.message, 'error'); }
}

async function quitarMateria(codigo) {
  try {
    const d = await api(`/students/${estudiante.id}/materia/${codigo}`, { method: 'DELETE' });
    malla = d; toast(d.msg, 'ok'); pintarTodo(malla);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Modal de matrícula ────────────────────────────────
function abrirModal(sem, d) {
  modalSem = sem;
  setEl('modal-titulo', `Matricular Semestre ${sem}`);
  ocultar('modal-error');

  const disponibles = d.materias.filter(m => m.semestre === sem && m.estado === 'disponible');
  const lista = getEl('lista-matricula');
  lista.innerHTML = '';

  disponibles.forEach(m => {
    const lbl = document.createElement('label');
    lbl.className = 'mat-check-row';
    lbl.innerHTML = `
      <input type="checkbox" class="mat-chk" value="${m.codigo}" data-cr="${m.creditos}" checked/>
      <div class="mat-check-info">
        <span class="mat-cod">${m.codigo}</span>
        <span class="mat-check-nombre">${m.nombre}</span>
      </div>
      <span class="mat-check-cr">${m.creditos} cr.</span>
    `;
    lista.appendChild(lbl);
  });

  actualizarContadorModal();
  lista.querySelectorAll('.mat-chk').forEach(c => c.addEventListener('change', actualizarContadorModal));

  mostrar('modal-matricula');
  getEl('btn-confirmar-matricula').onclick = confirmarMatricula;
}

function actualizarContadorModal() {
  const checks = [...document.querySelectorAll('.mat-chk:checked')];
  const total  = checks.reduce((s, c) => s + Number(c.dataset.cr), 0);
  const el = getEl('cr-seleccionados');
  el.textContent = total;
  el.className   = 'cr-num ' + (total < 12 ? 'cr-bajo' : total > 20 ? 'cr-alto' : 'cr-ok');
}

function cerrarModal() {
  ocultar('modal-matricula');
  modalSem = null;
}

async function confirmarMatricula() {
  const checks = [...document.querySelectorAll('.mat-chk:checked')];
  const codigos = checks.map(c => c.value);
  const total   = checks.reduce((s, c) => s + Number(c.dataset.cr), 0);
  const errEl   = getEl('modal-error');

  if (total < 12 || total > 20) {
    errEl.textContent = total < 12
      ? `Mínimo 12 créditos. Tienes ${total}.`
      : `Máximo 20 créditos. Tienes ${total}.`;
    errEl.classList.remove('oculto'); return;
  }
  ocultar('modal-error');

  const btn = getEl('btn-confirmar-matricula');
  btn.disabled = true; btn.textContent = 'Matriculando…';
  try {
    const d = await api(`/students/${estudiante.id}/matricular`,
      { method: 'POST', body: JSON.stringify({ semestre: modalSem, codigos }) });
    malla = d; toast(d.msg, 'ok');
    cerrarModal(); pintarTodo(malla);
  } catch (e) {
    errEl.textContent = e.message; errEl.classList.remove('oculto');
  } finally {
    btn.disabled = false; btn.textContent = 'Matricular';
  }
}

// ── Buscador ──────────────────────────────────────────
getEl('buscador').addEventListener('input', function () {
  const q  = this.value.trim().toLowerCase();
  const dd = getEl('buscador-dropdown');
  if (!q || !malla) { dd.classList.add('oculto'); return; }

  const res = malla.materias.filter(m =>
    m.codigo.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q)
  ).slice(0, 10);

  dd.innerHTML = '';
  if (!res.length) {
    dd.innerHTML = '<div class="dd-item" style="color:#475569">Sin resultados</div>';
  } else {
    res.forEach(m => {
      const it = document.createElement('div');
      it.className = 'dd-item';
      it.innerHTML = `<span class="dd-cod">${m.codigo}</span><span class="dd-nom">${m.nombre}</span>
        <span class="dd-meta">Sem ${m.semestre} · ${m.creditos}cr · <span class="dot-est ${m.estado}">${estadoLabel(m.estado)}</span></span>`;
      it.onclick = () => {
        dd.classList.add('oculto'); this.value = '';
        if (tabActual !== 'malla') cambiarTab('malla');
        setTimeout(() => {
          const card = document.querySelector(`.materia-card[data-codigo="${m.codigo}"]`);
          if (card) { card.classList.add('resaltada'); card.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => card.classList.remove('resaltada'), 2500); }
        }, 150);
      };
      dd.appendChild(it);
    });
  }
  dd.classList.remove('oculto');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.busqueda-wrap')) getEl('buscador-dropdown').classList.add('oculto');
});

function estadoLabel(e) {
  return { aprobada:'Aprobada', reprobada:'Reprobada', matriculada:'Matriculada',
           disponible:'Disponible', bloqueada:'Bloqueada', bloqueado_sem:'Bloqueado' }[e] || e;
}

// ── Grafo Cytoscape ───────────────────────────────────
const COLOR_ESTADO = {
  aprobada:'#10b981', matriculada:'#3b82f6', disponible:'#f59e0b',
  reprobada:'#ef4444', bloqueada:'#4b5563',  bloqueado_sem:'#1e293b'
};

function construirGrafo() {
  if (!malla) return;
  const empty = getEl('cy-empty');
  if (empty) empty.remove();

  const nodes = malla.materias.map(m => ({
    data: { id: m.codigo, label: m.codigo, nombre: m.nombre, creditos: m.creditos,
            semestre: m.semestre, estado: m.estado, color: COLOR_ESTADO[m.estado] || '#4b5563' }
  }));
  const edges = [];
  malla.materias.forEach(m => m.prereqs.forEach(p => edges.push({ data: { source: p, target: m.codigo } })));

  if (cy) cy.destroy();
  cy = cytoscape({
    container: getEl('cy-container'),
    elements:  { nodes, edges },
    style: [
      { selector:'node', style:{ 'background-color':'data(color)', label:'data(label)', color:'#e2e8f0',
        'font-family':'Space Mono,monospace', 'font-size':'9px', 'font-weight':'bold',
        'text-valign':'center','text-halign':'center', width:46, height:46,
        'border-width':2, 'border-color':'data(color)', 'text-outline-color':'#080c14', 'text-outline-width':2 }},
      { selector:'node[estado="aprobada"]',    style:{ 'background-color':'#10b981','border-color':'#6ee7b7' }},
      { selector:'node[estado="matriculada"]', style:{ 'background-color':'#3b82f6','border-color':'#93c5fd' }},
      { selector:'node[estado="disponible"]',  style:{ 'background-color':'#d97706','border-color':'#fcd34d' }},
      { selector:'node[estado="reprobada"]',   style:{ 'background-color':'#ef4444','border-color':'#f87171' }},
      { selector:'node[estado="bloqueada"]',   style:{ 'background-color':'#334155','border-color':'#475569','opacity':0.7 }},
      { selector:'node[estado="bloqueado_sem"]',style:{ 'background-color':'#1e293b','border-color':'#334155','opacity':0.4 }},
      { selector:'edge', style:{ width:1.5,'line-color':'#334155','target-arrow-color':'#475569',
        'target-arrow-shape':'triangle','curve-style':'bezier','arrow-scale':0.8, opacity:0.6 }},
      { selector:'edge.hl', style:{ 'line-color':'#3b82f6','target-arrow-color':'#3b82f6', width:2.5, opacity:1 }},
      { selector:'node.faded', style:{ opacity:0.15 }},
      { selector:'edge.faded', style:{ opacity:0.07 }},
    ],
    layout:{ name:'breadthfirst', directed:true, spacingFactor:1.6, padding:30, avoidOverlap:true },
    userZoomingEnabled:true, userPanningEnabled:true,
  });

  const tip = getEl('cy-tooltip');
  cy.on('mouseover','node', e => {
    const d = e.target.data();
    tip.innerHTML = `<b>${d.id}</b><br>${d.nombre}<br>Sem. ${d.semestre} · ${d.creditos} cr.<br><i>${estadoLabel(d.estado)}</i>`;
    tip.classList.remove('oculto');
    cy.elements().addClass('faded');
    e.target.removeClass('faded').connectedEdges().removeClass('faded').addClass('hl');
    e.target.neighborhood('node').removeClass('faded');
  });
  cy.on('mousemove', e => {
    tip.style.left = (e.originalEvent.clientX + 14) + 'px';
    tip.style.top  = (e.originalEvent.clientY + 14) + 'px';
  });
  cy.on('mouseout','node', () => {
    tip.classList.add('oculto');
    cy.elements().removeClass('faded hl');
  });
}
function cyAjustar()     { cy?.fit(undefined, 40); }
function cyReorganizar() { cy?.layout({ name:'breadthfirst', directed:true, spacingFactor:1.6, padding:30, avoidOverlap:true }).run(); }

// ── Electivas ─────────────────────────────────────────
const LINEAS = [
  { nombre:'Recursos Hídricos',    icon:'💧', color:'#3b82f6', bg:'rgba(59,130,246,.15)',  codigos:['453034','453043','453039'] },
  { nombre:'Residuos y Suelos',    icon:'♻️', color:'#10b981', bg:'rgba(16,185,129,.15)', codigos:['453044','453048','453055'] },
  { nombre:'Calidad del Aire',     icon:'🌫️', color:'#8b5cf6', bg:'rgba(139,92,246,.15)', codigos:['453030','453049']          },
  { nombre:'Biotecnología',        icon:'🧬', color:'#f59e0b', bg:'rgba(245,158,11,.15)', codigos:['453109','453057','453026'] },
  { nombre:'Gestión y Geomática',  icon:'🗺️', color:'#ec4899', bg:'rgba(236,72,153,.15)',  codigos:['453033','453037','453038','453047'] },
];

function pintarElectivas() {
  const grid = getEl('lineas-grid');
  grid.innerHTML = '';
  LINEAS.forEach(l => {
    const card = document.createElement('div');
    card.className = 'linea-card';
    const items = l.codigos.map(c => {
      const m = malla?.materias.find(x => x.codigo === c) || { codigo: c, nombre: c, estado:'bloqueado_sem' };
      return `<div class="linea-materia">
        <span class="mat-cod">${m.codigo}</span>
        <span class="linea-mat-nombre">${m.nombre}</span>
        <span class="dot-estado ${m.estado}" title="${estadoLabel(m.estado)}"></span>
      </div>`;
    }).join('');
    card.innerHTML = `
      <div class="linea-head">
        <div class="linea-icono" style="background:${l.bg};color:${l.color}">${l.icon}</div>
        <div class="linea-titulo">${l.nombre}</div>
      </div>
      <div class="linea-cuerpo">${items}</div>`;
    grid.appendChild(card);
  });
}

// ── PDF ───────────────────────────────────────────────
function exportarPDF() {
  if (!malla) { toast('Carga la malla primero.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const est  = estudiante;
  const res  = malla.resumen;
  const total= malla.materias.length;
  const pct  = total ? Math.round((res.aprobadas / total) * 100) : 0;

  doc.setFillColor(8,12,20);   doc.rect(0,0,210,297,'F');
  doc.setFillColor(20,29,46);  doc.roundedRect(10,10,190,38,4,4,'F');
  doc.setTextColor(227,232,240); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('MALLA CURRICULAR', 20, 24);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  doc.text('Ingeniería Ambiental', 20, 30);
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(227,232,240);
  doc.text(`${est.nombre} ${est.apellido}`, 20, 39);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  doc.text(`Cédula: ${est.cedula}  ·  Promedio: ${malla.promedio}  ·  ${new Date().toLocaleDateString('es-CO')}`, 20, 45);

  const cajas = [
    ['Aprobadas', res.aprobadas, [16,185,129]], ['Matriculadas', res.matriculadas, [59,130,246]],
    ['Disponibles', res.disponibles, [245,158,11]], [`${pct}%`, 'Progreso', [139,92,246]]
  ];
  cajas.forEach(([val, lbl, c], i) => {
    const x = 10 + i*48;
    doc.setFillColor(...c, 25); doc.roundedRect(x,52,44,18,3,3,'F');
    doc.setDrawColor(...c); doc.setLineWidth(.3); doc.roundedRect(x,52,44,18,3,3,'S');
    doc.setTextColor(...c); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text(String(val), x+22, 60, { align:'center' });
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
    doc.text(String(lbl).toUpperCase(), x+22, 66, { align:'center' });
  });

  const rows = [];
  const sMap = new Map();
  malla.materias.forEach(m => { if (!sMap.has(m.semestre)) sMap.set(m.semestre, []); sMap.get(m.semestre).push(m); });
  [...sMap.entries()].sort((a,b)=>a[0]-b[0]).forEach(([s, ms]) =>
    ms.forEach(m => rows.push([`Sem.${s}`, m.codigo, m.nombre, m.creditos,
      m.nota !== null && m.nota !== undefined ? m.nota : '—',
      estadoLabel(m.estado)]))
  );

  doc.autoTable({
    startY:76, head:[['Sem.','Código','Materia','Cr.','Nota','Estado']], body:rows,
    styles:{ fontSize:7.5, textColor:[227,232,240], fillColor:[13,18,32], lineColor:[26,37,64], lineWidth:.25 },
    headStyles:{ fillColor:[20,29,46], textColor:[148,163,184], fontStyle:'bold', fontSize:6.5 },
    alternateRowStyles:{ fillColor:[20,29,46] },
    columnStyles:{ 0:{cellWidth:12},1:{cellWidth:18,font:'courier',fontSize:7},2:{cellWidth:'auto'},3:{cellWidth:8,halign:'center'},4:{cellWidth:10,halign:'center'},5:{cellWidth:20,halign:'center'} },
    didParseCell: d => {
      if (d.column.index===5 && d.section==='body') {
        const v=d.cell.raw;
        if(v==='Aprobada')    d.cell.styles.textColor=[110,231,183];
        if(v==='Reprobada')   d.cell.styles.textColor=[248,113,113];
        if(v==='Matriculada') d.cell.styles.textColor=[147,197,253];
        if(v==='Disponible')  d.cell.styles.textColor=[252,211,77];
      }
    },
    margin:{left:10,right:10}
  });

  doc.setFontSize(6); doc.setTextColor(71,85,105);
  doc.text('Malla Curricular · Ingeniería Ambiental', 105, doc.internal.pageSize.height-7, {align:'center'});
  doc.save(`malla-${est.cedula}.pdf`);
  toast('PDF exportado.', 'ok');
}

// ── Arrancar ──────────────────────────────────────────
arrancar();
