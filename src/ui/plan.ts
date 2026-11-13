/** Plan de cambios para varios Invokers: se guarda en este navegador y se envía al portal como preset. */
import { useCallback, useEffect, useState } from 'react'
import type { Box, Gear, Hero } from '../box/model'
import type { BoxIndex } from '../box/stats'
import type { BuildResult } from '../box/optimizer'
import { ACCESSORY_SLOTS, fmtInt, RELIC_SLOTS, SLOT_LABEL, t } from '../box/i18n'

export type PlanEntry = {
  heroId: number; name: string; portrait: string; rarity: string
  /** Ranuras que cambian: id de la pieza o null para dejarla vacía. */
  relics: Record<string, number | null>; accessories: Record<string, number | null>
  changes: number; gold: number; damageGain: number; at: string
  /** Build completa prevista (todas las ranuras): reserva también las piezas que se quedan. */
  target?: { relics: Record<string, number | null>; accessories: Record<string, number | null> }
  /** Objetivo con el que se creó (p. ej. «Ulgorim · fase 16»). */
  goal?: string
  /** Estadísticas antes y estimadas después, para compararlas con las observadas al reimportar. */
  before?: Record<string, number>; estimated?: Record<string, number>
}
export const TRACKED_STATS = ['attack', 'health', 'defense', 'criticalRate', 'criticalDamage', 'accuracy', 'resistance', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration']
const keyFor = (box: Box) => `nexo.plan.${box.profile.name}`
const read = (k: string): PlanEntry[] => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }

