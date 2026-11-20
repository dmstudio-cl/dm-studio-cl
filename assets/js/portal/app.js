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
  const [proyecto, catalogo, bordes, despacho] = await Promise.all([
    api.proyecto(),
    fetch(`${window.DM.base}/assets/data/melaminas.json`).then((r) => r.json()).catch(() => []),
    fetch(`${window.DM.base}/assets/data/bordes.json`).then((r) => r.json()).catch(() => []),
    fetch(`${window.DM.base}/assets/data/despacho.json`).then((r) => r.json()).catch(() => null),
  ]);
  // comunas con despacho: lista cerrada en «Mis datos» (así el nombre siempre calza con la tabla de despacho)
  const OTRA = 'Otra (fuera de Santiago)';
  const comunasDesp = [...(despacho?.comunas || [])].map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es'));
  $('#pf-comuna').insertAdjacentHTML('beforeend', comunasDesp.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('') + `<option value="${OTRA}">${OTRA} · despacho a coordinar</option>`);
  // una comuna guardada antes (escrita a mano) se lleva a la de la lista, o a «Otra»
  const normCom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const comunaDeLista = (v) => (!String(v || '').trim() ? '' : comunasDesp.find((n) => normCom(n) === normCom(v)) || OTRA);

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
    // muebles que el cliente quiere cotizar (vacío = todos); si ya aprobó, los aprobados
    modulos: [...(proyecto.aprobacion?.modulos || proyecto.seleccion?.modulos || [])],
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
        : '<p class="small muted ppieza-ayuda">Toca un color y cambia <b>todo lo que ya tiene color o madera</b>; lo blanco se mantiene. Para cambiar <b>una pieza</b> (también una blanca), arrastra el color sobre ella o haz clic en ella y luego en el color. La cubierta se elige en su pestaña. <b>Doble clic</b> para comentar.</p>'}
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
      pintarMuebles(lastQuote);
      pintarCostos(lastQuote);
      pintarDespacho(lastQuote);
    } catch (e) {
      $('#ptotal').textContent = '—';
      status(e.message);
    } finally { $('#ptotal').classList.remove('loading'); }
  }
  const schedule = () => { clearTimeout(qt); qt = setTimeout(() => { quote(); if (!isOwner) api.guardar(sel).catch(() => {}); }, 450); };

  // ----- muebles a cotizar: cada uno con su precio; el cliente marca los que quiere (y aprueba solo esos)
  function pintarMuebles(q) {
    const box = $('#pmuebles');
    const mods = q?.modulos || [];
    box.hidden = mods.length < 2; // con un solo mueble no hay nada que elegir
    if (box.hidden) return;
    const elegidos = mods.filter((m) => m.incluido).length;
    box.innerHTML = `<p class="pmuebles-tit small"><span class="muted">Muebles a cotizar (${elegidos} de ${mods.length})</span>${elegidos < mods.length && !(aprobado() && !isOwner) ? '<button type="button" data-todos>Elegir todos</button>' : ''}</p>
      ${mods.map((m) => `<label class="pmueble${m.incluido ? '' : ' fuera'}">
        <input type="checkbox" data-mod="${esc(m.id)}"${m.incluido ? ' checked' : ''}${aprobado() && !isOwner ? ' disabled' : ''}>
        <span class="pm-nombre">${esc(m.nombre)}</span><span class="pm-precio">${clp(m.precio)}</span>
        ${isOwner && m.materiales != null ? `<small>Materiales ${clp(m.materiales)} · mano de obra ${clp(m.mano_obra)}</small>` : ''}</label>`).join('')}
      ${q.extras ? `<div class="pmueble extra"><span></span><span class="pm-nombre">Gastos generales del proyecto</span><span class="pm-precio">${clp(q.extras)}</span><small>Transporte, instalación e insumos: se cobran completos.</small></div>` : ''}
      <p class="pmuebles-nota">${q.parcial ? 'Los muebles tachados no se incluyen (su precio es el que tienen dentro del proyecto completo). Al cotizar solo algunos, las planchas se compran enteras para ellos, por eso cada uno puede costar un poco más.' : 'Desmarca los muebles que no quieras y el total se recalcula. Puedes aprobar solo los que elijas.'}</p>`;
  }
  $('#pmuebles').addEventListener('change', (e) => {
    const id = e.target.dataset?.mod; if (!id || !lastQuote) return;
    if (aprobado() && !isOwner) { e.target.checked = !e.target.checked; return; }
    const todos = lastQuote.modulos.map((m) => m.id);
    let elegidos = sel.modulos.length ? sel.modulos.filter((x) => todos.includes(x)) : [...todos];
    elegidos = e.target.checked ? [...new Set([...elegidos, id])] : elegidos.filter((x) => x !== id);
    if (!elegidos.length) { e.target.checked = true; status('Elige al menos un mueble para cotizar.'); return; }
    sel.modulos = elegidos.length === todos.length ? [] : elegidos;
    e.target.closest('.pmueble')?.classList.toggle('fuera', !e.target.checked);
    schedule();
  });
  $('#pmuebles').addEventListener('click', (e) => {
    if (!e.target.closest('[data-todos]')) return;
    sel.modulos = []; schedule();
  });
  // Despacho a la comuna del cliente (calculado en el Worker con la tabla de despacho; va incluido en el total)
  function pintarDespacho(q) {
    const box = $('#pdespacho'), d = q?.despacho;
    box.hidden = !d;
    if (!d) return;
    const irDatos = '<button type="button" data-ir-datos>Mis datos</button>';
    box.innerHTML = d.estado === 'ok' ? `<span>Despacho a <b>${esc(d.comuna)}</b> <small>(incluido)</small></span><span>${clp(d.monto)}</span>`
      : d.estado === 'coordinar' ? `<span>Despacho ${/^otra/i.test(d.comuna) ? 'fuera de Santiago' : `a ${esc(d.comuna)}`}: <b>a coordinar</b></span><span></span>`
        : `<span>${isOwner ? 'El cliente aún no indica su comuna: despacho sin calcular.' : `Indica tu comuna en ${irDatos} para sumar el despacho.`}</span><span></span>`;
  }
  $('#pdespacho').addEventListener('click', (e) => { if (e.target.closest('[data-ir-datos]')) document.querySelector('.ptabs [data-tab="perfil"]')?.click(); });
  // Solo el estudio: gasto en materiales y ganancia en mano de obra de lo elegido (el Worker no lo envía al cliente)
  function pintarCostos(q) {
    const box = $('#pcostos'), e = q?.estudio;
    box.hidden = !isOwner || !e;
    if (box.hidden) return;
    box.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">Solo el estudio</p>
      <div class="row"><span>Materiales${e.extras_costo ? ` <small class="muted">(incluye ${clp(e.extras_costo)} de extras)</small>` : ''}</span><span>${clp(e.materiales)}</span></div>
      <div class="row"><span>Luz (${Math.round(e.luz_pct * 100)}%)</span><span>${clp(e.luz)}</span></div>
      <div class="row"><span>Subtotal</span><span>${clp(e.subtotal)}</span></div>
      <div class="row fuerte"><span>Mano de obra (ganancia)</span><span>${clp(e.mano_obra)}</span></div>
      ${e.despacho ? `<div class="row"><span>Despacho (sin factor)</span><span>${clp(e.despacho)}</span></div>` : ''}
      <div class="row"><span class="muted">Total al cliente (×${e.factor})</span><span>${clp(q.total)}</span></div>`;
  }
  quote();

  // ¿Es blanco este material? (lo blanco se queda blanco al tocar un color; se cambia solo arrastrando sobre la pieza)
  function esBlanco(mid) {
    const id = String(mid || '').replace(/^liston:/, '');
    let hex = '';
    if (id.startsWith('color:')) hex = id.slice(6);
    else { const x = catalogo.find((k) => k.id === id); if (!x) return false; if (/blanco/i.test(x.nombre)) return true; hex = x.hex || ''; }
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return false;
    const n = parseInt(m[1], 16), lum = (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255;
    return lum > .86;
  }
  const leerJSON = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
  // Al tocar un color (sin pieza elegida): también cambian las piezas que ya tenían otra madera o color,
  // las del estudio y las que eligió el cliente; los listones conservan su ranurado.
  function recolorear(id) {
    const nuevos = { ...sel.materiales };
    const cambiar = (k, v) => { if (v && !esBlanco(v)) nuevos[k] = String(v).startsWith('liston:') ? `liston:${id}` : id; };
    (proyecto.modulos || []).forEach((m, i) => { const mid = m.id || `m${i}`; for (const [k, v] of Object.entries(leerJSON(m.materiales))) if (!(`${mid}|${k}` in sel.materiales)) cambiar(`${mid}|${k}`, v); });
    for (const [k, v] of Object.entries(sel.materiales)) cambiar(k, v);
    sel.materiales = nuevos;
  }
  function choose(kind, id) {
    if (aprobado() && !isOwner) { status('La propuesta ya fue aprobada. Para cambios, escríbenos en la conversación.'); return; }
    if (kind === 'melamina') recolorear(id);
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

  // ----- electrodoméstico tocado en el modelo: muestra a la derecha los productos que el estudio recomienda
  // (links que se agregan en el editor; se compran aparte y no suman al precio)
  const clp = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  function mostrarElectro(id) {
    const o = (proyecto.objetos || []).find((x) => x.id === id); if (!o) return;
    if (piezaSel) { piezaSel = null; pintarPiezas(); }
    scene.seleccionar(`obj|${id}`);
    const links = o.links || [];
    $('#pelectro').innerHTML = `
      <div class="pelectro-cab"><div><h2 class="eyebrow">Electrodoméstico</h2><p class="pelectro-tit">${esc(o.nombre)}</p>
        <p class="small muted mono">${+o.ancho} × ${+o.alto} × ${+o.fondo} cm</p></div>
        <button type="button" class="pelectro-cerrar" data-electro="cerrar" aria-label="Cerrar">✕</button></div>
      ${links.length ? `<p class="small muted">Te recomendamos estos modelos, que calzan con el espacio del diseño. Se compran aparte y no suman al precio del mueble.</p>
        <div class="optlist">${links.map((l) => `<a class="opt pelectro-link" href="${esc(l.url)}" target="_blank" rel="noopener">
          <span><b>${esc(l.nombre || 'Ver producto')}</b>${l.tienda || l.precio ? `<small>${[l.tienda && esc(l.tienda), l.precio && `desde ${clp(l.precio)}`].filter(Boolean).join(' · ')}</small>` : ''}</span><i aria-hidden="true">↗</i></a>`).join('')}</div>`
        : '<p class="small muted">Es una referencia para mostrar el espacio que ocupa; no está incluido en la cotización. Si quieres una recomendación, pregúntanos en la conversación.</p>'}`;
    document.querySelectorAll('.ptabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', 'false'));
    document.querySelectorAll('.ppanel').forEach((p) => { p.hidden = p.dataset.panel !== 'electro'; });
    status(links.length ? `${o.nombre}: ${links.length} producto${links.length > 1 ? 's' : ''} recomendado${links.length > 1 ? 's' : ''} a la derecha.` : `${o.nombre}: referencia, sin precio.`);
  }
  $('#pelectro').addEventListener('click', (e) => {
    if (!e.target.closest('[data-electro="cerrar"]')) return;
    scene.seleccionar(null);
    document.querySelector('.ptabs [data-tab="melamina"]')?.click();
  });

  // ----- mis datos (perfil del cliente): se guardan en el Worker (D1), nunca en un repositorio
  const pform = $('#perfilform');
  const pstat = (t, estado = '') => { $('#perfilstatus').textContent = t; $('#perfilstatus').dataset.state = estado; };
  let perfil = null;
  function pintarPerfil() {
    const d = perfil || { nombre: proyecto.cliente?.nombre || '', avisos_correo: true, avisos_whatsapp: true };
    for (const k of ['nombre', 'email', 'telefono', 'direccion']) pform.elements[k].value = d[k] || '';
    pform.elements.comuna.value = comunaDeLista(d.comuna);
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
      quote(); // la comuna cambia el despacho
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
      if (/^obj\|/.test(ref || '')) { mostrarElectro(ref.slice(4)); return; } // un electrodoméstico: sus productos recomendados
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
    if (ap) status(`Aprobado el ${new Date(ap.fecha).toLocaleDateString('es-CL')} · Total ${clp(ap.total)} · Anticipo ${clp(ap.anticipo)}${ap.modulos?.length ? ` · ${ap.modulos.length} mueble${ap.modulos.length > 1 ? 's' : ''}` : ''}.`);
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
        ${lastQuote?.modulos?.length > 1 ? `<tr><th>Muebles</th><td>${lastQuote.parcial ? lastQuote.modulos.filter((m) => m.incluido).map((m) => `${esc(m.nombre)} · ${clp(m.precio)}`).join('<br>') : 'Todo el proyecto'}</td></tr>` : ''}
        ${lastQuote?.despacho ? `<tr><th>Despacho</th><td>${lastQuote.despacho.estado === 'ok' ? `${esc(lastQuote.despacho.comuna)} · ${clp(lastQuote.despacho.monto)}` : lastQuote.despacho.estado === 'coordinar' ? `${esc(lastQuote.despacho.comuna)} · a coordinar` : 'Sin comuna (se coordina después)'}</td></tr>` : ''}
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
      await notifyApproval(proyecto, resolved(), aprobacion, api.mode, lastQuote?.parcial ? lastQuote.modulos.filter((m) => m.incluido).map((m) => m.nombre) : null);
      pintarMuebles(lastQuote);
      await refresh();
    } catch (e) { status(e.message); }
  });
}

// Aviso al estudio por correo (Web3Forms) + WhatsApp prellenado para coordinar el anticipo.
async function notifyApproval(p, r, ap, mode, muebles = null) {
  const resumen = [
    `Proyecto: ${p.titulo} (v${p.version || 1})`,
    `Cliente: ${p.cliente?.nombre || ''}`,
    ...(muebles?.length ? [`Muebles aprobados: ${muebles.join(', ')}`] : []),
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
