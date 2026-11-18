// Aplicación del portal de clientes (después de entrar con la clave, en modo demo o como estudio).
import { clp } from '../cart.js';
import { createScene } from './escena-css.js'; // CSS 3D: sin WebGL ni Three.js
import { iconoBorde } from '../editor/modelo.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (t) => new Date(t).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function startApp(api) {
  document.querySelector('[data-portal]').hidden = true;
  $('#papp').hidden = false;
  document.body.classList.add('in-app');

  const isOwner = api.mode === 'owner';
  const [proyecto, catalogo, bordes] = await Promise.all([
    api.proyecto(),
    fetch(`${window.DM.base}/assets/data/melaminas.json`).then((r) => r.json()).catch(() => []),
    fetch(`${window.DM.base}/assets/data/bordes.json`).then((r) => r.json()).catch(() => []),
  ]);

  // ----- opciones disponibles
  const permitidas = proyecto.opciones?.melaminas?.length ? new Set(proyecto.opciones.melaminas) : null;
  const melaminas = catalogo.filter((m) => !permitidas || permitidas.has(m.id));
  const sinStock = new Set(proyecto.opciones?.sin_stock || []); // sin stock en Imperial ni Homecenter: bloqueadas
  const tiradores = proyecto.opciones?.tiradores || [];
  const cubiertas = proyecto.opciones?.cubiertas || [];
  const byId = (list, id) => list.find((x) => x.id === id);

  const sel = {
    melamina: proyecto.seleccion?.melamina || proyecto.opciones?.melamina_inicial || melaminas.find((m) => m.tipo === 'madera')?.id || melaminas[0]?.id || '',
    tirador: proyecto.seleccion?.tirador || tiradores[0]?.id || '',
    cubierta: proyecto.seleccion?.cubierta || cubiertas[0]?.id || '',
    borde: proyecto.seleccion?.borde || bordes[0]?.id || '',
    materiales: { ...(proyecto.seleccion?.materiales || {}) }, // color propio por pieza: { "idMódulo|pieza": idMelamina }
  };
  const resolved = () => ({ melamina: byId(melaminas, sel.melamina), tirador: byId(tiradores, sel.tirador), cubierta: byId(cubiertas, sel.cubierta), borde: byId(bordes, sel.borde), materiales: sel.materiales });
  const aprobado = () => !!proyecto.aprobacion;

  // ----- cabecera
  const estados = { propuesta: 'Propuesta', cambios: 'Cambios solicitados', aprobado: 'Aprobado', fabricacion: 'En fabricación', entregado: 'Entregado' };
  $('#ptitle').textContent = proyecto.titulo;
  const paintMeta = () => { $('#pmeta').textContent = `${isOwner ? 'Vista del estudio · ' : ''}Propuesta v${proyecto.version || 1} · ${estados[proyecto.estado] || ''}`; };
  paintMeta();
  $('#pclient').textContent = proyecto.cliente?.nombre || '';
  if (proyecto.vigencia) $('#pvalid').textContent = `Precio válido hasta el ${new Date(proyecto.vigencia + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
  $('#pdemo').hidden = api.mode !== 'demo';
  $('#pcond').textContent = proyecto.condiciones || '';
  $('#papcond').textContent = proyecto.condiciones || '';

  // ----- escena
  const scene = createScene($('#pcanvas'));
  scene.setProject(proyecto, resolved(), catalogo);
  document.querySelector('[data-tool="solo"]')?.setAttribute('aria-pressed', String(scene.soloMuebles));
  $('#ploading').remove();

  // ----- listas de opciones
  const tipos = [['*', 'Todas'], ['madera', 'Maderas'], ['unicolor', 'Unicolor'], ['fantasia', 'Fantasía']]
    .filter(([t]) => t === '*' || melaminas.some((m) => m.tipo === t));
  $('#melfilters').innerHTML = tipos.map(([t, n], i) => `<button type="button" data-f="${t}" aria-pressed="${i === 0}">${n}</button>`).join('');
  $('#melfilters').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('#melfilters').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#mellist').querySelectorAll('[data-t]').forEach((x) => { x.hidden = b.dataset.f !== '*' && x.dataset.t !== b.dataset.f; });
  });
  $('#mellist').innerHTML = melaminas.length ? melaminas.map((m) => `
    <button type="button" class="sw2${sinStock.has(m.id) ? ' sin-stock' : ''}" data-id="${esc(m.id)}" data-t="${esc(m.tipo)}" aria-pressed="false"${sinStock.has(m.id) ? ' aria-disabled="true"' : ''} title="${esc(m.nombre)}${m.textura ? ' · ' + esc(m.textura) : ''}${sinStock.has(m.id) ? ' · sin stock por ahora' : ''}">
      <i style="${m.tipo === 'unicolor' ? `background:${esc(m.hex)}` : `background:${esc(m.hex)} url('${esc(m.imagen)}') center/cover`}"></i>
      <span>${esc(m.nombre)}</span>
    </button>`).join('') : '<p class="small muted">Catálogo de melaminas en preparación.</p>';
  const optRow = (o, kind) => `
    <button type="button" class="opt" data-id="${esc(o.id)}" data-kind="${kind}" aria-pressed="false">
      <i style="background:${esc(o.color || '#333')}">${o.forma === 'sin' ? '∅' : ''}</i><span>${esc(o.nombre)}</span>
    </button>`;
  $('#tirlist').innerHTML = tiradores.map((t) => optRow(t, 'tirador')).join('');
  $('#cublist').innerHTML = cubiertas.map((c) => optRow(c, 'cubierta')).join('');
  // Bordes de cubierta: foto si la hay; si no, el ícono del perfil
  $('#bordelist').innerHTML = bordes.map((b) => `
    <button type="button" class="opt opt-borde" data-id="${esc(b.id)}" data-kind="borde" aria-pressed="false">
      ${b.imagen ? `<img src="${esc(b.imagen)}" alt="" loading="lazy">` : `<i class="borde-ico">${iconoBorde(b.perfil)}</i>`}<span>${esc(b.nombre)}</span>
    </button>`).join('');
  $('#bordetit').hidden = !bordes.length;
  $('#preclist').innerHTML = (proyecto.recomendados || []).map((r) => `
    <a class="opt" href="${esc(r.url)}" target="_blank" rel="noopener"><i class="mono">${esc((r.tipo || '').slice(0, 3))}</i><span>${esc(r.nombre)}${r.medida ? ` · ${esc(r.medida)}` : ''} ↗</span></a>`).join('') || '<p class="small muted">Sin recomendaciones.</p>';
  $('#pdims').innerHTML = (proyecto.modulos || []).map((m) => `<tr><th>${esc(m.nombre)}</th><td class="mono">${m.ancho} × ${m.profundidad} × ${m.alto} cm</td></tr>`).join('');

  function paintSelection() {
    document.querySelectorAll('#mellist [data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === sel.melamina)));
    document.querySelectorAll('.opt[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === sel[b.dataset.kind])));
    const r = resolved();
    $('#psel').innerHTML = [
      r.melamina && `Melamina: <b>${esc(r.melamina.nombre)}</b>`,
      r.tirador && `Tirador: <b>${esc(r.tirador.nombre)}</b>`,
      r.cubierta && `Cubierta: <b>${esc(r.cubierta.nombre)}</b>`,
      r.borde && `Borde: <b>${esc(r.borde.nombre)}</b>`,
      Object.keys(sel.materiales).length && `<b>${Object.keys(sel.materiales).length}</b> pieza${Object.keys(sel.materiales).length > 1 ? 's' : ''} con color propio`,
    ].filter(Boolean).join(' · ');
    pintarPiezas();
  }

  // ----- color por pieza (como el visor de materiales del estudio): tocar una pieza y luego un color,
  // o arrastrar un color sobre la pieza. Tocar un color sin pieza elegida cambia todo el mueble.
  let piezaSel = null; // "idMódulo|pieza"
  const modNombre = (id) => (proyecto.modulos || []).find((m, i) => (m.id || `m${i}`) === id)?.nombre || 'el mueble';
  const LADOS = { izq: 'Costado izquierdo', der: 'Costado derecho', piso: 'Base', techo: 'Techo', fondo: 'Fondo' };
  function nombrePieza(ref) {
    const [mid, ...r] = ref.split('|'), [k, a, b, c, i] = r;
    let n = r.join('|');
    if (k === 'cuerpo') n = LADOS[a] || 'Cuerpo';
    else if (k === 'zocalo') n = 'Zócalo';
    else if (k === 'f') {
      const tipo = (proyecto.modulos || []).find((m, j) => (m.id || `m${j}`) === mid)?.columnas?.[+a]?.frentes?.[+b]?.tipo;
      const nom = { puerta: 'Puerta', puerta_doble: 'Puertas', cajon: 'Cajón', panel: 'Panel', abierto: 'Sección abierta' }[tipo] || 'Frente';
      n = c === 'rep' ? `Repisa ${+i + 1}` : c === 'div' ? 'Divisiones de la sección' : `${nom} (columna ${+a + 1}, fila ${+b + 1})`;
    }
    return `${n} · ${modNombre(mid)}`;
  }
  // Piezas que el cliente puede pintar: frentes, cuerpo, repisas, divisiones y zócalo (no tiradores, cubierta ni artefactos)
  const refPintable = (ref) => /^[^|]+\|(f\|\d+\|\d+(\|rep\|\d+|\|div)?|cuerpo\|(izq|der|piso|techo|fondo)|zocalo)$/.test(ref || '');
  function elegirPieza(ref) {
    piezaSel = ref; scene.seleccionar(ref);
    document.querySelector('.ptabs [data-tab="melamina"]')?.click();
    pintarPiezas();
  }
  function aplicarPieza(ref, id) {
    if (aprobado() && !isOwner) { status('La propuesta ya fue aprobada. Para cambios, escríbenos en la conversación.'); return; }
    if (id) sel.materiales[ref] = id; else delete sel.materiales[ref];
    paintSelection(); scene.update(resolved()); schedule();
    status(id ? `${byId(melaminas, id)?.nombre || 'Color'} en ${nombrePieza(ref)}.` : `${nombrePieza(ref)}: vuelve al color general.`);
  }
  function pintarPiezas() {
    const box = $('#ppieza'); if (!box) return;
    const lista = Object.entries(sel.materiales);
    box.innerHTML = `
      ${piezaSel ? `<div class="ppieza-sel"><span>Pieza elegida: <b>${esc(nombrePieza(piezaSel))}</b><br><small>Toca un color para aplicarlo solo aquí.</small></span>
        <button type="button" data-pz="general">Color general</button><button type="button" data-pz="listo" aria-label="Terminar">✕</button></div>`
        : '<p class="small muted ppieza-ayuda">Toca un color para <b>todo el mueble</b> (la cubierta se elige en su pestaña o tocándola). Para cambiar <b>una sola pieza</b> (una puerta, un costado, una repisa…), haz clic sobre ella en el modelo o arrastra el color encima. <b>Doble clic</b> para comentar.</p>'}
      ${lista.length ? `<details class="ppieza-lista"><summary>${lista.length} pieza${lista.length > 1 ? 's' : ''} con color propio</summary>
        ${lista.map(([ref, id]) => `<div><i style="background:${esc(byId(catalogo, id)?.hex || '#999')}"></i><span>${esc(nombrePieza(ref))} · ${esc(byId(catalogo, id)?.nombre || id)}</span><button type="button" data-pz-quitar="${esc(ref)}">Quitar</button></div>`).join('')}
        <button type="button" data-pz="todas">Quitar todos los colores por pieza</button></details>` : ''}`;
  }
  $('#ppieza').addEventListener('click', (e) => {
    const q = e.target.closest('[data-pz-quitar]')?.dataset.pzQuitar;
    if (q) { aplicarPieza(q, null); return; }
    const a = e.target.closest('[data-pz]')?.dataset.pz;
    if (a === 'general' && piezaSel) aplicarPieza(piezaSel, null);
    if (a === 'listo') { piezaSel = null; scene.seleccionar(null); pintarPiezas(); }
    if (a === 'todas') { sel.materiales = {}; paintSelection(); scene.update(resolved()); schedule(); }
  });
  // Arrastrar un color desde la lista y soltarlo sobre una pieza del modelo
  let arrastrado = false;
  $('#mellist').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-id]'); if (!b || e.button > 0 || sinStock.has(b.dataset.id)) return;
    const id = b.dataset.id, x0 = e.clientX, y0 = e.clientY;
    let fantasma = null; arrastrado = false;
    const mover = (ev) => {
      if (!fantasma && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
        if (ev.pointerType !== 'mouse' && Math.abs(ev.clientY - y0) > Math.abs(ev.clientX - x0)) return; // en táctil, deslizar vertical es desplazar la lista
        fantasma = document.createElement('i'); fantasma.className = 'pfantasma'; fantasma.style.cssText = b.querySelector('i').getAttribute('style'); document.body.append(fantasma);
        arrastrado = true;
      }
      if (fantasma) { fantasma.style.left = ev.clientX + 'px'; fantasma.style.top = ev.clientY + 'px'; }
    };
    const soltar = (ev) => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      if (!fantasma) return;
      fantasma.remove();
      const ref = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#pcanvas [data-ref]')?.dataset.ref;
      if (refPintable(ref)) aplicarPieza(ref, id); else status('Suelta el color sobre una puerta, cajón, costado o repisa del mueble.');
    };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  });
  paintSelection();

  // ----- precio y guardado (con espera para no saturar)
  let qt = 0, lastQuote = null;
  async function quote() {
    $('#ptotal').classList.add('loading');
    try {
      lastQuote = await api.cotizar(sel);
      $('#ptotal').textContent = clp(lastQuote.total);
      $('#panticipo').textContent = clp(lastQuote.anticipo);
    } catch (e) {
      $('#ptotal').textContent = '—';
      status(e.message);
    } finally { $('#ptotal').classList.remove('loading'); }
  }
  const schedule = () => { clearTimeout(qt); qt = setTimeout(() => { quote(); if (!isOwner) api.guardar(sel).catch(() => {}); }, 450); };
  quote();

  function choose(kind, id) {
    if (aprobado() && !isOwner) { status('La propuesta ya fue aprobada. Para cambios, escríbenos en la conversación.'); return; }
    sel[kind] = id;
    paintSelection();
    scene.update(resolved());
    schedule();
  }
  $('#mellist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    if (arrastrado) { arrastrado = false; return; } // fue un arrastre, no un clic
    if (sinStock.has(b.dataset.id)) { status(`${byId(melaminas, b.dataset.id)?.nombre || 'Esta melamina'} no tiene stock por ahora en nuestras tiendas. Elige otra o escríbenos.`); return; }
    if (piezaSel) aplicarPieza(piezaSel, b.dataset.id); else choose('melamina', b.dataset.id);
  });
  document.querySelectorAll('.optlist').forEach((l) => l.addEventListener('click', (e) => {
    const b = e.target.closest('.opt[data-kind]'); if (b) choose(b.dataset.kind, b.dataset.id);
  }));

  // ----- pestañas
  document.querySelector('.ptabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    document.querySelectorAll('.ptabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.ppanel').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  });

  // ----- mis datos (perfil del cliente): se guardan en el Worker (D1), nunca en un repositorio
  const pform = $('#perfilform');
  const pstat = (t, estado = '') => { $('#perfilstatus').textContent = t; $('#perfilstatus').dataset.state = estado; };
  let perfil = null;
  function pintarPerfil() {
    const d = perfil || { nombre: proyecto.cliente?.nombre || '', avisos_correo: true, avisos_whatsapp: true };
    for (const k of ['nombre', 'email', 'telefono', 'comuna', 'direccion']) pform.elements[k].value = d[k] || '';
    pform.elements.avisos_correo.checked = d.avisos_correo !== false;
    pform.elements.avisos_whatsapp.checked = d.avisos_whatsapp !== false;
    // punto rojo en la pestaña mientras falte el correo (para que el cliente reciba los avisos)
    $('#perfildot').hidden = isOwner || !!perfil?.email;
    if (isOwner) $('#perfilintro').textContent = perfil ? 'Datos que dejó el cliente. Puedes corregirlos si te los pidió.' : 'El cliente aún no completa sus datos.';
  }
  try { perfil = (await api.perfil?.())?.perfil || null; } catch { perfil = null; }
  pintarPerfil();
  pform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = pform.elements;
    const datos = { nombre: f.nombre.value.trim(), email: f.email.value.trim(), telefono: f.telefono.value.trim(), comuna: f.comuna.value.trim(), direccion: f.direccion.value.trim(), avisos_correo: f.avisos_correo.checked, avisos_whatsapp: f.avisos_whatsapp.checked };
    if (datos.email && !f.email.checkValidity()) { pstat('Revisa tu correo: parece incompleto.', 'error'); f.email.focus(); return; }
    pstat('Guardando…');
    try {
      const r = await api.guardarPerfil(datos);
      perfil = r.perfil || datos; pintarPerfil();
      pstat(datos.email && datos.avisos_correo ? 'Listo. Te avisaremos por correo cuando haya novedades.' : 'Listo, tus datos quedaron guardados.', 'ok');
    } catch (err) { pstat(err.message, 'error'); }
  });

  // ----- herramientas del visor
  let pinMode = false, pending = null;
  const pinBtn = document.querySelector('[data-tool="pin"]');
  const setPinMode = (on) => {
    pinMode = on; pinBtn.setAttribute('aria-pressed', String(on));
    $('#pinhint').hidden = !on; scene.canvas.style.cursor = on ? 'crosshair' : '';
  };
  document.querySelector('.ptools').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view) scene.view(b.dataset.view);
    if (b.dataset.tool === 'room') b.setAttribute('aria-pressed', String(scene.toggleRoom()));
    if (b.dataset.tool === 'solo') { const on = scene.toggleSolo(); b.setAttribute('aria-pressed', String(on)); status(on ? 'Solo muebles: se ocultan electrodomésticos, encimeras y lavaplatos (son solo referencias).' : 'Se muestran también los electrodomésticos de referencia.'); }
    if (b.dataset.tool === 'pin') setPinMode(!pinMode);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setPinMode(false); closePinPop(); } });

  // Abre el cuadro de comentario en el punto del modelo bajo (x, y).
  const ghost = document.createElement('span');
  ghost.className = 'pin pin-ghost'; ghost.textContent = '+'; ghost.hidden = true;
  function closePinPop() { $('#pinpop').hidden = true; pending = null; ghost.hidden = true; }
  function openPinAt(clientX, clientY) {
    const p = scene.pick(clientX, clientY);
    if (!p) return false;
    pending = p;
    const pop = $('#pinpop');
    const r = $('#pcanvas').getBoundingClientRect();
    const w = Math.min(290, r.width - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(clientX - r.left - w / 2, r.width - w - 12)) + 'px';
    const below = clientY - r.top + 22;
    pop.style.top = (below + 180 < r.height ? below : Math.max(12, clientY - r.top - 200)) + 'px';
    $('#pinmod').textContent = p.modulo || 'este punto';
    pop.hidden = false;
    placeGhost();
    $('#pintext').focus({ preventScroll: true });
    return true;
  }
  function placeGhost() {
    if (!pending) return;
    const s = scene.toScreen(pending);
    ghost.style.transform = `translate(${s.x}px, ${s.y}px)`;
    ghost.hidden = !s.visible;
  }

  // Formas de comentar: doble clic (mouse), mantener presionado (táctil)
  // o el botón "Comentar en el modelo" + un clic.
  const cv = scene.canvas;
  let down = null, press = null, pressed = false;
  const cancelPress = () => { clearTimeout(press); press = null; };
  cv.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY }; pressed = false;
    cancelPress();
    if (e.pointerType !== 'mouse' && e.isPrimary) {
      press = setTimeout(() => {
        press = null;
        if (openPinAt(down.x, down.y)) { pressed = true; navigator.vibrate?.(15); }
      }, 550);
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (press && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) cancelPress();
  });
  cv.addEventListener('pointercancel', cancelPress);
  cv.addEventListener('pointerup', (e) => {
    cancelPress();
    if (pressed) return; // ya se abrió con long tap
    if (!pinMode || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    if (openPinAt(e.clientX, e.clientY)) setPinMode(false);
  });
  // Doble clic = comentar; por eso el clic simple (elegir pieza o cubierta) espera un instante y se anula si llega el segundo clic
  let clicPendiente = 0;
  cv.addEventListener('dblclick', (e) => { e.preventDefault(); clearTimeout(clicPendiente); openPinAt(e.clientX, e.clientY); });
  // Clic simple sobre una cubierta (sin arrastrar y fuera del modo comentario): abre los bordes
  cv.addEventListener('click', (e) => {
    if (pinMode || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    if (e.detail > 1) { clearTimeout(clicPendiente); return; } // segundo clic de un doble clic
    const ref = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ref]')?.dataset.ref;
    clearTimeout(clicPendiente);
    clicPendiente = setTimeout(() => {
      if (refPintable(ref)) { elegirPieza(ref); return; } // una pieza: se le cambia el color
      if (!/\|cubierta$/.test(ref || '')) { if (piezaSel) { piezaSel = null; scene.seleccionar(null); pintarPiezas(); } return; } // fondo: suelta la pieza
      document.querySelector('.ptabs [data-tab="cubierta"]')?.click(); // la cubierta: su material y su borde
      const lista = $('#bordelist');
      lista.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      lista.classList.remove('flash'); void lista.offsetWidth; lista.classList.add('flash');
    }, 260);
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault()); // evita el menú del long tap
  $('#pinpop [data-cancel]').addEventListener('click', closePinPop);
  $('#pinpop').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('#pintext').value.trim(); if (!texto || !pending) return;
    await send({ texto, tipo: 'pin', pin: pending });
    $('#pintext').value = ''; closePinPop(); setPinMode(false);
  });

  // ----- mensajes, chat y pines
  let mensajes = [];
  const pinsEl = $('#pins');
  function pinNumber(m) { return mensajes.filter((x) => x.tipo === 'pin').indexOf(m) + 1; }
  function paintPins() {
    const pins = mensajes.filter((m) => m.tipo === 'pin' && m.pin);
    pinsEl.innerHTML = pins.map((m) => `<button type="button" class="pin${m.resuelto ? ' done' : ''}${m.autor === 'estudio' ? ' studio' : ''}" data-id="${m.id}" title="${esc(m.texto)}">${pinNumber(m)}</button>`).join('');
    pinsEl.append(ghost);
    placePins();
  }
  function placePins() {
    placeGhost();
    pinsEl.querySelectorAll('.pin[data-id]').forEach((el) => {
      const m = mensajes.find((x) => String(x.id) === el.dataset.id);
      const pin = typeof m.pin === 'string' ? JSON.parse(m.pin) : m.pin;
      const s = scene.toScreen(pin);
      el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      el.hidden = !s.visible;
    });
  }
  scene.onRender(placePins);
  pinsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.pin'); if (!b) return;
    openChat(true);
    const li = document.querySelector(`#chatlist [data-id="${b.dataset.id}"]`);
    li?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); li?.classList.add('flash'); setTimeout(() => li?.classList.remove('flash'), 1200);
  });

  function paintChat() {
    const list = $('#chatlist');
    const me = isOwner ? 'estudio' : 'cliente';
    list.innerHTML = mensajes.length ? mensajes.map((m) => `
      <li class="msg ${m.autor === me ? 'mine' : ''} ${m.autor === 'estudio' ? 'from-studio' : ''} t-${m.tipo}" data-id="${m.id}">
        <div class="bubble">${m.tipo === 'pin' ? `<b class="mono">📍 ${pinNumber(m)}</b> ` : ''}${m.tipo === 'cambios' ? '<b>Cambios solicitados:</b> ' : ''}${m.tipo === 'aprobacion' ? '<b>✓ Propuesta aprobada.</b> ' : ''}${esc(m.texto)}</div>
        <small class="muted">${m.autor === 'estudio' ? 'DM Studio' : esc(proyecto.cliente?.nombre || 'Cliente')} · ${fecha(m.creado)}${m.editado ? ' · editado' : ''}${m.tipo === 'pin' && m.resuelto ? ' · resuelto' : ''}
        ${isOwner && m.tipo === 'pin' && !m.resuelto ? ` · <button type="button" class="link-btn" data-resolve="${m.id}">Marcar resuelto</button>` : ''}${msgActions(m, me)}</small>
      </li>`).join('') : '<li class="small muted" style="padding:12px">Aún no hay mensajes. Escríbenos cualquier duda, o haz doble clic sobre el modelo (en el celular, mantén el dedo presionado) para comentar un punto exacto.</li>';
    list.scrollTop = list.scrollHeight;
    const unread = mensajes.filter((m) => m.autor !== me && m.creado > lastSeen()).length;
    $('#chatbadge').hidden = !unread || $('#chat').dataset.open === 'true'; $('#chatbadge').textContent = unread;
  }
  const seenKey = `dm_seen_${proyecto.id}_${isOwner ? 'o' : 'c'}`;
  const lastSeen = () => { try { return +localStorage.getItem(seenKey) || 0; } catch { return 0; } };
  const markSeen = () => { try { localStorage.setItem(seenKey, Date.now()); } catch { /* */ } };
  // Editar: solo los propios. Borrar: los propios, o cualquiera si es el estudio.
  // El registro de la aprobación no se toca.
  function msgActions(m, me) {
    if (m.tipo === 'aprobacion') return '';
    const own = m.autor === me;
    return (own ? ` · <button type="button" class="link-btn" data-edit="${m.id}">Editar</button>` : '')
      + (own || isOwner ? ` · <button type="button" class="link-btn" data-del="${m.id}">Borrar</button>` : '');
  }
  let editing = null; // id del mensaje en edición (pausa el refresco automático)
  function startEdit(li, m) {
    editing = m.id;
    const bubble = li.querySelector('.bubble');
    const f = document.createElement('form');
    f.className = 'msg-edit';
    f.innerHTML = `<label class="sr-only" for="edit-${m.id}">Editar mensaje</label>
      <textarea id="edit-${m.id}" rows="2" maxlength="2000" required></textarea>
      <div class="actions"><button class="btn btn-primary" type="submit">Guardar</button><button class="btn" type="button" data-cancel>Cancelar</button></div>`;
    const ta = f.querySelector('textarea');
    ta.value = m.texto;
    bubble.replaceWith(f);
    li.querySelector('small').hidden = true;
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const done = () => { editing = null; paintChat(); paintPins(); };
    f.querySelector('[data-cancel]').addEventListener('click', done);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = ta.value.trim(); if (!t) return;
      if (t === m.texto) return done();
      f.querySelector('[type=submit]').disabled = true;
      try { await api.editar(m.id, t); editing = null; await refresh(); }
      catch (err) { f.querySelector('[type=submit]').disabled = false; alert('No se pudo editar: ' + err.message); }
    });
  }
  $('#chatlist').addEventListener('click', async (e) => {
    const r = e.target.closest('[data-resolve]');
    if (r) { await api.resolver(+r.dataset.resolve); await refresh(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      if (editing) paintChat();
      const m = mensajes.find((x) => String(x.id) === ed.dataset.edit);
      const li = document.querySelector(`#chatlist [data-id="${ed.dataset.edit}"]`);
      if (m && li) startEdit(li, m);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const m = mensajes.find((x) => String(x.id) === del.dataset.del); if (!m) return;
      const que = m.tipo === 'pin' ? `el comentario 📍 ${pinNumber(m)}` : 'este mensaje';
      if (!confirm(`¿Borrar ${que}? No se puede deshacer.`)) return;
      try { await api.borrar(m.id); await refresh(); } catch (err) { alert('No se pudo borrar: ' + err.message); }
    }
  });

  async function refresh() {
    try {
      const r = await api.mensajes();
      mensajes = r.mensajes || [];
      if (editing && mensajes.some((m) => m.id === editing)) { paintPins(); return; }
      editing = null;
      paintChat(); paintPins();
      await revisarVersion();
    } catch (e) { if (e.code === 401) location.reload(); }
  }
  // Si el estudio publicó una versión nueva (mensaje "Versión N: …" en el chat), se recarga el
  // proyecto y el modelo se actualiza sin recargar la página ni mover la cámara.
  async function revisarVersion() {
    const nueva = Math.max(0, ...mensajes.filter((m) => m.tipo === 'version').map((m) => +(/Versi[oó]n (\d+)/.exec(m.texto)?.[1] || 0)));
    if (nueva <= (+proyecto.version || 1)) return;
    const p = await api.proyecto();
    if ((+p.version || 1) <= (+proyecto.version || 1)) return; // el servidor aún no la ve: se reintenta en la próxima revisión
    Object.assign(proyecto, p);
    proyecto.aprobacion = p.aprobacion || null;
    if (p.seleccion?.melamina) sel.melamina = p.seleccion.melamina; // la versión publicada trae la melamina del estudio
    sel.materiales = { ...(p.seleccion?.materiales || {}) };           // y lo que el estudio decidió por pieza manda
    paintSelection();
    scene.update(resolved());
    $('#pdims').innerHTML = (proyecto.modulos || []).map((m) => `<tr><th>${esc(m.nombre)}</th><td class="mono">${m.ancho} × ${m.profundidad} × ${m.alto} cm</td></tr>`).join('');
    paintMeta(); paintApproval(); quote();
    status(`DM Studio publicó la versión ${proyecto.version}: ya la estás viendo.`);
  }
  async function send(msg) {
    try { await api.enviar(msg); await refresh(); } catch (e) { status(e.message); }
  }
  function openChat(open) {
    $('#chat').dataset.open = String(open);
    $('#chathead').setAttribute('aria-expanded', String(open));
    if (open) { markSeen(); $('#chatbadge').hidden = true; }
  }
  $('#chathead').addEventListener('click', () => openChat($('#chat').dataset.open !== 'true'));
  $('#chatform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#chatinput').value.trim(); if (!t) return;
    const tipo = e.target.dataset.tipo || 'chat';
    delete e.target.dataset.tipo;
    $('#chatinput').value = '';
    await send({ texto: t, tipo });
  });
  $('#chatinput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatform').requestSubmit(); } });
  await refresh();
  if (api.mode !== 'demo') setInterval(refresh, 30000);

  // ----- aprobar / pedir cambios
  function status(msg) { $('#pstatus').textContent = msg; }
  function paintApproval() {
    const ap = proyecto.aprobacion;
    $('#papprove').hidden = !!ap || isOwner;
    $('#pchanges').hidden = !!ap || isOwner;
    const locked = !!ap && !isOwner;
    $('#plock').hidden = !locked;
    document.querySelector('.papp-side').classList.toggle('is-locked', locked);
    if (ap) status(`Aprobado el ${new Date(ap.fecha).toLocaleDateString('es-CL')} · Total ${clp(ap.total)} · Anticipo ${clp(ap.anticipo)}.`);
  }
  paintApproval();

  if (api.mode === 'demo') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'link-btn'; b.textContent = 'Reiniciar demo';
    b.addEventListener('click', () => { api.reset(); location.reload(); });
    $('#pstatus').after(b);
  }

  $('#pchanges').addEventListener('click', () => {
    openChat(true);
    $('#chatinput').value = 'Me gustaría hacer estos cambios: ';
    $('#chatinput').focus();
    $('#chatform').dataset.tipo = 'cambios';
  });

  const dlg = $('#papprovedlg');
  $('#papprove').addEventListener('click', () => {
    const r = resolved();
    $('#papsummary').innerHTML = `
      <table class="specs">
        <tr><th>Proyecto</th><td>${esc(proyecto.titulo)} · v${proyecto.version || 1}</td></tr>
        <tr><th>Melamina</th><td>${esc(r.melamina?.nombre || '—')}</td></tr>
        <tr><th>Tirador</th><td>${esc(r.tirador?.nombre || '—')}</td></tr>
        <tr><th>Cubierta</th><td>${esc(r.cubierta?.nombre || '—')}</td></tr>
        <tr><th>Borde</th><td>${esc(r.borde?.nombre || '—')}</td></tr>
        ${Object.keys(sel.materiales).length ? `<tr><th>Colores por pieza</th><td>${Object.entries(sel.materiales).map(([ref, id]) => `${esc(nombrePieza(ref))}: ${esc(byId(catalogo, id)?.nombre || id)}`).join('<br>')}</td></tr>` : ''}
        <tr><th>Total</th><td><b>${lastQuote ? clp(lastQuote.total) : '—'}</b></td></tr>
        <tr><th>Anticipo 50%</th><td>${lastQuote ? clp(lastQuote.anticipo) : '—'}</td></tr>
      </table>`;
    $('#papcheck').checked = false;
    dlg.showModal();
  });
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'ok') return;
    status('Registrando aprobación…');
    try {
      const { aprobacion } = await api.aprobar(sel);
      proyecto.aprobacion = aprobacion;
      paintApproval();
      await notifyApproval(proyecto, resolved(), aprobacion, api.mode);
      await refresh();
    } catch (e) { status(e.message); }
  });
}

