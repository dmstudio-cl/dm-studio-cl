// Motor CSS 3D mínimo para muebles: cajas (tableros) y prismas (patas) hechos con <div>.
// Sin WebGL: el navegador compone las caras como capas, así que funciona fluido incluso
// en equipos que no dibujan 3D con la tarjeta gráfica.
//
// Convenciones:
// - 1 em = 1 cm. El tamaño en pantalla se ajusta cambiando el font-size del rig.
// - Coordenadas del mueble: x a la derecha, y hacia arriba, z hacia el espectador (cm).
// - Luz fija respecto al espectador: al girar se recalcula el sombreado de cada cara
//   (solo cambia la opacidad de una capa negra → no repinta texturas).

const STYLE = `
.c3 { position: relative; width: 100%; height: 100%; perspective: 1800px; overflow: hidden; touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; outline: none; }
.c3.dragging { cursor: grabbing; }
.c3-rig, .c3-rig * { position: absolute; left: 50%; top: 50%; transform-style: preserve-3d; }
.c3-rig > * { left: 0; top: 0; transform-origin: 0 0; } /* cada cara se centra con translate(-50%,-50%) y gira sobre su centro */
.c3-f { backface-visibility: hidden; -webkit-backface-visibility: hidden; background-repeat: repeat; box-shadow: inset 0 0 0 .08em rgba(255,236,214,.13); /* canto levemente iluminado, como el borde redondeado */ }
.c3-f > i { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; }
.c3-floor { backface-visibility: hidden; border-radius: 50%; }
.c3-g > * { left: 0; top: 0; transform-origin: 0 0; } /* grupos (p. ej. un tirador girado): sus caras se ubican igual que en el rig */
`;
let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style'); s.textContent = STYLE; document.head.append(s);
}

// ----- matemática mínima (coordenadas CSS: y hacia abajo)
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const rad = (d) => d * Math.PI / 180;

