// Acabados de muros y suelo (dueño, 2026-11-25): azulejos, palmetas y baldosas dibujados en SVG a escala real
// (1 em = 1 cm) y con el color que se quiera (también sacado con el cuentagotas de una foto de inspiración).
// Un acabado: { patron, largo, ancho (cm), junta (mm), color, color2, color_junta, variacion (0–40 %), giro (0 | 90) }.
// La biblioteca de acabados listos está en _data/acabados.yml (editable en /admin → Acabados de muros y suelo).

export const PATRONES = {
  liso: { nombre: 'Liso (solo color)', medidas: false },
  recto: { nombre: 'Recto (cuadrícula)' },
  trabado: { nombre: 'Trabado (metro o ladrillo)' },
  espiga: { nombre: 'Espiga (parquet)' },
  hexagonal: { nombre: 'Hexagonal', soloLargo: true },
  tablas: { nombre: 'Tablas (palmeta o piso flotante)' },
  damero: { nombre: 'Damero (2 colores)', color2: true },
};

const HEX = /^#[0-9a-f]{6}$/i;
export const colorValido = (c, def) => (HEX.test(String(c || '')) ? String(c).toLowerCase() : def);
// Acabado con medidas válidas (el editor y el Worker guardan lo mismo)
export function normalizar(a = {}) {
  const patron = PATRONES[a.patron] ? a.patron : 'liso';
  const n = (v, def, lo, hi) => { const x = +v; return Number.isFinite(x) && x > 0 ? Math.max(lo, Math.min(hi, x)) : def; };
  const largo = n(a.largo, 30, 2, 300), ancho = n(a.ancho, PATRONES[patron].soloLargo ? largo : 30, 1, 300);
  return {
    patron, largo, ancho,
    junta: Math.max(0, Math.min(20, Number.isFinite(+a.junta) ? +a.junta : 2)),
    color: colorValido(a.color, '#e9e6df'), color2: colorValido(a.color2, '#2a2928'), color_junta: colorValido(a.color_junta, '#bdb8ae'),
    variacion: Math.max(0, Math.min(40, +a.variacion || 0)), giro: +a.giro === 90 ? 90 : 0,
  };
}

