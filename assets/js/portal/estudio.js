// Vista del estudio: lista de proyectos con mensajes sin responder. Requiere sesión de Decap (GitHub).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function listar(api) {
  const gate = document.querySelector('.gate-card');
  gate.innerHTML = '<p class="eyebrow">Vista del estudio</p><h1 style="font-size:2rem">Proyectos de clientes</h1><p class="muted">Cargando…</p>';
  try {
    const { proyectos } = await api.listar();
    gate.innerHTML = `<p class="eyebrow">Vista del estudio</p><h1 style="font-size:2rem">Proyectos de clientes</h1>
      <div class="optlist" style="text-align:left;margin-top:20px">${proyectos.map((p) => `
        <a class="opt" href="#estudio/${encodeURIComponent(p.id)}">
          <i class="mono">${p.pendientes ? p.pendientes : '·'}</i>
          <span><b>${esc(p.titulo)}</b><br><small class="muted">${esc(p.cliente)} · ${esc(p.estado)} · v${p.version}${p.aprobado ? ' · aprobado' : ''}</small></span>
        </a>`).join('') || '<p class="muted">No hay proyectos.</p>'}</div>
      <p class="small muted" style="margin-top:16px">El número indica mensajes del cliente sin respuesta.</p>`;
  } catch (e) {
    gate.innerHTML = `<p class="eyebrow">Vista del estudio</p><p class="form-status" data-state="error">${esc(e.message)}</p>`;
  }
}
