// Escena del portal en CSS 3D (sin WebGL ni Three.js): misma interfaz que tenía scene.js,
// así app.js no cambia. Dibuja con el mismo código que el editor de modelos (editor/modelo.js),
// por lo que el cliente ve exactamente lo que el estudio diseñó: muros, muebles y tiradores.
import { createStage } from '../css3d/engine.js';
import { dibujar, limites, tiradoresCliente, espacioPortal } from '../editor/modelo.js';
import { matsColores } from '../editor/colores.js';

const VISTAS = { 'tres-cuartos': [-24, -32], frente: [-6, 0], planta: [-88, 0] };

export function createScene(el) {
  // Contenedor propio para el escenario (el visor tiene otros hijos: pines, avisos)
  const host = document.createElement('div');
  host.className = 'pcss';
  host.style.cssText = 'position:absolute;inset:0;';
  el.prepend(host);
  const st = createStage(host, { rx: VISTAS['tres-cuartos'][0], ry: VISTAS['tres-cuartos'][1], minRx: -89, maxRx: -2 });

  let soloMuebles = (() => { try { return localStorage.getItem('dm-portal-solo') === '1'; } catch { return false; } })();
  let proyecto = null, sel = {}, roomVisible = true, zoom = 1, modeloActual = null, catalogo = [], piezaSel = null;
  // Fondo CSS de un material por pieza: melamina del catálogo (id) o color ('color:#rrggbb')
  const fondoMaterial = (mid) => {
    if (!mid) return null;
    if (mid.startsWith('liston:')) { const b = fondoMaterial(mid.slice(7)); return b ? `repeating-linear-gradient(90deg, rgba(0, 0, 0, .32) 0 .4em, rgba(0, 0, 0, .06) .4em .9em, transparent .9em 4.2em), ${b}` : null; }
    if (mid.startsWith('color:')) return mid.slice(6);
    const x = catalogo.find((k) => k.id === mid);
    return x ? (x.imagen && x.tipo !== 'unicolor' ? `url('${x.imagen}') center / 60em 60em, ${x.hex}` : x.hex) : null;
  };
  const leerJSON = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
  const listeners = [];
  st.onApply(() => listeners.forEach((fn) => fn()));

  // Materiales según la elección del cliente
  function mats(s) {
    const m = s.melamina;
    const frente = m ? (m.imagen && m.tipo !== 'unicolor' ? `url('${m.imagen}') center / 60em 60em, ${m.hex}` : m.hex) : '#cfc6b8';
    return { ...matsColores(proyecto?.colores, frente), cubierta: s.cubierta?.color || '#cfc9bc', borde: s.borde?.perfil || 'recto', material: fondoMaterial };
  }
  function modelo(s) {
    // muebles que el cliente desmarcó en «Muebles a cotizar»: desaparecen (las cocinas de piso no se cotizan y quedan)
    const elegidos = Array.isArray(s.modulos) && s.modulos.length ? new Set(s.modulos) : null;
    const visible = (m, i) => !elegidos || m.artefacto || elegidos.has(m.id || `m${i}`);
    return {
      espacio: espacioPortal(proyecto.espacio),
      objetos: soloMuebles ? [] : proyecto.objetos || [], // «Solo muebles»: sin electrodomésticos ni referencias
      modulos: (proyecto.modulos || []).map((m, i) => ({ m, i })).filter(({ m, i }) => !(soloMuebles && m.artefacto) && visible(m, i)).map(({ m, i }) => ({
        ...m, id: m.id || `m${i}`,
        ...(soloMuebles ? { artefactos: [] } : {}), // sin encimeras ni lavaplatos de referencia
        // materiales por pieza: los del estudio y encima los que eligió el cliente ("idMódulo|pieza")
        materiales: { ...leerJSON(m.materiales), ...Object.fromEntries(Object.entries(s.materiales || {}).filter(([k]) => k.startsWith(`${m.id || `m${i}`}|`)).map(([k, v]) => [k.slice(k.indexOf('|') + 1), v])) },
        x: +m.x || 0, z: +m.z || 0, elevacion: +m.elevacion || 0, rotacion: +m.rotacion || 0,
        tiradores: tiradoresCliente(m, s.tirador),
      })),
    };
  }
  function build() {
    modeloActual = modelo(sel);
    dibujar(st, modeloActual, { capas: { muros: roomVisible, cantoMuro: false }, mats: mats(sel), sel: piezaSel }); // el cliente no ve el borde superior de los muros
    listeners.forEach((fn) => fn());
  }
  function encuadrar() {
    const L = limites(modeloActual, { conMuros: roomVisible });
    const diag = Math.hypot(L.w, L.h, L.d);
    const Wp = host.clientWidth || 800, Hp = host.clientHeight || 600;
    const px = (Math.min(Wp, Hp) / (diag * (Wp < Hp ? 1.05 : 1.2))) * zoom; // px por cm
    st.frame([(L.x0 + L.x1) / 2, L.h / 2, (L.z0 + L.z1) / 2], Math.min(Wp, Hp) / px, 1);
  }
  new ResizeObserver(() => { if (modeloActual) encuadrar(); }).observe(host);

  // Zoom: rueda del mouse y pellizco con dos dedos
  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(.5, Math.min(4, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    encuadrar();
  }, { passive: false });
  const toques = new Map();
  let pellizco = null;
  host.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') toques.set(e.pointerId, [e.clientX, e.clientY]); });
  host.addEventListener('pointermove', (e) => {
    if (!toques.has(e.pointerId)) return;
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    if (toques.size === 2) {
      const [a, b] = [...toques.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pellizco) { zoom = Math.max(.5, Math.min(4, pellizco.z * d / pellizco.d)); encuadrar(); } else pellizco = { d, z: zoom };
    }
  });
  const soltar = (e) => { toques.delete(e.pointerId); if (toques.size < 2) pellizco = null; };
  host.addEventListener('pointerup', soltar); host.addEventListener('pointercancel', soltar);

  // ----- selección de un punto del modelo (pines de comentarios)
  // Se toma la cara bajo el cursor y se invierte su transformación CSS (homografía del plano de la
  // cara a la pantalla) para obtener el punto exacto en cm, en las mismas coordenadas del proyecto.
  const matrizDe = (n) => { const t = getComputedStyle(n).transform; return new DOMMatrix(t === 'none' ? undefined : t); };
  function cadena(face) { // matriz de la cara al espacio del rig (px)
    let M = matrizDe(face);
    for (let n = face.parentElement; n && n !== st.rig; n = n.parentElement) M = matrizDe(n).multiply(M);
    return M;
  }
  function pick(clientX, clientY) {
    const face = document.elementFromPoint(clientX, clientY)?.closest('.c3-f[data-ref]');
    if (!face || !host.contains(face)) return null;
    const local = cadena(face), T = st.proyeccion().multiply(local);
    const r = host.getBoundingClientRect();
    const sx = clientX - (r.left + r.width / 2), sy = clientY - (r.top + r.height / 2);
    // (u, v) en la cara → pantalla: [x', y', w'] = H · (u, v, 1)
    const H = [[T.m11, T.m21, T.m41], [T.m12, T.m22, T.m42], [T.m14, T.m24, T.m44]];
    // resolver H·(u,v,1) ∝ (sx, sy, 1)
    const a = [[H[0][0] - sx * H[2][0], H[0][1] - sx * H[2][1]], [H[1][0] - sy * H[2][0], H[1][1] - sy * H[2][1]]];
    const bb = [sx * H[2][2] - H[0][2], sy * H[2][2] - H[1][2]];
    const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
    if (Math.abs(det) < 1e-9) return null;
    const u = (bb[0] * a[1][1] - a[0][1] * bb[1]) / det, v = (a[0][0] * bb[1] - bb[0] * a[1][0]) / det;
    const p = local.transformPoint(new DOMPoint(u, v, 0, 1));
    const s = st.scale; // px por cm
    const ref = face.dataset.ref.split('|');
    const mod = modeloActual.modulos.find((m) => m.id === ref[0]);
    return { x: +(p.x / s).toFixed(1), y: +(-p.y / s).toFixed(1), z: +(p.z / s).toFixed(1), modulo: mod?.nombre || '' };
  }
  // Proyecta un punto 3D (cm) a la pantalla, relativo al visor
  function toScreen(p) {
    const s = st.scale, T = st.proyeccion();
    const q = T.transformPoint(new DOMPoint(p.x * s, -p.y * s, p.z * s, 1));
    const W = host.clientWidth, Hh = host.clientHeight;
    const x = W / 2 + q.x / q.w, y = Hh / 2 + q.y / q.w;
    return { x, y, visible: q.w > 0 && x > -10 && x < W + 10 && y > -10 && y < Hh + 10 };
  }

  return {
    setProject(p, s, cat = []) { proyecto = p; sel = s || {}; catalogo = cat; build(); encuadrar(); st.set(...VISTAS['tres-cuartos']); },
    // Pieza seleccionada para cambiarle el color (ref "idMódulo|pieza"; se resalta)
    seleccionar(ref) { piezaSel = ref || null; build(); },
    update(s) { sel = s || {}; build(); },
    view(nombre = 'tres-cuartos') { zoom = 1; encuadrar(); st.view(...(VISTAS[nombre] || VISTAS['tres-cuartos'])); },
    toggleRoom() { roomVisible = !roomVisible; build(); encuadrar(); return roomVisible; },
    toggleSolo() { soloMuebles = !soloMuebles; try { localStorage.setItem('dm-portal-solo', soloMuebles ? '1' : '0'); } catch {} build(); return soloMuebles; },
    get soloMuebles() { return soloMuebles; },
    pick, toScreen,
    onRender(fn) { listeners.push(fn); },
    request() { listeners.forEach((fn) => fn()); },
    canvas: host,
  };
}
