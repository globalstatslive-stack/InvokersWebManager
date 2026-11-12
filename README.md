# Nexo · Invokers: Titan Legacy

**Web publicada:** https://globalstatslive-stack.github.io/InvokersWebManager/ (instalable como PWA en Android)

Herramienta de fans independiente para gestionar tu cuenta de **Invokers: Titan Legacy** con los retratos, Titanes y objetos reales del juego. La idea central: **elige qué quieres superar, descubre qué cambiar, cuánto cuesta y cómo afecta a tus otros equipos**. El código y el diseño son propios; no incorpora código ni recursos de GGNoLuck. Las ilustraciones se publican conforme a la política oficial de contenido de fans.

## Versión 0.13: qué incluye

| Sección | Qué hace |
|---|---|
| **Inicio** | Cuenta, fecha de la instantánea y caducidad del enlace, objetivo actual, plan, equipos activos y accesos rápidos. |
| **Objetivo** | Elige un jefe y una fase de las guías oficiales (PREC, RES, tolerancia y objetivos publicados, con enlace a la fuente). Diagnostica a tu equipo contra esos objetivos y calcula tres planes comparables (mínimo coste, equilibrio, máximo beneficio) con piezas, cambios, oro de desequipar, a quién se le quita cada pieza y qué mínimos son inalcanzables con tus piezas. Compara asignación conjunta y secuencial. |
| **Colección** | Invokers y piezas con búsqueda siempre visible, filtros plegables con contador, tarjetas a dos columnas o lista compacta, personajes o ejemplares (copias ×N), estado equipado/libre/bloqueado y ficha de cada pieza con «¿a quién le sirve?». |
| **Plan** | Cambios guardados por Invoker, sin piezas repetidas entre Invokers. Al reimportar marca qué se aplicó y separa lo **estimado** de lo **observado**. Se puede enviar como preset al portal (extensión opcional). |
| **Optimizador** | Un Invoker: simulación de combate con sus habilidades, daño efectivo o pesos; esfuerzo (mínimo coste / equilibrio / máximo), mínimos, conjunto obligatorio y protección de equipos activos. Se calcula en un Web Worker con progreso y cancelación; si no hay solución válida lo dice. |
| **Asesor** | **Equipo para un jefe**: tus 5 mejores Invokers y Titanes para un jefe y fase, con el porqué, alternativas y lo que falta, y paso a Objetivo. Analiza las habilidades del jefe (guía oficial) frente a las de tus Invokers: qué pide, quién lo cubre y qué evitar. Además, revisión de builds, qué subir y candidatas a venta que excluyen las reservadas en el plan, las útiles para tus Invokers y las escasas de su conjunto. Nunca vende nada. |
| **Colección: Titanes y Equipos** | Tus Titanes y los récords por modo, como pestañas de Colección. **Historial** compara importaciones. |
| **Enciclopedia** | Contenido del juego con datos oficiales de invokers.com, sin cuenta y, si la importas, con lo que tienes: **Invokers** y **Titanes** (estadísticas de nivel 1 y máximas, habilidades nivel a nivel, tolerancias, efectos y nota oficial en cada jefe), **Jefes** (todas las fases, corrupciones, objetivos de la guía y tier list; «Preparar este objetivo»), **Agujas** (120 pisos por elemento: enemigos, nivel, PREC, RES, recompensas), **Eventos** de caza y torneos, **Tier lists** oficiales, **Equipamiento** (principales y secundarias por ranura, notas de tirada, conjuntos y dónde conseguirlos, accesorios), **Efectos**, **Calculadoras** (precisión contra resistencia, recuperación, ticks) y un índice en español de las **guías oficiales**. |

### Enciclopedia: datos oficiales y actualización

`scripts/fetch-wiki.mjs` genera `src/catalog/wiki/` a partir de lo que publica invokers.com: la API de fichas (`/api/explore/invokers|titans`), las tier lists, las páginas de agujas y eventos, las tablas de sus calculadoras (que el portal genera a partir de las reglas del juego) y las tablas de las guías de reliquias y accesorios. Descarga los retratos nuevos con su huella al manifiesto y regenera `characters.json`, así que los Invokers, Titanes, jefes o eventos nuevos aparecen sin tocar código. Si una fuente cambia de formato, el script falla sin escribir nada.

El workflow **Actualizar datos oficiales** (`.github/workflows/update-data.yml`) lo ejecuta cada martes junto a `fetch-bosses.mjs`, pasa las pruebas y la compilación, confirma en `main` y vuelve a publicar. También se puede lanzar a mano desde Actions.

Conforme a la política de contenido de fans de invokers.com, Nexo usa los datos del juego con presentación y herramientas propias y **enlaza** a las guías oficiales en lugar de copiar su texto. Los textos de habilidades y efectos se muestran tal como los publica el juego (en inglés).

### Qué es dato oficial, cálculo o supuesto

