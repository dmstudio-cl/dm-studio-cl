// Lista de materiales y de cortes (despiece) calculada desde los módulos del editor. Solo cantidades y medidas:
// los precios viven en el repo privado y los aplica el Worker.
//
// Reglas de fabricación del estudio (2026-11-19, ver CLAUDE.md «Cómo fabrica el dueño un mueble»):
// - Tablero de 15 mm. Profundidad del cuerpo = profundidad del módulo − 3 mm de cholguán (la trasera va por detrás
//   y tapa todos los cantos). Con el vuelo de 6 cm, la cubierta queda en cuerpo + 7,8 cm.
// - Basal: base de ancho completo sobre el zócalo, costados y divisiones encima de la base, sin techo; arriba,
//   soporte delantero de melamina (10 cm) y trasero de pino tapa; las divisiones llevan rebaje para los soportes.
// - Aéreo: base y techo de ancho completo, costados y divisiones entre ambos; soportes: adelante arriba en melamina,
//   atrás arriba y atrás abajo en pino (anclaje al muro).
// - Torre: base (si va al piso) y techo; sin soportes; lo que parece repisa es una división horizontal fija.
//   Sobre una cubierta no lleva zócalo ni base.
// - Zócalo: marco de pino tapa canteada 1x4 (tiras de 3,2 m).
// - Frentes: desde el canto inferior de la base hasta 7 cm bajo el borde (con cubierta) o 1 cm (sin cubierta);
//   3 mm de luz entre hojas. 2 bisagras por hoja: recta si va en un costado libre, semicurva si va en una
//   división compartida con otra puerta. Cajones: un par de correderas del largo más cercano (sin pasarse).
// - Tapacanto de 1 mm: puertas y frentes los 4 cantos; base y techo 3 (frente y laterales); costados,
//   divisiones y soporte delantero solo el frontal. La medida de corte descuenta 1 mm por canto enchapado.
import { celdas, tablero, nivelesRepisa, marcoZocalo, cubiertaDe, girar, distancias, hojasDe, CHOLGUAN } from './modelo.js';

export const BLANCA = 'blanco-softwood'; // Masisa Blanco
const CUERPO = { blanco: BLANCA, gris: 'gris', negro: 'negro-natural-matt' };
export const CORREDERAS = [25, 30, 35, 40, 45, 50, 55]; // largos comerciales (cm)
export const TAPACANTO = .1;  // cm que suma cada canto enchapado
export const LUZ = .3;        // cm entre hojas y frentes
export const SOPORTE = 10;    // alto de los soportes horizontales (cm)
export const PINO = { espesor: 2, largo: 320, corte: .5 }; // pino tapa canteada 1x4 de 3,2 m; corte de sierra
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

// Dirección de la veta en el mueble: 'v' = a lo largo del alto de la pieza (costados, divisiones, puertas),
// 'h' = a lo largo del ancho (base, techo, repisas, soportes, frentes y cajas de cajón)
const vetaDe = (k, nombre) => (/^cuerpo\|(izq|der)$|^div\|/.test(k) || /^(Puerta|Panel)/.test(nombre) ? 'v' : 'h');

// Clase de construcción del módulo
export function estructura(m) {
  const Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0);
  let E;
  if (m.tipo === 'aereo') E = { clase: 'aereo', base: true, techo: true, Z };
  else if (m.tipo === 'torre') {
    const sobreCubierta = !Z && (+m.elevacion || 0) > 20;
    E = { clase: sobreCubierta ? 'torre-cubierta' : 'torre', base: !sobreCubierta, techo: true, Z };
  } else E = { clase: 'basal', base: true, techo: false, Z };
  // techo de melamina forzado en el mueble (panel derecho): 'si' | 'no'
  if (m.techo === 'si') E.techo = true;
  if (m.techo === 'no') E.techo = false;
  return E;
}

