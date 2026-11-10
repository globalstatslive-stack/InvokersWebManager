import { describe, expect, it } from 'vitest'
import { diffFiles, inspectHeader, missingNames, type ImportRecord } from './data'

describe('inspección de snapshots', () => {
  it('detecta contenedores por firma y conserva una muestra hexadecimal', () => {
    expect(inspectHeader(new Uint8Array([0x1f, 0x8b, 0x00])).formatHint).toContain('GZIP')
    expect(inspectHeader(new Uint8Array([0x01, 0x02])).formatHint).toBe('Formato sin identificar')
    expect(inspectHeader(new Uint8Array([0x02, 0x03, 0x08, 0x08])).formatHint).toContain('MemoryPack')
    expect(inspectHeader(new Uint8Array([0x01, 0x02])).sample).toBe('01 02')
  })
  it('muestra exactamente cuáles de los cinco modelos principales faltan', () => {
    expect(missingNames(['playerheroesmodel.dat', 'PlayerRelicsModel.dat'])).toEqual(['PlayerAnimasModel.dat', 'PlayerAccessoriesModel.dat', 'PlayerModel.dat'])
  })
  it('compara archivos por digest y conserva eliminaciones', () => {
    const file = (name: string, digest: string) => ({ name, digest, size: 1, sample: '', formatHint: '', blob: new Blob() })
    const before: ImportRecord = { id: '1', importedAt: '2026-11-01', files: [file('A.dat', 'a'), file('B.dat', 'b')], missing: [] }
    const after: ImportRecord = { id: '2', importedAt: '2026-11-02', files: [file('A.dat', 'c'), file('C.dat', 'd')], missing: [] }
    expect(diffFiles(after, before)).toEqual([
      { name: 'A.dat', kind: 'cambiado' }, { name: 'C.dat', kind: 'nuevo' }, { name: 'B.dat', kind: 'eliminado' },
    ])
  })
})
