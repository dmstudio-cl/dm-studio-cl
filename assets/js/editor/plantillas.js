// Cocinas de referencia: plantillas paramétricas (lineal, en L, en U, isla).
// Se insertan con sus medidas generales y, si se cambia una medida, la cocina se vuelve a generar
// y los módulos se redistribuyen solos. Cada módulo guarda la plantilla en m.plantilla (texto JSON),
// así se conserva aunque el proyecto pase por Decap o se publique.
import { uid } from './modelo.js';

const T = 1.8; // espesor de frente
export const PLANTILLAS = {
  lineal: { nombre: 'Cocina lineal', medidas: ['largoA'] },
  L: { nombre: 'Cocina en L', medidas: ['largoA', 'largoB'] },
  U: { nombre: 'Cocina en U', medidas: ['largoA', 'largoB', 'largoC'] },
  isla: { nombre: 'Isla', medidas: ['largoA'] },
};
export const ETIQUETAS = {
  largoA: 'Largo pared principal', largoB: 'Largo lado izquierdo', largoC: 'Largo lado derecho',
  fondo: 'Fondo basales', alto: 'Alto basales', zocalo: 'Zócalo',
  altoAereo: 'Alto aéreos', sepAereo: 'Separación cubierta–aéreos', fondoAereo: 'Fondo aéreos',
  x: 'Posición X', z: 'Posición Z',
};
export function parametrosIniciales(tipo, espacio) {
  const P = (espacio?.puntos || []).filter(Boolean);
  const xs = P.map((p) => +p.x), zs = P.map((p) => +p.z);
  const conMuros = P.length >= 2;
  const ancho = conMuros ? Math.max(...xs) - Math.min(...xs) : 300;
  const fondoEsp = conMuros ? Math.max(...zs) - Math.min(...zs) : 220;
  const x0 = conMuros ? Math.min(...xs) : 0, z0 = conMuros ? Math.min(...zs) : 0;
  const base = { x: x0, z: z0, fondo: 58, alto: 88, zocalo: 10, aereos: true, altoAereo: 70, sepAereo: 60, fondoAereo: 35, lavaplatos: true, cocina: true };
  if (tipo === 'isla') return { ...base, largoA: 150, aereos: false, lavaplatos: false, cocina: false, x: x0 + Math.max(0, (ancho - 150) / 2), z: z0 + 60 + 90 };
  return { ...base, largoA: Math.round(ancho) || 300, largoB: Math.min(240, Math.round(fondoEsp) || 200), largoC: Math.min(240, Math.round(fondoEsp) || 200) };
}

// Reparte un largo en módulos de ~60 cm (entre 30 y 90), en múltiplos de 0,5 cm y sumando exacto.
function repartir(largo) {
  if (largo < 1) return [];
  if (largo < 30) return [largo]; // relleno angosto
  let n = Math.max(1, Math.round(largo / 60));
  while (largo / n > 90) n++;
  while (n > 1 && largo / n < 30) n--;
  const w = Math.round((largo / n) * 2) / 2;
  return [...Array(n - 1).fill(w), Math.round((largo - w * (n - 1)) * 10) / 10];
}

function columnasPara(ancho, util, rol, i) {
  if (rol === 'relleno') return [{ ancho, frentes: [{ tipo: 'panel', alto: util }] }];
  if (rol === 'lavaplatos' || ancho >= 70) return [{ ancho, frentes: [{ tipo: 'puerta_doble', alto: util, bisagra: 'izquierda' }] }];
  if (rol === 'cajonera') {
    const h = Math.round((util / 3) * 2) / 2;
    return [{ ancho, frentes: [{ tipo: 'cajon', alto: h }, { tipo: 'cajon', alto: h }, { tipo: 'cajon', alto: Math.round((util - 2 * h) * 10) / 10 }] }];
  }
  return [{ ancho, frentes: [{ tipo: 'puerta', alto: util, bisagra: i % 2 ? 'derecha' : 'izquierda' }] }];
}

/**
 * Genera los módulos de una plantilla.
 * @returns módulos listos para el editor (con m.plantilla = '{"g":id,"t":tipo,"p":{...}}')
 */