// Reparte una lista de largos de pino en tiras de 3,2 m (primero los más largos)
function tirasPino(largos) {
  const tiras = [];
  for (const l of [...largos].sort((a, b) => b - a)) {
    if (l > PINO.largo) { tiras.push(...Array(Math.ceil(l / PINO.largo)).fill(0)); continue; } // pieza más larga que una tira: va unida
    const t = tiras.findIndex((u) => u > 0 && u + l + PINO.corte <= PINO.largo);
    if (t >= 0) tiras[t] += l + PINO.corte; else tiras.push(l);
  }
  return tiras.length;
}

export function despiece(modelo) {
  const col = modelo.colores || {}, piezas = [], cubiertas = [], pinos = [];
  const herrajes = { bisagras: 0, bisagras_rectas: 0, bisagras_semicurvas: 0, correderas: {} };
  const porModulo = {}; // herrajes de cada mueble (el Worker cotiza cualquier combinación de muebles)
  let canto = 0, cantoBlanco = 0; // cm de tapacanto (total y de las piezas en melamina blanca)
  const cuerpoDef = CUERPO[col.cuerpo] || BLANCA;
  for (const m of modelo.modulos || []) {
    if (!m || m.artefacto) continue; // artefactos de piso: referencia, no se fabrican
    const h0 = { b: herrajes.bisagras, r: herrajes.bisagras_rectas, s: herrajes.bisagras_semicurvas, c: { ...herrajes.correderas } };
    const T = tablero(m), W = +m.ancho, H = +m.alto, D = +m.profundidad;
    const E = estructura(m), Z = E.Z, Dk = r1(D - CHOLGUAN), Hc = H - Z; // profundidad y alto del cuerpo
    const quitar = Array.isArray(m.quitar) ? m.quitar : [], ext = Math.max(0, +m.costados_atras || 0);
    const conBase = E.base && !quitar.includes('piso'), conTecho = E.techo && !quitar.includes('techo');
    const mat = (k, def) => limpio(m.materiales?.[k]) || def;
    // ancho × alto = medida final; cantos = cuántos cantos del largo «ancho» (arriba/abajo) y del largo «alto»
    // (izquierda/derecha) llevan tapacanto. La medida de corte descuenta 1 mm por canto enchapado.
    const add = (k, nombre, material, a, b, cantos = { ancho: 0, alto: 0 }, tipo = 'tablero', extra = {}) => {
      if (a <= 0 || b <= 0) return;
      const ca = tipo === 'tablero' ? cantos.ancho : 0, cb = tipo === 'tablero' ? cantos.alto : 0;
      piezas.push({ m: m.id, k, mueble: m.nombre, nombre, material, tipo, ancho: r1(a), alto: r1(b), area: Math.round(a * b) / 1e4,
        espesor: tipo === 'cholguan' ? 3 : T * 10, cantos: { ancho: ca, alto: cb },
        corte: { ancho: r1(a - cb * TAPACANTO), alto: r1(b - ca * TAPACANTO) }, veta: vetaDe(k, nombre), ...extra });
      canto += a * ca + b * cb;
      if (material === BLANCA) cantoBlanco += a * ca + b * cb; // tapacanto blanco (más barato); el resto es de color
    };
    const pino = (nombre, largo, k = 'pino') => { if (largo <= 0) return; pinos.push(largo); piezas.push({ m: m.id, k, mueble: m.nombre, nombre, material: 'pino-1x4', tipo: 'pino', ancho: r1(largo), alto: SOPORTE, area: 0, espesor: PINO.espesor * 10 }); };

    // ---- cuerpo
    // Alto de costados y divisiones: van sobre la base y bajo el techo (si los hay)
    const hs = Hc - (conBase ? T : 0) - (conTecho ? T : 0);
    const modoCostado = m.costados || col.costados || 'frente';
    for (const [p, n] of [['izq', 'Costado izquierdo'], ['der', 'Costado derecho']]) {
      const def = modoCostado === 'frente' && (m.costados === 'frente' || costadoVisible(m, p, modelo)) ? 'frente' : cuerpoDef;
      // costado alargado hacia atrás hasta el piso (isla con sillas): se ven también su canto trasero e inferior
      if (!quitar.includes(p)) add(`cuerpo|${p}`, `${n}${def === 'frente' ? ' (visible)' : ''}`, mat(`cuerpo|${p}`, mat('cuerpo', def)), Dk + ext, ext ? Hc : hs, { ancho: ext ? 1 : 0, alto: ext ? 2 : 1 });
    }
    // (las bases de los aéreos se ven desde abajo, pero van en blanco por decisión del estudio)
    if (conBase) add('cuerpo|piso', 'Base', mat('cuerpo|piso', mat('cuerpo', cuerpoDef)), W, Dk, { ancho: 1, alto: 2 });
    if (conTecho) add('cuerpo|techo', 'Techo', mat('cuerpo|techo', mat('cuerpo', cuerpoDef)), W, Dk, { ancho: 1, alto: 2 });
    if (!quitar.includes('fondo')) { // trasera de cholguán por detrás del cuerpo: tapa todos los cantos
      const f = m.materiales?.['cuerpo|fondo'] || m.materiales?.cuerpo;
      add('cuerpo|fondo', 'Trasera (cholguán)', `cholguan:${f ? limpio(f) : 'blanco'}`, W, Hc, undefined, 'cholguan');
    }
    // Soportes horizontales de 10 cm entre las caras interiores de los costados
    const li = W - 2 * T;
    // El soporte de melamina lleva tapacanto solo en el borde inferior (no costados ni borde superior)
    const matSoporte = mat('soporte', mat('cuerpo', cuerpoDef)); // color propio del soporte (ej. coigüe), si se eligió
    const conSoporte = !quitar.includes('soporte'); // se puede quitar el soporte delantero (ej. nicho del microondas)
    if (E.clase === 'basal') {
      if (conSoporte) add('soporte|frente', 'Soporte superior delantero', matSoporte, li, SOPORTE, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
      pino('Soporte superior trasero (pino)', li, 'soporte|atras');
    }
    if (E.clase === 'aereo') {
      if (conSoporte) add('soporte|frente', 'Soporte superior delantero', matSoporte, li, SOPORTE, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
      pino('Soporte superior trasero (pino)', li, 'soporte|atras');
      pino('Soporte inferior trasero, anclaje al muro (pino)', li, 'soporte|anclaje');
    }
    // ---- divisiones verticales entre columnas: misma medida que los costados, con rebaje para los soportes
    const rebaje = E.clase === 'basal' ? 'Rebaje arriba de 10 cm: 1,5 cm adelante y 2 cm atrás'
      : E.clase === 'aereo' ? 'Rebajes de 10 cm: adelante arriba 1,5 cm; atrás arriba y abajo 2 cm' : '';
    const cs = celdas(m), nCol = (m.columnas || []).length;
    for (let i = 0; i < nCol - 1; i++) add(`div|${i}`, `División vertical ${i + 1}`, mat('cuerpo', cuerpoDef), Dk, hs, { ancho: 0, alto: 1 }, 'tablero', rebaje ? { nota: rebaje } : {});

    // ---- frentes, divisiones horizontales, repisas y cajones
    const arriba = m.cubierta ? 7 : 1; // descuento superior de los frentes
    const yBase = conBase || Z ? Z : 0; // canto inferior de la base
    const conFrente = (c) => c && c.tipo !== 'abierto';
    const vecino = (c, x) => cs.find((o) => o !== c && (Math.abs(o.x1 - x) < .05 || Math.abs(o.x0 - x) < .05) && Math.min(o.y1, c.y1) - Math.max(o.y0, c.y0) > 1);
    // bisagra en el borde x de una celda: recta si es un costado o si al otro lado no hay puerta; si no, semicurva
    const bisagras = (c, x, n = 2) => {
      const interior = x > .05 && x < W - .05, otra = interior && conFrente(vecino(c, x));
      herrajes.bisagras += n; if (otra) herrajes.bisagras_semicurvas += n; else herrajes.bisagras_rectas += n;
    };
    for (const c of cs) {
      const k = `f|${c.col}|${c.fila}`;
      const frente = mat(k, mat('frentes', 'frente'));
      // medida final del frente: a ras afuera, 1,5 mm hacia cada vecino (3 mm de luz), y el descuento de arriba
      const fx0 = c.x0 + (c.x0 > .05 ? LUZ / 2 : 0), fx1 = c.x1 - (c.x1 < W - .05 ? LUZ / 2 : 0);
      const fy0 = c.y0 <= Z + .05 ? yBase : c.y0 + LUZ / 2, fy1 = c.y1 >= H - .05 ? H - arriba : c.y1 - LUZ / 2;
      const mm = (v) => Math.floor(v * 10 + 1e-6) / 10; // los frentes se redondean al mm hacia abajo (nunca suman de más)
      const fw = mm(fx1 - fx0), fh = mm(fy1 - fy0);
      // ancho interior de la sección (entre costados o divisiones)
      const wi = (c.x1 - c.x0) - (c.x0 < .05 ? T : T / 2) - (c.x1 > W - .05 ? T : T / 2);
      const fija = E.clase.startsWith('torre');
      if (c.tipo !== 'cajon') nivelesRepisa(c).forEach((y, i) => add(`${k}|rep|${i}`, fija ? `División horizontal fija ${i + 1}` : `Repisa ${i + 1}`,
        mat(`${k}|rep|${i}`, mat(`${k}|rep`, mat('cuerpo', cuerpoDef))), fija ? wi : wi - .2, fija ? Dk : Dk - 1, { ancho: 1, alto: 0 }));
      if (c.tipo === 'abierto' && !(c.y0 <= Z + .05) && (c.y1 < H - .05)) { // división horizontal de una sección abierta
        add(`${k}|div`, 'División horizontal', mat(`${k}|div`, mat('cuerpo', cuerpoDef)), wi, Dk, { ancho: 1, alto: 0 });
      }
      const c4 = { ancho: 2, alto: 2 };
      if (c.tipo === 'puerta') {
        add(k, 'Puerta', frente, fw, fh, c4);
        const f = m.columnas?.[c.col]?.frentes?.[c.fila] || {};
        bisagras(c, f.bisagra === 'derecha' ? c.x1 : c.x0);
      }
      if (c.tipo === 'puerta_doble') {
        const n = hojasDe(m.columnas?.[c.col]?.frentes?.[c.fila], c.w), hw = mm((fw - (n - 1) * LUZ) / n);
        for (let i = 0; i < n; i++) {
          add(k, `Puerta (hoja ${i + 1} de ${n})`, frente, hw, fh, c4);
          if (i === 0) bisagras(c, c.x0); else if (i === n - 1) bisagras(c, c.x1);
          else { herrajes.bisagras += 2; herrajes.bisagras_semicurvas += 2; } // hoja del medio: abre hacia otra puerta
        }
      }
      if (c.tipo === 'panel') add(k, 'Panel fijo', frente, fw, fh, c4);
      if (c.tipo === 'cajon') {
        // hueco del cajón: sobre la base (fila de abajo) y bajo el soporte o el techo (fila de arriba)
        const y0i = c.y0 <= Z + .05 ? yBase + (conBase ? T : 0) : c.y0;
        const y1i = c.y1 >= H - .05 ? H - (E.clase === 'basal' ? SOPORTE : E.clase === 'aereo' ? SOPORTE + T : conTecho ? T : 0) : c.y1;
        const f = m.columnas?.[c.col]?.frentes?.[c.fila] || {};
        let frenteY0 = fy0, frenteY1 = fy1;
        if (f.montaje === 'dentro') { // frente dentro de las separaciones: 3 mm de luz contra el marco y entre cajones (1,5 mm cada uno)
          frenteY0 = c.y0 <= Z + .05 ? y0i + LUZ : c.y0 + LUZ / 2; frenteY1 = c.y1 >= H - .05 ? y1i - LUZ : c.y1 - LUZ / 2;
          add(k, 'Frente de cajón (dentro)', frente, mm(wi - 2 * LUZ), mm(frenteY1 - frenteY0), c4);
        } else add(k, 'Frente de cajón', frente, fw, fh, c4); // sobre los cantos: igual que una puerta
        // caja: 12,5 mm por lado para las correderas y 2 cm menos que el fondo del cuerpo. Alto: sus costados quedan
        // 2 cm bajo el soporte de 10 cm (o el techo) en el cajón de arriba, y 2 cm bajo el canto superior del frente en los demás.
        const tope = (c.y1 >= H - .05 ? y1i : frenteY1) - 2, piso = Math.max(frenteY0, y0i);
        const ac = r1(Math.max(6, tope - piso)), ic = r1(wi - 2 * 1.25), lc = r1(Dk - 2 - (f.montaje === 'dentro' ? T : 0));
        const corr = CORREDERAS.filter((l) => l <= lc).pop() || CORREDERAS[0]; // la más cercana sin pasarse de la caja
        herrajes.correderas[corr] = (herrajes.correderas[corr] || 0) + 1; // un par por cajón
        add(`${k}|caja`, 'Caja de cajón: lateral', BLANCA, lc, ac, { ancho: 1, alto: 0 });
        add(`${k}|caja`, 'Caja de cajón: lateral', BLANCA, lc, ac, { ancho: 1, alto: 0 });
        add(`${k}|caja`, 'Caja de cajón: frente interior', BLANCA, ic - 2 * T, ac, { ancho: 1, alto: 0 });
        add(`${k}|caja`, 'Caja de cajón: trasera', BLANCA, ic - 2 * T, ac, { ancho: 1, alto: 0 });
        add(`${k}|caja`, 'Fondo de cajón (cholguán)', 'cholguan:blanco', ic, lc, undefined, 'cholguan');
      }
    }
    // ---- cubierta: largo × ancho (con vuelos), sacados de encimeras y lavaplatos, y si lleva zócalo (respaldo)
    if (m.cubierta) {
      const cb = cubiertaDe(m), arts = Array.isArray(m.artefactos) ? m.artefactos : [];
      const bajo = arts.filter((a) => String(a.tipo).startsWith('lavaplatos') && a.montaje === 'bajo').length;
      cubiertas.push({ m: m.id, mueble: m.nombre, largo: r1(cb.x1 - cb.x0), ancho: r1(cb.z1 - cb.z0), sobrepuestos: arts.length - bajo, bajo, respaldo: !!m.cubierta_respaldo });
    }
    // ---- zócalo: marco de pino bajo la base (frente y atrás de largo completo; costados entre ambos)
    if (Z > 0 && conBase) {
      const z = marcoZocalo(m, T);
      pino('Zócalo frente (pino)', r1(z.x1 - z.x0), 'zocalo'); pino('Zócalo atrás (pino)', r1(z.x1 - z.x0), 'zocalo');
      pino('Zócalo costado (pino)', r1(z.z1 - z.z0 - 2 * PINO.espesor), 'zocalo'); pino('Zócalo costado (pino)', r1(z.z1 - z.z0 - 2 * PINO.espesor), 'zocalo');
    }
    // herrajes de este mueble = lo que sumó al total
    const cor = {};
    for (const [l, n] of Object.entries(herrajes.correderas)) { const d = n - (h0.c[l] || 0); if (d) cor[l] = d; }
    porModulo[m.id] = { bisagras: herrajes.bisagras - h0.b, bisagras_rectas: herrajes.bisagras_rectas - h0.r, bisagras_semicurvas: herrajes.bisagras_semicurvas - h0.s, correderas: cor };
  }
  herrajes.pino = { tiras: tirasPino(pinos), metros: Math.round(pinos.reduce((a, b) => a + b, 0)) / 100 };
  return { version: 3, piezas, herrajes, por_modulo: porModulo, cubiertas, tapacanto_m: Math.round(canto) / 100,
    tapacanto_blanco_m: Math.round(cantoBlanco) / 100, tapacanto_color_m: Math.round(canto - cantoBlanco) / 100, tapacanto_mm: TAPACANTO * 10 };
}

// Resumen por material (para el editor): m² de tablero y de cholguán, herrajes y tapacanto
export function resumenDespiece(d) {
  const porMat = {};
  for (const p of d.piezas) { const k = `${p.tipo}|${p.material}`; porMat[k] = (porMat[k] || 0) + p.area; }
  return { porMat, ...d };
}
