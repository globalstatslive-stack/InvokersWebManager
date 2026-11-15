import { describe, expect, it } from 'vitest'
import { cupColor, parseCount, pickCounters, textBand, textBlocks, type BlockRead, type Cup } from './trophyOcr'

/** Barra sintética: fondo oscuro, «cifras» blancas (rectángulos), adornos encima y debajo y una copa de color. */
function bar() {
  const width = 600, height = 80, data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = 18; data[i + 1] = 22; data[i + 2] = 34; data[i + 3] = 255 }
  const fill = (x0: number, x1: number, y0: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2] }
  }
  const white: [number, number, number] = [240, 240, 236]
  // Tres contadores de 2–3 «cifras» (8 px de ancho, 3 px de separación) entre las filas 30 y 52.
  for (const [start, n] of [[200, 3], [330, 2], [450, 1]] as const) {
    for (let k = 0; k < n; k++) fill(start + k * 11, start + k * 11 + 8, 30, 52, white)
    fill(start - 4, start + n * 11 + 4, 22, 24, white) // adorno encima, separado por filas vacías
    fill(start - 30, start - 12, 28, 52, [200, 120, 70]) // copa de color: no es texto
  }
  return { width, height, data }
}

describe('lectura de la captura de la Sala de trofeos', () => {
  it('interpreta los contadores tal como los muestra el juego', () => {
    expect(parseCount('58')).toEqual({ value: 58, approx: false })
    expect(parseCount('18,4K')).toEqual({ value: 18400, approx: true })
    expect(parseCount('12,75K')).toEqual({ value: 12750, approx: true })
    expect(parseCount('1.204')).toEqual({ value: 1204, approx: false })
    expect(parseCount('0')).toEqual({ value: 0, approx: false })
    for (const bad of ['', '7,', '12,34', 'K', '1.2.3']) expect(parseCount(bad)).toBeNull()
  })
  it('encuentra la franja de texto y separa cada contador sin los adornos ni las copas', () => {
    const p = bar()
    const band = textBand(p)!
    expect(band.y0).toBeLessThanOrEqual(30)
    const blocks = textBlocks(p, band)
    expect(blocks).toHaveLength(3)
    expect(blocks.map(b => [b.x0, b.x1, b.y0, b.y1])).toEqual([[200, 230, 30, 52], [330, 349, 30, 52], [450, 458, 30, 52]])
    // La «copa» de color cobre de la izquierda se reconoce como bronce.
    expect(cupColor(p, blocks[0])).toBe('bronze')
  })
  it('identifica bronce, plata y oro por el color de su copa; las monedas son el número anterior', () => {
    const r = (x0: number, y0: number, y1: number, text: string, cup: Cup | null, confidence = 95): BlockRead => ({ region: { x0, x1: x0 + 30, y0, y1 }, text, confidence, cup })
    const coins = r(100, 30, 52, '18,4K', 'silver'), b = r(200, 30, 52, '58', 'bronze'), s = r(300, 31, 52, '143', 'silver'), g = r(400, 30, 52, '0', 'gold', 86)
    const home = r(500, 25, 50, '2', 'gold', 24), title = r(10, 20, 60, '70', null, 0)
    expect(pickCounters([title, coins, b, s, g, home])).toMatchObject({ coins: { value: 18400, approx: true }, bronze: { value: 58 }, silver: { value: 143 }, gold: { value: 0 } })
    // Si el oro no se lee, no se rellena nada: nunca se desplazan los números (el bronce no se queda con las monedas).
    expect(pickCounters([title, coins, b, s, { ...g, text: '', confidence: 0 }, home])).toBeNull()
    // Sin copas reconocibles (otra pantalla), tampoco.
    expect(pickCounters([coins, { ...b, cup: null }, s, g])).toBeNull()
  })
  it('sin información de color, solo acepta los tres últimos de la línea si todos se leen bien', () => {
    const r = (x0: number, text: string, confidence = 95): BlockRead => ({ region: { x0, x1: x0 + 30, y0: 30, y1: 52 }, text, confidence })
    expect(pickCounters([r(100, '12,5K'), r(200, '58'), r(300, '143'), r(400, '0')])).toMatchObject({ coins: { value: 12500 }, bronze: { value: 58 }, gold: { value: 0 } })
    expect(pickCounters([r(100, '12,5K'), r(200, '58'), r(300, '143'), r(400, '', 0)])).toBeNull()
  })
})
