# Invokers Bridge · prototipo Android 16

Puente auxiliar de **solo lectura**. Usa la API pública [Shizuku 13.1.5](https://github.com/RikkaApps/Shizuku-API), concretamente `UserService`, para ejecutar un lector de archivos con identidad shell. La ruta fuente está fijada a `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots`. Solo expone nombres `.dat` válidos y descriptores de lectura. No ejecuta comandos de shell, no hace peticiones de red y no abre contraseñas.

El proceso de la app recibe los descriptores, limita el lote a 250 MiB, copia los archivos a su caché privado y los ofrece con `FileProvider` mediante `ACTION_SEND_MULTIPLE`. La primera vez, el usuario elige la PWA instalada en el menú Compartir. Si Android informa qué WebAPK se eligió, el puente lo recuerda y en lecturas posteriores intenta abrirlo directamente. La PWA usa Web Share Target para guardar el lote automáticamente en IndexedDB. El botón «Borrar copias temporales» elimina los archivos de la caché del puente.

## Compilar

Se necesitan JDK 21, SDK Android 36 y Build Tools 35.0.0. Desde `bridge/`:

```sh
/path/to/gradle-8.13/bin/gradle :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. La copia publicada para la web se ubica en `../public/bridge.apk`; tras cambiar el código, vuelve a compilar y copia el APK antes de publicar el sitio.

## Estado de validación

La compilación, las pruebas de validación de nombres y lint pasaron para la versión inicial. El receptor PWA y la transferencia por `share_target` se probaron en Chromium. El usuario confirmó que la primera versión del puente leyó doce archivos reales en Android 16; queda probar la entrega a la PWA y el recuerdo del destino con esta actualización. Shizuku depende de que su servicio esté activo; después de reiniciar el teléfono puede ser necesario arrancarlo mediante depuración inalámbrica. Se necesita validar el contenido de los `.dat` antes de afirmar que se ha interpretado la cuenta.
