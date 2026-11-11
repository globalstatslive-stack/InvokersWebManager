/** Cálculo de estadísticas a partir del equipo.
 *
 * Fórmula verificada con la caja oficial (0 discrepancias en todas las estadísticas
 * de todos los Invokers equipados):
 *   aporte = Σ bonificaciones fijas + Σ (% × base) para vida/ataque/defensa
 *          + Σ bonificaciones de conjunto activas (3/5/8 piezas)
 *   total  = total publicado − aporte publicado + aporte del equipo propuesto
 */
import type { Bonus, Box, Gear, Hero, SetRule } from './model'
import { PERCENT_OF_BASE } from './i18n'

export type Stats = Record<string, number>
export const TIERS: [number, 'three' | 'five' | 'eight'][] = [[3, 'three'], [5, 'five'], [8, 'eight']]

export function addBonus(out: Stats, b: Bonus, basis: Stats | null): void {
  const v = b.mode === 'percent' && PERCENT_OF_BASE.has(b.stat) ? b.value * (basis?.[b.stat] ?? 0) : b.value
  out[b.stat] = (out[b.stat] ?? 0) + v
}
export function setCounts(pieces: Gear[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of pieces) if (p.kind === 'relic' && p.set) counts.set(p.set, (counts.get(p.set) ?? 0) + 1)
  return counts
}
export function activeSetBonuses(pieces: Gear[], rules: Map<string, SetRule>): { set: string; pieces: number; bonuses: Bonus[]; tiers: number[] }[] {
  const out = []
  for (const [set, n] of setCounts(pieces)) {
    const rule = rules.get(set)
    if (!rule) continue
    const tiers = TIERS.filter(([t]) => n >= t).map(([t]) => t)
    if (!tiers.length) continue
    out.push({ set, pieces: n, tiers, bonuses: TIERS.filter(([t]) => n >= t).flatMap(([, k]) => rule[k]) })
  }
  return out
}
/** Aporte total de un conjunto de piezas a las estadísticas de un Invoker. */
export function gearContribution(hero: Hero, pieces: Gear[], rules: Map<string, SetRule>): Stats {
  const out: Stats = {}
  for (const p of pieces) { addBonus(out, p.main, hero.basis); for (const s of p.subs) addBonus(out, s, hero.basis) }
  for (const s of activeSetBonuses(pieces, rules)) for (const b of s.bonuses) addBonus(out, b, hero.basis)
  return out
}
/** Estadísticas que tendría el Invoker con otras piezas. */
export function projectStats(hero: Hero, pieces: Gear[], rules: Map<string, SetRule>): Stats {
  const contribution = gearContribution(hero, pieces, rules)
  const out: Stats = { ...hero.stats }
  for (const [k, v] of Object.entries(hero.gearBonus ?? {})) out[k] = (out[k] ?? 0) - v
  for (const [k, v] of Object.entries(contribution)) out[k] = (out[k] ?? 0) + v
  return out
}

export class BoxIndex {
  readonly gear = new Map<string, Gear>()
  readonly heroes = new Map<number, Hero>()
  readonly titans = new Map<number, Box['titans'][number]>()
  readonly rules: Map<string, SetRule>
  constructor(readonly box: Box) {
    for (const g of box.relics) this.gear.set(`r${g.id}`, g)
    for (const g of box.accessories) this.gear.set(`a${g.id}`, g)
    for (const h of box.heroes) this.heroes.set(h.id, h)
    for (const t of box.titans) this.titans.set(t.id, t)
    this.rules = new Map(box.setRules.map(r => [r.set, r]))
  }
  relic(id: number) { return this.gear.get(`r${id}`) }
  accessory(id: number) { return this.gear.get(`a${id}`) }
  equipped(hero: Hero): Gear[] {
    return [
      ...Object.values(hero.relics).map(id => this.relic(id)),
      ...Object.values(hero.accessories).map(id => this.accessory(id)),
    ].filter((x): x is Gear => !!x)
  }
}

/** Curvas oficiales: valor de la estadística → porcentaje efectivo. */
const CURVE: Record<string, string> = { comboSpeed: 'speedPercent', skillSpeed: 'speedPercent', skillRecovery: 'skillRecoveryPercent', manaGeneration: 'manaGenerationPercent', instinct: 'instinctPercent' }
export function rating(box: Box, stat: string, value: number): number | null {
  const curve = box.ratingCurves?.[CURVE[stat]]
  if (!curve?.length) return null
  const i = Math.max(0, Math.min(curve.length - 1, Math.round(value)))
  return curve[i]
}

const GRADE_POINTS: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 }
/** Nota media de las subestadísticas (1 = D … 5 = S), o null si la pieza no tiene notas. */
export function gradeScore(g: Gear): number | null {
  const graded = g.subs.filter(s => s.grade)
  if (!graded.length) return null
  return graded.reduce((s, b) => s + GRADE_POINTS[b.grade!], 0) / graded.length
}
