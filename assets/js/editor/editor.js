// Editor de modelos CSS 3D por capas (zócalo → cuerpo → frentes → tiradores).
// Vista 3D para revisar y vista Frente (ortogonal, a escala) para dibujar, dividir y medir en cm.
import { createStage } from '../css3d/engine.js';
import { dibujar, celdas, limites, nuevoModulo, uid, TIRADORES, TIPOS_FRENTE, muros as murosDe, rotarEnCentro } from './modelo.js';
import { crearPlanta } from './planta.js';
import { crearReferencias } from './referencia.js';
import { PLANTILLAS, ETIQUETAS, generar, parametrosIniciales, leerPlantilla } from './plantillas.js';
import { iniciarProyectos, aModelo } from './proyecto.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;            // redondeo a 1 mm
const snap = (v, paso = .5) => Math.round(v / paso) * paso;
const cm = (v) => `${r1(v)}`.replace('.', ',');       // 12.5 → "12,5"
const SVG = 'http://www.w3.org/2000/svg';
const CLAVE = 'dm-editor-modelo';

const lienzo = $('#lienzo'), escena = $('#escena'), plano = $('#plano'), estadoEl = $('#estado');
const st = createStage(escena, { rx: -20, ry: -30, minRx: -70, maxRx: 0 });

// ===================== estado =====================
let modelo = cargar() || ejemplo();
let sel = null;            // { tipo: 'modulo'|'zocalo'|'cuerpo'|'frente'|'tirador'|'cubierta', m, col, fila, t }
let vista = '3d';          // '3d' | 'frente' | 'planta'
let herr = 'sel';          // 'sel' | 'dibujar' | 'div-v' | 'div-h' | 'muros'
let zoom = 1;
const capas = { zocalo: true, cuerpo: true, frentes: true, tiradores: true, cubierta: true, muros: true };
let proyActual = null;     // { id, sha, raw } cuando se edita un proyecto de cliente
let pines = [];            // comentarios del cliente con posición en el modelo
let pinFoco = null;
const hist = [], fut = [];

function ejemplo() {
  const m = nuevoModulo({ x: 0, ancho: 120, alto: 88 });
  m.nombre = 'Cajonera + puerta';
  m.columnas = [
    { ancho: 60, frentes: [{ tipo: 'cajon', alto: 18 }, { tipo: 'cajon', alto: 30 }, { tipo: 'cajon', alto: 30 }] },
    { ancho: 60, frentes: [{ tipo: 'puerta', alto: 78, bisagra: 'derecha' }] },
  ];
  m.tiradores = [
    { id: uid('t'), modelo: 'barra-128', color: 'negro', col: 0, fila: 0, dx: 0, dy: 0, rot: 0 },
    { id: uid('t'), modelo: 'barra-128', color: 'negro', col: 0, fila: 1, dx: 0, dy: 8, rot: 0 },
    { id: uid('t'), modelo: 'barra-128', color: 'negro', col: 0, fila: 2, dx: 0, dy: 8, rot: 0 },
    { id: uid('t'), modelo: 'barra-192', color: 'negro', col: 1, fila: 0, dx: -25, dy: 22, rot: 90 },
  ];
  m.x = 30;
  const espacio = {
    alto: 240, cerrado: true,
    puntos: [{ x: 0, z: 0 }, { x: 320, z: 0 }, { x: 320, z: 260 }, { x: 0, z: 260 }],
    muros: [{ etiqueta: 'Muro ladrillo princesa', espesor: 15 }, { etiqueta: 'Tabique', espesor: 10 }, { etiqueta: '', espesor: 15 }, { etiqueta: 'Tabique', espesor: 10 }],
  };
  return { nombre: 'Mueble de ejemplo', frente: (window.MELAMINAS || [])[0]?.id || '', espacio, modulos: [m] };
}
function cargar() {
  try { const d = JSON.parse(localStorage.getItem(CLAVE)); return d?.modulos ? d : null; } catch (e) { return null; }
}
// Borrador local: el modelo suelto, o uno por proyecto (ligado a la versión del repo que se abrió).
const claveProy = (id) => `dm-editor:${id}`;
function guardar() {
  try {
    if (proyActual) localStorage.setItem(claveProy(proyActual.id), JSON.stringify({ sha: proyActual.sha, modelo }));
    else localStorage.setItem(CLAVE, JSON.stringify(modelo));
  } catch (e) {}
}

const modulo = (id) => modelo.modulos.find((m) => m.id === id);
const Zde = (m) => (m.tipo === 'aereo' ? 0 : (+m.zocalo || 0));

// Cambia el modelo dejando un paso en el historial (deshacer).
function cambiar(fn) {
  hist.push(JSON.stringify(modelo)); if (hist.length > 150) hist.shift();
  fut.length = 0;
  fn(modelo);
  modelo.modulos.forEach(normalizar);
  guardar(); render();
}
function deshacer() { if (!hist.length) return; fut.push(JSON.stringify(modelo)); modelo = JSON.parse(hist.pop()); validarSel(); guardar(); render(); }
function rehacer() { if (!fut.length) return; hist.push(JSON.stringify(modelo)); modelo = JSON.parse(fut.pop()); validarSel(); guardar(); render(); }
function validarSel() {
  if (sel?.tipo === 'muro') { if (!murosDe(modelo.espacio)[sel.i]) sel = null; }
  else if (sel && !modulo(sel.m)) sel = null;
}
// Termina un gesto de arrastre: si cambió algo, queda un paso en el historial.
function registrar(antes) {
  if (JSON.stringify(modelo) !== antes) { hist.push(antes); fut.length = 0; modelo.modulos.forEach(normalizar); guardar(); }
  render();
}

// Las columnas suman el ancho del módulo y los frentes de cada columna, su alto útil.
function normalizar(m) {
  const W = +m.ancho, HU = +m.alto - Zde(m);
  if (!m.columnas?.length) m.columnas = [{ ancho: W, frentes: [{ tipo: 'puerta', alto: HU }] }];
  const sw = m.columnas.reduce((a, c) => a + +c.ancho, 0) || 1;
  m.columnas.forEach((c) => {
    c.ancho = r1(+c.ancho * W / sw);
    if (!c.frentes?.length) c.frentes = [{ tipo: 'puerta', alto: HU }];
    const sh = c.frentes.reduce((a, f) => a + +f.alto, 0) || 1;
    c.frentes.forEach((f) => { f.alto = r1(+f.alto * HU / sh); });
  });
  m.tiradores = (m.tiradores || []).filter((t) => m.columnas[t.col]?.frentes[t.fila]);
  // Cada tirador se mantiene dentro de su frente (si el frente se achica, el tirador lo acompaña)
  const cs = celdas(m);
  for (const t of m.tiradores) {
    const c = cs.find((k) => k.col === t.col && k.fila === t.fila), def = TIRADORES[t.modelo];
    if (!c || !def) continue;
    const a = ((+t.rot || 0) % 180 + 180) % 180, rad = a * Math.PI / 180;
    const ex = Math.abs(Math.cos(rad)) * def.largo / 2 + 1, ey = Math.abs(Math.sin(rad)) * def.largo / 2 + 1; // medio largo proyectado
    const mx = Math.max(0, c.w / 2 - ex), my = Math.max(0, c.h / 2 - ey);
    t.dx = r1(Math.max(-mx, Math.min(mx, +t.dx || 0)));
    t.dy = r1(Math.max(-my, Math.min(my, +t.dy || 0)));
  }
}

// ===================== materiales =====================
const MEL = window.MELAMINAS || [];
function mats() {
  const f = MEL.find((x) => x.id === modelo.frente);
  const frente = f ? (f.imagen ? `url(${window.DM.base}${f.imagen}) center / 60em 60em, ${f.hex}` : f.hex) : '#cfc6b8';
  return { frente, cuerpo: '#e9e6df', zocalo: '#3a3836', cubierta: '#cfc9bc' };
}

// ===================== dibujo =====================
function selRef() {
  if (!sel) return null;
  return {
    modulo: `${sel.m}|`, cuerpo: `${sel.m}|cuerpo`, zocalo: `${sel.m}|zocalo`, cubierta: `${sel.m}|cubierta`,
    frente: `${sel.m}|f|${sel.col}|${sel.fila}`, tirador: `${sel.m}|t|${sel.t}`, muro: `muro|${sel.i}`,
  }[sel.tipo];
}
// En la vista Frente se trabaja el mueble seleccionado de frente y sin girar (si no hay
// selección, todos). En Planta y 3D se ve el espacio completo con los muebles ubicados.
function modulosFrente() {
  const s = sel && sel.tipo !== 'muro' ? modulo(sel.m) : null;
  return s ? [s] : modelo.modulos;
}
function modeloVista() {
  if (vista !== 'frente') return modelo;
  return { ...modelo, espacio: null, modulos: modulosFrente().map((m) => ({ ...m, rotacion: 0, z: 0 })) };
}
function render({ panel = true } = {}) {
  const mv = modeloVista();
  dibujar(st, mv, { capas: vista === 'frente' ? { ...capas, muros: false } : capas, mats: mats(), sel: selRef() });
  if (vista === 'frente' || !murosDe(modelo.espacio).length || !capas.muros) pisoGrilla(mv);
  if (vista !== 'frente') dibujarPines();
  encuadrar(false);
  dibujarPlano();
  if (panel) { arbol(); props(); }
  $('#nombre').value = modelo.nombre || '';
}

