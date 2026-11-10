# Invokers Web Manager

**Web publicada para probar en Android:** https://globalstatslive-stack.github.io/InvokersWebManager/

Desde Chrome en el móvil, abre esa dirección y usa «Añadir a pantalla de inicio» o «Instalar aplicación». En la guía de la propia web puedes descargar Invokers Bridge. En la prueba del usuario, el puente ya leyó 12 archivos desde Android 16; falta verificar que lleguen a la PWA.

Web móvil e instalable para organizar snapshots de **Invokers: Titan Legacy**. Proyecto independiente. No incluye recursos, código ni datos de GGNoLuck o del juego.

## Estado real de la versión 0.3

La colección usa una galería adaptable a móvil con ilustraciones SVG originales: retratos genéricos para Invokers y Titanes y trece iconos de ranura para reliquias y accesorios. Las tarjetas muestran nivel, rango, rareza, propietario y detalles desplegables. El equipo se filtra por tipo, rareza y disponibilidad; el simulador comparte sus ilustraciones. Son imágenes de categoría, no retratos oficiales ni una identificación visual de cada personaje.

Funciona la recepción de archivos compartidos con una PWA instalada: los `.dat` se validan, interpretan y guardan automáticamente en IndexedDB. La selección manual de una carpeta o de archivos `.dat` individuales conserva la vista previa. La web reconoce el contenedor MemoryPack, calcula huellas SHA-256 y conserva hasta cinco lotes.

El lector independiente extrae **Invokers, Titanes, reliquias y accesorios**, con identificadores de instancia, niveles, rangos, bonificaciones y propietarios de equipo. Comprueba tamaños, recuentos y referencias cruzadas antes de marcar la colección como interpretada. Las importaciones antiguas se interpretan al abrir la versión nueva; la sección «Historial» compara altas, mejoras y cambios de propietario entre lotes interpretados.

La colección muestra identificadores de modelo en lugar de nombres: los `.dat` no contienen nombres y todavía no hay un catálogo independiente autorizado. «Herramientas» permite comparar una ranura con piezas libres y revisar candidatos a venta **sin ejecutar cambios en el juego**. No calcula todavía la build completa, los costes ni las composiciones de equipo. La entrega del puente a la PWA sigue pendiente de confirmación en el Android del usuario.

## Ejecutar y probar

Requiere Node.js 20.19+ o 22.12+.

```sh
cd /workspace/InvokersWebManager
npm ci
npm run dev
```

Abre la URL local indicada por Vite para probar en este entorno. Para instalar en Android 16 como PWA se necesita desplegar `dist/` en un origen **HTTPS** accesible desde el teléfono. Una dirección `localhost` del entorno no será accesible desde el móvil. Compilar:

```sh
npm run build
npm test
```

Prueba funcional de Chrome móvil (requiere Chromium instalado y el servidor de Vite activo en `127.0.0.1:5173`):

```sh
node scripts/e2e.mjs
node scripts/share-e2e.mjs
```

Las pruebas automatizadas usan archivos sintéticos para comprobar selección y almacenamiento y un lote MemoryPack construido para verificar el parser. Los doce `.dat` reales aportados por el usuario se probaron en privado: 376 Invokers, 50 Titanes, 901 reliquias y 327 accesorios. Ninguno se incluye en el repositorio ni en `dist/`.

## Acceso directo desde Android 16 (fase de prueba)

La web publicada incluye [Invokers Bridge](bridge/), una app Android pequeña que usa el **UserService oficial de Shizuku** con identidad shell para leer únicamente los `.dat` de la ruta fija `aggregate_snapshots`. La app copia los archivos a su caché privado y los envía mediante el menú Compartir de Android. La PWA instalada declara un Web Share Target que recibe y guarda los archivos automáticamente en IndexedDB. Si el usuario elige la PWA la primera vez y Android informa del WebAPK elegido, el puente recuerda el destino y en la próxima lectura intenta abrirlo directamente. No abre contraseñas, no escribe en el juego y no transmite archivos al alojamiento web.

Se probaron el puente y el receptor PWA por separado; el usuario confirmó en su Android 16 que Shizuku permitió leer doce archivos. **La entrega completa a la PWA sigue pendiente de prueba en ese teléfono.** Para probarla: instala la PWA desde Chrome, actualiza el APK del puente desde la sección «Cómo sincronizar», inicia Shizuku y autoriza el puente, abre Invokers Bridge, pulsa «Leer y compartir snapshots» y elige la PWA en Compartir si aparece el menú. La web debe abrir «Colección» con el lote interpretado. Si falla, registra el mensaje que muestre el puente o qué destino aparece en el menú Compartir. Shizuku puede requerir volver a iniciarse tras reiniciar el móvil.

El APK del puente es una compilación de desarrollo; su primera instalación puede requerir autorizar «Instalar aplicaciones desconocidas» para el navegador que lo descargue. No ofrece venta ni equipamiento.

## Importar desde Android

1. Usa el procedimiento que ya comprobaste con Shizuku y X-plore para copiar `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots/` a `Download/Invokers/aggregate_snapshots/`.
2. Pulsa «Seleccionar carpeta» y elige esa copia en Descargas. Si el selector de tu navegador no admite carpetas, pulsa «Elegir archivos» y selecciona los `.dat`.
3. Revisa los nombres, tamaños y avisos. Pulsa «Guardar archivos locales». Los archivos originales no se modifican.
4. Al copiar una exportación posterior, vuelve a importar y abre «Historial» para ver qué archivos se añadieron, cambiaron o desaparecieron.

La selección de carpetas mediante `webkitdirectory` puede depender de la versión del navegador y el proveedor de archivos Android; por eso existe la selección múltiple de archivos. El historial guarda hasta cinco lotes en IndexedDB. Chrome puede eliminar datos de sitios con poco espacio o al limpiar los datos del navegador. La web no transmite el inventario a un servidor.

## Referencia y límites

Se estudiaron las páginas públicas de [GGNoLuck](https://www.ggnoluck.com/es/) sobre importación, optimizador, clasificación y calculadoras. El código y la interfaz de este proyecto son propios; no se incorporó el módulo WebAssembly, el catálogo, imágenes ni otros recursos de GGNoLuck. El formato binario se implementó conforme a la [especificación pública de MemoryPack](https://github.com/Cysharp/MemoryPack#binary-wire-format-specification) y se contrastó con los archivos reales facilitados por el usuario.

Quedan pendientes el catálogo de nombres, las estadísticas totales del personaje, las composiciones de equipo, las calculadoras que requieren fórmulas verificadas y la validación completa del puente en Android. Venta y equipamiento dentro del juego requieren un mecanismo de escritura legítimo y pruebas del resultado real. Ninguna operación de ese tipo está activa.
