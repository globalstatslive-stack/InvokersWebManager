/** Objetivo de progreso: un jefe y una fase de las guías oficiales, un equipo y su diagnóstico.
 *
 * Fuente: guías oficiales de jefes de invokers.com (src/catalog/bosses.json, generado con scripts/fetch-bosses.mjs).
 * Cada fase publica PREC, RES y penalización de tolerancia del jefe, y los «objetivos de estadística» de la guía:
 *   · PREC ≥ RES del jefe para que entren todos tus perjuicios
 *   · RES ≥ PREC del jefe + 120 para resistir todos los suyos
 *   · tolerancia ≥ 100 % − penalización de la fase para cada corrupción del jefe
 * Nexo no estima probabilidades de victoria: solo compara tus estadísticas con esos objetivos publicados. */
import type { Box, Hero } from './model'
import { diagnose as gearIssues } from './advisor'
import { landChance, type Profile } from './combat'
import type { BoxIndex } from './stats'
import { optimize, type BuildResult, type OptimizeOptions } from './optimizer'

export type BossStage = { stage: number; label: string; element: string; hp: number; atk: number; def: number; acc: number; res: number; tolerance: number; accGoal: number; resGoal: number; tolGoal: number }
export type BossSkill = { name: string; kind: string; role: string; aoe: boolean; cd: string | null; effects: { label: string; group: string }[]; text: string }
export type Boss = { slug: string; name: string; epithet: string; category: string; guide: string; portrait: string; corruptions: { key: string; kind: string }[]; tierListUrl: string | null; tier: Record<string, { tier: string; score: number | null }>; stages: BossStage[]; skills?: BossSkill[] }
export type BossCatalog = { source: string; fetchedAt: string; bosses: Boss[] }
let cache: Promise<BossCatalog> | undefined
export const loadBosses = () => cache ??= import('../catalog/bosses.json').then(m => m.default as unknown as BossCatalog)

export type Check = { key: string; label: string; value: number; target: number; unit: 'num' | 'pct'; ok: boolean; applies: 'yes' | 'unknown'; why: string }
export type MemberDiagnosis = { hero: Hero; checks: Check[]; tier: { tier: string; score: number | null } | null; gear: string[]; missingKit: boolean }
export const toleranceKey = (corruption: string) => corruption.charAt(0).toLowerCase() + corruption.slice(1) + 'Tolerance'

export function diagnoseMember(box: Box, index: BoxIndex, hero: Hero, profile: Profile | null, boss: Boss, stage: BossStage): MemberDiagnosis {
  const checks: Check[] = []
  const acc = hero.stats.accuracy ?? 0, res = hero.stats.resistance ?? 0
  if (!profile || profile.needsAccuracy) checks.push({
    key: 'accuracy', label: 'Precisión', value: acc, target: stage.accGoal, unit: 'num', ok: acc >= stage.accGoal, applies: profile ? 'yes' : 'unknown',
    why: profile ? `${profile.accuracySkills.length} habilidades necesitan precisión; con ${Math.round(acc)} entra el ${Math.round(100 * landChance(acc, stage.res))} % de sus perjuicios contra RES ${stage.res}.` : 'Sin ficha de habilidades: no se sabe si necesita precisión.',
  })
  checks.push({ key: 'resistance', label: 'Resistencia', value: res, target: stage.resGoal, unit: 'num', ok: res >= stage.resGoal, applies: 'yes', why: `La guía pide RES ${stage.resGoal} para resistir todos los perjuicios del jefe (PREC ${stage.acc}).` })
  for (const c of boss.corruptions) {
    const v = 100 * (hero.stats[toleranceKey(c.key)] ?? 0)
    checks.push({ key: toleranceKey(c.key), label: `Tolerancia a ${c.key}`, value: v, target: stage.tolGoal, unit: 'pct', ok: v >= stage.tolGoal, applies: 'yes', why: `La fase suma ${stage.tolerance > 0 ? '+' : ''}${stage.tolerance} % a tu tolerancia; con ${stage.tolGoal} % mitigas el 100 % de ${c.key}.` })
  }
  return { hero, checks, tier: boss.tier[hero.code] ?? null, gear: gearIssues(box, index, hero).filter(i => i.severity >= 2).map(i => i.text), missingKit: !profile }
}

export type TeamMember = { heroId: number; options: OptimizeOptions }
export type TeamPlan = { mode: 'sequential' | 'joint'; builds: { heroId: number; result: BuildResult }[]; rounds: number; total: number }
const reservedOf = (r: BuildResult, keep: Set<string>) => {
  for (const g of [...Object.values(r.relics), ...Object.values(r.accessories)]) if (g) keep.add(`${g.kind}${g.id}`)
  return keep
}
const score = (r: BuildResult) => r.index !== undefined ? Math.log(r.index / 100) : (r.score - r.scoreBefore) / 100

