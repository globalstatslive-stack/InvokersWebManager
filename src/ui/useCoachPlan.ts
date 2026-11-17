/** Datos y cálculo del Coach personalizado para la cuenta abierta. Se recalcula solo al cambiar la caja, el objetivo,
 * el plan, los equipos activos o los trofeos; el cálculo se hace tras pintar para no bloquear la pantalla. */
import { useEffect, useMemo, useState } from 'react'
import { objectiveOptions, planFor, resolveObjective, type Catalogs, type CoachPlan, type EngineInput, type ObjectiveOption } from '../box/coachEngine'
import { loadKits, profileOf, skillLevels, type Kit } from '../box/combat'
import { loadBosses } from '../box/goal'
import { REVIEW_EFFORT, reviewOptions, usedHeroes } from '../box/equipBatch'
import { hallRanking } from '../box/trophyHall'
import { projectStats } from '../box/stats'
import type { Hero } from '../box/model'
import type { CoachAction } from '../box/coachEngine'
import { loadDetail, loadIndex, loadSpires, useLoad } from '../wiki/data'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { usePlan, TRACKED_STATS, type PlanEntry } from './plan'
import { useAscend } from './AscendCoach'
import { useHallCosts, useTrophyWallet } from './trophyWallet'
import { remember } from './coachMemory'
import { useFillOptimizer } from './useOptimizer'
import type { OptimizeOptions } from '../box/optimizer'

const objKey = (name: string) => `nexo.coach.objective.${name}`
const readObj = (name: string) => { try { return localStorage.getItem(objKey(name)) ?? 'general' } catch { return 'general' } }

export type CoachState = {
  options: ObjectiveOption[]; objectiveId: string; setObjective: (id: string) => void
  plan: CoachPlan | null; computing: boolean
  /** Revisión completa del equipo (optimizador con conjuntos) en curso. */
  reviewing: { done: number; total: number; label: string } | null
}

