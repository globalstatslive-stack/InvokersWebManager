/** Sala de trofeos: dónde gastar los trofeos de arena para que lo note tu cuenta.
 *
 * Oficial (guía «Arena» de invokers.com): cada elemento tiene 12 mejoras (Ataque: ATQ %, Prob. crítico, Vel. combo,
 * Daño crítico; Defensa: VIDA %, DEF %, RES, Instinto; Función: PREC, Recuperación, Gen. maná, Vel. habilidad) que
 * suben a todos los Invokers (y Titanes) de ese elemento en todos los modos. Cada mejora va del nivel 1 al 15: los
 * niveles 1–5 se pagan con trofeos de bronce, 6–10 con plata y 11–15 con oro, y cada nivel cuesta más que el anterior.
 * Si te faltan trofeos de un tipo, los de más valor se convierten solos (1 oro = 2 platas = 4 bronces; 1 plata = 2
 * bronces), nunca al revés. En el Bazar se pueden fundir en monedas (bronce 1, plata 5, oro 10). El nivel 1 de ATQ %
 * cuesta 20 bronces y da +2 % (imagen de la guía); el coste del resto de niveles no está publicado.
 * Portal (PlayerBox): las mejoras se suman a los Invokers de ese elemento; las de % sobre su VIDA, ATQ o DEF base.
 * Tu caja: el nivel de cada mejora y su valor; de ahí sale cuánto da cada nivel (lineal en lo observado).
 * Criterio de Nexo: el orden, con los mismos pesos por perfil que el optimizador, sumando a los Invokers que usas. */
import type { Box, Hero } from './model'
import { damageValue, PRESETS, presetFor, STAT_SCALE } from './optimizer'
import { PERCENT_OF_BASE } from './i18n'
import type { UsedHero } from './equipBatch'

export type Trophy = 'bronze' | 'silver' | 'gold'
export const HALL = {
  maxLevel: 15,
  tierOf: (level: number): Trophy => level <= 5 ? 'bronze' : level <= 10 ? 'silver' : 'gold',
  /** Primer nivel de ATQ %: 20 bronces, +2 % (guía oficial). */
  firstLevel: { trophy: 'bronze' as Trophy, amount: 20, attackPercent: 0.02 },
  convert: '1 oro = 2 platas = 4 bronces y 1 plata = 2 bronces, nunca al revés',
  coins: { bronze: 1, silver: 5, gold: 10 },
  elements: ['Fire', 'Earth', 'Water', 'Wind', 'Light', 'Dark'],
  guide: 'https://invokers.com/guides/arena/',
}
export type HallGroup = 'attack' | 'defense' | 'utility'
export const HALL_STATS: { stat: string; mode: 'flat' | 'percent'; group: HallGroup }[] = [
  { stat: 'attack', mode: 'percent', group: 'attack' }, { stat: 'criticalRate', mode: 'percent', group: 'attack' },
  { stat: 'comboSpeed', mode: 'flat', group: 'attack' }, { stat: 'criticalDamage', mode: 'percent', group: 'attack' },
  { stat: 'health', mode: 'percent', group: 'defense' }, { stat: 'defense', mode: 'percent', group: 'defense' },
  { stat: 'resistance', mode: 'flat', group: 'defense' }, { stat: 'instinct', mode: 'flat', group: 'defense' },
  { stat: 'accuracy', mode: 'flat', group: 'utility' }, { stat: 'skillRecovery', mode: 'flat', group: 'utility' },
  { stat: 'manaGeneration', mode: 'flat', group: 'utility' }, { stat: 'skillSpeed', mode: 'flat', group: 'utility' },
]
const key = (element: string, stat: string) => `${element}:${stat}`

/** Nivel y valor actual de cada mejora (lo que no aparece en la caja está a nivel 0). */
export function hallLevels(box: Box): Map<string, { level: number; value: number }> {
  return new Map(box.arenaHall.map(a => [key(a.element, a.stat), { level: a.level, value: a.value }]))
}
/** Cuánto da un nivel de cada estadística, observado en tu caja (valor ÷ nivel). Sin dato si aún no has subido ninguna. */
export function perLevel(box: Box): Map<string, number> {
  const seen = new Map<string, number[]>()
  for (const a of box.arenaHall) if (a.level > 0) seen.set(a.stat, [...(seen.get(a.stat) ?? []), a.value / a.level])
  return new Map([...seen].map(([s, v]) => [s, Math.round(v.reduce((x, y) => x + y, 0) / v.length * 1e4) / 1e4]))
}

