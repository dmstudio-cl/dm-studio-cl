# CLAUDE.md - DM Studio Mobiliario (dmstudio.cl)

> Documento vivo de decisiones acordadas con el dueño (Daniel). Si algo aquí contradice una idea nueva, preguntar antes de cambiarlo.
> Estado (2026-11-16): está construida la base del sitio público (home, portafolio, catálogo, ficha, carrito, a medida, dos paneles de Decap y visor Three.js).
> Fase 2 lista en código:
> - Portal `/proyectos/` en **CSS 3D** (`assets/js/portal/escena-css.js` + `assets/js/editor/modelo.js`), terminaciones, pines, chat y aprobación. Demo pública en `/proyectos/#demo`; vista del estudio en `/proyectos/#estudio`.
> - Catálogo Masisa: 62 colores en `_data/melaminas.yml`.
> - API del Worker en `C:\DesarrolloWeb\dmstudio-worker`, con pruebas.
> - Repo privado `dmstudio-cl/proyectos-clientes` y base D1 `dmstudio-portal` (binding `DB`) creados.
>
> Los puntos **[PENDIENTE]** requieren respuesta del dueño.
> Commits: el dueño aprueba cada uno. Mensaje en español con tema y detalle de lo hecho.

## Contexto
Estudio de diseño y fabricación de mobiliario (madera y melamina) en Chile.
- Repo: `github.com/dmstudio-cl/dm-studio-cl` (organización `dmstudio-cl`). Sitio hermano: `dmstudio.dev` (org `dmstudio-dev`).
- Hosting: **GitHub Pages + Jekyll** (solo plugins soportados por Pages). Dominio `dmstudio.cl` aún no comprado: usar URLs de Pages y `baseurl` configurable.
- Restricción de costo: **$0 de entrada**. Nada que exija tarjeta de crédito (por eso no se usa Cloudflare R2).
- Idioma: español de Chile. Precios en CLP sin decimales (`$150.000`, `Intl.NumberFormat('es-CL')`).

## Stack (inamovible)
- Jekyll + GitHub Pages, Vanilla JS / ES Modules, sin paso de build obligatorio.
- **3D en CSS** (decisión del 2026-11-17): el dueño eligió trabajar solo con CSS 3D por rendimiento en equipos sin aceleración gráfica. Motor propio en `assets/js/css3d/engine.js` (1 em = 1 cm, luz por cara, sin WebGL). Portada, editor de modelos y portal del cliente (cotizador) usan CSS 3D con el mismo código de dibujo. Las fichas de producto y del portafolio usan el visor CSS (`assets/js/css3d/visor.js`) con el `.json` exportado desde el editor (campo `modelo_css` en Decap). **Three.js ya no se usa en el sitio** (decisión del 2026-11-17).
- **Anime.js** (import map, versión fija en `_config.yml`) para animaciones: cargador de la portada y giro con scroll.
- **Decap CMS** en `/admin` con backend `github` y OAuth mediante el **Cloudflare Worker propio** del dueño.
- **Web3Forms** (plan gratuito, envío desde el navegador) — una access key exclusiva para este sitio **[PENDIENTE: key y correo destino]**.
- **Cloudflare Worker** (plan gratuito) + **D1** (SQLite) y **KV** para el portal privado. Sin R2.
- WhatsApp Empresa para pedidos a medida y cierre de ventas **[PENDIENTE: número]**.

