# Estado del proyecto · 11 de noviembre de 2026

## Implementado

- Web React/TypeScript/Vite con diseño propio oscuro, adaptable a móvil.
- Versión 0.4: identidad visual Nexo, retratos oficiales, agrupación de copias, filtros avanzados y fichas de equipo. 586 imágenes del portal oficial con origen e integridad comprobados.
- Importación de caja JSON oficial verificada con la instantánea compartida del usuario: 378 Invokers, 50 Titanes, 881 reliquias y 87 accesorios.
- Carpeta recordada y actualización al abrir la pantalla de importación con consentimiento cuando el navegador admite File System Access y conserva permiso.
- Puente 0.2: lectura de enlaces públicos oficiales mediante HTTPS y entrega del JSON a la PWA. No requiere Shizuku para ese modo.
- Comparador restringido a accesorios de la facción verificada del personaje.
- PWA con manifiesto, iconos, caché de la interfaz y receptor Web Share Target, probado en Chromium.
- Importación local de carpeta o archivos `.dat` mediante el selector del navegador.
- Vista previa de nombres, tamaños, huellas SHA-256 y cabeceras; reconocimiento del contenedor MemoryPack.
- Lector propio de modelos MemoryPack con límites y comprobaciones de referencias; extrae Invokers, Titanes, reliquias, accesorios, estadísticas y propietarios.
- Colección con filtros y herramienta de simulación de una ranura usando solo piezas libres; revisión de candidatos a venta sin ejecutar operaciones.
- Interpretación automática de importaciones anteriores y comparación de cambios de inventario entre lotes interpretados.
- IndexedDB con historial de hasta cinco lotes, comparación por huellas y borrado completo.
- Guía del procedimiento Android validado por el usuario.
- Invokers Bridge de solo lectura con UserService de Shizuku y envío mediante el menú Compartir; el usuario confirmó que leyó doce archivos en Android 16.
- Los archivos compartidos se validan y guardan automáticamente al abrir la PWA. La selección manual conserva su vista previa.
- El puente recuerda un destino WebAPK «Invokers» elegido por el usuario cuando Android lo comunica y permite olvidarlo con «Cambiar destino de compartir».

## Pendiente de validación y desarrollo

- Contrastar en el móvil los recuentos y propietarios con el juego.
- Cobertura de identidades futuras fuera de los 122 vínculos verificados para snapshots y cálculo propio de estadísticas completas.
- Validación en el Android del usuario de la entrega del JSON compartido desde el puente 0.2 a la PWA.
- Optimizador de builds completas, equipos y calculadoras con fórmulas verificadas.
- Validación de la entrega completa puente → PWA en el móvil del usuario.
- Método autorizado de venta o equipamiento.
- Prueba del recuerdo del destino WebAPK en Android.

## Evidencia

- `npm run build`: correcto.
- `npm test`: doce pruebas de importación oficial, identidad, compatibilidad, firmas, archivos faltantes, comparación y estructura MemoryPack.
- `node scripts/e2e.mjs` con Chromium a 390 × 844 px: importación, recarga, comparación y borrado correctos.
- `scripts/share-e2e.mjs`: cuatro archivos compartidos se guardan automáticamente y persisten tras recargar la PWA en Chromium.
- Los doce archivos reales del usuario, probados fuera del repositorio, producen 376 Invokers, 50 Titanes, 901 reliquias y 327 accesorios; se verificaron niveles, identificadores, propietarios y bonificaciones contra un lector de referencia.
- Chromium a 390 × 844 px: importación de los doce archivos, visualización de la colección y herramientas, persistencia y reinterpretación de un lote antiguo.
- GitHub Pages activo: `https://globalstatslive-stack.github.io/InvokersWebManager/` devuelve HTTP 200. Manifiesto y service worker válidos; el APK publicado coincide en SHA-256 con la compilación local.
- La pantalla móvil se revisó visualmente. El usuario confirmó la lectura de doce archivos con Shizuku en Android 16; faltan la recepción PWA y el recuerdo del destino en el teléfono.

## Retirada de RAID

Los archivos del proyecto, los artefactos y las copias de cuenta se retiraron de `/workspace`. Se eliminó la rama GitHub `downloads` que alojaba el APK personal y se vació la rama `main`. La eliminación total del repositorio GitHub devolvió `HTTP 403: Resource not accessible by integration`; requiere una cuenta con permisos de administrador en GitHub. Los commits antiguos podrían seguir existiendo hasta que se elimine el repositorio.
