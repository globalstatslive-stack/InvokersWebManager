import { describe, expect, it } from 'vitest'
import type { Box, Hero } from './model'
import type { Boss } from './goal'
import { findProspects, projectToCap, withBasis } from './prospects'

// Datos inventados: no son de ninguna cuenta real.
const hero = (id: number, code: string, x: Partial<Hero> = {}): Hero => ({
  id, code, name: code, fullName: code, rarity: 'Legendary', element: 'Water', cls: 'MeleeAttacker', faction: 'Lightseekers',
  rank: 5, level: 50, maxLevel: 50, awakeLevel: 3, battles: 100, power: 1000, totalXp: null, locked: false,
  relics: {}, accessories: {}, skills: [], basis: { attack: 650, health: 6000, defense: 400 }, gearBonus: {}, stats: { attack: 650, health: 6000, defense: 400 },
  ...x,
}) as unknown as Hero
const tiers = (m: Record<string, [string, number]>) => new Map(Object.entries(m).map(([k, [tier, score]]) => [k, { tier, score }]))
const boss = { slug: 'ulgorim', name: 'Ulgorim', tier: { NEW: { tier: 'S+', score: 4.97 }, USED: { tier: 'C', score: 3.8 } } } as unknown as Boss
const record = { mode: 'dungeon', key: 'ulgorim', label: 'Ulgorim', detail: null, highestLevel: 11, levels: [{ level: 11, slots: [{ heroId: 1, titanId: null }] }] }

describe('promesas: Invokers de tier alto que aún no usas', () => {
  const box = { heroes: [
    hero(1, 'USED'),                                                                                          // en tus equipos
    hero(2, 'USED', { level: 1 }),                                                                            // copia de uno que usas
    hero(3, 'NEW', { level: 1, awakeLevel: 2, battles: 0, totalXp: 0, relics: { Weapon: 9, Helmet: 8 } }),    // legendario S nuevo
    hero(4, 'LOWTIER', { level: 1 }),                                                                         // épico/legendario en B
    hero(5, 'RARE', { rarity: 'Rare', level: 1 }),                                                            // raro en S
  ], teams: [record] } as unknown as Box
  const official = { general: tiers({ USED: ['S', 4.9], NEW: ['S', 4.92], LOWTIER: ['B', 4.2], RARE: ['S', 4.8] }), bosses: [boss] }
  it('solo épicos y legendarios en S+, S o A+ sin ninguna copia en uso', () => {
    const p = findProspects(box, official, new Set([1]), { heroes: [hero(1, 'USED')] } as unknown as Box)
    expect(p.map(x => x.hero.id)).toEqual([3])
    expect(p[0]).toMatchObject({ isNew: true, tier: { tier: 'S', score: 4.92 }, cap: 50, xpToCap: 1618300 })
    expect(p[0].invested).toEqual(['despertar 2', '2 piezas puestas'])
    // Dónde encaja: nota del jefe y la más baja de tu equipo del récord.
    expect(p[0].bossFits[0]).toMatchObject({ name: 'Ulgorim', tier: 'S+', record: 11, team: [{ name: 'USED', tier: 'C' }] })
  })
  it('sin importación anterior no se marca como nuevo', () => {
    expect(findProspects(box, official, new Set([1]))[0].isNew).toBe(false)
  })
})

describe('base estimada en el tope de nivel', () => {
  const max = new Map([['NEW', { attack: 1000, health: 10000, defense: 800 }], ['R1', { attack: 1000, health: 10000, defense: 800 }], ['R2', { attack: 1000, health: 10000, defense: 800 }], ['R3', { attack: 2000, health: 10000, defense: 800 }]])
  const ref = (id: number, code: string, r: number, awake: number) => hero(id, code, { awakeLevel: awake, basis: { attack: r * (code === 'R3' ? 2000 : 1000), health: r * 10000, defense: r * 800 } })
  const target = hero(3, 'NEW', { level: 1, awakeLevel: 2, basis: { attack: 160, health: 1000, defense: 80 }, stats: { attack: 300, health: 4000, defense: 180 }, gearBonus: { attack: 140, health: 3000, defense: 100 } })
  const box = { heroes: [target, ref(10, 'R1', 0.6, 2), ref(11, 'R2', 0.7, 3), ref(12, 'R3', 0.65, 3)], arenaHall: [], setRules: [] } as unknown as Box
  it('máximo oficial × mediana de base/máximo de tus Invokers de las mismas estrellas en su tope', () => {
    const p = projectToCap(target, box, max)!
    expect(p.cap).toBe(50)
    expect(p.ratio.attack).toBeCloseTo(0.65)
    expect(p.basis.attack).toBeCloseTo(650)
    expect(p.basis.health).toBeCloseTo(6500)
    expect(p.refs).toContain('R1')
  })
  it('no proyecta si ya está en el tope o faltan referencias', () => {
    expect(projectToCap(hero(3, 'NEW'), box, max)).toBeNull()
    expect(projectToCap(target, { ...box, heroes: [target, box.heroes[1]] } as Box, max)).toBeNull()
  })
  it('recalcula el total con la sala de trofeos de su elemento y los % de sus piezas', () => {
    const piece = { kind: 'relic', id: 1, slot: 'Weapon', main: { stat: 'attack', mode: 'percent', value: 0.2 }, subs: [] }
    const b = { ...box, arenaHall: [{ element: 'Water', stat: 'attack', mode: 'percent', level: 5, value: 0.1 }] } as unknown as Box
    const h = withBasis({ ...target, gearBonus: { attack: 0.2 * 160 } } as Hero, { ...target.basis!, attack: 650 }, b, [piece] as never)
    // (650 − 160) × 1,1 más lo que el 20 % de ATQ de la pieza gana con la base nueva.
    expect(h.stats.attack).toBeCloseTo(300 + 490 * 1.1 + 0.2 * (650 - 160))
    expect(h.gearBonus!.attack).toBeCloseTo(130)
  })
})