## Identidad visual
- **Oscuro** en todo el sitio (incluido el visor). Base del logo: negro con grano + círculo **rojo oscuro/burdeos** con textura y firma blanca "Dm" (archivo: `OneDrive/Proyectos/Personales/Portfolio/Logo/logo-dmstudio-red.png`; no hay vector → vectorizar la firma o usar el PNG optimizado).
- Paleta de partida: tinta `#0b0b0d` / `#060505`, hueso `#ece7dd`, rojo de marca `#5a0101`–`#330000` con acento `#b4322e` (usar con moderación), madera cálida `#a97d4d` como acento secundario.
- Tipografía: serif editorial para títulos (Fraunces o Cormorant), sans neutra (Inter) para la interfaz, monoespaciada para datos técnicos (medidas, códigos, precios).
- Referencias del dueño: dmstudio.com/studio, oryzo.ai, cornrevolution.resn.global, Poltrona Frau, Holly Hunt (configurador 360), Vitra (Eames Plastic Chair RE), teenage.engineering. Línea: lujo silencioso, mucho aire, el producto al centro, configuradores limpios, detalles técnicos tipo ficha.
- Fotos profesionales en `OneDrive/Proyectos/Personales/<categoría>/<proyecto>` (Cocina, Decoración, Escritorio, Iluminación, Guitar Stand, Parlantes, Pipas, vitrinas, etc.; muchas en RAW `.CR2`). Instagram de referencia: @dm_studio.cl. Exportar a `.webp` (máx. ~2400 px de lado, más miniaturas).

## Reglas de seguridad
1. Nunca subir llaves secretas (Mercado Pago `ACCESS_TOKEN`, token de GitHub, secretos del Worker) al repo ni al frontend. Viven como *secrets* del Worker.
2. **Los datos de clientes son sensibles** (planta de su casa, nombre, precios). Nunca van en este repo público.
3. **Los costos internos y la fórmula de precio no se exponen al navegador**: el precio final del portal privado lo calcula el Worker.
4. Assets: imágenes `.webp`, modelos `.glb` con Draco o Meshopt, texturas KTX2 o WebP. Límite del repo: 1 GB.

## Flujos de usuario

### Comprador general
**Home → Catálogo → Ficha → Carrito → Checkout**
- **Home:** portafolio destacado (fotos y algunos modelos 3D interactivos).
- **Catálogo** (`_productos/`): productos existentes mostrados con foto o modelo 3D. Algunos modelos permiten modificar ciertas características; **toda personalización alarga el plazo de fabricación** y la ficha debe indicarlo (plazo estándar frente a plazo con personalización).
- **Carrito:** `localStorage`, en Vanilla JS.
- **Checkout:**
  - Producto suelto: link de pago de Mercado Pago o cobro MACH configurado por producto en Decap.
  - Carrito con varios productos: resumen (ID de orden, ítems, opciones, total CLP) que se cierra por WhatsApp. Más adelante, un endpoint en el Worker que cree la preferencia de Mercado Pago.
  - **Transferencia:** solo para proyectos personalizados y del cotizador.
- **A medida (melamina):** formulario Web3Forms (descripción, medidas, contacto); el dueño decide si toma el trabajo.
- **Madera maciza, restauración o mueble a medida en madera:** botón directo a **WhatsApp Empresa** con mensaje prellenado para que el cliente mande descripción y fotos.

### Cliente privado — `/proyectos` (portal cotizador)
Por ahora se centra en **muebles de melamina**, pero la arquitectura debe admitir cualquier proyecto 3D (incluido cargar un `.glb`).
1. El cliente entra a `/proyectos` e ingresa su **Access Key** (o abre un link con la clave en el `#fragmento`).
2. Ve la portada: nombre, proyecto, versión de la propuesta y vigencia.
3. **Visor Three.js** de su mueble:
   - **Estructura:** solo la edita el dueño (módulos, medidas, puertas y cajones).
   - **Lo visual lo elige el cliente:** color de melamina (catálogo **Masisa 2026**, proveedor único), **tiradores** y **cubierta**.
   - El precio se recalcula **en el Worker** con cada cambio.
4. **Comentarios anclados:** el cliente puede fijar un comentario en un punto del modelo (posición 3D más normal).
5. **Chat fijo abajo** para conversar y confirmar antes de que el dueño modifique. El dueño responde desde una vista de administración.
6. La configuración del cliente **se guarda** (D1) y se le muestra el **precio final**.
7. **Aprobar:** guarda una copia de la configuración, avisa al dueño por correo (Web3Forms) y abre WhatsApp con las condiciones y el **anticipo del 50 %** (transferencia, MACH o Mercado Pago).
8. Descarga del PDF de la cotización.
- **Encimeras y campanas:** son **solo recomendaciones según las medidas**, sin precio de DM Studio. Se muestran como opciones curadas con link a la tienda externa; el cliente las compra por su cuenta. Se pueden previsualizar en el modelo (genérico por medida).
- **Escena del espacio:** conservar la vista en esquina con muros, piso y planta 2D. Si el cliente manda fotos o medidas del lugar, el dueño puede ubicar el mueble en su espacio.

