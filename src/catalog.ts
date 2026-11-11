import relicArt from './catalog/relic-art.json'
const availableRelicArt = new Set(relicArt)
import rawCharacters from './catalog/characters.json'
import observedIdentities from './catalog/observed-identities.json'
import type { Equipment, Invoker, Titan } from './memorypack'

export type Character = {
  code: string; kind: 'invokers' | 'titans'; name: string; fullName: string; slug: string;
  portrait: string; rarity: string; faction: string; role: string; element: string;
  elementIcon?: string; factionIcon?: string; roleIcon?: string; source: string;
}
export const CHARACTERS = rawCharacters as Character[]
const byCode = new Map(CHARACTERS.map(x => [x.code, x]))
const identities: Record<string, string> = observedIdentities
export const characterByCode = (code: string) => byCode.get(code)
export const characterFor = (unit: Pick<Invoker | Titan, 'configId' | 'catalogCode'>) => byCode.get(unit.catalogCode ?? identities[unit.configId])
export const unitName = (unit: Invoker | Titan) => characterFor(unit)?.name ?? `Sin identificar · #${unit.inventoryId}`
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
export const LABELS: Record<string, string> = {
  Common: 'Común', Uncommon: 'Poco común', Rare: 'Raro', Epic: 'Épico', Legendary: 'Legendario', Mythic: 'Mítico',
  Fire: 'Fuego', Water: 'Agua', Earth: 'Tierra', Wind: 'Aire', Light: 'Luz', Dark: 'Tinieblas', Neutral: 'Neutral',
  MeleeAttacker: 'Daño cuerpo a cuerpo', RangedAttacker: 'Daño a distancia', Support: 'Apoyo', Tank: 'Tanque', Damage: 'Daño',
  Eldrin: 'Eldrinos', Magi: 'Magos', Stonehearts: 'Petrocordis', Freeborn: 'Libertarios', Beastbloods: 'Bestiales',
  Nocturna: 'Nocturnos', Ironbands: 'Férreos', Cambion: 'Cambiones', Lightseekers: 'Luminarios', Guardians: 'Guardianes', Dragons: 'Guardianes',
}
export const label = (key: string) => LABELS[key] ?? key
export const rarityNumber = (character?: Character) => character ? RARITY_ORDER.indexOf(character.rarity) + 1 : 0
export const RELIC_KEYS: Record<number, string> = { 1:'Weapon',2:'Shield',3:'Helmet',4:'Pauldrons',5:'Gauntlets',6:'Chestplate',7:'Belt',8:'Boots' }
export const ACCESSORY_KEYS: Record<number, string> = { 1:'Amulet',2:'Earrings',3:'Banner',4:'Talisman',5:'Flasks' }
export const FACTION_KEYS: Record<number, string> = { 1:'ELD',2:'MAG',3:'STO',5:'FRB',6:'BST',7:'NOC',9:'IRN',11:'CAM',12:'LTS' }
export const SET_KEYS: Record<number, string> = {
  1:'CrushTolerance',2:'ManaShockTolerance',3:'FrostTolerance',4:'DazeTolerance',5:'ParalysisTolerance',6:'NightmareTolerance',
  7:'MindFogTolerance',8:'FatigueTolerance',9:'BlightTolerance',10:'ManaBurnTolerance',11:'AtrophyTolerance',12:'BloodRotTolerance',
  101:'Attack',102:'Defense',103:'Health',104:'CriticalRate',105:'CriticalDamage',106:'Accuracy',107:'Resistance',108:'Instinct',
  109:'ManaGeneration',110:'SkillSpeed',111:'SkillRecovery',112:'LifeSteal',113:'IgnoreDefense',114:'Support',115:'ReduceBuffDuration',117:'EventSet2',118:'ClanBossSet1',
}
export function equipmentImage(item: Equipment) {
  if (item.kind === 'accessory') {
    const faction = FACTION_KEYS[item.setOrFaction], slot = ACCESSORY_KEYS[item.slot]
    return faction && slot ? `game/assets/gear/accessories/${faction}/${slot}.webp` : undefined
  }
  const slot = RELIC_KEYS[item.slot]
  const actual = `game/shop/relics/${SET_KEYS[item.setOrFaction]}/${slot}.webp`
  if (availableRelicArt.has(actual)) return actual
  return slot ? `game/assets/gear/slots/${slot}.webp` : undefined
}
export const setImage = (item: Equipment) => item.kind === 'relic' && SET_KEYS[item.setOrFaction] ? `game/assets/gear/sets/${SET_KEYS[item.setOrFaction]}.webp` : undefined

const FACTION_NAMES: Record<number, string> = { 1:'Eldrin',2:'Magi',3:'Stonehearts',5:'Freeborn',6:'Beastbloods',7:'Nocturna',9:'Ironbands',11:'Cambion',12:'Lightseekers' }
/** Facción documentada por el catálogo oficial; una identidad desconocida no prueba compatibilidad. */
export function compatibleWith(item: Equipment, hero: Invoker | undefined): boolean {
  if (!hero) return false
  if (item.kind === 'relic') return true
  const faction = characterFor(hero)?.faction
  return !!faction && FACTION_NAMES[item.setOrFaction] === faction
}
