// Editor de modelos CSS 3D por capas (zócalo → cuerpo → frentes → tiradores).
// Vista 3D para revisar y vista Frente (ortogonal, a escala) para dibujar, dividir y medir en cm.
import { createStage } from '../css3d/engine.js';
import { PATRONES, normalizar as normalizarAcab, fondoAcabado, colorValido, mosaico } from '../css3d/acabados.js';
import { nivelesRepisa, repartirPuertas, GAP, MAX_HOJA, hojasDe, artefactosDe, zonasCubierta, moverArtefacto, centroArtefacto, cubiertaDe, CT, hojasMin, marcoZocalo, tablero, fondoTotal, vuelosDe, TONOS_LUZ, LADOS_LUZ } from './modelo.js';
import { ARTEFACTOS, DE_CUBIERTA } from './artefactos.js';
import { OBJETOS } from './objetos.js';
import { despiece, medidaFrente } from './despiece.js';
import { PALETA, colorDe, matsColores } from './colores.js';
import { huella, centro, girar, metaMuro, murosContorno, partesCostado, bordesCostado, rectParte, repisaFija, divisionesH, zonasMuro, metaMuroLeer, grosorCostado } from './modelo.js';
import { dibujar, celdas, limites, nuevoModulo, uid, TIRADORES, TIPOS_FRENTE, muros as murosDe, rotarEnCentro, ejeMuro, vanosDe, VANOS, tiradorDef, modeloCatalogo, tiradoresCliente } from './modelo.js';
import { crearPlanta } from './planta.js';
import { crearReferencias } from './referencia.js';
import { PLANTILLAS, ETIQUETAS, generar, parametrosIniciales, leerPlantilla, CERO_OK, SELECTS } from './plantillas.js';
import { unirModulos } from './unir.js';
import { iniciarProyectos, aModelo, api, tokenGitHub, leerPrecios, aplicarCliente, textoCambios } from './proyecto.js';
import { evaluarCubierta } from './cubiertas.js';
import { optimizarDespiece, optimizarCholguan, svgPlancha, vetaLibre } from './optimizador.js';
import { descargarImperial, skuDe, bajoMinimo } from './imperial.js';
import { planoHTML } from './plano.js';
import { SOLUCIONES, ORDEN_SOLUCIONES, ORDEN_AEREO, geoEsquinero, nuevoEsquinero, medidasSugeridas, luzRincon, cajonSpaceCorner, hojasEditables, bandejaGiratoria, partesInterior, repisasL } from './esquinero.js';
const CORREDERAS_LARGOS = [25, 30, 35, 40, 45, 50, 55, 60];

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
let herr = 'sel';          // 'sel' | 'dibujar' | 'div-v' | 'div-h' | 'muros' | 'medir'
let medF = null, cursorF = null; // huincha en Frente: primer punto y cursor
let aislado = null; // «Ver solo este mueble» (dueño, 2026-11-25): id del mueble que se ve solo en 3D, desde sus 4 lados
let v34 = null; // vista fija 3/4 del interior de un esquinero: { id, abiertos: [claves] }
let zoom = 1;
const capas = { zocalo: true, cuerpo: true, frentes: true, tiradores: true, cubierta: true, muros: true, acabados: true, repisas: false, luces: true, noche: false, cliente: true };
let proyActual = null;     // { id, sha, raw } cuando se edita un proyecto de cliente
let materialesCub = [];    // materiales de cubierta de la Configuración de precios (reglas físicas: vuelo, largo, lavaplatos bajo cubierta)
let catalogoTir = [];      // tiradores de la Configuración de precios (nombre, forma, color, largo, grosor, precio)
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
// Respaldos: antes de reemplazar un borrador distinto se guarda una copia (las últimas 8 por proyecto).
// Así un cambio hecho en el administrador o un «No recuperar» nunca borra el trabajo sin publicar.
const claveResp = (id) => `dm-editor-respaldos:${id || 'local'}`;
function respaldos(id) { try { return JSON.parse(localStorage.getItem(claveResp(id))) || []; } catch (e) { return []; } }
function respaldar(id, m, motivo) {
  if (!m?.modulos?.length) return;
  const lista = respaldos(id);
  if (lista[0] && JSON.stringify(lista[0].modelo.modulos) === JSON.stringify(m.modulos)) return; // ya está
  lista.unshift({ fecha: Date.now(), motivo, modelo: m });
  try { localStorage.setItem(claveResp(id), JSON.stringify(lista.slice(0, 8))); } catch (e) {}
}
function guardar() {
  try {
    if (proyActual) localStorage.setItem(claveProy(proyActual.id), JSON.stringify({ sha: proyActual.sha, modelo, cliente: proyActual.cliente?.firma })); // cliente: su elección ya incluida
    else localStorage.setItem(CLAVE, JSON.stringify(modelo));
  } catch (e) {}
}

const modulo = (id) => modelo.modulos.find((m) => m.id === id);
const Zde = (m) => (m.tipo === 'aereo' ? 0 : (+m.zocalo || 0));

// Cambia el modelo dejando un paso en el historial (deshacer).
function cambiar(fn) {
  hist.push(vivoSnap ?? JSON.stringify(modelo)); vivoSnap = null; if (hist.length > 150) hist.shift(); // (vivoSnap: color probado en vivo)
  fut.length = 0;
  fn(modelo);
  modelo.modulos.forEach(normalizar);
  guardar(); render();
}
function deshacer() { if (!hist.length) return; fut.push(JSON.stringify(modelo)); modelo = JSON.parse(hist.pop()); validarSel(); guardar(); render(); }
function rehacer() { if (!fut.length) return; hist.push(JSON.stringify(modelo)); modelo = JSON.parse(fut.pop()); validarSel(); guardar(); render(); }
function validarSel() {
  if (sel?.tipo === 'multi') { sel.ids = sel.ids.filter((id) => modulo(id)); if (sel.ids.length < 2) sel = sel.ids.length ? { tipo: 'modulo', m: sel.ids[0] } : null; }
  else if (sel?.tipo === 'muro') { const w = murosDe(modelo.espacio)[sel.i]; if (!w) sel = null; else if (sel.z != null && !(metaMuroLeer(modelo.espacio, sel.i).zonas || [])[sel.z]) sel = { tipo: 'muro', i: sel.i }; }
  else if (sel?.tipo === 'suelo') { if (!murosDe(modelo.espacio).length) sel = null; }
  else if (sel?.tipo === 'medida') { if (!(modelo.medidas || []).some((x) => x.id === sel.id)) sel = null; }
  else if (sel?.tipo === 'vano') { if (!vanoSel()) sel = null; }
  else if (sel?.tipo === 'repisa') { const c = modulo(sel.m) && celdas(modulo(sel.m)).find((k) => k.col === sel.col && k.fila === sel.fila); if (!c || sel.i >= c.repisas) sel = c ? { tipo: 'frente', m: sel.m, col: sel.col, fila: sel.fila } : null; }
  else if (sel?.tipo === 'pieza') { if (!modulo(sel.m)) sel = null; }
  else if (sel?.tipo === 'objeto') { if (!objeto(sel.o)) sel = null; }
  else if (sel?.tipo === 'artefacto') { if (!modulo(sel.m)?.artefactos?.some((a) => a.id === sel.a)) sel = sel.m && modulo(sel.m) ? { tipo: 'modulo', m: sel.m } : null; }
  else if (sel?.tipo === 'div') { const m = modulo(sel.m); if (!m || (sel.dir === 'v' ? sel.col >= m.columnas.length - 1 : !m.columnas[sel.col] || sel.fila >= m.columnas[sel.col].frentes.length - 1)) sel = m ? { tipo: 'modulo', m: m.id } : null; }
  else if (sel && !modulo(sel.m)) sel = null;
}
// Termina un gesto de arrastre: si cambió algo, queda un paso en el historial.
function registrar(antes) {
  if (JSON.stringify(modelo) !== antes) { hist.push(antes); fut.length = 0; modelo.modulos.forEach(normalizar); guardar(); }
  render();
}

// Las columnas suman el ancho del módulo y los frentes de cada columna, su alto útil.
function normalizar(m) {
  if (m.tipo === 'esquinero') { // sus frentes salen de la solución elegida; los tiradores, con el modelo general
    m.columnas = []; if (!(m.tiradores || []).some((t) => t?.esq && tiradorDef(t.modelo))) m.tiradores = [{ id: 'esq', esq: true, modelo: 'barra-128', color: 'negro' }];
    if (m.aereo) { m.cubierta = false; m.zocalo = 0; if (m.solucion && !ORDEN_AEREO.includes(m.solucion)) m.solucion = ''; } // esquinero aéreo: reglas de un aéreo, solo 2a y 2b
    return;
  }
  const W = +m.ancho, HU = +m.alto - Zde(m);
  if (!m.columnas?.length) m.columnas = [{ ancho: W, frentes: [{ tipo: 'puerta', alto: HU }] }];
  const sw = m.columnas.reduce((a, c) => a + +c.ancho, 0) || 1;
  m.columnas.forEach((c) => {
    c.ancho = Math.round(+c.ancho * W / sw * 1000) / 1000; // 3 decimales: «Repartir en puertas iguales» necesita columnas exactas
    if (!c.frentes?.length) c.frentes = [{ tipo: 'puerta', alto: HU }];
    const sh = c.frentes.reduce((a, f) => a + +f.alto, 0) || 1;
    c.frentes.forEach((f) => { f.alto = r1(+f.alto * HU / sh); });
  });
  igualarPuertas(m); // todas las hojas del mueble iguales, salvo que se haya puesto una medida a mano
  const cambios = limitarPuertas(m);
  if (cambios.length) aviso(`Una hoja de puerta no pasa de ${MAX_HOJA} cm (bisagras): ${cambios.join('; ')}.`);
  m.tiradores = (m.tiradores || []).filter((t) => m.columnas[t.col]?.frentes[t.fila] && m.columnas[t.col].frentes[t.fila].tipo !== 'abierto');
  // Cada tirador se mantiene dentro de su frente (si el frente se achica, el tirador lo acompaña)
  const cs = celdas(m);
  for (const t of m.tiradores) {
    const c = cs.find((k) => k.col === t.col && k.fila === t.fila), def = tiradorDef(t.modelo);
    if (!c || !def) continue;
    const a = ((+t.rot || 0) % 180 + 180) % 180, rad = a * Math.PI / 180;
    const ex = Math.abs(Math.cos(rad)) * def.largo / 2 + 1, ey = Math.abs(Math.sin(rad)) * def.largo / 2 + 1; // medio largo proyectado
    const mx = Math.max(0, c.w / 2 - ex), my = Math.max(0, c.h / 2 - ey);
    t.dx = r1(Math.max(-mx, Math.min(mx, +t.dx || 0)));
    t.dy = r1(Math.max(-my, Math.min(my, +t.dy || 0)));
  }
}

// Puertas iguales automáticas (dueño, 2026-11-25): las columnas que solo tienen puertas se reparten para que todas las
// hojas del mueble midan lo mismo (ej. 150 cm con 2 secciones de 2 hojas → 4 × 37,2); las columnas de cajones o mixtas
// mantienen su ancho. Si se pone una medida a mano (cota de una puerta, ancho de columna o arrastrando una división), el
// mueble queda en «medida manual» (m.puertas_manual) y respeta ese número hasta que se vuelva a igualar en su panel.
function bordesColumna(m, i, k) { // lo que no es hoja dentro de una columna de k hojas: luces, divisiones y costados
  const n = m.columnas.length, izq = i === 0, der = i === n - 1;
  if (m.tipo === 'isla') { const T = tablero(m), G = grosorCostado(m); return (k - 1) * (T + 2 * GAP) + (izq ? G + GAP : T / 2 + GAP) + (der ? G + GAP : T / 2 + GAP); }
  return (k - 1) * GAP + (izq ? 0 : GAP / 2) + (der ? 0 : GAP / 2);
}
function igualarPuertas(m) {
  if (m.puertas_manual || m.tipo === 'esquinero' || m.artefacto || !(m.columnas?.length > 1)) return;
  const info = m.columnas.map((c, i) => {
    const fs = c.frentes || [];
    if (!fs.length || !fs.every((f) => f.tipo === 'puerta' || f.tipo === 'puerta_doble')) return null; // cajones o mixta: queda como está
    const ks = [...new Set(fs.map((f) => (f.tipo === 'puerta_doble' ? hojasDe(f, +c.ancho) : 1)))];
    return ks.length === 1 ? { k: ks[0], e: bordesColumna(m, i, ks[0]) } : null;
  });
  const ps = info.filter(Boolean); if (ps.length < 2) return;
  const libre = +m.ancho - m.columnas.reduce((s, c, i) => s + (info[i] ? 0 : +c.ancho), 0);
  const h = (libre - ps.reduce((s, p) => s + p.e, 0)) / ps.reduce((s, p) => s + p.k, 0);
  if (!(h > 5)) return;
  m.columnas.forEach((c, i) => { if (info[i]) c.ancho = Math.round((info[i].k * h + info[i].e) * 1000) / 1000; });
}
function medidaManual(m) { // una medida puesta a mano: desde ahora el mueble respeta ese número
  if (m.puertas_manual || m.tipo === 'esquinero') return;
  m.puertas_manual = true;
  aviso(`Medida a mano en «${m.nombre}»: sus puertas ya no se igualan solas. En el panel del mueble puedes volver a igualarlas.`);
}

// Repartir el mueble en n puertas de la misma medida final (cantidad y divisiones elegidas en el panel del mueble)
function bloquePuertas(m) {
  if (m.artefacto) return '';
  const actuales = celdas(m).reduce((s, c) => s + (c.tipo === 'puerta' ? 1 : c.tipo === 'puerta_doble' ? c.hojas : 0), 0);
  const n = actuales || hojasMin(+m.ancho);
  return `<div class="ed-plantilla"><p class="sub">Puertas iguales</p>
    <div class="ed-campos">
      <label class="ed-campo">Cantidad<span class="u" data-u="un."><input type="number" id="rp-n" min="1" max="12" step="1" value="${n}"></span></label>
      <label class="ed-campo ancho2">Divisiones<select id="rp-div"><option value="cada">Una entre cada puerta</option><option value="pares">Cada 2 puertas (abren de a pares)</option></select></label>
    </div>
    <div class="ed-botones"><button data-a="repartir-puertas" class="ed-primario">Repartir en puertas iguales</button></div>
    <label class="ed-check"><input type="checkbox" data-k="puertas_auto"${m.puertas_manual ? '' : ' checked'}> Las puertas se igualan solas${m.puertas_manual ? ' <small>(hoy: medida a mano)</small>' : ''}</label>
    <p class="ed-ayuda">Todas quedan con la misma medida final: descuenta 3 mm de luz entre hojas (a ras en los costados) y el tapacanto en el corte. Después elige hacia dónde abre cada puerta seleccionándola.</p></div>`;
}
// Tiradores después de repartir: uno por puerta, del mismo modelo y color que el primero que tenía el mueble
function tiradoresPuertas(m, t0) {
  const out = [];
  for (const c of celdas(m)) {
    if (c.tipo === 'puerta') { out.push({ ...ubicarTirador(m, c.col, c.fila, t0.modelo), color: t0.color }); continue; }
    if (c.tipo !== 'puerta_doble') continue;
    const base = ubicarTirador(m, c.col, c.fila, t0.modelo), n = c.hojas, lw = (c.w - (n - 1) * GAP) / n;
    for (let i = 0; i < n; i++) { // cada hoja con su tirador en el canto que abre (hacia el centro de la sección)
      const cx = -c.w / 2 + lw / 2 + i * (lw + GAP), s = i <= (n - 1) / 2 ? 1 : -1;
      out.push({ ...base, id: uid('t'), color: t0.color, dx: snap(cx + s * (lw / 2 - 4), .5) });
    }
  }
  return out;
}

// Puertas: una hoja no pasa de 45 cm. Una puerta más ancha pasa a una sección de varias hojas
// (puerta_doble con f.hojas): 2 hasta 90 cm, 3 hasta 135 cm, etc. La sección no se divide, así se
// pueden borrar divisiones y repartir las puertas como se quiera.
function limitarPuertas(m) {
  const out = [];
  for (const c of m.columnas) {
    const w = +c.ancho, min = hojasMin(w);
    for (const f of c.frentes) {
      // la puerta mide la columna menos hasta 3 mm de luz: se pasa a varias hojas solo si la puerta supera los 45 cm
      if (f.tipo === 'puerta' && w > MAX_HOJA + .35) { f.tipo = 'puerta_doble'; f.hojas = min; out.push(`la puerta de ${cm(w)} cm pasó a ${min} hojas`); }
      else if (f.tipo === 'puerta_doble') {
        const n = Math.round(+f.hojas || 0);
        if (n < min) { if (n >= 2) out.push(`la sección de ${cm(w)} cm pasó a ${min} hojas`); f.hojas = min; }
        else if (n > Math.max(min, Math.floor(w / 15))) f.hojas = Math.max(min, Math.floor(w / 15)); // hojas de al menos 15 cm
      }
    }
  }
  return out;
}

// ===================== materiales =====================
const MEL = window.MELAMINAS || [];
function mats() {
  const f = MEL.find((x) => x.id === modelo.frente);
  const frente = f ? (f.imagen ? `url(${window.DM.base}${f.imagen}) center / 60em 60em, ${f.hex}` : f.hex) : '#cfc6b8';
  const cli = capas.cliente ? proyActual?.cliente : null, s = cli?.sel; // cubierta y borde que eligió el cliente
  return { ...matsColores(modelo.colores, frente), cubierta: (s && cli.cubiertas.find((c) => c.id === s.cubierta)?.color) || '#cfc9bc',
    ...(s?.borde ? { borde: cli.bordes.find((b) => b.id === s.borde)?.perfil || 'recto' } : {}), material: fondoMaterial };
}
// ===================== elección del cliente (portal) =====================
// Muebles que el cliente no cotiza (desmarcados en su portal): se ven atenuados
function fueraCliente() {
  const s = capas.cliente ? proyActual?.cliente?.sel : null;
  if (!Array.isArray(s?.modulos) || !s.modulos.length) return new Set();
  return new Set(modelo.modulos.filter((m) => !m.artefacto && !s.modulos.includes(m.id)).map((m) => m.id));
}
// Tiradores con el modelo y color que eligió el cliente (en las mismas posiciones; «sin tirador» los oculta)
function conCliente(mv) {
  const cli = capas.cliente ? proyActual?.cliente : null, tir = cli?.sel?.tirador && cli.tiradores.find((t) => t.id === cli.sel.tirador);
  if (!tir) return mv;
  return { ...mv, modulos: mv.modulos.map((m) => (m.artefacto || !m.tiradores?.length ? m : { ...m, tiradores: tiradoresCliente(m, tir) })) };
}
// Aviso con botón cuando el cliente cambia materiales con el editor abierto
function avisoCliente(c, s) {
  document.querySelector('.ed-cliente-aviso')?.remove();
  const b = document.createElement('div');
  b.className = 'ed-version ed-cliente-aviso';
  b.innerHTML = `El cliente cambió en su portal: ${esc(textoCambios(c))}. <button data-si>Aplicar</button><button data-no class="sec">Ahora no</button>`;
  b.addEventListener('click', (e) => {
    if (e.target.closest('[data-si]')) { cambiar((d) => aplicarCliente(d, s)); aviso('Apliqué lo que eligió el cliente (Ctrl+Z deshace).'); }
    if (e.target.closest('button')) b.remove();
  });
  document.body.append(b);
}
// ===================== materiales por pieza (como Shapr3D: arrastrar una esfera sobre la pieza) =====================
// Un material es una melamina del catálogo (su id) o un color ('color:#rrggbb'). Se guarda en m.materiales[pieza].
const BASICOS = [['color:#f2f0eb', 'Blanco'], ['color:#d9d6cf', 'Hueso'], ['color:#8d8a85', 'Gris'], ['color:#3a3836', 'Gris grafito'],
  ['color:#1d1c1b', 'Negro'], ['color:#b4b7b9', 'Aluminio'], ['color:#a97d4d', 'Madera natural'], ['color:#6b4a2e', 'Madera oscura']];
