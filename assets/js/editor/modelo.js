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

export function nuevoModulo({ x = 0, elevacion = 0, ancho = 60, alto = 85, profundidad, zocalo } = {}) {
  const aereo = elevacion > 100;
  const z = aereo ? 0 : (zocalo ?? 10);
  return {
    id: uid(), nombre: aereo ? 'Aéreo' : 'Módulo', tipo: aereo ? 'aereo' : 'base',
    ancho, alto, profundidad: profundidad ?? (aereo ? 35 : 58), zocalo: z, zocalo_retiro: 5,
    x, elevacion, z: 0, cubierta: false,
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

// Límites del modelo completo (cm) para encuadrar.
export function limites(modelo) {
  let x0 = Infinity, x1 = -Infinity, y1 = 0, z1 = 0;
  for (const m of modelo.modulos) {
    x0 = Math.min(x0, +m.x); x1 = Math.max(x1, +m.x + +m.ancho);
    y1 = Math.max(y1, +m.elevacion + +m.alto + (m.cubierta ? CT : 0));
    z1 = Math.max(z1, +m.z + +m.profundidad + T);
  }
  if (!isFinite(x0)) { x0 = 0; x1 = 120; y1 = 90; z1 = 60; }
  return { x0, x1, y0: 0, y1, z0: 0, z1, w: x1 - x0, h: y1, d: z1 };
}

// ----- dibujo CSS 3D -----
// st: escenario de css3d/engine.js. capas: { zocalo, cuerpo, frentes, tiradores, cubierta } (true = visible).
// mats: { cuerpo, frente, zocalo, cubierta } → valores CSS "background" para cada material.
export function dibujar(st, modelo, { capas = {}, mats = {}, sel = null } = {}) {
  st.clear();
  const ver = (k) => capas[k] !== false;
  const M = {
    cuerpo: { bg: mats.cuerpo || '#e9e6df' },
    frente: { bg: mats.frente || '#cfc6b8' },
    zocalo: { bg: mats.zocalo || '#3a3836' },
    cubierta: { bg: mats.cubierta || '#cfc9bc' },
    hueco: { bg: '#24221f' },
  };
  // Los frentes ocupan el centro de la profundidad del cuerpo hacia adelante (z del mueble hacia el espectador).
  modelo.modulos.forEach((m, i) => {
    const W = +m.ancho, H = +m.alto, D = +m.profundidad;
    const Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
    const ox = +m.x, oy = +m.elevacion, oz = +m.z;
    const id = m.id;
    const B = (o, mat, ref) => st.box({ ...o, x: ox + o.x, y: oy + o.y, z: oz + o.z, tex: mat, ref });

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
          // hueco con repisa al centro (se selecciona desde la vista Frente o haciendo clic en la repisa)
          if (ver('cuerpo')) B({ w: c.w - 2 * T, h: T, d: D - 2, x: c.x, y: c.y, z: D / 2 }, M.cuerpo, ref);
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
        const g = st.group({ x: ox + c.x + (+t.dx || 0), y: oy + c.y + (+t.dy || 0), z: oz + D + T, rz: +t.rot || 0 });
        const color = { bg: COLORES_TIRADOR[t.color] || t.color || COLORES_TIRADOR.negro };
        for (const p of def.piezas) g.box({ ...p, tex: color, ref: `${id}|t|${t.id}` });
      });
    }
    if (ver('cubierta') && m.cubierta) {
      B({ w: W + .4, h: CT, d: D + OVER + T, x: W / 2, y: H + CT / 2, z: (D + OVER + T) / 2 }, M.cubierta, `${id}|cubierta`);
    }
  });
  // Marca de selección: las caras de la pieza seleccionada se resaltan
  if (sel) for (const f of st.rig.querySelectorAll('[data-ref]')) if (f.dataset.ref.startsWith(sel)) f.classList.add('c3-sel');
}
