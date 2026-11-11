import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { BoxIndex } from './stats'
import { conflicts, diagnoseMember, jointTeam, loadBosses, sequentialTeam, type Boss } from './goal'
import { whoBenefits } from './usefulness'
import { entryFrom, planConflicts, progressOf } from '../ui/plan'
import { optimize } from './optimizer'
// @ts-expect-error módulo JS de pruebas sin tipos
import { sampleBox } from '../../scripts/sample-box.mjs'

const boss: Boss = { slug: 'x', name: 'Jefe de prueba', epithet: '', category: 'Relic Boss', guide: '', portrait: '', corruptions: [{ key: 'Blight', kind: 'Damage' }], tierListUrl: null, tier: {}, stages: [{ stage: 1, label: 'Stage 1', element: 'Fire', hp: 1, atk: 1, def: 1, acc: 105, res: 300, tolerance: -60, accGoal: 300, resGoal: 225, tolGoal: 160 }] }

describe('objetivo y equipo', () => {
  it('diagnostica contra los objetivos publicados sin inventar requisitos', () => {
    const box = parseOfficialBox(sampleBox()), index = new BoxIndex(box)
    const d = diagnoseMember(box, index, box.heroes[0], null, boss, boss.stages[0])
    expect(d.checks.map(c => c.key)).toEqual(['accuracy', 'resistance', 'blightTolerance'])
    expect(d.checks[0].applies).toBe('unknown')
    expect(d.checks.find(c => c.key === 'resistance')!.ok).toBe(false)
    expect(d.missingKit).toBe(true)
  })
  it('equipo: nunca asigna una pieza a dos Invokers y la conjunta no empeora la secuencial', () => {
    const box = parseOfficialBox(sampleBox()), index = new BoxIndex(box)
    const members = box.heroes.map(h => ({ heroId: h.id, options: { weights: { damage: 10 }, objective: 'damage' as const, pool: 'all' as const } }))
    const seq = sequentialTeam(index, members), joint = jointTeam(index, members)
    expect(conflicts(seq.builds)).toEqual([])
    expect(conflicts(joint.builds)).toEqual([])
    expect(joint.total).toBeGreaterThanOrEqual(seq.total - 1e-9)
  })
  it('¿a quién le sirve? mide la mejora al sustituir su pieza de esa ranura', () => {
    const box = parseOfficialBox(sampleBox()), index = new BoxIndex(box)
    const free = box.relics.find(g => g.equippedHeroId === null && g.set === 'Attack' && g.slot === 'Pauldrons')!
    const u = whoBenefits(index, free, box.heroes)
    expect(u.length).toBeGreaterThan(0)
    expect(u[0].gain).toBeGreaterThan(0)
  })
  it('plan: impide la misma pieza en dos Invokers y comprueba lo aplicado al reimportar', () => {
    const box = parseOfficialBox(sampleBox()), index = new BoxIndex(box)
    const [a, b] = box.heroes
    const ra = optimize(index, a, { weights: { damage: 10 }, objective: 'damage', pool: 'free' })
    const ea = entryFrom(a, ra)
    const eb = { ...entryFrom(b, ra), heroId: b.id }
    expect(planConflicts([ea], eb).length).toBeGreaterThan(0)
    const nothingYet = progressOf(ea, a)
    expect(nothingYet.done).toBe(false)
    expect(nothingYet.pending.length).toBe(ra.changes.length)
    const applied = { ...a, relics: Object.fromEntries(Object.entries(ra.relics).filter(([, g]) => g).map(([s, g]) => [s, g!.id])) }
    expect(progressOf(ea, applied).pending.filter(s => s in ea.relics)).toEqual([])
  })
})

const real = process.env.BOX_JSON
describe.runIf(!!real && existsSync(real))('objetivo con caja real', () => {
  it('Ulgorim fase 16: datos oficiales y diagnóstico de un miembro', async () => {
    const box = parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8'))), index = new BoxIndex(box)
    const cat = await loadBosses(), ulg = cat.bosses.find(b => b.slug === 'ulgorim')!, s16 = ulg.stages.find(s => s.stage === 16)!
    expect([s16.res, s16.acc, s16.tolGoal]).toEqual([475, 105, 160])
    const d = diagnoseMember(box, index, box.heroes[0], null, ulg, s16)
    expect(d.checks.length).toBe(4)
  })
})