// Pines de comentarios del cliente (posición 3D en cm, igual que en el portal)
function dibujarPines() {
  for (const p of pines) {
    const d = document.createElement('div');
    d.className = `c3-pin${pinFoco === p.n ? ' foco' : ''}`;
    d.style.transform = `translate3d(${p.x}em, ${-p.y}em, ${p.z + 1}em)`;
    d.innerHTML = `<span title="Comentario ${p.n}"><b>${p.n}</b></span>`;
    st.rig.append(d);
  }
}

// Piso con grilla de 10 cm en la vista 3D
function pisoGrilla(mv = modelo) {
  const L = limites(mv);
  const f = document.createElement('div');
  f.className = 'c3-floor';
  const w = L.w + 120, d = L.d + 120;
  f.style.cssText = `width:${w}em;height:${d}em;border-radius:0;pointer-events:none;
    background:linear-gradient(rgba(236,231,221,.07) .06em, transparent .06em) 0 0 / 10em 10em,
    linear-gradient(90deg, rgba(236,231,221,.07) .06em, transparent .06em) 0 0 / 10em 10em;
    -webkit-mask: radial-gradient(closest-side, #000 55%, transparent); mask: radial-gradient(closest-side, #000 55%, transparent);
    transform: translate3d(${(L.x0 + L.x1) / 2}em, -.02em, ${(L.z0 + L.z1) / 2}em) rotateX(90deg) translate(-50%, -50%);`;
  st.rig.prepend(f);
}

// Encuadre: en Frente cabe completo a escala; en 3D, con margen para girar.
let encuadreHecho = '';
function encuadrar(forzar = true) {
  const L = limites(modeloVista(), { conMuros: vista !== 'frente' && capas.muros });
  const clave = `${vista}|${L.x0}|${L.x1}|${L.y1}|${L.z0}|${L.z1}|${zoom}|${lienzo.clientWidth}x${lienzo.clientHeight}`;
  if (!forzar && clave === encuadreHecho) return;
  encuadreHecho = clave;
  const Wp = lienzo.clientWidth || 800, Hp = lienzo.clientHeight || 600;
  const s0 = Math.min(Wp, Hp);
  let px; // px por cm
  if (vista === 'frente') px = Math.min(Wp / ((L.w + 60) * 1.15), Hp / ((L.h + 50) * 1.15));
  else if (vista === 'planta') px = Math.min(Wp / ((L.w + 110) * 1.1), Hp / ((L.d + 110) * 1.1));
  else { const diag = Math.hypot(L.w, L.h, L.d); px = Math.min(Wp, Hp) / (diag * 1.25); }
  px *= zoom;
  st.frame([(L.x0 + L.x1) / 2, vista === 'frente' ? L.h / 2 + 5 : vista === 'planta' ? 0 : L.h / 2, (L.z0 + L.z1) / 2], s0 / px, 1);
}

// ----- vista frontal: coordenadas mundo (cm) ↔ pantalla (px)
function mapa() {
  const Wp = lienzo.clientWidth, Hp = lienzo.clientHeight, s = st.scale, c = st.center;
  return {
    s, Wp, Hp,
    X: (x) => Wp / 2 + (x - c[0]) * s,
    Y: (y) => Hp / 2 - (y - c[1]) * s,
    x: (px) => c[0] + (px - Wp / 2) / s,
    y: (py) => c[1] - (py - Hp / 2) / s,
  };
}
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};

function dibujarPlano() {
  if (vista === 'planta') return planta.dibujar();
  if (vista !== 'frente') return;
  const M = mapa();
  plano.setAttribute('viewBox', `0 0 ${M.Wp} ${M.Hp}`);
  plano.replaceChildren();
  // grilla cada 10 cm (más marcada cada 50)
  const g = el('g', { class: 'grilla' }, plano);
  const xa = Math.floor(M.x(0) / 10) * 10, xb = M.x(M.Wp), ya = Math.floor(M.y(M.Hp) / 10) * 10, yb = M.y(0);
  for (let x = xa; x <= xb; x += 10) el('line', { x1: M.X(x), y1: 0, x2: M.X(x), y2: M.Hp, class: x % 50 === 0 ? 'g50' : null }, g);
  for (let y = ya; y <= yb; y += 10) el('line', { x1: 0, y1: M.Y(y), x2: M.Wp, y2: M.Y(y), class: y % 50 === 0 ? 'g50' : null }, g);
  el('line', { x1: 0, y1: M.Y(0), x2: M.Wp, y2: M.Y(0), class: 'piso' }, plano);
  referencias.pintar(plano, M, 'frente'); // foto o plano del cliente, a escala

  for (const m of modulosFrente()) {
    const ox = +m.x, oy = +m.elevacion, W = +m.ancho, H = +m.alto, Z = Zde(m);
    const esSel = sel?.m === m.id;
    // zócalo
    if (Z > 0) el('rect', { x: M.X(ox), y: M.Y(oy + Z), width: W * M.s, height: Z * M.s, class: `zona-zocalo${esSel && sel.tipo === 'zocalo' ? ' sel' : ''}`, 'data-tipo': 'zocalo', 'data-m': m.id }, plano);
    // celdas (frentes)
    for (const c of celdas(m)) {
      const s = esSel && sel.tipo === 'frente' && sel.col === c.col && sel.fila === c.fila;
      el('rect', { x: M.X(ox + c.x0), y: M.Y(oy + c.y1), width: c.w * M.s, height: c.h * M.s, class: `celda${s ? ' sel' : ''}`, 'data-tipo': 'celda', 'data-m': m.id, 'data-col': c.col, 'data-fila': c.fila }, plano);
    }
    // contorno del módulo
    el('rect', { x: M.X(ox), y: M.Y(oy + H), width: W * M.s, height: H * M.s, class: `modulo${esSel && (sel.tipo === 'modulo' || sel.tipo === 'cuerpo') ? ' sel' : ''}` }, plano);
    // divisores arrastrables
    const cs = celdas(m);
    m.columnas.forEach((col, ci) => {
      if (ci < m.columnas.length - 1) {
        const x = ox + cs.find((c) => c.col === ci).x1;
        el('line', { x1: M.X(x), y1: M.Y(oy + H), x2: M.X(x), y2: M.Y(oy + Z), class: 'divisor', 'data-tipo': 'div-v', 'data-m': m.id, 'data-col': ci }, plano);
      }
      col.frentes.forEach((f, fi) => {
        if (fi === col.frentes.length - 1) return;
        const c = cs.find((k) => k.col === ci && k.fila === fi);
        el('line', { x1: M.X(ox + c.x0), y1: M.Y(oy + c.y0), x2: M.X(ox + c.x1), y2: M.Y(oy + c.y0), class: 'divisor h', 'data-tipo': 'div-h', 'data-m': m.id, 'data-col': ci, 'data-fila': fi }, plano);
      });
    });
    // tiradores (zona para arrastrar)
    for (const t of m.tiradores || []) {
      const c = cs.find((k) => k.col === t.col && k.fila === t.fila); const def = TIRADORES[t.modelo];
      if (!c || !def) continue;
      const cx = M.X(ox + c.x + +t.dx), cy = M.Y(oy + c.y + +t.dy), L = (def.largo + 1) * M.s, A = Math.max(3, 3.2) * M.s;
      el('rect', { x: cx - L / 2, y: cy - A / 2, width: L, height: A, rx: 3, transform: `rotate(${-(+t.rot || 0)} ${cx} ${cy})`, class: `tirador${sel?.tipo === 'tirador' && sel.t === t.id ? ' sel' : ''}`, 'data-tipo': 'tirador', 'data-m': m.id, 'data-t': t.id }, plano);
    }
    if (esSel) cotas(m, M);
  }
}

