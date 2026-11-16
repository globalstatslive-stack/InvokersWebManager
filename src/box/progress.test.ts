import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { progressBetween, recordAt } from './progress'
import { accountStatsDelta, parseAccountStats } from './accountStats'
import { changeSummary, levelChanges } from './skillDiff'

const F = 2 ** 32
const hero = (id: number, extra: Record<string, unknown> = {}) => ({
  heroId: id, character: { portraitUrl: `/game-assets/1/characters/X/H${id}/portrait.webp`, shortName: `H${id}`, element: 'Fire', class: 'Tank', rarity: 'Rare' },
  rank: 4, level: 40, awakeLevel: 1, awakeNodesUnlocked: 3, power: 1000, relicIdBySlot: {}, accessoryIdBySlot: {},
  skillLevels: [{ kind: 'Combo', level: 0 }], stats: { attack: 500, health: 5000 }, basis: { attack: 400 * F, health: 4000 * F }, gearBonus: {}, ...extra,
})
const team = (levels: { level: number; v: number; d: number; t: number }[], highest: number) => ({ mode: 'dungeon', key: 'ulgorim', label: 'Ulgorim', difficultyLabel: 'Normal', highestLevel: highest,
  levels: levels.map(l => ({ level: l.level, bestTimeSeconds: l.t, victories: l.v, defeats: l.d, bestTimeTeam: { slots: [{ position: 'Front1', line: 'front', heroId: 1 }] } })) })
const box = (h: Record<string, unknown>, t: ReturnType<typeof team>) => parseOfficialBox({ profile: { name: 'P' }, heroes: [hero(1, h), hero(2)], relics: [], accessories: [], titans: [], teams: [t], rules: {} })

describe('Evolución entre importaciones', () => {
  const before = box({}, team([{ level: 5, v: 10, d: 2, t: 120 }], 5))
  it('separa los cambios de la cuenta de los resultados en combate', () => {
    const after = box({ rank: 5, skillLevels: [{ kind: 'Combo', level: 2 }], awakeNodesUnlocked: 5, stats: { attack: 600, health: 5000 } }, team([{ level: 5, v: 13, d: 2, t: 95 }, { level: 6, v: 1, d: 1, t: 200 }], 6))
    const p = progressBetween(before, after)
    expect(p.heroes[0].items).toEqual(expect.arrayContaining(['4★ → 5★', 'Combo 1 → 3', '2 nodos de despertar']))
    expect(p.heroes[0].stats).toEqual([{ stat: 'attack', from: 500, to: 600 }])
    expect(p.highest).toEqual([{ mode: 'dungeon', key: 'ulgorim', label: 'Ulgorim', from: 5, to: 6 }])
    expect(p.records.find(r => r.level === 5)).toMatchObject({ victories: 3, defeats: 0, bestTime: { from: 120, to: 95 } })
    expect(p.records.find(r => r.level === 6)).toMatchObject({ fresh: true, victories: 1, defeats: 1 })
    expect(p.battles).toBe(5)
  })
  it('sin combates nuevos lo dice (0 combates), aunque cambien las estadísticas', () => {
    const after = box({ stats: { attack: 700, health: 5000 } }, team([{ level: 5, v: 10, d: 2, t: 120 }], 5))
    const p = progressBetween(before, after)
    expect(p.battles).toBe(0)
    expect(p.records).toEqual([])
    expect(p.heroes.length).toBe(1)
  })
  it('récord de una fase concreta', () => {
    expect(recordAt(before, 'dungeon', 'ulgorim', 5)).toEqual({ victories: 10, defeats: 2, bestTime: 120, highest: 5 })
    expect(recordAt(before, 'dungeon', 'ulgorim', 9)).toEqual({ victories: 0, defeats: 0, bestTime: 0, highest: 5 })
    expect(recordAt(before, 'tower', 'x', 1)).toBeNull()
  })
})

describe('Account Stats (forma de la página oficial)', () => {
  const sample = (won: number, league: string) => ({ authenticated: true, playerId: 'p', general: { profileName: 'P', totalBattles: 100 + won, arenaBattlesWon: won, highestArenaLeague: 'Gold I', mostUsedInvokers: [{ configId: 5, name: 'Ozmol', battles: 300 }, { name: '' }], campaignProgress: 'Hard 3.1' },
    battles: { totalBattles: 100 + won, bosses: [{ key: 'ulgorim', name: 'Ulgorim', element: 'Fire', highestStage: 11, fastestTimeSeconds: 70, battles: 240 }], arena: { currentLeague: league, offenseBattles: 50 + won, defenseBattles: 20, lifetimeDefenseWinRate: 0.5 }, spires: [{ key: 'fire', element: 'Fire', highestFloor: 39 }] } })
  it('lee los campos que muestra la página y descarta lo que no es válido', () => {
    const s = parseAccountStats(sample(10, 'Silver II'), '2026-11-16T00:00:00Z')!
    expect(s.mostUsed).toEqual([{ configId: 5, name: 'Ozmol', battles: 300 }])
    expect(s.arena).toMatchObject({ currentLeague: 'Silver II', highestLeague: 'Gold I', battlesWon: 10 })
    expect(s.bosses[0]).toMatchObject({ key: 'ulgorim', highestStage: 11, fastestTimeSeconds: 70 })
    expect(parseAccountStats({ authenticated: false, general: null })).toBeNull()
    expect(parseAccountStats('nada')).toBeNull()
  })
  it('compara dos lecturas', () => {
    const d = accountStatsDelta(parseAccountStats(sample(10, 'Silver II'))!, parseAccountStats(sample(14, 'Silver I'))!)
    expect(d).toMatchObject({ arenaWon: 4, totalBattles: 4, offense: 4, defense: 0, league: { from: 'Silver II', to: 'Silver I' } })
  })
})

describe('Qué cambia al subir una habilidad (texto oficial)', () => {
  const L = (level: number, cd: string, d: string) => ({ level, crown: level === 11, cd, cost: '0', d })
  it('enfriamiento, efectos, duraciones y multiplicadores', () => {
    const a = L(2, '27s', 'Casts a <d>[20% ACC Down]</d> debuff, lasting <y>4s</y>.<br><i>#1 Damage: 100% ATK</i>')
    const b = L(3, '26s', 'Casts a <d>[22% ACC Down]</d> debuff, lasting <y>4.5s</y>. Casts <u>[Shield]</u>.<br><i>#1 Damage: 110% ATK</i>')
    const c = levelChanges(a, b)
    expect(c).toEqual(expect.arrayContaining([
      { what: 'Enfriamiento', from: '27 s', to: '26 s', better: true },
      { what: '[ACC Down]', from: '20 %', to: '22 %', better: true },
      { what: 'Duración de [ACC Down]', from: '4 s', to: '4,5 s', better: true },
      { what: 'Efecto nuevo', from: '—', to: '[Shield]', better: true },
    ]))
    expect(c.find(x => x.what === 'Daño')?.to).toContain('+10 %')
    expect(changeSummary(c)).toMatch(/^nuevo \[Shield\] · enfriamiento 27 s → 26 s/)
  })
  it('combos de varios golpes: media por golpe', () => {
    const a = L(1, '-', '#1 Attacks, dealing 10 damage.<br>Damage: 10% ATK<br>#2 Attacks.<br>Damage: 20% ATK')
    const b = L(2, '-', '#1 Attacks, dealing 11 damage.<br>Damage: 11% ATK<br>#2 Attacks.<br>Damage: 22% ATK')
    expect(levelChanges(a, b)).toEqual([{ what: 'Daño', from: '2 golpes', to: '+10 % por golpe', better: true }])
  })
})
