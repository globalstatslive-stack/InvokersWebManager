# Nexo · Invokers: Titan Legacy

**Web publicada:** https://globalstatslive-stack.github.io/InvokersWebManager/ (instalable como PWA en Android)

Herramienta de fans independiente para gestionar tu cuenta de **Invokers: Titan Legacy** con los retratos, Titanes y objetos reales del juego. Su objetivo es superar a [GGNoLuck](https://www.ggnoluck.com/es/) con más herramientas y cálculos exactos. El código y el diseño son propios. No incorpora código ni recursos de GGNoLuck. Las ilustraciones se publican conforme a la política oficial de contenido de fans.

## Versión 0.5: qué incluye

| Sección | Qué hace |
|---|---|
| **Inicio** | Perfil, poder total, Invokers más fuertes, rareza, facciones por poder y tareas pendientes (qué optimizar, subir o vender). |
| **Invokers** | 378+ Invokers con retratos reales. Filtros por facción, elemento, clase y rareza, mejor copia por personaje y orden por poder o por **cualquier estadística**. Vista en cuadrícula o en tabla. |
| **Ficha** | Estadísticas base + equipo = total, porcentaje efectivo de las velocidades (curvas oficiales), tolerancias, habilidades, piezas equipadas, conjuntos activos, carencias y registros de combate en los que aparece. |
| **Optimizador exacto** | Mejor combinación de 8 reliquias, conjuntos y accesorios con tu inventario. Objetivo **daño efectivo** ATQ × (1 + crítico × daño crítico) o pesos libres; perfiles por rol, mínimos de estadística, conjunto obligatorio, origen de las piezas (libres / no bloqueados / todas) y protección de Invokers de tus equipos. Muestra estadísticas antes/después, la lista de cambios a hacer en el juego y el oro estimado para desequipar. |
| **Asesor** | Revisión de builds de tus equipos, cola de mejoras (piezas equipadas sin nivel máximo), candidatas a venta con motivos (notas A–D de cada subestadística) y buscador de **tolerancias** por corrupción de jefe. |
| **Equipo** | Inventario de reliquias y accesorios con valoración 0–100, notas, filtros por ranura, conjunto, rareza, rango, principal y subestadística. |
| **Titanes** | Efecto vinculado, bonificaciones, poder y uso en equipos. |
| **Equipos** | Récords por modo (jefes, agujas, arena, jefe de clan): mejor tiempo, victorias, derrotas y formación con sus Titanes. |
| **Códice** | Catálogo completo de Invokers y Titanes con lo que tienes, lo que te falta y el progreso por facción. |
| **Historial** | Compara la importación actual con la anterior: poder ganado, subidas de nivel y rango, piezas nuevas. |

### Cálculo exacto

La caja compartida oficial (`https://invokers.com/api/lamb/<código>`) publica para cada Invoker sus estadísticas base (`basis`, coma fija 32.32), el aporte del equipo (`gearBonus`) y las reglas de los conjuntos. Nexo reproduce ese aporte **sin discrepancias** para todos los Invokers equipados de la caja de prueba:

```
aporte = Σ bonificaciones fijas + Σ (% × base) para vida/ataque/defensa + bonos de conjunto (3/5/8 piezas)
total propuesto = total publicado − aporte publicado + aporte de la build propuesta
```

El optimizador usa programación dinámica exacta sobre pares de conjuntos (8 ranuras admiten como mucho dos conjuntos de 3+ piezas), varios arranques y búsqueda local con la fórmula completa. En la caja de prueba encontró +44 % de daño efectivo para el Invoker más fuerte usando solo piezas libres.

## Importar tu cuenta

**En PC o Mac (recomendado): desde la carpeta del juego**

1. Abre tu caja en el juego y espera unos segundos: el juego guarda sus archivos.
2. En Nexo → **Importar** → «Desde el juego», copia la ruta:
   - Windows: `%USERPROFILE%\AppData\LocalLow\Hit_Zone\Invokers`
   - Mac: `~/Library/Application Support/Hit_Zone/Invokers` (en el selector, ⌘⇧G para pegarla)
3. Pulsa **Importar mi caja**, pega la ruta en el selector y elige la carpeta **Invokers**. También se puede arrastrar la carpeta.

Nexo busca los snapshots en `aggregate_snapshots`, los lee con su lector MemoryPack y recuerda la carpeta: después basta con **Actualizar** (y, opcionalmente, se actualiza sola al abrir Nexo en navegadores con File System Access).

**En móvil o tableta: con tu enlace**

1. En [tu caja del portal](https://invokers.com/hub/box/invokers/) activa «compartir» y pulsa «Refresh link».
2. Pega el enlace en «Con tu enlace». El portal no envía cabeceras CORS, así que la lectura directa solo funciona con un proxy (`proxy/cloudflare-worker.js`, configurable en «Avanzado» o fijo en `DEFAULT_PROXY`). Sin él, Nexo ofrece **copiar y pegar** los datos o el **marcador mágico**, que lee la caja en invokers.com y la envía a Nexo con `postMessage` (solo se aceptan mensajes de `invokers.com`).

La caja del enlace incluye además las estadísticas base y los registros de combate, que habilitan el **optimizador exacto**.

Los datos se guardan solo en tu navegador (IndexedDB, hasta cinco importaciones). Nexo no tiene servidor.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+.

```sh
npm ci
npm run dev
npm test             # unitarias + integridad de imágenes
npm run build
node scripts/e2e.mjs # con `npm run dev` activo; NEXO_BOX_JSON=/ruta/caja.json para una caja real
node scripts/share-e2e.mjs # con `npm run preview` activo
BOX_JSON=/ruta/caja.json npm test # verifica la fórmula y el optimizador contra una caja real
```

Ninguna caja real se guarda en el repositorio. Las pruebas usan una caja sintética (`scripts/sample-box.mjs`).

Estructura: `src/box/` (modelo, estadísticas, optimizador, asesor, textos), `src/ui/` (páginas), `src/memorypack.ts` (snapshots `.dat`), `src/folderSync.ts` (carpeta del juego), `proxy/` (Worker opcional).

## Límites

- Nexo no modifica la cuenta: los cambios se hacen en el juego. El portal tiene funciones de aplicar equipamiento para la sesión del propietario; Nexo no las usa.
- El daño efectivo no incluye defensa del enemigo, multiplicadores de habilidades ni elementos: compara builds para un mismo Invoker.
- Las velocidades y otras estadísticas secundarias se valoran con pesos ajustables, no con una simulación de combate.
- Los snapshots `.dat` no incluyen estadísticas base; para el optimizador hace falta la caja oficial.
