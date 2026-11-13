import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { BoxIndex } from './stats'
import { adviseAll, BOSS_ONLY_SETS, coachContext, GRADE_TABLE, gradeFor, outlookOf, projectedGear, rollBand, rollUnits, SUB_POOL, MAIN_POOL } from './gearCoach'
import gear from '../catalog/wiki/gear.json'

const F = 2 ** 32
type Sub = [string, string, number, number, string]
const piece = (id: number, slot: string, o: { set?: string; rank?: number; rarity?: string; level?: number; owner?: number | null; main: [string, string, number]; max?: number; subs?: Sub[]; faction?: string }) => ({
  id, slot, rank: o.rank ?? 4, rarity: o.rarity ?? 'Epic', set: o.set ?? null, faction: o.faction ?? null, level: o.level ?? 20, equippedHeroId: o.owner ?? null, unequipGold: 100,
  main: { stat: o.main[0], mode: o.main[1], value: o.main[2] }, mainAtMax: o.max === undefined ? null : { stat: o.main[0], mode: o.main[1], value: o.max },
  subs: (o.subs ?? []).map(([stat, mode, value, rolls, grade]) => ({ stat, mode, value, rolls, grade })),
})
const SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
const MAIN: Record<string, [string, string, number]> = { Weapon: ['attack', 'flat', 50], Shield: ['defense', 'flat', 50], Helmet: ['health', 'flat', 100], Pauldrons: ['attack', 'percent', 0.1], Gauntlets: ['attack', 'percent', 0.2], Chestplate: ['health', 'percent', 0.1], Belt: ['health', 'percent', 0.1], Boots: ['health', 'percent', 0.1] }
function fixture() {
  const worn = SLOTS.map((s, i) => piece(i + 1, s, { set: 'Health', level: s === 'Boots' ? 15 : 20, owner: 1, main: MAIN[s], max: s === 'Boots' ? 0.15 : undefined, subs: [['criticalRate', 'percent', 0.022, 0, 'B'], ['accuracy', 'flat', 12, 0, 'B']] }))
  worn[2] = piece(3, 'Helmet', { set: 'Health', rank: 3, level: 10, owner: 1, main: MAIN.Helmet, max: 120 })
  const relics = [...worn,
    piece(20, 'Weapon', { set: 'Attack', main: ['attack', 'flat', 300] }), // mejora ya a Ozmol
    piece(21, 'Weapon', { set: 'Attack', main: ['attack', 'flat', 200] }), // también, pero la ranura ya tiene una mejor
    piece(22, 'Helmet', { set: 'Health', rank: 3, level: 0, main: ['health', 'flat', 10] }), // 3★ libre
    piece(23, 'Helmet', { set: 'Health', rank: 4, level: 0, main: ['health', 'flat', 10], max: 50 }), // libre de más rango para el casco 3★
    piece(24, 'Gauntlets', { set: 'Attack', rank: 5, rarity: 'Epic', level: 0, main: ['attack', 'percent', 0.05], max: 0.4, subs: [['accuracy', 'flat', 15, 0, 'C'], ['comboSpeed', 'flat', 8, 0, 'D'], ['resistance', 'flat', 10, 0, 'D']] }), // los guantes no admiten críticos como subestadística
    piece(25, 'Boots', { set: 'DazeTolerance', rank: 4, rarity: 'Rare', level: 0, main: ['resistance', 'flat', 5], max: 20, subs: [['resistance', 'flat', 12, 0, 'B']] }),
    piece(26, 'Belt', { set: 'Attack', rank: 4, level: 0, main: ['attack', 'percent', 0.01], max: 0.02 }),
  ]
  const accessories = [piece(40, 'Amulet', { faction: 'Magi', rank: 4, rarity: 'Rare', level: 0, main: ['attack', 'flat', 10] })]
  return {
    profile: { name: 'Prueba', level: 10, totalPower: 1 },
    heroes: [{ heroId: 1, character: { portraitUrl: '/game-assets/1/characters/Ironbands/IRN036/portrait.webp', shortName: 'Ozmol', faction: 'Ironbands', class: 'RangedAttacker' }, rank: 5, level: 50, awakeLevel: 6, power: 10, locked: false,
      relicIdBySlot: Object.fromEntries(SLOTS.map((s, i) => [s, i + 1])), accessoryIdBySlot: {},
      stats: { health: 2000, attack: 900, criticalRate: 0.3, criticalDamage: 0.5 }, gearBonus: { health: 1000, attack: 400 }, basis: { health: 1000 * F, attack: 500 * F, defense: 300 * F } }],
    titans: [], relics, accessories, teams: [],
    rules: { maxGearLevel: 20, accessorySlotAwakeLevel: { Amulet: 0, Earrings: 2 }, relicSets: [{ set: 'Health', name: 'Health', three: [], five: [], eight: [] }, { set: 'Attack', name: 'Attack', three: [], five: [], eight: [] }] },
  }
}
const run = (reserved = new Map<string, string>()) => {
  const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
  const all = adviseAll(coachContext(index, { candidates: box.heroes, important: new Set([1]), reserved }))
  return new Map(all.map(a => [`${a.gear.kind}${a.gear.id}`, a]))
}

