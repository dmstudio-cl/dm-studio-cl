// Portada: matero de 3 apoyos (pieza torneada de DM Studio), mitad modelo CSS 3D y mitad plano técnico.
// Como es un sólido de revolución, su silueta de frente es la misma al girarlo: la mitad izquierda es
// el modelo 3D (recortado en el eje) y la derecha es su perfil dibujado en SVG a la misma escala.
// Mouse: una línea de medición sigue la altura del cursor y da el diámetro en ese punto; el modelo
// se orienta un poco hacia el cursor. Scroll (Anime.js): la tapa se levanta y el matero gira.
import { createStage } from './engine.js';
import { animate, onScroll, stagger } from 'animejs';

// ----- Medidas (cm). [PENDIENTE] Estimadas desde la foto con 24 cm de alto total: cambiar por las reales.
const BASE = [[0, 2.9], [1.4, 2.95], [2.4, 3.15], [3.2, 3.55], [3.85, 4.2], [4.25, 5.0], [4.43, 6.1], [4.4, 7.2], [4.2, 8.4]]; // madera rojiza
const CUERPO = [[4.2, 8.4], [4.02, 10.8], [3.8, 13.4], [3.55, 16.0], [3.3, 18.6], [3.1, 20.8], [2.98, 22.25]]; // madera clara
const TAPA = [[0, 22.3], [2.9, 22.3], [3.06, 22.45], [3.12, 22.9], [3.1, 23.5], [3.0, 23.85], [2.75, 24.05], [1.5, 24.16], [0, 24.18]]; // tallada
const PATA = { alto: 3.6, radio: 3.0, y: 3.45, abre: 19, angulos: [60, 180, 300] }; // 3 apoyos a 120°, abiertos 19°
const PATA_PERFIL = [[0, -3.6], [.3, -3.6], [.36, -3.3], [.55, -1.8], [.78, 0], [.6, .45]];
const PICO = { y: 21.55, x: -2.98, giro: 60, perfil: [[0, -.2], [.62, -.2], [.66, .15], [.5, .5], [.28, .72], [0, .8]] };
const OJO = { y: 20.65, angulo: -18, r: .42 };
const ALTO = TAPA.at(-1)[1], RX = -6, CY = 12.1, LADOS = 32;
const PERFIL = [...BASE, ...CUERPO.slice(1), ...TAPA.slice(1).filter(([, y]) => y > 22.3)]; // silueta de afuera

// Radio de la silueta a una altura (interpolado en el perfil).
function radioEn(y) {
  for (let i = 0; i < PERFIL.length - 1; i++) {
    const [ra, ya] = PERFIL[i], [rb, yb] = PERFIL[i + 1];
    if (y >= ya && y <= yb && yb > ya) return ra + (rb - ra) * (y - ya) / (yb - ya);
  }
  return 0;
}

