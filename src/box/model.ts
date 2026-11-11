/** Modelo normalizado de una cuenta, construido a partir de la caja compartida oficial
 * (`/api/lamb/<código>`) o, con menos datos, de los snapshots `.dat`. */
import { CHARACTERS, characterFor, RELIC_KEYS, ACCESSORY_KEYS, SET_KEYS, RARITY_ORDER, type Character } from '../catalog'
import type { Collection } from '../memorypack'

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'
export type Bonus = { stat: string; mode: 'flat' | 'percent'; value: number; rolls: number; grade: Grade | null }
export type Gear = {
  id: number; kind: 'relic' | 'accessory'; slot: string; rank: number; rarity: string
  set: string | null; faction: string | null; level: number; equippedHeroId: number | null
  main: Bonus; subs: Bonus[]; mainAtMax: Bonus | null; unequipGold: number; icon: string | null
}
export type Character2 = {
  code: string; name: string; fullName: string; portrait: string; rarity: string
  element: string | null; cls: string | null; role: string | null; faction: string
  soulSign: string | null; soulSignIcon: string | null; boundIcon: string | null
}
export type Hero = Character2 & {
  id: number; rank: number; level: number; maxLevel: number; awakeLevel: number; locked: boolean
  power: number; battles: number; skills: { kind: string; level: number }[]
  relics: Record<string, number>; accessories: Record<string, number>
  /** Estadísticas totales publicadas por el portal. */
  stats: Record<string, number>
  /** Aporte del equipo publicado por el portal (piezas + conjuntos). */
  gearBonus: Record<string, number> | null
  /** Estadísticas base (sin equipo), ya convertidas desde coma fija. */
  basis: Record<string, number> | null
  activeSets: { set: string; pieces: number; tiers: number[] }[]
}
export type Titan = Character2 & {
  id: number; rank: number; level: number; locked: boolean; power: number; battles: number; empowerment: number
  bound: { stat: string; mode: string; specialization: string; general: number; specialized: number } | null
  boundBonuses: Bonus[]; flatBonuses: Bonus[]
}
export type SetRule = { set: string; name: string; three: Bonus[]; five: Bonus[]; eight: Bonus[]; flags: string[]; threeDescription: string }
export type TeamSlot = { position: string; line: string; heroId: number; titanId: number | null }
export type TeamRecord = {
  mode: string; key: string; label: string; detail: string | null; icon: string | null; element: string | null
  difficulty: string; highestLevel: number
  levels: { level: number; bestTime: number; victories: number; defeats: number; formation: string | null; slots: TeamSlot[] }[]
}
export type Box = {
  source: 'official-link' | 'files'
  profile: { name: string; level: number; avatar: string | null; clan: string | null; totalPower: number }
  heroes: Hero[]; titans: Titan[]; relics: Gear[]; accessories: Gear[]
  teams: TeamRecord[]
  setRules: SetRule[]
  arenaHall: { element: string; stat: string; mode: string; level: number; value: number }[]
  accessorySlotAwake: Record<string, number>
  mainStatsBySlot: Record<string, string[]>
  ratingCurves: Record<string, number[]> | null
  maxGearLevel: number
  snapshotAt: string | null; expiresAt: string | null; sharePath: string | null
  /** Datos completos de estadísticas disponibles (habilita el optimizador exacto). */
  exact: boolean
  /** Prefijo remoto de las imágenes del juego para recursos que no están en la web. */
  assetBase: string | null
  /** Presente si la cuenta combina la carpeta del juego con la última caja oficial. */
  merge?: { officialSnapshot: string | null; exactHeroes: number; changedHeroes: number }
}

const FIXED = 2 ** 32
const fail = (s: string): never => { throw Error(`Caja oficial: ${s}`) }
const obj = (x: unknown): Record<string, any> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, any> : fail('objeto inválido')
const list = (x: unknown): any[] => x == null ? [] : Array.isArray(x) && x.length <= 50000 ? x : fail('lista inválida')
const int = (x: unknown, label: string) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : fail(`${label} inválido`)
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : 0
const str = (x: unknown) => typeof x === 'string' ? x : null
const numbers = (x: unknown) => {
  const out: Record<string, number> = {}
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

/** Convierte `/game-assets/<versión>/ruta` en la ruta del recurso. */
export function assetPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  const m = /^\/game-assets\/[^/]+\/(.+)$/.exec(url)
  return m ? `game/${m[1]}` : null
}
const assetBaseOf = (url: unknown) => typeof url === 'string' ? /^(\/game-assets\/[\w.-]+\/)/.exec(url)?.[1] ?? null : null
const codeFrom = (portrait: string | null) => /\/([^/]+)\/portrait\.webp$/.exec(portrait ?? '')?.[1] ?? ''

