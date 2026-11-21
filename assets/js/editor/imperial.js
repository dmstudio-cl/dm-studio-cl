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

// Rellena el template original de Imperial (assets/data/imperial-template.xlsx, descargado de su optimizador) en
// vez de crear un Excel desde cero: su importador no aceptaba el archivo generado (2026-11-21). Solo se tocan los
// valores: B3 (SKU de la plancha), G3 (SKU del tapacanto, si hay) y las filas desde la 5 (la fila de ejemplo se
// reemplaza). Estilos, logo, comentarios y demás partes del template quedan intactos. Los textos van en la lista
// de textos compartidos (sharedStrings), como en el template, y las celdas vacías quedan vacías (sin texto "").
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function llenarTemplate(hoja, textos, filas, { sku = '', tapacanto = '' } = {}) {
  const lista = [...textos.matchAll(/<si>[\s\S]*?<\/si>/g)].map((m) => m[0]);
  const texto = (s) => { // índice en sharedStrings (agrega el texto si no está)
    const si = `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`;
    let i = lista.indexOf(si); if (i < 0) { lista.push(si); i = lista.length - 1; }
    return i;
  };
  // celda: número, texto (compartido) o vacía; conserva el estilo del template (s)
  const celda = (ref, s, v) => {
    const st = s != null ? ` s="${s}"` : '';
    if (v === '' || v == null) return `<c r="${ref}"${st}/>`;
    if (typeof v === 'number' || /^\d+$/.test(String(v))) return `<c r="${ref}"${st}><v>${Number(v)}</v></c>`;
    return `<c r="${ref}"${st} t="s"><v>${texto(v)}</v></c>`;
  };
  // estilos de las columnas de piezas en el template: A–C sin estilo, D texto, E/G/I/K/M casillas, F/H/J/L/N separadores
  const COLS = [['A'], ['B'], ['C'], ['D', 17], ['E', 18], ['F', 19], ['G', 18], ['H', 19], ['I', 18], ['J', 19], ['K', 18], ['L', 19], ['M', 18], ['N', 19]];
  const filaXml = (r, f) => `<row r="${r}" spans="1:15" ht="13.5" customHeight="1">${COLS.map(([c, s], j) => celda(`${c}${r}`, s,
    [f.cantidad, f.base, f.altura, f.nombre, f.veta, '', f.g, '', f.i, '', f.k, '', f.m, ''][j])).join('')}</row>`;
  // reemplaza una celda dentro de su fila conservando su estilo
  const ponerCelda = (xml, ref, v) => xml.replace(new RegExp(`<c r="${ref}"( s="\\d+")?(?: t="\\w+")?(?:/>|>[\\s\\S]*?</c>)`), (m, s) => celda(ref, s ? +s.match(/\d+/)[0] : null, v));
  let out = ponerCelda(hoja, 'B3', sku);
  out = ponerCelda(out, 'G3', tapacanto);
  // filas de piezas: desde la 5; las del template en ese rango (ejemplo y vacías con estilo) se reemplazan
  const ultima = 4 + filas.length;
  out = out.replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (m, r) => (+r >= 5 && +r <= ultima ? '' : m));
  const nuevas = filas.map((f, j) => filaXml(5 + j, f)).join('');
  out = out.replace(/(<row r="4"[^>]*>[\s\S]*?<\/row>)/, `$1${nuevas}`);
  const maxFila = Math.max(ultima, ...[...out.matchAll(/<row r="(\d+)"/g)].map((m) => +m[1]));
  out = out.replace(/<dimension ref="A1:([A-Z]+)\d+"\/>/, `<dimension ref="A1:$1${maxFila}"/>`);
  const usos = (out.match(/ t="s"/g) || []).length;
  const sst = textos.replace(/<sst([^>]*)>[\s\S]*<\/sst>/, (m, attrs) => `<sst${attrs.replace(/ count="\d+"/, ` count="${usos}"`).replace(/ uniqueCount="\d+"/, ` uniqueCount="${lista.length}"`)}>${lista.join('')}</sst>`);
  return { hoja: out, textos: sst };
}

export async function descargarImperial(grupo, { sku = '', tapacanto = '', archivo = 'imperial' } = {}) {
  const XLSX = await sheetjs();
  const res = await fetch(`${window.DM?.base || ''}/assets/data/imperial-template.xlsx`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('No se encontró el template de Imperial.');
  const zip = XLSX.CFB.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
  const leer = (ruta) => new TextDecoder().decode(XLSX.CFB.find(zip, `/${ruta}`).content);
  const escribir = (ruta, txt) => { XLSX.CFB.find(zip, `/${ruta}`).content = new TextEncoder().encode(txt); };
  const { hoja, textos } = llenarTemplate(leer('xl/worksheets/sheet1.xml'), leer('xl/sharedStrings.xml'), filasImperial(grupo), { sku, tapacanto });
  escribir('xl/worksheets/sheet1.xml', hoja);
  escribir('xl/sharedStrings.xml', textos);
  const datos = XLSX.CFB.write(zip, { type: 'array', fileType: 'zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `${archivo}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
