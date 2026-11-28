// Revisión de la cocina (dueño, 2026-11-27): la «marcha adelante» de una cocina residencial (guardar en frío →
// lavar → preparar → cocinar → servir), el triángulo de trabajo, los espacios de apoyo, los pasillos y la relación
// con ventanas y puertas. Las reglas y sus medidas vienen de _data/reglas_cocina.yml (Decap): cada regla tiene un
// tipo que este módulo sabe medir. Las zonas se deducen de lo que ya tiene el modelo (lavaplatos, encimeras,
// cocinas de piso, refrigerador, horno, lavavajillas): no hay que etiquetar nada.
//
// La cubierta se lee como «líneas de trabajo»: los tramos de cubierta seguidos en un muro, unidos por el rincón del
// esquinero (una L o una U es una sola línea) o por un hueco (una cocina de piso, un refrigerador entre muebles).
// Cada artefacto o electrodoméstico queda en una posición t (cm) a lo largo de su línea.
//
// No toca el modelo: evaluarCocina() devuelve el resultado de cada regla y sugerirOrden() las posiciones propuestas
// para el lavaplatos y la encimera (el editor las dibuja semitransparentes en Planta y las aplica si el dueño quiere).
// No usa precios ni costos: también corre en el portal (sello «Cocina revisada»).
import { artefactosDe, huella, muros, ejeMuro, vanosDe, girar, zonasCubierta } from './modelo.js';

const r1 = (v) => Math.round(v * 10) / 10;
const cm = (v) => `${r1(v)}`.replace('.', ',');
export const PESO = { rojo: 3, amarillo: 2, verde: 1, info: 0, na: 0 };
export const REGLAS_POR_DEFECTO = { zonas: { frio: { nombre: 'Frío', objetos: ['refri1', 'refri2', 'conservadora'] }, lavado: { nombre: 'Lavado', artefactos: ['lavaplatos_1', 'lavaplatos_2'], objetos: ['lavavajillas'] }, coccion: { nombre: 'Cocción', artefactos: ['encimera_gas', 'encimera_electrica', 'encimera_2'], cocinas_piso: ['cocina4', 'cocina6'], objetos: ['horno'] } }, personas_cocina: 1, reglas: [] };

// ---------- geometría en planta ----------
const aMundo = (m, x, z) => { const [dx, dz] = girar(x, z, +m.rotacion || 0); return [+m.x + dx, +m.z + dz]; };
const dot = (p, d) => p[0] * d[0] + p[1] * d[1];
function rectObjeto(o) {
  const w = +o.ancho || 60, f = +o.fondo || 60, r = +o.rotacion || 0;
  return [[-w / 2, -f / 2], [w / 2, -f / 2], [w / 2, f / 2], [-w / 2, f / 2]].map(([x, z]) => { const [dx, dz] = girar(x, z, r); return [+o.x + dx, +o.z + dz]; });
}
function dentro(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function dSeg(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}
// distancia mínima entre 2 polígonos (0 si se tocan o se montan)
export function distPoligonos(A, B) {
  if (A.some((p) => dentro(p, B)) || B.some((p) => dentro(p, A))) return 0;
  let d = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, dSeg(p, Q[i], Q[(i + 1) % Q.length]));
  return d;
}
const distPuntoPoly = (p, poly) => (dentro(p, poly) ? 0 : Math.min(...poly.map((q, i) => dSeg(p, q, poly[(i + 1) % poly.length]))));
const centroPoly = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
// intersección de un rayo (origen o, dirección unitaria v) con un segmento: distancia o null
function rayoSeg(o, v, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], den = v[0] * ez - v[1] * ex; if (Math.abs(den) < 1e-9) return null;
  const wx = a[0] - o[0], wz = a[1] - o[1], t = (wx * ez - wz * ex) / den, u = (wx * v[1] - wz * v[0]) / den;
  return t > .5 && u >= -1e-6 && u <= 1 + 1e-6 ? t : null;
}