// Cotas del módulo seleccionado: ancho total, alto total, ancho de columnas y medidas de cada frente.
function cotas(m, M) {
  const g = el('g', { class: 'cota' }, plano);
  const ox = +m.x, oy = +m.elevacion, W = +m.ancho, H = +m.alto, Z = Zde(m);
  // edit: qué medida representa la cota (clic sobre el texto para escribirla en cm)
  const linea = (x1, y1, x2, y2, texto, vertical = false, edit = null) => {
    el('line', { x1, y1, x2, y2 }, g);
    el('circle', { cx: x1, cy: y1, r: 2.5 }, g); el('circle', { cx: x2, cy: y2, r: 2.5 }, g);
    const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2;
    el('text', { x: vertical ? tx + 8 : tx, y: vertical ? ty + 4 : ty - 6, 'text-anchor': vertical ? 'start' : 'middle', ...editable(edit) }, g).textContent = texto;
  };
  const editable = (e) => (e ? { class: 'editable', 'data-cota': e.k, 'data-m': m.id, 'data-col': e.col, 'data-fila': e.fila } : {});
  const top = M.Y(oy + H) - 22, der = M.X(ox + W) + 22;
  linea(M.X(ox), top, M.X(ox + W), top, `${cm(W)} cm`, false, { k: 'ancho' });
  linea(der, M.Y(oy + H), der, M.Y(oy), `${cm(H)} cm`, true, { k: 'alto' });
  if (Z > 0) linea(der + 54, M.Y(oy + Z), der + 54, M.Y(oy), `zócalo ${cm(Z)}`, true, { k: 'zocalo' });
  if (oy > 0) linea(M.X(ox) - 22, M.Y(oy), M.X(ox) - 22, M.Y(0), `↑ ${cm(oy)} del piso`, true, { k: 'elevacion' }); // altura desde el piso
  const cs = celdas(m);
  if (m.columnas.length > 1) {
    const yb = M.Y(oy) + 20;
    m.columnas.forEach((_, ci) => { const c = cs.find((k) => k.col === ci); linea(M.X(ox + c.x0), yb, M.X(ox + c.x1), yb, cm(c.w), false, { k: 'col', col: ci }); });
  }
  // medidas dentro de cada frente
  for (const c of cs) {
    if (c.h * M.s < 18 || c.w * M.s < 40) continue;
    el('text', { x: M.X(ox + c.x), y: M.Y(oy + c.y) + 4, 'text-anchor': 'middle', ...editable({ k: 'cel', col: c.col, fila: c.fila }) }, g).textContent = `${cm(c.w)} × ${cm(c.h)}`;
  }
}

// ===================== interacción en la vista frontal =====================
let gesto = null;
const local = (m, p) => ({ x: p.x - +m.x, y: p.y - +m.elevacion });

plano.addEventListener('pointerdown', (e) => {
  if (vista === 'planta') return planta.down(e);
  if (e.button > 0) return;
  const M = mapa(), r = plano.getBoundingClientRect();
  const p = { x: M.x(e.clientX - r.left), y: M.y(e.clientY - r.top) };
  const cota = e.target.closest('[data-cota]');
  if (cota) { e.preventDefault(); editarCota(cota); return; }
  const t = e.target.closest('[data-tipo]');
  plano.setPointerCapture(e.pointerId);

  if (herr === 'dibujar') { gesto = { tipo: 'dibujar', a: { x: snap(p.x, 1), y: Math.max(0, snap(p.y, 1)) }, b: null }; return; }
  if (!t) { sel = null; render(); return; }
  const m = modulo(t.dataset.m);
  const d = t.dataset;

  if (d.tipo === 'celda' && (herr === 'div-v' || herr === 'div-h')) {
    const L = local(m, p);
    cambiar(() => (herr === 'div-v' ? dividirV(m, +d.col, L.x) : dividirH(m, +d.col, +d.fila, L.y)));
    sel = { tipo: 'frente', m: m.id, col: +d.col, fila: +d.fila }; render();
    return;
  }
  if (d.tipo === 'div-v' || d.tipo === 'div-h') {
    gesto = { tipo: d.tipo, m: m.id, col: +d.col, fila: +d.fila, p0: p, antes: JSON.stringify(modelo), base: JSON.parse(JSON.stringify(m.columnas)) };
    return;
  }
  if (d.tipo === 'tirador') {
    const tt = m.tiradores.find((k) => k.id === d.t);
    sel = { tipo: 'tirador', m: m.id, t: tt.id };
    gesto = { tipo: 'tirador', m: m.id, t: tt.id, p0: p, dx: +tt.dx, dy: +tt.dy, antes: JSON.stringify(modelo) };
    render(); return;
  }
  if (d.tipo === 'celda') sel = { tipo: 'frente', m: m.id, col: +d.col, fila: +d.fila };
  else if (d.tipo === 'zocalo') sel = { tipo: 'zocalo', m: m.id };
  render();
});

plano.addEventListener('pointermove', (e) => {
  if (vista === 'planta') return planta.move(e);
  const M = mapa(), r = plano.getBoundingClientRect();
  const p = { x: M.x(e.clientX - r.left), y: M.y(e.clientY - r.top) };
  estadoEl.textContent = `${ayuda()}   ·   x ${cm(p.x)} · y ${cm(Math.max(0, p.y))} cm`;
  if (!gesto) return;
  if (gesto.tipo === 'dibujar') {
    gesto.b = { x: snap(p.x, 1), y: Math.max(0, snap(p.y, 1)) };
    dibujarPlano();
    const a = gesto.a, b = gesto.b;
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    el('rect', { x: M.X(x0), y: M.Y(y0 + h), width: w * M.s, height: h * M.s, class: 'borrador' }, plano);
    const tx = el('g', { class: 'cota' }, plano);
    el('text', { x: M.X(x0 + w / 2), y: M.Y(y0 + h) - 8, 'text-anchor': 'middle' }, tx).textContent = `${cm(w)} × ${cm(h)} cm`;
    return;
  }
  const m = modulo(gesto.m);
  if (gesto.tipo === 'div-v') {
    const cols = gesto.base, i = gesto.col;
    const d = snap(p.x - gesto.p0.x, .5);
    const a = +cols[i].ancho + d, b = +cols[i + 1].ancho - d;
    if (a < 5 || b < 5) return;
    m.columnas[i].ancho = a; m.columnas[i + 1].ancho = b;
  } else if (gesto.tipo === 'div-h') {
    const fr = gesto.base[gesto.col].frentes, j = gesto.fila;
    const d = snap(gesto.p0.y - p.y, .5); // bajar el divisor agranda el frente de arriba
    const a = +fr[j].alto + d, b = +fr[j + 1].alto - d;
    if (a < 5 || b < 5) return;
    m.columnas[gesto.col].frentes[j].alto = a; m.columnas[gesto.col].frentes[j + 1].alto = b;
  } else if (gesto.tipo === 'tirador') {
    const tt = m.tiradores.find((k) => k.id === gesto.t);
    let dx = snap(gesto.dx + p.x - gesto.p0.x, .5), dy = snap(gesto.dy + p.y - gesto.p0.y, .5);
    if (Math.abs(dx) < 1) dx = 0; if (Math.abs(dy) < 1) dy = 0; // imán al eje central del frente
    tt.dx = dx; tt.dy = dy;
  }
  render({ panel: false });
});

plano.addEventListener('pointerup', (e) => {
  if (vista === 'planta') return planta.up(e);
  if (!gesto) return;
  const g = gesto; gesto = null;
  if (g.tipo === 'dibujar') {
    if (!g.b) return render();
    const x0 = Math.min(g.a.x, g.b.x), y0 = Math.min(g.a.y, g.b.y), w = Math.abs(g.b.x - g.a.x), h = Math.abs(g.b.y - g.a.y);
    if (w < 10 || h < 10) return render();
    const elev = y0 < 6 ? 0 : y0; // cerca del piso: se apoya en el piso
    const m = nuevoModulo({ x: x0, elevacion: elev, ancho: w, alto: elev ? h : h + y0 });
    cambiar((d) => d.modulos.push(m));
    sel = { tipo: 'modulo', m: m.id };
    setHerr('sel'); render();
    return;
  }
  if (JSON.stringify(modelo) !== g.antes) { hist.push(g.antes); fut.length = 0; modelo.modulos.forEach(normalizar); guardar(); }
  render();
});

