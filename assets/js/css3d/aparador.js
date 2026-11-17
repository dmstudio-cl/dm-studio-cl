// Aparador de autor en CSS 3D: mismas piezas y medidas que la versión Three.js (three/pieces.js).
import { createStage } from './engine.js';

const TEX_CM = 60; // una repetición de la textura = 60 × 60 cm (igual que en Three.js)
const PRESETS = {
  roble: { base: '#a07446', dark: '#5f3f22', light: '#c39663', seed: 11 },
  nogal: { base: '#6e4a31', dark: '#3f2818', light: '#8f6847', seed: 5 },
  fresno: { base: '#d6c3a2', dark: '#a68d68', light: '#eadcc2', seed: 3 },
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Veta procedural en canvas 2D (misma receta que three/materials.js, sin rugosidad).
// Devuelve dos imágenes: veta horizontal y veta vertical.
const texCache = new Map();
export function woodTextures(key = 'roble', size = 512) {
  if (texCache.has(key)) return texCache.get(key);
  const { base, dark, light, seed } = PRESETS[key] || PRESETS.roble;
  const rand = rng(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    const y = rand() * size, h = (20 + rand() * 90) * size / 1024;
    const g = c.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, 'transparent'); g.addColorStop(.5, rand() > .5 ? light : dark); g.addColorStop(1, 'transparent');
    c.globalAlpha = .18 + rand() * .2; c.fillStyle = g; c.fillRect(0, y - h, size, h * 2);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 200; i++) {
    const y0 = rand() * size;
    const amp = (2 + rand() * 9) * size / 1024, freq = (1 + Math.floor(rand() * 3)) * Math.PI * 2 / size, ph = rand() * 6.28;
    c.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * .25;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = dark; c.globalAlpha = .08 + rand() * .32; c.lineWidth = (.4 + rand() * 1.6) * size / 1024; c.stroke();
  }
  c.globalAlpha = .1;
  for (let i = 0; i < 2500; i++) { c.fillStyle = rand() > .5 ? dark : light; c.fillRect(rand() * size, rand() * size, 1 + rand() * 3, .6); }
  c.globalAlpha = 1;
  const h = cv.toDataURL('image/jpeg', .86);
  const rot = document.createElement('canvas');
  rot.width = rot.height = size;
  const r = rot.getContext('2d');
  r.translate(size / 2, size / 2); r.rotate(Math.PI / 2); r.drawImage(cv, -size / 2, -size / 2);
  // Se registran como variables CSS globales: cada cara solo referencia var(--wood-<clave>-h|v),
  // así el navegador decodifica la imagen una vez y no se repite el texto en 100 estilos.
  const out = { h: `var(--wood-${key}-h)`, v: `var(--wood-${key}-v)` };
  const root = document.documentElement.style;
  root.setProperty(`--wood-${key}-h`, `url(${h})`);
  root.setProperty(`--wood-${key}-v`, `url(${rot.toDataURL('image/jpeg', .86)})`);
  texCache.set(key, out);
  return out;
}

// Elige la textura según el eje de la veta de la pieza y la orientación de cada cara.
function woodTex(tx, grain) {
  // eje horizontal / vertical de cada cara en coordenadas del mueble
  const axes = { front: ['x', 'y'], back: ['x', 'y'], right: ['z', 'y'], left: ['z', 'y'], top: ['x', 'z'], bottom: ['x', 'z'] };
  let k = 0;
  return (face) => {
    const [, v] = axes[face];
    const img = v === grain ? tx.v : tx.h;
    k++;
    return { bg: `${img} ${(k * 17) % TEX_CM}em ${(k * 29) % TEX_CM}em / ${TEX_CM}em ${TEX_CM}em`, size: null };
  };
}

export function mountAparador(el, { w = 160, h = 58, d = 45, legH = 20, wood = 'roble', autorotate = el.dataset.autorotate !== undefined } = {}) {
  const st = createStage(el, { autorotate });
  const tx = woodTextures(wood), legTx = woodTextures('nogal');
  const t = 1.8, y0 = legH;
  const B = (o, grain = 'x') => st.box({ ...o, tex: woodTex(tx, grain) });

  st.floorShadow({ w: w * 1.08, d: d * 1.7, opacity: .6 });
  // tapa, base, costados y fondo
  B({ w, h: t, d, y: y0 + h - t / 2 });
  B({ w: w - 2 * t, h: t, d: d - 1, y: y0 + t / 2, z: -.5 });
  B({ w: t, h: h - t, d, x: -w / 2 + t / 2, y: y0 + (h - t) / 2 }, 'y');
  B({ w: t, h: h - t, d, x: w / 2 - t / 2, y: y0 + (h - t) / 2 }, 'y');
  B({ w: w - 2 * t, h: h - 2 * t, d: 1.2, y: y0 + h / 2, z: -d / 2 + .6 });
  // puertas con tirador de canto
  const n = 3, gap = .35, inner = w - 2 * t, dw = (inner - gap * (n + 1)) / n, dh = h - 2 * t - gap * 2;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + gap + dw / 2 + i * (dw + gap);
    B({ w: dw, h: dh, d: t, x, y: y0 + h / 2, z: d / 2 - t / 2 }, 'y');
    st.box({ w: dw * .38, h: .5, d: .6, x, y: y0 + h - t - gap - 1.2, z: d / 2 + .3, tex: { bg: '#141110' } });
  }
  // patas cónicas de nogal
  const inset = 7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    st.prism({ r1: 1.6, r2: 1.1, h: legH, x: sx * (w / 2 - inset), y: legH / 2, z: sz * (d / 2 - inset), sides: 8, bg: `${legTx.v} 0 0 / ${TEX_CM}em ${TEX_CM}em` });
  }
  st.frame([0, (legH + h) / 2, 0], w * 1.08);
  return st;
}