export function entryFrom(hero: Hero, r: BuildResult, goal?: string): PlanEntry {
  const relics: Record<string, number | null> = {}, accessories: Record<string, number | null> = {}
  for (const c of r.changes) (RELIC_SLOTS.includes(c.slot) ? relics : accessories)[c.slot] = c.to?.id ?? null
  const pick = (m: Record<string, { id: number } | null>) => Object.fromEntries(Object.entries(m).map(([k, g]) => [k, g?.id ?? null]))
  const keep = (st: Record<string, number>) => Object.fromEntries(TRACKED_STATS.map(k => [k, st[k] ?? 0]))
  return { goal, target: { relics: pick(r.relics), accessories: pick(r.accessories) }, before: keep(r.before), estimated: keep(r.after), heroId: hero.id, name: hero.name, portrait: hero.portrait, rarity: hero.rarity, relics, accessories, changes: r.changes.length, gold: r.goldCost, damageGain: r.damageBefore ? r.damageAfter / r.damageBefore - 1 : 0, at: new Date().toISOString() }
}
/** Piezas que el plan asigna a Invokers distintos de `except`. */
export function reservedBy(plan: PlanEntry[], except: number): Set<string> {
  const out = new Set<string>()
  for (const e of plan) if (e.heroId !== except) {
    for (const id of Object.values(e.target?.relics ?? e.relics)) if (id !== null) out.add(`relic${id}`)
    for (const id of Object.values(e.target?.accessories ?? e.accessories)) if (id !== null) out.add(`accessory${id}`)
  }
  return out
}
/** Piezas de `entry` que el plan ya reserva para otro Invoker (no puede haber dos dueños). */
export function planConflicts(plan: PlanEntry[], entry: PlanEntry): string[] {
  const taken = reservedBy(plan, entry.heroId)
  return [...Object.values(entry.target?.relics ?? entry.relics).filter((id): id is number => id !== null).map(id => `relic${id}`),
    ...Object.values(entry.target?.accessories ?? entry.accessories).filter((id): id is number => id !== null).map(id => `accessory${id}`)].filter(k => taken.has(k))
}
export type Progress = { applied: string[]; pending: string[]; done: boolean; observed: Record<string, number> | null }
/** Comprueba, con la caja importada ahora, qué cambios del plan ya están hechos en el juego. */
export function progressOf(entry: PlanEntry, hero: Hero | undefined): Progress {
  const applied: string[] = [], pending: string[] = []
  for (const [slot, id] of Object.entries(entry.relics)) ((hero?.relics[slot] ?? null) === id ? applied : pending).push(slot)
  for (const [slot, id] of Object.entries(entry.accessories)) ((hero?.accessories[slot] ?? null) === id ? applied : pending).push(slot)
  const done = !!hero && pending.length === 0
  return { applied, pending, done, observed: done && hero.gearBonus ? Object.fromEntries(TRACKED_STATS.map(k => [k, hero.stats[k] ?? 0])) : null }
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
/** El optimizador oficial trabaja con 5 Invokers a la vez. */
export const PORTAL_TEAM = 5

/** Tandas de 5 con las entradas pendientes, en el orden del plan (prioridad). Como el plan nunca asigna una pieza a
 * dos Invokers (`planConflicts`), las tandas no comparten piezas y el resultado final no depende del orden. */
export function tandasOf(pending: PlanEntry[], size = PORTAL_TEAM): PlanEntry[][] {
  const out: PlanEntry[][] = []
  for (let i = 0; i < pending.length; i += size) out.push(pending.slice(i, i + size))
  return out
}
/** Piezas de la entrada (destino completo y cambios). */
const entryPieces = (e: PlanEntry): { kind: 'relic' | 'accessory'; slot: string; id: number }[] => [
  ...Object.entries(e.target?.relics ?? e.relics).filter(([, id]) => id !== null).map(([slot, id]) => ({ kind: 'relic' as const, slot, id: id! })),
  ...Object.entries(e.target?.accessories ?? e.accessories).filter(([, id]) => id !== null).map(([slot, id]) => ({ kind: 'accessory' as const, slot, id: id! })),
]
/** Piezas que aparecen en dos entradas a la vez (no debería pasar nunca). */
export function sharedPieces(entries: PlanEntry[]): string[] {
  const seen = new Map<string, string>(), out: string[] = []
  for (const e of entries) for (const p of entryPieces(e)) {
    const k = `${p.kind}${p.id}`
    if (seen.has(k) && seen.get(k) !== e.name) out.push(`${t(SLOT_LABEL, p.slot)} de ${e.name} y ${seen.get(k)}`)
    seen.set(k, e.name)
  }
  return out
}
export type EntryIssue = { severity: 'error' | 'warn'; text: string }
/** Comprueba una entrada contra la caja importada ahora: piezas que ya no existen (vendidas o trituradas) y piezas que
 * ahora lleva un Invoker que no está en el plan (al aplicar se le quitarán, con su oro de desequipar). */
export function checkEntry(e: PlanEntry, index: BoxIndex, planned: Set<number>): EntryIssue[] {
  const out: EntryIssue[] = []
  for (const [kind, map] of [['relic', e.relics], ['accessory', e.accessories]] as const) for (const [slot, id] of Object.entries(map)) {
    if (id === null) continue
    const g: Gear | undefined = kind === 'relic' ? index.relic(id) : index.accessory(id)
    if (!g) { out.push({ severity: 'error', text: `${t(SLOT_LABEL, slot)}: la pieza ya no está en tu caja (¿vendida o triturada?). Vuelve a calcular a ${e.name}.` }); continue }
    if (g.equippedHeroId !== null && g.equippedHeroId !== e.heroId && !planned.has(g.equippedHeroId)) {
      const owner = index.heroes.get(g.equippedHeroId)
      out.push({ severity: 'warn', text: `${t(SLOT_LABEL, slot)}: ahora la lleva ${owner?.name ?? 'otro Invoker'}; al aplicar se la quitarás (${fmtInt(g.unequipGold)} de oro).` })
    }
  }
  return out
}
/** Qué tandas se han enviado ya: id de Invoker → momento del envío (en este navegador). */
const sentKey = (box: Box) => `nexo.plan.sent.${box.profile.name}`
export function useSentTandas(box: Box | undefined) {
  const key = box ? sentKey(box) : ''
  const read = (): Record<string, string> => { try { const v = JSON.parse(localStorage.getItem(key) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } }
  const [sent, setSent] = useState<Record<string, string>>(() => key ? read() : {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSent(key ? read() : {}) }, [key])
  const mark = useCallback((ids: number[]) => {
    const next = { ...sent, ...Object.fromEntries(ids.map(id => [id, new Date().toISOString()])) }
    setSent(next); try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  }, [sent, key])
  /** Enviada si se envió después de la última modificación de la entrada. */
  const isSent = useCallback((e: PlanEntry) => !!sent[e.heroId] && sent[e.heroId] >= e.at, [sent])
  return { mark, isSent }
}
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
    /** Añade o sustituye la entrada; devuelve las piezas en conflicto (y no guarda) si alguna ya es de otro Invoker del plan. */
    upsert: (e: PlanEntry): string[] => { const c = planConflicts(plan, e); if (!c.length) save([...plan.filter(x => x.heroId !== e.heroId), e]); return c },
    /** Varias entradas de una vez (cada una se comprueba contra las anteriores). Devuelve las que no entraron. */
    upsertMany: (entries: PlanEntry[]): { added: number; blocked: PlanEntry[] } => {
      let next = plan
      const blocked: PlanEntry[] = []
      for (const e of entries) { if (planConflicts(next, e).length) blocked.push(e); else next = [...next.filter(x => x.heroId !== e.heroId), e] }
      save(next)
      return { added: entries.length - blocked.length, blocked }
    },
    remove: (heroId: number) => save(plan.filter(x => x.heroId !== heroId)),
    clear: () => save([]),
  }
}
