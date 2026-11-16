// Portal de clientes: entrada con Access Key, modo demo (#demo) y vista del estudio (#estudio).
import { login, workerApi, demoApi } from './portal/api.js';

const form = document.querySelector('#portal-form');
const input = form.querySelector('input[name="key"]');
const status = form.querySelector('.form-status');
const set = (s, m) => { status.dataset.state = s; status.textContent = m; };

async function open(api) {
  const { startApp } = await import('./portal/app.js');
  try { await startApp(api); } catch (e) {
    console.error(e);
    if (e.code === 401) { sessionStorage.removeItem('dm_portal'); location.reload(); return; }
    alert('No se pudo cargar el proyecto: ' + e.message);
  }
}

// Token de GitHub guardado por Decap (mismo sitio) → permite entrar como estudio.
function ownerToken() {
  try { return JSON.parse(localStorage.getItem('decap-cms-user') || 'null')?.token || null; } catch { return null; }
}

// Cambiar de vista (#demo, #estudio/…) recarga el portal desde cero.
window.addEventListener('hashchange', () => { if (location.hash) location.reload(); });

const hash = decodeURIComponent(location.hash.slice(1));
if (hash === 'demo') {
  open(demoApi());
} else if (hash.startsWith('estudio')) {
  const tok = ownerToken();
  const p = hash.split('/')[1];
  if (!tok) set('error', 'Inicia sesión primero en /admin/proyectos/ con tu cuenta de GitHub.');
  else if (p) open(workerApi(null, { owner: tok, proyecto: p }));
  else import('./portal/estudio.js').then((m) => m.listar(workerApi(null, { owner: tok })));
} else if (hash.length > 1) {
  // Clave en el fragmento: /proyectos/#DM-XXXX-XXXX (nunca viaja al servidor del sitio)
  input.value = hash;
  history.replaceState(null, '', location.pathname + location.search);
  form.requestSubmit();
} else if (sessionStorage.getItem('dm_portal')) {
  open(workerApi(sessionStorage.getItem('dm_portal')));
}

document.querySelector('[data-demo]')?.addEventListener('click', (e) => {
  e.preventDefault(); location.hash = 'demo';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = input.value.trim().toUpperCase();
  if (key.length < 8) return set('error', 'Revisa tu clave: debería tener al menos 8 caracteres.');
  if (!window.DM.worker) return set('error', 'El portal se está habilitando. Escríbenos y te avisamos apenas esté listo.');
  set('', 'Verificando…');
  try {
    const { token } = await login(key);
    sessionStorage.setItem('dm_portal', token);
    set('ok', 'Acceso concedido. Cargando tu proyecto…');
    open(workerApi(token));
  } catch (err) {
    set('error', err.message);
  }
});
