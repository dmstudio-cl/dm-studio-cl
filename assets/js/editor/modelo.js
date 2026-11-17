// Modelo de mueble por capas y su dibujo en CSS 3D (1 unidad = 1 cm).
//
// Formato (compatible con los "modulos" del portal / three/mueble.js):
// {
//   nombre, frente: <id melamina>,
//   modulos: [{
//     id, nombre, tipo, ancho, alto, profundidad, zocalo, x, elevacion, z, cubierta,
//     zocalo_retiro,                                  // cm que el zócalo queda hacia adentro
//     columnas: [{ ancho, frentes: [{ tipo, alto, bisagra }] }],   // de izq. a der. / de arriba a abajo
//     tiradores: [{ id, modelo, color, col, fila, dx, dy, rot }],  // dx,dy: cm desde el centro del frente
//   }]
// }
// Capas: zócalo → cuerpo (costados, piso, techo, fondo) → frentes (puertas, cajones…) → tiradores → cubierta.

export const T = 1.8;     // espesor de tablero
export const GAP = .3;    // luz entre frentes
export const CT = 3.8;    // espesor de cubierta
export const OVER = 2;    // vuelo frontal de la cubierta

export const TIPOS_FRENTE = {
  puerta: 'Puerta',
  puerta_doble: 'Puerta doble',
  cajon: 'Cajón',
  panel: 'Panel fijo',
  abierto: 'Abierto (repisa)',
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
    columnas: [{ ancho, frentes: [{ tipo: 'puerta', alto: alto - z, bisagra: 'izquierda' }] }],
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
      out.push({ col: ci, fila: fi, tipo: fr.tipo || 'puerta', x: x0 + cw / 2, y: ytop - fh / 2, w: cw, h: fh, x0, x1: x0 + cw, y0: ytop - fh, y1: ytop });
      ytop -= fh;
    });
    x0 += cw;
  });
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
    if (tipo === 'puerta_doble') {
      for (const s of [-1, 1]) out.push({ id: `${id}-${s}`, ...base, ...modeloDe(forma, c, 90), dx: s * (GAP / 2 + margen), dy, rot: forma === 'boton' ? 0 : 90 });
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
export const fondoTotal = (m) => +m.profundidad + T; // cuerpo + frentes

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
    out.push({ i, a, b, largo: L, n: nn, espesor: +meta.espesor || 15, alto: +meta.alto || +esp.alto || 240, etiqueta: meta.etiqueta || '', oculto: !!meta.oculto });
  }
  return out;
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
    piso: mats.piso || '#2a2826',
  };
  if (ver('muros')) dibujarEspacio(st, modelo.espacio, M);

  modelo.modulos.forEach((m) => {
    const W = +m.ancho, H = +m.alto, D = +m.profundidad;
    const Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
    const id = m.id;
    const G = st.group({ x: +m.x, y: +m.elevacion, z: +m.z, ry: +m.rotacion || 0 });
    const B = (o, mat, ref) => G.box({ ...o, tex: mat, ref });

    if (ver('zocalo') && Z > 0) {
      const r = +m.zocalo_retiro || 0;
      B({ w: W, h: Z, d: T, x: W / 2, y: Z / 2, z: D - r - T / 2 }, M.zocalo, `${id}|zocalo`); // tabla retranqueada bajo el cuerpo
    }
    if (ver('cuerpo')) {
      const ref = `${id}|cuerpo`;
      B({ w: T, h: H - Z, d: D, x: T / 2, y: Z + (H - Z) / 2, z: D / 2 }, M.cuerpo, ref);     // costado izq. (sobre el zócalo)
      B({ w: T, h: H - Z, d: D, x: W - T / 2, y: Z + (H - Z) / 2, z: D / 2 }, M.cuerpo, ref); // costado der.
      B({ w: W - 2 * T, h: T, d: D, x: W / 2, y: Z + T / 2, z: D / 2 }, M.cuerpo, ref); // piso
      B({ w: W - 2 * T, h: T, d: D, x: W / 2, y: H - T / 2, z: D / 2 }, M.cuerpo, ref); // techo
      B({ w: W - 2 * T, h: H - Z - 2 * T, d: .6, x: W / 2, y: Z + (H - Z) / 2, z: .3 }, M.cuerpo, ref); // fondo
    }
    if (ver('frentes')) {
      for (const c of celdas(m)) {
        const ref = `${id}|f|${c.col}|${c.fila}`;
        const fw = c.w - GAP, fh = c.h - GAP, zf = D + T / 2;
        if (c.tipo === 'abierto') {
          if (ver('cuerpo')) B({ w: c.w - 2 * T, h: T, d: D - 2, x: c.x, y: c.y, z: D / 2 }, M.cuerpo, ref); // repisa
        } else if (c.tipo === 'puerta_doble') {
          const lw = (fw - GAP) / 2;
          for (const s of [-1, 1]) B({ w: lw, h: fh, d: T, x: c.x + s * (lw + GAP) / 2, y: c.y, z: zf }, M.frente, ref);
        } else {
          B({ w: fw, h: fh, d: T, x: c.x, y: c.y, z: zf }, M.frente, ref);
        }
      }
    }
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
      const texCub = (cara) => (canto && ['front', 'left', 'right'].includes(cara) ? { bg: `${canto}, ${M.cubierta.bg}` } : M.cubierta);
      B({ w: W + .4, h: CT, d: D + OVER + T, x: W / 2, y: H + CT / 2, z: (D + OVER + T) / 2 }, texCub, `${id}|cubierta`);
    }
  });
  // Marca de selección: las caras de la pieza seleccionada se resaltan
  if (sel) for (const f of st.rig.querySelectorAll('[data-ref]')) if (f.dataset.ref.startsWith(sel)) f.classList.add('c3-sel');
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
    g.box({ w: m.largo, h: m.alto, d: m.espesor, x: 0, y: m.alto / 2, z: -m.espesor / 2, tex: M.muro, ref, caras: ['front'] });
    // canto superior, alargado en las esquinas para cerrar el encuentro con el muro vecino
    const e0 = conectado(m.i, false) ? m.espesor : 0, e1 = conectado(m.i, true) ? m.espesor : 0;
    const ux = Math.cos(ry * Math.PI / 180), uz = -Math.sin(ry * Math.PI / 180); // eje x local en el espacio
    const s = Math.sign(ux * dx + uz * dz) || 1; // +1 si el eje local va de a hacia b
    g.box({ w: m.largo + e0 + e1, h: 1, d: m.espesor, x: s * (e1 - e0) / 2, y: m.alto - .5, z: -m.espesor / 2, tex: M.cantoMuro, ref, caras: ['top'] });
  }
}
