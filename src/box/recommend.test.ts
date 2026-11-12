import { describe, expect, it } from 'vitest'
import type { Box, Hero, Titan } from './model'
import type { Boss, BossStage } from './goal'
import type { Profile } from './combat'
import { bestCopies, recommendTeam, scoreCandidates } from './recommend'
import type { Need } from './bossNeeds'

const ELEMENTS = { names: ['Fire', 'Earth', 'Wind', 'Water', 'Light', 'Dark', 'Neutral'], sign: [[0, 1, 0, -1, 0, 0, 0], [-1, 0, 1, 0, 0, 0, 0], [0, -1, 0, 1, 0, 0, 0], [1, 0, -1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0]] }
const hero = (id: number, code: string, cls: string, element: string, power: number, stats: Record<string, number> = {}): Hero =>
  ({ id, code, name: code, fullName: code, cls, element, power, rank: 5, level: 50, awakeLevel: 3, stats: { accuracy: 0, resistance: 0, ...stats }, skills: [], relics: {}, accessories: {} }) as unknown as Hero
const titan = (id: number, code: string, stat: string): Titan => ({ id, code, name: code, power: 100, bound: { stat, mode: 'percent', specialization: 'General', general: 0.1, specialized: 0 } }) as unknown as Titan
const prof = (p: Partial<Profile>): Profile => ({ scaling: { attack: 1, defense: 0, health: 0 }, needsAccuracy: false, accuracySkills: [], debuffs: [], buffs: [], control: [], heals: false, shields: false, mix: { damage: 1, control: 0, sustain: 0, tough: 0 }, ...p })

const stage: BossStage = { stage: 5, label: 'Stage 5', element: 'Earth', hp: 1, atk: 1, def: 1, acc: 100, res: 200, tolerance: -50, accGoal: 200, resGoal: 220, tolGoal: 150 }
const boss = (tier: Record<string, string>): Boss => ({ slug: 'testboss', name: 'Jefe', epithet: '', category: 'Relic Boss', guide: '', portrait: '', corruptions: [{ key: 'Daze', kind: '' }], tierListUrl: null, stages: [stage],
  tier: Object.fromEntries(Object.entries(tier).map(([k, t]) => [k, { tier: t, score: { 'S+': 4.9, S: 4.5, 'A+': 4, A: 3.5, B: 3, C: 2.5, D: 2, E: 1 }[t] ?? 1 }])) })

const heroes = [
  hero(1, 'TANK', 'Tank', 'Light', 5000, { dazeTolerance: 2 }),
  hero(2, 'HEAL', 'Support', 'Light', 4000, { dazeTolerance: 2 }),
  hero(3, 'FIRE', 'MeleeAttacker', 'Fire', 6000, { dazeTolerance: 2 }),
  hero(4, 'WIND', 'RangedAttacker', 'Wind', 6000, { dazeTolerance: 2 }),
  hero(5, 'DEB', 'Support', 'Dark', 5000, { dazeTolerance: 2, accuracy: 150 }),
  { ...hero(6, 'WEAK', 'MeleeAttacker', 'Dark', 1000), rank: 2, level: 20, awakeLevel: 0 } as Hero,
  hero(7, 'FIRE', 'MeleeAttacker', 'Fire', 2000),
  hero(8, 'DPS2', 'RangedAttacker', 'Dark', 5500, { dazeTolerance: 2 }),
]
const profiles = new Map<number, Profile | null>([[2, prof({ heals: true, mix: { damage: 0.4, control: 0, sustain: 0.6, tough: 0 } })], [5, prof({ needsAccuracy: true, accuracySkills: ['x'] })]])
const box = { heroes, titans: [titan(50, 'TATK', 'attack'), titan(51, 'THP', 'health')], teams: [{ mode: 'dungeon', key: 'testboss', highestLevel: 4, levels: [{ level: 4, slots: [{ heroId: 1 }, { heroId: 6 }] }] }] } as unknown as Box
const all = { TANK: 'B', HEAL: 'B', FIRE: 'B', WIND: 'B', DEB: 'B', WEAK: 'B', DPS2: 'B' }

