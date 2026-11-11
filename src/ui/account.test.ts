import { describe, expect, it } from 'vitest'
import { accountFrom } from './account'
import type { ImportRecord } from '../data'
// @ts-expect-error módulo JS de pruebas sin tipos
import { sampleBox } from '../../scripts/sample-box.mjs'

const record = (json: unknown, at: string): ImportRecord => ({ id: at, importedAt: at, source: 'official-link', missing: [], files: [{ name: 'caja.json', size: 1, digest: at, sample: '', formatHint: '', blob: new Blob([JSON.stringify(json)]) }] })
describe('regresión: una actualización fallida no sustituye la última caja válida', () => {
  it('una caja con referencias rotas no produce cuenta y la anterior sigue siendo válida', async () => {
    const good = record(sampleBox(), '2026-11-10')
    const brokenJson = sampleBox(); brokenJson.heroes[0].relicIdBySlot.Weapon = 99999
    const broken = record(brokenJson, '2026-11-11')
    await expect(accountFrom(broken, [broken, good])).rejects.toThrow()
    const a = await accountFrom(good, [broken, good])
    expect(a?.box.heroes.length).toBe(2)
  })
})
