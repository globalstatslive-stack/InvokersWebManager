/** Coach de piezas para la cuenta abierta: se calcula una vez por caja, plan y equipos activos, después de pintar. */
import { useEffect, useMemo, useState } from 'react'
import type { Hero } from '../box/model'
import { adviseAll, coachContext, type CoachContext, type GearAdvice, type Verdict } from '../box/gearCoach'
import { useAccount, type Account } from './account'
import { usePlan, type PlanEntry } from './plan'
import { useActiveTeams } from './activeTeams'

export type GearCoach = { ctx: CoachContext; advice: GearAdvice[]; byKey: Map<string, GearAdvice>; counts: Record<Verdict, number> }
const cache = new Map<string, GearCoach>()

/** Candidatos: equipos activos, plan y los 25 más fuertes. Foco (subidas): equipos activos y plan. */
export function coachFor(account: Account, plan: PlanEntry[], active: Set<number>): GearCoach {
  const sig = `${account.record.id}|${[...active].sort().join(',')}|${plan.map(e => `${e.heroId}:${JSON.stringify(e.target ?? e)}`).join(';')}`
  const hit = cache.get(sig)
  if (hit) return hit
  const { box, index } = account
  const planned = new Set(plan.map(e => e.heroId))
  const important = new Set([...active, ...planned])
  const top = [...box.heroes].filter(h => h.basis).sort((a, b) => b.power - a.power).slice(0, 25)
  const candidates = [...new Map([...box.heroes.filter(h => important.has(h.id) && h.basis), ...top].map(h => [h.id, h] as [number, Hero])).values()]
  const reserved = new Map<string, string>()
  for (const e of plan) {
    for (const id of Object.values(e.target?.relics ?? e.relics)) if (id !== null) reserved.set(`relic${id}`, e.name)
    for (const id of Object.values(e.target?.accessories ?? e.accessories)) if (id !== null) reserved.set(`accessory${id}`, e.name)
  }
  const ctx = coachContext(index, { candidates, important, reserved })
  const advice = adviseAll(ctx)
  const counts = { upgrade: 0, replace: 0, test: 0, equip: 0, keep: 0, sell: 0, done: 0 } as Record<Verdict, number>
  for (const a of advice) counts[a.verdict]++
  const out = { ctx, advice, byKey: new Map(advice.map(a => [`${a.gear.kind}${a.gear.id}`, a])), counts }
  if (cache.size > 6) cache.clear()
  cache.set(sig, out)
  return out
}

/** El cálculo tarda unos cientos de milisegundos con cajas grandes: se hace tras el primer pintado. */
export function useGearCoach(): GearCoach | null {
  const { account } = useAccount()
  const { plan } = usePlan(account?.box)
  const active = useActiveTeams(account?.box)
  const key = useMemo(() => account ? `${account.record.id}|${[...active.heroes].sort().join(',')}|${JSON.stringify(plan)}` : '', [account, active.heroes, plan])
  const [state, setState] = useState<{ key: string; coach: GearCoach } | null>(null)
  useEffect(() => {
    if (!account) return
    const id = setTimeout(() => setState({ key, coach: coachFor(account, plan, active.heroes) }), 0)
    return () => clearTimeout(id)
  }, [key, account, plan, active.heroes])
  return state && state.key === key ? state.coach : null
}
