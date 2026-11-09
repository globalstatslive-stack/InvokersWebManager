# Estado del proyecto · 9 de noviembre de 2026

## Implementado

- Web React/TypeScript/Vite/Tailwind con diseño propio oscuro, adaptable a móvil.
- PWA con manifiesto, iconos, caché de la interfaz y receptor Web Share Target, probado en Chromium.
- Importación local de carpeta o archivos `.dat` mediante el selector del navegador.
- Vista previa de nombres, tamaños, huellas SHA-256 y cabeceras hexadecimales; reconocimiento de contenedores GZIP, ZIP y SQLite por sus firmas estándar, sin asumir la estructura interna.
- IndexedDB con historial de hasta cinco lotes, comparación por huellas y borrado completo.
- Guía del procedimiento Android validado por el usuario.
- Invokers Bridge de solo lectura con UserService de Shizuku y envío mediante el menú Compartir; APK compilado y pruebas locales aprobadas.

## Pendiente de muestras y validación

- Formato de los doce `.dat`; parser de personajes, Titanes, reliquias y accesorios.
- Contrastar los resultados interpretados con el juego.
- Optimización basada en estadísticas reales.
- Validación del puente Android/Shizuku en el móvil del usuario; compilación y pruebas locales aprobadas.
- Método autorizado de venta o equipamiento.
- Comprobación del despliegue HTTPS y prueba del flujo completo Shizuku → puente → Chrome en el móvil.

## Evidencia

- `npm run build`: correcto.
- `npm test`: tres pruebas de firma, archivos faltantes y comparación.
- `node scripts/e2e.mjs` con Chromium a 390 × 844 px: importación, recarga, comparación y borrado correctos.
- `scripts/share-e2e.mjs`: cuatro archivos compartidos llegan a la vista previa de la PWA en Chromium, incluso bajo la subruta de GitHub Pages.
- La pantalla móvil se revisó visualmente. No se ha probado aún el selector nativo ni la instalación PWA en el teléfono del usuario.

## Retirada de RAID

Los archivos del proyecto, los artefactos y las copias de cuenta se retiraron de `/workspace`. Se eliminó la rama GitHub `downloads` que alojaba el APK personal y se vació la rama `main`. La eliminación total del repositorio GitHub devolvió `HTTP 403: Resource not accessible by integration`; requiere una cuenta con permisos de administrador en GitHub. Los commits antiguos podrían seguir existiendo hasta que se elimine el repositorio.
