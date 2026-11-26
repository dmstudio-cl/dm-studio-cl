// Vecinos del esquinero (dueño, 2026-11-24/26): pegar los basales agrupados a los laterales del esquinero y reacomodar
// la cocina al cambiar el tipo de esquina. Lo usan el editor (al elegir el tipo), la publicación (una variante por tipo
// para el portal) y la elección del cliente (el editor la aplica sola). Funciones puras sobre el modelo que reciben.
import { girar } from './modelo.js';
import { geoEsquinero, medidasSugeridas, ORDEN_SOLUCIONES, ORDEN_AEREO, solucionesQueCalzan } from './esquinero.js';

const r1 = (v) => Math.round(v * 10) / 10;
const cm = (v) => `${r1(v)}`.replace('.', ',');

// Cambia el largo del lado 1 sin mover el rincón
export function anchoEsquinero(m, v) {
  if (m.esquina !== 'izq') { const [ux, uz] = girar(1, 0, +m.rotacion || 0), d = v - +m.ancho; m.x = r1(+m.x - d * ux); m.z = r1(+m.z - d * uz); }
  m.ancho = v;
}
// Al agrupar 1 esquinero con basales (dueño, 2026-11-24): cada basal se pega al lateral del esquinero que le toca, a
// 0 cm, con la espalda en su muro. El que mira hacia el mismo lado que el esquinero va junto al lado 1; el que está
// girado 90°, junto al lado 2. Devuelve cuántos movió.
export function pegarAlEsquinero(mods) {
  const esq = mods.filter((m) => m.tipo === 'esquinero'); if (esq.length !== 1) return 0;
  const e = esq[0], r = +e.rotacion || 0, W = +e.ancho, L = +e.profundidad, izq = e.esquina === 'izq';
  const mundo = (lx, lz) => { const [dx, dz] = girar(lx, lz, r); return [r1(+e.x + dx), r1(+e.z + dz)]; };
  let n = 0;
  delete e.vecino_a; delete e.vecino_b;
  for (const b of mods) {
    if (b.anexo?.esq === e.id) { // anexo (basal absorbido): va dentro del esquinero, en el extremo de su lado
      const wx = +b.ancho; b.zocalo = e.zocalo; b.alto = e.alto;
      if (b.anexo.lado === 'a') { b.rotacion = r; [b.x, b.z] = mundo(izq ? W - wx : 0, 0); }
      else { b.rotacion = (r + (izq ? 90 : 270)) % 360; [b.x, b.z] = izq ? mundo(0, L) : mundo(W, L - wx); }
      n++; continue;
    }
    if (b === e || b.artefacto || b.tipo === 'esquinero' || (b.tipo === 'aereo') !== !!e.aereo) continue; // esquinero aéreo con aéreos; basal con basales
    if (e.aereo) b.elevacion = +e.elevacion || 0;
    const dr = ((((+b.rotacion || 0) - r) % 360) + 360) % 360, Wb = +b.ancho;
    if (Math.abs(dr) < 1 || Math.abs(dr - 360) < 1) { // lado 1: junto al muro de atrás
      [b.x, b.z] = mundo(izq ? W : -Wb, 0); e.vecino_a = true; n++;
    } else if (Math.abs(dr - 90) < 1 || Math.abs(dr - 270) < 1) { // lado 2: junto al muro del costado, mirando hacia adentro
      b.rotacion = (r + (izq ? 90 : 270)) % 360;
      [b.x, b.z] = izq ? mundo(0, L + Wb) : mundo(W, L); e.vecino_b = true; n++;
    }
  }
  return n;
}
// ----- Vecinos que se adaptan al esquinero (dueño, 2026-11-26) -----
// Al cambiar el tipo de esquina, el largo de cada muro (esquinero + basal agrupado a su lado) no cambia: el esquinero
// toma las medidas sugeridas del tipo nuevo y el basal absorbe la diferencia (sus puertas se vuelven a igualar).
// Mínimos del basal, por columna (dueño, 2026-11-26): cajones 30 cm; una columna de cajones que queda bajo 30 pasa a
// una puerta (1 hoja), que llega hasta 25 cm; las de puertas también hasta 25. Si ni así alcanza: en el space corner el
// esquinero lo absorbe y su lado se alarga hasta completar los dos muebles; en los demás tipos el basal se quita y ese
// espacio queda libre (vuelve a aparecer al cambiar a un tipo más chico). En el space corner, después de los cajones en L va
// siempre la puerta lateral (35 a 60 cm, para llegar al trapecio) y, a continuación, lo que tenía el basal (sus
// columnas, puertas o cajones, como «anexo» dentro del esquinero) si cabe con sus mínimos; si no cabe, la puerta
// lateral ocupa todo y sobre 60 cm se divide en 2 hojas. Al volver a un tipo más chico, el basal reaparece y crece.
const MIN_PUERTA_VECINO = 25, MIN_CAJON_VECINO = 30;
const conPuerta = (c) => (c?.frentes || []).some((f) => f.tipo === 'puerta' || f.tipo === 'puerta_doble');
const minColumna = (c) => (conPuerta(c) ? MIN_PUERTA_VECINO : MIN_CAJON_VECINO);
function ladoDelEsquinero(e, b) {
  const dr = ((((+b.rotacion || 0) - (+e.rotacion || 0)) % 360) + 360) % 360;
  return dr < 1 || dr > 359 ? 'a' : Math.abs(dr - 90) < 1 || Math.abs(dr - 270) < 1 ? 'b' : null;
}
// Anchos de columna del basal para un ancho nuevo sin bajar del mínimo de cada una: { anchos, puertas } o null si no
// cabe. puertas = columnas de cajones que pasan a una puerta para caber (su mínimo baja de 30 a 25).
function repartir(cs, W, mins) {
  const sm = mins.reduce((s, x) => s + x, 0), sc = cs.reduce((s, c) => s + +c.ancho, 0);
  if (W < sm - .05) return null;
  if (W >= sc || sc - sm < .05) return cs.map((c) => (+c.ancho * W) / sc);
  return cs.map((c, i) => mins[i] + ((W - sm) * (+c.ancho - mins[i])) / (sc - sm));
}
function anchosVecino(b, W) {
  const cs = b.columnas || [], sc = cs.reduce((s, c) => s + +c.ancho, 0);
  if (!cs.length || sc <= 0) return W >= MIN_PUERTA_VECINO ? { anchos: [], puertas: [] } : null;
  const a = repartir(cs, W, cs.map(minColumna)); if (a) return { anchos: a, puertas: [] };
  const b2 = repartir(cs, W, cs.map(() => MIN_PUERTA_VECINO)); if (!b2) return null; // los cajones que no alcanzan pasan a puerta
  return { anchos: b2, puertas: cs.map((c, i) => (!conPuerta(c) && b2[i] < MIN_CAJON_VECINO - .05 ? i : -1)).filter((i) => i >= 0) };
}
function ponerAncho(b, W, r) {
  // si alguna columna de cajones pasa a puerta, se guardan sus cajones para recuperarlos cuando vuelva a crecer
  if (r?.puertas?.length && !b.cajones_originales) b.cajones_originales = { columnas: JSON.parse(JSON.stringify(b.columnas)), tiradores: JSON.parse(JSON.stringify(b.tiradores || [])) };
  b.ancho = r1(W);
  if (r?.anchos?.length) {
    b.columnas.forEach((c, i) => { c.ancho = +r.anchos[i].toFixed(3); });
    const u = b.columnas[b.columnas.length - 1]; u.ancho = +(u.ancho + b.ancho - b.columnas.reduce((s, c) => s + c.ancho, 0)).toFixed(3);
  }
  for (const i of r?.puertas || []) { // columna de cajones que pasa a una sola puerta del alto de todos sus frentes
    const c = b.columnas[i], alto = (c.frentes || []).reduce((s, f) => s + (+f.alto || 0), 0);
    c.frentes = [{ tipo: 'puerta', alto: r1(alto) }];
    b.tiradores = (b.tiradores || []).filter((t) => !(t.col === i && t.fila > 0));
  }
}
// Las puertas del esquinero mandan (dueño, 2026-11-26): al cambiar su hoja, su diámetro de bandeja o el largo de un lado,
// el lateral (la división con el basal de al lado) se corre y el basal absorbe la diferencia con las mismas reglas que
// al cambiar el tipo. medidas = { ancho, profundidad } nuevas del esquinero.
export const ajustarEsquineroConVecinos = (modelo, e, medidas) => cambiarTipoConVecinos(modelo, e, e.solucion, medidas);
export function cambiarTipoConVecinos(modelo, e, sol, medidas = null) {
  const grupo = e.grupo ? modelo.modulos.filter((x) => x.grupo === e.grupo && x !== e && !x.artefacto && x.tipo !== 'esquinero' && (x.tipo === 'aereo') === !!e.aereo) : [];
  const vec = { a: null, b: null };
  for (const b of grupo) { const l = b.anexo?.esq === e.id ? b.anexo.lado : ladoDelEsquinero(e, b); if (l && !vec[l]) vec[l] = b; }
  const s0 = medidasSugeridas(e), eraSugerida = +e.ancho === s0.ancho && +e.profundidad === s0.profundidad;
  if (!vec.a && !vec.b && !e.absorbido_a && !e.absorbido_b) { // sin vecinos: como antes
    e.solucion = sol;
    if (medidas) { anchoEsquinero(e, r1(medidas.ancho)); e.profundidad = r1(medidas.profundidad); repegar(modelo, e); }
    else if (eraSugerida) { const s1 = medidasSugeridas(e); anchoEsquinero(e, s1.ancho); e.profundidad = s1.profundidad; repegar(modelo, e); }
    return [];
  }
  const largo = (l) => (l === 'a' ? +e.ancho : +e.profundidad), fijar = (l, v) => { if (l === 'a') anchoEsquinero(e, r1(v)); else e.profundidad = r1(v); };
  const total = {}, antes = {}, avisos = [];
  for (const l of ['a', 'b']) { // 1) largo del muro, y el vecino vuelve a ser un basal suelto
    const b = vec[l], guardado = e[`absorbido_${l}`];
    // un basal que se quitó (tipos que no lo absorben) guarda el largo que le quedaba en el muro: espacio libre
    total[l] = largo(l) + (b && !b.anexo ? +b.ancho : 0) + (!b && guardado?._libre != null ? +guardado._libre : 0);
    if (b?.anexo) { Object.assign(b, b.anexo.antes); delete b.anexo; }
    const v0 = b || null; if (v0?.cajones_originales) { v0.columnas = v0.cajones_originales.columnas; v0.tiradores = v0.cajones_originales.tiradores; delete v0.cajones_originales; } // recupera sus cajones
    else if (!b && guardado) { const nb = JSON.parse(JSON.stringify(guardado)); delete nb._libre; modelo.modulos.push(nb); vec[l] = nb; }
    delete e[`absorbido_${l}`]; delete e[`anexo_${l}`];
    if (vec[l]) antes[l] = +vec[l].ancho;
  }
  e.solucion = sol; // 2) el esquinero toma las medidas sugeridas del tipo nuevo (en los lados con vecino)
  const s1 = medidas || medidasSugeridas(e);
  if (vec.a || eraSugerida || medidas) fijar('a', s1.ancho);
  if (vec.b || eraSugerida || medidas) fijar('b', s1.profundidad);
  for (const l of ['a', 'b']) { // 3) cada vecino absorbe la diferencia
    const b = vec[l]; if (!b) continue;
    const w = r1(total[l] - largo(l)), anchos = w > 0 ? anchosVecino(b, w) : null;
    if (anchos) {
      ponerAncho(b, w, anchos);
      if (Math.abs(w - antes[l]) > .05) avisos.push(`«${b.nombre}» queda de ${cm(w)} cm${anchos.puertas.length ? ` (${anchos.puertas.length === 1 ? 'sus cajones pasan' : 'columnas de cajones pasan'} a una puerta)` : ''}`);
      continue;
    }
    if (sol !== '3') { // no alcanza ni una puerta de 25 cm: el basal se quita y ese espacio queda libre (dueño, 2026-11-26)
      const c = JSON.parse(JSON.stringify(b)); c._libre = Math.max(0, w); e[`absorbido_${l}`] = c;
      modelo.modulos.splice(modelo.modulos.indexOf(b), 1);
      avisos.push(`«${b.nombre}» se quita: le quedaban ${cm(Math.max(0, w))} cm, menos que una puerta de ${MIN_PUERTA_VECINO} (ese espacio queda libre)`);
      continue;
    }
    // 4) space corner: el esquinero absorbe al basal
    const g = geoEsquinero(e), base0 = (l === 'a' ? g.fb : g.fa) + g.ld + .15; // largo del lado hasta donde parte la puerta lateral
    const S = total[l] - base0, sm = (b.columnas || []).reduce((s, c) => s + minColumna(c), 0) || MIN_CAJON_VECINO;
    let d = Math.min(60, Math.max(35, largo(l) - base0 - .3)), wx = S - d - .3; // la puerta lateral se queda como estaba, si cabe
    if (wx < sm) { d = S - .3 - sm; wx = sm; }
    fijar(l, total[l]);
    if (d >= 35) { // a continuación de la puerta lateral, lo que tenía el basal (anexo)
      b.anexo = { esq: e.id, lado: l, fuera: l === 'a' ? (e.esquina === 'izq' ? 'der' : 'izq') : (e.esquina === 'izq' ? 'izq' : 'der'), antes: { cubierta: b.cubierta, profundidad: b.profundidad } };
      b.cubierta = false; b.profundidad = l === 'a' ? g.fa : g.fb; ponerAncho(b, wx, anchosVecino(b, wx));
      e[`anexo_${l}`] = r1(wx);
      avisos.push(`el esquinero absorbe a «${b.nombre}»: puerta lateral de ${cm(d)} cm y sus columnas en ${cm(wx)} cm`);
    } else { // no caben: la puerta lateral ocupa todo (sobre 60 cm, 2 hojas)
      const c = JSON.parse(JSON.stringify(b)); delete c.anexo; e[`absorbido_${l}`] = c;
      modelo.modulos.splice(modelo.modulos.indexOf(b), 1);
      avisos.push(`el esquinero reemplaza a «${b.nombre}»: puerta lateral de ${cm(S)} cm${S > 60 ? ` en 2 hojas de ${cm(S / 2)}` : ''}`);
    }
  }
  repegar(modelo, e);
  return avisos;
}
// Esquinero agrupado: al cambiar sus medidas, los basales del grupo lo siguen (quedan pegados a 0 cm)
export function repegar(modelo, m) { if (m.grupo) pegarAlEsquinero(modelo.modulos.filter((x) => x.grupo === m.grupo)); }