// Aclara u oscurece un color (k entre -1 y 1)
function tono(hex, k) {
  const v = parseInt(hex.slice(1), 16), c = [v >> 16, (v >> 8) & 255, v & 255];
  const t = c.map((x) => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)));
  return `#${t.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
}
// Número pseudoaleatorio estable (el mismo dibujo cada vez)
const azar = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const r2 = (x) => Math.round(x * 100) / 100;

// Mosaico SVG que se repite: { svg, w, h } en cm
export function mosaico(a0) {
  const a = normalizar(a0), j = a.junta / 10, L = a.largo, A = a.ancho, V = a.variacion / 100;
  const col = (i) => (V ? tono(a.color, (azar(i) - .5) * 2 * V) : a.color);
  const rect = (x, y, w, h, c) => `<rect x="${r2(x + j / 2)}" y="${r2(y + j / 2)}" width="${r2(Math.max(.05, w - j))}" height="${r2(Math.max(.05, h - j))}" fill="${c}"/>`;
  let w, h, cuerpo = '';
  if (a.patron === 'recto' || a.patron === 'damero') {
    const n = a.patron === 'damero' ? 2 : V ? 4 : 1; w = n * L; h = n * A;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) cuerpo += rect(i * L, k * A, L, A, a.patron === 'damero' ? ((i + k) % 2 ? a.color2 : a.color) : col(i * 7 + k));
  } else if (a.patron === 'trabado') {
    const n = V ? 4 : 1; w = n * L; h = 2 * n * A;
    for (let f = 0; f < 2 * n; f++) for (let i = -1; i <= n; i++) cuerpo += rect(i * L + (f % 2 ? L / 2 : 0), f * A, L, A, col(f * 13 + ((i + n) % n)));
  } else if (a.patron === 'tablas') { // filas de tablas con la unión corrida al azar y un poco de veta
    const filas = 6, n = 3; w = n * L; h = filas * A;
    for (let f = 0; f < filas; f++) {
      const off = [0, .5, .25, .75, .38, .62][f] * L;
      for (let i = -1; i <= n; i++) {
        const x = i * L + off, c = col(f * 17 + ((i + n) % n));
        cuerpo += rect(x, f * A, L, A, c);
        for (let v = 1; v <= 2; v++) cuerpo += `<rect x="${r2(x + j)}" y="${r2(f * A + A * (v / 3) + (azar(f * 31 + ((i + n) % n) * 5 + v) - .5) * A * .2)}" width="${r2(L - 2 * j)}" height="${r2(Math.max(.06, A * .02))}" fill="#000" opacity=".07"/>`;
      }
    }
  } else if (a.patron === 'espiga') { // tablas en espiga: el largo se redondea a un múltiplo del ancho
    const n = Math.max(2, Math.round(L / A)), Lr = n * A, P = 2 * Lr; w = P; h = P;
    for (let i = -2 * n - 2; i <= 2 * n + 2; i++) for (let k = -2; k <= 3; k++) {
      const ox = i * A + k * Lr, oy = i * A - k * Lr, u = ((i - n * k) % (2 * n) + 2 * n) % (2 * n);
      const piezas = [[ox, oy, Lr, A, 0], [ox + Lr, oy + A - Lr, A, Lr, 1]];
      for (const [x, y, pw, ph, t] of piezas) if (x < P && y < P && x + pw > 0 && y + ph > 0) cuerpo += rect(x, y, pw, ph, col(u * 2 + t));
    }
  } else if (a.patron === 'hexagonal') { // hexágonos de punta arriba; largo = de cara a cara
    const d = L, R = d / Math.sqrt(3), Rj = Math.max(.05, (d - j) / Math.sqrt(3)); w = d; h = Math.sqrt(3) * d;
    const hexa = (cx, cy, c) => `<polygon points="${Array.from({ length: 6 }, (_, q) => { const t = Math.PI / 3 * q + Math.PI / 6; return `${r2(cx + Rj * Math.cos(t))},${r2(cy + Rj * Math.sin(t))}`; }).join(' ')}" fill="${c}"/>`;
    for (let f = -1; f <= 2; f++) for (let i = -1; i <= 1; i++) cuerpo += hexa(i * d + (f % 2 ? d / 2 : 0), f * 1.5 * R, col(((f % 2) + 2) % 2));
  } else return null; // liso
  let svg = `<rect width="${r2(w)}" height="${r2(h)}" fill="${a.color_junta}"/>${cuerpo}`;
  if (a.giro === 90) { svg = `<g transform="matrix(0 1 1 0 0 0)">${svg}</g>`; [w, h] = [h, w]; }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w)}" height="${r2(h)}" viewBox="0 0 ${r2(w)} ${r2(h)}">${svg}</svg>`, w, h };
}

const cache = new Map();
// Fondo CSS de una cara: el dibujo parte en (ox, oy) cm, medidos desde la esquina izquierda de abajo de la cara
// (así las franjas de un mismo muro calzan entre sí y el suelo calza con el origen del espacio).
export function fondoAcabado(a, { ox = 0, oy = 0, desdeArriba = false } = {}) {
  const n = normalizar(a);
  if (n.patron === 'liso') return n.color;
  const clave = JSON.stringify(n);
  let m = cache.get(clave);
  if (!m) { m = mosaico(n); m.url = `url('data:image/svg+xml,${encodeURIComponent(m.svg)}')`; cache.set(clave, m); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return `${m.url} left ${r2(-ox)}em ${desdeArriba ? 'top' : 'bottom'} ${r2(-oy)}em / ${r2(m.w)}em ${r2(m.h)}em repeat, ${n.color_junta}`;
}
