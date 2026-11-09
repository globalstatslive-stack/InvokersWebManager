# Invokers Bridge · prototipo Android 16

Puente auxiliar de **solo lectura**. Usa la API pública [Shizuku 13.1.5](https://github.com/RikkaApps/Shizuku-API), concretamente `UserService`, para ejecutar un lector de archivos con identidad shell. La ruta fuente está fijada a `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots`. Solo expone nombres `.dat` válidos y descriptores de lectura. No ejecuta comandos de shell, no hace peticiones de red y no abre contraseñas.

El proceso de la app recibe los descriptores, limita el lote a 250 MiB, copia los archivos a su caché privado y los ofrece con `FileProvider` mediante `ACTION_SEND_MULTIPLE`. El usuario elige manualmente la PWA instalada en el menú Compartir. La PWA usa Web Share Target para abrir la vista previa antes de guardar en IndexedDB. El botón «Borrar copias temporales» elimina los archivos de la caché del puente.

## Compilar

Se necesitan JDK 21, SDK Android 36 y Build Tools 35.0.0. Desde `bridge/`:

```sh
/path/to/gradle-8.13/bin/gradle :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. La copia publicada para la web se ubica en `../public/bridge.apk`; tras cambiar el código, vuelve a compilar y copia el APK antes de publicar el sitio.

## Estado de validación

Compilación, dos pruebas de validación de nombres y lint (0 errores) pasan. El receptor PWA y la transferencia por `share_target` se probaron en Chromium. **No se ha probado todavía la lectura real de la carpeta del juego ni el destino Compartir en Android 16**. Shizuku depende de que su servicio esté activo; después de reiniciar el teléfono puede ser necesario arrancarlo mediante depuración inalámbrica. Se necesita una prueba del usuario con los doce `.dat` reales antes de afirmar que sincroniza la cuenta.
