// Vista Planta del editor: dibujar los muros del espacio, etiquetarlos y ubicar los muebles
// (mover, girar) con cotas de distancia a los muros. Coordenadas en cm: x a lo largo del muro
// principal, z hacia la habitación. En pantalla, z crece hacia abajo (el muro del fondo queda arriba).
import { muros, huella, centro, distancias, rotarEnCentro, nuevoModulo, ejeMuro, vanosDe, VANOS, artefactosDe, girar, metaMuro, murosContorno, uid, moverArtefacto, centroArtefacto, distanciasArtefacto } from './modelo.js';
import { ARTEFACTOS } from './artefactos.js';
import { OBJETOS } from './objetos.js';
import { cubiertaDe, tablero, celdas, fondoTotal, GAP } from './modelo.js';
import { huellaEsquinero, frentesPlanta, geoEsquinero, divisionesEsquinero } from './esquinero.js';

const SVG = 'http://www.w3.org/2000/svg';
const r1 = (v) => Math.round(v * 10) / 10;
const cm = (v) => `${r1(v)}`.replace('.', ',');
const snap = (v, paso = 1) => Math.round(v / paso) * paso;
const IMAN = 3; // cm: a esta distancia un mueble se pega al muro
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};

/**
 * ctx: {
 *   modelo(), sel(), setSel(s), cambiar(fn), registrar(antes), render(opts), aviso(t),
 *   herr(), setHerr(h), escala() → { s, c, Wp, Hp }, plano (svg), lienzo
 * }
 */
