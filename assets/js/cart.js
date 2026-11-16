// Carrito ligero en localStorage. Sin dependencias.
const KEY = 'dm_cart_v1';
const listeners = new Set();

export const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n || 0));

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* modo privado: el carrito vive solo en memoria */ }
  memory = items;
  listeners.forEach((fn) => fn(items));
}
let memory = read();

// Una línea del carrito se identifica por producto + opciones elegidas.
const lineKey = (it) => it.id + '|' + JSON.stringify(it.options || {});

export const cart = {
  items: () => memory.slice(),
  count: () => memory.reduce((a, it) => a + it.qty, 0),
  total: () => memory.reduce((a, it) => a + (it.price || 0) * it.qty, 0),
  hasQuoteItems: () => memory.some((it) => !it.price),
  add(item) {
    const items = memory.slice();
    const k = lineKey(item);
    const found = items.find((it) => lineKey(it) === k);
    if (found) found.qty += item.qty || 1;
    else items.push({ ...item, qty: item.qty || 1 });
    write(items);
  },
  setQty(index, qty) {
    const items = memory.slice();
    if (!items[index]) return;
    if (qty <= 0) items.splice(index, 1); else items[index] = { ...items[index], qty };
    write(items);
  },
  remove(index) { this.setQty(index, 0); },
  clear() { write([]); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

// Sincroniza entre pestañas.
window.addEventListener('storage', (e) => { if (e.key === KEY) { memory = read(); listeners.forEach((fn) => fn(memory)); } });

export function orderId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DM-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

export function orderMessage(id) {
  const lines = memory.map((it) => {
    const opts = Object.entries(it.options || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    const price = it.price ? clp(it.price * it.qty) : 'a cotizar';
    return `• ${it.qty} × ${it.title}${opts ? ` (${opts})` : ''} — ${price}`;
  });
  const total = cart.total();
  return [
    `Hola DM Studio, quiero concretar este pedido:`,
    ``,
    `Orden ${id}`,
    ...lines,
    ``,
    `Total: ${clp(total)}${cart.hasQuoteItems() ? ' + ítems a cotizar' : ''}`,
    ``,
    `Nombre:`,
    `Comuna de despacho:`,
  ].join('\n');
}