## Arquitectura del portal privado (opción B, costo $0)
- **Repo público (este):** solo el código del visor y la interfaz (`/proyectos/`), sin datos de clientes.
- **Repo privado** (propuesto: `dmstudio-cl/proyectos-clientes`): un archivo por proyecto (estructura, materiales habilitados, Access Key, datos del cliente, costos). Se edita con un **segundo Decap** en `/admin/proyectos/` que apunta a ese repo privado (el mismo OAuth del Worker, scope `repo`). Objetivo: crear un proyecto en pocos minutos, con plantillas de módulos y la clave generada.
- **Worker** (rutas `/api/portal/*`):
  - `login`: valida la clave contra el repo privado (token de GitHub de solo lectura como *secret*; índice clave→proyecto cacheado en KV) y emite una sesión firmada de corta duración.
  - `project`: entrega la estructura y las opciones visuales, sin costos internos.
  - `quote`: calcula el precio con los costos y la fórmula privados.
  - `config`: guarda las selecciones del cliente en D1.
  - `comments` y `chat`: guarda en D1 los mensajes y los pines (proyecto, autor, texto, posición 3D, fecha, estado).
  - `approve`: congela la configuración y el precio en D1.
  - Límites del plan gratuito: Workers 100k solicitudes/día; KV 1k escrituras/día; D1 dentro de su cuota gratuita. Sobra para este volumen.
- **[PENDIENTE]** Ubicación del código actual del Worker de OAuth (¿repo o editado en el dashboard?), para extenderlo en vez de crear otro.

## Motor de precios (cotizador de melamina)
Fórmula del dueño (confirmada el 2026-11-16):
```
materiales    = Σ (madera/melamina, bisagras, correderas, tiradores, diluyente, agorex, tapacanto, etc.)
luz           = 20% × materiales      (constante: energía de cortes, dimensionado y armado)
subtotal      = materiales + luz      (= materiales × 1.2)
precio_final  = subtotal × 2.3
mano_obra     = precio_final − subtotal   (se deriva, no se suma aparte)
anticipo      = 50% × precio_final
```
- **[PENDIENTE]** En la primera versión, el "transporte de materiales" iba dentro del subtotal. Confirmar si sigue como ítem dentro de `materiales` (se dejará como línea opcional del proyecto).
- Las constantes (20 %, 2.3, 50 %) se configuran en el repo privado para poder ajustarlas sin tocar código.
- Hay que derivar las **constantes por variable** para pasar de un cálculo manual a uno paramétrico: precio por m² o por plancha de melamina (por color o línea Masisa), metros lineales de tapacanto, unidades de bisagras, correderas y tiradores, m o m² de cubierta por tipo, y transporte por proyecto.
- El modelo paramétrico (piezas a partir de módulos y medidas) produce una **lista de cortes y materiales**, y el costo sale de esa lista. Todo se configura en el repo privado; nunca en el frontend.

