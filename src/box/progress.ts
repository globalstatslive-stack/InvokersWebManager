/** Evolución entre dos importaciones de la misma cuenta.
 *
 * Separa dos cosas que no deben confundirse:
 * · Cambios en la cuenta (ascensión, nivel, despertar, habilidades, estadísticas, piezas): mejora de estadísticas.
 * · Resultados en combate (récords de la caja: victorias, derrotas y mejor tiempo por fase): lo único que demuestra
 *   rendimiento. Si no hay combates nuevos registrados, se dice. */
import type { Box, Hero, TeamRecord } from './model'

export type HeroChange = { hero: Hero; before: Hero; items: string[]; stats: { stat: string; from: number; to: number }[]; power: number }
export type RecordChange = {
  mode: string; key: string; label: string; level: number
  victories: number; defeats: number
  bestTime: { from: number; to: number } | null
  /** Fase nueva en el récord (no existía antes). */
  fresh: boolean
}
export type HighestChange = { mode: string; key: string; label: string; from: number; to: number }
export type Progress = {
  heroes: HeroChange[]; records: RecordChange[]; highest: HighestChange[]
  /** Combates nuevos registrados en los récords (victorias + derrotas). */
  battles: number
  gear: { moved: number; added: number; removed: number }
}

const SKILL_ES: Record<string, string> = { Combo: 'Combo', ActiveSkill1: 'Habilidad 1', ActiveSkill2: 'Habilidad 2', ActiveSkill3: 'Habilidad 3', Ultimate: 'Definitiva', Tolerance1: 'Tolerancia', Tolerance2: 'Tolerancia' }
export const TRACKED = ['attack', 'health', 'defense', 'criticalRate', 'criticalDamage', 'accuracy', 'resistance', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration'] as const
const recordId = (t: Pick<TeamRecord, 'mode' | 'key' | 'difficulty'>) => `${t.mode}:${t.key}:${t.difficulty}`
const recordLabel = (t: TeamRecord) => `${t.label}${t.detail && t.mode !== 'arena' ? ` ${t.detail}` : t.mode === 'arena' && t.detail ? ` (${t.detail === 'Offense' ? 'ataque' : t.detail === 'Defense' ? 'defensa' : t.detail})` : ''}${t.difficulty && t.difficulty !== 'Normal' ? ` (${t.difficulty === 'Hard' ? 'difícil' : t.difficulty})` : ''}`

export function progressBetween(prev: Box, cur: Box): Progress {
  const before = new Map(prev.heroes.map(h => [h.id, h]))
  const heroes: HeroChange[] = []
  for (const h of cur.heroes) {
    const b = before.get(h.id)
    if (!b) continue
    const items: string[] = []
    if (h.rank > b.rank) items.push(`${b.rank}★ → ${h.rank}★`)
    if (h.level > b.level) items.push(`nivel ${b.level} → ${h.level}`)
    if (h.awakeLevel > b.awakeLevel) items.push(`despertar ${b.awakeLevel}★ → ${h.awakeLevel}★`)
    else if ((h.awakeNodes ?? 0) > (b.awakeNodes ?? 0) && b.awakeNodes != null) items.push(`${h.awakeNodes! - b.awakeNodes} ${h.awakeNodes! - b.awakeNodes === 1 ? 'nodo' : 'nodos'} de despertar`)
    for (const s of h.skills) {
      const old = b.skills.find(x => x.kind === s.kind)?.level ?? 0
      if (s.level > old) items.push(`${SKILL_ES[s.kind] ?? s.kind} ${old + 1} → ${s.level + 1}`)
    }
    const pieces = (x: Hero) => [...Object.entries(x.relics).map(([k, v]) => `r${k}${v}`), ...Object.entries(x.accessories).map(([k, v]) => `a${k}${v}`)]
    const pb = new Set(pieces(b)), changed = pieces(h).filter(p => !pb.has(p)).length + pieces(b).filter(p => !pieces(h).includes(p)).length
    if (changed) items.push(`${Math.ceil(changed / 2)} ${Math.ceil(changed / 2) === 1 ? 'pieza cambiada' : 'piezas cambiadas'}`)
    const stats = TRACKED.map(k => ({ stat: k as string, from: b.stats[k] ?? 0, to: h.stats[k] ?? 0 }))
      .filter(x => Math.abs(x.to - x.from) > (x.stat === 'criticalRate' || x.stat === 'criticalDamage' ? 0.004 : Math.max(1, 0.01 * Math.abs(x.from))))
    if (items.length || stats.length) heroes.push({ hero: h, before: b, items, stats, power: (h.power || 0) - (b.power || 0) })
  }
  heroes.sort((a, b) => b.items.length - a.items.length || b.power - a.power)

  const prevTeams = new Map(prev.teams.map(t => [recordId(t), t]))
  const records: RecordChange[] = [], highest: HighestChange[] = []
  let battles = 0
  for (const t of cur.teams) {
    const p = prevTeams.get(recordId(t))
    if (p && t.highestLevel > p.highestLevel) highest.push({ mode: t.mode, key: t.key, label: recordLabel(t), from: p.highestLevel, to: t.highestLevel })
    for (const l of t.levels) {
      const o = p?.levels.find(x => x.level === l.level)
      const dv = l.victories - (o?.victories ?? 0), dd = l.defeats - (o?.defeats ?? 0)
      const better = o && o.bestTime > 0 && l.bestTime > 0 && l.bestTime < o.bestTime
      if (dv <= 0 && dd <= 0 && !better) continue
      battles += Math.max(0, dv) + Math.max(0, dd)
      records.push({ mode: t.mode, key: t.key, label: recordLabel(t), level: l.level, victories: Math.max(0, dv), defeats: Math.max(0, dd), bestTime: better ? { from: o!.bestTime, to: l.bestTime } : null, fresh: !o })
    }
  }
  records.sort((a, b) => Number(!!b.bestTime) - Number(!!a.bestTime) || (b.victories + b.defeats) - (a.victories + a.defeats))

  const ids = (box: Box) => new Map([...box.relics, ...box.accessories].map(g => [`${g.kind}${g.id}`, g.equippedHeroId]))
  const gb = ids(prev), gc = ids(cur)
  let moved = 0, added = 0, removed = 0
  for (const [k, owner] of gc) { if (!gb.has(k)) added++; else if (gb.get(k) !== owner) moved++ }
  for (const k of gb.keys()) if (!gc.has(k)) removed++
  return { heroes, records, highest, battles, gear: { moved, added, removed } }
}

/** Récord de una fase concreta (para comparar el antes y el después de una recomendación). */
export function recordAt(box: Box, mode: string, key: string, level: number, difficulty?: string) {
  const t = box.teams.find(x => x.mode === mode && x.key === key && (!difficulty || x.difficulty === difficulty))
  const l = t?.levels.find(x => x.level === level)
  return t ? { victories: l?.victories ?? 0, defeats: l?.defeats ?? 0, bestTime: l?.bestTime ?? 0, highest: t.highestLevel } : null
}
