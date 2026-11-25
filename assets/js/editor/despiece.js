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
import { celdas, tablero, nivelesRepisa, marcoZocalo, cubiertaDe, girar, distancias, hojasDe, CHOLGUAN, unionesL, zocaloL, soportesL } from './modelo.js';

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

// Dirección de la veta de la pieza (regla del estudio, 2026-11-20): siempre a lo largo de su lado más largo, que
// va a lo largo de los 2500 mm de la plancha. 'v' = el alto es el lado largo; 'h' = el ancho.
const vetaDe = (ancho, alto) => (alto >= ancho ? 'v' : 'h');
export const vetaLargo = (p) => (+p.alto >= +p.ancho ? 'v' : 'h');

// Clase de construcción del módulo
const mmAbajo = (v) => Math.floor(v * 10 + 1e-2) / 10; // los frentes se redondean al mm hacia abajo (nunca suman de más; tolera 0,01 mm de redondeo)
// Medida final de un frente (cm): a ras afuera, 1,5 mm hacia cada vecino (3 mm de luz) y el descuento de arriba
// (7 cm con cubierta, 1 cm sin). En una sección de varias hojas, cada hoja = (ancho − 3 mm entre hojas) / n.
// La usan el despiece y las medidas de la vista Frente (así lo que se ve es lo que se corta).
export function medidaFrente(m, c) {
  const W = +m.ancho, H = +m.alto, E = estructura(m), Z = E.Z;
  const conBase = E.base && !(Array.isArray(m.quitar) && m.quitar.includes('piso'));
  const arriba = m.cubierta ? 7 : 1, yBase = conBase || Z ? Z : 0;
  const x0 = c.x0 + (c.x0 > .05 ? LUZ / 2 : 0), x1 = c.x1 - (c.x1 < W - .05 ? LUZ / 2 : 0);
  const y0 = c.y0 <= Z + .05 ? yBase : c.y0 + LUZ / 2, y1 = c.y1 >= H - .05 ? H - arriba : c.y1 - LUZ / 2;
  const w = mmAbajo(x1 - x0), h = mmAbajo(y1 - y0);
  const n = c.tipo === 'puerta_doble' ? hojasDe(m.columnas?.[c.col]?.frentes?.[c.fila], c.w) : 1;
  return { x0, x1, y0, y1, w, h, hojas: n, hoja: n > 1 ? mmAbajo((w - (n - 1) * LUZ) / n) : w };
}
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
  const col = modelo.colores || {}, piezas = [], cubiertas = [], pinos = [], cajones = [];
  const herrajes = { bisagras: 0, bisagras_rectas: 0, bisagras_semicurvas: 0, correderas: {} };
  const porModulo = {}; // herrajes de cada mueble (el Worker cotiza cualquier combinación de muebles)
  let canto = 0, cantoBlanco = 0; // cm de tapacanto (total y de las piezas en melamina blanca)
  const cuerpoDef = CUERPO[col.cuerpo] || BLANCA;
  const uniones = unionesL(modelo); // muebles en L: una trasera por muro y un zócalo en L
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
        corte: { ancho: r1(a - cb * TAPACANTO), alto: r1(b - ca * TAPACANTO) }, veta: vetaDe(a, b), ...extra });
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
      const uB = uniones.find((u) => u.B === m); // en L: sigue y tapa el costado del mueble de la esquina (un solo corte)
      add('cuerpo|fondo', uB ? `Trasera en L (cholguán, tapa el costado de «${uB.A.nombre}»)` : 'Trasera (cholguán)', `cholguan:${f ? limpio(f) : 'blanco'}`, W + (uB ? +uB.A.profundidad : 0), Hc, undefined, 'cholguan');
    }
    // Soportes horizontales de 10 cm entre las caras interiores de los costados
    const li = W - 2 * T;
    // El soporte de melamina lleva tapacanto solo en el borde inferior (no costados ni borde superior)
    const matSoporte = mat('soporte', mat('cuerpo', cuerpoDef)); // color propio del soporte (ej. coigüe), si se eligió
    const conSoporte = !quitar.includes('soporte'); // se puede quitar el soporte delantero (ej. nicho del microondas)
    if (E.clase === 'basal') {
      // en L: el delantero y el trasero se unen a 45° en la esquina (largo hasta la punta larga del inglete)
      const uL = uniones.find((u) => u.A === m || u.B === m), sL = uL ? soportesL(uL, PINO.espesor)[uL.A === m ? 'A' : 'B'] : null;
      const enL = sL ? ', en L: corte a 45° en la esquina' : '';
      if (conSoporte) add('soporte|frente', `Soporte superior delantero${enL}`, matSoporte, sL ? sL.frente.largo : li, SOPORTE, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
      pino(`Soporte superior trasero (pino${enL})`, r1(sL ? sL.atras.largo : li), 'soporte|atras');
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
      const { y0: fy0, y1: fy1, w: fw, h: fh } = medidaFrente(m, c);
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
        const { hojas: n, hoja: hw } = medidaFrente(m, c);
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
          add(k, 'Frente de cajón (dentro)', frente, mm(wi - 2 * LUZ), mm(frenteY1 - frenteY0), c4, 'tablero', { cajon: k });
        } else add(k, 'Frente de cajón', frente, fw, fh, c4, 'tablero', { cajon: k }); // sobre los cantos: igual que una puerta
        // caja: 12,5 mm por lado para las correderas y 2 cm menos que el fondo del cuerpo. Alto: sus costados quedan
        // 2 cm bajo el soporte de 10 cm (o el techo) en el cajón de arriba, y 2 cm bajo el canto superior del frente en los demás.
        const tope = (c.y1 >= H - .05 ? y1i : frenteY1) - 2, piso = Math.max(frenteY0, y0i);
        const ac = r1(Math.max(6, tope - piso)), ic = r1(wi - 2 * 1.25), lc = r1(Dk - 2 - (f.montaje === 'dentro' ? T : 0)); // largo de la caja (laterales)
        const corr = CORREDERAS.filter((l) => l <= lc).pop() || CORREDERAS[0]; // la más cercana sin pasarse de la caja
        herrajes.correderas[corr] = (herrajes.correderas[corr] || 0) + 1; // un par por cajón
        // Caja (dueño, 2026-11-23): sin frente interior. Los laterales van directo al frente con tarugos.
        // Fondo como bandeja: los laterales llevan una ranura de 3 × 5 mm por dentro, a 5 mm del borde inferior; el
        // fondo entra por atrás hasta topar con el frente, pasa bajo la trasera (8 mm más baja que los laterales) y se
        // atornilla hacia arriba a ella. Fondo = ancho interior + 2 × 5 mm por el largo de los laterales. Si la trasera
        // queda bajo 10 cm, Imperial la corta al mínimo y se repasa en el taller.
        const cj = { cajon: k }; // marca las piezas del cajón: el Worker aplica la mano de obra mínima por cajón
        const ranura = ' (ranura 3 × 5 mm a 5 mm del borde inferior; va al frente con tarugos)';
        add(`${k}|caja`, `Caja de cajón: lateral${ranura}`, BLANCA, lc, ac, { ancho: 1, alto: 0 }, 'tablero', cj);
        add(`${k}|caja`, `Caja de cajón: lateral${ranura}`, BLANCA, lc, ac, { ancho: 1, alto: 0 }, 'tablero', cj);
        add(`${k}|caja`, 'Caja de cajón: trasera (8 mm más baja: el fondo pasa por debajo)', BLANCA, ic - 2 * T, r1(ac - .8), { ancho: 1, alto: 0 }, 'tablero', cj);
        add(`${k}|caja`, 'Fondo de cajón (cholguán, entra en la ranura)', 'cholguan:blanco', r1(ic - 2 * T + 1), lc, undefined, 'cholguan', cj);
        cajones.push({ m: m.id, k, corredera: corr });
      }
    }
    // ---- cubierta: largo × ancho (con vuelos), sacados de encimeras y lavaplatos, y si lleva zócalo (respaldo)
    if (m.cubierta) {
      const cb = cubiertaDe(m), arts = Array.isArray(m.artefactos) ? m.artefactos : [];
      const bajo = arts.filter((a) => String(a.tipo).startsWith('lavaplatos') && a.montaje === 'bajo').length;
      const encimeras = arts.filter((a) => !String(a.tipo).startsWith('lavaplatos')).length;
      // vuelo_max: el mayor vuelo (cm) para las reglas físicas de cada material (sobre su máximo pide refuerzo o no sirve)
      cubiertas.push({ m: m.id, mueble: m.nombre, largo: r1(cb.x1 - cb.x0), ancho: r1(cb.z1 - cb.z0), sobrepuestos: arts.length - bajo, bajo, encimeras,
        respaldo: !!m.cubierta_respaldo, vuelo_max: r1(Math.max(cb.v.frente, cb.v.atras, cb.v.izq, cb.v.der)) });
    }
    // ---- zócalo: marco de pino bajo la base (frente y atrás de largo completo; costados entre ambos)
    const uA = uniones.find((u) => u.A === m);
    if (Z > 0 && conBase && uA) { // mueble en L: un solo zócalo en L (lo lleva el de la esquina; el otro no lleva)
      for (const t of zocaloL(uA, PINO.espesor)) pino(`Zócalo en L, ${t.nombre} (pino)`, r1(t.largo), 'zocalo');
    } else if (Z > 0 && conBase && !uniones.some((u) => u.B === m)) {
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
  return { version: 3, piezas, herrajes, por_modulo: porModulo, cubiertas, cajones, tapacanto_m: Math.round(canto) / 100,
    tapacanto_blanco_m: Math.round(cantoBlanco) / 100, tapacanto_color_m: Math.round(canto - cantoBlanco) / 100, tapacanto_mm: TAPACANTO * 10 };
}

// Resumen por material (para el editor): m² de tablero y de cholguán, herrajes y tapacanto
export function resumenDespiece(d) {
  const porMat = {};
  for (const p of d.piezas) { const k = `${p.tipo}|${p.material}`; porMat[k] = (porMat[k] || 0) + p.area; }
  return { porMat, ...d };
}