- **Dato oficial**: la caja (`/api/lamb/<código>`), estadísticas de los jefes y objetivos de las guías oficiales (`src/catalog/bosses.json`, generado con `scripts/fetch-bosses.mjs`), fichas de habilidades.
- **Cálculo determinista**: estadísticas de una build. `total = total publicado − aporte publicado + aporte propuesto`, con 0 discrepancias frente al aporte publicado en la caja de prueba.
- **Heurística**: la búsqueda de builds (programación dinámica por pares de conjuntos, varios arranques y búsqueda local) y la asignación conjunta del equipo. Encuentran buenas soluciones, pero no se garantiza el óptimo global.
- **Tablas oficiales**: la probabilidad de que entre un perjuicio sale de la tabla RES − PREC de la calculadora oficial (también en el simulador y el objetivo).
- **Supuesto**: la simulación de combate usa supuestos para lo que el juego no publica (animaciones, maná por golpe; `ASSUMPTIONS` en `src/box/combat.ts`). Nexo no estima probabilidades de victoria ni requisitos de jefe que no estén publicados, y un récord de mejor tiempo no indica la tasa de éxito reciente.

## Importar tu cuenta

**Con tu enlace (recomendado, también en móvil)**

1. En [tu caja del portal](https://invokers.com/hub/box/invokers/) activa «compartir» y copia el enlace.
2. Pégalo en Nexo → **Importar** → «Con tu enlace». Sin contraseñas, sin APK, sin extensiones.

El enlace es una **instantánea**: Nexo guarda la caja tal como estaba al importarla y no se sincroniza sola. Para actualizar, pulsa «Refresh link» en el portal (renueva la instantánea y el plazo) y vuelve a importar. El enlace caduca a la semana; Inicio muestra cuántos días quedan. Si una actualización falla o la caja no es válida, se conserva la última caja válida.

**Privacidad.** El portal no envía cabeceras CORS, así que la caja pasa por el proxy de Nexo en Cloudflare Workers (`proxy/cloudflare-worker.js`, `https://nexo-proxy.globalstatslive.workers.dev`): procesa la caja en tránsito, solo reenvía `/api/lamb/<código>`, solo responde a la web de Nexo y no la guarda, aunque Cloudflare puede registrar metadatos técnicos de la petición. La caja se guarda solo en tu navegador (IndexedDB, hasta cinco importaciones). Nexo no escribe nada en el juego.

**Alternativas**: carpeta del juego en PC/Mac (`%USERPROFILE%\AppData\LocalLow\Hit_Zone\Invokers` o `~/Library/Application Support/Hit_Zone/Invokers`, leída localmente) o pegar los datos.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+.

```sh
npm ci
npm run dev
npm test             # unitarias + integridad de imágenes
npm run build
node scripts/fetch-skills.mjs <carpeta> && node scripts/build-skills.mjs <carpeta> # regenera src/catalog/skills.json desde las fichas públicas
NODE_USE_ENV_PROXY=1 node scripts/fetch-wiki.mjs   # regenera la enciclopedia (detrás de un proxy)
node scripts/e2e.mjs # con `npm run dev` activo; NEXO_WIDTH=360 para otro ancho; NEXO_BOX_JSON=/ruta/caja.json para una caja real
node scripts/share-e2e.mjs # con `npm run preview` activo
BOX_JSON=/ruta/caja.json npm test # verifica la fórmula y el optimizador contra una caja real
```

Ninguna caja real se guarda en el repositorio. Las pruebas usan una caja sintética (`scripts/sample-box.mjs`).

**Extensión de Chrome/Edge** (`extension/`, se publica como `nexo-extension.zip`): guarda el plan como preset al abrir el optimizador oficial desde Nexo y abre la pestaña Presets, sin marcador. Solo actúa en `invokers.com/hub/*`, no equipa nada y pide confirmación si el enlace no viene de Nexo.

Estructura: `src/box/` (modelo, estadísticas, optimizador, asesor, textos), `src/ui/` (páginas), `src/memorypack.ts` (snapshots `.dat`), `src/folderSync.ts` (carpeta del juego), `proxy/` (Worker opcional).

## Límites
- Nexo no estima probabilidades de victoria: compara tus estadísticas con los objetivos publicados de cada fase.
- Las subestadísticas futuras al subir una pieza son desconocidas; solo se evalúa la principal al nivel máximo. El oro de desequipar no es el precio de venta.

- Nexo no modifica la cuenta. Puede guardar un plan como preset en el portal oficial (con tu sesión y confirmación); aplicarlo se hace con el botón del portal. El portal no ofrece subir piezas de nivel, así que Nexo tampoco.
- La simulación usa supuestos propios para lo que el juego no publica (duración de las animaciones y maná por golpe de combo; ver `ASSUMPTIONS` en `src/box/combat.ts`) y no incluye la defensa del jefe, mejoras de aliados ni efectos condicionales: compara builds de un mismo Invoker.
- Las velocidades y otras estadísticas secundarias se valoran con pesos ajustables, no con una simulación de combate.
- Los snapshots `.dat` no incluyen estadísticas base; para el optimizador hace falta la caja oficial.
