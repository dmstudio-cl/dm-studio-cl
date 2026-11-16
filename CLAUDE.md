# CLAUDE.md - DM Studio Mobiliario (dmstudio.cl)

> Documento vivo de decisiones acordadas con el dueño (Daniel). Si algo aquí contradice una idea nueva, preguntar antes de cambiarlo.
> Estado (2026-11-16): está construida la base del sitio público (home, portafolio, catálogo, ficha, carrito, a medida, entrada del portal, dos paneles de Decap y visor Three.js). Falta la fase 2: Worker + D1, visor paramétrico del portal y catálogo Masisa. Los puntos **[PENDIENTE]** requieren respuesta del dueño.
> Commits: el dueño aprueba cada uno. Mensaje en español con tema y detalle de lo hecho.

## Contexto
Estudio de diseño y fabricación de mobiliario (madera y melamina) en Chile.
- Repo: `github.com/dmstudio-cl/dm-studio-cl` (organización `dmstudio-cl`). Sitio hermano: `dmstudio.dev` (org `dmstudio-dev`).
- Hosting: **GitHub Pages + Jekyll** (solo plugins soportados por Pages). Dominio `dmstudio.cl` aún no comprado: usar URLs de Pages y `baseurl` configurable.
- Restricción de costo: **$0 de entrada**. Nada que exija tarjeta de crédito (por eso no se usa Cloudflare R2).
- Idioma: español de Chile. Precios en CLP sin decimales (`$150.000`, `Intl.NumberFormat('es-CL')`).

## Stack (inamovible)
- Jekyll + GitHub Pages, Vanilla JS / ES Modules, sin paso de build obligatorio.
- **Three.js** vía import map con versión fija (sin bundler). Todo el 3D del sitio usa Three.js; el prototipo CSS-3D antiguo (`d1ego-art/dm_studio.github.io/cotizador.html`) solo se usa como referencia del modelo de datos.
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

## Three.js — buenas prácticas acordadas
- 1 unidad = 1 cm. Muebles generados por código desde JSON (módulos → piezas), o `.glb` para proyectos no paramétricos.
- `MeshStandardMaterial`/`MeshPhysicalMaterial` con mapa de color, `roughnessMap` y `normalMap` suave. Veta orientada por pieza y textura a escala real (cm).
- Iluminación con HDRI de estudio vía `PMREMGenerator`. Tone mapping ACES/AgX y salida en sRGB. Sombras de contacto. Cantos con `RoundedBoxGeometry`.
- `OrbitControls` con límites de ángulo y zoom. Render bajo demanda (no en bucle continuo). DPR máximo de 2. Carga diferida del visor (`IntersectionObserver`).
- Materiales e instancias compartidos; las texturas se cachean y se reutilizan.

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
- Worker de OAuth: el dueño lo editó directo en el dashboard de Cloudflare. Hay que pasar su código a un repo (con wrangler) antes de extenderlo.
- Número de WhatsApp Empresa, access key de Web3Forms y correo destino.
- Código o acceso al Worker de OAuth existente.
- Selección de fotos para el portafolio (o permitir exportar todas las de cada carpeta de proyecto).