export function createStage(el, { rx = -22, ry = -38, minRx = -40, maxRx = -4, light = [-.45, -.8, .55], ambient = .68, diffuse = .45, autorotate = false } = {}) {
  injectStyle();
  el.classList.add('c3');
  el.tabIndex = 0;
  const rig = document.createElement('div');
  rig.className = 'c3-rig';
  el.prepend(rig);

  const faces = []; // { el, shade, n }
  const L = norm(light);
  let center = [0, 0, 0], fitCm = 200;

  // Cara rectangular: centro (cx,cy,cz) en cm de mundo, tamaño w×h, orientación por rotaciones CSS,
  // normal n en coordenadas CSS (y hacia abajo), fondo (textura) y recorte opcional (trapecio de las patas).
  // ref: etiqueta opcional (data-ref) para saber a qué pieza pertenece la cara al hacer clic.
  function face(parent, { w, h, at, rot = '', n, bg, size, clip, ref }) {
    const f = document.createElement('div');
    f.className = 'c3-f';
    if (ref) f.dataset.ref = ref;
    f.style.width = w + 'em'; f.style.height = h + 'em';
    f.style.transform = `translate3d(${at[0]}em, ${at[1]}em, ${at[2]}em) ${rot} translate(-50%, -50%)`;
    if (bg) { f.style.background = bg; if (size) f.style.backgroundSize = size; }
    if (clip) f.style.clipPath = clip;
    const shade = document.createElement('i');
    f.append(shade);
    parent.append(f);
    faces.push({ el: f, shade, n });
    return f;
  }

  // Caja centrada en (x,y,z) con medidas w×h×d (cm, y hacia arriba).
  // tex(caraNombre, ancho, alto) → { bg, size } para cada cara.
  // parent/nrot: uso interno de group() (contenedor girado y cómo rotar las normales).
  // caras: lista opcional de caras a dibujar (p. ej. ['front','top'] para un muro de casa de muñecas).
  function box({ w, h, d, x = 0, y = 0, z = 0, tex, ref, parent = rig, nrot = (n) => n, caras = null }) {
    const cy = -y; // a coordenadas CSS
    const T = (k, fw, fh) => (typeof tex === 'function' ? tex(k, fw, fh) : tex) || {};
    const add = (k, fw, fh, at, rot, n) => {
      if (caras && !caras.includes(k)) return;
      const t = T(k, fw, fh); face(parent, { w: fw, h: fh, at, rot, n: nrot(n), bg: t.bg, size: t.size, ref });
    };
    add('front', w, h, [x, cy, z + d / 2], '', [0, 0, 1]);
    add('back', w, h, [x, cy, z - d / 2], 'rotateY(180deg)', [0, 0, -1]);
    add('right', d, h, [x + w / 2, cy, z], 'rotateY(90deg)', [1, 0, 0]);
    add('left', d, h, [x - w / 2, cy, z], 'rotateY(-90deg)', [-1, 0, 0]);
    add('top', w, d, [x, cy - h / 2, z], 'rotateX(90deg)', [0, -1, 0]);
    add('bottom', w, d, [x, cy + h / 2, z], 'rotateX(-90deg)', [0, 1, 0]);
  }

  // Grupo con origen propio: sus cajas usan coordenadas locales (origen del grupo = 0,0,0).
  // ry gira en planta (grados, igual que rotation.y de Three.js: con 90 el frente +z mira a +x);
  // rz gira en el plano del frente (antihorario). Los grupos se pueden anidar (mueble → tirador).
  function group({ x = 0, y = 0, z = 0, ry = 0, rz = 0, parent = rig, nrot = (n) => n } = {}) {
    const g = document.createElement('div');
    g.className = 'c3-g';
    g.style.transform = `translate3d(${x}em, ${-y}em, ${z}em) rotateY(${ry}deg) rotateZ(${-rz}deg)`;
    parent.append(g);
    const az = rad(-rz), cz = Math.cos(az), sz = Math.sin(az), ay = rad(ry);
    // Normal local → del padre: primero rotateZ y luego rotateY (orden de la transformación CSS)
    const local = ([nx, ny, nz]) => rotY([nx * cz - ny * sz, nx * sz + ny * cz, nz], ay);
    const nr = (n) => nrot(local(n));
    return { el: g, box: (o) => box({ ...o, parent: g, nrot: nr }), group: (o) => group({ ...o, parent: g, nrot: nr }) };
  }

  // Prisma vertical de "sides" caras, más ancho arriba (r1) que abajo (r2): patas cónicas.
  function prism({ r1, r2, h, x = 0, y = 0, z = 0, sides = 8, bg, ref }) {
    const rMid = (r1 + r2) / 2;
    const side = 2 * rMid * Math.tan(Math.PI / sides) * 1.04; // leve solape para que no se vean rendijas
    const k = Math.min(1, r2 / r1) * 100;
    const inset = ((100 - k) / 2).toFixed(1);
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const n = [Math.sin(a), 0, Math.cos(a)];
      face(rig, {
        w: side * (r1 / rMid), h,
        at: [x + n[0] * rMid, -y, z + n[2] * rMid],
        rot: `rotateY(${(a * 180 / Math.PI).toFixed(2)}deg)`,
        n, bg, ref, clip: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`,
      });
    }
  }

  // Sombra de contacto: plano en el piso con degradado difuso (no recibe sombreado).
  function floorShadow({ w, d, y = 0, x = 0, z = 0, opacity = .55 }) {
    const f = document.createElement('div');
    f.className = 'c3-floor';
    f.style.width = w + 'em'; f.style.height = d + 'em';
    f.style.background = `radial-gradient(closest-side, rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity * .55}) 55%, transparent)`;
    f.style.transform = `translate3d(${x}em, ${-y + .05}em, ${z}em) rotateX(90deg) translate(-50%, -50%)`;
    rig.append(f);
  }

  // ----- vista
  let locked = false, ortho = false;
  let rx0 = rx, ry0 = ry, curX = rx, curY = ry, tgtX = rx, tgtY = ry, frame = 0, spinning = autorotate;
  // Giro extra que se suma al del arrastre (p. ej. el que entrega el scroll).
  let extX = 0, extY = 0;
  const angX = () => Math.max(minRx, Math.min(maxRx, curX + extX));
  const angY = () => curY + extY;

  function shadeAll() {
    const ax = rad(angX()), ay = rad(angY());
    for (const f of faces) {
      const n = rotX(rotY(f.n, ay), ax);
      if (n[2] < -0.02) continue; // de espaldas: el navegador no la dibuja
      const lambert = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); // L apunta hacia la luz
      const b = Math.min(1, ambient + diffuse * lambert);
      const o = (1 - b).toFixed(3);
      if (f.o !== o) { f.shade.style.opacity = o; f.o = o; }
    }
  }
  const alAplicar = []; // avisos cuando cambia la vista (p. ej. para reubicar pines en pantalla)
  function apply() {
    rig.style.transform = `rotateX(${angX()}deg) rotateY(${angY()}deg) translate3d(${-center[0]}em, ${center[1]}em, ${-center[2]}em)`;
    shadeAll();
    for (const fn of alAplicar) fn();
  }
  function loop() {
    frame = 0;
    if (spinning) tgtY += .12;
    curX += (tgtX - curX) * .2; curY += (tgtY - curY) * .2;
    if (Math.abs(tgtX - curX) < .01 && Math.abs(tgtY - curY) < .01) { curX = tgtX; curY = tgtY; }
    apply();
    if (spinning || curX !== tgtX || curY !== tgtY) frame = requestAnimationFrame(loop);
  }
  const request = () => { if (!frame && visible) frame = requestAnimationFrame(loop); };

  // ----- tamaño: el mueble ocupa ~fill del lado menor del visor
  let fill = .9;
  function resize() {
    const s = Math.min(el.clientWidth, el.clientHeight || el.clientWidth) || 400;
    rig.style.fontSize = (s * fill / fitCm).toFixed(3) + 'px';
    el.style.perspective = ortho ? 'none' : (s * 2.6).toFixed(0) + 'px';
  }
  new ResizeObserver(resize).observe(el);

  // ----- interacción: horizontal gira; vertical inclina poco (y deja hacer scroll en táctil)
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || locked) return;
    drag = { x: e.clientX, y: e.clientY, rx: tgtX, ry: tgtY, id: e.pointerId, mouse: e.pointerType === 'mouse' };
    spinning = false; hideHint();
    if (drag.mouse) el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    tgtY = drag.ry + (e.clientX - drag.x) * .4;
    if (drag.mouse) tgtX = Math.max(minRx, Math.min(maxRx, drag.rx - (e.clientY - drag.y) * .25));
    request();
  });
  const end = () => { drag = null; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: -15, ArrowRight: 15 }[e.key]; if (!k || locked) return;
    e.preventDefault(); spinning = false; hideHint(); tgtY += k; request();
  });
  const hint = el.querySelector('.viewer-hint');
  const hideHint = () => { if (hint) hint.style.opacity = '0'; };

  // Solo anima mientras está en pantalla
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) request(); }).observe(el);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) spinning = false;

  return {
    box, prism, floorShadow, group, rig,
    // Borra todas las piezas (para reconstruir el modelo tras un cambio en el editor).
    clear() { rig.replaceChildren(); faces.length = 0; },
    // Bloquea el giro con el mouse/teclado (vistas fijas del editor).
    lock(on) { locked = !!on; },
    // Límites de inclinación vertical (grados).
    limits(min, max) { minRx = min; maxRx = max; },
    // Vista ortogonal (sin perspectiva): el frente se ve como un plano a escala.
    ortho(on) { ortho = !!on; resize(); },
    // Escala actual en píxeles por centímetro y centro encuadrado (cm).
    get scale() { return parseFloat(rig.style.fontSize) || 1; },
    get center() { return center; },
    get angles() { return [angX(), angY()]; },
    onApply(fn) { alAplicar.push(fn); },
    // Matriz de proyección del espacio del rig (px CSS, y hacia abajo) a la pantalla, relativa al
    // centro del escenario. Incluye la perspectiva del escenario (salvo en vista ortogonal).
    proyeccion() {
      let M = new DOMMatrix(getComputedStyle(rig).transform === 'none' ? undefined : getComputedStyle(rig).transform);
      const P = parseFloat(el.style.perspective);
      if (!ortho && P > 0) { const per = new DOMMatrix(); per.m34 = -1 / P; M = per.multiply(M); }
      return M;
    },
    get el() { return el; },
    get faceCount() { return faces.length; },
    // Centro del mueble (cm, y hacia arriba) y tamaño de referencia para encuadrar.
    frame(c, size, f = fill) {
      center = c; fitCm = size; fill = f; resize(); apply(); request();
      el.dataset.ready = '';
      el.dispatchEvent(new CustomEvent('c3:listo', { bubbles: true }));
    },
    view(x, y) { tgtX = x; tgtY = y; request(); },
    // Giro adicional en grados (se suma al del arrastre). Se aplica de inmediato:
    // pensado para llamarse desde otro bucle de animación (scroll con Anime.js).
    offset(y = 0, x = 0) { extX = x; extY = y; apply(); },
    // Detiene o reanuda el giro automático.
    spin(on) { spinning = !!on && !matchMedia('(prefers-reduced-motion: reduce)').matches; if (spinning) request(); },
    // Fija el ángulo sin animación (útil para capturas y mediciones).
    set(x, y) { curX = tgtX = x; curY = tgtY = y; spinning = false; apply(); },
    reset() { tgtX = rx0; tgtY = ry0; request(); },
  };
}
