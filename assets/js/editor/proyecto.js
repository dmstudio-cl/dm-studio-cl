import { despiece } from './despiece.js';
import { optimizarDespiece } from './optimizador.js';
import { solucionesQueCalzan } from './esquinero.js';
// Proyectos de clientes en el editor: abrir desde el repo privado, ver y responder comentarios,
// y "Publicar versión" (commit en el repo + registro en el chat + aviso al cliente).
//
// Acceso: usa tu sesión de GitHub de Decap (localStorage "decap-cms-user", la misma de
// /admin/proyectos/). El Worker la verifica para los comentarios; GitHub, para leer y guardar.
// No se guarda ningún token nuevo.

const REPO = 'dmstudio-cl/proyectos-clientes';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);

export const tokenGitHub = () => { try { return JSON.parse(localStorage.getItem('decap-cms-user') || 'null')?.token || null; } catch { return null; } };

// ----- GitHub (repo privado) -----
async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    cache: 'no-store', ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenGitHub()}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
  if (res.status === 401) throw new Error('Tu sesión de GitHub expiró. Vuelve a entrar en «Proyectos de clientes».');
  if (res.status === 409) throw new Error('El proyecto cambió mientras lo guardabas. Vuelve a intentarlo.');
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}: ${(await res.json().catch(() => ({}))).message || ''}`);
  return res.json();
}
const b64dec = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const b64enc = (s) => { let bin = ''; new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };

// ----- proyecto nuevo (mismo archivo que crea Decap en /admin/proyectos/) -----
// Nombre del archivo como el «slug» de Decap: año + título en minúsculas, sin tildes y con guiones
const slugTitulo = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
// Clave de acceso del cliente: DM-XXXX-XXXX sin O/0 ni I/1 (igual que el botón «Generar» de Decap)
function nuevaClave() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint32Array(8));
  const s = [...r].map((n) => abc[n % abc.length]).join('');
  return `DM-${s.slice(0, 4)}-${s.slice(4)}`;
}
async function existeProyecto(id) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/proyectos/${encodeURIComponent(id)}.json?ref=main`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenGitHub()}` } });
  if (res.status === 404) return false;
  if (res.status === 401) throw new Error('Tu sesión de GitHub expiró. Vuelve a entrar.');
  return true;
}
// Crea el proyecto en Borrador (el cliente aún no puede entrar). Devuelve { id, raw }.
export async function crearProyecto({ titulo, nombre, email, telefono, comuna }) {
  const base = `${new Date().getFullYear()}-${slugTitulo(titulo) || 'proyecto'}`;
  let id = base;
  for (let i = 2; await existeProyecto(id); i++) id = `${base}-${i}`; // nunca pisa un proyecto existente
  const cliente = { nombre, ...(email ? { email } : {}), ...(telefono ? { telefono: telefono.replace(/[^\d+]/g, '') } : {}), ...(comuna ? { comuna } : {}) };
  const raw = { titulo, access_key: nuevaClave(), estado: 'borrador', version: 1, cliente, tipo: 'melamina', modulos: [] };
  await gh(`contents/proyectos/${encodeURIComponent(id)}.json`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Proyecto: crear «proyectos/${id}.json»`, content: b64enc(JSON.stringify(raw, null, 2) + '\n'), branch: 'main' }),
  });
  return { id, raw };
}

export async function leerProyecto(id) {
  const f = await gh(`contents/proyectos/${encodeURIComponent(id)}.json?ref=main`);
  return { raw: JSON.parse(b64dec(f.content)), sha: f.sha };
}
// Configuración de precios del repo privado (SKU de Imperial de cada plancha, tapacanto…). null si no hay sesión.
export async function leerPrecios() {
  if (!tokenGitHub()) return null;
  const f = await gh('contents/config/precios.json?ref=main');
  return JSON.parse(b64dec(f.content));
}
async function escribirProyecto(id, raw, sha, mensaje) {
  const r = await gh(`contents/proyectos/${encodeURIComponent(id)}.json`, {
    method: 'PUT',
    body: JSON.stringify({ message: mensaje, content: b64enc(JSON.stringify(raw, null, 2) + '\n'), sha, branch: 'main' }),
  });
  return { sha: r.content.sha, commit: r.commit.sha.slice(0, 7) };
}

