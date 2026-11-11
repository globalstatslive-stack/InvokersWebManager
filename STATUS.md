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

## Pendiente

- Probar el marcador mágico en Chrome Android real con el enlace del usuario.
- Simulación de daño con habilidades y defensa enemiga; optimización de equipos completos (repartir piezas entre varios Invokers).
- Datos de habilidades y descripciones del catálogo público.
- Probar la importación desde la carpeta del juego en Windows y Mac con archivos reales.