// ---------- líneas de trabajo (tramos de cubierta) ----------
function tramos(modelo) {
  const segs = [];
  for (const m of modelo.modulos || []) {
    if (!m || m.artefacto) continue;
    zonasCubierta(m).forEach((r, k) => {
      const porX = m.tipo !== 'esquinero' || k === 0, zc = (r.z0 + r.z1) / 2, xc = (r.x0 + r.x1) / 2;
      const a = porX ? aMundo(m, r.x0, zc) : aMundo(m, xc, r.z0), b = porX ? aMundo(m, r.x1, zc) : aMundo(m, xc, r.z1);
      const poly = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([x, z]) => aMundo(m, x, z));
      segs.push({ m: m.id, esq: m.tipo === 'esquinero', a, b, prof: porX ? r.z1 - r.z0 : r.x1 - r.x0, alto: (+m.elevacion || 0) + +m.alto, poly });
    });
  }
  // dirección normalizada a [0°, 180°) para agrupar los tramos de un mismo muro
  for (const s of segs) {
    let dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    let ang = (Math.atan2(dz, dx) * 180) / Math.PI; if (ang < -.5 || ang >= 179.5) { dx = -dx; dz = -dz; ang = (Math.atan2(dz, dx) * 180) / Math.PI; }
    s.ang = Math.round(((ang % 180) + 180) % 180); s.d = [dx, dz]; s.n = [-dz, dx]; s.off = dot(s.a, s.n);
    const sa = dot(s.a, s.d), sb = dot(s.b, s.d); s.s0 = Math.min(sa, sb); s.s1 = Math.max(sa, sb);
  }
  const out = [];
  for (const s of segs.sort((p, q) => p.ang - q.ang || p.off - q.off || p.s0 - q.s0)) {
    const t = out.find((x) => x.ang === s.ang && Math.abs(x.off - s.off) < 6 && Math.abs(x.alto - s.alto) < 1.5 && s.s0 <= x.s1 + 2 && s.s1 >= x.s0 - 2);
    if (t) { t.s0 = Math.min(t.s0, s.s0); t.s1 = Math.max(t.s1, s.s1); t.partes.push(s); continue; }
    out.push({ id: out.length, ang: s.ang, d: s.d, n: s.n, off: s.off, alto: s.alto, s0: s.s0, s1: s.s1, partes: [s] });
  }
  return out;
}
const puntoTramo = (T, s) => [T.d[0] * s + T.n[0] * T.off, T.d[1] * s + T.n[1] * T.off];
const enTramo = (T, p, holg = 3) => { const s = dot(p, T.d); return s >= T.s0 - holg && s <= T.s1 + holg && T.partes.some((q) => distPuntoPoly(p, q.poly) <= holg); };

// Une los tramos en líneas: por un hueco en el mismo muro (cocina de piso, refrigerador) o por el rincón del esquinero
export function lineasDeTrabajo(modelo) {
  const T = tramos(modelo), uniones = [];
  const libre = (X, e) => !uniones.some((u) => (u.X === X && u.ex === e) || (u.Y === X && u.ey === e));
  for (const X of T) for (const Y of T) {
    if (X === Y) continue;
    if (X.ang === Y.ang && Math.abs(X.off - Y.off) < 15 && Math.abs(X.alto - Y.alto) < 1.5) { // hueco en el mismo muro
      const g = Y.s0 - X.s1; if (g > 2 && g <= 130 && libre(X, 1) && libre(Y, 0)) uniones.push({ X, ex: 1, Y, ey: 0, tipo: 'hueco', g });
    } else if (Math.abs(Math.abs(X.ang - Y.ang) - 90) < 1.5 && X.id < Y.id) { // rincón: una punta de un tramo toca al otro
      for (const [A, B] of [[X, Y], [Y, X]]) for (const eb of [0, 1]) {
        const p = puntoTramo(B, eb ? B.s1 : B.s0);
        if (!A.partes.some((q) => distPuntoPoly(p, q.poly) <= 4)) continue;
        const sT = dot(p, A.d), ea = Math.abs(sT - A.s0) < Math.abs(sT - A.s1) ? 0 : 1;
        if (libre(A, ea) && libre(B, eb)) uniones.push({ X: A, ex: ea, Y: B, ey: eb, tipo: 'esquina', sTouch: sT });
      }
    }
  }
  const unionDe = (X, e) => uniones.find((u) => (u.X === X && u.ex === e) || (u.Y === X && u.ey === e));
  const lineas = [], visto = new Set();
  const inicio = (X) => (!unionDe(X, 0) ? 0 : !unionDe(X, 1) ? 1 : 0);
  for (const X0 of [...T].sort((p, q) => (unionDe(p, 0) && unionDe(p, 1) ? 1 : 0) - (unionDe(q, 0) && unionDe(q, 1) ? 1 : 0))) {
    if (visto.has(X0)) continue;
    const L = { id: lineas.length, tramos: [], huecos: [], largo: 0 };
    let X = X0, entrada = inicio(X0), toff = 0;
    while (X && !visto.has(X)) {
      visto.add(X);
      const len = X.s1 - X.s0, info = { T: X, toff, entrada }, T0 = X, o0 = toff, e0 = entrada; // copias fijas: el bucle cambia toff y entrada
      info.t = (s) => o0 + (e0 === 0 ? s - T0.s0 : T0.s1 - s);
      L.tramos.push(info);
      const salida = 1 - entrada, u = unionDe(X, salida), tSal = toff + len; L.largo = Math.max(L.largo, tSal);
      if (!u) break;
      const Y = u.X === X ? u.Y : u.X, ey = u.X === X ? u.ey : u.ex;
      if (visto.has(Y)) break;
      if (u.tipo === 'hueco') {
        const sx = salida ? X.s1 : X.s0, dir = Math.sign((Y.s0 + Y.s1) / 2 - sx) || 1;
        L.huecos.push({ t0: tSal, t1: tSal + u.g, T: X, sx, dir });
        toff = tSal + u.g;
      } else if (u.X === X) { // X es el tocado (A): Y entra en el punto de contacto
        toff = info.t(u.sTouch);
      } else { // X toca a Y (A): Y entra por su punta del rincón
        toff = tSal - (ey === 0 ? u.sTouch - Y.s0 : Y.s1 - u.sTouch);
      }
      entrada = ey; X = Y;
    }
    // tramos de cubierta en coordenada t (con su mueble: en el esquinero no se proponen artefactos)
    L.spans = L.tramos.flatMap(({ T, t }) => T.partes.map((q) => { const a = t(q.s0), b = t(q.s1); return { t0: Math.min(a, b), t1: Math.max(a, b), m: q.m, esq: q.esq, T }; })).sort((p, q) => p.t0 - q.t0);
    L.t0 = Math.min(...L.spans.map((s) => s.t0)); L.t1 = Math.max(...L.spans.map((s) => s.t1));
    lineas.push(L);
  }
  return lineas;
}
// Posición t de un punto en una línea (sobre la cubierta, en un hueco o un poco más allá de sus puntas)
function tEnLinea(L, p, { fuera = 0 } = {}) {
  for (const { T, t } of L.tramos) if (enTramo(T, p)) return t(dot(p, T.d));
  for (const h of L.huecos) { const s = dot(p, h.T.d); if (Math.abs(dot(p, h.T.n) - h.T.off) <= 80 && (s - h.sx) * h.dir >= -2 && (s - h.sx) * h.dir <= h.t1 - h.t0 + 2) return h.t0 + (s - h.sx) * h.dir; }
  const pf = fuera ? puntaCercana(L, p, fuera) : null;
  return pf ? pf.t : null;
}
// el punto queda junto a una punta de la línea (ej. el refrigerador al final de la cubierta): { t, dist } o null
function puntaCercana(L, p, fuera) {
  let mejor = null;
  for (const [info, punta] of [[L.tramos[0], 'ini'], [L.tramos[L.tramos.length - 1], 'fin']]) {
    const { T, t } = info, tp = t(dot(p, T.d)), lim = punta === 'ini' ? L.t0 : L.t1, perp = Math.abs(dot(p, T.n) - T.off), dist = punta === 'ini' ? lim - tp : tp - lim;
    if (perp <= 90 && dist > 0 && dist <= fuera && (!mejor || dist + perp < mejor.dist)) mejor = { t: tp, dist: dist + perp };
  }
  return mejor;
}

