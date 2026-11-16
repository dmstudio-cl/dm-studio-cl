// Generador paramétrico de muebles de melamina (1 unidad = 1 cm).
// Entrada: proyecto con "modulos" (formato del Decap privado) + selección del cliente.
//
// Convenciones del espacio:
//   - El muro principal corre a lo largo del eje X, en z = 0. El piso está en y = 0.
//   - Cada módulo se define por su esquina trasera-izquierda (x, z) y su elevación.
//   - El frente del módulo mira hacia +Z cuando rotacion = 0. Con 90 mira hacia +X (muro izquierdo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { flatMaterial, melaminaMaterial, worldUV } from './materials.js';

const T = 1.8;      // espesor de tablero
const GAP = 0.3;    // luz entre frentes
const CT = 3.8;     // espesor cubierta
const OVER = 2;     // vuelo frontal de la cubierta

function slab(w, h, d, x, y, z, material, { grain = 'x', radius = .12, texCm } = {}) {
  const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
  const geo = worldUV(new RoundedBoxGeometry(w, h, d, 2, r), grain, texCm || material?.userData?.texCm || 60);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- tiradores ----------
function handleMaterial(t) {
  const metal = /acero|inox|alumin|dorado|bronce|cobre/i.test((t?.color_nombre || '') + (t?.nombre || ''));
  return flatMaterial(t?.color || '#1b1b1b', { roughness: metal ? .32 : .5, metalness: metal ? .85 : .1 });
}

// Agrega un tirador sobre un frente. f: {x, y, w, h} del frente (centro x,y) ; z = cara frontal.
function addHandle(g, t, f, z, kind, place) {
  const forma = t?.forma || 'barra';
  if (forma === 'sin') return;
  const mat = handleMaterial(t);
  const largo = Math.min(t?.largo || 16, (kind === 'cajon' ? f.w : f.h) * .8);
  if (forma === 'perfil') {
    // perfil continuo en el canto superior (cajón) o lateral (puerta)
    if (kind === 'cajon' || place.v === 'arriba') g.add(slab(f.w * .96, 1.2, 1.4, f.x, f.y + f.h / 2 - .6, z + .7, mat, { radius: .3 }));
    else g.add(slab(1.2, f.h * .96, 1.4, place.side === 'der' ? f.x + f.w / 2 - .6 : f.x - f.w / 2 + .6, f.y, z + .7, mat, { radius: .3 }));
    return;
  }
  if (forma === 'boton') {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 2.4, 24), mat);
    knob.rotation.x = Math.PI / 2;
    let hx = f.x, hy = f.y;
    if (kind !== 'cajon') { hx = place.side === 'der' ? f.x + f.w / 2 - 4 : f.x - f.w / 2 + 4; hy = place.v === 'arriba' ? f.y + f.h / 2 - 6 : place.v === 'abajo' ? f.y - f.h / 2 + 6 : f.y; }
    else hy = f.y + f.h / 2 - Math.min(6, f.h / 3);
    knob.position.set(hx, hy, z + 1.2);
    knob.castShadow = true;
    g.add(knob);
    return;
  }
  // barra
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, largo, 16), mat);
  const post = new THREE.CylinderGeometry(.45, .45, 2.4, 12);
  const grp = new THREE.Group();
  bar.position.z = 2.4; grp.add(bar);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(post, mat); p.rotation.x = Math.PI / 2; p.position.set(0, s * (largo / 2 - 1.5), 1.2); grp.add(p); }
  grp.traverse((o) => { o.castShadow = true; });
  if (kind === 'cajon') {
    grp.rotation.z = Math.PI / 2;
    grp.position.set(f.x, f.y + f.h / 2 - Math.min(5, f.h / 3), z);
  } else {
    const hx = place.side === 'der' ? f.x + f.w / 2 - 3.5 : f.x - f.w / 2 + 3.5;
    const hy = place.v === 'arriba' ? f.y + f.h / 2 - largo / 2 - 4 : place.v === 'abajo' ? f.y - f.h / 2 + largo / 2 + 4 : f.y;
    grp.position.set(hx, hy, z);
  }
  g.add(grp);
}