export function generar(tipo, p, gid = uid('g')) {
  const meta = JSON.stringify({ g: gid, t: tipo, p });
  const util = p.alto - p.zocalo;
  const modulos = [];
  const base = (nombre, ancho, x, z, rot, rol, i = 0) => ({
    id: uid(), nombre, tipo: 'base', ancho, alto: p.alto, profundidad: p.fondo, zocalo: p.zocalo, zocalo_retiro: 5,
    x, z, rotacion: rot, elevacion: 0, cubierta: true,
    columnas: columnasPara(ancho, util, rol, i), tiradores: [], plantilla: meta,
  });
  const aereo = (nombre, ancho, x, z, rot) => {
    const doble = ancho >= 70;
    const cols = doble ? [{ ancho: ancho / 2, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'izquierda' }] }, { ancho: ancho / 2, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'derecha' }] }]
      : [{ ancho, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'izquierda' }] }];
    return {
      id: uid(), nombre, tipo: 'aereo', ancho, alto: p.altoAereo, profundidad: p.fondoAereo, zocalo: 0, zocalo_retiro: 5,
      x, z, rotacion: rot, elevacion: p.alto + 3.8 + p.sepAereo, cubierta: false, columnas: cols, tiradores: [], plantilla: meta,
    };
  };

  if (tipo === 'isla') {
    // Almacenaje hacia la cocina (giro 180: el frente mira a -z); el lado de los pisos queda hacia el comedor
    const D = p.fondo + T;
    const cols = repartir(p.largoA).map((w, i) => columnasPara(w, util, i === 0 ? 'cajonera' : 'puerta', i)[0]);
    modulos.push({ ...base('Isla', p.largoA, p.x + p.largoA, p.z + D, 180, 'puerta'), tipo: 'isla', columnas: cols });
    return modulos;
  }

  // --- Pared principal: [relleno/módulos] [lavaplatos 80] [módulos] [hueco cocina 76] [módulos]
  const A = p.largoA;
  const fijos = [];
  if (p.lavaplatos) fijos.push({ rol: 'lavaplatos', ancho: 80 });
  if (p.cocina) fijos.push({ rol: 'hueco', ancho: 76 });
  let resto = A - fijos.reduce((a, f) => a + f.ancho, 0);
  while (resto < 0 && fijos.length) { resto += fijos.pop().ancho; } // no cabe: se quitan cocina y lavaplatos
  const partes = fijos.length === 2 ? [.2, .45, .35] : fijos.length === 1 ? [.4, .6] : [1];
  const tramos = [];
  partes.forEach((f, i) => {
    tramos.push({ rol: 'tramo', ancho: Math.round(resto * f * 2) / 2 });
    if (fijos[i]) tramos.push(fijos[i]);
  });
  // el último tramo absorbe el redondeo
  const suma = tramos.reduce((a, t) => a + t.ancho, 0);
  tramos.filter((t) => t.rol === 'tramo').at(-1).ancho = Math.round((tramos.filter((t) => t.rol === 'tramo').at(-1).ancho + A - suma) * 10) / 10;

  let x = p.x;
  let n = 0;
  for (const t of tramos) {
    if (t.rol === 'hueco') { x += t.ancho; continue; } // espacio para la cocina (artefacto)
    if (t.rol === 'lavaplatos') {
      modulos.push(base('Lavaplatos', 80, x, p.z, 0, 'lavaplatos'));
      if (p.aereos) modulos.push(aereo('Aéreo lavaplatos', 80, x, p.z, 0));
      x += 80; continue;
    }
    repartir(t.ancho).forEach((w, i) => {
      const rol = w < 30 ? 'relleno' : i === 0 ? 'cajonera' : 'puerta';
      modulos.push(base(rol === 'relleno' ? 'Relleno' : `Basal ${++n}`, w, x, p.z, 0, rol, i));
      if (p.aereos && rol !== 'relleno') modulos.push(aereo(`Aéreo ${n}`, w, x, p.z, 0));
      x += w;
    });
  }

  // --- Lados (en L: izquierdo; en U: izquierdo y derecho). Empiezan después del fondo de la pared principal.
  const desde = p.z + p.fondo + T;
  const lado = (largo, izquierdo) => {
    const libre = largo - (p.fondo + T);
    let z = desde;
    repartir(Math.max(0, libre)).forEach((w, i) => {
      const rol = w < 30 ? 'relleno' : i === 0 ? 'cajonera' : 'puerta';
      // giro 90 (lado izquierdo): el ancho avanza hacia -z, el origen va en el extremo lejano
      // giro 270 (lado derecho): el ancho avanza hacia +z, el origen va en el extremo cercano
      if (izquierdo) modulos.push(base(`Lado izq. ${i + 1}`, w, p.x, z + w, 90, rol, i));
      else modulos.push(base(`Lado der. ${i + 1}`, w, p.x + A, z, 270, rol, i));
      z += w;
    });
  };
  if (tipo === 'L' || tipo === 'U') lado(p.largoB, true);
  if (tipo === 'U') lado(p.largoC, false);
  return modulos;
}

export const leerPlantilla = (m) => { try { return m?.plantilla ? JSON.parse(m.plantilla) : null; } catch { return null; } };
