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
const AIRE_GIRO = .5; // puerta giratoria: aire en la punta de cada hoja contra el costado (dueño, 2026-11-25)
const CORREDERAS_ESQ = [25, 30, 35, 40, 45, 50, 55, 60]; // largos comerciales (cm), los mismos de despiece.js

// Las 5 soluciones de esquina (nombres del dueño). lado = largo sugerido de cada lado más allá del fondo del otro.
// Precio (dueño, 2026-11-25): todos los esquineros se cobran como un basal (factor normal) más sus herrajes.
export const SOLUCIONES = {
  '1': { nombre: 'Puerta giratoria', ayuda: 'Puerta en L unida a 2 bandejas de ¾ de círculo que giran sobre 2 platos (abajo y arriba). Cierre con retenes magnéticos, sin bisagras. Módulo cuadrado: eliges la hoja (30 a 60 cm) y la bandeja queda centrada, con Ø = lado − 2 cm.', lado: 32, hojas: [30, 60], cuadrado: true },
  '2a': { nombre: 'Puertas con repisa fija en L', ayuda: '2 puertas independientes con bisagras de 165° cierre suave (2 si la hoja mide 30 cm, 3 si es más ancha) y una repisa fija en L (se pide rectangular; el calado se corta en el taller). Cada hoja puede medir de 30 a 60 cm.', lado: 32, hojas: [30, 60] },
  '2b': { nombre: 'Puertas con repisas intercaladas', ayuda: '2 puertas independientes con bisagras de 165° cierre suave (2 si la hoja mide 30 cm, 3 si es más ancha) y 2 repisas rectas, una por muro, a distinta altura. Cada hoja puede medir de 30 a 60 cm.', lado: 32, hojas: [30, 60] },
  '3': { nombre: 'Cajón space corner', ayuda: 'Cajones con frente en flecha que salen en diagonal y terminan en punta atrás. A los lados, compartimentos en trapecio rectángulo con puerta (bisagras semicurvas, de 35 a 60 cm) y repisa; sus lados en diagonal llevan, por el otro lado, las correderas.', lado: 82, niveles: true, frenteCajon: true, hojas: [35, 60] },
  '4': { nombre: 'Cajones pivotantes', ayuda: '2 filas de cajones, una por lado, que giran hacia afuera, cada fila en su eje vertical de barra de acero de 3/4".', lado: 32, niveles: true },
};
// Soluciones que se ofrecen en el panel (las claves numéricas se ordenarían solas primero). El tipo 4, cajones
// pivotantes, queda guardado para más adelante (dueño, 2026-11-25): su código sigue aquí, pero no se ofrece.
export const ORDEN_SOLUCIONES = ['1', '2a', '2b', '3'];
// Esquinero aéreo (dueño, 2026-11-25): solo puertas con repisa en L (2a) o repisas intercaladas (2b), con las reglas de
// un aéreo (base y techo, sin zócalo ni cubierta, 3 soportes de 10 cm, puertas 1 cm bajo el alto total).
export const ORDEN_AEREO = ['2a', '2b'];
export const FONDO_AEREO = 35; // fondo del cuerpo por defecto, como los aéreos de las cocinas de referencia
export const esEsquinero = (m) => m?.tipo === 'esquinero';
// Tipos de esquina que calzan con las medidas actuales del mueble, sin cambiarlas (dueño, 2026-11-25: el cliente elige
// entre estos en el portal). Calza si sus hojas quedan dentro de su rango (ej. 30 a 60 cm) y, en la puerta giratoria,
// si el módulo es cuadrado. El aéreo solo ofrece 2a y 2b. El tipo actual siempre está.
export function solucionesQueCalzan(m) {
  const lista = m?.aereo ? ORDEN_AEREO : ORDEN_SOLUCIONES;
  return lista.filter((sol) => {
    if (sol === m.solucion) return true;
    const mm = { ...m, solucion: sol }, g = geoEsquinero(mm), s = SOLUCIONES[sol];
    if (g.sol !== sol) return false;
    if (s.cuadrado && Math.abs(g.W - g.L) > .5) return false;
    const h = hojasEditables(mm, g);
    if (h?.rango) { const [lo, hi] = h.rango; for (const v of [h.a, h.b]) if (!(v > 0) || v < lo - .5 || v > hi + .5) return false; }
    return true;
  });
}

export function nuevoEsquinero(id, { x = 0, z = 0, rotacion = 0, esquina = 'der', aereo = false, fondo = aereo ? FONDO_AEREO : 58, alto = aereo ? 70 : 85, elevacion = 0 } = {}) {
  return { id, nombre: aereo ? 'Esquinero aéreo' : 'Esquinero', tipo: 'esquinero', esquina, solucion: '', ancho: fondo + 32, profundidad: fondo + 32, fondo_a: fondo, fondo_b: fondo,
    alto, zocalo: aereo ? 0 : 10, x, z, rotacion, elevacion: aereo ? elevacion : 0, cubierta: false, niveles: 3, frente_cajon: 40, columnas: [], tiradores: [], ...(aereo ? { aereo: true } : {}) };
}
// Medidas sugeridas para una solución (el dueño las ajusta en el panel)
export function medidasSugeridas(m, sol = m.solucion) {
  const f0 = m.aereo ? FONDO_AEREO : 58, s = SOLUCIONES[sol], lado = s ? s.lado : 32, fa = +m.fondo_a || f0, fb = +m.fondo_b || f0;
  if (s?.cuadrado) { const S = Math.round(Math.max(fa, fb) + lado); return { ancho: S, profundidad: S }; } // puerta giratoria: cuadrado con el fondo más largo
  return { ancho: Math.round(fb + lado), profundidad: Math.round(fa + lado) };
}

