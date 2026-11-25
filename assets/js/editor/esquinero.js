// Módulo esquinero (dueño, 2026-11-23/24; dibujo en contexto/visual/de-daniel/13-esquineros-tipos-planta.jpg).
// Módulo separado de los basales rectos que ocupa el rincón entre dos muros y se acopla a los muebles vecinos.
// Se arma como un basal: 1 base (se pide rectangular y el calado en L se corta en el taller), 2 laterales (donde topa
// con cada vecino), 2 fondos de cholguán (uno por muro), 2 soportes delanteros de melamina unidos a 45° en el rincón
// y 2 traseros de pino que van desde el lateral hasta la esquina del muro, unidos a 45°. Cada lado tiene su fondo.
//
// Coordenadas locales (como cualquier mueble: origen en la esquina trasera izquierda, x hacia la derecha, z hacia el
// frente). Se calcula con el rincón a la derecha («der»): lado A junto al muro de atrás (x de 0 a ancho, fondo fa) y
// lado B junto al muro de la derecha (z de 0 a profundidad, fondo fb). Con el rincón a la izquierda se refleja en x.
// m.ancho = largo del lado A · m.profundidad = largo del lado B · m.fondo_a / m.fondo_b = fondo del cuerpo de cada lado.
// Este archivo no importa nada (modelo.js y despiece.js lo usan).

const LUZ = .3, CHOL = .3, SOPORTE = 10, PINO_E = 2, VUELO = 6, CT = 3.8;
const CORREDERAS_ESQ = [25, 30, 35, 40, 45, 50, 55, 60]; // largos comerciales (cm), los mismos de despiece.js

// Las 5 soluciones de esquina (nombres del dueño). lado = largo sugerido de cada lado más allá del fondo del otro.
// factor: los tipos 1, 3 y 4 usan factor 2,5 sobre los materiales (más trabajo); 2a y 2b, el normal.
export const SOLUCIONES = {
  '1': { nombre: 'Puerta giratoria', ayuda: 'Puerta en L unida a 2 bandejas de ¾ de círculo que giran sobre 2 platos (abajo y arriba). Cierre con retenes magnéticos, sin bisagras. Módulo cuadrado: eliges la hoja (30 a 60 cm) y la bandeja queda centrada, con Ø = lado − 2 cm.', lado: 32, factor: true, hojas: [30, 60], cuadrado: true },
  '2a': { nombre: 'Puertas con repisa fija en L', ayuda: '2 puertas independientes con bisagras de 165° cierre suave (2 si la hoja mide 30 cm, 3 si es más ancha) y una repisa fija en L (se pide rectangular; el calado se corta en el taller). Cada hoja puede medir de 30 a 60 cm.', lado: 32, hojas: [30, 60] },
  '2b': { nombre: 'Puertas con repisas intercaladas', ayuda: '2 puertas independientes con bisagras de 165° cierre suave (2 si la hoja mide 30 cm, 3 si es más ancha) y 2 repisas rectas, una por muro, a distinta altura. Cada hoja puede medir de 30 a 60 cm.', lado: 32, hojas: [30, 60] },
  '3': { nombre: 'Cajón space corner', ayuda: 'Cajones con frente en flecha que salen en diagonal y terminan en punta atrás. A los lados, compartimentos en trapecio rectángulo con puerta (bisagras semicurvas, de 35 a 60 cm) y repisa; sus lados en diagonal llevan, por el otro lado, las correderas.', lado: 82, factor: true, niveles: true, frenteCajon: true, hojas: [35, 60] },
  '4': { nombre: 'Cajones pivotantes', ayuda: '2 filas de cajones, una por lado, que giran hacia afuera, cada fila en su eje vertical de barra de acero de 3/4".', lado: 32, factor: true, niveles: true },
};
export const ORDEN_SOLUCIONES = ['1', '2a', '2b', '3', '4']; // las claves numéricas se ordenarían solas primero
export const esEsquinero = (m) => m?.tipo === 'esquinero';

