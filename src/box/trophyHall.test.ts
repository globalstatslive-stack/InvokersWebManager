import { describe, expect, it } from 'vitest'
import { boxFromCollection, parseOfficialBox } from './model'
import { mergeWithOfficial } from './merge'
import { usedHeroes } from './equipBatch'
import { compareSteps, convertedPay, HALL, HALL_STATS, hallLevels, hallRanking, OFFICIAL_COSTS, perLevel, pointsFor, spendPlan } from './trophyHall'
import type { Collection } from '../memorypack'

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

describe('Sala de trofeos: compra paso a paso', () => {
  const box = parseOfficialBox(fixture())
  const { used } = usedHeroes(box, new Set())
  const { options } = hallRanking(box, used)
  it('sin costes conocidos se para en el primero y enseña lo que viene después', () => {
    const lanes = spendPlan(options, { bronze: 100, silver: 50, gold: 0 }, OFFICIAL_COSTS)
    expect(lanes.silver.steps).toHaveLength(1)
    expect(lanes.silver.steps[0]).toMatchObject({ from: 5, to: 6, cost: null, left: null })
    expect(lanes.silver.stop).toEqual({ kind: 'unknown-cost', level: 6 })
    expect(lanes.bronze.steps[0].option).toMatchObject({ element: 'Water', stat: 'health', next: 3 })
    expect(lanes.bronze.queue.length).toBeGreaterThan(0)
    expect(lanes.bronze.queue.every(o => !(o.element === 'Water' && o.stat === 'health'))).toBe(true)
    // Oro: ninguna mejora útil en el nivel 10.
    expect(lanes.gold).toMatchObject({ steps: [], stop: { kind: 'done' } })
  })
  it('con costes apuntados descuenta, sigue con la misma mejora dentro del tramo y para si no alcanza', () => {
    const lanes = spendPlan(options, { bronze: 0, silver: 100, gold: 0 }, { ...OFFICIAL_COSTS, 6: 30, 7: 40, 8: 50 })
    expect(lanes.silver.steps.map(s => [s.to, s.cost, s.left])).toEqual([[6, 30, 70], [7, 40, 30]])
    expect(lanes.silver.stop).toEqual({ kind: 'short', level: 8, cost: 50, missing: 20 })
    expect(lanes.silver.spent).toBe(70)
  })
  it('con los dos costes conocidos compara aporte por trofeo; si falta alguno, aporte y nivel más bajo', () => {
    const a = { ...options[0], score: 10, next: 2 }, b = { ...options[0], score: 12, next: 4 }
    expect(compareSteps(a, b, {})).toBeGreaterThan(0) // b aporta más
    expect(compareSteps(a, b, { 2: 20, 4: 60 })).toBeLessThan(0) // a rinde más por trofeo
  })
  it('si faltan trofeos de un tipo, el juego paga con los de más valor (nunca al revés)', () => {
    expect(convertedPay('bronze', 5, { bronze: 0, silver: 10, gold: 0 })).toEqual({ silver: 3, gold: 0 })
    expect(convertedPay('bronze', 6, { bronze: 0, silver: 1, gold: 1 })).toEqual({ silver: 1, gold: 1 })
    expect(convertedPay('silver', 3, { bronze: 50, silver: 0, gold: 1 })).toBeNull()
    expect(convertedPay('silver', 2, { bronze: 0, silver: 0, gold: 1 })).toEqual({ silver: 0, gold: 1 })
  })
})

describe('Sala de trofeos desde la carpeta del juego', () => {
  it('toma los niveles de la carpeta y el valor por nivel de la caja oficial', () => {
    const official = parseOfficialBox(fixture())
    const c: Collection = { invokers: [], titans: [], relics: [], accessories: [], warnings: [],
      arenaHall: [{ element: 1, stat: 4, level: 6 }, { element: 1, stat: 7, level: 1 }, { element: 9, stat: 4, level: 2 }] }
    const files = boxFromCollection(c)
    expect(files.arenaHall).toHaveLength(2)
    expect(Number.isNaN(files.arenaHall[0].value)).toBe(true)
    const merged = mergeWithOfficial(files, official)
    expect(hallLevels(merged).get('Fire:attack')).toEqual({ level: 6, value: expect.closeTo(0.12, 6) })
    // Prob. crítico: subido en la carpeta, pero la caja oficial no dice cuánto da: sigue sin dato.
    expect(perLevel(merged).has('criticalRate')).toBe(false)
    expect(hallLevels(merged).get('Fire:criticalRate')?.level).toBe(1)
  })
})
