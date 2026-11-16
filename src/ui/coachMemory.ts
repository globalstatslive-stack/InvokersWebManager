/** Memoria del Coach en este navegador: qué recomendó, si lo has aplicado y qué ha pasado después; y las lecturas de
 * Account Stats que envía el marcador. Nada sale del navegador. */
import { useMemo } from 'react'
import { isApplied, type CheckSpec, type CoachAction, type Objective } from '../box/coachEngine'
import { recordAt } from '../box/progress'
import { parseAccountStats, type AccountStats } from '../box/accountStats'
import type { Box } from '../box/model'

const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback } catch { return fallback } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

// ───────── Account Stats ─────────
const statsKey = (name: string) => `nexo.accountStats.${name}`
/** Guarda la lectura que llega con la caja (marcador o extensión). Se conservan las 12 últimas. */
export function saveAccountStats(boxJson: string, statsJson: string): AccountStats | null {
  try {
    const name = String(JSON.parse(boxJson)?.profile?.name ?? '')
    const parsed = parseAccountStats(JSON.parse(statsJson))
    if (!name || !parsed) return null
    // Si el portal dice otro nombre de perfil, no se mezcla.
    if (parsed.profileName && parsed.profileName !== name) return null
    const list = read<AccountStats[]>(statsKey(name), [])
    write(statsKey(name), [...list, parsed].slice(-12))
    return parsed
  } catch { return null }
}
export const accountStatsOf = (name: string) => read<AccountStats[]>(statsKey(name), [])

// ───────── Recomendaciones recordadas ─────────
export type Remembered = {
  id: string; title: string; kind: string; effect: string; impact: number | null
  objectiveId: string; objectiveLabel: string
  issuedAt: string; snapshot: string
  check: CheckSpec
  /** Récord de la fase del objetivo cuando se recomendó. */
  baseline: { mode: string; key: string; level: number; difficulty?: string; victories: number; defeats: number; bestTime: number; highest: number } | null
}
export type Reviewed = Remembered & { applied: boolean | null; outcome: { victories: number; defeats: number; bestTime: { from: number; to: number } | null; highest: { from: number; to: number } | null } | null }
const memKey = (name: string) => `nexo.coach.memory.${name}`

/** Recuerda las primeras recomendaciones de esta caja (una vez por recomendación). */
export function remember(name: string, snapshot: string, objective: Objective, actions: CoachAction[], box: Box, n = 4) {
  const list = read<Remembered[]>(memKey(name), [])
  const known = new Set(list.map(x => x.id))
  const c = objective.choice
  const baseline = c.kind === 'record' ? (() => { const r = recordAt(box, c.mode, c.key, c.level, c.difficulty); return r ? { mode: c.mode, key: c.key, level: c.level, difficulty: c.difficulty, ...r } : null })() : null
  const fresh = actions.slice(0, n).filter(a => !known.has(a.id)).map(a => ({
    id: a.id, title: a.title, kind: a.kind, effect: a.effect, impact: a.impact, objectiveId: objective.id, objectiveLabel: objective.label,
    issuedAt: new Date().toISOString(), snapshot, check: a.check, baseline,
  }))
  if (fresh.length) write(memKey(name), [...list, ...fresh].slice(-40))
}

/** Revisa las recomendaciones de cajas anteriores con la caja actual. */
export function review(name: string, snapshot: string, box: Box): Reviewed[] {
  return read<Remembered[]>(memKey(name), []).filter(r => r.snapshot !== snapshot).map(r => {
    const applied = isApplied(r.check, box)
    let outcome: Reviewed['outcome'] = null
    if (r.baseline) {
      const now = recordAt(box, r.baseline.mode, r.baseline.key, r.baseline.level, r.baseline.difficulty)
      if (now) outcome = {
        victories: Math.max(0, now.victories - r.baseline.victories), defeats: Math.max(0, now.defeats - r.baseline.defeats),
        bestTime: now.bestTime > 0 && (r.baseline.bestTime === 0 || now.bestTime < r.baseline.bestTime) ? { from: r.baseline.bestTime, to: now.bestTime } : null,
        highest: now.highest > r.baseline.highest ? { from: r.baseline.highest, to: now.highest } : null,
      }
    }
    return { ...r, applied, outcome }
  }).reverse()
}
export const forget = (name: string, id: string) => write(memKey(name), read<Remembered[]>(memKey(name), []).filter(x => x.id !== id))

export function useReview(name: string | undefined, snapshot: string | undefined, box: Box | undefined, version = 0) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => name && snapshot && box ? review(name, snapshot, box) : [], [name, snapshot, box, version])
}
