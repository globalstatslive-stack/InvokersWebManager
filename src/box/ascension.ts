/** Coach de personajes: a quién subir de estrellas (ascender) primero y con qué.
 *
 * Oficial (guías «Invoker Ascension» y «Levelling Up Invokers» de invokers.com, tablas publicadas como imagen):
 *  - Las estrellas fijan el tope de nivel: 1★ 10, 2★ 20, 3★ 30, 4★ 40, 5★ 50 y 6★ 60 (máximo).
 *  - Para ascender hay que estar en el tope y entregar tantos Invokers o Ecos de esas mismas estrellas como estrellas
 *    tiene (de 5★ a 6★, cinco de 5★). Los Invokers entregados se pierden; sus piezas vuelven al inventario gratis.
 *  - Subir de nivel solo aumenta VIDA, ATQ y DEF. XP acumulada para alcanzar cada tope: tabla oficial.
 * Oficial: tier list general (por los 17 jefes) y la de cada jefe.
 * De tu caja: estrellas, nivel, XP acumulada, combates y equipos de cada Invoker; despertar y piezas.
 * Criterio de Nexo: los pesos del ranking (a la vista) y qué cuenta como «material». No se estima cuánto sube cada
 * estadística: el juego no lo publica. */
import type { Box, Hero } from './model'
import type { Boss } from './goal'
import { ACCESSORY_SLOTS, fmtInt, MODE_LABEL, RELIC_SLOTS, t } from './i18n'

export const ASCENSION = {
  maxStars: 6,
  /** Tope de nivel según las estrellas. */
  cap: (stars: number) => Math.min(6, Math.max(1, stars)) * 10,
  /** XP acumulada para llegar a cada tope de nivel. */
  totalXp: { 10: 8000, 20: 50000, 30: 204000, 40: 646800, 50: 1618300, 60: 3814300 } as Record<number, number>,
  /** Unidades (Invokers o Ecos de las mismas estrellas) que pide ascender desde `stars`. */
  cost: (stars: number) => stars,
  guides: { ascension: 'https://invokers.com/guides/invoker-ascension/', levelling: 'https://invokers.com/guides/levelling-up-invokers/', tierList: 'https://invokers.com/tier-list/' },
}
/** XP del tramo de 10 niveles que termina en `cap`. */
export const rangeXp = (cap: number) => (ASCENSION.totalXp[cap] ?? 0) - (ASCENSION.totalXp[cap - 10] ?? 0)

export type Weights = { use: number; value: number; invest: number; ready: number }
/** Criterio de Nexo: primero quién usas, después lo bueno que es según las tier lists oficiales. */
export const ASCEND_WEIGHTS: Weights = { use: 0.45, value: 0.35, invest: 0.1, ready: 0.1 }

export type OfficialTiers = {
  /** Nota oficial general por código de personaje (0–5) y su tier. */
  general: Map<string, { tier: string; score: number }>
  bosses: Boss[]
}
export type AscendCandidate = {
  hero: Hero; from: number; to: number
  /** Puntuación 0–100 y sus cuatro partes (0–1). */
  score: number; parts: Weights
  teams: { mode: string; label: string; active: boolean }[]
  battles: number
  tier: { tier: string; score: number } | null
  /** Nota oficial contra los jefes en los que tienes récord (las tres mejores). */
  bossTiers: { slug: string; name: string; tier: string; score: number; record: number }[]
  atCap: boolean
  /** XP que falta para llegar al tope actual (null si la caja no publica su XP). */
  xpToCap: number | null
  /** XP del tramo nuevo (del tope actual al siguiente). */
  xpNewRange: number
  /** Unidades de `from`★ que pide la ascensión. */
  cost: number
  /** Otras copias del mismo personaje que podrían servir de material. */
  spareCopies: Hero[]
  awake: number; gearSlots: { filled: number; total: number }
  reasons: string[]; cautions: string[]
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))
/** Equipos registrados (el de mejor tiempo de su fase más alta) en los que aparece cada Invoker. */
export function teamsByHero(box: Box, activeKeys: Set<string> = new Set()): Map<number, AscendCandidate['teams']> {
  const out = new Map<number, AscendCandidate['teams']>()
  for (const tm of box.teams) for (const s of tm.levels[0]?.slots ?? []) {
    const list = out.get(s.heroId) ?? []
    list.push({ mode: tm.mode, label: tm.label, active: activeKeys.has(`${tm.mode}:${tm.key}:${tm.difficulty}`) })
    out.set(s.heroId, list)
  }
  return out
}

