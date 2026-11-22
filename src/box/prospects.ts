/** Promesas: Invokers de tier alto que todavía no usas (p. ej., un legendario recién conseguido).
 *
 * Sin esto, todo Nexo los trataba como «Invokers que no usas» (fuera de tus equipos o por debajo del nivel 30): nunca
 * se proponía desarrollarlos y sus piezas se ofrecían a otros. Ahora se detectan, se protegen y se les calcula equipo.
 *
 * Oficial: tier list general de invokers.com (por los 17 jefes) y la de cada jefe; topes de nivel y XP acumulada (guía
 * «Levelling Up Invokers»: subir de nivel solo aumenta VIDA, ATQ y DEF); ficha oficial con el máximo (6★, nivel 60,
 * despertar completo).
 * De tu caja: estrellas, nivel, XP, despertar, piezas, combates y récords; tus Invokers que ya están en su tope.
 * Criterio de Nexo: qué cuenta como promesa (épico o legendario en S+, S o A+ de la tier list oficial que no está en
 * tus equipos) y la estimación de su base en el tope de nivel: el máximo oficial por la proporción base/máximo de tus
 * Invokers de las mismas estrellas que ya están en su tope, con el despertar más parecido. El juego no publica cuánto
 * sube cada nivel, así que es una estimación y se presenta como tal. */
import type { Box, Hero } from './model'
import { ASCENSION, KEEP_TIERS, type OfficialTiers } from './ascension'
import { bossSlugOf } from './goal'
import { gearContribution, type Stats } from './stats'

export const PROSPECT_RARITIES = new Set(['Legendary', 'Epic'])
/** Estadísticas que suben al subir de nivel (guía oficial). */
export const LEVEL_STATS = ['health', 'attack', 'defense'] as const
type LevelStat = typeof LEVEL_STATS[number]

export type BossFit = { slug: string; name: string; tier: string; score: number; record: number
  /** Tu equipo del récord en esa fase, con su nota oficial en ese jefe (de menor a mayor). */
  team: { id: number; name: string; tier: string; score: number }[] }
export type Prospect = {
  hero: Hero
  tier: { tier: string; score: number }
  /** No estaba en la importación anterior. */
  isNew: boolean
  /** Lo que ya has invertido en él. */
  invested: string[]
  /** Jefes de tus récords donde mejor nota oficial tiene (nota ≥ 4 de 5), con tu equipo de ese récord. */
  bossFits: BossFit[]
  cap: number
  /** XP que le falta para su tope (null si la caja no publica su XP). */
  xpToCap: number | null
}

const piecesOn = (h: Hero) => Object.values(h.relics).filter(v => v !== null).length + Object.values(h.accessories).filter(v => v !== null).length
const capOf = (h: Hero) => h.maxLevel || ASCENSION.cap(h.rank)

/** Promesas de la caja: épicos y legendarios en S+, S o A+ de la tier list oficial que no usas (ninguna copia en
 * `used`). Primero los nuevos desde la importación anterior y en los que ya has invertido; después por nota. */
export function findProspects(box: Box, tiers: OfficialTiers, used: Set<number>, previous?: Box | null, max = 3): Prospect[] {
  const usedCodes = new Set(box.heroes.filter(h => used.has(h.id)).map(h => h.code))
  const before = previous ? new Set(previous.heroes.map(h => h.code)) : null
  const byCode = new Map<string, Hero[]>()
  for (const h of box.heroes) byCode.set(h.code, [...(byCode.get(h.code) ?? []), h])
  const heroes = new Map(box.heroes.map(h => [h.id, h]))
  const records = box.teams.filter(tm => tm.mode === 'dungeon' || tm.mode === 'clanBoss')
    .map(tm => ({ tm, boss: tiers.bosses.find(b => b.slug === bossSlugOf(tm)) })).filter(x => x.boss)
  const out: Prospect[] = []
  for (const [code, copies] of byCode) {
    if (usedCodes.has(code)) continue
    const tier = tiers.general.get(code)
    if (!tier || !KEEP_TIERS.includes(tier.tier)) continue
    const hero = [...copies].sort((a, b) => b.rank - a.rank || b.level - a.level || b.awakeLevel - a.awakeLevel || piecesOn(b) - piecesOn(a))[0]
    if (!PROSPECT_RARITIES.has(hero.rarity)) continue
    const invested: string[] = []
    if (hero.awakeLevel > 0) invested.push(`despertar ${hero.awakeLevel}`)
    const n = piecesOn(hero)
    if (n > 0) invested.push(`${n} ${n === 1 ? 'pieza puesta' : 'piezas puestas'}`)
    if (hero.level >= 20) invested.push(`nivel ${hero.level}`)
    const seen = new Set<string>()
    const bossFits = records.map(({ tm, boss }): BossFit => {
      const top = [...tm.levels].filter(l => l.slots.length).sort((a, b) => b.level - a.level)[0]
      const team = (top?.slots ?? []).map(s => heroes.get(s.heroId)).filter((h): h is Hero => !!h)
        .map(h => ({ id: h.id, name: h.name, tier: boss!.tier[h.code]?.tier ?? '—', score: boss!.tier[h.code]?.score ?? 0 })).sort((a, b) => a.score - b.score)
      return { slug: boss!.slug, name: boss!.name, tier: boss!.tier[code]?.tier ?? '', score: boss!.tier[code]?.score ?? 0, record: tm.highestLevel, team }
    }).filter(x => x.score >= 4 && !seen.has(x.slug) && seen.add(x.slug)).sort((a, b) => b.score - a.score).slice(0, 3)
    const cap = capOf(hero)
    const xpToCap = hero.level >= cap ? 0 : hero.totalXp == null ? null : Math.max(0, (ASCENSION.totalXp[cap] ?? 0) - hero.totalXp)
    out.push({ hero, tier, isNew: before ? !before.has(code) : false, invested, bossFits, cap, xpToCap })
  }
  return out.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.invested.length - a.invested.length || b.tier.score - a.tier.score).slice(0, max)
}