/** Selección secuencial: cada Invoker, por orden de prioridad, elige entre lo que dejaron los anteriores
 * (como el optimizador oficial). Nunca asigna una pieza a dos Invokers. */
export function sequentialTeam(index: BoxIndex, members: TeamMember[]): TeamPlan {
  const builds: TeamPlan['builds'] = []
  const taken = new Set<string>()
  for (const m of members) {
    const hero = index.heroes.get(m.heroId)!
    // Además de lo ya asignado, se protegen las piezas que llevan los demás miembros del equipo.
    const result = optimize(index, hero, { ...m.options, reserved: new Set([...(m.options.reserved ?? []), ...taken]), protectedHeroes: new Set([...(m.options.protectedHeroes ?? []), ...members.map(x => x.heroId).filter(id => id !== m.heroId)]) })
    builds.push({ heroId: m.heroId, result })
    reservedOf(result, taken)
  }
  return { mode: 'sequential', builds, rounds: 1, total: builds.reduce((s, b) => s + score(b.result), 0) }
}

/** Asignación conjunta por mejora iterativa: parte de la secuencial y vuelve a optimizar a cada miembro con
 * las piezas de los demás reservadas, aceptando el cambio solo si mejora la suma del equipo. Mejora o iguala a la
 * secuencial; no se garantiza el óptimo global. */
export function jointTeam(index: BoxIndex, members: TeamMember[], maxRounds = 3): TeamPlan {
  const start = sequentialTeam(index, members)
  const builds = start.builds.map(b => ({ ...b }))
  const total = () => builds.reduce((s, b) => s + score(b.result), 0)
  let rounds = 0
  for (; rounds < maxRounds; rounds++) {
    let improved = false
    for (const [i, m] of members.entries()) {
      const others = new Set<string>()
      builds.forEach((b, j) => { if (j !== i) reservedOf(b.result, others) })
      const hero = index.heroes.get(m.heroId)!
      const candidate = optimize(index, hero, { ...m.options, reserved: new Set([...(m.options.reserved ?? []), ...others]), protectedHeroes: new Set([...(m.options.protectedHeroes ?? []), ...members.map(x => x.heroId).filter(id => id !== m.heroId)]) })
      if (score(candidate) > score(builds[i].result) + 1e-6) { builds[i] = { heroId: m.heroId, result: candidate }; improved = true }
    }
    if (!improved) break
  }
  return { mode: 'joint', builds, rounds: rounds + 1, total: total() }
}

/** Comprueba que ninguna pieza esté en dos builds del equipo. */
export function conflicts(builds: { heroId: number; result: BuildResult }[]): string[] {
  const seen = new Map<string, number>(), out: string[] = []
  for (const b of builds) for (const g of [...Object.values(b.result.relics), ...Object.values(b.result.accessories)]) {
    if (!g) continue
    const k = `${g.kind}${g.id}`, prev = seen.get(k)
    if (prev !== undefined && prev !== b.heroId) out.push(k)
    seen.set(k, b.heroId)
  }
  return out
}

export type Limit = { stat: string; target: number; max: number }
/** Máximo alcanzable de cada mínimo exigido, optimizando solo esa estadística con las mismas piezas y protecciones.
 * Si el mínimo es inalcanzable, se quita del cálculo (no tiene sentido forzarlo) y se informa. Es una cota superior:
 * no descuenta las piezas que tomen otros miembros del equipo. */
export function relaxUnreachable(index: BoxIndex, members: TeamMember[]): { members: TeamMember[]; limits: Record<number, Limit[]> } {
  const limits: Record<number, Limit[]> = {}
  const out = members.map(m => {
    const mins = Object.entries(m.options.minimums ?? {}).filter(([, v]) => v > 0)
    if (!mins.length) return m
    const hero = index.heroes.get(m.heroId)!
    const kept: Record<string, number> = {}
    for (const [stat, target] of mins) {
      const best = optimize(index, hero, { ...m.options, objective: 'weights', weights: { [stat]: 10 }, minimums: {}, sim: undefined, changeCost: 0, moveAversion: 0, alternatives: 0, requiredSet: null })
      const max = best.after[stat] ?? 0
      if (max + 1e-9 < target) (limits[m.heroId] ??= []).push({ stat, target, max })
      else kept[stat] = target
    }
    return { ...m, options: { ...m.options, minimums: kept } }
  })
  return { members: out, limits }
}
