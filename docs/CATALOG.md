# Catálogo y recursos de la versión 0.4

Los retratos e iconos son materiales publicados por HITZONE en el portal oficial de **Invokers: Titan Legacy**, utilizados en una herramienta gratuita de fans con interfaz y código propios. No son los SVG genéricos de la versión 0.3 ni imágenes generadas. Los originales se conservan sin transformación y se sirven desde el mismo alojamiento de la aplicación.

## Fuentes

- Catálogo de Invokers: https://www.invokers.com/invokers/
- Catálogo de Titanes: https://www.invokers.com/titans/
- Índice público de datos: https://www.invokers.com/hub/index/invokers/
- Materiales de equipo publicados por el portal: https://www.invokers.com/hub/box/invokers/
- Política de contenido de fans: https://www.invokers.com/en/terms/fan-content-policy/

Consulta: 10 de noviembre de 2026. El catálogo público corresponde al conjunto de datos 0.62.1655. La política permite materiales del juego publicados, incorporados a contenido de fans con aportación propia, sin presentarse como producto oficial. La identidad visual principal de la web es **Nexo**. El proyecto no vende recursos ni cobra por acceder a ellos.

`game-assets-manifest.json` registra URL de origen y SHA-256 de las 586 imágenes. `scripts/check-game-assets.mjs` comprueba formato, origen e integridad. Cada ficha incluye enlace al personaje en el portal oficial; no se copian sus textos de habilidades ni biografías.

## Correspondencias de identidad: alcance y procedencia

`src/catalog/characters.json` contiene los nombres cortos, rareza, rol, elemento, facción y rutas de retratos publicados por el portal oficial: 242 Invokers y 39 Titanes. Los nombres propios conservan la forma del catálogo; las etiquetas de interfaz están en castellano.

`src/catalog/observed-identities.json` es una tabla separada de **122 pares de identificadores técnicos** (`configId` del snapshot → código de personaje). Son las 101 identidades de Invokers y 21 de Titanes observadas al contrastar los archivos facilitados por el usuario con su informe de importación local de referencia. El informe se produjo durante la investigación previa con el lector de referencia de GGNoLuck. Se cruzaron después los códigos con las fichas oficiales. Esta tabla no se presenta como una publicación oficial de equivalencias: el listado oficial de personajes no expone los `configId` de los snapshots.

No se incorpora el catálogo completo de GGNoLuck, su código, WebAssembly, imágenes, traducciones, guías ni puntuaciones. El informe de referencia y los `.dat` permanecen fuera del repositorio y del despliegue. Los pares técnicos no incluyen identificadores de instancia, nombre de jugador, equipamiento ni estadísticas personales.

Los 122 pares cubren las 426 copias presentes en los archivos de prueba. **No cubren automáticamente las 159 identidades restantes del catálogo.** Una identidad nueva desconocida se muestra por ID con un aviso; no se infiere por parecido numérico, nombre, nivel o imagen. Si hay identidades desconocidas, los personajes «pendientes» no implican una ausencia confirmada. Las futuras correspondencias deben verificarse antes de añadirse.

## Reglas de presentación

- Los contadores distinguen personajes diferentes de copias; agrupar duplicados no borra ninguna instancia.
- Rareza, facción, elemento y rol proceden del catálogo. Nivel, estrellas, bloqueo, mejoras y equipo proceden de los snapshots.
- Las fichas permiten seleccionar una copia y consultar sus piezas reales. No muestran un poder inventado ni estadísticas finales no calculadas.
- Los accesorios usan la imagen oficial de su facción y ranura. Las reliquias usan 171 ilustraciones oficiales de conjunto y ranura identificadas en la caja compartida real; si falta una combinación se muestran los iconos oficiales de ranura y conjunto.
- El comparador permite solo piezas libres. Los accesorios, además, deben coincidir con la facción verificada del Invoker.
- Las imágenes visitadas se almacenan en la caché local de la PWA para poder volver a mostrarlas sin conexión. No se transmite el inventario al portal oficial.

## Actualizar

El catálogo se construyó a partir de los metadatos públicos de las páginas oficiales y los recursos vinculados en ellas. Para actualizarlo, contrastar la nueva versión pública, añadir exclusivamente personajes publicados, conservar enlaces y registrar nuevos SHA-256. No ampliar `observed-identities.json` por patrones de números ni por deducciones de los identificadores de habilidades. Ejecutar `npm test` y la prueba de navegador con archivos locales antes de desplegar.

## Importación oficial por enlace (11 de noviembre)

La respuesta pública de una caja compartida contiene nombres, códigos de retrato y estadísticas. Esta vía se vincula directamente por el código publicado, sin depender de los 122 pares observados. Los `configId` grandes son números JSON que pueden perder precisión en JavaScript: se conservan las identidades por código en un espacio `official:` separado y no se presentan valores redondeados como IDs originales. Se validan tipos, límites, ranuras, rarezas y referencias de propietarios antes de guardar. Las estadísticas `reportedStats` son las publicadas por el portal, no resultados de nuestro motor.

El endpoint público `https://invokers.com/api/lamb/{token}` carece de CORS para GitHub Pages. La app auxiliar lee ese endpoint sin cookies ni credenciales tras una acción del usuario y comparte un archivo JSON privado. El enlace personal y la respuesta de prueba permanecen fuera del repositorio y del despliegue.
