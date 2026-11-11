import { useCallback, useEffect, useRef, useState } from 'react'
import type { Box } from '../box/model'
import type { BuildResult, OptimizeOptions } from '../box/optimizer'
import type { TeamMember } from '../box/goal'
import type { TeamResult, TeamVariant } from '../box/optimize.worker'

export type OptimizerState<T> =
  | { status: 'idle' } | { status: 'running'; progress?: { done: number; total: number; label: string } }
  | { status: 'done'; result: T; ms: number } | { status: 'error'; message: string } | { status: 'cancelled' }
type Reply = { id: number; result?: BuildResult; team?: TeamResult[]; error?: string; ms?: number; progress?: { done: number; total: number; label: string } }

/** Worker del optimizador. Cada petición nueva o «Cancelar» termina el cálculo en curso (se recrea el worker),
 * así que la interfaz nunca se bloquea ni muestra un resultado obsoleto. */
function useWorker<T>(box: Box, pick: (r: Reply) => T | undefined) {
  const worker = useRef<Worker | null>(null)
  const seq = useRef(0)
  const busy = useRef(false)
  const [state, setState] = useState<OptimizerState<T>>({ status: 'idle' })
  const spawn = useCallback(() => {
    worker.current?.terminate()
    const w = new Worker(new URL('../box/optimize.worker.ts', import.meta.url), { type: 'module' })
    w.postMessage({ type: 'box', box })
    w.onmessage = (e: MessageEvent<Reply>) => {
      if (e.data.id !== seq.current) return
      if (e.data.progress) { setState({ status: 'running', progress: e.data.progress }); return }
      busy.current = false
      if (e.data.error) setState({ status: 'error', message: e.data.error })
      else setState({ status: 'done', result: pick(e.data)!, ms: e.data.ms ?? 0 })
    }
    w.onerror = ev => { busy.current = false; setState({ status: 'error', message: ev.message || 'Error en el cálculo' }) }
    worker.current = w
    return w
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box])
  useEffect(() => { spawn(); return () => { worker.current?.terminate(); worker.current = null } }, [spawn])
  const post = useCallback((msg: Record<string, unknown>) => {
    const id = ++seq.current
    const w = busy.current ? spawn() : worker.current ?? spawn()
    busy.current = true
    setState({ status: 'running' })
    w.postMessage({ ...msg, id })
  }, [spawn])
  const cancel = useCallback(() => { seq.current++; busy.current = false; spawn(); setState({ status: 'cancelled' }) }, [spawn])
  return { state, post, cancel }
}

/** Optimización de un Invoker; se recalcula al cambiar las opciones. */
export function useOptimizer(box: Box, heroId: number, opts: OptimizeOptions | null) {
  const { state, post, cancel } = useWorker<BuildResult>(box, r => r.result)
  const [last, setLast] = useState<BuildResult | null>(null)
  useEffect(() => { if (state.status === 'done') setLast(state.result) }, [state])
  useEffect(() => { setLast(null) }, [heroId])
  useEffect(() => { if (opts) post({ type: 'run', heroId, opts }) }, [opts, heroId, post])
  return { state, last, cancel }
}
/** Optimización de un equipo bajo un objetivo, bajo demanda. */
export function useTeamOptimizer(box: Box) {
  const { state, post, cancel } = useWorker<TeamResult[]>(box, r => r.team)
  const run = useCallback((members: TeamMember[], variants: TeamVariant[]) => post({ type: 'team', members, variants }), [post])
  return { state, run, cancel }
}
