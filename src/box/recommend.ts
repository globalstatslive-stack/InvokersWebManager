/** Equipo recomendado para un jefe y una fase, solo con tus Invokers y Titanes.
 *
 * Datos oficiales: nota de cada Invoker en la tier list de ESE jefe (guía oficial), estadísticas de la fase
 * (elemento, RES, objetivos de PREC y tolerancia), corrupciones del jefe, tabla oficial de ventaja de elemento y
 * tier list oficial de Titanes. Datos de tu caja: poder, estadísticas totales, tolerancias y kit de habilidades.
 *
 * Heurística de Nexo (pesos propios, a la vista en la interfaz): la puntuación combina la nota oficial con tu
 * inversión (poder relativo) y ajusta por elemento, tolerancia y precisión. No estima probabilidad de victoria. */
import type { Box, Hero, Titan } from './model'
import type { Profile } from './combat'
import type { Boss, BossStage } from './goal'
import { toleranceKey } from './goal'
import { ELEMENT_LABEL, STAT_LABEL, t } from './i18n'
import { TOL_LABEL } from '../wiki/labels'
import { skillFit, type HeroSkills, type Need, type SkillFit } from './bossNeeds'

export type Weights = { official: number; power: number; element: number; tolerance: number; accuracy: number; skill: number; avoid: number }
/** Pesos por defecto: 60 % nota oficial del jefe, 40 % inversión; ±10 % por elemento; hasta −15 % sin tolerancia; −10 % sin PREC. */
export const DEFAULT_WEIGHTS: Weights = { official: 0.6, power: 0.4, element: 0.1, tolerance: 0.15, accuracy: 0.1, skill: 0.05, avoid: 0.15 }
/** Habilidades de tus Invokers frente a lo que pide el jefe. */
export type SkillContext = { needs: Need[]; byCode: Map<string, HeroSkills> }

export type Role = 'tank' | 'sustain' | 'support' | 'damage'
export type Candidate = {
  hero: Hero; profile: Profile | null; role: Role; tier: { tier: string; score: number | null } | null
  elementSign: number; tolCover: number; accOk: boolean | null; score: number; parts: Record<string, number>; fit: SkillFit
}
export type TeamPick = Candidate & { reasons: string[]; warnings: string[]; alternatives: Candidate[]; titan: TitanPick | null }
export type TitanPick = { titan: Titan; tier: string | null; why: string }
export type Swap = { need: Need; out: Candidate; in: Candidate; gains: Need[]; loses: Need[]; delta: number; pct: number }
export type Recommendation = { picks: TeamPick[]; gaps: string[]; pool: number; record: { heroIds: number[]; highest: number } | null; overlap: number
  /** Necesidades del jefe: quién del equipo las cubre y, si nadie, quién de tu caja podría. */
  needs: { need: Need; coveredBy: Hero[]; options: Hero[] }[]
  /** Tus mejores por habilidades, por puntuación completa (nota, inversión y habilidades). */
  bySkill: Candidate[]
  /** Cambios de un miembro que cubren una necesidad sin cubrir, con lo que se gana y se pierde. */
  swaps: Swap[]; total: number }
export type Options = { size?: number; needTank?: boolean; needSustain?: boolean; exclude?: Set<number>; include?: number[]; weights?: Weights; skills?: SkillContext }

const ROLE_ES: Record<Role, string> = { tank: 'tanque', sustain: 'curación o escudos', support: 'apoyo', damage: 'daño' }
export const roleLabel = (r: Role) => ROLE_ES[r]

export function roleOf(hero: Hero, profile: Profile | null): Role {
  if (hero.cls === 'Tank') return 'tank'
  if (profile && (profile.heals || profile.shields) && hero.cls === 'Support') return 'sustain'
  if (hero.cls === 'Support') return 'support'
  if (profile && (profile.heals || profile.shields) && (profile.mix.sustain ?? 0) >= 0.2) return 'sustain'
  return 'damage'
}

