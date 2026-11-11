/** Equipos que el jugador sigue usando y quiere proteger. Los récords del juego son históricos: por defecto
 * ninguno se considera activo hasta que el jugador lo marca. Se guarda en este navegador. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Box, TeamRecord } from '../box/model'

export const teamKey = (t: TeamRecord) => `${t.mode}:${t.key}:${t.difficulty}`
const storageKey = (box: Box) => `nexo.activeTeams.${box.profile.name}`
const read = (k: string): string[] => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }

export function useActiveTeams(box: Box | undefined) {
  const key = box ? storageKey(box) : ''
  const [keys, setKeys] = useState<string[]>(() => key ? read(key) : [])
  useEffect(() => { setKeys(key ? read(key) : []) }, [key])
  const save = useCallback((next: string[]) => { setKeys(next); try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* sin almacenamiento */ } }, [key])
  const teams = useMemo(() => (box?.teams ?? []).filter(t => keys.includes(teamKey(t))), [box, keys])
  /** Invokers de los equipos activos (del registro de mejor tiempo de su nivel más alto). */
  const heroes = useMemo(() => {
    const s = new Set<number>()
    for (const t of teams) for (const s2 of t.levels[0]?.slots ?? []) s.add(s2.heroId)
    return s
  }, [teams])
  return { keys, teams, heroes, isActive: (t: TeamRecord) => keys.includes(teamKey(t)), toggle: (t: TeamRecord) => save(keys.includes(teamKey(t)) ? keys.filter(k => k !== teamKey(t)) : [...keys, teamKey(t)]), clear: () => save([]) }
}
