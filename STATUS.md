# Estado del proyecto · 13 de noviembre de 2026

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

## Versión 0.13

- Asesor › Equipo para un jefe reorganizado: jefe y fase → equipo (lo esencial a la vista, «Por qué» plegado) → qué le falta (estadísticas y habilidades en un solo panel) → cambios que cubren lo que falta (quién sale, quién entra, qué ganas y cuánto cuesta en nota e inversión; «Probar este cambio» y volver) → tus mejores por habilidades, ordenados por la puntuación completa y con los de nota baja atenuados.

## Versión 0.14

- Equipo para un jefe elige por encaje con el jefe, no por el equipamiento actual: nota oficial, habilidades que pide, elemento y tolerancia innata del kit, más el desarrollo que las piezas no cambian (estrellas, nivel, despertar, habilidades). El poder actual, la tolerancia de conjuntos, la PREC y la RES pasan a «A mejorar con equipamiento», con acceso a Objetivo. Opción «Priorizar a los que ya tengo equipados» para el criterio anterior.

## Versión 0.19

- **Plan en tandas de 5**: el optimizador oficial trabaja con 5 Invokers a la vez (al cargar un preset, solo pone los 5 primeros en su lista). Con más de 5 pendientes, Plan los divide en tandas por orden de prioridad, cada una con su preset («Nombre · 1/4»…) y su enlace «Enviar tanda N».
  - Ninguna pieza está en dos tandas (el plan nunca asigna una pieza a dos Invokers y `sharedPieces` lo comprueba): el resultado final no depende del orden.
  - Antes de enviar, cada tanda se comprueba con tu última caja: pieza que ya no existe (vendida o triturada) = error y no se deja enviar; pieza que ahora lleva un Invoker fuera del plan = aviso con su oro de desequipar.
  - Estado de cada tanda (pendiente o enviada, en este navegador) y la siguiente resaltada; al reimportar, lo aplicado sale del envío. Solo se envía lo pendiente.
  - El panel del lote dice en cuántas tandas se enviará.
- Pruebas: `plan.test.ts` (tandas, un preset por tanda, piezas compartidas, comprobación con la caja); e2e con tandas cuando el plan pasa de 5.

## Versión 0.18

- **Equipar todo de una vez** (Coach › Piezas › Equipar, `src/box/equipBatch.ts`): prepara un lote y lo añade al Plan; de ahí al juego con «Enviar a invokers.com», el marcador y «Equip all».
  - Solo Invokers que usas: equipos activos y plan o, si no hay ninguno marcado, los de tus equipos registrados con nivel 30 o más. Los que tienen huecos y no usas se dejan fuera y se nombran: una pieza puesta cuesta oro de desequipar si luego se mueve.
  - Huecos vacíos: el optimizador, en un modo nuevo «solo huecos» (`onlyEmpty`: las ranuras ocupadas solo admiten su pieza), elige para cada Invoker por orden de prioridad las piezas libres que mejor le encajan con los conjuntos que se activan. Sin oro. Se calcula en el worker con progreso.
  - Sustituciones opcionales: las del coach que siguen dando un 1 % o más después de rellenar los huecos, con el oro de desequipar de la pieza que sale.
  - Nunca usa piezas reservadas en el plan ni las que el coach aconseja guardar; cada Invoker entra solo si gana un 1 % o más; ninguna pieza se repite. Se puede desmarcar a cualquiera.
  - Con la caja real: 11 Invokers y 81 piezas sin oro en unos 2,5 s; con sustituciones, 18 Invokers, 95 piezas y 207.200 de oro.
- La lista «Equipar» del coach solo propone piezas a Invokers que usas (antes, a los 25 más fuertes, incluidos algunos sin combates ni equipos). En la ficha de una pieza, «¿A quién le sirve?» marca a los que no están en ningún equipo.
- Plan: `upsertMany` añade varias entradas de una vez (antes, varias altas seguidas se pisaban). El coach sigue visible mientras se recalcula.
- Pruebas: `equipBatch.test.ts` (quién cuenta como usado, «solo huecos» no toca lo puesto, sin repetir ni usar reservadas, huecos antes que sustituciones, oro de las sustituciones, entrada de plan); e2e del lote hasta el plan.

