// Giro del modelo ligado al scroll (Anime.js onScroll): mientras la sección sale de pantalla,
// el mueble da media vuelta y se inclina un poco para mostrar la tapa.
import { animate, onScroll } from 'animejs';

export function girarConScroll(el, st, { vueltas = .5, inclina = -12 } = {}) {
  // El giro lo controla quien hace scroll, así que se mantiene incluso con "reducir movimiento",
  // pero más corto (un cuarto de vuelta).
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) vueltas = Math.min(vueltas, .25);
  const zona = el.closest('[data-scroll-zona]') || el.closest('section') || el;
  const giro = { y: 0, x: 0 };
  animate(giro, {
    y: 360 * vueltas,
    x: inclina,
    ease: 'linear',
    onUpdate: () => st.offset(giro.y, giro.x),
    // 'contenedor objetivo': empieza cuando el borde superior de la sección toca el de la ventana
    // y termina cuando su borde inferior sale por arriba. sync numérico = seguimiento suavizado.
    autoplay: onScroll({ target: zona, enter: 'top top', leave: 'top bottom', sync: .2 }),
  });
}
