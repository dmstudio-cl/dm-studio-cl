// Unir varios módulos contiguos en un solo mueble (un cuerpo, una cubierta).
// Condiciones: misma pared (mismo giro y misma línea de fondo), uno junto al otro sin espacios,
// mismo tipo (basal / aéreo), mismo alto, zócalo y altura desde el piso.
// Resultado: ancho = suma; columnas y tiradores en orden; fondo = el mayor.
import { girar, uid } from './modelo.js';

const TOL = 1; // cm de tolerancia para alinear y para considerar dos módulos contiguos
const n = (v) => +v || 0;
const fmt = (v) => `${Math.round(v * 10) / 10}`.replace('.', ',');

export function unirModulos(mods) {
  if (mods.length < 2) return { error: 'Selecciona al menos dos módulos.' };
  if (mods.some((m) => m.artefacto)) return { error: 'Una cocina de piso no se une con muebles.' };
  const r = n(mods[0].rotacion);
  if (mods.some((m) => Math.abs(((n(m.rotacion) - r) % 360 + 360) % 360) > .5)) return { error: 'Los módulos no miran hacia el mismo lado (tienen distinto giro).' };
  const aereo = (m) => m.tipo === 'aereo';
  if (mods.some((m) => aereo(m) !== aereo(mods[0]))) return { error: 'No se pueden unir módulos aéreos con basales.' };

  // Eje a lo largo de la pared (u) y hacia afuera de la pared (v) según el giro
  const [ux, uz] = girar(1, 0, r), [vx, vz] = girar(0, 1, r);
  const datos = mods.map((m) => ({ m, s: n(m.x) * ux + n(m.z) * uz, t: n(m.x) * vx + n(m.z) * vz })).sort((a, b) => a.s - b.s);
  if (datos.some((d) => Math.abs(d.t - datos[0].t) > TOL)) return { error: 'Los módulos no están alineados contra la misma pared (distinta línea de fondo).' };

  for (const k of ['alto', 'elevacion', ...(aereo(mods[0]) ? [] : ['zocalo'])]) {
    const vals = [...new Set(datos.map((d) => fmt(n(d.m[k]))))];
    if (vals.length > 1) {
      const nombre = { alto: 'alto', elevacion: 'altura desde el piso', zocalo: 'zócalo' }[k];
      return { error: `Tienen distinto ${nombre} (${vals.join(' / ')} cm). Iguálalo antes de unirlos.` };
    }
  }
  for (let i = 1; i < datos.length; i++) {
    const fin = datos[i - 1].s + n(datos[i - 1].m.ancho), hueco = datos[i].s - fin;
    if (Math.abs(hueco) > TOL) {
      return { error: hueco > 0
        ? `Hay un espacio de ${fmt(hueco)} cm entre «${datos[i - 1].m.nombre}» y «${datos[i].m.nombre}».`
        : `«${datos[i - 1].m.nombre}» y «${datos[i].m.nombre}» se superponen ${fmt(-hueco)} cm.` };
    }
  }

  // Mueble nuevo: el primero (en el orden de la pared) da el origen y los datos generales
  const base = datos[0].m;
  const columnas = [], tiradores = [], artefactos = [];
  let ancho = 0, desfase = 0;
  for (const { m } of datos) {
    const cols = JSON.parse(JSON.stringify(m.columnas || []));
    const suma = cols.reduce((a, c) => a + n(c.ancho), 0) || n(m.ancho);
    cols.forEach((c) => { c.ancho = Math.round(n(c.ancho) * n(m.ancho) / suma * 10) / 10; }); // columnas = ancho del módulo
    columnas.push(...cols);
    for (const t of m.tiradores || []) tiradores.push({ ...t, id: uid('t'), col: n(t.col) + desfase });
    for (const a of m.artefactos || []) artefactos.push({ ...a, id: uid('a'), desde: n(a.desde) + ancho }); // encimeras y lavaplatos
    desfase += cols.length;
    ancho += n(m.ancho);
  }
  const fondos = [...new Set(datos.map((d) => n(d.m.profundidad)))];
  const unido = {
    ...JSON.parse(JSON.stringify(base)),
    id: uid(),
    nombre: datos.length <= 3 ? datos.map((d) => d.m.nombre).join(' + ') : `Mueble unido (${datos.length} módulos)`,
    ancho: Math.round(ancho * 10) / 10,
    profundidad: Math.max(...fondos),
    cubierta: datos.some((d) => d.m.cubierta),
    columnas, tiradores, artefactos,
  };
  delete unido.plantilla; // deja de pertenecer a una cocina de referencia
  return { modulo: unido, aviso: fondos.length > 1 ? `Tenían distinto fondo (${fondos.map(fmt).join(' / ')} cm): quedó con ${fmt(unido.profundidad)}.` : '' };
}
