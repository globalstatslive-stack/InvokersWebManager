import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** Lector de capturas (OCR) servido desde la propia web, sin CDN: se descarga solo al leer una captura. */
const require = createRequire(import.meta.url)
const pkg = (name: string) => dirname(require.resolve(`${name}/package.json`))
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': join(pkg('tesseract.js'), 'dist/worker.min.js'),
  'ocr/tesseract-core-simd-lstm.wasm.js': join(pkg('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'),
  'ocr/tesseract-core-lstm.wasm.js': join(pkg('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'),
  'ocr/eng.traineddata.gz': join(pkg('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'),
}
function ocrAssets(): Plugin {
  return {
    name: 'nexo-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = Object.entries(OCR_FILES).find(([k]) => req.url?.split('?')[0].endsWith(`/${k}`))?.[1]
        if (!file) return next()
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        res.end(readFileSync(file))
      })
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(OCR_FILES)) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
    },
  }
}

export default defineConfig({ base: './', plugins: [react(), tailwindcss(), ocrAssets()], test: { environment: 'node' } })