export function useCoachPlan(): CoachState {
  const { account, records } = useAccount()
  const box = account?.box
  const name = box?.profile.name ?? ''
  const active = useActiveTeams(box)
  const { plan: planEntries } = usePlan(box)
  const bosses = useLoad(loadBosses), spires = useLoad(loadSpires), kits = useLoad(loadKits), wiki = useLoad(loadIndex)
  const ascend = useAscend()
  const { wallet } = useTrophyWallet(name, records)
  const { costs } = useHallCosts()
  const [objectiveId, setId] = useState(() => readObj(name))
  useEffect(() => { setId(readObj(name)) }, [name])
  const setObjective = (id: string) => { setId(id); try { localStorage.setItem(objKey(name), id) } catch { /* sin almacenamiento */ } }

  const cat: Catalogs = useMemo(() => ({ bosses: bosses.data?.bosses, spires: spires.data?.spires }), [bosses.data, spires.data])
  const important = useMemo(() => new Set([...active.heroes, ...planEntries.map(e => e.heroId)]), [active.heroes, planEntries])
  // Para el Coach, tus equipos registrados cuentan siempre; los de equipos activos y plan, además, pesan el triple.
  // (Así añadir una recomendación al plan no reduce «Toda la cuenta» a los Invokers del plan.)
  const used = useMemo(() => {
    if (!box) return []
    const marked = usedHeroes(box, important).used, teams = usedHeroes(box, new Set()).used
    const seen = new Set(marked.map(u => u.hero.id))
    return [...marked, ...teams.filter(u => !seen.has(u.hero.id))]
  }, [box, important])
  const options = useMemo(() => box ? objectiveOptions(box, cat) : [], [box, cat])
  const choice = options.find(o => o.id === objectiveId)?.choice ?? { kind: 'general' as const }
  const objective = useMemo(() => box ? resolveObjective(box, choice, used, cat) : null, [box, JSON.stringify(choice), used, cat]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fichas oficiales (texto por nivel de habilidad y tolerancias) de los Invokers del objetivo.
  const [texts, setTexts] = useState<EngineInput['skillText']>(new Map())
  const codes = objective?.team.map(h => h.code).join(',') ?? ''
  useEffect(() => {
    if (!wiki.data || !objective) return
    let live = true
    const slugs = new Map(wiki.data.invokers.map(s => [s.code, s.slug]))
    Promise.all(objective.team.map(async h => { const slug = slugs.get(h.code); const d = slug ? await loadDetail('invokers', slug).catch(() => null) : null; return [h.code, d] as const }))
      .then(list => { if (live) setTexts(new Map(list.filter(([, d]) => d).map(([c, d]) => [c, { skills: d!.skills, tolerances: d!.tolerances }]))) })
    return () => { live = false }
  }, [wiki.data, codes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revisión completa del equipo de los Invokers del objetivo en el worker del optimizador (con conjuntos); contra un
  // jefe o piso, con el índice del simulador como en Objetivo. Nunca toca a los que usas, equipos activos ni plan.
  const review = useFillOptimizer(box)
  const reserved = useMemo(() => {
    const r = new Set<string>()
    for (const e of planEntries) {
      for (const g of Object.values(e.target?.relics ?? e.relics)) if (g !== null) r.add(`relic${g}`)
      for (const g of Object.values(e.target?.accessories ?? e.accessories)) if (g !== null) r.add(`accessory${g}`)
    }
    return r
  }, [planEntries])
  const reviewKey = `${account?.record.id}|${objective?.id}|${[...reserved].sort().join(',')}|${[...important].sort().join(',')}|${!!kits.data}`
  const [ranKey, setRanKey] = useState('')
  useEffect(() => {
    if (!account || !objective) return
    const protect = new Set([...used.map(u => u.hero.id), ...important, ...objective.team.map(h => h.id)])
    const members = objective.team.filter(h => h.basis && h.gearBonus).slice(0, 12).map(h => {
      const kit = (kits.data as Record<string, Kit> | undefined)?.[h.code]
      if (objective.stage && kit) {
        const levels = skillLevels(h), mix = profileOf(h, kit, levels).mix
        const options: OptimizeOptions = { objective: 'sim', weights: { damage: 10 }, sim: { kit, levels, settings: { duration: 180, targetRes: objective.stage.res }, mix }, pool: 'all',
          protectedHeroes: new Set([...protect].filter(id => id !== h.id)), reserved, changeCost: REVIEW_EFFORT.balanced, moveAversion: 0.35 }
        return { heroId: h.id, options }
      }
      return { heroId: h.id, options: reviewOptions(h, reserved, protect, 'balanced') }
    })
    if (!members.length) return
    setRanKey(reviewKey)
    review.run(members)
  }, [reviewKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const builds = review.state.status === 'done' && ranKey === reviewKey ? review.state.result : null

  const [state, setState] = useState<{ key: string; plan: CoachPlan } | null>(null)
  const key = `${account?.record.id}|${objective?.id}|${builds ? `b${ranKey}` : 'nb'}|${planEntries.length}|${[...important].sort().join(',')}|${wallet?.bronze},${wallet?.silver},${wallet?.gold}|${JSON.stringify(costs)}|${texts?.size}|${!!kits.data}|${!!ascend}`
  useEffect(() => {
    if (!account || !objective) return
    const id = setTimeout(() => {
      const reserved = new Set<string>()
      for (const e of planEntries) {
        for (const g of Object.values(e.target?.relics ?? e.relics)) if (g !== null) reserved.add(`relic${g}`)
        for (const g of Object.values(e.target?.accessories ?? e.accessories)) if (g !== null) reserved.add(`accessory${g}`)
      }
      const asc = ascend ? [...ascend.six, ...ascend.five].map(c => ({
        hero: c.hero, to: c.to, score: c.score, units: c.cost,
        have: (c.from === 5 ? ascend.craft5.units : ascend.craft4.units) >= c.cost, why: c.reasons[0] ?? 'Ranking de Personajes.',
      })) : null
      const plan = planFor({
        index: account.index, objective, used: new Set(used.map(u => u.hero.id)),
        protect: new Set([...important, ...objective.team.map(h => h.id)]), reserved,
        kits: kits.data as Record<string, Kit> | undefined, skillText: texts,
        hall: { options: hallRanking(account.box, used).options, wallet: wallet ? { bronze: wallet.bronze, silver: wallet.silver, gold: wallet.gold } : null, costs }, ascend: asc, builds,
      })
      setState({ key, plan })
      // Recuerda las primeras recomendaciones de esta caja para comprobarlas en la siguiente.
      if (kits.data) remember(account.box.profile.name, account.record.id, objective, plan.actions, account.box)
    }, 0)
    return () => clearTimeout(id)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const reviewing = review.state.status === 'running' ? review.state.progress ?? { done: 0, total: objective?.team.length ?? 0, label: '' } : null
  return { options, objectiveId: options.some(o => o.id === objectiveId) ? objectiveId : 'general', setObjective, plan: state?.plan ?? null, computing: !state || state.key !== key, reviewing }
}

/** Entrada del Plan para un cambio de piezas del Coach (se suma a lo que ya tuviera ese Invoker en el plan). */
export function entryFromAction(index: { equipped: (h: Hero) => import('../box/model').Gear[]; rules: Parameters<typeof projectStats>[2]; relic: (id: number) => import('../box/model').Gear | undefined; accessory: (id: number) => import('../box/model').Gear | undefined }, hero: Hero, a: CoachAction, existing?: PlanEntry, goal?: string): PlanEntry | null {
  if (!a.plan?.length) return null
  const relics: Record<string, number | null> = { ...(existing?.relics ?? {}) }, accessories: Record<string, number | null> = { ...(existing?.accessories ?? {}) }
  for (const c of a.plan) (c.kind === 'relic' ? relics : accessories)[c.slot] = c.gearId
  const target = { relics: { ...hero.relics, ...(existing?.target?.relics ?? {}), ...relics }, accessories: { ...hero.accessories, ...(existing?.target?.accessories ?? {}), ...accessories } }
  const pieces = [...Object.values(target.relics).map(id => id === null ? undefined : index.relic(id)), ...Object.values(target.accessories).map(id => id === null ? undefined : index.accessory(id))].filter((g): g is import('../box/model').Gear => !!g)
  const after = projectStats(hero, pieces, index.rules)
  const keep = (st: Record<string, number>) => Object.fromEntries(TRACKED_STATS.map(k => [k, st[k] ?? 0]))
  return {
    heroId: hero.id, name: hero.name, portrait: hero.portrait, rarity: hero.rarity, relics, accessories,
    changes: Object.keys(relics).length + Object.keys(accessories).length, gold: (existing?.gold ?? 0) + (a.cost.gold ?? 0),
    damageGain: a.perHero[0]?.gain ?? 0, at: new Date().toISOString(), target, goal: goal ?? existing?.goal, before: keep(hero.stats), estimated: keep(after),
  }
}
