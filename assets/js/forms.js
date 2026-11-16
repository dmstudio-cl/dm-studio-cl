// Envío de formularios a Web3Forms con fetch (sin recargar la página).
const ENDPOINT = 'https://api.web3forms.com/submit';

export function initForms(root = document) {
  root.querySelectorAll('form[data-web3forms]').forEach((form) => {
    const status = form.querySelector('.form-status');
    const btn = form.querySelector('[type="submit"]');
    const set = (state, msg) => { if (status) { status.dataset.state = state; status.textContent = msg; } };

    if (!window.DM.web3forms) {
      set('error', 'Formulario aún sin configurar. Mientras tanto, escríbenos por WhatsApp o correo.');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!window.DM.web3forms) return;
      const data = new FormData(form);
      if (data.get('botcheck')) return; // honeypot
      data.set('access_key', window.DM.web3forms);
      btn.disabled = true;
      set('', 'Enviando…');
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          form.reset();
          set('ok', form.dataset.success || '¡Gracias! Te responderemos a la brevedad.');
        } else {
          set('error', json.message || 'No pudimos enviar el formulario. Inténtalo de nuevo.');
        }
      } catch {
        set('error', 'Sin conexión. Revisa tu internet e inténtalo de nuevo.');
      } finally {
        btn.disabled = false;
      }
    });
  });
}
