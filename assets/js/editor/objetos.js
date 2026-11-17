// Electrodomésticos sueltos (modelos de referencia genéricos con medidas modificables). Se ubican en cualquier
// lugar: en el piso, sobre una cubierta o dentro de una sección abierta (sobre su base o una repisa).
// modelo.objetos = [{ id, tipo, nombre, x, z, elevacion, rotacion, ancho, alto, fondo, color }]
// x, z = centro en planta; elevacion = altura de su base; rotacion como los módulos (con 0 el frente mira a +z).
// No tienen precio: son referencias para el diseño y para conversar con el cliente.
import { acabado } from './artefactos.js';

export const OBJETOS = {
  refri1: { nombre: 'Refrigerador 1 puerta', ancho: 60, alto: 170, fondo: 65, apoyo: 'piso' },
  refri2: { nombre: 'Refrigerador 2 puertas con pantalla', ancho: 91, alto: 178, fondo: 72, apoyo: 'piso' },
  lavavajillas: { nombre: 'Lavavajillas', ancho: 60, alto: 85, fondo: 60, apoyo: 'piso' },
  horno: { nombre: 'Horno eléctrico', ancho: 52, alto: 32, fondo: 42, apoyo: 'mesa' },
  microondas: { nombre: 'Microondas', ancho: 48, alto: 28, fondo: 36, apoyo: 'mesa' },
  freidora: { nombre: 'Freidora de aire', ancho: 30, alto: 32, fondo: 37, apoyo: 'mesa' },
  cafetera: { nombre: 'Cafetera', ancho: 24, alto: 35, fondo: 30, apoyo: 'mesa' },
  hervidor: { nombre: 'Hervidor', ancho: 22, alto: 25, fondo: 16, apoyo: 'mesa' },
};

const VIDRIO = 'linear-gradient(160deg, #3a4148, #121518 60%, #262b30)';
const perillas = (n) => Array.from({ length: n }, (_, i) => `radial-gradient(circle at 50% ${((i + .5) / n * 100).toFixed(0)}%, #1c1c1d 0 1.2em, #6a6d70 1.3em 1.5em, transparent 1.6em)`).join(', ');

// Dibuja el electrodoméstico en su propio grupo (origen = centro de la base, frente hacia +z)
export function dibujarObjeto(st, o, ref, colorGeneral = 'acero') {
  const def = OBJETOS[o.tipo] || OBJETOS.microondas;
  const W = +o.ancho || def.ancho, H = +o.alto || def.alto, D = +o.fondo || def.fondo;
  const ac = acabado(o.color || colorGeneral);
  const G = st.group({ x: +o.x || 0, y: +o.elevacion || 0, z: +o.z || 0, ry: +o.rotacion || 0 });
  const B = (b, bg, caras) => G.box({ ...b, tex: { bg }, ref, ...(caras ? { caras } : {}) });
  const zf = D / 2; // cara frontal
  B({ w: W, h: H, d: D, x: 0, y: H / 2, z: 0 }, ac.cuerpo);
  const manilla = (w, h, x, y) => B({ w, h, d: 2.4, x, y, z: zf + 1.6 }, '#c9ccce');
  switch (o.tipo) {
    case 'refri1':
      B({ w: W - 1, h: H * .34, d: .6, x: 0, y: H - H * .17 - .5, z: zf + .3 }, ac.cuerpo, ['front']);     // congelador
      B({ w: W - 1, h: H * .64 - 1.5, d: .6, x: 0, y: H * .32, z: zf + .3 }, ac.cuerpo, ['front']);         // refrigerador
      manilla(2, Math.min(30, H * .15), W / 2 - 5, H * .78); manilla(2, Math.min(45, H * .25), W / 2 - 5, H * .48);
      break;
    case 'refri2': {
      const hw = (W - 1.5) / 2;
      B({ w: hw, h: H - 2, d: .6, x: -hw / 2 - .4, y: H / 2, z: zf + .3 }, ac.cuerpo, ['front']);
      B({ w: hw, h: H - 2, d: .6, x: hw / 2 + .4, y: H / 2, z: zf + .3 }, ac.cuerpo, ['front']);
      manilla(2, Math.min(70, H * .4), -3, H * .58); manilla(2, Math.min(70, H * .4), 3, H * .58);
      B({ w: 12, h: 16, d: .3, x: -hw / 2 - .4, y: H * .7, z: zf + .7 }, 'linear-gradient(160deg, #1d3a4f, #0b141c 55%, #2c5a76)', ['front']); // pantalla
      break;
    }
    case 'lavavajillas':
      B({ w: W - 1, h: 9, d: .6, x: 0, y: H - 5, z: zf + .3 }, `linear-gradient(90deg, transparent 70%, #1f2224 70% 92%, transparent 92%), ${ac.cuerpo}`, ['front']);
      manilla(W * .6, 2, 0, H - 13);
      break;
    case 'horno':
      B({ w: W * .72, h: H - 7, d: .6, x: -W * .12, y: H / 2, z: zf + .3 }, VIDRIO, ['front']);
      B({ w: W * .2, h: H - 7, d: .4, x: W * .37, y: H / 2, z: zf + .2 }, `${perillas(3)}, ${ac.cuerpo}`, ['front']);
      manilla(W * .6, 1.4, -W * .12, H - 5);
      break;
    case 'microondas':
      B({ w: W * .68, h: H - 6, d: .6, x: -W * .14, y: H / 2, z: zf + .3 }, VIDRIO, ['front']);
      B({ w: W * .22, h: H - 6, d: .4, x: W * .36, y: H / 2, z: zf + .2 }, 'linear-gradient(180deg, #0f1214 0 22%, #2e3236 22% 26%, #1a1d20 26%)', ['front']);
      break;
    case 'freidora':
      B({ w: W - 4, h: H * .5, d: 1.5, x: 0, y: H * .3, z: zf + .75 }, ac.cuerpo);
      manilla(W * .45, 3, 0, H * .32);
      B({ w: W * .6, h: .3, d: D * .4, x: 0, y: H + .15, z: zf - D * .3 }, '#111316', ['top']); // panel táctil
      break;
    case 'cafetera':
      B({ w: W * .7, h: H * .35, d: D * .55, x: 0, y: H * .2, z: zf - D * .2 }, 'linear-gradient(180deg, rgba(40,30,25,.85), #120d0a)'); // jarra
      break;
    case 'hervidor':
      B({ w: 3, h: H * .7, d: 3, x: 0, y: H * .5, z: -D / 2 - 1.5 }, '#1d1e20'); // asa
      break;
  }
}
