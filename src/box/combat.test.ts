import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseOfficialBox } from './model'
import { landChance, loadKits, profileOf, simulate, skillLevels } from './combat'
import { BoxIndex } from './stats'
import { optimize } from './optimizer'

describe('precisión contra resistencia (guía oficial)', () => {
  it('reproduce los ejemplos publicados', () => {
    expect(landChance(400, 450)).toBeCloseTo(0.5)
    expect(landChance(320, 420)).toBeCloseTo(0.104)
    expect(landChance(60, 100)).toBeCloseTo(0.6)
    expect(landChance(500, 400)).toBe(1)
    expect(landChance(100, 220)).toBe(0)
  })
})
const real = process.env.BOX_JSON
describe.runIf(!!real && existsSync(real))('simulación con caja real', () => {
  it('Ozmol: reparto de combate plausible y perfil de atacante con precisión', async () => {
    const box = parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8'))), kits = await loadKits()
    const hero = box.heroes.find(h => h.code === 'IRN036')!, kit = kits[hero.code], levels = skillLevels(hero)
    const sim = simulate(box, kit, levels, hero.stats)
    const p = profileOf(hero, kit, levels)
    expect(p.scaling.attack).toBeGreaterThan(0.9)
    expect(p.needsAccuracy).toBe(true)
    expect(sim.damage).toBeGreaterThan(300000)
    expect(sim.damage).toBeLessThan(600000)
    // Más recuperación → más lanzamientos de habilidades.
    const more = simulate(box, kit, levels, { ...hero.stats, skillRecovery: (hero.stats.skillRecovery ?? 0) + 40 })
    expect(more.skills[2].casts).toBeGreaterThan(sim.skills[2].casts)
    // Optimizar con el objetivo de simulación mejora el índice y, contra un jefe de RES 300, busca precisión.
    const index = new BoxIndex(box)
    const run = (targetRes: number) => optimize(index, hero, { weights: {}, pool: 'unlocked', objective: 'sim', alternatives: 5, sim: { kit, levels, settings: { duration: 180, targetRes }, mix: p.mix } })
    const t0 = performance.now(), hard = run(475), soft = run(300)
    console.log('ms', Math.round(performance.now() - t0), 'RES475 idx', hard.index?.toFixed(1), 'dmg', Math.round(hard.simBefore!.damage), '→', Math.round(hard.sim!.damage), 'acc', hard.after.accuracy, '| RES300 idx', soft.index?.toFixed(1), 'dmg', Math.round(soft.sim!.damage), 'acc', Math.round(soft.after.accuracy), 'land', soft.sim!.land.toFixed(2), 'alts', soft.alternatives?.map(a => a.index?.toFixed(0)).join(','))
    expect(hard.index).toBeGreaterThan(100)
    expect(soft.sim!.land).toBeGreaterThan(0.5)
  })
})