const RANURA = 'repeating-linear-gradient(90deg, rgba(0, 0, 0, .32) 0 .4em, rgba(0, 0, 0, .06) .4em .9em, transparent .9em 4.2em)';
function fondoMaterial(mid) {
  if (!mid) return null;
  if (mid.startsWith('liston:')) { const b = fondoMaterial(mid.slice(7)); return b ? `${RANURA}, ${b}` : null; } // panel de listones
  if (mid.startsWith('color:')) return mid.slice(6);
  const f = MEL.find((x) => x.id === mid);
  return f ? (f.imagen ? `url(${window.DM.base}${f.imagen}) center / 60em 60em, ${f.hex}` : f.hex) : null;
}
const nombreMaterial = (mid) => (mid?.startsWith('liston:') ? `Listones · ${nombreMaterial(mid.slice(7))}` : mid?.startsWith('color:') ? (BASICOS.find((b) => b[0] === mid)?.[1] || `Color ${mid.slice(6)}`) : MEL.find((x) => x.id === mid)?.nombre || mid);
// Esfera de muestra: textura del material con brillo y sombra
function esfera(mid) {
  if (mid?.startsWith('liston:')) return esfera(mid.slice(7)).replace('background: ', `background: ${RANURA.replace(/em/g, 'px')}, `);
  const f = !mid?.startsWith('color:') && MEL.find((x) => x.id === mid);
  const base = f ? (f.imagen ? `url(${window.DM.base}${f.imagen}) center / 180% auto, ${f.hex}` : f.hex) : mid?.slice(6) || '#ccc';
  return `background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 38%), ${base};`;
}
// Clave de la pieza de un ref ("id|f|0|1", "id|cuerpo|piso"…) o de la selección actual
const claveDeRef = (ref) => {
  const [mid, ...r] = ref.split('|'); let k = r.join('|').replace(/\|p\d+$/, ''); // una parte del costado: su material es el del costado
  // (dueño, 2026-11-25) cualquier pieza de melamina toma el material que se le suelta encima y va a la hoja de corte de ese
  // material: el ref del 3D se traduce a la clave que leen el dibujo y el despiece
  if (k === 'soporte|frente') k = 'soporte';
  else if (/^soporte\|(atras|anclaje)$/.test(k)) return null; // pino tapa: no es melamina
  else if (/^cuerpo\|dv\d+$/.test(k)) k = `div|${k.match(/\d+$/)[0]}`; // división vertical entre columnas
  else if (/^f\|\d+\|\d+\|h\d+$/.test(k)) k = k.replace(/\|h\d+$/, ''); // una hoja: el frente de su sección
  else if (k === 'esq|int') k = 'esq|repisa'; // repisas y bandejas del esquinero
  if (mid === 'vano') return { vano: { i: +r[0], v: r[1] } }; // puerta o ventana del muro
  if (!modulo(mid) || modulo(mid).artefacto || /^(t|a)\|/.test(k) || /^esq\|giro/.test(k)) return null;
  return { m: mid, k };
};
function claveDeSel() {
  if (sel?.tipo === 'vano') return { vano: { i: sel.i, v: sel.v } };
  if (!sel?.m || !modulo(sel.m) || modulo(sel.m).artefacto) return null;
  const k = { frente: `f|${sel.col}|${sel.fila}`, cuerpo: 'cuerpo', pieza: `cuerpo|${sel.p}`, repisa: `f|${sel.col}|${sel.fila}|rep|${sel.i}`,
    zocalo: 'zocalo', cubierta: 'cubierta', modulo: 'frentes', soporte: 'soporte', div: sel.dir === 'h' ? `f|${sel.col}|${sel.fila}|div` : `div|${sel.col}` }[sel.tipo];
  return k ? { m: sel.m, k } : null;
}
const NOMBRE_PIEZA = { izq: 'Costado izquierdo', der: 'Costado derecho', piso: 'Base', techo: 'Techo', fondo: 'Fondo', soporte: 'Soporte delantero' };
// Opciones de melamina para los selectores del panel (vacío = la opción por defecto)
const opcionesMelamina = (vacio) => ({ '': vacio, ...Object.fromEntries(MEL.map((x) => [x.id, `${x.nombre}${x.linea ? ` · ${x.linea}` : ''}`])) });
// Techo y soporte delantero del mueble: se muestra al tocar el mueble o cualquiera de sus partes (sección, pieza, soporte)
function bloqueTechoSoportes(m) {
  const basal = (m.tipo || 'base') === 'base' || m.tipo === 'isla';
  const lleva = m.techo === 'si' || (m.techo !== 'no' && !basal);
  const sinSoporte = (m.quitar || []).includes('soporte');
  return `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Techo y soportes · ${esc(m.nombre)}</p>
    <div class="ed-campos">
      ${opciones('techo', 'Techo de melamina', m.techo || '', { '': `Automático (${basal ? 'sin techo' : 'con techo'})`, si: 'Con techo', no: 'Sin techo' }, 'ancho2')}
      ${opciones('mat|cuerpo|techo', 'Color del techo', m.materiales?.['cuerpo|techo'] || '', opcionesMelamina('Como el cuerpo'), 'ancho2')}
      ${opciones('sin_soporte', 'Soporte delantero (barra de 10 cm)', sinSoporte ? 'si' : '', { '': 'Con soporte', si: 'Sin soporte' }, 'ancho2')}
      ${opciones('mat|soporte', 'Color del soporte', m.materiales?.soporte || '', opcionesMelamina('Como el cuerpo'), 'ancho2')}
    </div>
    <p class="ed-ayuda">El techo es una placa de melamina arriba del mueble (ej. sobre el nicho del microondas o una torre).${lleva && m.cubierta ? ' <b>Este mueble lleva cubierta: el techo queda debajo de ella</b> (desmarca «Lleva cubierta» si quieres verlo).' : ''} Se guardan en este mueble y se cotizan en su melamina.</p></div>`;
}
// Repisas de cada sección del mueble (sin cajones), con − y + (también se cambian tocando la sección)
function bloqueRepisas(m) {
  const cs = celdas(m).filter((c) => c.tipo !== 'cajon');
  if (!cs.length) return '<p class="ed-ayuda" style="margin-top:10px">Este mueble solo tiene cajones: no lleva repisas.</p>';
  const nom = { puerta: 'Puerta', puerta_doble: 'Puertas', panel: 'Panel', abierto: 'Abierta' };
  return `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Repisas</p>
    ${cs.map((c) => `<div class="ed-repisas"><span>${nom[c.tipo] || 'Sección'} · c${c.col + 1}·f${c.fila + 1}</span><button data-a="rep-@${c.col}@${c.fila}" title="Quitar una repisa">−</button><b>${c.repisas}</b><button data-a="rep+@${c.col}@${c.fila}" title="Agregar una repisa">+</button></div>`).join('')}
    <p class="ed-ayuda">Detrás de puertas se ven punteadas con Capas → Repisas.</p></div>`;
}
function nombreClave(k) {
  if (k === 'frentes') return 'todos los frentes del mueble';
  if (k === 'cuerpo') return 'todo el cuerpo';
  if (k === 'zocalo') return 'el zócalo'; if (k === 'cubierta') return 'la cubierta';
  if (k === 'soporte') return 'el soporte delantero';
  if (/^div\|\d+$/.test(k)) return `la división vertical ${+k.slice(4) + 1}`;
  if (k === 'esq|repisa') return 'las repisas del esquinero'; if (k === 'esq|div') return 'las divisiones del esquinero';
  const p = k.split('|');
  if (p[0] === 'cuerpo') return (NOMBRE_PIEZA[p[1]] || p[1]).toLowerCase();
  if (p[0] === 'f') return p[3] === 'rep' ? `la repisa ${+p[4] + 1} (c${+p[1] + 1}·f${+p[2] + 1})` : p[3] === 'div' ? 'las divisiones de la sección' : `el frente c${+p[1] + 1}·f${+p[2] + 1}`;
  return k;
}
// Registro guardado de una ventana o puerta (para leer o cambiar su material)
const vanoRaw = (d, { i, v }) => (d.espacio ? metaMuro(d.espacio, i) : {}).vanos?.find((x) => x.id === v);
function aplicarMaterial(dest, mid) {
  if (dest.vano) {
    const r = vanoRaw(modelo, dest.vano); if (!r) return;
    cambiar((d) => { vanoRaw(d, dest.vano).material = mid; });
    aviso(`${nombreMaterial(mid)} aplicado en ${(VANOS[r.tipo]?.puerta ? 'la puerta' : 'el marco de la ventana')}. Ctrl+Z deshace.`);
    if (!$('#tab-mat').hidden) pintarMateriales();
    return;
  }
  const m = modulo(dest.m); if (!m) return;
  cambiar(() => { m.materiales = { ...(m.materiales || {}), [dest.k]: mid }; });
  aviso(`${nombreMaterial(mid)} aplicado en ${nombreClave(dest.k)} de «${m.nombre}». Ctrl+Z deshace.`);
  if (!$('#tab-mat').hidden) pintarMateriales();
}
function pintarMateriales() {
  const usados = new Map();
  for (const m of modelo.modulos) for (const mid of Object.values(m.materiales || {})) usados.set(mid, (usados.get(mid) || 0) + 1);
  for (const w of [...(modelo.espacio?.muros || []), ...(modelo.espacio?.tramos || [])]) for (const v of w?.vanos || []) if (v.material) usados.set(v.material, (usados.get(v.material) || 0) + 1);
  const q = ($('#mat-buscar')?.value || '').toLowerCase();
  const tarjeta = (mid, nombre, linea = '') => `<div class="ed-mat" data-mat="${esc(mid)}" title="Arrastra sobre una pieza, o haz clic para aplicarlo a la pieza seleccionada"><i class="ed-esfera" style="${esfera(mid)}"></i><span>${esc(nombre)}${linea ? `<br><small>${esc(linea)}</small>` : ''}</span></div>`;
  const lineas = [...new Set(MEL.map((x) => x.linea || 'Melaminas'))];
  const filtra = (n) => !q || n.toLowerCase().includes(q);
  $('#materiales').innerHTML = `
    <p class="ed-mat-ayuda"><b>Arrastra</b> un material sobre una puerta, cajón, costado, base, repisa, zócalo o cubierta (en 3D o en Frente). O selecciona la pieza y <b>haz clic</b> en el material. Lo general (melamina de frentes y colores) está en el panel izquierdo.</p>
    <div class="ed-mat-grupo">Materiales usados</div>
    <div class="ed-mat-usados">
      <div class="ed-mat-usado"><i class="ed-esfera" style="${esfera(modelo.frente || 'color:#cfc6b8')}"></i><span>${esc(nombreMaterial(modelo.frente) || 'Sin elegir')}<small>Melamina general de frentes</small></span></div>
      ${[...usados].map(([mid, n]) => `<div class="ed-mat-usado"><i class="ed-esfera" style="${esfera(mid)}"></i><span>${esc(nombreMaterial(mid))}<small>${n} pieza${n > 1 ? 's' : ''} con este material</small></span><button data-quitar-mat="${esc(mid)}" title="Volver al material general en esas piezas">Quitar</button></div>`).join('')}
    </div>
    <input type="search" id="mat-buscar" class="ed-mat-buscar" placeholder="Buscar material…" value="${esc(q)}">
    <label class="ed-check ed-mat-liston"><input type="checkbox" id="mat-liston"${matListon ? ' checked' : ''}> Aplicar como <b>listones</b> (panel ranurado, ej. el lado de las sillas de una isla)</label>
    <div class="ed-mat-grupo">Colores básicos</div>
    <div class="ed-mat-grid">${BASICOS.filter((b) => filtra(b[1])).map(([mid, n]) => tarjeta(mid, n)).join('')}</div>
    <label class="ed-mat-color">Color específico <input type="color" id="mat-color" value="#b4322e"> <span class="ed-mat" data-mat="color:#b4322e" id="mat-color-muestra" style="padding:4px 8px"><i class="ed-esfera" style="width:26px;height:26px;${esfera('color:#b4322e')}"></i></span></label>
    ${lineas.map((l) => { const xs = MEL.filter((x) => (x.linea || 'Melaminas') === l && filtra(x.nombre)); return xs.length ? `<div class="ed-mat-grupo">Masisa · ${esc(l)}</div><div class="ed-mat-grid">${xs.map((x) => tarjeta(x.id, x.nombre)).join('')}</div>` : ''; }).join('')}`;
}
let matListon = false;
$('#materiales').addEventListener('change', (e) => { if (e.target.id === 'mat-liston') matListon = e.target.checked; });
$('#materiales').addEventListener('input', (e) => {
  if (e.target.id === 'mat-buscar') { const pos = e.target.selectionStart; pintarMateriales(); const i = $('#mat-buscar'); i.focus(); i.setSelectionRange(pos, pos); }
  if (e.target.id === 'mat-color') { const m = $('#mat-color-muestra'); m.dataset.mat = `color:${e.target.value}`; m.querySelector('i').style.cssText = `width:26px;height:26px;${esfera(m.dataset.mat)}`; }
});
$('#materiales').addEventListener('click', (e) => {
  const q = e.target.closest('[data-quitar-mat]')?.dataset.quitarMat;
  if (q) {
    cambiar(() => {
      modelo.modulos.forEach((m) => { for (const [k, v] of Object.entries(m.materiales || {})) if (v === q) delete m.materiales[k]; });
      for (const w of [...(modelo.espacio?.muros || []), ...(modelo.espacio?.tramos || [])]) for (const v of w?.vanos || []) if (v.material === q) delete v.material;
    });
    pintarMateriales();
  }
});
// Arrastrar una esfera: al soltar sobre una pieza se le aplica; un clic la aplica a la pieza seleccionada
$('#materiales').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-mat]'); if (!b) return;
  e.preventDefault();
  const mid = (matListon && !b.dataset.mat.startsWith('liston:') ? 'liston:' : '') + b.dataset.mat, x0 = e.clientX, y0 = e.clientY;
  let fantasma = null;
  const destino = (ev) => {
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    const celda = bajo?.closest?.('[data-tipo="celda"]'), zoc = bajo?.closest?.('[data-tipo="zocalo"]'), cara = bajo?.closest?.('[data-ref]');
    if (celda) return { m: celda.dataset.m, k: `f|${celda.dataset.col}|${celda.dataset.fila}` };
    if (zoc) return { m: zoc.dataset.m, k: 'zocalo' };
    const vano = bajo?.closest?.('[data-tipo="vano"]'); // en Frente o en Planta
    if (vano?.dataset.v) return { vano: { i: +vano.dataset.i, v: vano.dataset.v } };
    if (cara && lienzo.contains(cara)) return claveDeRef(cara.dataset.ref);
    return null;
  };
  const mover = (ev) => {
    if (!fantasma && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { fantasma = document.createElement('div'); fantasma.className = 'ed-fantasma-mat ed-esfera'; fantasma.style.cssText += esfera(mid); document.body.append(fantasma); }
    if (!fantasma) return;
    fantasma.style.left = ev.clientX + 'px'; fantasma.style.top = ev.clientY + 'px';
    const d = destino(ev);
    estadoEl.textContent = d?.vano ? 'Soltar en esta puerta o ventana' : d ? `Soltar en ${nombreClave(d.k)} de «${modulo(d.m).nombre}»` : 'Suelta el material sobre una pieza del mueble, una puerta o una ventana';
  };
  const soltar = (ev) => {
    window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
    if (!fantasma) { // fue un clic
      const d = claveDeSel();
      if (d) aplicarMaterial(d, mid); else aviso('Selecciona una pieza (puerta, costado, base, repisa…) o arrastra el material sobre ella.');
      return;
    }
    fantasma.remove();
    const d = destino(ev);
    if (d) aplicarMaterial(d, mid); else aviso('Suelta el material sobre una pieza del mueble.');
  };
  window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
});
// ----- luces LED: se agregan según lo que está seleccionado (como en las apps de diseño: clic en la pieza → «+ Luz»)
//  · repisa  → luz bajo esa repisa (ilumina el espacio de abajo)
//  · sección → una luz en cada espacio entre repisas
//  · cubierta → bajo el vuelo (ej. lado de las sillas de una isla)
//  · mueble  → bajo el mueble, sobre él, detrás (halo) o a los costados
let tonoLuz = 'calida';
const LADOS_MUEBLE = { abajo: 'Bajo el mueble', arriba: 'Sobre el mueble', atras: 'Detrás (halo en el muro)', izq: 'Costado izq.', der: 'Costado der.' };
const LADOS_CUB = { atras: 'atrás', frente: 'frente', izq: 'izquierda', der: 'derecha' };
function lucesDeSel(m) {
  const sec = (sel.tipo === 'frente' || sel.tipo === 'repisa') ? `f|${sel.col}|${sel.fila}` : null;
  if (sel.tipo === 'repisa') return (m.luces || []).filter((L) => L.en === sec && +L.esp === sel.i);
  if (sec) return (m.luces || []).filter((L) => L.en === sec);
  if (sel.tipo === 'cubierta') return (m.luces || []).filter((L) => L.en === 'cubierta');
  return (m.luces || []).filter((L) => L.en === 'modulo');
}
const nombreLuz = (L, m) => {
  if (L.en === 'modulo') return LADOS_MUEBLE[L.lado] || L.lado;
  if (L.en === 'cubierta') return `Bajo la cubierta (${LADOS_CUB[L.lado] || L.lado})`;
  const [, c, f] = L.en.split('|').map(Number), k = celdas(m).find((x) => x.col === c && x.fila === f), n = k?.repisas || 0;
  const e = L.esp == null ? n : +L.esp;
  return n ? (e === n ? 'Espacio de arriba' : `Bajo la repisa ${e + 1}`) : 'En la sección';
};
function ladoVuelo(m) { const v = cubiertaDe(m).v; return sel.cara && sel.cara in v ? sel.cara : ['atras', 'izq', 'der', 'frente'].reduce((a, b) => (v[b] > v[a] ? b : a), 'atras'); }
function bloqueLuces(m) {
  const k = (sel.tipo === 'frente' || sel.tipo === 'repisa') ? celdas(m).find((x) => x.col === sel.col && x.fila === sel.fila) : null;
  let acciones = '';
  if (sel.tipo === 'repisa') acciones = `<button data-a="luz+rep" class="ed-primario">+ Luz bajo esta repisa</button>`;
  else if (sel.tipo === 'frente') acciones = `<button data-a="luz+esp" class="ed-primario">+ Una luz en cada espacio (${(k?.repisas || 0) + 1})</button>${k?.tipo !== 'abierto' ? '' : ''}`;
  else if (sel.tipo === 'cubierta') acciones = `<button data-a="luz+cub" class="ed-primario">+ Luz bajo la cubierta (${LADOS_CUB[ladoVuelo(m)]})</button>`;
  else acciones = Object.entries(LADOS_MUEBLE).map(([l, n]) => `<button data-a="luz+:${l}">+ ${n}</button>`).join('');
  const luces = lucesDeSel(m);
  return `<div class="ed-luces"><p class="sub">Iluminación LED</p>
    <div class="ed-luz-tonos">${Object.entries(TONOS_LUZ).map(([t, [n, rgb]]) => `<button data-a="tono:${t}"${tonoLuz === t ? ' class="ed-primario"' : ''}><i style="background:rgb(${rgb})"></i>${n}</button>`).join('')}</div>
    <div class="ed-botones">${acciones}${luces.length > 1 ? '<button data-a="luces-quitar" class="peligro">Quitar estas luces</button>' : ''}</div>
    ${luces.map((L) => `<div class="ed-luz"><i style="background:rgb(${(TONOS_LUZ[L.tono] || TONOS_LUZ.calida)[1]})"></i><span>${esc(nombreLuz(L, m))}</span>
      <select data-luz="${L.id}" data-lk="tono">${Object.entries(TONOS_LUZ).map(([t, [n]]) => `<option value="${t}"${L.tono === t ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <input type="range" min="15" max="100" value="${Math.round((L.intensidad ?? .8) * 100)}" data-luz="${L.id}" data-lk="intensidad" title="Intensidad">
      <button data-a="luz-:${L.id}" title="Quitar">✕</button></div>`).join('')}
    <p class="ed-ayuda">${sel.tipo === 'modulo' || sel.tipo === 'cuerpo' ? 'Para luces en repisas, haz clic en una repisa o en la sección; para el lado de las sillas, en la cubierta.' : 'Capas → «Noche» oscurece la escena para ver cómo iluminan.'}</p></div>`;
}
$('#props').addEventListener('input', (e) => { // intensidad y tono de una luz (sin rehacer todo el panel)
  const id = e.target.dataset?.luz; if (!id || !sel?.m) return;
  const m = modulo(sel.m), L = m?.luces?.find((x) => x.id === id); if (!L) return;
  if (e.target.dataset.lk === 'intensidad') { L.intensidad = Math.round(+e.target.value) / 100; render({ panel: false }); guardar(); }
  if (e.target.dataset.lk === 'tono') { cambiar(() => { L.tono = e.target.value; }); }
});

// Bloque del panel de una pieza: su material propio (o el general) y cómo quitarlo
function bloqueMaterial() {
  const d = claveDeSel(); if (!d) return '';
  const mid = d.vano ? vanoRaw(modelo, d.vano)?.material : modulo(d.m).materiales?.[d.k];
  return `<div class="ed-material-pieza"><i class="ed-esfera" style="${esfera(mid || modelo.frente || 'color:#cfc6b8')}"></i>
    <span style="flex:1">${mid ? `<b>${esc(nombreMaterial(mid))}</b><br><small>material propio</small>` : `<small>${d.vano ? 'Color general (Colores y materiales)' : 'Material general'}</small>`}</span>
    ${mid ? '<button data-a="quitar-material">Quitar</button>' : ''}<button data-a="ver-materiales">Cambiar…</button></div>`;
}
// Panel «Colores y materiales»: una lista corta por parte del mueble y del espacio
function pintarColores() {
  const c = modelo.colores || {};
  $('#colores').innerHTML = Object.entries(PALETA).map(([k, p]) => `<label class="ed-campo ancho2">${p.titulo}
    <select data-color="${k}">${Object.entries(p.opciones).map(([v, [n]]) => `<option value="${v}"${colorDe(c, k) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`).join('');
}
$('#colores').addEventListener('change', (e) => {
  const k = e.target.dataset.color; if (!k) return;
  cambiar((d) => { d.colores = { ...(d.colores || {}), [k]: e.target.value }; });
  pintarColores();
});
// ===================== Acabados de muros y suelo como esferas (dueño, 2026-11-25) =====================
// Igual que las melaminas: en la pestaña Materiales hay esferas de pinturas, azulejos, palmetas y baldosas (biblioteca
// en _data/acabados.yml, editable en /admin). Se selecciona un muro, una zona del muro (vista Frente) o el suelo y se
// hace clic en la esfera, o se arrastra la esfera y se suelta encima. Cada material aplicado tiene su rueda de color
// de las piezas y la del fragüe (con cuentagotas y los tonos del proyecto) y sus ajustes, que se despliegan al aplicarlo.
const BIBLIO_ACAB = (window.ACABADOS || []).filter((a) => a && a.id && PATRONES[a.patron]);
const PINTURAS = (window.PINTURAS || []).filter((p) => p && p.id && colorValido(p.color, null));
const CAMPOS_ACAB = ['patron', 'largo', 'ancho', 'junta', 'color', 'color2', 'color_junta', 'variacion', 'giro'];
const espAcab = (d = modelo) => ((d.espacio ||= {}).acabados ||= {});
let ajustesAbiertos = false, vivoSnap = null;
// Alcance: 'suelo' | 'muro:i' | 'muro:i:z' (zona de un muro dividido)
function alcanceSel() {
  if (sel?.tipo === 'suelo') return 'suelo';
  if (sel?.tipo === 'muro') return sel.z != null ? `muro:${sel.i}:${sel.z}` : `muro:${sel.i}`;
  return null;
}
const selDeAlcance = (s) => { if (s === 'suelo') return { tipo: 'suelo' }; const [, i, z] = s.split(':'); return z != null ? { tipo: 'muro', i: +i, z: +z } : { tipo: 'muro', i: +i }; };
function nombreAlcance(s) {
  if (s === 'suelo') return 'el suelo';
  const [, i, z] = s.split(':'), w = murosDe(modelo.espacio)[+i], n = w?.etiqueta || `muro ${+i + 1}`;
  return z != null ? `la zona ${+z + 1} del ${n}` : `el ${n}`;
}
// Acabados guardados en un alcance (un muro dividido sin zona elegida = todas sus zonas)
function acabadosEn(s, d = modelo, crear = false) {
  if (s === 'suelo') { const g = crear ? espAcab(d) : d.espacio?.acabados; return g?.suelo ? [g.suelo] : []; }
  const [, i, z] = s.split(':'), meta = crear ? metaMuro(d.espacio, +i) : metaMuroLeer(d.espacio, +i);
  if (Array.isArray(meta.zonas) && meta.zonas.length) return (z != null ? [meta.zonas[+z]] : meta.zonas).filter(Boolean).map((q) => q.acabado).filter(Boolean);
  return meta.acabado ? [meta.acabado] : [];
}
function ponerAcabado(s, a, d) { // dentro de cambiar()
  if (s === 'suelo') { espAcab(d).suelo = a; return; }
  const [, i, z] = s.split(':'), meta = metaMuro(d.espacio, +i);
  if (Array.isArray(meta.zonas) && meta.zonas.length) (z != null ? [meta.zonas[+z]] : meta.zonas).filter(Boolean).forEach((q) => { q.acabado = { ...a }; });
  else meta.acabado = a;
}
function quitarAcabado(s, d) {
  if (s === 'suelo') { delete espAcab(d).suelo; return; }
  const [, i, z] = s.split(':'), meta = metaMuro(d.espacio, +i);
  if (Array.isArray(meta.zonas) && meta.zonas.length) (z != null ? [meta.zonas[+z]] : meta.zonas).filter(Boolean).forEach((q) => { delete q.acabado; });
  else delete meta.acabado;
}
const deBiblio = (id) => { // 'a:<id>' azulejo/palmeta…, 'p:<id>' pintura
  if (id.startsWith('p:')) { const p = PINTURAS.find((x) => x.id === id.slice(2)); return p && { patron: 'liso', color: colorValido(p.color), nombre: p.nombre }; }
  const p = BIBLIO_ACAB.find((x) => x.id === id.slice(2)); if (!p) return null;
  const a = { nombre: p.nombre }; CAMPOS_ACAB.forEach((k) => { if (p[k] != null && p[k] !== '') a[k] = p[k]; }); return a;
};
function aplicarAcab(s, a) {
  cambiar((d) => ponerAcabado(s, { ...a }, d));
  sel = selDeAlcance(s); ajustesAbiertos = true; render(); pintarAcabTab(true);
  aviso(`${a.nombre || 'Material'} aplicado en ${nombreAlcance(s)}. Ajusta sus colores en la pestaña Materiales. Ctrl+Z deshace.`);
}
function guardarTono(hex, d = modelo) { // tonos del proyecto (los últimos 12 sacados o usados)
  const c = colorValido(hex, null); if (!c) return;
  const g = espAcab(d); g.paleta = [c, ...(g.paleta || []).filter((x) => x !== c)].slice(0, 12);
}
// Esfera de un acabado: el dibujo a escala dentro de la bola (unas 3 piezas de ancho)
function esferaAcab(a, px = 52) {
  const n = normalizarAcab(a), fs = n.patron === 'liso' ? 1 : Math.max(.08, Math.min(3, px / (3 * Math.max(n.largo, n.ancho))));
  return `font-size:${fs}px;background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.5), rgba(255,255,255,0) 40%), ${fondoAcabado(n)};`;
}
const ICONO_GOTAS = '<svg class="ed-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>'; // cuentagotas (pipeta)
function campoColor(campo, nombre, v) {
  const tonos = modelo.espacio?.acabados?.paleta || [];
  return `<label class="ed-campo ancho2">${nombre}<span class="ed-color"><input type="color" data-ac="${campo}" value="${v}">
    <button type="button" class="ed-gotas" data-gotas title="Cuentagotas: toca este botón y luego cualquier punto de la pantalla (también la foto del cliente en otra ventana)">${ICONO_GOTAS}</button>
    ${tonos.map((t) => `<button type="button" class="ed-tono" data-tono="${t}" title="${t}" style="background:${t}"></button>`).join('')}</span></label>`;
}
// Bloque del material aplicado en lo seleccionado: ruedas de color y ajustes
function bloqueAcabSel(s) {
  const lista = acabadosEn(s), a0 = lista[0], a = a0 && normalizarAcab(a0), P = a && PATRONES[a.patron];
  if (!a) return `<div class="ed-acab-sel"><p class="sub">Seleccionado: ${esc(nombreAlcance(s))}</p><p class="ed-ayuda">Sin material todavía: haz clic en una esfera de abajo (o arrástrala y suéltala encima).</p></div>`;
  const num2 = (k, nombre, v, u, step = .5) => `<label class="ed-campo">${nombre}<span class="u" data-u="${u}"><input type="number" step="${step}" min="0" data-ac="${k}" value="${v}"></span></label>`;
  const liso = a.patron === 'liso';
  return `<div class="ed-acab-sel"><p class="sub">Seleccionado: ${esc(nombreAlcance(s))}${lista.length > 1 ? ` (${lista.length} zonas)` : ''}</p>
    <div class="ed-mat-usado"><i class="ed-esfera" style="${esferaAcab(a0, 32)}"></i><span>${esc(a0.nombre || P.nombre)}<small>${liso ? 'Pintura' : `${P.nombre}${P.medidas === false ? '' : ` · ${cm(a.largo)}${P.soloLargo ? '' : ` × ${cm(a.ancho)}`} cm`}`}</small></span><button data-acab-quitar title="Sin material (gris)">Quitar</button></div>
    <div class="ed-campos">${campoColor('color', liso ? 'Color' : P.color2 ? 'Color 1 de las piezas' : 'Color de las piezas', a.color)}
      ${P.color2 ? campoColor('color2', 'Color 2 de las piezas', a.color2) : ''}${liso ? '' : campoColor('color_junta', 'Fragüe (junta)', a.color_junta)}</div>
    ${liso ? '' : `<details class="ed-acab-ajustes"${ajustesAbiertos ? ' open' : ''}><summary>Ajustes de este material</summary><div class="ed-campos">
      <label class="ed-campo ancho2">Patrón<select data-ac="patron">${Object.entries(PATRONES).map(([k, p]) => `<option value="${k}"${k === a.patron ? ' selected' : ''}>${p.nombre}</option>`).join('')}</select></label>
      ${num2('largo', P.soloLargo ? 'Medida (cara a cara)' : 'Largo', a.largo, 'cm')}${P.soloLargo ? '' : num2('ancho', 'Ancho', a.ancho, 'cm')}
      ${num2('junta', 'Junta', a.junta, 'mm')}${num2('variacion', 'Variación de tono', a.variacion, '%', 1)}
      ${a.patron === 'hexagonal' || a.patron === 'espiga' ? '' : `<label class="ed-check" style="grid-column:span 2"><input type="checkbox" data-ac="giro"${a.giro === 90 ? ' checked' : ''}> Girar 90° (piezas paradas o tablas en el otro sentido)</label>`}
    </div></details>`}
    ${s.startsWith('muro:') ? '<div class="ed-botones"><button data-acab-todos>Usar este material en todos los muros</button></div>' : ''}</div>`;
}
function pintarAcabTab(forzar = false) {
  const box = $('#mat-acab'); if (!box || $('#tab-mat').hidden) return;
  const s = alcanceSel(), clave = JSON.stringify([s, s && acabadosEn(s), modelo.espacio?.acabados?.paleta, ajustesAbiertos]);
  // con un muro, una zona o el suelo elegido, sus materiales van arriba de la pestaña (si no, al final, bajo las melaminas)
  const mel = $('#materiales'); if (s && box.nextElementSibling !== mel) mel.before(box); else if (!s && mel.nextElementSibling !== box) mel.after(box);
  if (!forzar && box.dataset.clave === clave) return; box.dataset.clave = clave;
  const esfera1 = (id, a) => `<div class="ed-mat" data-acab-mat="${esc(id)}" title="Arrastra sobre un muro, una zona o el suelo, o selecciónalo y haz clic aquí"><i class="ed-esfera" style="${esferaAcab(a)}"></i><span>${esc(a.nombre)}</span></div>`;
  const grupos = [...new Set(BIBLIO_ACAB.map((a) => a.grupo || 'Otros'))];
  const g = modelo.espacio?.acabados || {};
  box.innerHTML = `<div class="ed-mat-grupo">Muros y suelo</div>
    <p class="ed-mat-ayuda">Toca un <b>muro</b>, una <b>zona</b> del muro (vista Frente) o el <b>suelo</b> y haz clic en un material, o <b>arrástralo</b> y suéltalo encima.</p>
    ${s ? bloqueAcabSel(s) : ''}
    ${PINTURAS.length ? `<div class="ed-mat-grupo">Pinturas</div><div class="ed-mat-grid">${PINTURAS.map((p) => esfera1(`p:${p.id}`, deBiblio(`p:${p.id}`))).join('')}</div>` : ''}
    ${grupos.map((gr) => `<div class="ed-mat-grupo">${esc(gr)}</div><div class="ed-mat-grid">${BIBLIO_ACAB.filter((a) => (a.grupo || 'Otros') === gr).map((a) => esfera1(`a:${a.id}`, deBiblio(`a:${a.id}`))).join('')}</div>`).join('')}
    <div class="ed-mat-grupo">Tonos del proyecto</div>
    <div class="ed-tonos">${(g.paleta || []).map((t) => `<span class="ed-tono-g" style="background:${t}" title="${t}"><button type="button" data-tono-quitar="${t}" title="Quitar este tono">×</button></span>`).join('') || '<small style="color:var(--muted)">Todavía no hay tonos.</small>'}
      <button type="button" class="ed-gotas" data-gotas-guardar title="Saca un tono de la pantalla y lo guarda en la lista">${ICONO_GOTAS} Sacar un tono</button></div>
    <p class="ed-ayuda">Abre la foto de inspiración del cliente en otra ventana, toca el cuentagotas y luego el color en la foto: queda en «Tonos del proyecto» para usarlo en cualquier rueda de color.</p>`;
}
// Cuentagotas del navegador (Chrome y Edge): toma un color de cualquier punto de la pantalla
async function cuentagotas() {
  if (!window.EyeDropper) { aviso('El cuentagotas funciona en Chrome o Edge. Aquí puedes elegir el color con la rueda.'); return null; }
  try { const { sRGBHex } = await new window.EyeDropper().open(); const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(sRGBHex);
    return m ? `#${m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, '0')).join('')}` : colorValido(sRGBHex, null); } catch { return null; }
}
function cambiarCampoAcab(campo, v, tono = false) { // aplica un ajuste al material de lo seleccionado
  const s = alcanceSel(); if (!s) return;
  cambiar((d) => { acabadosEn(s, d, true).forEach((a) => { a[campo] = v; }); if (tono) guardarTono(v, d); });
  pintarAcabTab(true);
}
const caja = $('#mat-acab');
caja?.addEventListener('change', (e) => {
  const t = e.target, k = t.dataset.ac; if (!k) return;
  const v = t.type === 'checkbox' ? (t.checked ? 90 : 0) : t.type === 'number' ? parseFloat(t.value) : t.value;
  if (t.type === 'number' && !isFinite(v)) return;
  cambiarCampoAcab(k, v, t.type === 'color');
});
caja?.addEventListener('input', (e) => { // rueda de color en vivo: el 3D cambia al tiro; al soltar queda un solo paso de deshacer
  const t = e.target, s = alcanceSel(); if (t.type !== 'color' || !t.dataset.ac || !s) return;
  vivoSnap ??= JSON.stringify(modelo);
  acabadosEn(s).forEach((a) => { a[t.dataset.ac] = t.value; });
  render({ panel: false });
});
caja?.addEventListener('toggle', (e) => { if (e.target.matches?.('.ed-acab-ajustes')) ajustesAbiertos = e.target.open; }, true);
caja?.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const inp = b.parentElement?.querySelector('input[type=color]');
  if (b.dataset.gotas != null) { const hex = await cuentagotas(); if (hex && inp) cambiarCampoAcab(inp.dataset.ac, hex, true); return; }
  if (b.dataset.tono) { if (inp) cambiarCampoAcab(inp.dataset.ac, b.dataset.tono); return; }
  if (b.dataset.gotasGuardar != null) { const hex = await cuentagotas(); if (hex) { cambiar((d) => guardarTono(hex, d)); pintarAcabTab(true); aviso(`Tono ${hex} guardado en la lista.`); } return; }
  if (b.dataset.tonoQuitar) { cambiar((d) => { const g = espAcab(d); g.paleta = (g.paleta || []).filter((x) => x !== b.dataset.tonoQuitar); }); pintarAcabTab(true); return; }
  const s = alcanceSel(); if (!s) return;
  if (b.dataset.acabQuitar != null) { cambiar((d) => quitarAcabado(s, d)); pintarAcabTab(true); return; }
  if (b.dataset.acabTodos != null) {
    const a = acabadosEn(s)[0]; if (!a) return;
    cambiar((d) => { murosDe(d.espacio).filter((w) => !w.oculto).forEach((w) => ponerAcabado(`muro:${w.i}`, { ...a }, d)); });
    pintarAcabTab(true); aviso(`${a.nombre || 'Material'} aplicado en todos los muros. Ctrl+Z deshace.`);
  }
});
// Arrastrar una esfera: al soltarla sobre un muro, una zona o el suelo se aplica; un clic la aplica a lo seleccionado
function destinoAcab(ev) {
  const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
  const z = bajo?.closest?.('[data-tipo="zona-muro"]'); // vista Frente
  if (z) return z.dataset.z != null ? `muro:${z.dataset.i}:${z.dataset.z}` : `muro:${z.dataset.i}`;
  const c = bajo?.closest?.('[data-ref]'); if (!c || !lienzo.contains(c)) return null;
  if (c.dataset.ref === 'suelo') return 'suelo';
  const m = /^muro\|(\d+)(?:\|z(\d+))?$/.exec(c.dataset.ref);
  return m ? (m[2] != null ? `muro:${m[1]}:${m[2]}` : `muro:${m[1]}`) : null;
}
caja?.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-acab-mat]'); if (!b) return;
  e.preventDefault();
  const a = deBiblio(b.dataset.acabMat); if (!a) return;
  const x0 = e.clientX, y0 = e.clientY; let fantasma = null;
  const mover = (ev) => {
    if (!fantasma && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { fantasma = document.createElement('div'); fantasma.className = 'ed-fantasma-mat ed-esfera'; fantasma.style.cssText += esferaAcab(a); document.body.append(fantasma); }
    if (!fantasma) return;
    fantasma.style.left = ev.clientX + 'px'; fantasma.style.top = ev.clientY + 'px';
    const d = destinoAcab(ev);
    estadoEl.textContent = d ? `Soltar en ${nombreAlcance(d)}` : 'Suelta el material sobre un muro, una zona del muro o el suelo';
  };
  const soltar = (ev) => {
    window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
    if (!fantasma) { const s = alcanceSel(); if (s) aplicarAcab(s, a); else aviso('Selecciona un muro, una zona del muro o el suelo (tócalo en 3D o en Frente), o arrastra el material encima.'); return; }
    fantasma.remove();
    const d = destinoAcab(ev);
    if (d) aplicarAcab(d, a); else aviso('Suelta el material sobre un muro, una zona del muro o el suelo.');
  };
  window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
});

