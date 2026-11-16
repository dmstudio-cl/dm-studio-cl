// Materiales de madera procedurales (sin descargar texturas) y mapeo UV a escala real.
// 1 unidad de escena = 1 cm. La veta del canvas corre a lo largo del eje U.
import * as THREE from 'three';

const TEX_CM = 60; // una repetición de la textura cubre 60 × 60 cm
const cache = new Map();

// Ruido 1D suave y determinista para la veta.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function woodCanvases({ base = '#b48a5a', dark = '#7a5534', light = '#d2ad7c', seed = 7, size = 1024 } = {}) {
  const rand = rng(seed);
  const color = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = color.height = rough.width = rough.height = size;
  const c = color.getContext('2d');
  const r = rough.getContext('2d');

  c.fillStyle = base; c.fillRect(0, 0, size, size);
  r.fillStyle = '#9a9a9a'; r.fillRect(0, 0, size, size);

  // Bandas anchas de tono (anillos de crecimiento vistos de canto)
  for (let i = 0; i < 18; i++) {
    const y = rand() * size, h = 20 + rand() * 90;
    const g = c.createLinearGradient(0, y - h, 0, y + h);
    const col = rand() > .5 ? light : dark;
    g.addColorStop(0, 'transparent'); g.addColorStop(.5, col); g.addColorStop(1, 'transparent');
    c.globalAlpha = .18 + rand() * .2; c.fillStyle = g; c.fillRect(0, y - h, size, h * 2);
  }
  c.globalAlpha = 1;

  // Líneas de veta: curvas largas, ligeramente onduladas y que hacen "tile" en X.
  const lines = 260;
  for (let i = 0; i < lines; i++) {
    const y0 = rand() * size;
    const amp = 2 + rand() * 9, freq = (1 + Math.floor(rand() * 3)) * Math.PI * 2 / size, ph = rand() * 6.28;
    const w = .4 + rand() * 1.6;
    const a = .08 + rand() * .32;
    c.beginPath(); r.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * .25;
      if (x === 0) { c.moveTo(x, y); r.moveTo(x, y); } else { c.lineTo(x, y); r.lineTo(x, y); }
    }
    c.strokeStyle = dark; c.globalAlpha = a; c.lineWidth = w; c.stroke();
    r.strokeStyle = '#c8c8c8'; r.globalAlpha = a; r.lineWidth = w * 1.5; r.stroke();
  }
  // Poros finos
  c.globalAlpha = .12;
  for (let i = 0; i < 5000; i++) {
    c.fillStyle = rand() > .5 ? dark : light;
    c.fillRect(rand() * size, rand() * size, 1 + rand() * 5, .6);
  }
  c.globalAlpha = 1; r.globalAlpha = 1;
  return { color, rough };
}

export function woodMaterial(key = 'roble', opts = {}) {
  const k = key + JSON.stringify(opts);
  if (cache.has(k)) return cache.get(k);
  const presets = {
    roble: { base: '#a07446', dark: '#5f3f22', light: '#c39663', seed: 11 },
    nogal: { base: '#6e4a31', dark: '#3f2818', light: '#8f6847', seed: 5 },
    fresno: { base: '#d6c3a2', dark: '#a68d68', light: '#eadcc2', seed: 3 },
  };
  const { color, rough } = woodCanvases({ ...presets[key], ...opts });
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rough);
  for (const t of [map, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const mat = new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: .62, metalness: 0, envMapIntensity: .9 });
  cache.set(k, mat);
  return mat;
}

// Material liso (melamina unicolor, metal, etc.)
export function flatMaterial(color, { roughness = .55, metalness = 0 } = {}) {
  const k = 'flat' + color + roughness + metalness;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return cache.get(k);
}

// Recalcula UVs por proyección de caja en coordenadas de la pieza (cm), así la veta
// queda a escala real sin importar el tamaño. grain: 'x' | 'y' | 'z' = eje de la veta.
export function worldUV(geometry, grain = 'x') {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const pick = (vec, axis) => (axis === 'x' ? vec.x : axis === 'y' ? vec.y : vec.z);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    // Plano de proyección según la normal dominante
    const plane = ax > ay && ax > az ? ['z', 'y'] : ay > az ? ['x', 'z'] : ['x', 'y'];
    // U debe seguir el eje de la veta cuando éste está en el plano
    let [a, b] = plane;
    if (b === grain) [a, b] = [b, a];
    uv[i * 2] = pick(v, a) / TEX_CM;
    uv[i * 2 + 1] = pick(v, b) / TEX_CM;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