function character(raw: unknown): Character2 {
  const c = obj(raw), portrait = assetPath(c.portraitUrl) ?? ''
  const code = codeFrom(portrait), known = CHARACTERS.find(x => x.code === code)
  return {
    code, portrait,
    name: str(c.shortName) ?? known?.name ?? str(c.name) ?? code,
    fullName: str(c.name) ?? known?.fullName ?? code,
    rarity: str(c.rarity) ?? known?.rarity ?? 'Common',
    element: str(c.element) ?? (known?.kind === 'invokers' ? known.element : null),
    cls: str(c.class) ?? (known?.kind === 'invokers' ? known.role : null),
    role: str(c.role) ?? (known?.kind === 'titans' ? known.role : null),
    faction: str(c.faction) ?? known?.faction ?? '—',
    soulSign: str(c.soulSign), soulSignIcon: assetPath(c.soulSignIconUrl), boundIcon: assetPath(c.boundEffectIconUrl),
  }
}
function bonus(raw: unknown): Bonus {
  const b = obj(raw)
  const stat = str(b.stat) ?? fail('bonificación sin estadística')
  const grade = typeof b.grade === 'string' && /^[SABCD]$/.test(b.grade) ? b.grade as Grade : null
  return { stat, mode: b.mode === 'percent' ? 'percent' : 'flat', value: num(b.value), rolls: num(b.rolls), grade }
}
function gear(raw: unknown, kind: 'relic' | 'accessory'): Gear {
  const r = obj(raw)
  return {
    id: int(r.id, 'id de pieza'), kind, slot: str(r.slot) ?? fail('pieza sin ranura'), rank: num(r.rank), rarity: str(r.rarity) ?? 'Common',
    set: str(r.set), faction: str(r.faction), level: num(r.level),
    equippedHeroId: r.equippedHeroId == null ? null : int(r.equippedHeroId, 'propietario'),
    main: bonus(r.main), subs: list(r.subs).map(bonus), mainAtMax: r.mainAtMax ? bonus(r.mainAtMax) : null,
    unequipGold: num(r.unequipGold), icon: assetPath(r.iconUrl),
  }
}
const decodeFixed = (x: unknown) => { const out: Record<string, number> = {}; for (const [k, v] of Object.entries(numbers(x))) out[k] = v / FIXED; return out }

