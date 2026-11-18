// Cocinas de referencia: plantillas paramétricas (lineal, en L, en U, isla).
// Se insertan con sus medidas generales y, si se cambia una medida, la cocina se vuelve a generar
// y los módulos se redistribuyen solos. Cada módulo guarda la plantilla en m.plantilla (texto JSON),
// así se conserva aunque el proyecto pase por Decap o se publique.
import { uid } from './modelo.js';

const T = 1.5; // espesor de frente (melamina 15 mm)
export const PLANTILLAS = {
  lineal: { nombre: 'Cocina lineal', medidas: ['largoA'] },
  L: { nombre: 'Cocina en L', medidas: ['largoA', 'largoB'] },
  U: { nombre: 'Cocina en U', medidas: ['largoA', 'largoB', 'largoC'] },
  isla: { nombre: 'Isla', medidas: ['largoA'] },
  // Islas completas (inspiradas en la referencia del cliente): todo se ajusta desde el panel
  isla_barra: { nombre: 'Isla con barra', medidas: ['largoA', 'huecoSillas', 'vueloSillas', 'vueloCocina', 'vueloExtremos'], opciones: ['listones', 'luz'] },
  isla_trabajo: { nombre: 'Isla de trabajo (doble cara)', medidas: ['largoA', 'fondoAtras', 'vueloSillas'], opciones: ['luz'], extra: ['artefacto'] },
  isla_mesa: { nombre: 'Isla con mesa', medidas: ['largoA', 'largoMesa', 'vueloSillas'], opciones: ['listones', 'luz'] },
};
// Campos de las islas que aceptan 0 y opciones de lista
export const CERO_OK = ['x', 'z', 'vueloSillas', 'vueloCocina', 'vueloExtremos', 'huecoSillas'];
export const SELECTS = { artefacto: { ninguno: 'Sin artefacto', lavaplatos_1: 'Lavaplatos 1 cuba', lavaplatos_2: 'Lavaplatos 2 cubas', encimera_gas: 'Encimera a gas', encimera_electrica: 'Encimera eléctrica' } };
export const ETIQUETAS = {
  largoA: 'Largo pared principal', largoB: 'Largo lado izquierdo', largoC: 'Largo lado derecho',
  fondo: 'Fondo basales', alto: 'Alto basales', zocalo: 'Zócalo',
  altoAereo: 'Alto aéreos', sepAereo: 'Separación cubierta–aéreos', fondoAereo: 'Fondo aéreos',
  x: 'Posición X', z: 'Posición Z',
  vueloSillas: 'Vuelo lado sillas', vueloCocina: 'Vuelo lado cocina', vueloExtremos: 'Vuelo en los extremos',
  fondoAtras: 'Fondo del lado de atrás', largoMesa: 'Largo de la mesa', huecoSillas: 'Hueco para sillas (listones hacia adentro)',
  listones: 'Listones de madera en el lado de las sillas', luz: 'Luz LED bajo la cubierta', artefacto: 'Sobre la cubierta',
};
export function parametrosIniciales(tipo, espacio) {
  const P = (espacio?.puntos || []).filter(Boolean);
  const xs = P.map((p) => +p.x), zs = P.map((p) => +p.z);
  const conMuros = P.length >= 2;
  const ancho = conMuros ? Math.max(...xs) - Math.min(...xs) : 300;
  const fondoEsp = conMuros ? Math.max(...zs) - Math.min(...zs) : 220;
  const x0 = conMuros ? Math.min(...xs) : 0, z0 = conMuros ? Math.min(...zs) : 0;
  const base = { x: x0, z: z0, fondo: 58, alto: 88, zocalo: 10, aereos: true, altoAereo: 70, sepAereo: 60, fondoAereo: 35, lavaplatos: true, cocina: true };
  if (tipo === 'isla') return { ...base, largoA: 150, aereos: false, lavaplatos: false, cocina: false, x: x0 + Math.max(0, (ancho - 150) / 2), z: z0 + 60 + 90 };
  const techo = +espacio?.alto || 240;
  // Islas: centradas en el espacio, a ~95 cm de los muebles del muro del fondo
  const isla = (L, extra) => ({ ...base, aereos: false, lavaplatos: false, cocina: false, alto: 90, zocalo: 10, techo, largoA: L,
    x: x0 + Math.max(0, (ancho - L) / 2), z: z0 + 60 + 95, luz: true, ...extra });
  if (tipo === 'isla_barra') return isla(180, { fondo: 60, huecoSillas: 35, vueloSillas: 2, vueloCocina: 2, vueloExtremos: 0, listones: true });
  if (tipo === 'isla_trabajo') return isla(200, { fondo: 58, fondoAtras: 35, vueloSillas: 25, artefacto: 'encimera_electrica' });
  if (tipo === 'isla_mesa') return isla(120, { fondo: 60, largoMesa: 90, vueloSillas: 25, listones: true });
  return { ...base, largoA: Math.round(ancho) || 300, largoB: Math.min(240, Math.round(fondoEsp) || 200), largoC: Math.min(240, Math.round(fondoEsp) || 200) };
}