// ---------- elementos (artefactos, cocinas de piso y electrodomésticos) con su zona ----------
function elementos(modelo, Z, lineas) {
  const zonaDe = (campo, tipo) => Object.keys(Z).find((k) => (Z[k]?.[campo] || []).includes(tipo)) || null;
  const out = [];
  for (const m of modelo.modulos || []) {
    if (!m) continue;
    if (m.artefacto) { const z = zonaDe('cocinas_piso', m.artefacto); if (z) out.push({ zona: z, clase: 'piso', tipo: m.artefacto, ref: { m: m.id }, poly: huella(m), ancho: +m.ancho, nombre: m.nombre || 'Cocina de piso' }); continue; }
    for (const a of artefactosDe(m)) {
      const z = zonaDe('artefactos', a.tipo); if (!z) continue;
      out.push({ zona: z, clase: 'artefacto', tipo: a.tipo, ref: { m: m.id, a: a.id }, poly: a.pts.map(([x, zz]) => aMundo(m, x, zz)), ancho: a.ancho, fondo: a.fondo, nombre: a.tipo.startsWith('lavaplatos') ? 'Lavaplatos' : 'Encimera', esq: m.tipo === 'esquinero' });
    }
  }
  for (const o of modelo.objetos || []) { if (!o) continue; const z = zonaDe('objetos', o.tipo); out.push({ zona: z, clase: 'objeto', tipo: o.tipo, ref: { o: o.id }, poly: rectObjeto(o), ancho: +o.ancho || 60, elevacion: +o.elevacion || 0, nombre: o.nombre || o.tipo }); }
  for (const e of out) {
    e.c = centroPoly(e.poly);
    let L = lineas.find((l) => tEnLinea(l, e.c) != null), t = L ? tEnLinea(L, e.c) : null;
    if (!L && e.zona === 'frio') { // junto a una punta: la línea más cercana
      let mejor = null; for (const l of lineas) { const pc = puntaCercana(l, e.c, 120); if (pc && (!mejor || pc.dist < mejor.pc.dist)) mejor = { l, pc }; }
      if (mejor) { L = mejor.l; t = mejor.pc.t; }
    }
    if (L) { e.L = L; e.t = t; e.t0 = t - e.ancho / 2; e.t1 = t + e.ancho / 2; }
  }
  return out;
}
// cubierta libre desde t hacia dir (−1 / +1) en la línea, hasta otro elemento o el fin de la cubierta seguida
function libre(L, t, dir, els, yo) {
  const spans = L.spans, p = t + dir * .5;
  let run = null; // tramo de cubierta seguido que contiene p (los tramos que se tocan cuentan como uno)
  const corridas = []; for (const s of spans) { const u = corridas[corridas.length - 1]; if (u && s.t0 <= u.t1 + 2) u.t1 = Math.max(u.t1, s.t1); else corridas.push({ t0: s.t0, t1: s.t1 }); }
  // la cubierta que sigue (con 3 cm de holgura: una cocina de piso suele ser un poco más angosta que su hueco)
  run = corridas.find((r) => p >= r.t0 - .01 && p <= r.t1 + .01) || corridas.find((r) => (dir < 0 ? r.t1 <= t + .5 && t - r.t1 <= 3 : r.t0 >= t - .5 && r.t0 - t <= 3));
  if (!run) return 0;
  let lim = dir > 0 ? run.t1 : run.t0;
  for (const e of els) {
    if (e === yo || e.L !== L || e.clase === 'objeto' && e.zona !== 'frio') continue;
    if (dir > 0 && e.t0 >= t - .1) lim = Math.min(lim, e.t0);
    if (dir < 0 && e.t1 <= t + .1) lim = Math.max(lim, e.t1);
  }
  return Math.max(0, (lim - t) * dir);
}
const nivelMin = (v, verde, rojo) => (v >= verde ? 'verde' : v < rojo ? 'rojo' : 'amarillo');

