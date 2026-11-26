// Escena del portal en CSS 3D (sin WebGL ni Three.js): misma interfaz que tenía scene.js,
// así app.js no cambia. Dibuja con el mismo código que el editor de modelos (editor/modelo.js),
// por lo que el cliente ve exactamente lo que el estudio diseñó: muros, muebles y tiradores.
import { createStage } from '../css3d/engine.js';
import { dibujar, limites, tiradoresCliente, espacioPortal, huella } from '../editor/modelo.js';
import { geoEsquinero, animarGiro, vueltaGiro, partesInterior } from '../editor/esquinero.js';
import { matsColores } from '../editor/colores.js';

const VISTAS = { 'tres-cuartos': [-24, -32], frente: [-6, 0], planta: [-88, 0] };

export function createScene(el) {
  // Contenedor propio para el escenario (el visor tiene otros hijos: pines, avisos)
  const host = document.createElement('div');
  host.className = 'pcss';
  host.style.cssText = 'position:absolute;inset:0;';
  el.prepend(host);
  const st = createStage(host, { rx: VISTAS['tres-cuartos'][0], ry: VISTAS['tres-cuartos'][1], minRx: -89, maxRx: -2 });
  st.panLimit(300); // moverse por el entorno hasta 3 m del centro (clic derecho, 2 dedos o las flechas en pantalla)

  let soloMuebles = (() => { try { return localStorage.getItem('dm-portal-solo') === '1'; } catch { return false; } })();
  let proyecto = null, sel = {}, roomVisible = true, zoom = 1, modeloActual = null, catalogo = [], piezaSel = null;
  let foco = null; // mueble enfocado (dueño, 2026-11-25): { id, abiertos: [claves de puertas y cajones abiertos] }
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
  // Tipo de esquina elegido por el cliente, si es uno de los que ofrece el proyecto (dueño, 2026-11-25)
  function esquinaElegida(m, i, s) {
    const id = m.id || `m${i}`, sol = s.esquineros?.[id];
    return m.tipo === 'esquinero' && sol && (proyecto.esquineros_opciones?.[id] || []).includes(sol) ? sol : null;
  }
  // La cocina con el tipo de esquina que eligió el cliente (dueño, 2026-11-26): los muebles de esa esquina como quedan
  // (esquinero y basales reacomodados) y sin los que absorbió el esquinero. Lo mismo que cotiza el Worker.
  function conVariantes(mods, s) {
    for (const [id, sol] of Object.entries(s.esquineros || {})) {
      const v = proyecto.esquineros_variantes?.[id]?.[sol]; if (!v) continue;
      const nuevos = Object.fromEntries(v.modulos.map((m) => [m.id, m]));
      mods = mods.filter((m) => !v.quitados.includes(m.id)).map((m) => nuevos[m.id] || m);
      for (const m of v.modulos) if (!mods.some((x) => x.id === m.id)) mods.push(m); // un basal que reaparece
    }
    return mods;
  }
  function modelo(s) {
    // muebles que el cliente desmarcó en «Muebles a cotizar»: desaparecen (las cocinas de piso no se cotizan y quedan)
    const elegidos = Array.isArray(s.modulos) && s.modulos.length ? new Set(s.modulos) : null;
    const visible = (m, i) => !elegidos || m.artefacto || elegidos.has(m.id || `m${i}`) || !(proyecto.modulos || []).some((x) => x.id === m.id); // uno que reaparece con el tipo de esquina se ve
    return {
      espacio: espacioPortal(proyecto.espacio),
      objetos: soloMuebles ? [] : proyecto.objetos || [], // «Solo muebles»: sin electrodomésticos ni referencias
      modulos: conVariantes(proyecto.modulos || [], s).map((m, i) => ({ m, i })).filter(({ m, i }) => !(soloMuebles && m.artefacto) && visible(m, i)).map(({ m, i }) => ({
        ...m, id: m.id || `m${i}`,
        ...(soloMuebles ? { artefactos: [] } : {}), // sin encimeras ni lavaplatos de referencia
        // materiales por pieza: los del estudio y encima los que eligió el cliente ("idMódulo|pieza")
        materiales: { ...leerJSON(m.materiales), ...Object.fromEntries(Object.entries(s.materiales || {}).filter(([k]) => k.startsWith(`${m.id || `m${i}`}|`)).map(([k, v]) => [k.slice(k.indexOf('|') + 1), v])) },
        x: +m.x || 0, z: +m.z || 0, elevacion: +m.elevacion || 0, rotacion: +m.rotacion || 0,
        tiradores: tiradoresCliente(m, s.tirador),
        ...(esquinaElegida(m, i, s) ? { solucion: esquinaElegida(m, i, s) } : {}), // tipo de esquina que eligió el cliente
      })),
    };
  }
  function build() {
    modeloActual = modelo(sel);
    dibujar(st, modeloActual, { capas: { muros: roomVisible, cantoMuro: false }, mats: mats(sel), sel: piezaSel, interior: foco, abrir: foco }); // el cliente no ve el borde superior de los muros
    if (foco) { // con un mueble enfocado, lo demás queda tenue y no toma los toques (no lo tapa ni se lleva el clic)
      animarGiro(st.rig, foco.abiertos.includes('auto')); // la puerta giratoria enfocada gira sola
      for (const f of st.rig.querySelectorAll('.c3-f[data-ref]')) { const r = f.dataset.ref; if (!r.startsWith(`${foco.id}|`) && !r.startsWith('muro|') && !r.startsWith('vano|')) f.classList.add('c3-tenue'); }
    }
    listeners.forEach((fn) => fn());
  }
  // Encuadre de un mueble (centro y tamaño, cm)
  function marcoDe(m) {
    const h = huella(m), xs = h.map((q) => q[0]), zs = h.map((q) => q[1]);
    return { c: [(Math.min(...xs) + Math.max(...xs)) / 2, +m.elevacion + +m.alto / 2, (Math.min(...zs) + Math.max(...zs)) / 2], size: Math.hypot(+m.ancho, +m.profundidad, +m.alto) * 2 };
  }
  // Acercamiento suave (0,6 s): solo se mueve la cámara, no se vuelve a dibujar nada
  let vuelo = 0, encuadreAct = null;
  function volarA(c, size) {
    const de = encuadreAct || { c: st.center, size }, t0 = performance.now(), ease = (t) => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    cancelAnimationFrame(vuelo);
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / 600), k = ease(t);
      const cc = de.c.map((v, i) => v + (c[i] - v) * k), ss = de.size + (size - de.size) * k;
      st.frame(cc, ss, 1); encuadreAct = { c: cc, size: ss };
      if (t < 1) vuelo = requestAnimationFrame(paso);
    };
    vuelo = requestAnimationFrame(paso);
  }
  function marcoGeneral() {
    const L = limites(modeloActual, { conMuros: roomVisible }), diag = Math.hypot(L.w, L.h, L.d), Wp = host.clientWidth || 800, Hp = host.clientHeight || 600;
    const px = (Math.min(Wp, Hp) / (diag * (Wp < Hp ? 1.05 : 1.2))) * zoom;
    return { c: [(L.x0 + L.x1) / 2, L.h / 2, (L.z0 + L.z1) / 2], size: Math.min(Wp, Hp) / px };
  }
  function encuadrar() {
    if (foco) { const m = modeloActual.modulos.find((x) => x.id === foco.id); if (m) { const f = marcoDe(m); st.frame(f.c, f.size / zoom, 1); encuadreAct = { c: f.c, size: f.size / zoom }; return; } }
    const g0 = marcoGeneral(); encuadreAct = g0;
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
    // ----- mueble enfocado (portal, dueño 2026-11-25): acercamiento a una vista 3/4 del mueble (la cámara se puede
    // mover) y sus puertas y cajones se abren y cierran con un toque
    get foco() { return foco?.id || null; },
    esMueble(id) { return !!modeloActual?.modulos.find((m) => m.id === id && !m.artefacto); },
    modulos() { return modeloActual?.modulos || []; }, // como se ven (con el tipo de esquina elegido)
    enfocar(id) {
      const m = modeloActual?.modulos.find((x) => x.id === id); if (!m) return;
      const esq = m.tipo === 'esquinero' ? geoEsquinero(m) : null;
      foco = { id, abiertos: esq?.sol === '1' ? ['auto'] : [] }; zoom = 1;
      build();
      const f = marcoDe(m), r = +m.rotacion || 0;
      st.resetPan(); volarA(f.c, f.size);
      st.view(esq?.sol ? -30 : -26, (esq ? (m.esquina === 'izq' ? -45 : 45) : -10) - r); // casi de frente al mueble, así los vecinos no lo tapan (el esquinero, hacia el rincón)
    },
    desenfocar() {
      if (!foco) return; foco = null; zoom = 1; build();
      const f = marcoGeneral(); st.resetPan(); volarA(f.c, f.size); st.view(...VISTAS['tres-cuartos']);
    },
    // abre o cierra una puerta o cajón del mueble enfocado (clave = data-esq-anim del grupo)
    alternar(key, hoja) {
      if (!foco) return;
      const m = modeloActual.modulos.find((x) => x.id === foco.id);
      if (hoja) { foco.abiertos = foco.abiertos.filter((k) => k !== 'auto'); vueltaGiro(st.rig, hoja, m?.esquina === 'izq'); return; } // puerta giratoria: una vuelta
      const abierto = !foco.abiertos.includes(key);
      foco.abiertos = abierto ? [...foco.abiertos, key] : foco.abiertos.filter((k) => k !== key);
      if (key === 'auto') { animarGiro(st.rig, abierto); return; }
      for (const g of st.rig.querySelectorAll('[data-esq-anim]')) if (g.dataset.esqAnim === key) g.style.transform = abierto ? g.dataset.abierto : g.dataset.cerrado;
    },
    // abrir o cerrar todo lo del mueble enfocado
    todos(abrir) {
      if (!foco) return;
      const claves = [...new Set([...st.rig.querySelectorAll('[data-esq-anim]')].map((g) => g.dataset.esqAnim))].filter((k) => k !== 'giro');
      foco.abiertos = abrir ? claves : [];
      animarGiro(st.rig, false);
      for (const g of st.rig.querySelectorAll('[data-esq-anim]')) g.style.transform = abrir && g.dataset.esqAnim !== 'giro' ? g.dataset.abierto : g.dataset.cerrado;
    },
    nombreFoco() { return foco && modeloActual.modulos.find((x) => x.id === foco.id)?.nombre || ''; },
    partesEsquinero() { const m = foco && modeloActual.modulos.find((x) => x.id === foco.id); return m?.tipo === 'esquinero' ? partesInterior(m).filter((p) => p.key !== 'giro') : []; },
    abiertos() { return foco?.abiertos || []; },
    onRender(fn) { listeners.push(fn); },
    request() { listeners.forEach((fn) => fn()); },
    canvas: host,
  };
}