// Reparte un largo en módulos de ~60 cm (entre 30 y 90), en múltiplos de 0,5 cm y sumando exacto.
function repartir(largo) {
  if (largo < 1) return [];
  if (largo < 30) return [largo]; // relleno angosto
  let n = Math.max(1, Math.round(largo / 60));
  while (largo / n > 90) n++;
  while (n > 1 && largo / n < 30) n--;
  const w = Math.round((largo / n) * 2) / 2;
  return [...Array(n - 1).fill(w), Math.round((largo - w * (n - 1)) * 10) / 10];
}

function columnasPara(ancho, util, rol, i) {
  if (rol === 'relleno') return [{ ancho, frentes: [{ tipo: 'panel', alto: util }] }];
  if (rol === 'lavaplatos' || ancho > 45) return [{ ancho, frentes: [{ tipo: 'puerta_doble', alto: util, bisagra: 'izquierda' }] }];
  if (rol === 'cajonera') {
    const h = Math.round((util / 3) * 2) / 2;
    return [{ ancho, frentes: [{ tipo: 'cajon', alto: h }, { tipo: 'cajon', alto: h }, { tipo: 'cajon', alto: Math.round((util - 2 * h) * 10) / 10 }] }];
  }
  return [{ ancho, frentes: [{ tipo: 'puerta', alto: util, bisagra: i % 2 ? 'derecha' : 'izquierda' }] }];
}

/**
 * Genera los módulos de una plantilla.
 * @returns módulos listos para el editor (con m.plantilla = '{"g":id,"t":tipo,"p":{...}}')
 */
