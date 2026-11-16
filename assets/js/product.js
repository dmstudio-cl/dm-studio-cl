// Ficha de producto: galería, opciones con recargo, plazo y agregar al carrito.
import { cart, clp } from './cart.js';

const data = JSON.parse(document.querySelector('[data-product]').textContent);
const form = document.querySelector('#product-form');
const priceEl = document.querySelector('[data-price]');
const leadEl = document.querySelector('[data-lead]');
const stage = document.querySelector('.detail-media .stage');

// ----- galería (fotos y visor 3D)
document.querySelector('.thumbs')?.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  stage.querySelectorAll('[data-slide]').forEach((s) => { s.hidden = s.dataset.slide !== b.dataset.slide; });
  const v = stage.querySelector(`[data-slide="${b.dataset.slide}"][data-viewer-lazy]`);
  if (v && !v.dataset.mounted) {
    v.dataset.mounted = '1';
    import('./three/viewer.js').then(({ mountViewer }) => mountViewer(v));
  }
});

// ----- opciones
function selection() {
  const options = {}; let extra = 0; let custom = false;
  (data.opciones || []).forEach((op, i) => {
    const input = form?.querySelector(`input[name="op${i}"]:checked`);
    if (!input) return;
    const val = op.valores[+input.value];
    options[op.nombre] = val.nombre;
    extra += +val.recargo || 0;
    if (+input.value !== 0) custom = true; // el primer valor es el estándar
  });
  return { options, extra, custom };
}

function paint() {
  const { extra, custom } = selection();
  if (priceEl && data.precio) priceEl.textContent = clp(data.precio + extra);
  if (leadEl) {
    const days = custom && data.plazo_personalizado ? data.plazo_personalizado : data.plazo;
    leadEl.textContent = days ? `${days} días hábiles${custom ? ' (con personalización)' : ''}` : 'A coordinar';
    leadEl.closest('.note')?.classList.toggle('note-red', custom);
  }
}
form?.addEventListener('change', paint);
paint();

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const { options, extra } = selection();
  cart.add({
    id: data.id,
    title: data.titulo,
    price: data.precio ? data.precio + extra : 0,
    img: data.imagen,
    url: location.pathname,
    mp: Object.keys(options).length ? '' : (data.link_mercadopago || ''),
    options,
  });
  window.DM.toast?.('Agregado al carrito');
});