// ---------- módulo ----------
function buildModule(mod, mats, tirador) {
  const g = new THREE.Group();
  g.name = mod.nombre || 'modulo';
  const W = +mod.ancho, H = +mod.alto, D = +mod.profundidad;
  const Z = mod.tipo === 'aereo' ? 0 : (+mod.zocalo || 0);
  const body = mats.cuerpo, front = mats.frente;

  // Carcasa: costados, piso, techo, fondo
  g.add(slab(T, H - Z, D, T / 2, Z + (H - Z) / 2, D / 2, body, { grain: 'y' }));
  g.add(slab(T, H - Z, D, W - T / 2, Z + (H - Z) / 2, D / 2, body, { grain: 'y' }));
  g.add(slab(W - 2 * T, T, D, W / 2, Z + T / 2, D / 2, body));
  g.add(slab(W - 2 * T, T, D, W / 2, H - T / 2, D / 2, body));
  g.add(slab(W - 2 * T, H - Z - 2 * T, .6, W / 2, Z + (H - Z) / 2, .3, body, { grain: 'y' }));
  // Zócalo retranqueado
  if (Z > 0) g.add(slab(W, Z, T, W / 2, Z / 2, D - 5, mats.zocalo));

  // Frentes por columnas (izq → der), frentes de arriba → abajo
  const cols = mod.columnas?.length ? mod.columnas : [{ ancho: W, frentes: [{ tipo: 'puerta', alto: H - Z }] }];
  const sumW = cols.reduce((a, c) => a + (+c.ancho || 0), 0) || W;
  const kx = W / sumW; // tolera pequeñas diferencias de suma
  const zf = D + T / 2;
  let x0 = 0;
  for (const col of cols) {
    const cw = (+col.ancho || 0) * kx;
    const frentes = col.frentes?.length ? col.frentes : [{ tipo: 'puerta', alto: H - Z }];
    const sumH = frentes.reduce((a, f) => a + (+f.alto || 0), 0) || (H - Z);
    const ky = (H - Z) / sumH;
    let ytop = H;
    for (const fr of frentes) {
      const fh = (+fr.alto || 0) * ky;
      const f = { x: x0 + cw / 2, y: ytop - fh / 2, w: cw - GAP, h: fh - GAP };
      const tipo = fr.tipo || 'puerta';
      if (tipo === 'abierto') {
        g.add(slab(cw - 2 * T, T, D - 2, f.x, f.y, D / 2, body));
      } else if (tipo === 'puerta_doble') {
        const lw = (f.w - GAP) / 2;
        for (const s of [-1, 1]) {
          const lx = f.x + s * (lw + GAP) / 2;
          g.add(slab(lw, f.h, T, lx, f.y, zf, front, { grain: 'y' }));
          addHandle(g, tirador, { ...f, x: lx, w: lw }, D + T, 'puerta', { side: s < 0 ? 'der' : 'izq', v: mod.tipo === 'aereo' ? 'abajo' : 'arriba' });
        }
      } else {
        const grain = tipo === 'cajon' ? 'x' : 'y';
        g.add(slab(f.w, f.h, T, f.x, f.y, zf, front, { grain }));
        if (tipo === 'campana') {
          g.add(slab(f.w * .8, 1.2, D * .7, f.x, f.y - f.h / 2 - .6, D * .55, flatMaterial('#2a2a2c', { roughness: .4, metalness: .6 })));
        } else if (tipo === 'puerta') {
          const b = fr.bisagra || 'izquierda';
          const place = b === 'arriba' ? { v: 'abajo', side: 'izq' } : b === 'abajo' ? { v: 'arriba', side: 'izq' }
            : { side: b === 'izquierda' ? 'der' : 'izq', v: mod.tipo === 'aereo' ? 'abajo' : 'arriba' };
          if (b === 'arriba' || b === 'abajo') addHandle(g, tirador, f, D + T, 'cajon', place);
          else addHandle(g, tirador, f, D + T, 'puerta', place);
        } else if (tipo === 'cajon') {
          addHandle(g, tirador, f, D + T, 'cajon', {});
        }
      }
      ytop -= fh;
    }
    x0 += cw;
  }

  // Cubierta
  if (mod.cubierta) {
    g.add(slab(W + .4, CT, D + OVER + T, W / 2, H + CT / 2, (D + OVER + T) / 2, mats.cubierta, { radius: .4, texCm: 80 }));
  }

  // Posición en el espacio
  const pivot = new THREE.Group();
  pivot.add(g);
  pivot.rotation.y = THREE.MathUtils.degToRad(+mod.rotacion || 0);
  pivot.position.set(+mod.x || 0, +mod.elevacion || 0, +mod.z || 0);
  pivot.userData.modulo = mod.nombre;
  return pivot;
}

