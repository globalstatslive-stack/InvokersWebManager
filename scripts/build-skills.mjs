/** Compacta las fichas descargadas por fetch-skills.mjs en src/catalog/skills.json.
 * Formato por Invoker (clave = código): [combo, hab1, hab2, hab3, definitiva], cada una
 *   { n: nombre, a: área, e: efectos, acc: necesita precisión, m: [maná def. nivel 1, nivel máx], l: niveles }
 * y cada nivel: [enfriamiento s, coste de maná, fórmulas], con fórmulas [tipo, [[%, estadística]…]]
 *   tipo: D daño · T daño por tic · H curación · S escudo   ·   estadística: A ataque · D defensa · M vida máx. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const dir = process.argv[2]
if (!dir) throw Error('Indica la carpeta con las fichas')
const characters = JSON.parse(readFileSync(new URL('../src/catalog/characters.json', import.meta.url)))
const ORDER = ['Combo', 'Active Skill1', 'Active Skill2', 'Active Skill3', 'Ultimate']
const KIND = { Damage: 'D', Heal: 'H', Shield: 'S' }
const STAT = { ATK: 'A', DEF: 'D', 'MAX HP': 'M', HP: 'M' }
const num = s => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0
const text = h => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
const unknown = new Map()
function formulas(description) {
  const out = []
  for (const m of text(description).matchAll(/(?:^|\n|#\d+\s*)(Damage|Heal|Shield):\s*([^\n#]+)/g)) {
    let kind = KIND[m[1].trim()]
    if (!kind) continue
    const terms = []
    let tick = false, ok = true
    for (const part of m[2].split('+')) {
      const t = /^\s*([\d.,]+)%\s*\*?\s*([A-Za-z ]+?)\s*$/.exec(part)
      if (!t) { ok = false; break }
      let name = t[2].trim()
      if (/ per tick$/.test(name)) { tick = true; name = name.replace(/ per tick$/, '') }
      const stat = STAT[name]
      if (!stat) { ok = false; unknown.set(name, (unknown.get(name) ?? 0) + 1); break }
      terms.push([num(t[1]), stat])
    }
    if (ok && terms.length) out.push([tick && kind === 'D' ? 'T' : kind, terms])
  }
  return out
}
const result = {}
let skills = 0
for (const c of characters.filter(c => c.kind === 'invokers')) {
  const file = `${dir}/invokers-${c.code}.json`
  if (!existsSync(file)) continue
  const item = JSON.parse(readFileSync(file)).item
  result[c.code] = ORDER.map(type => {
    const s = item.skills.find(x => x.type === type)
    if (!s) return null
    skills++
    return {
      n: s.name, a: s.isAoe ? 1 : 0, e: s.effects.map(e => e.key.replace('effect:', '')),
      acc: /Accuracy required for/.test(s.levels.at(-1).descriptionHtml) ? 1 : 0,
      m: [num(s.manaGenUlt), num(s.manaGenUltMax ?? s.manaGenUlt)],
      l: s.levels.map(l => [num(l.cooldown), num(l.cost), formulas(l.descriptionHtml)]),
    }
  })
}
writeFileSync(new URL('../src/catalog/skills.json', import.meta.url), JSON.stringify(result))
console.log(`${Object.keys(result).length} Invokers, ${skills} habilidades. Términos no reconocidos:`, [...unknown])
