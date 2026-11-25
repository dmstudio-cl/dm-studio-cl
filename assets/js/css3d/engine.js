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
.c3-f.c3-luz { pointer-events: none; backface-visibility: visible; } /* ilusión de luz: degradado translúcido sin sombra (mix-blend-mode aplanaría el 3D) */
.c3-floor { backface-visibility: hidden; border-radius: 50%; }
.c3-g > * { left: 0; top: 0; transform-origin: 0 0; } /* grupos (p. ej. un tirador girado): sus caras se ubican igual que en el rig */
.c3.c3-pan { touch-action: none; }
.c3-mover { position: absolute; left: 12px; bottom: var(--c3-mover-abajo, 12px); z-index: 5; display: grid; grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(3, 34px); gap: 3px; }
.c3-mover[hidden] { display: none; }
.c3-mover button { font: 15px/1 system-ui, sans-serif; border: 1px solid rgba(236,231,221,.22); border-radius: 8px; background: rgba(11,11,13,.72); color: #ece7dd; cursor: pointer; padding: 0; }
.c3-mover button:hover { background: rgba(60,56,52,.85); }
.c3-mover .c3-centro { font-size: 12px; }
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
  function face(parent, { w, h, at, rot = '', n, bg, size, clip, ref, cara, emisiva }) {
    const f = document.createElement('div');
    f.className = 'c3-f';
    if (ref) f.dataset.ref = ref;
    if (cara) f.dataset.cara = cara; // qué cara de la caja es (front, left…): sirve para extruir una cara
    f.style.width = w + 'em'; f.style.height = h + 'em';
    f.style.transform = `translate3d(${at[0]}em, ${at[1]}em, ${at[2]}em) ${rot} translate(-50%, -50%)`;
    if (bg) { f.style.background = bg; if (size) f.style.backgroundSize = size; }
    if (clip) f.style.clipPath = clip;
    if (emisiva) { f.classList.add('c3-luz'); parent.append(f); return f; } // luz: sin capa de sombra
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
  function box({ w, h, d, x = 0, y = 0, z = 0, tex, ref, parent = rig, nrot = (n) => n, caras = null, emisiva = false }) {
    const cy = -y; // a coordenadas CSS
    const T = (k, fw, fh) => (typeof tex === 'function' ? tex(k, fw, fh) : tex) || {};
    const add = (k, fw, fh, at, rot, n) => {
      if (caras && !caras.includes(k)) return;
      const t = T(k, fw, fh); face(parent, { w: fw, h: fh, at, rot, n: nrot(n), bg: t.bg, size: t.size, clip: t.clip, ref, cara: ref ? k : undefined, emisiva }); // clip: recorte de la cara (ej. bandeja redonda)
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

  // ----- desplazamiento (dueño, 2026-11-25): además de girar, la cámara se mueve por el entorno hasta panMax cm del
  // centro (clic derecho o 2 dedos arrastrando, o las flechas en pantalla). pan = [x, z] en cm, sumado al centro.
  let panMax = 0, pan = [0, 0], tgtPan = [0, 0], pad = null;
  const limitarPan = (p) => { const l = Math.hypot(p[0], p[1]); return l > panMax && l > 0 ? [p[0] * panMax / l, p[1] * panMax / l] : p; };
  // ejes de la pantalla en el piso: derecha y hacia adentro, según el giro actual
  const ejes = () => { const a = rad(angY()); return { der: [Math.cos(a), Math.sin(a)], fon: [Math.sin(a), -Math.cos(a)] }; };
  function moverVista(dDer, dFon, suave = false) { // cm en pantalla: hacia la derecha y hacia el fondo
    if (!panMax) return;
    const { der, fon } = ejes(), b = suave ? tgtPan : pan;
    const p = limitarPan([b[0] + der[0] * dDer + fon[0] * dFon, b[1] + der[1] * dDer + fon[1] * dFon]);
    tgtPan = p; if (!suave) pan = p.slice();
    if (suave) request(); else apply();
  }
  function crearPad() {
    pad = document.createElement('div'); pad.className = 'c3-mover'; pad.hidden = true;
    pad.innerHTML = '<span></span><button type="button" data-m="0,1" title="Avanzar" aria-label="Avanzar">↑</button><span></span>'
      + '<button type="button" data-m="-1,0" title="Mover a la izquierda" aria-label="Mover a la izquierda">←</button><button type="button" class="c3-centro" data-m="c" title="Volver al centro" aria-label="Volver al centro">●</button><button type="button" data-m="1,0" title="Mover a la derecha" aria-label="Mover a la derecha">→</button>'
      + '<span></span><button type="button" data-m="0,-1" title="Retroceder" aria-label="Retroceder">↓</button><span></span>';
    for (const ev of ['pointerdown', 'pointerup', 'click']) pad.addEventListener(ev, (e) => e.stopPropagation()); // no gira ni elige piezas
    pad.addEventListener('click', (e) => {
      const m = e.target.closest('button')?.dataset.m; if (!m) return;
      if (m === 'c') { tgtPan = [0, 0]; request(); return; }
      const [a, b] = m.split(',').map(Number); moverVista(a * 40, b * 40, true);
    });
    el.append(pad);
  }

  // ----- vista
  let locked = false, ortho = false;
  let rx0 = rx, ry0 = ry, curX = rx, curY = ry, tgtX = rx, tgtY = ry, frame = 0, spinning = autorotate;
  // Giro extra que se suma al del arrastre (p. ej. el que entrega el scroll).
  let extX = 0, extY = 0;
  const angX = () => Math.max(minRx, Math.min(maxRx, curX + extX));
  const angY = () => curY + extY;

  let noche = 0;
  function shadeAll() {
    const ax = rad(angX()), ay = rad(angY());
    for (const f of faces) {
      const n = rotX(rotY(f.n, ay), ax);
      if (n[2] < -0.02) continue; // de espaldas: el navegador no la dibuja
      const lambert = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); // L apunta hacia la luz
      const b = Math.min(1, ambient + diffuse * lambert) * (1 - noche); // noche: oscurece todo menos las luces
      const o = (1 - b).toFixed(3);
      if (f.o !== o) { f.shade.style.opacity = o; f.o = o; }
    }
  }
  const alAplicar = []; // avisos cuando cambia la vista (p. ej. para reubicar pines en pantalla)
  function apply() {
    rig.style.transform = `rotateX(${angX()}deg) rotateY(${angY()}deg) translate3d(${-(center[0] + pan[0])}em, ${center[1]}em, ${-(center[2] + pan[1])}em)`;
    shadeAll();
    for (const fn of alAplicar) fn();
  }
  function loop() {
    frame = 0;
    if (spinning) tgtY += .12;
    curX += (tgtX - curX) * .2; curY += (tgtY - curY) * .2;
    if (Math.abs(tgtX - curX) < .01 && Math.abs(tgtY - curY) < .01) { curX = tgtX; curY = tgtY; }
    pan = pan.map((v, i) => v + (tgtPan[i] - v) * .2);
    const panQuieto = Math.abs(tgtPan[0] - pan[0]) < .05 && Math.abs(tgtPan[1] - pan[1]) < .05; if (panQuieto) pan = tgtPan.slice();
    apply();
    if (spinning || curX !== tgtX || curY !== tgtY || !panQuieto) frame = requestAnimationFrame(loop);
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
  const dedos = new Map(); // toques activos (2 dedos = mover la cámara)
  const medio = () => { const p = [...dedos.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };
  el.addEventListener('pointerdown', (e) => {
    if (locked) return;
    if (e.pointerType === 'touch') dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (panMax && e.pointerType === 'touch' && dedos.size === 2) { const c = medio(); drag = { pan: true, x: c.x, y: c.y, dos: true }; return; }
    if (e.button === 2 && panMax) { drag = { pan: true, x: e.clientX, y: e.clientY, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch {} el.classList.add('dragging'); spinning = false; return; }
    if (e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, rx: tgtX, ry: tgtY, id: e.pointerId, mouse: e.pointerType === 'mouse' };
    spinning = false; hideHint();
    if (drag.mouse) el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag?.pan) { // mover: se «toma» el piso y se arrastra (más lento en profundidad según la inclinación)
      const c = drag.dos ? (dedos.size === 2 ? medio() : null) : (e.pointerId === drag.id ? { x: e.clientX, y: e.clientY } : null);
      if (!c) return;
      const s = parseFloat(rig.style.fontSize) || 1, incl = Math.max(.35, Math.sin(Math.abs(rad(angX()))));
      moverVista(-(c.x - drag.x) / s, (c.y - drag.y) / s / incl);
      drag.x = c.x; drag.y = c.y; return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    tgtY = drag.ry + (e.clientX - drag.x) * .4;
    if (drag.mouse) tgtX = Math.max(minRx, Math.min(maxRx, drag.rx - (e.clientY - drag.y) * .25));
    request();
  });
  el.addEventListener('contextmenu', (e) => { if (panMax) e.preventDefault(); });
  const end = (e) => { if (e?.pointerId != null) dedos.delete(e.pointerId); if (drag?.dos && dedos.size === 2) return; drag = null; el.classList.remove('dragging'); };
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
    // Oscurece la escena (0 = día, ~0,6 = noche) para que se luzcan las caras emisivas (luces).
    noche(k = 0) { noche = Math.max(0, Math.min(.85, +k || 0)); for (const f of faces) f.o = null; shadeAll(); },
    reset() { tgtX = rx0; tgtY = ry0; request(); },
    // Desplazamiento por el entorno: radio máximo en cm alrededor del centro (0 = apagado, vuelve al centro y oculta
    // las flechas en pantalla).
    panLimit(cm = 0) {
      panMax = Math.max(0, +cm || 0); el.classList.toggle('c3-pan', panMax > 0);
      if (panMax && !pad) crearPad();
      if (pad) pad.hidden = !panMax;
      if (!panMax) { pan = [0, 0]; tgtPan = [0, 0]; apply(); } else { tgtPan = limitarPan(tgtPan); request(); }
    },
    resetPan() { pan = [0, 0]; tgtPan = [0, 0]; apply(); },
    get pan() { return pan.slice(); },
  };
}