// ----- Veta procedural para madera torneada: vetas verticales onduladas, nudos y (tapa) golpes de gubia.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const TH = 25; // la textura cubre una vuelta × 25 cm de alto
function madera(key, { base, dark, light, acento, seed, nudos = 0, gubia = false }) {
  const v = `--mt-${key}`;
  if (document.documentElement.style.getPropertyValue(v)) return `var(${v})`;
  const rand = rng(seed), W = 512, H = 640;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H }), c = cv.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { // bandas anchas
    const x = rand() * W, w = 20 + rand() * 70, g = c.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'transparent'); g.addColorStop(.5, rand() > .45 ? light : dark); g.addColorStop(1, 'transparent');
    c.globalAlpha = .2 + rand() * .3; c.fillStyle = g; c.fillRect(x - w, 0, w * 2, H);
  }
  for (let i = 0; i < 110; i++) { // vetas finas y largas
    const x0 = rand() * W, amp = 3 + rand() * 16, f = (1 + rand() * 2.5) * Math.PI * 2 / H, ph = rand() * 6.3;
    c.beginPath();
    for (let y = -10; y <= H + 10; y += 8) { const x = x0 + Math.sin(y * f + ph) * amp + Math.sin(y * f * 2.7 + ph) * amp * .3; y < 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.strokeStyle = rand() > .65 && acento ? acento : dark; c.globalAlpha = .08 + rand() * .36; c.lineWidth = .5 + rand() * 2.4; c.stroke();
  }
  for (let i = 0; i < nudos; i++) { // nudos y manchas oscuras
    const x = rand() * W, y = rand() * H, r = 4 + rand() * 9;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, '#3a2412'); g.addColorStop(.55, '#5a3a1a'); g.addColorStop(1, 'transparent');
    c.globalAlpha = .75; c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * .7, r * 1.6, 0, 0, 7); c.fill();
  }
  if (gubia) for (let i = 0; i < 520; i++) { // golpes de gubia (tapa tallada)
    const x = rand() * W, y = rand() * H, r = 7 + rand() * 9, g = c.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,215,185,.22)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,5,0,.35)');
    c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  c.globalAlpha = .08;
  for (let i = 0; i < 2600; i++) { c.fillStyle = rand() > .5 ? dark : light; c.fillRect(rand() * W, rand() * H, .7, 1 + rand() * 4); }
  document.documentElement.style.setProperty(v, `url(${cv.toDataURL('image/jpeg', .86)})`);
  return `var(${v})`;
}
// Fondo de cada cara: la textura da una vuelta completa en cada anillo (ancho = su circunferencia),
// así la veta sigue el mismo ángulo de un anillo al otro, y a lo alto continúa según la altura.
const vetaDe = (img, lados) => ({ i, W, yArriba }) => `${img} ${(-(i * W) + .0).toFixed(3)}em ${(-(TH - yArriba)).toFixed(3)}em / ${(W * lados).toFixed(3)}em ${TH}em`;

