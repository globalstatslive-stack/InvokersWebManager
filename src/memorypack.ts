/** Lector independiente del subconjunto MemoryPack observado en los snapshots.
 * Cada acceso comprueba límites; un esquema nuevo falla de forma explícita. */

export type Invoker = {
  inventoryId: number; catalogCode?: string; configId: string; rank: number; level: number;
  reportedStats?: Record<string, number>; reportedPower?: number;
  locked: boolean; inStorage: boolean; awakeLevel: number;
  relicIds: Record<number, number>; accessoryIds: Record<number, number>;
}
export type Titan = {
  inventoryId: number; catalogCode?: string; configId: string; rank: number; level: number;
  empowermentLevel: number; locked: boolean;
}
export type Bonus = { id: number; stat: number; value: number; level: number; rolls: number }
export type Equipment = {
  inventoryId: number; kind: 'relic' | 'accessory'; slot: number; rank: number;
  rarity: number; setOrFaction: number; level: number; ownerType: number; equippedHeroId?: number;
  bonuses: Bonus[];
}
export type Collection = {
  invokers: Invoker[]; titans: Titan[]; relics: Equipment[]; accessories: Equipment[];
  player?: { name: string; level: number };
  /** Monedas de arena y trofeos que tiene ahora (PlayerModel.dat, diccionario de recursos). */
  trophies?: { arenaCoins: number | null; bronze: number; silver: number; gold: number };
  /** Niveles de la Sala de trofeos (PlayerArenaModel.dat), con los identificadores del juego. */
  arenaHall?: { element: number; stat: number; level: number }[];
  warnings: string[];
}

type NamedBytes = { name: string; bytes: Uint8Array }
const TAGS: Record<string, number> = {
  'PlayerModel.dat': 1, 'PlayerHeroesModel.dat': 2, 'PlayerAnimasModel.dat': 3,
  'PlayerRelicsModel.dat': 4, 'PlayerAccessoriesModel.dat': 5, 'PlayerArenaModel.dat': 9,
}
/** Identificadores de recurso de la arena en PlayerModel.dat (comprobados con el contador del juego). */
export const ARENA_RESOURCES = { arenaCoins: 22, bronze: 23, silver: 24, gold: 25 } as const
const MAX_COLLECTION = 50_000

function fail(message: string): never { throw new Error(`Snapshot MemoryPack: ${message}`) }
function requireBytes(data: Uint8Array, at: number, length: number): void {
  if (!Number.isSafeInteger(at) || !Number.isSafeInteger(length) || at < 0 || length < 0 || at + length > data.length) fail('longitud fuera de los límites del archivo')
}
function view(data: Uint8Array, at: number, length: number): DataView {
  requireBytes(data, at, length)
  return new DataView(data.buffer, data.byteOffset + at, length)
}
function int32(data: Uint8Array, at = 0): number { return view(data, at, 4).getInt32(0, true) }
function uint32(data: Uint8Array, at = 0): number { return view(data, at, 4).getUint32(0, true) }
function uint16(data: Uint8Array, at = 0): number { return view(data, at, 2).getUint16(0, true) }
function uint64(data: Uint8Array, at = 0): bigint { return view(data, at, 8).getBigUint64(0, true) }
function bool(data: Uint8Array): boolean { if (data.length !== 1 || data[0] > 1) fail('booleano no válido'); return data[0] === 1 }
function fixed(data: Uint8Array): number { if (data.length !== 8) fail('valor de estadística no válido'); return Number(uint64(data)) / 4294967296 }
function exactly(data: Uint8Array, length: number, label: string): void { if (data.length !== length) fail(`${label}: tamaño inesperado`) }

function lengthCode(data: Uint8Array, at: number): [number, number] {
  requireBytes(data, at, 1)
  const tag = data[at++]
  if (tag <= 127) return [tag, at]
  const kinds: Record<number, [number, (v: DataView) => number]> = {
    0x87: [1, v => v.getUint8(0)], 0x86: [1, v => v.getInt8(0)],
    0x85: [2, v => v.getUint16(0, true)], 0x84: [2, v => v.getInt16(0, true)],
    0x83: [4, v => v.getUint32(0, true)], 0x82: [4, v => v.getInt32(0, true)],
  }
  const kind = kinds[tag]
  if (!kind) fail('codificación de longitud no admitida')
  return [kind[1](view(data, at, kind[0])), at + kind[0]]
}

export function versioned(data: Uint8Array, start = 0): { members: Uint8Array[]; end: number } {
  requireBytes(data, start, 1)
  const count = data[start]
  if (count < 1 || count > 80) fail('número de campos no admitido')
  let at = start + 1
  const lengths: number[] = []
  for (let i = 0; i < count; i++) {
    const [length, next] = lengthCode(data, at)
    if (length < 0) fail('longitud negativa')
    lengths.push(length); at = next
  }
  const members: Uint8Array[] = []
  for (const length of lengths) { requireBytes(data, at, length); members.push(data.subarray(at, at + length)); at += length }
  return { members, end: at }
}