export type CapProjection = {
  /** Base estimada en el tope (VIDA, ATQ y DEF; el resto no cambia con el nivel). */
  basis: Record<string, number>
  cap: number
  /** Proporción base/máximo oficial usada para cada estadística. */
  ratio: Record<LevelStat, number>
  /** Invokers de referencia (mismas estrellas, ya en su tope, despertar más parecido). */
  refs: string[]
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }

/** Base estimada de `hero` en su tope de nivel, o null si ya está en él o no hay datos (necesita la ficha oficial del
 * Invoker y al menos 2 de referencia). `maxStats`: máximos oficiales de VIDA, ATQ y DEF por código de personaje. */
export function projectToCap(hero: Hero, box: Box, maxStats: Map<string, Partial<Record<LevelStat, number>>>): CapProjection | null {
  const cap = capOf(hero), own = maxStats.get(hero.code)
  if (!hero.basis || !own || hero.level >= cap) return null
  const refs = box.heroes.filter(h => h.id !== hero.id && h.rank === hero.rank && h.level >= capOf(h) && h.basis && maxStats.has(h.code))
    .sort((a, b) => Math.abs(a.awakeLevel - hero.awakeLevel) - Math.abs(b.awakeLevel - hero.awakeLevel) || (b.battles || 0) - (a.battles || 0))
  const seen = new Set<string>(), picked = refs.filter(h => !seen.has(h.code) && !!seen.add(h.code)).slice(0, 5)
  if (picked.length < 2) return null
  const basis = { ...hero.basis }, ratio = {} as Record<LevelStat, number>
  for (const k of LEVEL_STATS) {
    const rs = picked.map(h => (h.basis![k] ?? 0) / (maxStats.get(h.code)![k] ?? 0)).filter(r => Number.isFinite(r) && r > 0)
    if (!rs.length || !own[k]) return null
    ratio[k] = median(rs)
    basis[k] = Math.max(hero.basis[k] ?? 0, own[k]! * ratio[k])
  }
  return { basis, cap, ratio, refs: picked.map(h => h.name) }
}

/** Copia del Invoker con otra base: recalcula su total y lo que aportan sus piezas (los % de la base cambian) con la
 * misma composición que el portal (base × (1 + % de la sala de trofeos de su elemento) + piezas). */
export function withBasis(hero: Hero, basis: Record<string, number>, box: Box, pieces: Parameters<typeof gearContribution>[1]): Hero {
  const rules = new Map(box.setRules.map(r => [r.set, r]))
  const next = { ...hero, basis }
  const oldGear = hero.gearBonus ?? gearContribution(hero, pieces, rules), newGear = gearContribution(next, pieces, rules)
  const hall = (k: string) => box.arenaHall.filter(a => a.element === hero.element && a.stat === k && a.mode === 'percent' && Number.isFinite(a.value)).reduce((s, a) => s + a.value, 0)
  const stats: Stats = { ...hero.stats }
  for (const k of LEVEL_STATS) stats[k] = (stats[k] ?? 0) + ((basis[k] ?? 0) - (hero.basis?.[k] ?? 0)) * (1 + hall(k))
  for (const k of new Set([...Object.keys(oldGear), ...Object.keys(newGear)])) stats[k] = (stats[k] ?? 0) - (oldGear[k] ?? 0) + (newGear[k] ?? 0)
  return { ...next, stats, gearBonus: newGear }
}