/** Signo oficial de la ventaja de elemento: +1 ventaja, −1 desventaja, 0 neutral. */
export function elementSign(elements: string[], matrix: number[][], attacker: string | null, defender: string | null): number {
  const i = elements.indexOf(attacker ?? 'Neutral'), j = elements.indexOf(defender ?? 'Neutral')
  return i >= 0 && j >= 0 ? matrix[i][j] : 0
}

/** Una copia por personaje: la de más poder. */
export function bestCopies(heroes: Hero[]): Hero[] {
  const best = new Map<string, Hero>()
  for (const h of heroes) { const b = best.get(h.code); if (!b || h.power > b.power) best.set(h.code, h) }
  return [...best.values()]
}

export function scoreCandidates(box: Box, boss: Boss, stage: BossStage, profiles: Map<number, Profile | null>, elements: { names: string[]; sign: number[][] }, weights: Weights = DEFAULT_WEIGHTS, exclude = new Set<number>(), skills?: SkillContext): Candidate[] {
  const heroes = bestCopies(box.heroes.filter(h => !exclude.has(h.id)))
  const maxPower = Math.max(1, ...heroes.map(h => h.power))
  return heroes.map(hero => {
    const profile = profiles.get(hero.id) ?? null
    const tier = boss.tier[hero.code] ?? null
    const official = tier?.score != null ? Math.min(1, tier.score / 5) : 0
    const power = hero.power / maxPower
    const sign = elementSign(elements.names, elements.sign, hero.element, stage.element)
    const covers = boss.corruptions.map(c => Math.min(1, (hero.stats[toleranceKey(c.key)] ?? 0) / Math.max(0.01, stage.tolGoal / 100)))
    const tolCover = covers.length ? covers.reduce((a, b) => a + b, 0) / covers.length : 1
    const accOk = profile ? (profile.needsAccuracy ? (hero.stats.accuracy ?? 0) >= stage.accGoal : null) : null
    const base = weights.official * official + weights.power * power
    const fElement = 1 + weights.element * sign
    const fTol = 1 - weights.tolerance * (1 - tolCover)
    const fAcc = accOk === false ? 1 - weights.accuracy : 1
    const fit = skills ? skillFit(skills.byCode.get(hero.code), skills.needs) : { matched: [], avoided: [] }
    const fSkill = 1 + weights.skill * Math.min(3, fit.matched.length) - (fit.avoided.length ? weights.avoid : 0)
    return { hero, profile, role: roleOf(hero, profile), tier, elementSign: sign, tolCover, accOk, score: base * fElement * fTol * fAcc * fSkill, parts: { official, power, fElement, fTol, fAcc, fSkill }, fit }
  }).sort((a, b) => b.score - a.score)
}

const BOUND_FIT: Record<string, (c: Candidate) => number> = {
  attack: c => c.profile?.scaling.attack ?? (c.role === 'damage' ? 1 : 0.3),
  criticalRate: c => (c.profile?.mix.damage ?? (c.role === 'damage' ? 1 : 0.2)),
  criticalDamage: c => (c.profile?.mix.damage ?? (c.role === 'damage' ? 1 : 0.2)),
  defense: c => c.profile?.scaling.defense ?? (c.role === 'tank' ? 1 : 0.2),
  health: c => c.profile?.scaling.health ?? (c.role === 'tank' || c.role === 'sustain' ? 1 : 0.2),
  accuracy: c => (c.profile?.needsAccuracy ? 1 : 0.1),
  resistance: c => (c.role === 'tank' || c.role === 'support' || c.role === 'sustain' ? 0.8 : 0.3),
}
const TITAN_ORDER = ['S+', 'S', 'A+', 'A', 'B', 'C', 'D', 'E']

