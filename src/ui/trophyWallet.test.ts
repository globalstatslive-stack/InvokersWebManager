import { describe, expect, it } from 'vitest'
import { folderWallet, pickWallet, savedWallet, type WalletData } from './trophyWallet'
import type { ImportRecord } from '../data'

const rec = (importedAt: string, name: string, trophies?: { bronze: number; silver: number; gold: number; arenaCoins: number | null }, modified?: number): ImportRecord => ({
  id: importedAt, importedAt, missing: [], source: 'files',
  files: [{ name: 'PlayerModel.dat', size: 1, digest: '', sample: '', formatHint: '', blob: Object.assign(new Blob(['x']), modified ? { lastModified: modified } : {}) } as ImportRecord['files'][number]],
  collection: { invokers: [], titans: [], relics: [], accessories: [], warnings: [], player: { name, level: 1 }, trophies },
})

describe('trofeos del jugador', () => {
  it('de la carpeta: la importación más reciente de ese perfil, con la hora del archivo del juego', () => {
    const t = Date.parse('2026-11-10T13:59:00Z')
    const records = [rec('2026-11-12T10:00:00Z', 'Otro', { bronze: 9, silver: 9, gold: 9, arenaCoins: 9 }), rec('2026-11-11T10:00:00Z', 'Yo', { bronze: 96, silver: 12, gold: 0, arenaCoins: 15020 }, t), rec('2026-11-01T10:00:00Z', 'Yo', { bronze: 1, silver: 1, gold: 1, arenaCoins: 1 })]
    expect(folderWallet(records, 'Yo')).toEqual({ bronze: 96, silver: 12, gold: 0, coins: 15020, at: new Date(t).toISOString(), source: 'carpeta' })
    expect(folderWallet([rec('2026-11-11T10:00:00Z', 'Yo')], 'Yo')).toBeNull()
  })
  it('usa el dato más reciente entre carpeta y captura o escrito', () => {
    const folder: WalletData = { bronze: 96, silver: 12, gold: 0, coins: 15020, at: '2026-11-10T13:59:00.000Z', source: 'carpeta' }
    const shot: WalletData = { bronze: 58, silver: 143, gold: 0, coins: 18400, coinsApprox: true, at: '2026-11-15T20:00:00.000Z', source: 'captura' }
    expect(pickWallet(folder, shot)).toBe(shot)
    expect(pickWallet({ ...folder, at: '2026-11-16T00:00:00.000Z' }, shot)?.source).toBe('carpeta')
    expect(pickWallet(folder, { ...shot, at: null })).toBe(folder)
    expect(pickWallet(null, null)).toBeNull()
  })
  it('sin almacenamiento del navegador no hay nada guardado', () => {
    expect(savedWallet('Yo')).toBeNull()
  })
})