// ----- edición directa de una cota: campo de texto encima de la medida
// Ancho, alto, zócalo y columnas aceptan un número. En un frente se acepta "ancho × alto"
// (o solo el alto). Enter o salir del campo aplica; Esc cancela.
function editarCota(t) {
  document.querySelector('.ed-cota-input')?.remove();
  const m = modulo(t.dataset.m); if (!m) return;
  const k = t.dataset.cota, col = +t.dataset.col, fila = +t.dataset.fila;
  const cs = celdas(m), c = cs.find((x) => x.col === col && x.fila === fila);
  const valor = { ancho: m.ancho, alto: m.alto, zocalo: m.zocalo, elevacion: m.elevacion, col: m.columnas[col]?.ancho }[k];
  const inp = document.createElement('input');
  inp.className = 'ed-cota-input';
  inp.value = k === 'cel' ? `${cm(c.w)} × ${cm(c.h)}` : cm(valor);
  inp.setAttribute('aria-label', 'Medida en cm');
  const r = t.getBoundingClientRect(), L = lienzo.getBoundingClientRect();
  inp.style.left = `${r.left - L.left + r.width / 2}px`; inp.style.top = `${r.top - L.top + r.height / 2}px`;
  lienzo.append(inp);
  inp.focus(); inp.select();
  let hecho = false;
  const cerrar = (aplicar) => {
    if (hecho) return; hecho = true;
    const txt = inp.value.replace(/,/g, '.'); inp.remove();
    if (!aplicar) return;
    const nums = (txt.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return;
    sel = k === 'cel' ? { tipo: 'frente', m: m.id, col, fila } : { tipo: 'modulo', m: m.id };
    cambiar(() => {
      if (k === 'cel') {
        // "40 × 37" → ancho de columna y alto del frente; un solo número → alto del frente
        if (nums.length > 1 && Math.abs(nums[0] - c.w) > .05) aplicarCampo(m, 'c.ancho', nums[0], { col });
        const alto = nums.length > 1 ? nums[1] : nums[0];
        if (Math.abs(alto - c.h) > .05) aplicarCampo(m, 'f.alto', alto, { col, fila });
      } else if (k === 'col') aplicarCampo(m, 'c.ancho', nums[0], { col });
      else aplicarCampo(m, k, nums[0]);
    });
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cerrar(true); }
    if (e.key === 'Escape') { e.preventDefault(); cerrar(false); }
  });
  inp.addEventListener('blur', () => cerrar(true));
}

// ----- divisiones
function dividirV(m, ci, xLocal) {
  const cs = celdas(m), c = cs.find((k) => k.col === ci);
  let a = snap(xLocal - c.x0, .5);
  if (Math.abs(a - c.w / 2) < 2) a = c.w / 2; // imán a la mitad
  const b = c.w - a; if (a < 5 || b < 5) return;
  const col = m.columnas[ci];
  const nueva = { ancho: b, frentes: JSON.parse(JSON.stringify(col.frentes)) };
  col.ancho = a;
  m.columnas.splice(ci + 1, 0, nueva);
  for (const t of m.tiradores) {
    if (t.col > ci) t.col++;
    else if (t.col === ci) { // el tirador queda en la columna donde cae su posición, en el mismo lugar del mueble
      const x = c.x + +t.dx;
      if (x > c.x0 + a) { t.col = ci + 1; t.dx = r1(x - (c.x0 + a + b / 2)); } else t.dx = r1(x - (c.x0 + a / 2));
    }
  }
}
function dividirH(m, ci, fi, yLocal) {
  const c = celdas(m).find((k) => k.col === ci && k.fila === fi);
  let arriba = snap(c.y1 - yLocal, .5);
  if (Math.abs(arriba - c.h / 2) < 2) arriba = c.h / 2;
  const abajo = c.h - arriba; if (arriba < 5 || abajo < 5) return;
  const fr = m.columnas[ci].frentes, f = fr[fi];
  fr.splice(fi, 1, { ...f, alto: arriba }, { ...f, alto: abajo });
  for (const t of m.tiradores) {
    if (t.col !== ci) continue;
    if (t.fila > fi) t.fila++;
    else if (t.fila === fi) { // el tirador queda en el frente donde cae su posición
      const y = c.y + +t.dy;
      if (y < c.y1 - arriba) { t.fila = fi + 1; t.dy = r1(y - (c.y0 + abajo / 2)); } else t.dy = r1(y - (c.y1 - arriba / 2));
    }
  }
}
function unirAbajo(m, ci, fi) {
  const fr = m.columnas[ci].frentes; if (fi >= fr.length - 1) return;
  fr[fi].alto = +fr[fi].alto + +fr[fi + 1].alto; fr.splice(fi + 1, 1);
  m.tiradores = m.tiradores.filter((t) => !(t.col === ci && t.fila === fi + 1));
  for (const t of m.tiradores) if (t.col === ci && t.fila > fi + 1) t.fila--;
}
function unirDerecha(m, ci) {
  if (ci >= m.columnas.length - 1) return;
  m.columnas[ci].ancho = +m.columnas[ci].ancho + +m.columnas[ci + 1].ancho; m.columnas.splice(ci + 1, 1);
  m.tiradores = m.tiradores.filter((t) => t.col !== ci + 1);
  for (const t of m.tiradores) if (t.col > ci + 1) t.col--;
}

// ----- tiradores: ubicación por defecto según el tipo de frente
function ubicarTirador(m, ci, fi, modeloT, punto = null) {
  const c = celdas(m).find((k) => k.col === ci && k.fila === fi);
  const def = TIRADORES[modeloT];
  const f = m.columnas[ci].frentes[fi];
  const t = { id: uid('t'), modelo: modeloT, color: 'negro', col: ci, fila: fi, dx: 0, dy: 0, rot: 0 };
  const largo = /barra/.test(modeloT);
  if (punto) { t.dx = snap(punto.x - c.x, .5); t.dy = snap(punto.y - c.y, .5); }
  else if (f.tipo === 'cajon') t.dy = Math.max(0, snap(c.h / 2 - 7, .5));
  else if (f.tipo === 'puerta' || f.tipo === 'puerta_doble') {
    const lado = f.bisagra === 'derecha' ? -1 : 1;
    t.dx = snap(lado * (c.w / 2 - 4), .5);
    t.dy = snap((m.tipo === 'aereo' ? -1 : 1) * (c.h / 2 - (largo ? def.largo / 2 : 0) - 6), .5);
  }
  if (largo && f.tipo !== 'cajon') t.rot = 90;
  if (Math.abs(t.dx) < 1) t.dx = 0; if (Math.abs(t.dy) < 1) t.dy = 0;
  return t;
}

// ===================== 3D: clic para seleccionar =====================
let toque = null;
escena.addEventListener('pointerdown', (e) => { toque = { x: e.clientX, y: e.clientY }; });
escena.addEventListener('pointerup', (e) => {
  if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 5) return;
  // El motor captura el puntero al arrastrar: se busca la cara que está bajo el cursor.
  const f = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ref]');
  sel = f ? desdeRef(f.dataset.ref) : null;
  render();
});
function desdeRef(ref) {
  const [m, k, a, b] = ref.split('|');
  if (k === 'f') return { tipo: 'frente', m, col: +a, fila: +b };
  if (k === 't') return { tipo: 'tirador', m, t: a };
  return { tipo: k, m };
}

// ===================== biblioteca de tiradores (arrastrar y soltar) =====================
const biblio = $('#biblio');
for (const [id, def] of Object.entries(TIRADORES)) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.tirador = id;
  const xs = def.piezas.map((p) => [p.x - p.w / 2, p.x + p.w / 2]).flat(), ys = def.piezas.map((p) => [p.y - p.h / 2, p.y + p.h / 2]).flat();
  const x0 = Math.min(...xs, -4), x1 = Math.max(...xs, 4), y0 = Math.min(...ys, -2), y1 = Math.max(...ys, 2);
  b.innerHTML = `<svg viewBox="${x0 - 1} ${-y1 - 1} ${x1 - x0 + 2} ${y1 - y0 + 2}" preserveAspectRatio="xMidYMid meet">${def.piezas.map((p) => `<rect x="${p.x - p.w / 2}" y="${-p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx=".3" fill="${p.z > 1.5 ? '#ece7dd' : '#8a857d'}"/>`).join('')}</svg>${esc(def.nombre)}`;
  biblio.append(b);
}
biblio.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-tirador]'); if (!b) return;
  e.preventDefault();
  const id = b.dataset.tirador;
  const fantasma = document.createElement('div');
  fantasma.className = 'ed-fantasma'; fantasma.textContent = TIRADORES[id].nombre;
  document.body.append(fantasma);
  const mover = (ev) => { fantasma.style.left = ev.clientX + 'px'; fantasma.style.top = ev.clientY + 'px'; };
  mover(e);
  const soltar = (ev) => {
    window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
    fantasma.remove();
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    let m, ci, fi, punto = null;
    const celda = bajo?.closest?.('[data-tipo="celda"]');
    const cara = bajo?.closest?.('[data-ref]');
    if (celda) {
      m = modulo(celda.dataset.m); ci = +celda.dataset.col; fi = +celda.dataset.fila;
      const M = mapa(), r = plano.getBoundingClientRect();
      punto = local(m, { x: M.x(ev.clientX - r.left), y: M.y(ev.clientY - r.top) });
    } else if (cara && cara.dataset.ref.includes('|f|')) {
      const s = desdeRef(cara.dataset.ref); m = modulo(s.m); ci = s.col; fi = s.fila;
    } else { aviso('Suelta el tirador sobre una puerta o un cajón.'); return; }
    const t = ubicarTirador(m, ci, fi, id, punto);
    cambiar(() => m.tiradores.push(t));
    sel = { tipo: 'tirador', m: m.id, t: t.id }; render();
  };
  window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
});