/** Lee el JSON de `/api/lamb/<código>`. Valida la estructura y las referencias entre piezas y propietarios. */
export function parseOfficialBox(value: unknown): Box {
  const root = obj(value)
  if (!Array.isArray(root.heroes) || !Array.isArray(root.relics)) fail('no parece una caja compartida de Invokers')
  const heroes: Hero[] = list(root.heroes).map(raw => {
    const r = obj(raw)
    const activeSets = list(r.activeSets).map(s => ({ set: String(s.set), pieces: num(s.pieces), tiers: list(s.activeTiers).map(num) }))
    return {
      ...character(r.character), id: int(r.heroId, 'heroId'), rank: num(r.rank), level: num(r.level), maxLevel: num(r.maxLevel),
      awakeLevel: num(r.awakeLevel), locked: r.locked === true, power: num(r.power), battles: num(r.battles),
      skills: list(r.skillLevels).map(s => ({ kind: String(s.kind), level: num(s.level) })),
      relics: numbers(r.relicIdBySlot), accessories: numbers(r.accessoryIdBySlot), stats: numbers(r.stats),
      gearBonus: r.gearBonus ? numbers(r.gearBonus) : null,
      basis: r.basis ? decodeFixed(r.basis) : null, activeSets,
    }
  })
  const titans: Titan[] = list(root.titans).map(raw => {
    const r = obj(raw), s = r.stats ? obj(r.stats) : {}
    const b = r.boundEffect ? obj(r.boundEffect) : null
    return {
      ...character(r.character), id: int(r.titanId, 'titanId'), rank: num(r.rank), level: num(r.level), locked: r.locked === true,
      power: num(r.power), battles: num(r.battles), empowerment: num(r.empowerment),
      bound: b ? { stat: String(b.stat), mode: String(b.mode), specialization: String(b.specialization), general: num(b.general), specialized: num(b.specialized) } : null,
      boundBonuses: list(s.boundBonuses).map(bonus), flatBonuses: list(s.flatBonuses).map(bonus),
    }
  })
  const relics = list(root.relics).map(x => gear(x, 'relic')), accessories = list(root.accessories).map(x => gear(x, 'accessory'))
  const unique = (ids: number[], label: string) => { if (new Set(ids).size !== ids.length) fail(`${label} repetidos`) }
  unique(heroes.map(h => h.id), 'Invokers'); unique(titans.map(h => h.id), 'Titanes'); unique(relics.map(g => g.id), 'reliquias'); unique(accessories.map(g => g.id), 'accesorios')
  const heroIds = new Set(heroes.map(h => h.id))
  for (const g of [...relics, ...accessories]) if (g.equippedHeroId !== null && !heroIds.has(g.equippedHeroId)) fail('una pieza pertenece a un Invoker ausente')
  const rules = root.rules ? obj(root.rules) : {}
  const setRules: SetRule[] = list(rules.relicSets).map(s => ({
    set: String(s.set), name: String(s.name ?? s.set), three: list(s.three).map(bonus), five: list(s.five).map(bonus), eight: list(s.eight).map(bonus),
    flags: list(s.flags).map(String), threeDescription: String(s.threeDescription ?? ''),
  }))
  const teams: TeamRecord[] = list(root.teams).map(raw => {
    const r = obj(raw)
    return {
      mode: String(r.mode), key: String(r.key), label: String(r.label ?? r.key), detail: str(r.detail), icon: assetPath(r.iconUrl),
      element: str(r.element), difficulty: String(r.difficultyLabel ?? ''), highestLevel: num(r.highestLevel),
      levels: list(r.levels).map(l => {
        const team = l.bestTimeTeam ? obj(l.bestTimeTeam) : null
        return {
          level: num(l.level), bestTime: num(l.bestTimeSeconds), victories: num(l.victories), defeats: num(l.defeats),
          formation: team ? str(team.formation) : null,
          slots: team ? list(team.slots).map(s => ({ position: String(s.position), line: String(s.line), heroId: num(s.heroId), titanId: s.titanId == null ? null : num(s.titanId) })) : [],
        }
      }),
    }
  })
  const profile = root.profile ? obj(root.profile) : {}
  const sharing = root.sharing ? obj(root.sharing) : {}
  const curves = root.ratingCurves ? obj(root.ratingCurves) : null
  return {
    source: 'official-link',
    profile: { name: String(profile.name ?? 'Jugador').slice(0, 80), level: num(profile.level), avatar: assetPath(profile.avatarUrl), clan: str(profile.clanAbbreviation), totalPower: num(profile.totalPower) },
    heroes, titans, relics, accessories, teams, setRules,
    arenaHall: list(root.arenaHallBonuses).map(a => ({ element: String(a.element), stat: String(a.stat), mode: String(a.mode), level: num(a.level), value: num(a.value) })),
    accessorySlotAwake: numbers(rules.accessorySlotAwakeLevel),
    mainStatsBySlot: { ...Object.fromEntries(Object.entries(rules.relicMainStatsBySlot ?? {}).map(([k, v]) => [k, list(v).map(String)])), ...Object.fromEntries(Object.entries(rules.accessoryMainStatsBySlot ?? {}).map(([k, v]) => [k, list(v).map(String)])) },
    ratingCurves: curves ? Object.fromEntries(Object.entries(curves).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).map(num)])) : null,
    maxGearLevel: num(rules.maxGearLevel) || 20,
    snapshotAt: str(sharing.snapshotAt) ?? str(root.computedAt), expiresAt: str(sharing.expiresAt), sharePath: str(sharing.sharePath),
    exact: heroes.length > 0 && heroes.every(h => h.basis && h.gearBonus) && setRules.length > 0,
    assetBase: assetBaseOf(profile.avatarUrl) ?? assetBaseOf(obj(list(root.heroes)[0] ?? {}).character?.portraitUrl),
  }
}

