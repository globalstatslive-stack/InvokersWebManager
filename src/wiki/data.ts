/** Enciclopedia: datos oficiales de invokers.com generados con scripts/fetch-wiki.mjs. Todo se carga bajo demanda. */
import { useEffect, useState } from 'react'

export type Kind = 'invokers' | 'titans'
export type Summary = {
  slug: string; code: string; name: string; short: string; rarity: string; faction: string | null; element: string | null
  cls: string | null; role: string | null; soulSign: { name: string; icon: string | null } | null; tolerances: string[]
  fullArt: string | null; portraitUrl: string | null; skills: number; aoe: boolean; effects: string[]
}
export type Effect = { key: string; label: string; group: string; icon: string | null; description: string | null; count?: number }
export type WikiIndex = { source: string; fetchedAt: string; version: string | null; invokers: Summary[]; titans: Summary[]; effects: Effect[]; tolerances: Effect[] }
export type StatRow = { key: string | null; label: string; value: string; detail: string | null }
export type SkillLevel = { level: number; crown: boolean; cd: string | null; cost: string | null; d: string; dm?: string }
export type Skill = { name: string; type: string; aoe: boolean; icon: string | null; cd: string; cost: string; mana: { ult: string | null; titan: string | null; ultMax: string | null; titanMax: string | null }; effects: string[]; levels: SkillLevel[] }
export type Detail = Omit<Summary, 'skills' | 'aoe' | 'effects' | 'tolerances'> & {
  bio: string | null; subtitle: string | null; fields: { section: string; label: string; value: string }[]
  stats: StatRow[]; maxStats: StatRow[]; ceilings: Record<string, number>; baseCeilings: Record<string, number>
  tolerances: { key: string; label: string; icon: string | null; value: string; levels: string[] }[]
  corruptions: { key: string; label: string; icon: string | null; value: string }[]
  skills: Skill[]; effects: Effect[]; official: string; comingSoon: string | null
}
export type TierRow = { key: string; label: string; entries: { slug: string; code: string | null; score: number | null }[] }
export type Tiers = { invokers: { updated: string | null; scope: string | null; rows: TierRow[] }; titans: { updated: string | null; scope: string | null; rows: TierRow[] }; sources: { invokers: string; titans: string } }
export type Floor = { floor: number; boss: boolean; element: string | null; matchup: string; level: number; acc: number; res: number; waves: { name: string; boss: boolean; enemies: string[] }[]; rewards: { item: string; amount: string }[]; firstClear: string | null }
export type Spire = { slug: string; name: string; intro: string; official: string; floors: Floor[] }
export type Spires = { source: string; fetchedAt: string; spires: Spire[] }
export type Chase = { key: string; start: string; end: string; name: string; official: string | null; icon: string | null; currency: string | null; crownsNeeded: number; crownsOnOffer: number; leaderboardCrowns: number; hero: { name: string; code: string | null; slug: string | null } | null; runs: { type: string; name: string; start: string; end: string; crowns: number; icon: string | null }[] }
export type Events = { source: string; builtAt: string | null; divisions: { id: number; name: string; levels: string }[]; chases: Chase[] }
export type Tools = { source: string; ratingMax: number; arenaInitialCooldownFactor: number; skillRecoveryPct: number[]; skillSpeedPct: number[]; resistChanceByDiff: { min: number; max: number; values: number[] }; elements: string[]; elementDebuffDelta: number[][]; elementMatchupSign: number[][]; tickSeconds: number }
export type GearData = {
  relicMain: { slot: string; stats: string[] }[]; relicSub: { slot: string; stats: string[] }[]; grades: { roll: string; total: string; grade: string }[]
  sets: { kind: 'standard' | 'advanced'; name: string; three: string; five: string; fiveTotal: string | null; where: string }[]
  accessoryMain: { slot: string; stats: string[] }[]; accessorySub: { slot: string; stats: string[] }[]; sources: { relics: string; accessories: string }
}
export type Guides = { fetchedAt: string; guides: { path: string; url: string }[] }