export function generar(tipo, p, gid = uid('g')) {
  const meta = JSON.stringify({ g: gid, t: tipo, p });
  const util = p.alto - p.zocalo;
  const modulos = [];
  const base = (nombre, ancho, x, z, rot, rol, i = 0) => ({
    id: uid(), nombre, tipo: 'base', ancho, alto: p.alto, profundidad: p.fondo, zocalo: p.zocalo, zocalo_retiro: 5,
    x, z, rotacion: rot, elevacion: 0, cubierta: true,
    columnas: columnasPara(ancho, util, rol, i), tiradores: [], plantilla: meta,
  });
  const aereo = (nombre, ancho, x, z, rot) => {
    const doble = ancho > 45; // una hoja no pasa de 45 cm
    const cols = doble ? [{ ancho: ancho / 2, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'izquierda' }] }, { ancho: ancho / 2, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'derecha' }] }]
      : [{ ancho, frentes: [{ tipo: 'puerta', alto: p.altoAereo, bisagra: 'izquierda' }] }];
    return {
      id: uid(), nombre, tipo: 'aereo', ancho, alto: p.altoAereo, profundidad: p.fondoAereo, zocalo: 0, zocalo_retiro: 5,
      x, z, rotacion: rot, elevacion: p.alto + 3.8 + p.sepAereo, cubierta: false, columnas: cols, tiradores: [], plantilla: meta,
    };
  };

  if (tipo.startsWith('isla_')) return generarIsla(tipo, p, meta);
  if (tipo === 'isla') {
    // Almacenaje hacia la cocina (giro 180: el frente mira a -z); el lado de los pisos queda hacia el comedor
    const D = p.fondo + T;
    const cols = repartir(p.largoA).map((w, i) => columnasPara(w, util, i === 0 ? 'cajonera' : 'puerta', i)[0]);
    modulos.push({ ...base('Isla', p.largoA, p.x + p.largoA, p.z + D, 180, 'puerta'), tipo: 'isla', columnas: cols });
    return modulos;
  }

  // --- Pared principal: [relleno/módulos] [lavaplatos 80] [módulos] [hueco cocina 76] [módulos]
  const A = p.largoA;
  const fijos = [];
  if (p.lavaplatos) fijos.push({ rol: 'lavaplatos', ancho: 80 });
  if (p.cocina) fijos.push({ rol: 'hueco', ancho: 76 });
  let resto = A - fijos.reduce((a, f) => a + f.ancho, 0);
  while (resto < 0 && fijos.length) { resto += fijos.pop().ancho; } // no cabe: se quitan cocina y lavaplatos
  const partes = fijos.length === 2 ? [.2, .45, .35] : fijos.length === 1 ? [.4, .6] : [1];
  const tramos = [];
  partes.forEach((f, i) => {
    tramos.push({ rol: 'tramo', ancho: Math.round(resto * f * 2) / 2 });
    if (fijos[i]) tramos.push(fijos[i]);
  });
  // el último tramo absorbe el redondeo
  const suma = tramos.reduce((a, t) => a + t.ancho, 0);
  tramos.filter((t) => t.rol === 'tramo').at(-1).ancho = Math.round((tramos.filter((t) => t.rol === 'tramo').at(-1).ancho + A - suma) * 10) / 10;

  let x = p.x;
  let n = 0;
  for (const t of tramos) {
    if (t.rol === 'hueco') { x += t.ancho; continue; } // espacio para la cocina (artefacto)
    if (t.rol === 'lavaplatos') {
      modulos.push(base('Lavaplatos', 80, x, p.z, 0, 'lavaplatos'));
      if (p.aereos) modulos.push(aereo('Aéreo lavaplatos', 80, x, p.z, 0));
      x += 80; continue;
    }
    repartir(t.ancho).forEach((w, i) => {
      const rol = w < 30 ? 'relleno' : i === 0 ? 'cajonera' : 'puerta';
      modulos.push(base(rol === 'relleno' ? 'Relleno' : `Basal ${++n}`, w, x, p.z, 0, rol, i));
      if (p.aereos && rol !== 'relleno') modulos.push(aereo(`Aéreo ${n}`, w, x, p.z, 0));
      x += w;
    });
  }

  // --- Lados (en L: izquierdo; en U: izquierdo y derecho). Empiezan después del fondo de la pared principal.
  const desde = p.z + p.fondo + T;
  const lado = (largo, izquierdo) => {
    const libre = largo - (p.fondo + T);
    let z = desde;
    repartir(Math.max(0, libre)).forEach((w, i) => {
      const rol = w < 30 ? 'relleno' : i === 0 ? 'cajonera' : 'puerta';
      // giro 90 (lado izquierdo): el ancho avanza hacia -z, el origen va en el extremo lejano
      // giro 270 (lado derecho): el ancho avanza hacia +z, el origen va en el extremo cercano
      if (izquierdo) modulos.push(base(`Lado izq. ${i + 1}`, w, p.x, z + w, 90, rol, i));
      else modulos.push(base(`Lado der. ${i + 1}`, w, p.x + A, z, 270, rol, i));
      z += w;
    });
  };
  if (tipo === 'L' || tipo === 'U') lado(p.largoB, true);
  if (tipo === 'U') lado(p.largoC, false);
  return modulos;
}

