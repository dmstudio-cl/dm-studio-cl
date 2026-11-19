// Cliente de la API del portal.
// - modo "worker": habla con el Cloudflare Worker (datos reales, precio calculado en el servidor).
// - modo "demo": proyecto de ejemplo público, todo vive en el navegador (sin datos reales ni precios reales).
const base = () => (window.DM.worker || '').replace(/\/$/, '');

export function workerApi(token, { owner = null, proyecto = null } = {}) {
  const headers = () => {
    const h = { 'Content-Type': 'application/json' };
    if (owner) h['X-DM-Owner'] = owner; else h.Authorization = `Bearer ${token}`;
    return h;
  };
  async function call(path, opts = {}, params = {}) {
    const u = new URL(`${base()}/api/portal/${path}`);
    if (proyecto) u.searchParams.set('p', proyecto);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetch(u, { ...opts, headers: headers() });
    if (res.status === 401) { const e = new Error('Sesión expirada'); e.code = 401; throw e; }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
    return res.json();
  }
  return {
    mode: owner ? 'owner' : 'worker',
    proyecto: () => call('proyecto'),
    cotizar: (sel) => call('cotizar', { method: 'POST', body: JSON.stringify({ seleccion: sel }) }),
    guardar: (sel) => call('seleccion', { method: 'PUT', body: JSON.stringify({ seleccion: sel }) }),
    mensajes: (since = 0) => call('mensajes', {}, { since }),
    listar: () => call('admin/proyectos'),
    enviar: (msg) => call('mensajes', { method: 'POST', body: JSON.stringify(msg) }),
    resolver: (id) => call('mensajes', { method: 'PATCH', body: JSON.stringify({ id, resuelto: 1 }) }),
    editar: (id, texto) => call('mensajes', { method: 'PATCH', body: JSON.stringify({ id, texto }) }),
    borrar: (id) => call('mensajes', { method: 'DELETE' }, { id }),
    aprobar: (sel) => call('aprobar', { method: 'POST', body: JSON.stringify({ seleccion: sel }) }),
    perfil: () => call('perfil'),
    guardarPerfil: (datos) => call('perfil', { method: 'PUT', body: JSON.stringify(datos) }),
  };
}

export async function login(key) {
  const res = await fetch(`${base()}/api/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
  });
  if (res.status === 401 || res.status === 404) { const e = new Error('Clave no válida o expirada.'); e.code = 401; throw e; }
  if (res.status === 429) throw new Error('Demasiados intentos. Espera unos minutos.');
  if (!res.ok) throw new Error('No pudimos conectar con el portal.');
  return res.json();
}

// ---------------- demo ----------------
const DKEY = 'dm_demo_v1';
const dread = () => { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch { return {}; } };
const dwrite = (v) => { try { localStorage.setItem(DKEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export function demoApi() {
  let demoP = null; // proyecto de ejemplo (para los nombres de los muebles)
  return {
    mode: 'demo',
    async proyecto() {
      const p = await fetch(`${window.DM.base}/assets/data/proyecto-demo.json`).then((r) => r.json());
      const st = dread();
      return { ...p, seleccion: st.seleccion || p.seleccion, aprobacion: st.aprobacion || null };
    },
    // Precio ficticio solo para mostrar la interfaz (por mueble, repartido por tamaño; al elegir solo algunos, un
    // recargo simula las planchas enteras). El real lo calcula el Worker con los costos privados.
    async cotizar(sel) {
      let base = 1890000;
      if (sel?.tirador && /acero|laton|latón/.test(sel.tirador)) base += 45000;
      if (sel?.cubierta && /roble|piedra/.test(sel.cubierta)) base += 120000;
      demoP ||= fetch(`${window.DM.base}/assets/data/proyecto-demo.json`).then((r) => r.json());
      const mods = ((await demoP).modulos || []).map((m, i) => ({ id: m.id || `m${i}`, nombre: m.nombre, peso: (+m.ancho || 60) * (+m.alto || 90) }));
      const extras = 90000, pt = mods.reduce((s, m) => s + m.peso, 0) || 1, todos = mods.map((m) => m.id);
      const elegidos = sel?.modulos?.length ? sel.modulos.filter((id) => todos.includes(id)) : todos;
      const parcial = elegidos.length < todos.length;
      const modulos = mods.map((m) => {
        const incluido = elegidos.includes(m.id);
        return { id: m.id, nombre: m.nombre, incluido, precio: Math.round((base - extras) * m.peso / pt * (incluido && parcial ? 1.15 : 1) / 10) * 10 };
      });
      const total = modulos.filter((m) => m.incluido).reduce((s, m) => s + m.precio, 0) + extras;
      return { total, anticipo: Math.round(total * .5), extras, modulos, parcial, demo: true };
    },
    async guardar(sel) { dwrite({ ...dread(), seleccion: sel }); return { ok: true }; },
    async mensajes() { return { mensajes: dread().mensajes || [] }; },
    async enviar(msg) {
      const st = dread(); const list = st.mensajes || [];
      const m = { id: Date.now(), autor: 'cliente', creado: Date.now(), resuelto: 0, ...msg };
      list.push(m); dwrite({ ...st, mensajes: list });
      return { mensaje: m };
    },
    async resolver(id) {
      const st = dread(); (st.mensajes || []).forEach((m) => { if (m.id === id) m.resuelto = 1; }); dwrite(st); return { ok: true };
    },
    async editar(id, texto) {
      const st = dread(); (st.mensajes || []).forEach((m) => { if (m.id === id) { m.texto = texto; m.editado = Date.now(); } }); dwrite(st); return { ok: true };
    },
    async borrar(id) {
      const st = dread(); st.mensajes = (st.mensajes || []).filter((m) => m.id !== id); dwrite(st); return { ok: true };
    },
    async aprobar(sel) {
      const q = await this.cotizar(sel);
      const ap = { fecha: Date.now(), total: q.total, anticipo: q.anticipo, version: 1, ...(q.parcial ? { modulos: q.modulos.filter((m) => m.incluido).map((m) => m.id) } : {}) };
      dwrite({ ...dread(), aprobacion: ap });
      return { aprobacion: ap };
    },
    async perfil() { return { perfil: dread().perfil || null }; },
    async guardarPerfil(datos) {
      if (datos.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) throw new Error('Revisa tu correo: parece incompleto.');
      dwrite({ ...dread(), perfil: datos }); return { ok: true, perfil: datos };
    },
    reset() { localStorage.removeItem(DKEY); },
  };
}