// ----- zonas del muro (vista Frente): se corta en horizontal o vertical y cada zona lleva su material
function bloqueZonasMuro(w) {
  const meta = metaMuroLeer(modelo.espacio, w.i), ZS = zonasMuro(modelo.espacio, w.i, w.largo, w.alto), dividido = ZS.length > 1;
  const z = dividido ? sel.z : 0, Z = z != null ? ZS[z] : null, s = alcanceSel(), a = s && acabadosEn(s)[0];
  const enFrente = vista === 'frente' && muroActivo()?.i === w.i;
  const campo = (eje, nombre, v) => `<label class="ed-campo">${nombre}<span class="u" data-u="cm"><input type="number" step="1" data-corte-zona="${eje}" value="${cm(v)}"></span></label>`;
  const vecinos = Z ? ['arriba', 'abajo', 'izq', 'der'].filter((dir) => vecinoZona(ZS, Z, dir)) : [];
  const nomDir = { arriba: 'la de arriba', abajo: 'la de abajo', izq: 'la de la izquierda', der: 'la de la derecha' };
  return `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Material ${Z && dividido ? `de la zona ${z + 1}` : 'del muro'}</p>
    <div class="ed-material-pieza"><i class="ed-esfera" style="${a ? esferaAcab(a, 28) : 'background:#57534e'}"></i><span style="flex:1">${a ? `<b>${esc(a.nombre || PATRONES[a.patron]?.nombre || '')}</b>` : '<small>Sin material (gris)</small>'}</span><button data-a="ver-materiales">Cambiar…</button></div>
    <p class="sub" style="margin-top:10px">Zonas del muro${dividido ? ` · ${ZS.length}` : ''}</p>
    ${dividido ? `<div class="ed-botones">${ZS.map((q) => `<button data-a="zona:${q.z}"${q.z === sel.z ? ' class="ed-primario"' : ''}>Zona ${q.z + 1} · ${cm(q.x1 - q.x0)} × ${cm(q.y1 - q.y0)}</button>`).join('')}</div>` : ''}
    ${Z ? `<p class="ed-ayuda">${dividido ? `Zona ${z + 1}: ` : ''}de ${cm(Z.x0)} a ${cm(Z.x1)} cm desde la izquierda y de ${cm(Z.y0)} a ${cm(Z.y1)} cm de alto.</p>
      <div class="ed-campos">${campo('y', 'Corte horizontal a (alto)', Math.min(Z.y1 - 2, Math.max(Z.y0 + 2, Z.y0 < 90 && Z.y1 > 92 ? 90 : (Z.y0 + Z.y1) / 2)))}${campo('x', 'Corte vertical a (desde la izq.)', (Z.x0 + Z.x1) / 2)}</div>
      <div class="ed-botones"><button data-a="zona-cortar:y">Cortar horizontal</button><button data-a="zona-cortar:x">Cortar vertical</button></div>
      ${vecinos.length ? `<div class="ed-botones">${vecinos.map((dir) => `<button data-a="zona-unir:${dir}">Unir con ${nomDir[dir]}</button>`).join('')}</div>` : ''}`
    : '<p class="ed-ayuda">Elige una zona (aquí o tocándola en la vista Frente) para cortarla o cambiar su material.</p>'}
    ${dividido ? '<div class="ed-botones"><button data-a="zonas-quitar" class="peligro">Quitar todas las divisiones</button></div>' : ''}
    <p class="ed-ayuda">Divide el muro en zonas para combinar materiales (ej. pintura arriba, azulejo entre 90 y 150 cm y otra pintura abajo): con «Dividir |» o «Dividir —» de la barra de arriba, clic sobre el muro donde va el corte, o con las medidas de aquí. ${enFrente ? 'Toca una zona para elegirla.' : 'Se ve mejor de frente: botón «Ver de frente».'}</p></div>`;
}
function vecinoZona(ZS, Z, dir) { // zona que comparte el borde completo
  const eq = (p, q) => Math.abs(p - q) < .05;
  return ZS.find((o) => o !== Z && (dir === 'arriba' ? eq(o.y0, Z.y1) && eq(o.x0, Z.x0) && eq(o.x1, Z.x1)
    : dir === 'abajo' ? eq(o.y1, Z.y0) && eq(o.x0, Z.x0) && eq(o.x1, Z.x1)
      : dir === 'izq' ? eq(o.x1, Z.x0) && eq(o.y0, Z.y0) && eq(o.y1, Z.y1)
        : eq(o.x0, Z.x1) && eq(o.y0, Z.y0) && eq(o.y1, Z.y1)));
}
// en = { i, z, v }: corte hecho con «Dividir |» o «Dividir —» al hacer clic sobre el muro en la vista Frente
function cortarZona(eje, en = null) {
  const i = en ? en.i : sel.i, w = murosDe(modelo.espacio)[i]; if (!w) return;
  const v = en ? en.v : parseFloat($(`#props [data-corte-zona="${eje}"]`)?.value);
  const ZS = zonasMuro(modelo.espacio, i, w.largo, w.alto), z = ZS.length > 1 ? (en ? en.z : sel.z) : 0, Z = ZS[z]; if (!Z) return;
  const a = Z[`${eje}0`], b = Z[`${eje}1`];
  if (!(isFinite(v) && v > a + 1 && v < b - 1)) { aviso(`El corte tiene que quedar dentro de la zona: entre ${cm(a + 1)} y ${cm(b - 1)} cm.`); return; }
  const n = Math.round(v * 10) / 10;
  cambiar((d) => {
    const mm = metaMuro(d.espacio, i), base = mm.zonas?.length ? mm.zonas : [{ ...(mm.acabado ? { acabado: mm.acabado } : {}) }];
    const q = JSON.parse(JSON.stringify(base[z]));
    mm.zonas = [...base.slice(0, z), { ...q, [`${eje}1`]: n }, { ...JSON.parse(JSON.stringify(q)), [`${eje}0`]: n }, ...base.slice(z + 1)];
    delete mm.acabado;
  });
  sel = { tipo: 'muro', i, z }; render();
  aviso(`Muro dividido a ${cm(n)} cm ${eje === 'y' ? 'de alto' : 'desde la izquierda'}. Elige una zona y suéltale un material (pestaña Materiales).`);
}
function unirZona(dir) {
  const i = sel.i, w = murosDe(modelo.espacio)[i]; if (!w || sel.z == null) return;
  const ZS = zonasMuro(modelo.espacio, i, w.largo, w.alto), Z = ZS[sel.z], o = Z && vecinoZona(ZS, Z, dir); if (!o) return;
  cambiar((d) => {
    const mm = metaMuro(d.espacio, i), q = mm.zonas[Z.z];
    const u = { x0: Math.min(Z.x0, o.x0), x1: Math.max(Z.x1, o.x1), y0: Math.min(Z.y0, o.y0), y1: Math.max(Z.y1, o.y1) };
    const borde = (k, v) => ((k.endsWith('0') && v <= .05) || (k === 'x1' && v >= w.largo - .05) || (k === 'y1' && v >= w.alto - .05) ? null : v); // al borde: null (sigue al muro)
    const nueva = { ...(q.acabado ? { acabado: q.acabado } : {}) }; Object.entries(u).forEach(([k, v]) => { const b = borde(k, v); if (b != null) nueva[k] = b; });
    mm.zonas = mm.zonas.filter((_, j) => j !== o.z); mm.zonas[mm.zonas.indexOf(q)] = nueva;
    if (mm.zonas.length === 1) { if (mm.zonas[0].acabado) mm.acabado = mm.zonas[0].acabado; delete mm.zonas; }
  });
  const quedan = metaMuroLeer(modelo.espacio, i).zonas?.length;
  sel = quedan ? { tipo: 'muro', i, z: Z.z > o.z ? Z.z - 1 : Z.z } : { tipo: 'muro', i }; render();
}
// ----- muebles agrupados (ej. en L): siguen siendo módulos separados pero se mueven y giran juntos
const grupoDe = (m) => (m?.grupo ? modelo.modulos.filter((x) => x.grupo === m.grupo) : m ? [m] : []);
function girarGrupo(m, grados) {
  const mods = grupoDe(m);
  if (mods.length < 2) return planta.rotar(m, grados);
  const cs = mods.map((x) => { const h = huella(x); return [(h[0][0] + h[2][0]) / 2, (h[0][1] + h[2][1]) / 2]; });
  const C = [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
  mods.forEach((x, i) => {
    const [dx, dz] = girar(cs[i][0] - C[0], cs[i][1] - C[1], grados); // nuevo centro, girado alrededor del centro del grupo
    planta.rotar(x, grados);
    const h = huella(x), cx = (h[0][0] + h[2][0]) / 2, cz = (h[0][1] + h[2][1]) / 2;
    x.x = r1(+x.x + C[0] + dx - cx); x.z = r1(+x.z + C[1] + dz - cz);
  });
}

// Girar desde el panel o con R. En Frente el mueble se dibuja siempre de frente, así que el giro no se nota ahí
// (el dueño creyó que no giraba, 2026-11-23): se avisa hacia dónde quedó, y si se estaba viendo un muro y el mueble
// ya no está en él, la vista pasa a «Mueble seleccionado» para que no desaparezca.
function girarConAviso(m, grados) {
  if (!m) return;
  cambiar(() => girarGrupo(m, grados));
  const rot = ((((+m.rotacion || 0) % 360) + 360) % 360), [fx, fz] = girar(0, 1, rot); // hacia dónde mira el frente
  const w = murosDe(modelo.espacio).filter((x) => !x.oculto && x.n).find((x) => x.n[0] * fx + x.n[1] * fz < -.9); // el muro de enfrente
  const espalda = w ? ` · su frente mira hacia el ${w.etiqueta || `muro ${w.i + 1}`}` : '';
  if (vista === 'frente') {
    if (muroFrente != null && !modulosFrente().some((x) => x.id === m.id)) { muroFrente = null; opcionesMuroFrente(); render(); encuadrar(true); }
    aviso(`«${m.nombre}» girado a ${rot}°${espalda}. En Frente el mueble se ve siempre de frente: el giro se ve en Planta y en 3D.`);
  } else aviso(`«${m.nombre}» girado a ${rot}°${espalda}.`);
}

// ===================== dibujo =====================
function selRef() {
  if (!sel) return null;
  if (sel.tipo === 'multi') return sel.ids.map((id) => `${id}|`);
  if (sel.tipo === 'vano') return `vano|${sel.i}|${sel.v}`;
  if (sel.tipo === 'artefacto') return `${sel.m}|a|${sel.a}`;
  if (sel.tipo === 'objeto') return `obj|${sel.o}`;
  if (sel.tipo === 'pieza') return `${sel.m}|cuerpo|${sel.p}${sel.parte != null ? `|p${sel.parte}` : ''}`;
  if (sel.tipo === 'repisa') return `${sel.m}|f|${sel.col}|${sel.fila}|rep|${sel.i}`;
  if (sel.tipo === 'div') return sel.dir === 'h' ? `${sel.m}|f|${sel.col}|${sel.fila}|div` : `${sel.m}|cuerpo|dv${sel.col}`;
  return {
    modulo: `${sel.m}|`, cuerpo: `${sel.m}|cuerpo`, zocalo: `${sel.m}|zocalo`, cubierta: `${sel.m}|cubierta`,
    frente: `${sel.m}|f|${sel.col}|${sel.fila}`, tirador: `${sel.m}|t|${sel.t}`, muro: `muro|${sel.i}${sel.z != null ? `|z${sel.z}` : ''}`, suelo: 'suelo',
  }[sel.tipo];
}
// En la vista Frente se trabaja el mueble seleccionado de frente y sin girar (si no hay
// selección, todos). En Planta y 3D se ve el espacio completo con los muebles ubicados.
// Frente por muro: se ven de frente los muebles apoyados en ese muro, medidos desde su extremo izquierdo
// (mirando el muro desde adentro). u = a lo largo del muro (izq → der), n = hacia adentro del espacio.
let muroFrente = null; // índice del muro o null (= mueble seleccionado / todos)
function muroActivo() {
  if (muroFrente == null) return null;
  const w = murosDe(modelo.espacio)[muroFrente];
  if (!w || w.oculto) { muroFrente = null; return null; }
  return { ...w, ...ejeMuro(w) };
}
// ----- ventanas y puertas
// Vano seleccionado: { w (muro), v (medidas válidas), raw (registro guardado, para editar) }
function vanoSel(d = modelo) {
  if (sel?.tipo !== 'vano') return null;
  const w = murosDe(d.espacio)[sel.i]; if (!w) return null;
  const v = vanosDe(w).find((x) => x.id === sel.v); if (!v) return null;
  return { w, v, raw: (metaMuro(d.espacio, sel.i).vanos || []).find((x) => x.id === sel.v) };
}
// Muro donde se inserta un vano: el que se ve de frente o el seleccionado
function muroParaVano() {
  const W = vista === 'frente' && muroActivo(); if (W) return W.i;
  if (sel?.tipo === 'muro' || sel?.tipo === 'vano') return sel.i;
  return null;
}
$('#vanos').addEventListener('click', (e) => {
  const t = e.target.closest('[data-vano]')?.dataset.vano; if (!t) return;
  const i = muroParaVano();
  if (i == null) { aviso('Elige primero un muro: selecciónalo en Planta o míralo de frente (selector de muro en la vista Frente).'); return; }
  const w = murosDe(modelo.espacio)[i], def = VANOS[t];
  const ancho = Math.min(def.ancho, w.largo), alto = Math.min(def.alto, w.alto);
  const v = { id: uid('v'), tipo: t, desde: Math.round((w.largo - ancho) / 2), ancho, alto, antepecho: def.puerta ? 0 : Math.min(def.antepecho, w.alto - alto) };
  cambiar((d) => { const m = metaMuro(d.espacio, i); m.vanos = [...(m.vanos || []), v]; });
  sel = { tipo: 'vano', i, v: v.id };
  muroFrente = i;
  if (vista !== 'frente') setVista('frente');
  render();
  encuadrar(true); dibujarPlano();
  aviso(`${def.nombre} agregada al muro ${i + 1}. Arrástrala o cambia sus medidas en el panel derecho.`);
});
// ----- artefactos de cocina
// Sobre la cubierta: en el mueble seleccionado (o cuya cubierta se seleccionó). De piso: como un módulo,
// en el muro que se ve de frente (o el seleccionado), en el primer espacio libre a nivel de piso.
function agregarArtefacto(tipo) {
  const def = ARTEFACTOS[tipo]; if (!def) return;
  if (def.zona === 'cubierta') {
    // lavaplatos y encimeras (dueño, 2026-11-25): el lugar debe tener cubierta. Sirve cualquier mueble seleccionado
    // (también el esquinero) en Planta, Frente o 3D; después se mueve libre por las cubiertas.
    const m = sel?.m && modulo(sel.m);
    if (!m || m.artefacto) { aviso('Selecciona un mueble con cubierta (en Planta, Frente o 3D) y luego elige la encimera o el lavaplatos.'); return; }
    if (!m.cubierta) { aviso(`«${m.nombre}» no tiene cubierta: el ${def.cubas ? 'lavaplatos' : 'encimera'} necesita una. Márcala en el panel del mueble («Lleva cubierta») y vuelve a intentarlo.`); return; }
    const zs = zonasCubierta(m), z1 = zs[0], Dc = z1.z1, esq = m.tipo === 'esquinero';
    const largo = esq ? Math.abs((m.esquina === 'izq' ? z1.x1 - zs[1].x1 : zs[1].x0 - z1.x0)) : z1.x1 - z1.x0; // brazo 1 sin el rincón
    const ancho = Math.min(def.ancho, Math.max(30, largo)), fondo = Math.min(def.fondo, Dc - 2);
    const x0 = esq && m.esquina === 'izq' ? zs[1].x1 : Math.max(0, z1.x0);
    const a = { id: uid('a'), tipo, ancho, fondo, desde: r1(x0 + (largo - ancho) / 2), frente: Math.min(5, Dc - fondo), ...(def.cubas ? { lado: 'derecha' } : {}) };
    cambiar(() => { m.artefactos = [...(m.artefactos || []), a]; });
    sel = { tipo: 'artefacto', m: m.id, a: a.id }; render();
    aviso(`${def.nombre} en «${m.nombre}». Arrástralo en Planta (pasa de un mueble a otro por la cubierta) o escribe sus distancias en el panel.`);
    return;
  }
  const m = { ...nuevoModulo({ ancho: def.ancho, alto: def.alto, profundidad: def.fondo, zocalo: 0 }), nombre: def.nombre, artefacto: tipo, zocalo: 0, cubierta: false, tiradores: [] };
  m.columnas = [{ ancho: def.ancho, frentes: [{ tipo: 'panel', alto: def.alto }] }];
  const i = muroParaVano(), w = i != null ? murosDe(modelo.espacio)[i] : null;
  if (w && !w.oculto) {
    const E = ejeMuro(w), s = espacioLibre(w, E, def.ancho);
    m.x = E.O[0] + s * E.u[0]; m.z = E.O[1] + s * E.u[1]; m.rotacion = E.rot;
    muroFrente = i;
  } else {
    m.x = modelo.modulos.reduce((a, x) => Math.max(a, +x.x + +x.ancho), 0); // a la derecha de lo que hay
  }
  cambiar((d) => d.modulos.push(m));
  sel = { tipo: 'modulo', m: m.id };
  if (vista === '3d') setVista('frente');
  render(); encuadrar(true); dibujarPlano();
  aviso(`${def.nombre} agregada. Muévela hacia los lados en Frente: las cotas muestran la distancia a lo más cercano.`);
}
// Primer tramo libre del muro (a nivel de piso: muebles basales y puertas) donde cabe un ancho dado
function espacioLibre(w, E, ancho) {
  const s = (x, z) => (x - E.O[0]) * E.u[0] + (z - E.O[1]) * E.u[1];
  const occ = [];
  for (const m of modelo.modulos) {
    const dr = Math.abs((((+m.rotacion || 0) - E.rot) % 360 + 360) % 360);
    if (Math.min(dr, 360 - dr) > 1 || +m.elevacion > 60 || Math.abs(+m.x * w.n[0] + +m.z * w.n[1] - E.linea) > 60) continue;
    const a = s(+m.x, +m.z); occ.push([a, a + +m.ancho]);
  }
  for (const v of vanosDe(w)) if (VANOS[v.tipo].puerta || v.antepecho < 60) occ.push([v.desde, v.desde + v.ancho]);
  occ.sort((p, q) => p[0] - q[0]);
  let x = 0;
  for (const [a, b] of occ) { if (a - x >= ancho) return x; x = Math.max(x, b); }
  return w.largo - x >= ancho ? x : Math.max(0, (w.largo - ancho) / 2);
}
$('#artefactos').addEventListener('click', (e) => { const t = e.target.closest('[data-artefacto]')?.dataset.artefacto; if (t) agregarArtefacto(t); });

// ----- electrodomésticos sueltos (refrigeradores, microondas…): modelo.objetos
const objeto = (id) => (modelo.objetos || []).find((o) => o.id === id);
// Superficies donde se puede apoyar algo en el punto (x, z): piso, cubiertas y secciones abiertas (su base y repisas)
function apoyosEn(x, z) {
  const out = [{ y: 0, nombre: 'Piso' }];
  for (const m of modelo.modulos) {
    if (m.artefacto) continue;
    const [lx, lz] = girar(x - +m.x, z - +m.z, -(+m.rotacion || 0)), T = tablero(m), H = +m.alto, e = +m.elevacion || 0;
    if (m.cubierta) { const c = cubiertaDe(m); if (lx >= c.x0 && lx <= c.x1 && lz >= c.z0 && lz <= c.z1) out.push({ y: e + H + CT, nombre: `Cubierta de ${m.nombre}` }); }
    if (lx < 0 || lx > +m.ancho || lz < 0 || lz > +m.profundidad) continue;
    if (!m.cubierta && m.tipo !== 'aereo' && !m.aereo && !m.artefacto) out.push({ y: e + H, nombre: `Sobre ${m.nombre}` });
    for (const c of celdas(m)) {
      if (c.tipo !== 'abierto' || lx < c.x0 || lx > c.x1) continue;
      const baseMueble = c.y0 <= Zde(m) + .05;
      const piso = baseMueble ? (Array.isArray(m.quitar) && m.quitar.includes('piso') ? Zde(m) : Zde(m) + T) : c.y0 + T / 2;
      out.push({ y: e + piso, nombre: `Sección abierta de ${m.nombre}` });
      nivelesRepisa(c).forEach((y, i) => out.push({ y: e + y + T / 2, nombre: `Repisa ${i + 1} de ${m.nombre}` }));
    }
  }
  return out.sort((a, b) => a.y - b.y);
}
// Al moverlo, queda sobre la superficie más alta que tenga debajo sin pasar por encima de donde estaba
// Los de mesa (microondas, horno, cafetera…) necesitan una base física: cubierta, repisa o la base de una sección
// (dueño, 2026-11-25: el piso no sirve). Devuelve false si ahí no hay dónde apoyarlo (quien mueve lo deja donde estaba).
function apoyar(o) {
  const def = OBJETOS[o.tipo];
  if (def?.apoyo === 'techo') return true; // cuelga del techo: se queda a su altura
  let ap = apoyosEn(+o.x, +o.z);
  if (def?.apoyo === 'mesa') { ap = ap.filter((a) => a.y > 0); if (!ap.length) return false; }
  const bajo = ap.filter((a) => a.y <= (+o.elevacion || 0) + 1), elegido = bajo.length ? bajo[bajo.length - 1] : ap[0];
  o.elevacion = r1(elegido ? elegido.y : 0);
  return true;
}
function agregarObjeto(tipo) {
  const def = OBJETOS[tipo]; if (!def) return;
  const o = { id: uid('o'), tipo, nombre: def.nombre, ancho: def.ancho, alto: def.alto, fondo: def.fondo, x: 0, z: 0, elevacion: 0, rotacion: 0 };
  const m = sel?.m && modulo(sel.m);
  const mc = def.apoyo === 'mesa' ? (m?.cubierta ? m : modelo.modulos.find((x) => x.cubierta && !x.artefacto)) : null;
  if (def.apoyo === 'techo') { // lámpara colgante: sobre la cubierta del mueble elegido (o la primera), a 75 cm de ella
    const mt = m?.cubierta ? m : modelo.modulos.find((x) => x.cubierta && !x.artefacto) || m;
    const techo = +modelo.espacio?.alto || 240;
    if (mt) { const c = mt.cubierta ? cubiertaDe(mt) : { x0: 0, x1: +mt.ancho, z0: 0, z1: +mt.profundidad }, [dx, dz] = girar((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, +mt.rotacion || 0); o.x = r1(+mt.x + dx); o.z = r1(+mt.z + dz); o.elevacion = r1(+mt.elevacion + +mt.alto + (mt.cubierta ? CT : 0) + 75); }
    else o.elevacion = 150;
    o.cable = r1(Math.max(0, techo - o.elevacion - def.alto));
  } else if (mc) { // sobre una cubierta: centrado, mirando hacia el frente del mueble
    const c = cubiertaDe(mc), [dx, dz] = girar((c.x0 + c.x1) / 2, (c.z1 - def.fondo / 2 - 4), +mc.rotacion || 0);
    o.x = r1(+mc.x + dx); o.z = r1(+mc.z + dz); o.rotacion = +mc.rotacion || 0; o.elevacion = r1(+mc.elevacion + +mc.alto + CT);
  } else if (def.apoyo === 'mesa') { // sin cubierta: en una sección abierta o repisa del mueble seleccionado; si no hay, no se agrega
    const ap = m && !m.artefacto ? (() => { const [cx, cz] = centro(m); return { cx, cz, l: apoyosEn(cx, cz).filter((a) => a.y > 0) }; })() : null;
    if (!ap?.l.length) { aviso(`${def.nombre}: necesita una base (cubierta, repisa o sección abierta de un mueble), no el piso. Selecciona ese mueble y vuelve a intentarlo.`); return; }
    o.x = r1(ap.cx); o.z = r1(ap.cz); o.rotacion = +m.rotacion || 0; o.elevacion = r1(ap.l[0].y);
  } else {
    const i = muroParaVano(), w = i != null ? murosDe(modelo.espacio)[i] : null;
    if (w && !w.oculto) { // en el primer espacio libre del muro, con la espalda contra él
      const E = ejeMuro(w), s = espacioLibre(w, E, def.ancho) + def.ancho / 2;
      o.x = r1(E.O[0] + s * E.u[0] + w.n[0] * (def.fondo / 2 + 1)); o.z = r1(E.O[1] + s * E.u[1] + w.n[1] * (def.fondo / 2 + 1)); o.rotacion = E.rot;
    } else { const L = limites(modelo, { conMuros: false }); o.x = r1(L.x1 + def.ancho / 2 + 5); o.z = r1(def.fondo / 2); }
  }
  cambiar((d) => { d.objetos = [...(d.objetos || []), o]; });
  sel = { tipo: 'objeto', o: o.id }; render();
  aviso(`${def.nombre} agregado${mc ? ` sobre la cubierta de «${mc.nombre}»` : ''}. Muévelo en Planta o Frente; sus medidas se cambian en el panel.`);
}
$('#objetos').addEventListener('click', (e) => { const t = e.target.closest('[data-objeto]')?.dataset.objeto; if (t) agregarObjeto(t); });
function cambiarObjeto(f) { const id = sel.o; cambiar((d) => { const o = (d.objetos || []).find((x) => x.id === id); if (o) f(o); }); }
function cambiarArtefacto(f) {
  const s = { ...sel };
  cambiar((d) => { sel = s; const m = d.modulos.find((x) => x.id === s.m), a = m?.artefactos?.find((x) => x.id === s.a); if (a) f(a, m, cubiertaDe(m)); });
}

// Lavaplatos o encimera en el esquinero: de frente al lado 1, al lado 2 o girado en el rincón (dueño, 2026-11-25).
// Busca el primer lugar de ese tramo donde se apoya completo sobre la L.
function posicionEnL(pos) {
  const s = { ...sel }, m0 = modulo(s.m), a = m0 && artefactosDe(m0).find((x) => x.id === s.a); if (!a || m0.tipo !== 'esquinero') return;
  const izq = m0.esquina === 'izq', [A, Bz] = zonasCubierta(m0), sg = izq ? 1 : -1;
  const mundo = ([lx, lz]) => { const [dx, dz] = girar(lx, lz, +m0.rotacion || 0); return [+m0.x + dx, +m0.z + dz]; };
  const cand = [];
  const ent = (n) => Array.from({ length: n + 1 }, (_, i) => i / n);
  if (pos === 'lado1') { // a lo largo del brazo 1, a 5 cm del canto, partiendo del medio del tramo sin rincón
    const xa = izq ? Bz.x1 : A.x0, xb = izq ? A.x1 : Bz.x0, z = A.z1 - 5 - a.fondo / 2;
    for (const t of ent(40).sort((p, q) => Math.abs(p - .5) - Math.abs(q - .5))) cand.push([[xa + (xb - xa) * t, z], 0]);
  } else if (pos === 'lado2') { // a lo largo del brazo 2, de frente a él
    const x = izq ? Bz.x1 - 5 - a.fondo / 2 : Bz.x0 + 5 + a.fondo / 2;
    for (const t of ent(40)) cand.push([[x, A.z0 + (Bz.z1 - A.z0) * t], sg * 90]);
    cand.sort((p, q) => Math.abs(p[0][1] - (Bz.z0 + Bz.z1) / 2) - Math.abs(q[0][1] - (Bz.z0 + Bz.z1) / 2));
  } else { // en el rincón: sobre la diagonal, desde la esquina de los muros hacia afuera, el primero que cabe
    const c0 = [izq ? A.x0 : A.x1, A.z0], c1 = [izq ? Bz.x1 : Bz.x0, A.z1];
    for (const t of ent(100)) cand.push([[c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t], sg * 45]);
  }
  let ok = null;
  cambiar((d) => {
    for (const [p, giro] of cand) { const [wx, wz] = mundo(p); const mid = moverArtefacto(d, s.m, s.a, wx, wz, giro); if (mid) { ok = mid; break; } }
  });
  if (!ok) aviso('No cabe en esa posición: achica el artefacto o agranda la cubierta.');
  sel = { ...s, m: ok || s.m }; render();
}

function cambiarVano(f) {
  const s = { ...sel };
  cambiar((d) => { sel = s; const x = vanoSel(d); if (!x) return; f(x.raw, x.w, VANOS[x.raw.tipo] || VANOS.vano); });
}
const proyS = (W, x, z) => (x - W.O[0]) * W.u[0] + (z - W.O[1]) * W.u[1]; // posición a lo largo del muro
function enMuro(m, W) {
  const dr = Math.abs((((+m.rotacion || 0) - W.rot) % 360 + 360) % 360);
  if (Math.min(dr, 360 - dr) > 1) return false; // no mira hacia afuera de este muro
  const t = +m.x * W.n[0] + +m.z * W.n[1];
  if (Math.abs(t - W.linea) > 60) return false; // demasiado lejos del muro (ej. una isla)
  const s = proyS(W, +m.x, +m.z);
  return s + +m.ancho > -5 && s < W.largo + 5;
}
// Posición horizontal del mueble en la vista Frente
const xF = (m) => { const W = vista === 'frente' && muroActivo(); return W ? proyS(W, +m.x, +m.z) : +m.x; };
// Mover a lo largo de la vista Frente (en un muro: siguiendo el muro)
function moverFrente(m, dx) {
  const W = vista === 'frente' && muroActivo();
  if (W) { m.x = +m.x + dx * W.u[0]; m.z = +m.z + dx * W.u[1]; } else m.x = +m.x + dx;
}
// Electrodomésticos en la vista Frente, con su posición horizontal fx (centro) en coordenadas de la vista
function objetosFrente() {
  const W = muroActivo();
  if (!W) return sel?.m && sel.tipo !== 'muro' && modulo(sel.m) ? [] : (modelo.objetos || []).map((o) => ({ ...o, fx: +o.x }));
  return (modelo.objetos || []).map((o) => ({ ...o, fx: proyS(W, +o.x, +o.z), t: +o.x * W.n[0] + +o.z * W.n[1] - W.linea }))
    .filter((o) => o.t > -5 && o.t < 120 && o.fx + o.ancho / 2 > -5 && o.fx - o.ancho / 2 < W.largo + 5);
}
function modulosFrente() {
  const W = muroActivo();
  if (W) return modelo.modulos.filter((m) => enMuro(m, W));
  const s = sel && sel.tipo !== 'muro' ? modulo(sel.m) : null;
  return s ? [s] : modelo.modulos;
}
// Vista «Abajo»: el mueble seleccionado visto desde el piso (sin girar), para ver y ajustar el marco del zócalo
const moduloInferior = () => { const m = sel?.m && modulo(sel.m); return m && !m.artefacto ? m : null; };
function modeloVista() {
  if (aislado && vista === '3d' && !v34) { const m = modulo(aislado); if (m) return { ...modelo, espacio: null, objetos: [], modulos: [m] }; aislado = null; }
  if (vista === 'inferior') { const m = moduloInferior(); return { ...modelo, espacio: null, objetos: [], modulos: m ? [{ ...m, x: 0, z: 0, rotacion: 0, elevacion: 0 }] : [] }; }
  if (vista !== 'frente') return modelo;
  const W = muroActivo();
  return {
    ...modelo,
    // el muro activo solo sirve para encuadrar (no se dibuja en 3D)
    espacio: W ? { alto: W.alto, puntos: [{ x: 0, z: 0 }, { x: W.largo, z: 0 }], muros: [{ alto: W.alto }] } : null,
    modulos: modulosFrente().map((m) => ({ ...m, x: xF(m), rotacion: 0, z: 0 })),
    objetos: objetosFrente().map((o) => ({ ...o, x: o.fx, z: W ? o.t : +o.fondo / 2, rotacion: W ? (+o.rotacion || 0) - W.rot : 0 })),
  };
}
function opcionesMuroFrente() {
  const s = $('#muro-frente'), ws = murosDe(modelo.espacio).filter((w) => !w.oculto);
  s.hidden = vista !== 'frente' || !ws.length;
  s.innerHTML = `<option value="">Mueble seleccionado / todos</option>${ws.map((w) => `<option value="${w.i}"${muroFrente === w.i ? ' selected' : ''}>Muro ${w.i + 1}${w.etiqueta ? ' · ' + esc(w.etiqueta) : ''} · ${cm(w.largo)} cm</option>`).join('')}`;
}
$('#muro-frente').addEventListener('change', (e) => {
  muroFrente = e.target.value === '' ? null : +e.target.value;
  if (sel?.tipo === 'muro') sel = null;
  render(); encuadrar(true);
});
// Moverse por el entorno en 3D (dueño, 2026-11-25): hasta 3 m del centro con clic derecho o las flechas en pantalla.
// No en Planta, Frente ni en la vista 3/4 fija. Ajustar el radio aquí después de probarlo.
const RADIO_PAN = 300;
let panActual = -1;
function render({ panel = true } = {}) {
  const panOn = vista === '3d' && !v34 ? RADIO_PAN : 0; if (panOn !== panActual) { panActual = panOn; st.panLimit(panOn); }
  const mv = modeloVista();
  if (v34 && (vista !== '3d' || !modulo(v34.id) || !geoEsquinero(modulo(v34.id)).sol)) salir34(false);
  const fo = focoEditor(); if (abiertosEd.id !== fo) abiertosEd = { id: fo, claves: [], activo: false }; // otro mueble: todo cerrado
  const abrirFoco = fo && abiertosEd.activo && modulo(fo)?.tipo !== 'esquinero' ? { id: fo, abiertos: abiertosEd.claves } : null;
  dibujar(st, conCliente(mv), { abrir: abrirFoco, capas: vista === 'frente' || vista === 'inferior' ? { ...capas, muros: false } : v34 ? { ...capas, cantoMuro: false } : capas, mats: mats(), sel: v34 ? null : selRef(), fabricacion: true, interior: v34, pisoClic: true });
  if (fo) st.rig.querySelectorAll('.c3-f[data-ref]').forEach((f) => { const r = f.dataset.ref; if (!r.startsWith(`${fo}|`) && !/^(muro|vano|suelo)(\||$)/.test(r)) f.classList.add('c3-tenue-ed'); }); // los demás, semitransparentes
  const fuera = fueraCliente(); // muebles que el cliente no cotiza: atenuados (siguen editables)
  if (fuera.size) st.rig.querySelectorAll('[data-ref]').forEach((f) => { if (fuera.has(f.dataset.ref.split('|')[0])) f.classList.add('c3-fuera'); });
  if (vista !== 'inferior' && (vista === 'frente' || !murosDe(modelo.espacio).length || !capas.muros)) pisoGrilla(mv); // desde abajo el piso taparía el mueble
  if (vista !== 'frente' && vista !== 'inferior') dibujarPines();
  encuadrar(false);
  dibujarPlano();
  if (panel) { arbol(); props(); pintarAcabTab(); }
  if (v34) giroAuto(); // la puerta giratoria sigue girando después de redibujar
  opcionesMuroFrente();
  ponerManija();
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
  if (v34) { // vista 3/4: encuadra solo el esquinero
    const m = modulo(v34.id); if (!m) return;
    const h = huella(m), cx = (h[0][0] + h[2][0]) / 2, cz = (h[0][1] + h[2][1]) / 2;
    st.frame([cx, +m.elevacion + +m.alto / 2, cz], Math.hypot(+m.ancho, +m.profundidad, +m.alto) * 1.05, 1);
    return;
  }
  if (!forzar && encuadreHecho && (herr === 'muros' || herr === 'medir')) return; // dibujando muros o midiendo: la vista no se mueve
  const L = limites(modeloVista(), { conMuros: vista === 'frente' ? !!muroActivo() : capas.muros });
  const clave = `${vista}|${L.x0}|${L.x1}|${L.y1}|${L.z0}|${L.z1}|${zoom}|${lienzo.clientWidth}x${lienzo.clientHeight}`;
  if (!forzar && clave === encuadreHecho) return;
  encuadreHecho = clave;
  const Wp = lienzo.clientWidth || 800, Hp = lienzo.clientHeight || 600;
  const s0 = Math.min(Wp, Hp);
  let px; // px por cm
  if (vista === 'frente') px = Math.min(Wp / ((L.w + 60) * 1.15), Hp / ((L.h + 50) * 1.15));
  else if (vista === 'planta') px = Math.min(Wp / ((L.w + 110) * 1.1), Hp / ((L.d + 110) * 1.1));
  else if (vista === 'inferior') px = Math.min(Wp / ((L.w + 70) * 1.15), Hp / ((L.d + 70) * 1.15));
  else { const diag = Math.hypot(L.w, L.h, L.d); px = Math.min(Wp, Hp) / (diag * 1.25); }
  px *= zoom;
  st.frame([(L.x0 + L.x1) / 2, vista === 'frente' ? L.h / 2 + 5 : vista === 'planta' || vista === 'inferior' ? 0 : L.h / 2, (L.z0 + L.z1) / 2], s0 / px, 1);
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

// ----- vista «Abajo»: coordenadas locales del mueble (x, z) ↔ pantalla. Desde abajo, la pared (z = 0) queda arriba.
function mapaInf() {
  const Wp = lienzo.clientWidth, Hp = lienzo.clientHeight, s = st.scale, c = st.center, k = signoInf();
  return { s, Wp, Hp, X: (x) => Wp / 2 + (x - c[0]) * s, Y: (z) => Hp / 2 + k * (z - c[2]) * s, x: (px) => c[0] + (px - Wp / 2) / s, z: (py) => c[2] + k * (py - Hp / 2) / s };
}
// Sentido del eje z en pantalla con la cámara mirando hacia arriba (se mide una vez con el motor)
let _signoInf = 0;
function signoInf() {
  if (_signoInf) return _signoInf;
  try { const P = st.proyeccion(); const a = P.transformPoint(new DOMPoint(0, 0, 0)), b = P.transformPoint(new DOMPoint(0, 0, 10)); _signoInf = (b.y / b.w - a.y / a.w) >= 0 ? 1 : -1; } catch (e) { _signoInf = -1; }
  return _signoInf;
}
function dibujarInferior() {
  const M = mapaInf();
  plano.setAttribute('viewBox', `0 0 ${M.Wp} ${M.Hp}`);
  plano.replaceChildren();
  const m = moduloInferior();
  if (!m) { el('text', { x: M.Wp / 2, y: M.Hp / 2, 'text-anchor': 'middle', class: 'inf-vacio' }, plano).textContent = 'Selecciona un mueble para verlo desde abajo'; return; }
  const W = +m.ancho, D = +m.profundidad, DT = fondoTotal(m), T = tablero(m), Z = Zde(m);
  const R = (x0, z0, x1, z1, attrs) => el('rect', { x: Math.min(M.X(x0), M.X(x1)), y: Math.min(M.Y(z0), M.Y(z1)), width: Math.abs(M.X(x1) - M.X(x0)), height: Math.abs(M.Y(z1) - M.Y(z0)), ...attrs }, plano);
  R(0, 0, W, DT, { class: 'inf-mueble' }); // contorno del mueble (con los frentes)
  el('text', { x: M.X(W / 2), y: M.Y(-6), 'text-anchor': 'middle', class: 'inf-txt' }, plano).textContent = 'pared (atrás)';
  el('text', { x: M.X(W / 2), y: M.Y(DT + 6) + 4, 'text-anchor': 'middle', class: 'inf-txt' }, plano).textContent = 'frente';
  if (!Z) { el('text', { x: M.X(W / 2), y: M.Y(DT / 2), 'text-anchor': 'middle', class: 'inf-txt' }, plano).textContent = 'Este mueble no lleva zócalo (alto 0)'; return; }
  const z = marcoZocalo(m, T), es = sel?.tipo === 'zocalo';
  R(z.x0 + T, z.z0 + T, z.x1 - T, z.z1 - T, { class: 'inf-mover', 'data-tipo': 'zoc-mover' }); // interior: arrastrar mueve el marco
  const lados = { f: [z.x0, z.z1 - T, z.x1, z.z1], a: [z.x0, z.z0, z.x1, z.z0 + T], i: [z.x0, z.z0, z.x0 + T, z.z1], d: [z.x1 - T, z.z0, z.x1, z.z1] };
  for (const [l, [a, b, c, d]] of Object.entries(lados)) R(a, b, c, d, { class: `inf-lado${es ? ' sel' : ''}`, 'data-tipo': 'zoc-lado', 'data-lado': l });
  // cotas: retiros del marco a los bordes del cuerpo (se pueden escribir)
  const g = el('g', { class: 'cota' }, plano);
  const cota = (x1, z1, x2, z2, v, k) => {
    if (v < .05) return;
    el('line', { x1: M.X(x1), y1: M.Y(z1), x2: M.X(x2), y2: M.Y(z2) }, g);
    el('text', { x: (M.X(x1) + M.X(x2)) / 2 + (z1 === z2 ? 0 : 6), y: (M.Y(z1) + M.Y(z2)) / 2 + (z1 === z2 ? -6 : 4), 'text-anchor': z1 === z2 ? 'middle' : 'start', class: 'editable', 'data-cota': k, 'data-m': m.id }, g).textContent = cm(v);
  };
  const zm = (z.z0 + z.z1) / 2, xm = (z.x0 + z.x1) / 2;
  cota(0, zm, z.x0, zm, z.izq, 'zocalo_izq'); cota(z.x1, zm, W, zm, z.der, 'zocalo_der');
  cota(xm, 0, xm, z.z0, z.atras, 'zocalo_atras'); cota(xm, z.z1, xm, D, z.frente, 'zocalo_retiro');
  el('text', { x: M.X(xm), y: M.Y(zm) + 4, 'text-anchor': 'middle', class: 'inf-txt' }, plano).textContent = `zócalo ${cm(z.x1 - z.x0)} × ${cm(z.z1 - z.z0)} · alto ${cm(Z)}`;
}
// Zonas del muro visto de frente, rellenas con su material (el mismo dibujo del 3D, a escala)
function zonasFrente(W, M) {
  const ZS = zonasMuro(modelo.espacio, W.i, W.largo, W.alto), defs = el('defs', {}, plano);
  for (const Z of ZS) {
    let fill = 'transparent';
    if (Z.acabado) {
      const a = normalizarAcab(Z.acabado), t = a.patron === 'liso' ? null : mosaico(a);
      if (!t) fill = a.color;
      else {
        const id = `pz${W.i}-${Z.z}`, pat = el('pattern', { id, patternUnits: 'userSpaceOnUse', x: M.X(0), y: M.Y(0), width: t.w * M.s, height: t.h * M.s }, defs);
        el('image', { href: `data:image/svg+xml,${encodeURIComponent(t.svg)}`, width: t.w * M.s, height: t.h * M.s, preserveAspectRatio: 'none' }, pat);
        fill = `url(#${id})`;
      }
    }
    const esSel = sel?.tipo === 'muro' && sel.i === W.i && (Z.dividido ? sel.z === Z.z : sel.z == null);
    el('rect', { x: M.X(Z.x0), y: M.Y(Z.y1), width: (Z.x1 - Z.x0) * M.s, height: (Z.y1 - Z.y0) * M.s, fill, class: `zona-muro${esSel ? ' sel' : ''}`, 'data-tipo': 'zona-muro', 'data-i': W.i, ...(Z.dividido ? { 'data-z': Z.z } : {}) }, plano);
    if (Z.dividido) el('text', { x: M.X(Z.x0) + 6, y: M.Y(Z.y0) - 6, class: 'zona-muro-txt' }, plano).textContent = `Zona ${Z.z + 1}`;
  }
}
function dibujarPlano() {
  if (vista === 'planta') return planta.dibujar();
  if (vista === 'inferior') return dibujarInferior();
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
  const W = muroActivo();
  if (W) { // contorno del muro que se está viendo, con su largo
    if (capas.acabados !== false) zonasFrente(W, M);
    el('rect', { x: M.X(0), y: M.Y(W.alto), width: W.largo * M.s, height: W.alto * M.s, class: 'muro-frente' }, plano);
    el('text', { x: M.X(0) + 8, y: M.Y(W.alto) + 18, class: 'muro-frente-txt' }, plano).textContent = `Muro ${W.i + 1}${W.etiqueta ? ' · ' + W.etiqueta : ''} · ${cm(W.largo)} × ${cm(W.alto)} cm`;
    for (const v of vanosDe(W)) {
      const esSel = sel?.tipo === 'vano' && sel.i === W.i && sel.v === v.id;
      el('rect', { x: M.X(v.desde), y: M.Y(v.antepecho + v.alto), width: v.ancho * M.s, height: v.alto * M.s, class: `vano${esSel ? ' sel' : ''}`, 'data-tipo': 'vano', 'data-i': W.i, 'data-v': v.id }, plano);
      el('text', { x: M.X(v.desde + v.ancho / 2), y: M.Y(v.antepecho + v.alto / 2) + 4, 'text-anchor': 'middle', class: 'vano-txt' }, plano).textContent = `${VANOS[v.tipo].nombre} ${cm(v.ancho)} × ${cm(v.alto)}`;
      if (esSel) { // cotas: a cada extremo del muro y antepecho
        const g = el('g', { class: 'cota' }, plano), yb = M.Y(0) + 34;
        const lin = (x1, y1, x2, y2, t, vert) => { el('line', { x1, y1, x2, y2 }, g); el('text', { x: vert ? x1 + 8 : (x1 + x2) / 2, y: vert ? (y1 + y2) / 2 + 4 : y1 - 6, 'text-anchor': vert ? 'start' : 'middle' }, g).textContent = t; };
        lin(M.X(0), yb, M.X(v.desde), yb, `${cm(v.desde)}`);
        lin(M.X(v.desde + v.ancho), yb, M.X(W.largo), yb, `${cm(W.largo - v.desde - v.ancho)}`);
        if (v.antepecho > 0) lin(M.X(v.desde + v.ancho) + 14, M.Y(v.antepecho), M.X(v.desde + v.ancho) + 14, M.Y(0), `antepecho ${cm(v.antepecho)}`, true);
      }
    }
  }

  for (const o of objetosFrente()) { // electrodomésticos (debajo de los muebles para no tapar sus frentes)
    const sa = sel?.tipo === 'objeto' && sel.o === o.id, ox = o.fx - +o.ancho / 2;
    el('rect', { x: M.X(ox), y: M.Y(+o.elevacion + +o.alto), width: +o.ancho * M.s, height: +o.alto * M.s, class: `objeto${sa ? ' sel' : ''}`, 'data-tipo': 'objeto', 'data-o': o.id }, plano);
    if (sa) el('text', { x: M.X(o.fx), y: M.Y(+o.elevacion + +o.alto) - 8, 'text-anchor': 'middle', class: 'objeto-txt' }, plano).textContent = `${o.nombre} · ${cm(o.ancho)} × ${cm(o.alto)} · a ${cm(o.elevacion)} del piso`;
  }
  for (const m of modulosFrente()) {
    const ox = xF(m), oy = +m.elevacion, W = +m.ancho, H = +m.alto, Z = Zde(m);
    const esSel = sel?.m === m.id, enMulti = !!sel?.ids?.includes(m.id);
    if (m.tipo === 'esquinero') { // de frente se ve el lado 1; se elige y se mueve como un bloque
      if (Z > 0) el('rect', { x: M.X(ox), y: M.Y(oy + Z), width: W * M.s, height: Z * M.s, class: 'zona-zocalo' }, plano);
      el('rect', { x: M.X(ox), y: M.Y(oy + H), width: W * M.s, height: (H - Z) * M.s, class: `celda${esSel ? ' sel' : ''}`, 'data-tipo': 'celda', 'data-m': m.id, 'data-col': 0, 'data-fila': 0 }, plano);
      const S = SOLUCIONES[geoEsquinero(m).sol];
      el('text', { x: M.X(ox + W / 2), y: M.Y(oy + H / 2) + 4, 'text-anchor': 'middle', class: 'vano-txt' }, plano).textContent = `${m.nombre} · ${S ? S.nombre : '?'}`;
      continue;
    }
    // zócalo
    if (Z > 0) el('rect', { x: M.X(ox), y: M.Y(oy + Z), width: W * M.s, height: Z * M.s, class: `zona-zocalo${esSel && sel.tipo === 'zocalo' ? ' sel' : ''}`, 'data-tipo': 'zocalo', 'data-m': m.id }, plano);
    // celdas (frentes)
    for (const c of celdas(m)) {
      const s = esSel && sel.tipo === 'frente' && sel.col === c.col && sel.fila === c.fila;
      // los frentes con su ancho real: entre dos puertas queda la luz de 3 mm (ahí, al centro, va la división)
      const F = c.tipo === 'abierto' ? null : medidaFrente(m, c), fx0 = F ? F.x0 : c.x0, fx1 = F ? F.x1 : c.x1;
      el('rect', { x: M.X(ox + fx0), y: M.Y(oy + c.y1), width: (fx1 - fx0) * M.s, height: c.h * M.s, class: `celda${s ? ' sel' : ''}${c.tipo === 'abierto' ? ' abierta' : ''}`, 'data-tipo': 'celda', 'data-m': m.id, 'data-col': c.col, 'data-fila': c.fila }, plano);
      if (F && F.hojas > 1) for (let i = 1; i < F.hojas; i++) { // luz entre las hojas de la sección
        const x = F.x0 + i * (F.paso ?? F.hoja + GAP) - (F.sep ?? GAP) / 2; // en la isla, al centro de la división entre hojas
        el('line', { x1: M.X(ox + x), y1: M.Y(oy + c.y1), x2: M.X(ox + x), y2: M.Y(oy + c.y0), class: 'junta' }, plano);
      }
      aperturaFrente(m, c, M, ox, oy);
      // repisas: con puerta se ven punteadas (detrás de la puerta); sin puerta, llenas
      if (capas.repisas && c.tipo !== 'cajon') for (const y of nivelesRepisa(c)) {
        el('line', { x1: M.X(ox + c.x0 + 1.5), y1: M.Y(oy + y), x2: M.X(ox + c.x1 - 1.5), y2: M.Y(oy + y), class: `repisa${c.tipo === 'abierto' ? '' : ' oculta'}` }, plano);
      }
    }
    // contorno del módulo
    el('rect', { x: M.X(ox), y: M.Y(oy + H), width: W * M.s, height: H * M.s, class: `modulo${enMulti || (esSel && (sel.tipo === 'modulo' || sel.tipo === 'cuerpo')) ? ' sel' : ''}` }, plano);
    // divisores arrastrables
    const cs = celdas(m);
    m.columnas.forEach((col, ci) => {
      if (ci < m.columnas.length - 1) {
        const x = ox + cs.find((c) => c.col === ci).x1;
        const sd = sel?.tipo === 'div' && sel.m === m.id && sel.dir === 'v' && sel.col === ci;
        el('line', { x1: M.X(x), y1: M.Y(oy + H), x2: M.X(x), y2: M.Y(oy + Z), class: `divisor${sd ? ' sel' : ''}`, 'data-tipo': 'div-v', 'data-m': m.id, 'data-col': ci }, plano);
      }
      col.frentes.forEach((f, fi) => {
        if (fi === col.frentes.length - 1) return;
        const c = cs.find((k) => k.col === ci && k.fila === fi);
        const sd = sel?.tipo === 'div' && sel.m === m.id && sel.dir === 'h' && sel.col === ci && sel.fila === fi;
        el('line', { x1: M.X(ox + c.x0), y1: M.Y(oy + c.y0), x2: M.X(ox + c.x1), y2: M.Y(oy + c.y0), class: `divisor h${sd ? ' sel' : ''}`, 'data-tipo': 'div-h', 'data-m': m.id, 'data-col': ci, 'data-fila': fi }, plano);
      });
    });
    // tiradores (zona para arrastrar)
    for (const t of m.tiradores || []) {
      const c = cs.find((k) => k.col === t.col && k.fila === t.fila); const def = tiradorDef(t.modelo);
      if (!c || !def) continue;
      const cx = M.X(ox + c.x + +t.dx), cy = M.Y(oy + c.y + +t.dy), L = (def.largo + 1) * M.s, A = Math.max(3, 3.2) * M.s;
      el('rect', { x: cx - L / 2, y: cy - A / 2, width: L, height: A, rx: 3, transform: `rotate(${-(+t.rot || 0)} ${cx} ${cy})`, class: `tirador${sel?.tipo === 'tirador' && sel.t === t.id ? ' sel' : ''}`, 'data-tipo': 'tirador', 'data-m': m.id, 'data-t': t.id }, plano);
    }
    if (esSel) cotas(m, M);
    for (const a of artefactosDe(m)) {
      const sa = sel?.tipo === 'artefacto' && sel.m === m.id && sel.a === a.id, yt = oy + H + CT;
      const ax0 = Math.min(...a.pts.map((q) => q[0])), ax1 = Math.max(...a.pts.map((q) => q[0]));
      el('rect', { x: M.X(ox + ax0), y: M.Y(yt + 3), width: (ax1 - ax0) * M.s, height: 3 * M.s, class: `artefacto${sa ? ' sel' : ''}`, 'data-tipo': 'artefacto', 'data-m': m.id, 'data-a': a.id }, plano);
      if (sa) { // cotas a los costados del mueble
        const g = el('g', { class: 'cota' }, plano), y = M.Y(yt + 3) - 14;
        const lin = (x1, x2) => { if (x2 - x1 < .05) return; el('line', { x1: M.X(ox + x1), y1: y, x2: M.X(ox + x2), y2: y }, g); el('text', { x: M.X(ox + (x1 + x2) / 2), y: y - 6, 'text-anchor': 'middle' }, g).textContent = cm(x2 - x1); };
        lin(0, a.x0); lin(a.x1, W);
        el('text', { x: M.X(ox + (a.x0 + a.x1) / 2), y: y - 6, 'text-anchor': 'middle' }, g).textContent = `${ARTEFACTOS[a.tipo].nombre} ${cm(a.ancho)}`;
      }
    }
  }
  const ms = sel?.m && !['multi', 'vano', 'muro', 'medida'].includes(sel.tipo) ? modulosFrente().find((m) => m.id === sel.m) : null;
  if (ms) { cotasLaterales(ms, M); cotasAltura(ms, M); }
  // medidas de la huincha en Frente (las de este muro, o las de la vista general)
  const mu = muroActivo()?.i ?? null;
  for (const md of (modelo.medidas || []).filter((x) => x?.vista === 'frente' && (x.muro ?? null) === mu)) cotaMedidaF(md.a, md.b, M, { id: md.id, sel: sel?.tipo === 'medida' && sel.id === md.id });
  if (medF) cotaMedidaF([medF.x, medF.y], cursorF ? [cursorF.x, cursorF.y] : [medF.x, medF.y], M, { vivo: true });
}

// ----- huincha en Frente (dueño, 2026-11-25): cotas guardadas en modelo.medidas = [{ id, vista: 'frente', muro, a:[x,y], b:[x,y] }]
function cotaMedidaF(a, b, M, { id, sel: s, vivo } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), g = el('g', { class: `medida${s ? ' sel' : ''}${vivo ? ' viva' : ''}`, ...(id ? { 'data-tipo': 'medida', 'data-id': id } : {}) }, plano);
  const x1 = M.X(a[0]), y1 = M.Y(a[1]), x2 = M.X(b[0]), y2 = M.Y(b[1]);
  el('line', { x1, y1, x2, y2, class: 'toque' }, g); el('line', { x1, y1, x2, y2 }, g);
  const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang) * 6, ny = Math.cos(ang) * 6;
  for (const [x, y] of [[x1, y1], [x2, y2]]) el('line', { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny }, g);
  let rot = ang * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
  const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2;
  if (L > .05) el('text', { x: tx, y: ty - 7, 'text-anchor': 'middle', transform: `rotate(${rot} ${tx} ${ty})` }, g).textContent = `${cm(L)} cm`;
}
// Punto de la huincha en Frente: esquina de un mueble, ventana o muro (10 px) o la línea más cercana (12 px)
function imanFrente(p) {
  const M = mapa(), rects = modulosFrente().map((m) => [xF(m), +m.elevacion, xF(m) + +m.ancho, +m.elevacion + +m.alto]);
  const W = muroActivo();
  if (W) { rects.push([0, 0, W.largo, W.alto]); for (const v of vanosDe(W)) rects.push([v.desde, v.antepecho, v.desde + v.ancho, v.antepecho + v.alto]); }
  const P = [M.X(p.x), M.Y(p.y)];
  let best = null, dmin = 10;
  for (const [x0, y0, x1, y1] of rects) for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const d = Math.hypot(M.X(x) - P[0], M.Y(y) - P[1]); if (d < dmin) { dmin = d; best = { x, y }; } }
  if (best) return best;
  dmin = 12;
  for (const [x0, y0, x1, y1] of rects) {
    const cx = Math.max(x0, Math.min(x1, p.x)), cy = Math.max(y0, Math.min(y1, p.y));
    for (const q of [{ x: x0, y: cy }, { x: x1, y: cy }, { x: cx, y: y0 }, { x: cx, y: y1 }]) { const d = Math.hypot(M.X(q.x) - P[0], M.Y(q.y) - P[1]); if (d < dmin) { dmin = d; best = { x: r1(q.x), y: r1(q.y) }; } }
  }
  return best || { x: r1(p.x), y: r1(p.y) };
}
// Clic derecho sobre una medida (Planta o Frente): queda elegida y Supr la borra
plano.addEventListener('contextmenu', (e) => {
  const t = e.target.closest?.('[data-tipo="medida"]'); if (!t) return;
  e.preventDefault(); sel = { tipo: 'medida', id: t.dataset.id }; render(); aviso('Medida elegida: Supr la borra.');
});

