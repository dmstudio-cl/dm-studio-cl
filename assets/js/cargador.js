// Cargador de la portada: dibuja el plano del logo, lo llena de rojo según lo que de verdad
// va cargando la página y, al terminar, el logo viaja a la cabecera y aparece el inicio.
const root = document.getElementById('cargador');
if (root) {
  import('animejs').then(iniciar).catch(() => salir());
}

function salir() {
  try { sessionStorage.setItem('dm-cargador', '1'); } catch (e) {}
  document.documentElement.classList.remove('cargando');
  root?.remove();
  window.dispatchEvent(new Event('dm:cargador-fin'));
}

function iniciar({ animate, createTimeline, svg, stagger }) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const t0 = performance.now();

  // Toma el control: quita el respaldo CSS y prepara el dibujo de líneas
  root.style.animation = 'none';
  for (const g of $$('.cg-dib, .cg-marcas, .cg-regla, .cg-textos')) { g.style.animation = 'none'; g.style.opacity = 1; }
  // Las guías punteadas aparecen por opacidad (el trazado progresivo pisaría su punteado)
  const guias = $$('.cg-eje, .cg-guia');
  guias.forEach((g) => { g.style.opacity = 0; });
  const lineas = svg.createDrawable($$('.cg-dib > :not(.cg-eje):not(.cg-guia)'));
  const reglas = svg.createDrawable($$('.cg-regla > line:not(.cg-avance)'));
  animate(lineas, { draw: '0 0', duration: 0 });
  animate(reglas, { draw: '0 0', duration: 0 });

  createTimeline({ defaults: { ease: 'inOutQuart' } })
    .add($('.cg-grilla'), { opacity: [0, .07], duration: 500 }, 0)
    .add(guias, { opacity: [0, .45], duration: 600, delay: stagger(80) }, 100)
    .add(lineas, { draw: ['0 0', '0 1'], duration: 900, delay: stagger(45) }, 0)
    .add(reglas, { draw: ['1 1', '0 1'], duration: 400, delay: stagger(12) }, 250)
    .add($$('.cg-marcas > *'), { scale: [0, 1], duration: 400, delay: stagger(60), ease: 'outBack' }, 500)
    .add($$('.cg-textos > *'), { opacity: [0, 1], duration: 400, delay: stagger(60) }, 650);

  // ----- avance real: DOM, fuentes, modelo 3D y carga completa.
  // Lo mostrado nunca supera lo cargado, y tampoco corre más rápido que el dibujo
  // (tope por tiempo: el relleno parte a los 400 ms y tarda al menos 1,6 s en completarse).
  const pasos = { dom: 15, fuentes: 20, modelo: 35, carga: 30 };
  const hechos = new Set();
  let meta = 0, visto = 0;
  const relleno = $('.cg-relleno'), avance = $('.cg-avance'), pct = $('.cg-pct');
  const pintar = (p) => {
    const d = `${p.toFixed(2)} 100`;
    relleno.setAttribute('stroke-dasharray', d);
    avance.setAttribute('stroke-dasharray', d);
    pct.textContent = String(Math.round(p)).padStart(3, '0') + '%';
  };
  const tick = () => {
    const tope = Math.max(0, (performance.now() - t0 - 400) / 1600 * 100);
    const obj = Math.min(meta, tope, 100);
    visto += (obj - visto) * .14;
    if (obj - visto < .05) visto = obj;
    pintar(visto);
    if (visto >= 100) terminar(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const marcar = (k) => {
    if (hechos.has(k)) return;
    hechos.add(k);
    meta += pasos[k];
  };

  marcar('dom');
  document.fonts?.ready.then(() => marcar('fuentes')) ?? marcar('fuentes');
  if (document.querySelector('[data-css3d][data-ready]') || !document.querySelector('[data-css3d]')) marcar('modelo');
  else document.addEventListener('c3:listo', () => marcar('modelo'), { once: true });
  if (document.readyState === 'complete') marcar('carga');
  else window.addEventListener('load', () => marcar('carga'), { once: true });
  // Si algo se demora demasiado (una imagen lenta), no se deja a nadie esperando
  setTimeout(() => Object.keys(pasos).forEach(marcar), 7000);

  // ----- salida
  let saliendo = false;
  function terminar() {
    if (saliendo) return;
    saliendo = true;

    const logo = $('.cg-logo');
    const marca = document.querySelector('.site-header .brand img');
    // El círculo del logo ocupa 912/1000 del svg; la imagen de la cabecera lo dibuja a ~96 %.
    const a = logo.getBoundingClientRect();
    const b = marca?.getBoundingClientRect();
    // Con "reducir movimiento" activado en el sistema, el logo se desvanece en vez de volar.
    const calma = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vuelo = b && b.width && !calma ? {
      x: (b.left + b.width / 2) - (a.left + a.width / 2),
      y: (b.top + b.height / 2) - (a.top + a.height / 2),
      s: (b.width * .96) / (a.width * .912),
    } : null;

    const tl = createTimeline({ defaults: { ease: 'inOutQuart' }, onComplete: fin });
    tl.add($('.cg-firma-llena'), { opacity: [0, 1], duration: 250 }, 0)
      .add($$('.cg-dib > *, .cg-marcas, .cg-regla, .cg-textos, .cg-grilla'), { opacity: 0, duration: 450, delay: stagger(25, { from: 'last' }) }, 150)
      .add($('.cg-pie'), { opacity: 0, duration: 300 }, 150);
    if (vuelo) {
      tl.add(logo, { x: vuelo.x, y: vuelo.y, scale: vuelo.s, duration: 1000, ease: 'inOutExpo' }, 550)
        .add(root, { backgroundColor: 'rgba(247,245,241,0)', duration: 700 }, 750)
        .add(marca, { opacity: [0, 1], duration: 200 }, 1450)
        .add(logo, { opacity: 0, duration: 200 }, 1500);
    } else {
      tl.add(root, { opacity: 0, duration: 600 }, 550);
      if (marca) tl.add(marca, { opacity: [0, 1], duration: 400 }, 700);
    }
    // Entrada del inicio: el texto sube en cascada
    const copia = document.querySelectorAll('.hero-copy > *');
    if (copia.length) tl.add(copia, { opacity: [0, 1], y: [24, 0], duration: 800, delay: stagger(70), ease: 'outQuart' }, 900);
  }
  function fin() {
    document.querySelectorAll('.hero-copy > *').forEach((el) => { el.style.removeProperty('transform'); el.style.removeProperty('opacity'); });
    salir();
  }
}