describe('reglas oficiales de las piezas', () => {
  it('la tabla de notas coincide con la guía oficial (actualizada cada semana)', () => {
    const official = gear.grades.map(r => ({ rolls: Number(r.roll.split(' ')[0]), total: Number(r.total.replace('%', '')), grade: r.grade }))
    expect(GRADE_TABLE.flatMap((row, rolls) => row.map(([total, grade]) => ({ rolls, total, grade })))).toEqual(official)
  })
  it('notas y márgenes de tirada', () => {
    expect(rollBand(0, 'D')).toEqual([70, 80])
    expect(rollBand(0, 'B')).toEqual([100, 100])
    expect(rollBand(2, 'S')).toEqual([300, 300])
    expect(rollBand(4, 'S')).toEqual([430, 500])
    expect(gradeFor(3, 280)).toBe('C') // el ejemplo de la guía
    expect(gradeFor(1, 200)).toBe('A')
  })
  it('hitos: la rareza decide cuántos desbloquean y cuántos mejoran', () => {
    const g = (rarity: string, level: number, subs: number) => ({ slot: 'Weapon', level, rarity, main: { stat: 'attack', mode: 'flat' }, subs: Array.from({ length: subs }, (_, i) => ({ stat: ['accuracy', 'resistance', 'skillSpeed', 'comboSpeed'][i], mode: 'flat', rolls: 0 })) }) as never
    expect(outlookOf(g('Rare', 0, 2), () => true, []).events).toEqual(['unlock', 'unlock', 'upgrade', 'upgrade'])
    expect(outlookOf(g('Legendary', 0, 4), () => true, []).events).toEqual(['upgrade', 'upgrade', 'upgrade', 'upgrade'])
    expect(outlookOf(g('Epic', 10, 4), () => true, []).events).toEqual(['upgrade', 'upgrade'])
    const common = outlookOf(g('Common', 0, 0), () => true, [])
    expect(common.events).toEqual(['unlock', 'unlock', 'unlock', 'unlock'])
    expect(common.pUseful).toBeNull()
    // Grupo de desbloqueo: subestadísticas oficiales del arma que aún no tiene (ni su principal).
    expect(outlookOf(g('Rare', 0, 2), () => true, []).pool.size).toBe(SUB_POOL.get('Weapon')!.length - 2)
  })
  it('tablas oficiales de ranuras traducidas a la caja', () => {
    for (const slot of [...SLOTS, 'Amulet', 'Earrings', 'Banner', 'Talisman', 'Flasks']) { expect(SUB_POOL.get(slot)?.length, slot).toBeGreaterThan(5); expect(MAIN_POOL.get(slot)?.length, slot).toBeGreaterThan(0) }
    expect(SUB_POOL.get('Weapon')).not.toContain('attack:flat')
    expect(MAIN_POOL.get('Weapon')).toEqual(['attack:flat'])
    expect(BOSS_ONLY_SETS.has('DazeTolerance') && BOSS_ONLY_SETS.has('IgnoreDefense')).toBe(true)
    expect(BOSS_ONLY_SETS.has('Health')).toBe(false)
  })
  it('valor de una tirada máxima leído de la caja (nota B = 100 %, C = 90 %)', () => {
    const box = parseOfficialBox(fixture())
    const u = new Map([...rollUnits(box), ['skillSpeed:flat:5', 9]])
    expect(u.get('criticalRate:percent:4')).toBeCloseTo(0.022)
    expect(u.get('accuracy:flat:5')).toBeCloseTo(15 / 0.9)
    const p = projectedGear(box.relics.find(g => g.id === 24)!, u)
    expect(p.main.value).toBe(0.4)
    expect(p.subs.length).toBe(4) // 3 propias + una fracción del desbloqueo esperado (Vel. habilidad)
    expect(p.subs[3].value).toBeCloseTo(1 / (SUB_POOL.get('Gauntlets')!.length - 4) * (1 + 3 / 4) * 0.85 * 9)
  })
})

describe('veredictos del coach', () => {
  it('equipada: subir, sustituir antes de subir o completa', () => {
    const r = run()
    expect(r.get('relic8')!.verdict).toBe('upgrade') // botas +15 de Ozmol
    expect(r.get('relic1')!.verdict).toBe('done')
    const helm = r.get('relic3')!
    expect(helm.verdict).toBe('replace')
    expect(helm.why).toMatch(/120.*50|más rango/)
  })
  it('libre: una sola pieza por ranura e Invoker; la otra lo explica', () => {
    const r = run()
    expect(r.get('relic20')!.verdict).toBe('equip')
    expect(r.get('relic20')!.best!.hero.name).toBe('Ozmol')
    const other = r.get('relic21')!
    expect(other.verdict).toBe('sell')
    expect(other.why).toMatch(/otra pieza libre mejor/)
  })
  it('libre: 3★ se vende; tolerancia escasa se guarda; reservada se guarda', () => {
    expect(run().get('relic22')!.verdict).toBe('sell')
    expect(run().get('relic25')!.verdict).toBe('keep')
    expect(run(new Map([['relic22', 'Ozmol']])).get('relic22')!.verdict).toBe('keep')
  })
  it('libre con futuro: se prueba hasta el siguiente hito y dice qué vigilar', () => {
    const a = run().get('relic24')!
    expect(a.verdict).toBe('test')
    expect(a.title).toBe('Pruébala hasta +5')
    expect(a.watch).toMatch(/Al \+5 se desbloquea/)
    expect(run().get('relic26')!.verdict).toBe('sell') // ni al +20 mejora a Ozmol
  })
  it('accesorio de una facción que no tienes: vender', () => {
    const a = run().get('accessory40')!
    expect(a.verdict).toBe('sell')
    expect(a.why).toMatch(/Magi/)
  })
  it('cada veredicto explica su razonamiento por bloques y con su fuente', () => {
    for (const a of run().values()) {
      expect(a.sections.map(s => s.title)[0]).toBe('Qué es')
      expect(a.sections).toHaveLength(5)
      expect(a.sections.every(s => s.steps.every(st => ['oficial', 'tu caja', 'cálculo', 'criterio'].includes(st.tag) && st.text.length > 10))).toBe(true)
      expect(a.sections.at(-1)!.steps[0].text).toContain(a.title)
    }
  })
})