// ----- distancias a los lados en Frente: al objeto más cercano (mueble, ventana o puerta, extremo del muro)
// Cuentan solo los objetos que comparten altura con el mueble (un basal bajo una ventana no choca con ella).
function obstaculosFrente(m) {
  const W = muroActivo(), y0 = +m.elevacion, y1 = y0 + +m.alto, out = [];
  const choca = (a, b) => b > y0 + .1 && a < y1 - .1;
  for (const o of modulosFrente()) if (o.id !== m.id && choca(+o.elevacion, +o.elevacion + +o.alto)) out.push({ a: xF(o), b: xF(o) + +o.ancho, nombre: o.nombre });
  if (W) {
    for (const v of vanosDe(W)) if (choca(v.antepecho, v.antepecho + v.alto)) out.push({ a: v.desde, b: v.desde + v.ancho, nombre: VANOS[v.tipo].nombre });
    out.push({ a: -1e6, b: 0, nombre: 'muro' }, { a: W.largo, b: 1e6, nombre: 'muro' });
  }
  return out;
}
function vecinosFrente(m) {
  const x0 = xF(m), x1 = x0 + +m.ancho;
  let izq = null, der = null;
  for (const o of obstaculosFrente(m)) {
    if (o.b <= x0 + .05) { if (!izq || o.b > izq.x) izq = { x: o.b, nombre: o.nombre }; }
    else if (o.a >= x1 - .05) { if (!der || o.a < der.x) der = { x: o.a, nombre: o.nombre }; }
  }
  return { x0, x1, izq, der };
}
// ----- distancias arriba y abajo en Frente: piso, techo y lo que comparte el ancho del mueble (muebles con su
// cubierta, ventanas y puertas). Así un aéreo se ubica sobre la cubierta o bajo el techo con su cota.
function obstaculosAltura(m) {
  const x0 = xF(m), x1 = x0 + +m.ancho, out = [], W = muroActivo();
  const cruza = (a, b) => b > x0 + .1 && a < x1 - .1;
  for (const o of modulosFrente()) {
    if (o.id === m.id || (m.grupo && o.grupo === m.grupo) || !cruza(xF(o), xF(o) + +o.ancho)) continue;
    const y0 = +o.elevacion || 0;
    out.push({ a: y0, b: y0 + +o.alto + (o.cubierta && !o.artefacto ? CT : 0), nombre: o.nombre });
  }
  if (W) for (const v of vanosDe(W)) if (cruza(v.desde, v.desde + v.ancho)) out.push({ a: v.antepecho, b: v.antepecho + v.alto, nombre: VANOS[v.tipo].nombre });
  const techo = (W && +W.alto) || +modelo.espacio?.alto || 240;
  out.push({ a: -1e6, b: 0, nombre: 'piso' }, { a: techo, b: 1e6, nombre: 'techo' });
  return out;
}
function vecinosAltura(m) {
  const y0 = +m.elevacion || 0, y1 = y0 + +m.alto + (m.cubierta && !m.artefacto ? CT : 0);
  let abajo = null, arriba = null;
  for (const o of obstaculosAltura(m)) {
    if (o.b <= y0 + .05) { if (!abajo || o.b > abajo.y) abajo = { y: o.b, nombre: o.nombre }; }
    else if (o.a >= y1 - .05) { if (!arriba || o.a < arriba.y) arriba = { y: o.a, nombre: o.nombre }; }
  }
  return { y0, y1, abajo, arriba };
}
function cotasAltura(m, M) {
  const V = vecinosAltura(m), g = el('g', { class: 'cota lateral' }, plano);
  const x = M.X(xF(m) + +m.ancho * .22);
  const tramo = (a, b, k, nombre) => {
    const d = b - a; if (d < .05) return; // apoyado: no hay cota
    el('line', { x1: x, y1: M.Y(a), x2: x, y2: M.Y(b) }, g);
    el('circle', { cx: x, cy: M.Y(a), r: 2.5 }, g); el('circle', { cx: x, cy: M.Y(b), r: 2.5 }, g);
    const t = el('text', { x: x + 7, y: M.Y((a + b) / 2) + 4, class: 'editable', 'data-cota': k, 'data-m': m.id }, g);
    t.textContent = cm(d);
    el('text', { x: x + 7, y: M.Y((a + b) / 2) + 19, class: 'hasta' }, g).textContent = `a ${nombre}`;
  };
  if (V.abajo && V.abajo.nombre !== 'piso') tramo(V.abajo.y, V.y0, 'dist-abajo', V.abajo.nombre); // al piso ya está la cota de elevación
  if (V.arriba) tramo(V.y1, V.arriba.y, 'dist-arriba', V.arriba.nombre);
}
function cotasLaterales(m, M) {
  const V = vecinosFrente(m), g = el('g', { class: 'cota lateral' }, plano);
  const y = M.Y(+m.elevacion + +m.alto * .78); // más arriba que la cota de alto (que va a media altura)
  const lado = (a, b, k, nombre) => {
    const d = b - a; if (d < .05) return; // pegado: no hay cota
    el('line', { x1: M.X(a), y1: y, x2: M.X(b), y2: y }, g);
    el('circle', { cx: M.X(a), cy: y, r: 2.5 }, g); el('circle', { cx: M.X(b), cy: y, r: 2.5 }, g);
    const t = el('text', { x: M.X((a + b) / 2), y: y - 7, 'text-anchor': 'middle', class: 'editable', 'data-cota': k, 'data-m': m.id }, g);
    t.textContent = cm(d);
    el('text', { x: M.X((a + b) / 2), y: y + 15, 'text-anchor': 'middle', class: 'hasta' }, g).textContent = `a ${nombre}`;
  };
  if (V.izq) lado(V.izq.x, V.x0, 'dist-izq', V.izq.nombre);
  if (V.der) lado(V.x1, V.der.x, 'dist-der', V.der.nombre);
}

// Marca de apertura de las puertas en Frente (como en los planos): dos líneas que se juntan en el lado de las
// bisagras. Una sección de varias hojas abre hacia afuera desde el centro (la primera mitad con bisagra a la izquierda).
function aperturaFrente(m, c, M, ox, oy) {
  if (c.tipo !== 'puerta' && c.tipo !== 'puerta_doble') return;
  const f = m.columnas?.[c.col]?.frentes?.[c.fila] || {};
  const hoja = (x0, x1, lado) => {
    const y0 = oy + c.y0 + 2, y1 = oy + c.y1 - 2, a = x0 + 1.5, b = x1 - 1.5, ym = (y0 + y1) / 2, xm = (a + b) / 2;
    const p = lado === 'derecha' ? [[a, y1], [b, ym], [a, y0]] : lado === 'arriba' ? [[a, y0], [xm, y1], [b, y0]] : lado === 'abajo' ? [[a, y1], [xm, y0], [b, y1]] : [[b, y1], [a, ym], [b, y0]];
    el('polyline', { points: p.map(([x, y]) => `${M.X(ox + x)},${M.Y(y)}`).join(' '), class: 'apertura' }, plano);
  };
  if (c.tipo === 'puerta') return hoja(c.x0, c.x1, f.bisagra || 'izquierda');
  const n = c.hojas, lw = (c.w - (n - 1) * GAP) / n;
  for (let i = 0; i < n; i++) hoja(c.x0 + i * (lw + GAP), c.x0 + i * (lw + GAP) + lw, i <= (n - 1) / 2 ? 'izquierda' : 'derecha');
}

// Frente de más abajo de una columna (el que define la cota de abajo)
const frenteAbajo = (cs, ci) => cs.filter((k) => k.col === ci).sort((a, b) => a.y0 - b.y0)[0];
// Ancho de columna para que su puerta (o cada hoja) mida «puerta» cm: + 3 mm entre hojas y 1,5 mm hacia cada vecino
function anchoColumnaPara(m, c, puerta) {
  const n = c.tipo === 'puerta_doble' ? c.hojas : 1, W = +m.ancho;
  if (m.tipo === 'isla') return n * puerta + bordesColumna(m, c.col, n); // isla: empotradas, con división entre hojas
  return n * puerta + (n - 1) * GAP + (c.x0 > .05 ? GAP / 2 : 0) + (c.x1 < W - .05 ? GAP / 2 : 0);
}

// Cotas del módulo seleccionado: ancho total, alto total, medida de las puertas y de cada frente.
function cotas(m, M) {
  const g = el('g', { class: 'cota' }, plano);
  const ox = xF(m), oy = +m.elevacion, W = +m.ancho, H = +m.alto, Z = Zde(m);
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
  if (m.columnas.length > 1 || cs.some((k) => k.hojas > 1)) {
    const yb = M.Y(oy) + 20;
    // medida de las puertas (lo que se corta), una por hoja; se escribe el ancho de la puerta y la columna se ajusta
    // (la división queda siempre al centro de la luz de 3 mm entre dos puertas). Sin frente: el ancho del hueco.
    m.columnas.forEach((_, ci) => {
      const c = frenteAbajo(cs, ci);
      if (c.tipo === 'abierto') return linea(M.X(ox + c.x0), yb, M.X(ox + c.x1), yb, cm(c.w), false, { k: 'col', col: ci });
      const F = medidaFrente(m, c);
      for (let i = 0; i < F.hojas; i++) {
        const a = F.x0 + i * (F.hoja + GAP);
        linea(M.X(ox + a), yb, M.X(ox + a + F.hoja), yb, cm(F.hoja), false, { k: 'col-puerta', col: ci, fila: c.fila });
      }
    });
  }
  // medidas dentro de cada frente
  for (const c of cs) {
    if (c.h * M.s < 18 || c.w * M.s < 40) continue;
    // puertas: su medida final (la que se corta, con la luz de 3 mm); el resto: la medida de la sección (editable)
    if (c.tipo === 'puerta' || c.tipo === 'puerta_doble') {
      const F = medidaFrente(m, c);
      el('text', { x: M.X(ox + c.x), y: M.Y(oy + c.y) + 4, 'text-anchor': 'middle', class: 'medida-puerta' }, g).textContent = F.hojas > 1 ? `${F.hojas} × ${cm(F.hoja)} × ${cm(F.h)}` : `${cm(F.w)} × ${cm(F.h)}`;
    } else el('text', { x: M.X(ox + c.x), y: M.Y(oy + c.y) + 4, 'text-anchor': 'middle', ...editable({ k: 'cel', col: c.col, fila: c.fila }) }, g).textContent = `${cm(c.w)} × ${cm(c.h)}`;
  }
}

// ===================== interacción en la vista frontal =====================
let gesto = null;
const local = (m, p) => ({ x: p.x - xF(m), y: p.y - +m.elevacion });

let gInf = null;
plano.addEventListener('pointerdown', (e) => {
  if (vista === 'planta') return planta.down(e);
  if (vista === 'inferior') {
    const cota = e.target.closest('[data-cota]'); if (cota) { e.preventDefault(); editarCota(cota); return; }
    const t = e.target.closest('[data-tipo^="zoc-"]'), m = moduloInferior();
    if (!t || !m) { if (m) { sel = { tipo: 'modulo', m: m.id }; render(); } return; }
    const M = mapaInf(), r = plano.getBoundingClientRect();
    plano.setPointerCapture(e.pointerId);
    sel = { tipo: 'zocalo', m: m.id };
    gInf = { tipo: t.dataset.tipo, lado: t.dataset.lado, x0: M.x(e.clientX - r.left), z0: M.z(e.clientY - r.top), ini: marcoZocalo(m), antes: JSON.stringify(modelo) };
    render(); return;
  }
  if (e.button > 0) return;
  const M = mapa(), r = plano.getBoundingClientRect();
  const p = { x: M.x(e.clientX - r.left), y: M.y(e.clientY - r.top) };
  const cota = e.target.closest('[data-cota]');
  if (cota) { e.preventDefault(); editarCota(cota); return; }
  const t = e.target.closest('[data-tipo]');
  plano.setPointerCapture(e.pointerId);

  if (herr === 'medir') { // huincha en Frente: 2 clics = una cota guardada
    const q = imanFrente(p);
    if (!medF) { medF = q; cursorF = q; dibujarPlano(); return; }
    const a = [medF.x, medF.y], b = [q.x, q.y]; medF = null; cursorF = null;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .5) { dibujarPlano(); return; }
    const id = uid('med'), muro = muroActivo()?.i ?? null;
    cambiar((d) => { d.medidas = [...(d.medidas || []), { id, vista: 'frente', muro, a, b }]; });
    aviso(`Medida: ${cm(Math.hypot(b[0] - a[0], b[1] - a[1]))} cm. Clic derecho sobre ella y Supr para borrarla.`);
    return;
  }
  if (t?.dataset.tipo === 'medida') { sel = { tipo: 'medida', id: t.dataset.id }; render(); return; }
  if (herr === 'dibujar') { gesto = { tipo: 'dibujar', a: { x: snap(p.x, 1), y: Math.max(0, snap(p.y, 1)) }, b: null }; return; }
  // Espacio vacío: recuadro de selección (si casi no se mueve, solo deselecciona)
  if ((herr === 'div-v' || herr === 'div-h') && t?.dataset.tipo === 'zona-muro') { // dividir el muro en zonas (dueño, 2026-11-25)
    const i = +t.dataset.i, z = t.dataset.z != null ? +t.dataset.z : 0, w = murosDe(modelo.espacio)[i];
    const Z = w && zonasMuro(modelo.espacio, i, w.largo, w.alto)[z]; if (!Z) return;
    const eje = herr === 'div-v' ? 'x' : 'y', a = Z[`${eje}0`], b = Z[`${eje}1`], mitad = (a + b) / 2;
    let v = snap(eje === 'x' ? p.x : p.y, 1); if (Math.abs(v - mitad) < 4) v = Math.round(mitad * 10) / 10; // imán a la mitad, como en los frentes
    cortarZona(eje, { i, z, v }); return;
  }
  if (!t || t.dataset.tipo === 'zona-muro') { gesto = { tipo: 'marco', a: p, b: null, suma: e.shiftKey, zona: t ? { i: +t.dataset.i, ...(t.dataset.z != null ? { z: +t.dataset.z } : {}) } : null }; return; }
  if (t.dataset.tipo === 'objeto') {
    const o = objeto(t.dataset.o); if (!o) return;
    sel = { tipo: 'objeto', o: o.id };
    gesto = { tipo: 'obj-f', o: o.id, p0: p, x0: +o.x, z0: +o.z, e0: +o.elevacion || 0, antes: JSON.stringify(modelo) };
    render(); return;
  }
  if (t.dataset.tipo === 'artefacto') { // encimera o lavaplatos: seleccionar y arrastrar a lo largo
    const a = modulo(t.dataset.m)?.artefactos?.find((x) => x.id === t.dataset.a); if (!a) return;
    sel = { tipo: 'artefacto', m: t.dataset.m, a: a.id };
    gesto = { tipo: 'artef-f', m: t.dataset.m, a: a.id, p0: p, c0: centroArtefacto(modulo(t.dataset.m), a.id), antes: JSON.stringify(modelo) };
    render(); return;
  }
  if (t.dataset.tipo === 'vano') { // ventana o puerta: seleccionar y arrastrar
    sel = { tipo: 'vano', i: +t.dataset.i, v: t.dataset.v };
    const x = vanoSel();
    gesto = { tipo: 'vano', p0: p, desde: x.v.desde, ante: x.v.antepecho, antes: JSON.stringify(modelo) };
    render(); return;
  }
  const m = modulo(t.dataset.m);
  const d = t.dataset;
  // Mayús + clic sobre un mueble: lo agrega o lo quita de la selección múltiple
  if (e.shiftKey && herr === 'sel' && d.tipo !== 'div-v' && d.tipo !== 'div-h') { alternar(m.id); return; }

  if ((m.artefacto || m.tipo === 'esquinero') && d.tipo === 'celda') {
    sel = { tipo: 'modulo', m: m.id };
    if (herr === 'sel') gesto = { tipo: 'mover-f', m: m.id, p0: p, x0: xF(m), e0: +m.elevacion || 0, movido: false, antes: JSON.stringify(modelo) };
    render(); return;
  }
  if (d.tipo === 'celda' && (herr === 'div-v' || herr === 'div-h')) {
    const L = local(m, p);
    cambiar(() => (herr === 'div-v' ? dividirV(m, +d.col, L.x) : dividirH(m, +d.col, +d.fila, L.y)));
    sel = { tipo: 'frente', m: m.id, col: +d.col, fila: +d.fila }; render();
    return;
  }
  if (d.tipo === 'div-v' || d.tipo === 'div-h') {
    sel = { tipo: 'div', m: m.id, dir: d.tipo === 'div-v' ? 'v' : 'h', col: +d.col, fila: d.tipo === 'div-h' ? +d.fila : 0 }; render();
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
  if ((d.tipo === 'celda' || d.tipo === 'zocalo') && herr === 'sel') gesto = { tipo: 'mover-f', m: m.id, p0: p, x0: xF(m), e0: +m.elevacion || 0, movido: false, antes: JSON.stringify(modelo) };
  render();
});

plano.addEventListener('pointermove', (e) => {
  if (vista === 'planta') return planta.move(e);
  if (vista === 'frente' && medF) { const M = mapa(), r = plano.getBoundingClientRect(); cursorF = imanFrente({ x: M.x(e.clientX - r.left), y: M.y(e.clientY - r.top) }); dibujarPlano(); return; }
  if (vista === 'inferior') {
    if (!gInf) return;
    const m = moduloInferior(); if (!m) return;
    const M = mapaInf(), r = plano.getBoundingClientRect(), x = M.x(e.clientX - r.left), z = M.z(e.clientY - r.top);
    const W = +m.ancho, D = +m.profundidad, k = gInf.ini, dx = snap(x - gInf.x0, .5), dz = snap(z - gInf.z0, .5), cl = (v) => Math.max(0, r1(v));
    if (gInf.tipo === 'zoc-mover') { // mover el marco completo dentro del mueble
      const mx = Math.max(-k.izq, Math.min(k.der, dx)), mz = Math.max(-k.atras, Math.min(k.frente, dz));
      m.zocalo_izq = cl(k.izq + mx); m.zocalo_der = cl(k.der - mx); m.zocalo_atras = cl(k.atras + mz); m.zocalo_retiro = cl(k.frente - mz);
    } else { // un lado: cambia ese retiro
      if (gInf.lado === 'i') m.zocalo_izq = cl(k.izq + dx);
      if (gInf.lado === 'd') m.zocalo_der = cl(k.der - dx);
      if (gInf.lado === 'a') m.zocalo_atras = cl(k.atras + dz);
      if (gInf.lado === 'f') m.zocalo_retiro = cl(k.frente - dz);
    }
    const v = marcoZocalo(m); m.zocalo_izq = r1(v.izq); m.zocalo_der = r1(v.der); m.zocalo_atras = r1(v.atras); m.zocalo_retiro = r1(v.frente);
    estadoEl.textContent = `Retiros: frente ${cm(v.frente)} · atrás ${cm(v.atras)} · izq. ${cm(v.izq)} · der. ${cm(v.der)} cm`;
    render({ panel: false }); return;
  }
  const M = mapa(), r = plano.getBoundingClientRect();
  const p = { x: M.x(e.clientX - r.left), y: M.y(e.clientY - r.top) };
  estadoEl.textContent = `${ayuda()}   ·   x ${cm(p.x)} · y ${cm(Math.max(0, p.y))} cm`;
  if (!gesto) return;
  if (gesto.tipo === 'obj-f') {
    const o = objeto(gesto.o); if (!o) return;
    const W = muroActivo(), d = snap(p.x - gesto.p0.x, .5);
    const px = o.x, pz = o.z, pe = o.elevacion;
    o.x = r1(gesto.x0 + d * (W ? W.u[0] : 1)); o.z = r1(gesto.z0 + d * (W ? W.u[1] : 0));
    o.elevacion = Math.max(0, snap(gesto.e0 + p.y - gesto.p0.y, .5));
    if (OBJETOS[o.tipo]?.apoyo === 'mesa' && !apoyar(o)) { o.x = px; o.z = pz; o.elevacion = pe; estadoEl.textContent = `${o.nombre}: necesita una cubierta, repisa o base debajo (el piso no sirve)`; return; }
    render({ panel: false }); return;
  }
  if (gesto.tipo === 'artef-f') {
    if (!gesto.c0) return;
    const W = muroActivo(), d = snap(p.x - gesto.p0.x, .5); // a lo largo del muro; pasa al mueble vecino si la cubierta sigue
    const mid = moverArtefacto(modelo, gesto.m, gesto.a, gesto.c0[0] + d * (W ? W.u[0] : 1), gesto.c0[1] + d * (W ? W.u[1] : 0));
    if (!mid) { estadoEl.textContent = 'Ahí no se apoya completo: necesita cubierta debajo'; return; }
    if (mid !== gesto.m) { gesto.m = mid; sel = { tipo: 'artefacto', m: mid, a: gesto.a }; }
    render({ panel: false }); return;
  }
  if (gesto.tipo === 'mover-f') { // mover el mueble a lo largo del frente (o del muro)
    const m = modulo(gesto.m); if (!m) return;
    if (!gesto.movido) { // aún es un clic; al pasar 4 px se decide el eje: hacia los lados o en altura
      const ax = Math.abs(p.x - gesto.p0.x) * M.s, ay = Math.abs(p.y - gesto.p0.y) * M.s;
      if (Math.max(ax, ay) < 4) return;
      gesto.eje = ay > ax && !m.artefacto ? 'v' : 'h'; // las cocinas van directo al piso
    }
    gesto.movido = true;
    if (gesto.eje === 'v') { // en altura (ej. un aéreo): imán al piso, la cubierta o el mueble de abajo, el de arriba y el techo
      const h = +m.alto;
      let y = Math.max(0, snap(gesto.e0 + p.y - gesto.p0.y, .5));
      if (!e.altKey) {
        let mejor = 3;
        for (const o of obstaculosAltura(m)) for (const c of [o.b, o.a - h]) if (c >= 0 && Math.abs(y - c) < mejor) { mejor = Math.abs(y - c); y = c; }
      }
      const d = r1(y) - (+m.elevacion || 0);
      for (const o of grupoDe(m)) o.elevacion = r1(Math.max(0, (+o.elevacion || 0) + d)); // mueble agrupado: va completo
      estadoEl.textContent = `Altura desde el piso: ${cm(m.elevacion)} cm (Alt: sin imán)`;
      render({ panel: false }); return;
    }
    const w = +m.ancho;
    let s = snap(gesto.x0 + p.x - gesto.p0.x, .5);
    if (!e.altKey) { // imán: se pega a los bordes vecinos a menos de 3 cm (Alt lo desactiva)
      let mejor = 3;
      for (const o of obstaculosFrente(m)) {
        for (const c of [o.b, o.a - w]) if (Math.abs(s - c) < mejor) { mejor = Math.abs(s - c); s = c; }
      }
    }
    const x0 = +m.x, z0 = +m.z;
    moverFrente(m, s - xF(m));
    for (const o of grupoDe(m)) if (o !== m) { o.x = r1(+o.x + +m.x - x0); o.z = r1(+o.z + +m.z - z0); } // mueble agrupado: va completo
    render({ panel: false }); return;
  }
  if (gesto.tipo === 'vano') {
    const x = vanoSel(); if (!x) return;
    x.raw.desde = Math.min(Math.max(0, snap(gesto.desde + p.x - gesto.p0.x, .5)), x.w.largo - x.v.ancho);
    if (!VANOS[x.v.tipo].puerta) x.raw.antepecho = Math.min(Math.max(0, snap(gesto.ante + p.y - gesto.p0.y, .5)), x.w.alto - x.v.alto);
    render({ panel: false }); return;
  }
  if (gesto.tipo === 'marco') {
    gesto.b = p; dibujarPlano();
    const a = gesto.a;
    el('rect', { x: M.X(Math.min(a.x, p.x)), y: M.Y(Math.max(a.y, p.y)), width: Math.abs(p.x - a.x) * M.s, height: Math.abs(p.y - a.y) * M.s, class: 'marco' }, plano);
    return;
  }
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
    if (!m.puertas_manual && m.tipo !== 'esquinero') { m.puertas_manual = true; aviso(`Medida a mano en «${m.nombre}»: sus puertas ya no se igualan solas. En el panel del mueble puedes volver a igualarlas.`); }
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
  if (vista === 'inferior') {
    if (!gInf) return;
    const g = gInf; gInf = null;
    if (JSON.stringify(modelo) !== g.antes) { hist.push(g.antes); fut.length = 0; guardar(); }
    render(); return;
  }
  if (!gesto) return;
  const g = gesto; gesto = null;
  if (g.tipo === 'obj-f') { // al soltar: se apoya en la superficie más alta que quede debajo (cubierta, repisa o piso)
    const o = objeto(g.o);
    if (o && OBJETOS[o.tipo]?.apoyo === 'techo') { o.cable = r1(Math.max(0, +o.cable + g.e0 - +o.elevacion)); } // colgante: el cable se ajusta
    else if (o) { const ap = apoyosEn(+o.x, +o.z).filter((a) => a.y <= +o.elevacion + 4); const a = ap[ap.length - 1]; o.elevacion = r1(a ? a.y : 0); aviso(`${o.nombre}: ${a ? a.nombre.toLowerCase() : 'piso'} (a ${cm(o.elevacion)} cm del piso).`); }
    if (JSON.stringify(modelo) !== g.antes) { hist.push(g.antes); fut.length = 0; guardar(); }
    render(); return;
  }
  if (g.tipo === 'marco') {
    const M = mapa();
    if (!g.b || Math.hypot((g.b.x - g.a.x) * M.s, (g.b.y - g.a.y) * M.s) < 4) { if (!g.suma) sel = g.zona ? { tipo: 'muro', ...g.zona } : null; render(); return; }
    const x0 = Math.min(g.a.x, g.b.x), x1 = Math.max(g.a.x, g.b.x), y0 = Math.min(g.a.y, g.b.y), y1 = Math.max(g.a.y, g.b.y);
    const ids = modulosFrente().filter((m) => xF(m) + +m.ancho > x0 && xF(m) < x1 && +m.elevacion + +m.alto > y0 && +m.elevacion < y1).map((m) => m.id);
    seleccionarVarios(ids, g.suma);
    return;
  }
  if (g.tipo === 'dibujar') {
    if (!g.b) return render();
    const x0 = Math.min(g.a.x, g.b.x), y0 = Math.min(g.a.y, g.b.y), w = Math.abs(g.b.x - g.a.x), h = Math.abs(g.b.y - g.a.y);
    if (w < 10 || h < 10) return render();
    const elev = y0 < 6 ? 0 : y0; // cerca del piso: se apoya en el piso
    const m = nuevoModulo({ x: x0, elevacion: elev, ancho: w, alto: elev ? h : h + y0 });
    const Wm = muroActivo();
    if (Wm) { m.x = Wm.O[0] + x0 * Wm.u[0]; m.z = Wm.O[1] + x0 * Wm.u[1]; m.rotacion = Wm.rot; }
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
  const V = vecinosFrente(m), VA = vecinosAltura(m);
  const mz = marcoZocalo(m);
  const valor = { ancho: m.ancho, alto: m.alto, zocalo: m.zocalo, elevacion: m.elevacion, col: m.columnas[col]?.ancho,
    'col-puerta': c ? medidaFrente(m, c).hoja : 0,
    zocalo_retiro: mz.frente, zocalo_atras: mz.atras, zocalo_izq: mz.izq, zocalo_der: mz.der,
    'dist-izq': V.izq ? V.x0 - V.izq.x : 0, 'dist-der': V.der ? V.der.x - V.x1 : 0,
    'dist-abajo': VA.abajo ? VA.y0 - VA.abajo.y : 0, 'dist-arriba': VA.arriba ? VA.arriba.y - VA.y1 : 0 }[k];
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
    sel = k === 'cel' ? { tipo: 'frente', m: m.id, col, fila } : k.startsWith('zocalo_') ? { tipo: 'zocalo', m: m.id } : { tipo: 'modulo', m: m.id };
    cambiar(() => {
      if (k === 'dist-izq' && V.izq) moverFrente(m, V.izq.x + nums[0] - V.x0);
      else if (k === 'dist-der' && V.der) moverFrente(m, V.der.x - nums[0] - V.x1);
      else if ((k === 'dist-abajo' && VA.abajo) || (k === 'dist-arriba' && VA.arriba)) {
        const d = k === 'dist-abajo' ? VA.abajo.y + nums[0] - VA.y0 : VA.arriba.y - nums[0] - VA.y1;
        for (const o of grupoDe(m)) o.elevacion = r1(Math.max(0, (+o.elevacion || 0) + d));
      }
      else if (k === 'cel') {
        // "40 × 37" → ancho de columna y alto del frente; un solo número → alto del frente
        if (nums.length > 1 && Math.abs(nums[0] - c.w) > .05) aplicarCampo(m, 'c.ancho', nums[0], { col });
        const alto = nums.length > 1 ? nums[1] : nums[0];
        if (Math.abs(alto - c.h) > .05) aplicarCampo(m, 'f.alto', alto, { col, fila });
      } else if (k === 'col') aplicarCampo(m, 'c.ancho', nums[0], { col });
      else if (k === 'col-puerta') aplicarCampo(m, 'c.ancho', Math.round(anchoColumnaPara(m, c, nums[0]) * 1000) / 1000, { col });
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
  const def = tiradorDef(modeloT);
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
// ----- extruir una cara de la cubierta en 3D: al tocar la cara, la vista gira para que esa dirección quede
// de lado a lado en la pantalla; luego se arrastra la manija (o la misma cara) y la placa completa crece o se achica.
const NORMAL_CUB = { frente: [0, 1], atras: [0, -1], izq: [-1, 0], der: [1, 0] };
function caraCubierta(m, lado) {
  const cb = cubiertaDe(m), r = +m.rotacion || 0, y = +m.elevacion + +m.alto + CT / 2;
  const [lx, lz] = { frente: [(cb.x0 + cb.x1) / 2, cb.z1], atras: [(cb.x0 + cb.x1) / 2, cb.z0], izq: [cb.x0, (cb.z0 + cb.z1) / 2], der: [cb.x1, (cb.z0 + cb.z1) / 2] }[lado];
  const [dx, dz] = girar(lx, lz, r), [nx, nz] = girar(...NORMAL_CUB[lado], r);
  return { c: [+m.x + dx, y, +m.z + dz], n: [nx, 0, nz] };
}
function aPantalla([x, y, z]) { // punto del mundo (cm) → px de pantalla
  const s = st.scale, P = st.proyeccion(), q = P.transformPoint(new DOMPoint(x * s, -y * s, z * s, 1)), r = escena.getBoundingClientRect();
  return [r.left + r.width / 2 + q.x / q.w, r.top + r.height / 2 + q.y / q.w];
}
function orientarHacia(n) { // gira la cámara para que la normal n apunte hacia la derecha de la pantalla
  const [rx0, ry0] = st.angles; let mejor = ry0, puntaje = -2;
  for (let ry = 0; ry < 360; ry += 5) {
    st.set(-16, ry);
    const a = aPantalla([0, 0, 0]), b = aPantalla([n[0] * 100, 0, n[2] * 100]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const p = dx / L - Math.abs(dy) / L * .5;
    if (p > puntaje) { puntaje = p; mejor = ry; }
  }
  st.set(rx0, ry0); st.view(-16, mejor);
}
const manija = document.createElement('div');
manija.className = 'ed-extruir'; manija.hidden = true; manija.innerHTML = '<span>⇆</span><b></b>';
manija.title = 'Arrastra para extruir la cubierta (hacia afuera crece, hacia adentro se achica)';
lienzo.append(manija);
function ponerManija() {
  const m = sel?.tipo === 'cubierta' && sel.cara && vista === '3d' && modulo(sel.m);
  if (!m || !m.cubierta) { manija.hidden = true; return; }
  const { c } = caraCubierta(m, sel.cara), [px, py] = aPantalla(c), r = lienzo.getBoundingClientRect();
  manija.hidden = false; manija.style.left = `${px - r.left}px`; manija.style.top = `${py - r.top}px`;
  manija.querySelector('b').textContent = `${cm(cubiertaDe(m).v[sel.cara])} cm`;
}
st.onApply(ponerManija);
let extr = null;
function empezarExtruir(e) {
  const m = modulo(sel.m), lado = sel.cara, { c, n } = caraCubierta(m, lado);
  const a = aPantalla(c), b = aPantalla([c[0] + n[0] * 10, c[1], c[2] + n[2] * 10]);
  extr = { m: m.id, lado, x0: e.clientX, y0: e.clientY, v0: cubiertaDe(m).v[lado], vx: (b[0] - a[0]) / 10, vy: (b[1] - a[1]) / 10, antes: JSON.stringify(modelo) };
  e.stopPropagation(); e.preventDefault();
  window.addEventListener('pointermove', moverExtruir); window.addEventListener('pointerup', soltarExtruir);
}
function moverExtruir(e) {
  if (!extr) return;
  const m = modulo(extr.m), q = extr.vx * extr.vx + extr.vy * extr.vy || 1;
  const d = ((e.clientX - extr.x0) * extr.vx + (e.clientY - extr.y0) * extr.vy) / q; // cm a lo largo de la normal
  m[`vuelo_${extr.lado}`] = Math.max(0, Math.min(150, snap(extr.v0 + d, .5)));
  estadoEl.textContent = `Vuelo ${LADOS_CUB[extr.lado]}: ${cm(cubiertaDe(m).v[extr.lado])} cm   ·   suelta para terminar`;
  render({ panel: false });
}
function soltarExtruir() {
  window.removeEventListener('pointermove', moverExtruir); window.removeEventListener('pointerup', soltarExtruir);
  const g = extr; extr = null; if (!g) return;
  if (JSON.stringify(modelo) !== g.antes) { hist.push(g.antes); fut.length = 0; guardar(); }
  toque = null; render();
  const m = modulo(g.m); if (m) aviso(`Vuelo ${LADOS_CUB[g.lado]}: ${cm(cubiertaDe(m).v[g.lado])} cm. Ctrl+Z deshace.`);
}
manija.addEventListener('pointerdown', (e) => { if (e.button === 0) empezarExtruir(e); });
// arrastrar la misma cara elegida también extruye (sin girar la vista)
escena.addEventListener('pointerdown', (e) => {
  if (e.button > 0 || sel?.tipo !== 'cubierta' || !sel.cara || vista !== '3d') return;
  const f = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ref]');
  const lado = { front: 'frente', back: 'atras', left: 'izq', right: 'der' }[f?.dataset.cara];
  if (f?.dataset.ref === `${sel.m}|cubierta` && lado === sel.cara) empezarExtruir(e);
}, { capture: true });
escena.addEventListener('pointerdown', (e) => { toque = e.button === 0 && e.isPrimary ? { x: e.clientX, y: e.clientY } : null; }); // clic derecho o 2 dedos mueven la cámara
escena.addEventListener('pointerup', (e) => {
  if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 5) return;
  if (v34) { // vista 3/4: solo abre y cierra (en la puerta giratoria, la hoja tocada da una vuelta)
    const f = document.elementFromPoint(e.clientX, e.clientY), h = /\|esq34\|giro\|([AB])$/.exec(f?.closest?.('[data-ref]')?.dataset.ref || '');
    if (h) { vuelta34(h[1]); return; }
    const p = f?.closest('[data-esq-anim]'); if (p) alternar34(p.dataset.esqAnim); return;
  }
  // El motor captura el puntero al arrastrar: se busca la cara que está bajo el cursor.
  const f = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ref]');
  const nuevo = f ? desdeRef(f.dataset.ref) : null;
  if (nuevo?.tipo === 'frente' && nuevo.m === focoEditor() && modulo(nuevo.m)?.tipo !== 'esquinero') { sel = nuevo; alternarFrenteEd(nuevo); return; }
  sel = nuevo;
  if (sel?.tipo === 'cubierta') sel.cara = { front: 'frente', back: 'atras', left: 'izq', right: 'der' }[f.dataset.cara] || null; // la cara tocada se puede extruir
  render();
  if (sel?.tipo === 'cubierta' && sel.cara) { orientarHacia(caraCubierta(modulo(sel.m), sel.cara).n); aviso(`Cara ${LADOS_CUB[sel.cara]} de la cubierta: arrastra la manija ⇆ (o la cara) para extruirla.`); }
});
// ----- selección múltiple
const idsSel = () => (sel?.tipo === 'multi' ? sel.ids : sel?.m && sel.tipo !== 'muro' ? [sel.m] : []);
function seleccionarVarios(ids, sumar = false) {
  const set = new Set(sumar ? [...idsSel(), ...ids] : ids);
  const lista = [...set];
  sel = lista.length >= 2 ? { tipo: 'multi', ids: lista } : lista.length ? { tipo: 'modulo', m: lista[0] } : null;
  render();
  if (lista.length >= 2) aviso(`${lista.length} módulos seleccionados. Mayús + clic agrega o quita.`);
}
function alternar(id) {
  const ids = idsSel();
  seleccionarVarios(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
}

function desdeRef(ref) {
  const [m, k, a, b, e, i] = ref.split('|');
  if (k === 'cuerpo' && /^dv\d+$/.test(a || '')) return { tipo: 'div', m, dir: 'v', col: +a.slice(2), fila: 0 }; // división vertical
  if (k === 'f' && e === 'div') return { tipo: 'div', m, dir: 'h', col: +a, fila: +b }; // división entre dos secciones
  if (k === 'cuerpo' && a) return /^p\d+$/.test(b || '') ? { tipo: 'pieza', m, p: a, parte: +b.slice(1) } : { tipo: 'pieza', m, p: a };
  if (k === 'f' && e === 'rep') return { tipo: 'repisa', m, col: +a, fila: +b, i: +i };
  if (m === 'muro') return /^z\d+$/.test(a || '') ? { tipo: 'muro', i: +k, z: +a.slice(1) } : { tipo: 'muro', i: +k };
  if (m === 'suelo') return { tipo: 'suelo' };
  if (m === 'vano') return { tipo: 'vano', i: +k, v: a };
  if (m === 'obj') return { tipo: 'objeto', o: k };
  if (k === 'a') return { tipo: 'artefacto', m, a };
  if (k === 'f') return { tipo: 'frente', m, col: +a, fila: +b };
  if (k === 't') return { tipo: 'tirador', m, t: a };
  return { tipo: k, m };
}

// ===================== biblioteca de tiradores (arrastrar y soltar) =====================
const biblio = $('#biblio');
// Qué materiales de cubierta sirven para esta cubierta según sus reglas físicas (las mismas del Worker: el cliente
// no puede elegir los que no sirven). Postformado y los que se tratan como él siguen las reglas de siempre.
function bloqueMaterialesCub(m) {
  if (!materialesCub.length) return `<p class="ed-ayuda">${tokenGitHub() ? 'Cargando los materiales de cubierta…' : 'Entra a /admin/proyectos/ con GitHub para ver qué materiales de cubierta sirven con estos vuelos.'}</p>`;
  const cb = cubiertaDe(m), arts = artefactosDe(m);
  const c = { largo: cb.x1 - cb.x0, vuelo_max: Math.max(cb.v.frente, cb.v.atras, cb.v.izq, cb.v.der), bajo: arts.filter((a) => String(a.tipo).startsWith('lavaplatos') && a.montaje === 'bajo').length };
  const ev = materialesCub.map((mt) => ({ mt, ...evaluarCubierta(c, mt) }));
  const fila = (e) => `<li class="ed-cub-${e.estado}"><b>${esc(e.mt.nombre)}</b>${e.motivos.length ? ` <small>${esc(e.motivos.join(' · '))}</small>` : ''}</li>`;
  const grupo = (est, tit) => { const l = ev.filter((e) => e.estado === est); return l.length ? `<p class="ed-ayuda" style="margin:8px 0 2px"><b>${tit}</b></p><ul class="ed-cub-lista">${l.map(fila).join('')}</ul>` : ''; };
  return `<details class="ed-cub-mats"${ev.some((e) => e.estado !== 'ok') ? ' open' : ''}><summary>Materiales de cubierta para este diseño</summary>
    ${grupo('ok', 'Sirven')}${grupo('refuerzo', 'Sirven con refuerzo')}${grupo('no', 'No sirven (el cliente no los puede elegir)')}
    <p class="ed-ayuda">Según las reglas de cada material en Configuración de precios. Solo avisa: el mueble no cambia.</p></details>`;
}
// Tiradores del catálogo de precios (Configuración de precios): se dibujan a escala con su medida y color reales
function botonTirador(id, def, nombre, color = null) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.tirador = id;
  const xs = def.piezas.map((p) => [p.x - p.w / 2, p.x + p.w / 2]).flat(), ys = def.piezas.map((p) => [p.y - p.h / 2, p.y + p.h / 2]).flat();
  const x0 = Math.min(...xs, -4), x1 = Math.max(...xs, 4), y0 = Math.min(...ys, -2), y1 = Math.max(...ys, 2);
  const fill = (p) => color || (p.z > 1.5 ? '#ece7dd' : '#8a857d');
  b.innerHTML = `<svg viewBox="${x0 - 1} ${-y1 - 1} ${x1 - x0 + 2} ${y1 - y0 + 2}" preserveAspectRatio="xMidYMid meet">${def.piezas.map((p) => `<rect x="${p.x - p.w / 2}" y="${-p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx=".3" fill="${fill(p)}"${color ? ' stroke="#ece7dd" stroke-width=".15"' : ''}/>`).join('')}</svg>${esc(nombre)}`;
  return b;
}
function pintarBiblio() {
  biblio.replaceChildren();
  const cat = catalogoTir.map((c, i) => ({ c, i, def: c.forma !== 'sin' && tiradorDef(modeloCatalogo(c)) })).filter((x) => x.def);
  if (cat.length) {
    const t = document.createElement('p'); t.className = 'ed-ayuda ed-biblio-tit'; t.textContent = 'Catálogo (a escala, con su precio en Configuración de precios)'; biblio.append(t);
    for (const { c, i, def } of cat) { const b = botonTirador(modeloCatalogo(c), def, c.nombre, c.color); b.dataset.cat = i; b.title = `${c.nombre}${+c.precio ? ` · $${Number(c.precio).toLocaleString('es-CL')}` : ''}`; biblio.append(b); }
    const t2 = document.createElement('p'); t2.className = 'ed-ayuda ed-biblio-tit'; t2.textContent = 'Básicos'; biblio.append(t2);
  }
  for (const [id, def] of Object.entries(TIRADORES)) biblio.append(botonTirador(id, def, def.nombre));
}
pintarBiblio();
leerPrecios().then((cfg) => { catalogoTir = (cfg?.tiradores || []).filter((t) => t?.nombre); materialesCub = (cfg?.cubiertas_materiales || []).filter((x) => x?.id); pintarBiblio(); if (sel?.tipo === 'cubierta') props(); }).catch(() => {});
biblio.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-tirador]'); if (!b) return;
  e.preventDefault();
  const id = b.dataset.tirador, cat = b.dataset.cat != null ? catalogoTir[+b.dataset.cat] : null;
  const fantasma = document.createElement('div');
  fantasma.className = 'ed-fantasma'; fantasma.textContent = cat?.nombre || tiradorDef(id)?.nombre || id;
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
    if (cat) { t.color = cat.color || t.color; t.nombre = cat.nombre; } // del catálogo: su color y su nombre
    cambiar(() => m.tiradores.push(t));
    sel = { tipo: 'tirador', m: m.id, t: t.id }; render();
  };
  window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
});

