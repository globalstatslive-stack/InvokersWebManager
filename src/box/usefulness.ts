/** «¿A quién le sirve esta pieza?»: qué ganaría cada Invoker si sustituyera su pieza de esa ranura.
 * Cálculo determinista con la fórmula de estadísticas verificada (incluye conjuntos activos y perdidos).
 * El valor se mide con el perfil del Invoker: daño por golpe para atacantes y pesos de su clase para el resto. */
import type { Gear, Hero } from './model'
import { BoxIndex, projectStats, type Stats } from './stats'
import { damageValue, PRESETS, presetFor, STAT_SCALE } from './optimizer'
import { PERCENT_OF_BASE } from './i18n'

export type Usefulness = { hero: Hero; gain: number; unit: 'damage' | 'points'; replaces: Gear | null; stats: Stats; ownerLoses: boolean }
const ATTACKERS = new Set(['MeleeAttacker', 'RangedAttacker'])

export function valueOf(hero: Hero, stats: Stats): { value: number; unit: 'damage' | 'points' } {
  if (ATTACKERS.has(hero.cls ?? '')) return { value: damageValue(stats), unit: 'damage' }
  const w = PRESETS.find(p => p.id === presetFor(hero))!.weights
  let v = 0
  for (const [k, wt] of Object.entries(w)) if (k !== 'damage') v += wt * (stats[k] ?? 0) / ((PERCENT_OF_BASE.has(k) ? hero.basis?.[k] || 1 : 1) * (STAT_SCALE[k] ?? 10))
  return { value: v, unit: 'points' }
}

/** Mejora para cada candidato (solo Invokers con estadísticas base). Accesorios: misma facción y ranura desbloqueada. */
export function whoBenefits(index: BoxIndex, gear: Gear, candidates: Hero[]): Usefulness[] {
  const out: Usefulness[] = []
  for (const hero of candidates) {
    if (!hero.basis || !hero.gearBonus || hero.id === gear.equippedHeroId) continue
    if (gear.kind === 'accessory' && (gear.faction !== hero.faction || hero.awakeLevel < (index.box.accessorySlotAwake[gear.slot] ?? 0))) continue
    const current = index.equipped(hero)
    const replaces = current.find(g => g.kind === gear.kind && g.slot === gear.slot) ?? null
    const next = [...current.filter(g => g !== replaces), gear]
    const before = valueOf(hero, projectStats(hero, current, index.rules)), stats = projectStats(hero, next, index.rules), after = valueOf(hero, stats)
    const gain = before.unit === 'damage' ? (before.value ? after.value / before.value - 1 : 0) : after.value - before.value
    out.push({ hero, gain, unit: before.unit, replaces, stats, ownerLoses: gear.equippedHeroId !== null })
  }
  return out.filter(u => u.gain > (u.unit === 'damage' ? 0.002 : 0.05)).sort((a, b) => (b.unit === 'damage' ? b.gain * 100 : b.gain) - (a.unit === 'damage' ? a.gain * 100 : a.gain))
}
