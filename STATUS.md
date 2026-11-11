# Estado del proyecto · 11 de noviembre de 2026

## Versión 0.5 (Nexo)

- Interfaz rehecha: inicio, Invokers, ficha, Titanes, equipo, optimizador, asesor, equipos, códice, importar e historial. Escritorio y móvil con barra inferior.
- Modelo completo de la caja oficial: estadísticas base, aporte del equipo, conjuntos activos, habilidades, notas de subestadísticas, oro de desequipar, principal al máximo, equipos por modo, reglas de conjuntos, bonos del salón de arena y curvas de velocidades.
- Fórmula de estadísticas verificada: 0 discrepancias con el aporte publicado en la caja real de prueba.
- Optimizador exacto (DP por pares de conjuntos + arranques múltiples + búsqueda local), objetivo de daño efectivo, mínimos, conjunto obligatorio y protección de equipos.
- Asesor: revisión de builds, cola de mejoras, candidatas a venta con motivos y tolerancias por corrupción.
- Importación al estilo de GG: «Desde el juego» (PC/Mac, ruta para copiar, carpeta recordada, arrastrar y soltar, actualizar con un clic) y «Con tu enlace» (móvil: proxy opcional, copiar y pegar o marcador mágico). Se retiró el puente Android.
- Proxy propio en Cloudflare Workers desplegado y verificado con la caja real (200, CORS solo para la web de Nexo, códigos no válidos rechazados): el enlace se importa con un toque.
- Se mantienen el lector `.dat` MemoryPack, el receptor Web Share Target y la carpeta recordada.

## Evidencia

- `npm test`: 17 pruebas + 2 con caja real (`BOX_JSON`), integridad de 586 imágenes.
- `node scripts/e2e.mjs` en Chromium 390 × 844: pegar caja, todas las secciones sin desbordamiento horizontal, optimizador, recarga, marcador mágico y borrado. También con la caja real del usuario.
- `node scripts/share-e2e.mjs`: la caja compartida con la PWA se importa sola y persiste.
- Con la caja real: optimización del Invoker más fuerte en <0,5 s; +44 % de daño efectivo solo con piezas libres o no bloqueadas.

## Versión 0.6

- Optimizador con propuestas alternativas, principales al nivel máximo y plan de varios Invokers con piezas reservadas.
- Envío del plan al portal como preset mediante el marcador mágico (probado de extremo a extremo con la API del portal simulada; pendiente de probar con la sesión real).
- La carpeta del juego se combina con la última caja del enlace para el optimizador.

## Versión 0.7

- Catálogo de habilidades de los 242 Invokers (11 niveles) desde la API pública de fichas.
- Simulador de combate por campeón y objetivo «Combate simulado» en el optimizador; perfil automático del kit.
- Contraste con una simulación de referencia para Ozmol: lanzamientos y daño dentro de ~8 %.
- Extensión de Chrome para guardar el plan como preset sin marcador.

## Versión 0.8

- Fiabilidad: «nivel máximo» ya no altera el «antes»; un conjunto obligatorio imposible muestra «Sin solución válida»; el importador valida IDs, ranuras, dueños y asignaciones (y conserva la última caja válida); el cálculo va en un Web Worker con progreso, cancelación y descarte de resultados obsoletos. Pruebas de regresión en `engine.test.ts`, `goal.test.ts` y `account.test.ts`.
- Textos honestos: dato oficial / cálculo / heurística / supuesto; privacidad del proxy; instantánea, actualización y caducidad del enlace.
- Rediseño móvil: Colección (búsqueda visible, filtros plegables con contador, 2 columnas o lista compacta, personajes/ejemplares, estados), Inicio útil en la primera pantalla, barra inferior Inicio · Colección · Objetivo · Plan · Más. Sin desbordamiento a 360/390/412 px ni en escritorio.
- Objetivo de progreso con 17 jefes de las guías oficiales, diagnóstico, tres planes con coste y donantes, mínimos inalcanzables explicados, asignación conjunta frente a secuencial y protección de equipos activos.
- «¿A quién le sirve?» por pieza, venta que respeta reservas, utilidad y conjuntos; plan con seguimiento estimado frente a observado.

## Pendiente

- Validar en el juego los supuestos de tiempos y maná (contar definitivas en 3 min).
- La simulación no incluye la defensa del jefe ni sinergias entre aliados; la asignación conjunta es heurística.
- Ampliar el objetivo a más modos (agujas, arena) cuando haya datos oficiales equivalentes a las guías de jefes.
- Datos de habilidades y descripciones del catálogo público.
- Probar la importación desde la carpeta del juego en Windows y Mac con archivos reales.