// ===================== panel de capas (árbol) =====================
function arbol() {
  const fuera = fueraCliente();
  const tipoN = (f) => TIPOS_FRENTE[f.tipo] || f.tipo;
  const act = (s) => (sel && JSON.stringify(s) === JSON.stringify(sel) ? ' aria-current="true"' : '');
  const btn = (s, cls, html) => `<button class="${cls}" data-sel='${esc(JSON.stringify(s))}'${act(s)}>${html}</button>`;
  const W = murosDe(modelo.espacio);
  const hEsp = W.length ? `<div class="n0" style="padding:4px 6px;font-size:.78rem;color:var(--muted)">Espacio · ${W.length} muros</div>${W.map((w) => btn({ tipo: 'muro', i: w.i }, 'n1', `${esc(w.etiqueta || `Muro ${w.i + 1}`)} <small>${cm(w.largo)}</small>`) + vanosDe(w).map((v) => btn({ tipo: 'vano', i: w.i, v: v.id }, 'n3', `${VANOS[v.tipo].nombre} <small>${cm(v.ancho)}×${cm(v.alto)}</small>`)).join('')).join('')}<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">` : '';
  const hObj = (modelo.objetos || []).length ? `<div class="n0" style="padding:4px 6px;font-size:.78rem;color:var(--muted)">Electrodomésticos</div>${modelo.objetos.map((o) => btn({ tipo: 'objeto', o: o.id }, 'n1', `${esc(o.nombre)} <small>${cm(o.ancho)}×${cm(o.alto)}</small>`)).join('')}<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">` : '';
  $('#arbol').innerHTML = hEsp + hObj + modelo.modulos.map((m) => {
    const Z = Zde(m);
    let h = btn({ tipo: 'modulo', m: m.id }, 'n0', `<b>${esc(m.nombre)}</b> <small>${cm(m.ancho)}×${cm(m.alto)}×${cm(m.profundidad)}</small>${m.grupo ? `<span class="ed-tag">${esc(m.grupo_nombre || 'agrupado')}</span>` : ''}${fuera.has(m.id) ? '<span class="ed-tag ed-tag-fuera" title="El cliente lo desmarcó en «Muebles a cotizar»">no lo cotiza</span>' : ''}`);
    if (m.artefacto) return h;
    if (Z > 0) h += btn({ tipo: 'zocalo', m: m.id }, 'n1', `Zócalo <small>${cm(Z)}</small>`);
    h += btn({ tipo: 'cuerpo', m: m.id }, 'n1', 'Cuerpo');
    const csA = celdas(m); // cada frente con su medida final (la del corte); las puertas dobles, por hoja
    m.columnas.forEach((c, ci) => {
      h += `<div class="n2" style="padding:4px 0 2px 30px;font-size:.72rem">Columna ${ci + 1}</div>`;
      c.frentes.forEach((f, fi) => {
        const k = csA.find((x) => x.col === ci && x.fila === fi), F = k && k.tipo !== 'abierto' ? medidaFrente(m, k) : null;
        const med = F ? `${F.hojas > 1 ? `${F.hojas} × ` : ''}${cm(F.hoja)}×${cm(F.h)}` : k ? `${cm(k.w)}×${cm(k.h)}` : cm(f.alto);
        h += btn({ tipo: 'frente', m: m.id, col: ci, fila: fi }, 'n3', `${tipoN(f)} <small>${med}</small>`);
      });
    });
    (m.tiradores || []).filter((t) => !t.esq).forEach((t) => { h += btn({ tipo: 'tirador', m: m.id, t: t.id }, 'n1', `↳ ${esc(t.nombre || tiradorDef(t.modelo)?.nombre || t.modelo)} <small>c${t.col + 1}·f${t.fila + 1}</small>`); });
    if (m.cubierta) h += btn({ tipo: 'cubierta', m: m.id }, 'n1', 'Cubierta');
    for (const a of artefactosDe(m)) h += btn({ tipo: 'artefacto', m: m.id, a: a.id }, 'n3', `${ARTEFACTOS[a.tipo].nombre} <small>${cm(a.ancho)}×${cm(a.fondo)}</small>`);
    return h;
  }).join('<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">') || '<p class="ed-vacio">Sin módulos. Usa <b>Dibujar módulo</b>.</p>';
}
$('#arbol').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sel]'); if (!b) return;
  sel = JSON.parse(b.dataset.sel); render();
});

// ===================== panel de propiedades =====================
const num = (k, label, v, { u = 'cm', step = .5, min = 0, cls = '' } = {}) => // cls 'resaltado' marca el campo de la cara elegida
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
  if (sel.tipo === 'objeto') {
    const o = objeto(sel.o); if (!o) { sel = null; return props(); }
    const ap = apoyosEn(+o.x, +o.z);
    P.innerHTML = `<div class="ed-props"><p class="tit">${esc(o.nombre)}</p><p class="sub">Electrodoméstico · referencia, sin precio</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Nombre<input type="text" data-k="o.nombre" value="${esc(o.nombre)}"></label>
        <label class="ed-campo ancho2">Modelo<select data-k="o.tipo">${Object.entries(OBJETOS).map(([k, d]) => `<option value="${k}"${k === o.tipo ? ' selected' : ''}>${d.nombre}</option>`).join('')}</select></label>
        ${num('o.ancho', 'Ancho', o.ancho)}${num('o.alto', 'Alto', o.alto)}${num('o.fondo', 'Fondo', o.fondo)}${num('o.elevacion', 'Altura del piso', o.elevacion)}
        ${num('o.x', 'Posición X', o.x, { min: -9999 })}${num('o.z', 'Posición Z', o.z, { min: -9999 })}${num('o.rotacion', 'Giro', o.rotacion, { u: '°', step: 90, min: -360 })}
        ${o.tipo === 'colgante' ? num('o.cable', 'Largo del cable', o.cable) : opciones('o.color', 'Color', o.color || '', { '': 'Como cocina y encimeras', acero: 'Acero inoxidable', negro: 'Negro', blanco: 'Blanco' }, 'ancho2')}
      </div>
      <p class="sub" style="margin-top:12px">Apoyar en</p>
      <div class="ed-botones">${ap.map((a) => `<button data-a="apoyar:${a.y}"${Math.abs(a.y - +o.elevacion) < .5 ? ' class="ed-primario"' : ''}>${esc(a.nombre)} <small>${cm(a.y)}</small></button>`).join('')}</div>
      <p class="sub" style="margin-top:12px">Productos recomendados para el cliente</p>
      <p class="ed-ayuda">Cuando el cliente toque este electrodoméstico en su portal, verá estos links a la derecha. Pega el link del producto en la tienda.</p>
      ${(o.links || []).map((l, i) => `<div class="ed-campos ed-link">
        <label class="ed-campo ancho2">Nombre<input type="text" data-k="o.links.${i}.nombre" value="${esc(l.nombre || '')}" placeholder="Ej.: Freezer horizontal 200 L"></label>
        <label class="ed-campo">Tienda<input type="text" data-k="o.links.${i}.tienda" value="${esc(l.tienda || '')}" placeholder="Ej.: Falabella"></label>
        <label class="ed-campo">Precio<input type="number" min="0" step="1000" data-k="o.links.${i}.precio" value="${+l.precio || ''}" placeholder="opcional"></label>
        <label class="ed-campo ancho2">Link<input type="url" data-k="o.links.${i}.url" value="${esc(l.url || '')}" placeholder="https://…"></label>
        <div class="ed-botones ancho2"><button data-a="obj-link-del:${i}" class="peligro">Quitar este link</button></div>
      </div>`).join('')}
      <div class="ed-botones"><button data-a="obj-link-add"${(o.links || []).length >= 6 ? ' disabled' : ''}>+ Agregar link</button></div>
      <div class="ed-botones"><button data-a="obj-girar">⟳ 90°</button><button data-a="obj-duplicar">Duplicar</button><button data-a="obj-borrar" class="peligro">Eliminar</button></div>
      <p class="ed-ayuda">Arrástralo en Planta (se queda sobre la cubierta o repisa que tenga debajo) o en Frente (también en altura: al soltarlo se apoya en la superficie de abajo).</p></div>`;
    return;
  }
  if (sel.tipo === 'artefacto') {
    const m = modulo(sel.m), a = m && artefactosDe(m).find((x) => x.id === sel.a);
    if (!a) { sel = m ? { tipo: 'modulo', m: m.id } : null; return props(); }
    const def = ARTEFACTOS[a.tipo], esq = m.tipo === 'esquinero', W = +m.ancho, Dc = zonasCubierta(m)[0].z1;
    const pos = !a.giro ? 'lado1' : Math.abs(a.giro) === 45 ? 'rincon' : 'lado2';
    P.innerHTML = `<div class="ed-props"><p class="tit">${def.nombre}</p><p class="sub">Sobre la cubierta de ${esc(m.nombre)}${esq ? ' (en L)' : ` · ${cm(W)} × ${cm(Dc)} cm`}</p>
      ${esq ? `<p class="sub" style="margin-top:8px">Posición en la L</p><div class="ed-botones">${[['lado1', 'Lado 1'], ['rincon', 'En el rincón (45°)'], ['lado2', 'Lado 2']].map(([k, t]) => `<button data-a="art-pos:${k}"${pos === k ? ' class="ed-primario"' : ''}>${t}</button>`).join('')}</div>
      <p class="ed-ayuda">De frente a un lado de la L o girado mirando al rincón. También puedes arrastrarlo en Planta: al pasar al otro lado se gira solo.</p>` : ''}
      <div class="ed-campos">
        <label class="ed-campo ancho2">Modelo<select data-k="a.tipo">${DE_CUBIERTA.map((k) => `<option value="${k}"${k === a.tipo ? ' selected' : ''}>${ARTEFACTOS[k].nombre}</option>`).join('')}</select></label>
        ${num('a.ancho', 'Ancho', a.ancho)}${num('a.fondo', 'Fondo', a.fondo)}
        ${esq ? '' : `${num('a.desde', 'Al costado izq.', a.desde, { min: -999 })}${num('a.hasta', 'Al costado der.', r1(W - a.x1), { min: -999 })}
        ${num('a.frente', 'Al canto (frente)', a.frente)}${num('a.atras', 'A la pared (fondo)', r1(a.z0))}`}
        ${def.cubas ? opciones('a.lado', 'Escurridor', a.lado || 'derecha', { derecha: 'A la derecha', izquierda: 'A la izquierda' }, 'ancho2') : ''}
        ${def.cubas ? opciones('a.montaje', 'Montaje (sacado en la cubierta)', a.montaje || 'sobrepuesto', { sobrepuesto: 'Sobrepuesto', bajo: 'Bajo cubierta (pulido)' }, 'ancho2') : ''}
      </div>
      <div class="ed-botones">${esq ? '' : '<button data-a="centrar-art">Centrar en el mueble</button>'}<button data-a="borrar-art" class="peligro">Eliminar</button></div>
      <p class="ed-ayuda">Arrástralo en Planta (o hacia los lados en Frente): se mueve libre por las cubiertas y puede quedar sobre la unión de dos muebles si la cubierta sigue. Donde no hay cubierta no se deja. Las flechas lo mueven (Mayús: 10 cm).</p></div>`;
    return;
  }
  if (sel.tipo === 'div') {
    const m = modulo(sel.m); if (!m) { sel = null; return props(); }
    P.innerHTML = `<div class="ed-props"><p class="tit">División ${sel.dir === 'v' ? 'vertical' : 'horizontal'}</p>
      <p class="sub">${esc(m.nombre)} · ${sel.dir === 'v' ? `entre las columnas ${sel.col + 1} y ${sel.col + 2}` : `columna ${sel.col + 1}, entre las filas ${sel.fila + 1} y ${sel.fila + 2}`}</p>
      ${sel.dir === 'h' ? (() => { const on = divisionesH(m).some((d) => d.col === sel.col && d.fila === sel.fila);
        return `<p class="sub" style="margin-top:10px">Tablero de división</p>
      <div class="ed-botones"><button data-a="div-tablero:1"${on ? ' class="ed-primario"' : ''}>Lleva división fija</button><button data-a="div-tablero:0"${on ? '' : ' class="ed-primario"'}>Sin tablero</button></div>
      <p class="ed-ayuda">La división fija va justa y atornillada entre los costados. Aparece sola cuando una de las dos secciones es abierta; aquí la pones o la quitas (ej. entre dos puertas de una torre).</p>${on ? bloqueMaterial() : ''}`; })() : ''}
      <div class="ed-botones"><button data-a="borrar-div" class="peligro">Unir las dos secciones (Supr)</button></div>
      <p class="ed-ayuda">Al unirlas, las dos secciones quedan en una. En Frente, arrástrala para cambiar las medidas.</p></div>`;
    return;
  }
  if (sel.tipo === 'vano') {
    const x = vanoSel(); if (!x) { sel = null; return props(); }
    const { w, v } = x, def = VANOS[v.tipo];
    P.innerHTML = `<div class="ed-props"><p class="tit">${def.nombre}</p><p class="sub">Muro ${w.i + 1}${w.etiqueta ? ' · ' + esc(w.etiqueta) : ''} · ${cm(w.largo)} cm</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Modelo<select data-k="v.tipo">${Object.entries(VANOS).map(([k, d]) => `<option value="${k}"${k === v.tipo ? ' selected' : ''}>${d.nombre}</option>`).join('')}</select></label>
        ${num('v.ancho', 'Ancho', v.ancho)}${num('v.alto', 'Alto', v.alto)}
        ${def.puerta ? '' : num('v.antepecho', 'Antepecho (desde el piso)', v.antepecho, { min: 0 })}
        ${num('v.desde', 'Desde el extremo izq.', v.desde, { min: 0 })}${num('v.hasta', 'Hasta el extremo der.', Math.round((w.largo - v.desde - v.ancho) * 10) / 10, { min: 0 })}
      </div>
      <div class="ed-botones"><button data-a="centrar-vano">Centrar en el muro</button><button data-a="borrar-vano" class="peligro">Eliminar</button></div>
      ${def.hojas ? `<p class="sub" style="margin-top:12px">${def.puerta ? 'Color de la puerta' : 'Color del marco'}</p>${bloqueMaterial()}` : ''}
      <p class="ed-ayuda">Medidas en cm. Arrástrala en la vista Frente del muro; las flechas la mueven (Mayús: 10 cm). Para cambiarle el color, arrastra un material de la pestaña «Materiales» sobre ella.</p></div>`;
    return;
  }
  if (sel.tipo === 'medida') {
    const md = (modelo.medidas || []).find((x) => x.id === sel.id); if (!md) { sel = null; return props(); }
    const L = Math.hypot(md.b[0] - md.a[0], md.b[1] - md.a[1]);
    P.innerHTML = `<div class="ed-props"><p class="tit">Medida · ${cm(L)} cm</p><p class="sub">Huincha · vista ${md.vista === 'planta' ? 'Planta' : 'Frente'}</p>
      <div class="ed-botones"><button data-a="borrar-medida" class="peligro">Borrar medida (Supr)</button></div>
      <p class="ed-ayuda">Las medidas quedan guardadas en el proyecto como cotas de referencia; no las ve el cliente.</p></div>`;
    return;
  }
  if (sel.tipo === 'multi') {
    const mods = sel.ids.map(modulo).filter(Boolean);
    P.innerHTML = `<div class="ed-props"><p class="tit">${mods.length} módulos</p><p class="sub">Selección múltiple</p>
      <ul class="ed-sel-lista">${mods.map((m) => `<li>${esc(m.nombre)} <small>${cm(m.ancho)} × ${cm(m.alto)}</small></li>`).join('')}</ul>
      <div class="ed-botones"><button data-a="unir" class="ed-primario">Unir en un mueble</button><button data-a="agrupar">Agrupar como un mueble (en L)</button><button data-a="borrar-multi" class="peligro">Eliminar ${mods.length}</button></div>
      <p class="ed-ayuda" id="unir-aviso"><b>Unir</b>: módulos uno junto al otro en la misma pared, con el mismo alto y zócalo; quedan con un solo cuerpo y una sola cubierta.<br><b>Agrupar</b>: para muebles en L o que no miran hacia el mismo lado; cada parte conserva su forma, pero se mueven y giran juntas como un solo mueble.</p></div>`;
    return;
  }
  if (sel.tipo === 'suelo') { // suelo del espacio: su material (palmeta, baldosa…) se elige en la pestaña Materiales
    const a = acabadosEn('suelo')[0];
    P.innerHTML = `<div class="ed-props"><p class="tit">Suelo</p><p class="sub">Espacio</p>
      <div class="ed-material-pieza"><i class="ed-esfera" style="${a ? esferaAcab(a, 28) : 'background:#2a2826'}"></i><span style="flex:1">${a ? `<b>${esc(a.nombre || PATRONES[a.patron]?.nombre || '')}</b>` : '<small>Sin material</small>'}</span><button data-a="ver-materiales">Cambiar…</button></div>
      <p class="ed-ayuda">Elige una palmeta, baldosa o porcelanato en la pestaña Materiales (clic en la esfera, o arrástrala al suelo). Supr le quita el material.</p></div>`;
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
        : `<button data-a="ver-muro" class="ed-primario">Ver de frente</button>${w.tramo != null ? '<button data-a="invertir-muro" title="Cambia hacia qué lado mira la cara interior">Invertir lado</button>' : ''}<button data-a="eliminar-muro" class="peligro">Eliminar este muro</button>`}<button data-a="borrar-muros" class="peligro">Borrar todos los muros</button></div>
      ${w.tramo != null ? '<p class="ed-ayuda">Muro suelto: arrastra sus puntas en Planta; si acercas una a la punta de otro muro, se pegan (y si es el extremo del contorno, se une a él).</p>' : ''}
      ${w.oculto ? '<p class="ed-ayuda">Muro eliminado: no se dibuja ni lo ve el cliente. Queda punteado en Planta para poder restaurarlo.</p>' : ''}
      <p class="ed-ayuda">Cambiar el largo corre los muros que siguen y mantiene la escuadra. El cliente ve los muros, pero no las etiquetas.</p>
      ${w.oculto ? '' : bloqueZonasMuro(w)}</div>`;
    return;
  }
  const m = modulo(sel.m); if (!m) { sel = null; return props(); }
  if (m.tipo === 'esquinero') { P.innerHTML = panelEsquinero(m); return; }
  let h = '';
  if ((sel.tipo === 'modulo' || sel.tipo === 'cuerpo') && m.artefacto) {
    P.innerHTML = `<div class="ed-props"><p class="tit">${esc(m.nombre)}</p><p class="sub">Artefacto de piso</p>
      <div class="ed-campos">
        ${opciones('artefacto', 'Modelo', m.artefacto, Object.fromEntries(Object.entries(ARTEFACTOS).filter(([, d]) => d.zona === 'piso').map(([k, d]) => [k, d.nombre])), 'ancho2')}
        ${num('ancho', 'Ancho', m.ancho)}${num('alto', 'Alto', m.alto)}${num('profundidad', 'Fondo', m.profundidad)}
        ${num('x', 'Posición X', m.x, { min: -9999 })}${num('z', 'Posición Z (fondo)', m.z, { min: -9999 })}${num('rotacion', 'Giro en planta', m.rotacion, { u: '°', step: 90, min: -360 })}
      </div>
      <div class="ed-botones"><button data-a="girar-">⟲ 90°</button><button data-a="girar+">⟳ 90°</button><button data-a="borrar-modulo" class="peligro">Eliminar</button></div>
      <p class="ed-ayuda">En Frente, mantén el clic y arrástrala hacia los lados: las cotas muestran la distancia al mueble, puerta o muro más cercano.</p></div>`;
    return;
  }
  if (sel.tipo === 'modulo' || sel.tipo === 'cuerpo') {
    const pl = leerPlantilla(m);
    const defP = PLANTILLAS[pl?.t] || {}, esIsla = pl?.t?.startsWith('isla');
    const bloquePl = pl ? `<div class="ed-plantilla"><p class="sub">${esc(defP.nombre || 'Cocina de referencia')} · se ajusta sola</p>
      <div class="ed-campos">
        ${[...defP.medidas, 'fondo', 'alto', 'zocalo', ...(pl.p.aereos ? ['altoAereo', 'sepAereo', 'fondoAereo'] : []), 'x', 'z']
          .map((k) => `<label class="ed-campo">${(esIsla && { largoA: 'Largo de la isla', fondo: 'Fondo (lado cocina)', alto: 'Alto (sin cubierta)' }[k]) || ETIQUETAS[k]}<span class="u" data-u="${k === 'lamparas' ? 'un.' : 'cm'}"><input type="number" step="${k === 'lamparas' ? 1 : .5}" min="0" data-pk="${k}" value="${pl.p[k] ?? 0}"></span></label>`).join('')}
        ${(defP.extra || []).filter((k) => SELECTS[k]).map((k) => `<label class="ed-campo ancho2">${ETIQUETAS[k]}<select data-pk="${k}">${Object.entries(SELECTS[k]).map(([v, n]) => `<option value="${v}"${pl.p[k] === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`).join('')}
      </div>
      ${(defP.opciones || []).map((k) => `<label class="ed-check"><input type="checkbox" data-pk="${k}"${pl.p[k] ? ' checked' : ''}> ${ETIQUETAS[k]}</label>`).join('')}
      ${!esIsla ? `<label class="ed-check"><input type="checkbox" data-pk="aereos"${pl.p.aereos ? ' checked' : ''}> Muebles aéreos</label>
      <label class="ed-check"><input type="checkbox" data-pk="lavaplatos"${pl.p.lavaplatos ? ' checked' : ''}> Lavaplatos (80 cm)</label>
      <label class="ed-check"><input type="checkbox" data-pk="cocina"${pl.p.cocina ? ' checked' : ''}> Hueco para cocina (76 cm)</label>` : ''}
      <div class="ed-botones"><button data-a="desagrupar">Desagrupar (editar libre)</button><button data-a="borrar-cocina" class="peligro">Eliminar ${esIsla ? 'esta isla' : 'esta cocina'}</button></div>
      </div>` : '';
    const g = grupoDe(m);
    const bloqueG = m.grupo ? `<div class="ed-plantilla"><p class="sub">Parte de un mueble agrupado · ${g.length} piezas</p>
      <label class="ed-campo ancho2">Nombre del mueble<input type="text" data-k="grupo_nombre" value="${esc(m.grupo_nombre || 'Mueble en L')}"></label>
      <div class="ed-botones"><button data-a="sel-grupo">Seleccionar el mueble completo</button><button data-a="desagrupar-mueble">Separar las piezas</button></div></div>` : '';
    h = `${bloquePl}${bloqueG}<p class="tit">${esc(m.nombre)}</p><p class="sub">${sel.tipo === 'cuerpo' ? 'Cuerpo' : 'Módulo'}</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Nombre<input type="text" data-k="nombre" value="${esc(m.nombre)}"></label>
        ${opciones('tipo', 'Tipo', m.tipo, { base: 'Base', aereo: 'Aéreo', torre: 'Torre', isla: 'Isla' }, 'ancho2')}
        ${num('ancho', 'Ancho', m.ancho)}${num('alto', 'Alto', m.alto)}
        ${num('profundidad', 'Profundidad', m.profundidad)}${num('zocalo', 'Zócalo', m.zocalo)}
        ${num('x', 'Posición X', m.x, { min: -9999 })}${num('z', 'Posición Z (fondo)', m.z, { min: -9999 })}
        ${num('elevacion', 'Altura del piso', m.elevacion)}${num('rotacion', 'Giro en planta', m.rotacion, { u: '°', step: 90, min: -360 })}
        ${opciones('tablero', 'Tablero', String(+m.tablero || 15), { 15: 'Melamina 15 mm', 18: 'Melamina 18 mm' }, 'ancho2')}
        ${num('costados_atras', 'Costados alargados atrás', m.costados_atras || 0)}
        ${m.tipo === 'isla' ? `${num('costado_grosor', 'Grosor de los costados', grosorCostado(m), { min: 1.5, step: .5 })}<p class="ed-ayuda" style="grid-column:span 2;margin:0">Isla: el ancho es el total; los costados son dobles (2 caras con tiras entre ellas y una tapa adelante) y engruesan hacia adentro. Las puertas van empotradas, con una división en cada unión, y se ajustan solas. Trasera de melamina 15 mm.</p>` : ''}
        ${opciones('costados', 'Costados visibles', m.costados || '', { '': `Como el general (${PALETA.costados.opciones[colorDe(modelo.colores, 'costados')][0].toLowerCase()})`, frente: 'Igual a la melamina', cuerpo: 'Como el cuerpo' }, 'ancho2')}
      </div>
      ${bloqueTechoSoportes(m)}
      ${bloquePuertas(m)}
      ${bloqueRepisas(m)}
      <label class="ed-check"><input type="checkbox" data-k="cubierta"${m.cubierta ? ' checked' : ''}> Lleva cubierta</label>
      <div class="ed-botones"><button data-a="girar-" title="Girar 90° a la izquierda (R)">⟲ 90°</button><button data-a="girar+" title="Girar 90° a la derecha">⟳ 90°</button><button data-a="duplicar">Duplicar →</button><button data-a="borrar-modulo" class="peligro">Eliminar módulo</button></div>`;
  } else if (sel.tipo === 'soporte') {
    h = `<p class="tit">Soporte delantero</p><p class="sub">${esc(m.nombre)} · tablero horizontal de 10 cm bajo la cubierta o el techo</p>
      <p class="ed-ayuda">Elige su color abajo («Cambiar…») o arrastra un material encima.</p>
      <div class="ed-botones"><button data-a="quitar-soporte" class="peligro">Quitar el soporte (Supr)</button></div>`;
  } else if (sel.tipo === 'zocalo') {
    const z = marcoZocalo(m);
    h = `<p class="tit">Zócalo</p><p class="sub">${esc(m.nombre)} · marco de 4 lados · ${cm(z.x1 - z.x0)} × ${cm(z.z1 - z.z0)} cm</p>
      <div class="ed-campos">${num('zocalo', 'Alto', m.zocalo)}${num('zocalo_retiro', 'Retiro del frente', z.frente)}
        ${num('zocalo_atras', 'Retiro de atrás', z.atras)}${num('zocalo_izq', 'Retiro izquierdo', z.izq)}${num('zocalo_der', 'Retiro derecho', z.der)}</div>
      <div class="ed-botones">${vista !== 'inferior' ? '<button data-a="ver-abajo" class="ed-primario">Ver desde abajo</button>' : ''}<button data-a="zocalo-centrar">Centrar a los lados</button></div>
      <p class="ed-ayuda">Cada retiro es cuánto entra el zócalo desde ese borde del mueble. Desde abajo puedes arrastrar cada lado o el marco completo.</p>`;
  } else if (sel.tipo === 'frente') {
    const col = m.columnas[sel.col], f = col?.frentes[sel.fila];
    if (!f) { sel = { tipo: 'modulo', m: m.id }; return props(); }
    const tieneBis = f.tipo === 'puerta';
    h = `<p class="tit">${esc(TIPOS_FRENTE[f.tipo] || f.tipo)}</p><p class="sub">Columna ${sel.col + 1} · fila ${sel.fila + 1}</p>
      <div class="ed-campos">
        ${opciones('f.tipo', 'Tipo', f.tipo, TIPOS_FRENTE, 'ancho2')}
        ${tieneBis ? opciones('f.bisagra', 'Bisagra', f.bisagra || 'izquierda', { izquierda: 'Izquierda', derecha: 'Derecha', arriba: 'Arriba (abatible)', abajo: 'Abajo' }, 'ancho2') : ''}
        ${f.tipo === 'cajon' ? opciones('f.montaje', 'Frente del cajón', f.montaje || 'sobre', { sobre: 'Sobre los cantos (como una puerta)', dentro: 'Dentro de las separaciones' }, 'ancho2') : ''}
        ${num('f.alto', 'Alto del frente', f.alto)}${num('c.ancho', 'Ancho de columna', col.ancho)}
      </div>
      ${tieneBis ? `<p class="ed-ayuda">Bisagra = el lado donde van las bisagras: la puerta abre hacia el otro lado (${(f.bisagra || 'izquierda') === 'izquierda' ? 'esta abre hacia la derecha' : (f.bisagra === 'derecha' ? 'esta abre hacia la izquierda' : 'esta abre hacia ' + (f.bisagra === 'arriba' ? 'arriba' : 'abajo'))}). En Planta se ve el arco de apertura y se puede tocar.</p>` : ''}
      ${f.tipo !== 'cajon' ? (() => {
        const n = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila)?.repisas || 0;
        return `<div class="ed-repisas"><span>Repisas</span><button data-a="rep-" title="Quitar una repisa">−</button><b>${n}</b><button data-a="rep+" title="Agregar una repisa">+</button>
          ${f.tipo !== 'abierto' ? '<button data-a="quitar-puerta">Quitar puerta (sección abierta)</button>' : '<button data-a="poner-puerta">Poner puerta</button>'}</div>
          <p class="ed-ayuda">${f.tipo === 'abierto' ? 'Sin puerta: se ve el interior blanco y las repisas completas hasta el fondo.' : 'Detrás de la puerta: actívalas en Capas → Repisas para verlas punteadas.'}</p>`;
      })() : ''}
      ${f.tipo === 'puerta_doble' ? (() => {
        const n = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila)?.hojas || 2;
        return `<div class="ed-repisas"><span>Puertas (hojas)</span><button data-a="hoja-" title="Una hoja menos">−</button><b>${n}</b><button data-a="hoja+" title="Una hoja más">+</button><small>${cm(medidaFrente(m, celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila)).hoja)} cm c/u</small></div>
          <p class="ed-ayuda">Máximo ${MAX_HOJA} cm por hoja: con ${cm(col.ancho)} cm van al menos ${hojasMin(+col.ancho)}.</p>`;
      })() : ''}
      <div class="ed-botones">
        <button data-a="div-h">Dividir en 2 filas</button><button data-a="div-v">Dividir en 2 columnas</button>
        ${sel.fila < col.frentes.length - 1 ? '<button data-a="unir-abajo">Unir con el de abajo</button>' : ''}
        ${sel.col < m.columnas.length - 1 ? '<button data-a="unir-der">Unir columna con la derecha</button>' : ''}
        <button data-a="tirador">+ Tirador</button>
      </div>`;
  } else if (sel.tipo === 'tirador') {
    const t = m.tiradores.find((k) => k.id === sel.t);
    if (!t) { sel = null; return props(); }
    // Modelo: los del catálogo de precios (a escala y con su color) y los de la biblioteca básica
    const enCat = catalogoTir.findIndex((c) => c.nombre === t.nombre);
    const modelos = { ...Object.fromEntries(catalogoTir.map((c, i) => [`cat|${i}`, `${c.nombre}`])), ...Object.fromEntries(Object.entries(TIRADORES).map(([k, v]) => [k, `Básico · ${v.nombre}`])) };
    if (enCat < 0 && !modelos[t.modelo]) modelos[t.modelo] = tiradorDef(t.modelo)?.nombre || t.modelo;
    const colores = { negro: 'Negro mate', acero: 'Acero', dorado: 'Dorado', blanco: 'Blanco' };
    if (!colores[t.color]) colores[t.color] = t.color;
    h = `<p class="tit">${esc(t.nombre || tiradorDef(t.modelo)?.nombre || t.modelo)}</p><p class="sub">Tirador · columna ${t.col + 1} · fila ${t.fila + 1}${tiradorDef(t.modelo) ? ` · ${cm(tiradorDef(t.modelo).largo)} cm de largo` : ''}</p>
      <div class="ed-campos">
        ${opciones('t.modelo', 'Modelo', enCat >= 0 ? `cat|${enCat}` : t.modelo, modelos, 'ancho2')}
        ${opciones('t.color', 'Color', t.color, colores, 'ancho2')}
        ${num('t.dx', 'Desde el centro →', t.dx, { min: -999 })}${num('t.dy', 'Desde el centro ↑', t.dy, { min: -999 })}
        ${num('t.rot', 'Giro', t.rot, { u: '°', step: 1, min: -360 })}
      </div>
      <div class="ed-botones"><button data-a="rot-">⟲ 90°</button><button data-a="rot+">⟳ 90°</button><button data-a="centrar">Centrar</button><button data-a="borrar-tirador" class="peligro">Eliminar</button></div>`;
  } else if (sel.tipo === 'pieza') {
    const quitable = ['piso', 'techo', 'fondo', 'izq', 'der'].includes(sel.p);
    h = `<p class="tit">${NOMBRE_PIEZA[sel.p] || sel.p}</p><p class="sub">${esc(m.nombre)} · tablero de ${+m.tablero || 15} mm</p>
      ${sel.p === 'piso' ? '<p class="ed-ayuda">Si el mueble va apoyado sobre una cubierta u otro mueble, puedes quitar la base: el interior llega hasta abajo.</p>' : ''}
      ${sel.p === 'izq' || sel.p === 'der' ? bloquePartes(m, sel) : quitable ? '<div class="ed-botones"><button data-a="quitar-pieza" class="peligro">Quitar esta pieza (Supr)</button></div>' : ''}${bloqueMaterial()}`;
  } else if (sel.tipo === 'repisa') {
    const c = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila);
    h = `<p class="tit">Repisa ${sel.i + 1} de ${c.repisas}</p><p class="sub">${esc(m.nombre)} · columna ${sel.col + 1}, fila ${sel.fila + 1}</p>
      ${(() => { const fija = repisaFija(m, c, sel.i); return `<p class="sub" style="margin-top:10px">¿Cómo va?</p>
      <div class="ed-botones"><button data-a="rep-tipo:fija"${fija ? ' class="ed-primario"' : ''}>Fija (justa, atornillada)</button><button data-a="rep-tipo:movil"${fija ? '' : ' class="ed-primario"'}>Móvil (más corta)</button></div>
      <p class="ed-ayuda">Fija: ancho interior exacto y fondo completo, se atornilla. Móvil: 2 mm más corta de ancho y 1 cm menos de fondo, para correrla por dentro sobre soportes; en 3D lleva una raya roja en el canto.</p>`; })()}
      <div class="ed-botones"><button data-a="quitar-repisa" class="peligro">Quitar esta repisa (Supr)</button><button data-a="ver-seccion">Ver la sección</button></div>
      <p class="ed-ayuda">Las repisas se reparten parejo en el alto de la sección.</p>${bloqueMaterial()}`;
  } else if (sel.tipo === 'cubierta') {
    const cb = cubiertaDe(m), lados = { frente: 'Frente', atras: 'Atrás', izq: 'Izquierda', der: 'Derecha' };
    h = `<p class="tit">Cubierta</p><p class="sub">${esc(m.nombre)} · ${cm(cb.x1 - cb.x0)} × ${cm(cb.z1 - cb.z0)} cm</p>
      <p class="sub" style="margin-top:10px">Vuelos: cuánto sobresale del mueble${sel.cara ? ` · cara elegida: ${lados[sel.cara].toLowerCase()}` : ''}</p>
      <div class="ed-campos">${Object.entries(lados).map(([k, n]) => num(`v.${k}`, n, cb.v[k], { cls: sel.cara === k ? 'resaltado' : '' })).join('')}</div>
      <label class="ed-check"><input type="checkbox" data-k="cubierta_respaldo"${m.cubierta_respaldo ? ' checked' : ''}> Lleva zócalo de cubierta (respaldo contra el muro)</label>
      ${bloqueMaterialesCub(m)}
      <div class="ed-botones"><button data-a="barra-desayuno" class="ed-primario">Barra de desayuno (${sel.cara && sel.cara !== 'frente' ? lados[sel.cara].toLowerCase() : 'atrás'}: 60 cm)</button></div>
      <p class="ed-ayuda">Toca el canto de la cubierta en 3D: la vista gira hacia ese lado y aparece la manija ⇆ para extruirla. En Planta también puedes arrastrar sus bordes.</p>
      <p class="sub" style="margin-top:10px">Agregar sobre la cubierta</p>
      <div class="ed-biblio ed-plantillas">${DE_CUBIERTA.map((k) => `<button type="button" data-a="art:${k}">${ARTEFACTOS[k].nombre}</button>`).join('')}</div>
      ${artefactosDe(m).map((a) => `<button class="ed-fila-art" data-a="ver-art:${a.id}">${ARTEFACTOS[a.tipo].nombre} <small>${cm(a.ancho)} × ${cm(a.fondo)}</small></button>`).join('')}
      <div class="ed-botones"><button data-a="quitar-cubierta" class="peligro">Quitar cubierta</button></div>`;
  }
  if (['frente', 'zocalo', 'cubierta', 'cuerpo', 'modulo', 'soporte'].includes(sel.tipo)) h += bloqueMaterial();
  if (['frente', 'cuerpo', 'modulo', 'repisa', 'cubierta'].includes(sel.tipo) && !m.artefacto) h += bloqueLuces(m);
  // Techo y soporte también al tocar una sección, una pieza o el soporte (ej. el nicho del microondas)
  if (['modulo', 'cuerpo', 'frente', 'pieza', 'soporte', 'repisa', 'zocalo'].includes(sel.tipo) && m && !m.artefacto) h += bloqueAbrir(m) + bloqueAislar(m);
  // Girar el mueble desde cualquiera de sus partes (en 3D, al tocar el mueble se elige una parte y antes no había cómo girarlo)
  if (['frente', 'pieza', 'soporte', 'repisa', 'zocalo', 'cubierta'].includes(sel.tipo) && m && !m.artefacto) {
    h += `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Girar el mueble · ${esc(m.nombre)}</p>
      <div class="ed-botones"><button data-a="girar-" title="Girar 90° a la izquierda (R)">⟲ 90°</button><button data-a="girar+" title="Girar 90° a la derecha">⟳ 90°</button></div>
      <p class="ed-ayuda">Gira el mueble completo (también con la tecla R).</p></div>`;
  }
  if (['frente', 'pieza', 'soporte', 'repisa'].includes(sel.tipo) && m && !m.artefacto) h += bloqueTechoSoportes(m);
  // Piezas quitadas del cuerpo (se pueden restaurar)
  if ((sel.tipo === 'modulo' || sel.tipo === 'cuerpo') && m.quitar?.length) {
    h += `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Piezas quitadas: ${m.quitar.map((p) => (NOMBRE_PIEZA[p] || p).toLowerCase()).join(', ')}</p><div class="ed-botones"><button data-a="restaurar-piezas">Restaurar piezas</button></div></div>`;
  }
  // En frentes, zócalo y tiradores también se muestran las medidas generales del módulo.
  if (sel.tipo === 'frente' || sel.tipo === 'zocalo' || sel.tipo === 'tirador') {
    h += `<p class="sub" style="margin-top:14px">Módulo · ${esc(m.nombre)}</p>
      <div class="ed-campos">${num('ancho', 'Ancho', m.ancho)}${num('alto', 'Alto', m.alto)}${num('profundidad', 'Profundidad', m.profundidad)}${sel.tipo === 'zocalo' ? '' : num('zocalo', 'Zócalo', m.zocalo)}</div>`;
  }
  P.innerHTML = `<div class="ed-props">${h}</div>`;
}

