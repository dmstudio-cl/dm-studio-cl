// Portal de clientes: pantalla de acceso con Access Key.
// La validación real la hace el Cloudflare Worker (fase 2). Aquí solo la interfaz y la llamada.
const form = document.querySelector('#portal-form');
const input = form.querySelector('input[name="key"]');
const status = form.querySelector('.form-status');
const set = (s, m) => { status.dataset.state = s; status.textContent = m; };

// Permite abrir el portal con la clave en el fragmento: /proyectos/#CLAVE (nunca viaja al servidor).
if (location.hash.length > 1) {
  input.value = decodeURIComponent(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = input.value.trim().toUpperCase();
  if (key.length < 8) return set('error', 'Revisa tu clave: debería tener al menos 8 caracteres.');
  if (!window.DM.worker) return set('error', 'El portal se está habilitando. Escríbenos y te avisamos apenas esté listo.');
  set('', 'Verificando…');
  try {
    const res = await fetch(`${window.DM.worker.replace(/\/$/, '')}/api/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (res.status === 401 || res.status === 404) return set('error', 'Clave no válida o expirada.');
    if (!res.ok) throw new Error(res.status);
    const { token } = await res.json();
    sessionStorage.setItem('dm_portal', token);
    set('ok', 'Acceso concedido. Cargando tu proyecto…');
    document.dispatchEvent(new CustomEvent('portal:login', { detail: { token } }));
  } catch {
    set('error', 'No pudimos conectar con el portal. Inténtalo en unos minutos.');
  }
});
