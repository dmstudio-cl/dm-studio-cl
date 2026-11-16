// Piezas paramétricas generadas por código (1 unidad = 1 cm).
// Es la semilla del generador de muebles del portal: cada mueble = lista de piezas con medidas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woodMaterial, flatMaterial, worldUV } from './materials.js';

// Tablero con canto levemente redondeado. x,y,z = centro.
export function board(w, h, d, { x = 0, y = 0, z = 0, grain = 'x', material, radius = .35 } = {}) {
  const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
  const geo = worldUV(new RoundedBoxGeometry(w, h, d, 2, r), grain);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// Aparador de autor: cuerpo sobre patas, 3 puertas con veta vertical y tapa con veta horizontal.
export function aparador({ w = 160, h = 58, d = 45, legH = 20, wood = 'roble' } = {}) {
  const g = new THREE.Group();
  const m = woodMaterial(wood);
  const t = 1.8; // espesor tablero
  const y0 = legH;
  // tapa, base, costados, fondo
  g.add(board(w, t, d, { y: y0 + h - t / 2, material: m }));
  g.add(board(w - 2 * t, t, d - 1, { y: y0 + t / 2, z: -.5, material: m }));
  g.add(board(t, h - t, d, { x: -w / 2 + t / 2, y: y0 + (h - t) / 2, grain: 'y', material: m }));
  g.add(board(t, h - t, d, { x: w / 2 - t / 2, y: y0 + (h - t) / 2, grain: 'y', material: m }));
  // fondo terminado en madera: un mueble de autor se ve bien desde todos los ángulos
  g.add(board(w - 2 * t, h - 2 * t, 1.2, { y: y0 + h / 2, z: -d / 2 + .6, grain: 'x', material: m }));
  // puertas
  const n = 3, gap = .35, inner = w - 2 * t, dw = (inner - gap * (n + 1)) / n, dh = h - 2 * t - gap * 2;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + gap + dw / 2 + i * (dw + gap);
    g.add(board(dw, dh, t, { x, y: y0 + h / 2, z: d / 2 - t / 2, grain: 'y', material: m }));
    // tirador de canto: ranura oscura
    g.add(board(dw * .38, .5, .6, { x, y: y0 + h - t - gap - 1.2, z: d / 2 + .1, material: flatMaterial('#141110', { roughness: .8 }), radius: .2 }));
  }
  // patas cónicas
  const legMat = woodMaterial('nogal');
  const lg = new THREE.CylinderGeometry(1.6, 1.1, legH, 24);
  worldUV(lg, 'y');
  const inset = 7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(lg, legMat);
    leg.position.set(sx * (w / 2 - inset), legH / 2, sz * (d / 2 - inset));
    leg.rotation.z = sx * .06; leg.rotation.x = -sz * .06;
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

export const PROCEDURAL = { aparador };
