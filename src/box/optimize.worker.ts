/// <reference lib="webworker" />
/** Cálculo del optimizador fuera del hilo de la interfaz. La caja se envía una vez; cada petición lleva un id y
 * la interfaz descarta las respuestas que ya no corresponden a la última petición. */
import type { Box } from './model'
import { BoxIndex } from './stats'
import { optimize, type OptimizeOptions } from './optimizer'
import { conflicts, jointTeam, relaxUnreachable, sequentialTeam, type Limit, type TeamMember, type TeamPlan } from './goal'

let index: BoxIndex | null = null
export type TeamVariant = { id: string; label: string; changeCost: number; joint: boolean }
export type WorkerRequest =
  | { type: 'box'; box: Box }
  | { type: 'run'; id: number; heroId: number; opts: OptimizeOptions }
  | { type: 'team'; id: number; members: TeamMember[]; variants: TeamVariant[] }
  /** Equipar en lote: rellena los huecos de cada Invoker por orden, sin repetir piezas. */
  | { type: 'fill'; id: number; members: TeamMember[] }
export type TeamResult = { variant: TeamVariant; plan: TeamPlan; sequential: TeamPlan; conflicts: string[]; limits: Record<number, Limit[]> }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'box') { index = new BoxIndex(msg.box); return }
  const t0 = performance.now()
  try {
    if (!index) throw Error('Caja no cargada')
    if (msg.type === 'run') {
      const hero = index.heroes.get(msg.heroId)
      if (!hero) throw Error('Invoker no encontrado')
      self.postMessage({ id: msg.id, result: optimize(index, hero, msg.opts), ms: performance.now() - t0 })
      return
    }
    if (msg.type === 'fill') {
      const taken = new Set<string>()
      const fills: [number, ReturnType<typeof optimize>][] = []
      for (const [i, m] of msg.members.entries()) {
        const hero = index.heroes.get(m.heroId)
        if (!hero) continue
        self.postMessage({ id: msg.id, progress: { done: i, total: msg.members.length, label: hero.name } })
        const r = optimize(index, hero, { ...m.options, reserved: new Set([...(m.options.reserved ?? []), ...taken]) })
        for (const c of r.changes) if (c.to) taken.add(`${c.to.kind}${c.to.id}`)
        fills.push([m.heroId, r])
      }
      self.postMessage({ id: msg.id, fills, ms: performance.now() - t0 })
      return
    }
    const out: TeamResult[] = []
    self.postMessage({ id: msg.id, progress: { done: 0, total: msg.variants.length + 1, label: 'Comprobando qué mínimos se pueden alcanzar' } })
    const { members: relaxed, limits } = relaxUnreachable(index, msg.members)
    for (const [i, v] of msg.variants.entries()) {
      self.postMessage({ id: msg.id, progress: { done: i + 1, total: msg.variants.length + 1, label: v.label } })
      const members = relaxed.map(m => ({ ...m, options: { ...m.options, changeCost: v.changeCost } }))
      const sequential = sequentialTeam(index, members)
      const plan = v.joint ? jointTeam(index, members) : sequential
      out.push({ variant: v, plan, sequential, conflicts: conflicts(plan.builds), limits })
    }
    self.postMessage({ id: msg.id, team: out, ms: performance.now() - t0 })
  } catch (err) {
    self.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) })
  }
}