// Costado en partes (dueño, 2026-11-25): se divide con un corte horizontal (a una altura) o vertical (a un fondo) y se
// borran las partes que no van (ej. la caja del refrigerador apoyada en el mesón). Cada parte que queda es una pieza.
function bloquePartes(m, s) {
  const ps = partesCostado(m, s.p), bc = bordesCostado(m), i = ps ? s.parte : 0;
  const lista = ps ? ps.map((q, j) => { const r = rectParte(q, bc); return `<button data-a="parte:${j}"${j === s.parte ? ' class="ed-primario"' : ''}>Parte ${j + 1} · ${cm(r.y1 - r.y0)} alto × ${cm(r.z1 - r.z0)} fondo</button>`; }).join('') : '';
  const r = i != null && rectParte((ps || [{}])[i] || {}, bc);
  const campo = (eje, nombre, v) => `<label class="ed-campo">${nombre}<span class="u" data-u="cm"><input type="number" step=".5" data-corte="${eje}" value="${cm(v)}"></span></label>`;
  return `<div class="ed-plantilla" style="margin-top:10px"><p class="sub">${ps ? `Costado en ${ps.length} parte${ps.length > 1 ? 's' : ''}` : 'Dividir el costado'}</p>
    ${ps ? `<div class="ed-botones">${lista}</div>` : ''}
    ${r ? `<p class="ed-ayuda">${ps ? `Parte ${i + 1}: ` : ''}de ${cm(r.y0)} a ${cm(r.y1)} cm de alto (desde abajo del mueble) y de ${cm(r.z0)} a ${cm(r.z1)} cm de fondo (desde atrás).</p>
    <div class="ed-campos">${campo('y', 'Corte horizontal a (alto)', (r.y0 + r.y1) / 2)}${campo('z', 'Corte vertical a (fondo)', (r.z0 + r.z1) / 2)}</div>
    <div class="ed-botones"><button data-a="cortar:y">Cortar horizontal</button><button data-a="cortar:z">Cortar vertical</button>${ps ? '<button data-a="borrar-parte" class="peligro">Borrar esta parte (Supr)</button>' : ''}</div>`
    : '<p class="ed-ayuda">Elige una parte (aquí o tocándola en 3D) para cortarla o borrarla.</p>'}
    <div class="ed-botones">${ps ? '<button data-a="unir-costado">Volver a una pieza</button>' : ''}<button data-a="quitar-pieza" class="peligro">Quitar el costado completo</button></div>
    <p class="ed-ayuda">Corta el costado y borra lo que no va (ej. la parte de abajo, donde se apoya en el mesón). Las medidas son desde abajo del mueble y desde atrás. Cada parte que queda se pide a Imperial como pieza aparte.</p></div>`;
}
function cortarCostado(eje) {
  const m = modulo(sel.m), s = { ...sel }; if (!m) return;
  const v = parseFloat($('#props [data-corte="' + eje + '"]')?.value);
  const ps = partesCostado(m, s.p) || [{ y0: null, y1: null, z0: null, z1: null }], i = s.parte ?? 0, q = ps[i];
  if (!q) return;
  const r = rectParte(q, bordesCostado(m)), a = r[`${eje}0`], b = r[`${eje}1`];
  if (!(isFinite(v) && v > a + 1 && v < b - 1)) { aviso(`El corte tiene que quedar dentro de la parte: entre ${cm(a + 1)} y ${cm(b - 1)} cm.`); return; }
  const n = Math.round(v * 10) / 10;
  cambiar(() => { m.partes = { ...(m.partes || {}), [s.p]: [...ps.slice(0, i), { ...q, [`${eje}1`]: n }, { ...q, [`${eje}0`]: n }, ...ps.slice(i + 1)] }; });
  sel = { ...s, parte: i }; render();
  aviso(eje === 'y' ? `Costado cortado a ${cm(n)} cm de alto: elige la parte que no va y bórrala (Supr).` : `Costado cortado a ${cm(n)} cm de fondo: elige la parte que no va y bórrala (Supr).`);
}
function borrarParte() {
  const m = modulo(sel.m), s = { ...sel }, ps = m && partesCostado(m, s.p); if (!ps || s.parte == null || !ps[s.parte]) return;
  cambiar(() => {
    const resto = ps.filter((_, j) => j !== s.parte);
    if (resto.length) m.partes = { ...m.partes, [s.p]: resto };
    else { delete m.partes[s.p]; m.quitar = [...new Set([...(m.quitar || []), s.p])]; } // sin partes = sin costado
    if (m.partes && !Object.keys(m.partes).length) delete m.partes;
  });
  sel = partesCostado(m, s.p) ? { tipo: 'pieza', m: m.id, p: s.p, parte: null } : { tipo: 'modulo', m: m.id };
  render(); aviso('Parte del costado borrada (Ctrl+Z la trae de vuelta).');
}
// Mueble seleccionado en 3D (dueño, 2026-11-25), como en el portal: los demás quedan semitransparentes (se siguen
// pudiendo tocar) y, con el mueble ya seleccionado, un clic en una puerta o un cajón lo abre o lo cierra para llegar a
// las repisas y divisiones de adentro. El esquinero se abre en su vista 3/4 por dentro.
let abiertosEd = { id: null, claves: [], activo: false };
function focoEditor() {
  if (vista !== '3d' || v34 || !sel?.m || sel.tipo === 'multi' || sel.tipo === 'artefacto') return null;
  const m = modulo(sel.m); return m && !m.artefacto ? m.id : null;
}
const gruposAbre = (pref) => [...st.rig.querySelectorAll('[data-esq-anim]')].filter((g) => pref === '*' ? g.dataset.esqAnim !== 'giro' : g.dataset.esqAnim === pref || g.dataset.esqAnim.startsWith(pref + '|'));
const abiertoEd = (key) => abiertosEd.claves.some((k) => k === '*' || k === key || key.startsWith(k + '|'));
function abrirEd(key) { // dibuja las puertas como hojas que giran (cerradas) y las abre con su animación
  abiertosEd.activo = true; render();
  abiertosEd.claves = key === '*' ? ['*'] : [...abiertosEd.claves, key];
  requestAnimationFrame(() => requestAnimationFrame(() => gruposAbre(key).forEach((g) => { g.style.transform = g.dataset.abierto; })));
}
function cerrarEd(key) {
  if (key === '*') abiertosEd.claves = [];
  else if (abiertosEd.claves.includes('*')) { // estaba todo abierto: quedan abiertas las demás
    const todas = [...new Set(gruposAbre('*').map((g) => g.dataset.esqAnim))];
    abiertosEd.claves = todas.filter((k) => !(k === key || k.startsWith(key + '|')));
  } else abiertosEd.claves = abiertosEd.claves.filter((k) => !(k === key || k.startsWith(key + '|')));
  const gs = gruposAbre(key); gs.forEach((g) => { g.style.transform = g.dataset.cerrado; });
  props(); clearTimeout(cerrarEd.t);
  cerrarEd.t = setTimeout(() => { abiertosEd.activo = abiertosEd.claves.length > 0; render(); }, gs.length ? 900 : 0);
}
function alternarFrenteEd(s) {
  const key = `${s.m}|f|${s.col}|${s.fila}`;
  if (abiertoEd(key)) cerrarEd(key); else abrirEd(key);
}
function bloqueAbrir(m) {
  if (vista !== '3d' || v34 || m.tipo === 'esquinero') return '';
  return `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Puertas y cajones</p>
    <div class="ed-botones"><button data-a="abrir-todo">Abrir todo</button><button data-a="cerrar-todo">Cerrar todo</button></div>
    <p class="ed-ayuda">Con el mueble seleccionado, toca una puerta o un cajón para abrirlo o cerrarlo, como en el portal del cliente: así llegas a las repisas y divisiones de adentro.</p></div>`;
}

// Ver solo este mueble, desde sus 4 lados (dueño, 2026-11-25)
function bloqueAislar(m) {
  if (vista !== '3d' || v34) return '';
  if (aislado !== m.id) return `<div class="ed-plantilla" style="margin-top:12px"><div class="ed-botones"><button data-a="aislar">Ver solo este mueble</button></div>
    <p class="ed-ayuda">Oculta lo demás para trabajar este mueble y verlo de frente, atrás y de cada lado.</p></div>`;
  return `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Solo este mueble · verlo desde</p>
    <div class="ed-botones"><button data-a="lado:frente">Frente</button><button data-a="lado:atras">Atrás</button><button data-a="lado:izq">Izquierda</button><button data-a="lado:der">Derecha</button></div>
    <div class="ed-botones"><button data-a="aislar-salir">Volver al proyecto (Esc)</button></div></div>`;
}
function verLado(m, lado) { // gira la cámara para mirar esa cara del mueble (por el camino corto)
  const r = +m.rotacion || 0, obj = { frente: -r, atras: 180 - r, izq: 90 - r, der: -90 - r }[lado];
  const [, ry] = st.angles, d = ((((obj - ry) % 360) + 540) % 360) - 180;
  st.view(-12, ry + d);
}
function salirAislado() { aislado = null; render(); encuadrar(true); }

// Panel del módulo esquinero: solución de esquina, medidas de cada lado y cajones
function panelEsquinero(m) {
  const g = geoEsquinero(m), S = SOLUCIONES[g.sol], sug = medidasSugeridas(m);
  const bot = (k, n) => `<button data-a="esq-sol:${k}"${g.sol === k ? ' class="ed-primario"' : ''}>${n}</button>`;
  return `<div class="ed-props"><p class="tit">${esc(m.nombre)}</p><p class="sub">${g.aereo ? 'Esquinero aéreo' : 'Módulo esquinero'} · ${S ? esc(S.nombre) : 'sin solución elegida'}</p>
    <p class="sub" style="margin-top:10px">Solución de esquina</p>
    <div class="ed-botones">${(g.aereo ? ORDEN_AEREO : ORDEN_SOLUCIONES).map((k) => bot(k, `${k} · ${SOLUCIONES[k].nombre}`)).join('')}${bot('', 'Sin elegir')}</div>
    ${g.aereo ? '<p class="ed-ayuda">Aéreo: lleva base y techo (en L, calado en el taller), sin zócalo ni cubierta, 3 soportes de 10 cm (adelante arriba en melamina; atrás arriba y abajo en pino, para anclar al muro) y puertas 1 cm bajo el alto total. Solo 2a o 2b.</p>' : ''}
    <p class="ed-ayuda">${S ? esc(S.ayuda) : 'Mientras no se elija, se ve un «?» rojo en el rincón y el cliente ve «precio por confirmar».'}</p>
    <div class="ed-campos">
      <label class="ed-campo ancho2">Nombre<input type="text" data-k="nombre" value="${esc(m.nombre)}"></label>
      ${num('ancho', 'Largo lado 1 (muro de atrás)', m.ancho)}${num('profundidad', 'Largo lado 2 (muro del costado)', m.profundidad)}
      ${num('fondo_a', 'Fondo del lado 1', g.fa)}${num('fondo_b', 'Fondo del lado 2', g.fb)}
      ${num('alto', 'Alto', m.alto)}${g.aereo ? num('elevacion', 'Altura desde el piso', m.elevacion) : num('zocalo', 'Zócalo', m.zocalo)}
      ${opciones('esquina', 'Rincón del muro', m.esquina === 'izq' ? 'izq' : 'der', { der: 'A la derecha', izq: 'A la izquierda' }, 'ancho2')}
      ${(() => { const he = hojasEditables(m, g); if (!he) return ''; if (he.cuadrado) return num('esq_hoja_a', 'Hoja de la puerta en L', cm(Math.max(he.a, he.b)).replace(',', '.')); const t = g.sol === '3' ? 'Puerta lateral' : 'Hoja'; return num('esq_hoja_a', `${t} del lado 1`, cm(he.a).replace(',', '.')) + num('esq_hoja_b', `${t} del lado 2`, cm(he.b).replace(',', '.')); })()}
      ${g.sol === '1' ? num('soporte_alto', 'Alto de la barra delantera', g.sop) : ''}
      ${g.sol === '2a' ? `<div class="ed-repisas ancho2"><span>Repisas en L</span><button data-a="esq-rep-" title="Quitar una repisa">−</button><b>${repisasL(m)}</b><button data-a="esq-rep+" title="Agregar una repisa">+</button></div>` : ''}
      ${S?.niveles ? opciones('niveles', 'Cajones por lado', String(g.niveles), { 2: '2 cajones', 3: '3 cajones' }, 'ancho2') : ''}
      ${S?.frenteCajon ? num('frente_cajon', 'Frente del cajón (por lado)', g.ld) : ''}
      ${num('x', 'Posición X', m.x, { min: -9999 })}${num('z', 'Posición Z (fondo)', m.z, { min: -9999 })}
      ${num('rotacion', 'Giro en planta', m.rotacion, { u: '°', step: 90, min: -360 })}
    </div>
    ${g.aereo ? '' : `<label class="ed-check"><input type="checkbox" data-k="cubierta"${m.cubierta ? ' checked' : ''}> Lleva cubierta (en L)</label>`}
    ${g.sol ? (v34?.id === m.id
      ? `<div class="ed-plantilla" style="margin-top:12px"><p class="sub">Vista 3/4 · abrir y cerrar</p><div class="ed-botones">${partesInterior(m, g).map((p) => `<button data-a="esq34:${p.key}"${v34.abiertos.includes(p.key) ? ' class="ed-primario"' : ''}>${esc(p.nombre)}</button>`).join('')}</div>
        <div class="ed-botones"><button data-a="esq34-salir">Salir de la vista 3/4</button></div><p class="ed-ayuda">También con un clic sobre el cajón o la puerta. La vista queda fija; Esc sale.</p></div>`
      : '<div class="ed-botones"><button data-a="esq34-entrar" class="ed-primario">Ver por dentro (vista 3/4)</button></div>') : ''}
    <div class="ed-botones"><button data-a="esq-sugerido">Medidas sugeridas (${sug.ancho} × ${sug.profundidad})</button><button data-a="girar-" title="Girar 90° a la izquierda (R)">⟲ 90°</button><button data-a="girar+" title="Girar 90° a la derecha">⟳ 90°</button><button data-a="borrar-modulo" class="peligro">Eliminar</button></div>
    ${S && !['1', '3'].includes(g.sol) || g.sol === '1' ? `<p class="ed-ayuda">Línea de aire en el rincón entre las dos hojas: ${cm(luzRincon(g) * 10)} mm (mínimo 3 mm; crece si el ancho de la hoja no la deja girar).</p>` : ''}
    ${g.sol === '1' ? '<p class="ed-ayuda">La puerta pasa bajo la barra delantera (7 cm por defecto) y sobre la base, con 3 mm de aire arriba, abajo y a los lados: si cambias la barra, la puerta se ajusta sola.</p>' : ''}
    ${g.sol === '1' ? (() => { const b = bandejaGiratoria(g); return `<p class="ed-ayuda">Bandejas: Ø ${cm(2 * b.r)} cm, centradas (se piden cuadradas de ${cm(2 * b.r)} × ${cm(2 * b.r)}).${Math.abs(+m.ancho - +m.profundidad) > .5 ? ' Ojo: la puerta giratoria va en un módulo cuadrado; cambia la hoja para igualar los lados.' : ''}</p>`; })() : ''}
    ${g.sol === '3' ? (() => { const k = cajonSpaceCorner(g), c = CORREDERAS_LARGOS.filter((l) => l <= Math.min(k.latA, k.latB)).pop(); return `<p class="ed-ayuda">Cajón en diagonal: caja de ${cm(Math.min(k.latA, k.latB))} cm de largo, pasillo de ${cm(k.pasillo)} cm. Corredera: ${c ? `${c} cm` : 'ninguna cabe'}${c && Math.min(k.latA, k.latB) - c > 10 ? ' (la caja es bastante más larga: si quieres, busca una corredera más larga en Imperial)' : ''}.</p>`; })() : ''}
    ${(() => { const he = hojasEditables(m, g); if (!he) return ''; const fuera = [he.a, he.b].some((w) => w < he.rango[0] - .15 || w > he.rango[1] + .15); return `<p class="ed-ayuda${fuera ? ' ed-error' : ''}">${g.sol === '3' ? 'Puertas laterales' : 'Hojas'}: de ${he.rango[0]} a ${he.rango[1]} cm cada una${fuera ? ' · alguna está fuera de ese rango' : ''}. Al cambiar una, el lado se alarga o se acorta y el rincón queda en su lugar.</p>`; })()}
    <p class="ed-ayuda">Lado 1 = el que va junto al muro de atrás; lado 2 = el que sale hacia adelante junto al muro del costado. El fondo de cada lado es el del cuerpo, como la profundidad de un basal. Al cambiar un largo, el rincón queda en su lugar.</p>
    <p class="ed-ayuda">Todavía no cambia a los muebles vecinos: eso se define al fusionarlos en un mueble en L.</p></div>`;
}
// Al agrupar 1 esquinero con basales (dueño, 2026-11-24): cada basal se pega al lateral del esquinero que le toca, a
// 0 cm, con la espalda en su muro. El que mira hacia el mismo lado que el esquinero va junto al lado 1; el que está
// girado 90°, junto al lado 2. Devuelve cuántos movió.
function pegarAlEsquinero(mods) {
  const esq = mods.filter((m) => m.tipo === 'esquinero'); if (esq.length !== 1) return 0;
  const e = esq[0], r = +e.rotacion || 0, W = +e.ancho, L = +e.profundidad, izq = e.esquina === 'izq';
  const mundo = (lx, lz) => { const [dx, dz] = girar(lx, lz, r); return [r1(+e.x + dx), r1(+e.z + dz)]; };
  let n = 0;
  delete e.vecino_a; delete e.vecino_b;
  for (const b of mods) {
    if (b === e || b.artefacto || b.tipo === 'esquinero' || (b.tipo === 'aereo') !== !!e.aereo) continue; // esquinero aéreo con aéreos; basal con basales
    if (e.aereo) b.elevacion = +e.elevacion || 0;
    const dr = ((((+b.rotacion || 0) - r) % 360) + 360) % 360, Wb = +b.ancho;
    if (Math.abs(dr) < 1 || Math.abs(dr - 360) < 1) { // lado 1: junto al muro de atrás
      [b.x, b.z] = mundo(izq ? W : -Wb, 0); e.vecino_a = true; n++;
    } else if (Math.abs(dr - 90) < 1 || Math.abs(dr - 270) < 1) { // lado 2: junto al muro del costado, mirando hacia adentro
      b.rotacion = (r + (izq ? 90 : 270)) % 360;
      [b.x, b.z] = izq ? mundo(0, L + Wb) : mundo(W, L); e.vecino_b = true; n++;
    }
  }
  return n;
}
// Esquinero agrupado: al cambiar sus medidas, los basales del grupo lo siguen (quedan pegados a 0 cm)
function repegar(m) { if (m.grupo) pegarAlEsquinero(modelo.modulos.filter((x) => x.grupo === m.grupo)); }
// ----- vista fija 3/4 del interior de un esquinero (dueño, 2026-11-22/25): la cámara mira el rincón desde la
// habitación en diagonal y no se puede girar; clic en un cajón o puerta lo abre o lo cierra (o el botón del panel).
function entrar34(m) {
  if (vista !== '3d') setVista('3d');
  v34 = { id: m.id, abiertos: geoEsquinero(m).sol === '1' ? ['auto'] : [] }; // la puerta giratoria parte girando sola
  sel = { tipo: 'modulo', m: m.id };
  const r = +m.rotacion || 0;
  st.lock(true); st.set(-30, (m.esquina === 'izq' ? -45 : 45) - r);
  render(); encuadrar(true); giroAuto();
  aviso('Vista 3/4: haz clic en un cajón o una puerta para abrirlo o cerrarlo (también con los botones del panel). Esc sale.');
}
function salir34(redibujar = true) {
  if (!v34) return;
  v34 = null; st.lock(vista !== '3d');
  if (redibujar) { render(); encuadrar(true); }
}
// Puerta giratoria «girar sola» (dueño, 2026-11-25): la puerta en L y sus 2 bandejas giran en círculo sin parar.
// Son 14 caras (2 bandejas de 1 cara + 2 hojas de 6) y solo cambia el transform del grupo: lo anima el navegador
// sin volver a dibujar ni a pintar, así que casi no pesa.
function giroAuto() {
  const g = st.rig.querySelector('[data-esq-anim="giro"]'); if (!g) return;
  g.getAnimations().forEach((a) => a.cancel());
  if (!v34?.abiertos.includes('auto')) return;
  const paso = (deg) => ({ transform: g.dataset.cerrado.replace(/rotateY\([^)]*\)/, `rotateY(${deg}deg)`) });
  g.animate([paso(0), paso(360)], { duration: 14000, iterations: Infinity, easing: 'linear' });
}
// Clic en una hoja de la puerta giratoria (dueño, 2026-11-25): da una vuelta completa hacia el lado de la otra hoja
// (la de la derecha gira hacia la izquierda y al revés) y se detiene al volver a quedar cerrada.
function vuelta34(hoja) {
  const g = st.rig.querySelector('[data-esq-anim="giro"]'); if (!g || !v34) return;
  v34.abiertos = v34.abiertos.filter((k) => k !== 'auto' && k !== 'giro');
  g.getAnimations().forEach((a) => a.cancel()); g.style.transform = g.dataset.cerrado;
  const izq = modulo(v34.id)?.esquina === 'izq', s = (hoja === 'B' ? -1 : 1) * (izq ? -1 : 1);
  const paso = (deg) => ({ transform: g.dataset.cerrado.replace(/rotateY\([^)]*\)/, `rotateY(${deg}deg)`) });
  g.animate([paso(0), paso(360 * s)], { duration: 7000, iterations: 1, easing: 'ease-in-out' });
  props();
}
function alternar34(key) {
  if (!v34) return;
  if (key === 'vueltaA' || key === 'vueltaB') { vuelta34(key.slice(-1)); return; }
  if (key === 'auto' || (key === 'giro' && !alternar34.boton)) { // girar sola: prende o apaga (también con clic en la puerta)
    v34.abiertos = v34.abiertos.includes('auto') ? v34.abiertos.filter((k) => k !== 'auto') : [...v34.abiertos.filter((k) => k !== 'giro'), 'auto'];
    const g = st.rig.querySelector('[data-esq-anim="giro"]'); if (g) g.style.transform = g.dataset.cerrado;
    giroAuto(); props(); return;
  }
  if (key === 'giro') { v34.abiertos = v34.abiertos.filter((k) => k !== 'auto'); giroAuto(); }
  const abierto = !v34.abiertos.includes(key);
  v34.abiertos = abierto ? [...v34.abiertos, key] : v34.abiertos.filter((k) => k !== key);
  for (const g of st.rig.querySelectorAll(`[data-esq-anim="${key}"]`)) g.style.transform = abierto ? g.dataset.abierto : g.dataset.cerrado;
  props();
}
// Cambia el largo del lado 1 de un esquinero sin mover el rincón (con el rincón a la derecha, el origen se corre)
function anchoEsquinero(m, v) {
  if (m.esquina !== 'izq') { const [ux, uz] = girar(1, 0, +m.rotacion || 0), d = v - +m.ancho; m.x = r1(+m.x - d * ux); m.z = r1(+m.z - d * uz); }
  m.ancho = v;
}
// Agrega un esquinero en el primer rincón libre del espacio (dos muros en escuadra que se tocan)
function agregarEsquinero(aereo = false) {
  const ws = murosDe(modelo.espacio).filter((w) => !w.oculto), cerca = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 3;
  const ocupado = (p) => modelo.modulos.some((x) => x.tipo === 'esquinero' && !!x.aereo === aereo && huella(x).some((q) => cerca(q, p)));
  // esquinero aéreo (dueño, 2026-11-25): a la altura de los aéreos que ya hay (o 151,8 cm: 88 + 3,8 de cubierta + 60)
  const otroAereo = modelo.modulos.find((x) => x.tipo === 'aereo');
  const m = nuevoEsquinero(uid(), aereo ? { aereo: true, elevacion: otroAereo ? +otroAereo.elevacion : 151.8, alto: otroAereo ? +otroAereo.alto : 70 } : {});
  let ok = false;
  for (const A of ws) {
    const E = ejeMuro(A), fin = [E.O[0] + A.largo * E.u[0], E.O[1] + A.largo * E.u[1]];
    for (const B of ws) {
      if (B === A || Math.abs(A.n[0] * B.n[0] + A.n[1] * B.n[1]) > .05) continue; // en escuadra
      const toca = (p) => cerca(B.a, p) || cerca(B.b, p), hacia = B.n[0] * E.u[0] + B.n[1] * E.u[1];
      if (toca(fin) && hacia < -.9 && !ocupado(fin)) { m.esquina = 'der'; m.x = r1(fin[0] - m.ancho * E.u[0]); m.z = r1(fin[1] - m.ancho * E.u[1]); m.rotacion = E.rot; ok = true; break; }
      if (toca(E.O) && hacia > .9 && !ocupado(E.O)) { m.esquina = 'izq'; m.x = r1(E.O[0]); m.z = r1(E.O[1]); m.rotacion = E.rot; ok = true; break; }
    }
    if (ok) break;
  }
  if (!ok) m.x = modelo.modulos.reduce((a, x) => Math.max(a, +x.x + +x.ancho), 0);
  cambiar((d) => d.modulos.push(m));
  sel = { tipo: 'modulo', m: m.id };
  if (vista === 'frente') setVista('planta');
  render(); encuadrar(true);
  if (aereo) { aviso(ok ? 'Esquinero aéreo agregado en un rincón, a la altura de los aéreos. Elige 2a o 2b en el panel derecho.' : 'No encontré un rincón libre entre dos muros: muévelo a la esquina en Planta. Elige 2a o 2b en el panel derecho.'); return; }
  aviso(ok ? 'Esquinero agregado en un rincón. Elige su solución en el panel derecho y ajusta el largo y el fondo de cada lado.' : 'No encontré un rincón libre entre dos muros: muévelo a la esquina en Planta. Elige su solución en el panel derecho.');
}

