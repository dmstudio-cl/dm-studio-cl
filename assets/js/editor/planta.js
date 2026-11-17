// Vista Planta del editor: dibujar los muros del espacio, etiquetarlos y ubicar los muebles
// (mover, girar) con cotas de distancia a los muros. Coordenadas en cm: x a lo largo del muro
// principal, z hacia la habitación. En pantalla, z crece hacia abajo (el muro del fondo queda arriba).
import { muros, huella, centro, distancias, rotarEnCentro, nuevoModulo } from './modelo.js';

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
      el('polygon', { points: pts.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `muro${esSel ? ' sel' : ''}`, 'data-tipo': 'muro', 'data-i': w.i }, plano);
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

    // muebles: huella, frente marcado y nombre
    for (const m of modelo.modulos) {
      const h = huella(m), esSel = sel?.m === m.id;
      el('polygon', { points: h.map(([x, z]) => `${M.X(x)},${M.Y(z)}`).join(' '), class: `huella${esSel ? ' sel' : ''}`, 'data-tipo': 'huella', 'data-m': m.id }, plano);
      el('line', { x1: M.X(h[2][0]), y1: M.Y(h[2][1]), x2: M.X(h[3][0]), y2: M.Y(h[3][1]), class: 'frente-linea' }, plano);
      const [cx, cz] = centro(m);
      el('text', { x: M.X(cx), y: M.Y(cz) + 4, 'text-anchor': 'middle', class: 'nombre' }, plano).textContent = m.nombre;
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

  // ---------- muros: dibujar una planta nueva ----------
  function siguiente(p, libre) {
    const u = dib.puntos.at(-1);
    let x = snap(p.x), z = snap(p.z);
    if (!libre) { if (Math.abs(x - u.x) >= Math.abs(z - u.z)) z = u.z; else x = u.x; } // 90°
    return { x, z };
  }
  function terminarMuros(cerrado) {
    const pts = dib.puntos; dib = null; cursor = null;
    if (pts.length < 2) { ctx.render({ panel: false }); return; }
    ctx.cambiar((d) => {
      const alto = d.espacio?.alto || 240;
      d.espacio = { ...(d.espacio || {}), alto, cerrado: !!cerrado, puntos: pts, muros: (cerrado ? pts : pts.slice(1)).map(() => ({ etiqueta: '', espesor: 15 })) }; // un registro por muro
    });
    ctx.setHerr('sel');
    ctx.aviso('Muros listos. Haz clic en un largo para corregirlo o en «+ etiqueta» para nombrar el muro.');
  }

  // Cambiar el largo del muro i: corre el extremo final y los muros perpendiculares que le siguen,
  // hasta el próximo muro paralelo (que absorbe la diferencia). Así una habitación sigue en escuadra.
  function cambiarLargo(esp, i, nuevo) {
    const P = esp.puntos, N = P.length, W = muros(esp)[i];
    if (!W || nuevo < 5) return;
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
    if (k === 'dist') valor = t.textContent;
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
      if (k === 'etiqueta') { ctx.cambiar((d) => { d.espacio.muros[i] = { ...(d.espacio.muros[i] || {}), etiqueta: txt.slice(0, 80) }; }); return; }
      const v = parseFloat(txt.replace(',', '.')); if (!isFinite(v)) return;
      if (k === 'largo') ctx.cambiar((d) => cambiarLargo(d.espacio, i, v));
      if (k === 'dist') {
        const m = modelo.modulos.find((x) => x.id === t.dataset.m);
        const ds = distancias(m, esp)[t.dataset.lado]; if (!ds) return;
        const mov = ds.d - v; // acercar o alejar del muro
        ctx.cambiar(() => { m.x = r1(+m.x + ds.dir[0] * mov); m.z = r1(+m.z + ds.dir[1] * mov); });
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
    if (herr === 'muros') {
      if (!dib) {
        if (modelo.espacio?.puntos?.length && !confirm('¿Reemplazar los muros actuales por unos nuevos?')) return;
        dib = { puntos: [{ x: snap(p.x), z: snap(p.z) }] };
      } else {
        const q = siguiente(p, e.shiftKey), f = dib.puntos[0], M = mapa();
        if (dib.puntos.length > 2 && Math.hypot(M.X(q.x) - M.X(f.x), M.Y(q.z) - M.Y(f.z)) < 14) return terminarMuros(true); // cerrar
        const u = dib.puntos.at(-1);
        if (q.x !== u.x || q.z !== u.z) dib.puntos.push(q);
      }
      dibujar(); return;
    }
    if (herr === 'dibujar') { gesto = { tipo: 'nuevo', a: { x: snap(p.x), z: snap(p.z) }, b: null }; return; }
    const t = e.target.closest('[data-tipo]');
    if (!t) { ctx.setSel(null); ctx.render(); return; }
    const d = t.dataset;
    if (d.tipo === 'huella') {
      const m = modelo.modulos.find((x) => x.id === d.m);
      const s = ctx.sel();
      if (s?.m !== m.id || s.tipo === 'muro') ctx.setSel({ tipo: 'modulo', m: m.id });
      gesto = { tipo: 'mover', m: m.id, p0: p, x0: +m.x, z0: +m.z, antes: JSON.stringify(modelo) };
      ctx.render(); return;
    }
    if (d.tipo === 'muro') { ctx.setSel({ tipo: 'muro', i: +d.i }); ctx.render(); return; }
    if (d.tipo === 'vertice') { gesto = { tipo: 'vertice', i: +d.i, antes: JSON.stringify(modelo) }; return; }
  }
  function move(e) {
    const p = punto(e), modelo = ctx.modelo();
    ctx.estado(`x ${cm(p.x)} · z ${cm(p.z)} cm`);
    if (dib) { cursor = siguiente(p, e.shiftKey); dibujar(); return; }
    if (!gesto) return;
    if (gesto.tipo === 'nuevo') { gesto.b = { x: snap(p.x), z: snap(p.z) }; dibujar(); return; }
    if (gesto.tipo === 'mover') {
      const m = modelo.modulos.find((x) => x.id === gesto.m);
      m.x = snap(gesto.x0 + p.x - gesto.p0.x); m.z = snap(gesto.z0 + p.z - gesto.p0.z);
      if (!e.altKey) iman(m, modelo.espacio); // Alt: sin imán
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
      P[i] = { x, z };
      ctx.render({ panel: false });
    }
  }
  function up(e) {
    if (!gesto) return;
    const g = gesto; gesto = null;
    if (g.tipo === 'nuevo') {
      if (!g.b) return dibujar();
      const x0 = Math.min(g.a.x, g.b.x), z0 = Math.min(g.a.z, g.b.z), w = Math.abs(g.b.x - g.a.x), d = Math.abs(g.b.z - g.a.z);
      if (w < 10 || d < 10) return dibujar();
      const m = nuevoModulo({ x: x0, pz: z0, ancho: w, profundidad: Math.max(5, d - 1.8) });
      ctx.cambiar((md) => { md.modulos.push(m); iman(m, md.espacio); });
      ctx.setSel({ tipo: 'modulo', m: m.id }); ctx.setHerr('sel'); ctx.render();
      return;
    }
    ctx.registrar(g.antes);
  }
  function teclado(e) {
    if (!dib) return false;
    if (e.key === 'Enter') { terminarMuros(false); return true; }
    if (e.key === 'Escape') { dib = null; cursor = null; dibujar(); return true; }
    if (e.key === 'Backspace') { dib.puntos.pop(); if (!dib.puntos.length) dib = null; dibujar(); return true; }
    return false;
  }
  plano.addEventListener('dblclick', () => { if (dib && ctx.vista() === 'planta') terminarMuros(false); });

  return {
    dibujar, down, move, up, teclado,
    rotar(m, grados) { rotarEnCentro(m, (+m.rotacion || 0) + grados); },
    cancelar() { dib = null; cursor = null; gesto = null; },
    cambiarLargo,
  };
}