## Editor de modelos y avisos al cliente (2026-11-17)
- `/admin/editor/`: editor CSS 3D por capas (zócalo → cuerpo → frentes → tiradores → cubierta), vista Frente a escala con cotas editables en cm. Formato = `modulos` del portal + `tiradores` ubicados a mano (`assets/js/editor/modelo.js`).
- Abre los proyectos del repo privado con la sesión de GitHub de Decap (`decap-cms-user`), muestra y responde los comentarios (Worker, `X-DM-Owner`) y **Publicar versión** hace un commit en el repo privado (versión +1; «cambios» → «propuesta»), registra un mensaje `tipo: version` en el chat y avisa al cliente.
- Avisos (costo $0): **correo automático** desde el Gmail del estudio vía Apps Script (`dmstudio-worker/apps-script/correo.gs`; secretos del Worker `MAIL_URL` y `MAIL_SECRET`). **WhatsApp con un toque** (`wa.me` con el mensaje escrito); la API oficial de Meta se descartó por costo por mensaje y verificación.
- Decap privado «plano»: la clave se genera sola (widget `clave`) y los módulos se dibujan en el editor.
- **Espacio** (vista Planta del editor, `assets/js/editor/planta.js`): `espacio.puntos` = cara interior de los muros (x, z en cm), `espacio.muros[i]` = {etiqueta, espesor, alto} del tramo i, `espacio.cerrado`. Los muebles se ubican con x, z, `rotacion` (grados, como `rotation.y` de Three.js, giro sobre la esquina trasera izquierda) y `elevacion`. Las **etiquetas de muros son internas**: el Worker no las envía al cliente. Cliente y editor dibujan los muros como «casa de muñecas» (solo la cara interior, los que dan a la cámara desaparecen).
- El portal del cliente dibuja con el mismo `modelo.js` del editor: respeta los tiradores ubicados a mano (con la forma y color que elige el cliente) o los ubica automáticamente. Pines: el punto 3D se obtiene invirtiendo la transformación CSS de la cara bajo el cursor (mismas coordenadas que antes con Three.js).

## 3D en CSS — buenas prácticas acordadas
- 1 em = 1 cm (el tamaño en pantalla se da con el font-size del rig). Muebles generados desde JSON (módulos → piezas) con `editor/modelo.js`; no se usan `.glb`.
- Texturas como variables CSS o `background` compartidos (no repetir data URLs por cara). Veta orientada por pieza y textura a escala real (60 cm por repetición).
- Luz fija respecto del espectador: solo cambia la opacidad de una capa negra por cara (no se repintan texturas). Sombra de contacto con degradado. Cantos sugeridos con un brillo interior.
- Animar solo transformaciones (girar, mover, escalar); cambiar medidas o texturas obliga a repintar. Render solo mientras se mueve y solo si está en pantalla (`IntersectionObserver`). Respeta «reducir movimiento».

## Estructura de carpetas (objetivo)
- `_config.yml`
- `_productos/` (catálogo, Decap), `_portafolio/` (trabajos, Decap)
- `_data/melaminas.yml` (catálogo visual Masisa 2026: nombre, código, textura, línea — **sin costos**), `_data/tiradores.yml`, `_data/cubiertas.yml`, `_data/recomendados.yml` (encimeras y campanas con link)
- `admin/` (Decap del sitio público), `admin/proyectos/` (Decap del repo privado)
- `proyectos/index.html` (portal privado)
- `assets/js/three/` (visor, generador paramétrico de muebles, materiales, anotaciones), `assets/js/cart.js`, `assets/js/portal/`
- Worker: repo aparte **[PENDIENTE]**

## Pendientes del dueño
- Interpretación exacta de la fórmula de precio y lista de costos unitarios.
- Catálogo Masisa 2026: fuente en `C:\DesarrolloWeb\cotizador-dmstudio\LOOKBOOK MELAMINA-.pdf` (146 págs.; cada color tiene una página con la muestra a página completa, el nombre arriba a la izquierda y el código de textura abajo, seguida de una página de ambiente). El PDF no trae capa de texto: nombres y códigos se transcriben a mano. Las muestras tienen una marca de agua "MASISA" tenue, así que hay que recortar una zona limpia para la textura 3D. Falta el catálogo de tiradores y cubiertas.
- Worker de OAuth (`https://dmstudio-cms-auth.moralesdiego905.workers.dev`): corregido y desplegado el 2026-11-16. Copia del código en `C:\DesarrolloWeb\dmstudio-worker` (aún sin repo). Variables: `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`. El editor del dashboard no acepta pegar desde la automatización: el dueño pega el código y presiona Deploy.
- Número de WhatsApp Empresa, access key de Web3Forms y correo destino.
- Código o acceso al Worker de OAuth existente.
- Selección de fotos para el portafolio (o permitir exportar todas las de cada carpeta de proyecto).
