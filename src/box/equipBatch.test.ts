import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { BoxIndex } from './stats'
import { optimize } from './optimizer'
import { assembleBatch, buildFor, fillOptions, usedHeroes } from './equipBatch'
import { entryFrom } from '../ui/plan'

const F = 2 ** 32
const SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
const MAIN: Record<string, [string, string, number]> = { Weapon: ['attack', 'flat', 50], Shield: ['defense', 'flat', 50], Helmet: ['health', 'flat', 100], Pauldrons: ['attack', 'percent', 0.1], Gauntlets: ['attack', 'percent', 0.1], Chestplate: ['health', 'percent', 0.1], Belt: ['health', 'percent', 0.1], Boots: ['health', 'percent', 0.1] }
let nextId = 100
const piece = (slot: string, o: { owner?: number | null; set?: string; value?: number; gold?: number } = {}) => {
  const [stat, mode, value] = MAIN[slot]
  return { id: nextId++, slot, rank: 4, rarity: 'Rare', set: o.set ?? 'Attack', level: 20, equippedHeroId: o.owner ?? null, unequipGold: o.gold ?? 1000, main: { stat, mode, value: o.value ?? value }, subs: [] }
}
const hero = (id: number, name: string, o: { level?: number; slots?: Record<string, number>; battles?: number }) => ({
  heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/${name}/portrait.webp`, shortName: name, faction: 'Ironbands', class: 'RangedAttacker', rarity: 'Epic' },
  rank: 5, level: o.level ?? 50, maxLevel: 50, awakeLevel: 0, power: 1000 - id, locked: false, battles: o.battles ?? 10,
  relicIdBySlot: o.slots ?? {}, accessoryIdBySlot: {}, stats: { attack: 500, health: 1000, defense: 300, criticalRate: 0.2, criticalDamage: 0.5 }, gearBonus: {}, basis: { attack: 500 * F, health: 1000 * F, defense: 300 * F },
})
const team = (key: string, ids: number[]) => ({ mode: 'dungeon', key, label: key, difficultyLabel: 'Normal', highestLevel: 5, levels: [{ level: 5, bestTimeTeam: { slots: ids.map(heroId => ({ position: 'Front1', line: 'front', heroId })) } }] })

function fixture() {
  nextId = 100
  // A: usado, con arma puesta y 7 huecos. B: usado, sin nada. C: no está en equipos. D: en un equipo pero nivel 10.
  const aWeapon = piece('Weapon', { owner: 1, value: 40, gold: 2200 })
  const free = [...SLOTS.map(s => piece(s)), ...SLOTS.map(s => piece(s, { value: MAIN[s][2] / 2 })), piece('Weapon', { value: 400 })]
  return {
    profile: { name: 'Prueba', level: 10, totalPower: 1 },
    heroes: [hero(1, 'AAA', { slots: { Weapon: aWeapon.id }, battles: 500 }), hero(2, 'BBB', { battles: 100 }), hero(3, 'CCC', { battles: 0 }), hero(4, 'DDD', { level: 10 })],
    titans: [], relics: [aWeapon, ...free], accessories: [],
    teams: [team('j1', [1, 2]), team('j2', [1, 4])],
    rules: { maxGearLevel: 20, accessorySlotAwakeLevel: { Amulet: 0 }, relicSets: [{ set: 'Attack', name: 'Attack', three: [{ stat: 'attack', mode: 'percent', value: 0.1 }], five: [], eight: [] }] },
  }
}

describe('equipar en lote', () => {
  const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
  it('solo Invokers que usas: equipos registrados con nivel 30 o más, o los marcados', () => {
    const { used, skipped } = usedHeroes(box, new Set())
    expect(used.map(u => u.hero.name)).toEqual(['AAA', 'BBB']) // AAA en 2 equipos, BBB en 1; DDD es nivel 10
    expect(skipped.map(h => h.name)).toEqual(['CCC'])
    expect(usedHeroes(box, new Set([2])).used.map(u => u.hero.name)).toEqual(['BBB'])
  })
  it('«solo huecos»: el optimizador no toca lo que ya lleva, aunque haya algo mejor', () => {
    const a = box.heroes[0]
    const r = optimize(index, a, fillOptions(a, new Set()))
    // 7 huecos; el escudo (DEF plana) no aporta nada a un perfil de daño, así que ese hueco se queda vacío.
    expect(r.changes.map(c => c.slot)).toEqual(['Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots'])
    expect(r.changes.every(c => c.from === null)).toBe(true)
    expect(r.goldCost).toBe(0)
    expect(r.relics.Weapon?.id).toBe(a.relics.Weapon)
    const full = optimize(index, a, { ...fillOptions(a, new Set()), onlyEmpty: false })
    expect(full.changes.some(c => c.slot === 'Weapon')).toBe(true) // sin el modo, cambiaría el arma (cuesta oro)
  })
  it('reparte por prioridad sin repetir piezas ni usar las reservadas, y sin oro si solo rellena huecos', () => {
    const { used, skipped } = usedHeroes(box, new Set())
    const reserved = new Set([`relic${box.relics.find(g => g.slot === 'Helmet' && g.equippedHeroId === null)!.id}`])
    const fills = new Map(used.map(u => [u.hero.id, optimize(index, u.hero, fillOptions(u.hero, reserved))]))
    const b = assembleBatch(index, used, fills, [], false, skipped)
    const ids = b.heroes.flatMap(h => h.fills.map(c => c.to!.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some(id => reserved.has(`relic${id}`))).toBe(false)
    expect(b.gold).toBe(0)
    expect(b.heroes[0].hero.name).toBe('AAA')
    expect(b.heroes.every(h => h.gain >= 0.01)).toBe(true)
  })
  it('los huecos van antes que las sustituciones: el mejor arma libre es para el hueco de BBB', () => {
    const { used } = usedHeroes(box, new Set())
    const fills = new Map(used.map(u => [u.hero.id, optimize(index, u.hero, fillOptions(u.hero, new Set()))]))
    const best = box.relics.find(g => g.slot === 'Weapon' && g.main.value === 400)!
    const b = assembleBatch(index, used, fills, [{ heroId: used[0].hero.id, slot: 'Weapon', kind: 'relic', pieceId: best.id }], true)
    expect(b.heroes.find(h => h.hero.name === 'BBB')!.fills.some(c => c.to!.id === best.id)).toBe(true)
    expect(b.heroes.find(h => h.hero.name === 'AAA')!.swaps).toHaveLength(0)
  })
  it('las sustituciones son opcionales, se aplican sobre los huecos y cuentan su oro', () => {
    const used = usedHeroes(box, new Set()).used.slice(0, 1)
    const a = used[0].hero
    const fills = new Map(used.map(u => [u.hero.id, optimize(index, u.hero, fillOptions(u.hero, new Set()))]))
    const best = box.relics.find(g => g.slot === 'Weapon' && g.main.value === 400)!
    const swap = [{ heroId: a.id, slot: 'Weapon', kind: 'relic' as const, pieceId: best.id }]
    expect(assembleBatch(index, used, fills, swap, false).heroes[0].swaps).toHaveLength(0)
    const b = assembleBatch(index, used, fills, swap, true)
    const ha = b.heroes.find(h => h.hero.id === a.id)!
    expect(ha.swaps.map(s => s.to!.id)).toEqual([best.id])
    expect(ha.gold).toBe(2200) // el oro de desequipar del arma que sale
    expect(ha.fills.length).toBe(6) // los huecos se mantienen
  })
  it('el resultado entra en el Plan como cualquier build', () => {
    const a = box.heroes[0]
    const e = entryFrom(a, buildFor(index, a, { ...a.relics, Helmet: box.relics.find(g => g.slot === 'Helmet' && g.equippedHeroId === null)!.id }, {}), 'Equipar piezas libres')
    expect(e.changes).toBe(1)
    expect(e.gold).toBe(0)
    expect(Object.keys(e.relics)).toEqual(['Helmet'])
    expect(e.goal).toBe('Equipar piezas libres')
  })
})