// Cambios desde los campos
// Aplica una medida o propiedad a un módulo. s indica la pieza (col, fila, t) cuando corresponde.
// Lo usan el panel derecho y la edición directa en las cotas.
function aplicarCampo(m, k, v, s = {}) {
  if (k.startsWith('f.') || k.startsWith('c.')) {
    const col = m.columnas[s.col], fr = col.frentes;
    if (k === 'f.tipo') { fr[s.fila].tipo = v; if (v === 'abierto') m.tiradores = m.tiradores.filter((t) => !(t.col === s.col && t.fila === s.fila)); }
    if (k === 'f.bisagra') { // el tirador se pasa al canto que abre (el contrario a las bisagras)
      fr[s.fila].bisagra = v;
      for (const t of m.tiradores || []) if (t.col === s.col && t.fila === s.fila && ((v === 'izquierda' && +t.dx < 0) || (v === 'derecha' && +t.dx > 0))) t.dx = -t.dx;
    }
    if (k === 'f.montaje') { if (v === 'dentro') fr[s.fila].montaje = 'dentro'; else delete fr[s.fila].montaje; }
    if (k === 'f.alto') { // el vecino de abajo (o de arriba si es el último) absorbe la diferencia
      const j = s.fila < fr.length - 1 ? s.fila + 1 : s.fila - 1;
      if (j < 0) return aviso('Este frente ocupa todo el alto: cambia el alto del módulo.');
      const d = v - +fr[s.fila].alto;
      if (+fr[j].alto - d < 5 || v < 5) return aviso('No cabe: el frente vecino quedaría con menos de 5 cm.');
      fr[s.fila].alto = v; fr[j].alto = +fr[j].alto - d;
    }
    if (k === 'c.ancho') { // la columna vecina absorbe la diferencia
      medidaManual(m); // medida a mano: el mueble ya no iguala sus puertas solo
      const cols = m.columnas, j = s.col < cols.length - 1 ? s.col + 1 : s.col - 1;
      if (j < 0) return aviso('Esta columna ocupa todo el ancho: cambia el ancho del módulo.');
      const d = v - +col.ancho;
      if (+cols[j].ancho - d < 5 || v < 5) return aviso('No cabe: la columna vecina quedaría con menos de 5 cm.');
      col.ancho = v; cols[j].ancho = +cols[j].ancho - d;
    }
  } else if (k.startsWith('t.')) {
    const t = m.tiradores.find((x) => x.id === s.t);
    if (k === 't.modelo' && String(v).startsWith('cat|')) { // tirador del catálogo: modelo a escala, su color y su nombre
      const c = catalogoTir[+String(v).slice(4)];
      if (c) { t.modelo = modeloCatalogo(c); t.color = c.color || t.color; t.nombre = c.nombre; }
    } else { t[k.slice(2)] = v; if (k === 't.modelo') delete t.nombre; }
  } else if ((k === 'esq_hoja_a' || k === 'esq_hoja_b') && m.tipo === 'esquinero') { // ancho de una hoja: cambia el largo de ese lado
    const he = hojasEditables(m); if (!he) return;
    if (v < he.rango[0] || v > he.rango[1]) return aviso(`Cada ${geoEsquinero(m).sol === '3' ? 'puerta lateral' : 'hoja'} va de ${he.rango[0]} a ${he.rango[1]} cm.`);
    if (he.cuadrado) { anchoEsquinero(m, r1(he.anchoPara(v))); m.profundidad = r1(he.profundidadPara(v)); } // puerta giratoria: cuadrado
    else if (k === 'esq_hoja_a') anchoEsquinero(m, r1(he.anchoPara(v))); else m.profundidad = r1(he.profundidadPara(v));
    repegar(m);
  } else if (k === 'ancho' && m.tipo === 'esquinero') {
    if (v < 30) return aviso('Largo mínimo del lado: 30 cm.');
    anchoEsquinero(m, v); repegar(m);
  } else if (k === 'ancho') {
    if (v < 10) return aviso('Ancho mínimo: 10 cm.');
    const k2 = v / (+m.ancho || 1); m.columnas.forEach((c) => { c.ancho = +c.ancho * k2; }); m.ancho = v;
  } else if (k === 'alto') {
    if (v < Zde(m) + 10) return aviso('El alto tiene que superar el zócalo en al menos 10 cm.');
    m.alto = v; // normalizar() reparte los frentes en el nuevo alto
  } else if (k === 'zocalo') {
    if (v < 0 || v > +m.alto - 10) return aviso('El zócalo tiene que dejar al menos 10 cm de cuerpo.');
    m.zocalo = v;
  } else if (m.tipo === 'esquinero' && ['profundidad', 'esquina', 'elevacion'].includes(k)) { // el aéreo sube o baja con sus aéreos del grupo
    m[k] = v; repegar(m);
  } else if (k === 'rotacion') {
    rotarEnCentro(m, v); // gira alrededor del centro del mueble
  } else if (k === 'artefacto') {
    const d = ARTEFACTOS[v]; if (!d) return;
    m.artefacto = v; m.nombre = d.nombre; m.ancho = d.ancho; m.alto = d.alto; m.profundidad = d.fondo;
  } else if (k === 'grupo_nombre') {
    for (const x of modelo.modulos) if (x.grupo && x.grupo === m.grupo) x.grupo_nombre = String(v).slice(0, 60);
  } else if (k === 'costados') {
    if (v) m.costados = v; else delete m.costados;
  } else if (k === 'sin_soporte') { // quitar o volver a poner el soporte delantero
    const q = (m.quitar || []).filter((p) => p !== 'soporte');
    m.quitar = v === 'si' ? [...q, 'soporte'] : q;
    if (!m.quitar.length) delete m.quitar;
  } else if (k === 'techo') { // techo de melamina forzado: 'si' | 'no' (vacío = automático según el tipo)
    if (v === 'si' || v === 'no') m.techo = v; else delete m.techo;
    if (v === 'si' && Array.isArray(m.quitar)) m.quitar = m.quitar.filter((p) => p !== 'techo');
  } else if (k.startsWith('mat|')) { // material de una pieza del mueble (techo, soporte…) desde el panel
    const p = k.slice(4); m.materiales = { ...(m.materiales || {}) };
    if (v) m.materiales[p] = v; else delete m.materiales[p];
  } else if (k === 'puertas_auto') { // volver a igualar las puertas solas (o dejarlas a mano)
    if (v) delete m.puertas_manual; else m.puertas_manual = true;
  } else if (k === 'tablero') {
    m.tablero = +v === 18 ? 18 : 15;
  } else if (k === 'costado_grosor') { // isla: grosor del costado doble, entre el tablero (costado simple) y 15 cm
    m.costado_grosor = Math.max(+m.tablero / 10 || 1.5, Math.min(15, +v || 5));
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
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? e.target.value : parseFloat(e.target.value);
    if (e.target.type === 'number' && !(isFinite(v) && (v > 0 || (CERO_OK.includes(pk) && v >= 0)))) return;
    const p = { ...pl.p, [pk]: v };
    regenerarPlantilla(pl.g, pl.t, p);
    return;
  }
  const inp = e.target.closest('[data-k]'); if (!inp || !sel) return;
  const k = inp.dataset.k;
  const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value;
  const s = { ...sel };
  if (s.tipo === 'objeto') {
    cambiarObjeto((o) => {
      const c = k.slice(2);
      if (c === 'tipo' && OBJETOS[v]) { const d = OBJETOS[v]; Object.assign(o, { tipo: v, nombre: d.nombre, ancho: d.ancho, alto: d.alto, fondo: d.fondo }); return; }
      if (c === 'nombre') { o.nombre = String(v).slice(0, 60); return; }
      if (c.startsWith('links.')) { // links.<i>.<campo>
        const [, i, campo] = c.split('.'), l = o.links?.[+i]; if (!l) return;
        if (campo === 'precio') { if (+v > 0) l.precio = Math.round(+v); else delete l.precio; }
        else if (['nombre', 'tienda', 'url'].includes(campo)) l[campo] = String(v).trim().slice(0, campo === 'url' ? 500 : 80);
        return;
      }
      if (c === 'color') { if (v) o.color = v; else delete o.color; return; }
      if (['ancho', 'alto', 'fondo'].includes(c) && v > 0) o[c] = v;
      if (c === 'elevacion' && v >= 0) { if (o.tipo === 'colgante') o.cable = r1(Math.max(0, +o.cable + +o.elevacion - v)); o.elevacion = v; } // la colgante sube o baja con el cable
      if (c === 'cable' && v >= 0) o.cable = v;
      if (['x', 'z', 'rotacion'].includes(c)) o[c] = v;
    });
    return;
  }
  if (s.tipo === 'cubierta' && k === 'cubierta_respaldo') { cambiar(() => { modulo(s.m).cubierta_respaldo = !!v; }); return; }
  if (s.tipo === 'cubierta' && k.startsWith('v.')) {
    cambiar(() => { modulo(s.m)[`vuelo_${k.slice(2)}`] = Math.max(0, Math.min(150, +v || 0)); });
    return;
  }
  if (s.tipo === 'artefacto') {
    cambiarArtefacto((a, m, { W, Dc }) => {
      const v0 = artefactosDe(m).find((x) => x.id === a.id);
      if (k === 'a.tipo' && ARTEFACTOS[v]) { a.tipo = v; a.ancho = Math.min(ARTEFACTOS[v].ancho, W); a.fondo = Math.min(ARTEFACTOS[v].fondo, Dc - 2); if (ARTEFACTOS[v].cubas && !a.lado) a.lado = 'derecha'; }
      if (k === 'a.ancho' && v > 0) a.ancho = v;
      if (k === 'a.fondo' && v > 0) a.fondo = v;
      if (k === 'a.desde' && v >= 0) a.desde = v;
      if (k === 'a.hasta' && v >= 0) a.desde = W - v0.ancho - v;
      if (k === 'a.frente' && v >= 0) a.frente = v;
      if (k === 'a.atras' && v >= 0) a.frente = Dc - v0.fondo - v;
      if (k === 'a.lado') a.lado = v;
      if (k === 'a.montaje') a.montaje = v;
    });
    return;
  }
  if (s.tipo === 'vano') {
    cambiarVano((r, w, def) => {
      if (k === 'v.tipo' && VANOS[v]) { r.tipo = v; if (VANOS[v].puerta) r.antepecho = 0; else if (!(+r.antepecho > 0)) r.antepecho = VANOS[v].antepecho; }
      if (k === 'v.ancho' && v > 0) r.ancho = v;
      if (k === 'v.alto' && v > 0) r.alto = v;
      if (k === 'v.antepecho' && v >= 0) r.antepecho = v;
      if (k === 'v.desde' && v >= 0) r.desde = v;
      if (k === 'v.hasta' && v >= 0) r.desde = Math.max(0, w.largo - (+r.ancho || def.ancho) - v);
    });
    return;
  }
  if (s.tipo === 'muro') {
    cambiar((d) => {
      const e = d.espacio;
      if (k === 'w.etiqueta') metaMuro(e, s.i).etiqueta = String(v).slice(0, 80);
      if (k === 'w.espesor' && v > 0) metaMuro(e, s.i).espesor = v;
      if (k === 'w.alto' && v > 0) metaMuro(e, s.i).alto = v;
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
    if (b.dataset.a === 'borrar-cocina') { cambiar((d) => { d.modulos = d.modulos.filter((m) => !del(m)); d.objetos = (d.objetos || []).filter((o) => !del(o)); }); sel = null; render(); }
    else cambiar((d) => { d.modulos.forEach((m) => { if (del(m)) delete m.plantilla; }); (d.objetos || []).forEach((o) => { if (del(o)) delete o.plantilla; }); });
    return;
  }
  if (b.dataset.a.startsWith('art:')) { agregarArtefacto(b.dataset.a.slice(4)); return; }
  if (b.dataset.a.startsWith('apoyar:')) { const y = +b.dataset.a.slice(7); cambiarObjeto((o) => { o.elevacion = y; }); return; }
  if (b.dataset.a === 'obj-link-add') { cambiarObjeto((o) => { o.links = [...(o.links || []), { nombre: '', tienda: '', url: '' }].slice(0, 6); }); props(); return; }
  if (b.dataset.a.startsWith('obj-link-del:')) { const i = +b.dataset.a.slice(13); cambiarObjeto((o) => { o.links = (o.links || []).filter((_, j) => j !== i); if (!o.links.length) delete o.links; }); props(); return; }
  if (b.dataset.a === 'obj-girar') { cambiarObjeto((o) => { o.rotacion = ((+o.rotacion || 0) + 90) % 360; }); return; }
  if (b.dataset.a === 'obj-borrar') { borrarSel(); return; }
  if (b.dataset.a === 'obj-duplicar') { const o = objeto(sel.o), c = { ...o, id: uid('o'), x: r1(+o.x + +o.ancho + 2), ...(o.links ? { links: o.links.map((l) => ({ ...l })) } : {}) }; cambiar((d) => { d.objetos.push(c); }); sel = { tipo: 'objeto', o: c.id }; render(); return; }
  if (b.dataset.a.startsWith('ver-art:')) { sel = { tipo: 'artefacto', m: sel.m, a: b.dataset.a.slice(8) }; render(); return; }
  if (b.dataset.a === 'borrar-art') { borrarSel(); return; }
  if (b.dataset.a.startsWith('art-pos:')) { posicionEnL(b.dataset.a.slice(8)); return; }
  if (b.dataset.a === 'centrar-art') { cambiarArtefacto((a, m, { W }) => { a.desde = r1((W - Math.min(+a.ancho, W)) / 2); }); return; }
  if (b.dataset.a === 'borrar-div') { borrarSel(); return; }
  if (b.dataset.a.startsWith('div-tablero:')) { // poner o quitar el tablero de la división entre dos secciones
    const s = { ...sel }, m = modulo(s.m), fr = m?.columnas?.[s.col]?.frentes?.[s.fila]; if (!fr) return;
    const v = b.dataset.a.endsWith('1'), def = divisionesH({ ...m, columnas: m.columnas.map((c, i) => (i === s.col ? { ...c, frentes: c.frentes.map((f, j) => (j === s.fila ? { ...f, division: undefined } : f)) } : c)) }).some((d) => d.col === s.col && d.fila === s.fila);
    cambiar(() => { if (v === def) delete fr.division; else fr.division = v; });
    aviso(v ? 'División fija agregada: se suma a Materiales (justa, atornillada).' : 'Tablero de división quitado.'); return;
  }
  if (b.dataset.a === 'quitar-material' && sel.tipo === 'vano') { const v = { i: sel.i, v: sel.v }; cambiar((d) => { delete vanoRaw(d, v).material; }); return; }
  if (b.dataset.a === 'ver-materiales' && sel.tipo === 'vano') { $('.ed-tabs [data-tab="mat"]').click(); return; }
  if (b.dataset.a === 'borrar-vano' || b.dataset.a === 'centrar-vano') {
    const s = { ...sel };
    if (b.dataset.a === 'borrar-vano') { cambiar((d) => { const m = metaMuro(d.espacio, s.i); m.vanos = (m.vanos || []).filter((x) => x.id !== s.v); }); sel = null; render(); }
    else cambiarVano((r, w, def) => { r.desde = Math.round((w.largo - (+r.ancho || def.ancho)) / 2 * 10) / 10; });
    return;
  }
  if (b.dataset.a === 'ver-materiales' && (sel?.tipo === 'muro' || sel?.tipo === 'suelo')) { $('.ed-tabs [data-tab="mat"]').click(); return; }
  if (b.dataset.a?.startsWith('zona:')) { sel = { tipo: 'muro', i: sel.i, z: +b.dataset.a.slice(5) }; render(); return; }
  if (b.dataset.a?.startsWith('zona-cortar:')) { cortarZona(b.dataset.a.slice(12)); return; }
  if (b.dataset.a?.startsWith('zona-unir:')) { unirZona(b.dataset.a.slice(10)); return; }
  if (b.dataset.a === 'zonas-quitar') { const i = sel.i; cambiar((d) => { const mm = metaMuro(d.espacio, i), a = mm.zonas?.[sel.z ?? 0]?.acabado; delete mm.zonas; if (a) mm.acabado = a; }); sel = { tipo: 'muro', i }; render(); return; }
  if (b.dataset.a === 'ver-muro') { muroFrente = sel.i; sel = null; setVista('frente'); return; }
  if (b.dataset.a === 'agrupar') {
    const ids = sel.ids, gid = uid('g'), nombre = 'Mueble en L';
    let pegados = 0;
    cambiar((d) => {
      d.modulos.forEach((m) => { if (ids.includes(m.id)) { m.grupo = gid; m.grupo_nombre = nombre; } });
      pegados = pegarAlEsquinero(d.modulos.filter((m) => ids.includes(m.id)));
    });
    if (pegados) { sel = { tipo: 'modulo', m: ids[0] }; render(); aviso(`${ids.length} módulos agrupados como «${nombre}»: ${pegados === 1 ? 'el basal quedó pegado' : 'los basales quedaron pegados'} al esquinero (0 cm). Ctrl+Z deshace.`); return; }
    sel = { tipo: 'modulo', m: ids[0] }; render();
    aviso(`${ids.length} módulos agrupados como «${nombre}». Al moverlos o girarlos van juntos; cada parte se edita por separado.`);
    return;
  }
  if (b.dataset.a === 'sel-grupo') { seleccionarVarios(grupoDe(modulo(sel.m)).map((x) => x.id)); return; }
  if (b.dataset.a === 'desagrupar-mueble') { const g = modulo(sel.m).grupo; cambiar((d) => d.modulos.forEach((m) => { if (m.grupo === g) { delete m.grupo; delete m.grupo_nombre; delete m.vecino_a; delete m.vecino_b; } })); return; }
  if (b.dataset.a === 'unir') {
    const ids = sel.ids, r = unirModulos(ids.map(modulo));
    if (r.error) { $('#unir-aviso').innerHTML = esc(r.error) + (r.giro ? ' <button data-a="agrupar" class="ed-primario">Agrupar ahora</button>' : ''); $('#unir-aviso').classList.add('ed-error'); aviso(r.error); return; }
    cambiar((d) => {
      const i = Math.min(...ids.map((id) => d.modulos.findIndex((m) => m.id === id)));
      d.modulos = d.modulos.filter((m) => !ids.includes(m.id));
      d.modulos.splice(i, 0, r.modulo);
    });
    sel = { tipo: 'modulo', m: r.modulo.id }; render();
    aviso(`Unidos en «${r.modulo.nombre}» (${cm(r.modulo.ancho)} cm). ${r.aviso || ''} Ctrl+Z deshace.`);
    return;
  }
  if (b.dataset.a === 'borrar-multi') { const ids = sel.ids; cambiar((d) => { d.modulos = d.modulos.filter((m) => !ids.includes(m.id)); }); sel = null; render(); return; }
  if (b.dataset.a === 'eliminar-muro' || b.dataset.a === 'restaurar-muro') {
    const i = sel.i, oculto = b.dataset.a === 'eliminar-muro', n = murosContorno(modelo.espacio);
    if (oculto && i >= n) { cambiar((d) => { d.espacio.tramos.splice(i - n, 1); }); sel = null; render(); return; } // muro suelto: se borra (Ctrl+Z lo trae)
    cambiar((d) => { metaMuro(d.espacio, i).oculto = oculto; });
    return;
  }
  if (b.dataset.a === 'borrar-medida') { borrarSel(); return; }
  if (b.dataset.a === 'invertir-muro') { const i = sel.i; cambiar((d) => { const t = metaMuro(d.espacio, i); t.invertir = !t.invertir; }); return; }
  if (b.dataset.a === 'borrar-muros') {
    if (confirm('¿Borrar todos los muros del espacio?')) { cambiar((d) => { d.espacio = { ...(d.espacio || {}), puntos: [], muros: [], tramos: [], cerrado: false }; }); sel = null; render(); }
    return;
  }
  if (b.dataset.a === 'girar-' || b.dataset.a === 'girar+') { girarConAviso(modulo(sel.m), b.dataset.a === 'girar-' ? 90 : -90); return; }
  const m = modulo(sel.m), a = b.dataset.a;
  if (a === 'duplicar') {
    const c = JSON.parse(JSON.stringify(m)); c.id = uid(); c.x = +m.x + +m.ancho; c.nombre = m.nombre + ' (copia)';
    c.tiradores.forEach((t) => { t.id = uid('t'); });
    cambiar((d) => d.modulos.push(c)); sel = { tipo: 'modulo', m: c.id }; render(); return;
  }
  if (a.startsWith('esq-sol:')) { // elegir la solución; si las medidas eran las sugeridas, pasan a las de la nueva
    const k = a.slice(8);
    cambiar(() => { const s0 = medidasSugeridas(m); m.solucion = k; if (+m.ancho === s0.ancho && +m.profundidad === s0.profundidad) { const s1 = medidasSugeridas(m); anchoEsquinero(m, s1.ancho); m.profundidad = s1.profundidad; repegar(m); } });
    aviso(k ? `«${m.nombre}»: ${SOLUCIONES[k].nombre}.` : `«${m.nombre}» queda sin solución (se ve el «?» rojo).`);
    return;
  }
  if (a === 'esq-rep-' || a === 'esq-rep+') { cambiar(() => { m.repisas_l = Math.max(0, Math.min(4, repisasL(m) + (a === 'esq-rep+' ? 1 : -1))); }); return; } // repisas en L del 2a (se reparten parejo)
  if (a === 'esq34-entrar') { entrar34(m); return; }
  if (a === 'esq34-salir') { salir34(); props(); return; }
  if (a.startsWith('esq34:')) { alternar34.boton = true; alternar34(a.slice(6)); alternar34.boton = false; return; }
  if (a === 'esq-sugerido') { const s1 = medidasSugeridas(m); cambiar(() => { anchoEsquinero(m, s1.ancho); m.profundidad = s1.profundidad; repegar(m); }); return; }
  if (a === 'borrar-modulo') { cambiar((d) => { d.modulos = d.modulos.filter((x) => x.id !== m.id); }); sel = null; render(); return; }
  if (a === 'div-h') { const c = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila); cambiar(() => dividirH(m, sel.col, sel.fila, c.y)); return; }
  if (a === 'div-v') { const c = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila); cambiar(() => dividirV(m, sel.col, c.x)); return; }
  if (a === 'unir-abajo') { cambiar(() => unirAbajo(m, sel.col, sel.fila)); return; }
  if (a === 'unir-der') { cambiar(() => unirDerecha(m, sel.col)); return; }
  if (/^rep[+-]/.test(a)) { // 'rep+' / 'rep-' en la sección elegida, o 'rep+@col@fila' desde el panel del mueble
    const [, signo, cc, ff] = /^rep([+-])(?:@(\d+)@(\d+))?$/.exec(a) || [];
    if (!signo) return;
    const col = cc != null ? +cc : sel.col, fila = ff != null ? +ff : sel.fila;
    if (!m.columnas?.[col]?.frentes?.[fila]) return;
    const n = celdas(m).find((k) => k.col === col && k.fila === fila)?.repisas || 0;
    cambiar(() => { m.columnas[col].frentes[fila].repisas = Math.max(0, Math.min(12, n + (signo === '+' ? 1 : -1))); });
    if (signo === '+' && !capas.repisas && m.columnas[col].frentes[fila].tipo !== 'abierto') aviso('Repisa agregada detrás de la puerta. Activa Capas → Repisas para verla punteada.');
    return;
  }
  if (a === 'quitar-soporte') { cambiar(() => { m.quitar = [...new Set([...(m.quitar || []), 'soporte'])]; }); sel = { tipo: 'modulo', m: m.id }; render(); aviso(`Se quitó el soporte delantero de «${m.nombre}». Se restaura desde el panel del mueble o con Ctrl+Z.`); return; }
  if (a === 'quitar-pieza') { sel = { tipo: 'pieza', m: m.id, p: sel.p }; borrarSel(); return; }
  if (a === 'quitar-repisa') { borrarSel(); return; }
  if (a.startsWith('rep-tipo:')) { // repisa fija o móvil (dueño, 2026-11-25)
    const s = { ...sel }, fr = m.columnas?.[s.col]?.frentes?.[s.fila]; if (!fr) return;
    cambiar(() => { fr.repisas_tipo = { ...(fr.repisas_tipo || {}), [s.i]: a.slice(9) }; });
    sel = s; render(); return;
  }
  if (a.startsWith('parte:')) { sel = { ...sel, parte: +a.slice(6) }; render(); return; }
  if (a.startsWith('cortar:')) { cortarCostado(a.slice(7)); return; }
  if (a === 'borrar-parte') { borrarParte(); return; }
  if (a === 'unir-costado') { const p = sel.p; cambiar(() => { delete m.partes[p]; if (!Object.keys(m.partes).length) delete m.partes; }); sel = { tipo: 'pieza', m: m.id, p }; render(); return; }
  if (a === 'aislar') { aislado = m.id; render(); encuadrar(true); verLado(m, 'frente'); aviso(`Solo «${m.nombre}»: míralo desde sus 4 lados con los botones del panel. Esc vuelve al proyecto.`); return; }
  if (a === 'aislar-salir') { salirAislado(); return; }
  if (a === 'abrir-todo') { abrirEd('*'); return; }
  if (a === 'cerrar-todo') { cerrarEd('*'); return; }
  if (a.startsWith('lado:')) { verLado(m, a.slice(5)); return; }
  if (a.startsWith('tono:')) { tonoLuz = a.slice(5); props(); return; }
  const nuevaLuz = (o) => ({ id: uid('l'), tono: tonoLuz, intensidad: .8, lado: 'arriba', ...o });
  if (a.startsWith('luz+:')) { cambiar(() => { m.luces = [...(m.luces || []), nuevaLuz({ en: 'modulo', lado: a.slice(5) })]; }); return; }
  if (a === 'luz+rep') { // bajo esta repisa: ilumina el espacio que queda debajo
    const en = `f|${sel.col}|${sel.fila}`, i = sel.i;
    if ((m.luces || []).some((L) => L.en === en && +L.esp === i)) { aviso('Esta repisa ya tiene luz.'); return; }
    cambiar(() => { m.luces = [...(m.luces || []), nuevaLuz({ en, esp: i })]; }); return;
  }
  if (a === 'luz+esp') { // una luz en cada espacio de la sección (bajo cada repisa y bajo el techo de la sección)
    const en = `f|${sel.col}|${sel.fila}`, n = celdas(m).find((x) => x.col === sel.col && x.fila === sel.fila)?.repisas || 0;
    cambiar(() => { m.luces = [...(m.luces || []).filter((L) => L.en !== en), ...Array.from({ length: n + 1 }, (_, e) => nuevaLuz({ en, esp: e }))]; });
    aviso(`${n + 1} luces: una en cada espacio de la sección.`); return;
  }
  if (a === 'luz+cub') { const lado = ladoVuelo(m); cambiar(() => { m.luces = [...(m.luces || []).filter((L) => !(L.en === 'cubierta' && L.lado === lado)), nuevaLuz({ en: 'cubierta', lado })]; }); return; }
  if (a === 'luces-quitar') { const ids = lucesDeSel(m).map((L) => L.id); cambiar(() => { m.luces = (m.luces || []).filter((L) => !ids.includes(L.id)); }); return; }
  if (a.startsWith('luz-:')) { const id = a.slice(5); cambiar(() => { m.luces = (m.luces || []).filter((L) => L.id !== id); }); return; }
  if (a === 'barra-desayuno') { const lado = sel.cara && sel.cara !== 'frente' ? sel.cara : 'atras'; cambiar(() => { m[`vuelo_${lado}`] = 60; }); aviso('Cubierta con 60 cm de vuelo para sentarse. Ajusta la medida en el panel o arrastrando el borde en Planta.'); return; }
  if (a === 'ver-abajo') { setVista('inferior'); render(); return; }
  if (a === 'zocalo-centrar') { const z = marcoZocalo(m), v = r1((z.izq + z.der) / 2); cambiar(() => { m.zocalo_izq = v; m.zocalo_der = v; }); return; }
  if (a === 'restaurar-piezas') { cambiar(() => { delete m.quitar; }); return; }
  if (a === 'ver-seccion') { sel = { tipo: 'frente', m: m.id, col: sel.col, fila: sel.fila }; render(); return; }
  if (a === 'quitar-material') { const d = claveDeSel(); if (d) cambiar(() => { delete m.materiales[d.k]; }); return; }
  if (a === 'ver-materiales') { $('.ed-tabs [data-tab="mat"]').click(); return; }
  if (a === 'hoja+' || a === 'hoja-') {
    const f = m.columnas[sel.col].frentes[sel.fila], w = +m.columnas[sel.col].ancho;
    const n = celdas(m).find((k) => k.col === sel.col && k.fila === sel.fila)?.hojas || 2, min = hojasMin(w);
    const nuevo = n + (a === 'hoja+' ? 1 : -1);
    if (nuevo < min) { aviso(nuevo < 2 ? 'Para una sola puerta cambia el tipo a «Puerta» (hasta 45 cm).' : `Con ${cm(w)} cm no puede tener menos de ${min} hojas: quedarían de más de ${MAX_HOJA} cm.`); return; }
    if (w / nuevo < 15) { aviso('Las hojas quedarían de menos de 15 cm.'); return; }
    cambiar(() => { f.hojas = nuevo; });
    return;
  }
  if (a === 'quitar-puerta') { cambiar(() => aplicarCampo(m, 'f.tipo', 'abierto', sel)); return; }
  if (a === 'repartir-puertas') {
    const n = Math.round(+$('#rp-n')?.value || 0), div = $('#rp-div')?.value || 'cada';
    if (n < 1) { aviso('Escribe cuántas puertas quieres.'); return; }
    const d = (+m.ancho - (n - 1) * GAP) / n;
    if (d > MAX_HOJA + .05) { aviso(`Con ${n} puertas cada una mediría ${cm(d)} cm: más de ${MAX_HOJA} cm daña las bisagras. Pon al menos ${Math.ceil((+m.ancho + GAP) / (MAX_HOJA + GAP))}.`); return; }
    if (d < 15) { aviso(`Con ${n} puertas cada una mediría ${cm(d)} cm: muy angostas (mínimo 15 cm).`); return; }
    const otros = m.columnas.some((c) => c.frentes.length > 1 || c.frentes.some((f) => f.tipo !== 'puerta' && f.tipo !== 'puerta_doble'));
    if (otros && !confirm(`«${m.nombre}» tiene cajones, secciones abiertas o varias filas. Al repartir en ${n} puertas iguales se reemplazan todos sus frentes. ¿Seguir? (Ctrl+Z deshace)`)) return;
    cambiar(() => {
      const t0 = (m.tiradores || [])[0];
      repartirPuertas(m, n, div); delete m.puertas_manual; // vuelven a igualarse solas
      m.tiradores = t0 ? tiradoresPuertas(m, t0) : [];
    });
    const F = celdas(m).map((c) => medidaFrente(m, c)), w = F[0].hojas > 1 ? F[0].hoja : F[0].w;
    aviso(`${n} puertas iguales de ${cm(w)} × ${cm(F[0].h)} cm (medida final, con 3 mm de luz entre hojas). Cambia hacia dónde abre cada una con «Bisagra» al seleccionarla.`);
    return;
  }
  if (a === 'poner-puerta') { cambiar(() => aplicarCampo(m, 'f.tipo', +m.columnas[sel.col].ancho > MAX_HOJA ? 'puerta_doble' : 'puerta', sel)); return; }
  if (a === 'tirador') { const t = ubicarTirador(m, sel.col, sel.fila, 'barra-128'); cambiar(() => m.tiradores.push(t)); sel = { tipo: 'tirador', m: m.id, t: t.id }; render(); return; }
  if (a === 'quitar-cubierta') { cambiar(() => { m.cubierta = false; }); sel = { tipo: 'modulo', m: m.id }; render(); return; }
  const t = m.tiradores.find((x) => x.id === sel.t);
  if (a === 'rot-' || a === 'rot+') cambiar(() => { t.rot = ((+t.rot || 0) + (a === 'rot+' ? -90 : 90) + 360) % 360; });
  if (a === 'centrar') cambiar(() => { t.dx = 0; t.dy = 0; });
  if (a === 'borrar-tirador') { cambiar(() => { m.tiradores = m.tiradores.filter((x) => x.id !== t.id); }); sel = null; render(); }
});

