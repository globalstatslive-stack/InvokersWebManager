import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { usedHeroes } from './equipBatch'
import { HALL, HALL_STATS, hallLevels, hallRanking, perLevel, pointsFor } from './trophyHall'

const F = 2 ** 32
const hero = (id: number, name: string, element: string, cls: string) => ({
  heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/${name}/portrait.webp`, shortName: name, element, class: cls, rarity: 'Epic' },
  rank: 5, level: 50, power: 1000, battles: 100, relicIdBySlot: {}, accessoryIdBySlot: {}, gearBonus: {},
  stats: { attack: 1000, health: 5000, defense: 500, criticalRate: 0.5, criticalDamage: 1 }, basis: { attack: 800 * F, health: 4000 * F, defense: 400 * F },
})
const team = (key: string, ids: number[]) => ({ mode: 'dungeon', key, label: key, difficultyLabel: 'Normal', highestLevel: 5, levels: [{ level: 5, bestTimeTeam: { slots: ids.map(heroId => ({ position: 'Front1', line: 'front', heroId })) } }] })
const hall = (element: string, stat: string, mode: string, level: number, value: number) => ({ element, stat, mode, level, value })
function fixture() {
  return {
    profile: { name: 'P' }, titans: [], relics: [], accessories: [], rules: {},
    heroes: [hero(1, 'FUEGO1', 'Fire', 'RangedAttacker'), hero(2, 'FUEGO2', 'Fire', 'MeleeAttacker'), hero(3, 'AGUA', 'Water', 'Tank'), hero(4, 'BANQUILLO', 'Wind', 'RangedAttacker')],
    teams: [team('j1', [1, 2, 3]), team('j2', [1])],
    arenaHallBonuses: [hall('Fire', 'attack', 'percent', 5, 0.1), hall('Water', 'health', 'percent', 2, 0.04), hall('Dark', 'skillSpeed', 'flat', 8, 32)],
  }
}

describe('Sala de trofeos', () => {
  const box = parseOfficialBox(fixture())
  it('reglas oficiales: 12 mejoras por elemento, 15 niveles, bronce 1–5, plata 6–10, oro 11–15', () => {
    expect(HALL_STATS).toHaveLength(12)
    expect(HALL.elements).toHaveLength(6)
    expect([1, 5, 6, 10, 11, 15].map(HALL.tierOf)).toEqual(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold'])
    expect(HALL.firstLevel).toMatchObject({ trophy: 'bronze', amount: 20, attackPercent: 0.02 })
  })
  it('lee de la caja el nivel de cada mejora y lo que da cada nivel', () => {
    expect(hallLevels(box).get('Fire:attack')).toMatchObject({ level: 5 })
    expect(hallLevels(box).get('Earth:attack')).toBeUndefined()
    const p = perLevel(box)
    expect(p.get('attack')).toBeCloseTo(0.02)
    expect(p.get('health')).toBeCloseTo(0.02)
    expect(p.get('skillSpeed')).toBe(4)
    expect(p.has('criticalRate')).toBe(false) // nunca subida: sin dato
  })
  it('ATQ % vale más que una velocidad para un atacante; VIDA % para un tanque', () => {
    const [a, , t] = box.heroes
    expect(pointsFor(a, 'attack', 'percent', 0.02)).toBeGreaterThan(pointsFor(a, 'skillSpeed', 'flat', 4))
    expect(pointsFor(t, 'health', 'percent', 0.02)).toBeGreaterThan(pointsFor(t, 'attack', 'percent', 0.02))
  })
  it('ordena el siguiente nivel por lo que aporta a los Invokers que usas de cada elemento', () => {
    const { used } = usedHeroes(box, new Set())
    expect(used.map(u => u.hero.name)).not.toContain('BANQUILLO')
    const { options, unknown } = hallRanking(box, used)
    expect(options[0]).toMatchObject({ element: 'Fire', stat: 'attack', level: 5, next: 6, trophy: 'silver' })
    expect(options[0].beneficiaries.map(b => b.hero.name).sort()).toEqual(['FUEGO1', 'FUEGO2'])
    expect(options.find(o => o.element === 'Water' && o.stat === 'health')).toMatchObject({ next: 3, trophy: 'bronze' })
    // Viento: el único Invoker no se usa, así que no aporta nada.
    expect(options.filter(o => o.element === 'Wind').every(o => o.score === 0)).toBe(true)
    // Prob. crítico no se ha subido nunca: va a «sin dato», no al orden.
    expect(options.some(o => o.stat === 'criticalRate')).toBe(false)
    expect(unknown.some(o => o.stat === 'criticalRate' && o.element === 'Fire')).toBe(true)
  })
})