// ---------- evaluación ----------
// opciones: { personas } (1 o 2). Devuelve { reglas: [{ id, nombre, nivel, valor, ayuda, refs }], peor, resumen, lineas, els }
export function evaluarCocina(modelo, reglasCfg = REGLAS_POR_DEFECTO, opciones = {}) {
  const cfg = reglasCfg && reglasCfg.reglas ? reglasCfg : REGLAS_POR_DEFECTO, Z = cfg.zonas || REGLAS_POR_DEFECTO.zonas;
  const L = lineasDeTrabajo(modelo), els = elementos(modelo, Z, L);
  const de = (z, f = () => true) => els.filter((e) => e.zona === z && f(e));
  const enLinea = (e) => !!e.L, sobreCubierta = (e) => e.clase !== 'objeto';
  const out = [];
  for (const R of cfg.reglas || []) {
    if (R.activa === false) continue;
    const base = { id: R.id, nombre: R.nombre, ayuda: R.ayuda || '', tipo: R.tipo };
    const res = (nivel, valor, refs = [], med = null) => out.push({ ...base, nivel, valor, refs, ...(med != null ? { med } : {}) });
    const v = +R.verde, v2 = +R.verde_2, ro = +R.rojo, ro2 = +R.rojo_2;
    if (R.tipo === 'secuencia') {
      const casos = L.map((l) => ({ l, F: de('frio', (e) => e.L === l)[0], Lv: de('lavado', (e) => e.L === l && sobreCubierta(e))[0], C: de('coccion', (e) => e.L === l && sobreCubierta(e))[0] })).filter((c) => c.Lv && c.C);
      if (!casos.length) {
        const hay = de('lavado', sobreCubierta).length && de('coccion', sobreCubierta).length;
        res(hay ? 'amarillo' : 'na', hay ? 'El lavaplatos y la cocción están en cubiertas separadas: no hay una línea de preparación entre ellos. Si se puede, júntalos en el mismo muro o en una L con esquinero.' : 'Falta un lavaplatos o una cocción.', hay ? [de('lavado', sobreCubierta)[0].ref, de('coccion', sobreCubierta)[0].ref] : []);
        continue;
      }
      let peor = null;
      for (const c of casos) {
        if (!c.F) { const r = { nivel: 'verde', valor: `Lavaplatos y cocción en la misma línea (el refrigerador no está junto a ella: ${de('frio').length ? 'queda aparte' : 'no hay'}).`, refs: [c.Lv.ref, c.C.ref] }; if (!peor) peor = r; continue; }
        const ok = (c.F.t < c.Lv.t && c.Lv.t < c.C.t) || (c.C.t < c.Lv.t && c.Lv.t < c.F.t);
        const r = ok ? { nivel: 'verde', valor: 'Refrigerador → lavaplatos → cocción, sin cruces.', refs: [c.F.ref, c.Lv.ref, c.C.ref] }
          : { nivel: 'rojo', valor: 'La cocción queda entre el refrigerador y el lavaplatos: el recorrido se cruza. El lavaplatos va al medio.', refs: [c.F.ref, c.Lv.ref, c.C.ref] };
        if (!peor || PESO[r.nivel] > PESO[peor.nivel]) peor = r;
      }
      res(peor.nivel, peor.valor, peor.refs); continue;
    }
    if (R.tipo === 'libre_entre') {
      const [za, zb] = R.zonas || ['lavado', 'coccion']; let peor = null;
      for (const a of de(za, (e) => enLinea(e) && sobreCubierta(e))) for (const b of de(zb, (e) => e.L === a.L && sobreCubierta(e))) {
        const dir = b.t > a.t ? 1 : -1, desde = dir > 0 ? a.t1 : a.t0, hasta = dir > 0 ? b.t0 : b.t1;
        const val = Math.min(libre(a.L, desde, dir, els, a), Math.max(0, (hasta - desde) * dir));
        const r = { nivel: nivelMin(val, v, ro), valor: `${cm(val)} cm libres entre ${a.nombre.toLowerCase()} y ${b.nombre.toLowerCase()} (ideal ${cm(v)}).`, refs: [a.ref, b.ref], val };
        if (!peor || PESO[r.nivel] > PESO[peor.nivel] || (r.nivel === peor.nivel && val < peor.val)) peor = r;
      }
      if (!peor) res('na', 'No hay lavaplatos y cocción en la misma línea de cubierta.'); else res(peor.nivel, peor.valor, peor.refs, peor.val); continue;
    }
    if (R.tipo === 'libre_lados') {
      const z = (R.zonas || [])[0]; let peor = null;
      for (const e of de(z, (x) => enLinea(x) && sobreCubierta(x))) {
        const a = libre(e.L, e.t0, -1, els, e), b = libre(e.L, e.t1, 1, els, e), may = Math.max(a, b), men = Math.min(a, b);
        const nivel = may >= v && men >= v2 ? 'verde' : men < ro ? 'rojo' : 'amarillo';
        const r = { nivel, valor: `${e.nombre}: ${cm(a)} y ${cm(b)} cm a los lados (ideal ${cm(v)} y ${cm(v2)}).`, refs: [e.ref], men };
        if (!peor || PESO[r.nivel] > PESO[peor.nivel] || (r.nivel === peor.nivel && men < peor.men)) peor = r;
      }
      if (!peor) res('na', 'No hay elementos de esta zona sobre la cubierta.'); else res(peor.nivel, peor.valor, peor.refs); continue;
    }
    if (R.tipo === 'apoyo') {
      const z = (R.zonas || [])[0]; let peor = null;
      for (const e of de(z)) {
        let ap = 0;
        if (e.L) ap = Math.max(libre(e.L, e.t0, -1, els, e), libre(e.L, e.t1, 1, els, e));
        if (!ap) { // fuera de la línea: la punta de cubierta más cercana
          let mejor = Infinity, sp = null, Lx = null;
          for (const l of L) for (const s of l.spans) for (const q of s.T.partes) { const d = distPoligonos(e.poly, q.poly); if (d < mejor) { mejor = d; sp = s; Lx = l; } }
          if (sp && mejor <= ro) { const p = e.c, tp = tEnLinea(Lx, p, { fuera: 400 }); ap = tp == null ? 0 : tp < sp.t0 ? libre(Lx, sp.t0, 1, els, e) : libre(Lx, sp.t1, -1, els, e); }
        }
        const r = { nivel: ap >= v ? 'verde' : ap > 0 ? 'amarillo' : 'rojo', valor: ap > 0 ? `${cm(ap)} cm de cubierta de apoyo junto a «${e.nombre}» (ideal ${cm(v)}).` : `Sin cubierta de apoyo a menos de ${cm(ro)} cm de «${e.nombre}».`, refs: [e.ref], ap };
        if (!peor || PESO[r.nivel] > PESO[peor.nivel] || (r.nivel === peor.nivel && ap < peor.ap)) peor = r;
      }
      if (!peor) res('na', 'No hay refrigerador en el modelo.'); else res(peor.nivel, peor.valor, peor.refs); continue;
    }
    if (R.tipo === 'separacion') {
      const [za, zb] = R.zonas || ['frio', 'coccion']; let peor = null;
      for (const a of de(za)) for (const b of de(zb)) {
        const d = distPoligonos(a.poly, b.poly), r = { nivel: nivelMin(d, v, ro), valor: `«${a.nombre}» a ${cm(d)} cm de «${b.nombre}» (ideal ${cm(v)} o un costado de mueble entre ambos).`, refs: [a.ref, b.ref], d };
        if (!peor || d < peor.d) peor = r;
      }
      if (!peor) res('na', 'No hay refrigerador y cocción a la vez.'); else res(peor.nivel, peor.valor, peor.refs); continue;
    }
    if (R.tipo === 'cerca_de') {
      const z = (R.zonas || [])[0], obs = els.filter((e) => e.clase === 'objeto' && e.tipo === R.objeto), destino = de(z, sobreCubierta); let peor = null;
      for (const o of obs) {
        const d = destino.length ? Math.min(...destino.map((x) => distPoligonos(o.poly, x.poly))) : Infinity;
        const r = { nivel: d <= v ? 'verde' : d > ro ? 'rojo' : 'amarillo', valor: d === Infinity ? 'No hay lavaplatos en el modelo.' : `${o.nombre} a ${cm(d)} cm del lavaplatos (ideal hasta ${cm(v)}).`, refs: [o.ref, ...destino.map((x) => x.ref)], d };
        if (!peor || d > peor.d) peor = r;
      }
      if (!peor) res('na', 'No hay lavavajillas en el modelo.'); else res(peor.nivel, peor.valor, peor.refs); continue;
    }
    if (R.tipo === 'triangulo') {
      const F = de('frio')[0], Lv = de('lavado', sobreCubierta)[0], C = de('coccion', sobreCubierta)[0] || de('coccion')[0];
      if (!F || !Lv || !C) { res('na', 'Hace falta refrigerador, lavaplatos y cocción para medir el triángulo.'); continue; }
      const d = (p, q) => Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]), lados = [d(F, Lv), d(Lv, C), d(C, F)], suma = lados.reduce((s, x) => s + x, 0);
      const ok = lados.every((x) => x >= v && x <= v2) && suma >= ro && suma <= ro2;
      res(ok ? 'verde' : suma > (+R.limite || 900) ? 'rojo' : 'amarillo', `Lados de ${lados.map(cm).join(', ')} cm; suma ${cm(suma)} cm (ideal cada lado ${cm(v)}–${cm(v2)} y suma ${cm(ro)}–${cm(ro2)}).`, [F.ref, Lv.ref, C.ref], suma);
      continue;
    }
    if (R.tipo === 'pasillo') {
      const pers = +opciones.personas || +modelo.personas_cocina || +cfg.personas_cocina || 1, minimo = pers >= 2 ? v2 || v : v;
      const W = muros(modelo.espacio).filter((w) => !w.oculto), mods = (modelo.modulos || []).filter((m) => m && m.tipo !== 'aereo');
      const obst = [...W.map((w) => [w.a, w.b]), ...mods.flatMap((m) => { const h = huella(m); return h.map((p, i) => [p, h[(i + 1) % 4], m.id]); }), ...(modelo.objetos || []).filter((o) => o && ['refri1', 'refri2', 'conservadora'].includes(o.tipo)).flatMap((o) => { const h = rectObjeto(o); return h.map((p, i) => [p, h[(i + 1) % 4]]); })];
      let peor = null;
      for (const m of mods) {
        if (m.tipo === 'esquinero' || !(m.cubierta || m.tipo === 'isla' || m.artefacto)) continue;
        const h = huella(m), n = girar(0, 1, +m.rotacion || 0);
        for (const k of [.25, .5, .75]) {
          const o = [h[3][0] + (h[2][0] - h[3][0]) * k, h[3][1] + (h[2][1] - h[3][1]) * k];
          let d = Infinity; for (const [a, b, id] of obst) { if (id === m.id) continue; const t = rayoSeg(o, n, a, b); if (t != null) d = Math.min(d, t); }
          if (d > 400) continue;
          if (!peor || d < peor.d) peor = { d, m };
        }
      }
      if (!peor) { res('na', 'No hay un muro o mueble enfrente a menos de 4 m.'); continue; }
      res(nivelMin(peor.d, minimo, ro), `Pasillo de ${cm(peor.d)} cm frente a «${peor.m.nombre}» (ideal ${cm(minimo)} para ${pers === 1 ? '1 persona' : `${pers} personas`}).`, [{ m: peor.m.id }], peor.d);
      continue;
    }
    if (R.tipo === 'vano') {
      const z = (R.zonas || [])[0], W = muros(modelo.espacio).filter((w) => !w.oculto); let peor = null;
      for (const e of de(z, sobreCubierta)) {
        const mod = (modelo.modulos || []).find((m) => m.id === e.ref.m); if (!mod || mod.tipo === 'isla') continue;
        const rot = ((Math.round(+mod.rotacion || 0) % 360) + 360) % 360;
        for (const w of W) {
          const E = ejeMuro(w), dist = dot(e.c, w.n) - E.linea; if (E.rot !== rot || dist < -5 || dist > 130) continue;
          const s = (e.c[0] - E.O[0]) * E.u[0] + (e.c[1] - E.O[1]) * E.u[1], a0 = s - e.ancho / 2, a1 = s + e.ancho / 2;
          if (a1 < -5 || a0 > w.largo + 5) continue;
          for (const vn of vanosDe(w)) {
            const b0 = vn.desde, b1 = vn.desde + vn.ancho, gap = Math.max(0, b0 - a1, a0 - b1), puerta = ['puerta', 'puerta_doble', 'vano'].includes(vn.tipo) || vn.antepecho < 60;
            let r;
            if (!puerta && gap === 0) r = { nivel: 'rojo', valor: `${e.nombre} bajo una ventana: el viento apaga la llama y la cortina se puede quemar.`, gap: -1 };
            else if (puerta) r = { nivel: nivelMin(gap, v, ro), valor: `${e.nombre} a ${cm(gap)} cm de una puerta (ideal ${cm(v)}).`, gap };
            else continue;
            r.refs = [e.ref];
            if (!peor || PESO[r.nivel] > PESO[peor.nivel] || (r.nivel === peor.nivel && r.gap < peor.gap)) peor = r;
          }
        }
      }
      if (!peor) res(de(z).length ? 'verde' : 'na', de(z).length ? 'Ninguna cocción bajo una ventana ni junto a una puerta.' : 'No hay cocción en el modelo.'); else res(peor.nivel, peor.valor, peor.refs);
      continue;
    }
    if (R.tipo === 'campana') {
      const enc = de((R.zonas || ['coccion'])[0], (e) => e.clase === 'artefacto' || e.clase === 'piso');
      if (!enc.length) { res('na', 'No hay encimera ni cocina de piso.'); continue; }
      const anchos = [60, 70, 75, 80, 90, 100, 120], txt = enc.map((e) => `${e.nombre} de ${cm(e.ancho)} cm → campana de al menos ${anchos.find((a) => a >= e.ancho) || Math.ceil(e.ancho / 10) * 10} cm`).join('; ');
      res('info', txt + '.', enc.map((e) => e.ref)); continue;
    }
    if (R.tipo === 'altura') {
      const obs = els.filter((e) => e.clase === 'objeto' && e.tipo === R.objeto), enc = de('coccion', (e) => e.clase === 'artefacto'); let peor = null;
      for (const o of obs) {
        const sobre = enc.some((x) => distPoligonos(o.poly, x.poly) === 0) && o.elevacion > 80;
        const r = sobre ? { nivel: 'rojo', valor: `${o.nombre} sobre la encimera: el vapor y el calor lo dañan y se alcanza por encima del fuego.` }
          : { nivel: o.elevacion >= v && o.elevacion <= v2 ? 'verde' : 'amarillo', valor: `${o.nombre} con su base a ${cm(o.elevacion)} cm del piso (ideal ${cm(v)}–${cm(v2)}).` };
        r.refs = [o.ref]; if (!peor || PESO[r.nivel] > PESO[peor.nivel]) peor = r;
      }
      if (!peor) res('na', 'No hay microondas en el modelo.'); else res(peor.nivel, peor.valor, peor.refs); continue;
    }
  }
  const peor = out.reduce((p, r) => (PESO[r.nivel] > PESO[p] ? r.nivel : p), 'na');
  const cuenta = (n) => out.filter((r) => r.nivel === n).length;
  return { reglas: out, peor, rojos: cuenta('rojo'), amarillos: cuenta('amarillo'), verdes: cuenta('verde'), lineas: L, els };
}

