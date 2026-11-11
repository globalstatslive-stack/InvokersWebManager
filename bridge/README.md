# Invokers Bridge 0.2.0 · Android 16

Puente auxiliar de **solo lectura** con dos entradas. Puede leer los `.dat` locales con Shizuku o descargar una colección que el usuario haya compartido mediante el enlace oficial LAMB. No solicita credenciales ni modifica el juego.

## Enlace oficial compartido

Pega `https://invokers.com/lamb/?b=…` en el puente y pulsa «Importar enlace y abrir la web». También se acepta el dominio `www.invokers.com`. La importación por enlace **no necesita Shizuku**. El puente hace únicamente `GET https://invokers.com/api/lamb/{token}`; el endpoint se observó en el visor público oficial. No usa sesiones, cookies de Chrome ni contraseñas. La colección de ese enlace es una instantánea: volver a descargarla no obliga al juego a actualizarla. El enlace puede caducar o ser revocado desde el portal oficial.

El navegador no permite leer directamente esa respuesta desde GitHub Pages: en la comprobación del 11/11/2026 el endpoint no incluyó cabeceras CORS para ese origen. El puente evita necesitar un servidor intermediario: descarga la respuesta en el dispositivo y comparte `invokers-shared-box.json` con la PWA, que valida el formato antes de guardarlo.

La entrada desde la web es:

```text
intent://import?url={enlace HTTPS codificado}#Intent;scheme=invokersbridge;package=es.invokers.bridge;end
```

También acepta `ACTION_SEND` con `text/plain` y un enlace completo, por ejemplo al compartirlo desde Chrome. Tanto los enlaces pegados como los recibidos se validan: solo HTTPS, dos hosts oficiales, ruta `/lamb/` o `/lamb`, un único parámetro `b`, token alfanumérico con guiones de hasta 80 caracteres, sin usuario, puerto ni fragmento. El enlace no se conserva en preferencias. No se siguen redirecciones. Los tiempos de conexión/lectura son de 20 segundos; la descarga se limita a 20 MiB, incluso sin `Content-Length`. Un 404 informa de enlace caducado o colección no pública. No se ejecutan peticiones para habilitar, renovar ni desactivar enlaces.

## Snapshots mediante Shizuku

Usa la API pública [Shizuku 13.1.5](https://github.com/RikkaApps/Shizuku-API), concretamente `UserService`, para ejecutar un lector de archivos con identidad shell. La ruta fuente está fijada a `Android/data/hitzone.anima.spirit.guardians/files/aggregate_snapshots`. Solo expone nombres `.dat` válidos y descriptores de lectura. No ejecuta comandos de shell.

El proceso de la app recibe los descriptores, limita el lote a 250 MiB, copia los archivos a su caché privado y los ofrece con `FileProvider` mediante `ACTION_SEND_MULTIPLE`. La primera vez, el usuario elige la PWA instalada en el menú Compartir. Si Android informa qué WebAPK se eligió, el puente lo recuerda y en lecturas posteriores intenta abrirlo directamente. Este mismo mecanismo entrega el JSON del enlace oficial, usando `application/json`. La PWA usa Web Share Target para validar y guardar el lote en IndexedDB. El botón «Borrar copias temporales» elimina los archivos de la caché del puente.

## Compilar

Se necesitan JDK 21, SDK Android 36 y Build Tools 35.0.0. Desde `bridge/`:

```sh
/path/to/gradle-8.13/bin/gradle :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. La copia publicada para la web se ubica en `../public/bridge.apk`; tras cambiar el código, vuelve a compilar y copia el APK antes de publicar el sitio.

Para poder actualizar una instalación existente debe conservarse la misma clave de firma. La clave de desarrollo permanece fuera del repositorio; comprueba que `apksigner verify --print-certs` muestre el mismo SHA-256 de certificado antes de distribuir una actualización.

## Estado de validación

El usuario confirmó que la primera versión del puente leyó doce archivos reales en Android 16. La versión 0.2.0 incorpora pruebas de hosts/rutas/token, rechazos de redirección, caducidad, límites de tamaño y respuesta JSON. La entrega completa enlace → puente → PWA y la recepción mediante Intents requieren validación en un Android con Chrome y la PWA actualizada; las pruebas JVM no sustituyen esa prueba. Shizuku depende de que su servicio esté activo; después de reiniciar el teléfono puede ser necesario arrancarlo mediante depuración inalámbrica.