// ===================== panel de capas (árbol) =====================
function arbol() {
  const tipoN = (f) => TIPOS_FRENTE[f.tipo] || f.tipo;
  const act = (s) => (sel && JSON.stringify(s) === JSON.stringify(sel) ? ' aria-current="true"' : '');
  const btn = (s, cls, html) => `<button class="${cls}" data-sel='${esc(JSON.stringify(s))}'${act(s)}>${html}</button>`;
  const W = murosDe(modelo.espacio);
  const hEsp = W.length ? `<div class="n0" style="padding:4px 6px;font-size:.78rem;color:var(--muted)">Espacio · ${W.length} muros</div>${W.map((w) => btn({ tipo: 'muro', i: w.i }, 'n1', `${esc(w.etiqueta || `Muro ${w.i + 1}`)} <small>${cm(w.largo)}</small>`)).join('')}<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">` : '';
  $('#arbol').innerHTML = hEsp + modelo.modulos.map((m) => {
    const Z = Zde(m);
    let h = btn({ tipo: 'modulo', m: m.id }, 'n0', `<b>${esc(m.nombre)}</b> <small>${cm(m.ancho)}×${cm(m.alto)}×${cm(m.profundidad)}</small>`);
    if (Z > 0) h += btn({ tipo: 'zocalo', m: m.id }, 'n1', `Zócalo <small>${cm(Z)}</small>`);
    h += btn({ tipo: 'cuerpo', m: m.id }, 'n1', 'Cuerpo');
    m.columnas.forEach((c, ci) => {
      h += `<div class="n2" style="padding:4px 0 2px 30px;font-size:.72rem">Columna ${ci + 1} <small>${cm(c.ancho)}</small></div>`;
      c.frentes.forEach((f, fi) => { h += btn({ tipo: 'frente', m: m.id, col: ci, fila: fi }, 'n3', `${tipoN(f)} <small>${cm(f.alto)}</small>`); });
    });
    (m.tiradores || []).forEach((t) => { h += btn({ tipo: 'tirador', m: m.id, t: t.id }, 'n1', `↳ ${esc(TIRADORES[t.modelo]?.nombre || t.modelo)} <small>c${t.col + 1}·f${t.fila + 1}</small>`); });
    if (m.cubierta) h += btn({ tipo: 'cubierta', m: m.id }, 'n1', 'Cubierta');
    return h;
  }).join('<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">') || '<p class="ed-vacio">Sin módulos. Usa <b>Dibujar módulo</b>.</p>';
}
$('#arbol').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sel]'); if (!b) return;
  sel = JSON.parse(b.dataset.sel); render();
});

// ===================== panel de propiedades =====================
const num = (k, label, v, { u = 'cm', step = .5, min = 0, cls = '' } = {}) =>
  `<label class="ed-campo ${cls}">${label}<span class="u" data-u="${u}"><input type="number" data-k="${k}" value="${r1(+v || 0)}" step="${step}" min="${min}"></span></label>`;
