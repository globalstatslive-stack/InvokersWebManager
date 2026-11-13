import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import type { Boss } from './goal'
import { ASCENSION, ascendMaterial, ascendRanking, craftUnits, rangeXp, type OfficialTiers } from './ascension'

const hero = (id: number, code: string, o: { rarity?: string; rank: number; level: number; xp?: number; battles?: number; locked?: boolean; awake?: number; relics?: Record<string, number> }) => ({
  heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/${code}/portrait.webp`, shortName: code, rarity: o.rarity ?? 'Epic', class: 'RangedAttacker', faction: 'X' },
  rank: o.rank, level: o.level, maxLevel: o.rank * 10, awakeLevel: o.awake ?? 0, power: 100 * o.rank + o.level, locked: o.locked ?? false, battles: o.battles ?? 0,
  totalExperience: o.xp ?? 0, relicIdBySlot: o.relics ?? {}, accessoryIdBySlot: {}, stats: {},
})
const team = (key: string, mode: string, ids: number[], highest = 5) => ({ mode, key, label: key, difficultyLabel: 'Normal', highestLevel: highest, levels: [{ level: highest, bestTimeTeam: { slots: ids.map(heroId => ({ position: 'Front1', line: 'front', heroId })) } }] })
function fixture() {
  return {
    profile: { name: 'Prueba', level: 10, totalPower: 1 },
    heroes: [
      hero(1, 'USED', { rank: 5, level: 50, xp: 1618300, battles: 900, awake: 3 }),
      hero(2, 'BENCH', { rank: 5, level: 50, xp: 1618300 }),
      hero(3, 'HALF', { rank: 5, level: 43, xp: 900000, battles: 300 }),
      hero(4, 'USED', { rank: 4, level: 1 }), // copia repetida: material, no candidata a 5★
      hero(5, 'FOUR', { rank: 4, level: 40, xp: 646800, battles: 50 }),
      hero(6, 'LOCK', { rarity: 'Rare', rank: 3, level: 1, locked: true }),
      hero(7, 'GEAR', { rarity: 'Rare', rank: 3, level: 1, relics: { Weapon: 1 } }),
      hero(8, 'STAR', { rarity: 'Rare', rank: 3, level: 1 }), // única copia y de las mejores de la tier list: se guarda
      ...Array.from({ length: 6 }, (_, i) => hero(20 + i, `U${i}`, { rarity: 'Uncommon', rank: 2, level: 1 })),
      ...Array.from({ length: 2 }, (_, i) => hero(30 + i, `R${i}`, { rarity: 'Rare', rank: 3, level: 1 })),
    ],
    titans: [], accessories: [], relics: [{ id: 1, slot: 'Weapon', rank: 4, rarity: 'Rare', set: 'Attack', level: 0, equippedHeroId: 7, main: { stat: 'attack', mode: 'flat', value: 10 }, subs: [] }],
    teams: [team('boss1', 'dungeon', [1, 3, 5]), team('tower1', 'tower', [1])],
    rules: { maxGearLevel: 20, accessorySlotAwakeLevel: { Amulet: 0 }, relicSets: [] },
  }
}
const general = new Map([['USED', { tier: 'S', score: 4.9 }], ['BENCH', { tier: 'E', score: 2.6 }], ['HALF', { tier: 'A', score: 4.5 }], ['FOUR', { tier: 'B', score: 4.2 }], ['STAR', { tier: 'S+', score: 5 }],
  ...Array.from({ length: 6 }, (_, i) => [`U${i}`, { tier: 'D', score: 3.4 }] as [string, { tier: string; score: number }]), ...Array.from({ length: 2 }, (_, i) => [`R${i}`, { tier: 'C', score: 3.8 }] as [string, { tier: string; score: number }])])
const boss = { slug: 'boss1', name: 'Jefe', tier: { USED: { tier: 'S+', score: 5 }, HALF: { tier: 'B', score: 4.2 } }, stages: [] } as unknown as Boss
const T: OfficialTiers = { general, bosses: [boss] }

describe('reglas oficiales de ascensión', () => {
  it('tope de nivel, coste y XP por tramo (tabla oficial)', () => {
    expect([1, 2, 3, 4, 5, 6].map(ASCENSION.cap)).toEqual([10, 20, 30, 40, 50, 60])
    expect(ASCENSION.cost(5)).toBe(5)
    expect([10, 20, 30, 40, 50, 60].map(rangeXp)).toEqual([8000, 42000, 154000, 442800, 971500, 2196000])
    expect(rangeXp(60)).toBeGreaterThan(ASCENSION.totalXp[50]) // el último tramo cuesta más que los 50 primeros niveles
  })
})

describe('ranking de ascensión', () => {
  const box = parseOfficialBox(fixture())
  it('ordena por uso real y tier oficial; explica cada puesto', () => {
    const r = ascendRanking(box, 5, T)
    expect(r.map(c => c.hero.code)).toEqual(['USED', 'HALF', 'BENCH'])
    const [used, half, bench] = r
    expect(used.teams).toHaveLength(2)
    expect(used.atCap && used.xpToCap === 0).toBe(true)
    expect(used.cost).toBe(5)
    expect(used.xpNewRange).toBe(2196000)
    expect(used.bossTiers[0]).toMatchObject({ slug: 'boss1', tier: 'S+', record: 5 })
    expect(used.reasons.join(' ')).toMatch(/2 de tus equipos/)
    expect(half.atCap).toBe(false)
    expect(half.xpToCap).toBe(1618300 - 900000)
    expect(half.cautions.join(' ')).toMatch(/nivel 50/)
    expect(bench.cautions.join(' ')).toMatch(/No está en ninguno de tus equipos/)
    expect(used.score).toBeGreaterThan(bench.score)
  })
  it('una entrada por personaje: la copia de menos estrellas no es candidata', () => {
    const r = ascendRanking(box, 4, T)
    expect(r.map(c => c.hero.code)).toEqual(['FOUR'])
  })
  it('los equipos activos y el plan suman', () => {
    const base = ascendRanking(box, 4, T)[0].parts.use
    expect(ascendRanking(box, 4, T, { activeKeys: new Set(['dungeon:boss1:Normal']) })[0].parts.use).toBeGreaterThan(base)
  })
})

describe('material para ascender', () => {
  const box = parseOfficialBox(fixture())
  it('cuenta solo lo prudente', () => {
    const m = ascendMaterial(box, T)
    expect(m.byStars[2]).toHaveLength(6)
    expect(m.byStars[3].map(h => h.code).sort()).toEqual(['R0', 'R1']) // ni el bloqueado, ni el equipado, ni el S+ único
    expect(m.byStars[4].map(h => h.id)).toEqual([4]) // la copia repetida
    expect(m.total).toBe(9)
  })
  it('fusiona hacia arriba con la regla oficial y suma la XP de las bases', () => {
    const m = ascendMaterial(box, T)
    const c = craftUnits(m, 4)
    // 6 de 2★ → 2 de 3★ (2 bases a nivel 20); con los 2 raros, 4 de 3★ → 1 de 4★ (base ya a nivel 20, falta hasta el 30).
    expect(c.steps).toEqual([{ stars: 3, made: 2, xp: 100000 }, { stars: 4, made: 1, xp: 154000 }])
    expect(c.units).toBe(2) // la fabricada y la copia repetida de 4★
    expect(craftUnits(m, 5).units).toBe(0)
  })
})

// Comprobación opcional con una caja real que no se guarda en el repositorio: BOX_JSON=/ruta/caja.json npm test
const real = process.env.BOX_JSON
describe.skipIf(!real)('tabla oficial frente a una caja real', () => {
  it('los Invokers en su tope tienen exactamente la XP de la tabla oficial', async () => {
    const { readFileSync } = await import('node:fs')
    const box = parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8')))
    const atCap = box.heroes.filter(h => h.totalXp != null && h.level > 1 && h.level === ASCENSION.cap(h.rank))
    expect(atCap.length).toBeGreaterThan(0)
    for (const h of atCap) expect(h.totalXp, `${h.name} ${h.rank}★ nivel ${h.level}`).toBe(ASCENSION.totalXp[h.level])
    for (const h of box.heroes) expect(h.maxLevel, h.name).toBe(ASCENSION.cap(h.rank))
  })
})
