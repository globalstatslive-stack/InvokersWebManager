# Invokers Web Manager

**Web publicada para probar en Android:** https://globalstatslive-stack.github.io/InvokersWebManager/

Desde Chrome en el móvil, abre esa dirección y usa «Añadir a pantalla de inicio» o «Instalar aplicación». En la guía de la propia web puedes descargar Invokers Bridge. En la prueba del usuario, el puente ya leyó 12 archivos desde Android 16; falta verificar que lleguen a la PWA.

Web móvil e instalable para organizar snapshots de **Invokers: Titan Legacy**. Proyecto independiente. No incluye recursos, código ni datos de GGNoLuck o del juego.

## Estado real de la versión 0.1

Funciona la recepción de archivos compartidos con una PWA instalada: los `.dat` recibidos se validan y guardan automáticamente en IndexedDB. La selección manual de una carpeta `aggregate_snapshots` o de archivos `.dat` individuales desde Chrome Android conserva la vista previa. La web detecta cuatro nombres conocidos, lee tamaño y firma binaria, calcula huellas SHA-256, conserva hasta cinco lotes, compara archivos cambiados y permite borrar los datos guardados. La interfaz es adaptable a móvil y puede instalarse como PWA si se sirve por HTTPS.

**Todavía no interpreta personajes, Titanes, reliquias ni accesorios.** El formato de los doce `.dat` sigue sin verificar porque no se han aportado muestras. Los números de colección se muestran como «—». La app marca un lote como «archivos guardados» o «incompleto», nunca como colección sincronizada. El usuario ya verificó la lectura de doce archivos con el puente en Android 16; la recepción completa en Chrome requiere otra prueba. No hay ventas.

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

La prueba funcional usa archivos sintéticos de dos bytes **solo para comprobar selección, almacenamiento y comparación**, no para simular datos del juego.

## Acceso directo desde Android 16 (fase de prueba)

La web publicada incluye [Invokers Bridge](bridge/), una app Android pequeña que usa el **UserService oficial de Shizuku** con identidad shell para leer únicamente los `.dat` de la ruta fija `aggregate_snapshots`. La app copia los archivos a su caché privado y los envía mediante el menú Compartir de Android. La PWA instalada declara un Web Share Target que recibe y guarda los archivos automáticamente en IndexedDB. Si el usuario elige la PWA la primera vez y Android informa del WebAPK elegido, el puente recuerda el destino y en la próxima lectura intenta abrirlo directamente. No abre contraseñas, no escribe en el juego y no transmite archivos al alojamiento web.

Se probaron el puente y el receptor PWA por separado; el usuario confirmó en su Android 16 que Shizuku permitió leer doce archivos. **La entrega completa a la PWA sigue pendiente de prueba en ese teléfono.** Para probarla: instala la PWA desde Chrome, actualiza el APK del puente desde la sección «Cómo sincronizar», inicia Shizuku y autoriza el puente, abre Invokers Bridge, pulsa «Leer y compartir snapshots» y elige la PWA en Compartir si aparece el menú. La web debe abrir «Archivos» con el lote guardado. Si falla, registra el mensaje que muestre el puente o qué destino aparece en el menú Compartir. Shizuku puede requerir volver a iniciarse tras reiniciar el móvil.

El APK del puente es una compilación de desarrollo; su primera instalación puede requerir autorizar «Instalar aplicaciones desconocidas» para el navegador que lo descargue. No ofrece venta ni equipamiento.

## Importar desde Android

1. Usa el procedimiento que ya comprobaste con Shizuku y X-plore para copiar `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots/` a `Download/Invokers/aggregate_snapshots/`.
2. Pulsa «Seleccionar carpeta» y elige esa copia en Descargas. Si el selector de tu navegador no admite carpetas, pulsa «Elegir archivos» y selecciona los `.dat`.
3. Revisa los nombres, tamaños y avisos. Pulsa «Guardar archivos locales». Los archivos originales no se modifican.
4. Al copiar una exportación posterior, vuelve a importar y abre «Historial» para ver qué archivos se añadieron, cambiaron o desaparecieron.

La selección de carpetas mediante `webkitdirectory` puede depender de la versión del navegador y el proveedor de archivos Android; por eso existe la selección múltiple de archivos. El historial guarda hasta cinco lotes en IndexedDB. Chrome puede eliminar datos de sitios con poco espacio o al limpiar los datos del navegador. La web no transmite el inventario a un servidor.

## Lo que necesito para continuar

Adjunta los doce `.dat` de una **copia** de `aggregate_snapshots`, o al menos los cuatro identificados (`PlayerHeroesModel.dat`, `PlayerAnimasModel.dat`, `PlayerRelicsModel.dat`, `PlayerAccessoriesModel.dat`). Con muestras reales se podrá inspeccionar la serialización, crear un lector verificable y contrastar los recuentos y relaciones con tu colección. No hace falta usuario ni contraseña del juego. Los archivos pueden contener información de tu cuenta; no se publicarán sin autorización expresa.

El puente de Shizuku ya está implementado como prueba. Antes de afirmar que sincroniza en tu cuenta hay que validar su lectura y entrega en tu móvil. Venta y equipamiento requieren además un mecanismo de escritura legítimo y pruebas que demuestren el resultado real dentro del juego.