const opciones = (k, label, v, obj, cls = '') =>
  `<label class="ed-campo ${cls}">${label}<select data-k="${k}">${Object.entries(obj).map(([a, b]) => `<option value="${a}"${a === v ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;

function props() {
  const P = $('#props');
  if (!sel) {
    P.innerHTML = `<div class="ed-vacio"><p>Selecciona una pieza en la vista o en las capas.</p>
      <p>Para crear: vista <b>Frente</b> → <b>Dibujar módulo</b> <kbd>M</kbd> y arrastra.<br>Para dividir: <kbd>D</kbd> columnas, <kbd>H</kbd> filas, y clic en un frente.<br>Medidas: arrastra los divisores o escríbelas aquí en cm.</p>
      <p><kbd>Supr</kbd> borra · <kbd>Ctrl Z</kbd> deshace · <kbd>R</kbd> gira un tirador 90° · flechas mueven 1 cm (Mayús: 10).</p></div>`;
    return;
  }
  if (sel.tipo === 'muro') {
    const w = murosDe(modelo.espacio)[sel.i];
    if (!w) { sel = null; return props(); }
    P.innerHTML = `<div class="ed-props"><p class="tit">${esc(w.etiqueta || `Muro ${w.i + 1}`)}</p><p class="sub">Espacio · muro ${w.i + 1}</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Etiqueta (solo la ves tú)<input type="text" data-k="w.etiqueta" value="${esc(w.etiqueta)}" placeholder="Ej: Tabique, Ladrillo princesa"></label>
        ${num('w.largo', 'Largo', w.largo)}${num('w.espesor', 'Espesor', w.espesor)}
        ${num('w.alto', 'Alto de este muro', w.alto)}${num('e.alto', 'Alto general', modelo.espacio.alto || 240)}
      </div>
      <label class="ed-check"><input type="checkbox" data-k="e.cerrado"${modelo.espacio.cerrado ? ' checked' : ''}> Espacio cerrado (une el último muro con el primero)</label>
      <div class="ed-botones">${w.oculto
        ? '<button data-a="restaurar-muro" class="ed-primario">Restaurar este muro</button>'
        : '<button data-a="eliminar-muro" class="peligro">Eliminar este muro</button>'}<button data-a="borrar-muros" class="peligro">Borrar todos los muros</button></div>
      ${w.oculto ? '<p class="ed-ayuda">Muro eliminado: no se dibuja ni lo ve el cliente. Queda punteado en Planta para poder restaurarlo.</p>' : ''}
      <p class="ed-ayuda">Cambiar el largo corre los muros que siguen y mantiene la escuadra. El cliente ve los muros, pero no las etiquetas.</p></div>`;
    return;
  }
  const m = modulo(sel.m); if (!m) { sel = null; return props(); }
  let h = '';
  if (sel.tipo === 'modulo' || sel.tipo === 'cuerpo') {
    const pl = leerPlantilla(m);
    const bloquePl = pl ? `<div class="ed-plantilla"><p class="sub">${esc(PLANTILLAS[pl.t]?.nombre || 'Cocina de referencia')} · se ajusta sola</p>
      <div class="ed-campos">
        ${[...PLANTILLAS[pl.t].medidas, 'fondo', 'alto', 'zocalo', ...(pl.p.aereos ? ['altoAereo', 'sepAereo', 'fondoAereo'] : []), 'x', 'z']
          .map((k) => `<label class="ed-campo">${ETIQUETAS[k]}<span class="u" data-u="cm"><input type="number" step="0.5" data-pk="${k}" value="${pl.p[k]}"></span></label>`).join('')}
      </div>
      ${pl.t !== 'isla' ? `<label class="ed-check"><input type="checkbox" data-pk="aereos"${pl.p.aereos ? ' checked' : ''}> Muebles aéreos</label>
      <label class="ed-check"><input type="checkbox" data-pk="lavaplatos"${pl.p.lavaplatos ? ' checked' : ''}> Lavaplatos (80 cm)</label>
      <label class="ed-check"><input type="checkbox" data-pk="cocina"${pl.p.cocina ? ' checked' : ''}> Hueco para cocina (76 cm)</label>` : ''}
      <div class="ed-botones"><button data-a="desagrupar">Desagrupar (editar libre)</button><button data-a="borrar-cocina" class="peligro">Eliminar esta cocina</button></div>
      </div>` : '';
    h = `${bloquePl}<p class="tit">${esc(m.nombre)}</p><p class="sub">${sel.tipo === 'cuerpo' ? 'Cuerpo' : 'Módulo'}</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Nombre<input type="text" data-k="nombre" value="${esc(m.nombre)}"></label>
        ${opciones('tipo', 'Tipo', m.tipo, { base: 'Base', aereo: 'Aéreo', torre: 'Torre', isla: 'Isla' }, 'ancho2')}
        ${num('ancho', 'Ancho', m.ancho)}${num('alto', 'Alto', m.alto)}
        ${num('profundidad', 'Profundidad', m.profundidad)}${num('zocalo', 'Zócalo', m.zocalo)}
        ${num('x', 'Posición X', m.x, { min: -9999 })}${num('z', 'Posición Z (fondo)', m.z, { min: -9999 })}
        ${num('elevacion', 'Altura del piso', m.elevacion)}${num('rotacion', 'Giro en planta', m.rotacion, { u: '°', step: 90, min: -360 })}
      </div>
      <label class="ed-check"><input type="checkbox" data-k="cubierta"${m.cubierta ? ' checked' : ''}> Lleva cubierta</label>
      <div class="ed-botones"><button data-a="girar-" title="Girar 90° a la izquierda (R)">⟲ 90°</button><button data-a="girar+" title="Girar 90° a la derecha">⟳ 90°</button><button data-a="duplicar">Duplicar →</button><button data-a="borrar-modulo" class="peligro">Eliminar módulo</button></div>`;
  } else if (sel.tipo === 'zocalo') {
    h = `<p class="tit">Zócalo</p><p class="sub">${esc(m.nombre)}</p>
      <div class="ed-campos">${num('zocalo', 'Alto', m.zocalo)}${num('zocalo_retiro', 'Retiro', m.zocalo_retiro)}</div>
      <p class="ed-ayuda">El retiro es cuánto queda el zócalo hacia adentro respecto del frente.</p>`;
  } else if (sel.tipo === 'frente') {
    const col = m.columnas[sel.col], f = col?.frentes[sel.fila];
    if (!f) { sel = { tipo: 'modulo', m: m.id }; return props(); }
    const tieneBis = f.tipo === 'puerta';
    h = `<p class="tit">${esc(TIPOS_FRENTE[f.tipo] || f.tipo)}</p><p class="sub">Columna ${sel.col + 1} · fila ${sel.fila + 1}</p>
      <div class="ed-campos">
        ${opciones('f.tipo', 'Tipo', f.tipo, TIPOS_FRENTE, 'ancho2')}
        ${tieneBis ? opciones('f.bisagra', 'Bisagra', f.bisagra || 'izquierda', { izquierda: 'Izquierda', derecha: 'Derecha', arriba: 'Arriba (abatible)', abajo: 'Abajo' }, 'ancho2') : ''}
        ${num('f.alto', 'Alto del frente', f.alto)}${num('c.ancho', 'Ancho de columna', col.ancho)}
      </div>
      <div class="ed-botones">
        <button data-a="div-h">Dividir en 2 filas</button><button data-a="div-v">Dividir en 2 columnas</button>
        ${sel.fila < col.frentes.length - 1 ? '<button data-a="unir-abajo">Unir con el de abajo</button>' : ''}
        ${sel.col < m.columnas.length - 1 ? '<button data-a="unir-der">Unir columna con la derecha</button>' : ''}
        <button data-a="tirador">+ Tirador</button>
      </div>`;
  } else if (sel.tipo === 'tirador') {
    const t = m.tiradores.find((k) => k.id === sel.t);
    if (!t) { sel = null; return props(); }
    h = `<p class="tit">${esc(TIRADORES[t.modelo]?.nombre || t.modelo)}</p><p class="sub">Tirador · columna ${t.col + 1} · fila ${t.fila + 1}</p>
      <div class="ed-campos">
        ${opciones('t.modelo', 'Modelo', t.modelo, Object.fromEntries(Object.entries(TIRADORES).map(([k, v]) => [k, v.nombre])), 'ancho2')}
        ${opciones('t.color', 'Color', t.color, { negro: 'Negro mate', acero: 'Acero', dorado: 'Dorado', blanco: 'Blanco' }, 'ancho2')}
        ${num('t.dx', 'Desde el centro →', t.dx, { min: -999 })}${num('t.dy', 'Desde el centro ↑', t.dy, { min: -999 })}
        ${num('t.rot', 'Giro', t.rot, { u: '°', step: 1, min: -360 })}
      </div>
      <div class="ed-botones"><button data-a="rot-">⟲ 90°</button><button data-a="rot+">⟳ 90°</button><button data-a="centrar">Centrar</button><button data-a="borrar-tirador" class="peligro">Eliminar</button></div>`;
  } else if (sel.tipo === 'cubierta') {
    h = `<p class="tit">Cubierta</p><p class="sub">${esc(m.nombre)}</p><div class="ed-botones"><button data-a="quitar-cubierta" class="peligro">Quitar cubierta</button></div>`;
  }
  // En frentes, zócalo y tiradores también se muestran las medidas generales del módulo.
  if (sel.tipo === 'frente' || sel.tipo === 'zocalo' || sel.tipo === 'tirador') {
    h += `<p class="sub" style="margin-top:14px">Módulo · ${esc(m.nombre)}</p>
      <div class="ed-campos">${num('ancho', 'Ancho', m.ancho)}${num('alto', 'Alto', m.alto)}${num('profundidad', 'Profundidad', m.profundidad)}${sel.tipo === 'zocalo' ? '' : num('zocalo', 'Zócalo', m.zocalo)}</div>`;
  }
  P.innerHTML = `<div class="ed-props">${h}</div>`;
}

// Cambios desde los campos
// Aplica una medida o propiedad a un módulo. s indica la pieza (col, fila, t) cuando corresponde.
// Lo usan el panel derecho y la edición directa en las cotas.
function aplicarCampo(m, k, v, s = {}) {
  if (k.startsWith('f.') || k.startsWith('c.')) {
    const col = m.columnas[s.col], fr = col.frentes;
    if (k === 'f.tipo') { fr[s.fila].tipo = v; if (v === 'abierto') m.tiradores = m.tiradores.filter((t) => !(t.col === s.col && t.fila === s.fila)); }
    if (k === 'f.bisagra') fr[s.fila].bisagra = v;
    if (k === 'f.alto') { // el vecino de abajo (o de arriba si es el último) absorbe la diferencia
      const j = s.fila < fr.length - 1 ? s.fila + 1 : s.fila - 1;
      if (j < 0) return aviso('Este frente ocupa todo el alto: cambia el alto del módulo.');
      const d = v - +fr[s.fila].alto;
      if (+fr[j].alto - d < 5 || v < 5) return aviso('No cabe: el frente vecino quedaría con menos de 5 cm.');
      fr[s.fila].alto = v; fr[j].alto = +fr[j].alto - d;
    }
    if (k === 'c.ancho') { // la columna vecina absorbe la diferencia
      const cols = m.columnas, j = s.col < cols.length - 1 ? s.col + 1 : s.col - 1;
      if (j < 0) return aviso('Esta columna ocupa todo el ancho: cambia el ancho del módulo.');
      const d = v - +col.ancho;
      if (+cols[j].ancho - d < 5 || v < 5) return aviso('No cabe: la columna vecina quedaría con menos de 5 cm.');
      col.ancho = v; cols[j].ancho = +cols[j].ancho - d;
    }
  } else if (k.startsWith('t.')) {
    const t = m.tiradores.find((x) => x.id === s.t); t[k.slice(2)] = v;
  } else if (k === 'ancho') {
    if (v < 10) return aviso('Ancho mínimo: 10 cm.');
    const k2 = v / (+m.ancho || 1); m.columnas.forEach((c) => { c.ancho = +c.ancho * k2; }); m.ancho = v;
  } else if (k === 'alto') {
    if (v < Zde(m) + 10) return aviso('El alto tiene que superar el zócalo en al menos 10 cm.');
    m.alto = v; // normalizar() reparte los frentes en el nuevo alto
  } else if (k === 'zocalo') {
    if (v < 0 || v > +m.alto - 10) return aviso('El zócalo tiene que dejar al menos 10 cm de cuerpo.');
    m.zocalo = v;
  } else if (k === 'rotacion') {
    rotarEnCentro(m, v); // gira alrededor del centro del mueble
  } else if (k === 'tipo') {
    m.tipo = v; if (v === 'aereo') m.zocalo = 0;
  } else {
    m[k] = v; // profundidad, x, elevacion, nombre, cubierta, zocalo_retiro
  }
}

$('#props').addEventListener('change', (e) => {
  const pk = e.target.dataset?.pk;
  if (pk && sel) {
    const pl = leerPlantilla(modulo(sel.m)); if (!pl) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
    if (e.target.type !== 'checkbox' && !(isFinite(v) && (v > 0 || pk === 'x' || pk === 'z'))) return;
    const p = { ...pl.p, [pk]: v };
    regenerarPlantilla(pl.g, pl.t, p);
    return;
  }
  const inp = e.target.closest('[data-k]'); if (!inp || !sel) return;
  const k = inp.dataset.k;
  const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value;
  const s = { ...sel };
  if (s.tipo === 'muro') {
    cambiar((d) => {
      const e = d.espacio;
      if (k === 'w.etiqueta') e.muros[s.i] = { ...(e.muros[s.i] || {}), etiqueta: String(v).slice(0, 80) };
      if (k === 'w.espesor' && v > 0) e.muros[s.i] = { ...(e.muros[s.i] || {}), espesor: v };
      if (k === 'w.alto' && v > 0) e.muros[s.i] = { ...(e.muros[s.i] || {}), alto: v };
      if (k === 'w.largo') planta.cambiarLargo(e, s.i, v);
      if (k === 'e.alto' && v > 0) e.alto = v;
      if (k === 'e.cerrado') e.cerrado = !!v;
    });
    return;
  }
  cambiar(() => aplicarCampo(modulo(s.m), k, v, s));
});

// Botones del panel
$('#props').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || !sel) return;
  if (b.dataset.a === 'desagrupar' || b.dataset.a === 'borrar-cocina') {
    const pl = leerPlantilla(modulo(sel.m)); if (!pl) return;
    const del = (m) => leerPlantilla(m)?.g === pl.g;
    if (b.dataset.a === 'borrar-cocina') { cambiar((d) => { d.modulos = d.modulos.filter((m) => !del(m)); }); sel = null; render(); }
    else cambiar((d) => { d.modulos.forEach((m) => { if (del(m)) delete m.plantilla; }); });
    return;
  }
  if (b.dataset.a === 'eliminar-muro' || b.dataset.a === 'restaurar-muro') {
    const i = sel.i, oculto = b.dataset.a === 'eliminar-muro';
    cambiar((d) => { d.espacio.muros[i] = { ...(d.espacio.muros[i] || {}), oculto }; });
    return;
  }
  if (b.dataset.a === 'borrar-muros') {
    if (confirm('¿Borrar todos los muros del espacio?')) { cambiar((d) => { d.espacio = { ...(d.espacio || {}), puntos: [], muros: [], cerrado: false }; }); sel = null; render(); }
    return;
  }
  if (b.dataset.a === 'girar-' || b.dataset.a === 'girar+') {
    const mm = modulo(sel.m);
    cambiar(() => planta.rotar(mm, b.dataset.a === 'girar-' ? 90 : -90));
    return;
  }
  const m = modulo(sel.m), a = b.dataset.a;
  if (a === 'duplicar') {
    const c = JSON.parse(JSON.stringify(m)); c.id = uid(); c.x = +m.x + +m.ancho; c.nombre = m.nombre + ' (copia)';
    c.tiradores.forEach((t) => { t.id = uid('t'); });
    cambiar((d) => d.modulos.push(c)); sel = { tipo: 'modulo', m: c.id }; render(); return;
  }
  if (a === 'borrar-modulo') { cambiar((d) => { d.modulos = d.modulos.filter((x) => x.id !== m.id); }); sel = null; render(); return; }
  if (a === 'div-h') { const c = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila); cambiar(() => dividirH(m, sel.col, sel.fila, c.y)); return; }
  if (a === 'div-v') { const c = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila); cambiar(() => dividirV(m, sel.col, c.x)); return; }
  if (a === 'unir-abajo') { cambiar(() => unirAbajo(m, sel.col, sel.fila)); return; }
  if (a === 'unir-der') { cambiar(() => unirDerecha(m, sel.col)); return; }
  if (a === 'tirador') { const t = ubicarTirador(m, sel.col, sel.fila, 'barra-128'); cambiar(() => m.tiradores.push(t)); sel = { tipo: 'tirador', m: m.id, t: t.id }; render(); return; }
  if (a === 'quitar-cubierta') { cambiar(() => { m.cubierta = false; }); sel = { tipo: 'modulo', m: m.id }; render(); return; }
  const t = m.tiradores.find((x) => x.id === sel.t);
  if (a === 'rot-' || a === 'rot+') cambiar(() => { t.rot = ((+t.rot || 0) + (a === 'rot+' ? -90 : 90) + 360) % 360; });
  if (a === 'centrar') cambiar(() => { t.dx = 0; t.dy = 0; });
  if (a === 'borrar-tirador') { cambiar(() => { m.tiradores = m.tiradores.filter((x) => x.id !== t.id); }); sel = null; render(); }
});