export function unpackSnapshot(name: string, bytes: Uint8Array): Uint8Array[] {
  if (bytes.length < 21) fail(`${name}: archivo demasiado corto`)
  if (bytes[0] !== TAGS[name]) fail(`${name}: identificador de modelo inesperado`)
  const parsed = versioned(bytes, 1)
  if (parsed.end !== bytes.length || parsed.members.length !== 3 || parsed.members[0].length !== 8 || parsed.members[1].length !== 8) fail(`${name}: cabecera incompatible o truncada`)
  const model = versioned(parsed.members[2])
  if (model.end !== parsed.members[2].length) fail(`${name}: datos sobrantes en el modelo`)
  return model.members
}

function readRecords<T>(data: Uint8Array, minimumMembers: number, convert: (fields: Uint8Array[]) => T): T[] {
  const count = int32(data)
  if (count < 0 || count > MAX_COLLECTION) fail('recuento de elementos inválido')
  let at = 4
  const result: T[] = []
  const ids = new Set<number>()
  for (let i = 0; i < count; i++) {
    const key = uint32(data, at); at += 4
    const item = versioned(data, at); at = item.end
    if (item.members.length < minimumMembers || uint32(item.members[0]) !== key || ids.has(key)) fail('registro de inventario incoherente')
    ids.add(key)
    result.push(convert(item.members))
  }
  if (at !== data.length) fail('recuento distinto del contenido de la colección')
  return result
}

function pairs(data: Uint8Array, maximum = 64): Record<number, number> {
  if (!data.length) return {}
  const count = int32(data)
  if (count < 0 || count > maximum || data.length !== 4 + count * 8) fail('diccionario de identificadores inválido')
  const result: Record<number, number> = {}
  for (let i = 0; i < count; i++) result[uint32(data, 4 + 8 * i)] = uint32(data, 8 + 8 * i)
  return result
}

function bonuses(data: Uint8Array): Bonus[] {
  const count = int32(data)
  if (count < 0 || count > 16) fail('número de bonificaciones inválido')
  let at = 4
  const result: Bonus[] = []
  for (let i = 0; i < count; i++) {
    const item = versioned(data, at); at = item.end
    const f = item.members
    if (f.length < 5) fail('bonificación incompleta')
    f.slice(0, 2).forEach((x, j) => exactly(x, 4, `bonificación ${j}`))
    exactly(f[3], 4, 'nivel de bonificación')
    result.push({ id: uint32(f[0]), stat: uint32(f[1]), value: fixed(f[2]), level: uint32(f[3]), rolls: fixed(f[4]) })
  }
  if (at !== data.length) fail('bonificaciones con datos sobrantes')
  return result
}

function hero(f: Uint8Array[]): Invoker {
  for (const i of [0, 2, 3, 15]) exactly(f[i], 4, `campo de Invoker ${i}`)
  exactly(f[1], 8, 'configuración de Invoker')
  return {
    inventoryId: uint32(f[0]), configId: uint64(f[1]).toString(), rank: uint32(f[2]), level: uint32(f[3]),
    locked: bool(f[6]), inStorage: bool(f[7]), awakeLevel: uint32(f[15]),
    relicIds: pairs(f[11], 8), accessoryIds: pairs(f[12], 5),
  }
}
function titan(f: Uint8Array[]): Titan {
  for (const i of [0, 2, 3, 9]) exactly(f[i], 4, `campo de Titán ${i}`)
  exactly(f[1], 8, 'configuración de Titán')
  return { inventoryId: uint32(f[0]), configId: uint64(f[1]).toString(),
    empowermentLevel: uint32(f[2]), level: uint32(f[3]), rank: uint32(f[9]), locked: bool(f[10]) }
}
function equipment(kind: 'relic' | 'accessory', f: Uint8Array[]): Equipment {
  for (const i of [0, 1, 2, 3, 6]) exactly(f[i], 4, `campo de equipo ${i}`)
  exactly(f[4], kind === 'relic' ? 4 : 2, 'conjunto o facción')
  exactly(f[5], 8, 'propietario de equipo')
  const ownerType = uint32(f[5])
  const equippedHeroId = ownerType === 1 ? uint32(f[5], 4) : undefined
  return {
    inventoryId: uint32(f[0]), kind, slot: uint32(f[1]), rank: uint32(f[2]), rarity: uint32(f[3]),
    setOrFaction: kind === 'relic' ? uint32(f[4]) : uint16(f[4]), level: uint32(f[6]), ownerType,
    equippedHeroId: equippedHeroId || undefined, bonuses: bonuses(f[8]),
  }
}
function memoryString(data: Uint8Array): string {
  const marker = int32(data)
  if (marker === -1) return ''
  if (marker >= 0) { exactly(data, 4 + marker * 2, 'cadena UTF-16'); return new TextDecoder('utf-16le', { fatal: true }).decode(data.subarray(4)) }
  const bytes = ~marker
  if (bytes < 0 || bytes > 1024) fail('cadena demasiado larga')
  const chars = int32(data, 4)
  if (chars < 0 || chars > 1024) fail('longitud de cadena no válida')
  exactly(data, 8 + bytes, 'cadena UTF-8')
  return new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(8))
}