/** Ranking de candidatos a subir de `from`★ a `from`+1★. Una entrada por personaje: su mejor copia. */
export function ascendRanking(box: Box, from: number, tiers: OfficialTiers, opts: { activeKeys?: Set<string>; planned?: Set<number>; weights?: Weights } = {}): AscendCandidate[] {
  const w = opts.weights ?? ASCEND_WEIGHTS
  const teams = teamsByHero(box, opts.activeKeys)
  const byCode = new Map<string, Hero[]>()
  for (const h of box.heroes) byCode.set(h.code, [...(byCode.get(h.code) ?? []), h])
  const rank = (h: Hero) => h.rank * 1000 + h.level + (teams.get(h.id)?.length ?? 0) * 10000 + (h.power || 0) / 1e6
  const maxTeams = Math.max(1, ...box.heroes.map(h => teams.get(h.id)?.length ?? 0))
  const maxBattles = Math.max(1, ...box.heroes.map(h => h.battles || 0))
  const scores = [...tiers.general.values()].map(x => x.score)
  const lo = scores.length ? Math.min(...scores) : 0, hi = scores.length ? Math.max(...scores) : 5
  const norm = (s: number) => hi > lo ? clamp((s - lo) / (hi - lo)) : 0
  const records = box.teams.filter(tm => tm.mode === 'dungeon' || tm.mode === 'clanBoss').map(tm => ({ tm, boss: tiers.bosses.find(b => b.slug === tm.key) })).filter(x => x.boss)
  const out: AscendCandidate[] = []
  for (const [code, copies] of byCode) {
    const best = [...copies].sort((a, b) => rank(b) - rank(a))[0]
    // Solo la mejor copia de cada personaje, y solo si es la que está en esas estrellas.
    if (best.rank !== from || from >= ASCENSION.maxStars) continue
    const hero = best
    const inTeams = teams.get(hero.id) ?? []
    const active = inTeams.some(x => x.active) || !!opts.planned?.has(hero.id)
    const use = clamp(0.6 * inTeams.length / maxTeams + 0.4 * Math.log1p(hero.battles || 0) / Math.log1p(maxBattles) + (active ? 0.15 : 0))
    const tier = tiers.general.get(code) ?? null
    const seen = new Set<string>()
    const bossTiers = records.map(({ tm, boss }) => ({ slug: boss!.slug, name: boss!.name, tier: boss!.tier[code]?.tier ?? '', score: boss!.tier[code]?.score ?? 0, record: tm.highestLevel }))
      .filter(x => x.score > 0 && !seen.has(x.slug) && seen.add(x.slug)).sort((a, b) => b.score - a.score).slice(0, 3)
    const bossAvg = bossTiers.length ? bossTiers.reduce((s, x) => s + clamp(x.score / 5), 0) / bossTiers.length : null
    const general = tier ? norm(tier.score) : 0
    const value = bossAvg === null ? general : 0.6 * general + 0.4 * bossAvg
    const total = RELIC_SLOTS.length + ACCESSORY_SLOTS.filter(s => hero.awakeLevel >= (box.accessorySlotAwake[s] ?? 99)).length
    const filled = Object.keys(hero.relics).length + Object.keys(hero.accessories).length
    const invest = clamp(0.5 * (hero.awakeLevel || 0) / 6 + 0.5 * filled / Math.max(1, total))
    const cap = ASCENSION.cap(from), atCap = hero.level >= cap
    const ready = atCap ? 1 : 0.5 * clamp((hero.level - (cap - 10)) / 10)
    const xpToCap = atCap ? 0 : hero.totalXp == null ? null : Math.max(0, ASCENSION.totalXp[cap] - hero.totalXp)
    const score = Math.round(100 * (w.use * use + w.value * value + w.invest * invest + w.ready * ready))
    const reasons: string[] = [], cautions: string[] = []
    const modes = [...new Set(inTeams.map(x => t(MODE_LABEL, x.mode)))]
    if (inTeams.length) reasons.push(`Lo usas en ${inTeams.length} de tus equipos (${modes.join(', ')})${hero.battles ? ` y lleva ${fmtInt(hero.battles)} combates` : ''}.`)
    else if (hero.battles) reasons.push(`Lleva ${fmtInt(hero.battles)} combates, aunque ahora no está en ninguno de tus equipos registrados.`)
    else cautions.push('No está en ninguno de tus equipos ni tiene combates: asegúrate de que vas a usarlo.')
    if (tier) (norm(tier.score) >= 0.75 ? reasons : norm(tier.score) < 0.4 ? cautions : reasons).push(`Tier list oficial: ${tier.tier} (${tier.score.toFixed(2).replace('.', ',')} de 5 en los 17 jefes).`)
    if (bossTiers[0] && bossTiers[0].score >= 4) reasons.push(`De tus jefes, donde mejor nota tiene: ${bossTiers.filter(x => x.score >= 4).map(x => `${x.name} (${x.tier})`).join(', ')}.`)
    if (hero.awakeLevel >= 2 || filled >= total - 1) reasons.push(`Ya has invertido en él: ${hero.awakeLevel ? `despertar ${hero.awakeLevel}★, ` : ''}${filled} de ${total} piezas puestas.`)
    if (atCap) reasons.push(`Está en el tope (nivel ${hero.level} de ${cap}): puede ascender ya.`)
    else cautions.push(`Antes hay que subirlo al nivel ${cap} (está en el ${hero.level})${xpToCap !== null ? `: le faltan ${fmtInt(xpToCap)} de XP` : ''}.`)
    out.push({
      hero, from, to: from + 1, score, parts: { use, value, invest, ready }, teams: inTeams, battles: hero.battles || 0, tier, bossTiers, atCap, xpToCap,
      xpNewRange: rangeXp(cap + 10), cost: ASCENSION.cost(from), spareCopies: copies.filter(c => c !== hero && c.rank === from),
      awake: hero.awakeLevel || 0, gearSlots: { filled, total }, reasons, cautions,
    })
  }
  return out.sort((a, b) => b.score - a.score || b.hero.power - a.hero.power)
}