export function mountMatero(el) {
  const root = el.closest('[data-matero]') || el.parentElement;
  const st = createStage(el, { rx: RX, ry: 0, minRx: RX, maxRx: RX, light: [-.6, -.5, .62], ambient: .58, diffuse: .58 });
  st.ortho(true);
  const clara = madera('clara', { base: '#d6ad62', dark: '#9c5420', light: '#f1d9a0', acento: '#c8691f', seed: 7, nudos: 3 });
  const rojiza = madera('rojiza', { base: '#6d2a18', dark: '#3b130a', light: '#93432a', acento: '#a5552e', seed: 13 });
  const tallada = madera('tallada', { base: '#6a2717', dark: '#3a1209', light: '#8c3b25', seed: 21, gubia: true });

  st.floorShadow({ w: 13, d: 13, opacity: .55 });
  st.lathe({ perfil: BASE, lados: LADOS, tex: vetaDe(rojiza, LADOS) });
  st.lathe({ perfil: CUERPO, lados: LADOS, tex: vetaDe(clara, LADOS) });
  const tapa = st.group({});
  tapa.lathe({ perfil: TAPA, lados: LADOS, tex: vetaDe(tallada, LADOS) });
  for (const a of PATA.angulos) {
    const r = a * Math.PI / 180;
    // +0,05°: Chrome no dibuja un grupo girado justo 90°
    st.group({ x: Math.sin(r) * PATA.radio, y: PATA.y, z: Math.cos(r) * PATA.radio, ry: a - 90 + .05, rz: PATA.abre }).lathe({ perfil: PATA_PERFIL, lados: 10, tex: vetaDe(rojiza, 10) });
  }
  st.group({ x: PICO.x, y: PICO.y, rz: PICO.giro }).lathe({ perfil: PICO.perfil, lados: 12, tex: vetaDe(clara, 12) });
  const zOjo = radioEn(OJO.y) + .02;
  st.group({ ry: OJO.angulo }).box({ w: OJO.r * 2.1, h: OJO.r * 2.1, d: .02, y: OJO.y, z: zOjo, caras: ['front'], emisiva: true, tex: { bg: 'radial-gradient(circle at 42% 40%, #6b3a20 0, #3a1a0c 52%, #2a1007 64%, transparent 67%)' } });

  // ----- capas 2D: brillo (sobre la mitad 3D) y plano técnico (mitad derecha)
  const NS = 'http://www.w3.org/2000/svg';
  const brillo = root.querySelector('.matero-brillo'), plano = root.querySelector('.matero-plano');
  let W = 0, H = 0, s = 1, lift = 0, primera = true;
  const cosT = Math.cos(RX * Math.PI / 180);
  const X = (r) => W / 2 + r * s, Y = (y) => H / 2 - (y - CY) * cosT * s;
  const mm = (cm) => Math.round(cm * 10);
  const f1 = (n) => n.toFixed(1);

  function dibujarBrillo() {
    const tramo = (pts, extra = '') => pts.slice(0, -1).map(([ra, ya], i) => {
      const [rb, yb] = pts[i + 1]; if (Math.max(ra, rb) < .05) return '';
      return `<polygon points="${f1(X(-ra))},${f1(Y(ya))} ${f1(X(-rb))},${f1(Y(yb))} ${f1(W / 2)},${f1(Y(yb))} ${f1(W / 2)},${f1(Y(ya))}" ${extra}/>`;
    }).join('');
    brillo.setAttribute('viewBox', `0 0 ${W} ${H}`);
    brillo.innerHTML = `<defs><linearGradient id="mt-brillo">
        <stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".1" stop-color="#000" stop-opacity=".16"/>
        <stop offset=".3" stop-color="#fff3df" stop-opacity="0"/><stop offset=".42" stop-color="#fff3df" stop-opacity=".2"/>
        <stop offset=".52" stop-color="#fff3df" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient></defs>
      <g fill="url(#mt-brillo)" shape-rendering="crispEdges">${tramo([...BASE, ...CUERPO.slice(1)])}<g class="mt-tapa">${tramo(TAPA.filter(([, y]) => y > 22.3))}</g></g>`;
  }

  // Cota con trazos oblicuos en los extremos (estilo arquitectura).
  const tic = (x, y, k = 4) => `M${f1(x - k)} ${f1(y + k)}L${f1(x + k)} ${f1(y - k)}`;
  function dibujarPlano() {
    plano.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pts = (arr) => arr.map(([r, y]) => `${f1(X(r))},${f1(Y(y))}`).join(' ');
    const cuerpoR = [...BASE, ...CUERPO.slice(1)];
    // pata derecha (a 60°): eje proyectado y contorno
    const a = PATA.angulos[0] * Math.PI / 180, ab = PATA.abre * Math.PI / 180;
    const pTop = [PATA.radio * Math.sin(a), PATA.y], pTip = [(PATA.radio + PATA.alto * Math.sin(ab)) * Math.sin(a), PATA.y - PATA.alto * Math.cos(ab)];
    const nx = Math.cos(ab), ny = Math.sin(ab); // normal al eje de la pata (en el dibujo)
    const pata = [[pTop[0] - nx * .78, pTop[1] - ny * .78], [pTop[0] + nx * .78, pTop[1] + ny * .78], [pTip[0] + nx * .32, pTip[1] + ny * .32], [pTip[0] - nx * .32, pTip[1] - ny * .32]];
    const pataTrasera = [[0, PATA.y], [.78, PATA.y], [.32, PATA.y - PATA.alto * Math.cos(ab)], [0, PATA.y - PATA.alto * Math.cos(ab)]];
    // cavidad (línea oculta): pared de 6 mm
    const cav = CUERPO.filter(([, y]) => y >= 9.4).map(([r, y]) => [Math.max(.5, r - .6), y]);
    const xc = X(5.7), xt = X(7.1); // cadena de cotas y cota total
    const niveles = [0, 2.9, 8.4, 22.3, ALTO];
    const cadena = niveles.slice(0, -1).map((y0, i) => {
      const y1 = niveles[i + 1], enTapa = i === 3;
      const d = `M${f1(xc)} ${f1(Y(y0))}V${f1(Y(y1))}${tic(xc, Y(y0))}${tic(xc, Y(y1))}`;
      return `<g${enTapa ? ' class="mt-tapa"' : ''}><path class="pl-cota" d="${d}"/><text class="pl-num" x="${f1(xc + 8)}" y="${f1((Y(y0) + Y(y1)) / 2 + 4)}">${mm(y1 - y0)}</text></g>`;
    }).join('');
    const ext = niveles.map((y) => { const r = y === 0 ? pTip[0] + .3 : y === 2.9 ? 1.6 : radioEn(y); return `<path class="pl-ext${y >= 22.3 ? ' mt-tapa-ext' : ''}" d="M${f1(X(r) + 4)} ${f1(Y(y))}H${f1(xt + 6)}"/>`; }).join('');
    const diam = (y, r, txt, cls = '') => `<g class="${cls}"><path class="pl-cota" d="M${f1(W / 2)} ${f1(Y(y))}H${f1(X(r))}${tic(X(r), Y(y), 3.5)}"/><text class="pl-num" x="${f1(X(r) + 7)}" y="${f1(Y(y) - 5)}">${txt}</text></g>`;
    // planta (vista superior): arriba a la derecha; las patas giran con el modelo
    const pc = [W * .83, H * .13], pr = Math.min(W * .085, 60), k = pr / 4.43;
    plano.innerHTML = `
      <g class="pl-eje"><path d="M${f1(W / 2)} ${f1(Y(ALTO + 1.8))}V${f1(Y(-1.2))}"/></g>
      <g class="pl-linea">
        <polyline points="${pts([[0, 2.9], ...cuerpoR.slice(1)])}"/>
        <path d="M${f1(W / 2)} ${f1(Y(8.4))}H${f1(X(4.2))}"/>
        <polygon points="${pts(pata)}"/>
        <polyline points="${pts(pataTrasera)}"/>
        <g class="mt-tapa"><polyline points="${pts(TAPA.slice(1))}"/><path d="M${f1(W / 2)} ${f1(Y(22.3))}H${f1(X(2.9))}"/></g>
      </g>
      <g class="pl-oculta"><polyline points="${pts([[0, 9.4], ...cav, [0, cav.at(-1)[1]]])}"/></g>
      <g class="pl-cotas">
        ${ext}${cadena}
        <g><path class="pl-cota" d="M${f1(xt)} ${f1(Y(0))}V${f1(Y(ALTO))}${tic(xt, Y(0))}${tic(xt, Y(ALTO))}"/><text class="pl-num pl-total" x="${f1(xt + 8)}" y="${f1(Y(ALTO / 2) + 4)}">${mm(ALTO)}</text></g>
        ${diam(23.3, radioEn(23.3), `Ø${mm(2 * radioEn(23.3))}`, 'mt-tapa')}
        ${diam(19.5, radioEn(19.5), `Ø${mm(2 * radioEn(19.5))}`)}
        ${diam(8.4, 4.2, `Ø${mm(8.4)}`)}
        ${diam(6.1, 4.43, `Ø${mm(8.86)}`)}
        <path class="pl-cota" d="M${f1(X(pTip[0]))} ${f1(Y(-.6))}V${f1(Y(pTip[1]) + 3)}M${f1(W / 2)} ${f1(Y(-.6))}H${f1(X(pTip[0]))}${tic(X(pTip[0]), Y(-.6), 3.5)}"/>
        <text class="pl-num" x="${f1(X(pTip[0]) + 7)}" y="${f1(Y(-.6) + 4)}">${mm(pTip[0])}</text>
        <path class="pl-cota" d="M${f1(X(pTop[0]))} ${f1(Y(pTop[1]))}L${f1(X(pTop[0]))} ${f1(Y(pTop[1] - 2.6))}"/>
        <path class="pl-cota" d="M${f1(X(pTop[0]) + Math.sin(ab) * 2.1 * s)} ${f1(Y(pTop[1]) + Math.cos(ab) * 2.1 * s)}A${f1(2.1 * s)} ${f1(2.1 * s)} 0 0 1 ${f1(X(pTop[0]))} ${f1(Y(pTop[1]) + 2.1 * s)}"/>
        <text class="pl-num pl-chico" x="${f1(X(pTop[0]) + 5)}" y="${f1(Y(pTop[1]) + 2.6 * s + 9)}">${PATA.abre}°</text>
      </g>
      <g class="pl-ojo"><circle r="${f1(OJO.r * s)}"/><path d="M${f1(-OJO.r * s * 2.2)} 0H${f1(OJO.r * s * 2.2)}M0 ${f1(-OJO.r * s * 2.2)}V${f1(OJO.r * s * 2.2)}"/><text class="pl-num pl-chico" y="${f1(OJO.r * s * 2.2 + 11)}" text-anchor="middle">tarugo Ø${mm(OJO.r * 2)}</text></g>
      <g class="pl-planta" transform="translate(${f1(pc[0])} ${f1(pc[1])})">
        <circle class="pl-l" r="${f1(pr)}"/><circle class="pl-o" r="${f1(3.1 * k)}"/>
        <path class="pl-eje2" d="M${f1(-pr - 10)} 0H${f1(pr + 10)}M0 ${f1(-pr - 10)}V${f1(pr + 10)}"/>
        <g class="pl-patas">${PATA.angulos.map((g) => { const r = g * Math.PI / 180, R = (PATA.radio + PATA.alto * Math.sin(ab)) * k; return `<circle r="${f1(.4 * k + 1)}" cx="${f1(Math.sin(r) * R)}" cy="${f1(Math.cos(r) * R)}"/><path d="M0 0L${f1(Math.sin(r) * R)} ${f1(Math.cos(r) * R)}"/>`; }).join('')}</g>
        <text class="pl-num pl-chico" y="${f1(pr + 24)}" text-anchor="middle">PLANTA · 3 × 120°</text>
      </g>
      <g class="pl-abre"><path class="pl-cota" d=""/><text class="pl-num pl-acento"></text></g>
      <g class="pl-mide"><path class="pl-guia" d=""/><path class="pl-med" d=""/><text class="pl-num pl-acento pl-d"></text><text class="pl-num pl-h" text-anchor="end"></text></g>`;
    moverTapa(); seguirModelo();
    if (primera) { primera = false; entrar(); }
  }

  // El ojo (marca sobre el modelo 3D) y las patas de la planta siguen el giro del modelo.
  const ojo3d = [Math.sin(OJO.angulo * Math.PI / 180) * zOjo, OJO.y, Math.cos(OJO.angulo * Math.PI / 180) * zOjo];
  function seguirModelo() {
    const g = plano.querySelector('.pl-ojo'); if (!g) return;
    const ay = st.angles[1];
    const P = st.proyeccion(), q = P.transformPoint(new DOMPoint(ojo3d[0] * s, -ojo3d[1] * s, ojo3d[2] * s, 1));
    const x = W / 2 + q.x / q.w, y = H / 2 + q.y / q.w;
    const zr = -ojo3d[0] * Math.sin(ay * Math.PI / 180) + ojo3d[2] * Math.cos(ay * Math.PI / 180);
    g.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
    g.style.opacity = zr > .5 && x < W / 2 - OJO.r * s ? '' : '0';
    plano.querySelector('.pl-patas')?.setAttribute('transform', `rotate(${(-ay).toFixed(1)})`);
  }
  st.onApply(seguirModelo);

  // Tapa levantada (scroll): mueve la tapa 3D, su dibujo y muestra la cota de apertura.
  function moverTapa() {
    tapa.el.style.transform = `translate3d(0, ${-lift}em, 0)`;
    const dy = -lift * cosT * s;
    root.querySelectorAll('.mt-tapa').forEach((g) => g.setAttribute('transform', `translate(0 ${f1(dy)})`));
    const ab = plano.querySelector('.pl-abre'); if (!ab) return;
    ab.style.opacity = lift > .3 ? '' : '0';
    const x = X(4.3), y0 = Y(22.3), y1 = Y(22.3 + lift);
    ab.querySelector('path').setAttribute('d', `M${f1(X(3.2))} ${f1(y1)}H${f1(x + 5)}M${f1(x)} ${f1(y0)}V${f1(y1)}${tic(x, y0, 3)}${tic(x, y1, 3)}`);
    const t = ab.querySelector('text'); t.setAttribute('x', f1(x + 7)); t.setAttribute('y', f1((y0 + y1) / 2 + 4)); t.textContent = `+${mm(lift)}`;
  }

  // Línea de medición que sigue al mouse: diámetro y altura en ese punto.
  function medir(e) {
    const g = plano.querySelector('.pl-mide'); if (!g) return;
    const b = root.getBoundingClientRect(), py = e.clientY - b.top;
    let y = CY - (py - H / 2) / (cosT * s);
    const enTapa = y > 22.3 + lift; if (enTapa) y -= lift; else if (y > 22.3) y = -1;
    if (y < 2.95 || y > ALTO) { g.style.opacity = '0'; return; }
    const r = radioEn(y), yy = py;
    g.style.opacity = '1';
    g.querySelector('.pl-guia').setAttribute('d', `M0 ${f1(yy)}H${f1(W)}`);
    g.querySelector('.pl-med').setAttribute('d', `M${f1(X(-r))} ${f1(yy)}H${f1(X(r))}${tic(X(-r), yy, 3.5)}${tic(X(r), yy, 3.5)}`);
    const d = g.querySelector('.pl-d'); d.setAttribute('x', f1(W / 2 + 8)); d.setAttribute('y', f1(yy - 7)); d.textContent = `Ø ${(r * 20).toFixed(1).replace('.', ',')}`;
    const h = g.querySelector('.pl-h'); h.setAttribute('x', f1(X(-r) - 9)); h.setAttribute('y', f1(yy - 6)); h.textContent = `h ${Math.round(y * 10)}`;
  }
  // El modelo mira un poco hacia el cursor.
  root.addEventListener('pointermove', (e) => {
    medir(e);
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const b = root.getBoundingClientRect();
    st.view(RX, ((e.clientX - b.left) / b.width - .5) * 36);
  });
  root.addEventListener('pointerleave', () => { const g = plano.querySelector('.pl-mide'); if (g) g.style.opacity = '0'; st.view(RX, 0); });

  // Trazado inicial del plano (las líneas se dibujan) y luego las cifras.
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function entrar() {
    if (reducir) return;
    const lineas = [...plano.querySelectorAll('.pl-linea > *, .pl-linea .mt-tapa > *, .pl-cota, .pl-ext, .pl-planta circle')];
    lineas.forEach((p) => { const L = p.getTotalLength?.() || 0; p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = L; });
    animate(lineas, { strokeDashoffset: 0, duration: 1400, delay: stagger(18, { start: 250 }), ease: 'inOutQuad', onComplete: () => lineas.forEach((p) => { p.style.strokeDasharray = ''; }) });
    animate(plano.querySelectorAll('.pl-num, .pl-eje, .pl-oculta'), { opacity: [0, 1], duration: 700, delay: stagger(25, { start: 900 }) });
    animate(root.querySelectorAll('.matero-titulo > *, .matero-leyenda'), { opacity: [0, 1], y: [12, 0], duration: 900, delay: stagger(120, { start: 300 }), ease: 'outQuart' });
  }

  function medidas() {
    W = root.clientWidth; H = root.clientHeight; s = st.scale;
    if (!W || !H) return;
    dibujarBrillo(); dibujarPlano();
  }
  new ResizeObserver(medidas).observe(root);

  // Scroll: mientras la portada sale de pantalla, la tapa se levanta y el matero da un giro.
  const zona = root.closest('section') || root;
  const prog = { p: 0 };
  animate(prog, {
    p: 1, ease: 'linear',
    // la tapa termina de abrirse en el primer 45 % del recorrido (mientras el matero aún se ve)
    onUpdate: () => { const k = Math.min(1, prog.p / .45); lift = 3.8 * (1 - (1 - k) ** 2); moverTapa(); st.offset(150 * prog.p, 0); },
    autoplay: onScroll({ target: zona, enter: 'top top', leave: 'top bottom', sync: .2 }),
  });

  st.frame([0, CY, 0], 26, 1);
  medidas(); // también ahora (ResizeObserver solo avisa cuando la página se dibuja)
  return st;
}