function borrarSel() {
  if (!sel) return;
  if (sel.tipo === 'muro') { // Supr sobre un muro: se elimina solo ese muro (se puede restaurar)
    const i = sel.i;
    cambiar((d) => { d.espacio.muros[i] = { ...(d.espacio.muros[i] || {}), oculto: true }; });
    return;
  }
  const m = modulo(sel.m);
  if (sel.tipo === 'tirador') cambiar(() => { m.tiradores = m.tiradores.filter((x) => x.id !== sel.t); });
  else if (sel.tipo === 'modulo' || sel.tipo === 'cuerpo') cambiar((d) => { d.modulos = d.modulos.filter((x) => x.id !== m.id); });
  else if (sel.tipo === 'frente') cambiar(() => (sel.fila < m.columnas[sel.col].frentes.length - 1 ? unirAbajo(m, sel.col, sel.fila) : sel.fila > 0 ? unirAbajo(m, sel.col, sel.fila - 1) : unirDerecha(m, Math.max(0, sel.col - (sel.col === m.columnas.length - 1 ? 1 : 0)))));
  else if (sel.tipo === 'cubierta') cambiar(() => { m.cubierta = false; });
  else if (sel.tipo === 'zocalo') cambiar(() => { m.zocalo = 0; });
  sel = null; render();
}

