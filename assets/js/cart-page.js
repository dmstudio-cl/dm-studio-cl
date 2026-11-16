// Página del carrito y cierre del pedido (Mercado Pago por producto o WhatsApp).
import { cart, clp, orderId, orderMessage } from './cart.js';

const root = document.querySelector('[data-cart-page]');
const list = root.querySelector('[data-items]');
const sum = root.querySelector('[data-summary]');
const empty = root.querySelector('[data-empty]');
const tpl = document.querySelector('#cart-item');
let id = sessionStorage.getItem('dm_order') || orderId();
try { sessionStorage.setItem('dm_order', id); } catch { /* ignore */ }

function paint() {
  const items = cart.items();
  empty.hidden = items.length > 0;
  sum.hidden = items.length === 0;
  list.replaceChildren(...items.map((it, i) => {
    const n = tpl.content.firstElementChild.cloneNode(true);
    const img = n.querySelector('img');
    if (it.img) { img.src = it.img; img.alt = it.title; } else img.remove();
    const a = n.querySelector('h3 a'); a.textContent = it.title; a.href = it.url || '#';
    n.querySelector('.opts').textContent = Object.entries(it.options || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
    n.querySelector('[data-q]').textContent = it.qty;
    n.querySelector('[data-line]').textContent = it.price ? clp(it.price * it.qty) : 'A cotizar';
    n.querySelector('[data-dec]').onclick = () => cart.setQty(i, it.qty - 1);
    n.querySelector('[data-inc]').onclick = () => cart.setQty(i, it.qty + 1);
    n.querySelector('[data-rm]').onclick = () => cart.remove(i);
    return n;
  }));

  sum.querySelector('[data-order]').textContent = id;
  const total = cart.total(), quote = cart.hasQuoteItems();
  sum.querySelector('[data-total]').textContent = total === 0 && quote ? 'A cotizar' : clp(total) + (quote ? ' + a cotizar' : '');

  // Mercado Pago directo: solo cuando hay un único producto (1 unidad) con link de pago propio.
  const mp = sum.querySelector('[data-mp]');
  const single = items.length === 1 && items[0].qty === 1 && items[0].mp;
  mp.hidden = !single;
  if (single) mp.href = items[0].mp;

  const wa = sum.querySelector('[data-wa]');
  const msg = encodeURIComponent(orderMessage(id));
  if (window.DM.whatsapp) { wa.href = `https://wa.me/${window.DM.whatsapp}?text=${msg}`; wa.removeAttribute('aria-disabled'); }
  else { wa.setAttribute('aria-disabled', 'true'); wa.title = 'WhatsApp aún no configurado'; }
}
cart.subscribe(paint);
paint();