export function nuevoEsquinero(id, { x = 0, z = 0, rotacion = 0, esquina = 'der', fondo = 58, alto = 85 } = {}) {
  return { id, nombre: 'Esquinero', tipo: 'esquinero', esquina, solucion: '', ancho: fondo + 32, profundidad: fondo + 32, fondo_a: fondo, fondo_b: fondo,
    alto, zocalo: 10, x, z, rotacion, elevacion: 0, cubierta: false, niveles: 3, frente_cajon: 40, columnas: [], tiradores: [] };
}
// Medidas sugeridas para una solución (el dueño las ajusta en el panel)
export function medidasSugeridas(m, sol = m.solucion) {
  const s = SOLUCIONES[sol], lado = s ? s.lado : 32, fa = +m.fondo_a || 58, fb = +m.fondo_b || 58;
  if (s?.cuadrado) { const S = Math.round(Math.max(fa, fb) + lado); return { ancho: S, profundidad: S }; } // puerta giratoria: cuadrado con el fondo más largo
  return { ancho: Math.round(fb + lado), profundidad: Math.round(fa + lado) };
}

// Medidas válidas del esquinero, con el rincón a la derecha. X() refleja una x si el rincón va a la izquierda.
export function geoEsquinero(m) {
  const T = (+m.tablero || 15) / 10, W = +m.ancho, L = +m.profundidad, H = +m.alto, Z = +m.zocalo || 0;
  const fa = Math.max(20, Math.min(+m.fondo_a || 58, L - T - 5)), fb = Math.max(20, Math.min(+m.fondo_b || 58, W - T - 5));
  const izq = m.esquina === 'izq', sol = SOLUCIONES[m.solucion] ? m.solucion : '';
  const niveles = Math.max(2, Math.min(3, Math.round(+m.niveles || 3)));
  const ld = Math.max(20, Math.min(+m.frente_cajon || 40, W - fb - T - 5, L - fa - T - 5)); // ancho del frente del cajón space corner por lado
  return { T, W, L, H, Z, fa, fb, xb: W - fb, izq, sol, niveles, ld, arriba: m.cubierta ? 7 : 1, X: (x) => (izq ? W - x : x) };
}

// Contorno en planta (cuerpo + frentes) en coordenadas locales del mueble
export function huellaEsquinero(m) {
  const g = geoEsquinero(m), { T, W, L, fa, xb } = g;
  return [[0, 0], [W, 0], [W, L], [xb - T, L], [xb - T, fa + T], [0, fa + T]].map(([x, z]) => [g.X(x), z]);
}
// Líneas del frente en planta (lado A y lado B), en coordenadas locales
export function frentesPlanta(m) {
  const g = geoEsquinero(m), { T, L, fa, xb } = g;
  return [[[g.X(0), fa + T], [g.X(xb - T), fa + T]], [[g.X(xb - T), fa + T], [g.X(xb - T), L]]];
}

// Bandeja del carrusel (tipo 1): el círculo más grande donde quepa sin que el eje salga del mueble; el eje va lo más
// cerca posible del rincón interior del frente, a 3 cm de cada cara (regla del dueño). Devuelve { cx, cz, r } (rincón a la der.).
// Puerta giratoria (tipo 1, dueño 2026-11-25, con su dibujo de referencia): el módulo es un cuadrado de lado
// S = fondo más largo + 1,5 + hoja (hoja de 30 a 60 cm) y la bandeja va centrada en él, con Ø = S − 2 cm (1 cm de holgura).
export function bandejaGiratoria(g) {
  const S = Math.min(g.W, g.L);
  return { cx: g.W - S / 2, cz: S / 2, r: Math.max(5, Math.floor((S - 2) / 2 * 10) / 10) };
}
export function bandejaCarrusel(g) {
  const cx = g.xb + 3, cz = g.fa - 3;
  const r = Math.min(cz - CHOL, g.W - CHOL - cx, cx - g.T, g.L - g.T - cz) - 1;
  return { cx, cz, r: Math.max(5, Math.floor(r * 10) / 10) };
}

// Línea de aire vertical en el rincón (dueño, 2026-11-24): cada hoja llega hasta el rincón dejando una línea abierta de
// mínimo 3 mm. Si el ancho de la hoja no deja girar su canto trasero (la diagonal de la hoja, √(ancho² + espesor²), es
// más larga que su ancho), la línea crece lo necesario. Con hojas normales manda el mínimo (30 cm × 1,5 → 0,4 mm).
export function luzRincon(g) {
  const w = Math.max(g.xb - g.T, g.L - g.fa - g.T) - LUZ;
  return Math.max(LUZ, Math.ceil((Math.hypot(w, g.T) - w) * 100) / 100);
}

// 2a y 2b: distancia desde la cara de la otra hoja a la que debe ir el centro del tirador para que esa hoja, al abrir,
// no lo toque. La otra hoja (ancho w) gira desde su bisagra; su canto libre pasa a √(w² − d²) de la bisagra cuando está a
// d de la cara: tiene que pasar 1 cm por fuera del tirador (que sale «sale» cm). Más 1 cm por el grosor del tirador.
export function distanciaTirador(w, luz, sale) {
  const libre = w + luz - sale - 1; // hasta dónde puede llegar el canto sin tocar el tirador
  return Math.sqrt(Math.max(0, w * w - libre * libre)) + 1;
}

