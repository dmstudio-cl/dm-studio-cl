// Modelo de mueble por capas y su dibujo en CSS 3D (1 unidad = 1 cm).
//
// Formato (compatible con los "modulos" del portal / three/mueble.js):
// {
//   nombre, frente: <id melamina>,
//   modulos: [{
//     id, nombre, tipo, ancho, alto, profundidad, zocalo, x, elevacion, z, cubierta,
//     tablero,                                        // espesor de la melamina en mm (15 normal, 18 a veces)
//     materiales: { [pieza]: idMaterial },            // material propio de una pieza (editor): 'f|col|fila', 'cuerpo|izq', 'zocalo'…
//     quitar: ['piso', 'techo', 'fondo', 'izq', 'der'], // tableros del cuerpo que no lleva
//     zocalo_retiro,                                  // cm que el zócalo queda hacia adentro desde el frente
//     zocalo_atras, zocalo_izq, zocalo_der,           // retiros del marco del zócalo hacia la pared y los costados
//     vuelo_frente, vuelo_atras, vuelo_izq, vuelo_der, // cuánto sobresale la cubierta del cuerpo (barra de desayuno)
//     costados_atras,                                  // cm que los costados se alargan hacia atrás, hasta el piso (hueco para sillas)
//     luces: [{ id, en: 'modulo' | 'f|col|fila', lado: arriba|abajo|izq|der|atras, tono: calida|neutra|fria, intensidad }]
//     columnas: [{ ancho, frentes: [{ tipo, alto, bisagra, repisas, hojas }] }],   // hojas: puertas de la sección (puerta_doble)   // de izq. a der. / de arriba a abajo
//     tiradores: [{ id, modelo, color, col, fila, dx, dy, rot }],  // dx,dy: cm desde el centro del frente
//   }]
// }
// Capas: zócalo → cuerpo (costados, piso, techo, fondo) → frentes (puertas, cajones…) → tiradores → cubierta.

import { dibujarObjeto, OBJETOS } from './objetos.js';
import { ARTEFACTOS, cubiertaCoccion, acabado, cubaDe, escurridorDe, partesLavaplatos, ajustarArtefacto } from './artefactos.js';

export const T = 1.5;     // espesor de tablero por defecto: melamina de 15 mm
export const tablero = (m) => (+m?.tablero || 15) / 10; // espesor del módulo en cm (15 o 18 mm)
export const MAX_HOJA = 45; // ancho máximo de una hoja de puerta (cm): más ancha daña las bisagras
// Hojas de una sección con puertas (puerta_doble): al menos 2 y las necesarias para no pasar de 45 cm cada una
export const hojasMin = (w) => Math.max(2, Math.ceil(w / MAX_HOJA - 1e-6));
export const hojasDe = (fr, w) => Math.max(hojasMin(w), Math.round(+fr?.hojas || 0));
export const GAP = .3;    // luz entre frentes
export const CT = 3.8;    // espesor de cubierta
export const OVER = 2;    // vuelo frontal de la cubierta

export const TIPOS_FRENTE = {
  puerta: 'Puerta',
  puerta_doble: 'Puertas (2 o más hojas)',
  cajon: 'Cajón',
  panel: 'Panel fijo',
  abierto: 'Abierto (sin puerta)',
};

// ----- Biblioteca de tiradores prehechos -----
// Cada pieza es una caja en coordenadas locales del tirador: x a lo largo, y vertical, z hacia afuera
// del frente (0 = superficie del frente). rot = 0 → horizontal.
const barra = (cc) => ({
  nombre: `Barra ${cc * 10} mm`, largo: cc + 3,
  piezas: [
    { w: cc + 3, h: 1, d: 1, x: 0, y: 0, z: 2.9 },
    { w: 1, h: 1, d: 2.4, x: -cc / 2, y: 0, z: 1.2 },
    { w: 1, h: 1, d: 2.4, x: cc / 2, y: 0, z: 1.2 },
  ],
});
export const TIRADORES = {
  'barra-96': barra(9.6),
  'barra-128': barra(12.8),
  'barra-192': barra(19.2),
  'barra-320': barra(32),
  boton: { nombre: 'Botón', largo: 2.6, piezas: [{ w: 2.2, h: 2.2, d: 1.2, x: 0, y: 0, z: 2 }, { w: 1.2, h: 1.2, d: 1.6, x: 0, y: 0, z: .8 }] },
  canto: { nombre: 'Tirador de canto', largo: 15, piezas: [{ w: 15, h: .5, d: 2, x: 0, y: 0, z: 1 }, { w: 15, h: 1.6, d: .5, x: 0, y: .55, z: 2 }] },
  perfil: { nombre: 'Perfil gola 40 cm', largo: 40, piezas: [{ w: 40, h: 1.4, d: 1.8, x: 0, y: 0, z: .9 }] },
  concha: { nombre: 'Concha', largo: 9, piezas: [{ w: 9, h: 3.2, d: .7, x: 0, y: 0, z: .35 }, { w: 7, h: .8, d: 1.4, x: 0, y: -1.2, z: 1 }] },
};
export const COLORES_TIRADOR = { negro: '#151312', acero: '#a9aaa7', dorado: '#b8975a', blanco: '#e8e6e1' };

// ----- utilidades de datos -----
let nid = 0;
export const uid = (p = 'm') => `${p}${Date.now().toString(36)}${(nid++).toString(36)}`;

export function nuevoModulo({ x = 0, pz = 0, rotacion = 0, elevacion = 0, ancho = 60, alto = 85, profundidad, zocalo } = {}) {
  const aereo = elevacion > 100;
  const z = aereo ? 0 : (zocalo ?? 10);
  return {
    id: uid(), nombre: aereo ? 'Aéreo' : 'Módulo', tipo: aereo ? 'aereo' : 'base',
    ancho, alto, profundidad: profundidad ?? (aereo ? 35 : 58), zocalo: z, zocalo_retiro: 5,
    x, elevacion, z: pz, rotacion, cubierta: false,
    columnas: [{ ancho, frentes: [{ tipo: ancho > MAX_HOJA ? 'puerta_doble' : 'puerta', alto: alto - z, bisagra: 'izquierda' }] }],
    tiradores: [],
  };
}