/** Diccionario de recursos actuales: objeto con un campo, recuento int32 y pares (id uint32, cantidad int32). */
export function resources(data: Uint8Array): Record<number, number> {
  const inner = versioned(data)
  if (inner.end !== data.length || inner.members.length !== 1) fail('recursos con formato inesperado')
  const d = inner.members[0], count = int32(d)
  if (count < 0 || count > 1024 || d.length !== 4 + count * 8) fail('recuento de recursos inválido')
  const out: Record<number, number> = {}
  for (let i = 0; i < count; i++) out[uint32(d, 4 + 8 * i)] = int32(d, 8 + 8 * i)
  return out
}
/** Mejoras de la Sala de trofeos: recuento int32 y registros (elemento, estadística, nivel). */
export function arenaHall(data: Uint8Array): { element: number; stat: number; level: number }[] {
  const count = int32(data)
  if (count < 0 || count > 6 * 12) fail('número de mejoras de la sala inválido')
  let at = 4
  const out: { element: number; stat: number; level: number }[] = []
  for (let i = 0; i < count; i++) {
    const item = versioned(data, at); at = item.end
    const f = item.members
    if (f.length < 3) fail('mejora de la sala incompleta')
    f.slice(0, 3).forEach((x, j) => exactly(x, 4, `mejora de la sala ${j}`))
    const element = uint32(f[0]), stat = uint32(f[1]), level = uint32(f[2])
    if (element < 1 || element > 6 || level > 15) fail('mejora de la sala fuera de rango')
    out.push({ element, stat, level })
  }
  if (at !== data.length) fail('mejoras de la sala con datos sobrantes')
  return out
}

export function decodeCollection(files: NamedBytes[]): Collection {
  const byName = new Map(files.map(file => [file.name.toLowerCase(), file]))
  const fields = (name: string): Uint8Array[] | undefined => {
    const file = byName.get(name.toLowerCase())
    return file ? unpackSnapshot(name, file.bytes) : undefined
  }
  const heroes = fields('PlayerHeroesModel.dat')
  const animas = fields('PlayerAnimasModel.dat')
  const relics = fields('PlayerRelicsModel.dat')
  if (!heroes || !animas || !relics) fail('faltan PlayerHeroesModel.dat, PlayerAnimasModel.dat o PlayerRelicsModel.dat')
  const accessories = fields('PlayerAccessoriesModel.dat')
  const player = fields('PlayerModel.dat')
  if (heroes.length < 2 || animas.length < 2 || relics.length < 2 || (accessories && accessories.length < 2)) fail('modelo de colección incompleto')
  const result: Collection = {
    invokers: readRecords(heroes[1], 16, hero),
    titans: readRecords(animas[1], 11, titan),
    relics: readRecords(relics[1], 9, f => equipment('relic', f)),
    accessories: accessories ? readRecords(accessories[1], 9, f => equipment('accessory', f)) : [],
    warnings: [],
  }
  if (player) {
    if (player.length < 5) fail('PlayerModel.dat incompleto')
    result.player = { name: memoryString(player[1]), level: uint32(player[4]) }
    // Trofeos: si el formato cambia, se avisa y el resto de la caja se lee igual.
    try {
      const r = player.length > 9 ? resources(player[9]) : {}
      if (ARENA_RESOURCES.bronze in r || ARENA_RESOURCES.silver in r || ARENA_RESOURCES.gold in r) {
        const n = (id: number) => Math.max(0, r[id] ?? 0)
        result.trophies = { arenaCoins: ARENA_RESOURCES.arenaCoins in r ? n(ARENA_RESOURCES.arenaCoins) : null, bronze: n(ARENA_RESOURCES.bronze), silver: n(ARENA_RESOURCES.silver), gold: n(ARENA_RESOURCES.gold) }
      }
    } catch { result.warnings.push('No se pudieron leer los trofeos de PlayerModel.dat.') }
  } else result.warnings.push('Falta PlayerModel.dat: los datos de cuenta son parciales.')
  try {
    const arena = fields('PlayerArenaModel.dat')
    if (arena && arena.length > 8) result.arenaHall = arenaHall(arena[8])
  } catch { result.warnings.push('No se pudo leer la Sala de trofeos de PlayerArenaModel.dat.') }
  if (!accessories) result.warnings.push('Falta PlayerAccessoriesModel.dat: no se muestran accesorios.')
  const heroesById = new Map(result.invokers.map(hero => [hero.inventoryId, hero]))
  for (const item of [...result.relics, ...result.accessories]) {
    if (!item.equippedHeroId) continue
    const owner = heroesById.get(item.equippedHeroId)
    if (!owner || !Object.values(item.kind === 'relic' ? owner.relicIds : owner.accessoryIds).includes(item.inventoryId)) fail('relación entre equipo e Invoker incoherente')
  }
  return result
}