// ----- islas completas -----
// Almacenaje hacia la cocina (giro 180: el frente mira a -z); el lado de las sillas queda hacia +z (atrás del mueble).
// Devuelve los módulos y, aparte (en .objetos), las lámparas colgantes; todo lleva la misma plantilla.
function generarIsla(tipo, p, meta) {
  const util = p.alto - p.zocalo, D = p.fondo, out = [], objetos = [];
  const cols = (L) => repartir(L).map((w, i) => columnasPara(w, util, i === 0 && L >= 60 ? 'cajonera' : 'puerta', i)[0]);
  const madera = 'liston:color:#a97d4d';
  const modulo = (o) => ({ id: uid(), tipo: 'isla', zocalo: p.zocalo, zocalo_retiro: 5, elevacion: 0, cubierta: true, tiradores: [], plantilla: meta, alto: p.alto, profundidad: D, ...o });
  const luz = (lado) => (p.luz ? [{ id: uid('l'), en: 'cubierta', lado, tono: 'calida', intensidad: .85 }] : []);
  const z0 = p.z + D + T; // atrás del cuerpo de cocina (lado de las sillas)
  if (tipo === 'isla_barra') {
    // los costados se alargan hasta la línea de la cubierta y los listones quedan huecoSillas cm hacia adentro
    const hueco = Math.max(0, +p.huecoSillas || 0);
    out.push(modulo({ nombre: 'Isla con barra', ancho: p.largoA, x: p.x + p.largoA, z: z0, rotacion: 180, columnas: cols(p.largoA), costados_atras: hueco,
      vuelo_atras: hueco + p.vueloSillas, vuelo_frente: p.vueloCocina, vuelo_izq: p.vueloExtremos, vuelo_der: p.vueloExtremos,
      ...(p.listones ? { materiales: { 'cuerpo|fondo': madera } } : {}), luces: luz('atras') }));
  }
  if (tipo === 'isla_trabajo') { // dos cuerpos espalda con espalda: cocina adelante y almacenaje bajo atrás, una sola cubierta
    const Da = Math.max(20, p.fondoAtras), g = meta && JSON.parse(meta).g;
    const art = SELECTS.artefacto[p.artefacto] && p.artefacto !== 'ninguno' ? p.artefacto : null;
    const anchoArt = { lavaplatos_1: 80, lavaplatos_2: 100, encimera_gas: 58, encimera_electrica: 60 }[art] || 0;
    out.push(modulo({ nombre: 'Isla · lado cocina', ancho: p.largoA, x: p.x + p.largoA, z: z0, rotacion: 180, columnas: cols(p.largoA),
      vuelo_atras: Da + T + p.vueloSillas, vuelo_frente: 2, grupo: g, grupo_nombre: 'Isla de trabajo', luces: luz('atras'),
      ...(art ? { artefactos: [{ id: uid('a'), tipo: art, ancho: Math.min(anchoArt, p.largoA - 10), fondo: art.startsWith('lava') ? 50 : 52, desde: Math.round((p.largoA - Math.min(anchoArt, p.largoA - 10)) / 2), frente: 5, ...(art.startsWith('lava') ? { lado: 'derecha' } : {}) }] } : {}) }));
    out.push(modulo({ nombre: 'Isla · lado atrás', ancho: p.largoA, x: p.x, z: z0, rotacion: 0, profundidad: Da, cubierta: false, grupo: g, grupo_nombre: 'Isla de trabajo',
      columnas: repartir(p.largoA).map((w, i) => columnasPara(w, util, 'puerta', i)[0]) }));
  }
  if (tipo === 'isla_mesa') { // almacenaje + la cubierta se alarga como mesa, apoyada en un costado (pata panel) hasta el piso
    const M = Math.max(40, p.largoMesa), g = meta && JSON.parse(meta).g;
    out.push(modulo({ nombre: 'Isla con mesa', ancho: p.largoA, x: p.x + p.largoA, z: z0, rotacion: 180, columnas: cols(p.largoA),
      vuelo_atras: p.vueloSillas, vuelo_frente: 2, vuelo_izq: M, grupo: g, grupo_nombre: 'Isla con mesa',
      ...(p.listones ? { materiales: { 'cuerpo|fondo': madera } } : {}), luces: luz('atras') }));
    // pata: panel del alto del mueble bajo el extremo de la mesa (mismo fondo que la cubierta)
    out.push(modulo({ nombre: 'Pata de la mesa', ancho: 2 * T + .1, x: p.x + p.largoA + M, z: z0 + p.vueloSillas, rotacion: 180, zocalo: 0, cubierta: false,
      profundidad: D + p.vueloSillas + 2, grupo: g, grupo_nombre: 'Isla con mesa', columnas: [{ ancho: 2 * T + .1, frentes: [{ tipo: 'panel', alto: p.alto }] }] }));
  }
  // lámparas colgantes: el cotizador es solo de muebles, las islas ya no las traen (se agregan aparte si se quieren)
  const n = 0;
  const largo = p.largoA + (tipo === 'isla_mesa' ? Math.max(40, p.largoMesa) : 0);
  const zc = p.z + (D + T + (tipo === 'isla_trabajo' ? Math.max(20, p.fondoAtras) + T : 0)) / 2 + (tipo === 'isla_trabajo' ? 0 : p.vueloSillas / 2);
  const elev = p.alto + 3.8 + 75;
  for (let i = 0; i < n; i++) {
    objetos.push({ id: uid('o'), tipo: 'colgante', nombre: 'Lámpara colgante', ancho: 16, alto: 24, fondo: 16, rotacion: 0, plantilla: meta,
      x: Math.round((p.x + largo * (i + 1) / (n + 1)) * 10) / 10, z: Math.round(zc * 10) / 10, elevacion: elev, cable: Math.max(0, Math.round(((+p.techo || 240) - elev - 24) * 10) / 10) });
  }
  out.objetos = objetos;
  return out;
}

export const leerPlantilla = (m) => { try { return m?.plantilla ? JSON.parse(m.plantilla) : null; } catch { return null; } };
