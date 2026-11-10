import { describe, expect, it } from 'vitest'
import { decodeCollection, unpackSnapshot } from './memorypack'

const bytes = (...values: number[]) => new Uint8Array(values)
const join = (...pieces: Uint8Array[]) => { const result = new Uint8Array(pieces.reduce((n, x) => n + x.length, 0)); let at = 0; for (const piece of pieces) { result.set(piece, at); at += piece.length } return result }
const i32 = (value: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, value, true); return b }
const u64 = (value: bigint) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, value, true); return b }
const compact = (value: number) => value <= 127 ? bytes(value) : join(bytes(0x82), i32(value))
const object = (fields: Uint8Array[]) => join(bytes(fields.length), ...fields.map(x => compact(x.length)), ...fields)
const list = (...entries: { id: number; value: Uint8Array }[]) => join(i32(entries.length), ...entries.flatMap(x => [i32(x.id), x.value]))
const file = (name: string, tag: number, fields: Uint8Array[]) => ({ name, bytes: join(bytes(tag), object([u64(1n), u64(2n), object(fields)])) })

function fixture(owner = 1) {
  const hero = Array.from({ length: 22 }, () => bytes())
  hero[0] = i32(1); hero[1] = u64(1001n); hero[2] = i32(4); hero[3] = i32(40)
  hero[6] = bytes(1); hero[7] = bytes(0); hero[11] = join(i32(1), i32(1), i32(7))
  hero[12] = i32(0); hero[15] = i32(0)
  const titan = Array.from({ length: 13 }, () => bytes())
  titan[0] = i32(2); titan[1] = u64(2002n); titan[2] = i32(1); titan[3] = i32(20); titan[9] = i32(3); titan[10] = bytes(0)
  const bonus = object([i32(1), i32(13), u64(5n * 4294967296n), i32(4), u64(0n)])
  const relic = [i32(7), i32(1), i32(4), i32(3), i32(101), join(i32(1), i32(owner)), i32(12), bytes(1), join(i32(1), bonus)]
  return [
    file('PlayerHeroesModel.dat', 2, [i32(8), list({ id: 1, value: object(hero) })]),
    file('PlayerAnimasModel.dat', 3, [i32(3), list({ id: 2, value: object(titan) })]),
    file('PlayerRelicsModel.dat', 4, [i32(8), list({ id: 7, value: object(relic) })]),
  ]
}

describe('lector de inventario MemoryPack', () => {
  it('interpreta registros reales de tipo y verifica la relación entre héroe y reliquia', () => {
    const data = decodeCollection(fixture())
    expect(data.invokers).toMatchObject([{ inventoryId: 1, configId: '1001', level: 40, locked: true, relicIds: { 1: 7 } }])
    expect(data.titans).toMatchObject([{ inventoryId: 2, level: 20, empowermentLevel: 1 }])
    expect(data.relics).toMatchObject([{ inventoryId: 7, equippedHeroId: 1, bonuses: [{ stat: 13, value: 5 }] }])
    expect(data.warnings).toHaveLength(2)
  })
  it('rechaza un propietario incoherente y un archivo truncado', () => {
    expect(() => decodeCollection(fixture(99))).toThrow('relación entre equipo')
    const original = fixture()[0]
    expect(() => unpackSnapshot(original.name, original.bytes.subarray(0, -3))).toThrow()
  })
})