// Cubierta en L del esquinero en coordenadas locales del mueble (ya reflejada si el rincón va a la izquierda):
// [brazo 1 (lado A, completo), brazo 2 (resto del lado B)], cada uno { x0, x1, z0, z1 }. Sirve para apoyar artefactos.
export function zonasCubiertaEsq(m) {
  const g = geoEsquinero(m), f = g.fa + g.T + VUELO, xs = (a, b) => (g.izq ? [g.W - b, g.W - a] : [a, b]);
  const [a0, a1] = xs(0, g.W), [b0, b1] = xs(g.xb - g.T - VUELO, g.W);
  return [{ x0: a0, x1: a1, z0: 0, z1: f }, { x0: b0, x1: b1, z0: f, z1: g.L }];
}

// Medidas válidas del esquinero, con el rincón a la derecha. X() refleja una x si el rincón va a la izquierda.
export function geoEsquinero(m) {
  const aereo = !!m.aereo, T = (+m.tablero || 15) / 10, W = +m.ancho, L = +m.profundidad, H = +m.alto, Z = aereo ? 0 : +m.zocalo || 0, f0 = aereo ? FONDO_AEREO : 58;
  const fa = Math.max(20, Math.min(+m.fondo_a || f0, L - T - 5)), fb = Math.max(20, Math.min(+m.fondo_b || f0, W - T - 5));
  const izq = m.esquina === 'izq', sol = SOLUCIONES[m.solucion] && (!aereo || ORDEN_AEREO.includes(m.solucion)) ? m.solucion : '';
  const niveles = Math.max(2, Math.min(3, Math.round(+m.niveles || 3)));
  const ld = Math.max(20, Math.min(+m.frente_cajon || 40, W - fb - T - 5, L - fa - T - 5)); // ancho del frente del cajón space corner por lado
  // barra (soporte delantero): 7 cm en la puerta giratoria (dueño, 2026-11-25, editable), 10 cm en los demás
  const sop = sol === '1' ? Math.max(3, Math.min(20, +m.soporte_alto || 7)) : SOPORTE;
  // yTop: techo del interior útil (bajo la barra delantera; en el aéreo, bajo su techo de melamina)
  return { m, T, W, L, H, Z, fa, fb, xb: W - fb, izq, sol, niveles, ld, sop, aereo, yTop: aereo ? H - T : H - sop, arriba: m.cubierta && !aereo ? 7 : 1, X: (x) => (izq ? W - x : x) };
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
// Puerta giratoria (tipo 1, dueño 2026-11-25): el módulo es un cuadrado de lado S = fondo más largo + 1,5 + hoja + aire.
// El EJE va en el vértice de la L, donde se juntan las 2 hojas por dentro (como los carruseles de fábrica): así cada hoja
// es un radio y al girar sus puntas se alejan de los costados. Antes iba al centro del cuadrado y las puertas cruzaban
// los costados (2,1 cm en un 90 × 90). Bandeja de ¾ de círculo centrada en el eje: Ø = 2 × (lo más corto entre el largo
// libre de cada hoja y el fondo más corto − la trasera de cholguán, menos 1 cm de holgura); el diámetro máximo lo
// define el lado con menor fondo (dueño). Ej.: 90 × 90 fondo 58 → Ø 59; 96 × 96 fondo 52,2 → Ø 82,6.
export function bandejaGiratoria(g) {
  const cx = g.xb, cz = g.fa, fMin = Math.min(g.fa, g.fb);
  const libre = Math.min(cx - g.T, g.L - g.T - cz, fMin - CHOL);
  return { cx, cz, r: Math.max(5, Math.floor((libre - 1) * 10) / 10) };
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
    // (dueño, 2026-11-25) al girar, la puerta entra al mueble: va bajo la barra delantera (7 cm, editable) y sobre la
    // base de 15 mm, entre los laterales, con 3 mm de aire arriba, abajo y a cada lado; si cambia la barra, la puerta
    // se ajusta sola. Vale para las 2 hojas.
    const yb = Z + T + LUZ, yt = H - g.sop - LUZ;
    // (dueño, 2026-11-25) las 2 hojas se juntan en el rincón sin línea de aire: se cortan a 45° (largo hasta la punta
    // larga del inglete, el canto del inglete sin tapacanto); en el modelo van de tope (la hoja 2 tapa el rincón)
    const c3 = { ancho: 2, alto: 1 };
    // en la punta, 5 mm de aire contra el costado (dueño, 2026-11-25): al girar, la puerta pasa a unos 4,7 mm de él
    hoja('A', [T + AIRE_GIRO, xb - T], 'puerta', 'Puerta en L, hoja del lado 1 (inglete a 45° en el rincón; va unida a las bandejas)', { en: 's0' }, { corte: xb - T - AIRE_GIRO, cantos: c3, tope: 's1' }, yb, yt);
    hoja('B', [fa, L - T - AIRE_GIRO], 'puerta', 'Puerta en L, hoja del lado 2 (inglete a 45° en el rincón; va unida a las bandejas)', { en: 's1' }, { corte: L - T - AIRE_GIRO - fa, cantos: c3, tope: 's0' }, yb, yt);
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
  if (s.cuadrado) { const f = Math.max(g.fa, g.fb), lado = (v) => v + f + g.T + AIRE_GIRO; /* hoja (hasta la punta del inglete) + lateral + 5 mm de aire */
    // la hoja no puede ser más larga que el fondo más corto − 1 cm: al girar, su punta tocaría la trasera
    const rango = [s.hojas[0], Math.min(s.hojas[1], Math.floor(Math.min(g.fa, g.fb) - 1))];
    return { rango, cuadrado: true, a: A ? A.corte : 0, b: Bf ? Bf.corte : 0, anchoPara: lado, profundidadPara: lado }; }
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

// Repisas en trapecio rectángulo de los compartimentos laterales del space corner (dueño, 2026-11-25), con el rincón a
// la derecha: van del fondo hasta 1 cm del frente, con 1 mm de juego contra el lateral y contra la división diagonal.
// Cada una: { pts: [[x, z] × 4] (fondo y frente), corto, largo, prof }.
export function repisasTrapecio(g) {
  const { T, W, L, fa, fb, xb, ld } = g, d2 = T * Math.SQRT2, out = {};
  const cA = xb - ld + fa - d2, xDiv = (z) => cA - z;                      // cara de la división 1 hacia su compartimento: x + z = cA
  const zf = fa - 1, xa = T + .1;
  if (xDiv(zf) - .1 - xa > 5) out.A = { pts: [[xa, CHOL], [xDiv(CHOL) - .1, CHOL], [xDiv(zf) - .1, zf], [xa, zf]], corto: xDiv(zf) - .1 - xa, largo: xDiv(CHOL) - .1 - xa, prof: zf - CHOL };
  const cB = xb + fa + ld + d2, zDiv = (x) => cB - x;                      // división 2: x + z = cB
  const xf = xb + 1, zl = L - T - .1, xw = W - CHOL;
  if (zl - zDiv(xf) - .1 > 5) out.B = { pts: [[xw, zDiv(xw) + .1], [xw, zl], [xf, zl], [xf, zDiv(xf) + .1]], corto: zl - zDiv(xf) - .1, largo: zl - zDiv(xw) - .1, prof: xw - xf };
  return out;
}
// Placa para pedir las 2 repisas en trapecio juntas, intercaladas (una girada), con 1 cm entre ambas para la sierra
// (dueño, 2026-11-25). Si hay una sola, su rectángulo.
export function placaTrapecios(g) {
  const { A, B } = repisasTrapecio(g);
  if (A && B) return { ancho: Math.max(A.corto + B.largo, A.largo + B.corto) + 1, prof: Math.max(A.prof, B.prof), n: 2 };
  const t = A || B; return t ? { ancho: t.largo, prof: t.prof, n: 1 } : null;
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
    const yl = g.aereo ? H - T : H; // en el aéreo los laterales van entre la base y el techo
    B(0, T, Z + T, yl, 0, fa, MC, `${id}|cuerpo|izq`); B(xb, W, Z + T, yl, L - T, L, MC, `${id}|cuerpo|der`); // laterales
    if (g.aereo) { B(0, W, H - T, H, 0, fa, MC, `${id}|cuerpo|techo`); B(xb, W, H - T, H, fa, L, MC, `${id}|cuerpo|techo`); } // techo en L
    B(0, W, Z, H, 0, CHOL, MC, `${id}|cuerpo|fondo`); B(W - CHOL, W, Z, H, CHOL, L, MC, `${id}|cuerpo|fondo`); // fondos
    for (const d of divisionesEsquinero(m, g)) { // divisiones diagonales (space corner): un tablero girado 45°
      const gd = G.group({ x: d.cx, y: (Z + T + H) / 2, z: d.cz, ry: d.ry });
      gd.box({ w: d.largo, h: H - Z - T, d: T, x: 0, y: 0, z: 0, tex: propio('esq|div', 'cuerpo') || MC, ref: `${id}|esq|div` });
    }
    if (fab) { // soportes de 10 cm: delanteros de melamina y traseros de pino, unidos a 45° (se dibujan sin encimarse)
      const ys = g.aereo ? H - T : H; // en el aéreo, bajo el techo
      B(T, xb, ys - g.sop, ys, fa - T, fa, propio('soporte') || MC, `${id}|soporte|frente`); B(xb, xb + T, ys - g.sop, ys, fa - T, L - T, propio('soporte') || MC, `${id}|soporte|frente`);
      B(T, W - CHOL - PINO_E, ys - SOPORTE, ys, CHOL, CHOL + PINO_E, PINO, `${id}|soporte|atras`); B(W - CHOL - PINO_E, W - CHOL, ys - SOPORTE, ys, CHOL, L - T, PINO, `${id}|soporte|atras`);
      if (g.aereo) { // aéreo: tercer soporte, atrás abajo (pino), para anclar al muro
        const y0 = Z + T; B(T, W - CHOL - PINO_E, y0, y0 + SOPORTE, CHOL, CHOL + PINO_E, PINO, `${id}|soporte|anclaje`); B(W - CHOL - PINO_E, W - CHOL, y0, y0 + SOPORTE, CHOL, L - T, PINO, `${id}|soporte|anclaje`);
      }
    }
  }
  if (o.interior && g.sol) { dibujarInterior(G, m, g, o, fab ? H - g.arriba : H); return; } // vista 3/4: interior y partes que se mueven (sin cubierta)
  if (ver('frentes')) {
    const top = fab ? H - g.arriba : H, fr = frentesEsquinero(m, g, top);
    const espec = (m.tiradores || []).find((t) => t?.esq); // modelo y color del tirador (del proyecto o del cliente)
    const def = ver('tiradores') && espec && o.tiradorDef?.(espec.modelo);
    fr.forEach((f, i) => {
      const tex = propio(`esq|${i}`, 'frentes') || M.frente, ref = `${id}|esq|${i}`, y0 = f.y0 + LUZ / 2, y1 = f.y1 - LUZ / 2;
      const l0 = f.tope === 's0' ? 0 : LUZ / 2, l1 = f.tope === 's1' ? 0 : LUZ / 2; // de tope en el rincón: sin luz
      if (f.lado === 'A') B(f.s0 + l0, f.s1 - l1, y0, y1, fa, fa + T, tex, ref);
      else B(xb - T, xb, y0, y1, f.s0 + l0, f.s1 - l1, tex, ref);
      if (!def || !f.tir) return;
      const largo = def.largo || 10;
      let mg = f.tir.horizontal ? largo / 2 + 4 : 3.5;
      // 2a y 2b (dueño, 2026-11-25): el tirador de cada hoja va donde la otra hoja, al abrir, no lo toca
      if ((g.sol === '2a' || g.sol === '2b') && f.clase === 'puerta') {
        const otra = fr.find((o) => o.clase === 'puerta' && o.lado !== f.lado), sale = Math.max(...def.piezas.map((p) => (+p.z || 0) + (+p.d || 0) / 2));
        if (otra) mg = Math.max(mg, distanciaTirador(otra.corte, luzRincon(g), sale) - luzRincon(g));
      }
      const sT = f.tir.en === 'medio' ? (f.s0 + f.s1) / 2 : f.tir.en === 's0' ? f.s0 + mg : f.s1 - mg;
      // aéreo (dueño, 2026-11-25): el tirador va en la esquina inferior de la puerta (solo en el modelo; en el taller se ajusta)
      const yT = f.tir.horizontal ? y1 - Math.min(5, (y1 - y0) / 3) : g.aereo ? Math.min(y1 - largo / 2 - 2, y0 + largo / 2 + 4) : Math.max(y0 + largo / 2 + 2, y1 - largo / 2 - 4);
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

// ----- vista fija 3/4 del interior (dueño, 2026-11-22/25) -----
// Solo en el acercamiento 3/4 se dibuja lo de adentro. Cada parte que se mueve va en un grupo con su posición cerrada
// y abierta (data-esq-anim, data-cerrado, data-abierto): el editor cambia el transform y la transición CSS la anima,
// sin volver a dibujar la escena. Puerta giratoria: gira 180° lento (la bandeja muestra su borde redondo, sin el corte);
// puertas: abren 165° (casi tocan la puerta del vecino); cajones: salen (en diagonal el space corner) o giran 80° en su eje (pivotantes).
export function partesInterior(m, g = geoEsquinero(m)) { // botones del panel: [{ key, nombre }]
  const fr = frentesEsquinero(m, g), out = [];
  if (g.sol === '1') out.push({ key: 'auto', nombre: 'Girar solo' }, { key: 'vueltaA', nombre: 'Una vuelta (hoja 1)' }, { key: 'vueltaB', nombre: 'Una vuelta (hoja 2)' }, { key: 'giro', nombre: 'Dejar girada (180°)' });
  if (g.sol === '2a' || g.sol === '2b') out.push({ key: 'pA', nombre: 'Puerta del lado 1' }, { key: 'pB', nombre: 'Puerta del lado 2' });
  if (g.sol === '3') {
    for (let i = 0; i < g.niveles; i++) out.push({ key: `c${i}`, nombre: `Cajón ${i + 1}` });
    if (fr.some((f) => f.clase === 'puerta' && f.lado === 'A')) out.push({ key: 'pA', nombre: 'Puerta lateral, lado 1' });
    if (fr.some((f) => f.clase === 'puerta' && f.lado === 'B')) out.push({ key: 'pB', nombre: 'Puerta lateral, lado 2' });
  }
  if (g.sol === '4') for (let i = 0; i < g.niveles; i++) out.push({ key: `cA${i}`, nombre: `Cajón ${i + 1}, lado 1` }, { key: `cB${i}`, nombre: `Cajón ${i + 1}, lado 2` });
  return out;
}
// Polígono de recorte (clip-path) de un sector de círculo en la cara de arriba de una caja cuadrada: ángulos en grados
// de pantalla (0 = +x, 90 = +z hacia el frente), de t0 a t1.
const sector = (t0, t1, espejo) => {
  const pts = ['50% 50%'];
  for (let t = t0; t <= t1 + .01; t += 7.5) { const a = (espejo ? 180 - t : t) * Math.PI / 180; pts.push(`${(50 + 50 * Math.cos(a)).toFixed(2)}% ${(50 + 50 * Math.sin(a)).toFixed(2)}%`); }
  return `polygon(${pts.join(',')})`;
};
// Animaciones de la puerta giratoria, compartidas por el editor y el portal: girar sola en círculo (14 s por vuelta)
// y una vuelta completa hacia el lado de la otra hoja (la de la derecha hacia la izquierda y al revés).
export function animarGiro(rig, on) {
  const g = rig.querySelector('[data-esq-anim="giro"]'); if (!g) return;
  g.getAnimations().forEach((a) => a.cancel());
  if (!on) return;
  const paso = (deg) => ({ transform: g.dataset.cerrado.replace(/rotateY\([^)]*\)/, `rotateY(${deg}deg)`) });
  g.animate([paso(0), paso(360)], { duration: 14000, iterations: Infinity, easing: 'linear' });
}
export function vueltaGiro(rig, hoja, izq) {
  const g = rig.querySelector('[data-esq-anim="giro"]'); if (!g) return;
  g.getAnimations().forEach((a) => a.cancel()); g.style.transform = g.dataset.cerrado;
  const s = (hoja === 'B' ? -1 : 1) * (izq ? -1 : 1), paso = (deg) => ({ transform: g.dataset.cerrado.replace(/rotateY\([^)]*\)/, `rotateY(${deg}deg)`) });
  g.animate([paso(0), paso(360 * s)], { duration: 7000, iterations: 1, easing: 'ease-in-out' });
}

// Bandeja de la puerta giratoria: el círculo menos el rincón que queda por delante de las hojas. kx, kz = caras
// interiores de las hojas 2 y 1 respecto del eje (con el rincón a la derecha). Polígono en % de la cara cuadrada.
function bandejaRecortada(r, kx, kz, espejo) {
  const P = (x, z) => `${(50 + 50 * (espejo ? -x : x) / r).toFixed(2)}% ${(50 + 50 * z / r).toFixed(2)}%`;
  if (Math.abs(kx) >= r || Math.abs(kz) >= r) return sector(-180, 90, espejo);
  const x1 = -Math.sqrt(r * r - kz * kz), z2 = Math.sqrt(r * r - kx * kx); // donde el borde toca la hoja 1 y la hoja 2
  let a1 = Math.atan2(kz, x1) * 180 / Math.PI, a2 = Math.atan2(z2, kx) * 180 / Math.PI;
  if (a2 <= a1) a2 += 360;
  const pts = [P(kx, kz), P(x1, kz)];
  for (let t = a1 + 6; t < a2; t += 6) pts.push(P(r * Math.cos(t * Math.PI / 180), r * Math.sin(t * Math.PI / 180)));
  pts.push(P(kx, z2));
  return `polygon(${pts.join(',')})`;
}
// Alturas de las repisas en L del 2a: repartidas parejo entre la base y la barra (dueño, 2026-11-25: la cantidad se
// cambia en el panel; la altura queda regulable en el taller)
export const repisasL = (m) => Math.max(0, Math.min(4, Math.round(m.repisas_l ?? 1)));
export function nivelesL(g, n = repisasL(g.m || {})) {
  const y0 = g.Z + g.T, y1 = g.yTop;
  return Array.from({ length: n }, (_, i) => y0 + (y1 - y0) * (i + 1) / (n + 1));
}
function dibujarInterior(G, m, g, o, top) {
  const { T, W, L, H, Z, fa, xb, izq, sol } = g, id = m.id, { M, propio } = o, MC = propio('esq|repisa', 'cuerpo') || M.cuerpo; // interior: repisas y bandejas (su material propio, si se le soltó uno)
  const abiertos = o.interior.abiertos || [], sx = izq ? -1 : 1; // sx: las x locales se reflejan con el rincón a la izquierda
  const tf = (p) => `translate3d(${p.x}em, ${-p.y}em, ${p.z}em) rotateY(${p.ry || 0}deg) rotateZ(0deg)`;
  const anim = (key, base, abierto, dur) => { // grupo que se mueve entre cerrado y abierto
    const p = abiertos.includes(key) ? abierto : base, gr = G.group({ x: p.x, y: p.y, z: p.z, ry: p.ry || 0 });
    Object.assign(gr.el.dataset, { esqAnim: key, cerrado: tf(base), abierto: tf(abierto) });
    gr.el.style.transition = `transform ${dur}s ease-in-out`;
    return gr;
  };
  const caja = (gr, x0, x1, y0, y1, z0, z1, tex, ref, extra = {}) => gr.box({ w: Math.abs(x1 - x0), h: y1 - y0, d: z1 - z0, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, tex, ref, ...extra });
  const fr = frentesEsquinero(m, g, top), MF = (i) => propio(`esq|${i}`, 'frentes') || M.frente, ref = (k) => `${id}|esq34|${k}`;
  const est = (x0, x1, y0, y1, z0, z1, tex = MC) => G.box({ w: x1 - x0, h: y1 - y0, d: z1 - z0, x: g.X((x0 + x1) / 2), y: (y0 + y1) / 2, z: (z0 + z1) / 2, tex, ref: `${id}|esq|int` });
  // hoja con bisagra en su extremo de afuera (2a, 2b y puertas laterales del 3): abre casi hasta tocar la puerta del
  // mueble vecino, a punto de tocar su tirador (dueño, 2026-11-25): 165°, lo que dan las bisagras de 165°
  const ABRE = 165;
  const puerta = (f, i, key) => {
    const y0 = f.y0 + .15, y1 = f.y1 - .15;
    if (f.lado === 'A') { // bisagra en s0 (lado del lateral 1), cara de afuera en z = fa + T
      const gr = anim(key, { x: g.X(f.s0), y: 0, z: fa + T }, { x: g.X(f.s0), y: 0, z: fa + T, ry: -ABRE * sx }, 1.1);
      caja(gr, 0, sx * (f.s1 - f.s0 - .3), y0, y1, -T, 0, MF(i), ref(key));
    } else { // bisagra en s1 (lado del lateral 2), cara de afuera en x = xb − T
      const gr = anim(key, { x: g.X(xb - T), y: 0, z: f.s1 }, { x: g.X(xb - T), y: 0, z: f.s1, ry: ABRE * sx }, 1.1);
      gr.box({ w: T, h: y1 - y0, d: f.s1 - f.s0 - .3, x: sx * T / 2, y: (y0 + y1) / 2, z: -(f.s1 - f.s0 - .3) / 2, tex: MF(i), ref: ref(key) });
    }
  };
  const yIn = Z + T, yTop = g.yTop; // interior útil: sobre la base y bajo la barra (en el aéreo, bajo el techo)
  if (sol === '1') { // puerta en L unida a 2 bandejas de ¾ de círculo, gira 180° sobre el eje centrado
    const b = bandejaGiratoria(g), cx = g.X(b.cx), d = 2 * b.r;
    const gr = anim('giro', { x: cx, y: 0, z: b.cz }, { x: cx, y: 0, z: b.cz, ry: 180 }, 2.6);
    // la bandeja llega justo hasta la cara interior de las 2 hojas (la puerta va fija a ella, sin espacio entre ambas)
    const clip = bandejaRecortada(b.r, xb - b.cx, fa - b.cz, izq);
    // contorno negro (dueño, 2026-11-25): una cara oscura 4 mm más grande justo debajo dibuja el borde y da profundidad (1 cara más por bandeja)
    const e = .4, borde = bandejaRecortada(b.r + e, xb - b.cx - e, fa - b.cz + e, izq);
    for (const y of [yIn + 2, (yIn + yTop) / 2]) {
      gr.box({ w: d + 2 * e, h: 1.5, d: d + 2 * e, x: 0, y: y - .15, z: 0, tex: { bg: '#141210', clip: borde }, ref: ref('giro'), caras: ['top'] });
      gr.box({ w: d, h: 1.5, d, x: 0, y, z: 0, tex: { bg: MC.bg, clip }, ref: ref('giro'), caras: ['top'] });
    }
    fr.forEach((f, i) => { // cada hoja con su ref: el clic en una la hace dar la vuelta hacia el otro lado
      if (f.lado === 'A') caja(gr, g.X(f.s0 + .15) - cx, g.X(f.s1) - cx, f.y0 + .15, f.y1 - .15, fa - b.cz, fa + T - b.cz, MF(i), `${ref('giro')}|A`);
      else caja(gr, g.X(xb - T) - cx, g.X(xb) - cx, f.y0 + .15, f.y1 - .15, f.s0 - b.cz, f.s1 - .15 - b.cz, MF(i), `${ref('giro')}|B`);
    });
  }
  if (sol === '2a' || sol === '2b') {
    fr.forEach((f, i) => puerta(f, i, f.lado === 'A' ? 'pA' : 'pB'));
    // contorno negro (dueño, 2026-11-25): bajo cada repisa, su cara de arriba en oscuro y 4 mm más salida en los cantos
    // que se ven (el frente de cada lado), para que se note la profundidad
    const e = .4, NEGRO = { bg: '#141210' }, plano = (x0, x1, y, z0, z1, tex) => G.box({ w: x1 - x0, h: .1, d: z1 - z0, x: g.X((x0 + x1) / 2), y, z: (z0 + z1) / 2, tex, ref: `${id}|esq|int`, caras: ['top'] });
    const repisa = (x0, x1, y, z0, z1, fx, fz) => { // fx / fz: cuánto sale el contorno en x (hacia el rincón) y en z (hacia adelante)
      plano(x0 - fx, x1, y + T / 2 - .2, z0, z1 + fz, NEGRO); est(x0, x1, y - T / 2, y + T / 2, z0, z1);
    };
    if (sol === '2a') { // repisas fijas en L, repartidas parejo en el alto (se agregan o se quitan en el panel)
      for (const y of nivelesL(g)) { repisa(T, W - CHOL, y, CHOL, fa - .3, 0, e); repisa(xb, W - CHOL, y, fa - .3, L - T, e, 0); }
    } else { const y1 = yIn + (yTop - yIn) / 3, y2 = yIn + 2 * (yTop - yIn) / 3; repisa(T, W - CHOL, y1, CHOL, fa - .3, 0, e); repisa(xb, W - CHOL, y2, CHOL, L - T, e, 0); }
  }
  if (sol === '3') {
    const k = cajonSpaceCorner(g), sale = 45, dx = -sale / Math.SQRT2 * sx, dz = sale / Math.SQRT2; // sale en diagonal hacia la habitación
    fr.filter((f) => f.clase === 'puerta').forEach((f) => puerta(f, fr.indexOf(f), f.lado === 'A' ? 'pA' : 'pB'));
    // cara plana con forma de polígono (puntos [x, z] con el rincón a la derecha), recortada sobre su rectángulo
    const placa = (gr, pts, y, tex, ref2) => {
      const P = pts.map(([x, z]) => [g.X(x), z]), xs = P.map((q) => q[0]), zs = P.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), w = x1 - x0 || 1, d = z1 - z0 || 1;
      const clip = `polygon(${P.map(([x, z]) => `${((x - x0) / w * 100).toFixed(2)}% ${((z - z0) / d * 100).toFixed(2)}%`).join(',')})`;
      gr.box({ w, h: .1, d, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, tex: { bg: tex.bg, clip }, ref: ref2, caras: ['top'] });
    };
    const NEG = { bg: '#141210' }, e = .4;
    const ym = (yIn + yTop) / 2, rt = repisasTrapecio(g); // repisas en trapecio de los compartimentos, con contorno negro en los cantos que se ven
    if (rt.A) { const [a, b, c, d] = rt.A.pts; placa(G, [a, [b[0] + e, b[1]], [c[0] + e, c[1] + e], [d[0], d[1] + e]], ym + T / 2 - .15, NEG, `${id}|esq|int`); placa(G, rt.A.pts, ym + T / 2, MC, `${id}|esq|int`); }
    if (rt.B) { const [a, b, c, d] = rt.B.pts; placa(G, [[a[0], a[1] - e], b, [c[0] - e, c[1]], [d[0] - e, d[1] - e]], ym + T / 2 - .15, NEG, `${id}|esq|int`); placa(G, rt.B.pts, ym + T / 2, MC, `${id}|esq|int`); }
    for (let i = 0; i < g.niveles; i++) {
      const fA = fr.find((f) => f.cajon === i && f.lado === 'A'), fB = fr.find((f) => f.cajon === i && f.lado === 'B'); if (!fA || !fB) continue;
      const key = `c${i}`, gr = anim(key, { x: 0, y: 0, z: 0 }, { x: dx, y: 0, z: dz }, .9);
      const y0 = fA.y0 + .15, y1 = fA.y1 - .15, ac = Math.max(6, y1 - y0 - 2), yb = y0 + 1;
      caja(gr, g.X(fA.s0 + .15), g.X(fA.s1), y0, y1, fa, fa + T, MF(fr.indexOf(fA)), ref(key));
      caja(gr, g.X(xb - T), g.X(xb), y0, y1, fB.s0, fB.s1 - .15, MF(fr.indexOf(fB)), ref(key));
      // caja: laterales en diagonal y traseras en flecha
      for (const [p, largo] of [[k.pa, k.latA], [k.pb, k.latB]]) {
        const gl = gr.group({ x: g.X(p[0] + largo / 2 / Math.SQRT2), y: 0, z: p[1] - largo / 2 / Math.SQRT2, ry: 45 * sx });
        gl.box({ w: largo, h: ac, d: T, x: 0, y: yb + ac / 2, z: 0, tex: MC, ref: ref(key) });
      }
      caja(gr, g.X(k.pa[0] + k.latA / Math.SQRT2), g.X(k.xk), yb, yb + ac - .8, k.zb, k.zb + T, MC, ref(key));
      caja(gr, g.X(k.xk - T), g.X(k.xk), yb, yb + ac - .8, k.zb, k.pb[1] - k.latB / Math.SQRT2, MC, ref(key));
      // fondo de la caja (cholguán, con la forma en flecha) y contorno negro en el canto de arriba de la caja y los frentes
      const zA = k.pa[0] + fa - k.zb, zB = k.pb[1] - (k.xk - xb);
      placa(gr, [[xb, fa], [k.pa[0], fa], [zA, k.zb], [k.xk, k.zb], [k.xk, zB], [xb, k.pb[1]]], yb + .2, { bg: '#e2ddd3' }, ref(key));
      const linea = (x0, x1, z0, z1, y) => caja(gr, g.X(x0), g.X(x1), y, y + .1, z0, z1, NEG, ref(key), { caras: ['top'] });
      linea(fA.s0 + .15, fA.s1, fa + T / 2 - .2, fa + T / 2 + .2, y1);                       // canto de arriba del frente, lado 1
      linea(xb - T / 2 - .2, xb - T / 2 + .2, fB.s0, fB.s1 - .15, y1);                       // frente, lado 2
      linea(k.pa[0] + k.latA / Math.SQRT2, k.xk, k.zb + T / 2 - .2, k.zb + T / 2 + .2, yb + ac - .8); // traseras en flecha
      linea(k.xk - T / 2 - .2, k.xk - T / 2 + .2, k.zb, zB, yb + ac - .8);
      for (const [p, largo] of [[k.pa, k.latA], [k.pb, k.latB]]) { // laterales en diagonal
        const gl = gr.group({ x: g.X(p[0] + largo / 2 / Math.SQRT2), y: 0, z: p[1] - largo / 2 / Math.SQRT2, ry: 45 * sx });
        gl.box({ w: largo, h: .1, d: .4, x: 0, y: yb + ac + .05, z: 0, tex: NEG, ref: ref(key), caras: ['top'] });
      }
    }
  }
  if (sol === '4') { // 2 filas de cajones en tajada, cada fila gira 80° en su eje del rincón
    const b = bandejaCarrusel(g), cx = g.X(b.cx), d = 2 * b.r;
    fr.forEach((f, i) => {
      const lado = f.lado, n = Math.floor(i / 2), key = `c${lado}${n}`;
      const gr = anim(key, { x: cx, y: 0, z: b.cz }, { x: cx, y: 0, z: b.cz, ry: (lado === 'A' ? 80 : -80) * sx }, 1.1);
      const y0 = f.y0 + .15, y1 = f.y1 - .15;
      const tajada = lado === 'A' ? sector(180, 315, izq) : sector(-45, 90, izq), e = .4; // contorno negro: la misma tajada 4 mm más grande, justo debajo
      gr.box({ w: d + 2 * e, h: 1.5, d: d + 2 * e, x: 0, y: y0 + .85, z: 0, tex: { bg: '#141210', clip: tajada }, ref: ref(key), caras: ['top'] });
      gr.box({ w: d, h: 1.5, d, x: 0, y: y0 + 1, z: 0, tex: { bg: MC.bg, clip: tajada }, ref: ref(key), caras: ['top'] });
      if (lado === 'A') caja(gr, g.X(f.s0 + .15) - cx, g.X(f.s1 - .15) - cx, y0, y1, fa - b.cz, fa + T - b.cz, MF(i), ref(key));
      else caja(gr, g.X(xb - T) - cx, g.X(xb) - cx, y0, y1, f.s0 + .15 - b.cz, f.s1 - .15 - b.cz, MF(i), ref(key));
    });
  }
}

// Despiece del esquinero. ctx = { add, pino, herrajes, mat, cuerpoDef, frente, BLANCA }: las mismas funciones del despiece.
// Devuelve la ficha del esquinero para el Worker: { m, solucion, factor, platos, retenes, barra_cm, confirmar }.
export function despieceEsquinero(m, ctx) {
  const g = geoEsquinero(m), { T, W, L, H, Z, fa, fb, xb, sol } = g, { add, pino, herrajes, mat, cuerpoDef, frente, BLANCA } = ctx;
  const r1 = (v) => Math.round(v * 10) / 10, Hc = H - Z, hs = Hc - T, cuerpo = mat('cuerpo', cuerpoDef);
  const ficha = { m: m.id, solucion: sol, platos: 0, retenes: 0, barra_cm: 0, tiradores: 0, confirmar: !sol };
  // base rectangular (W × L sin el cholguán); el calado en L y su tapacanto se hacen en el taller
  add('cuerpo|piso', 'Base en L (se pide rectangular; calado y tapacanto del calado en el taller)', mat('cuerpo|piso', cuerpo), W - .3, L - .3, undefined, 'tablero',
    { nota: `Calado: quitar ${r1(xb)} × ${r1(L - fa)} cm en el rincón del frente`, tapacanto_taller: r1(xb + L - fa) });
  // aéreo (dueño, 2026-11-25): lleva techo igual a la base y los laterales van entre ambos
  if (g.aereo) add('cuerpo|techo', 'Techo en L (se pide rectangular; calado y tapacanto del calado en el taller)', mat('cuerpo|techo', cuerpo), W - .3, L - .3, undefined, 'tablero',
    { nota: `Calado: quitar ${r1(xb)} × ${r1(L - fa)} cm en el rincón del frente`, tapacanto_taller: r1(xb + L - fa) });
  const hl = g.aereo ? hs - T : hs;
  add('cuerpo|izq', 'Lateral del lado 1', mat('cuerpo|izq', cuerpo), r1(fa - .3), r1(hl), { ancho: 0, alto: 1 });
  add('cuerpo|der', 'Lateral del lado 2', mat('cuerpo|der', cuerpo), r1(fb - .3), r1(hl), { ancho: 0, alto: 1 });
  const f = m.materiales?.['cuerpo|fondo'] || m.materiales?.cuerpo, ch = `cholguan:${f ? String(f).replace(/^liston:/, '') : 'blanco'}`;
  add('cuerpo|fondo', 'Fondo del lado 1 (cholguán)', ch, W, Hc, undefined, 'cholguan');
  add('cuerpo|fondo', 'Fondo del lado 2 (cholguán)', ch, r1(L - .3), Hc, undefined, 'cholguan');
  // soportes: delanteros desde el interior de cada lateral hasta la punta larga del inglete; traseros hasta la esquina del muro
  const sop = mat('soporte', cuerpo);
  add('soporte|frente', 'Soporte delantero del lado 1 (corte a 45° en el rincón)', sop, r1(xb), g.sop, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
  add('soporte|frente', 'Soporte delantero del lado 2 (corte a 45° en el rincón)', sop, r1(L - fa), g.sop, { ancho: 1, alto: 0 }, 'tablero', { edges: { inf: 1 } });
  pino('Soporte trasero del lado 1 (pino, 45° en la esquina)', r1(W - T), 'soporte|atras');
  pino('Soporte trasero del lado 2 (pino, 45° en la esquina)', r1(L - T), 'soporte|atras');
  if (g.aereo) { // aéreo: tercer soporte atrás abajo, para anclar al muro
    pino('Soporte inferior trasero del lado 1, anclaje al muro (pino, 45° en la esquina)', r1(W - T), 'soporte|anclaje');
    pino('Soporte inferior trasero del lado 2, anclaje al muro (pino, 45° en la esquina)', r1(L - T), 'soporte|anclaje');
  }
  if (Z > 0) for (const t of zocaloEsquinero(g, PINO_E, m)) pino(`Zócalo en L, ${t.nombre} (pino)`, r1(t.largo), 'zocalo');
  // frentes cerrados (medida final redondeada al mm hacia abajo; 4 cantos)
  const mm = (v) => Math.floor(v * 10 + 1e-2) / 10, c4 = { ancho: 2, alto: 2 };
  const frs = frentesEsquinero(m, g);
  frs.forEach((fr, i) => add(`esq|${i}`, fr.nombre, mat(`esq|${i}`, mat('frentes', frente)), mm(fr.corte), mm(fr.y1 - fr.y0), fr.cantos || c4, 'tablero', fr.cajon != null ? { cajon: `esq${fr.cajon}` } : {})); // frente de cajón: cuenta para su mínimo
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
  if (sol === '2a') for (let i = 0; i < repisasL(m); i++) { // repisas en L (cantidad en el panel)
    add('esq|repisa', `Repisa fija en L ${i + 1} (se pide rectangular; calado en el taller)`, mat('esq|repisa', cuerpo), r1(ri), r1(rj), undefined, 'tablero',
      { nota: `Calado: quitar ${r1(xb - T)} × ${r1(L - fa - T)} cm en el rincón del frente`, tapacanto_taller: r1(xb - T + L - fa - T) });
  }
  if (sol === '2b') {
    add('esq|repisa', 'Repisa recta del lado 1 (más abajo)', mat('esq|repisa', cuerpo), r1(ri), r1(fa - .3 - .2), { ancho: 1, alto: 0 });
    add('esq|repisa', 'Repisa recta del lado 2 (más arriba)', mat('esq|repisa', cuerpo), r1(rj), r1(fb - .3 - .2), { ancho: 1, alto: 0 });
  }
  if (sol === '3') {
    const k = cajonSpaceCorner(g), n = g.niveles, div = mat('cuerpo', cuerpoDef);
    // divisiones diagonales del pasillo del cajón (ahí van las correderas); se cotizan como rectángulo
    add('esq|div', 'División diagonal del cajón, lado 1 (corte a 45° en los extremos, en el taller)', mat('esq|div', div), r1(k.divA), hs, { ancho: 0, alto: 1 });
    add('esq|div', 'División diagonal del cajón, lado 2 (corte a 45° en los extremos, en el taller)', mat('esq|div', div), r1(k.divB), hs, { ancho: 0, alto: 1 });
    // repisas en trapecio de los compartimentos laterales (dueño, 2026-11-25): las 2 se piden juntas en una placa
    // rectangular, intercaladas (una girada), con 1 cm entre ambas para la sierra; el corte en diagonal y el tapacanto
    // del frente se hacen en el taller
    const rt = repisasTrapecio(g), pl = placaTrapecios(g);
    if (pl) add('esq|repisa', pl.n === 2 ? `Placa para las 2 repisas en trapecio, intercaladas (corte en diagonal con 1 cm de sierra, en el taller): ${r1(rt.A.corto)}/${r1(rt.A.largo)} y ${r1(rt.B.corto)}/${r1(rt.B.largo)} × ${r1(Math.max(rt.A.prof, rt.B.prof))}` : 'Repisa en trapecio del compartimento (rectángulo; diagonal en el taller)',
      mat('esq|repisa', cuerpo), r1(pl.ancho), r1(pl.prof), undefined, 'tablero', { tapacanto_taller: r1((rt.A?.corto || 0) + (rt.B?.corto || 0)) });
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
      ctx.cajones?.push({ m: m.id, k: `esq${i}`, corredera: corr }); // mano de obra mínima por cajón, como en un basal
    });
  }
  if (sol === '4') {
    ficha.barra_cm = r1(2 * Hc); // 2 ejes verticales del alto del cuerpo
    // cada cajón en tajada: un fondo de melamina que se pide rectangular (la forma y los bordes se hacen en el taller)
    const b = bandejaCarrusel(g), r = b.r, lar = r1(r * (1 + Math.SQRT1_2));
    for (let i = 0; i < g.niveles; i++) {
      for (const lado of [1, 2]) { // cada cajón con su mano de obra mínima (sin corredera: gira en el eje)
        add('esq|cajon', `Cajón pivotante ${i + 1}, lado ${lado}: fondo (rectángulo; tajada y bordes en el taller)`, BLANCA, lar, r1(r), undefined, 'tablero', { cajon: `esqp${i}-${lado}` });
        ctx.cajones?.push({ m: m.id, k: `esqp${i}-${lado}`, corredera: null });
      }
    }
  }
  return ficha;
}
