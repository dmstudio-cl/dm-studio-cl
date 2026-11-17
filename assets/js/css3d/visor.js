// Visor CSS 3D del sitio (fichas de producto y proyectos del portafolio). Sin WebGL ni Three.js.
//   data-procedural="aparador"   → modelo procedural (css3d/aparador.js)
//   data-modelo-css="/ruta.json" → modelo exportado desde el Editor de modelos («Guardar .json»)
//   data-autorotate              → gira solo hasta que el usuario lo toca
// Usa el mismo dibujo que el editor y el portal (editor/modelo.js).
import { createStage } from './engine.js';

export async function mountVisor(el) {
  const autorotate = el.dataset.autorotate !== undefined;
  if (el.dataset.procedural === 'aparador') {
    const { mountAparador } = await import('./aparador.js');
    return mountAparador(el, { autorotate });
  }
  const url = el.dataset.modeloCss;
  if (!url) return null;
  try {
    const [modelo, melaminas, { dibujar, limites }] = await Promise.all([
      fetch(url).then((r) => { if (!r.ok) throw new Error(`No se encontró el modelo (${r.status})`); return r.json(); }),
      fetch(`${window.DM.base}/assets/data/melaminas.json`).then((r) => r.json()).catch(() => []),
      import('../editor/modelo.js'),
    ]);
    if (!Array.isArray(modelo.modulos)) throw new Error('El archivo no es un modelo del editor.');
    const st = createStage(el, { autorotate, rx: -18, ry: -32, minRx: -60, maxRx: -2 });
    const m = melaminas.find((x) => x.id === modelo.frente);
    const frente = m ? (m.imagen && m.tipo !== 'unicolor' ? `url('${m.imagen}') center / 60em 60em, ${m.hex}` : m.hex) : '#cfc6b8';
    const mod = {
      ...modelo,
      modulos: modelo.modulos.map((x, i) => ({ ...x, id: x.id || `m${i}`, x: +x.x || 0, z: +x.z || 0, elevacion: +x.elevacion || 0, rotacion: +x.rotacion || 0 })),
    };
    dibujar(st, mod, { capas: { muros: false }, mats: { frente } }); // en el catálogo se muestra solo el mueble
    const L = limites(mod, { conMuros: false });
    st.floorShadow({ w: L.w * 1.15, d: L.d * 1.6, x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, opacity: .55 });
    st.frame([(L.x0 + L.x1) / 2, L.h / 2, (L.z0 + L.z1) / 2], Math.hypot(L.w, L.h, L.d) * 1.05, .95);
    return st;
  } catch (e) {
    console.error(e);
    const aviso = el.querySelector('.viewer-loading');
    if (aviso) aviso.textContent = 'No se pudo cargar el modelo 3D.';
    return null;
  }
}