// Frentes cerrados según la solución. Cada uno: { lado: 'A'|'B', s0, s1 (lo que se dibuja, a lo largo de su lado),
// corte (largo de la pieza), y0, y1, clase, nombre, cantos, tir }. Lado A: s = x (desde el lateral 1 hasta el rincón).
// Lado B: s = z (desde el rincón hasta el lateral 2). Alto: desde el canto inferior de la base hasta 7 cm bajo la
// cubierta (1 cm sin ella), como un basal. tir = dónde va el tirador ('s0'/'s1' = cerca de ese extremo, 'medio'),
// y si va horizontal (cajones). Los tiradores siguen las reglas de todos los muebles del proyecto.
export function frentesEsquinero(m, g = geoEsquinero(m), top = null) {
  const { T, L, Z, H, fa, xb, sol, niveles: n, ld } = g, y1 = top ?? H - g.arriba, out = [], gR = luzRincon(g);
  // Pegado a un basal (agrupado en L): el frente se ve continuo, con 3 mm de luz contra la puerta del vecino (dueño, 2026-11-25)
  const iA = m.vecino_a ? LUZ : 0, iB = m.vecino_b ? LUZ : 0;
  const A = [iA, xb - T - gR], B = [fa + T + gR, L - iB]; // cada hoja llega al rincón con su línea de aire
  const c4 = { ancho: 2, alto: 2 };
  const hoja = (lado, [s0, s1], clase, nombre, tir, extra = {}, y0 = Z, ya = y1) => { if (s1 - s0 > 1) out.push({ lado, s0, s1, corte: s1 - s0, y0, y1: ya, clase, nombre, cantos: c4, tir, ...extra }); };
  const pisos = (fn) => { const h = (y1 - Z - (n - 1) * LUZ) / n; for (let i = 0; i < n; i++) fn(Z + i * (h + LUZ), Z + i * (h + LUZ) + h, i); };
  if (sol === '1') { // la puerta en L gira con las bandejas: 2 tiradores, en los bordes de afuera (lejos del rincón)
    hoja('A', A, 'puerta', 'Puerta en L, hoja del lado 1 (va unida a las bandejas)', { en: 's0' });
    hoja('B', B, 'puerta', 'Puerta en L, hoja del lado 2 (va unida a las bandejas)', { en: 's1' });
  }
  if (sol === '2a' || sol === '2b') { hoja('A', A, 'puerta', 'Puerta del lado 1', { en: 's1' }); hoja('B', B, 'puerta', 'Puerta del lado 2', { en: 's0' }); }
  if (sol === '4') pisos((y0, ya, i) => { // cada fila gira en su eje del rincón: el tirador va en el extremo de afuera
    hoja('A', A, 'cajon', `Frente de cajón pivotante ${i + 1}, lado 1`, { en: 's0', horizontal: true }, {}, y0, ya);
    hoja('B', B, 'cajon', `Frente de cajón pivotante ${i + 1}, lado 2`, { en: 's1', horizontal: true }, {}, y0, ya);
  });
  if (sol === '3') { // frente en flecha: 2 piezas unidas a 45° en el rincón (largo hasta la punta larga del inglete)
    // (dueño, 2026-11-25, con fotos reales) cada hoja del frente en flecha lleva su tirador (2 por cajón). El frente del
    // cajón llega hasta la división diagonal y la puerta lateral parte ahí, con 3 mm de luz (como cualquier frente).
    // Puertas laterales de 35 a 60 cm.
    const c3 = { ancho: 2, alto: 1 }; // el canto del inglete va sin tapacanto
    const a0 = xb - ld + LUZ / 2, b1 = fa + ld - LUZ / 2;          // frente del cajón: desde la división hasta el rincón
    pisos((y0, ya, i) => {
      hoja('A', [a0, xb - T], 'cajon', `Frente del cajón ${i + 1} en flecha, lado 1 (inglete a 45° en el rincón)`, { en: 'medio', horizontal: true }, { corte: xb - a0, cantos: c3, cajon: i }, y0, ya);
      hoja('B', [fa, b1], 'cajon', `Frente del cajón ${i + 1} en flecha, lado 2 (inglete a 45° en el rincón)`, { en: 'medio', horizontal: true }, { corte: b1 - fa, cantos: c3, cajon: i }, y0, ya);
    });
    hoja('A', [iA, xb - ld - LUZ / 2], 'puerta', 'Puerta del compartimento lateral, lado 1', { en: 's1' });
    hoja('B', [fa + ld + LUZ / 2, L - iB], 'puerta', 'Puerta del compartimento lateral, lado 2', { en: 's0' });
  }
  return out;
}

