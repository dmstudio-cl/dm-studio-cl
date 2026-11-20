// Optimizador de planchas (como el de Imperial, Lepton Sistemas): acomoda las piezas de cada melamina en
// planchas de 2500 × 1830 mm con cortes de guillotina en franjas a lo largo de los 2500 mm.
// - Refilado: 10 mm por lado de la plancha (útil 2490 × 1820). Sierra: 3,2 mm.
// - La veta de la plancha corre a lo largo de los 2500 mm («base»). Regla del estudio: toda pieza va con su lado
//   más largo a lo largo de la base. Una melamina con veta (maderas, piedras y textiles) no se gira;
//   las unicolor se pueden girar libremente.
// - Mide con la medida de CORTE (ya descontado 1 mm por canto con tapacanto).
// Sirve para saber cuántas planchas de cada melamina se usan (precio) y para revisar el esquema antes de pedir.

import { aMinimo } from './imperial.js';

export const PLANCHA = { base: 2500, altura: 1830, refilado: 10, sierra: 3.2 };

// ¿Se puede girar la pieza en la plancha? Solo las melaminas de color uniforme (línea «Unicolor»)
export function vetaLibre(material) {
  const m = (window.MELAMINAS || []).find((x) => x.id === material);
  return !!m && /unicolor/i.test(m.linea || '');
}

// Un acomodo con un orden y un criterio dados. Franjas horizontales (alto = la primera pieza), columnas dentro
// de cada franja y piezas apiladas en una columna si caben (como las de 190 dentro de una franja de 420).
function acomodar(items, L, A, k, mejorAjuste) {
  const tableros = [];
  const ubicar = (t, x, y, o, it) => t.piezas.push({ x, y, w: o.b, h: o.a, girada: o.girada, ...it.p });
  for (const it of items) {
    let mejor = null; // { t, tipo, s, c, o, costo }
    const proponer = (cand) => { if (!mejor || cand.costo < mejor.costo) mejor = cand; };
    for (const t of tableros) {
      for (const o of it.ors) {
        for (const s of t.franjas) {
          for (const c of s.cols) if (o.b <= c.w && c.usado + k + o.a <= s.h) proponer({ t, tipo: 'apilar', s, c, o, costo: (c.w - o.b) * o.a });
          if (s.x + k + o.b <= L && o.a <= s.h) proponer({ t, tipo: 'columna', s, o, costo: (s.h - o.a) * o.b * .5 });
        }
        if (t.y + k + o.a <= A) proponer({ t, tipo: 'franja', o, costo: mejorAjuste ? o.b * o.a * .25 : Infinity });
      }
      if (mejor && !mejorAjuste) break; // primer ajuste: la primera plancha donde cabe
    }
    if (!mejor) { // plancha nueva
      const o = it.ors.find((x) => x.b <= L && x.a <= A), t = { franjas: [], y: -k, piezas: [] };
      tableros.push(t); mejor = { t, tipo: 'franja', o };
    }
    const { t, s, c, o } = mejor;
    if (mejor.tipo === 'apilar') { ubicar(t, c.x, s.y + c.usado + k, o, it); c.usado += k + o.a; }
    else if (mejor.tipo === 'columna') { const x = s.x + k; s.cols.push({ x, w: o.b, usado: o.a }); s.x = x + o.b; ubicar(t, x, s.y, o, it); }
    else { const y = t.y + k; t.franjas.push({ y, h: o.a, x: o.b, cols: [{ x: 0, w: o.b, usado: o.a }] }); t.y = y + o.a; ubicar(t, 0, y, o, it); }
  }
  return tableros;
}