// ----- Worker (comentarios) -----
export async function api(path, { method = 'GET', body, p, params = {} } = {}) {
  const base = (window.DM.worker || '').replace(/\/$/, '');
  if (!base) throw new Error('Falta la URL del Worker en Ajustes del sitio.');
  const u = new URL(`${base}/api/portal/${path}`);
  if (p) u.searchParams.set('p', p);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method, headers: { 'Content-Type': 'application/json', 'X-DM-Owner': tokenGitHub() }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
  return res.json();
}

// ----- avisos -----
const portalUrl = () => new URL(`${window.DM.base}/proyectos/`, location.origin).href;
export function linkWhatsApp(cliente, texto) {
  let n = String(cliente?.telefono || '').replace(/\D/g, '');
  if (!n) return null;
  if (n.length === 9 && n.startsWith('9')) n = '56' + n; // celular chileno sin código de país
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
// Contacto del cliente: lo que dejó en «Mis datos» del portal (D1) tiene prioridad sobre lo de Decap.
function contactoDe(info) {
  const c = info?.raw?.cliente || {}, p = info?.perfil || {};
  return {
    nombre: p.nombre || c.nombre || '', email: p.email || c.email || '', telefono: p.telefono || c.telefono || '',
    comuna: p.comuna || c.comuna || '', direccion: p.direccion || '',
    avisos_correo: p.avisos_correo !== false, avisos_whatsapp: p.avisos_whatsapp !== false, completo: !!info?.perfil,
  };
}
const textoAviso = { 'sin-permiso': 'El cliente pidió no recibir avisos por correo.', enviado: 'Correo enviado al cliente.', 'sin-correo': 'El proyecto no tiene email del cliente: no se envió correo.', 'sin-configurar': 'El correo automático aún no está configurado en el Worker.', error: 'No se pudo enviar el correo (revisa el Apps Script).' };

// Convierte el proyecto del repo al modelo del editor (y viceversa al publicar).
// Los materiales por pieza viajan como texto JSON (así Decap los conserva, igual que «plantilla»)
const leerJSON = (v) => { if (!v) return undefined; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return undefined; } };
export function aModelo(raw, uid) {
  return {
    nombre: raw.titulo || 'Proyecto',
    frente: raw.opciones?.melamina_inicial || '',
    espacio: raw.espacio ? JSON.parse(JSON.stringify(raw.espacio)) : null,
    colores: raw.colores ? { ...raw.colores } : {},
    objetos: Array.isArray(raw.objetos) ? raw.objetos.map((o) => ({ ...o })) : [],
    modulos: (raw.modulos || []).map((m) => ({
      ...m, id: m.id || uid(), materiales: leerJSON(m.materiales), tiradores: (m.tiradores || []).map((t) => ({ ...t, id: t.id || uid('t') })),
      zocalo_retiro: m.zocalo_retiro ?? 5, x: +m.x || 0, elevacion: +m.elevacion || 0, z: +m.z || 0, rotacion: +m.rotacion || 0,
    })),
  };
}

