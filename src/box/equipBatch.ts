/** Equipar en lote: las piezas libres que de verdad le sirven a la cuenta, listas para el Plan.
 *
 * - Solo Invokers que usas: los de tus equipos activos y tu plan o, si no has marcado ninguno, los de tus equipos
 *   registrados con nivel 30 o más (los récords antiguos con Invokers sin subir no cuentan).
 * - Huecos vacíos: el optimizador elige para cada Invoker, por orden de prioridad, las piezas libres que mejor le
 *   encajan en sus ranuras vacías, con los conjuntos que se activan. No cuesta oro: no se quita nada.
 * - Sustituciones (opcionales): cambiar una pieza puesta por una libre que le da un 1 % o más; cuesta el oro de
 *   desequipar la que sale (dato del portal).
 * - Nunca usa piezas reservadas en tu plan ni las que el coach aconseja guardar (tolerancias escasas).
 * El valor se mide como en el resto del coach: daño medio por golpe en atacantes y valor del perfil de clase en
 * tanques y apoyos, con la fórmula de estadísticas verificada. */
import type { Box, Gear, Hero } from './model'
import { BoxIndex, projectStats } from './stats'
import { PRESETS, presetFor, damageValue, type BuildResult, type Change, type OptimizeOptions } from './optimizer'
import { valueOf } from './usefulness'
import { teamsByHero } from './ascension'
import { ACCESSORY_SLOTS, RELIC_SLOTS } from './i18n'

/** Criterio de Nexo: un cambio que no da al menos un 1 % no compensa. */
export const MIN_BATCH_GAIN = 0.01
export const USED_MIN_LEVEL = 30

export type UsedHero = { hero: Hero; why: 'active' | 'team'; teams: number }
/** Invokers que usas, por prioridad: equipos activos y plan; si no hay, los de tus equipos registrados (nivel ≥ 30). */
export function usedHeroes(box: Box, important: Set<number>): { used: UsedHero[]; skipped: Hero[] } {
  const teams = teamsByHero(box)
  const marked = box.heroes.filter(h => important.has(h.id))
  const pool: UsedHero[] = marked.length
    ? marked.map(h => ({ hero: h, why: 'active' as const, teams: teams.get(h.id)?.length ?? 0 }))
    : box.heroes.filter(h => teams.has(h.id) && h.level >= USED_MIN_LEVEL).map(h => ({ hero: h, why: 'team' as const, teams: teams.get(h.id)!.length }))
  const used = pool.filter(u => u.hero.basis && u.hero.gearBonus).sort((a, b) => b.teams - a.teams || (b.hero.battles || 0) - (a.hero.battles || 0) || b.hero.power - a.hero.power)
  const codes = new Set(used.map(u => u.hero.code))
  // Invokers con ranuras vacías que no usas (una vez por personaje): se informa de que se dejan fuera.
  const seen = new Set<string>()
  const skipped = box.heroes.filter(h => !codes.has(h.code) && h.level >= USED_MIN_LEVEL && Object.keys(h.relics).length < RELIC_SLOTS.length && !seen.has(h.code) && !!seen.add(h.code))
  return { used, skipped }
}

/** Opciones del optimizador para rellenar huecos: el perfil de su clase (daño en atacantes). */
export function fillOptions(hero: Hero, reserved: Set<string>): OptimizeOptions {
  const preset = presetFor(hero)
  const weights = PRESETS.find(p => p.id === preset)!.weights
  return { objective: preset === 'dps' ? 'damage' : 'weights', weights, pool: 'free', onlyEmpty: true, changeCost: 0.5, reserved }
}

const piecesOf = (index: BoxIndex, relics: Record<string, number | null>, accessories: Record<string, number | null>): Gear[] => [
  ...Object.values(relics).map(id => id === null ? undefined : index.relic(id)),
  ...Object.values(accessories).map(id => id === null ? undefined : index.accessory(id)),
].filter((g): g is Gear => !!g)

/** Resultado listo para el Plan (mismo formato que el optimizador). */
export function buildFor(index: BoxIndex, hero: Hero, relics: Record<string, number | null>, accessories: Record<string, number | null>): BuildResult {
  const before = hero.stats, pieces = piecesOf(index, relics, accessories), after = projectStats(hero, pieces, index.rules)
  const changes: Change[] = []
  let goldCost = 0
  for (const [kind, slots, now, next] of [['relic', RELIC_SLOTS, hero.relics, relics], ['accessory', ACCESSORY_SLOTS, hero.accessories, accessories]] as const) {
    for (const slot of slots) {
      const fromId = now[slot] ?? null, toId = next[slot] ?? null
      if (fromId === toId) continue
      const from = fromId === null ? null : (kind === 'relic' ? index.relic(fromId) : index.accessory(fromId)) ?? null
      const to = toId === null ? null : (kind === 'relic' ? index.relic(toId) : index.accessory(toId)) ?? null
      if (from) goldCost += from.unequipGold
      changes.push({ slot, from, to, takenFrom: null })
    }
  }
  const asGear = (m: Record<string, number | null>, kind: 'relic' | 'accessory') => Object.fromEntries(Object.entries(m).map(([s, id]) => [s, id === null ? null : (kind === 'relic' ? index.relic(id) : index.accessory(id)) ?? null]))
  return { relics: asGear(relics, 'relic'), accessories: asGear(accessories, 'accessory'), before, after, changes, goldCost, minimumsMet: true, unmet: [], score: 0, scoreBefore: 0, feasible: true, problems: [], damageBefore: damageValue(before), damageAfter: damageValue(after) }
}