const STAT_IDS: Record<number, [string, 'flat' | 'percent']> = {
  1: ['attack', 'flat'], 2: ['defense', 'flat'], 3: ['health', 'flat'], 4: ['attack', 'percent'], 5: ['defense', 'percent'], 6: ['health', 'percent'],
  7: ['criticalRate', 'percent'], 8: ['criticalDamage', 'percent'], 9: ['accuracy', 'flat'], 10: ['resistance', 'flat'], 11: ['runSpeed', 'flat'],
  12: ['comboSpeed', 'flat'], 13: ['skillSpeed', 'flat'], 14: ['skillRecovery', 'flat'], 15: ['manaGeneration', 'flat'], 16: ['instinct', 'flat'],
}
const FACTIONS: Record<number, string> = { 1: 'Eldrin', 2: 'Magi', 3: 'Stonehearts', 5: 'Freeborn', 6: 'Beastbloods', 7: 'Nocturna', 9: 'Ironbands', 11: 'Cambion', 12: 'Lightseekers' }
function fromCatalog(c: Character | undefined, id: number): Character2 {
  return {
    code: c?.code ?? '', name: c?.name ?? `Sin identificar #${id}`, fullName: c?.fullName ?? `Sin identificar #${id}`, portrait: c?.portrait ?? '',
    rarity: c?.rarity ?? 'Common', element: c?.kind === 'invokers' ? c.element : null, cls: c?.kind === 'invokers' ? c.role : null,
    role: c?.kind === 'titans' ? c.role : null, faction: c?.faction ?? '—', soulSign: null, soulSignIcon: null, boundIcon: null,
  }
}
/** Adapta una colección leída de los `.dat` (sin estadísticas base) al modelo común. */
export function boxFromCollection(c: Collection): Box {
  const toBonus = (b: { stat: number; value: number; rolls: number }): Bonus => { const [stat, mode] = STAT_IDS[b.stat] ?? [`stat${b.stat}`, 'flat']; return { stat, mode, value: b.value, rolls: b.rolls, grade: null } }
  const toGear = (g: Collection['relics'][number]): Gear => ({
    id: g.inventoryId, kind: g.kind, slot: (g.kind === 'relic' ? RELIC_KEYS : ACCESSORY_KEYS)[g.slot] ?? `Slot${g.slot}`, rank: g.rank,
    rarity: RARITY_ORDER[g.rarity - 1] ?? 'Common', set: g.kind === 'relic' ? SET_KEYS[g.setOrFaction] ?? null : null,
    faction: g.kind === 'accessory' ? FACTIONS[g.setOrFaction] ?? null : null, level: g.level, equippedHeroId: g.equippedHeroId ?? null,
    main: toBonus(g.bonuses[0] ?? { stat: 1, value: 0, rolls: 0 }), subs: g.bonuses.slice(1).map(toBonus), mainAtMax: null, unequipGold: 0, icon: null,
  })
  const slots = (ids: Record<number, number>, keys: Record<number, string>) => Object.fromEntries(Object.entries(ids).map(([k, v]) => [keys[Number(k)] ?? k, v]))
  return {
    source: 'files', profile: { name: c.player?.name ?? 'Jugador', level: c.player?.level ?? 0, avatar: null, clan: null, totalPower: c.invokers.reduce((s, h) => s + (h.reportedPower ?? 0), 0) },
    heroes: c.invokers.map(h => ({
      ...fromCatalog(characterFor(h), h.inventoryId), id: h.inventoryId, rank: h.rank, level: h.level, maxLevel: 50, awakeLevel: h.awakeLevel, locked: h.locked,
      power: h.reportedPower ?? 0, battles: 0, skills: [], relics: slots(h.relicIds, RELIC_KEYS), accessories: slots(h.accessoryIds, ACCESSORY_KEYS),
      stats: h.reportedStats ?? {}, gearBonus: null, basis: null, activeSets: [],
    })),
    titans: c.titans.map(t => ({ ...fromCatalog(characterFor(t), t.inventoryId), id: t.inventoryId, rank: t.rank, level: t.level, locked: t.locked, power: 0, battles: 0, empowerment: t.empowermentLevel, bound: null, boundBonuses: [], flatBonuses: [] })),
    relics: c.relics.map(toGear), accessories: c.accessories.map(toGear), teams: [], setRules: [], arenaHall: [],
    accessorySlotAwake: { Amulet: 0, Earrings: 2, Banner: 4, Talisman: 5, Flasks: 6 }, mainStatsBySlot: {}, ratingCurves: null, maxGearLevel: 20,
    snapshotAt: null, expiresAt: null, sharePath: null, exact: false, assetBase: null,
  }
}
