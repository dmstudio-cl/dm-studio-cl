// Plano técnico para mandar a fabricar: vista en planta general (ubicación de los muebles) y vista frontal de
// cada mueble con sus cotas. Genera SVG desde las medidas del modelo (1 unidad = 1 cm), pensado para imprimir.
import { celdas, tablero, huella, muros, marcoZocalo, TIPOS_FRENTE, fondoTotal } from './modelo.js';

const r1 = (v) => Math.round(v * 10) / 10;
const cm = (v) => `${r1(v)}`.replace('.', ',');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOMBRE_FRENTE = { puerta: 'Puerta', puerta_doble: 'Puertas', cajon: 'Cajón', panel: 'Panel', abierto: 'Abierto' };

// Cota: línea con topes en los extremos y la medida al centro. 'h' = horizontal, 'v' = vertical.
function cota(x1, y1, x2, y2, texto, { lado = 'arriba' } = {}) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, h = y1 === y2;
  const t = 3; // largo de los topes
  const topes = h ? `<line x1="${x1}" y1="${y1 - t}" x2="${x1}" y2="${y1 + t}"/><line x1="${x2}" y1="${y2 - t}" x2="${x2}" y2="${y2 + t}"/>`
    : `<line x1="${x1 - t}" y1="${y1}" x2="${x1 + t}" y2="${y1}"/><line x1="${x2 - t}" y1="${y2}" x2="${x2 + t}" y2="${y2}"/>`;
  const tx = h ? mx : mx + (lado === 'izq' ? -5 : 5), ty = h ? (lado === 'abajo' ? my + 11 : my - 4) : my;
  const rot = h ? '' : ` transform="rotate(-90 ${tx} ${ty})"`;
  return `<g class="cota"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${topes}<text x="${tx}" y="${ty}"${rot} text-anchor="middle">${esc(texto)}</text></g>`;
}