// Aviso al estudio por correo (Web3Forms) + WhatsApp prellenado para coordinar el anticipo.
async function notifyApproval(p, r, ap, mode) {
  const resumen = [
    `Proyecto: ${p.titulo} (v${p.version || 1})`,
    `Cliente: ${p.cliente?.nombre || ''}`,
    `Melamina: ${r.melamina?.nombre || '—'}`,
    `Tirador: ${r.tirador?.nombre || '—'}`,
    `Cubierta: ${r.cubierta?.nombre || '—'}`,
    `Borde de cubierta: ${r.borde?.nombre || '—'}`,
    ...(Object.keys(r.materiales || {}).length ? [`Colores por pieza: ${Object.keys(r.materiales).length} (ver el detalle en el portal)`] : []),
    `Total: ${clp(ap.total)}`,
    `Anticipo 50%: ${clp(ap.anticipo)}`,
  ].join('\n');
  if (mode !== 'demo' && window.DM.web3forms) {
    const fd = new FormData();
    fd.set('access_key', window.DM.web3forms);
    fd.set('subject', `Propuesta aprobada · ${p.titulo}`);
    fd.set('from_name', 'Portal DM Studio');
    fd.set('message', resumen);
    fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd }).catch(() => {});
  }
  const st = document.querySelector('#pstatus');
  if (window.DM.whatsapp) {
    const a = document.createElement('a');
    a.className = 'btn btn-wa btn-block'; a.target = '_blank'; a.rel = 'noopener';
    a.href = `https://wa.me/${window.DM.whatsapp}?text=${encodeURIComponent('Hola DM Studio, aprobé mi propuesta:\n' + resumen + '\n\n¿Cómo coordinamos el anticipo?')}`;
    a.textContent = 'Coordinar anticipo por WhatsApp';
    st.after(a);
  } else {
    st.textContent += ' Te contactaremos para coordinar el anticipo.';
  }
}
