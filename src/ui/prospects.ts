/** Promesas de la cuenta abierta (Invokers de tier alto que aún no usas) y su base estimada en el tope de nivel. */
import { useEffect, useMemo, useState } from 'react'
import type { Box, Hero } from '../box/model'
import { findProspects, LEVEL_STATS, projectToCap, type CapProjection, type Prospect } from '../box/prospects'
import { usedHeroes } from '../box/equipBatch'
import { loadBosses } from '../box/goal'
import { ASCENSION } from '../box/ascension'
import { loadDetail, loadIndex, loadTiers, useLoad } from '../wiki/data'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { usePlan } from './plan'

const NONE: { prospects: Prospect[]; ids: Set<number> } = { prospects: [], ids: new Set() }

/** Promesas y sus ids (para no proponer quitarles piezas en ningún optimizador). */
export function useProspects(): { prospects: Prospect[]; ids: Set<number> } {
  const { account, previous } = useAccount()
  const bosses = useLoad(loadBosses), tiers = useLoad(loadTiers)
  const active = useActiveTeams(account?.box)
  const { plan } = usePlan(account?.box)
  return useMemo(() => {
    if (!account || !bosses.data || !tiers.data) return NONE
    const general = new Map<string, { tier: string; score: number }>()
    for (const r of tiers.data.invokers.rows) for (const e of r.entries) if (e.code && e.score != null) general.set(e.code, { tier: r.label, score: e.score })
    const used = new Set([...usedHeroes(account.box, new Set()).used.map(u => u.hero.id), ...active.heroes, ...plan.map(e => e.heroId)])
    const prospects = findProspects(account.box, { general, bosses: bosses.data.bosses }, used, previous?.box)
    return prospects.length ? { prospects, ids: new Set(prospects.map(p => p.hero.id)) } : NONE
  }, [account, previous, bosses.data, tiers.data, active.heroes, plan])
}

const num = (s: string) => Number(s.replace(/[^\d.]/g, ''))
const capOf = (h: Hero) => h.maxLevel || ASCENSION.cap(h.rank)
/** Base estimada de un Invoker en su tope de nivel (ver `projectToCap`). `undefined` mientras carga las fichas
 * oficiales; `null` si ya está en el tope o no hay datos suficientes. */
export function useCapProjection(hero: Hero | undefined, box: Box | undefined): CapProjection | null | undefined {
  const [state, setState] = useState<{ key: string; value: CapProjection | null } | null>(null)
  const key = hero && box ? `${hero.id}|${hero.level}|${hero.rank}|${box.heroes.length}` : ''
  useEffect(() => {
    if (!hero || !box) return
    if (!hero.basis || hero.level >= capOf(hero)) { setState({ key, value: null }); return }
    let live = true
    void (async () => {
      const index = await loadIndex()
      const slugs = new Map(index.invokers.map(s => [s.code, s.slug]))
      const seen = new Set([hero.code])
      const refs = box.heroes.filter(h => h.id !== hero.id && h.rank === hero.rank && h.level >= capOf(h) && h.basis)
        .sort((a, b) => Math.abs(a.awakeLevel - hero.awakeLevel) - Math.abs(b.awakeLevel - hero.awakeLevel) || (b.battles || 0) - (a.battles || 0))
        .filter(h => !seen.has(h.code) && !!seen.add(h.code)).slice(0, 8)
      const maxStats = new Map<string, Record<string, number>>()
      await Promise.all([hero, ...refs].map(async h => {
        const slug = slugs.get(h.code), d = slug ? await loadDetail('invokers', slug).catch(() => null) : null
        if (d) maxStats.set(h.code, Object.fromEntries(LEVEL_STATS.map(k => [k, num(d.maxStats.find(s => s.key === k)?.value ?? '0')])))
      }))
      if (live) setState({ key, value: projectToCap(hero, box, maxStats) })
    })().catch(() => { if (live) setState({ key, value: null }) })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return state?.key === key ? state.value : undefined
}