// piezas: [{ ancho, alto (mm, medida de corte), veta: 'v'|'h', libre, ... }] → planchas con las piezas ubicadas.
// Prueba varios órdenes y criterios y se queda con el que usa menos planchas (y deja la última más vacía).
export function optimizar(piezas, { plancha = PLANCHA } = {}) {
  const L = plancha.base - plancha.refilado, A = plancha.altura - plancha.refilado, k = plancha.sierra;
  const noCaben = [], base = [];
  for (const p of piezas) {
    // b = a lo largo de los 2500 mm (la veta de la plancha): siempre el lado más largo de la pieza
    const largoVeta = Math.max(p.alto, p.ancho), otro = Math.min(p.alto, p.ancho);
    const ors = [{ b: largoVeta, a: otro, girada: false }];
    if (p.libre && largoVeta !== otro) ors.push({ b: otro, a: largoVeta, girada: true });
    if (p.libre) ors.sort((x, y) => y.b - x.b);
    const caben = ors.filter((o) => o.b <= L && o.a <= A);
    if (caben.length) base.push({ p, ors: caben, alto: Math.min(...caben.map((o) => o.a)), largo: Math.max(...caben.map((o) => o.b)) }); else noCaben.push(p);
  }
  const ordenes = [
    (x, y) => y.alto - x.alto || y.largo - x.largo,
    (x, y) => y.largo - x.largo || y.alto - x.alto,
    (x, y) => y.alto * y.largo - x.alto * x.largo,
  ];
  let mejor = null;
  const probar = (lista, ajuste) => {
    const t = acomodar(lista, L, A, k, ajuste);
    const resto = t.length ? t[t.length - 1].y : 0; // alto usado en la última plancha
    if (!mejor || t.length < mejor.t.length || (t.length === mejor.t.length && resto < mejor.resto)) mejor = { t, resto };
  };
  for (const orden of ordenes) for (const ajuste of [false, true]) probar([...base].sort(orden), ajuste);
  // Más intentos: el orden por alto con un poco de azar (semilla fija: siempre da lo mismo) y, en las piezas que
  // se pueden girar, a veces la otra orientación primero
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const intentos = Math.min(800, Math.round(60000 / Math.max(1, base.length)));
  for (let n = 0; n < intentos; n++) {
    const giro = azar() * .6; // en cada intento, cuántas piezas girables prueban primero la otra orientación
    const lista = base.map((it) => ({ ...it, ors: it.ors.length > 1 && azar() < giro ? [...it.ors].reverse() : it.ors, r: it.alto * (1 + (azar() - .5) * .5) }))
      .sort((x, y) => y.r - x.r);
    probar(lista, azar() < .5);
  }
  const tableros = mejor?.t || [];
  const area = piezas.reduce((s, p) => s + p.ancho * p.alto, 0) / 1e6;
  const total = tableros.length * plancha.base * plancha.altura / 1e6;
  return { planchas: tableros.length, tableros, noCaben, m2Piezas: area, m2Planchas: total, aprovechamiento: total ? area / total : 0, plancha };
}

// Agrupa las piezas de melamina del despiece por material y las optimiza.
// frente = melamina que reemplaza a «frente» (la del cliente o la del editor); sin ella, «frente» se optimiza con veta fija.
export function optimizarDespiece(d, { frente } = {}) {
  const grupos = {};
  for (const p of d.piezas) {
    if (p.tipo !== 'tablero') continue;
    const mat = p.material === 'frente' && frente ? frente : p.material;
    const g = (grupos[`${mat}|${p.espesor}`] ||= { material: mat, espesor: p.espesor, piezas: [] });
    // medida de corte en mm, agrandada al mínimo de Imperial (lo que realmente se corta)
    const [ancho, alto] = aMinimo(Math.round(p.corte.ancho * 10), Math.round(p.corte.alto * 10));
    g.piezas.push({ ...p, ancho, alto, libre: vetaLibre(mat) });
  }
  return Object.values(grupos).map((g) => ({ ...g, ...optimizar(g.piezas) }));
}

// Dibujo SVG de una plancha (para revisar el esquema): piezas con su nombre y medidas en mm
export function svgPlancha(t, plancha = PLANCHA) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = plancha.base, H = plancha.altura, r = plancha.refilado / 2;
  return `<svg viewBox="-20 -20 ${W + 40} ${H + 40}" class="ed-plancha" role="img" aria-label="Esquema de corte de una plancha">
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(236,231,221,.05)" stroke="rgba(236,231,221,.5)" stroke-width="4"/>
    ${t.piezas.map((p) => `<g><rect x="${r + p.x}" y="${r + p.y}" width="${p.w}" height="${p.h}" fill="rgba(169,125,77,.28)" stroke="#ece7dd" stroke-width="3"/>
      ${p.w > 160 && p.h > 70 ? `<text x="${r + p.x + p.w / 2}" y="${r + p.y + p.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(46, p.h / 3)}" fill="#ece7dd">${esc(p.nombre.replace(/ \(.*\)$/, ''))}</text>
      <text x="${r + p.x + p.w / 2}" y="${r + p.y + p.h / 2 + Math.min(46, p.h / 3) + 6}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(40, p.h / 3.4)}" fill="#bdb6a8">${p.w} × ${p.h}${p.girada ? ' ↻' : ''}</text>` : ''}</g>`).join('')}
  </svg>`;
}