// Celdas (frentes) de un módulo en coordenadas locales: x desde el costado izquierdo, y desde el piso.
// Cada celda: { col, fila, x, y, w, h } con x,y = centro. Misma lógica que three/mueble.js.
export function celdas(m) {
  const W = +m.ancho, H = +m.alto, Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
  const cols = m.columnas?.length ? m.columnas : [{ ancho: W, frentes: [{ tipo: 'puerta', alto: H - Z }] }];
  const sumW = cols.reduce((a, c) => a + (+c.ancho || 0), 0) || W;
  const kx = W / sumW;
  const out = [];
  let x0 = 0;
  cols.forEach((col, ci) => {
    const cw = (+col.ancho || 0) * kx;
    const frentes = col.frentes?.length ? col.frentes : [{ tipo: 'puerta', alto: H - Z }];
    const sumH = frentes.reduce((a, f) => a + (+f.alto || 0), 0) || (H - Z);
    const ky = (H - Z) / sumH;
    let ytop = H;
    frentes.forEach((fr, fi) => {
      const fh = (+fr.alto || 0) * ky;
      const repisas = fr.repisas != null && fr.repisas !== '' ? Math.max(0, Math.round(+fr.repisas) || 0) : fr.tipo === 'abierto' ? 1 : 0;
      const hojas = fr.tipo === 'puerta_doble' ? hojasDe(fr, cw) : 1;
      out.push({ col: ci, fila: fi, tipo: fr.tipo || 'puerta', repisas, hojas, x: x0 + cw / 2, y: ytop - fh / 2, w: cw, h: fh, x0, x1: x0 + cw, y0: ytop - fh, y1: ytop });
      ytop -= fh;
    });
    x0 += cw;
  });
  return out;
}

// ----- luces LED (ilusión en CSS: una tira que brilla y un halo con degradado que suma luz) -----
export const TONOS_LUZ = { calida: ['Cálida (2700 K)', '255, 176, 96'], neutra: ['Neutra (4000 K)', '255, 232, 196'], fria: ['Fría (6500 K)', '196, 222, 255'] };
export const LADOS_LUZ = { arriba: 'Arriba', abajo: 'Abajo', izq: 'Izquierda', der: 'Derecha', atras: 'Atrás' };
function dibujarLuz(G, m, L, { T, W, H, D, Z, cs }) {
  const rgb = (TONOS_LUZ[L.tono] || TONOS_LUZ.calida)[1], a = Math.max(.15, Math.min(1, L.intensidad == null ? .8 : +L.intensidad));
  const c = (k) => `rgba(${rgb}, ${Math.min(1, k * a).toFixed(2)})`;
  const halo = (dir) => (dir === 'radial' ? `radial-gradient(ellipse at 50% 50%, ${c(.7)}, ${c(.22)} 45%, rgba(${rgb}, 0) 72%)`
    : `linear-gradient(${dir}, ${c(.8)}, ${c(.3)} 35%, rgba(${rgb}, 0) 90%)`);
  const caja = (b, bg, caras) => G.box({ ...b, tex: { bg }, emisiva: true, ...(caras ? { caras } : {}) });
  const tira = (b) => caja(b, `linear-gradient(rgb(255, 255, 255), rgb(${rgb}))`);
  if (L.en === 'modulo') { // luz del mueble completo
    if (L.lado === 'abajo') { tira({ w: W - 4, h: .6, d: 1.2, x: W / 2, y: -.4, z: D - 5 }); caja({ w: W, h: 70, d: .01, x: W / 2, y: -35, z: .25 }, halo('to bottom'), ['front']); }
    if (L.lado === 'arriba') { tira({ w: W - 4, h: .6, d: 1.2, x: W / 2, y: H + .4, z: D - 5 }); caja({ w: W, h: 60, d: .01, x: W / 2, y: H + 30, z: .25 }, halo('to top'), ['front']); }
    if (L.lado === 'atras') caja({ w: W + 50, h: H + 40, d: .01, x: W / 2, y: H / 2, z: -.4 }, halo('radial'), ['front']);
    if (L.lado === 'izq') caja({ w: 50, h: H, d: .01, x: -25, y: H / 2, z: .25 }, halo('to left'), ['front']);
    if (L.lado === 'der') caja({ w: 50, h: H, d: .01, x: W + 25, y: H / 2, z: .25 }, halo('to right'), ['front']);
    return;
  }
  if (L.en === 'cubierta') { // bajo el vuelo de la cubierta (ej. el lado de las sillas de una isla): ilumina el costado del mueble
    const cb = cubiertaDe(m), yt = H - .4, alto = H - Z, g = halo('to bottom');
    if (L.lado === 'atras') { tira({ w: W - 4, h: .6, d: 1.2, x: W / 2, y: yt, z: -1.5 }); caja({ w: W, h: alto, d: .01, x: W / 2, y: Z + alto / 2, z: -.15 }, g, ['back']); }
    if (L.lado === 'frente') { tira({ w: W - 4, h: .6, d: 1.2, x: W / 2, y: yt, z: cb.z1 - 2 }); caja({ w: W, h: alto, d: .01, x: W / 2, y: Z + alto / 2, z: D + T + .2 }, g, ['front']); }
    if (L.lado === 'izq') { tira({ w: 1.2, h: .6, d: D - 4, x: -1.5, y: yt, z: D / 2 }); caja({ w: .01, h: alto, d: D, x: -.15, y: Z + alto / 2, z: D / 2 }, g, ['left']); }
    if (L.lado === 'der') { tira({ w: 1.2, h: .6, d: D - 4, x: W + 1.5, y: yt, z: D / 2 }); caja({ w: .01, h: alto, d: D, x: W + .15, y: Z + alto / 2, z: D / 2 }, g, ['right']); }
    return;
  }
  // Dentro de una sección: una luz por espacio (el hueco entre dos repisas), montada arriba de ese espacio
  // ("bajo la repisa"). esp = índice del espacio desde abajo (0 = sobre la base); sin esp = el espacio de arriba.
  const [, col, fila] = String(L.en).split('|').map(Number), k = cs.find((x) => x.col === col && x.fila === fila); if (!k) return;
  const xa = k.x0 + (k.x0 < .05 ? T : T / 2), xb = k.x1 - (k.x1 > W - .05 ? T : T / 2);
  const ya = k.y0 + (k.y0 <= Z + .05 ? T : T / 2), yb = k.y1 - (k.y1 >= H - .05 ? T : T / 2);
  const reps = nivelesRepisa(k), bordes = [ya, ...reps.flatMap((y) => [y - T / 2, y + T / 2]), yb]; // [piso, techo] de cada espacio
  const n = reps.length, e = Math.max(0, Math.min(n, L.esp == null ? n : +L.esp));
  const y0 = bordes[2 * e], y1 = bordes[2 * e + 1], w = xb - xa, h = y1 - y0, xm = (xa + xb) / 2, ym = (y0 + y1) / 2;
  if (h < 1) return;
  const lado = L.lado || 'arriba', zf = D - 4;
  const fondo = (dir) => caja({ w, h, d: .01, x: xm, y: ym, z: .75 }, halo(dir), ['front']);
  const piso = (y, cara) => caja({ w, h: .01, d: D - 1.5, x: xm, y, z: (D - 1.5) / 2 + .6 }, halo('radial'), [cara]);
  if (lado === 'arriba') { tira({ w: w - 1, h: .5, d: 1.2, x: xm, y: y1 - .35, z: zf }); fondo('to bottom'); piso(y0 + .06, 'top'); }
  if (lado === 'abajo') { tira({ w: w - 1, h: .5, d: 1.2, x: xm, y: y0 + .35, z: zf }); fondo('to top'); piso(y1 - .06, 'bottom'); }
  if (lado === 'izq') { tira({ w: .5, h: h - 1, d: 1.2, x: xa + .35, y: ym, z: zf }); fondo('to right'); }
  if (lado === 'der') { tira({ w: .5, h: h - 1, d: 1.2, x: xb - .35, y: ym, z: zf }); fondo('to left'); }
  if (lado === 'atras') { tira({ w: w - 2, h: .5, d: .6, x: xm, y: y1 - 1, z: 1.2 }); fondo('radial'); piso(y0 + .06, 'top'); }
}

