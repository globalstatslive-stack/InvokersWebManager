/** Descarga las fichas públicas de habilidades (invokers.com/api/explore) a una carpeta de trabajo.
 * Uso: node scripts/fetch-skills.mjs <carpeta>   ·   Después: node scripts/build-skills.mjs <carpeta> */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const out = process.argv[2]
if (!out) throw Error('Indica la carpeta de destino')
mkdirSync(out, { recursive: true })
const characters = JSON.parse(readFileSync(new URL('../src/catalog/characters.json', import.meta.url)))
let ok = 0, failed = []
for (const c of characters) {
  const file = `${out}/${c.kind}-${c.code}.json`
  if (existsSync(file)) { ok++; continue }
  const res = await fetch(`https://invokers.com/api/explore/${c.kind}/${encodeURIComponent(c.slug)}`, { headers: { accept: 'application/json' } })
  if (!res.ok) { failed.push(`${c.code} ${c.slug} ${res.status}`); continue }
  writeFileSync(file, await res.text()); ok++
  await new Promise(r => setTimeout(r, 120))
}
console.log(`${ok} fichas descargadas; ${failed.length} fallidas`, failed.slice(0, 10))
