// Reglas físicas de los materiales de cubierta (Configuración de precios → «Materiales de cubierta»), las mismas
// que aplica el Worker al cotizar: sobre el vuelo máximo con refuerzo o con lavaplatos bajo cubierta sin permitirlo
// el cliente no puede elegir el material; entre el vuelo sin apoyo y el con refuerzo hay que reforzar; si el largo
// pasa el máximo sin unión, la cubierta lleva uniones. Solo avisa: no cambia el mueble.
const pos = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
export function evaluarCubierta(c, mt) {
  const out = { estado: 'ok', motivos: [] };
  const v = pos(c.vuelo_max), sin = pos(mt.vuelo_max_sin_apoyo), con = pos(mt.vuelo_max_con_refuerzo), lmax = pos(mt.largo_max_sin_union);
  if (con && v > con) { out.estado = 'no'; out.motivos.push(`vuelo ${v} cm, máx. ${con} cm`); }
  else if (sin && v > sin) { out.estado = 'refuerzo'; out.motivos.push(`vuelo ${v} cm: reforzar sobre ${sin} cm${pos(mt.distancia_max_apoyos) ? `, apoyos cada ${pos(mt.distancia_max_apoyos)} cm` : ''}`); }
  if (mt.permite_bajo === false && pos(c.bajo)) { out.estado = 'no'; out.motivos.push('no admite lavaplatos bajo cubierta'); }
  if (lmax && pos(c.largo) > lmax) { const n = Math.floor(pos(c.largo) / lmax); out.motivos.push(`${n} unión${n > 1 ? 'es' : ''} (largo máx. ${lmax} cm)`); } // como el Worker (2026-11-26)
  if (mt.requiere_base_continua) out.motivos.push('pide base continua bajo la cubierta');
  return out;
}