// ----- elección del cliente en su portal (2026-11-22) -----
// El cliente manda en los materiales que el portal le deja elegir: al abrir el proyecto, el editor pasa al modelo su
// melamina (si la eligió él) y sus colores por pieza; tirador, cubierta, borde y muebles a cotizar se muestran encima
// (capa «Elección del cliente»). Lo último que se cambia manda: lo que publicas queda como base y el cliente puede volver a
// cambiarlo. Si el cliente cambia algo con el editor abierto, aparece un aviso para aplicarlo.
export const firmaMat = (s) => JSON.stringify({ m: s?.melamina_propia ? s.melamina || '' : '', x: s?.materiales || {} });
// Pasa al modelo la melamina y los colores por pieza del cliente. Devuelve qué cambió: { melamina, piezas }.
export function aplicarCliente(mod, s) {
  const out = { melamina: '', piezas: 0 };
  if (!s) return out;
  if (s.melamina_propia && s.melamina && s.melamina !== mod.frente) { mod.frente = s.melamina; out.melamina = s.melamina; }
  for (const [k, v] of Object.entries(s.materiales || {})) {
    const i = k.indexOf('|'), m = (mod.modulos || []).find((x) => x.id === k.slice(0, i));
    if (!m || i < 1) continue;
    const pieza = k.slice(i + 1);
    if ((m.materiales || {})[pieza] === v) continue;
    m.materiales = { ...(m.materiales || {}), [pieza]: v };
    out.piezas++;
  }
  return out;
}
const nombreMel = (id) => (window.MELAMINAS || []).find((x) => x.id === id)?.nombre || id;
export const textoCambios = (c) => [c.melamina && `melamina ${nombreMel(c.melamina)}`, c.piezas && `${c.piezas} color${c.piezas > 1 ? 'es' : ''} por pieza`].filter(Boolean).join(' y ');
let bordesSitio = null;
// Lo que eligió el cliente (Worker, como estudio) y los catálogos para dibujarlo
async function leerCliente(id) {
  const d = await api('proyecto', { p: id });
  if (!bordesSitio) bordesSitio = await fetch(`${window.DM.base}/assets/data/bordes.json`).then((r) => r.json()).catch(() => []);
  const sel = d.seleccion || null;
  return { sel, tiradores: d.opciones?.tiradores || [], cubiertas: d.opciones?.cubiertas || [], bordes: Array.isArray(bordesSitio) ? bordesSitio : [], aprobacion: d.aprobacion || null, firma: firmaMat(sel) };
}

/**
 * Conecta la interfaz de proyectos con el editor.
 * ed: { modelo(): modelo actual, abrir(modelo, info), aviso(texto), pines(lista), enfocarPin(pin) }
 */
