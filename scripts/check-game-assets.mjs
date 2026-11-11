import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const manifest = JSON.parse(readFileSync(new URL('../docs/game-assets-manifest.json', import.meta.url)))
for (const asset of manifest.assets) {
  assert.ok(asset.path.startsWith('game/') && !asset.path.includes('..'))
  assert.equal(new URL(asset.source).origin, 'https://www.invokers.com')
  const bytes = readFileSync(new URL(`../public/${asset.path}`, import.meta.url))
  assert.equal(bytes.subarray(0,4).toString(), 'RIFF', asset.path)
  assert.equal(bytes.subarray(8,12).toString(), 'WEBP', asset.path)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.path)
}
console.log(`${manifest.assets.length} imágenes oficiales: origen, formato e integridad verificados.`)
