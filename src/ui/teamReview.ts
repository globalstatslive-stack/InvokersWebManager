/** Revisión completa de tus Invokers más usados, una vez por caja y en segundo plano (worker del optimizador).
 *
 * Sirve para que ninguna parte de Nexo contradiga al optimizador: una pieza que la revisión pondría en uno de tus
 * Invokers no se aconseja vender (el coach de piezas compara pieza a pieza y no ve el valor de un conjunto de varias
 * piezas). Se guarda en este navegador lo mínimo: qué pieza va a quién y cuánto gana ese Invoker. */
import { useEffect, useState } from 'react'
import type { Box } from '../box/model'
import type { BuildResult } from '../box/optimizer'
import type { TeamMember } from '../box/goal'
import { relativeGain, reviewOptions, usedHeroes } from '../box/equipBatch'
import { BoxIndex } from '../box/stats'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { reservedBy, usePlan } from './plan'

export const REVIEW_COUNT = 20
export type PieceUse = { heroId: number; heroName: string; gain: number; changes: number }
export type TeamReview = { key: string; uses: Record<string, PieceUse> }

let current: { key: string; worker: Worker; progress: { done: number; total: number; label: string } | null } | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(f => f())
const storeKey = (recordId: string) => `nexo.review.${recordId}`
const read = (recordId: string): TeamReview | null => { try { const v = localStorage.getItem(storeKey(recordId)); return v ? JSON.parse(v) as TeamReview : null } catch { return null } }
const write = (recordId: string, r: TeamReview) => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('nexo.review.') && k !== storeKey(recordId)) localStorage.removeItem(k) }
    localStorage.setItem(storeKey(recordId), JSON.stringify(r))
  } catch { /* sin almacenamiento */ }
}

/** Qué pieza pondría la revisión completa en cada Invoker (de su resultado). */
export function usesOf(index: BoxIndex, builds: Map<number, BuildResult>): Record<string, PieceUse> {
  const out: Record<string, PieceUse> = {}
  for (const [heroId, b] of builds) {
    const hero = index.heroes.get(heroId), changes = b.changes.filter(c => c.to)
    if (!hero || !changes.length) continue
    const next = [...Object.values(b.relics), ...Object.values(b.accessories)].filter((g): g is NonNullable<typeof g> => !!g)
    const gain = relativeGain(index, hero, index.equipped(hero), next)
    if (gain < 0.01) continue
    for (const c of changes) out[`${c.to!.kind}${c.to!.id}`] = { heroId, heroName: hero.name, gain, changes: changes.length }
  }
  return out
}

function start(box: Box, recordId: string, key: string, members: TeamMember[]) {
  if (current?.key === key) return
  current?.worker.terminate()
  const worker = new Worker(new URL('../box/optimize.worker.ts', import.meta.url), { type: 'module' })
  current = { key, worker, progress: null }
  worker.postMessage({ type: 'box', box })
  worker.onmessage = (e: MessageEvent<{ progress?: { done: number; total: number; label: string }; fills?: [number, BuildResult][]; error?: string }>) => {
    if (current?.worker !== worker) return
    if (e.data.progress) { current.progress = e.data.progress; notify(); return }
    worker.terminate()
    if (e.data.fills) write(recordId, { key, uses: usesOf(new BoxIndex(box), new Map(e.data.fills)) })
    current = null
    notify()
  }
  worker.onerror = () => { worker.terminate(); if (current?.worker === worker) current = null; notify() }
  worker.postMessage({ type: 'fill', id: 1, members })
  notify()
}

/** Resultado de la revisión de tus Invokers más usados para la caja abierta (se lanza si aún no existe). */
export function useTeamReview(enabled = true): { review: TeamReview | null; progress: { done: number; total: number; label: string } | null } {
  const { account } = useAccount()
  const active = useActiveTeams(account?.box)
  const { plan } = usePlan(account?.box)
  const [, force] = useState(0)
  useEffect(() => { const f = () => force(x => x + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const reserved = reservedBy(plan, -1)
  const key = account ? `${account.record.id}|${[...reserved].sort().join(',')}|${[...active.heroes].sort().join(',')}` : ''
  const saved = account ? read(account.record.id) : null
  const fresh = saved?.key === key ? saved : null
  useEffect(() => {
    if (!enabled || !account || fresh || current?.key === key) return
    const important = new Set([...active.heroes, ...plan.map(e => e.heroId)])
    const { used } = usedHeroes(account.box, important), teams = usedHeroes(account.box, new Set()).used
    const pool = [...used, ...teams.filter(u => !used.some(x => x.hero.id === u.hero.id))]
    const protect = new Set([...pool.map(u => u.hero.id), ...important])
    const members = pool.filter(u => !plan.some(e => e.heroId === u.hero.id)).slice(0, REVIEW_COUNT).map(u => ({ heroId: u.hero.id, options: reviewOptions(u.hero, reserved, protect, 'balanced') }))
    if (members.length) start(account.box, account.record.id, key, members)
  }, [enabled, key, !!fresh]) // eslint-disable-line react-hooks/exhaustive-deps
  return { review: fresh, progress: current?.key === key ? current.progress ?? { done: 0, total: REVIEW_COUNT, label: '' } : null }
}