## Versión 0.17

- **Coach › Personajes: a quién subir** (`src/box/ascension.ts`): ranking de a quién subir a 6★ y a 5★, una entrada por personaje (su mejor copia).
  - Oficial (guías «Invoker Ascension» y «Levelling Up Invokers», tablas publicadas como imagen): tope de nivel = estrellas × 10 (máximo 6★, nivel 60); ascender pide estar en el tope y entregar tantos Invokers o Ecos de esas estrellas como estrellas tiene; XP acumulada por tope (8.000, 50.000, 204.000, 646.800, 1.618.300 y 3.814.300); subir de nivel solo aumenta VIDA, ATQ y DEF; estrellas iniciales por rareza. Una prueba opcional con caja real comprueba que la XP de cada Invoker en su tope coincide con la tabla.
  - De tu caja: estrellas, nivel, XP acumulada (se guarda `totalXp`), combates y equipos registrados de cada Invoker, despertar y piezas.
  - Puntuación 0–100 con pesos a la vista: lo usas 45 %, tier oficial 35 % (general y tus tres mejores jefes con récord), ya invertido 10 %, listo 10 %. Cada puesto explica sus razones y avisos, lo que gana, lo que cuesta (XP que falta, material, XP del tramo nuevo) y el máximo oficial de su ficha frente a su base actual.
  - No se estima cuánto sube cada estadística por nivel: el juego no lo publica y de la caja no sale una fórmula fiable (se comprobó).
  - «¿Tienes con qué?»: Invokers sin usar por estrellas y cuántas ascensiones dan fusionándolos hacia arriba con la regla oficial, con la XP que habría que dar a las bases. Material prudente: sin bloquear, fuera de equipos y plan, sin piezas ni despertar, y copias repetidas o comunes, poco comunes y raros que no estén en S+, S o A+. Los Ecos y las pociones de XP no están en la caja.
- **Coach simplificado**: pestañas Hoy · Personajes · Piezas · Jefes · Más (revisión de builds y tolerancias; las rutas antiguas siguen funcionando). «Hoy» muestra los tres frentes con datos de la caja y «Empieza por aquí»: tres pasos en lenguaje llano, cada uno con «Aprende por qué», y el resto plegado. Nuevo paso «Sube a X a 6★/5★».
- La caja leída de la carpeta del juego usa el tope oficial (estrellas × 10) en vez de 50 fijo.
- Pruebas: `ascension.test.ts` (tabla oficial, ranking, una entrada por personaje, equipos activos, material y fusión); e2e con las pantallas nuevas.

## Versión 0.16

- El coach de piezas enseña en lugar de solo listar razones. Cada pieza (en Coach › Piezas con «Explícamelo» y en su ficha):
  - **La pieza, para quien la llevaría**: principal (fija, le sirve o no; valor actual → al +20) y las 4 casillas de subestadística con semáforo (le sirve, a medias, no le sirve, casilla vacía con la probabilidad de que salga útil), nota y una marca por mejora recibida.
  - **A favor / En contra** en frases cortas (rango, rareza, principal, subestadísticas útiles, mejoras que cayeron bien o se perdieron, a quién mejora).
  - **Camino de subida** +0 → +5 → +10 → +15 → +20: qué pasó, dónde está y, en cada hito que falta, si trae una subestadística nueva o mejora una y la probabilidad de que sea útil.
  - **Qué hacer en el próximo hito**: barra de probabilidad y dos salidas («si sale X, sigue hasta +N»; «si sale Y, para y véndela» o «búscale sustituta»), con la regla de parada de Nexo: deja de subir cuando más de la mitad de las mejoras se han perdido o no queda ninguna subestadística útil a la que pueda caer.
  - El razonamiento completo con fuentes queda plegado.
