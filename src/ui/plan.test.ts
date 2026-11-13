import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from '../box/model'
import { BoxIndex } from '../box/stats'
import { checkEntry, portalUrl, presetPayload, sharedPieces, tandasOf, type PlanEntry } from './plan'

const entry = (heroId: number, relics: Record<string, number | null>, target?: Record<string, number | null>): PlanEntry =>
  ({ heroId, name: `H${heroId}`, portrait: '', rarity: 'Epic', relics, accessories: {}, changes: Object.keys(relics).length, gold: 0, damageGain: 0, at: '2026-11-13T10:00:00.000Z', target: target ? { relics: target, accessories: {} } : undefined })

describe('plan en tandas de 5', () => {
  it('divide lo pendiente en tandas de 5 por orden de prioridad', () => {
    const plan = Array.from({ length: 12 }, (_, i) => entry(i + 1, { Weapon: 100 + i }))
    const t = tandasOf(plan)
    expect(t.map(x => x.map(e => e.heroId))).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12]])
    expect(tandasOf(plan.slice(0, 5))).toHaveLength(1)
  })
  it('cada tanda es su propio preset y abre en el portal a sus 5 Invokers', () => {
    const plan = Array.from({ length: 7 }, (_, i) => entry(i + 1, { Weapon: 100 + i }))
    const [a, b] = tandasOf(plan)
    expect(presetPayload(b, 'Nexo · 2/2').loadouts.map(l => l.heroId)).toEqual([6, 7])
    expect(portalUrl(a, 'Nexo · 1/2')).toMatch(/\?heroes=1,2,3,4,5&from=Nexo#nexo-plan=/)
  })
  it('detecta una pieza en dos entradas (destino completo incluido)', () => {
    expect(sharedPieces([entry(1, { Weapon: 5 }), entry(2, { Shield: 6 })])).toEqual([])
    expect(sharedPieces([entry(1, { Weapon: 5 }), entry(2, { Shield: 6 }, { Shield: 6, Weapon: 5 })])).toHaveLength(1)
  })
  it('comprueba cada entrada con la caja de ahora: vendida o puesta en otro Invoker', () => {
    const F = 2 ** 32
    const h = (id: number) => ({ heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/C${id}/portrait.webp`, shortName: `H${id}` }, rank: 5, level: 50, power: 1, relicIdBySlot: id === 3 ? { Weapon: 11 } : {}, accessoryIdBySlot: {}, stats: {}, basis: { attack: F } })
    const g = (id: number, owner: number | null) => ({ id, slot: 'Weapon', rank: 4, rarity: 'Rare', level: 0, equippedHeroId: owner, unequipGold: 2200, main: { stat: 'attack', mode: 'flat', value: 10 }, subs: [] })
    const box = parseOfficialBox({ profile: { name: 'P' }, heroes: [h(1), h(2), h(3)], titans: [], relics: [g(10, null), g(11, 3)], accessories: [], teams: [], rules: {} })
    const index = new BoxIndex(box), planned = new Set([1, 2])
    expect(checkEntry(entry(1, { Weapon: 10 }), index, planned)).toEqual([])
    expect(checkEntry(entry(1, { Weapon: 99 }), index, planned)[0].severity).toBe('error')
    const moved = checkEntry(entry(2, { Weapon: 11 }), index, planned)
    expect(moved[0]).toMatchObject({ severity: 'warn' })
    expect(moved[0].text).toMatch(/H3.*2200|H3.*2\.200/)
    // Si quien la lleva también está en el plan, no es un problema: su propia entrada la cambia.
    expect(checkEntry(entry(2, { Weapon: 11 }), index, new Set([1, 2, 3]))).toEqual([])
  })
})
