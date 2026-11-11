/** Plan de cambios para varios Invokers: se guarda en este navegador y se envía al portal como preset. */
import { useCallback, useEffect, useState } from 'react'
import type { Box, Hero } from '../box/model'
import type { BuildResult } from '../box/optimizer'
import { ACCESSORY_SLOTS, RELIC_SLOTS } from '../box/i18n'

export type PlanEntry = {
  heroId: number; name: string; portrait: string; rarity: string
  /** Ranuras que cambian: id de la pieza o null para dejarla vacía. */
  relics: Record<string, number | null>; accessories: Record<string, number | null>
  changes: number; gold: number; damageGain: number; at: string
}
const keyFor = (box: Box) => `nexo.plan.${box.profile.name}`
const read = (k: string): PlanEntry[] => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }

export function entryFrom(hero: Hero, r: BuildResult): PlanEntry {
  const relics: Record<string, number | null> = {}, accessories: Record<string, number | null> = {}
  for (const c of r.changes) (RELIC_SLOTS.includes(c.slot) ? relics : accessories)[c.slot] = c.to?.id ?? null
  return { heroId: hero.id, name: hero.name, portrait: hero.portrait, rarity: hero.rarity, relics, accessories, changes: r.changes.length, gold: r.goldCost, damageGain: r.damageBefore ? r.damageAfter / r.damageBefore - 1 : 0, at: new Date().toISOString() }
}
/** Piezas que el plan asigna a Invokers distintos de `except`. */
export function reservedBy(plan: PlanEntry[], except: number): Set<string> {
  const out = new Set<string>()
  for (const e of plan) if (e.heroId !== except) {
    for (const id of Object.values(e.relics)) if (id !== null) out.add(`relic${id}`)
    for (const id of Object.values(e.accessories)) if (id !== null) out.add(`accessory${id}`)
  }
  return out
}
/** Formato de preset del portal oficial: { name, category, loadouts: [{ heroId, relics, accessories }] }. */
export function presetPayload(plan: PlanEntry[], name: string) {
  return { v: 1, name: name.slice(0, 60), category: 'Nexo', loadouts: plan.map(e => ({ heroId: e.heroId, relics: pick(e.relics, RELIC_SLOTS), accessories: pick(e.accessories, ACCESSORY_SLOTS) })) }
}
const pick = (m: Record<string, number | null>, slots: string[]) => Object.fromEntries(Object.entries(m).filter(([s]) => slots.includes(s)))
const b64url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** Optimizador oficial: acepta `?heroes=1,2&from=` para abrirse con esos Invokers cargados.
 * El fragmento `#nexo-plan=` lo lee el marcador de Nexo para guardar el preset con la sesión del jugador. */
export const PORTAL_OPTIMIZER = 'https://invokers.com/hub/optimizer/'
export function portalUrl(plan: PlanEntry[], name: string): string {
  const heroes = plan.map(e => e.heroId).slice(0, 5).join(',')
  return `${PORTAL_OPTIMIZER}?heroes=${heroes}&from=Nexo#nexo-plan=${b64url(JSON.stringify(presetPayload(plan, name)))}`
}

export function usePlan(box: Box | undefined) {
  const key = box ? keyFor(box) : ''
  const [plan, setPlan] = useState<PlanEntry[]>(() => key ? read(key) : [])
  useEffect(() => { setPlan(key ? read(key) : []) }, [key])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === key) setPlan(read(key)) }
    addEventListener('storage', onStorage); return () => removeEventListener('storage', onStorage)
  }, [key])
  const save = useCallback((next: PlanEntry[]) => { setPlan(next); try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* sin almacenamiento */ } }, [key])
  return {
    plan,
    upsert: (e: PlanEntry) => save([...plan.filter(x => x.heroId !== e.heroId), e]),
    remove: (heroId: number) => save(plan.filter(x => x.heroId !== heroId)),
    clear: () => save([]),
  }
}
