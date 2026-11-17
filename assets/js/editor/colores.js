// Colores y materiales del modelo (fuera de la melamina de frentes). Se eligen de una paleta corta
// para que sea fácil de usar; se guardan en modelo.colores = { zocalo, cuerpo, costados, marco, hoja, lavaplatos, cocina }.
// 'frente' = igual a la melamina elegida.

export const PALETA = {
  zocalo: { titulo: 'Zócalo', def: 'grafito', opciones: {
    grafito: ['Gris grafito', '#3a3836'], negro: ['Negro', '#1d1c1b'], aluminio: ['Aluminio', 'linear-gradient(180deg, #cfd1d2, #9a9da0)'],
    blanco: ['Blanco', '#e9e6df'], frente: ['Igual a la melamina', null] } },
  cuerpo: { titulo: 'Interior y cuerpo', def: 'blanco', opciones: {
    blanco: ['Blanco', '#e9e6df'], gris: ['Gris claro', '#c9c7c2'], negro: ['Negro', '#2a2928'] } },
  costados: { titulo: 'Costados visibles', def: 'cuerpo', opciones: {
    cuerpo: ['Como el cuerpo', null], frente: ['Igual a la melamina', null] } },
  marco: { titulo: 'Marcos de ventanas', def: 'blanco', opciones: {
    blanco: ['Blanco', '#e3e1dc'], negro: ['Negro', '#262526'], aluminio: ['Aluminio', '#b4b7b9'], madera: ['Madera', '#9b7650'] } },
  hoja: { titulo: 'Puertas de muro', def: 'madera', opciones: {
    madera: ['Madera clara', '#b49a78'], blanca: ['Blanca', '#e7e4de'], gris: ['Gris', '#8d8a85'], negra: ['Negra', '#2b2a29'] } },
  lavaplatos: { titulo: 'Lavaplatos', def: 'acero', opciones: {
    acero: ['Acero inoxidable', '#b9bdc0'], negro: ['Negro (granito)', '#2b2b2d'], blanco: ['Blanco (granito)', '#e6e3dd'] } },
  cocina: { titulo: 'Cocina y encimeras', def: 'acero', opciones: {
    acero: ['Acero inoxidable', '#b9bdc0'], negro: ['Negra', '#232325'], blanco: ['Blanca', '#e6e3dd'] } },
};

export const colorDe = (c, k) => (PALETA[k].opciones[c?.[k]] ? c[k] : PALETA[k].def);

// Materiales para dibujar(): fondos CSS de cada parte. frente = fondo CSS de la melamina elegida.
export function matsColores(c = {}, frente = '#cfc6b8') {
  const bg = (k) => { const v = colorDe(c, k); return v === 'frente' ? frente : PALETA[k].opciones[v][1]; };
  const cuerpo = bg('cuerpo');
  return {
    frente, cuerpo,
    zocalo: bg('zocalo'),
    costado: colorDe(c, 'costados') === 'frente' ? frente : cuerpo,
    marco: bg('marco'), hoja: bg('hoja'),
    lavaplatos: colorDe(c, 'lavaplatos'), cocina: colorDe(c, 'cocina'),
  };
}
