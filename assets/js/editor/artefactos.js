// Artefactos de cocina (modelos de referencia con medidas modificables, en cm):
// - sobre la cubierta: encimeras (a gas o eléctricas) y lavaplatos de 1 o 2 cubas. Se guardan en el
//   módulo: m.artefactos = [{ id, tipo, desde, frente, ancho, fondo, lado }]
//   desde = del costado izquierdo del mueble al artefacto; frente = del canto de la cubierta al artefacto;
//   lado = dónde queda el escurridor del lavaplatos ('derecha' | 'izquierda').
// - de piso: cocinas de 4 o 6 platos. Son un módulo más (m.artefacto = 'cocina4' | 'cocina6'), así se
//   ubican, mueven y acotan igual que un mueble.
// El estudio no las cobra: son referencias para ubicar y dar las medidas al cliente.

export const ARTEFACTOS = {
  encimera_gas: { nombre: 'Encimera a gas 4 platos', ancho: 58, fondo: 50, zona: 'cubierta', platos: 4, gas: true },
  encimera_electrica: { nombre: 'Encimera eléctrica 4 zonas', ancho: 60, fondo: 52, zona: 'cubierta', platos: 4 },
  encimera_2: { nombre: 'Encimera eléctrica 2 zonas', ancho: 30, fondo: 52, zona: 'cubierta', platos: 2 },
  lavaplatos_1: { nombre: 'Lavaplatos 1 cuba', ancho: 80, fondo: 50, zona: 'cubierta', cubas: 1 },
  lavaplatos_2: { nombre: 'Lavaplatos 2 cubas', ancho: 120, fondo: 50, zona: 'cubierta', cubas: 2 },
  cocina4: { nombre: 'Cocina de piso 4 platos', ancho: 56, alto: 85, fondo: 60, zona: 'piso', platos: 4, gas: true },
  cocina6: { nombre: 'Cocina de piso 6 platos', ancho: 76, alto: 85, fondo: 60, zona: 'piso', platos: 6, gas: true },
};
export const DE_CUBIERTA = Object.keys(ARTEFACTOS).filter((k) => ARTEFACTOS[k].zona === 'cubierta');
export const DE_PISO = Object.keys(ARTEFACTOS).filter((k) => ARTEFACTOS[k].zona === 'piso');

// Distribución de platos (porcentajes de la cara superior): 2 → en fila hacia el fondo, 4 → 2×2, 6 → 3×2
function puntos(n) {
  if (n === 2) return [[50, 28], [50, 72]];
  if (n === 6) return [[18, 30], [50, 30], [82, 30], [18, 72], [50, 72], [82, 72]];
  return [[28, 30], [72, 30], [28, 72], [72, 72]];
}
// Fondo CSS de la cara superior: quemadores (gas) o zonas de calor (eléctrica)
export function cubiertaCoccion(def, ancho, acabado = 'acero') {
  const r = Math.min(9, ancho / (def.platos === 6 ? 7 : 5)); // radio de cada plato en cm
  const capas = puntos(def.platos).map(([x, y], i) => {
    const k = i % 3 === 1 ? .8 : 1; // un plato más chico para que se vea natural
    return def.gas
      ? `radial-gradient(circle at ${x}% ${y}%, #3a3a3c 0 ${r * .28 * k}em, #8c8d8f ${r * .28 * k}em ${r * .4 * k}em, #1a1a1b ${r * .4 * k}em ${r * .75 * k}em, #4a4b4d ${r * .75 * k}em ${r * .82 * k}em, transparent ${r * .83 * k}em)`
      : `radial-gradient(circle at ${x}% ${y}%, transparent 0 ${r * .78 * k}em, rgba(214, 96, 70, .55) ${r * .78 * k}em ${r * .84 * k}em, transparent ${r * .85 * k}em)`;
  });
  const base = !def.gas ? (acabado === 'blanco' ? 'linear-gradient(160deg, #f2f0ec, #d9d6d0)' : 'linear-gradient(160deg, #262628, #0e0e10 70%, #1d1d20)')
    : acabado === 'acero' ? 'linear-gradient(160deg, #d3d6d8, #a5aaad)' : acabado === 'blanco' ? 'linear-gradient(160deg, #f0eee9, #d6d3cd)' : 'linear-gradient(160deg, #2a2a2c, #19191a)';
  return `${capas.join(', ')}, ${base}`;
}
// Acabados de lavaplatos y cocinas: acero inoxidable, negro o blanco (granito / esmaltado)
export const ACABADOS = {
  acero: { base: 'linear-gradient(135deg, #e1e4e6, #a3a8ac 55%, #c9cdd0)', cuba: ['#6f7478', '#a9aeb2'], esc: ['#cfd3d6', '#a7acb0'], cuerpo: 'linear-gradient(180deg, #d4d7d9, #aeb2b5)' },
  negro: { base: 'linear-gradient(135deg, #3b3c3e, #1f2021)', cuba: ['#18191a', '#303133'], esc: ['#333436', '#232425'], cuerpo: 'linear-gradient(180deg, #2f3032, #1b1c1d)' },
  blanco: { base: 'linear-gradient(135deg, #f4f2ee, #d8d5cf)', cuba: ['#c9c6c0', '#e4e1db'], esc: ['#ebe8e3', '#d2cfc9'], cuerpo: 'linear-gradient(180deg, #f1efeb, #d7d4ce)' },
};
export const acabado = (k) => ACABADOS[k] || ACABADOS.acero;
export const ACERO = ACABADOS.acero.base;
export const cubaDe = (k) => { const [a, b] = acabado(k).cuba; return `radial-gradient(circle at 50% 62%, #2f3234 0 1.6em, ${a} 1.7em 2em, transparent 2.1em), linear-gradient(170deg, ${a}, ${b})`; };
export const escurridorDe = (k) => { const [a, b] = acabado(k).esc; return `repeating-linear-gradient(90deg, ${a} 0 1.2em, ${b} 1.2em 1.6em)`; };

// Cubas y escurridor del lavaplatos, en cm desde su borde izquierdo: [{ x0, x1, tipo: 'cuba'|'escurridor' }]
export function partesLavaplatos(a, def) {
  const borde = 4, util = a.ancho - 2 * borde;
  const nc = def.cubas || 1;
  let cuba = Math.min(40, (util - (nc - 1) * 3) / nc);
  let esc = util - nc * cuba - (nc - 1) * 3 - 3;
  if (esc < 15) { esc = 0; cuba = (util - (nc - 1) * 3) / nc; }
  const piezas = [];
  for (let i = 0; i < nc; i++) piezas.push({ ancho: cuba, tipo: 'cuba' });
  if (esc) piezas[a.lado === 'izquierda' ? 'unshift' : 'push']({ ancho: esc, tipo: 'escurridor' });
  let x = borde;
  return piezas.map((p) => { const o = { x0: x, x1: x + p.ancho, tipo: p.tipo }; x += p.ancho + 3; return o; });
}

// Medidas válidas de un artefacto sobre una cubierta de ancho W y fondo Dc
export function ajustarArtefacto(a, W, Dc) {
  const def = ARTEFACTOS[a.tipo] || ARTEFACTOS.encimera_gas;
  const ancho = Math.min(Math.max(20, +a.ancho || def.ancho), W);
  const fondo = Math.min(Math.max(20, +a.fondo || def.fondo), Dc);
  return {
    ...a, ancho, fondo,
    desde: Math.min(Math.max(0, +a.desde || 0), W - ancho),
    frente: Math.min(Math.max(0, +a.frente || 0), Dc - fondo),
  };
}