// Hojas que se pueden medir en el panel (2a y 2b: las 2 puertas; 3: las puertas laterales): ancho actual y el largo de
// lado que da un ancho pedido. El rincón queda fijo (el panel corre el mueble).
export function hojasEditables(m, g = geoEsquinero(m)) {
  const s = SOLUCIONES[g.sol]; if (!s?.hojas) return null;
  const fr = frentesEsquinero(m, g).filter((f) => f.clase === 'puerta'), A = fr.find((f) => f.lado === 'A'), Bf = fr.find((f) => f.lado === 'B');
  const extra = g.sol === '3' ? g.ld + LUZ / 2 : g.T + luzRincon(g); // lo que va entre el fondo del otro lado y la hoja
  const iA = m.vecino_a ? LUZ : 0, iB = m.vecino_b ? LUZ : 0; // luz contra la puerta del basal vecino (agrupado)
  if (s.cuadrado) { const f = Math.max(g.fa, g.fb), lado = (v) => v + f + extra + Math.max(iA, iB); return { rango: s.hojas, cuadrado: true, a: A ? A.corte : 0, b: Bf ? Bf.corte : 0, anchoPara: lado, profundidadPara: lado }; }
  return { rango: s.hojas, a: A ? A.corte : 0, b: Bf ? Bf.corte : 0, anchoPara: (v) => v + g.fb + extra + iA, profundidadPara: (v) => v + g.fa + extra + iB };
}

// Divisiones diagonales del space corner (tipo 3), como cualquier división: se dibujan en Planta y en 3D y van en los
// cortes de Imperial. Cada una: { a, b } = extremos de su cara hacia el pasillo, { cx, cz } = centro del tablero,
// largo y giro (ry) — todo en coordenadas locales del mueble, ya reflejado si el rincón va a la izquierda.
export function divisionesEsquinero(m, g = geoEsquinero(m)) {
  if (g.sol !== '3') return [];
  const k = cajonSpaceCorner(g), t = g.T / 2 / Math.SQRT2; // medio espesor hacia el compartimento
  const una = (p, q, s) => { // s = hacia dónde queda el compartimento (−1: lado 1; +1: lado 2)
    const cx = (p[0] + q[0]) / 2 + s * t, cz = (p[1] + q[1]) / 2 + s * t;
    return { a: [g.X(p[0]), p[1]], b: [g.X(q[0]), q[1]], cx: g.X(cx), cz, largo: Math.hypot(q[0] - p[0], q[1] - p[1]), ry: g.izq ? -45 : 45 };
  };
  return [
    una(k.pa, [k.pa[0] + (g.fa - CHOL), CHOL], -1),           // lado 1: desde el frente hasta el fondo del muro 1
    una(k.pb, [g.W - CHOL, k.pb[1] - (g.fb - CHOL)], 1),      // lado 2: desde el frente hasta el fondo del muro 2
  ];
}

// Cajón space corner (tipo 3) en planta, con el rincón a la derecha. El cajón sale en diagonal (45°) por un pasillo
// entre 2 divisiones diagonales que parten donde termina el frente de cada lado. Caja: frente en flecha (2 piezas a
// 45°), 2 laterales diagonales, 2 traseras en flecha (una por muro, juntas en la punta del rincón) y fondo.
export function cajonSpaceCorner(g) {
  const { T, W, fa, fb, xb, ld } = g, holgura = 2; // la punta queda 2 cm antes de los fondos, como un cajón normal
  const pa = [xb - ld, fa], pb = [xb, fa + ld];                 // donde parte cada división (en la línea del cuerpo)
  const zb = CHOL + holgura, xk = W - CHOL - holgura;            // traseras: a lo largo del muro 1 (z = zb) y del muro 2 (x = xk)
  const latA = Math.SQRT2 * (fa - zb), latB = Math.SQRT2 * (fb - CHOL - holgura); // laterales (diagonal)
  const trasA = fb + ld - fa, trasB = fa + ld - fb;              // traseras en flecha
  const divA = Math.SQRT2 * (fa - CHOL), divB = Math.SQRT2 * (fb - CHOL); // divisiones diagonales hasta los fondos
  const fondo = [xk - pa[0], pb[1] - zb];                        // rectángulo que contiene el fondo (se corta en el taller)
  return { pa, pb, zb, xk, latA, latB, trasA, trasB, divA, divB, fondo, pasillo: Math.SQRT2 * ld };
}