/** Asigna Titanes: los de mejor nota oficial primero, cada uno al miembro al que más sirve su bonificación vinculada. */
export function assignTitans(picks: Candidate[], titans: Titan[], titanTier: Map<string, string>): (TitanPick | null)[] {
  const out: (TitanPick | null)[] = picks.map(() => null)
  const best = new Map<string, Titan>()
  for (const t of titans) { const b = best.get(t.code); if (!b || t.power > b.power) best.set(t.code, t) }
  const ordered = [...best.values()].sort((a, b) => ((TITAN_ORDER.indexOf(titanTier.get(a.code) ?? '') + 1 || 99) - (TITAN_ORDER.indexOf(titanTier.get(b.code) ?? '') + 1 || 99)) || b.power - a.power)
  for (const titan of ordered) {
    if (out.every(Boolean)) break
    const stat = titan.bound?.stat ?? ''
    const fit = BOUND_FIT[stat]
    let bestIdx = -1, bestFit = -1
    picks.forEach((c, i) => { if (out[i]) return; const f = fit ? fit(c) : 0.1; if (f > bestFit) { bestFit = f; bestIdx = i } })
    if (bestIdx < 0) break
    out[bestIdx] = { titan, tier: titanTier.get(titan.code) ?? null, why: !stat ? 'sin bonificación vinculada conocida' : BOUND_FIT[stat] ? `su vínculo da ${(STAT_LABEL[stat] ?? stat).toLowerCase()}, lo que más aprovecha este Invoker` : `su vínculo da ${(STAT_LABEL[stat] ?? stat).toLowerCase()}; sin preferencia clara, va por nota oficial` }
  }
  return out
}