describe('equipo recomendado para un jefe', () => {
  it('una copia por personaje, cinco miembros, con tanque y curación', () => {
    expect(bestCopies(heroes).filter(h => h.code === 'FIRE').map(h => h.id)).toEqual([3])
    const r = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map())
    expect(r.picks).toHaveLength(5)
    expect(new Set(r.picks.map(p => p.hero.code)).size).toBe(5)
    expect(r.picks.some(p => p.role === 'tank')).toBe(true)
    expect(r.picks.some(p => p.profile?.heals)).toBe(true)
    expect(r.picks.some(p => p.hero.id === 7)).toBe(false)
  })
  it('sin «usar mi equipamiento», el poder actual no decide; con él, sí', () => {
    const lowPower = { ...all, WIND: 'B', DPS2: 'B' }
    const free = scoreCandidates(box, boss(lowPower), stage, profiles, ELEMENTS)
    expect(free.find(c => c.hero.code === 'TANK')!.parts.power).toBeDefined()
    const a = free.find(c => c.hero.code === 'HEAL')!, b = free.find(c => c.hero.code === 'DEB')!
    expect(a.parts.official).toBe(b.parts.official)
    const geared = scoreCandidates(box, boss(lowPower), stage, profiles, ELEMENTS, undefined, undefined, undefined, true)
    expect(geared.find(c => c.hero.code === 'DPS2')!.score).toBeGreaterThan(free.find(c => c.hero.code === 'DPS2')!.score)
  })
  it('la nota oficial del jefe pesa más que un poco más de poder', () => {
    const r = scoreCandidates(box, boss({ ...all, WIND: 'S+', DPS2: 'E' }), stage, profiles, ELEMENTS)
    expect(r.findIndex(c => c.hero.code === 'WIND')).toBeLessThan(r.findIndex(c => c.hero.code === 'DPS2'))
  })
  it('ventaja y desventaja de elemento según la tabla oficial', () => {
    const r = scoreCandidates(box, boss(all), stage, profiles, ELEMENTS)
    expect(r.find(c => c.hero.code === 'FIRE')!.elementSign).toBe(1) // Fuego contra Tierra
    expect(r.find(c => c.hero.code === 'WIND')!.elementSign).toBe(-1) // Aire contra Tierra
    expect(r.find(c => c.hero.code === 'FIRE')!.score).toBeGreaterThan(r.find(c => c.hero.code === 'WIND')!.score)
  })
  it('avisa de precisión y tolerancia insuficientes', () => {
    const r = recommendTeam(box, boss({ ...all, DEB: 'S+', WEAK: 'S+' }), stage, profiles, ELEMENTS, new Map(), { needTank: false, needSustain: false })
    const deb = r.picks.find(p => p.hero.code === 'DEB')!
    expect(deb.accOk).toBe(false)
    expect(deb.gear.join(' ')).toMatch(/PREC 150 de 200/)
    const weak = r.picks.find(p => p.hero.code === 'WEAK')
    if (weak) expect(weak.gear.join(' ')).toMatch(/Tolerancia al 0 %/)
    expect(r.gaps.join(' ')).toMatch(/PREC 200/)
  })
  it('descartar quita al Invoker y lo sustituye', () => {
    const base = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map())
    const out = base.picks[0].hero.id
    const r = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map(), { exclude: new Set([out]) })
    expect(r.picks.some(p => p.hero.id === out)).toBe(false)
    expect(r.picks).toHaveLength(5)
  })
  it('cada Titán va a un solo miembro, según su bonificación vinculada', () => {
    const r = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map([['TATK', 'S'], ['THP', 'A']]))
    const titans = r.picks.map(p => p.titan?.titan.code).filter(Boolean)
    expect(new Set(titans).size).toBe(titans.length)
    expect(titans).toContain('TATK')
    const hp = r.picks.find(p => p.titan?.titan.code === 'THP')
    expect(hp && ['tank', 'sustain'].includes(hp.role)).toBe(true)
  })
  it('compara con el equipo del récord', () => {
    const r = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map())
    expect(r.record?.highest).toBe(4)
    expect(r.overlap).toBeGreaterThanOrEqual(1)
  })
  it('propone cambios que cubren una habilidad que falta, sin perder tanque ni curación', () => {
    const cleanse: Need = { id: 'cleanse', label: 'Limpiar o evitar perjuicios', why: 'test', effects: ['block:RemoveStatusEffect:PurgeDebuffs'] }
    const byCode = new Map([['WEAK', { effects: ['block:RemoveStatusEffect:PurgeDebuffs'], aoe: false }]])
    const r = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map(), { skills: { needs: [cleanse], byCode } })
    expect(r.picks.some(p => p.hero.code === 'WEAK')).toBe(false)
    expect(r.needs[0].coveredBy).toHaveLength(0)
    const swap = r.swaps[0]
    expect(swap.in.hero.code).toBe('WEAK')
    expect(['tank', 'sustain']).not.toContain(swap.out.role)
    expect(swap.delta).toBeLessThan(0) // WEAK está poco desarrollado (2★, nv. 20)
    // Aplicar el cambio: entra el elegido y sale el sustituido.
    const after = recommendTeam(box, boss(all), stage, profiles, ELEMENTS, new Map(), { skills: { needs: [cleanse], byCode }, include: [swap.in.hero.id], exclude: new Set([swap.out.hero.id]) })
    expect(after.picks.map(p => p.hero.id)).toContain(swap.in.hero.id)
    expect(after.picks.map(p => p.hero.id)).not.toContain(swap.out.hero.id)
    expect(after.needs[0].coveredBy.map(h => h.code)).toEqual(['WEAK'])
  })
})
