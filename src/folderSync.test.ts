import { describe, expect, it } from 'vitest'
import { selectSnapshots } from './folderSync'

const f = (name: string, dir: string) => ({ file: new File([new Uint8Array([1])], name), dir })
describe('selección de la carpeta del juego', () => {
  it('prefiere aggregate_snapshots y solo los modelos del jugador', () => {
    const out = selectSnapshots([f('PlayerHeroesModel.dat', 'aggregate_snapshots'), f('PlayerHeroesModel.dat', 'backup'), f('Settings.dat', 'Invokers'), f('PlayerRelicsModel.dat', 'aggregate_snapshots')])
    expect(out.map(x => x.name).sort()).toEqual(['PlayerHeroesModel.dat', 'PlayerRelicsModel.dat'])
  })
  it('explica qué hacer si la carpeta no tiene la caja', () => {
    expect(() => selectSnapshots([f('notas.txt', 'Invokers')])).toThrow(/Invokers/)
  })
})