// ---------- espacio (piso y muros) ----------
function buildRoom(esp, bounds) {
  const g = new THREE.Group();
  const L = +esp?.largo || Math.max(bounds.max.x + 60, 240);
  const A = +esp?.ancho || Math.max(bounds.max.z + 120, 240);
  const Hh = +esp?.alto || 240;
  const wall = new THREE.MeshStandardMaterial({ color: '#2c2b2f', roughness: .95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#1c1b1e', roughness: .9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, A), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(L / 2, 0, A / 2); floor.receiveShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(L, Hh), wall);
  back.position.set(L / 2, Hh / 2, 0); back.receiveShadow = true;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(A, Hh), wall);
  left.rotation.y = Math.PI / 2; left.position.set(0, Hh / 2, A / 2); left.receiveShadow = true;
  g.add(floor, back, left);
  g.userData.room = true;
  return g;
}

/**
 * Construye el proyecto completo.
 * @param {object} proyecto  datos del proyecto (modulos, espacio)
 * @param {object} sel       { melamina, tirador, cubierta } objetos ya resueltos
 * @returns {{ group: THREE.Group, room: THREE.Group, furniture: THREE.Group }}
 */
export function buildProyecto(proyecto, sel = {}) {
  const mats = {
    frente: melaminaMaterial(sel.melamina),
    cuerpo: flatMaterial('#ecebe7', { roughness: .62 }),
    zocalo: flatMaterial('#d9d7d2', { roughness: .7 }),
    cubierta: sel.cubierta?.material || flatMaterial(sel.cubierta?.color || '#cfc9bc', { roughness: .45 }),
  };
  const furniture = new THREE.Group();
  furniture.name = 'muebles';
  for (const mod of proyecto.modulos || []) furniture.add(buildModule(mod, mats, sel.tirador));
  const bounds = new THREE.Box3().setFromObject(furniture);
  const group = new THREE.Group();
  group.add(furniture);
  let room = null;
  if (proyecto.espacio && (proyecto.espacio.largo || proyecto.espacio.mostrar !== false)) {
    room = buildRoom(proyecto.espacio, bounds);
    group.add(room);
  }
  return { group, furniture, room, bounds };
}

// Resumen de medidas y conteos (lo mismo que usa el Worker para cotizar).
export function resumen(proyecto) {
  let puertas = 0, cajones = 0, ml = 0;
  for (const m of proyecto.modulos || []) {
    if (m.cubierta) ml += (+m.ancho || 0) / 100;
    for (const c of m.columnas || []) for (const f of c.frentes || []) {
      if (f.tipo === 'puerta') puertas++;
      else if (f.tipo === 'puerta_doble') puertas += 2;
      else if (f.tipo === 'cajon') cajones++;
    }
  }
  return { puertas, cajones, tiradores: puertas + cajones, cubierta_ml: Math.round(ml * 100) / 100 };
}