// Zócalo en L de 6 tablas de pino con los retiros de un zócalo normal (5 adelante, 4 + 0,3 atrás, 2 en los extremos).
export function zocaloEsquinero(g, e = PINO_E, m = {}) {
  const fr = m.zocalo_retiro != null && m.zocalo_retiro !== '' ? +m.zocalo_retiro : 5;
  const xa = 2, za = 4 + CHOL, xw = g.W - 4 - CHOL, zend = g.L - 2, zf = g.fa - fr, xf = g.xb + fr;
  return [
    { nombre: 'atrás', x0: xa, x1: xw, z0: za, z1: za + e, largo: xw - xa },
    { nombre: 'frente del lado 1', x0: xa, x1: xf + e, z0: zf - e, z1: zf, largo: xf + e - xa },
    { nombre: 'extremo del lado 2', x0: xf, x1: xw, z0: zend - e, z1: zend, largo: xw - xf },
    { nombre: 'extremo del lado 1', x0: xa, x1: xa + e, z0: za + e, z1: zf - e, largo: zf - za - 2 * e },
    { nombre: 'muro del lado 2', x0: xw - e, x1: xw, z0: za + e, z1: zend - e, largo: zend - za - 2 * e },
    { nombre: 'frente del lado 2', x0: xf, x1: xf + e, z0: zf, z1: zend - e, largo: zend - zf - e },
  ].filter((t) => t.largo > 0);
}

