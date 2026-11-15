/** Lectura de los contadores de una captura de la Sala de trofeos, en el navegador (la imagen no sale del equipo).
 *
 * La barra superior del juego muestra, de izquierda a derecha: monedas de arena, bronces, platas y oros, en texto
 * blanco. Nexo busca la franja de texto blanco de la parte de arriba, la corta en bloques separados por huecos y lee
 * cada bloque por separado; se queda con los 4 bloques numéricos más a la derecha. Si no salen 4 números claros, no
 * rellena nada: el jugador siempre ve lo leído y puede corregirlo. */
export type Pixels = { width: number; height: number; data: ArrayLike<number> }
export type Region = { x0: number; x1: number; y0: number; y1: number }

/** Píxel de texto: claro y casi sin color (los iconos de las copas son de color; el texto, blanco). */
export const isText = (d: ArrayLike<number>, i: number) => {
  const r = d[i], g = d[i + 1], b = d[i + 2], lo = Math.min(r, g, b)
  return lo > 175 && Math.max(r, g, b) - lo < 60
}

/** Franja horizontal con más texto blanco en la parte de arriba de la captura. */
export function textBand(p: Pixels, top = 1): { y0: number; y1: number } | null {
  const { width: w, height: h, data: d } = p
  const yb = Math.max(1, Math.round(h * top))
  const rows: number[] = []
  for (let y = 0; y < yb; y++) { let n = 0; for (let x = 0; x < w; x++) if (isText(d, (y * w + x) * 4)) n++; rows.push(n) }
  const peak = Math.max(...rows)
  if (peak < 4) return null
  // Tiras de filas con texto (se toleran filas sueltas vacías); gana la de más píxeles de texto, no la fila más
  // llena: una línea fina de adorno puede tener más píxeles en una fila que las cifras.
  const min = peak * 0.12
  let best: { y0: number; y1: number; area: number } | null = null
  for (let y = 0; y < yb;) {
    if (rows[y] <= min) { y++; continue }
    let y1 = y, area = 0
    while (y1 < yb && (rows[y1] > min || (y1 + 1 < yb && rows[y1 + 1] > min))) area += rows[y1++]
    if (y1 - y >= 6 && (!best || area > best.area)) best = { y0: y, y1, area }
    y = y1 + 1
  }
  return best && { y0: best.y0, y1: best.y1 }
}

/** Bloques de texto dentro de la franja, separados por huecos de más de medio alto de letra. */
export function textBlocks(p: Pixels, band: { y0: number; y1: number }): Region[] {
  const { width: w, data: d } = p
  const hgt = band.y1 - band.y0, gap = Math.max(3, Math.round(hgt * 0.3))
  const cols: number[] = []
  for (let x = 0; x < w; x++) { let n = 0; for (let y = band.y0; y < band.y1; y++) if (isText(d, (y * w + x) * 4)) n++; cols.push(n) }
  const out: Region[] = []
  let start = -1, last = -1
  for (let x = 0; x <= w; x++) {
    const on = x < w && cols[x] > 0
    if (on) { if (start < 0) start = x; last = x }
    else if (start >= 0 && x - last > gap) { out.push({ x0: start, x1: last + 1, y0: band.y0, y1: band.y1 }); start = -1 }
  }
  // Alto real de cada bloque: la tira de filas con texto más alta (deja fuera los adornos de la barra, encima y debajo
  // de la cifra) y descarta los brillos sueltos de los iconos.
  const blocks: Region[] = []
  for (const r of out) {
    const rows: number[] = []
    for (let y = r.y0; y < r.y1; y++) { let n = 0; for (let x = r.x0; x < r.x1; x++) if (isText(d, (y * w + x) * 4)) n++; rows.push(n) }
    let best = { a: 0, b: 0, n: 0 }, a = -1, n = 0, gapRun = 0
    for (let i = 0; i <= rows.length; i++) {
      if (i < rows.length && rows[i] > 0) { if (a < 0) { a = i; n = 0 } n += rows[i]; gapRun = 0; continue }
      if (a >= 0 && i < rows.length && ++gapRun <= 1) continue
      if (a >= 0) { const b = i - gapRun; if (b - a > best.b - best.a) best = { a, b, n }; a = -1; gapRun = 0 }
    }
    if (best.b - best.a < hgt * 0.35 || best.n < 12) continue
    // Columnas con texto dentro de esa tira (los adornos son más anchos que la cifra).
    let x0 = r.x1, x1 = r.x0
    for (let y = r.y0 + best.a; y < r.y0 + best.b; y++) for (let x = r.x0; x < r.x1; x++) if (isText(d, (y * w + x) * 4)) { if (x < x0) x0 = x; if (x >= x1) x1 = x + 1 }
    blocks.push({ x0, x1, y0: r.y0 + best.a, y1: r.y0 + best.b })
  }
  return blocks
}

