# Invokers Web Manager

Web móvil e instalable para organizar snapshots de **Invokers: Titan Legacy**. Proyecto independiente. No incluye recursos, código ni datos de GGNoLuck o del juego.

## Estado real de la versión 0.1

Funciona la selección de una carpeta `aggregate_snapshots` o de archivos `.dat` individuales desde Chrome Android, con vista previa, detección de cuatro nombres conocidos, lectura de tamaño y firma binaria, huellas SHA-256, guardado local en IndexedDB, historial limitado a cinco lotes, comparación de archivos cambiados y borrado de los datos guardados. La interfaz es adaptable a móvil y puede instalarse como PWA si se sirve por HTTPS.

**Todavía no interpreta personajes, Titanes, reliquias ni accesorios.** El formato de los doce `.dat` sigue sin verificar porque no se han aportado muestras. Los números de colección se muestran como «—». La app marca un lote como «archivos guardados» o «incompleto», nunca como colección sincronizada. No hay conexión automática ni ventas.

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
```

La prueba funcional usa archivos sintéticos de dos bytes **solo para comprobar selección, almacenamiento y comparación**, no para simular datos del juego.

## Importar desde Android

1. Usa el procedimiento que ya comprobaste con Shizuku y X-plore para copiar `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots/` a `Download/Invokers/aggregate_snapshots/`.
2. Pulsa «Seleccionar carpeta» y elige esa copia en Descargas. Si el selector de tu navegador no admite carpetas, pulsa «Elegir archivos» y selecciona los `.dat`.
3. Revisa los nombres, tamaños y avisos. Pulsa «Guardar archivos locales». Los archivos originales no se modifican.
4. Al copiar una exportación posterior, vuelve a importar y abre «Historial» para ver qué archivos se añadieron, cambiaron o desaparecieron.

La selección de carpetas mediante `webkitdirectory` puede depender de la versión del navegador y el proveedor de archivos Android; por eso existe la selección múltiple de archivos. El historial guarda hasta cinco lotes en IndexedDB. Chrome puede eliminar datos de sitios con poco espacio o al limpiar los datos del navegador. La web no transmite el inventario a un servidor.

## Lo que necesito para continuar

Adjunta los doce `.dat` de una **copia** de `aggregate_snapshots`, o al menos los cuatro identificados (`PlayerHeroesModel.dat`, `PlayerAnimasModel.dat`, `PlayerRelicsModel.dat`, `PlayerAccessoriesModel.dat`). Con muestras reales se podrá inspeccionar la serialización, crear un lector verificable y contrastar los recuentos y relaciones con tu colección. No hace falta usuario ni contraseña del juego. Los archivos pueden contener información de tu cuenta; no se publicarán sin autorización expresa.

La automatización posterior con Shizuku sería un componente Android aparte. Antes de hacerlo hay que validar la lectura con su API oficial y un canal seguro hacia la web. Venta y equipamiento requieren además un mecanismo de escritura legítimo y pruebas que demuestren el resultado real dentro del juego.
