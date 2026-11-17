# dmstudio.cl

Sitio de DM Studio (mobiliario de autor, Chile). Usa Jekyll y se publica en GitHub Pages. Las decisiones del proyecto están en [`CLAUDE.md`](CLAUDE.md).

## Ver el sitio en tu computador

Requisito: tener Docker Desktop abierto.

```bash
docker run --rm -p 4010:4000 -v "C:/DesarrolloWeb/dm-studio-cl:/srv/site" -v dmstudio-gems:/usr/local/bundle -w /srv/site ruby:3.3 sh -c "bundle install --quiet && bundle exec jekyll serve --host 0.0.0.0 --force_polling"
```

Luego abre <http://localhost:4010/dm-studio-cl/>.

## Editar contenido

- `/admin/`: portafolio, catálogo y ajustes del sitio (WhatsApp, Web3Forms, MACH, URL del Worker).
- `/admin/proyectos/`: proyectos privados de clientes (repo privado `dmstudio-cl/proyectos-clientes`).

Los dos paneles necesitan la URL del Cloudflare Worker de OAuth en `admin/config.yml` y en `admin/proyectos/config.yml`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `_portafolio/` | Trabajos realizados (un `.md` por proyecto) |
| `_productos/` | Catálogo (un `.md` por producto) |
| `_data/sitio.yml` | Contacto y servicios externos |
| `assets/js/css3d/` | Motor CSS 3D (sin WebGL), visor del sitio, aparador procedural y giro con scroll |
| `assets/js/editor/` | Editor de modelos por capas, planta del espacio y proyectos de clientes |
| `assets/js/cart.js` | Carrito en `localStorage` |
| `proyectos/` | Portal de clientes (entrada con Access Key) |