/** Interpreta lo leído en un contador: «58», «143», «18,4K», «1.204», «12,75K». Null si no es un número limpio. */
export function parseCount(text: string): { value: number; approx: boolean } | null {
  const s = text.replace(/\s+/g, '').replace(/k$/, 'K')
  const m = /^(\d{1,3})(?:[.,](\d{1,3}))?(K)?$/.exec(s) ?? /^(\d{1,7})()()$/.exec(s)
  if (!m) return null
  if (m[3]) return { value: Math.round(Number(`${m[1]}.${m[2] || 0}`) * 1000), approx: true }
  // «1.204» o «1,204» sin K: separador de miles.
  if (m[2]) return m[2].length === 3 ? { value: Number(m[1] + m[2]), approx: false } : null
  return { value: Number(m[1]), approx: false }
}

export type Cup = 'bronze' | 'silver' | 'gold'
/** Color de la copa que hay a la izquierda de un contador (las cifras son blancas; las copas, de color). */
export function cupColor(p: Pixels, r: Region): Cup | null {
  const { width: w, height: h, data: d } = p
  const H = r.y1 - r.y0
  const x0 = Math.max(0, Math.round(r.x0 - 3 * H)), x1 = Math.max(0, Math.round(r.x0 - 0.15 * H))
  const y0 = Math.max(0, Math.round(r.y0 - 0.9 * H)), y1 = Math.min(h, Math.round(r.y1 + 0.3 * H))
  const n = { bronze: 0, silver: 0, gold: 0 }
  let area = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    area++
    const i = (y * w + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2]
    const max = Math.max(R, G, B), min = Math.min(R, G, B), v = max / 255, sat = max ? (max - min) / max : 0
    if (v < 0.35) continue
    let hue = 0
    if (max !== min) hue = max === R ? 60 * (((G - B) / (max - min)) % 6) : max === G ? 60 * ((B - R) / (max - min) + 2) : 60 * ((R - G) / (max - min) + 4)
    if (hue < 0) hue += 360
    if (sat > 0.35 && (hue <= 33 || hue >= 345)) n.bronze++
    else if (sat > 0.4 && hue >= 34 && hue <= 65) n.gold++
    else if (sat < 0.18 && v > 0.45 && !isText(d, i)) n.silver++ // gris, no el blanco del texto
  }
  if (!area) return null
  // Los grises aparecen en marcos y adornos de toda la barra: el cobre y el dorado mandan si aparecen.
  if (Math.max(n.bronze, n.gold) >= Math.max(6, area * 0.008)) return n.bronze > n.gold ? 'bronze' : 'gold'
  return n.silver >= area * 0.012 ? 'silver' : null
}

export type BlockRead = { region: Region; text: string; confidence: number; cup?: Cup | null }
export type CounterRead = { value: number; approx: boolean }
export type Counters = { coins: CounterRead | null; bronze: CounterRead; silver: CounterRead; gold: CounterRead; regions: Region[] }

/** Elige los contadores entre los bloques leídos. Primero, los bloques de la misma línea que las lecturas claras
 * (misma línea de base y alto de cifra). Después, tres seguidos con copa de bronce, plata y oro a su izquierda; el
 * anterior son las monedas. Si no aparecen o alguno no se lee bien, no se rellena nada: así un número sin leer
 * nunca desplaza a los demás (el bronce no puede quedarse con las monedas). */
export function pickCounters(reads: BlockRead[], minConfidence = 60): Counters | null {
  const all = reads.map(r => ({ ...r, parsed: parseCount(r.text) })).sort((a, b) => a.region.x0 - b.region.x0)
  const good = all.filter(r => r.parsed && r.confidence >= minConfidence)
  if (!good.length) return null
  const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const H = mid(good.map(r => r.region.y1 - r.region.y0)), base = mid(good.map(r => r.region.y1))
  const row = all.filter(r => Math.abs(r.region.y1 - base) <= H * 0.3 && r.region.y1 - r.region.y0 >= H * 0.6 && r.region.y1 - r.region.y0 <= H * 1.6)
  const ok = (r: typeof row[number] | undefined) => !!r && !!r.parsed && r.confidence >= 40
  let at = -1
  if (row.some(r => r.cup !== undefined)) {
    for (let i = 0; i + 2 < row.length; i++) if (row[i].cup === 'bronze' && row[i + 1].cup === 'silver' && row[i + 2].cup === 'gold') { at = i; break }
  } else {
    // Sin colores (pruebas): los tres últimos de la línea, siempre que todos se lean bien.
    at = row.length - 3
  }
  if (at < 0 || ![row[at], row[at + 1], row[at + 2]].every(ok)) return null
  const [bronze, silver, gold] = [row[at], row[at + 1], row[at + 2]]
  const coins = ok(row[at - 1]) ? row[at - 1] : null
  return {
    coins: coins?.parsed ?? null, bronze: bronze.parsed!, silver: silver.parsed!, gold: gold.parsed!,
    regions: [...(coins ? [coins.region] : []), bronze.region, silver.region, gold.region],
  }
}