export function recommendTeam(box: Box, boss: Boss, stage: BossStage, profiles: Map<number, Profile | null>, elements: { names: string[]; sign: number[][] }, titanTier: Map<string, string>, opts: Options = {}): Recommendation {
  const size = opts.size ?? 5
  const pool = scoreCandidates(box, boss, stage, profiles, elements, opts.weights ?? DEFAULT_WEIGHTS, opts.exclude, opts.skills)
  const chosen: Candidate[] = []
  const take = (c?: Candidate) => { if (c && !chosen.includes(c) && chosen.length < size) chosen.push(c) }
  // Elegidos a mano (p. ej. al aplicar un cambio): entran primero, con la misma copia que puntúa el resto.
  for (const id of opts.include ?? []) take(pool.find(c => c.hero.id === id))
  if ((opts.needTank ?? true) && !chosen.some(c => c.role === 'tank')) take(pool.find(c => c.role === 'tank'))
  const sustains = (c: Candidate): boolean => c.role === 'sustain' || !!(c.profile && (c.profile.heals || c.profile.shields))
  if ((opts.needSustain ?? true) && !chosen.some(sustains)) take(pool.find(c => !chosen.includes(c) && sustains(c)))
  for (const c of pool) take(c)
  chosen.sort((a, b) => b.score - a.score)
  const titans = assignTitans(chosen, box.titans, titanTier)
  const picks: TeamPick[] = chosen.map((c, i) => {
    const reasons: string[] = [], warnings: string[] = []
    if (c.tier) reasons.push(`${c.tier.tier} en la tier list oficial de ${boss.name}${c.tier.score != null ? ` (${c.tier.score.toFixed(2)})` : ''}`)
    else warnings.push(`Sin nota oficial en ${boss.name}`)
    reasons.push(`Cubre ${ROLE_ES[c.role]}`)
    if (c.elementSign > 0) reasons.push(`Ventaja de elemento contra ${t(ELEMENT_LABEL, stage.element)}`)
    if (c.elementSign < 0) warnings.push(`Desventaja de elemento contra ${t(ELEMENT_LABEL, stage.element)}`)
    if (boss.corruptions.length && c.tolCover >= 1) reasons.push('Alcanza la tolerancia de la guía')
    if (boss.corruptions.length && c.tolCover < 1) warnings.push(`Tolerancia al ${Math.round(100 * c.tolCover)} % del objetivo de la guía`)
    if (c.accOk === false) warnings.push(`PREC ${Math.round(c.hero.stats.accuracy ?? 0)} < ${stage.accGoal}: algunos perjuicios no entrarán`)
    if (c.accOk === true) reasons.push(`PREC ${Math.round(c.hero.stats.accuracy ?? 0)} ≥ ${stage.accGoal}`)
    if (c.fit.matched.length) reasons.push(`Aporta: ${c.fit.matched.map(n => n.label.toLowerCase()).join(', ')}`)
    for (const n of c.fit.avoided) warnings.push(`${n.label}: ${n.why}`)
    const alternatives = pool.filter(o => !chosen.includes(o) && o.role === c.role).slice(0, 2)
    return { ...c, reasons, warnings, alternatives, titan: titans[i] }
  })
  const gaps: string[] = []
  if ((opts.needTank ?? true) && !picks.some(p => p.role === 'tank')) gaps.push('No tienes ningún tanque disponible.')
  if ((opts.needSustain ?? true) && !picks.some(p => p.profile?.heals || p.profile?.shields)) gaps.push('Nadie del equipo cura ni da escudos.')
  for (const c of boss.corruptions) {
    const key = toleranceKey(c.key)
    const ok = picks.filter(p => (p.hero.stats[key] ?? 0) * 100 >= stage.tolGoal).length
    if (ok < picks.length) gaps.push(`${picks.length - ok} de ${picks.length} no llegan a ${stage.tolGoal} % de tolerancia a ${TOL_LABEL[c.key] ?? c.key}.`)
  }
  const lowAcc = picks.filter(p => p.accOk === false).length
  if (lowAcc) gaps.push(`${lowAcc} con perjuicios que necesitan PREC ${stage.accGoal} y no la tienen.`)
  const lowRes = picks.filter(p => (p.hero.stats.resistance ?? 0) < stage.resGoal).length
  if (lowRes) gaps.push(`${lowRes} por debajo de RES ${stage.resGoal}: sufrirán los perjuicios del jefe.`)
  const needs = (opts.skills?.needs ?? []).filter(n => !n.avoid).map(need => ({
    need,
    coveredBy: picks.filter(p => p.fit.matched.includes(need)).map(p => p.hero),
    options: pool.filter(c => !chosen.includes(c) && c.fit.matched.includes(need)).slice(0, 3).map(c => c.hero),
  }))
  // Cambios: para cada necesidad sin cubrir, el mejor candidato que la cubre entra por el miembro cuya salida menos
  // cuesta, sin dejar al equipo sin tanque, sin curación (si se exigen) ni sin otra necesidad que solo él cubra.
  const total = chosen.reduce((a, c) => a + c.score, 0)
  const covers = (team: Candidate[], n: Need) => team.some(c => c.fit.matched.includes(n))
  const active = (opts.skills?.needs ?? []).filter(n => !n.avoid && n.id !== 'amplify')
  const swaps: Swap[] = []
  for (const need of active.filter(n => !covers(chosen, n))) {
    let best: Swap | null = null
    for (const cand of pool.filter(c => !chosen.includes(c) && c.fit.matched.includes(need) && !c.fit.avoided.length).slice(0, 6)) {
      for (const out of chosen) {
        if ((opts.include ?? []).includes(out.hero.id)) continue
        const team = [...chosen.filter(c => c !== out), cand]
        if ((opts.needTank ?? true) && !team.some(c => c.role === 'tank') && chosen.some(c => c.role === 'tank')) continue
        if ((opts.needSustain ?? true) && !team.some(sustains) && chosen.some(sustains)) continue
        const loses = active.filter(n => covers(chosen, n) && !covers(team, n))
        if (loses.length) continue
        const gains = active.filter(n => !covers(chosen, n) && covers(team, n))
        const delta = cand.score - out.score
        if (!best || delta > best.delta) best = { need, out, in: cand, gains, loses, delta, pct: total ? delta / total : 0 }
      }
    }
    if (best && !swaps.some(x => x.in === best!.in && x.out === best!.out)) swaps.push(best)
  }
  const bySkill = pool.filter(c => c.fit.matched.length && !c.fit.avoided.length).slice(0, 10)
  const rec = box.teams.find(t => t.mode === 'dungeon' && t.key === boss.slug)
  const recordIds = rec?.levels[0]?.slots.map(s => s.heroId) ?? []
  const pickedCodes = new Set(picks.map(p => p.hero.code))
  const recordCodes = new Set(recordIds.map(id => box.heroes.find(h => h.id === id)?.code).filter(Boolean) as string[])
  return { picks, gaps, pool: pool.length, record: rec ? { heroIds: recordIds, highest: rec.highestLevel } : null, overlap: [...recordCodes].filter(c => pickedCodes.has(c)).length, needs, bySkill, swaps, total }
}
