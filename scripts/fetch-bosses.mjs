/** Genera src/catalog/bosses.json desde las guías oficiales de jefes (invokers.com/guides/<jefe>-boss-guide/).
 * Por jefe: nombre, categoría, corrupciones, lista oficial de niveles (código → nota) y las fases publicadas
 * con VIDA, ATQ, DEF, PREC, RES, penalización de tolerancia y los objetivos de estadística de la guía.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/fetch-bosses.mjs */
import { writeFileSync } from 'node:fs'
const BASE = 'https://invokers.com'
const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
/** Deshace la serialización de props de Astro: [0, valor] y [1, lista]. */
function decode(v) {
  if (Array.isArray(v) && v.length === 2 && (v[0] === 0 || v[0] === 1)) return v[0] === 1 ? v[1].map(decode) : decode(v[1])
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]))
  return v
}
async function hub(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw Error(`${path}: ${res.status}`)
  const html = await res.text()
  const m = /component-url="[^"]*BossGuideHub[^"]*"[^>]*props="([^"]*)"/.exec(html)
  if (!m) throw Error(`${path}: sin datos de la guía`)
  return decode(JSON.parse(unescape(m[1]))).data
}
const code = url => /\/([^/]+)\/portrait\.webp$/.exec(url ?? '')?.[1] ?? null
const first = await hub('/guides/ulgorim-boss-guide/')
const out = { source: 'https://invokers.com/guides/bosses/', fetchedAt: new Date().toISOString().slice(0, 10), bosses: [] }
for (const r of first.roster) {
  const path = r.href ?? `/guides/${r.slug}-boss-guide/`
  const d = r.slug === first.slug ? first : await hub(path)
  const tier = {}
  for (const row of d.officialTierList?.rows ?? []) for (const c of row.cards ?? []) {
    const k = code(c.portraitUrl), score = typeof c.average === 'number' ? c.average : NaN
    if (k) tier[k] = { tier: row.label, score: Number.isFinite(score) ? score : null }
  }
  out.bosses.push({
    slug: d.slug, name: d.name, epithet: r.epithet, category: r.badge, guide: BASE + path, portrait: r.portraitUrl,
    corruptions: (d.corruptions ?? []).map(c => ({ key: c.key, kind: c.kind })),
    tierListUrl: d.officialTierList?.href ? BASE + d.officialTierList.href : null, tier,
    stages: (d.stages ?? []).map(s => ({ stage: s.stage, label: s.label, element: s.element, hp: s.hp, atk: s.atk, def: s.def, acc: s.accuracy, res: s.resistance, tolerance: s.tolerance, accGoal: s.accuracyGoal, resGoal: s.resistanceGoal, tolGoal: s.toleranceGoal })),
  })
  await new Promise(r => setTimeout(r, 150))
}
writeFileSync(new URL('../src/catalog/bosses.json', import.meta.url), JSON.stringify(out))
console.log(out.bosses.map(b => `${b.slug}:${b.stages.length}f/${Object.keys(b.tier).length}t`).join(' '))
