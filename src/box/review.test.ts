import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { BoxIndex } from './stats'
import { optimize, gearKey, type BuildResult } from './optimizer'
import { REVIEW_EFFORT, reviewBatch, reviewOptions, usedHeroes } from './equipBatch'
import { planFor, resolveObjective } from './coachEngine'
import { withReview } from '../ui/coach'
import { usesOf } from '../ui/teamReview'

const F = 2 ** 32
const hero = (id: number, name: string, relics: Record<string, number>) => ({
  heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/${name}/portrait.webp`, shortName: name, element: 'Fire', class: 'RangedAttacker', rarity: 'Epic', faction: 'Magi' },
  rank: 5, level: 50, awakeLevel: 0, power: 1000, relicIdBySlot: relics, accessoryIdBySlot: {}, gearBonus: {},
  stats: { attack: 1000, health: 5000, defense: 400, criticalRate: 0.1, criticalDamage: 0.5 }, basis: { attack: 1000 * F, health: 5000 * F, defense: 400 * F, criticalRate: 0.05 * F, criticalDamage: 0.5 * F },
})
const relic = (id: number, slot: string, set: string, owner: number | null, main: [string, string, number]) => ({
  id, kind: 'relic', slot, rank: 5, rarity: 'Epic', set, level: 15, equippedHeroId: owner, unequipGold: 1000,
  main: { stat: main[0], mode: main[1], value: main[2], rolls: 0, grade: null }, subs: [], mainAtMax: null,
})
// Tres piezas libres del conjunto Ataque: cada una sola aporta poco frente a lo que lleva, pero las tres juntas activan
// el conjunto (+30 % ATQ). Comparando pieza a pieza no se ve; el optimizador completo sí.
function fixture() {
  return {
    profile: { name: 'P' }, accessories: [], titans: [],
    rules: { relicSets: [{ set: 'Attack', name: 'Attack', three: [{ stat: 'attack', mode: 'percent', value: 0.3 }], five: [], eight: [], flags: [] }, { set: 'Other', name: 'Other', three: [], five: [], eight: [], flags: [] }] },
    heroes: [hero(1, 'USADO', { Weapon: 10, Helmet: 11, Boots: 12 }), hero(2, 'OTRO', {})],
    relics: [
      relic(10, 'Weapon', 'Other', 1, ['attack', 'flat', 60]), relic(11, 'Helmet', 'Other', 1, ['attack', 'flat', 60]), relic(12, 'Boots', 'Other', 1, ['attack', 'flat', 60]),
      relic(20, 'Weapon', 'Attack', null, ['attack', 'flat', 50]), relic(21, 'Helmet', 'Attack', null, ['attack', 'flat', 50]), relic(22, 'Boots', 'Attack', null, ['attack', 'flat', 50]),
    ],
    teams: [{ mode: 'dungeon', key: 'x', label: 'X', difficultyLabel: 'Normal', highestLevel: 1, levels: [{ level: 1, bestTimeSeconds: 60, victories: 1, defeats: 0, bestTimeTeam: { slots: [{ position: 'Front1', line: 'front', heroId: 1 }] } }] }],
  }
}

describe('Revisión completa del equipo', () => {
  const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
  const { used } = usedHeroes(box, new Set())
  const h = box.heroes[0]
  it('opciones: todas las piezas salvo las de otros Invokers protegidos y las reservadas; cada cambio paga su coste', () => {
    const o = reviewOptions(h, new Set(['relic99']), new Set([1, 2]), 'min')
    expect(o).toMatchObject({ pool: 'all', changeCost: REVIEW_EFFORT.min, objective: 'damage' })
    expect([...o.protectedHeroes!]).toEqual([2])
    expect(o.reserved?.has('relic99')).toBe(true)
  })
  it('encuentra el cambio de conjunto de varias piezas que pieza a pieza no se ve', () => {
    const b = optimize(index, h, reviewOptions(h, new Set(), new Set([1]), 'balanced'))
    expect(b.changes.map(c => c.to?.id).sort()).toEqual([20, 21, 22])
    const batch = reviewBatch(index, used, new Map([[h.id, b]]))
    expect(batch.heroes).toHaveLength(1)
    expect(batch.heroes[0].gain).toBeGreaterThan(0.2)
    expect(batch.heroes[0].gold).toBe(3000)
    // Cada pieza sola no mejora (pierde 10 de ATQ): vale por el conjunto.
    expect(batch.heroes[0].swaps.every(s => s.gain < 0.005)).toBe(true)
    // El Coach sin revisión no lo propone; con ella, sí, como una sola acción.
    const obj = resolveObjective(box, { kind: 'record', mode: 'dungeon', key: 'x', level: 1, intent: 'faster' }, used)
    const input = { index, objective: obj, used: new Set([1]), protect: new Set([1]), reserved: new Set<string>() }
    expect(planFor(input).actions.some(a => a.kind === 'gear')).toBe(false)
    const withBuild = planFor({ ...input, builds: new Map<number, BuildResult>([[h.id, b]]) }).actions.filter(a => a.kind === 'gear')
    expect(withBuild).toHaveLength(1)
    expect(withBuild[0].title).toBe('Revisa el equipo de USADO: 3 cambios')
    expect(withBuild[0].why.join(' ')).toMatch(/activa Ataque \(3\)/)
    expect(withBuild[0].cost).toMatchObject({ kind: 'gold', gold: 3000 })
  })
  it('el coach de piezas no aconseja vender lo que la revisión pondría en un Invoker', () => {
    const b = optimize(index, h, reviewOptions(h, new Set(), new Set([1]), 'balanced'))
    const uses = usesOf(index, new Map([[h.id, b]]))
    expect(Object.keys(uses).sort()).toEqual([gearKey(box.relics[3]), gearKey(box.relics[4]), gearKey(box.relics[5])].sort())
    const advice = box.relics.slice(3).map(g => ({ gear: g, verdict: 'sell' as const, title: 'Véndela', why: '', priority: 3 }))
    const coach = { ctx: {} as never, advice: advice as never, byKey: new Map(), counts: { upgrade: 0, replace: 0, test: 0, equip: 0, keep: 0, sell: 3, done: 0 } }
    const fixed = withReview(coach, { key: 'k', uses })
    expect(fixed.counts).toMatchObject({ sell: 0, equip: 3 })
    expect(fixed.advice[0].title).toBe('Equípala en USADO')
    expect(withReview(coach, null)).toBe(coach)
  })
})