/** Ganancia relativa (daño por golpe o valor del perfil) de pasar de unas piezas a otras. */
export function relativeGain(index: BoxIndex, hero: Hero, from: Gear[], to: Gear[]): number {
  const a = valueOf(hero, projectStats(hero, from, index.rules)), b = valueOf(hero, projectStats(hero, to, index.rules))
  return a.value > 0 ? b.value / a.value - 1 : b.value > 0 ? 1 : 0
}

export type SwapOption = { heroId: number; slot: string; kind: 'relic' | 'accessory'; pieceId: number }
export type BatchHero = {
  hero: Hero; why: UsedHero['why']; teams: number
  fills: Change[]; swaps: (Change & { gain: number })[]
  /** Ganancia de los huecos y total con sustituciones. */
  fillGain: number; gain: number; gold: number
  build: BuildResult
}
export type Batch = { heroes: BatchHero[]; pieces: number; gold: number; skipped: Hero[]; left: { hero: Hero; reason: string }[] }

/** Une los huecos que eligió el optimizador con las sustituciones que propone el coach (si se piden).
 * `fills`: resultado del optimizador con «solo huecos» para cada Invoker, en orden de prioridad. */
export function assembleBatch(index: BoxIndex, used: UsedHero[], fills: Map<number, BuildResult>, swapOptions: SwapOption[], withSwaps: boolean, skipped: Hero[] = []): Batch {
  const taken = new Set<string>()
  type Work = { u: UsedHero; current: Gear[]; relics: Record<string, number | null>; accessories: Record<string, number | null>; fills: Change[]; fillGain: number; tried: number; swaps: BatchHero['swaps'] }
  // 1) Huecos vacíos: van primero porque no cuestan oro. Si un Invoker de más prioridad se quedó una pieza, se descarta.
  const work: Work[] = used.map(u => {
    const current = index.equipped(u.hero)
    const fillChanges = (fills.get(u.hero.id)?.changes ?? []).filter(c => !c.from && c.to && !taken.has(`${c.to.kind}${c.to.id}`))
    const relics: Record<string, number | null> = { ...u.hero.relics }, accessories: Record<string, number | null> = { ...u.hero.accessories }
    for (const c of fillChanges) (c.to!.kind === 'relic' ? relics : accessories)[c.slot] = c.to!.id
    const gain = fillChanges.length ? relativeGain(index, u.hero, current, piecesOf(index, relics, accessories)) : 0
    if (gain >= MIN_BATCH_GAIN) { for (const c of fillChanges) taken.add(`${c.to!.kind}${c.to!.id}`); return { u, current, relics, accessories, fills: fillChanges, fillGain: gain, tried: fillChanges.length, swaps: [] } }
    return { u, current, relics: { ...u.hero.relics }, accessories: { ...u.hero.accessories }, fills: [], fillGain: 0, tried: fillChanges.length, swaps: [] }
  })
  // 2) Sustituciones (opcionales): sobre lo ya rellenado, solo si siguen dando un 1 % o más.
  if (withSwaps) for (const w of work) {
    let pieces = piecesOf(index, w.relics, w.accessories)
    for (const o of swapOptions.filter(s => s.heroId === w.u.hero.id)) {
      const key = `${o.kind}${o.pieceId}`
      const piece = o.kind === 'relic' ? index.relic(o.pieceId) : index.accessory(o.pieceId)
      const map = o.kind === 'relic' ? w.relics : w.accessories
      const fromId = map[o.slot]
      if (!piece || taken.has(key) || piece.equippedHeroId !== null || fromId == null) continue
      const next = { ...map, [o.slot]: o.pieceId }
      const trial = o.kind === 'relic' ? piecesOf(index, next, w.accessories) : piecesOf(index, w.relics, next)
      const gain = relativeGain(index, w.u.hero, pieces, trial)
      if (gain < MIN_BATCH_GAIN) continue
      const from = (o.kind === 'relic' ? index.relic(fromId) : index.accessory(fromId)) ?? null
      map[o.slot] = o.pieceId
      pieces = trial
      taken.add(key)
      w.swaps.push({ slot: o.slot, from, to: piece, takenFrom: null, gain })
    }
  }
  const out: BatchHero[] = [], left: Batch['left'] = []
  for (const w of work) {
    if (!w.fills.length && !w.swaps.length) {
      const empty = RELIC_SLOTS.some(s => !w.u.hero.relics[s]) || ACCESSORY_SLOTS.some(s => w.u.hero.awakeLevel >= (index.box.accessorySlotAwake[s] ?? 99) && !w.u.hero.accessories[s])
      if (empty) left.push({ hero: w.u.hero, reason: w.tried ? 'Las piezas libres que le caben le darían menos de un 1 %.' : 'No queda ninguna pieza libre que le sirva para sus huecos.' })
      continue
    }
    const build = buildFor(index, w.u.hero, w.relics, w.accessories)
    out.push({ hero: w.u.hero, why: w.u.why, teams: w.u.teams, fills: w.fills, swaps: w.swaps, fillGain: w.fillGain, gain: relativeGain(index, w.u.hero, w.current, piecesOf(index, w.relics, w.accessories)), gold: build.goldCost, build })
  }
  return { heroes: out, pieces: out.reduce((s, h) => s + h.fills.length + h.swaps.length, 0), gold: out.reduce((s, h) => s + h.gold, 0), skipped, left }
}
