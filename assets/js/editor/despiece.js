// Lista de materiales (despiece) calculada desde los módulos del editor. Solo cantidades: los precios
// viven en el repo privado y los aplica el Worker. Reglas del dueño (2026-11-18):
// - Cada tablero cuenta sus m² en su material. Sin material propio: melamina blanca (cuerpo, costados,
//   repisas, divisiones, cajones); los frentes usan la melamina general («frente»).
// - Las traseras son cholguán blanco; si el fondo tiene otro material, cholguán de ese color.
// - Cada hoja de puerta lleva 2 bisagras de cierre suave; cada cajón, un par de correderas telescópicas de
//   cierre suave del largo más cercano (sin pasarse) al fondo del mueble.
// - Tapacanto: metros lineales de los cantos visibles.
import { celdas, tablero, nivelesRepisa, marcoZocalo, cubiertaDe, girar, distancias } from './modelo.js';

export const BLANCA = 'blanco-softwood'; // Masisa Blanco
const ZOCALO = { grafito: 'gris-grafito-natural-matt', negro: 'negro-natural-matt', aluminio: 'aluminio', blanco: BLANCA, frente: 'frente' };
const CUERPO = { blanco: BLANCA, gris: 'gris', negro: 'negro-natural-matt' };
export const CORREDERAS = [25, 30, 35, 40, 45, 50, 55]; // largos comerciales (cm)
const r1 = (v) => Math.round(v * 10) / 10;
// material de una pieza: sin «liston:» (los listones se cotizan como su melamina)
const limpio = (m) => String(m || '').replace(/^liston:/, '');

// ¿Se ve este costado? Queda oculto si toca otro mueble del mismo muro (mismo giro y fondo, a la misma altura)
// o un muro. lado: 'izq' (x = 0 del mueble) o 'der' (x = ancho).
function costadoVisible(m, lado, modelo) {
  const r = +m.rotacion || 0, u = girar(1, 0, r), v = girar(0, 1, r);
  const s = (o) => +o.x * u[0] + +o.z * u[1], t = (o) => +o.x * v[0] + +o.z * v[1];
  const borde = s(m) + (lado === 'der' ? +m.ancho : 0), y0 = +m.elevacion || 0, y1 = y0 + +m.alto;
  for (const o of modelo.modulos || []) {
    if (o === m || o.tipo === 'aereo' && m.tipo !== 'aereo' && +o.elevacion > y1) continue;
    const dr = Math.abs(((((+o.rotacion || 0) - r) % 360) + 360) % 360);
    if (Math.min(dr, 360 - dr) > 1 || Math.abs(t(o) - t(m)) > 5) continue; // otro muro u otra fila
    const a = s(o), b = a + +o.ancho, oy0 = +o.elevacion || 0, oy1 = oy0 + +o.alto;
    const toca = lado === 'der' ? Math.abs(a - borde) < 1.5 : Math.abs(b - borde) < 1.5;
    if (toca && Math.min(y1, oy1) - Math.max(y0, oy0) > (y1 - y0) * .5) return false; // pegado a otro mueble
  }
  const d = distancias(m, modelo.espacio)?.[lado === 'der' ? 'derecha' : 'izquierda']?.d;
  return !(d != null && d < 2); // contra un muro
}

