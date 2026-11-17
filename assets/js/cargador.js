// Cargador de la portada: dibuja el plano del logo, lo llena de rojo según lo que de verdad
// va cargando la página y, al terminar, el logo viaja a la cabecera y aparece el inicio.
//
// Guía rápida de Anime.js (v4) para leer este archivo:
// - animate(objetivos, { propiedad: valor | [desde, hasta], duration, delay, ease })
// - createTimeline().add(objetivos, parámetros, posición): la posición es el milisegundo
//   de la línea de tiempo en que empieza esa animación (todas cuentan desde 0, no en cadena).
// - stagger(ms): reparte un retraso creciente entre varios objetivos (efecto cascada).
// - svg.createDrawable(el): permite animar "draw" = 'inicio fin' del trazo (0 a 1).
// - Los tiempos están en milisegundos.

const root = document.getElementById('cargador'); // contenedor del cargador (_includes/cargador.html)
if (root) {
  // Anime.js se pide al cargar; si el CDN falla, se sale sin animar para no bloquear la página.
  import('animejs').then(iniciar).catch(() => salir());
}

// Limpia todo al terminar: marca la sesión, devuelve el scroll y elimina el cargador.
function salir() {
  try { sessionStorage.setItem('dm-cargador', '1'); } catch (e) {} // no se repite en esta sesión
  document.documentElement.classList.remove('cargando');          // quita el bloqueo de scroll y los ocultos del CSS
  root?.remove();                                                  // saca el cargador del DOM
  window.dispatchEvent(new Event('dm:cargador-fin'));              // aviso para otros scripts
}