export function iniciarProyectos(ed) {
  let info = null;      // { id, sha, raw }
  let mensajes = [];
  let sondeo = 0;
  const btnProy = $('#btn-proyecto'), btnPub = $('#btn-publicar');
  const dlgP = $('#dlg-proyectos'), dlgV = $('#dlg-publicar');

  function pintarBarra() {
    btnProy.textContent = info ? `${info.raw.titulo} · v${info.raw.version || 1}` : 'Modelo local ▾';
    btnProy.title = info ? `${info.raw.cliente?.nombre || ''} · ${info.raw.estado || ''}` : 'Abrir un proyecto de cliente';
    btnPub.hidden = !info;
    $('#tab-btn-coment').hidden = !info;
  }

  // --- elegir proyecto
  btnProy.addEventListener('click', async () => {
    const cuerpo = $('.ed-dlg-cuerpo', dlgP);
    if (!dlgP.open) dlgP.showModal();
    if (!tokenGitHub()) {
      cuerpo.innerHTML = `<p>Para abrir proyectos de clientes, primero entra en <a href="${window.DM.base}/admin/proyectos/">Proyectos de clientes</a> con tu cuenta de GitHub y vuelve aquí.</p>`;
      return;
    }
    cuerpo.innerHTML = '<p class="ed-ayuda">Cargando proyectos…</p>';
    try {
      const { proyectos } = await api('admin/proyectos');
      cuerpo.innerHTML = `<p class="ed-nuevo-fila"><button class="ed-primario" data-nuevo>+ Nuevo proyecto</button></p>
        <div class="ed-lista">${proyectos.map((p) => `
        <button data-id="${esc(p.id)}"><b>${esc(p.titulo)}</b><small>${esc(p.cliente)} · ${esc(p.estado)} · v${p.version}</small>${p.pendientes ? `<i>${p.pendientes}</i>` : ''}</button>`).join('') || '<p class="ed-ayuda">No hay proyectos. Créalos en «Proyectos de clientes».</p>'}</div>
        ${info ? '<p><button data-local>Volver al modelo local</button></p>' : ''}`;
    } catch (e) { cuerpo.innerHTML = `<p class="ed-error">${esc(e.message)}</p>`; }
  });
  // --- proyecto nuevo: datos básicos obligatorios (lo demás se completa en Decap o en el editor)
  function formNuevo() {
    $('.ed-dlg-cuerpo', dlgP).innerHTML = `<form class="ed-nuevo" id="form-nuevo">
      <p class="sub">Proyecto nuevo</p>
      <div class="ed-campos">
        <label class="ed-campo ancho2">Título del proyecto *<input name="titulo" required maxlength="80" placeholder="Ej: Cocina departamento Ñuñoa"></label>
        <label class="ed-campo ancho2">Nombre del cliente *<input name="nombre" required maxlength="80"></label>
        <label class="ed-campo ancho2">Email del cliente<input name="email" type="email" maxlength="120" placeholder="Recibe los avisos de cada versión"></label>
        <label class="ed-campo">WhatsApp<input name="telefono" inputmode="tel" maxlength="20" placeholder="56912345678"></label>
        <label class="ed-campo">Comuna<input name="comuna" maxlength="60"></label>
      </div>
      <p class="ed-ayuda">Se crea en <b>Borrador</b> (el cliente aún no puede entrar) con su clave de acceso, y se abre aquí para dibujar el mueble. Cuando lo publiques como propuesta, el cliente podrá entrar. Lo demás (vigencia, opciones, costos) se edita en «Proyectos de clientes».</p>
      <div class="ed-botones"><button type="button" data-volver>Volver</button><button type="submit" class="ed-primario">Crear y abrir</button></div>
      <p class="ed-error" id="nuevo-msg" aria-live="polite"></p>
    </form>`;
    $('#form-nuevo input', dlgP).focus();
  }
  dlgP.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-nuevo') return;
    e.preventDefault();
    const f = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim()]));
    if (!f.titulo || !f.nombre) return;
    const b = e.submitter; b.disabled = true; b.textContent = 'Creando…';
    try {
      const { id, raw } = await crearProyecto(f);
      await abrir(id);
      dlgP.close();
      ed.aviso(`Proyecto «${raw.titulo}» creado en Borrador. Clave de acceso del cliente: ${raw.access_key}. Dibuja el mueble y publica la primera versión.`);
    } catch (err) { $('#nuevo-msg', dlgP).textContent = err.message; b.disabled = false; b.textContent = 'Crear y abrir'; }
  });
  dlgP.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cerrar]')) return dlgP.close();
    if (e.target.closest('[data-nuevo]')) return formNuevo();
    if (e.target.closest('[data-volver]')) return btnProy.click();
    if (e.target.closest('[data-local]')) { info = null; mensajes = []; clearInterval(sondeo); ed.abrir(null, null); pintarBarra(); pintarComentarios(); pintarContacto(); return dlgP.close(); }
    const b = e.target.closest('[data-id]'); if (!b) return;
    b.disabled = true;
    try { await abrir(b.dataset.id); dlgP.close(); } catch (err) { ed.aviso(err.message); b.disabled = false; }
  });

  async function abrir(id) {
    const { raw, sha } = await leerProyecto(id);
    info = { id, sha, raw, perfil: null };
    try { info.perfil = (await api('perfil', { p: id })).perfil; } catch { /* sin perfil */ }
    try { info.cliente = await leerCliente(id); info.cliente.visto = info.cliente.firma; } catch { info.cliente = null; } // lo que eligió en su portal
    pintarContacto();
    ed.abrir(raw, info);
    pintarBarra();
    await cargarComentarios();
    clearInterval(sondeo);
    sondeo = setInterval(() => { if (!document.hidden) { cargarComentarios().catch(() => {}); revisarCliente(); } }, 30000);
  }
  // ¿El cliente cambió algo en su portal? (true si hay materiales nuevos por aplicar: el editor muestra el aviso)
  async function revisarCliente() {
    if (!info) return false;
    let cli; try { cli = await leerCliente(info.id); } catch { return false; }
    const hay = ed.clienteNuevo(cli);
    pintarContacto();
    return hay;
  }

  // --- ficha de contacto del cliente (arriba de los comentarios)
  function pintarContacto() {
    const el = $('#coment-cliente'); if (!el) return;
    if (!info) { el.innerHTML = ''; return; }
    const c = contactoDe(info);
    const fila = (k, v) => (v ? `<div><span>${k}</span><b>${esc(v)}</b></div>` : '');
    el.innerHTML = `<p class="sub">Cliente</p>
      ${fila('Nombre', c.nombre)}${fila('Correo', c.email)}${fila('WhatsApp', c.telefono)}${fila('Comuna', c.comuna)}${fila('Dirección', c.direccion)}
      <p class="ed-ayuda">${c.completo ? `Avisos por correo: ${c.avisos_correo ? 'sí' : 'no'} · WhatsApp: ${c.avisos_whatsapp ? 'sí' : 'no'}` : 'El cliente aún no completa «Mis datos» en el portal.'}</p>
      ${eleccionCliente()}`;
  }
  // Resumen de lo que eligió el cliente en su portal
  function eleccionCliente() {
    const cli = info?.cliente, s = cli?.sel;
    if (!s) return '<p class="sub">Elección del cliente</p><p class="ed-ayuda">El cliente aún no elige nada en su portal.</p>';
    const fila = (k, v) => (v ? `<div><span>${k}</span><b>${esc(v)}</b></div>` : '');
    const mods = (info.raw.modulos || []).filter((m) => !m.artefacto);
    const elegidos = Array.isArray(s.modulos) && s.modulos.length ? mods.filter((m) => s.modulos.includes(m.id)) : mods;
    const piezas = Object.keys(s.materiales || {}).length, ap = cli.aprobacion;
    return `<p class="sub">Elección del cliente</p>
      ${fila('Melamina', `${nombreMel(s.melamina)}${s.melamina_propia ? '' : ' (la tuya)'}`)}${fila('Colores por pieza', piezas ? `${piezas}` : '')}
      ${fila('Tirador', cli.tiradores.find((t) => t.id === s.tirador)?.nombre || s.tirador)}${fila('Cubierta', cli.cubiertas.find((c) => c.id === s.cubierta)?.nombre || s.cubierta)}
      ${fila('Borde', cli.bordes.find((b) => b.id === s.borde)?.nombre || s.borde)}${fila('Cotiza', elegidos.length < mods.length ? `${elegidos.length} de ${mods.length} muebles` : 'todos los muebles')}
      ${ap ? fila('Aprobó', `${new Date(ap.fecha).toLocaleDateString('es-CL')} · $${Math.round(ap.total).toLocaleString('es-CL')}`) : ''}
      <p class="ed-ayuda">Se ve en el modelo con la capa «Elección del cliente». Su melamina y sus colores por pieza ya están en el modelo: lo que publiques queda como base y el cliente puede volver a cambiarlo.</p>`;
  }

  // --- comentarios
  async function cargarComentarios() {
    if (!info) return;
    const r = await api('mensajes', { p: info.id });
    mensajes = r.mensajes || [];
    pintarComentarios();
  }
  const nPin = (m) => mensajes.filter((x) => x.tipo === 'pin').indexOf(m) + 1;
  function pintarComentarios() {
    const lista = $('#coment-lista');
    ed.pines(mensajes.filter((m) => m.tipo === 'pin' && m.pin && !m.resuelto).map((m) => ({ ...m.pin, n: nPin(m), id: m.id })));
    // pendientes: mensajes del cliente después de la última respuesta del estudio
    const ult = mensajes.reduce((a, m) => (m.autor === 'estudio' ? m.creado : a), 0);
    const pend = mensajes.filter((m) => m.autor === 'cliente' && m.creado > ult && m.tipo !== 'aprobacion').length;
    $('#n-coment').textContent = pend || '';
    if (!info) { lista.innerHTML = ''; return; }
    const fecha = (t) => new Date(t).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const etiqueta = (m) => ({ pin: `📍 ${nPin(m)}`, cambios: 'Cambios solicitados', version: 'Versión publicada', aprobacion: '✓ Aprobado' }[m.tipo] || '');
    lista.innerHTML = mensajes.map((m) => `
      <li class="ed-msg ${m.autor === 'estudio' ? 'yo' : ''} t-${m.tipo}${m.resuelto ? ' resuelto' : ''}" data-id="${m.id}">
        <div class="cab"><b>${m.autor === 'estudio' ? 'DM Studio' : esc(contactoDe(info).nombre || 'Cliente')}</b><span>${fecha(m.creado)}</span></div>
        ${etiqueta(m) ? `<span class="etq">${etiqueta(m)}</span>` : ''}
        <p>${esc(m.texto)}</p>
        <div class="acc">
          ${m.tipo === 'pin' && m.pin ? '<button data-ver>Ver en el modelo</button>' : ''}
          ${m.tipo === 'pin' && !m.resuelto ? '<button data-resolver>Marcar resuelto</button>' : ''}
          ${m.autor === 'cliente' ? '<button data-citar>Responder</button>' : ''}
          <button data-borrar class="peligro" title="Eliminar este mensaje (también desaparece del portal del cliente)">Eliminar</button>
        </div>
      </li>`).join('') || '<li class="ed-ayuda">Sin comentarios todavía.</li>';
    lista.scrollTop = lista.scrollHeight;
  }
  $('#coment-lista').addEventListener('click', async (e) => {
    const li = e.target.closest('[data-id]'); if (!li) return;
    const m = mensajes.find((x) => x.id === +li.dataset.id);
    if (e.target.closest('[data-ver]')) ed.enfocarPin({ ...m.pin, n: nPin(m) });
    if (e.target.closest('[data-citar]')) {
      const ta = $('#coment-texto');
      ta.value = `${m.tipo === 'pin' ? `Sobre el 📍 ${nPin(m)}: ` : ''}${ta.value}`;
      ta.focus();
    }
    if (e.target.closest('[data-borrar]')) {
      const quien = m.autor === 'estudio' ? 'tuyo' : 'del cliente';
      const extra = m.tipo === 'aprobacion' ? '\n\nOjo: es el registro de la aprobación (la aprobación en sí no se deshace).' : '';
      if (!confirm(`¿Eliminar este mensaje ${quien}?\n\n«${m.texto.slice(0, 120)}»\n\nTambién desaparece del portal del cliente y no se puede recuperar.${extra}`)) return;
      try { await api('mensajes', { method: 'DELETE', p: info.id, params: { id: m.id } }); await cargarComentarios(); } catch (err) { ed.aviso(err.message); }
      return;
    }
    if (e.target.closest('[data-resolver]')) {
      try { await api('mensajes', { method: 'PATCH', p: info.id, body: { id: m.id } }); await cargarComentarios(); } catch (err) { ed.aviso(err.message); }
    }
  });
  $('#coment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = $('#coment-texto'), texto = ta.value.trim(); if (!texto || !info) return;
    const avisar = $('#coment-avisar').checked;
    const btn = e.submitter; btn.disabled = true;
    try {
      const r = await api('mensajes', { method: 'POST', p: info.id, body: { texto, tipo: 'chat', avisar } });
      ta.value = '';
      await cargarComentarios();
      resultado($('#coment-resultado'), r.aviso, `Hola ${contactoDe(info).nombre.split(' ')[0]}, te respondí en tu proyecto «${info.raw.titulo}»: ${texto}\n\nRevísalo aquí: ${portalUrl()}`);
    } catch (err) { $('#coment-resultado').innerHTML = `<p class="ed-error">${esc(err.message)}</p>`; }
    btn.disabled = false;
  });

  // Muestra el resultado del aviso por correo y, si hay número, el botón de WhatsApp (un toque).
  function resultado(el, aviso, textoWa) {
    const c = contactoDe(info);
    const wa = c.avisos_whatsapp ? linkWhatsApp(c, textoWa) : null;
    el.innerHTML = `${aviso ? `<p class="ed-ayuda">${esc(textoAviso[aviso] || '')}</p>` : '<p class="ed-ayuda">Guardado sin aviso por correo.</p>'}
      ${wa ? `<a class="ed-wa" href="${wa}" target="_blank" rel="noopener">Avisar por WhatsApp</a>` : '<p class="ed-ayuda">Sin número de WhatsApp en el proyecto.</p>'}`;
  }

  // --- publicar versión (como un commit)
  btnPub.addEventListener('click', async () => {
    if (!info) return;
    // antes de publicar: si el cliente cambió materiales recién, primero se decide si aplicarlos (si no, se perderían)
    if (await revisarCliente()) { ed.aviso('El cliente cambió materiales en su portal recién: revisa el aviso de abajo antes de publicar.'); return; }
    const v = (+info.raw.version || 1) + 1;
    $('.ed-dlg-cuerpo', dlgV).innerHTML = `
      <form id="form-version" class="ed-form">
        <p class="ed-ayuda">Se guarda el modelo en el proyecto <b>${esc(info.raw.titulo)}</b>. ¿Le avisas al cliente?</p>
        <fieldset class="ed-modo">
          <label class="ed-check"><input type="radio" name="v-modo" value="avisar" checked> <span><b>Publicar versión ${v} y avisar</b><br><small>Queda en su chat y le llega el aviso por correo o WhatsApp.</small></span></label>
          <label class="ed-check"><input type="radio" name="v-modo" value="silencio"> <span><b>Solo actualizar el modelo</b><br><small>Sin mensaje ni aviso: el cliente ve el cambio al entrar (sigue la versión ${v - 1}). Útil para correcciones chicas.</small></span></label>
        </fieldset>
        <label class="ed-campo"><span id="v-msg-tit">¿Qué cambió?</span><textarea id="v-msg" rows="3" required placeholder="Ej: Agrandé el cajón superior a 22 cm y moví los tiradores al centro."></textarea></label>
        <label class="ed-check" id="v-avisar-fila"><input type="checkbox" id="v-avisar" checked> Avisar por correo${(() => { const c = contactoDe(info); return !c.email ? ' (el cliente aún no deja su correo)' : !c.avisos_correo ? ' (el cliente pidió no recibir correos)' : ` a ${esc(c.email)}`; })()}</label>
        <div class="ed-botones"><button type="submit" class="ed-primario" id="v-enviar">Publicar versión ${v}</button><button type="button" data-cerrar>Cancelar</button></div>
        <div id="v-resultado"></div>
      </form>`;
    // Sin aviso: el texto pasa a ser una nota opcional (solo queda en el historial del repositorio)
    const modo = () => {
      const silencio = $('[name="v-modo"]:checked', dlgV).value === 'silencio';
      $('#v-msg').required = !silencio;
      $('#v-msg-tit').textContent = silencio ? 'Nota para ti (opcional, el cliente no la ve)' : '¿Qué cambió?';
      $('#v-avisar-fila').hidden = silencio;
      $('#v-enviar').textContent = silencio ? 'Actualizar el modelo' : `Publicar versión ${v}`;
    };
    dlgV.querySelectorAll('[name="v-modo"]').forEach((r) => r.addEventListener('change', modo));
    dlgV.showModal();
    $('#v-msg').focus();
  });
  dlgV.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) dlgV.close(); });
  dlgV.addEventListener('submit', async (e) => {
    e.preventDefault();
    const silencio = $('[name="v-modo"]:checked', dlgV)?.value === 'silencio';
    const msg = $('#v-msg').value.trim(); if (!msg && !silencio) return;
    const btn = e.submitter; btn.disabled = true; btn.textContent = silencio ? 'Guardando…' : 'Publicando…';
    const out = $('#v-resultado');
    try {
      // 1) Se lee la última versión del repo (por si se editó en Decap) y se reemplaza solo lo del editor.
      const { raw, sha } = await leerProyecto(info.id);
      const modelo = ed.modelo();
      const v = (+raw.version || 1) + (silencio ? 0 : 1); // sin aviso: misma versión
      raw.modulos = modelo.modulos.map((m) => (m.materiales && Object.keys(m.materiales).length ? { ...m, materiales: JSON.stringify(m.materiales) } : (({ materiales, ...r }) => r)(m)));
      raw.colores = modelo.colores || {};
      raw.objetos = modelo.objetos || [];
      raw.despiece = despiece(modelo); // cantidades de materiales y herrajes: el Worker las cotiza
      // planchas enteras por melamina (optimizador); «frente» queda sin resolver (la elige el cliente) y con veta fija
      raw.despiece.planchas = optimizarDespiece(raw.despiece).map((g) => ({ material: g.material, espesor: g.espesor, planchas: g.planchas, m2: Math.round(g.m2Piezas * 100) / 100 }));
      // melaminas que se pueden girar en la plancha (unicolor): el Worker re-optimiza las planchas de los muebles elegidos
      raw.despiece.libres = (window.MELAMINAS || []).filter((x) => /unicolor/i.test(x.linea || '')).map((x) => x.id);
      // Esquineros (dueño, 2026-11-25): el cliente elige en el portal entre los tipos que calzan con las medidas del
      // mueble. Por cada uno se manda el despiece de ese mueble con ese tipo; el Worker cotiza el que elija.
      const variantes = {};
      for (const m of modelo.modulos.filter((x) => x.tipo === 'esquinero')) {
        for (const sol of solucionesQueCalzan(m)) {
          if (sol === m.solucion) continue;
          const dv = despiece({ ...modelo, modulos: modelo.modulos.map((x) => (x.id === m.id ? { ...m, solucion: sol } : x)) }), deEste = (o) => o.m === m.id;
          (variantes[m.id] ||= {})[sol] = { piezas: dv.piezas.filter(deEste), por_modulo: dv.por_modulo?.[m.id] || {}, esquinero: (dv.esquineros || []).find(deEste) || null,
            cajones: (dv.cajones || []).filter(deEste), cubiertas: (dv.cubiertas || []).filter(deEste) };
        }
      }
      if (Object.keys(variantes).length) raw.despiece.variantes_esquinero = variantes;
      // espacio: muros y etiquetas del editor; se conservan los datos que solo viven en Decap (fotos, etc.)
      if (modelo.espacio) raw.espacio = { ...(raw.espacio || {}), ...modelo.espacio };
      raw.opciones = { ...(raw.opciones || {}), melamina_inicial: modelo.frente || raw.opciones?.melamina_inicial };
      raw.version = v;
      if (!silencio && raw.estado === 'cambios') raw.estado = 'propuesta'; // respondiste a los cambios pedidos: vuelve a ser propuesta
      const titulo = silencio ? `Proyecto: «${info.id}» actualizado sin aviso (versión ${v})${msg ? ` · ${msg}` : ''}` : `Proyecto: «${info.id}» versión ${v} · ${msg}`;
      const { sha: nuevo, commit } = await escribirProyecto(info.id, raw, sha, titulo.slice(0, 200));
      info = { ...info, raw, sha: nuevo };
      ed.abrir(raw, info, { conservarVista: true });
      pintarBarra();
      if (silencio) { // 2') sin mensaje en el chat ni aviso; el portal del cliente vuelve a la melamina del editor
        let sync = true;
        try { await api('sincronizar', { method: 'POST', p: info.id, body: { melamina: modelo.frente || '' } }); } catch (e) { sync = false; }
        btn.textContent = 'Modelo actualizado';
        out.innerHTML = `<p class="ed-ok">Guardado en el repositorio (commit ${commit}), sin avisar al cliente. Lo verá en su portal en alrededor de un minuto.${sync ? '' : ' No se pudo actualizar la melamina del cliente (¿Worker sin desplegar?): la verá cuando publiques una versión.'}${raw.estado === 'borrador' ? ' Ojo: el proyecto sigue en «Borrador», el cliente aún no puede entrar.' : ''}</p>`;
        return;
      }
      // 2) Registro en el chat del proyecto + aviso por correo (lo envía el Worker)
      const r = await api('mensajes', { method: 'POST', p: info.id, body: { texto: `Versión ${v}: ${msg}`, tipo: 'version', avisar: $('#v-avisar').checked, melamina: modelo.frente || '' } }); // la melamina del editor manda
      await cargarComentarios();
      btn.textContent = `Versión ${v} publicada`;
      out.innerHTML = `<p class="ed-ok">Guardado en el repositorio (commit ${commit}).${raw.estado === 'borrador' ? ' Ojo: el proyecto sigue en «Borrador», el cliente aún no puede entrar.' : ''}</p>`;
      const div = document.createElement('div'); out.append(div);
      resultado(div, r.aviso, `Hola ${contactoDe(info).nombre.split(' ')[0]}, publiqué la versión ${v} de tu proyecto «${raw.titulo}»: ${msg}\n\nRevísala aquí: ${portalUrl()}`);
    } catch (err) {
      out.innerHTML = `<p class="ed-error">${esc(err.message)}</p>`;
      btn.disabled = false; btn.textContent = 'Reintentar';
    }
  });

  pintarBarra();
  return { get info() { return info; }, abrir };
}
