import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { BoxIndex, gearContribution } from './stats'
import { optimize } from './optimizer'
import { diagnose, sellCandidates } from './advisor'

const F = 2 ** 32
const piece = (id: number, slot: string, set: string, main: [string, string, number], owner: number | null, subs: [string, string, number, string][] = []) => ({
  id, slot, rank: 5, rarity: 'Epic', set, level: 20, equippedHeroId: owner, unequipGold: 100,
  main: { stat: main[0], mode: main[1], value: main[2] }, subs: subs.map(([stat, mode, value, grade]) => ({ stat, mode, value, grade })),
})
const SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
function fixture() {
  const relics = [
    ...SLOTS.map((s, i) => piece(i + 1, s, 'Health', ['health', 'flat', 100], 1)),
    ...SLOTS.map((s, i) => piece(i + 11, s, 'Attack', ['attack', 'percent', 0.1], null, [['criticalRate', 'percent', 0.02, 'B']])),
    piece(30, 'Weapon', 'CriticalRate', ['attack', 'flat', 300], 2),
  ]
  return {
    profile: { name: 'Prueba', level: 10, totalPower: 1 },
    heroes: [
      { heroId: 1, character: { portraitUrl: '/game-assets/1/characters/Ironbands/IRN036/portrait.webp', shortName: 'Ozmol', faction: 'Ironbands', class: 'RangedAttacker' }, rank: 5, level: 50, awakeLevel: 0, power: 10, locked: false,
        relicIdBySlot: Object.fromEntries(SLOTS.map((s, i) => [s, i + 1])), accessoryIdBySlot: {},
        stats: { health: 1000 + 800, attack: 500 }, gearBonus: { health: 800 + 200 * 0 }, basis: { health: 1000 * F, attack: 500 * F } },
      { heroId: 2, character: { portraitUrl: '/game-assets/1/characters/Magi/MAG017/portrait.webp' }, rank: 5, level: 50, awakeLevel: 0, power: 5, locked: true,
        relicIdBySlot: { Weapon: 30 }, accessoryIdBySlot: {}, stats: { attack: 800 }, gearBonus: { attack: 300 }, basis: { attack: 500 * F } },
    ],
    titans: [], accessories: [], relics, teams: [],
    rules: { maxGearLevel: 20, accessorySlotAwakeLevel: { Amulet: 0 }, relicSets: [
      { set: 'Health', name: 'Health', three: [], five: [], eight: [] },
      { set: 'Attack', name: 'Attack', three: [{ stat: 'attack', mode: 'percent', value: 0.1 }], five: [{ stat: 'attack', mode: 'percent', value: 0.2 }], eight: [] },
      { set: 'CriticalRate', name: 'Crit', three: [{ stat: 'criticalRate', mode: 'percent', value: 0.1 }], five: [], eight: [] },
    ] },
  }
}

