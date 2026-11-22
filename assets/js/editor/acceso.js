// Acceso al editor: solo con una cuenta de GitHub que pueda escribir en el repo privado de proyectos
// (la misma comprobación que hace el Worker). Usa la sesión de Decap (localStorage «decap-cms-user»): si ya
// entraste en /admin/proyectos/ no pide nada; si no, «Entrar con GitHub» abre la misma ventana de acceso
// que Decap (OAuth en el Worker, rutas /auth y /callback) y guarda la sesión para los dos.
//
// Ojo: el sitio es estático y su código es público (repo público), así que esto oculta el editor a quien no
// tiene cuenta; lo que de verdad protege los datos es que el repo de proyectos es privado y el Worker exige
// el mismo permiso para todo lo del estudio.
const REPO = 'dmstudio-cl/proyectos-clientes';
const CLAVE = 'decap-cms-user';
const puerta = document.getElementById('ed-acceso');
const msg = document.getElementById('ed-acceso-msg');
const btn = document.getElementById('ed-acceso-entrar');

const token = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null')?.token || null; } catch { return null; } };
function bloquear(texto) {
  document.documentElement.classList.add('ed-bloqueado');
  puerta.hidden = false;
  if (texto) msg.textContent = texto;
}
function abrirPaso() { document.documentElement.classList.remove('ed-bloqueado'); puerta.hidden = true; }

// ¿El token puede escribir en el repo privado? (sin red se deja pasar: el editor no podrá leer proyectos igual)
async function verificar(t) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${t}` } });
    if (r.status === 401) return 'Tu sesión de GitHub expiró. Vuelve a entrar.';
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.permissions?.push) return 'Esta cuenta de GitHub no tiene acceso al editor.';
    return '';
  } catch { return ''; }
}

// Ventana de acceso de GitHub (mismo protocolo que Decap: «authorizing:github» y luego el token)
function entrar() {
  const base = (window.DM?.worker || '').replace(/\/$/, '');
  if (!base) { msg.textContent = 'Falta la URL del Worker en Ajustes del sitio.'; return; }
  const w = 560, h = 720, x = screenX + (outerWidth - w) / 2, y = screenY + (outerHeight - h) / 2;
  const pop = window.open(`${base}/auth?provider=github&site_id=${encodeURIComponent(location.host)}&scope=repo`, 'dm-github', `width=${w},height=${h},left=${x},top=${y}`);
  if (!pop) { msg.textContent = 'El navegador bloqueó la ventana de acceso: permite ventanas emergentes para este sitio.'; return; }
  const origen = new URL(base).origin;
  btn.disabled = true; msg.textContent = 'Completa el acceso en la ventana de GitHub…';
  const alRecibir = async (e) => {
    if (e.origin !== origen || typeof e.data !== 'string') return;
    if (e.data === 'authorizing:github') { e.source.postMessage('authorizing:github', e.origin); return; }
    const m = /^authorization:github:(success|error):(.*)$/s.exec(e.data); if (!m) return;
    window.removeEventListener('message', alRecibir);
    btn.disabled = false;
    let datos = {}; try { datos = JSON.parse(m[2]); } catch { /* respuesta inválida */ }
    if (m[1] !== 'success' || !datos.token) { msg.textContent = datos.message || 'No se pudo iniciar sesión con GitHub.'; return; }
    const error = await verificar(datos.token);
    if (error) { msg.textContent = error; return; }
    // sesión compartida con Decap (/admin/proyectos/): mismo formato que guarda Decap
    let u = {}; try { u = await (await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${datos.token}` } })).json(); } catch { /* sin datos del usuario */ }
    localStorage.setItem(CLAVE, JSON.stringify({ backendName: 'github', token: datos.token, login: u.login, name: u.name, avatar_url: u.avatar_url }));
    location.reload();
  };
  window.addEventListener('message', alRecibir);
}

btn.addEventListener('click', entrar);
const t = token();
if (!t) bloquear();
else verificar(t).then((error) => (error ? bloquear(error) : abrirPaso()));