function borrarSel() {
  if (!sel) return;
  if (sel.tipo === 'medida') { const id = sel.id; cambiar((d) => { d.medidas = (d.medidas || []).filter((x) => x.id !== id); }); sel = null; render(); aviso('Medida borrada (Ctrl+Z la trae de vuelta).'); return; }
  if (sel.tipo === 'objeto') { const id = sel.o; cambiar((d) => { d.objetos = (d.objetos || []).filter((o) => o.id !== id); }); sel = null; render(); return; }
  if (sel.tipo === 'multi') { const ids = sel.ids; cambiar((d) => { d.modulos = d.modulos.filter((m) => !ids.includes(m.id)); }); sel = null; render(); return; }
  if (sel.tipo === 'vano') { const s = { ...sel }; cambiar((d) => { const m = metaMuro(d.espacio, s.i); m.vanos = (m.vanos || []).filter((x) => x.id !== s.v); }); sel = null; render(); return; }
  if (sel.tipo === 'artefacto') { const s = { ...sel }; cambiar((d) => { const m = d.modulos.find((x) => x.id === s.m); m.artefactos = (m.artefactos || []).filter((x) => x.id !== s.a); }); sel = { tipo: 'cubierta', m: s.m }; render(); return; }
  if (sel.tipo === 'soporte') { // Supr sobre el soporte delantero: el mueble va sin él
    const m = modulo(sel.m); if (!m) return;
    cambiar(() => { m.quitar = [...new Set([...(m.quitar || []), 'soporte'])]; });
    aviso(`Se quitó el soporte delantero de «${m.nombre}». Se restaura desde el panel del mueble o con Ctrl+Z.`);
    sel = { tipo: 'modulo', m: m.id }; render(); return;
  }
  if (sel.tipo === 'pieza' && sel.parte != null) { borrarParte(); return; } // una parte del costado
  if (sel.tipo === 'pieza') { // Supr sobre la base, el techo, el fondo o un costado: el mueble va sin esa pieza
    const s = { ...sel }, m = modulo(s.m);
    if (!['piso', 'techo', 'fondo', 'izq', 'der'].includes(s.p)) return;
    cambiar(() => { m.quitar = [...new Set([...(m.quitar || []), s.p])]; });
    aviso(`Se quitó: ${NOMBRE_PIEZA[s.p].toLowerCase()} de «${m.nombre}». Se restaura desde el panel del mueble o con Ctrl+Z.`);
    sel = { tipo: 'modulo', m: m.id }; render(); return;
  }
  if (sel.tipo === 'repisa') { // Supr sobre una repisa: una menos en esa sección
    const s = { ...sel }, m = modulo(s.m), c = celdas(m).find((k) => k.col === s.col && k.fila === s.fila);
    cambiar(() => { m.columnas[s.col].frentes[s.fila].repisas = Math.max(0, (c?.repisas || 1) - 1); });
    sel = { tipo: 'frente', m: m.id, col: s.col, fila: s.fila }; render(); return;
  }
  if (sel.tipo === 'div') { // Supr sobre una división: las dos secciones quedan en una
    const s = { ...sel }, m = modulo(s.m);
    cambiar(() => (s.dir === 'v' ? unirDerecha(m, s.col) : unirAbajo(m, s.col, s.fila)));
    sel = { tipo: 'frente', m: m.id, col: s.col, fila: s.dir === 'v' ? 0 : s.fila }; render(); return;
  }
  if (sel.tipo === 'suelo' || (sel.tipo === 'muro' && sel.z != null)) { const s = alcanceSel(); cambiar((d) => quitarAcabado(s, d)); aviso(`Material quitado de ${nombreAlcance(s)}. Ctrl+Z lo trae.`); return; }
  if (sel.tipo === 'muro') { // Supr sobre un muro: se elimina solo ese muro (del contorno se puede restaurar; el suelto se borra)
    const i = sel.i, n = murosContorno(modelo.espacio);
    if (i >= n) { cambiar((d) => { d.espacio.tramos.splice(i - n, 1); }); sel = null; render(); return; }
    cambiar((d) => { metaMuro(d.espacio, i).oculto = true; });
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
  const salia34 = !!v34;
  v34 = null; // cualquier botón de vista (también 3D) sale de la vista 3/4: vuelven la cubierta y la cámara libre
  aislado = null; // y de «Ver solo este mueble»
  vista = v;
  $$('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
  lienzo.classList.toggle('frente', v === 'frente');
  lienzo.classList.toggle('planta', v === 'planta');
  lienzo.classList.toggle('inferior', v === 'inferior');
  planta.cancelar();
  if (v === 'frente') { st.lock(true); st.limits(-89, 89); st.ortho(true); st.set(0, 0); if (herr === 'muros') setHerr('sel'); }
  else if (v === 'planta') { st.lock(true); st.limits(-90, 90); st.ortho(true); st.set(-90, 0); if (herr.startsWith('div')) setHerr('sel'); }
  else if (v === 'inferior') { st.lock(true); st.limits(-90, 90); st.ortho(true); st.set(90, 0); if (herr !== 'sel') setHerr('sel'); }
  else { st.lock(false); st.limits(-70, 0); st.ortho(false); st.set(-24, -30); if (herr !== 'sel') setHerr('sel'); }
  render({ panel: salia34 }); // al salir de la vista 3/4 el panel vuelve a mostrar «Ver por dentro»
  encuadrar(true); dibujarPlano();
  referencias.pintarPanel();
  estadoEl.textContent = ayuda();
}
function setHerr(h) {
  herr = h;
  $$('[data-herr]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.herr === h)));
  lienzo.className = lienzo.className.replace(/\bh-\S+/g, '').trim() + ` h-${h}`;
  // Cada herramienta trabaja en su vista: muros en Planta, divisiones en Frente; dibujar módulo en ambas.
  medF = null; cursorF = null; planta.cancelar?.();
  if (h.startsWith('div') && (sel?.tipo === 'muro' || sel?.tipo === 'vano') && murosDe(modelo.espacio)[sel.i] && !murosDe(modelo.espacio)[sel.i].oculto && muroFrente !== sel.i) {
    muroFrente = sel.i; opcionesMuroFrente(); if (vista === 'frente') { render(); encuadrar(true); } // dividir el muro elegido
  }
  const necesita = h === 'muros' ? 'planta' : h.startsWith('div') ? 'frente' : (h === 'dibujar' || h === 'medir') && vista === '3d' ? (h === 'medir' ? 'planta' : 'frente') : null;
  if (necesita && vista !== necesita) setVista(necesita);
  estadoEl.textContent = ayuda();
}
function ayuda() {
  if (vista === '3d') return 'Arrastra para girar · clic para seleccionar · rueda para acercar';
  if (vista === 'inferior') return 'Vista desde abajo · arrastra un lado del zócalo para cambiar su retiro, o el centro para moverlo · clic en una cota para escribirla';
  if (vista === 'planta') return {
    sel: 'Arrastra un mueble para moverlo (imán a los muros, Alt sin imán) · R gira · clic en una cota para escribirla',
    dibujar: 'Arrastra para dibujar la huella de un mueble (ancho × fondo)',
    muros: 'Clic en un punto y clic en otro: queda un muro (90°; Mayús libre). Si empiezas o terminas en la punta de otro muro, se unen · Esc cancela',
    medir: 'Huincha: clic en un punto y clic en otro (se pega a la línea más cercana de un mueble o muro) · clic derecho sobre una medida y Supr la borra',
  }[herr] || '';
  return {
    sel: 'Clic selecciona · arrastra divisores y tiradores',
    dibujar: 'Arrastra para dibujar un módulo (se apoya en el piso si empiezas cerca)',
    'div-v': 'Clic en un frente para dividirlo en columnas, o en el muro para cortarlo en zonas de material (imán a la mitad)',
    'div-h': 'Clic en un frente para dividirlo en filas, o en el muro para cortarlo en zonas de material (imán a la mitad)',
    medir: 'Huincha: clic en un punto y clic en otro (se pega a la línea más cercana de un mueble) · clic derecho sobre una medida y Supr la borra',
  }[herr];
}
function aviso(t) { estadoEl.textContent = t; }

$$('[data-vista]').forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
$$('[data-herr]').forEach((b) => b.addEventListener('click', () => setHerr(b.dataset.herr)));
$('#capas').addEventListener('change', (e) => {
  const c = e.target.dataset.capa; if (!c) return;
  capas[c] = e.target.checked;
  if (c === 'noche') { st.noche(capas.noche ? .62 : 0); return; } // solo cambia la sombra de las caras
  render();
});
$('#nombre').addEventListener('change', (e) => cambiar(() => { modelo.nombre = e.target.value.trim() || 'Sin nombre'; }));

// Secciones del panel izquierdo: plegables, recuerda cuáles quedaron abiertas (solo en este navegador)
for (const d of document.querySelectorAll('.ed-sec')) {
  try { const v = localStorage.getItem(`dm-editor-sec:${d.dataset.sec}`); if (v) d.open = v === '1'; } catch (e) {}
  d.addEventListener('toggle', () => { try { localStorage.setItem(`dm-editor-sec:${d.dataset.sec}`, d.open ? '1' : '0'); } catch (e) {} });
}
const selMel = $('#melamina');
selMel.innerHTML = MEL.map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)} · ${esc(x.linea || '')}</option>`).join('');
selMel.value = modelo.frente || '';
pintarColores();
selMel.addEventListener('change', () => { if (!$('#tab-mat').hidden) pintarMateriales(); });
selMel.addEventListener('change', () => cambiar(() => { modelo.frente = selMel.value; }));

$('.ed-acciones').addEventListener('click', (e) => {
  const a = e.target.closest('[data-acc]')?.dataset.acc; if (!a) return;
  if (a === 'deshacer') deshacer();
  if (a === 'rehacer') rehacer();
  if (a === 'encuadrar') { zoom = 1; st.resetPan(); encuadrar(true); dibujarPlano(); }
  if (a === 'respaldos') abrirRespaldos();
  if (a === 'despiece') abrirDespiece();
  if (a === 'plano') abrirPlano();
  if (a === 'nuevo' && confirm('¿Empezar un modelo vacío? El actual se puede recuperar con Deshacer o en «Respaldos».') && (respaldar(proyActual?.id, JSON.parse(JSON.stringify(modelo)), 'antes de «Nuevo»'), true)) { cambiar((d) => { d.modulos = []; d.nombre = 'Nuevo modelo'; }); sel = null; setVista('frente'); setHerr('dibujar'); }
  if (a === 'exportar') exportar();
  if (a === 'importar') $('#archivo').click();
});
// Ventana «Plano técnico»: planta general y un frente por mueble con cotas, para imprimir o mandar a fabricar
function abrirPlano() {
  let dlg = $('#dlg-plano');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.className = 'ed-dlg ed-dlg-ancho'; dlg.id = 'dlg-plano';
    dlg.innerHTML = '<div class="ed-dlg-cab"><h2>Plano técnico</h2><div class="ed-dlg-acc"><button data-plano-print>Imprimir / PDF</button><button data-cerrar aria-label="Cerrar">✕</button></div></div><div class="ed-dlg-cuerpo"></div>';
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) dlg.close();
      if (e.target.closest('[data-plano-print]')) imprimirPlano();
    });
    document.body.append(dlg);
  }
  dlg.querySelector('.ed-dlg-cuerpo').innerHTML = planoHTML(modelo, { titulo: proyActual?.raw?.titulo ? `Plano técnico · ${proyActual.raw.titulo}` : 'Plano técnico' });
  dlg.showModal();
}
function imprimirPlano() {
  const doc = $('#dlg-plano .plano-doc')?.outerHTML; if (!doc) return;
  const w = window.open('', '_blank'); if (!w) { aviso('Permite las ventanas emergentes para imprimir el plano.'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plano técnico</title><style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    .plano-cab h2 { margin: 0 0 2px; } .plano-cab p { margin: 0 0 16px; color: #555; font-size: 13px; }
    .plano-mueble { margin: 0 0 26px; page-break-inside: avoid; } .plano-mueble h3 { margin: 0 0 6px; font-size: 15px; } .plano-mueble small { color: #666; font-weight: 400; }
    .plano-svg { width: 100%; max-height: 640px; height: auto; }
    .plano-svg .pieza { fill: #f4f1ea; stroke: #222; stroke-width: .6; } .plano-svg .zocalo { fill: #ddd6c8; stroke: #222; stroke-width: .5; }
    .plano-svg .frente { fill: none; stroke: #444; stroke-width: .5; } .plano-svg .div { stroke: #222; stroke-width: .8; }
    .plano-svg .muro { stroke: #222; stroke-width: 3; stroke-linecap: square; } .plano-svg .mueble { fill: #f4f1ea; stroke: #333; stroke-width: .8; } .plano-svg .frente-m { stroke: #b4322e; stroke-width: 1.6; }
    .plano-svg .et { font: 4px system-ui, sans-serif; fill: #333; } .plano-svg .et.chico { font-size: 3.2px; fill: #777; }
    .plano-svg .cota line { stroke: #b4322e; stroke-width: .4; } .plano-svg .cota text { font: 3.6px system-ui, sans-serif; fill: #b4322e; }
  </style></head><body>${doc}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
}
// Ventana «Lista de materiales»: lo que se publica con el proyecto y con lo que el Worker calcula el precio
function abrirDespiece() {
  const d = despiece(modelo);
  const nombreMat = (k) => (k === 'frente' ? `Melamina de frentes (${nombreMaterial(modelo.frente) || 'la que elija el cliente'})` : nombreMaterial(k) || k);
  const grupos = {};
  for (const p of d.piezas) {
    if (p.tipo === 'pino') continue; // el pino se cuenta en tiras
    const [tipo, mat] = p.tipo === 'cholguan' ? ['Cholguán', p.material.replace(/^cholguan:/, '')] : [`Melamina ${p.espesor} mm`, p.material];
    const k = `${tipo}|${mat}`; grupos[k] = grupos[k] || { tipo, mat, m2: 0, n: 0 }; grupos[k].m2 += p.area; grupos[k].n++;
  }
  const filas = Object.values(grupos).sort((a, b) => b.m2 - a.m2).map((g) => `<tr><td>${esc(g.tipo)}</td><td>${esc(g.mat === 'blanco' ? 'Blanco' : nombreMat(g.mat))}</td><td class="num">${g.n}</td><td class="num">${g.m2.toFixed(2)} m²</td></tr>`).join('');
  const corr = Object.entries(d.herrajes.correderas).map(([l, n]) => `${n} par${n > 1 ? 'es' : ''} de ${l} cm`).join(', ') || '—';
  let dlg = $('#dlg-despiece');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.className = 'ed-dlg ed-dlg-ancho'; dlg.id = 'dlg-despiece';
    dlg.innerHTML = '<div class="ed-dlg-cab"><h2>Lista de materiales</h2><button data-cerrar aria-label="Cerrar">✕</button></div><div class="ed-dlg-cuerpo"></div>';
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) dlg.close();
      const i = e.target.closest('[data-imperial]')?.dataset.imperial; if (i != null) exportarImperial(+i);
    });
    document.body.append(dlg);
  }
  dlg.querySelector('.ed-dlg-cuerpo').innerHTML = `
    <p class="ed-ayuda">Calculada con tus reglas de fabricación: cuerpo = profundidad − 3 mm de cholguán; basales sin techo con soportes de 10 cm; aéreos con base, techo y 3 soportes; zócalo y soportes traseros de pino; frentes con 3 mm de luz y 7 cm (con cubierta) o 1 cm menos arriba. La medida de corte descuenta 1 mm por canto con tapacanto. Al publicar se envía con el proyecto y el Worker la cotiza con tus precios.</p>
    <table class="ed-tabla"><thead><tr><th>Tipo</th><th>Material</th><th class="num">Piezas</th><th class="num">Superficie</th></tr></thead><tbody>${filas || '<tr><td colspan="4">Sin muebles.</td></tr>'}</tbody></table>
    <table class="ed-tabla"><tbody>
      <tr><td>Bisagras de cierre suave</td><td class="num">${d.herrajes.bisagras} (${d.herrajes.bisagras_rectas || 0} rectas · ${d.herrajes.bisagras_semicurvas || 0} semicurvas)</td></tr>
      <tr><td>Pino tapa canteada 1x4 (zócalo y soportes)</td><td class="num">${d.herrajes.pino?.tiras || 0} tira${d.herrajes.pino?.tiras === 1 ? '' : 's'} de 3,2 m · ${(d.herrajes.pino?.metros || 0).toFixed(2)} m</td></tr>
      <tr><td>Correderas telescópicas de cierre suave</td><td class="num">${esc(corr)}</td></tr>
      ${(() => { // esquineros: platos giratorios, retenes (caja de 10) y ejes de acero (barra de 6 m)
        const E = d.esquineros || [], pl = E.reduce((s, e) => s + (+e.platos || 0), 0), rt = E.reduce((s, e) => s + (+e.retenes || 0), 0), br = E.reduce((s, e) => s + (+e.barra_cm || 0), 0);
        const pend = E.filter((e) => e.confirmar).length;
        const b165 = E.reduce((s, e) => s + (+e.bisagras_165 || 0), 0);
        return (b165 ? `<tr><td>Bisagras de 165° cierre suave (esquinero)</td><td class="num">${b165}</td></tr>` : '')
          + (pl ? `<tr><td>Platos giratorios de 15 cm (esquinero)</td><td class="num">${pl}</td></tr>` : '')
          + (rt ? `<tr><td>Retenes magnéticos (esquinero)</td><td class="num">${rt} · ${Math.ceil(rt / 10)} caja${rt > 10 ? 's' : ''} de 10</td></tr>` : '')
          + (br ? `<tr><td>Ejes de barra de acero 3/4" (esquinero)</td><td class="num">${cm(br / 100)} m · ${Math.ceil(br / 600)} barra${br > 600 ? 's' : ''} de 6 m</td></tr>` : '')
          + (pend ? `<tr><td colspan="2" class="ed-ayuda">${pend} esquinero${pend > 1 ? 's' : ''} con precio por confirmar (sin solución elegida o con piezas por definir).</td></tr>` : '');
      })()}
      <tr><td>Tapacanto (cantos visibles)</td><td class="num">${d.tapacanto_m.toFixed(1)} m${d.tapacanto_blanco_m != null ? ` (${d.tapacanto_blanco_m.toFixed(1)} blanco · ${d.tapacanto_color_m.toFixed(1)} color)` : ''}</td></tr>
    </tbody></table>
    ${d.cubiertas.length ? `<table class="ed-tabla"><thead><tr><th>Cubierta</th><th class="num">Largo × ancho</th><th class="num">Sacados</th><th>Respaldo</th></tr></thead><tbody>${d.cubiertas.map((c) => `<tr><td>${esc(c.mueble)}</td><td class="num">${cm(c.largo)} × ${cm(c.ancho)} cm${c.ancho < 60 ? ' (cobra 60)' : ''}</td><td class="num">${c.sobrepuestos} sobrep. · ${c.bajo} bajo cub.</td><td>${c.respaldo ? 'Sí' : 'No'}</td></tr>`).join('')}</tbody></table>
      <p class="ed-ayuda">La cubierta se cotiza por m² según el material que elija el cliente (Configuración de precios → Materiales de cubierta): merma, instalación estimada, sacados, respaldo y el margen de cada material.</p>` : ''}
    ${(() => { // planchas por melamina (optimizador propio, igual que el de Imperial) y Excel para pedir el corte
      const grupos = optimizarDespiece(d, { frente: modelo.frente });
      ultimaOptimizacion = grupos;
      if (!grupos.length) return '';
      return `<p class="sub" style="margin-top:14px">Planchas y corte (2500 × 1830 mm)</p>
        <p class="ed-ayuda">Acomodo como el optimizador de Imperial: refilado de 10 mm, sierra de 3,2 mm y medidas de corte. Las melaminas con veta (maderas, piedras y textiles) no se giran; las unicolor sí. «Excel para Imperial» descarga su template con las piezas de esa melamina.</p>
        <table class="ed-tabla"><thead><tr><th>Melamina</th><th class="num">Piezas</th><th class="num">Planchas</th><th class="num">Aprovechamiento</th><th></th></tr></thead><tbody>
        ${grupos.map((g, i) => `<tr><td>${esc(nombreMat(g.material))} · ${g.espesor} mm${vetaLibre(g.material) ? '' : ' <small>(veta fija)</small>'}</td><td class="num">${g.piezas.length}</td><td class="num">${g.planchas}</td><td class="num">${(g.aprovechamiento * 100).toFixed(0)} %</td>
          <td><button type="button" data-imperial="${i}">Excel para Imperial</button></td></tr>`).join('')}</tbody></table>
        ${(() => { // Imperial no corta bajo 300 × 100 mm: esas piezas se piden agrandadas al mínimo y se repasan en el taller
          const chicas = d.piezas.filter((p) => p.tipo === 'tablero' && bajoMinimo({ ancho: p.corte.ancho * 10, alto: p.corte.alto * 10 }))
            .map((p) => `${p.mueble} · ${p.nombre} ${Math.round(p.corte.ancho * 10)} × ${Math.round(p.corte.alto * 10)} mm`);
          return chicas.length ? `<p class="ed-ayuda ed-err">Imperial no corta bajo 300 × 100 mm. Estas ${chicas.length} se piden al mínimo y se repasan en el taller: ${chicas.map(esc).join('; ')}.</p>` : '';
        })()}
        ${grupos.some((g) => g.noCaben.length) ? `<p class="ed-ayuda ed-err">Hay piezas más grandes que la plancha: ${grupos.flatMap((g) => g.noCaben).map((p) => esc(`${p.mueble} · ${p.nombre}`)).join(', ')}.</p>` : ''}
        <details><summary>Ver el esquema de corte</summary>${grupos.map((g) => g.tableros.map((t, j) => `<p class="ed-ayuda">${esc(nombreMat(g.material))} · plancha ${j + 1} de ${g.planchas}</p>${svgPlancha(t)}`).join('')).join('')}</details>
        <p class="ed-ayuda" id="imperial-msg"></p>`;
    })()}
    <div id="cholguan-planchas"></div>
    <div class="ed-tiendas" id="tiendas"><p class="sub">Precios y stock de las tiendas</p><p class="ed-ayuda">${tokenGitHub() ? 'Cargando…' : 'Entra a /admin/proyectos/ con GitHub para ver los precios de Imperial y Homecenter.'}</p></div>
    <details><summary>Ver las ${d.piezas.length} piezas (medida final y de corte)</summary><table class="ed-tabla"><thead><tr><th>Mueble</th><th>Pieza</th><th class="num">Final</th><th class="num">Corte</th><th>Tapacanto</th><th>Material</th></tr></thead><tbody>${d.piezas.map((p) => {
      const tc = p.cantos ? [p.cantos.ancho && `${p.cantos.ancho} × ${cm(p.ancho)}`, p.cantos.alto && `${p.cantos.alto} × ${cm(p.alto)}`].filter(Boolean).join(' + ') : '';
      const mat = p.tipo === 'cholguan' ? 'Cholguán' : p.tipo === 'pino' ? 'Pino 1x4' : nombreMat(p.material);
      return `<tr><td>${esc(p.mueble)}</td><td>${esc(p.nombre)}${p.nota ? `<br><small>${esc(p.nota)}</small>` : ''}</td><td class="num">${p.tipo === 'pino' ? `${cm(p.ancho)} cm` : `${cm(p.ancho)} × ${cm(p.alto)}`}</td><td class="num">${p.corte ? `${cm(p.corte.ancho)} × ${cm(p.corte.alto)}` : '—'}</td><td>${tc || '—'}</td><td>${esc(mat)}</td></tr>`;
    }).join('')}</tbody></table></details>`;
  dlg.showModal();
  pintarCholguan(d);
  if (tokenGitHub()) { pintarTiendas(); leerPrecios().then((cfg) => pintarCholguan(d, cfg)).catch(() => {}); }
}
// Cholguán por plancha entera (no se vende por m²), con el formato de cada cholguán en la Configuración de precios
function pintarCholguan(d, cfg = null) {
  const box = $('#cholguan-planchas'); if (!box) return;
  const formato = (c) => ((cfg?.cholguan || []).find((x) => x.codigo === c) || (cfg?.cholguan || []).find((x) => x.codigo === '*'))?.formato;
  const grupos = optimizarCholguan(d, formato);
  if (!grupos.length) { box.innerHTML = ''; return; }
  const nom = (c) => (c === 'blanco' ? 'Blanco' : nombreMaterial(c) || c);
  const trozos = grupos.flatMap((g) => g.piezas.filter((p) => p.trozos > 1)).filter((p, i, l) => l.findIndex((x) => x.mueble === p.mueble && x.nombre === p.nombre) === i);
  box.innerHTML = `<p class="sub" style="margin-top:14px">Cholguán (se compra por plancha entera)</p>
    <table class="ed-tabla"><thead><tr><th>Cholguán</th><th class="num">Formato</th><th class="num">Piezas</th><th class="num">Planchas</th><th class="num">Aprovechamiento</th></tr></thead><tbody>
    ${grupos.map((g) => `<tr><td>${esc(nom(g.material))}</td><td class="num">${g.plancha.altura} × ${g.plancha.base}</td><td class="num">${g.piezas.length}</td><td class="num">${g.planchas}</td><td class="num">${(g.aprovechamiento * 100).toFixed(0)} %</td></tr>`).join('')}</tbody></table>
    ${trozos.length ? `<p class="ed-ayuda">Más grandes que la plancha (se arman con trozos iguales): ${trozos.map((p) => esc(`${p.mueble} · ${p.nombre} (${p.trozos} trozos)`)).join('; ')}.</p>` : ''}
    ${cfg ? '' : '<p class="ed-ayuda">Formato supuesto 1520 × 2440 mientras no se lea la Configuración de precios.</p>'}
    <details><summary>Ver el acomodo del cholguán</summary>${grupos.map((g) => g.tableros.map((t, j) => `<p class="ed-ayuda">Cholguán ${esc(nom(g.material))} · plancha ${j + 1} de ${g.planchas}</p>${svgPlancha(t, g.plancha)}`).join('')).join('')}</details>`;
}
// Excel para Imperial de una melamina: el SKU de la plancha y del tapacanto salen de la Configuración de precios
let ultimaOptimizacion = [];
async function exportarImperial(i) {
  const g = ultimaOptimizacion[i], msg = $('#imperial-msg'); if (!g) return;
  try {
    const cfg = await leerPrecios().catch(() => null);
    const e = (cfg?.planchas || []).find((x) => x.codigo === g.material);
    const sku = skuDe(e?.url_imperial), tapacanto = e?.tapacanto_sku || '';
    const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await descargarImperial(g, { sku, tapacanto, archivo: `imperial-${slug(proyActual?.raw?.titulo || modelo.nombre || 'proyecto')}-${slug(nombreMaterial(g.material))}-${g.espesor}mm` });
    if (msg) msg.textContent = sku ? `Descargado el Excel de ${nombreMaterial(g.material)} (SKU ${sku}${tapacanto ? `, tapacanto ${tapacanto}` : ''}).`
      : `Descargado el Excel de ${nombreMaterial(g.material)} sin SKU: agrega el link de Imperial de esa plancha en Configuración de precios (o escríbelo en la celda B3).`;
  } catch (err) { if (msg) msg.textContent = `No se pudo crear el Excel: ${err.message}`; }
}
// Precios leídos de Imperial (Santa Rosa) y Homecenter por el Worker (cada hora, de a poco). Solo el estudio los ve.
async function pintarTiendas(actualizar = false) {
  const box = $('#tiendas'); if (!box) return;
  try {
    let msg = '';
    if (actualizar) { const r = await api('precios/actualizar', { method: 'POST' }); msg = `Se leyeron ${r.leidos} productos${r.fallas.length ? `, ${r.fallas.length} con error` : ''}${r.pendientes ? ` · quedan ${r.pendientes} para la próxima` : ''}.`; }
    const { filas, conLink } = await api('precios');
    const fecha = (t) => (t ? new Date(t).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
    const nom = (f) => (f.lista === 'herrajes' ? f.clave : f.lista === 'cholguan' ? `Cholguán ${f.clave}` : nombreMaterial(f.clave) || f.clave);
    box.innerHTML = `<p class="sub">Precios y stock de las tiendas</p>
      <p class="ed-ayuda">${conLink ? `${conLink} links en Configuración de precios.` : 'Agrega links de Imperial u Homecenter en Configuración de precios (planchas, cholguán y herrajes).'} Se actualizan solos cada hora (de a ${15} productos). Al cotizar se usa el más barato con stock; si ninguna tienda tiene stock, la melamina queda bloqueada para el cliente.</p>
      ${filas.length ? `<table class="ed-tabla"><thead><tr><th>Producto</th><th>Tienda</th><th class="num">Precio</th><th>Stock</th><th>Leído</th></tr></thead><tbody>${filas.map((f) => `<tr${f.error ? ' class="ed-err"' : ''}><td>${esc(nom(f))}</td><td>${f.tienda === 'imperial' ? 'Imperial' : 'Homecenter'}</td><td class="num">${f.precio ? '$' + Number(f.precio).toLocaleString('es-CL') : '—'}</td><td>${f.stock === 1 ? `Sí${f.unidades ? ` (${f.unidades})` : ''}` : f.stock === 0 ? '<b>Sin stock</b>' : '—'}</td><td>${fecha(f.actualizado)}${f.error ? `<br><small>${esc(f.error)}</small>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="ed-botones"><button data-tiendas="actualizar">Actualizar ahora</button></div>${msg ? `<p class="ed-ayuda">${esc(msg)}</p>` : ''}`;
    box.querySelector('[data-tiendas]').onclick = (e) => { e.target.disabled = true; e.target.textContent = 'Leyendo…'; pintarTiendas(true); };
  } catch (e) { box.innerHTML = `<p class="sub">Precios y stock de las tiendas</p><p class="ed-ayuda">No se pudo consultar: ${esc(e.message)}</p>`; }
}
// Ventana «Respaldos»: copias automáticas del modelo de este proyecto (o del modelo local)
function abrirRespaldos() {
  const id = proyActual?.id, lista = respaldos(id);
  let d = $('#dlg-respaldos');
  if (!d) {
    d = document.createElement('dialog'); d.className = 'ed-dlg'; d.id = 'dlg-respaldos';
    d.innerHTML = '<div class="ed-dlg-cab"><h2>Respaldos</h2><button data-cerrar aria-label="Cerrar">✕</button></div><div class="ed-dlg-cuerpo"></div>';
    document.body.append(d);
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) return d.close();
      const i = e.target.closest('[data-resp]')?.dataset.resp; if (i == null) return;
      const r = respaldos(proyActual?.id)[+i]; if (!r) return;
      respaldar(proyActual?.id, JSON.parse(JSON.stringify(modelo)), 'antes de recuperar un respaldo');
      cambiar((m) => { m.modulos = r.modelo.modulos; if (r.modelo.espacio) m.espacio = r.modelo.espacio; if (r.modelo.colores) m.colores = r.modelo.colores; if (r.modelo.frente) m.frente = r.modelo.frente; });
      sel = null; selMel.value = modelo.frente || ''; pintarColores(); render(); encuadrar(true);
      aviso('Respaldo recuperado. Ctrl+Z vuelve atrás. Publica la versión para que quede en el proyecto.');
      d.close();
    });
  }
  d.querySelector('.ed-dlg-cuerpo').innerHTML = `<p class="ed-ayuda">Copias automáticas ${proyActual ? 'de este proyecto' : 'del modelo local'} guardadas en este navegador antes de reemplazar un borrador.</p>
    ${lista.length ? `<div class="ed-lista">${lista.map((r, i) => `<button data-resp="${i}"><b>${new Date(r.fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })} · ${r.modelo.modulos.length} muebles</b><small>${esc(r.motivo || '')} · ${esc(r.modelo.modulos.slice(0, 4).map((m) => m.nombre).join(', '))}${r.modelo.modulos.length > 4 ? '…' : ''}</small></button>`).join('')}</div>`
      : '<p class="ed-vacio">Todavía no hay respaldos.</p>'}`;
  d.showModal();
}
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
    cambiar(() => { modelo = d; }); modelo = d; modelo.modulos.forEach(normalizar); sel = null; selMel.value = modelo.frente || ''; pintarColores(); guardar(); render(); encuadrar(true);
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
  else if (k === '4') setVista('inferior');
  else if (k === 'w') setHerr('muros');
  else if (k === 'u') setHerr('medir');
  else if (k === 'escape' && medF) { medF = null; cursorF = null; dibujarPlano(); }
  else if (k === 'escape' && v34) { salir34(); props(); }
  else if (k === 'escape' && aislado) salirAislado();
  else if (k === 'v' || k === 'escape') { setHerr('sel'); if (k === 'escape') { sel = null; render(); } }
  else if (k === 'm') setHerr('dibujar');
  else if (k === 'd') setHerr('div-v');
  else if (k === 'h') setHerr('div-h');
  else if (k === 'f') { zoom = 1; st.resetPan(); encuadrar(true); dibujarPlano(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); borrarSel(); }
  else if (k === 'r' && sel?.tipo === 'tirador') { const m = modulo(sel.m), t = m.tiradores.find((x) => x.id === sel.t); cambiar(() => { t.rot = ((+t.rot || 0) + 90) % 360; }); }
  else if (e.key.startsWith('Arrow') && sel?.tipo === 'vano') { // mover la ventana o puerta en su muro
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0, dy = { ArrowUp: paso, ArrowDown: -paso }[e.key] || 0;
    cambiarVano((r, w, def) => {
      r.desde = Math.min(Math.max(0, (+r.desde || 0) + dx), w.largo - (+r.ancho || def.ancho));
      if (!def.puerta) r.antepecho = Math.min(Math.max(0, (+r.antepecho || 0) + dy), w.alto - (+r.alto || def.alto));
    });
  }
  else if (e.key.startsWith('Arrow') && sel?.tipo === 'objeto') { // mover el electrodoméstico
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0, dy = { ArrowUp: paso, ArrowDown: -paso }[e.key] || 0;
    const W = vista === 'frente' && muroActivo();
    cambiarObjeto((o) => {
      if (vista === 'planta') { o.x = +o.x + dx; o.z = +o.z - dy; }
      else { o.x = +o.x + dx * (W ? W.u[0] : 1); o.z = +o.z + dx * (W ? W.u[1] : 0); o.elevacion = Math.max(0, +o.elevacion + dy); }
    });
  }
  else if (k === 'r' && sel?.tipo === 'objeto') cambiarObjeto((o) => { o.rotacion = ((+o.rotacion || 0) + 90) % 360; });
  else if (e.key.startsWith('Arrow') && sel?.tipo === 'artefacto') { // mover sobre la cubierta: ←→ a lo largo, ↑↓ hacia la pared o el canto
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0, dy = { ArrowUp: paso, ArrowDown: -paso }[e.key] || 0;
    const s = { ...sel };
    cambiar((d) => {
      const m = d.modulos.find((x) => x.id === s.m), c = m && centroArtefacto(m, s.a); if (!c) return;
      const [gx, gz] = girar(dx, -dy, +m.rotacion || 0), mid = moverArtefacto(d, s.m, s.a, c[0] + gx, c[1] + gz);
      sel = { ...s, m: mid || s.m };
    });
  }
  else if (['vano', 'artefacto', 'div'].includes(sel?.tipo) && (k === 'r' || e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown')) { /* no aplica */ }
  else if (k === 'r' && sel && sel.tipo !== 'muro' && sel.tipo !== 'multi') girarConAviso(modulo(sel.m), 90);
  else if ((e.key === 'PageUp' || e.key === 'PageDown') && sel?.tipo === 'multi') { // subir / bajar varios
    e.preventDefault();
    const paso = (e.shiftKey ? 10 : 1) * (e.key === 'PageUp' ? 1 : -1), ids = sel.ids;
    cambiar((d) => d.modulos.filter((m) => ids.includes(m.id)).forEach((m) => { m.elevacion = Math.max(0, +m.elevacion + paso); }));
  }
  else if (e.key.startsWith('Arrow') && sel?.tipo === 'multi') { // mover varios juntos
    e.preventDefault();
    const paso = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -paso, ArrowRight: paso }[e.key] || 0, dy = { ArrowUp: paso, ArrowDown: -paso }[e.key] || 0, ids = sel.ids;
    cambiar((d) => d.modulos.filter((m) => ids.includes(m.id)).forEach((m) => {
      if (vista === 'planta') { m.x = +m.x + dx; m.z = +m.z - dy; } else { moverFrente(m, dx); m.elevacion = Math.max(0, +m.elevacion + dy); }
    }));
  }
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
    else cambiar(() => { moverFrente(m, dx); m.elevacion = Math.max(0, +m.elevacion + dy); });
  }
});

// Re-encuadrar al cambiar el tamaño de la ventana
new ResizeObserver(() => { encuadrar(true); dibujarPlano(); }).observe(lienzo);

// ===================== proyectos de clientes =====================
// Pestañas del panel derecho
$$('.ed-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
  $$('.ed-tabs [data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('#tab-props').hidden = b.dataset.tab !== 'props';
  $('#tab-mat').hidden = b.dataset.tab !== 'mat';
  if (b.dataset.tab === 'mat') { pintarMateriales(); pintarAcabTab(true); }
  $('#tab-coment').hidden = b.dataset.tab !== 'coment';
}));

// ===================== cocinas de referencia =====================
function regenerarPlantilla(gid, tipo, p) {
  const idx = modelo.modulos.findIndex((m) => leerPlantilla(m)?.g === gid);
  const nuevos = generar(tipo, p, gid);
  cambiar((d) => {
    d.modulos = d.modulos.filter((m) => leerPlantilla(m)?.g !== gid);
    d.modulos.splice(Math.max(0, idx), 0, ...nuevos);
    d.objetos = [...(d.objetos || []).filter((o) => leerPlantilla(o)?.g !== gid), ...(nuevos.objetos || [])]; // lámparas de la isla
  });
  sel = { tipo: 'modulo', m: nuevos[0].id }; render();
}
$('#plantillas').addEventListener('click', (e) => {
  if (e.target.closest('[data-esquinero]')) { agregarEsquinero(); return; }
  if (e.target.closest('[data-esquinero-aereo]')) { agregarEsquinero(true); return; }
  const t = e.target.closest('[data-plantilla]')?.dataset.plantilla; if (!t) return;
  const nuevos = generar(t, parametrosIniciales(t, modelo.espacio));
  cambiar((d) => { d.modulos.push(...nuevos); if (nuevos.objetos?.length) d.objetos = [...(d.objetos || []), ...nuevos.objetos]; });
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
  seleccionarVarios: (ids, sumar) => seleccionarVarios(ids, sumar),
  apoyar: (o) => apoyar(o),
  alternar: (id) => alternar(id),
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
      const cli = info.cliente; // lo que eligió el cliente en su portal: su melamina y colores por pieza pasan al modelo
      let deCliente = cli?.sel ? aplicarCliente(modelo, cli.sel) : null;
      if (!conservarVista) { // ¿quedó un borrador sin publicar? (aunque el proyecto haya cambiado después en el administrador)
        let b = null; try { b = JSON.parse(localStorage.getItem(claveProy(info.id))); } catch (e) {}
        if (b?.modelo?.modulos && JSON.stringify(b.modelo.modulos) !== JSON.stringify(modelo.modulos)) {
          respaldar(info.id, b.modelo, 'borrador sin publicar');
          const msg = b.sha === info.sha
            ? `Tienes cambios sin publicar en este proyecto (${b.modelo.modulos.length} muebles). ¿Recuperarlos?`
            : `Tienes cambios sin publicar en este proyecto (${b.modelo.modulos.length} muebles), hechos antes de que el proyecto se modificara en el administrador.\n\n¿Recuperarlos? (Si no, quedan guardados en «Respaldos».)`;
          if (confirm(msg)) {
            modelo = { ...b.modelo, nombre: modelo.nombre || b.modelo.nombre };
            // el borrador ya trae la elección del cliente de ese momento; si cambió después, se aplica encima
            deCliente = cli?.sel && b.cliente !== cli.firma ? aplicarCliente(modelo, cli.sel) : null;
          }
          else aviso('Tu borrador quedó guardado en «Respaldos» (barra superior) por si lo necesitas.');
        }
      }
      if (modelo.modulos.some((m) => +m.rotacion)) aviso('Ojo: hay módulos girados (muro izquierdo); el editor los muestra sin girar.');
      if (deCliente && (deCliente.melamina || deCliente.piezas)) aviso(`Cargué lo que eligió el cliente en su portal: ${textoCambios(deCliente)}. Queda como base al publicar.`);
    }
    document.querySelector('.ed-cliente-aviso')?.remove();
    if (!modelo.frente) modelo.frente = MEL[0]?.id || '';
    modelo.modulos.forEach(normalizar);
    selMel.value = modelo.frente || ''; pintarColores();
    guardar(); render();
    if (!conservarVista) { zoom = 1; encuadrar(true); dibujarPlano(); }
    if (raw && modelo.modulos.length === 0) { setVista('frente'); setHerr('dibujar'); aviso('Proyecto vacío: dibuja el primer módulo arrastrando.'); }
  },
  pines(lista) { pines = lista; render({ panel: false }); },
  // Nueva lectura de la elección del cliente: tirador, cubierta, borde y muebles se ven al tiro; los materiales, con aviso.
  // Devuelve true si hay materiales nuevos por aplicar.
  clienteNuevo(cli) {
    if (!proyActual) return false;
    const visto = proyActual.cliente?.visto;
    proyActual.cliente = cli;
    cli.visto = cli.firma;
    render();
    if (!cli?.sel || cli.firma === visto) return !!document.querySelector('.ed-cliente-aviso');
    const c = aplicarCliente(JSON.parse(JSON.stringify(modelo)), cli.sel);
    if (!c.melamina && !c.piezas) return false;
    avisoCliente(c, cli.sel);
    return true;
  },
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

// ===================== versión nueva del editor =====================
// Una pestaña abierta sigue con el código con que se cargó. Si se publicó una versión nueva, se avisa para recargar.
async function revisarVersion() {
  try {
    const v = await fetch(`${window.DM.base}/assets/data/version.json`, { cache: 'no-store' }).then((r) => r.json());
    if (v.build && window.DM.build && v.build !== window.DM.build && !document.querySelector('.ed-version')) {
      const b = document.createElement('div');
      b.className = 'ed-version';
      b.innerHTML = 'Hay una versión nueva del editor. <button>Recargar</button><small>Tus cambios quedan guardados en este navegador.</small>';
      b.querySelector('button').addEventListener('click', () => location.reload());
      document.body.append(b);
    }
  } catch (e) {}
}
setInterval(revisarVersion, 3 * 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarVersion(); });
