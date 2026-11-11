/** Optimizador exacto de equipo para un Invoker.
 *
 * Con pesos lineales, el valor de una build es la suma del valor de cada pieza más el de
 * los conjuntos activos. Ocho ranuras admiten como mucho dos conjuntos de 3+ piezas, así que
 * para cada par de conjuntos (A, B) una programación dinámica sobre las ranuras con estado
 * (piezas de A, piezas de B) encuentra el óptimo exacto. Los mínimos se resuelven aumentando
 * el peso de la estadística que falta y repitiendo. */
import type { Bonus, Gear, Hero } from './model'
import { ACCESSORY_SLOTS, PERCENT_OF_BASE, RELIC_SLOTS } from './i18n'
import { BoxIndex, projectStats, setCounts, TIERS, type Stats } from './stats'
import { indexOf, simulate, type Kit, type Mix, type SimResult, type SimSettings } from './combat'

export type Pool = 'free' | 'unlocked' | 'all'
export type OptimizeOptions = {
  weights: Record<string, number>
  pool: Pool
  /** Invokers cuyas piezas no se tocan (además de los bloqueados si pool = unlocked). */
  protectedHeroes?: Set<number>
  /** Conjunto obligatorio con un mínimo de piezas. */
  requiredSet?: { set: string; pieces: 3 | 5 | 8 } | null
  /** Mínimos de estadísticas totales. */
  minimums?: Record<string, number>
  /** Penaliza mover piezas de otros Invokers (0 = sin penalización). */
  moveAversion?: number
  /** Puntos que debe ganar cada cambio de pieza para merecer la pena (0 = cualquier mejora). */
  changeCost?: number
  /** 'damage' maximiza ATQ × (1 + crítico × daño crítico) además de los pesos del resto. */
  objective?: 'weights' | 'damage' | 'sim'
  /** Con objective = 'sim': simulación de combate del campeón y reparto del índice. */
  sim?: { kit: Kit; levels: number[]; settings: SimSettings; mix: Mix }
  /** Evalúa cada pieza con su principal al nivel máximo (como si se subiera). */
  maxLevel?: boolean
  /** Piezas reservadas por el plan para otros Invokers (`relic12`, `accessory7`). */
  reserved?: Set<string>
  /** Número de propuestas alternativas a devolver además de la mejor. */
  alternatives?: number
}
type Pick = { relics: Record<string, Gear | null>; accessories: Record<string, Gear | null> }
const DAMAGE_STATS = new Set(['attack', 'criticalRate', 'criticalDamage', 'damage'])
const MIN_PENALTY = 60
const SIM_STATS = ['attack', 'defense', 'health', 'criticalRate', 'criticalDamage', 'accuracy', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration']
/** Daño efectivo medio por golpe (crítico limitado al 100 %). */
export function damageValue(s: Stats): number {
  const cr = Math.min(1, Math.max(0, s.criticalRate ?? 0))
  return (s.attack ?? 0) * (1 + cr * (s.criticalDamage ?? 0))
}
export type Change = { slot: string; from: Gear | null; to: Gear | null; takenFrom: Hero | null }
export type BuildResult = {
  relics: Record<string, Gear | null>; accessories: Record<string, Gear | null>
  before: Stats; after: Stats; changes: Change[]; goldCost: number
  minimumsMet: boolean; unmet: string[]; score: number; scoreBefore: number
  /** false si no existe ninguna combinación que cumpla el conjunto obligatorio: no es una propuesta válida. */
  feasible: boolean; problems: string[]
  damageBefore: number; damageAfter: number
  /** Con objetivo de simulación: índice (100 = equipo actual) y combate simulado. */
  index?: number; sim?: SimResult; simBefore?: SimResult
  /** Otras propuestas ordenadas por valor (la primera es esta misma build). */
  alternatives?: BuildResult[]
}
export const gearKey = (g: Pick2) => `${g.kind}${g.id}`
type Pick2 = { kind: string; id: number }

/** Escala de cada estadística: una subestadística típica vale 1 punto. */
export const STAT_SCALE: Record<string, number> = {
  health: 0.03, attack: 0.03, defense: 0.03, criticalRate: 0.03, criticalDamage: 0.035,
  accuracy: 15, resistance: 15, instinct: 8, comboSpeed: 7, skillSpeed: 7, skillRecovery: 7, manaGeneration: 7, runSpeed: 5,
}
const TOLERANCE_SCALE = 0.25

export const PRESETS: { id: string; label: string; weights: Record<string, number> }[] = [
  { id: 'dps', label: 'Daño', weights: { damage: 10, accuracy: 2, comboSpeed: 2, skillSpeed: 2, health: 1 } },
  { id: 'tank', label: 'Tanque', weights: { health: 10, defense: 9, resistance: 5, instinct: 4, skillRecovery: 3, comboSpeed: 2 } },
  { id: 'support', label: 'Apoyo', weights: { health: 7, defense: 5, skillSpeed: 9, skillRecovery: 9, manaGeneration: 8, resistance: 4 } },
  { id: 'control', label: 'Control', weights: { accuracy: 10, skillSpeed: 7, manaGeneration: 6, attack: 4, health: 3 } },
  { id: 'speed', label: 'Velocidad', weights: { comboSpeed: 10, skillSpeed: 10, skillRecovery: 6, manaGeneration: 6, attack: 3 } },
]
export function presetFor(hero: Hero): string {
  return hero.cls === 'Tank' ? 'tank' : hero.cls === 'Support' ? 'support' : 'dps'
}

function bonusPoints(b: Bonus, hero: Hero, w: Record<string, number>): number {
  const weight = w[b.stat] ?? 0
  if (!weight) return 0
  let value = b.value
  if (PERCENT_OF_BASE.has(b.stat) && b.mode === 'flat') value = hero.basis?.[b.stat] ? b.value / hero.basis[b.stat] : 0
  const scale = STAT_SCALE[b.stat] ?? (b.stat.endsWith('Tolerance') ? TOLERANCE_SCALE : 10)
  return weight * value / scale
}
export function piecePoints(g: Gear, hero: Hero, w: Record<string, number>): number {
  let s = bonusPoints(g.main, hero, w)
  for (const b of g.subs) s += bonusPoints(b, hero, w)
  return s
}

export function optimize(index: BoxIndex, hero: Hero, opts: OptimizeOptions): BuildResult {
  const owners = new Map<number, Hero>()
  const allowed = (g: Gear) => {
    if (opts.reserved?.has(gearKey(g))) return false
    if (g.equippedHeroId === null || g.equippedHeroId === hero.id) return true
    if (opts.protectedHeroes?.has(g.equippedHeroId)) return false
    if (opts.pool === 'free') return false
    const owner = index.heroes.get(g.equippedHeroId)
    return opts.pool === 'all' || !owner?.locked
  }
  for (const h of index.box.heroes) owners.set(h.id, h)
  // Con «nivel máximo», cada pieza se evalúa con la principal que tendría al subirla (dato del portal).
  const up = (g: Gear): Gear => opts.maxLevel && g.mainAtMax ? { ...g, main: g.mainAtMax } : g
  const pieces = new Map([...index.box.relics, ...index.box.accessories].map(g => [gearKey(g), up(g)]))
  const piece = (kind: 'relic' | 'accessory', id: number | undefined) => id === undefined ? undefined : pieces.get(`${kind}${id}`)
  const relics = index.box.relics.filter(allowed).map(g => pieces.get(gearKey(g))!)
  const accessories = index.box.accessories.filter(g => allowed(g) && g.faction === hero.faction && hero.awakeLevel >= (index.box.accessorySlotAwake[g.slot] ?? 0)).map(g => pieces.get(gearKey(g))!)
  /** Equipo actual tal cual (referencia «antes»); con nivel máximo, las piezas candidatas se evalúan subidas. */
  const actual = index.equipped(hero)
  const minimums = Object.entries(opts.minimums ?? {}).filter(([, v]) => v > 0)
  const aversion = opts.moveAversion ?? 0.15
  const changeCost = opts.changeCost ?? 0
  const damage = opts.objective === 'damage'
  /** Puntos por cada 100 % (en log) de daño efectivo: peso «damage» 0–10. */
  const DAMAGE_POINTS = 60 * (opts.weights.damage ?? 10)
  const unit = (k: string) => (PERCENT_OF_BASE.has(k) ? (hero.basis?.[k] || 1) : 1) * (STAT_SCALE[k] ?? (k.endsWith('Tolerance') ? TOLERANCE_SCALE : 10))
  const sim = opts.objective === 'sim' && opts.sim ? opts.sim : null
  const linearWeights = Object.entries(opts.weights).filter(([k, w]) => w && k !== 'damage' && !(damage && DAMAGE_STATS.has(k)))
  const base = damageValue(hero.stats) || 1
  const runSim = (stats: Stats) => simulate(index.box, sim!.kit, sim!.levels, stats, sim!.settings)
  let simBase: { sim: SimResult; stats: Stats } | null = null
  /** Puntos del índice de simulación: 600 por cada 100 % (en log), como el objetivo de daño. */
  const simPoints = (stats: Stats) => sim && simBase ? 6 * (opts.weights.damage ?? 10) * 10 * Math.log(indexOf(sim.mix, { sim: runSim(stats), stats }, simBase) / 100) : 0
  /** Valor exacto de una build: daño efectivo (log), pesos lineales y penalización por mínimos. */
  const evaluate = (pieces: Gear[]) => {
    const stats = projectStats(hero, pieces, index.rules)
    let j = 0
    for (const [k, w] of linearWeights) j += w * ((stats[k] ?? 0) - (hero.stats[k] ?? 0)) / unit(k)
    if (damage) j += DAMAGE_POINTS * Math.log(Math.max(1e-9, damageValue(stats)) / base)
    if (sim) j += simPoints(stats)
    for (const [k, v] of minimums) j -= MIN_PENALTY * Math.max(0, v - (stats[k] ?? 0)) / unit(k)
    for (const g of pieces) if (g.equippedHeroId !== hero.id) j -= changeCost + (g.equippedHeroId !== null ? aversion : 0)
    return { stats, j }
  }
  /** Pesos lineales equivalentes alrededor de unas estadísticas (gradiente del objetivo). */
  const gradient = (stats: Stats) => {
    const w: Record<string, number> = Object.fromEntries(linearWeights)
    if (damage) {
      const a = stats.attack ?? 0, cr = Math.min(1, Math.max(0, stats.criticalRate ?? 0)), cd = stats.criticalDamage ?? 0, f = damageValue(stats) || 1
      w.attack = (w.attack ?? 0) + DAMAGE_POINTS * (1 + cr * cd) / f * unit('attack')
      w.criticalRate = (w.criticalRate ?? 0) + ((stats.criticalRate ?? 0) < 1 ? DAMAGE_POINTS * a * cd / f * unit('criticalRate') : 0)
      w.criticalDamage = (w.criticalDamage ?? 0) + DAMAGE_POINTS * a * cr / f * unit('criticalDamage')
    }
    if (sim) for (const k of SIM_STATS) {
      // Gradiente numérico: puntos que da «una subestadística» más de cada estadística.
      const d = simPoints({ ...stats, [k]: (stats[k] ?? 0) + unit(k) }) - simPoints(stats)
      if (d > 1e-9) w[k] = (w[k] ?? 0) + d
    }
    for (const [k, v] of minimums) if ((stats[k] ?? 0) < v) w[k] = (w[k] ?? 0) + MIN_PENALTY
    return w
  }
  if (sim) { const s0 = projectStats(hero, actual, index.rules); simBase = { sim: runSim(s0), stats: s0 } }
  const piecesOf = (pick: Pick) => [...Object.values(pick.relics), ...Object.values(pick.accessories)].filter((x): x is Gear => !!x)
  // 1) Programación dinámica exacta sobre la linealización, repetida hasta converger.
  let best: { pick: Pick; j: number; stats: Stats } | null = null
  // Arranques múltiples: la linealización inicial decide el óptimo local que se alcanza.
  const seeds: Record<string, number>[] = [gradient(hero.stats)]
  if (damage) for (const mix of [0, 0.25, 0.5, 0.75, 1]) seeds.push({ ...gradient(hero.stats), attack: 10 * (1 - mix) + 2, criticalRate: 10 * mix + 1, criticalDamage: 8 * mix + 1 })
  if (sim) {
    const g = gradient(hero.stats), top = Math.max(1, ...Object.values(g))
    // Variantes: priorizar crítico, la estadística de la que escala y la precisión (tiene un umbral que el gradiente no ve).
    seeds.push({ ...g, criticalRate: top, criticalDamage: top * 0.8 }, { ...g, attack: (g.attack ?? 0) * 2, defense: (g.defense ?? 0) * 2, health: (g.health ?? 0) * 2 })
    if (sim.mix.control > 0) seeds.push({ ...g, accuracy: top }, { ...g, accuracy: top * 2.5 }, { ...g, accuracy: top * 6 })
    seeds.push({ ...g, skillRecovery: top, manaGeneration: top * 0.7, comboSpeed: top * 0.7, skillSpeed: top * 0.5 })
  }
  for (const seed of seeds) {
    const { pick } = solve(index, hero, relics, accessories, seed, aversion)
    const e = evaluate(piecesOf(pick))
    if (!best || e.j > best.j) best = { pick, ...e }
  }
  let stats: Stats = best!.stats
  for (let round = 0; round < 10; round++) {
    const { pick } = solve(index, hero, relics, accessories, gradient(stats), aversion)
    const e = evaluate(piecesOf(pick))
    if (best && e.j <= best.j + 1e-9) {
      const blended: Stats = { ...stats }
      for (const k of Object.keys(e.stats)) blended[k] = ((stats[k] ?? 0) + (e.stats[k] ?? 0)) / 2
      stats = blended
      if (round > 5) break
      continue
    }
    best = { pick, ...e }
    stats = e.stats
  }
  // 2) Búsqueda local exacta: probar cada candidata en cada ranura con la fórmula completa.
  const w = gradient(best!.stats)
  const top = (pool: Gear[], slot: string) => pool.filter(g => g.slot === slot).sort((a, b) => piecePoints(b, hero, w) - piecePoints(a, hero, w)).slice(0, 30)
  const cand = new Map<string, Gear[]>([...RELIC_SLOTS.map(s => [s, top(relics, s)] as const), ...ACCESSORY_SLOTS.map(s => [s, top(accessories, s)] as const)])
  for (let pass = 0; pass < 4; pass++) {
    let improved = false
    for (const slot of [...RELIC_SLOTS, ...ACCESSORY_SLOTS]) {
      const isRelic = RELIC_SLOTS.includes(slot)
      for (const g of cand.get(slot) ?? []) {
        const map = isRelic ? best!.pick.relics : best!.pick.accessories
        if (map[slot] === g) continue
        const trial: Pick = isRelic ? { relics: { ...map, [slot]: g }, accessories: best!.pick.accessories } : { relics: best!.pick.relics, accessories: { ...map, [slot]: g } }
        if (opts.requiredSet && (setCounts(piecesOf(trial)).get(opts.requiredSet.set) ?? 0) < opts.requiredSet.pieces) continue
        const e = evaluate(piecesOf(trial))
        if (e.j > best!.j + 1e-9) { best = { pick: trial, ...e }; improved = true }
      }
    }
    if (!improved) break
  }
  const final = best!
  const now = evaluate(actual)
  const build = (b: { pick: Pick; j: number; stats: Stats }): BuildResult => {
    const unmet = minimums.filter(([k, v]) => (b.stats[k] ?? 0) < v).map(([k]) => k)
    const extra = sim && simBase ? (() => { const r = runSim(b.stats); return { sim: r, simBefore: simBase!.sim, index: indexOf(sim.mix, { sim: r, stats: b.stats }, simBase!) } })() : {}
    const problems: string[] = []
    if (opts.requiredSet && (setCounts(piecesOf(b.pick)).get(opts.requiredSet.set) ?? 0) < opts.requiredSet.pieces) problems.push(`No hay piezas disponibles para ${opts.requiredSet.pieces} del conjunto exigido.`)
    return { ...finalize(b.pick), feasible: problems.length === 0, problems, before: now.stats, after: b.stats, unmet, minimumsMet: unmet.length === 0, score: b.j, scoreBefore: now.j, damageBefore: damageValue(now.stats), damageAfter: damageValue(b.stats), ...extra }
  }
  const result = build(final)
  // 3) Propuestas alternativas: la mejor combinación de cada par de conjuntos, evaluada con la fórmula completa.
  const count = opts.alternatives ?? 0
  if (count > 0) {
    const signature = (p: Pick) => RELIC_SLOTS.map(s => p.relics[s]?.id ?? '-').join(',')
    const seen = new Set([signature(final.pick)])
    const others = solve(index, hero, relics, accessories, gradient(final.stats), aversion).pairs
      .map(relicPick => ({ relics: relicPick, accessories: final.pick.accessories }))
      .filter(p => { const k = signature(p); if (seen.has(k)) return false; seen.add(k); return true })
      .map(p => ({ pick: p, ...evaluate(piecesOf(p)) }))
      .filter(b => !opts.requiredSet || (setCounts(piecesOf(b.pick)).get(opts.requiredSet.set) ?? 0) >= opts.requiredSet.pieces)
      .sort((a, b) => b.j - a.j).slice(0, count)
    result.alternatives = [result, ...others.map(build)]
  }
  return result

  function finalize(pick: Pick) {
    const changes: Change[] = []
    let goldCost = 0
    for (const [slot, to] of [...Object.entries(pick.relics), ...Object.entries(pick.accessories)]) {
      const fromId = (RELIC_SLOTS.includes(slot) ? hero.relics : hero.accessories)[slot]
      const from = piece(RELIC_SLOTS.includes(slot) ? 'relic' : 'accessory', fromId) ?? null
      if ((from?.id ?? null) === (to?.id ?? null)) continue
      const takenFrom = to && to.equippedHeroId !== null && to.equippedHeroId !== hero.id ? owners.get(to.equippedHeroId) ?? null : null
      if (from) goldCost += from.unequipGold
      if (takenFrom && to) goldCost += to.unequipGold
      changes.push({ slot, from, to, takenFrom })
    }
    return { relics: pick.relics, accessories: pick.accessories, changes, goldCost }
  }

  function solve(index: BoxIndex, hero: Hero, relics: Gear[], accessories: Gear[], w: Record<string, number>, aversion: number): { pick: Pick; pairs: Record<string, Gear | null>[] } {
    const points = new Map<Gear, number>()
    const value = (g: Gear) => {
      let p = points.get(g)
      if (p === undefined) {
        p = piecePoints(g, hero, w)
        if (g.equippedHeroId === hero.id) p += 1e-6
        else p -= changeCost + (g.equippedHeroId !== null ? aversion : 0)
        points.set(g, p)
      }
      return p
    }
    // Reliquias por ranura y conjunto (solo la mejor de cada conjunto importa para el DP).
    const bySlot = new Map<string, Map<string, Gear>>(), bestAny = new Map<string, Gear[]>()
    for (const g of relics) {
      const sets = bySlot.get(g.slot) ?? new Map<string, Gear>()
      bySlot.set(g.slot, sets)
      const key = g.set ?? '—'
      const prev = sets.get(key)
      if (!prev || value(g) > value(prev)) sets.set(key, g)
    }
    for (const [slot, sets] of bySlot) bestAny.set(slot, [...sets.values()].sort((a, b) => value(b) - value(a)))
    const setValue = (set: string, n: number) => {
      const rule = index.rules.get(set)
      if (!rule) return 0
      let v = 0
      for (const [t, k] of TIERS) if (n >= t) for (const b of rule[k]) v += bonusPoints(b, hero, w)
      return v
    }
    const sets = [...index.rules.keys()].filter(s => setValue(s, 8) > 0 || opts.requiredSet?.set === s)
    const candidates: (string | null)[] = [null, ...sets]
    let best: { score: number; pick: Record<string, Gear | null> } = { score: -Infinity, pick: {} }
    const pairs: { score: number; pick: Record<string, Gear | null> }[] = []
    for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j <= candidates.length; j++) {
      const A = candidates[i], B = j < candidates.length ? candidates[j] : null
      if (A === null && B !== null) continue
      if (opts.requiredSet && A !== opts.requiredSet.set && B !== opts.requiredSet.set) continue
      // dp[a][b] = mejor suma; elección por ranura para reconstruir.
      let dp = new Map<string, { score: number; pick: Record<string, Gear | null> }>([['0,0', { score: 0, pick: {} }]])
      for (const slot of RELIC_SLOTS) {
        const sets = bySlot.get(slot)
        const options: { g: Gear | null; da: number; db: number }[] = [{ g: null, da: 0, db: 0 }]
        const other = (bestAny.get(slot) ?? []).find(g => g.set !== A && g.set !== B)
        if (other) options.push({ g: other, da: 0, db: 0 })
        if (A && sets?.get(A)) options.push({ g: sets.get(A)!, da: 1, db: 0 })
        if (B && sets?.get(B)) options.push({ g: sets.get(B)!, da: 0, db: 1 })
        const next = new Map<string, { score: number; pick: Record<string, Gear | null> }>()
        for (const [key, state] of dp) {
          const [a, b] = key.split(',').map(Number)
          for (const o of options) {
            const k = `${a + o.da},${b + o.db}`, score = state.score + (o.g ? value(o.g) : 0)
            const prev = next.get(k)
            if (!prev || score > prev.score) next.set(k, { score, pick: { ...state.pick, [slot]: o.g } })
          }
        }
        dp = next
      }
      let pairBest: { score: number; pick: Record<string, Gear | null> } | null = null
      for (const [key, state] of dp) {
        const [a, b] = key.split(',').map(Number)
        if (opts.requiredSet && ((A === opts.requiredSet.set ? a : b) < opts.requiredSet.pieces)) continue
        const total = state.score + (A ? setValue(A, a) : 0) + (B ? setValue(B, b) : 0)
        if (total > best.score) best = { score: total, pick: state.pick }
        // Para las alternativas, cada par debe tener sus conjuntos activos (3+ piezas): propuestas distintas.
        if ((!A || a >= 3) && (!B || b >= 3) && (!pairBest || total > pairBest.score)) pairBest = { score: total, pick: state.pick }
      }
      if (pairBest) pairs.push(pairBest)
    }
    const relicPick: Record<string, Gear | null> = Object.fromEntries(RELIC_SLOTS.map(s => [s, best.pick[s] ?? null]))
    const accessoryPick: Record<string, Gear | null> = {}
    for (const slot of ACCESSORY_SLOTS) {
      const options = accessories.filter(g => g.slot === slot)
      accessoryPick[slot] = options.length ? options.reduce((a, b) => value(b) > value(a) ? b : a) : null
      if (accessoryPick[slot] && value(accessoryPick[slot]!) <= 0 && accessoryPick[slot]!.equippedHeroId !== hero.id) accessoryPick[slot] = null
    }
    // Mantener piezas actuales en ranuras que el optimizador deja vacías por no aportar.
    const keep = (kind: 'relic' | 'accessory', id: number | undefined) => { const g = piece(kind, id); return g && !opts.reserved?.has(gearKey(g)) ? g : null }
    const fill = (p: Record<string, Gear | null>) => { const out = Object.fromEntries(RELIC_SLOTS.map(s => [s, p[s] ?? null])); for (const slot of RELIC_SLOTS) if (!out[slot]) out[slot] = keep('relic', hero.relics[slot]); return out }
    for (const slot of ACCESSORY_SLOTS) if (!accessoryPick[slot]) accessoryPick[slot] = keep('accessory', hero.accessories[slot])
    return { pick: { relics: fill(relicPick), accessories: accessoryPick }, pairs: pairs.sort((a, b) => b.score - a.score).slice(0, 40).map(p => fill(p.pick)) }
  }
}