/** Puntos de Nexo que da `delta` de una estadística a un Invoker, con los pesos de su perfil en el optimizador
 * (atacantes: daño efectivo en logaritmo, como el optimizador; el resto, pesos lineales). */
export function pointsFor(hero: Hero, stat: string, mode: 'flat' | 'percent', amount: number): number {
  const w = PRESETS.find(p => p.id === presetFor(hero))!.weights
  const base = hero.basis?.[stat] ?? 0
  const delta = mode === 'percent' && PERCENT_OF_BASE.has(stat) ? amount * base : amount
  if (!delta) return 0
  let pts = 0
  if (w.damage && (stat === 'attack' || stat === 'criticalRate' || stat === 'criticalDamage')) {
    const before = damageValue(hero.stats) || 1
    pts += 60 * w.damage * Math.log(damageValue({ ...hero.stats, [stat]: (hero.stats[stat] ?? 0) + delta }) / before)
  }
  if (w[stat]) pts += w[stat] * delta / ((PERCENT_OF_BASE.has(stat) ? base || 1 : 1) * (STAT_SCALE[stat] ?? 10))
  return pts
}

export type HallBeneficiary = { hero: Hero; weight: number; points: number; delta: number }
export type HallOption = {
  element: string; stat: string; mode: 'flat' | 'percent'; group: HallGroup
  level: number; next: number; trophy: Trophy
  /** Lo que da un nivel (null si tu caja aún no lo muestra). */
  step: number | null
  score: number; beneficiaries: HallBeneficiary[]
}

/** Peso de cada Invoker que usas: más cuantos más equipos; los de tus equipos activos y plan, el triple. */
export const heroWeight = (u: UsedHero) => (u.why === 'active' ? 3 : 1) * Math.max(1, Math.log2(1 + u.teams))

/** Siguiente nivel de cada mejora, ordenado por lo que aporta a los Invokers que usas de su elemento. */
export function hallRanking(box: Box, used: UsedHero[]): { options: HallOption[]; unknown: HallOption[]; maxed: number } {
  const levels = hallLevels(box), steps = perLevel(box)
  const options: HallOption[] = [], unknown: HallOption[] = []
  let maxed = 0
  for (const element of HALL.elements) for (const s of HALL_STATS) {
    const level = levels.get(key(element, s.stat))?.level ?? 0
    if (level >= HALL.maxLevel) { maxed++; continue }
    const step = steps.get(s.stat) ?? null
    const next = level + 1
    const beneficiaries: HallBeneficiary[] = []
    for (const u of used) if (u.hero.element === element && u.hero.basis) {
      const points = step === null ? 0 : pointsFor(u.hero, s.stat, s.mode, step)
      const delta = step === null ? 0 : s.mode === 'percent' && PERCENT_OF_BASE.has(s.stat) ? step * (u.hero.basis[s.stat] ?? 0) : step
      beneficiaries.push({ hero: u.hero, weight: heroWeight(u), points, delta })
    }
    beneficiaries.sort((a, b) => b.weight * b.points - a.weight * a.points)
    const o: HallOption = { element, stat: s.stat, mode: s.mode, group: s.group, level, next, trophy: HALL.tierOf(next), step, beneficiaries,
      score: beneficiaries.reduce((t, b) => t + b.weight * b.points, 0) }
    ;(step === null ? unknown : options).push(o)
  }
  // A igual aporte, primero el nivel más bajo: cada nivel cuesta más que el anterior.
  options.sort((a, b) => b.score - a.score || a.level - b.level)
  unknown.sort((a, b) => b.beneficiaries.reduce((t, x) => t + x.weight, 0) - a.beneficiaries.reduce((t, x) => t + x.weight, 0))
  return { options, unknown, maxed }
}
