// Imagen de referencia del editor (fotos de clientes o planos en PDF), una por vista (Frente / Planta).
//  1. Cargar: imagen o PDF (se elige la página).
//  2. Calibrar: se marcan las 4 esquinas de un rectángulo conocido y se escriben sus medidas en cm.
//     La imagen se endereza (homografía: corrige la perspectiva) y queda a escala real en el editor.
//  3. Proponer divisiones (Frente): se detectan las líneas fuertes del frente enderezado y se arma un
//     módulo con columnas, frentes y zócalo en cm, para revisar y ajustar.
// Las imágenes se guardan SOLO en este navegador (IndexedDB): no se publican ni van al repositorio.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
const r1 = (v) => Math.round(v * 10) / 10;
const medio = (v) => Math.round(v * 2) / 2;

// ---------- almacenamiento local (IndexedDB) ----------
function abrirDB() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('dm-editor', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('referencias');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function dbHacer(modo, fn) {
  const db = await abrirDB();
  return new Promise((ok, mal) => {
    const tx = db.transaction('referencias', modo);
    const req = fn(tx.objectStore('referencias'));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => mal(tx.error);
  });
}
const dbLeer = (k) => dbHacer('readonly', (s) => s.get(k)).catch(() => null);
const dbGuardar = (k, v) => dbHacer('readwrite', (s) => s.put(v, k)).catch(() => null);
const dbBorrar = (k) => dbHacer('readwrite', (s) => s.delete(k)).catch(() => null);

// ---------- carga de imagen o PDF ----------
const MAX_PX = 2400;
function aCanvas(fuente, w, h) {
  const k = Math.min(1, MAX_PX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
  return c;
}
export async function leerArchivo(archivo, pagina = 1) {
  if (archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name)) {
    const pdfjs = await import(/* @vite-ignore */ `${PDFJS}pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
    const n = Math.min(Math.max(1, pagina), doc.numPages);
    const page = await doc.getPage(n);
    const v0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: MAX_PX / Math.max(v0.width, v0.height) });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    return { canvas: c, paginas: doc.numPages, pagina: n };
  }
  const bmp = await createImageBitmap(archivo);
  return { canvas: aCanvas(bmp, bmp.width, bmp.height), paginas: 1, pagina: 1 };
}

// ---------- homografía (4 puntos) ----------
// Devuelve una función (u, v) → (x, y) que lleva el rectángulo [0..W]×[0..H] (cm) a los 4 puntos de la foto.
export function homografia(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i], [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  // eliminación de Gauss con pivoteo parcial
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    if (Math.abs(A[c][c]) < 1e-12) throw new Error('Los 4 puntos no forman un rectángulo válido.');
    for (let r = c + 1; r < 8; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = new Array(8);
  for (let r = 7; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < 8; k++) s -= A[r][k] * h[k]; h[r] = s / A[r][r]; }
  return (u, v) => { const w = h[6] * u + h[7] * v + 1; return [(h[0] * u + h[1] * v + h[2]) / w, (h[3] * u + h[4] * v + h[5]) / w]; };
}

// Endereza la zona marcada: devuelve un canvas a escala (k px por cm) con un margen m (cm) alrededor.
export function enderezar(fuente, puntos, W, H) {
  const m = Math.min(40, Math.max(W, H) * .12);
  const k = Math.min(6, 2200 / (Math.max(W, H) + 2 * m));
  const map = homografia([[0, 0], [W, 0], [W, H], [0, H]], puntos);
  const ow = Math.round((W + 2 * m) * k), oh = Math.round((H + 2 * m) * k);
  const sw = fuente.width, sh = fuente.height;
  const sd = fuente.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const g = out.getContext('2d'), od = g.createImageData(ow, oh);
  for (let j = 0; j < oh; j++) {
    const v = -m + (j + .5) / k;
    for (let i = 0; i < ow; i++) {
      const u = -m + (i + .5) / k;
      const [x, y] = map(u, v);
      if (x < 0 || y < 0 || x >= sw - 1 || y >= sh - 1) continue; // fuera de la foto: transparente
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, o = (j * ow + i) * 4;
      for (let c = 0; c < 3; c++) { // interpolación bilineal
        const a = sd[(y0 * sw + x0) * 4 + c], b2 = sd[(y0 * sw + x0 + 1) * 4 + c];
        const cc = sd[((y0 + 1) * sw + x0) * 4 + c], d = sd[((y0 + 1) * sw + x0 + 1) * 4 + c];
        od.data[o + c] = (a * (1 - fx) + b2 * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
      }
      od.data[o + 3] = 255;
    }
  }
  g.putImageData(od, 0, 0);
  return { canvas: out, m, k };
}

// ---------- detección de divisiones en el frente enderezado ----------
function suavizar(p, r) {
  const out = new Float32Array(p.length);
  let acc = 0; const n = 2 * r + 1;
  for (let i = -r; i < p.length + r; i++) {
    acc += p[Math.min(p.length - 1, Math.max(0, i + r))] - (i - r - 1 >= 0 ? p[Math.min(p.length - 1, i - r - 1)] : p[0]);
    if (i >= 0 && i < p.length) out[i] = acc / n;
  }
  return out;
}
// Picos de un perfil (posiciones en px): sobre la media + f·desviación, separados al menos sep px, lejos de los bordes.
// minAbs: fuerza mínima absoluta (descarta "picos" de puro ruido cuando no hay líneas reales).
function picos(perfil, { sep, borde, f = 1.6, max = 8, minAbs = 0 }) {
  const s = suavizar(perfil, Math.max(1, Math.round(sep / 12)));
  const zona = s.slice(borde, s.length - borde);
  if (!zona.length) return [];
  const media = zona.reduce((a, v) => a + v, 0) / zona.length;
  const desv = Math.sqrt(zona.reduce((a, v) => a + (v - media) ** 2, 0) / zona.length) || 1;
  const cand = [];
  for (let i = borde; i < s.length - borde; i++) {
    if (s[i] > media + f * desv && s[i] > minAbs && s[i] >= s[i - 1] && s[i] >= s[i + 1]) cand.push(i);
  }
  cand.sort((a, b) => s[b] - s[a]);
  const elegidos = [];
  for (const c of cand) { if (elegidos.every((e) => Math.abs(e - c) >= sep)) elegidos.push(c); if (elegidos.length >= max) break; }
  return elegidos.sort((a, b) => a - b);
}
// Analiza el rectángulo calibrado (W×H cm) y propone { zocalo, columnas: [{ ancho, frentes: [{ tipo, alto, bisagra }] }] }.
export function proponerDivisiones(ref, { base = true } = {}) {
  const { k, m, w: W, h: H } = ref;
  const ox = Math.round(m * k), oy = Math.round(m * k), pw = Math.round(W * k), ph = Math.round(H * k);
  const d = ref.canvas.getContext('2d').getImageData(ox, oy, pw, ph).data;
  const g = new Float32Array(pw * ph);
  for (let i = 0; i < pw * ph; i++) g[i] = d[i * 4 + 3] ? d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11 : 255;
  const gx = (x, y) => Math.abs(g[y * pw + Math.min(pw - 1, x + 1)] - g[y * pw + Math.max(0, x - 1)]);
  const gy = (x, y) => Math.abs(g[Math.min(ph - 1, y + 1) * pw + x] - g[Math.max(0, y - 1) * pw + x]);
  const cm = (px) => medio(px / k);

  // Zócalo: línea horizontal fuerte en la franja inferior (4–18 cm), en todo el ancho
  let Z = 0;
  if (base) {
    const filas = new Float32Array(ph);
    for (let y = 1; y < ph - 1; y++) { let a = 0; for (let x = 0; x < pw; x += 2) a += gy(x, y); filas[y] = a; }
    const desde = Math.round(ph - 18 * k), hasta = Math.round(ph - 4 * k);
    const zona = Array.from(filas.slice(desde, hasta));
    const media = filas.reduce((a, v) => a + v, 0) / ph;
    const imax = zona.indexOf(Math.max(...zona));
    Z = zona.length && zona[imax] > media * 2 ? cm(ph - (desde + imax)) : 10;
  }
  const phU = Math.round(ph - Z * k); // alto útil (sin zócalo), en px

  // Columnas: bordes verticales fuertes en la zona útil
  const cols = new Float32Array(pw);
  const y1c = Math.round(phU * .05), y2c = Math.round(phU * .95);
  for (let x = 1; x < pw - 1; x++) { let a = 0, n = 0; for (let y = y1c; y < y2c; y += 2) { a += gx(x, y); n++; } cols[x] = a / (n || 1); }
  // Referencia de "línea real": el borde vertical más fuerte del frente (incluye los cantos del mueble)
  let fuerza = 0; for (let x = 1; x < pw - 1; x++) fuerza = Math.max(fuerza, cols[x]);
  const xs = picos(cols, { sep: Math.round(8 * k), borde: Math.round(4 * k), minAbs: fuerza * .35 });
  if (xs.length) fuerza = xs.reduce((a, x) => a + cols[x], 0) / xs.length; // promedio de las divisiones encontradas
  const lim = [0, ...xs, pw];

  const columnas = [];
  for (let c = 0; c < lim.length - 1; c++) {
    const a = lim[c], b = lim[c + 1], ancho = b - a;
    // Filas de esta columna: bordes horizontales en su franja central
    const filas = new Float32Array(phU);
    const x1 = Math.round(a + ancho * .15), x2 = Math.round(b - ancho * .15);
    for (let y = 1; y < phU - 1; y++) { let s = 0, n = 0; for (let x = x1; x < x2; x += 2) { s += gy(x, y); n++; } filas[y] = s / (n || 1); }
    // una división horizontal tiene que ser al menos 40 % tan fuerte como las verticales (no veta ni sombras)
    const ys = picos(filas, { sep: Math.round(6 * k), borde: Math.round(3 * k), minAbs: fuerza * .4 });
    const lf = [0, ...ys, phU];
    const altos = lf.slice(1).map((v, i) => v - lf[i]);
    const frentes = altos.map((hpx) => ({
      tipo: altos.length >= 2 && hpx / k <= 40 ? 'cajon' : 'puerta',
      alto: cm(hpx),
    }));
    frentes.forEach((f) => { if (f.tipo === 'puerta') f.bisagra = c % 2 ? 'derecha' : 'izquierda'; });
    columnas.push({ ancho: cm(ancho), frentes });
  }
  return { ancho: medio(W), alto: medio(H), zocalo: Z, columnas };
}

// ---------- interfaz ----------
/**
 * ctx: { vista(), clave(), render(), aviso(t), moduloSel(), aplicarPropuesta(propuesta, ref), $ }
 */
export function crearReferencias(ctx) {
  const $ = (s) => document.querySelector(s);
  const refs = { frente: null, planta: null };
  let fuente = null, archivo = null, puntos = [];
  const dlg = $('#dlg-ref'), lienzo = $('#ref-lienzo');

  const clave = (v) => `${ctx.clave()}:${v}`;
  async function cargar() {
    for (const v of ['frente', 'planta']) {
      const r = await dbLeer(clave(v));
      refs[v] = r ? { ...r, canvas: await imgACanvas(r.img) } : null;
    }
    pintarPanel(); ctx.render();
  }
  function imgACanvas(src) {
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); ok(c); };
      im.onerror = () => ok(null);
      im.src = src;
    });
  }
  const guardar = (v) => {
    const r = refs[v];
    if (!r) return dbBorrar(clave(v));
    const { canvas, ...datos } = r;
    return dbGuardar(clave(v), datos);
  };

  // --- panel izquierdo
  function pintarPanel() {
    const v = ctx.vista(), r = refs[v === 'planta' ? 'planta' : 'frente'];
    const cuerpo = $('#ref-panel');
    if (v === '3d') { cuerpo.innerHTML = '<p class="ed-ayuda">Cambia a la vista Frente o Planta para usar una imagen de referencia.</p>'; return; }
    if (!r) {
      cuerpo.innerHTML = `<p class="ed-ayuda">Foto o plano (imagen o PDF) para calcar en la vista ${v === 'planta' ? 'Planta' : 'Frente'}. Se guarda solo en este navegador.</p>
        <button data-ref="cargar">Cargar imagen o PDF</button>`;
      return;
    }
    cuerpo.innerHTML = `
      <label class="ed-check"><input type="checkbox" data-ref="visible"${r.visible ? ' checked' : ''}> Mostrar (${r.w} × ${r.h} cm)</label>
      <label class="ed-campo">Opacidad<input type="range" min="10" max="100" value="${Math.round(r.opacidad * 100)}" data-ref="opacidad"></label>
      <div class="ed-campos">
        <label class="ed-campo">X<span class="u" data-u="cm"><input type="number" step="0.5" value="${r.x0}" data-ref="x0"></span></label>
        <label class="ed-campo">${v === 'planta' ? 'Z' : 'Y (desde el piso)'}<span class="u" data-u="cm"><input type="number" step="0.5" value="${r.y0}" data-ref="y0"></span></label>
      </div>
      <div class="ed-botones">
        ${v === 'frente' ? '<button data-ref="proponer" class="ed-primario">Proponer divisiones</button>' : ''}
        <button data-ref="calibrar">Calibrar de nuevo</button><button data-ref="cargar">Otra imagen</button><button data-ref="quitar" class="peligro">Quitar</button>
      </div>`;
  }
  $('#ref-panel').addEventListener('click', async (e) => {
    const a = e.target.closest('button[data-ref]')?.dataset.ref; if (!a) return;
    const v = ctx.vista() === 'planta' ? 'planta' : 'frente';
    if (a === 'cargar') $('#ref-archivo').click();
    if (a === 'calibrar') { if (fuente) abrirDialogo(); else ctx.aviso('Vuelve a cargar la imagen original para calibrarla de nuevo.'); }
    if (a === 'quitar') { refs[v] = null; await guardar(v); pintarPanel(); ctx.render(); }
    if (a === 'proponer') {
      const r = refs.frente; if (!r?.canvas) return;
      const sel = ctx.moduloSel();
      const base = !(sel ? +sel.elevacion > 100 : r.y0 > 100);
      const p = proponerDivisiones(r, { base });
      ctx.aplicarPropuesta(p, r);
      const nf = p.columnas.reduce((a, c) => a + c.frentes.length, 0);
      ctx.aviso(`Propuesta: ${p.columnas.length} columna(s), ${nf} frente(s)${p.zocalo ? `, zócalo ${p.zocalo} cm` : ''}. Revisa y ajusta las medidas en las cotas.`);
    }
  });
  $('#ref-panel').addEventListener('input', async (e) => {
    const a = e.target.dataset.ref; if (!a) return;
    const v = ctx.vista() === 'planta' ? 'planta' : 'frente', r = refs[v]; if (!r) return;
    if (a === 'visible') r.visible = e.target.checked;
    if (a === 'opacidad') r.opacidad = +e.target.value / 100;
    if (a === 'x0' || a === 'y0') { const n = parseFloat(e.target.value); if (isFinite(n)) r[a] = n; }
    ctx.render({ panel: false });
    clearTimeout(r._t); r._t = setTimeout(() => guardar(v), 300);
  });

  // --- elegir archivo
  $('#ref-archivo').addEventListener('change', async (e) => {
    archivo = e.target.files[0]; e.target.value = '';
    if (!archivo) return;
    try {
      ctx.aviso('Abriendo la imagen…');
      const r = await leerArchivo(archivo, 1);
      fuente = r.canvas;
      $('#ref-pagina-caja').hidden = r.paginas < 2;
      $('#ref-pagina').innerHTML = Array.from({ length: r.paginas }, (_, i) => `<option value="${i + 1}">Página ${i + 1}</option>`).join('');
      abrirDialogo();
    } catch (err) { ctx.aviso('No se pudo abrir el archivo: ' + err.message); }
  });
  $('#ref-pagina').addEventListener('change', async (e) => {
    const r = await leerArchivo(archivo, +e.target.value);
    fuente = r.canvas; puntos = []; dibujarDialogo();
  });

  // --- diálogo de calibración (4 esquinas + medidas)
  function abrirDialogo() {
    puntos = [];
    const v = ctx.vista() === 'planta' ? 'planta' : 'frente';
    const sel = ctx.moduloSel();
    $('#ref-ancho').value = v === 'frente' && sel ? sel.ancho : '';
    $('#ref-alto').value = v === 'frente' && sel ? sel.alto : '';
    $('#ref-titulo-alto').textContent = v === 'planta' ? 'Fondo (cm)' : 'Alto (cm)';
    dlg.showModal();
    requestAnimationFrame(dibujarDialogo);
  }
  function escalaDialogo() {
    const maxW = Math.min(window.innerWidth * .86, 1100), maxH = window.innerHeight * .62;
    return Math.min(maxW / fuente.width, maxH / fuente.height);
  }
  function dibujarDialogo() {
    const s = escalaDialogo();
    lienzo.width = Math.round(fuente.width * s); lienzo.height = Math.round(fuente.height * s);
    const g = lienzo.getContext('2d');
    g.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
    g.lineWidth = 2; g.strokeStyle = '#b4322e'; g.fillStyle = 'rgba(180,50,46,.15)';
    if (puntos.length) {
      g.beginPath(); puntos.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
      if (puntos.length === 4) { g.closePath(); g.fill(); }
      g.stroke();
    }
    const nombres = ['Arriba izq.', 'Arriba der.', 'Abajo der.', 'Abajo izq.'];
    puntos.forEach(([x, y], i) => {
      g.fillStyle = '#b4322e'; g.beginPath(); g.arc(x * s, y * s, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '600 12px system-ui'; g.fillText(`${i + 1}`, x * s - 3.5, y * s + 4);
    });
    $('#ref-paso').textContent = puntos.length < 4
      ? `Haz clic en la esquina ${puntos.length + 1} de 4: ${nombres[puntos.length]} del rectángulo que conoces (el frente del mueble o la vista del plano).`
      : 'Listo. Escribe las medidas reales de ese rectángulo y presiona «Usar».';
  }
  lienzo.addEventListener('click', (e) => {
    if (puntos.length >= 4) return;
    const r = lienzo.getBoundingClientRect(), s = escalaDialogo();
    puntos.push([(e.clientX - r.left) / s, (e.clientY - r.top) / s]);
    dibujarDialogo();
  });
  $('#ref-reiniciar').addEventListener('click', () => { puntos = []; dibujarDialogo(); });
  $('#ref-cancelar').addEventListener('click', () => dlg.close());
  $('#ref-usar').addEventListener('click', async () => {
    const W = parseFloat(String($('#ref-ancho').value).replace(',', '.')), H = parseFloat(String($('#ref-alto').value).replace(',', '.'));
    if (puntos.length < 4) { $('#ref-paso').textContent = 'Faltan esquinas: marca las 4.'; return; }
    if (!(W > 0 && H > 0)) { $('#ref-paso').textContent = 'Escribe el ancho y el alto en cm.'; return; }
    try {
      const { canvas, m, k } = enderezar(fuente, puntos, W, H);
      const v = ctx.vista() === 'planta' ? 'planta' : 'frente';
      const sel = ctx.moduloSel();
      refs[v] = {
        img: canvas.toDataURL('image/jpeg', .85), canvas, m, k, w: r1(W), h: r1(H), opacidad: .55, visible: true,
        x0: v === 'frente' && sel ? +sel.x : 0, y0: v === 'frente' && sel ? +sel.elevacion : 0,
      };
      await guardar(v);
      dlg.close(); pintarPanel(); ctx.render();
      ctx.aviso(v === 'frente' ? 'Imagen calibrada. Dibuja encima o usa «Proponer divisiones».' : 'Imagen calibrada. Dibuja los muros o ubica los muebles encima.');
    } catch (err) { $('#ref-paso').textContent = err.message; }
  });

  // --- pintar la referencia en el plano (SVG) de la vista actual
  // M: mapeo de la vista (X(x) y Y(y) en Frente; X(x) y Y(z) en Planta), s: px por cm.
  function pintar(svg, M, vista) {
    const r = refs[vista];
    if (!r?.visible) return;
    const NS = 'http://www.w3.org/2000/svg';
    const im = document.createElementNS(NS, 'image');
    const x = M.X(r.x0 - r.m), y = vista === 'planta' ? M.Y(r.y0 - r.m) : M.Y(r.y0 + r.h + r.m);
    for (const [a, b] of Object.entries({ href: r.img, x, y, width: (r.w + 2 * r.m) * M.s, height: (r.h + 2 * r.m) * M.s, opacity: r.opacidad, preserveAspectRatio: 'none', class: 'ref-img' })) im.setAttribute(a, b);
    svg.insertBefore(im, svg.children[1] || null); // sobre la grilla, debajo de todo lo demás
    // contorno del rectángulo calibrado
    const rc = document.createElementNS(NS, 'rect');
    const ry = vista === 'planta' ? M.Y(r.y0) : M.Y(r.y0 + r.h);
    for (const [a, b] of Object.entries({ x: M.X(r.x0), y: ry, width: r.w * M.s, height: r.h * M.s, class: 'ref-marco' })) rc.setAttribute(a, b);
    svg.insertBefore(rc, im.nextSibling);
  }

  return { cargar, pintar, pintarPanel, get refs() { return refs; } };
}