describe('motor de estadísticas', () => {
  it('reproduce el aporte publicado del equipo', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    expect(gearContribution(box.heroes[0], index.equipped(box.heroes[0]), index.rules).health).toBe(800)
  })
  it('elige el conjunto de ataque completo y respeta Invokers bloqueados', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    const result = optimize(index, box.heroes[0], { weights: { attack: 10, criticalRate: 5 }, pool: 'unlocked' })
    expect(Object.values(result.relics).every(g => g?.set === 'Attack')).toBe(true)
    // 8 × 10 % + 30 % de conjunto (3 + 5 piezas) sobre 500 de base
    expect(result.after.attack).toBeCloseTo(500 + 500 * (0.8 + 0.3))
    expect(result.after.health).toBeCloseTo(1000)
    expect(result.changes.every(c => c.takenFrom === null)).toBe(true)
    expect(result.goldCost).toBe(800)
  })
  it('puede tomar piezas de Invokers bloqueados solo con el modo «todas»', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    const result = optimize(index, box.heroes[0], { weights: { attack: 1 }, pool: 'all', moveAversion: 0 })
    expect(result.relics.Weapon?.id).toBe(30)
    expect(result.changes.find(c => c.slot === 'Weapon')?.takenFrom?.id).toBe(2)
  })
  it('cumple un conjunto obligatorio', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    const result = optimize(index, box.heroes[0], { weights: { health: 10 }, pool: 'free', requiredSet: { set: 'Attack', pieces: 5 } })
    expect(Object.values(result.relics).filter(g => g?.set === 'Attack').length).toBeGreaterThanOrEqual(5)
  })
  it('devuelve propuestas alternativas distintas y respeta piezas reservadas', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    const r = optimize(index, box.heroes[0], { weights: { attack: 10, criticalRate: 5 }, pool: 'all', moveAversion: 0, alternatives: 5 })
    expect(r.alternatives!.length).toBeGreaterThanOrEqual(1)
    expect(r.alternatives![0]).toBe(r)
    expect(new Set(r.alternatives!.map(a => Object.values(a.relics).map(g => g?.id).join())).size).toBe(r.alternatives!.length)
    const reserved = new Set(Object.values(r.relics).map(g => `relic${g!.id}`))
    const r2 = optimize(index, box.heroes[0], { weights: { attack: 10 }, pool: 'all', reserved })
    expect(Object.values(r2.relics).every(g => !g || !reserved.has(`relic${g.id}`))).toBe(true)
  })
  it('con «nivel máximo» usa la principal al máximo publicada', () => {
    const raw = fixture(); (raw.relics[8] as Record<string, unknown>).mainAtMax = { stat: 'attack', mode: 'percent', value: 0.5 }
    const box = parseOfficialBox(raw), index = new BoxIndex(box)
    const r = optimize(index, box.heroes[0], { weights: { attack: 10 }, pool: 'free', maxLevel: true })
    expect(r.relics.Weapon!.main.value).toBe(0.5)
  })
  it('da recomendaciones sin errores', () => {
    const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
    expect(Array.isArray(sellCandidates(box))).toBe(true)
    expect(diagnose(box, index, box.heroes[1]).some(i => i.kind === 'empty')).toBe(true)
  })
})

// Comprobación opcional con una caja real que no se guarda en el repositorio: BOX_JSON=/ruta/caja.json npm test
const real = process.env.BOX_JSON
describe.runIf(!!real && existsSync(real))('caja real', () => {
  it('reproduce el aporte publicado de todos los Invokers', () => {
    const box = parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8'))), index = new BoxIndex(box)
    expect(box.exact).toBe(true)
    let checked = 0
    for (const h of box.heroes) {
      const c = gearContribution(h, index.equipped(h), index.rules)
      for (const [k, v] of Object.entries(h.gearBonus ?? {})) { expect(Math.abs((c[k] ?? 0) - v)).toBeLessThan(k.startsWith('critical') || k.endsWith('Tolerance') ? 0.002 : 1.01); checked++ }
    }
    expect(checked).toBeGreaterThan(0)
    const top = [...box.heroes].sort((a, b) => b.power - a.power)[0]
    const t0 = performance.now(), r = optimize(index, top, { weights: { attack: 10, criticalRate: 8, criticalDamage: 8 }, pool: 'unlocked' })
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(r.score).toBeGreaterThanOrEqual(r.scoreBefore - 1e-6)
  })
})

describe.runIf(!!real && existsSync(real))('objetivo de daño en caja real', () => {
  it('no empeora el daño efectivo y cumple mínimos alcanzables', () => {
    const box = parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8'))), index = new BoxIndex(box)
    const hero = [...box.heroes].filter(h => h.cls !== 'Support' && h.cls !== 'Tank').sort((a, b) => b.power - a.power)[0]
    const t0 = performance.now()
    const r = optimize(index, hero, { weights: { accuracy: 3, comboSpeed: 4, skillSpeed: 4, health: 1 }, pool: 'unlocked', objective: 'damage', minimums: { accuracy: 200 }, alternatives: 6 })
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(r.damageAfter).toBeGreaterThan(r.damageBefore)
    expect(r.score).toBeGreaterThanOrEqual(r.scoreBefore - 1e-6)
    expect(r.after.accuracy).toBeGreaterThanOrEqual(200)
    expect(r.alternatives!.length).toBeGreaterThan(2)
    expect(r.alternatives!.every(a => a.score <= r.score + 1e-9)).toBe(true)
  })
})