// Basales agrupados con el esquinero (o absorbidos por él)
export const tieneVecinos = (modelo, e) => !!(e.absorbido_a || e.absorbido_b || (e.grupo && modelo.modulos.some((x) => x !== e && x.grupo === e.grupo && !x.artefacto && x.tipo !== 'esquinero' && (x.tipo === 'aereo') === !!e.aereo)));
// Tipos que se ofrecen (dueño, 2026-11-26): agrupado con basales, todos los que se pueden armar reacomodando a los
// vecinos (que se achican, pasan a puerta o se quitan); sin vecinos, los que calzan con sus medidas.
export function tiposPosibles(modelo, e) {
  if (!tieneVecinos(modelo, e)) return solucionesQueCalzan(e);
  return (e.aereo ? ORDEN_AEREO : ORDEN_SOLUCIONES).filter((sol) => {
    if (sol === e.solucion) return true;
    const c = JSON.parse(JSON.stringify(modelo)), ce = c.modulos.find((x) => x.id === e.id);
    return !cambiarTipoConVecinos(c, ce, sol).some((t) => /bajo sus mínimos/.test(t));
  });
}
// Tipos de esquina que eligió el cliente en su portal (dueño, 2026-11-26: desde «Propuesta enviada» decide el cliente y
// el editor lo aplica solo, reacomodando a los vecinos). Devuelve los avisos de lo que cambió.
export function aplicarEsquinerosCliente(modelo, s) {
  const out = [];
  for (const [id, sol] of Object.entries(s?.esquineros || {})) {
    const e = modelo.modulos.find((x) => x.id === id && x.tipo === 'esquinero');
    if (!e || !sol || e.solucion === sol || !tiposPosibles(modelo, e).includes(sol)) continue;
    const av = cambiarTipoConVecinos(modelo, e, sol);
    out.push(`«${e.nombre}» pasa a tipo ${sol}${av.length ? ` (${av.join('; ')})` : ''}`);
  }
  return out;
}
