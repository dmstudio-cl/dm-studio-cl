# CLAUDE.md - DM Studio Mobiliario (dmstudio.cl)

## Contexto del Proyecto
Sitio web estático para un estudio de diseño y fabricación de mobiliario en madera en Chile. Alojado en **GitHub Pages** usando **Jekyll** (compatible con GitHub Pages sin plugins no soportados).

## Reglas Estrictas de Arquitectura y Seguridad
1. **Entorno 100% Estático:** No utilizar PHP, bases de datos ni backend tradicional. Todo debe compilar en HTML, CSS y Vanilla JS / ES Modules.
2. **Seguridad de Credenciales:** NUNCA hardcodear llaves privadas (Secret Keys) de Mercado Pago o APIs en el código frontend. Solo usar Public Keys o redirecciones seguras.
3. **Optimización de Assets:** Las imágenes deben estar en formato `.webp` optimizado y los modelos 3D (`.glb`/`.gltf`) comprimidos (Draco) para no superar el límite de 1GB del repositorio.
4. **Moneda y Localización:** Todo el sitio en español (Chile). Precios en Pesos Chilenos (CLP) formateados sin decimales (ej. `$150.000`).

## Requerimientos Funcionales

### 1. Home Page & Portafolio (Three.js + Decap CMS)
- **Hero Interactivo:** Integrar visor ligero de **Three.js** en el Home cargando modelos 3D optimizados con controles de órbita limitados (sin zoom infinito) y buena iluminación de estudio.
- **Galería / Portafolio:** Grilla de trabajos realizados administrable mediante **Decap CMS** (`/admin`). Configurar `config.yml` con backend `git-gateway` o `github` para subir fotos, descripción, tipo de madera y medidas.

### 2. Catálogo y Carrito de Compras (JAMstack)
- **Productos Disponibles:** Colección de Jekyll (`_productos/`) administrable vía Decap CMS (campos: título, precio CLP, stock boolean, imágenes, dimensiones, enlace de pago directo).
- **Carrito Local:** Implementar un carrito de compras ligero en JavaScript usando `localStorage` (o Snipcart si se prefiere gestión externa, pero priorizar solución nativa JS para evitar comisiones extra por transacción).

### 3. Pasarela de Pagos (Mercado Pago / MACH)
- **Limitación GitHub Pages:** Como no hay backend para generar preferencias dinámicas de Mercado Pago de forma segura sin exponer el `ACCESS_TOKEN`, implementar dos flujos:
  - *Flujo A (Pago Directo por Producto):* Botón directo a Link de Pago de Mercado Pago o Cobro MACH configurado en el CMS por producto.
  - *Flujo B (Carrito Multi-producto):* Al finalizar el carrito, generar un resumen detallado (ID de orden, items, medidas, total en CLP) y ofrecer:
    1. Redirección a una **Cloudflare Worker / Vercel Serverless Function** (endpoint externo) que cree la preferencia de Mercado Pago y devuelva el `init_point`.
    2. Opción alternativa de **"Pagar con MACH / Transferencia"** que muestra el monto exacto, datos bancarios/link MACH y abre WhatsApp con el comprobante prellenado.

### 4. Formulario de Cotizaciones Personalizadas (Web3Forms)
- Integrar formulario en la sección de contacto usando **Web3Forms** (plan gratuito).
- Campos: Nombre, Email, Teléfono (+569), Tipo de proyecto (Mueble a medida, Cotización 3D, Proyecto comercial), Medidas aproximadas, Mensaje y archivo/link de referencia.
- Manejo de envío mediante `fetch` asíncrono (AJAX) sin recargar la página, mostrando estado de éxito/error claro.

## Estructura de Carpetas Esperada
- `_config.yml` (Configuración Jekyll)
- `_productos/` (Markdowns de muebles en venta)
- `_portafolio/` (Markdowns de proyectos realizados)
- `admin/` (`index.html` y `config.yml` de Decap CMS)
- `assets/js/three-viewer.js` (Lógica modular de Three.js)
- `assets/js/cart.js` (Lógica de carrito y checkout)
- `cotizador-3d.html` (Integración del cotizador 3D existente)