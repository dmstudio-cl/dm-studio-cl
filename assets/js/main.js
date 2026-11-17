// Punto de entrada común a todas las páginas.
import { cart, clp } from './cart.js';
import { initForms } from './forms.js';

// ----- menú móvil
const toggle = document.querySelector('.nav-toggle');
toggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  toggle.setAttribute('aria-expanded', String(open));
});

// ----- contador del carrito
const badge = document.querySelector('[data-cart-count]');
const paintCount = () => {
  const n = cart.count();
  if (!badge) return;
  badge.textContent = n;
  badge.hidden = n === 0;
};
paintCount();
cart.subscribe(paintCount);

// ----- toast
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
window.DM.toast = toast;

// ----- precios formateados
document.querySelectorAll('[data-clp]').forEach((el) => { el.textContent = clp(+el.dataset.clp); });

// ----- aparición al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ----- modelos CSS 3D (sin WebGL): se montan de inmediato, son livianos.
// data-scroll: el modelo además gira al bajar por la página (Anime.js).
document.querySelectorAll('[data-css3d]').forEach((el) => {
  import('./css3d/aparador.js').then(({ mountAparador }) => {
    const st = mountAparador(el);
    if (el.hasAttribute('data-scroll')) import('./css3d/scroll.js').then(({ girarConScroll }) => girarConScroll(el, st));
  });
});

// ----- visores 3D: Three.js solo se descarga cuando un visor se acerca a la pantalla
const viewers = document.querySelectorAll('[data-viewer]');
if (viewers.length) {
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      vio.unobserve(e.target);
      import('./three/viewer.js').then(({ mountViewer }) => mountViewer(e.target));
    });
  }, { rootMargin: '200px' });
  viewers.forEach((v) => vio.observe(v));
}

// ----- filtros de grilla (portafolio / catálogo)
document.querySelectorAll('[data-filters]').forEach((bar) => {
  const grid = document.querySelector(bar.dataset.filters);
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.filter;
    grid.querySelectorAll('[data-cat]').forEach((it) => { it.hidden = f !== '*' && it.dataset.cat !== f; });
  });
});

initForms();

// Módulos específicos de página
if (document.querySelector('[data-product]')) import('./product.js');
if (document.querySelector('[data-cart-page]')) import('./cart-page.js');
if (document.querySelector('[data-portal]')) import('./portal.js');
