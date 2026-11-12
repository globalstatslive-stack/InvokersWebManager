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

## Versión 0.9

- Enciclopedia con datos oficiales de invokers.com (versión del juego 0.62.1655): 242 Invokers y 39 Titanes con habilidades por nivel, 17 jefes, 6 agujas de 120 pisos, 5 cazas, tier lists, equipamiento, 71 efectos, 3 calculadoras y 65 guías enlazadas.
- Integrada con la cuenta: lo que tienes y lo que te falta, tus mejor valorados por jefe, «Preparar este objetivo», tu PREC en la calculadora.
- La probabilidad de que entre un perjuicio usa la tabla oficial (antes, una aproximación por tramos que difería entre 50 y 100 de RES − PREC).
- Actualización semanal automática con comprobaciones (`update-data.yml`).
- Pruebas: integridad de los datos, marcado seguro de textos, calculadoras contra los ejemplos publicados; e2e de la enciclopedia a 360/390/412/1440 px.

## Versión 0.10

- Lateral compacto: 6 entradas principales, Enciclopedia como grupo plegable (abierto solo dentro), Importar e Historial al pie; tarjeta de perfil con avatar, nivel, poder y estado del enlace. Titanes y Equipos pasan a pestañas de Colección.
- Carta de personaje (marco por rareza, elemento y clase, nivel, estrellas, poder) en Colección, Inicio y enciclopedia; Inicio con perfil destacado; cabeceras, paneles, pestañas y botones con la identidad dorada de Nexo.
- Eventos: calendario de torneos por días con la línea de hoy y las coronas que puedes saltarte.

## Versión 0.11

- Asesor › Equipo para un jefe: tus 5 mejores Invokers y Titanes para un jefe y fase (tier list oficial del jefe, inversión, elemento, tolerancias y precisión de la guía), con el porqué de cada uno, alternativas, descartar, lo que le falta (y piezas libres de tolerancia) y paso directo a Objetivo. Pesos de Nexo a la vista; sin probabilidades de victoria.

## Versión 0.12

- Equipo para un jefe analiza las habilidades: de las habilidades publicadas en cada guía de jefe, Nexo deduce qué pide (reducir su curación, daño en área contra invocaciones, limpiar sus perjuicios, curación o escudos frente a corrupciones de daño, maná de definitiva, quitar sus mejoras, DEF − o Debilitar) y contraindicaciones (Sangrado contra Althar, curar contra la Garuda de Luz). Lo cruza con los efectos de tus Invokers, ajusta la recomendación, muestra quién cubre cada necesidad y tus mejores por habilidades.
- Corregido: los efectos instantáneos («block:…», como purgar perjuicios o ganar maná) no se guardaban por Invoker; ahora salen de la lista oficial y una prueba compara con sus recuentos.

## Pendiente

- Validar en el juego los supuestos de tiempos y maná (contar definitivas en 3 min).
- La simulación no incluye la defensa del jefe ni sinergias entre aliados; la asignación conjunta es heurística.
- Llevar el objetivo a las agujas con los datos de pisos ya disponibles (PREC/RES por piso).
- Comprobar el primer lanzamiento del workflow semanal en GitHub Actions (que invokers.com responde a sus servidores).
- Textos de habilidades en español: invokers.com solo los publica en inglés.
- Datos de habilidades y descripciones del catálogo público.
- Probar la importación desde la carpeta del juego en Windows y Mac con archivos reales.
