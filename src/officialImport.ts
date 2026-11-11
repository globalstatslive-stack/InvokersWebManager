import { CHARACTERS, RELIC_KEYS, ACCESSORY_KEYS, SET_KEYS, RARITY_ORDER } from './catalog'
import type { Collection, Equipment, Invoker, Titan, Bonus } from './memorypack'
export function sharedBoxUrl(value: string): URL {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw Error('Pega un enlace completo de invokers.com/lamb/?b=…') }
  const token = url.searchParams.get('b')
  if (url.protocol !== 'https:' || !['invokers.com','www.invokers.com'].includes(url.hostname) || url.username || url.password || url.port || url.hash || !/^\/lamb\/?$/.test(url.pathname) || [...url.searchParams.keys()].length !== 1 || !token || !/^[A-Za-z0-9_-]{3,200}$/.test(token)) throw Error('El enlace debe ser una caja compartida de https://invokers.com/lamb/?b=…')
  return new URL(`https://invokers.com/lamb/?b=${encodeURIComponent(token)}`)
}
const fail = (s: string): never => { throw Error(`Caja oficial: ${s}`) }
const obj = (x: unknown): Record<string, any> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string,any> : fail('objeto inválido')
const int = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : fail('identificador o nivel inválido')
const arr = (x: unknown) => Array.isArray(x) && x.length <= 50000 ? x : fail('colección ausente o demasiado grande')
const index = (table: Record<number,string>, value: unknown) => { const key=Object.keys(table).find(k=>table[Number(k)]===value);return key ? Number(key) : fail(`valor no compatible: ${String(value)}`) }
const factions: Record<number,string> = {1:'Eldrin',2:'Magi',3:'Stonehearts',5:'Freeborn',6:'Beastbloods',7:'Nocturna',9:'Ironbands',11:'Cambion',12:'Lightseekers'}
const stats: Record<string,number> = {'attack:flat':1,'defense:flat':2,'health:flat':3,'attack:percent':4,'defense:percent':5,'health:percent':6,'criticalRate:percent':7,'criticalDamage:percent':8,'accuracy:flat':9,'resistance:flat':10,'runSpeed:flat':11,'comboSpeed:flat':12,'skillSpeed:flat':13,'skillRecovery:flat':14,'manaGeneration:flat':15,'instinct:flat':16}
export function decodeOfficialBox(value: unknown): Collection {
  const root=obj(value), warnings: string[]=[]
  const unique=<T extends {inventoryId:number}>(rows:T[])=> {if(new Set(rows.map(x=>x.inventoryId)).size!==rows.length)fail('identificadores repetidos');return rows}
  const character=(row:Record<string,any>,kind:string)=> {
    const c=obj(row.character), path=String(c.portraitUrl ?? ''),code=/\/characters\/[^/]+\/([^/]+)\/portrait\.webp$/.exec(path)?.[1]
    if(!code || !CHARACTERS.some(x=>x.code===code && x.kind===kind))fail('personaje fuera del catálogo local; actualiza el catálogo antes de importar')
    return { configId:`official:${code}`,catalogCode:code }
  }
  const slots=(value:unknown,table:Record<number,string>)=>Object.fromEntries(Object.entries(obj(value)).map(([k,v])=>[index(table,k),int(v)]))
  const invokers=unique(arr(root.heroes).map(raw=>{const r=obj(raw);const reportedStats: Record<string,number>={};for(const [k,v]of Object.entries(obj(r.stats)))if(typeof v==='number'&&Number.isFinite(v))reportedStats[k]=v;return {inventoryId:int(r.heroId),...character(r,'invokers'),level:int(r.level),rank:int(r.rank),locked:r.locked===true,inStorage:r.inStorage===true,awakeLevel:int(r.awakeLevel),relicIds:slots(r.relicIdBySlot,RELIC_KEYS),accessoryIds:slots(r.accessoryIdBySlot,ACCESSORY_KEYS),reportedStats,reportedPower:int(r.power)} as Invoker}))
  const titans=unique(arr(root.titans).map(raw=>{const r=obj(raw);return {inventoryId:int(r.titanId),...character(r,'titans'),level:int(r.level),rank:int(r.rank),locked:r.locked===true,empowermentLevel:int(r.empowerment)} as Titan}))
  const gear=(value:unknown,kind:'relic'|'accessory')=>unique(arr(value).map(raw=>{
    const r=obj(raw);if(!Object.prototype.hasOwnProperty.call(r,'equippedHeroId'))fail('estado de propietario ausente');const rarity=RARITY_ORDER.indexOf(r.rarity)+1;if(!rarity)fail('rareza desconocida')
    const bonuses:Bonus[]=[obj(r.main),...arr(r.subs)].map((raw,i)=>{const b=obj(raw),stat=stats[`${b.stat}:${b.mode}`];if(!stat || typeof b.value!=='number' || !Number.isFinite(b.value))fail('bonificación no compatible');return{id:i+1,stat,value:b.value,level:i===0?int(r.level):0,rolls:typeof b.rolls==='number'?b.rolls:0}})
    const owner=r.equippedHeroId==null?undefined:int(r.equippedHeroId)
    return{inventoryId:int(r.id),kind,slot:index(kind==='relic'?RELIC_KEYS:ACCESSORY_KEYS,r.slot),rank:int(r.rank),rarity,setOrFaction:index(kind==='relic'?SET_KEYS:factions,kind==='relic'?r.set:r.faction),level:int(r.level),ownerType:owner===undefined?0:1,equippedHeroId:owner,bonuses} as Equipment
  }))
  const relics=gear(root.relics,'relic'),accessories=gear(root.accessories,'accessory')
  for(const [kind,pieces]of [['relic',relics],['accessory',accessories]] as const){const byId=new Map(pieces.map(x=>[x.inventoryId,x]));for(const h of invokers)for(const [slot,id]of Object.entries(kind==='relic'?h.relicIds:h.accessoryIds)){const p=byId.get(id);if(!p||p.slot!==Number(slot)||p.equippedHeroId!==h.inventoryId)fail('equipo y propietarios no coinciden')};for(const p of pieces)if(p.equippedHeroId!==undefined&&!invokers.some(h=>h.inventoryId===p.equippedHeroId))fail('propietario ausente')}
  const profile=obj(root.profile)
  if(typeof profile.name!=='string')fail('perfil sin nombre')
  warnings.push('Instantánea compartida del portal oficial. Actualiza el enlace en Invokers para obtener cambios posteriores. Las estadísticas publicadas son de esa instantánea.')
  return{invokers,titans,relics,accessories,player:{name:profile.name.slice(0,200),level:int(profile.level)},warnings}
}
