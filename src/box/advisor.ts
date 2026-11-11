/** Recomendaciones sin ejecutar nada en el juego: venta, mejoras y diagnóstico de builds. */
import type { Box, Gear, Hero } from './model'
import { ACCESSORY_SLOTS, RARITIES, RELIC_SLOTS, SET_LABEL, t } from './i18n'
import { BoxIndex, gradeScore } from './stats'

export type SellVerdict = { gear: Gear; score: number; reasons: string[]; keep: string[] }
const FLAT_BASE = new Set(['attack', 'defense', 'health'])

/** Puntuación 0–100 de una pieza: rareza, rango, notas y calidad de las subestadísticas. */
export function gearRating(g: Gear): number {
  const rarity = RARITIES.indexOf(g.rarity) / 4
  const rank = (g.rank - 1) / 4
  const grade = gradeScore(g)
  const gradePart = grade === null ? 0.4 : (grade - 1) / 4
  const flatSubs = g.subs.filter(s => s.mode === 'flat' && FLAT_BASE.has(s.stat)).length
  const subsPart = Math.min(1, g.subs.length / 4) - flatSubs * 0.08
  return Math.round(100 * Math.max(0, Math.min(1, 0.25 * rarity + 0.3 * rank + 0.3 * gradePart + 0.15 * subsPart)))
}

export function sellCandidates(box: Box): SellVerdict[] {
  const out: SellVerdict[] = []
  for (const g of [...box.relics, ...box.accessories]) {
    if (g.equippedHeroId !== null) continue
    const reasons: string[] = [], keep: string[] = []
    const rating = gearRating(g), grade = gradeScore(g)
    if (g.rank <= 3) reasons.push(`Rango ${g.rank}★`)
    if (RARITIES.indexOf(g.rarity) <= 1) reasons.push(`Rareza ${g.rarity === 'Common' ? 'común' : 'poco común'}`)
    if (grade !== null && grade < 1.6 && g.subs.length >= 2) reasons.push('Subestadísticas con nota D')
    const flat = g.subs.filter(s => s.mode === 'flat' && FLAT_BASE.has(s.stat)).length
    if (flat >= 2) reasons.push(`${flat} subestadísticas planas de ATQ/DEF/VIDA`)
    if (g.kind === 'relic' && ['Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots'].includes(g.slot) && g.main.mode === 'flat' && FLAT_BASE.has(g.main.stat)) reasons.push('Principal plana en ranura de porcentaje')
    if (g.rank >= 5) keep.push('Rango 5★')
    if (grade !== null && grade >= 3) keep.push('Buenas notas')
    if (g.subs.some(s => s.grade === 'S' || s.grade === 'A')) keep.push('Tiene una sub A/S')
    if (g.level >= 15) keep.push(`Ya está a +${g.level}`)
    const score = Math.max(0, 100 - rating) + reasons.length * 8 - keep.length * 15
    if (reasons.length && score >= 50) out.push({ gear: g, score, reasons, keep })
  }
  return out.sort((a, b) => b.score - a.score)
}

export type Upgrade = { gear: Gear; hero: Hero; gain: number; levels: number }
/** Piezas equipadas sin maximizar, priorizando a los Invokers más fuertes. */
export function upgradeQueue(box: Box, index: BoxIndex): Upgrade[] {
  const out: Upgrade[] = []
  for (const h of box.heroes) for (const g of index.equipped(h)) {
    const max = g.kind === 'relic' ? box.maxGearLevel : 15
    if (g.level >= max) continue
    const gain = g.mainAtMax ? g.mainAtMax.value - g.main.value : 0
    out.push({ gear: g, hero: h, gain, levels: max - g.level })
  }
  return out.sort((a, b) => b.hero.power - a.hero.power || b.levels - a.levels)
}

export type Issue = { kind: 'empty' | 'unleveled' | 'set' | 'accessory' | 'weak'; text: string; severity: 1 | 2 | 3 }
/** Revisión de un Invoker: ranuras vacías, piezas sin subir, conjuntos incompletos. */
export function diagnose(box: Box, index: BoxIndex, hero: Hero): Issue[] {
  const issues: Issue[] = []
  const emptyRelics = RELIC_SLOTS.filter(s => !hero.relics[s])
  if (emptyRelics.length) issues.push({ kind: 'empty', severity: 3, text: `${emptyRelics.length} ranura${emptyRelics.length > 1 ? 's' : ''} de reliquia vacía${emptyRelics.length > 1 ? 's' : ''}` })
  const openAccessories = ACCESSORY_SLOTS.filter(s => hero.awakeLevel >= (box.accessorySlotAwake[s] ?? 99) && !hero.accessories[s])
  if (openAccessories.length) {
    const available = box.accessories.filter(g => g.equippedHeroId === null && g.faction === hero.faction && openAccessories.includes(g.slot)).length
    issues.push({ kind: 'accessory', severity: available ? 3 : 1, text: `${openAccessories.length} ranura${openAccessories.length > 1 ? 's' : ''} de accesorio desbloqueada${openAccessories.length > 1 ? 's' : ''} sin usar${available ? ` · ${available} libres de su facción` : ''}` })
  }
  const pieces = index.equipped(hero)
  const low = pieces.filter(g => g.level < (g.kind === 'relic' ? box.maxGearLevel : 15))
  if (low.length) issues.push({ kind: 'unleveled', severity: 2, text: `${low.length} pieza${low.length > 1 ? 's' : ''} sin nivel máximo` })
  const counts = new Map<string, number>()
  for (const g of pieces) if (g.kind === 'relic' && g.set) counts.set(g.set, (counts.get(g.set) ?? 0) + 1)
  for (const [set, n] of counts) if (n === 2 || n === 4 || n === 7) issues.push({ kind: 'set', severity: 1, text: `${n} piezas de ${t(SET_LABEL, set)}: falta 1 para el siguiente bonus` })
  const weak = pieces.filter(g => g.rank <= 3)
  if (weak.length >= 3) issues.push({ kind: 'weak', severity: 2, text: `${weak.length} piezas de rango 3★ o menor` })
  return issues.sort((a, b) => b.severity - a.severity)
}
/** Invokers que aparecen en equipos registrados (arena, jefes, agujas…). */
export function teamHeroIds(box: Box): Set<number> {
  const ids = new Set<number>()
  for (const t of box.teams) for (const l of t.levels) for (const s of l.slots) ids.add(s.heroId)
  return ids
}