// Dibujo CSS 3D del esquinero cerrado (en la vista general solo se ven los frentes cerrados; el interior se verá en
// el acercamiento fijo 3/4). o = { M, ver, fab, propio, PINO }.
export function dibujarEsquinero(G, m, o) {
  const g = geoEsquinero(m), { T, W, L, H, Z, fa, xb } = g, id = m.id, { M, ver, fab, propio, PINO } = o;
  const B = (x0, x1, y0, y1, z0, z1, tex, ref) => G.box({ w: x1 - x0, h: y1 - y0, d: z1 - z0, x: g.X((x0 + x1) / 2), y: (y0 + y1) / 2, z: (z0 + z1) / 2, tex, ref });
  const MC = propio('cuerpo') || M.cuerpo;
  if (ver('zocalo') && Z > 0) for (const t of zocaloEsquinero(g, T, m)) B(t.x0, t.x1, 0, Z, t.z0, t.z1, propio('zocalo') || (fab ? PINO : M.zocalo), `${id}|zocalo`);
  if (ver('cuerpo')) {
    B(0, W, Z, Z + T, 0, fa, MC, `${id}|cuerpo|piso`); B(xb, W, Z, Z + T, fa, L, MC, `${id}|cuerpo|piso`); // base en L
    B(0, T, Z + T, H, 0, fa, MC, `${id}|cuerpo|izq`); B(xb, W, Z + T, H, L - T, L, MC, `${id}|cuerpo|der`); // laterales
    B(0, W, Z, H, 0, CHOL, MC, `${id}|cuerpo|fondo`); B(W - CHOL, W, Z, H, CHOL, L, MC, `${id}|cuerpo|fondo`); // fondos
    for (const d of divisionesEsquinero(m, g)) { // divisiones diagonales (space corner): un tablero girado 45°
      const gd = G.group({ x: d.cx, y: (Z + T + H) / 2, z: d.cz, ry: d.ry });
      gd.box({ w: d.largo, h: H - Z - T, d: T, x: 0, y: 0, z: 0, tex: propio('cuerpo') || MC, ref: `${id}|esq|div` });
    }
    if (fab) { // soportes de 10 cm: delanteros de melamina y traseros de pino, unidos a 45° (se dibujan sin encimarse)
      B(T, xb, H - SOPORTE, H, fa - T, fa, propio('soporte') || MC, `${id}|soporte|frente`); B(xb, xb + T, H - SOPORTE, H, fa - T, L - T, propio('soporte') || MC, `${id}|soporte|frente`);
      B(T, W - CHOL - PINO_E, H - SOPORTE, H, CHOL, CHOL + PINO_E, PINO, `${id}|soporte|atras`); B(W - CHOL - PINO_E, W - CHOL, H - SOPORTE, H, CHOL, L - T, PINO, `${id}|soporte|atras`);
    }
  }
  if (ver('frentes')) {
    const top = fab ? H - g.arriba : H, fr = frentesEsquinero(m, g, top);
    const espec = (m.tiradores || []).find((t) => t?.esq); // modelo y color del tirador (del proyecto o del cliente)
    const def = ver('tiradores') && espec && o.tiradorDef?.(espec.modelo);
    fr.forEach((f, i) => {
      const tex = propio(`esq|${i}`, 'frentes') || M.frente, ref = `${id}|esq|${i}`, y0 = f.y0 + LUZ / 2, y1 = f.y1 - LUZ / 2;
      if (f.lado === 'A') B(f.s0 + LUZ / 2, f.s1 - LUZ / 2, y0, y1, fa, fa + T, tex, ref);
      else B(xb - T, xb, y0, y1, f.s0 + LUZ / 2, f.s1 - LUZ / 2, tex, ref);
      if (!def || !f.tir) return;
      const largo = def.largo || 10;
      let mg = f.tir.horizontal ? largo / 2 + 4 : 3.5;
      // 2a y 2b (dueño, 2026-11-25): el tirador de cada hoja va donde la otra hoja, al abrir, no lo toca
      if ((g.sol === '2a' || g.sol === '2b') && f.clase === 'puerta') {
        const otra = fr.find((o) => o.clase === 'puerta' && o.lado !== f.lado), sale = Math.max(...def.piezas.map((p) => (+p.z || 0) + (+p.d || 0) / 2));
        if (otra) mg = Math.max(mg, distanciaTirador(otra.corte, luzRincon(g), sale) - luzRincon(g));
      }
      const sT = f.tir.en === 'medio' ? (f.s0 + f.s1) / 2 : f.tir.en === 's0' ? f.s0 + mg : f.s1 - mg;
      const yT = f.tir.horizontal ? y1 - Math.min(5, (y1 - y0) / 3) : Math.max(y0 + largo / 2 + 2, y1 - largo / 2 - 4);
      const rz = f.tir.horizontal || espec.modelo?.startsWith?.('boton') ? 0 : 90;
      const gt = f.lado === 'A' ? G.group({ x: g.X(sT), y: yT, z: fa + T, rz }) : G.group({ x: g.X(xb - T), y: yT, z: sT, ry: g.izq ? 90 : -90, rz });
      const piezas = espec.modelo === 'perfil' ? def.piezas.map((p) => ({ ...p, w: (f.s1 - f.s0) * .96 })) : def.piezas;
      for (const p of piezas) gt.box({ ...p, tex: { bg: o.colorTirador?.(espec.color) || '#151312' }, ref: `${id}|esq|${i}` });
    });
  }
  if (ver('cubierta') && m.cubierta) { // cubierta en L: el lado A completo y el resto del lado B
    const tex = propio('cubierta') || M.cubierta, f = fa + T + VUELO;
    B(0, W, H, H + CT, 0, f, tex, `${id}|cubierta`); B(xb - T - VUELO, W, H, H + CT, f, L, tex, `${id}|cubierta`);
  }
}

