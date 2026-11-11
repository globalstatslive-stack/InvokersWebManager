import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseOfficialBox, type Box } from './model'
import { mergeWithOfficial } from './merge'
import { BoxIndex, projectStats } from './stats'
// @ts-expect-error módulo JS de pruebas sin tipos
import { sampleBox } from '../../scripts/sample-box.mjs'

/** Simula lo que da la carpeta del juego: sin base, sin notas y con el equipo cambiado. */
function asFiles(official: Box, mutate: (b: Box) => void): Box {
  const b: Box = structuredClone({ ...official, source: 'files', setRules: [], teams: [], exact: false })
  b.heroes = b.heroes.map(h => ({ ...h, basis: null, gearBonus: null, stats: {}, skills: [], power: 0 }))
  b.relics = b.relics.map(g => ({ ...g, subs: g.subs.map(s => ({ ...s, grade: null })), mainAtMax: null, unequipGold: 0, icon: null }))
  mutate(b)
  return b
}
function check(official: Box) {
  const index = new BoxIndex(official)
  const hero = [...official.heroes].filter(h => Object.keys(h.relics).length).sort((a, b) => b.power - a.power)[0]
  const free = official.relics.find(g => g.equippedHeroId === null && g.slot === 'Weapon')!
  const files = asFiles(official, b => {
    const h = b.heroes.find(x => x.id === hero.id)!
    const old = b.relics.find(g => g.id === h.relics.Weapon)
    if (old) old.equippedHeroId = null
    b.relics.find(g => g.id === free.id)!.equippedHeroId = hero.id
    h.relics = { ...h.relics, Weapon: free.id }
  })
  const merged = mergeWithOfficial(files, official)
  const m = merged.heroes.find(h => h.id === hero.id)!
  const expected = projectStats(hero, [...index.equipped(hero).filter(g => g.slot !== 'Weapon'), free], index.rules)
  for (const k of ['health', 'attack', 'defense', 'criticalRate', 'accuracy']) expect(m.stats[k] ?? 0).toBeCloseTo(expected[k] ?? 0, 4)
  expect(merged.exact).toBe(true)
  expect(merged.teams.length).toBe(official.teams.length)
  expect(merged.relics.find(g => g.id === free.id)!.subs.map(s => s.grade)).toEqual(free.subs.map(s => s.grade))
  // Un Invoker que sube de nivel deja de ser exacto.
  const leveled = mergeWithOfficial(asFiles(official, b => { b.heroes.find(x => x.id === hero.id)!.level += 1 }), official)
  expect(leveled.heroes.find(h => h.id === hero.id)!.basis).toBeNull()
  expect(leveled.merge!.changedHeroes).toBe(1)
}

describe('combinar carpeta del juego con la caja oficial', () => {
  it('recalcula las estadísticas con el equipo actual (caja sintética)', () => check(parseOfficialBox(sampleBox())))
  const real = process.env.BOX_JSON
  it.runIf(!!real && existsSync(real))('recalcula las estadísticas con el equipo actual (caja real)', () => check(parseOfficialBox(JSON.parse(readFileSync(real!, 'utf8')))))
})