// Marco del zócalo en coordenadas locales (x desde el costado izq., z desde la pared), con medidas válidas
export function marcoZocalo(m, T = tablero(m)) {
  const W = +m.ancho, D = +m.profundidad, min = 2 * T + 5;
  const izq = Math.max(0, +m.zocalo_izq || 0), der = Math.max(0, +m.zocalo_der || 0);
  const atras = Math.max(0, +m.zocalo_atras || 0), frente = Math.max(0, +m.zocalo_retiro || 0);
  const x0 = Math.min(izq, W - min), x1 = Math.max(x0 + min, W - der);
  const z0 = Math.min(atras, D - min), z1 = Math.max(z0 + min, D - frente);
  return { x0, x1, z0, z1, izq: x0, der: W - x1, atras: z0, frente: D - z1 };
}

// Alturas (y local) de las repisas de una celda: repartidas parejo en su alto.
export const nivelesRepisa = (c) => Array.from({ length: c.repisas || 0 }, (_, i) => c.y0 + c.h * (i + 1) / (c.repisas + 1));

// ----- bordes de cubierta -----
// Luz y sombra sobre el canto (frente y costados de la cubierta) que sugieren el perfil del borde.
const CANTOS = {
  recto: '',
  redondeado: 'linear-gradient(to bottom, rgba(255,255,255,.5), rgba(255,255,255,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,.35))',
  biselado: 'linear-gradient(to bottom, rgba(255,255,255,.6) 0 32%, rgba(0,0,0,.12) 32% 100%)',
  boleado: 'linear-gradient(to bottom, rgba(0,0,0,.15), rgba(255,255,255,.6) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,.5))',
  'media-cana': 'linear-gradient(to bottom, rgba(255,255,255,.45) 0 18%, rgba(0,0,0,.4) 45%, rgba(255,255,255,.3) 78%, rgba(0,0,0,.25))',
};
// Ícono del perfil (corte de la cubierta; el canto queda a la derecha)
export function iconoBorde(perfil) {
  const d = {
    recto: 'M4 6 H56 V18 H4 Z',
    redondeado: 'M4 6 H52 Q56 6 56 10 V18 H4 Z',
    biselado: 'M4 6 H50 L56 12 V18 H4 Z',
    boleado: 'M4 6 H50 A6 6 0 0 1 50 18 H4 Z',
    'media-cana': 'M4 6 H56 V8 Q50 12 56 16 V18 H4 Z',
  }[perfil] || 'M4 6 H56 V18 H4 Z';
  return `<svg viewBox="0 0 60 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}

// ----- tiradores para el portal del cliente -----
// El cliente elige un tirador del catálogo de precios: { forma: barra|boton|perfil|sin, color, largo (cm) }.
// Si el estudio ubicó tiradores a mano en el editor, se respetan sus posiciones y se cambia el modelo;
// si no, se ubican automáticamente con las mismas reglas que tenía three/mueble.js.
const BARRAS = [['barra-96', 9.6], ['barra-128', 12.8], ['barra-192', 19.2], ['barra-320', 32]];
const barraPara = (largo = 16) => BARRAS.reduce((a, b) => (Math.abs(b[1] - largo) < Math.abs(a[1] - largo) ? b : a))[0];

export function tiradoresCliente(m, sel) {
  const forma = sel?.forma || 'barra';
  if (forma === 'sin') return [];
  const color = sel?.color || COLORES_TIRADOR.negro;
  const cs = celdas(m);
  const celda = (t) => cs.find((k) => k.col === t.col && k.fila === t.fila);
  const modeloDe = (f, c, rot) => {
    if (f === 'boton') return { modelo: 'boton' };
    if (f === 'perfil') return { modelo: 'perfil', largo: (Math.abs(rot % 180) === 90 ? c.h : c.w) * .96 };
    return { modelo: barraPara(+sel?.largo || 16) };
  };
  // Tiradores ubicados a mano en el editor
  if (m.tiradores?.length) {
    return m.tiradores.filter(celda).map((t) => ({ ...t, ...(sel ? { ...modeloDe(forma, celda(t), +t.rot || 0), color } : {}) }));
  }
  // Ubicación automática
  const out = [];
  const largoBarra = TIRADORES[barraPara(+sel?.largo || 16)].largo;
  for (const c of cs) {
    const f = m.columnas[c.col].frentes[c.fila], tipo = f.tipo || 'puerta';
    if (!['puerta', 'puerta_doble', 'cajon'].includes(tipo)) continue;
    const id = `auto-${c.col}-${c.fila}`;
    const base = { col: c.col, fila: c.fila, color };
    const horizontal = tipo === 'cajon' || f.bisagra === 'arriba' || f.bisagra === 'abajo';
    if (horizontal) {
      // cajón y puertas abatibles: tirador horizontal junto al canto que se abre
      const abajo = f.bisagra === 'arriba';
      const off = forma === 'perfil' ? c.h / 2 - .7 : c.h / 2 - Math.min(forma === 'boton' ? 6 : 5, c.h / 3);
      out.push({ id, ...base, ...modeloDe(forma, c, 0), dx: 0, dy: abajo ? -off : off, rot: 0 });
      continue;
    }
    const aereo = m.tipo === 'aereo';
    const altoT = forma === 'boton' ? 0 : forma === 'perfil' ? 0 : largoBarra;
    const dy = forma === 'perfil' ? 0 : Math.max(0, c.h / 2 - altoT / 2 - (forma === 'boton' ? 6 : 4)) * (aereo ? -1 : 1);
    const margen = forma === 'perfil' ? .6 : forma === 'boton' ? 4 : 3.5;
    if (tipo === 'puerta_doble') { // cada hoja con su tirador, hacia el centro de la sección
      const n = c.hojas, lw = (c.w - (n - 1) * GAP) / n;
      for (let i = 0; i < n; i++) {
        const cx = -c.w / 2 + lw / 2 + i * (lw + GAP), s = i < (n - 1) / 2 ? 1 : i > (n - 1) / 2 ? -1 : 1;
        out.push({ id: `${id}-${i}`, ...base, ...modeloDe(forma, c, 90), dx: cx + s * (lw / 2 - margen), dy, rot: forma === 'boton' ? 0 : 90 });
      }
    } else {
      const lado = (f.bisagra || 'izquierda') === 'izquierda' ? 1 : -1; // se abre por el lado contrario a la bisagra
      out.push({ id, ...base, ...modeloDe(forma, c, 90), dx: lado * (c.w / 2 - margen), dy, rot: forma === 'boton' ? 0 : 90 });
    }
  }
  return out;
}

// Espacio de proyectos antiguos (solo largo × ancho): se dibujan el muro del fondo y el izquierdo,
// como lo hacía el visor Three.js.
export function espacioPortal(esp) {
  if (!esp) return null;
  if (esp.puntos?.length >= 2) return esp;
  const L = +esp.largo, A = +esp.ancho;
  if (!L && !A) return null;
  return { alto: +esp.alto || 240, cerrado: false, puntos: [{ x: 0, z: A || 260 }, { x: 0, z: 0 }, { x: L || 360, z: 0 }], muros: [{ espesor: 15 }, { espesor: 15 }] };
}

// ----- geometría en planta (x a lo largo del muro principal, z hacia la habitación) -----
// Rotación en planta igual que Three.js (rotation.y): con 90° el frente (+z) mira hacia +x.
export const girar = (x, z, deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; };
export const fondoTotal = (m) => +m.profundidad + (m.artefacto ? 0 : tablero(m)); // cuerpo + frentes
// Cubierta de un módulo en coordenadas locales: ancho W y fondo Dc (desde la pared hasta el canto)
// Vuelos de la cubierta (cm que sobresale del cuerpo por cada lado). Frente: 2 cm por defecto.
export const vuelosDe = (m) => ({ frente: m.vuelo_frente != null && m.vuelo_frente !== '' ? Math.max(0, +m.vuelo_frente) : OVER,
  atras: Math.max(0, +m.vuelo_atras || 0), izq: Math.max(0, +m.vuelo_izq || 0), der: Math.max(0, +m.vuelo_der || 0) });
// Cubierta en coordenadas locales: x0..x1 (desde el costado izq.), z0..z1 (desde la pared; z1 = canto del frente)
export const cubiertaDe = (m) => {
  const v = vuelosDe(m), W = +m.ancho, z1 = +m.profundidad + tablero(m) + v.frente;
  return { W, Dc: z1, x0: -v.izq, x1: W + v.der, z0: -v.atras, z1, v };
};
// Artefactos sobre la cubierta, con medidas válidas y su rectángulo local (x0..x1, z0..z1; z crece hacia el frente)
export function artefactosDe(m) {
  if (!m.cubierta || m.artefacto) return [];
  const { W, Dc } = cubiertaDe(m);
  return (m.artefactos || []).filter(Boolean).map((a) => {
    const v = ajustarArtefacto(a, W, Dc);
    return { ...v, x0: v.desde, x1: v.desde + v.ancho, z1: Dc - v.frente, z0: Dc - v.frente - v.fondo };
  });
}

// Esquinas del mueble en planta (atrás-izq, atrás-der, frente-der, frente-izq), en coordenadas del espacio.
export function huella(m) {
  const W = +m.ancho, D = fondoTotal(m), r = +m.rotacion || 0;
  return [[0, 0], [W, 0], [W, D], [0, D]].map(([x, z]) => { const [a, b] = girar(x, z, r); return [+m.x + a, +m.z + b]; });
}
// Centro del mueble en planta
export function centro(m) { const h = huella(m); return [(h[0][0] + h[2][0]) / 2, (h[0][1] + h[2][1]) / 2]; }
// Gira el mueble alrededor de su centro (mantiene el centro en su lugar)
export function rotarEnCentro(m, deg) {
  const [cx, cz] = centro(m);
  m.rotacion = ((deg % 360) + 360) % 360;
  const [lx, lz] = girar(+m.ancho / 2, fondoTotal(m) / 2, m.rotacion);
  m.x = Math.round((cx - lx) * 10) / 10; m.z = Math.round((cz - lz) * 10) / 10;
}

// Segmentos de muro (cara interior) del espacio: [{ i, a:[x,z], b:[x,z], largo, n:[nx,nz] hacia adentro, espesor, alto, etiqueta }]
export function muros(esp) {
  const P = esp?.puntos || [];
  if (P.length < 2) return [];
  const n = esp.cerrado && P.length > 2 ? P.length : P.length - 1;
  const cx = P.reduce((a, p) => a + +p.x, 0) / P.length, cz = P.reduce((a, p) => a + +p.z, 0) / P.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = [+P[i].x, +P[i].z], b = [+P[(i + 1) % P.length].x, +P[(i + 1) % P.length].z];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    let nn = [-dz / L, dx / L];
    // "Adentro" = hacia el centro de los puntos (sirve para habitaciones y para cocinas en L o en U)
    if ((cx - (a[0] + b[0]) / 2) * nn[0] + (cz - (a[1] + b[1]) / 2) * nn[1] < 0) nn = [-nn[0], -nn[1]];
    const meta = esp.muros?.[i] || {};
    out.push({ i, a, b, largo: L, n: nn, espesor: +meta.espesor || 15, alto: +meta.alto || +esp.alto || 240, etiqueta: meta.etiqueta || '', oculto: !!meta.oculto, vanos: Array.isArray(meta.vanos) ? meta.vanos : [] });
  }
  return out;
}

// ----- ventanas y puertas (vanos) en los muros -----
// Modelos de referencia: se insertan con estas medidas y luego se ajustan (ancho, alto, antepecho).
export const VANOS = {
  ventana: { nombre: 'Ventana', ancho: 120, alto: 110, antepecho: 100, hojas: 2 },
  ventana_cocina: { nombre: 'Ventana sobre cubierta', ancho: 100, alto: 70, antepecho: 110, hojas: 2 },
  ventana_alta: { nombre: 'Ventana alta', ancho: 80, alto: 40, antepecho: 170, hojas: 1 },
  ventanal: { nombre: 'Ventanal corredero', ancho: 180, alto: 210, antepecho: 0, hojas: 2 },
  puerta: { nombre: 'Puerta', ancho: 80, alto: 200, antepecho: 0, hojas: 1, puerta: true },
  puerta_doble: { nombre: 'Puerta doble', ancho: 140, alto: 200, antepecho: 0, hojas: 2, puerta: true },
  vano: { nombre: 'Vano libre', ancho: 90, alto: 210, antepecho: 0, hojas: 0 },
};
// Eje de un muro mirado desde adentro: u = de izquierda a derecha, O = extremo izquierdo (desde = 0),
// rot = giro de un mueble apoyado en él, linea = posición de su cara interior a lo largo de n.
export function ejeMuro(w) {
  const u = [w.n[1], -w.n[0]];
  const sa = w.a[0] * u[0] + w.a[1] * u[1], sb = w.b[0] * u[0] + w.b[1] * u[1];
  const O = sa <= sb ? w.a : w.b;
  const rot = ((Math.round(Math.atan2(w.n[0], w.n[1]) * 180 / Math.PI) % 360) + 360) % 360;
  return { u, O, rot, linea: w.a[0] * w.n[0] + w.a[1] * w.n[1] };
}
// Vanos del muro con medidas válidas (dentro del muro). desde = distancia desde el extremo izquierdo.
export function vanosDe(w) {
  return (w.vanos || []).filter(Boolean).map((v) => {
    const def = VANOS[v.tipo] || VANOS.vano;
    const ancho = Math.min(Math.max(10, +v.ancho || def.ancho), w.largo);
    const alto = Math.min(Math.max(10, +v.alto || def.alto), w.alto);
    const antepecho = def.puerta ? 0 : Math.min(Math.max(0, +v.antepecho || 0), w.alto - alto);
    const desde = Math.min(Math.max(0, +v.desde || 0), w.largo - ancho);
    return { id: v.id || '', tipo: VANOS[v.tipo] ? v.tipo : 'vano', ancho, alto, antepecho, desde, ...(v.material ? { material: v.material } : {}) };
  });
}

// Distancia desde el punto p, en la dirección dir, hasta la cara interior del muro más cercano.
export function distanciaAMuro(esp, p, dir) {
  let best = Infinity;
  for (const w of muros(esp)) {
    if (w.oculto) continue; // muro eliminado: no hay pared ahí
    const ex = w.b[0] - w.a[0], ez = w.b[1] - w.a[1];
    const den = dir[0] * ez - dir[1] * ex;
    if (Math.abs(den) < 1e-9) continue; // paralelo
    const t = ((w.a[0] - p[0]) * ez - (w.a[1] - p[1]) * ex) / den;   // avance sobre el rayo
    const u = ((w.a[0] - p[0]) * dir[1] - (w.a[1] - p[1]) * dir[0]) / den; // posición en el muro (0..1)
    if (t > -1 && u >= -0.001 && u <= 1.001 && t < best) best = t;
  }
  return best;
}

// Distancias del mueble a los muros desde el centro de cada lado: { atras, derecha, frente, izquierda } → { d, desde, dir }
export function distancias(m, esp) {
  const h = huella(m), out = {};
  const lados = { atras: [h[0], h[1]], derecha: [h[1], h[2]], frente: [h[2], h[3]], izquierda: [h[3], h[0]] };
  const [cx, cz] = centro(m);
  for (const [k, [a, b]] of Object.entries(lados)) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let dir = [mid[0] - cx, mid[1] - cz]; const L = Math.hypot(...dir) || 1; dir = [dir[0] / L, dir[1] / L];
    const d = distanciaAMuro(esp, mid, dir);
    if (isFinite(d)) out[k] = { d, desde: mid, dir };
  }
  return out;
}

// Límites del modelo completo (cm) para encuadrar: muebles girados y muros.
export function limites(modelo, { conMuros = true } = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
  for (const m of modelo.modulos) {
    for (const [x, z] of huella(m)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    y1 = Math.max(y1, +m.elevacion + +m.alto + (m.cubierta ? CT : 0));
  }
  for (const o of modelo.objetos || []) { // electrodomésticos sueltos
    const r = Math.max(+o.ancho || 0, +o.fondo || 0) / 2;
    x0 = Math.min(x0, +o.x - r); x1 = Math.max(x1, +o.x + r); z0 = Math.min(z0, +o.z - r); z1 = Math.max(z1, +o.z + r);
    y1 = Math.max(y1, (+o.elevacion || 0) + (+o.alto || 0));
  }
  if (conMuros) for (const w of muros(modelo.espacio)) {
    for (const [x, z] of [w.a, w.b]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    y1 = Math.max(y1, w.alto);
  }
  if (!isFinite(x0)) { x0 = 0; x1 = 120; z0 = 0; z1 = 60; y1 = 90; }
  return { x0, x1, y0: 0, y1, z0, z1, w: x1 - x0, h: y1, d: z1 - z0 };
}

// ----- dibujo CSS 3D -----
// st: escenario de css3d/engine.js. capas: { zocalo, cuerpo, frentes, tiradores, cubierta, muros } (true = visible).
// mats: { cuerpo, frente, zocalo, cubierta } → valores CSS "background" para cada material.
// Cada mueble se dibuja en un grupo con origen en su esquina trasera izquierda y girado en planta
// (igual que three/mueble.js), así el editor y el portal ubican todo en el mismo lugar.
export function dibujar(st, modelo, { capas = {}, mats = {}, sel = null } = {}) {
  st.clear();
  const ver = (k) => capas[k] !== false;
  const M = {
    cuerpo: { bg: mats.cuerpo || '#e9e6df' },
    frente: { bg: mats.frente || '#cfc6b8' },
    zocalo: { bg: mats.zocalo || '#3a3836' },
    cubierta: { bg: mats.cubierta || '#cfc9bc' },
    muro: { bg: mats.muro || '#57534e' },     // muros claros sobre el fondo oscuro, para que el espacio se lea
    cantoMuro: { bg: '#b9b2a7' },
    marco: { bg: mats.marco || '#d8d5cf' },
    vidrio: { bg: 'linear-gradient(135deg, rgba(196, 220, 232, .42), rgba(120, 150, 170, .18) 60%, rgba(196, 220, 232, .3))' },
    hoja: { bg: mats.hoja || '#b49a78' },
    costado: { bg: mats.costado || mats.cuerpo || '#e9e6df' }, // costados visibles (cuerpo o igual a la melamina)
    lavaplatos: mats.lavaplatos || 'acero', cocina: mats.cocina || 'acero',
    manilla: { bg: '#2a2725' },
    piso: mats.piso || '#2a2826',
    material: mats.material, // resolver de materiales por pieza (lo usan también las ventanas y puertas)
  };
  if (ver('muros')) dibujarEspacio(st, modelo.espacio, M);

  modelo.modulos.forEach((m) => {
    const W = +m.ancho, H = +m.alto, D = +m.profundidad;
    const Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
    const id = m.id;
    const T = tablero(m); // 1,5 cm (melamina 15 mm) o 1,8 cm
    const G = st.group({ x: +m.x, y: +m.elevacion, z: +m.z, ry: +m.rotacion || 0 });
    const B = (o, mat, ref) => G.box({ ...o, tex: mat, ref });
    if (m.artefacto) { dibujarCocinaPiso(G, m, M.cocina); return; } // cocina de piso: no lleva cuerpo de melamina

    // Material propio de una pieza (si el editor le asignó uno), probando de la clave más específica a la general
    const propio = (...claves) => {
      for (const k of claves) { const mid = m.materiales?.[k]; const bg = mid && mats.material?.(mid); if (bg) return { bg }; }
      return null;
    };
    const quitada = (p) => Array.isArray(m.quitar) && m.quitar.includes(p);
    if (ver('zocalo') && Z > 0) { // marco de 4 tablas bajo el cuerpo (no se ve vacío por los costados)
      const zr = marcoZocalo(m, T), MZ = propio('zocalo') || M.zocalo, rz = `${id}|zocalo`;
      const ancho = zr.x1 - zr.x0, fondo = zr.z1 - zr.z0;
      B({ w: ancho, h: Z, d: T, x: (zr.x0 + zr.x1) / 2, y: Z / 2, z: zr.z1 - T / 2 }, MZ, rz);              // frente
      B({ w: ancho, h: Z, d: T, x: (zr.x0 + zr.x1) / 2, y: Z / 2, z: zr.z0 + T / 2 }, MZ, rz);              // atrás
      B({ w: T, h: Z, d: fondo - 2 * T, x: zr.x0 + T / 2, y: Z / 2, z: (zr.z0 + zr.z1) / 2 }, MZ, rz);      // izquierda
      B({ w: T, h: Z, d: fondo - 2 * T, x: zr.x1 - T / 2, y: Z / 2, z: (zr.z0 + zr.z1) / 2 }, MZ, rz);      // derecha
    }
    if (ver('cuerpo')) {
      // costados: por dentro siempre del color del cuerpo; por fuera, como se eligió (general o de este mueble)
      const MC = m.costados === 'frente' ? M.frente : m.costados === 'cuerpo' ? M.cuerpo : M.costado;
      const lado = (cara, p) => propio(`cuerpo|${p}`, 'cuerpo') || ((c) => (c === cara || c === 'front' || c === 'top' || c === 'bottom' ? MC : M.cuerpo));
      const tab = (p) => propio(`cuerpo|${p}`, 'cuerpo') || M.cuerpo;
      const piso = quitada('piso') ? Z : Z + T; // sin base: el interior llega hasta abajo (ej. sobre una cubierta)
      // Costados alargados hacia atrás (isla con barra): llegan hasta la línea de la cubierta y bajan al piso, y el fondo
      // (los listones) queda retirado: el hueco sirve para las sillas.
      const ext = Math.max(0, +m.costados_atras || 0), cy0 = ext ? 0 : Z, dz = D + ext;
      if (!quitada('izq')) B({ w: T, h: H - cy0, d: dz, x: T / 2, y: cy0 + (H - cy0) / 2, z: (D - ext) / 2 }, lado('left', 'izq'), `${id}|cuerpo|izq`);     // costado izq.
      if (!quitada('der')) B({ w: T, h: H - cy0, d: dz, x: W - T / 2, y: cy0 + (H - cy0) / 2, z: (D - ext) / 2 }, lado('right', 'der'), `${id}|cuerpo|der`); // costado der.
      if (!quitada('piso')) B({ w: W - 2 * T, h: T, d: D, x: W / 2, y: Z + T / 2, z: D / 2 }, tab('piso'), `${id}|cuerpo|piso`); // base
      if (!quitada('techo')) B({ w: W - 2 * T, h: T, d: D, x: W / 2, y: H - T / 2, z: D / 2 }, tab('techo'), `${id}|cuerpo|techo`); // techo
      if (!quitada('fondo')) B({ w: W - 2 * T, h: H - piso - T, d: .6, x: W / 2, y: piso + (H - piso - T) / 2, z: .3 }, tab('fondo'), `${id}|cuerpo|fondo`); // fondo
    }
    if (ver('frentes')) {
      for (const c of celdas(m)) {
        const k = `f|${c.col}|${c.fila}`, ref = `${id}|${k}`;
        const fw = c.w - GAP, fh = c.h - GAP, zf = D + T / 2;
        const MF = propio(k, 'frentes') || M.frente, MD = propio(`${k}|div`, 'cuerpo') || M.cuerpo;
        if (c.tipo === 'abierto') { // sin puerta: se ve el interior blanco, con sus divisiones y repisas
          if (ver('cuerpo')) {
            const rd = `${ref}|div`;
            if (c.x0 > .05) B({ w: T, h: c.h, d: D, x: c.x0, y: c.y, z: D / 2 }, MD, rd);      // división izq.
            if (c.x1 < W - .05) B({ w: T, h: c.h, d: D, x: c.x1, y: c.y, z: D / 2 }, MD, rd);  // división der.
            if (c.y1 < H - .05) B({ w: c.w, h: T, d: D, x: c.x, y: c.y1, z: D / 2 }, MD, rd);  // división arriba
            if (c.y0 > Z + .05) B({ w: c.w, h: T, d: D, x: c.x, y: c.y0, z: D / 2 }, MD, rd);  // división abajo
            const xa = c.x0 + (c.x0 < .05 ? T : T / 2), xb = c.x1 - (c.x1 > W - .05 ? T : T / 2);
            const dr = D - 1.1; // repisa completa: desde el fondo hasta 0,5 cm del canto
            nivelesRepisa(c).forEach((y, i) => B({ w: xb - xa, h: T, d: dr, x: (xa + xb) / 2, y, z: .6 + dr / 2 }, propio(`${k}|rep|${i}`, `${k}|rep`, 'cuerpo') || M.cuerpo, `${ref}|rep|${i}`));
          }
        } else if (c.tipo === 'puerta_doble') { // n hojas iguales (máx. 45 cm cada una)
          const n = c.hojas, lw = (fw - (n - 1) * GAP) / n;
          for (let i = 0; i < n; i++) B({ w: lw, h: fh, d: T, x: c.x - fw / 2 + lw / 2 + i * (lw + GAP), y: c.y, z: zf }, MF, ref);
        } else {
          B({ w: fw, h: fh, d: T, x: c.x, y: c.y, z: zf }, MF, ref);
        }
      }
    }
    if (ver('luces') && Array.isArray(m.luces)) { const cs = celdas(m); for (const L of m.luces) if (L) dibujarLuz(G, m, L, { T, W, H, D, Z, cs }); }
    if (ver('tiradores')) {
      const cs = celdas(m);
      (m.tiradores || []).forEach((t) => {
        const c = cs.find((k) => k.col === t.col && k.fila === t.fila);
        const def = TIRADORES[t.modelo];
        if (!c || !def) return;
        const g = G.group({ x: c.x + (+t.dx || 0), y: c.y + (+t.dy || 0), z: D + T, rz: +t.rot || 0 });
        const color = { bg: COLORES_TIRADOR[t.color] || t.color || COLORES_TIRADOR.negro };
        // el perfil se estira al largo indicado (p. ej. el ancho del cajón)
        const piezas = t.modelo === 'perfil' && +t.largo ? def.piezas.map((p) => ({ ...p, w: +t.largo })) : def.piezas;
        for (const p of piezas) g.box({ ...p, tex: color, ref: `${id}|t|${t.id}` });
      });
    }
    if (ver('cubierta') && m.cubierta) {
      // el canto (frente y costados) lleva el perfil del borde elegido; la cara de arriba, el material
      const canto = CANTOS[mats.borde] || '';
      const MCub = propio('cubierta') || M.cubierta;
      const texCub = (cara) => (canto && ['front', 'left', 'right'].includes(cara) ? { bg: `${canto}, ${MCub.bg}` } : MCub);
      const cb = cubiertaDe(m), conCanto = (cara) => ['front', 'left', 'right', ...(cb.v.atras > 0 ? ['back'] : [])].includes(cara);
      const texC = (cara) => (canto && conCanto(cara) ? { bg: `${canto}, ${MCub.bg}` } : MCub);
      B({ w: cb.x1 - cb.x0 + .4, h: CT, d: cb.z1 - cb.z0, x: (cb.x0 + cb.x1) / 2, y: H + CT / 2, z: (cb.z0 + cb.z1) / 2 }, texC, `${id}|cubierta`);
      for (const a of artefactosDe(m)) dibujarArtefacto(G, a, H + CT, `${id}|a|${a.id}`, M);
    }
  });
  // Marca de selección: las caras de la pieza seleccionada se resaltan
  // electrodomésticos sueltos (refrigerador, microondas…)
  for (const o of modelo.objetos || []) if (o && OBJETOS[o.tipo]) dibujarObjeto(st, o, `obj|${o.id}`, M.cocina);
  if (sel) {
    const pref = [].concat(sel);
    for (const f of st.rig.querySelectorAll('[data-ref]')) if (pref.some((p) => f.dataset.ref.startsWith(p))) f.classList.add('c3-sel');
  }
}

// Encimera o lavaplatos sobre la cubierta (y = altura de la cara superior de la cubierta)
function dibujarArtefacto(G, a, y, ref, M) {
  const def = ARTEFACTOS[a.tipo] || ARTEFACTOS.encimera_gas, cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
  const caras = ['top', 'front', 'left', 'right', 'back'];
  if (!def.cubas) { // encimera: vidrio o acero negro casi a ras
    G.box({ w: a.ancho, h: .5, d: a.fondo, x: cx, y: y + .25, z: cz, tex: (c) => ({ bg: c === 'top' ? cubiertaCoccion(def, a.ancho, M.cocina) : '#151516' }), ref, caras });
    return;
  }
  const ac = acabado(M.lavaplatos);
  G.box({ w: a.ancho, h: .3, d: a.fondo, x: cx, y: y + .15, z: cz, tex: { bg: ac.base }, ref, caras }); // reborde
  const fz = a.fondo - 10; // cubas y escurridor: dejan 4 cm atrás (llave) y 6 adelante
  for (const p of partesLavaplatos(a, def)) {
    G.box({ w: p.x1 - p.x0, h: .1, d: fz, x: a.x0 + (p.x0 + p.x1) / 2, y: y + .35, z: a.z0 + 4 + fz / 2, tex: { bg: p.tipo === 'cuba' ? cubaDe(M.lavaplatos) : escurridorDe(M.lavaplatos) }, ref, caras: ['top'] });
  }
  // llave (grifería) detrás de la primera cuba
  const cuba = partesLavaplatos(a, def).find((p) => p.tipo === 'cuba');
  const kx = a.x0 + (cuba.x0 + cuba.x1) / 2;
  const llave = { bg: acabado('acero').base }; // la grifería se ve cromada
  G.box({ w: 3, h: 22, d: 3, x: kx, y: y + 11, z: a.z0 + 2.2, tex: llave, ref });
  G.box({ w: 2.4, h: 2.4, d: 17, x: kx, y: y + 21, z: a.z0 + 10, tex: llave, ref });
}
// Cocina de piso: cuerpo de acero, cubierta con quemadores, panel de perillas y puerta de horno
function dibujarCocinaPiso(G, m, color = 'acero') {
  const def = ARTEFACTOS[m.artefacto] || ARTEFACTOS.cocina4, W = +m.ancho, H = +m.alto, D = +m.profundidad, ref = `${m.id}|cuerpo`;
  const acero = { bg: acabado(color).cuerpo };
  G.box({ w: W, h: H - 1, d: D, x: W / 2, y: (H - 1) / 2, z: D / 2, tex: acero, ref, caras: ['left', 'right', 'back', 'front'] });
  G.box({ w: W, h: 1, d: D, x: W / 2, y: H - .5, z: D / 2, tex: (c) => ({ bg: c === 'top' ? cubiertaCoccion(def, W, color) : '#1b1b1c' }), ref });
  // panel de perillas
  const n = def.platos + 1;
  const perillas = Array.from({ length: n }, (_, i) => `radial-gradient(circle at ${((i + .5) / n * 100).toFixed(1)}% 50%, #1c1c1d 0 1.5em, #555 1.6em 1.8em, transparent 1.9em)`).join(', ');
  G.box({ w: W - 1, h: 9, d: .6, x: W / 2, y: H - 6.5, z: D + .3, tex: { bg: `${perillas}, linear-gradient(180deg, #c8ccce, #9ea3a6)` }, ref, caras: ['front'] });
  // puerta del horno con vidrio y manilla
  const hp = Math.min(55, H - 25);
  G.box({ w: W - 3, h: hp, d: 1, x: W / 2, y: 12 + hp / 2, z: D + .5, tex: { bg: 'linear-gradient(180deg, #a9adb0 0 12%, #1d2023 12% 88%, #a9adb0 88%)' }, ref, caras: ['front', 'top', 'left', 'right'] });
  G.box({ w: W - 14, h: 1.6, d: 2.5, x: W / 2, y: 12 + hp - 4, z: D + 2.4, tex: { bg: '#cfd2d4' }, ref });
  G.box({ w: W - 3, h: 9, d: .6, x: W / 2, y: 5.5, z: D + .3, tex: { bg: 'linear-gradient(180deg, #3a3b3d, #252627)' }, ref, caras: ['front'] }); // cajón inferior
}

// Ventana o puerta en el grupo del muro: marco y vidrio u hoja(s).
function dibujarVano(g, v, m, xl, k, M) {
  const def = VANOS[v.tipo], ref = `vano|${m.i}|${v.id}`, e = m.espesor;
  const cx = xl(v.desde + v.ancho / 2), y0 = v.antepecho, y1 = v.antepecho + v.alto, cy = (y0 + y1) / 2;
  // Solo caras que miran hacia adentro: así el vano desaparece junto con su muro (casa de muñecas).
  if (!def.hojas) return; // vano libre
  const zf = -e / 2; // plano del marco: al centro del muro
  // material propio (arrastrado desde la biblioteca): la hoja de la puerta o el marco de la ventana
  const propio = v.material && M.material?.(v.material), MMarco = !def.puerta && propio ? { bg: propio } : M.marco, MHoja = def.puerta && propio ? { bg: propio } : M.hoja;
  const barra = (w, h, x, y) => g.box({ w, h, d: 1, x, y, z: zf + .5, tex: MMarco, ref, caras: ['front'] });
  const F = 4; // ancho del perfil del marco (cm)
  if (def.puerta) {
    const n = def.hojas, hw = (v.ancho - 2 * F) / n;
    barra(F, v.alto, xl(v.desde + F / 2), cy); barra(F, v.alto, xl(v.desde + v.ancho - F / 2), cy); barra(v.ancho, F, cx, y1 - F / 2);
    for (let i = 0; i < n; i++) {
      const d0 = v.desde + F + i * hw, dc = d0 + hw / 2;
      g.box({ w: hw - .4, h: v.alto - F - .3, d: 1, x: xl(dc), y: (v.alto - F) / 2, z: zf + 1, tex: MHoja, ref, caras: ['front'] });
      // manilla: en una hoja, al lado derecho; en dos hojas, hacia el centro
      const dm = n === 1 ? d0 + hw - 7 : i === 0 ? d0 + hw - 6 : d0 + 6;
      g.box({ w: 2.5, h: 12, d: 2, x: xl(dm), y: 100, z: zf + 2.6, tex: M.manilla, ref, caras: ['front'] });
    }
    return;
  }
  // ventana: vidrio + marco perimetral + parante entre hojas
  g.box({ w: v.ancho - 2 * F, h: v.alto - 2 * F, d: .4, x: cx, y: cy, z: zf, tex: M.vidrio, ref, caras: ['front'] });
  barra(F, v.alto, xl(v.desde + F / 2), cy); barra(F, v.alto, xl(v.desde + v.ancho - F / 2), cy);
  barra(v.ancho - 2 * F, F, cx, y1 - F / 2); barra(v.ancho - 2 * F, F, cx, y0 + F / 2);
  for (let i = 1; i < def.hojas; i++) barra(F * .8, v.alto - 2 * F, xl(v.desde + v.ancho * i / def.hojas), cy);
}

// Muros "casa de muñecas": solo se dibuja la cara interior (y el canto superior). Como las caras
// tienen backface-visibility: hidden, los muros que dan hacia la cámara desaparecen solos y siempre
// se ve el interior. Piso con la forma de la planta (clip-path) si el espacio está cerrado.
function dibujarEspacio(st, esp, M) {
  const W = muros(esp);
  if (!W.length) return;
  const P = esp.puntos;
  // piso
  const xs = P.map((p) => +p.x), zs = P.map((p) => +p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const f = document.createElement('div');
  f.className = 'c3-floor c3-piso';
  const w = Math.max(1, x1 - x0), d = Math.max(1, z1 - z0);
  f.style.cssText = `width:${w}em;height:${d}em;border-radius:0;pointer-events:none;background:${M.piso};
    ${esp.cerrado && P.length > 2 ? `clip-path:polygon(${P.map((p) => `${((p.x - x0) / w * 100).toFixed(2)}% ${((p.z - z0) / d * 100).toFixed(2)}%`).join(',')});` : ''}
    transform: translate3d(${(x0 + x1) / 2}em, -.05em, ${(z0 + z1) / 2}em) rotateX(90deg) translate(-50%, -50%);`;
  st.rig.prepend(f);
  // muros
  const conectado = (i, fin) => esp.cerrado || (fin ? i < W.length - 1 : i > 0);
  for (const m of W) {
    if (m.oculto) continue; // muro eliminado en el editor
    const dx = m.b[0] - m.a[0], dz = m.b[1] - m.a[1];
    // eje local x a lo largo del muro; el frente local (+z) mira hacia adentro
    let ry = Math.atan2(-dz, dx) * 180 / Math.PI;
    const izq = [-dz / m.largo, dx / m.largo]; // hacia dónde mira +z con ese giro
    if (izq[0] * m.n[0] + izq[1] * m.n[1] < 0) ry += 180;
    const g = st.group({ x: (m.a[0] + m.b[0]) / 2, y: 0, z: (m.a[1] + m.b[1]) / 2, ry });
    const ref = `muro|${m.i}`;
    // posición local (eje x del grupo) de un punto a "d" cm del extremo izquierdo del muro
    const E = ejeMuro(m), gx = Math.cos(ry * Math.PI / 180), gz = -Math.sin(ry * Math.PI / 180);
    const mid = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
    const xl = (d) => (E.O[0] + d * E.u[0] - mid[0]) * gx + (E.O[1] + d * E.u[1] - mid[1]) * gz;
    const k = Math.sign(E.u[0] * gx + E.u[1] * gz) || 1; // +1 si "derecha" del muro = +x local
    const V = vanosDe(m);
    // cara del muro en franjas verticales, sin los huecos
    const cortes = [...new Set([0, m.largo, ...V.flatMap((v) => [v.desde, v.desde + v.ancho])])].sort((p, q) => p - q);
    for (let j = 0; j < cortes.length - 1; j++) {
      const d0 = cortes[j], d1 = cortes[j + 1]; if (d1 - d0 < .05) continue;
      const dm = (d0 + d1) / 2;
      let tramos = [[0, m.alto]];
      for (const v of V) {
        if (dm <= v.desde || dm >= v.desde + v.ancho) continue;
        const h0 = v.antepecho, h1 = v.antepecho + v.alto;
        tramos = tramos.flatMap(([y0, y1]) => [[y0, Math.min(y1, h0)], [Math.max(y0, h1), y1]]).filter(([y0, y1]) => y1 - y0 > .05);
      }
      for (const [y0, y1] of tramos) g.box({ w: d1 - d0, h: y1 - y0, d: m.espesor, x: xl(dm), y: (y0 + y1) / 2, z: -m.espesor / 2, tex: M.muro, ref, caras: ['front'] });
    }
    for (const v of V) dibujarVano(g, v, m, xl, k, M);
    // canto superior, alargado en las esquinas para cerrar el encuentro con el muro vecino
    const e0 = conectado(m.i, false) ? m.espesor : 0, e1 = conectado(m.i, true) ? m.espesor : 0;
    const ux = Math.cos(ry * Math.PI / 180), uz = -Math.sin(ry * Math.PI / 180); // eje x local en el espacio
    const s = Math.sign(ux * dx + uz * dz) || 1; // +1 si el eje local va de a hacia b
    g.box({ w: m.largo + e0 + e1, h: 1, d: m.espesor, x: s * (e1 - e0) / 2, y: m.alto - .5, z: -m.espesor / 2, tex: M.cantoMuro, ref, caras: ['top'] });
  }
}
