import { describe, expect, it } from 'vitest'
import manifest from '../docs/game-assets-manifest.json'
const assetPaths = new Set(manifest.assets.map(x => x.path))
import { CHARACTERS, characterFor, compatibleWith, equipmentImage, SET_KEYS, setImage } from './catalog'
import identities from './catalog/observed-identities.json'
import type { Equipment, Invoker } from './memorypack'

describe('identidad e ilustraciones del juego', () => {
  it('conserva los identificadores grandes como texto y no asigna retratos por aproximación', () => {
    expect(characterFor({ configId: '17806611759643308' })?.name).toBe('Ozmol')
    expect(characterFor({ configId: '17857780043827674' })?.name).toBe('Grimnall')
    expect(characterFor({ configId: '17231248749422769' })?.name).toBe('Aratax')
    expect(characterFor({ configId: '17806611759643309' })).toBeUndefined()
    expect(characterFor({ configId: 'no-identificado' })).toBeUndefined()
  })
  it('cada correspondencia verificada resuelve un único personaje y un retrato local real', () => {
    expect(new Set(CHARACTERS.map(x => x.code)).size).toBe(CHARACTERS.length)
    for (const [configId, code] of Object.entries(identities)) expect(characterFor({ configId })?.code).toBe(code)
    for (const c of CHARACTERS) {
      expect(c.source.startsWith('https://www.invokers.com/')).toBe(true)
      for (const path of [c.portrait,c.elementIcon,c.roleIcon,c.factionIcon].filter(Boolean) as string[]) {
        expect(assetPaths.has(path)).toBe(true)
      }
    }
  })
  it('no propone accesorios incompatibles ni presume la facción de una identidad desconocida', () => {
    const ozmol = { configId: '17806611759643308' } as Invoker
    const accessory = { kind: 'accessory', setOrFaction: 9 } as Equipment
    expect(compatibleWith(accessory, ozmol)).toBe(true)
    expect(compatibleWith({...accessory, setOrFaction: 7}, ozmol)).toBe(false)
    expect(compatibleWith(accessory, { configId: 'sin-identificar' } as Invoker)).toBe(false)
    expect(compatibleWith({...accessory,kind:'relic'}, ozmol)).toBe(true)
    expect(compatibleWith(accessory, undefined)).toBe(false)
  })
  it('selecciona accesorios por facción y ranura y conserva el conjunto de las reliquias', () => {
    const base = { kind: 'accessory', slot: 1, setOrFaction: 1 } as Equipment
    expect(equipmentImage(base)).toContain('/ELD/Amulet.webp')
    expect(equipmentImage({...base,setOrFaction:7})).toContain('/NOC/Amulet.webp')
    expect(equipmentImage({...base,setOrFaction:999})).toBeUndefined()
    for (const id of Object.keys(SET_KEYS)) expect(assetPaths.has(setImage({...base,kind:'relic',setOrFaction:Number(id)}) || '')).toBe(true)
  })
})
