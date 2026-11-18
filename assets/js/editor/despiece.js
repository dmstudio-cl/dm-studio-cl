// Lista de materiales (despiece) calculada desde los módulos del editor. Solo cantidades: los precios
// viven en el repo privado y los aplica el Worker. Reglas del dueño (2026-11-18):
// - Cada tablero cuenta sus m² en su material. Sin material propio: melamina blanca (cuerpo, costados,
//   repisas, divisiones, cajones); los frentes usan la melamina general («frente»).
// - Las traseras son cholguán blanco; si el fondo tiene otro material, cholguán de ese color.
// - Cada hoja de puerta lleva 2 bisagras de cierre suave; cada cajón, un par de correderas telescópicas de
//   cierre suave del largo más cercano (sin pasarse) al fondo del mueble.
// - Tapacanto: metros lineales de los cantos visibles.
import { celdas, tablero, nivelesRepisa, marcoZocalo, cubiertaDe } from './modelo.js';

export const BLANCA = 'blanco-softwood'; // Masisa Blanco
const ZOCALO = { grafito: 'gris-grafito-natural-matt', negro: 'negro-natural-matt', aluminio: 'aluminio', blanco: BLANCA, frente: 'frente' };
const CUERPO = { blanco: BLANCA, gris: 'gris', negro: 'negro-natural-matt' };
export const CORREDERAS = [25, 30, 35, 40, 45, 50, 55]; // largos comerciales (cm)
const r1 = (v) => Math.round(v * 10) / 10;
// material de una pieza: sin «liston:» (los listones se cotizan como su melamina)
const limpio = (m) => String(m || '').replace(/^liston:/, '');

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
    const costadoDef = (m.costados || col.costados) === 'frente' ? 'frente' : cuerpoDef;
    const hc = H - (ext ? 0 : Z);
    for (const [p, n] of [['izq', 'Costado izquierdo'], ['der', 'Costado derecho']]) {
      if (!quitar.includes(p)) add(`cuerpo|${p}`, n, mat(`cuerpo|${p}`, mat('cuerpo', costadoDef)), D + ext, hc, hc + (ext ? D + ext : 0));
    }
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