// Vista frontal de un mueble con cotas (ancho total, alto total, zócalo, ancho de columnas y alto de frentes).
export function svgFrente(m) {
  const W = +m.ancho, H = +m.alto, Z = m.tipo === 'aereo' ? 0 : (+m.zocalo || 0), T = tablero(m);
  const cs = celdas(m);
  const mL = 46, mR = 30, mT = 30, mB = 34; // márgenes para las cotas
  const X = (x) => mL + x, Y = (y) => mT + (H - y); // y del modelo (desde el piso) → y de pantalla
  const cols = [...new Set(cs.map((c) => c.col))].map((ci) => { const cc = cs.filter((c) => c.col === ci).sort((a, b) => b.y0 - a.y0); return { ci, x0: cc[0].x0, x1: cc[0].x1, cc }; }).sort((a, b) => a.x0 - b.x0);
  let s = '';
  // cuerpo y zócalo
  s += `<rect class="pieza" x="${X(0)}" y="${Y(H)}" width="${W}" height="${H - Z}"/>`;
  if (Z > 0) s += `<rect class="zocalo" x="${X(0)}" y="${Y(Z)}" width="${W}" height="${Z}"/>`;
  // divisiones verticales entre columnas
  for (let i = 0; i < cols.length - 1; i++) s += `<line class="div" x1="${X(cols[i].x1)}" y1="${Y(H)}" x2="${X(cols[i].x1)}" y2="${Y(Z)}"/>`;
  // frentes: contorno, división horizontal y etiqueta
  for (const c of cs) {
    s += `<rect class="frente" x="${X(c.x0)}" y="${Y(c.y1)}" width="${c.x1 - c.x0}" height="${c.y1 - c.y0}"/>`;
    const txt = NOMBRE_FRENTE[c.tipo] || 'Frente';
    s += `<text class="et" x="${X((c.x0 + c.x1) / 2)}" y="${Y((c.y0 + c.y1) / 2)}" text-anchor="middle">${esc(txt)}${c.repisas ? ` · ${c.repisas} rep.` : ''}</text>`;
  }
  // cotas: ancho total (arriba), alto total (derecha), columnas (abajo), frentes de la primera columna y zócalo (izq)
  s += cota(X(0), mT - 12, X(W), mT - 12, `${cm(W)} cm`);
  s += cota(X(W) + 14, Y(H), X(W) + 14, Y(0), `${cm(H)} cm`, { lado: 'der' });
  for (const col of cols) s += cota(X(col.x0), Y(0) + 16, X(col.x1), Y(0) + 16, cm(col.x1 - col.x0), { lado: 'abajo' });
  const col0 = cols[0];
  for (const c of col0.cc) s += cota(mL - 14, Y(c.y1), mL - 14, Y(c.y0), cm(c.y1 - c.y0), { lado: 'izq' });
  if (Z > 0) s += cota(mL - 14, Y(Z), mL - 14, Y(0), cm(Z), { lado: 'izq' });
  return `<svg class="plano-svg" viewBox="0 0 ${W + mL + mR} ${H + mT + mB}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

// Vista en planta general: muros del espacio y huella de cada mueble, con el frente marcado y su medida.
export function svgPlanta(modelo) {
  const ms = (modelo.modulos || []).filter((m) => m && !m.artefacto);
  if (!ms.length) return '';
  const W = muros(modelo.espacio), pts = [];
  ms.forEach((m) => huella(m).forEach((p) => pts.push(p)));
  W.forEach((w) => { pts.push(w.a); pts.push(w.b); });
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = 40, Wp = maxX - minX, Hp = maxZ - minZ;
  const X = (x) => pad + (x - minX), Y = (z) => pad + (z - minZ);
  let s = '';
  for (const w of W) s += `<line class="muro" x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(w.b[0])}" y2="${Y(w.b[1])}"/>`;
  for (const m of ms) {
    const h = huella(m).map(([x, z]) => `${X(x)},${Y(z)}`).join(' ');
    s += `<polygon class="mueble" points="${h}"/>`;
    const hh = huella(m); // [atrás-izq, atrás-der, frente-der, frente-izq]
    s += `<line class="frente-m" x1="${X(hh[3][0])}" y1="${Y(hh[3][1])}" x2="${X(hh[2][0])}" y2="${Y(hh[2][1])}"/>`;
    const cx = (hh[0][0] + hh[2][0]) / 2, cz = (hh[0][1] + hh[2][1]) / 2;
    s += `<text class="et" x="${X(cx)}" y="${Y(cz)}" text-anchor="middle">${esc(m.nombre)}</text>`;
    s += `<text class="et chico" x="${X(cx)}" y="${Y(cz) + 11}" text-anchor="middle">${cm(+m.ancho)} × ${cm(fondoTotal(m))} cm</text>`;
  }
  s += cota(X(minX), pad - 14, X(maxX), pad - 14, `${cm(Wp)} cm`);
  s += cota(X(maxX) + 14, Y(minZ), X(maxX) + 14, Y(maxZ), `${cm(Hp)} cm`, { lado: 'der' });
  return `<svg class="plano-svg" viewBox="0 0 ${Wp + 2 * pad} ${Hp + 2 * pad}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

// HTML completo del plano técnico (planta general + un frente por mueble), para la ventana e impresión.
export function planoHTML(modelo, { titulo = 'Plano técnico' } = {}) {
  const ms = (modelo.modulos || []).filter((m) => m && !m.artefacto);
  const planta = svgPlanta(modelo);
  const frentes = ms.map((m) => `<section class="plano-mueble"><h3>${esc(m.nombre)} <small>${cm(+m.ancho)} × ${cm(+m.alto)} × ${cm(fondoTotal(m))} cm</small></h3>${svgFrente(m)}</section>`).join('');
  return `<div class="plano-doc">
    <header class="plano-cab"><h2>${esc(titulo)}</h2><p>${esc(modelo.nombre || '')} · ${ms.length} mueble${ms.length === 1 ? '' : 's'} · medidas en cm</p></header>
    ${planta ? `<section class="plano-mueble"><h3>Planta general</h3>${planta}</section>` : ''}
    ${frentes || '<p class="ed-ayuda">Sin muebles para dibujar.</p>'}</div>`;
}