- **Cómo leer una pieza (2 minutos)**: principal, subestadísticas e hitos, por qué subir es una lotería, rango y rareza, notas y la regla de oro. Se puede plegar y se recuerda.
- Pruebas del camino de hitos, del próximo hito y de la regla de parada; el e2e abre la explicación de una pieza.

## Versión 0.15

- **Coach** sustituye al Asesor (segunda entrada del menú y de la barra móvil). «Qué hacer ahora»: acciones priorizadas con su porqué (enlace a punto de caducar, plan pendiente, marcar equipos activos, ranuras vacías, equipar, subir, no invertir en piezas de poco rango, probar, limpieza, siguiente fase de tus jefes). Las 3 primeras, también en Inicio.
- **Coach de piezas** (`src/box/gearCoach.ts`): veredicto y razonamiento completo para cada reliquia y accesorio, por bloques (qué es, sus estadísticas para quien la llevaría, lo que puede llegar a ser, para tu cuenta, decisión), cada paso etiquetado como oficial, tu caja, cálculo o criterio de Nexo.
  - Reglas oficiales de las guías Relics y Accessories: subestadísticas de serie por rareza, hitos +5/+10/+15/+20 (desbloqueo o mejora al azar), tiradas del 70–100 % con el mismo peso, tabla de notas (una prueba la compara con la guía que se descarga cada semana), el rango no se sube, vender da oro y triturar Memorium, accesorios por facción y despertar, conjuntos que solo dan los jefes.
  - De tu caja: valor de una tirada máxima por estadística y rango (subestadísticas con nota B sin mejoras = 100 %). Con él se ve que las subestadísticas planas de ATQ/DEF/VIDA pueden rendir más que las de % según la base del Invoker (p. ej., +15 DEF = 4,5 % de una base de 330, frente al 1,9 % de DEF %): se quita la penalización que tenían en «Qué vender» y en la valoración.
  - Decisión: una pieza libre por Invoker y ranura para «equipar» (ganancia ≥ 1 %); «probar» solo si su valor medio esperado al +20 (principal al máximo del portal y tiradas medias en mejoras y desbloqueos) mejora en ≥ 1 % a tus equipos activos y plan (o a tus 10 más fuertes), con 2 candidatas por ranura y qué vigilar en el siguiente hito; «sustituir» las 3★ equipadas si hay libres de más rango.
- **Plan** en 3 pasos (enviar, marcador, «Equip all») más la comprobación al reimportar; el marcador se instala desde la propia página. El marcador y la extensión, tras guardar el preset, abren la pestaña Presets y pulsan «Load» (el marcador refresca la lista del portal sin recargar; si algo falla, recarga y lo explica). Nombre de preset con fecha y hora.
- El coach se carga al abrirlo: el paquete inicial baja de 174 a 153 KB comprimidos.
- Pruebas: `gearCoach.test.ts` (tabla de notas frente a la guía oficial, hitos por rareza, grupos de desbloqueo, valores de tirada, proyección, veredictos y razonamiento); e2e con el marcador cargando el preset en un optimizador simulado y con las páginas del coach.

## Pendiente

- Validar en el juego los supuestos de tiempos y maná (contar definitivas en 3 min).
- La simulación no incluye la defensa del jefe ni sinergias entre aliados; la asignación conjunta es heurística.
- Llevar el objetivo a las agujas con los datos de pisos ya disponibles (PREC/RES por piso).
- Comprobar el primer lanzamiento del workflow semanal en GitHub Actions (que invokers.com responde a sus servidores).
- Textos de habilidades en español: invokers.com solo los publica en inglés.
- Datos de habilidades y descripciones del catálogo público.
- Probar la importación desde la carpeta del juego en Windows y Mac con archivos reales.