export function despiece(modelo) {
  const col = modelo.colores || {}, piezas = [], herrajes = { bisagras: 0, correderas: {} }, cubiertas = [];
  let canto = 0; // cm
  const cuerpoDef = CUERPO[col.cuerpo] || BLANCA;
  for (const m of modelo.modulos || []) {
    if (!m || m.artefacto) continue; // artefactos de piso: referencia, no se fabrican
    const T = tablero(m), W = +m.ancho, H = +m.alto, D = +m.profundidad, Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
    const quitar = Array.isArray(m.quitar) ? m.quitar : [], ext = Math.max(0, +m.costados_atras || 0);
    const mat = (k, def) => limpio(m.materiales?.[k]) || def;
    const add = (k, nombre, material, a, b, cantoCm = 0, tipo = 'tablero') => {
      if (a <= 0 || b <= 0) return;
      piezas.push({ m: m.id, k, mueble: m.nombre, nombre, material, tipo, ancho: r1(a), alto: r1(b), area: Math.round(a * b) / 1e4, espesor: tipo === 'cholguan' ? 3 : T * 10 });
      canto += cantoCm;
    };
    // ---- cuerpo
    // Costados: los que se ven van en la melamina de frentes (salvo que el mueble o el general digan «como el cuerpo»);
    // los que tocan otro mueble o un muro, en blanco.
    const modoCostado = m.costados || col.costados || 'frente';
    const hc = H - (ext ? 0 : Z);
    for (const [p, n] of [['izq', 'Costado izquierdo'], ['der', 'Costado derecho']]) {
      const def = modoCostado === 'frente' && (m.costados === 'frente' || costadoVisible(m, p, modelo)) ? 'frente' : cuerpoDef;
      if (!quitar.includes(p)) add(`cuerpo|${p}`, `${n}${def === 'frente' ? ' (visible)' : ''}`, mat(`cuerpo|${p}`, mat('cuerpo', def)), D + ext, hc, hc + (ext ? D + ext : 0));
    }
    // (las bases de los aéreos se ven desde abajo, pero van en blanco por decisión del estudio)
    if (!quitar.includes('piso')) add('cuerpo|piso', 'Base', mat('cuerpo|piso', mat('cuerpo', cuerpoDef)), W - 2 * T, D, W - 2 * T);
    if (!quitar.includes('techo')) add('cuerpo|techo', 'Techo', mat('cuerpo|techo', mat('cuerpo', cuerpoDef)), W - 2 * T, D, W - 2 * T);
    if (!quitar.includes('fondo')) { // trasera de cholguán (blanco, o del color que se le asignó)
      const f = m.materiales?.['cuerpo|fondo'] || m.materiales?.cuerpo;
      add('cuerpo|fondo', 'Trasera (cholguán)', `cholguan:${f ? limpio(f) : 'blanco'}`, W - 2 * T + 1, H - Z - (quitar.includes('piso') ? T : 2 * T) + 1, 0, 'cholguan');
    }
    // ---- divisiones verticales entre columnas
    const cs = celdas(m);
    const nCol = (m.columnas || []).length;
    for (let i = 0; i < nCol - 1; i++) add(`div|${i}`, `División vertical ${i + 1}`, mat('cuerpo', cuerpoDef), D - 1, H - Z - 2 * T, H - Z - 2 * T);
    // ---- frentes, repisas y cajones
    const largoCorr = CORREDERAS.filter((l) => l <= D - 3).pop() || CORREDERAS[0];
    for (const c of cs) {
      const k = `f|${c.col}|${c.fila}`, f = m.columnas?.[c.col]?.frentes?.[c.fila] || {};
      const frente = mat(k, mat('frentes', 'frente')), fw = c.w - .3, fh = c.h - .3;
      // repisas (en secciones con puerta o abiertas)
      if (c.tipo !== 'cajon') nivelesRepisa(c).forEach((y, i) => add(`${k}|rep|${i}`, `Repisa ${i + 1}`, mat(`${k}|rep|${i}`, mat(`${k}|rep`, mat('cuerpo', cuerpoDef))), c.w - T, D - 2, c.w - T));
      if (c.tipo === 'abierto' && !(c.y0 <= Z + .05) && (c.y1 < H - .05)) { /* las divisiones horizontales de secciones abiertas se cuentan como repisa extra */
        add(`${k}|div`, 'División horizontal', mat(`${k}|div`, mat('cuerpo', cuerpoDef)), c.w - T, D - 1, c.w - T);
      }
      if (c.tipo === 'puerta') { add(k, 'Puerta', frente, fw, fh, 2 * (fw + fh)); herrajes.bisagras += 2; }
      if (c.tipo === 'puerta_doble') {
        const n = c.hojas || 2, hw = (fw - (n - 1) * .3) / n;
        for (let i = 0; i < n; i++) add(k, `Puerta (hoja ${i + 1} de ${n})`, frente, hw, fh, 2 * (hw + fh));
        herrajes.bisagras += 2 * n;
      }
      if (c.tipo === 'panel') add(k, 'Panel fijo', frente, fw, fh, 2 * (fw + fh));
      if (c.tipo === 'cajon') {
        add(k, 'Frente de cajón', frente, fw, fh, 2 * (fw + fh));
        herrajes.correderas[largoCorr] = (herrajes.correderas[largoCorr] || 0) + 1;
        const ac = Math.max(8, c.h - 7), ic = c.w - 2 * T - 2.6; // alto de la caja e interior (holgura de las correderas)
        add(`${k}|caja`, 'Caja de cajón: laterales (2)', BLANCA, largoCorr, ac * 2, 2 * largoCorr);
        add(`${k}|caja`, 'Caja de cajón: frente y trasera', BLANCA, ic - 2 * T, ac * 2, 2 * (ic - 2 * T));
        add(`${k}|caja`, 'Fondo de cajón (cholguán)', 'cholguan:blanco', ic, largoCorr, 0, 'cholguan');
      }
    }
    // ---- cubierta: largo × ancho (con vuelos), sacados de encimeras y lavaplatos, y si lleva zócalo (respaldo)
    if (m.cubierta) {
      const cb = cubiertaDe(m), arts = Array.isArray(m.artefactos) ? m.artefactos : [];
      const bajo = arts.filter((a) => String(a.tipo).startsWith('lavaplatos') && a.montaje === 'bajo').length;
      cubiertas.push({ m: m.id, mueble: m.nombre, largo: r1(cb.x1 - cb.x0), ancho: r1(cb.z1 - cb.z0), sobrepuestos: arts.length - bajo, bajo, respaldo: !!m.cubierta_respaldo });
    }
    // ---- zócalo (marco de 4 tablas)
    if (Z > 0) {
      const z = marcoZocalo(m, T), zmat = mat('zocalo', ZOCALO[col.zocalo] || ZOCALO.grafito);
      add('zocalo', 'Zócalo frente y atrás', zmat, z.x1 - z.x0, Z * 2, z.x1 - z.x0);
      add('zocalo', 'Zócalo costados', zmat, z.z1 - z.z0 - 2 * T, Z * 2, 0);
    }
  }
  return { version: 1, piezas, herrajes, cubiertas, tapacanto_m: Math.round(canto) / 100 };
}

// Resumen por material (para el editor): m² de tablero y de cholguán, herrajes y tapacanto
export function resumenDespiece(d) {
  const porMat = {};
  for (const p of d.piezas) { const k = `${p.tipo}|${p.material}`; porMat[k] = (porMat[k] || 0) + p.area; }
  return { porMat, ...d };
}