// ---------- sugerencia de orden (plantilla semitransparente en Planta) ----------
// Para cada línea con lavaplatos y cocción: el lavaplatos entre el refrigerador y la cocción, con su apoyo hacia el
// frío, la cubierta para preparar entre ambos y el apoyo del otro lado de la cocción. Solo mueve artefactos de
// cubierta (no las cocinas de piso ni los electrodomésticos) y no los pone en el esquinero. Devuelve
// [{ ref: { m, a }, nombre, wx, wz, poly, ancho, fondo }] con su posición propuesta, o [] si ya está bien o no cabe.
export function sugerirOrden(modelo, reglasCfg = REGLAS_POR_DEFECTO, ev = evaluarCocina(modelo, reglasCfg)) {
  const cfg = reglasCfg && reglasCfg.reglas ? reglasCfg : REGLAS_POR_DEFECTO, R = (id) => (cfg.reglas || []).find((r) => r.tipo === id || r.id === id) || {};
  const prep = +R('libre_entre').verde || 90, prepMin = +R('libre_entre').rojo || 60;
  const ladosLav = (cfg.reglas || []).find((r) => r.tipo === 'libre_lados' && (r.zonas || [])[0] === 'lavado') || {}, ladosCoc = (cfg.reglas || []).find((r) => r.tipo === 'libre_lados' && (r.zonas || [])[0] === 'coccion') || {};
  const apoyoLav = +ladosLav.verde_2 || 45, apoyoCoc = +ladosCoc.verde_2 || 30;
  const out = [];
  for (const L of ev.lineas) {
    const els = ev.els.filter((e) => e.L === L), F = els.find((e) => e.zona === 'frio'), Lv = els.find((e) => e.zona === 'lavado' && e.clase === 'artefacto' && !e.esq), C = els.find((e) => e.zona === 'coccion' && (e.clase === 'artefacto' || e.clase === 'piso') && !e.esq);
    if (!Lv || !C) continue;
    const asc = F ? F.t < C.t : Lv.t < C.t; // el frío (o el lavaplatos actual) va al comienzo
    // cubierta donde se pueden poner artefactos: tramos seguidos, sin el esquinero
    const corr = []; for (const s of L.spans.filter((x) => !x.esq)) { const u = corr[corr.length - 1]; if (u && s.t0 <= u.t1 + 2) { u.t1 = Math.max(u.t1, s.t1); u.spans.push(s); } else corr.push({ t0: s.t0, t1: s.t1, spans: [s] }); }
    const plan = (pp, aL, aC) => {
      if (C.clase === 'piso') { // la cocina de piso no se mueve: el lavaplatos se pone hacia el frío
        const r = corr.find((x) => (asc ? x.t1 <= C.t0 + 2 : x.t0 >= C.t1 - 2) && (asc ? C.t0 - x.t1 < 5 : x.t0 - C.t1 < 5)) || corr.filter((x) => (asc ? x.t1 <= C.t0 + 2 : x.t0 >= C.t1 - 2)).sort((p, q) => (asc ? q.t1 - p.t1 : p.t0 - q.t0))[0];
        if (!r) return null;
        const tL = asc ? Math.min(r.t1, C.t0) - pp - Lv.ancho / 2 : Math.max(r.t0, C.t1) + pp + Lv.ancho / 2;
        if ((asc ? tL - Lv.ancho / 2 - r.t0 : r.t1 - tL - Lv.ancho / 2) < aL) return null;
        return { tL };
      }
      const need = aL + Lv.ancho + pp + C.ancho + aC;
      const r = corr.filter((x) => x.t1 - x.t0 >= need).sort((p, q) => (q.spans.some((s) => s.m === Lv.ref.m || s.m === C.ref.m) ? 1 : 0) - (p.spans.some((s) => s.m === Lv.ref.m || s.m === C.ref.m) ? 1 : 0) || (q.t1 - q.t0) - (p.t1 - p.t0))[0];
      if (!r) return null;
      const extra = Math.min(30, r.t1 - r.t0 - need), p2 = pp + extra; // si sobra, un poco más para preparar
      if (asc) { const tL = r.t0 + aL + Lv.ancho / 2; return { tL, tC: tL + Lv.ancho / 2 + p2 + C.ancho / 2 }; }
      const tL = r.t1 - aL - Lv.ancho / 2; return { tL, tC: tL - Lv.ancho / 2 - p2 - C.ancho / 2 };
    };
    const p = plan(prep, apoyoLav, apoyoCoc) || plan(prepMin, Math.min(30, apoyoLav), Math.min(15, apoyoCoc)); if (!p) continue;
    const ubicar = (e, t) => { // de t a una posición del espacio, a la misma distancia del frente que hoy
      const sp = L.spans.find((s) => !s.esq && t >= s.t0 - .1 && t <= s.t1 + .1); if (!sp) return null;
      const info = L.tramos.find((x) => x.T === sp.T), T = sp.T, s = info.entrada === 0 ? T.s0 + (t - info.toff) : T.s1 - (t - info.toff);
      const delta = dot(e.c, T.n) - dot(puntoTramo(e.L.tramos.find((x) => enTramo(x.T, e.c))?.T || T, dot(e.c, T.d)), T.n);
      const c = [T.d[0] * s + T.n[0] * (T.off + delta), T.d[1] * s + T.n[1] * (T.off + delta)], hw = e.ancho / 2, hf = (e.fondo || 50) / 2;
      const poly = [[-hw, -hf], [hw, -hf], [hw, hf], [-hw, hf]].map(([a, b]) => [c[0] + T.d[0] * a + T.n[0] * b, c[1] + T.d[1] * a + T.n[1] * b]);
      return { ref: e.ref, nombre: e.nombre, wx: r1(c[0]), wz: r1(c[1]), poly, ancho: e.ancho, fondo: e.fondo, desde: e.c };
    };
    const sL = ubicar(Lv, p.tL), sC = p.tC != null ? ubicar(C, p.tC) : null;
    for (const s of [sL, sC]) if (s && Math.hypot(s.wx - s.desde[0], s.wz - s.desde[1]) > 3) out.push(s);
  }
  return out;
}