export function crearPlanta(ctx) {
  const plano = ctx.plano;
  let gesto = null;
  let dib = null; // muros en dibujo: { puntos: [{x,z}] }
  let cursor = null;
  let med = null; // huincha: primer punto { x, z } mientras se mide

  function mapa() {
    const { s, c, Wp, Hp } = ctx.escala();
    return {
      s, Wp, Hp,
      X: (x) => Wp / 2 + (x - c[0]) * s,
      Y: (z) => Hp / 2 + (z - c[2]) * s,
      x: (px) => c[0] + (px - Wp / 2) / s,
      z: (py) => c[2] + (py - Hp / 2) / s,
    };
  }
  const punto = (e) => { const M = mapa(), r = plano.getBoundingClientRect(); return { x: M.x(e.clientX - r.left), z: M.z(e.clientY - r.top), px: e.clientX - r.left, py: e.clientY - r.top }; };

  // ---------- dibujo del plano ----------
  function dibujar() {
    const M = mapa(), modelo = ctx.modelo(), sel = ctx.sel(), esp = modelo.espacio;
    plano.setAttribute('viewBox', `0 0 ${M.Wp} ${M.Hp}`);
    plano.replaceChildren();
    // grilla de 10 cm
    const g = el('g', { class: 'grilla' }, plano);
    const xa = Math.floor(M.x(0) / 10) * 10, xb = M.x(M.Wp), za = Math.floor(M.z(0) / 10) * 10, zb = M.z(M.Hp);
    for (let x = xa; x <= xb; x += 10) el('line', { x1: M.X(x), y1: 0, x2: M.X(x), y2: M.Hp, class: x % 50 === 0 ? 'g50' : null }, g);
    for (let z = za; z <= zb; z += 10) el('line', { x1: 0, y1: M.Y(z), x2: M.Wp, y2: M.Y(z), class: z % 50 === 0 ? 'g50' : null }, g);
    ctx.fondo?.(plano, M); // imagen de referencia (plano del cliente), debajo de los muros

    // muros
    const W = muros(esp);
    for (const w of W) {
      const o = [-w.n[0] * w.espesor, -w.n[1] * w.espesor]; // hacia afuera
      const pts = [w.a, w.b, [w.b[0] + o[0], w.b[1] + o[1]], [w.a[0] + o[0], w.a[1] + o[1]]];
      const esSel = sel?.tipo === 'muro' && sel.i === w.i;
      el('polygon', { points: pts.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `muro${esSel ? ' sel' : ''}${w.oculto ? ' oculto' : ''}`, 'data-tipo': 'muro', 'data-i': w.i }, plano);
    }
    // ventanas y puertas: hueco en el muro, vidrio o batiente de la puerta
    for (const w of W) {
      if (w.oculto) continue;
      const E = ejeMuro(w), P = (d, o = 0) => [E.O[0] + d * E.u[0] - w.n[0] * o, E.O[1] + d * E.u[1] - w.n[1] * o];
      for (const v of vanosDe(w)) {
        const def = VANOS[v.tipo], esSel = sel?.tipo === 'vano' && sel.i === w.i && sel.v === v.id;
        const a = v.desde, b = v.desde + v.ancho;
        const hueco = [P(a), P(b), P(b, w.espesor), P(a, w.espesor)];
        const gv = el('g', { class: `vano-planta${esSel ? ' sel' : ''}`, 'data-tipo': 'vano', 'data-i': w.i, 'data-v': v.id }, plano);
        el('polygon', { points: hueco.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' ') }, gv);
        if (def.puerta) { // hoja(s) abiertas hacia adentro con su arco
          const hojas = def.hojas === 2 ? [[a, v.ancho / 2, 1], [b, v.ancho / 2, -1]] : [[a, v.ancho, 1]];
          for (const [d, r, s] of hojas) {
            const bis = P(d), punta = [bis[0] + w.n[0] * r, bis[1] + w.n[1] * r], cierre = P(d + s * r);
            el('line', { x1: M.X(bis[0]), y1: M.Y(bis[1]), x2: M.X(punta[0]), y2: M.Y(punta[1]), class: 'hoja' }, gv);
            el('path', { d: `M ${M.X(cierre[0])} ${M.Y(cierre[1])} A ${r * M.s} ${r * M.s} 0 0 ${s * (E.u[0] * w.n[1] - E.u[1] * w.n[0]) > 0 ? 1 : 0} ${M.X(punta[0])} ${M.Y(punta[1])}`, class: 'arco' }, gv);
          }
        } else if (def.hojas) { // ventana: vidrio al centro del muro
          const p0 = P(a, w.espesor / 2), p1 = P(b, w.espesor / 2);
          el('line', { x1: M.X(p0[0]), y1: M.Y(p0[1]), x2: M.X(p1[0]), y2: M.Y(p1[1]), class: 'vidrio' }, gv);
        }
      }
    }
    // cotas de largo (por dentro) y etiquetas (por fuera), editables
    const cg = el('g', { class: 'cota' }, plano);
    for (const w of W) {
      const off = 16 / M.s; // separación de la cota hacia adentro, en cm
      const a = [w.a[0] + w.n[0] * off, w.a[1] + w.n[1] * off], b = [w.b[0] + w.n[0] * off, w.b[1] + w.n[1] * off];
      el('line', { x1: M.X(a[0]), y1: M.Y(a[1]), x2: M.X(b[0]), y2: M.Y(b[1]) }, cg);
      el('circle', { cx: M.X(a[0]), cy: M.Y(a[1]), r: 2.5 }, cg); el('circle', { cx: M.X(b[0]), cy: M.Y(b[1]), r: 2.5 }, cg);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      el('text', { x: M.X(mx + w.n[0] * 6 / M.s * 2), y: M.Y(mz + w.n[1] * 6 / M.s * 2) + 4, 'text-anchor': 'middle', class: 'editable', 'data-pcota': 'largo', 'data-i': w.i }, cg).textContent = `${cm(w.largo)} cm`;
      const lx = (w.a[0] + w.b[0]) / 2 - w.n[0] * (w.espesor + 14 / M.s), lz = (w.a[1] + w.b[1]) / 2 - w.n[1] * (w.espesor + 14 / M.s);
      el('text', { x: M.X(lx), y: M.Y(lz) + 4, 'text-anchor': 'middle', class: `editable etiqueta${w.etiqueta ? '' : ' vacia'}`, 'data-pcota': 'etiqueta', 'data-i': w.i }, cg).textContent = w.etiqueta || `+ etiqueta muro ${w.i + 1}`;
    }
    // vértices (arrastrables)
    (esp?.puntos || []).forEach((p, i) => el('circle', { cx: M.X(+p.x), cy: M.Y(+p.z), r: 5, class: 'vertice', 'data-tipo': 'vertice', 'data-i': i }, plano));
    (esp?.tramos || []).forEach((t, j) => { for (const k of ['a', 'b']) if (t?.[k]) el('circle', { cx: M.X(+t[k].x), cy: M.Y(+t[k].z), r: 5, class: 'vertice', 'data-tipo': 'tvertice', 'data-j': j, 'data-k': k }, plano); });

    // muebles: huella, frente marcado y nombre
    for (const m of modelo.modulos) {
      const h = huella(m), esSel = sel?.m === m.id || !!sel?.ids?.includes(m.id);
      if (m.tipo === 'esquinero') { // contorno en L, con sus dos frentes; «?» rojo hasta que se elija la solución
        const aM = (lx, lz) => { const [dx, dz] = girar(lx, lz, +m.rotacion || 0); return [+m.x + dx, +m.z + dz]; };
        const hl = huellaEsquinero(m).map(([x, z]) => aM(x, z));
        el('polygon', { points: hl.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `huella${esSel ? ' sel' : ''}`, 'data-tipo': 'huella', 'data-m': m.id }, plano);
        for (const d of divisionesEsquinero(m)) { const p = aM(...d.a), q = aM(...d.b); el('line', { x1: M.X(p[0]), y1: M.Y(p[1]), x2: M.X(q[0]), y2: M.Y(q[1]), class: 'esq-div' }, plano); } // divisiones diagonales
        for (const [a, b] of frentesPlanta(m)) { const p = aM(...a), q = aM(...b); el('line', { x1: M.X(p[0]), y1: M.Y(p[1]), x2: M.X(q[0]), y2: M.Y(q[1]), class: 'frente-linea' }, plano); }
        const g = geoEsquinero(m), [qx, qz] = aM(g.X((g.xb + g.W) / 2), g.fa / 2);
        el('text', { x: M.X(qx), y: M.Y(qz) + 4, 'text-anchor': 'middle', class: 'nombre' }, plano).textContent = m.nombre;
        if (!g.sol) el('text', { x: M.X(qx), y: M.Y(qz) + 26, 'text-anchor': 'middle', class: 'esq-pregunta' }, plano).textContent = '?';
        continue;
      }
      el('polygon', { points: h.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `huella${esSel ? ' sel' : ''}`, 'data-tipo': 'huella', 'data-m': m.id }, plano);
      el('line', { x1: M.X(h[2][0]), y1: M.Y(h[2][1]), x2: M.X(h[3][0]), y2: M.Y(h[3][1]), class: 'frente-linea' }, plano);
      const [cx, cz] = centro(m);
      el('text', { x: M.X(cx), y: M.Y(cz) + 4, 'text-anchor': 'middle', class: 'nombre' }, plano).textContent = m.nombre;
    }
    // apertura de las puertas (arco como en los planos): se toca para elegir la puerta y cambiar hacia dónde abre
    for (const m of modelo.modulos) aperturas(m, M, sel);
    // cubierta seleccionada: su contorno con los vuelos; cada borde se arrastra para extruirla (ej. barra de desayuno)
    if (sel?.tipo === 'cubierta') {
      const m = modelo.modulos.find((x) => x.id === sel.m);
      if (m?.cubierta) {
        const cb = cubiertaDe(m), aM = (lx, lz) => { const [dx, dz] = girar(lx, lz, +m.rotacion || 0); return [+m.x + dx, +m.z + dz]; };
        const P = (a, b) => aM(a, b);
        el('polygon', { points: [P(cb.x0, cb.z0), P(cb.x1, cb.z0), P(cb.x1, cb.z1), P(cb.x0, cb.z1)].map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: 'cub-contorno' }, plano);
        const bordes = { frente: [[cb.x0, cb.z1], [cb.x1, cb.z1]], atras: [[cb.x0, cb.z0], [cb.x1, cb.z0]], izq: [[cb.x0, cb.z0], [cb.x0, cb.z1]], der: [[cb.x1, cb.z0], [cb.x1, cb.z1]] };
        for (const [lado, [a, b]] of Object.entries(bordes)) {
          const [x1, z1] = P(...a), [x2, z2] = P(...b);
          el('line', { x1: M.X(x1), y1: M.Y(z1), x2: M.X(x2), y2: M.Y(z2), class: `cub-borde${sel.cara === lado ? ' sel' : ''}`, 'data-tipo': 'cub-borde', 'data-m': m.id, 'data-lado': lado }, plano);
          const v = cb.v[lado];
          if (v > .05) el('text', { x: M.X((x1 + x2) / 2), y: M.Y((z1 + z2) / 2) - 8, 'text-anchor': 'middle', class: 'cub-txt' }, plano).textContent = `vuelo ${cm(v)}`;
        }
      }
    }
    // electrodomésticos sueltos: huella girada, seleccionables y arrastrables
    for (const o of modelo.objetos || []) {
      if (!OBJETOS[o.tipo]) continue;
      const w = +o.ancho / 2, f = +o.fondo / 2, r = +o.rotacion || 0;
      const pts = [[-w, -f], [w, -f], [w, f], [-w, f]].map(([a, b]) => { const [dx, dz] = girar(a, b, r); return [+o.x + dx, +o.z + dz]; });
      const esSel = sel?.tipo === 'objeto' && sel.o === o.id;
      el('polygon', { points: pts.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `objeto${esSel ? ' sel' : ''}`, 'data-tipo': 'objeto', 'data-o': o.id }, plano);
      const [fx, fz] = girar(0, f, r); // marca del frente
      el('circle', { cx: M.X(+o.x + fx), cy: M.Y(+o.z + fz), r: 3, class: 'objeto-frente' }, plano);
      el('text', { x: M.X(+o.x), y: M.Y(+o.z) + 4, 'text-anchor': 'middle', class: 'objeto-txt' }, plano).textContent = o.nombre || OBJETOS[o.tipo].nombre;
    }
    // encimeras y lavaplatos sobre las cubiertas (con cotas a los bordes del mueble si están seleccionados)
    for (const m of modelo.modulos) {
      const aMundo = (lx, lz) => { const [dx, dz] = girar(lx, lz, +m.rotacion || 0); return [+m.x + dx, +m.z + dz]; };
      for (const a of artefactosDe(m)) {
        const esSel = sel?.tipo === 'artefacto' && sel.m === m.id && sel.a === a.id;
        const pts = a.pts.map(([x, z]) => aMundo(x, z));
        el('polygon', { points: pts.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `artefacto${esSel ? ' sel' : ''}${ARTEFACTOS[a.tipo]?.cubas ? ' lava' : ''}`, 'data-tipo': 'artefacto', 'data-m': m.id, 'data-a': a.id }, plano);
        if (!esSel || a.giro || m.tipo === 'esquinero') continue; // cotas a los bordes solo en muebles derechos
        const g = el('g', { class: 'cota' }, plano), W = +m.ancho, zc = (a.z0 + a.z1) / 2, xc = (a.x0 + a.x1) / 2, Dc = a.z1 + a.frente;
        const lin = (p, q, t) => {
          const [x1, z1] = aMundo(...p), [x2, z2] = aMundo(...q);
          if (Math.hypot(x2 - x1, z2 - z1) < .05) return;
          el('line', { x1: M.X(x1), y1: M.Y(z1), x2: M.X(x2), y2: M.Y(z2) }, g);
          el('text', { x: M.X((x1 + x2) / 2), y: M.Y((z1 + z2) / 2) - 5, 'text-anchor': 'middle' }, g).textContent = t;
        };
        lin([0, zc], [a.x0, zc], cm(a.x0)); lin([a.x1, zc], [W, zc], cm(W - a.x1));
        lin([xc, 0], [xc, a.z0], cm(a.z0)); lin([xc, a.z1], [xc, Dc], cm(a.frente));
      }
    }
    // distancias del mueble seleccionado a los muros (editables)
    const ms = sel && modelo.modulos.find((m) => m.id === sel.m);
    if (ms && W.length) {
      const dg = el('g', { class: 'cota distancia' }, plano);
      for (const [lado, v] of Object.entries(distancias(ms, esp))) {
        if (v.d > 2000) continue;
        const a = v.desde, b = [a[0] + v.dir[0] * v.d, a[1] + v.dir[1] * v.d];
        el('line', { x1: M.X(a[0]), y1: M.Y(a[1]), x2: M.X(b[0]), y2: M.Y(b[1]) }, dg);
        el('circle', { cx: M.X(b[0]), cy: M.Y(b[1]), r: 2.5 }, dg);
        el('text', { x: M.X((a[0] + b[0]) / 2) + 6, y: M.Y((a[1] + b[1]) / 2) - 6, class: 'editable', 'data-pcota': 'dist', 'data-lado': lado, 'data-m': ms.id }, dg).textContent = `${cm(Math.max(0, v.d))}`;
      }
    }
    // artefacto seleccionado (lavaplatos o encimera): distancias a los muros, editables como las de un mueble
    const ma = sel?.tipo === 'artefacto' && modelo.modulos.find((m) => m.id === sel.m);
    if (ma && W.length) {
      const dg = el('g', { class: 'cota distancia' }, plano);
      for (const [lado, v] of Object.entries(distanciasArtefacto(ma, sel.a, esp))) {
        if (v.d > 2000) continue;
        const a = v.desde, b = [a[0] + v.dir[0] * v.d, a[1] + v.dir[1] * v.d];
        el('line', { x1: M.X(a[0]), y1: M.Y(a[1]), x2: M.X(b[0]), y2: M.Y(b[1]) }, dg);
        el('circle', { cx: M.X(b[0]), cy: M.Y(b[1]), r: 2.5 }, dg);
        el('text', { x: M.X((a[0] + b[0]) / 2) + 6, y: M.Y((a[1] + b[1]) / 2) - 6, class: 'editable', 'data-pcota': 'dist-art', 'data-lado': lado, 'data-m': ma.id, 'data-a': sel.a }, dg).textContent = `${cm(Math.max(0, v.d))}`;
      }
    }
    // medidas de la huincha (Planta)
    for (const md of (modelo.medidas || []).filter((x) => x?.vista === 'planta')) cotaMedida(md.a, md.b, M, { id: md.id, sel: sel?.tipo === 'medida' && sel.id === md.id });
    if (med) { cotaMedida([med.x, med.z], cursor ? [cursor.x, cursor.z] : [med.x, med.z], M, { vivo: true }); }
    // muros en dibujo
    if (dib?.puntos.length) {
      const pts = [...dib.puntos, ...(cursor ? [cursor] : [])];
      el('polyline', { points: pts.map((p) => `${M.X(p.x)},${M.Y(p.z)}`).join(' '), class: 'borrador-muro' }, plano);
      dib.puntos.forEach((p) => el('circle', { cx: M.X(p.x), cy: M.Y(p.z), r: 4, class: 'vertice' }, plano));
      if (cursor) {
        const u = dib.puntos.at(-1), L = Math.hypot(cursor.x - u.x, cursor.z - u.z);
        el('text', { x: M.X((u.x + cursor.x) / 2), y: M.Y((u.z + cursor.z) / 2) - 8, 'text-anchor': 'middle' }, el('g', { class: 'cota' }, plano)).textContent = `${cm(L)} cm`;
      }
    }
    if (gesto?.tipo === 'nuevo' && gesto.b) {
      const a = gesto.a, b = gesto.b;
      el('rect', { x: M.X(Math.min(a.x, b.x)), y: M.Y(Math.min(a.z, b.z)), width: Math.abs(b.x - a.x) * M.s, height: Math.abs(b.z - a.z) * M.s, class: 'borrador' }, plano);
      el('text', { x: M.X((a.x + b.x) / 2), y: M.Y(Math.min(a.z, b.z)) - 8, 'text-anchor': 'middle' }, el('g', { class: 'cota' }, plano)).textContent = `${cm(Math.abs(b.x - a.x))} × ${cm(Math.abs(b.z - a.z))} cm`;
    }
  }

  // Arcos de apertura de las puertas de un mueble, en su frente. Por columna se dibuja la puerta elegida
  // (o la más alta de esa columna); una sección de varias hojas abre hacia afuera desde el centro.
  function aperturas(m, M, sel) {
    if (m.artefacto || m.tipo === 'esquinero') return;
    const D = fondoTotal(m), r = +m.rotacion || 0;
    const P = (lx, lz) => { const [dx, dz] = girar(lx, lz, r); return [M.X(+m.x + dx), M.Y(+m.z + dz)]; };
    const cs = celdas(m).filter((c) => c.tipo === 'puerta' || c.tipo === 'puerta_doble');
    const porCol = new Map();
    for (const c of cs) {
      const elegida = sel?.tipo === 'frente' && sel.m === m.id && sel.col === c.col && sel.fila === c.fila;
      const prev = porCol.get(c.col);
      if (!prev || elegida || (!prev.elegida && c.h > prev.c.h)) porCol.set(c.col, { c, elegida });
    }
    for (const { c, elegida } of porCol.values()) {
      const f = m.columnas?.[c.col]?.frentes?.[c.fila] || {};
      const g = el('g', { class: `apertura-planta${elegida ? ' sel' : ''}`, 'data-tipo': 'puerta-planta', 'data-m': m.id, 'data-col': c.col, 'data-fila': c.fila }, plano);
      const hoja = (x0, x1, lado) => {
        const w = x1 - x0;
        if (lado === 'arriba' || lado === 'abajo') { // abatible: la hoja sale derecha hacia adelante
          const a = P(x0, D), b = P(x1, D), a2 = P(x0, D + w * .35), b2 = P(x1, D + w * .35);
          el('polygon', { points: [a, b, b2, a2].map((p) => p.join(',')).join(' '), class: 'abatible' }, g); return;
        }
        const xh = lado === 'derecha' ? x1 : x0, s = lado === 'derecha' ? -1 : 1;
        const bis = P(xh, D), punta = P(xh, D + w), cierre = P(xh + s * w, D);
        el('line', { x1: bis[0], y1: bis[1], x2: punta[0], y2: punta[1], class: 'hoja' }, g);
        el('path', { d: `M ${cierre[0]} ${cierre[1]} A ${w * M.s} ${w * M.s} 0 0 ${s > 0 ? 1 : 0} ${punta[0]} ${punta[1]}`, class: 'arco' }, g);
        // zona para tocar: el cuarto de círculo completo
        el('path', { d: `M ${bis[0]} ${bis[1]} L ${cierre[0]} ${cierre[1]} A ${w * M.s} ${w * M.s} 0 0 ${s > 0 ? 1 : 0} ${punta[0]} ${punta[1]} Z`, class: 'toque' }, g);
      };
      if (c.tipo === 'puerta') hoja(c.x0 + GAP / 2, c.x1 - GAP / 2, f.bisagra || 'izquierda');
      else { const n = c.hojas, lw = (c.w - (n - 1) * GAP) / n; for (let i = 0; i < n; i++) hoja(c.x0 + i * (lw + GAP), c.x0 + i * (lw + GAP) + lw, i <= (n - 1) / 2 ? 'izquierda' : 'derecha'); }
    }
  }

  // ---------- huincha de medir (dueño, 2026-11-25) ----------
  // Cota entre 2 puntos (cm). Se guarda en modelo.medidas = [{ id, vista: 'planta', a:[x,z], b:[x,z] }].
  function cotaMedida(a, b, M, { id, sel, vivo } = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), g = el('g', { class: `medida${sel ? ' sel' : ''}${vivo ? ' viva' : ''}`, ...(id ? { 'data-tipo': 'medida', 'data-id': id } : {}) }, plano);
    const x1 = M.X(a[0]), y1 = M.Y(a[1]), x2 = M.X(b[0]), y2 = M.Y(b[1]);
    el('line', { x1, y1, x2, y2, class: 'toque' }, g); el('line', { x1, y1, x2, y2 }, g);
    const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang) * 6, ny = Math.cos(ang) * 6;
    for (const [x, y] of [[x1, y1], [x2, y2]]) el('line', { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny }, g); // remates
    let rot = ang * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
    const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2;
    if (L > .05) el('text', { x: tx, y: ty - 7, 'text-anchor': 'middle', transform: `rotate(${rot} ${tx} ${ty})` }, g).textContent = `${cm(L)} cm`;
  }
  // Punto de la huincha: se pega a la punta de un muro o a la esquina de un mueble (10 px) o a la línea más cercana
  // de un mueble o muro (12 px); si no hay nada cerca, queda donde está el mouse.
  function imanHuincha(p) {
    const M = mapa(), modelo = ctx.modelo(), segs = [], pts = [];
    for (const w of muros(modelo.espacio)) if (!w.oculto) { segs.push([w.a, w.b]); pts.push(w.a, w.b); }
    for (const m of modelo.modulos) {
      let h = huella(m);
      if (m.tipo === 'esquinero') { const r = +m.rotacion || 0; h = huellaEsquinero(m).map(([x, z]) => { const [dx, dz] = girar(x, z, r); return [+m.x + dx, +m.z + dz]; }); }
      h.forEach((q, i) => { segs.push([q, h[(i + 1) % h.length]]); pts.push(q); });
    }
    const px = (q) => [M.X(q[0]), M.Y(q[1])], P = [M.X(p.x), M.Y(p.z)];
    let best = null, dmin = 10;
    for (const q of pts) { const [a, b] = px(q), d = Math.hypot(a - P[0], b - P[1]); if (d < dmin) { dmin = d; best = { x: q[0], z: q[1] }; } }
    if (best) return best;
    dmin = 12;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / L2));
      const q = [a[0] + t * dx, a[1] + t * dz], [qx, qy] = px(q), d = Math.hypot(qx - P[0], qy - P[1]);
      if (d < dmin) { dmin = d; best = { x: r1(q[0]), z: r1(q[1]) }; }
    }
    return best || { x: r1(p.x), z: r1(p.z) };
  }

  // ---------- muros: 2 clics = un muro (dueño, 2026-11-25) ----------
  // Puntas de todos los muros (contorno y sueltos) para el imán
  function puntas(esp) {
    const out = [];
    (esp?.puntos || []).forEach((p, i) => out.push({ x: +p.x, z: +p.z, c: 'p', i }));
    (esp?.tramos || []).forEach((t, j) => { if (t?.a) out.push({ x: +t.a.x, z: +t.a.z, c: 't', j, k: 'a' }); if (t?.b) out.push({ x: +t.b.x, z: +t.b.z, c: 't', j, k: 'b' }); });
    return out;
  }
  function imanPunta(p, esp, fuera = () => false) {
    const M = mapa(); let best = null, dmin = 14;
    for (const v of puntas(esp)) { if (fuera(v)) continue; const d = Math.hypot(M.X(v.x) - M.X(p.x), M.Y(v.z) - M.Y(p.z)); if (d < dmin) { dmin = d; best = v; } }
    return best;
  }
  // ¿la punta v es un extremo del contorno abierto? 'ini' | 'fin' | null
  const extremo = (esp, v) => { const P = esp?.puntos || []; if (!v || v.c !== 'p' || esp.cerrado || P.length < 2) return null; return v.i === 0 ? 'ini' : v.i === P.length - 1 ? 'fin' : null; };
  // Agrega el muro a→b: si es el primero, arranca el contorno; si parte o termina en un extremo del contorno, lo alarga
  // (o lo cierra); si no, queda como muro suelto.
  function agregarMuro(d, a, b, v0, v1) {
    const E = (d.espacio ||= {}); E.puntos ||= []; E.muros = Array.isArray(E.muros) ? E.muros : []; E.alto ||= 240;
    const P = E.puntos, e0 = extremo(E, v0), e1 = extremo(E, v1);
    if (P.length < 2 && !(E.tramos || []).length) { E.puntos = [a, b]; E.cerrado = false; E.muros = [{ etiqueta: '', espesor: 15 }]; return 'contorno'; }
    if (P.length > 2 && e0 && e1 && e0 !== e1) { E.cerrado = true; return 'cerrado'; }
    if (e0 === 'fin' || e1 === 'fin') { P.push(e0 === 'fin' ? b : a); return 'contorno'; }
    if (e0 === 'ini' || e1 === 'ini') { P.unshift(e0 === 'ini' ? b : a); E.muros.unshift({ etiqueta: '', espesor: 15 }); return 'contorno'; }
    (E.tramos ||= []).push({ a, b, espesor: 15 });
    return 'suelto';
  }
  function siguiente(p, libre) {
    const u = dib.puntos.at(-1);
    let x = snap(p.x), z = snap(p.z);
    if (!libre) { if (Math.abs(x - u.x) >= Math.abs(z - u.z)) z = u.z; else x = u.x; } // 90°
    return { x, z };
  }


  // Cambiar el largo del muro i: corre el extremo final y los muros perpendiculares que le siguen,
  // hasta el próximo muro paralelo (que absorbe la diferencia). Así una habitación sigue en escuadra.
  function cambiarLargo(esp, i, nuevo) {
    const P = esp.puntos, N = P.length, W = muros(esp)[i];
    if (!W || nuevo < 5) return;
    if (W.tramo != null) { const t = esp.tramos[W.tramo], k = nuevo / W.largo; t.b = { x: r1(W.a[0] + (W.b[0] - W.a[0]) * k), z: r1(W.a[1] + (W.b[1] - W.a[1]) * k) }; return; } // muro suelto: se corre su punta final
    const d = [(W.b[0] - W.a[0]) / W.largo, (W.b[1] - W.a[1]) / W.largo], delta = nuevo - W.largo;
    const mover = (k) => { P[k].x = r1(+P[k].x + d[0] * delta); P[k].z = r1(+P[k].z + d[1] * delta); };
    let j = (i + 1) % N;
    mover(j);
    const nseg = esp.cerrado ? N : N - 1;
    for (let paso = 0; paso < nseg - 1; paso++) {
      const k = j, k2 = (j + 1) % N;
      if (!esp.cerrado && k2 === 0) break;
      if (k2 === (i + 1) % N || k2 === i) break;
      const sx = +P[k2].x - +P[k].x, sz = +P[k2].z - +P[k].z, L = Math.hypot(sx, sz) || 1;
      if (Math.abs((sx * d[0] + sz * d[1]) / L) > .5) break; // muro paralelo: absorbe el cambio
      mover(k2); j = k2;
    }
  }

  // ---------- edición directa de cotas y etiquetas ----------
  function editar(t) {
    document.querySelector('.ed-cota-input')?.remove();
    const modelo = ctx.modelo(), esp = modelo.espacio, k = t.dataset.pcota, i = +t.dataset.i;
    const W = muros(esp)[i];
    let valor = '';
    if (k === 'largo') valor = cm(W.largo);
    if (k === 'etiqueta') valor = W?.etiqueta || '';
    if (k === 'dist' || k === 'dist-art') valor = t.textContent;
    const inp = document.createElement('input');
    inp.className = 'ed-cota-input' + (k === 'etiqueta' ? ' texto' : '');
    inp.value = valor;
    inp.placeholder = k === 'etiqueta' ? 'Ej: Tabique, Ladrillo princesa' : '';
    const r = t.getBoundingClientRect(), L = ctx.lienzo.getBoundingClientRect();
    inp.style.left = `${r.left - L.left + r.width / 2}px`; inp.style.top = `${r.top - L.top + r.height / 2}px`;
    ctx.lienzo.append(inp); inp.focus(); inp.select();
    let hecho = false;
    const cerrar = (ok) => {
      if (hecho) return; hecho = true;
      const txt = inp.value.trim(); inp.remove();
      if (!ok) return;
      if (k === 'etiqueta') { ctx.cambiar((d) => { metaMuro(d.espacio, i).etiqueta = txt.slice(0, 80); }); return; }
      const v = parseFloat(txt.replace(',', '.')); if (!isFinite(v)) return;
      if (k === 'largo') ctx.cambiar((d) => cambiarLargo(d.espacio, i, v));
      if (k === 'dist') {
        const m = modelo.modulos.find((x) => x.id === t.dataset.m);
        const ds = distancias(m, esp)[t.dataset.lado]; if (!ds) return;
        const mov = ds.d - v; // acercar o alejar del muro
        ctx.cambiar(() => { m.x = r1(+m.x + ds.dir[0] * mov); m.z = r1(+m.z + ds.dir[1] * mov); });
      }
      if (k === 'dist-art') { // acercar o alejar el artefacto del muro (sigue sobre la cubierta; si ahí no se apoya, avisa)
        const m = modelo.modulos.find((x) => x.id === t.dataset.m), aId = t.dataset.a;
        const ds = m && distanciasArtefacto(m, aId, esp)[t.dataset.lado], c = m && centroArtefacto(m, aId); if (!ds || !c) return;
        const mov = ds.d - v; let mid = null;
        ctx.cambiar((d) => { mid = moverArtefacto(d, m.id, aId, c[0] + ds.dir[0] * mov, c[1] + ds.dir[1] * mov); });
        if (mid) ctx.setSel({ tipo: 'artefacto', m: mid, a: aId }); else ctx.estado('Ahí no se apoya completo: necesita cubierta debajo');
        ctx.render();
      }
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cerrar(true); } if (e.key === 'Escape') { e.preventDefault(); cerrar(false); } });
    inp.addEventListener('blur', () => cerrar(true));
  }

  // Imán: si algún lado del mueble queda a menos de IMAN cm de un muro, se pega.
  function iman(m, esp) {
    for (const v of Object.values(distancias(m, esp))) {
      if (Math.abs(v.d) < IMAN) { m.x = r1(+m.x + v.dir[0] * v.d); m.z = r1(+m.z + v.dir[1] * v.d); }
    }
  }

  // ---------- puntero ----------
  function down(e) {
    if (e.button > 0) return;
    const p = punto(e), modelo = ctx.modelo(), herr = ctx.herr();
    const cota = e.target.closest('[data-pcota]');
    if (cota) { e.preventDefault(); editar(cota); return; }
    plano.setPointerCapture(e.pointerId);
    if (herr === 'muros') { // 2 clics = un muro; las puntas se pegan a las de otros muros
      const esp = modelo.espacio || {};
      if (!dib) { const v = imanPunta(p, esp); dib = { puntos: [v ? { x: v.x, z: v.z } : { x: snap(p.x), z: snap(p.z) }], v0: v }; dibujar(); return; }
      const v1 = imanPunta(p, esp), q = v1 ? { x: v1.x, z: v1.z } : siguiente(p, e.shiftKey), a = dib.puntos[0], v0 = dib.v0;
      if (Math.hypot(q.x - a.x, q.z - a.z) < 5) return; // muy corto
      dib = null; cursor = null;
      let como = '';
      ctx.cambiar((d) => { como = agregarMuro(d, a, q, v0, v1); });
      ctx.aviso({ contorno: 'Muro agregado al contorno.', cerrado: 'Contorno cerrado.', suelto: 'Muro suelto agregado: arrastra sus puntas para moverlo; acércalas a la punta de otro muro para pegarlas.' }[como] || '');
      return;
    }
    if (herr === 'medir') { // huincha: 2 clics = una cota que queda en el proyecto
      const q = imanHuincha(p);
      if (!med) { med = q; cursor = q; dibujar(); return; }
      const a = [med.x, med.z], b = [q.x, q.z]; med = null; cursor = null;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .5) { dibujar(); return; }
      const id = uid('med');
      ctx.cambiar((d) => { d.medidas = [...(d.medidas || []), { id, vista: 'planta', a, b }]; });
      ctx.aviso(`Medida: ${cm(Math.hypot(b[0] - a[0], b[1] - a[1]))} cm. Clic derecho sobre ella y Supr para borrarla.`);
      return;
    }
    if (herr === 'dibujar') { gesto = { tipo: 'nuevo', a: { x: snap(p.x), z: snap(p.z) }, b: null }; return; }
    const t = e.target.closest('[data-tipo]');
    // Espacio vacío: recuadro de selección (si casi no se mueve, solo deselecciona)
    if (!t) { gesto = { tipo: 'marco', a: p, b: null, suma: e.shiftKey }; return; }
    const d = t.dataset;
    // Mayús + clic sobre un mueble: lo agrega o lo quita de la selección múltiple
    if (d.tipo === 'puerta-planta') { // tocar el arco de una puerta: se elige esa puerta (su panel dice hacia dónde abre)
      ctx.setSel({ tipo: 'frente', m: d.m, col: +d.col, fila: +d.fila }); ctx.render(); return;
    }
    if (d.tipo === 'huella' && e.shiftKey) { ctx.alternar(d.m); return; }
    if (d.tipo === 'huella') {
      const m = modelo.modulos.find((x) => x.id === d.m);
      const s = ctx.sel();
      if (s?.m !== m.id || s.tipo === 'muro') ctx.setSel({ tipo: 'modulo', m: m.id });
      // si es parte de un mueble agrupado (ej. en L), se mueve el mueble completo
      const otros = m.grupo ? modelo.modulos.filter((x) => x.grupo === m.grupo && x.id !== m.id).map((x) => ({ id: x.id, x0: +x.x, z0: +x.z })) : [];
      gesto = { tipo: 'mover', m: m.id, p0: p, x0: +m.x, z0: +m.z, otros, antes: JSON.stringify(modelo) };
      ctx.render(); return;
    }
    if (d.tipo === 'muro') { ctx.setSel({ tipo: 'muro', i: +d.i }); ctx.render(); return; }
    if (d.tipo === 'vano') { ctx.setSel({ tipo: 'vano', i: +d.i, v: d.v }); ctx.render(); return; }
    if (d.tipo === 'objeto') { // electrodoméstico suelto: seleccionar y arrastrar
      const o = (modelo.objetos || []).find((x) => x.id === d.o); if (!o) return;
      ctx.setSel({ tipo: 'objeto', o: o.id });
      gesto = { tipo: 'objeto', o: o.id, p0: p, x0: +o.x, z0: +o.z, antes: JSON.stringify(modelo) };
      ctx.render(); return;
    }
    if (d.tipo === 'cub-borde') { // extruir la cubierta por ese lado
      ctx.setSel({ tipo: 'cubierta', m: d.m, cara: d.lado });
      gesto = { tipo: 'cub-borde', m: d.m, lado: d.lado, antes: JSON.stringify(modelo) };
      ctx.render(); return;
    }
    if (d.tipo === 'artefacto') { // encimera o lavaplatos: seleccionar y arrastrar sobre la cubierta
      const m = modelo.modulos.find((x) => x.id === d.m), a = (m?.artefactos || []).find((x) => x.id === d.a); if (!a) return;
      ctx.setSel({ tipo: 'artefacto', m: m.id, a: a.id });
      gesto = { tipo: 'artefacto', m: m.id, a: a.id, p0: p, c0: centroArtefacto(m, a.id), antes: JSON.stringify(modelo) };
      ctx.render(); return;
    }
    if (d.tipo === 'vertice') { gesto = { tipo: 'vertice', i: +d.i, antes: JSON.stringify(modelo) }; return; }
    if (d.tipo === 'tvertice') { gesto = { tipo: 'tvertice', j: +d.j, k: d.k, antes: JSON.stringify(modelo) }; return; }
    if (d.tipo === 'medida') { ctx.setSel({ tipo: 'medida', id: d.id }); ctx.render(); return; }
  }
  function move(e) {
    const p = punto(e), modelo = ctx.modelo();
    ctx.estado(`x ${cm(p.x)} · z ${cm(p.z)} cm`);
    if (dib) { const v = imanPunta(p, modelo.espacio || {}); cursor = v ? { x: v.x, z: v.z } : siguiente(p, e.shiftKey); dibujar(); return; }
    if (med) { cursor = imanHuincha(p); dibujar(); return; }
    if (!gesto) return;
    if (gesto.tipo === 'nuevo') { gesto.b = { x: snap(p.x), z: snap(p.z) }; dibujar(); return; }
    if (gesto.tipo === 'marco') {
      gesto.b = p; dibujar();
      const M = mapa(), a = gesto.a;
      el('rect', { x: M.X(Math.min(a.x, p.x)), y: M.Y(Math.min(a.z, p.z)), width: Math.abs(p.x - a.x) * M.s, height: Math.abs(p.z - a.z) * M.s, class: 'marco' }, plano);
      return;
    }
    if (gesto.tipo === 'objeto') {
      const o = (modelo.objetos || []).find((x) => x.id === gesto.o); if (!o) return;
      o.x = snap(gesto.x0 + p.x - gesto.p0.x, .5); o.z = snap(gesto.z0 + p.z - gesto.p0.z, .5);
      if (ctx.apoyar?.(o) === false) { o.x = gesto.ux ?? gesto.x0; o.z = gesto.uz ?? gesto.z0; ctx.estado('El microondas y los demás de mesa necesitan una cubierta, repisa o base debajo'); ctx.render({ panel: false }); return; }
      gesto.ux = o.x; gesto.uz = o.z; // sigue sobre la cubierta o repisa que tenga debajo (los de piso, al piso)
      ctx.render({ panel: false }); return;
    }
    if (gesto.tipo === 'cub-borde') {
      const m = modelo.modulos.find((x) => x.id === gesto.m); if (!m) return;
      const [lx, lz] = girar(p.x - +m.x, p.z - +m.z, -(+m.rotacion || 0)); // punto en ejes del mueble
      const W = +m.ancho, D = +m.profundidad + tablero(m), v = (n) => Math.max(0, Math.min(150, snap(n, .5)));
      if (gesto.lado === 'frente') m.vuelo_frente = v(lz - D);
      if (gesto.lado === 'atras') m.vuelo_atras = v(-lz);
      if (gesto.lado === 'izq') m.vuelo_izq = v(-lx);
      if (gesto.lado === 'der') m.vuelo_der = v(lx - W);
      ctx.estado(`vuelo ${gesto.lado === 'izq' ? 'izquierdo' : gesto.lado === 'der' ? 'derecho' : gesto.lado === 'atras' ? 'de atrás' : 'del frente'}: ${cm(cubiertaDe(m).v[gesto.lado])} cm`);
      ctx.render({ panel: false }); return;
    }
    if (gesto.tipo === 'artefacto') {
      // se mueve libre por las cubiertas: pasa de un mueble a otro y puede quedar sobre la unión si la cubierta es
      // continua; donde no se apoya completo (sin cubierta debajo), se queda en el último lugar válido
      if (!gesto.c0) return;
      const mid = moverArtefacto(modelo, gesto.m, gesto.a, snap(gesto.c0[0] + p.x - gesto.p0.x, .5), snap(gesto.c0[1] + p.z - gesto.p0.z, .5));
      if (!mid) { ctx.estado('Ahí no se apoya completo: necesita cubierta debajo'); return; }
      if (mid !== gesto.m) { gesto.m = mid; ctx.setSel({ tipo: 'artefacto', m: mid, a: gesto.a }); }
      ctx.render({ panel: false }); return;
    }
    if (gesto.tipo === 'mover') {
      const m = modelo.modulos.find((x) => x.id === gesto.m);
      m.x = snap(gesto.x0 + p.x - gesto.p0.x); m.z = snap(gesto.z0 + p.z - gesto.p0.z);
      if (!e.altKey) iman(m, modelo.espacio); // Alt: sin imán
      for (const o of gesto.otros || []) { const x = modelo.modulos.find((k) => k.id === o.id); if (x) { x.x = r1(o.x0 + +m.x - gesto.x0); x.z = r1(o.z0 + +m.z - gesto.z0); } }
      ctx.render({ panel: false }); return;
    }
    if (gesto.tipo === 'vertice') {
      const P = modelo.espacio.puntos, N = P.length, i = gesto.i;
      let x = snap(p.x), z = snap(p.z);
      // se alinea con los vecinos (mantiene la escuadra) si queda cerca
      for (const k of [(i - 1 + N) % N, (i + 1) % N]) {
        if (k === i || (!modelo.espacio.cerrado && (k === (i - 1 + N) % N ? i === 0 : i === N - 1))) continue;
        if (Math.abs(x - +P[k].x) < 4) x = +P[k].x;
        if (Math.abs(z - +P[k].z) < 4) z = +P[k].z;
      }
      const v = imanPunta(p, modelo.espacio, (w) => w.c === 'p' && w.i === i); // se pega a la punta de otro muro
      if (v) { x = v.x; z = v.z; }
      gesto.v = v;
      P[i] = { x, z };
      ctx.render({ panel: false });
    }
    if (gesto.tipo === 'tvertice') { // punta de un muro suelto
      const t = modelo.espacio.tramos[gesto.j], v = imanPunta(p, modelo.espacio, (w) => w.c === 't' && w.j === gesto.j);
      t[gesto.k] = v ? { x: v.x, z: v.z } : { x: snap(p.x), z: snap(p.z) };
      gesto.v = v;
      ctx.render({ panel: false });
    }
  }
  function up(e) {
    if (!gesto) return;
    const g = gesto; gesto = null;
    if (g.tipo === 'marco') {
      const M = mapa();
      if (!g.b || Math.hypot((g.b.x - g.a.x) * M.s, (g.b.z - g.a.z) * M.s) < 4) { if (!g.suma) { ctx.setSel(null); ctx.render(); } else dibujar(); return; }
      const x0 = Math.min(g.a.x, g.b.x), x1 = Math.max(g.a.x, g.b.x), z0 = Math.min(g.a.z, g.b.z), z1 = Math.max(g.a.z, g.b.z);
      const ids = ctx.modelo().modulos.filter((m) => {
        const h = huella(m), xs = h.map((q) => q[0]), zs = h.map((q) => q[1]);
        return Math.max(...xs) > x0 && Math.min(...xs) < x1 && Math.max(...zs) > z0 && Math.min(...zs) < z1; // toca el recuadro
      }).map((m) => m.id);
      ctx.seleccionarVarios(ids, g.suma);
      return;
    }
    if (g.tipo === 'nuevo') {
      if (!g.b) return dibujar();
      const x0 = Math.min(g.a.x, g.b.x), z0 = Math.min(g.a.z, g.b.z), w = Math.abs(g.b.x - g.a.x), d = Math.abs(g.b.z - g.a.z);
      if (w < 10 || d < 10) return dibujar();
      const m = nuevoModulo({ x: x0, pz: z0, ancho: w, profundidad: Math.max(5, d - 1.5) });
      ctx.cambiar((md) => { md.modulos.push(m); iman(m, md.espacio); });
      ctx.setSel({ tipo: 'modulo', m: m.id }); ctx.setHerr('sel'); ctx.render();
      return;
    }
    if (g.tipo === 'vertice' || g.tipo === 'tvertice') unirPuntas(ctx.modelo().espacio, g);
    ctx.registrar(g.antes);
  }
  // Al soltar una punta sobre otra: si es el extremo del contorno sobre su otro extremo, el contorno se cierra; si es
  // un muro suelto sobre un extremo del contorno, el muro pasa a ser parte del contorno. Si no, solo quedan pegadas.
  function unirPuntas(E, g) {
    const v = g.v; if (!v) return;
    const P = E.puntos || [];
    if (g.tipo === 'vertice') {
      const de = extremo(E, { c: 'p', i: g.i }), a = extremo(E, v);
      if (de && a && de !== a && P.length > 3) { P.splice(g.i, 1); if (g.i === 0 && Array.isArray(E.muros)) { const m0 = E.muros.shift(); E.muros[P.length - 1] = m0 || {}; } E.cerrado = true; ctx.aviso('Contorno cerrado.'); }
      return;
    }
    const e = extremo(E, v); if (!e) return;
    const t = E.tramos[g.j], otra = g.k === 'a' ? t.b : t.a, meta = { etiqueta: t.etiqueta || '', espesor: +t.espesor || 15, ...(t.alto ? { alto: t.alto } : {}), ...(t.vanos?.length ? { vanos: t.vanos } : {}) };
    E.tramos.splice(g.j, 1);
    E.muros = Array.isArray(E.muros) ? E.muros : [];
    if (e === 'fin') { E.muros[P.length - 1] = meta; P.push(otra); } else { P.unshift(otra); E.muros.unshift(meta); }
    ctx.aviso('El muro quedó unido al contorno.');
  }
  function teclado(e) {
    if (med && e.key === 'Escape') { med = null; cursor = null; dibujar(); return true; }
    if (!dib) return false;
    if (e.key === 'Escape' || e.key === 'Backspace') { dib = null; cursor = null; dibujar(); return true; }
    return false;
  }

  return {
    dibujar, down, move, up, teclado,
    rotar(m, grados) { rotarEnCentro(m, (+m.rotacion || 0) + grados); },
    cancelar() { dib = null; cursor = null; gesto = null; med = null; },
    cambiarLargo,
  };
}
