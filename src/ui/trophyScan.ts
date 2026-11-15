/** Lee los trofeos de una captura de la Sala de trofeos, en este navegador: la imagen no se sube a ningún sitio.
 * El lector (Tesseract, ~7 MB) se sirve desde la propia web y solo se descarga la primera vez que se usa. */
import { cupColor, isText, parseCount, pickCounters, textBand, textBlocks, type BlockRead, type Counters, type Region } from '../box/trophyOcr'

export type Scan = Counters & { strip: string }
const TOP = 0.14

async function bitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) { try { return await createImageBitmap(file) } catch { /* formato no admitido: se prueba con <img> */ } }
  const url = URL.createObjectURL(file)
  try { const img = new Image(); img.src = url; await img.decode(); return img } finally { URL.revokeObjectURL(url) }
}

/** Recorte de un bloque, ampliado, en negro sobre blanco y con margen (así lo lee mejor el OCR). */
function blockImage(src: HTMLCanvasElement, r: Region): HTMLCanvasElement {
  const hh = r.y1 - r.y0, s = Math.max(1, Math.min(4, 40 / hh)), px = Math.round(hh * 1.5), py = Math.round(hh * 0.6)
  const w0 = Math.max(1, Math.round((r.x1 - r.x0) * s)), h0 = Math.max(1, Math.round(hh * s))
  const t = document.createElement('canvas'); t.width = w0; t.height = h0
  const tq = t.getContext('2d', { willReadFrequently: true })!
  tq.imageSmoothingQuality = 'high'; tq.drawImage(src, r.x0, r.y0, r.x1 - r.x0, hh, 0, 0, w0, h0)
  const d = tq.getImageData(0, 0, w0, h0)
  for (let i = 0; i < d.data.length; i += 4) { const v = isText(d.data, i) ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
  tq.putImageData(d, 0, 0)
  const k = document.createElement('canvas'); k.width = w0 + 2 * px; k.height = h0 + 2 * py
  const q = k.getContext('2d')!; q.fillStyle = '#fff'; q.fillRect(0, 0, k.width, k.height); q.drawImage(t, px, py)
  return k
}

export async function scanTrophies(file: File, onStep: (text: string) => void = () => {}): Promise<Scan> {
  if (!file.type.startsWith('image/')) throw Error('Elige una imagen (la captura de la Sala de trofeos).')
  if (file.size > 25 * 1024 * 1024) throw Error('La imagen es demasiado grande (máximo 25 MB).')
  onStep('Buscando los contadores…')
  const img = await bitmap(file)
  if (img.width < 400 || img.height < 200) throw Error('La captura es demasiado pequeña. Usa una captura de pantalla completa del juego.')
  if (img.height > img.width) throw Error('La captura está en vertical. Haz la captura con el juego en horizontal, como se juega.')
  const top = document.createElement('canvas'); top.width = img.width; top.height = Math.round(img.height * TOP)
  const g = top.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, img.width, top.height, 0, 0, img.width, top.height)
  const pixels = g.getImageData(0, 0, top.width, top.height)
  const band = textBand(pixels, 1)
  const blocks = band ? textBlocks(pixels, band).slice(-24) : []
  if (blocks.length < 3) throw Error('No encuentro la barra de trofeos. Usa una captura de la Sala de trofeos sin recortar.')
  onStep('Preparando el lector (la primera vez se descarga, unos 7 MB)…')
  const { createWorker, PSM } = await import('tesseract.js')
  const dir = new URL('ocr/', document.baseURI).href
  const worker = await createWorker('eng', 1, { workerPath: `${dir}worker.min.js`, corePath: dir, langPath: dir.replace(/\/$/, ''), gzip: true })
  try {
    await worker.setParameters({ tessedit_char_whitelist: '0123456789,.K', tessedit_pageseg_mode: PSM.SINGLE_LINE })
    onStep('Leyendo los números…')
    const reads: BlockRead[] = []
    for (const region of blocks) {
      const img = blockImage(top, region)
      let { data } = await worker.recognize(img)
      let read = { text: data.text.trim(), confidence: data.confidence }
      // Una cifra suelta («0») a veces no sale como línea: se repite como palabra y se queda la mejor lectura.
      if (!parseCount(read.text) || read.confidence < 60) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD })
        ;({ data } = await worker.recognize(img))
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE })
        const again = { text: data.text.trim(), confidence: data.confidence }
        if (parseCount(again.text) && (!parseCount(read.text) || again.confidence > read.confidence)) read = again
      }
      reads.push({ region, ...read, cup: cupColor(pixels, region) })
    }
    const counters = pickCounters(reads)
    if (!counters) throw Error('No he podido leer con seguridad qué número es cada trofeo. Prueba con otra captura de la Sala de trofeos (sin recortar ni tapar la barra de arriba) o escríbelos a mano.')
    // Recorte de la barra para que el jugador compare lo leído con su captura.
    const x0 = Math.max(0, Math.min(...counters.regions.map(r => r.x0)) - 120), x1 = Math.min(img.width, Math.max(...counters.regions.map(r => r.x1)) + 30)
    const y0 = Math.max(0, band!.y0 - 6), y1 = Math.min(top.height, band!.y1 + 6)
    const strip = document.createElement('canvas'); strip.width = Math.min(900, x1 - x0); strip.height = Math.round((y1 - y0) * strip.width / (x1 - x0))
    strip.getContext('2d')!.drawImage(top, x0, y0, x1 - x0, y1 - y0, 0, 0, strip.width, strip.height)
    return { ...counters, strip: strip.toDataURL('image/jpeg', 0.85) }
  } finally { await worker.terminate() }
}
