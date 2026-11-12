import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { cooldown, landChance, ticks, type Detail, type Spires, type Tiers, type Tools, type WikiIndex } from './data'
import { landChance as simLand } from '../box/combat'
import { RichText, esNum } from '../ui/wiki/kit'

const dir = new URL('../catalog/wiki/', import.meta.url)
const json = <T,>(f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as T
const index = json<WikiIndex>('index.json'), tools = json<Tools>('tools.json'), tiers = json<Tiers>('tiers.json'), spires = json<Spires>('spires.json')

describe('datos oficiales de la enciclopedia', () => {
  it('cada Invoker y Titán del índice tiene ficha con habilidades y retrato', () => {
    expect(index.invokers.length).toBeGreaterThanOrEqual(200)
    expect(index.titans.length).toBeGreaterThanOrEqual(30)
    for (const kind of ['invokers', 'titans'] as const) {
      const files = new Set(readdirSync(new URL(`${kind}/`, dir)))
      for (const s of index[kind]) {
        expect(files.has(`${s.slug}.json`), s.slug).toBe(true)
        expect(s.portraitUrl, s.slug).toMatch(/\/characters\/.+\/portrait\.webp$/)
      }
      expect(files.size).toBe(index[kind].length)
    }
  })
  it('los efectos de cada Invoker cuadran con los recuentos oficiales', () => {
    for (const e of index.effects) expect(index.invokers.filter(s => s.effects.includes(e.key)).length, e.key).toBe(e.count)
  })
  it('el catálogo base coincide con el índice (nuevos personajes incluidos)', () => {
    const chars = JSON.parse(readFileSync(new URL('../catalog/characters.json', import.meta.url), 'utf8')) as { code: string }[]
    expect(new Set(chars.map(c => c.code))).toEqual(new Set([...index.invokers, ...index.titans].map(s => s.code)))
  })
  it('las descripciones solo llevan el marcado permitido', () => {
    for (const kind of ['invokers', 'titans'] as const) for (const f of readdirSync(new URL(`${kind}/`, dir))) {
      const d = json<Detail>(`${kind}/${f}`)
      expect(d.skills.length, f).toBeGreaterThan(0)
      for (const s of d.skills) for (const l of s.levels) for (const t of [l.d, l.dm ?? '']) expect(t.replace(/<\/?(?:n|u|d|y|b|i)>|<br>/g, ''), `${f} ${s.name}`).not.toMatch(/[<>]/)
    }
  })
  it('las tier lists apuntan a personajes del índice', () => {
    const codes = new Set([...index.invokers, ...index.titans].map(s => s.code))
    for (const k of ['invokers', 'titans'] as const) {
      const entries = tiers[k].rows.flatMap(r => r.entries)
      expect(entries.length).toBeGreaterThan(20)
      for (const e of entries) expect(codes.has(e.code!), e.slug).toBe(true)
    }
  })
  it('seis agujas de 120 pisos con PREC y RES', () => {
    expect(spires.spires).toHaveLength(6)
    for (const s of spires.spires) {
      expect(s.floors).toHaveLength(120)
      expect(s.floors.every(f => f.level > 0 && f.res >= 0 && f.waves.some(w => w.enemies.length))).toBe(true)
    }
  })
})

describe('calculadoras con las tablas oficiales', () => {
  it('precisión contra resistencia reproduce los ejemplos publicados', () => {
    expect(landChance(tools, { accuracy: 400, resistance: 450 }).land).toBeCloseTo(50)
    expect(landChance(tools, { accuracy: 320, resistance: 420 }).land).toBeCloseTo(10.4)
    expect(landChance(tools, { accuracy: 500, resistance: 400 }).land).toBe(100)
    expect(landChance(tools, { accuracy: 100, resistance: 220 }).land).toBe(0)
    // Mejoras y perjuicios en puntos de probabilidad; el elemento resta resistencia según la matriz oficial.
    expect(landChance(tools, { accuracy: 400, resistance: 450, accUp: 10 }).land).toBeCloseTo(60)
    expect(landChance(tools, { accuracy: 400, resistance: 450, resUp: 10 }).land).toBeCloseTo(40)
    const i = tools.elements.indexOf('Fire'), j = tools.elements.indexOf('Earth')
    expect(landChance(tools, { accuracy: 400, resistance: 450, caster: 'Fire', target: 'Earth' }).land).toBeCloseTo(50 + tools.elementDebuffDelta[i][j])
  })
  it('el simulador usa la misma tabla', () => {
    for (const [a, r] of [[200, 260], [300, 375], [0, 50], [400, 300]]) expect(simLand(a, r)).toBeCloseTo(landChance(tools, { accuracy: a, resistance: r }).land / 100)
  })
  it('recuperación y ticks', () => {
    expect(cooldown(tools, { base: 20, rating: 0 }).real).toBe(20)
    const c = cooldown(tools, { base: 20, rating: 200 })
    expect(c.real).toBeCloseTo(20 / (1 + c.pct / 100))
    expect(c.arena).toBe(20 * tools.arenaInitialCooldownFactor)
    expect(ticks(tools, { duration: 10, interval: 1, rating: 0 }).base).toHaveLength(10)
    expect(ticks(tools, { duration: 10, interval: 1, rating: 1000 }).modified.length).toBeGreaterThanOrEqual(10)
  })
})

describe('textos', () => {
  it('RichText nunca inserta HTML', () => {
    const html = renderToStaticMarkup(createElement(RichText, { src: 'Hace <n>143</n> de daño <img src=x onerror=alert(1)><br><i>#1 Damage: 155% ATK</i>' }))
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('<b class="rt-n">143</b>')
  })
  it('cifras del portal en formato español', () => {
    expect(esNum('9,442')).toBe('9442')
    expect(esNum('1,136,500')).toBe('1.136.500')
    expect(esNum('1.4%')).toBe('1,4%')
    expect(esNum('155% ATK')).toBe('155% ATK')
  })
})
