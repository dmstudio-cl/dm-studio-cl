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

import { fondoAcabado } from '../css3d/acabados.js';
import { dibujarObjeto, OBJETOS } from './objetos.js';
import { ARTEFACTOS, cubiertaCoccion, acabado, cubaDe, escurridorDe, partesLavaplatos, ajustarArtefacto } from './artefactos.js';
import { dibujarEsquinero, geoEsquinero, zonasCubiertaEsq } from './esquinero.js';

export const T = 1.5;     // espesor de tablero por defecto: melamina de 15 mm
export const tablero = (m) => (+m?.tablero || 15) / 10; // espesor del módulo en cm (15 o 18 mm)
export const MAX_HOJA = 45; // ancho máximo de una hoja de puerta (cm): más ancha daña las bisagras
// Hojas de una sección con puertas (puerta_doble): al menos 2 y las necesarias para no pasar de 45 cm cada una
export const hojasMin = (w) => Math.max(2, Math.ceil(w / MAX_HOJA - 1e-6));
export const hojasDe = (fr, w) => Math.max(hojasMin(w), Math.round(+fr?.hojas || 0));
export const GAP = .3;    // luz entre frentes
// Reparte el ancho del mueble en n puertas de la MISMA medida final. Cada puerta pierde 1,5 mm hacia cada vecino
// (3 mm de luz entre hojas) y nada hacia afuera, así que las columnas de los extremos quedan 1,5 mm más angostas que
// las del medio. divisiones: 'cada' (una división entre cada puerta) o 'pares' (una división cada 2 puertas: cada
// par es una sección de 2 hojas que abren hacia afuera; con 2 puertas, sin división). Las puertas sueltas abren hacia
// el centro del mueble; después se cambia con «Bisagra» en cada una. Devuelve la medida final de cada puerta (cm).
export function repartirPuertas(m, n, divisiones = 'cada') {
  const W = +m.ancho, H = +m.alto, Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
  n = Math.max(1, Math.round(n));
  const d = (W - (n - 1) * GAP) / n;
  const grupos = divisiones === 'pares' ? [...Array(Math.floor(n / 2)).fill(2), ...(n % 2 ? [1] : [])] : Array(n).fill(1);
  const repisas = m.columnas?.[0]?.frentes?.find((f) => f.tipo !== 'cajon')?.repisas;
  let i0 = 0; // índice de la primera puerta del grupo
  m.columnas = grupos.map((k, gi) => {
    const ancho = k * d + (k - 1) * GAP + (gi > 0 ? GAP / 2 : 0) + (gi < grupos.length - 1 ? GAP / 2 : 0);
    const fr = k === 1 ? { tipo: 'puerta', alto: H - Z, bisagra: i0 + .5 <= n / 2 ? 'izquierda' : 'derecha' } : { tipo: 'puerta_doble', alto: H - Z, hojas: k };
    if (repisas != null) fr.repisas = repisas;
    i0 += k;
    return { ancho: Math.round(ancho * 1000) / 1000, frentes: [fr] };
  });
  return d;
}
export const CT = 3.8;    // espesor de cubierta
export const OVER = 6;    // vuelo frontal de la cubierta desde la cara de las puertas (regla del estudio: cubierta = cuerpo + 7,8 cm)
export const CHOLGUAN = .3; // trasera de cholguán (3 mm), dentro de la profundidad del módulo

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
// cc = distancia entre centros (cm); g = grosor del tubo (cm). La barra sobresale 1,5 cm a cada lado de las patas.
const barra = (cc, g = 1) => ({
  nombre: `Barra ${Math.round(cc * 10)} mm`, largo: cc + 3,
  piezas: [
    { w: cc + 3, h: g, d: g, x: 0, y: 0, z: 2.4 + g / 2 },
    { w: g, h: g, d: 2.4, x: -cc / 2, y: 0, z: 1.2 },
    { w: g, h: g, d: 2.4, x: cc / 2, y: 0, z: 1.2 },
  ],
});
// Perilla o botón de diámetro d (cm)
const perilla = (d) => ({
  nombre: `Perilla ${Math.round(d * 10)} mm`, largo: d,
  piezas: [{ w: d, h: d, d: 1.2, x: 0, y: 0, z: 2 }, { w: d * .55, h: d * .55, d: 1.6, x: 0, y: 0, z: .8 }],
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

// Modelo de tirador por su nombre: los de la biblioteca, o a escala según medidas del catálogo:
// 'barra-<cc mm>[-<grosor mm>]' (ej. barra-160-12) y 'boton-<diámetro mm>' (ej. boton-25).
const TIR_CACHE = {};
export function tiradorDef(id) {
  if (!id) return null;
  if (TIRADORES[id]) return TIRADORES[id];
  if (TIR_CACHE[id]) return TIR_CACHE[id];
  let m = /^barra-(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/.exec(id);
  if (m) return (TIR_CACHE[id] = barra(+m[1] / 10, m[2] ? +m[2] / 10 : 1));
  m = /^boton-(\d+(?:\.\d+)?)$/.exec(id);
  if (m) return (TIR_CACHE[id] = perilla(+m[1] / 10));
  return null;
}
// Nombre del modelo a escala para un tirador del catálogo { forma, largo (cm), grosor (cm) }
export function modeloCatalogo(t) {
  const mm = (v) => Math.round(+v * 10);
  if (t?.forma === 'boton') return +t.largo > 0 && +t.largo <= 8 ? `boton-${mm(t.largo)}` : 'boton'; // sin diámetro real: el botón estándar
  if (t?.forma === 'perfil') return 'perfil';
  return `barra-${mm(+t?.largo || 16)}${+t?.grosor > 0 ? `-${mm(t.grosor)}` : ''}`;
}

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
  if (m?.tipo === 'esquinero') return []; // el esquinero tiene sus propios frentes (esquinero.js)
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
  // Por defecto (regla del estudio): el marco de pino se retira 5 cm del frente, 4 cm de la trasera de la base y 2 cm de cada costado
  const def = (v, d) => (v == null || v === '' ? d : Math.max(0, +v || 0));
  const izq = def(m.zocalo_izq, 2), der = def(m.zocalo_der, 2);
  const atras = def(m.zocalo_atras, 4 + CHOLGUAN), frente = def(m.zocalo_retiro, 5);
  const x0 = Math.min(izq, W - min), x1 = Math.max(x0 + min, W - der);
  const z0 = Math.min(atras, D - min), z1 = Math.max(z0 + min, D - frente);
  return { x0, x1, z0, z1, izq: x0, der: W - x1, atras: z0, frente: D - z1 };
}

// ----- muebles en L (decisión del dueño, 2026-11-22) -----
// Dos módulos a la misma altura y en escuadra, donde la espalda de uno (B) sigue la línea del costado del otro (A,
// el que ocupa la esquina) y B parte en el frente de A. Así se fabrican: bases separadas, pero
//  · una sola trasera de cholguán por ese muro: la de B se alarga y tapa el costado de A (ej. 150 + 60 = 210 cm);
//  · un solo zócalo en L (6 tablas) con los mismos retiros de un zócalo normal; lo lleva A.
// Devuelve [{ A, B, s, ladoB, caja }]: s = costado de A en la esquina ('izq' | 'der'); ladoB = extremo de B que toca a A;
// caja = rectángulo del cuerpo de B en coordenadas locales de A.
export function unionesL(modelo) {
  const ms = (modelo.modulos || []).filter((m) => m && !m.artefacto && m.tipo !== 'esquinero'), out = [];
  const aLocal = (A, [x, z]) => girar(x - +A.x, z - +A.z, -(+A.rotacion || 0));
  const mundo = (m, lx, lz) => { const [dx, dz] = girar(lx, lz, +m.rotacion || 0); return [+m.x + dx, +m.z + dz]; };
  for (const A of ms) for (const B of ms) {
    if (A === B || Math.abs((+A.elevacion || 0) - (+B.elevacion || 0)) > 1 || (A.tipo === 'aereo') !== (B.tipo === 'aereo')) continue;
    const dr = ((((+B.rotacion || 0) - (+A.rotacion || 0)) % 360) + 360) % 360;
    if (Math.abs(dr - 90) > 1 && Math.abs(dr - 270) > 1) continue;
    const WA = +A.ancho, DA = +A.profundidad, WB = +B.ancho, DB = +B.profundidad;
    const pts = [[0, 0], [WB, 0], [WB, DB], [0, DB]].map(([x, z]) => aLocal(A, mundo(B, x, z)));
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const caja = { bx0: Math.min(...xs), bx1: Math.max(...xs), bz0: Math.min(...zs), bz1: Math.max(...zs) };
    if (Math.abs(caja.bz0 - DA) > 3) continue; // B parte en el frente de A
    const espalda = aLocal(A, mundo(B, WB / 2, 0)); // medio de la espalda de B
    const s = Math.abs(espalda[0] - WA) < 2 && Math.abs(caja.bx1 - WA) < 2 ? 'der' : Math.abs(espalda[0]) < 2 && Math.abs(caja.bx0) < 2 ? 'izq' : null;
    if (!s) continue;
    const z0 = aLocal(A, mundo(B, 0, 0))[1], z1 = aLocal(A, mundo(B, WB, 0))[1];
    out.push({ A, B, s, ladoB: Math.abs(z0 - DA) < Math.abs(z1 - DA) ? 'izq' : 'der', caja });
  }
  return out;
}
// Zócalo en L en coordenadas locales de A: 6 tablas de espesor e (las que van a lo largo, completas; las otras, entre
// ellas). Retiros: los de A (atrás, frente y su extremo libre) y los de B (atrás = muro, frente y su extremo libre).
export function zocaloL(u, e) {
  const { A, B, s, ladoB, caja } = u, WA = +A.ancho, DA = +A.profundidad;
  const rA = marcoZocalo(A), rB = marcoZocalo(B);
  const fx = (x) => (s === 'der' ? x : WA - x); // se calcula con la esquina a la derecha y se refleja si va a la izquierda
  const bx0 = s === 'der' ? caja.bx0 : WA - caja.bx1, bx1 = s === 'der' ? caja.bx1 : WA - caja.bx0;
  const xa = s === 'der' ? rA.izq : rA.der, za = rA.atras, zf = DA - rA.frente;
  const xw = bx1 - rB.atras, xb = bx0 + rB.frente, zend = caja.bz1 - (ladoB === 'izq' ? rB.der : rB.izq);
  const tablas = [ // x0, x1, z0, z1 (con la esquina a la derecha)
    { nombre: 'atrás', x0: xa, x1: xw, z0: za, z1: za + e, largo: xw - xa },
    { nombre: 'frente', x0: xa, x1: xb + e, z0: zf - e, z1: zf, largo: xb + e - xa },
    { nombre: 'extremo del mueble en L', x0: xb, x1: xw, z0: zend - e, z1: zend, largo: xw - xb },
    { nombre: 'extremo de la esquina', x0: xa, x1: xa + e, z0: za + e, z1: zf - e, largo: zf - za - 2 * e },
    { nombre: 'muro', x0: xw - e, x1: xw, z0: za + e, z1: zend - e, largo: zend - za - 2 * e },
    { nombre: 'frente del mueble en L', x0: xb, x1: xb + e, z0: zf, z1: zend - e, largo: zend - zf - e },
  ];
  return tablas.filter((t) => t.largo > 0).map((t) => ({ ...t, x0: Math.min(fx(t.x0), fx(t.x1)), x1: Math.max(fx(t.x0), fx(t.x1)) }));
}

// Soportes superiores de los basales en L (regla del dueño, 2026-11-22): el delantero (melamina) y el trasero (pino)
// de cada mueble se unen a 45° en la esquina. Largo = desde la cara interior del costado libre hasta la punta larga
// del corte a 45° (Imperial corta el rectángulo; el inglete se hace en el taller). Devuelve, en x local de cada mueble,
// el tramo a dibujar (sin encimarse en la esquina) y el largo de corte: { A: { frente, atras }, B: { frente, atras } },
// cada uno { x0, x1, largo }.
export function soportesL(u, e = 2) {
  const { A, B, s, ladoB, caja } = u, WA = +A.ancho, DA = +A.profundidad;
  const tA = tablero(A), tB = tablero(B);
  const bx0 = s === 'der' ? caja.bx0 : WA - caja.bx1; // frente de B, con la esquina a la derecha
  const fx = (a, b) => (s === 'der' ? { x0: a, x1: b } : { x0: WA - b, x1: WA - a });
  const bz = (z) => (ladoB === 'izq' ? z - caja.bz0 : caja.bz1 - z); // z local de A → x local de B
  const tramoB = (z0, z1) => { const a = bz(z0), b = bz(z1); return { x0: Math.min(a, b), x1: Math.max(a, b) }; };
  const zFin = caja.bz1 - tB; // cara interior del costado libre de B
  return {
    A: {
      frente: { ...fx(tA, bx0 + tB), largo: bx0 + tB - tA },          // hasta la cara de atrás del soporte de B
      atras: { ...fx(tA, WA - e), largo: WA - tA },                    // hasta el rincón del muro (borde del mueble)
    },
    B: {
      frente: { ...tramoB(DA, zFin), largo: zFin - (DA - tA) },       // entra hasta la cara de atrás del soporte de A
      atras: { ...tramoB(0, zFin), largo: zFin },                       // sigue por el muro hasta el rincón
    },
  };
}

// Alturas (y local) de las repisas de una celda: repartidas parejo en su alto.
export const nivelesRepisa = (c) => Array.from({ length: c.repisas || 0 }, (_, i) => c.y0 + c.h * (i + 1) / (c.repisas + 1));
// Repisa fija o móvil (dueño, 2026-11-25). Fija: medida justa (ancho interior y fondo completo), va atornillada.
// Móvil: 2 mm más corta de ancho y 1 cm menos de fondo, se corre por dentro sobre soportes. Se marca en el panel de la
// repisa (fr.repisas_tipo = { [i]: 'fija' | 'movil' }); por defecto, fija en las torres y móvil en el resto.
export const repisaFija = (m, c, i) => { const t = m?.columnas?.[c.col]?.frentes?.[c.fila]?.repisas_tipo?.[i]; return t ? t === 'fija' : m?.tipo === 'torre'; };
// Divisiones horizontales entre secciones (dueño, 2026-11-25): un tablero fijo (justo, atornillado) en el borde entre
// dos filas de una misma columna. Va solo si al menos una de las dos secciones es abierta, y se pone o se quita a mano
// (fr.division = true | false en la fila de arriba). El 3D y el despiece usan esta misma lista.
export function divisionesH(m) {
  const cs = celdas(m), out = [];
  for (const c of cs) {
    const b = cs.find((o) => o.col === c.col && o.fila === c.fila + 1); if (!b) continue;
    const fr = m.columnas?.[c.col]?.frentes?.[c.fila] || {}, def = c.tipo === 'abierto' || b.tipo === 'abierto' || (esIsla(m) && (PUERTAS_ISLA.has(c.tipo) || PUERTAS_ISLA.has(b.tipo)));
    if (fr.division ?? def) out.push({ col: c.col, fila: c.fila, y: c.y0, x0: c.x0, x1: c.x1, def });
  }
  return out;
}

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
export function tiradoresCliente(m, sel) {
  const forma = sel?.forma || 'barra';
  if (forma === 'sin') return [];
  const color = sel?.color || COLORES_TIRADOR.negro;
  // esquinero: un solo dato con el modelo y el color; sus frentes dicen dónde va cada tirador (esquinero.js)
  if (m?.tipo === 'esquinero') return sel ? [{ id: 'esq', esq: true, modelo: modeloCatalogo({ forma, largo: sel.largo, grosor: sel.grosor }), color }] : (m.tiradores || []).filter((t) => t?.esq);
  const cs = celdas(m);
  const celda = (t) => cs.find((k) => k.col === t.col && k.fila === t.fila);
  // el modelo a escala con las medidas reales del tirador elegido (barra: entre centros y grosor; perilla: diámetro)
  const modeloDe = (f, c, rot) => {
    if (f === 'perfil') return { modelo: 'perfil', largo: (Math.abs(rot % 180) === 90 ? c.h : c.w) * .96 };
    return { modelo: modeloCatalogo({ forma: f, largo: sel?.largo, grosor: sel?.grosor }) };
  };
  // Tiradores ubicados a mano en el editor
  if (m.tiradores?.length) {
    return m.tiradores.filter(celda).map((t) => ({ ...t, ...(sel ? { ...modeloDe(forma, celda(t), +t.rot || 0), color } : {}) }));
  }
  // Ubicación automática
  const out = [];
  const largoBarra = tiradorDef(modeloCatalogo({ forma: 'barra', largo: sel?.largo, grosor: sel?.grosor })).largo;
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
  if (esp.puntos?.length >= 2 || esp.tramos?.length) return esp;
  const L = +esp.largo, A = +esp.ancho;
  if (!L && !A) return null;
  return { alto: +esp.alto || 240, cerrado: false, puntos: [{ x: 0, z: A || 260 }, { x: 0, z: 0 }, { x: L || 360, z: 0 }], muros: [{ espesor: 15 }, { espesor: 15 }] };
}

// ----- geometría en planta (x a lo largo del muro principal, z hacia la habitación) -----
// Rotación en planta igual que Three.js (rotation.y): con 90° el frente (+z) mira hacia +x.
// Costado dividido en partes (dueño, 2026-11-25): m.partes = { izq: [{ y0, y1, z0, z1 }], der: [...] }, en cm del mueble
// (y desde abajo del mueble, z desde atrás); null = hasta el borde del costado. Las partes borradas no están en la lista
// y cada parte que queda se pide como pieza aparte (ej. el costado de la caja del refrigerador que se apoya en el mesón).
export const partesCostado = (m, p) => (Array.isArray(m?.partes?.[p]) && m.partes[p].length ? m.partes[p] : null);
// Bordes del costado en el 3D: desde el zócalo (o el piso si se alarga atrás) hasta arriba; de atrás hacia el frente
export function bordesCostado(m) {
  const ext = Math.max(0, +m.costados_atras || 0), Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
  return { y0: ext ? 0 : Z, y1: +m.alto, z0: -ext, z1: +m.profundidad };
}
// Rectángulo real de una parte dentro de unos bordes (las medidas null llegan al borde)
export function rectParte(q, b) {
  const lim = (v, def, lo, hi) => (v == null || v === '' ? def : Math.max(lo, Math.min(hi, +v)));
  return { y0: lim(q.y0, b.y0, b.y0, b.y1), y1: lim(q.y1, b.y1, b.y0, b.y1), z0: lim(q.z0, b.z0, b.z0, b.z1), z1: lim(q.z1, b.z1, b.z0, b.z1) };
}

export const girar = (x, z, deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; };
export const fondoTotal = (m) => +m.profundidad + (m.artefacto || m.tipo === 'esquinero' || m.tipo === 'isla' ? 0 : tablero(m)); // cuerpo + frentes (el esquinero ya los incluye; la isla los lleva empotrados)
// ----- Isla (directrices del dueño, 2026-11-25) -----
// · La medida (ej. 120 cm de ancho) es la total. Cada costado es doble (2 caras, con tiras de melamina de 15 mm entre
//   ellas arriba, abajo y adelante, y una tapa adelante del ancho del grosor, unida a 45°) y se engruesa HACIA ADENTRO:
//   m.costado_grosor (cm, 5 por defecto; 1,5 = costado simple). El interior es lo que queda entre las caras interiores.
// · Puertas y cajones EMPOTRADOS: al ras del borde de los costados, entre costados y divisiones, con 3 mm de luz.
// · Una división en cada unión de puertas (entre columnas, entre las hojas de una sección y entre filas de puertas),
//   fija a la base, a la trasera y al soporte delantero; sus cantos quedan a la vista.
// · Trasera de melamina de 15 mm metida entre los costados (no lleva cholguán). El soporte trasero de pino va por dentro,
//   tapado por la trasera (dueño, 2026-11-25).
// · Todo lo que se ve, del color del frente (cara exterior de los costados, tapa, trasera y el tapacanto de los cantos).
// · Bisagras: se cotizan todas semicurvas (el dueño las define en persona después de aprobar).
// · Cubierta: 6 cm de vuelo en los 4 lados.
export const esIsla = (m) => m?.tipo === 'isla';
export const grosorCostado = (m) => {
  const T = tablero(m); if (!esIsla(m)) return T;
  const g = m.costado_grosor == null || m.costado_grosor === '' ? 5 : +m.costado_grosor;
  return Math.max(T, Math.min(15, Number.isFinite(g) ? g : 5));
};
const PUERTAS_ISLA = new Set(['puerta', 'puerta_doble', 'panel']);
// Frentes empotrados de una sección de isla: hueco libre con 3 mm de luz y, si son varias hojas, cada una separada por
// una división de 15 mm. { x0, x1, y0, y1, n, w (ancho de cada hoja), sep, hojas: [{ x0, x1 }] }
export function frentesIsla(m, c) {
  const T = tablero(m), G = grosorCostado(m), W = +m.ancho, H = +m.alto, Z = +m.zocalo || 0, L = .3;
  const q = Array.isArray(m.quitar) ? m.quitar : [], dvs = divisionesH(m);
  const arriba = dvs.some((d) => d.col === c.col && d.fila === c.fila - 1), abajo = dvs.some((d) => d.col === c.col && d.fila === c.fila);
  const x0 = c.x0 < .05 ? G + L : c.x0 + T / 2 + L, x1 = c.x1 > W - .05 ? W - G - L : c.x1 - T / 2 - L;
  const y0 = c.y0 <= Z + .05 ? Z + (q.includes('piso') ? 0 : T) + L : abajo ? c.y0 + T / 2 + L : c.y0 + L / 2;
  const y1 = c.y1 >= H - .05 ? H - (q.includes('soporte') ? 0 : 10) - L : arriba ? c.y1 - T / 2 - L : c.y1 - L / 2;
  const n = c.tipo === 'puerta_doble' ? Math.max(1, c.hojas || 1) : 1, sep = T + 2 * L;
  // uniones de hojas (1..n−1): con división de 15 mm, salvo las que se quitaron (fr.sin_div): ahí 3 mm entre hojas
  const sin = new Set(((m.columnas?.[c.col]?.frentes?.[c.fila] || {}).sin_div || []).map(Number));
  const seps = Array.from({ length: n - 1 }, (_, j) => (sin.has(j + 1) ? L : sep)), w = (x1 - x0 - seps.reduce((a, b) => a + b, 0)) / n;
  const hojas = [], divs = [], juntas = []; let x = x0;
  for (let i = 0; i < n; i++) {
    hojas.push({ x0: x, x1: x + w }); x += w;
    if (i < n - 1) { const s = seps[i]; juntas.push(x + s / 2); if (s > L + .01) divs.push({ i: i + 1, x: x + s / 2 }); x += s; }
  }
  return { x0, x1, y0, y1, n, w, sep, hojas, divs, juntas };
}
// Cubierta de un módulo en coordenadas locales: ancho W y fondo Dc (desde la pared hasta el canto)
// Vuelos de la cubierta (cm que sobresale del cuerpo por cada lado). Frente: 2 cm por defecto.
export const vuelosDe = (m) => {
  const v = (k, def) => (m[k] != null && m[k] !== '' ? Math.max(0, +m[k] || 0) : def), d = esIsla(m) ? OVER : 0; // isla: 6 cm en los 4 lados
  return { frente: v('vuelo_frente', OVER), atras: v('vuelo_atras', d), izq: v('vuelo_izq', d), der: v('vuelo_der', d) };
};
// Cubierta en coordenadas locales: x0..x1 (desde el costado izq.), z0..z1 (desde la pared; z1 = canto del frente)
export const cubiertaDe = (m) => {
  const v = vuelosDe(m), W = +m.ancho, z1 = +m.profundidad + (esIsla(m) ? 0 : tablero(m)) + v.frente; // la isla no tiene frentes por delante
  return { W, Dc: z1, x0: -v.izq, x1: W + v.der, z0: -v.atras, z1, v };
};
// Zonas de cubierta de un mueble en coordenadas locales ([{ x0, x1, z0, z1 }]): una en los muebles derechos y dos
// (la L) en el esquinero. Vacío si no lleva cubierta.
export function zonasCubierta(m) {
  if (!m?.cubierta || m.artefacto) return [];
  if (m.tipo === 'esquinero') return zonasCubiertaEsq(m);
  const c = cubiertaDe(m); return [{ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }];
}
const cubiertaArriba = (m) => (+m.elevacion || 0) + +m.alto + CT;
const dentroZonas = (zs, x, z, e = .5) => zs.some((r) => x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e);
// Artefactos sobre la cubierta, con medidas válidas y su rectángulo local (x0..x1, z0..z1; z crece hacia el frente).
// Se guardan con desde (del costado izquierdo) y frente (del canto del brazo 1 de la cubierta). Desde el 2026-11-25
// pueden quedar montados sobre la unión con el mueble vecino (cubierta continua), así que solo su centro queda dentro
// de este mueble. En el esquinero llevan giro (0 = de frente al brazo 1, ±90 = brazo 2, ±45 = en el rincón).
// pts = sus 4 esquinas en planta (locales, con el giro).
export function artefactosDe(m) {
  const zs = zonasCubierta(m); if (!zs.length) return [];
  const Dc = zs[0].z1, cl = (v, a, b) => Math.min(Math.max(v, a), b);
  const bx0 = Math.min(...zs.map((r) => r.x0)), bx1 = Math.max(...zs.map((r) => r.x1)), bz0 = Math.min(...zs.map((r) => r.z0)), bz1 = Math.max(...zs.map((r) => r.z1));
  return (m.artefactos || []).filter(Boolean).map((a) => {
    const def = ARTEFACTOS[a.tipo] || ARTEFACTOS.encimera_gas;
    const ancho = cl(+a.ancho || def.ancho, 20, 250), fondo = cl(+a.fondo || def.fondo, 20, 90);
    const cx = cl((+a.desde || 0) + ancho / 2, bx0, bx1), cz = cl(Dc - (+a.frente || 0) - fondo / 2, bz0, bz1);
    const giro = m.tipo === 'esquinero' ? +a.giro || 0 : 0;
    const pts = [[-ancho / 2, -fondo / 2], [ancho / 2, -fondo / 2], [ancho / 2, fondo / 2], [-ancho / 2, fondo / 2]].map(([x, z]) => { const [dx, dz] = girar(x, z, giro); return [cx + dx, cz + dz]; });
    const desde = cx - ancho / 2, frente = Dc - cz - fondo / 2;
    return { ...a, ancho, fondo, desde, frente, giro, cx, cz, x0: desde, x1: desde + ancho, z0: cz - fondo / 2, z1: cz + fondo / 2, pts };
  });
}
// Centro de un artefacto en planta (coordenadas del espacio)
export function centroArtefacto(m, aId) {
  const v = artefactosDe(m).find((x) => x.id === aId); if (!v) return null;
  const [dx, dz] = girar(v.cx, v.cz, +m.rotacion || 0); return [+m.x + dx, +m.z + dz];
}
// Mueve un artefacto de cubierta para que su centro quede en (wx, wz) del espacio (dueño, 2026-11-25): pasa al mueble
// cuya cubierta queda debajo de su centro y solo se acepta si las 4 esquinas se apoyan en alguna cubierta a la misma
// altura (cubierta continua entre muebles pegados). En el esquinero toma el giro del brazo donde cae (en el rincón
// conserva el que tenía); giro fuerza uno. Devuelve el id del mueble donde quedó, o null si ahí no se puede.
export function moverArtefacto(modelo, mId, aId, wx, wz, giro = null) {
  const m0 = modelo.modulos.find((x) => x.id === mId), raw = m0?.artefactos?.find((x) => x?.id === aId); if (!raw) return null;
  const v0 = artefactosDe(m0).find((x) => x.id === aId); if (!v0) return null;
  const local = (m, x, z) => girar(x - +m.x, z - +m.z, -(+m.rotacion || 0));
  const conCub = modelo.modulos.filter((m) => zonasCubierta(m).length);
  const dest = [m0, ...conCub.filter((m) => m !== m0)].find((m) => { const zs = zonasCubierta(m), [x, z] = local(m, wx, wz); return zs.length && dentroZonas(zs, x, z, 0); });
  if (!dest) return null;
  const zs = zonasCubierta(dest), [cx, cz] = local(dest, wx, wz);
  let gi = 0;
  if (dest.tipo === 'esquinero') {
    const izq = dest.esquina === 'izq', enB = dentroZonas([zs[1]], cx, cz, 0), rincon = !enB && cx >= zs[1].x0 && cx <= zs[1].x1;
    gi = giro != null ? giro : rincon ? (dest === m0 ? +raw.giro || 0 : 0) : enB ? (izq ? 90 : -90) : 0;
  }
  const cand = { ...raw, giro: gi, desde: cx - v0.ancho / 2, frente: zs[0].z1 - cz - v0.fondo / 2 };
  const v = artefactosDe({ ...dest, artefactos: [cand] })[0], y = cubiertaArriba(dest);
  const apoyada = v.pts.every(([lx, lz]) => {
    const [dx, dz] = girar(lx, lz, +dest.rotacion || 0), px = +dest.x + dx, pz = +dest.z + dz;
    return conCub.some((o) => Math.abs(cubiertaArriba(o) - y) < 1 && dentroZonas(zonasCubierta(o), ...local(o, px, pz)));
  });
  if (!apoyada) return null;
  raw.desde = Math.round(v.desde * 10) / 10; raw.frente = Math.round(v.frente * 10) / 10;
  if (dest.tipo === 'esquinero') raw.giro = gi; else delete raw.giro;
  if (dest !== m0) { m0.artefactos = m0.artefactos.filter((x) => x !== raw); dest.artefactos = [...(dest.artefactos || []), raw]; }
  return dest.id;
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
// Muros sueltos (dueño, 2026-11-25): esp.tramos = [{ a:{x,z}, b:{x,z}, espesor, alto, etiqueta, vanos, oculto, invertir }],
// cada uno de 2 puntos, dibujado con 2 clics. Van después de los del contorno (i = n + j) y guardan sus datos en el tramo.
export const murosContorno = (esp) => { const P = esp?.puntos || []; return P.length < 2 ? 0 : esp.cerrado && P.length > 2 ? P.length : P.length - 1; };
// Datos (etiqueta, espesor, alto, vanos, oculto) del muro i, sea del contorno o suelto; se crean si faltan
export function metaMuro(esp, i) {
  const n = murosContorno(esp);
  if (i >= n) return esp.tramos?.[i - n] || {};
  esp.muros = Array.isArray(esp.muros) ? esp.muros : [];
  return (esp.muros[i] ||= {});
}
// Acabados del espacio (dueño, 2026-11-25): son la habitación real del proyecto (el botón «Muros» del portal la oculta
// completa y quedan solo los muebles). Suelo: esp.acabados.suelo. Muro: meta.acabado para el muro entero, o
// meta.zonas = [{ x0, x1, y0, y1, acabado }] si se dividió en la vista Frente (x desde el extremo izquierdo mirado desde
// adentro, y desde el piso; null = hasta el borde) para combinar materiales. Acabado = pintura lisa, azulejo, etc.
export const metaMuroLeer = (esp, i) => { const n = murosContorno(esp); return (i < n ? esp?.muros?.[i] : esp?.tramos?.[i - n]) || {}; };
export function rectZona(q, L, H) {
  const lim = (v, d, hi) => (v == null || v === '' ? d : Math.max(0, Math.min(hi, +v)));
  return { x0: lim(q?.x0, 0, L), x1: lim(q?.x1, L, L), y0: lim(q?.y0, 0, H), y1: lim(q?.y1, H, H) };
}
const conAcabado = (a) => (a?.patron && a.patron !== 'ninguno' ? a : null);
export function zonasMuro(esp, i, L, H) {
  const meta = metaMuroLeer(esp, i), zs = Array.isArray(meta.zonas) && meta.zonas.length ? meta.zonas : [{ acabado: meta.acabado }];
  return zs.map((q, z) => ({ ...rectZona(q, L, H), z, acabado: conAcabado(q?.acabado), dividido: zs.length > 1 }));
}
export function muros(esp) {
  const P = esp?.puntos || [], T = (esp?.tramos || []).filter((t) => t?.a && t?.b);
  if (P.length < 2 && !T.length) return [];
  const n = murosContorno(esp);
  const todos = [...P, ...T.flatMap((t) => [t.a, t.b])];
  const cx = (P.length ? P : todos).reduce((a, p) => a + +p.x, 0) / (P.length || todos.length), cz = (P.length ? P : todos).reduce((a, p) => a + +p.z, 0) / (P.length || todos.length);
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
  (esp.tramos || []).forEach((t, j) => { // muros sueltos: adentro = hacia el centro del espacio (se puede invertir)
    if (!t?.a || !t?.b) return;
    const a = [+t.a.x, +t.a.z], b = [+t.b.x, +t.b.z], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    let nn = [-dz / L, dx / L];
    if ((cx - (a[0] + b[0]) / 2) * nn[0] + (cz - (a[1] + b[1]) / 2) * nn[1] < -1e-6) nn = [-nn[0], -nn[1]];
    if (t.invertir) nn = [-nn[0], -nn[1]];
    out.push({ i: n + j, tramo: j, a, b, largo: L, n: nn, espesor: +t.espesor || 15, alto: +t.alto || +esp.alto || 240, etiqueta: t.etiqueta || '', oculto: !!t.oculto, vanos: Array.isArray(t.vanos) ? t.vanos : [] });
  });
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

// Distancias de un artefacto de cubierta a los muros (dueño, 2026-11-25), igual que las de un mueble: desde el centro
// de cada lado, hacia afuera. { atras, derecha, frente, izquierda } → { d, desde, dir } (en el espacio).
export function distanciasArtefacto(m, aId, esp) {
  const v = artefactosDe(m).find((x) => x.id === aId); if (!v) return {};
  const r = +m.rotacion || 0, mundo = ([lx, lz]) => { const [dx, dz] = girar(lx, lz, r); return [+m.x + dx, +m.z + dz]; };
  const h = v.pts.map(mundo), c = mundo([v.cx, v.cz]), out = {};
  const lados = { atras: [h[0], h[1]], derecha: [h[1], h[2]], frente: [h[2], h[3]], izquierda: [h[3], h[0]] };
  for (const [k, [a, b]] of Object.entries(lados)) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let dir = [mid[0] - c[0], mid[1] - c[1]]; const L = Math.hypot(...dir) || 1; dir = [dir[0] / L, dir[1] / L];
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
// fabricacion: dibuja el mueble tal como se arma (basales sin techo, con soportes de 10 cm; puertas 7 cm bajo la
// cubierta o 1 cm sin ella; zócalo de pino). Por ahora solo lo usa el editor; el portal del cliente va sin él.
export function dibujar(st, modelo, { capas = {}, mats = {}, sel = null, fabricacion = false, interior = null, abrir = null, pisoClic = false } = {}) {
  st.clear();
  const ver = (k) => capas[k] !== false;
  const SOPORTE = 10;                       // alto de los soportes horizontales (cm)
  const PINO = { bg: mats.pino || 'linear-gradient(180deg, #d8bd94, #c7a877)' }; // pino tapa canteada
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
  if (ver('muros')) dibujarEspacio(st, modelo.espacio, M, { canto: ver('cantoMuro'), acab: ver('acabados'), pisoClic });
  const uniones = unionesL(modelo); // muebles en L: zócalo y trasera compartidos

  modelo.modulos.forEach((m) => {
    const W = +m.ancho, H = +m.alto, D = +m.profundidad;
    const Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
    const id = m.id;
    const T = tablero(m); // 1,5 cm (melamina 15 mm) o 1,8 cm
    const TC = grosorCostado(m), isla = esIsla(m); // costado (doble en la isla, crece hacia adentro)
    const ZF = isla ? D : D + T;                  // cara de adelante de los frentes (en la isla, empotrados al ras)
    // canto a la vista de una división: el material que se le soltó encima (clave «…|canto») o, en la isla, el color del frente
    const canto = (base, key) => {
      const pc = key && propio(`${key}|canto`); if (!isla && !pc) return base;
      const f = pc || M.frente; return (c) => (c === 'front' ? f : typeof base === 'function' ? base(c) : base);
    };
    const G = st.group({ x: +m.x, y: +m.elevacion, z: +m.z, ry: +m.rotacion || 0 });
    const B = (o, mat, ref) => G.box({ ...o, tex: mat, ref });
    if (m.artefacto) { dibujarCocinaPiso(G, m, M.cocina); return; } // cocina de piso: no lleva cuerpo de melamina
    const propioE = (...claves) => { for (const k of claves) { const mid = m.materiales?.[k]; const bg = mid && mats.material?.(mid); if (bg) return { bg }; } return null; };
    if (m.tipo === 'esquinero') {
      dibujarEsquinero(G, m, { M, ver, fab: fabricacion, propio: propioE, PINO, tiradorDef, colorTirador: (c) => COLORES_TIRADOR[c] || c, interior: interior?.id === m.id ? interior : null });
      if (ver('cubierta') && interior?.id !== m.id) for (const a of artefactosDe(m)) dibujarArtefacto(G, a, H + CT, `${id}|a|${a.id}`, M); // lavaplatos o encimera sobre la L
      return;
    }
    const esBasal = m.tipo !== 'aereo' && m.tipo !== 'torre';
    const fab = fabricacion && !m.artefacto;
    const recorteSup = fab ? (m.cubierta ? 7 : 1) : 0; // cuánto bajan los frentes del borde superior

    // Material propio de una pieza (si el editor le asignó uno), probando de la clave más específica a la general
    const propio = (...claves) => {
      for (const k of claves) { const mid = m.materiales?.[k]; const bg = mid && mats.material?.(mid); if (bg) return { bg }; }
      return null;
    };
    const quitada = (p) => Array.isArray(m.quitar) && m.quitar.includes(p);
    const uA = uniones.find((u) => u.A === m), uB = uniones.find((u) => u.B === m);
    // Mueble enfocado en el portal (dueño, 2026-11-25): sus puertas abren según su bisagra (recta 90°, semicurva 110°) y
    // sus cajones salen lo que mide su corredera. Cada parte que se mueve va en un grupo con su posición cerrada y abierta.
    const abre = abrir?.id === id && !m.artefacto, abiertos = abrir?.abiertos || [], grupos = {};
    if (ver('zocalo') && Z > 0 && uA) { // mueble en L: un solo zócalo en L (6 tablas) bajo los dos
      const MZ = propio('zocalo') || (fab ? PINO : M.zocalo);
      for (const t of zocaloL(uA, T)) B({ w: t.x1 - t.x0, h: Z, d: t.z1 - t.z0, x: (t.x0 + t.x1) / 2, y: Z / 2, z: (t.z0 + t.z1) / 2 }, MZ, `${id}|zocalo`);
    } else if (ver('zocalo') && Z > 0 && !uB) { // marco de 4 tablas bajo el cuerpo (no se ve vacío por los costados)
      const zr = marcoZocalo(m, T), MZ = propio('zocalo') || (fab ? PINO : M.zocalo), rz = `${id}|zocalo`;
      const ancho = zr.x1 - zr.x0, fondo = zr.z1 - zr.z0;
      B({ w: ancho, h: Z, d: T, x: (zr.x0 + zr.x1) / 2, y: Z / 2, z: zr.z1 - T / 2 }, MZ, rz);              // frente
      B({ w: ancho, h: Z, d: T, x: (zr.x0 + zr.x1) / 2, y: Z / 2, z: zr.z0 + T / 2 }, MZ, rz);              // atrás
      B({ w: T, h: Z, d: fondo - 2 * T, x: zr.x0 + T / 2, y: Z / 2, z: (zr.z0 + zr.z1) / 2 }, MZ, rz);      // izquierda
      B({ w: T, h: Z, d: fondo - 2 * T, x: zr.x1 - T / 2, y: Z / 2, z: (zr.z0 + zr.z1) / 2 }, MZ, rz);      // derecha
    }
    if (ver('cuerpo')) {
      // costados: por dentro siempre del color del cuerpo; por fuera, como se eligió (general o de este mueble)
      const MC = isla || m.costados === 'frente' ? M.frente : m.costados === 'cuerpo' ? M.cuerpo : M.costado;
      const lado = (cara, p) => propio(`cuerpo|${p}`, 'cuerpo') || ((c) => (c === cara || c === 'front' || c === 'top' || c === 'bottom' ? MC : M.cuerpo));
      const tab = (p) => propio(`cuerpo|${p}`, 'cuerpo') || M.cuerpo;
      const piso = quitada('piso') ? Z : Z + T; // sin base: el interior llega hasta abajo (ej. sobre una cubierta)
      // Costados alargados hacia atrás (isla con barra): llegan hasta la línea de la cubierta y bajan al piso, y el fondo
      // (los listones) queda retirado: el hueco sirve para las sillas.
      const ext = Math.max(0, +m.costados_atras || 0), cy0 = ext ? 0 : Z, dz = D + ext;
      const costado = (p, x, cara) => { // entero, o en partes si se dividió (cada parte se elige y se borra aparte)
        if (quitada(p)) return;
        const ps = partesCostado(m, p);
        if (!ps) { B({ w: TC, h: H - cy0, d: dz, x, y: cy0 + (H - cy0) / 2, z: (D - ext) / 2 }, lado(cara, p), `${id}|cuerpo|${p}`); return; }
        const bc = { y0: cy0, y1: H, z0: -ext, z1: D };
        ps.forEach((q, i) => {
          const r = rectParte(q, bc);
          if (r.y1 - r.y0 > .1 && r.z1 - r.z0 > .1) B({ w: TC, h: r.y1 - r.y0, d: r.z1 - r.z0, x, y: (r.y0 + r.y1) / 2, z: (r.z0 + r.z1) / 2 }, lado(cara, p), `${id}|cuerpo|${p}|p${i}`);
        });
      };
      costado('izq', TC / 2, 'left'); costado('der', W - TC / 2, 'right');
      if (!quitada('piso')) B({ w: W - 2 * TC, h: T, d: D, x: W / 2, y: Z + T / 2, z: D / 2 }, canto(tab('piso')), `${id}|cuerpo|piso`); // base
      if (isla) { // divisiones entre columnas: sus cantos se ven entre las puertas empotradas
        const xs = [...new Set(celdas(m).filter((c) => c.x1 < W - .05).map((c) => +c.x1.toFixed(2)))];
        xs.forEach((x, i) => B({ w: T, h: H - piso, d: D - T, x, y: piso + (H - piso) / 2, z: T + (D - T) / 2 }, canto(propio(`div|${i}`, 'cuerpo') || M.cuerpo, `div|${i}`), `${id}|cuerpo|dv${i}`));
      }
      // Techo de melamina: por defecto los basales no llevan (quedan abiertos arriba) y aéreos y torres sí;
      // cada mueble puede forzarlo con m.techo = 'si' | 'no' (ej. el nicho del microondas o una torre con placa arriba)
      const conTechoDib = m.techo === 'si' ? true : m.techo === 'no' ? false : !(fab && esBasal);
      if (!quitada('techo') && conTechoDib) B({ w: W - 2 * T, h: T, d: D, x: W / 2, y: H - T / 2, z: D / 2 }, tab('techo'), `${id}|cuerpo|techo`); // techo
      if (!quitada('fondo') && isla) B({ w: W - 2 * TC, h: H - piso, d: T, x: W / 2, y: piso + (H - piso) / 2, z: T / 2 }, propio('cuerpo|fondo') || ((c) => (c === 'back' || c === 'top' ? M.frente : M.cuerpo)), `${id}|cuerpo|fondo`); // isla: trasera de melamina entre los costados
      else if (!quitada('fondo')) B({ w: W - 2 * T, h: H - piso - T, d: .6, x: W / 2, y: piso + (H - piso - T) / 2, z: .3 }, tab('fondo'), `${id}|cuerpo|fondo`); // fondo
      if (uB && !quitada('fondo')) { // mueble en L: la trasera es una sola pieza que sigue y tapa el costado del mueble de la esquina
        const ex = +uB.A.profundidad, x0 = uB.ladoB === 'izq' ? -ex : 0, x1 = uB.ladoB === 'izq' ? W : W + ex;
        B({ w: x1 - x0, h: H - Z, d: .3, x: (x0 + x1) / 2, y: Z + (H - Z) / 2, z: -.15 }, tab('fondo'), `${id}|cuerpo|fondo`);
      }
      // Soportes horizontales de 10 cm (fabricación): delantero de melamina, trasero(s) de pino tapa
      if (fab && (esBasal || m.tipo === 'aereo')) {
        // en L (basales): cada soporte llega hasta la unión a 45° de la esquina
        const uS = esBasal && (uA || uB), sL = uS ? soportesL(uS)[uA ? 'A' : 'B'] : null;
        const tramo = (k) => (sL ? sL[k] : { x0: TC, x1: W - TC });
        const tf = tramo('frente'), ta = tramo('atras');
        if (!quitada('soporte')) B({ w: tf.x1 - tf.x0, h: SOPORTE, d: T, x: (tf.x0 + tf.x1) / 2, y: H - SOPORTE / 2, z: D - T / 2 }, propio('soporte') || (isla ? M.frente : M.cuerpo), `${id}|soporte|frente`); // color propio por mueble (en la isla se ve: color del frente)
        B({ w: ta.x1 - ta.x0, h: SOPORTE, d: T, x: (ta.x0 + ta.x1) / 2, y: H - SOPORTE / 2, z: isla ? T + T / 2 : T / 2 }, PINO, `${id}|soporte|atras`); // en la isla, por dentro: lo tapa la trasera de melamina
        const li = W - 2 * T;
        if (m.tipo === 'aereo') B({ w: li, h: SOPORTE, d: T, x: W / 2, y: Z + T + SOPORTE / 2, z: T / 2 }, PINO, `${id}|soporte|anclaje`);
      }
    }
    if (ver('frentes')) {
      if (ver('cuerpo')) for (const dv of divisionesH(m)) { // divisiones entre secciones: dentro de los costados
        const xa = dv.x0 + (dv.x0 < .05 ? TC : T / 2), xb = dv.x1 - (dv.x1 > W - .05 ? TC : T / 2), kd = `f|${dv.col}|${dv.fila}`;
        B({ w: xb - xa, h: T, d: isla ? D - T : D, x: (xa + xb) / 2, y: dv.y, z: isla ? T + (D - T) / 2 : D / 2 }, canto(propio(`${kd}|div`, 'cuerpo') || M.cuerpo, `${kd}|div`), `${id}|${kd}|div`);
      }
      // Repisa: fija (justa, hasta el canto) o móvil (más corta; en el editor lleva una marca roja en su canto)
      const repisas = (c, k, ref, xa, xb) => nivelesRepisa(c).forEach((y, i) => {
        const z0r = isla ? T : .6, zFr = isla && c.tipo !== 'abierto' ? D - T : D; // isla: desde la trasera hasta la puerta empotrada
        const fija = repisaFija(m, c, i), dr = fija ? zFr - z0r : zFr - z0r - .5, h = fija ? 0 : .1, mat = propio(`${k}|rep|${i}`, `${k}|rep`, 'cuerpo') || M.cuerpo;
        B({ w: xb - xa - 2 * h, h: T, d: dr, x: (xa + xb) / 2, y, z: z0r + dr / 2 }, mat, `${ref}|rep|${i}`);
        if (fab && !fija) B({ w: Math.max(1, xb - xa - 6), h: .3, d: .1, x: (xa + xb) / 2, y, z: z0r + dr + .05 }, { bg: '#b4322e' }, `${ref}|rep|${i}`);
      });
      for (const c of celdas(m)) {
        const k = `f|${c.col}|${c.fila}`, ref = `${id}|${k}`;
        // En fabricación, los frentes de la fila de arriba bajan 7 cm (con cubierta) o 1 cm del borde superior
        let cy = c.y, ch = c.h;
        if (fab && recorteSup && c.tipo !== 'abierto' && c.y1 >= H - .05) { ch = Math.max(5, (H - recorteSup) - c.y0); cy = c.y0 + ch / 2; }
        const fw = c.w - GAP, fh = ch - GAP, zf = D + T / 2;
        const MF = propio(k, 'frentes') || M.frente, MD = propio(`${k}|div`, 'cuerpo') || M.cuerpo;
        const FI = isla && c.tipo !== 'abierto' ? frentesIsla(m, c) : null;
        const divHojas = () => { if (FI && ver('cuerpo')) for (const dv of FI.divs) B({ w: T, h: FI.y1 - FI.y0 + .6, d: D - T, x: dv.x, y: (FI.y0 + FI.y1) / 2, z: T + (D - T) / 2 }, canto(propio(`${k}|dh${dv.i}`, `${k}|div`, 'cuerpo') || M.cuerpo, `${k}|dh${dv.i}`), `${ref}|dh${dv.i}`); }; // se elige y se quita con Supr
        if (FI && !abre) { // isla: frentes empotrados al ras de los costados y una división entre hojas
          FI.hojas.forEach((h) => B({ w: h.x1 - h.x0, h: FI.y1 - FI.y0, d: T, x: (h.x0 + h.x1) / 2, y: (FI.y0 + FI.y1) / 2, z: D - T / 2 }, MF, ref));
          divHojas(); continue;
        }
        if (c.tipo === 'abierto') { // sin puerta: se ve el interior blanco, con sus divisiones y repisas
          if (ver('cuerpo')) {
            const rd = `${ref}|div`;
            // regla del dueño (2026-11-25): repisas y divisiones horizontales van siempre DENTRO de los costados (y de las
            // divisiones verticales); los costados son piezas completas y no se ve el canto de ninguna repisa por fuera
            const xa = c.x0 + (c.x0 < .05 ? TC : T / 2), xb = c.x1 - (c.x1 > W - .05 ? TC : T / 2);
            if (c.x0 > .05 && !isla) B({ w: T, h: c.h, d: D, x: c.x0, y: c.y, z: D / 2 }, canto(propio(`div|${c.col - 1}`, 'cuerpo') || M.cuerpo, `div|${c.col - 1}`), `${id}|cuerpo|dv${c.col - 1}`);  // división vertical izq. (la isla las dibuja enteras)
            if (c.x1 < W - .05 && !isla) B({ w: T, h: c.h, d: D, x: c.x1, y: c.y, z: D / 2 }, canto(propio(`div|${c.col}`, 'cuerpo') || M.cuerpo, `div|${c.col}`), `${id}|cuerpo|dv${c.col}`); // división vertical der.
            repisas(c, k, ref, xa, xb); // las divisiones de arriba y abajo van en divisionesH()
          }
        } else if (abre) { // mueble enfocado: divisiones y repisas a la vista al abrir, puertas que giran y cajones que salen
          if (ver('cuerpo')) {
            if (c.x0 > .05 && !isla) B({ w: T, h: c.h, d: D, x: c.x0, y: c.y, z: D / 2 }, propio(`div|${c.col - 1}`, 'cuerpo') || M.cuerpo, `${id}|cuerpo|dv${c.col - 1}`);
            if (c.x1 < W - .05 && !isla) B({ w: T, h: c.h, d: D, x: c.x1, y: c.y, z: D / 2 }, propio(`div|${c.col}`, 'cuerpo') || M.cuerpo, `${id}|cuerpo|dv${c.col}`);
            const xa = c.x0 + (c.x0 < .05 ? TC : T / 2), xb = c.x1 - (c.x1 > W - .05 ? TC : T / 2); // dentro de los costados
            divHojas();
            if (c.tipo !== 'cajon') repisas(c, k, ref, xa, xb);
          }
          const fr = m.columnas?.[c.col]?.frentes?.[c.fila] || {}, x0f = FI ? FI.x0 : c.x - fw / 2;
          const hh = FI ? FI.y1 - FI.y0 : fh, yy = FI ? (FI.y0 + FI.y1) / 2 : cy;
          const hoja = (x0, x1, lado, ang, key) => { // bisagra en el canto izquierdo o derecho; abre hacia afuera
            const w = x1 - x0, izq = lado === 'izq', base = { x: izq ? x0 : x1, y: 0, z: ZF };
            const gr = grupoMovil(G, key, base, { ...base, ry: (izq ? -1 : 1) * ang }, .9, abiertos);
            gr.box({ w, h: hh, d: T, x: izq ? w / 2 : -w / 2, y: yy, z: -T / 2, tex: MF, ref });
            (grupos[`${c.col}|${c.fila}`] ||= []).push({ gr, x0, x1, ox: base.x, oz: base.z });
          };
          if (c.tipo === 'puerta') {
            if (fr.bisagra === 'arriba' || fr.bisagra === 'abajo') B({ w: fw, h: fh, d: T, x: c.x, y: cy, z: zf }, MF, ref); // abatible: por ahora queda cerrada
            else { const lado = fr.bisagra === 'derecha' ? 'der' : 'izq'; hoja(x0f, FI ? FI.x1 : x0f + fw, lado, FI ? 110 : anguloBisagra(m, c, lado === 'der' ? c.x1 : c.x0), ref); }
          } else if (c.tipo === 'puerta_doble') {
            const n = c.hojas, lw = FI ? FI.w : (fw - (n - 1) * GAP) / n, paso = FI ? FI.w + FI.sep : lw + GAP;
            for (let i = 0; i < n; i++) {
              const a = FI ? FI.hojas[i].x0 : x0f + i * paso, lado = i <= (n - 1) / 2 ? 'izq' : 'der';
              const ang = i === 0 ? anguloBisagra(m, c, c.x0) : i === n - 1 ? anguloBisagra(m, c, c.x1) : 110; // las del medio abren hacia otra puerta
              hoja(a, a + lw, lado, ang, `${ref}|h${i}`);
            }
          } else if (c.tipo === 'cajon') { // sale lo que mide su corredera, con su caja
            const xa = c.x0 + (c.x0 < .05 ? TC : T / 2) + 1.25, xb = c.x1 - (c.x1 > W - .05 ? TC : T / 2) - 1.25;
            const zFr = FI ? D - T : D; // la caja llega hasta la cara de atrás del frente (empotrado en la isla)
            const lc = Math.max(10, FI ? D - 2 * T - 2 : D - CHOLGUAN - 2), corr = CORREDERAS_M.filter((l) => l <= lc).pop() || CORREDERAS_M[0];
            const yb = FI ? FI.y0 + .2 : (c.y0 <= Z + .05 ? Z + T : c.y0) + .5, yt = Math.max(yb + 6, FI ? FI.y1 - 2 : cy + fh / 2 - 2), ac = yt - yb;
            const gr = grupoMovil(G, ref, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: corr }, .8, abiertos), NEG = { bg: '#141210' };
            gr.box({ w: FI ? FI.x1 - FI.x0 : fw, h: hh, d: T, x: FI ? (FI.x0 + FI.x1) / 2 : c.x, y: yy, z: FI ? D - T / 2 : zf, tex: MF, ref });
            const z0 = zFr - lc, bx = (x0, x1, y0, y1, za, zb, tex = M.cuerpo, extra = {}) => gr.box({ w: x1 - x0, h: y1 - y0, d: zb - za, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (za + zb) / 2, tex, ref, ...extra });
            bx(xa, xa + T, yb, yt, z0, zFr); bx(xb - T, xb, yb, yt, z0, zFr); bx(xa + T, xb - T, yb, yt - .8, z0, z0 + T); // laterales y trasera
            bx(xa + T, xb - T, yb + .3, yb + .4, z0 + T, zFr, { bg: '#e2ddd3' }, { caras: ['top'] });         // fondo
            for (const [p, q, r, t] of [[xa, xa + T, z0, zFr], [xb - T, xb, z0, zFr], [xa + T, xb - T, z0, z0 + T]]) bx(p, q, yt + .02, yt + .1, r, t, NEG, { caras: ['top'] }); // contorno negro arriba
            (grupos[`${c.col}|${c.fila}`] ||= []).push({ gr, x0: c.x0, x1: c.x1, ox: 0, oz: 0 });
          } else B({ w: fw, h: fh, d: T, x: c.x, y: cy, z: zf }, MF, ref);
        } else if (c.tipo === 'puerta_doble') { // n hojas iguales (máx. 45 cm cada una)
          const n = c.hojas, lw = (fw - (n - 1) * GAP) / n;
          for (let i = 0; i < n; i++) B({ w: lw, h: fh, d: T, x: c.x - fw / 2 + lw / 2 + i * (lw + GAP), y: cy, z: zf }, MF, ref);
        } else {
          B({ w: fw, h: fh, d: T, x: c.x, y: cy, z: zf }, MF, ref);
        }
      }
    }
    if (ver('luces') && Array.isArray(m.luces)) { const cs = celdas(m); for (const L of m.luces) if (L) dibujarLuz(G, m, L, { T, W, H, D, Z, cs }); }
    if (ver('tiradores')) {
      const cs = celdas(m);
      (m.tiradores || []).forEach((t) => {
        const c = cs.find((k) => k.col === t.col && k.fila === t.fila);
        const def = tiradorDef(t.modelo);
        if (!c || !def) return;
        const tx = c.x + (+t.dx || 0), gm = abre && (grupos[`${c.col}|${c.fila}`] || []).find((q) => tx >= q.x0 - .5 && tx <= q.x1 + .5); // se mueve con su puerta o cajón
        const g = gm ? gm.gr.group({ x: tx - gm.ox, y: c.y + (+t.dy || 0), z: ZF - gm.oz, rz: +t.rot || 0 }) : G.group({ x: tx, y: c.y + (+t.dy || 0), z: ZF, rz: +t.rot || 0 });
        const color = { bg: COLORES_TIRADOR[t.color] || t.color || COLORES_TIRADOR.negro };
        // el perfil se estira al largo indicado (p. ej. el ancho del cajón)
        const piezas = t.modelo === 'perfil' && +t.largo ? def.piezas.map((p) => ({ ...p, w: +t.largo })) : def.piezas;
        for (const p of piezas) g.box({ ...p, tex: color, ref: `${id}|t|${t.id}` });
      });
    }
    if (ver('cubierta') && m.cubierta) {
      // (dueño, 2026-11-25) el canto va del mismo material que la cubierta, como en el esquinero: sin la franja gris del
      // perfil de borde (el borde que elige el cliente se sigue guardando y se ve en su lista, con su ícono)
      const MCub = propio('cubierta') || M.cubierta, texC = MCub, cb = cubiertaDe(m);
      B({ w: cb.x1 - cb.x0 + .4, h: CT, d: cb.z1 - cb.z0, x: (cb.x0 + cb.x1) / 2, y: H + CT / 2, z: (cb.z0 + cb.z1) / 2 }, texC, `${id}|cubierta`);
      for (const a of artefactosDe(m)) dibujarArtefacto(G, a, H + CT, `${id}|a|${a.id}`, M);
    }
  });
  // Esquinero sin solución elegida: pin rojo «?» sobre el rincón (como los pines de comentarios)
  for (const m of modelo.modulos) {
    if (m?.tipo !== 'esquinero' || geoEsquinero(m).sol) continue;
    const g = geoEsquinero(m), [dx, dz] = girar(g.X(g.xb - g.T), g.fa + g.T, +m.rotacion || 0);
    const d = document.createElement('div');
    d.className = 'c3-pin esq-pin';
    d.style.transform = `translate3d(${+m.x + dx}em, ${-(+m.elevacion + g.H + (m.cubierta ? CT : 0) + 1)}em, ${+m.z + dz}em)`;
    d.innerHTML = '<span title="Falta elegir la solución de esta esquina" style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:grid;place-items:center;width:26px;height:26px;border-radius:50% 50% 50% 0;rotate:-45deg;background:#b4322e;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);font:700 14px/1 sans-serif;color:#fff"><b style="rotate:45deg">?</b></span>';
    st.rig.append(d);
  }
  // Marca de selección: las caras de la pieza seleccionada se resaltan
  // electrodomésticos sueltos (refrigerador, microondas…)
  for (const o of modelo.objetos || []) if (o && OBJETOS[o.tipo]) dibujarObjeto(st, o, `obj|${o.id}`, M.cocina);
  if (sel) {
    const pref = [].concat(sel);
    for (const f of st.rig.querySelectorAll('[data-ref]')) if (pref.some((p) => f.dataset.ref.startsWith(p))) f.classList.add('c3-sel');
  }
}

// ----- puertas y cajones que se abren (portal, mueble enfocado) -----
const CORREDERAS_M = [25, 30, 35, 40, 45, 50, 55, 60]; // largos comerciales (cm), los mismos de despiece.js
// Grupo que se mueve entre su posición cerrada y abierta: la transición CSS lo anima sin volver a dibujar la escena.
export function grupoMovil(G, key, base, abierto, dur, abiertos = []) {
  const tf = (p) => `translate3d(${p.x}em, ${-p.y}em, ${p.z}em) rotateY(${p.ry || 0}deg) rotateZ(0deg)`;
  // abierto si su clave está en la lista, si está la de su frente (ej. 'id|f|0|1' abre sus hojas 'id|f|0|1|h0'…) o '*' (todo)
  const abre = abiertos.some((k) => k === key || key.startsWith(k + '|') || (k === '*' && key !== 'giro'));
  const p = abre ? abierto : base, gr = G.group({ x: p.x, y: p.y, z: p.z, ry: p.ry || 0 });
  Object.assign(gr.el.dataset, { esqAnim: key, cerrado: tf(base), abierto: tf(abierto) });
  gr.el.style.transition = `transform ${dur}s ease-in-out`;
  return gr;
}
// Ángulo de apertura según la bisagra (dueño, 2026-11-25), con la misma regla del despiece: recta (90°) si va en un
// costado o si al otro lado no hay otra puerta; semicurva (110°) si va en una división compartida con otra puerta.
export function anguloBisagra(m, c, x) {
  const W = +m.ancho, interior = x > .05 && x < W - .05;
  if (!interior) return 90;
  const otra = celdas(m).find((o) => o !== c && (Math.abs(o.x1 - x) < .05 || Math.abs(o.x0 - x) < .05) && Math.min(o.y1, c.y1) - Math.max(o.y0, c.y0) > 1);
  return otra && otra.tipo !== 'abierto' ? 110 : 90;
}

// Encimera o lavaplatos sobre la cubierta (y = altura de la cara superior de la cubierta)
function dibujarArtefacto(G, a, y, ref, M) {
  if (a.giro) { // girado (esquinero): se dibuja en su propio grupo, centrado en su lugar
    const g2 = G.group({ x: a.cx, y: 0, z: a.cz, ry: a.giro });
    return dibujarArtefacto(g2, { ...a, giro: 0, cx: 0, cz: 0, x0: -a.ancho / 2, x1: a.ancho / 2, z0: -a.fondo / 2, z1: a.fondo / 2 }, y, ref, M);
  }
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
function dibujarEspacio(st, esp, M, { canto = true, acab = true, pisoClic = false } = {}) {
  const W = muros(esp);
  if (!W.length) return;
  const P = esp.puntos || [];
  // piso (con el contorno; los muros sueltos no cierran piso)
  const xs = (P.length >= 2 ? P : W.flatMap((m) => [{ x: m.a[0] }, { x: m.b[0] }])).map((p) => +p.x), zs = (P.length >= 2 ? P : W.flatMap((m) => [{ z: m.a[1] }, { z: m.b[1] }])).map((p) => +p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const f = document.createElement('div');
  f.className = 'c3-floor c3-piso';
  const w = Math.max(1, x1 - x0), d = Math.max(1, z1 - z0);
  const suelo = acab && esp.acabados?.suelo?.patron ? fondoAcabado(esp.acabados.suelo, { ox: x0, oy: z0, desdeArriba: true }) : M.piso; // palmeta, baldosa…
  if (pisoClic) f.dataset.ref = 'suelo'; // en el editor el suelo se toca para darle su acabado
  f.style.cssText = `width:${w}em;height:${d}em;border-radius:0;pointer-events:${pisoClic ? 'auto' : 'none'};background:${suelo};
    ${esp.cerrado && P.length > 2 ? `clip-path:polygon(${P.map((p) => `${((p.x - x0) / w * 100).toFixed(2)}% ${((p.z - z0) / d * 100).toFixed(2)}%`).join(',')});` : ''}
    transform: translate3d(${(x0 + x1) / 2}em, -.05em, ${(z0 + z1) / 2}em) rotateX(90deg) translate(-50%, -50%);`;
  st.rig.prepend(f);
  // muros
  const nC = murosContorno(esp), conectado = (i, fin) => i < nC && (esp.cerrado || (fin ? i < nC - 1 : i > 0)); // los sueltos no se unen
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
    // acabado: pintura y franja de revestimiento; el dibujo parte en el extremo izquierdo del muro y en el piso
    // zonas del muro con su acabado (sin acabado: el gris de siempre); el dibujo calza entre una franja y otra
    const ZS = acab ? zonasMuro(esp, m.i, m.largo, m.alto) : [{ x0: 0, x1: m.largo, y0: 0, y1: m.alto, z: 0, acabado: null, dividido: false }];
    const cara = (d0, d1, y0, y1) => {
      for (const Z of ZS) {
        const a = Math.max(d0, Z.x0), b = Math.min(d1, Z.x1), ya = Math.max(y0, Z.y0), yb = Math.min(y1, Z.y1);
        if (b - a < .05 || yb - ya < .05) continue;
        const w = b - a, xc = xl((a + b) / 2), tex = Z.acabado ? { bg: fondoAcabado(Z.acabado, { ox: xc - w / 2 + 5000, oy: ya }) } : M.muro;
        g.box({ w, h: yb - ya, d: m.espesor, x: xc, y: (ya + yb) / 2, z: -m.espesor / 2, tex, ref: Z.dividido ? `${ref}|z${Z.z}` : ref, caras: ['front'] });
      }
    };
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
      for (const [y0, y1] of tramos) cara(d0, d1, y0, y1);
    }
    for (const v of V) dibujarVano(g, v, m, xl, k, M);
    // canto superior, alargado en las esquinas para cerrar el encuentro con el muro vecino
    const e0 = conectado(m.i, false) ? m.espesor : 0, e1 = conectado(m.i, true) ? m.espesor : 0;
    const ux = Math.cos(ry * Math.PI / 180), uz = -Math.sin(ry * Math.PI / 180); // eje x local en el espacio
    const s = Math.sign(ux * dx + uz * dz) || 1; // +1 si el eje local va de a hacia b
    if (canto) g.box({ w: m.largo + e0 + e1, h: 1, d: m.espesor, x: s * (e1 - e0) / 2, y: m.alto - .5, z: -m.espesor / 2, tex: M.cantoMuro, ref, caras: ['top'] });
  }
}
