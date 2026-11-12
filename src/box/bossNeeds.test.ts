import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { BossCatalog } from './goal'
import { deriveNeeds, skillFit } from './bossNeeds'

const catalog = JSON.parse(readFileSync(new URL('../catalog/bosses.json', import.meta.url), 'utf8')) as BossCatalog
const boss = (slug: string) => catalog.bosses.find(b => b.slug === slug)!
const ids = (slug: string) => deriveNeeds(boss(slug)).map(n => n.id)

describe('qué pide cada jefe (habilidades de la guía oficial)', () => {
  it('todas las guías traen habilidades', () => {
    expect(catalog.bosses.every(b => (b.skills?.length ?? 0) > 0)).toBe(true)
  })
  it('Ulgorim: se cura con tótems, invoca, aturde, Plaga y quita maná', () => {
    expect(ids('ulgorim')).toEqual(expect.arrayContaining(['heal-reduction', 'aoe', 'cleanse', 'sustain', 'mana', 'amplify']))
    expect(deriveNeeds(boss('ulgorim')).find(n => n.id === 'heal-reduction')!.why).toMatch(/«/)
  })
  it('Althar: el Sangrado le hace invencible', () => {
    const avoid = deriveNeeds(boss('althar')).find(n => n.id === 'avoid-bleed')!
    expect(avoid.avoid).toBe(true)
    expect(avoid.effects).toEqual(['effect:Bleed'])
  })
  it('Garuda de Luz: curar destruye vida máxima', () => {
    expect(ids('omnissi-light')).toContain('avoid-heal')
  })
  it('Sorgott: se da mejoras y cura a sus ratas', () => {
    expect(ids('sorgott')).toEqual(expect.arrayContaining(['strip', 'heal-reduction', 'aoe']))
  })
  it('cruza necesidades con los efectos de un Invoker', () => {
    const needs = deriveNeeds(boss('althar'))
    const fit = skillFit({ effects: ['effect:Bleed', 'effect:DebuffDefense'], aoe: true }, needs)
    expect(fit.avoided.map(n => n.id)).toEqual(['avoid-bleed'])
    expect(fit.matched.map(n => n.id)).toEqual(expect.arrayContaining(['aoe', 'amplify']))
    expect(skillFit(undefined, needs)).toEqual({ matched: [], avoided: [] })
  })
})