const memo = <T,>(f: () => Promise<T>) => { let p: Promise<T> | undefined; return () => p ??= f() }
export const loadIndex = memo(() => import('../catalog/wiki/index.json').then(m => m.default as unknown as WikiIndex))
export const loadTiers = memo(() => import('../catalog/wiki/tiers.json').then(m => m.default as unknown as Tiers))
export const loadSpires = memo(() => import('../catalog/wiki/spires.json').then(m => m.default as unknown as Spires))
export const loadEvents = memo(() => import('../catalog/wiki/events.json').then(m => m.default as unknown as Events))
export const loadTools = memo(() => import('../catalog/wiki/tools.json').then(m => m.default as unknown as Tools))
export const loadGear = memo(() => import('../catalog/wiki/gear.json').then(m => m.default as unknown as GearData))
export const loadGuides = memo(() => import('../catalog/wiki/guides.json').then(m => m.default as unknown as Guides))

const details = {
  invokers: import.meta.glob('../catalog/wiki/invokers/*.json', { import: 'default' }),
  titans: import.meta.glob('../catalog/wiki/titans/*.json', { import: 'default' }),
}
export async function loadDetail(kind: Kind, slug: string): Promise<Detail | null> {
  const f = details[kind][`../catalog/wiki/${kind}/${slug}.json`]
  return f ? (await f()) as Detail : null
}

/** Estado de una carga asíncrona para las páginas. */
export function useLoad<T>(f: () => Promise<T>, deps: unknown[] = []): { data?: T; error?: string } {
  const [s, set] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    let live = true
    set({})
    f().then(data => live && set({ data }), e => live && set({ error: String(e?.message ?? e) }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return s
}

/** Probabilidad de que un perjuicio entre, con las tablas de la calculadora oficial. */
export function landChance(t: Tools, o: { accuracy: number; resistance: number; accUp?: number; accDown?: number; resUp?: number; resDown?: number; caster?: string; target?: string }) {
  const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b)
  const { min, max, values } = t.resistChanceByDiff
  const base = values[clamp(Math.round(o.resistance - o.accuracy), min, max) - min]
  const i = t.elements.indexOf(o.caster ?? 'Neutral'), j = t.elements.indexOf(o.target ?? 'Neutral')
  const delta = i >= 0 && j >= 0 ? t.elementDebuffDelta[i][j] : 0
  const sign = i >= 0 && j >= 0 ? t.elementMatchupSign[i][j] : 0
  const resist = clamp(base + (o.resUp ?? 0) - (o.resDown ?? 0) - ((o.accUp ?? 0) - (o.accDown ?? 0)) - delta, 0, 100)
  return { resist, land: 100 - resist, matchup: sign > 0 ? 'advantage' : sign < 0 ? 'disadvantage' : 'neutral', delta }
}
const rating = (arr: number[], r: number, maxR: number) => arr[Math.min(Math.max(Math.round(r), 0), maxR)]
/** Enfriamiento real con la tabla oficial de recuperación de habilidad. */
export function cooldown(t: Tools, o: { base: number; rating: number; up?: number; down?: number }) {
  const pct = rating(t.skillRecoveryPct, o.rating, t.ratingMax)
  const speed = Math.max(0, 1 + (pct + (o.up ?? 0) - (o.down ?? 0)) / 100)
  const real = speed > 0 ? o.base / speed : Infinity
  const arena = o.base * t.arenaInitialCooldownFactor
  return { pct, speed, real, arena, arenaFirst: speed > 0 ? arena / speed : Infinity }
}
/** Ticks de un efecto periódico con la tabla oficial de velocidad de habilidad. */
export function ticks(t: Tools, o: { duration: number; interval: number; rating: number }) {
  const pct = rating(t.skillSpeedPct, o.rating, t.ratingMax)
  const mult = Math.max(0, 1 + pct / 100)
  const frames = (x: number) => Math.floor(x / t.tickSeconds + 1e-9) + 1
  const count = (interval: number) => {
    if (interval <= 0 || o.duration <= 0) return [] as number[]
    const end = frames(o.duration), out: number[] = []
    for (let k = 1; ; k++) { const f = frames(k * interval); if (f > end) break; out.push(f * t.tickSeconds) }
    return out
  }
  const modified = mult > 0 ? o.interval / mult : o.interval
  return { pct, mult, base: count(o.interval), modified: count(modified), modifiedInterval: modified }
}