export type Material = {
  /** Invokers que no usas, por estrellas. */
  byStars: Record<number, Hero[]>
  total: number
}
/** Tiers de la lista oficial que nunca se cuentan como material aunque estén sin usar. */
export const KEEP_TIERS = ['S+', 'S', 'A+']
/** Material: Invokers que no usas y que podrían entregarse en una ascensión. Criterio de Nexo (prudente): sin bloquear,
 * fuera de tus equipos y de tu plan, sin piezas ni despertar, y que sean copias repetidas o Invokers comunes, poco
 * comunes o raros que no estén en S+, S o A+ de la tier list oficial. */
export function ascendMaterial(box: Box, tiers: OfficialTiers, keep: Set<number> = new Set()): Material {
  const teams = teamsByHero(box)
  const best = new Map<string, Hero>()
  for (const h of box.heroes) { const b = best.get(h.code); if (!b || h.rank > b.rank || (h.rank === b.rank && (h.level > b.level || (h.level === b.level && h.power > b.power)))) best.set(h.code, h) }
  const byStars: Record<number, Hero[]> = {}
  let total = 0
  for (const h of box.heroes) {
    if (h.locked || keep.has(h.id) || teams.has(h.id) || h.awakeLevel > 0 || Object.keys(h.relics).length || Object.keys(h.accessories).length) continue
    const duplicate = best.get(h.code) !== h
    const lowRarity = ['Common', 'Uncommon', 'Rare'].includes(h.rarity)
    const top = KEEP_TIERS.includes(tiers.general.get(h.code)?.tier ?? '')
    if (!duplicate && (!lowRarity || top)) continue
    ;(byStars[h.rank] ??= []).push(h)
    total++
  }
  return { byStars, total }
}

export type Crafted = { units: number; xp: number; steps: { stars: number; made: number; xp: number }[] }
/** Cuántas unidades de `target`★ se reúnen fusionando el material hacia arriba (sin Ecos): cada unidad de (s+1)★ pide
 * una base de s★ en su tope de nivel más s unidades de s★ (regla oficial). Como base se usan las que ya tienen más XP.
 * `xp` es la experiencia que habría que dar a las bases, según la tabla oficial. */
export function craftUnits(material: Material, target: number): Crafted {
  let carry: number[] = []
  let xp = 0
  const steps: Crafted['steps'] = []
  for (let s = 1; s < target; s++) {
    // Sin XP publicada (carpeta del juego), se toma la del último tope completo que ya superó su nivel.
    const pool = [...(material.byStars[s] ?? []).map(h => h.totalXp ?? ASCENSION.totalXp[Math.floor(h.level / 10) * 10] ?? 0), ...carry].sort((a, b) => b - a)
    const made: number[] = []
    let stepXp = 0
    while (pool.length >= s + 1) {
      const base = pool.shift()!
      pool.splice(pool.length - s, s)
      stepXp += Math.max(0, ASCENSION.totalXp[ASCENSION.cap(s)] - base)
      made.push(ASCENSION.totalXp[ASCENSION.cap(s)])
    }
    if (made.length) steps.push({ stars: s + 1, made: made.length, xp: stepXp })
    xp += stepXp
    carry = made
  }
  return { units: (material.byStars[target]?.length ?? 0) + carry.length, xp, steps }
}