// Despiece del esquinero. ctx = { add, pino, herrajes, mat, cuerpoDef, frente, BLANCA }: las mismas funciones del despiece.
// Devuelve la ficha del esquinero para el Worker: { m, solucion, factor, platos, retenes, barra_cm, confirmar }.
export function despieceEsquinero(m, ctx) {
  const g = geoEsquinero(m), { T, W, L, H, Z, fa, fb, xb, sol } = g, { add, pino, herrajes, mat, cuerpoDef, frente, BLANCA } = ctx;
  const r1 = (v) => Math.round(v * 10) / 10, Hc = H - Z, hs = Hc - T, cuerpo = mat('cuerpo', cuerpoDef);
  const ficha = { m: m.id, solucion: sol, factor: !!SOLUCIONES[sol]?.factor, platos: 0, retenes: 0, barra_cm: 0, tiradores: 0, confirmar: !sol };
  // base rectangular (W × L sin el cholguán); el calado en L y su tapacanto se hacen en el taller
  add('cuerpo|piso', 'Base en L (se pide rectangular; calado y tapacanto del calado en el taller)', mat('cuerpo|piso', cuerpo), W - .3, L - .3, undefined, 'tablero',
    { nota: `Calado: quitar ${r1(xb)} × ${r1(L - fa)} cm en el rincón del frente`, tapacanto_taller: r1(xb + L - fa) });
  add('cuerpo|izq', 'Lateral del lado 1', mat('cuerpo|izq', cuerpo), r1(fa - .3), hs, { ancho: 0, alto: 1 });
  add('cuerpo|der', 'Lateral del lado 2', mat('cuerpo|der', cuerpo), r1(fb - .3), hs, { ancho: 0, alto: 1 });
  const f = m.materiales?.['cuerpo|fondo'] || m.materiales?.cuerpo, ch = `cholguan:${f ? String(f).replace(/^liston:/, '') : 'blanco'}`;
  add('cuerpo|fondo', 'Fondo del lado 1 (cholguán)', ch, W, Hc, undefined, 'cholguan');
  add('cuerpo|fondo', 'Fondo del lado 2 (cholguán)', ch, r1(L - .3), Hc, undefined, 'cholguan');
  // soportes: delanteros desde el interior de cada lateral hasta la punta larga del inglete; traseros hasta la esquina del muro
  const sop = mat('soporte', cuerpo);
  add('soporte|frente', 'Soporte delantero del lado 1 (corte a 45° en el rincón)', sop, r1(xb), SOPORTE, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
  add('soporte|frente', 'Soporte delantero del lado 2 (corte a 45° en el rincón)', sop, r1(L - fa), SOPORTE, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
  pino('Soporte trasero del lado 1 (pino, 45° en la esquina)', r1(W - T), 'soporte|atras');
  pino('Soporte trasero del lado 2 (pino, 45° en la esquina)', r1(L - T), 'soporte|atras');
  if (Z > 0) for (const t of zocaloEsquinero(g, PINO_E, m)) pino(`Zócalo en L, ${t.nombre} (pino)`, r1(t.largo), 'zocalo');
  // frentes cerrados (medida final redondeada al mm hacia abajo; 4 cantos)
  const mm = (v) => Math.floor(v * 10 + 1e-2) / 10, c4 = { ancho: 2, alto: 2 };
  const frs = frentesEsquinero(m, g);
  frs.forEach((fr, i) => add(`esq|${i}`, fr.nombre, mat(`esq|${i}`, mat('frentes', frente)), mm(fr.corte), mm(fr.y1 - fr.y0), fr.cantos || c4, 'tablero'));
  ficha.tiradores = frs.filter((fr) => fr.tir).length;
  const semicurvas = (n) => { herrajes.bisagras += n; herrajes.bisagras_semicurvas += n; };
  const ri = (W - T - .3 - .2), rj = (L - T - .3 - .2); // interior de cada lado, con 1 mm de juego por lado
  // 2a y 2b (dueño, 2026-11-24): bisagras de 165° cierre suave, 2 si la hoja mide 30 cm y 3 si es más ancha
  if (sol === '2a' || sol === '2b') ficha.bisagras_165 = frs.filter((fr) => fr.clase === 'puerta').reduce((s, fr) => s + (Math.round(fr.corte) <= 30 ? 2 : 3), 0);
  if (sol === '1') { // 2 bandejas de ¾ de círculo: se piden cuadradas y el círculo se corta en el taller
    const b = bandejaGiratoria(g), d = r1(2 * b.r);
    for (const k of ['inferior', 'superior']) add('esq|bandeja', `Bandeja ${k} del carrusel (cuadrado; círculo de Ø ${d} cm con el cuarto del frente recortado, en el taller)`, BLANCA, d, d, undefined, 'tablero', { tapacanto_taller: r1(1.5 * Math.PI * b.r + 2 * b.r) });
    ficha.platos = 2; ficha.retenes = 2;
  }
  if (sol === '2a') {
    add('esq|repisa', 'Repisa fija en L (se pide rectangular; calado en el taller)', mat('esq|repisa', cuerpo), r1(ri), r1(rj), undefined, 'tablero',
      { nota: `Calado: quitar ${r1(xb - T)} × ${r1(L - fa - T)} cm en el rincón del frente`, tapacanto_taller: r1(xb - T + L - fa - T) });
  }
  if (sol === '2b') {
    add('esq|repisa', 'Repisa recta del lado 1 (más abajo)', mat('esq|repisa', cuerpo), r1(ri), r1(fa - .3 - .2), { ancho: 1, alto: 0 });
    add('esq|repisa', 'Repisa recta del lado 2 (más arriba)', mat('esq|repisa', cuerpo), r1(rj), r1(fb - .3 - .2), { ancho: 1, alto: 0 });
  }
  if (sol === '3') {
    const k = cajonSpaceCorner(g), n = g.niveles, div = mat('cuerpo', cuerpoDef);
    // divisiones diagonales del pasillo del cajón (ahí van las correderas); se cotizan como rectángulo
    add('esq|div', 'División diagonal del cajón, lado 1 (corte a 45° en los extremos, en el taller)', div, r1(k.divA), hs, { ancho: 0, alto: 1 });
    add('esq|div', 'División diagonal del cajón, lado 2 (corte a 45° en los extremos, en el taller)', div, r1(k.divB), hs, { ancho: 0, alto: 1 });
    // repisas en trapecio de los compartimentos laterales: se cotizan como rectángulo y la diagonal se corta en el taller
    const anA = k.pa[0] + (fa - .3) - T, anB = (L - k.pb[1]) + (fb - .3) - T;
    if (k.pa[0] - T > 5) add('esq|repisa', 'Repisa en trapecio del compartimento, lado 1 (rectángulo; diagonal en el taller)', mat('esq|repisa', cuerpo), r1(anA - .2), r1(fa - .3 - 1), { ancho: 1, alto: 0 });
    if (L - k.pb[1] - T > 5) add('esq|repisa', 'Repisa en trapecio del compartimento, lado 2 (rectángulo; diagonal en el taller)', mat('esq|repisa', cuerpo), r1(anB - .2), r1(fb - .3 - 1), { ancho: 1, alto: 0 });
    semicurvas(4); // puertas laterales (dueño, 2026-11-24): 2 bisagras semicurvas cada una
    // cajas: alto como un cajón normal (2 cm bajo el soporte en el de arriba; 2 cm bajo el canto de su frente en los demás)
    const hF = frs.filter((fr) => fr.cajon != null && fr.lado === 'A');
    const ranura = ' (ranura 3 × 5 mm a 5 mm del borde inferior; va al frente con tarugos)';
    hF.forEach((fr, i) => {
      const arriba = i === hF.length - 1, tope = (arriba ? H - SOPORTE : fr.y1) - 2, piso = Math.max(fr.y0, Z + T);
      const ac = r1(Math.max(6, tope - piso)), cj = { cajon: `esq${i}` };
      add('esq|caja', `Cajón ${i + 1}: lateral diagonal, lado 1${ranura}`, BLANCA, r1(k.latA), ac, { ancho: 1, alto: 0 }, 'tablero', cj);
      add('esq|caja', `Cajón ${i + 1}: lateral diagonal, lado 2${ranura}`, BLANCA, r1(k.latB), ac, { ancho: 1, alto: 0 }, 'tablero', cj);
      add('esq|caja', `Cajón ${i + 1}: trasera en flecha, muro 1 (8 mm más baja; 45° en la punta)`, BLANCA, r1(k.trasA), r1(ac - .8), { ancho: 1, alto: 0 }, 'tablero', cj);
      add('esq|caja', `Cajón ${i + 1}: trasera en flecha, muro 2 (8 mm más baja; 45° en la punta)`, BLANCA, r1(k.trasB), r1(ac - .8), { ancho: 1, alto: 0 }, 'tablero', cj);
      add('esq|caja', `Cajón ${i + 1}: fondo (cholguán; rectángulo, la forma en el taller)`, 'cholguan:blanco', r1(k.fondo[0]), r1(k.fondo[1]), undefined, 'cholguan', cj);
      // corredera: la más cercana al largo de la caja, sin pasarse (telescópica de cierre suave)
      const corr = CORREDERAS_ESQ.filter((l) => l <= Math.min(k.latA, k.latB)).pop() || CORREDERAS_ESQ[0];
      herrajes.correderas[corr] = (herrajes.correderas[corr] || 0) + 1;
      ficha.corredera = corr; ficha.caja = r1(Math.min(k.latA, k.latB));
    });
  }
  if (sol === '4') {
    ficha.barra_cm = r1(2 * Hc); // 2 ejes verticales del alto del cuerpo
    // cada cajón en tajada: un fondo de melamina que se pide rectangular (la forma y los bordes se hacen en el taller)
    const b = bandejaCarrusel(g), r = b.r, lar = r1(r * (1 + Math.SQRT1_2));
    for (let i = 0; i < g.niveles; i++) {
      add('esq|cajon', `Cajón pivotante ${i + 1}, lado 1: fondo (rectángulo; tajada y bordes en el taller)`, BLANCA, lar, r1(r), undefined, 'tablero');
      add('esq|cajon', `Cajón pivotante ${i + 1}, lado 2: fondo (rectángulo; tajada y bordes en el taller)`, BLANCA, lar, r1(r), undefined, 'tablero');
    }
  }
  return ficha;
}