function iniciar({ animate, createTimeline, svg, stagger }) {
  const $ = (s) => root.querySelector(s);                // un elemento dentro del cargador
  const $$ = (s) => [...root.querySelectorAll(s)];       // varios elementos dentro del cargador
  const t0 = performance.now();                          // momento de inicio (para el tope de avance)

  // ===== 1. PREPARACIÓN =====
  root.style.animation = 'none'; // anula el respaldo CSS que esconde el cargador a los 6 s
  for (const g of $$('.cg-dib, .cg-marcas, .cg-regla, .cg-textos')) {
    g.style.animation = 'none';  // anula la aparición de respaldo de cada grupo
    g.style.opacity = 1;         // los grupos quedan visibles; sus piezas se animan una a una
  }
  const guias = $$('.cg-eje, .cg-guia');               // ejes y guías punteadas
  guias.forEach((g) => { g.style.opacity = 0; });       // parten ocultas: aparecen por opacidad (el trazado pisaría el punteado)
  const lineas = svg.createDrawable($$('.cg-dib > :not(.cg-eje):not(.cg-guia)')); // círculo, cotas, radio y firma: se "dibujan"
  const reglas = svg.createDrawable($$('.cg-regla > line:not(.cg-avance)'));      // las 41 marcas de la regla
  animate(lineas, { draw: '0 0', duration: 0 }); // trazo vacío (nada dibujado todavía)
  animate(reglas, { draw: '0 0', duration: 0 });

  // ===== 2. ENTRADA: se dibuja el plano =====
  createTimeline({ defaults: { ease: 'inOutQuart' } })                       // curva suave por defecto
    .add($('.cg-grilla'), { opacity: [0, .07], duration: 500 }, 0)          // 0 ms: aparece la grilla de fondo, muy tenue
    .add(guias, { opacity: [0, .45], duration: 600, delay: stagger(80) }, 100) // 100 ms: guías punteadas, una cada 80 ms
    .add(lineas, { draw: ['0 0', '0 1'], duration: 900, delay: stagger(45) }, 0) // 0 ms: cada línea se traza de inicio a fin, una cada 45 ms
    .add(reglas, { draw: ['1 1', '0 1'], duration: 400, delay: stagger(12) }, 250) // 250 ms: marcas de la regla, de abajo hacia arriba
    .add($$('.cg-marcas > *'), { scale: [0, 1], duration: 400, delay: stagger(60), ease: 'outBack' }, 500) // 500 ms: puntos de cota con rebote
    .add($$('.cg-textos > *'), { opacity: [0, 1], duration: 400, delay: stagger(60) }, 650); // 650 ms: textos de cota (Ø 912, R 456…)

  // ===== 3. AVANCE: el círculo se llena de rojo =====
  // Lo mostrado nunca supera lo cargado, y tampoco corre más rápido que el dibujo
  // (tope por tiempo: el relleno parte a los 400 ms y tarda al menos 1,6 s en completarse).
  const pasos = { dom: 15, fuentes: 20, modelo: 35, carga: 30 }; // cuánto suma cada cosa cargada (total 100)
  const hechos = new Set();                                      // pasos ya contados
  let meta = 0, visto = 0;                                       // meta = % cargado real; visto = % que se dibuja
  const relleno = $('.cg-relleno'), avance = $('.cg-avance'), pct = $('.cg-pct');
  const pintar = (p) => {
    const d = `${p.toFixed(2)} 100`;               // trazo de p sobre 100 (pathLength = 100)
    relleno.setAttribute('stroke-dasharray', d);   // sector rojo del círculo (máscara del logo)
    avance.setAttribute('stroke-dasharray', d);    // barra roja sobre la regla
    pct.textContent = String(Math.round(p)).padStart(3, '0') + '%'; // contador "042%"
  };
  const tick = () => {                             // se ejecuta en cada cuadro
    const tope = Math.max(0, (performance.now() - t0 - 400) / 1600 * 100); // máximo permitido por tiempo
    const obj = Math.min(meta, tope, 100);         // objetivo: lo cargado, sin pasar el tope
    visto += (obj - visto) * .14;                  // se acerca un 14 % por cuadro (movimiento suave)
    if (obj - visto < .05) visto = obj;            // evita decimales eternos al final
    pintar(visto);
    if (visto >= 100) terminar(); else requestAnimationFrame(tick); // al 100 % arranca la salida
  };
  requestAnimationFrame(tick);
  const marcar = (k) => {                          // suma un paso una sola vez
    if (hechos.has(k)) return;
    hechos.add(k);
    meta += pasos[k];
  };

  marcar('dom');                                                                   // el script ya corre: DOM listo
  document.fonts?.ready.then(() => marcar('fuentes')) ?? marcar('fuentes');        // tipografías cargadas
  if (document.querySelector('[data-css3d][data-ready]') || !document.querySelector('[data-css3d]')) marcar('modelo');
  else document.addEventListener('c3:listo', () => marcar('modelo'), { once: true }); // el aparador CSS 3D avisa cuando está armado
  if (document.readyState === 'complete') marcar('carga');
  else window.addEventListener('load', () => marcar('carga'), { once: true });     // imágenes y resto de la página
  setTimeout(() => Object.keys(pasos).forEach(marcar), 7000);                      // a los 7 s se da por cargado igual

  // ===== 4. SALIDA =====
  let saliendo = false;
  function terminar() {
    if (saliendo) return; // solo una vez
    saliendo = true;

    // --- Tiempos de la salida (ms desde que se llega al 100 %). Ajusta aquí. ---
    const T = {
      firma: 0,          // la firma se rellena de blanco
      oscuro: 100,       // inversión: fondo claro → oscuro y líneas oscuras → claras, a la vez
      oscuroDur: 650,    //   …y tarda esto (curva 'inExpo': casi quieto al inicio, el cambio fuerte ocurre al final)
      borrar: 950,       // ya invertido, las líneas (ahora claras) se mantienen un instante y empiezan a borrarse
      vuelo: 950,        // el logo empieza a viajar a la cabecera
      vueloDur: 1500,    //   …y tarda esto
      descubrir: 1150,   // el fondo oscuro se vuelve transparente: se ve la página
      descubrirDur: 500, //   …y tarda esto
      texto: 1300,       // empieza la cascada del texto del inicio
      textoPaso: 110,    //   retraso entre una pieza de texto y la siguiente
    };
    const aterriza = T.vuelo + T.vueloDur; // momento en que el logo llega a la cabecera

    const logo = $('.cg-logo');                                    // svg del logo rojo (el que vuela)
    const marca = document.querySelector('.site-header .brand img'); // logo real de la cabecera (destino)
    const a = logo.getBoundingClientRect();                        // dónde está el logo ahora
    const b = marca?.getBoundingClientRect();                      // dónde tiene que llegar
    const calma = matchMedia('(prefers-reduced-motion: reduce)').matches; // "reducir movimiento" del sistema
    // Desplazamiento y escala para calzar centro con centro. El círculo ocupa 912/1000 del svg
    // y la imagen de la cabecera lo dibuja a ~96 % de su ancho.
    const vuelo = b && b.width && !calma ? {
      x: (b.left + b.width / 2) - (a.left + a.width / 2),
      y: (b.top + b.height / 2) - (a.top + a.height / 2),
      s: (b.width * .96) / (a.width * .912),
    } : null;

    const oscuro = getComputedStyle(document.body).backgroundColor || '#0b0b0d'; // color de fondo real del sitio
    const transparente = oscuro.replace(/^rgb\((.+)\)$/, 'rgba($1, 0)');        // el mismo color con alfa 0
    const CLARO = '#ece7dd';                                                    // tono hueso del sitio: color de las líneas ya invertidas

    const tl = createTimeline({ defaults: { ease: 'inOutQuart' }, onComplete: fin }); // al terminar llama a fin()
    tl.add($('.cg-firma-llena'), { opacity: [0, 1], duration: 250 }, T.firma)       // firma blanca sólida (tapa el calado)
      .add($$('.cg-dib > *, .cg-marcas, .cg-regla, .cg-textos, .cg-grilla'),         // todas las líneas del plano…
        { opacity: 0, duration: 450, delay: stagger(25, { from: 'last' }) }, T.borrar) // …se borran, de la última a la primera
      .add($('.cg-pie'), { opacity: 0, duration: 300 }, T.borrar)                    // texto inferior y porcentaje
      // Inversión estilo animejs.com: fondo y líneas cambian juntos con la misma curva.
      // 'inExpo' deja el tono casi quieto (apenas se oscurece) y concentra el cambio en el
      // último tramo, por eso se percibe como un fundido rápido al negro.
      .add(root, { backgroundColor: oscuro, color: CLARO, duration: T.oscuroDur, ease: 'inExpo' }, T.oscuro) // fondo → oscuro; líneas, cotas y grilla (usan currentColor) → claras
      .add($$('.cg-pie, .cg-pct'), { color: CLARO, duration: T.oscuroDur, ease: 'inExpo' }, T.oscuro);      // el pie y el porcentaje también se invierten
    if (vuelo) {
      tl.add(root, { backgroundColor: transparente, duration: T.descubrirDur, ease: 'linear' }, T.descubrir) // se ve la página
        .add(logo, { x: vuelo.x, y: vuelo.y, scale: vuelo.s, duration: T.vueloDur, ease: 'inOutExpo' }, T.vuelo) // viaje a la cabecera
        .add(marca, { opacity: [0, 1], duration: 200 }, aterriza - 150) // el logo real aparece justo antes de que llegue…
        .add(logo, { opacity: 0, duration: 200 }, aterriza - 100);      // …y el que vuela se desvanece encima (relevo)
    } else {
      tl.add(root, { opacity: 0, duration: T.descubrirDur }, T.descubrir);            // sin vuelo: el cargador se desvanece
      if (marca) tl.add(marca, { opacity: [0, 1], duration: 400 }, T.descubrir + 50); // y aparece el logo de la cabecera
    }

    // --- Cascada del texto del inicio ---
    // Piezas en orden de lectura: antetítulo, cada palabra del título, párrafo, cada botón y cada dato.
    const piezas = textoEnCascada();
    if (piezas.length) {
      tl.add(piezas, {
        opacity: [0, 1],                   // de invisible a visible
        y: calma ? 0 : ['0.6em', '0em'],   // sube desde un poco más abajo (sin desplazamiento si se pide menos movimiento)
        duration: 900,
        delay: stagger(T.textoPaso),      // una pieza tras otra
        ease: 'outQuart',                 // rápido al inicio, frena al llegar
      }, T.texto);
    }
  }

  // Devuelve las piezas del texto del inicio, en orden. El título se separa en palabras
  // (cada una dentro de un <span> en línea) conservando el <em> y el punto final.
  function textoEnCascada() {
    const copia = document.querySelector('.hero-copy');
    if (!copia) return [];
    const h1 = copia.querySelector('h1');
    if (h1 && !h1.dataset.palabras) {
      h1.dataset.palabras = '';
      const nodos = [];
      const recorrer = (n) => n.childNodes.forEach((c) => (c.nodeType === 3 ? nodos.push(c) : recorrer(c)));
      recorrer(h1);
      for (const nodo of nodos) {
        const trozos = nodo.textContent.split(/(\s+)/);  // palabras y espacios por separado
        const frag = document.createDocumentFragment();
        for (const t of trozos) {
          if (!t) continue;
          if (/^\s+$/.test(t)) { frag.append(t); continue; } // los espacios quedan como texto
          const s = document.createElement('span');
          s.className = 'palabra';
          s.style.display = 'inline-block';                   // necesario para poder moverla con transform
          s.textContent = t;
          frag.append(s);
        }
        nodo.replaceWith(frag);
      }
    }
    const piezas = [];
    for (const hijo of copia.children) {
      if (hijo === h1) piezas.push(...h1.querySelectorAll('.palabra'));           // palabra por palabra
      else if (hijo.matches('.actions, .hero-meta')) piezas.push(...hijo.children); // botón por botón, dato por dato
      else piezas.push(hijo);                                                       // antetítulo y párrafo enteros
    }
    // Primero se muestran los bloques (antes los ocultaba el CSS) y luego se ocultan las piezas:
    // en ese orden, porque el antetítulo y el párrafo son a la vez bloque y pieza.
    copia.querySelectorAll(':scope > *').forEach((h) => { h.style.opacity = 1; });
    piezas.forEach((p) => { p.style.opacity = 0; });
    return piezas;
  }

  // Al terminar: se limpian los estilos en línea que dejó la animación y se sale.
  function fin() {
    document.querySelectorAll('.hero-copy > *, .hero-copy .palabra, .hero-copy .actions > *, .hero-copy .hero-meta > *')
      .forEach((el) => { el.style.removeProperty('transform'); el.style.removeProperty('opacity'); });
    salir();
  }
}
