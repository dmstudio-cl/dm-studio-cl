// Excel para el optimizador de Imperial (su «Template_optimizador»): un archivo por melamina.
// Formato del template: A3 «SKU» y B3 el SKU de la plancha; G2:M2 «TAPACANTO» y G3 su SKU; fila 4 los títulos
// CANTIDAD · BASE (largo, mm) · ALTURA (ancho, mm) · NOMBRE · VETA (1 = puede girar, 0 = veta fija) y desde la
// fila 5 las piezas, con el tapacanto de cada canto en G, I (cantos del largo) y K, M (cantos del ancho): 1 = lleva.
// Las medidas son las de CORTE: ya descuentan 1 mm por canto con tapacanto (Imperial lo enchapa después).
const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let cargando = null;
const sheetjs = () => (window.XLSX ? Promise.resolve(window.XLSX) : (cargando ||= new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = SHEETJS; s.onload = () => ok(window.XLSX); s.onerror = () => mal(new Error('No se pudo cargar el generador de Excel (sin conexión).'));
  document.head.append(s);
})));

// SKU de Imperial desde el link de la ficha (…/product/115692) o escrito directo
export const skuDe = (url) => (/\/product\/([\w-]+)/.exec(url || '') || /^\s*(\d+)\s*$/.exec(url || ''))?.[1] || '';

// Imperial no corta piezas de menos de 300 × 100 mm (normativa de seguridad de su optimizador). Las piezas bajo
// ese mínimo se agrandan al mínimo (el lado mayor a 300, el menor a 100) y el dueño las repasa en el taller.
export const MINIMO = { largo: 300, ancho: 100 };
export const bajoMinimo = (p) => Math.max(p.ancho, p.alto) < MINIMO.largo || Math.min(p.ancho, p.alto) < MINIMO.ancho;
// Agranda un par de medidas (mm) al mínimo de Imperial, conservando cuál es cuál
export function aMinimo(x, y) {
  return x >= y ? [Math.max(x, MINIMO.largo), Math.max(y, MINIMO.ancho)] : [Math.max(x, MINIMO.ancho), Math.max(y, MINIMO.largo)];
}

// Filas del template: piezas iguales se juntan (misma medida, nombre, veta y cantos). Las piezas bajo el mínimo
// de Imperial se agrandan al mínimo (se repasan en el taller).
// Columnas de tapacanto confirmadas con su web: G = Sup, I = Inf (cantos del largo), K = Izq, M = Der (cantos del ancho).
export function filasImperial(grupo) {
  const filas = new Map();
  for (const p of grupo.piezas) {
    const v = +p.alto >= +p.ancho; // la veta va por el lado más largo, que es la «base» (largo) en Imperial
    let base = v ? p.alto : p.ancho, altura = v ? p.ancho : p.alto; // mm; base = a lo largo de la veta
    [base, altura] = aMinimo(base, altura);
    const cb = v ? p.cantos.alto : p.cantos.ancho, ca = v ? p.cantos.ancho : p.cantos.alto; // cantos del largo y del ancho
    const pieza = p.nombre.replace(/\s*\((visible|pino|cholguán)\)/g, '').replace(/^Caja de cajón: /, 'Cajón ').replace(/hoja (\d+) de \d+/, 'hoja $1');
    const nombre = `${String(p.mueble || '').slice(0, 16)} · ${pieza}`.replace(/\s+/g, ' ').slice(0, 45).trim();
    // Tapacanto por borde: si la pieza trae edges (sup/inf/izq/der en su propio marco) se usan; si no, se reparte
    // desde los conteos (primero el borde superior/izquierdo). G=Sup, I=Inf (bordes del largo); K=Izq, M=Der (del ancho).
    let g, i, k, m;
    if (p.edges) { const e = p.edges;
      [g, i, k, m] = v ? [e.izq ? 1 : 0, e.der ? 1 : 0, e.sup ? 1 : 0, e.inf ? 1 : 0] : [e.sup ? 1 : 0, e.inf ? 1 : 0, e.izq ? 1 : 0, e.der ? 1 : 0];
    } else { g = cb >= 1 ? 1 : 0; i = cb >= 2 ? 1 : 0; k = ca >= 1 ? 1 : 0; m = ca >= 2 ? 1 : 0; }
    const fila = { base, altura, nombre, veta: p.libre ? 1 : 0, g, i, k, m };
    const clave = JSON.stringify(fila);
    filas.set(clave, { ...fila, cantidad: (filas.get(clave)?.cantidad || 0) + 1 });
  }
  return [...filas.values()].sort((a, b) => b.base * b.altura - a.base * a.altura);
}

export async function descargarImperial(grupo, { sku = '', tapacanto = '', archivo = 'imperial' } = {}) {
  const XLSX = await sheetjs();
  const aoa = [[], ['', '', '', '', '', '', 'TAPACANTO'], ['SKU', sku ? (Number(sku) || sku) : '', '', '', '', '', tapacanto ? (Number(tapacanto) || tapacanto) : ''],
    ['CANTIDAD', 'BASE', 'ALTURA', 'NOMBRE', 'VETA']];
  for (const f of filasImperial(grupo)) aoa.push([f.cantidad, f.base, f.altura, f.nombre, f.veta, '', f.g, '', f.i, '', f.k, '', f.m]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!ref'] = ws['!ref'].replace(/^A2:/, 'A1:'); // la hoja parte en A1 como el template
  ws['!merges'] = [{ s: { r: 1, c: 6 }, e: { r: 1, c: 12 } }, { s: { r: 2, c: 6 }, e: { r: 2, c: 12 } }];
  ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 40 }, { wch: 6 }, { wch: 2 }, { wch: 3 }, { wch: 2 }, { wch: 3 }, { wch: 2 }, { wch: 3 }, { wch: 2 }, { wch: 3 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template_optimizador');
  XLSX.writeFile(wb, `${archivo}.xlsx`);
}