// ===================== barra superior, vistas y herramientas =====================
function setVista(v) {
  vista = v;
  $$('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
  lienzo.classList.toggle('frente', v === 'frente');
  lienzo.classList.toggle('planta', v === 'planta');
  planta.cancelar();
  if (v === 'frente') { st.lock(true); st.limits(-89, 89); st.ortho(true); st.set(0, 0); if (herr === 'muros') setHerr('sel'); }
  else if (v === 'planta') { st.lock(true); st.limits(-90, 90); st.ortho(true); st.set(-90, 0); if (herr.startsWith('div')) setHerr('sel'); }
  else { st.lock(false); st.limits(-70, 0); st.ortho(false); st.set(-24, -30); if (herr !== 'sel') setHerr('sel'); }
  render({ panel: false });
  encuadrar(true); dibujarPlano();
  referencias.pintarPanel();
  estadoEl.textContent = ayuda();
}
function setHerr(h) {
  herr = h;
  $$('[data-herr]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.herr === h)));
  lienzo.className = lienzo.className.replace(/\bh-\S+/g, '').trim() + ` h-${h}`;
  // Cada herramienta trabaja en su vista: muros en Planta, divisiones en Frente; dibujar módulo en ambas.
  const necesita = h === 'muros' ? 'planta' : h.startsWith('div') ? 'frente' : h === 'dibujar' && vista === '3d' ? 'frente' : null;
  if (necesita && vista !== necesita) setVista(necesita);
  estadoEl.textContent = ayuda();
}
function ayuda() {
  if (vista === '3d') return 'Arrastra para girar · clic para seleccionar · rueda para acercar';
  if (vista === 'planta') return {
    sel: 'Arrastra un mueble para moverlo (imán a los muros, Alt sin imán) · R gira · clic en una cota para escribirla',
    dibujar: 'Arrastra para dibujar la huella de un mueble (ancho × fondo)',
    muros: 'Clic para cada esquina (90°, Mayús libre) · clic en el primer punto cierra · Enter o doble clic termina · Retroceso deshace',
  }[herr] || '';
  return {
    sel: 'Clic selecciona · arrastra divisores y tiradores',
    dibujar: 'Arrastra para dibujar un módulo (se apoya en el piso si empiezas cerca)',
    'div-v': 'Clic en un frente para dividirlo en columnas (imán a la mitad)',
    'div-h': 'Clic en un frente para dividirlo en filas (imán a la mitad)',
  }[herr];
}
function aviso(t) { estadoEl.textContent = t; }

$$('[data-vista]').forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
$$('[data-herr]').forEach((b) => b.addEventListener('click', () => setHerr(b.dataset.herr)));
$('#capas').addEventListener('change', (e) => { const c = e.target.dataset.capa; if (c) { capas[c] = e.target.checked; render(); } });
$('#nombre').addEventListener('change', (e) => cambiar(() => { modelo.nombre = e.target.value.trim() || 'Sin nombre'; }));

const selMel = $('#melamina');
selMel.innerHTML = MEL.map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)} · ${esc(x.linea || '')}</option>`).join('');
selMel.value = modelo.frente || '';
selMel.addEventListener('change', () => cambiar(() => { modelo.frente = selMel.value; }));

$('.ed-acciones').addEventListener('click', (e) => {
  const a = e.target.closest('[data-acc]')?.dataset.acc; if (!a) return;
  if (a === 'deshacer') deshacer();
  if (a === 'rehacer') rehacer();
  if (a === 'encuadrar') { zoom = 1; encuadrar(true); dibujarPlano(); }
  if (a === 'nuevo' && confirm('¿Empezar un modelo vacío? El actual se puede recuperar con Deshacer.')) { cambiar((d) => { d.modulos = []; d.nombre = 'Nuevo modelo'; }); sel = null; setVista('frente'); setHerr('dibujar'); }
  if (a === 'exportar') exportar();
  if (a === 'importar') $('#archivo').click();
});
function exportar() {
  const nombre = (modelo.nombre || 'modelo').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([JSON.stringify(modelo, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nombre || 'modelo'}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#archivo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.modulos)) throw new Error('El archivo no tiene "modulos".');
    d.modulos.forEach((m) => { m.id ||= uid(); m.tiradores ||= []; m.tiradores.forEach((t) => { t.id ||= uid('t'); }); });
    cambiar(() => { modelo = d; }); modelo = d; modelo.modulos.forEach(normalizar); sel = null; selMel.value = modelo.frente || ''; guardar(); render(); encuadrar(true);
  } catch (err) { alert('No se pudo abrir: ' + err.message); }
  e.target.value = '';
});

// Zoom con la rueda (ambas vistas)
lienzo.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom = Math.max(.3, Math.min(6, zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  encuadrar(true); dibujarPlano();
}, { passive: false });

// Teclado
window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (vista === 'planta' && planta.teclado(e)) { e.preventDefault(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); return; }
  if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); return; }
  if (ctrl) return;
  const k = e.key.toLowerCase();
  if (k === '1') setVista('3d');
  else if (k === '2') setVista('frente');
  else if (k === '3') setVista('planta');
  else if (k === 'w') setHerr('muros');
  else if (k === 'v' || k === 'escape') { setHerr('sel'); if (k === 'escape') { sel = null; render(); } }
  else if (k === 'm') setHerr('dibujar');
  else if (k === 'd') setHerr('div-v');
  else if (k === 'h') setHerr('div-h');
  else if (k === 'f') { zoom = 1; encuadrar(true); dibujarPlano(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); borrarSel(); }
  else if (k === 'r' && sel?.tipo === 'tirador') { const m = modulo(sel.m), t = m.tiradores.find((x) => x.id === sel.t); cambiar(() => { t.rot = ((+t.rot || 0) + 90) % 360; }); }
  else if (k === 'r' && sel && sel.tipo !== 'muro') { const m = modulo(sel.m); cambiar(() => planta.rotar(m, 90)); }
  else if ((e.key === 'PageUp' || e.key === 'PageDown') && sel && sel.tipo !== 'muro') { // subir / bajar
    e.preventDefault();
    const m = modulo(sel.m), paso = (e.shiftKey ? 10 : 1) * (e.key === 'PageUp' ? 1 : -1);
    cambiar(() => { m.elevacion = Math.max(0, +m.elevacion + paso); });
  }
  else if (e.key.startsWith('Arrow') && sel && sel.tipo !== 'muro') {
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0, dy = { ArrowUp: paso, ArrowDown: -paso }[e.key] || 0;
    const m = modulo(sel.m);
    if (sel.tipo === 'tirador') { const t = m.tiradores.find((x) => x.id === sel.t); cambiar(() => { t.dx = +t.dx + dx; t.dy = +t.dy + dy; }); }
    else if (vista === 'planta') cambiar(() => { m.x = +m.x + dx; m.z = +m.z - dy; }); // en planta, ↑ va hacia el muro del fondo
    else cambiar(() => { m.x = +m.x + dx; m.elevacion = Math.max(0, +m.elevacion + dy); });
  }
});

// Re-encuadrar al cambiar el tamaño de la ventana
new ResizeObserver(() => { encuadrar(true); dibujarPlano(); }).observe(lienzo);

// ===================== proyectos de clientes =====================
// Pestañas del panel derecho
$$('.ed-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
  $$('.ed-tabs [data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('#tab-props').hidden = b.dataset.tab !== 'props';
  $('#tab-coment').hidden = b.dataset.tab !== 'coment';
}));

// ===================== cocinas de referencia =====================
function regenerarPlantilla(gid, tipo, p) {
  const idx = modelo.modulos.findIndex((m) => leerPlantilla(m)?.g === gid);
  const nuevos = generar(tipo, p, gid);
  cambiar((d) => {
    d.modulos = d.modulos.filter((m) => leerPlantilla(m)?.g !== gid);
    d.modulos.splice(Math.max(0, idx), 0, ...nuevos);
  });
  sel = { tipo: 'modulo', m: nuevos[0].id }; render();
}
$('#plantillas').addEventListener('click', (e) => {
  const t = e.target.closest('[data-plantilla]')?.dataset.plantilla; if (!t) return;
  const nuevos = generar(t, parametrosIniciales(t, modelo.espacio));
  cambiar((d) => { d.modulos.push(...nuevos); });
  sel = { tipo: 'modulo', m: nuevos[0].id };
  if (vista === 'frente') setVista('planta');
  render(); encuadrar(true);
  aviso(`${PLANTILLAS[t].nombre} insertada (${nuevos.length} módulos). Cambia sus medidas en el panel derecho y se redistribuye sola.`);
});

// Imagen de referencia por vista (se guarda solo en este navegador)
const referencias = crearReferencias({
  vista: () => vista,
  clave: () => (proyActual ? proyActual.id : 'local'),
  render, aviso,
  moduloSel: () => (sel && sel.tipo !== 'muro' ? modulo(sel.m) : null),
  // Aplica la propuesta de divisiones al módulo seleccionado, o crea uno nuevo sobre la imagen
  aplicarPropuesta(p, ref) {
    const m0 = sel && sel.tipo !== 'muro' ? modulo(sel.m) : null;
    cambiar((d) => {
      const m = m0 || nuevoModulo({ x: ref.x0, elevacion: ref.y0, ancho: p.ancho, alto: p.alto });
      m.ancho = p.ancho; m.alto = p.alto; m.zocalo = m.tipo === 'aereo' ? 0 : p.zocalo;
      m.columnas = p.columnas; m.tiradores = [];
      if (!m0) { m.nombre = 'Desde imagen'; d.modulos.push(m); sel = { tipo: 'modulo', m: m.id }; }
    });
  },
});

const planta = crearPlanta({
  modelo: () => modelo, sel: () => sel, setSel: (s) => { sel = s; },
  cambiar, registrar, render, aviso, herr: () => herr, setHerr, vista: () => vista,
  escala: () => ({ s: st.scale, c: st.center, Wp: lienzo.clientWidth, Hp: lienzo.clientHeight }),
  fondo: (svg, M) => referencias.pintar(svg, M, 'planta'),
  estado: (t) => { estadoEl.textContent = `${ayuda()}   ·   ${t}`; },
  plano, lienzo,
});

iniciarProyectos({
  modelo: () => modelo,
  aviso,
  // Abre un proyecto (raw del repo) o vuelve al modelo local (raw = null).
  abrir(raw, info, { conservarVista = false } = {}) {
    const cambioDeProyecto = (proyActual?.id || null) !== (info?.id || null);
    proyActual = info;
    if (cambioDeProyecto) referencias.cargar(); // cada proyecto tiene sus propias imágenes de referencia
    hist.length = 0; fut.length = 0; sel = null;
    if (!raw) { modelo = cargar() || ejemplo(); pines = []; }
    else {
      modelo = aModelo(raw, uid);
      if (!conservarVista) { // ¿quedó un borrador sin publicar sobre esta misma versión?
        let b = null; try { b = JSON.parse(localStorage.getItem(claveProy(info.id))); } catch (e) {}
        if (b?.sha === info.sha && b.modelo && JSON.stringify(b.modelo.modulos) !== JSON.stringify(modelo.modulos)
          && confirm('Tienes cambios sin publicar en este proyecto. ¿Recuperarlos?')) modelo = b.modelo;
      }
      if (modelo.modulos.some((m) => +m.rotacion)) aviso('Ojo: hay módulos girados (muro izquierdo); el editor los muestra sin girar.');
    }
    if (!modelo.frente) modelo.frente = MEL[0]?.id || '';
    modelo.modulos.forEach(normalizar);
    selMel.value = modelo.frente || '';
    guardar(); render();
    if (!conservarVista) { zoom = 1; encuadrar(true); dibujarPlano(); }
    if (raw && modelo.modulos.length === 0) { setVista('frente'); setHerr('dibujar'); aviso('Proyecto vacío: dibuja el primer módulo arrastrando.'); }
  },
  pines(lista) { pines = lista; render({ panel: false }); },
  enfocarPin(p) {
    setVista('3d');
    pinFoco = p.n; render({ panel: false });
    setTimeout(() => { pinFoco = null; }, 2000);
  },
});

modelo.modulos.forEach(normalizar);
setHerr('sel');
render();
referencias.cargar();
window.editor = { get modelo() { return modelo; }, st, setVista, setHerr, render, referencias }; // para depurar en la consola
