import { describe, expect, it } from 'vitest'
import { sharedBoxUrl, decodeOfficialBox } from './officialImport'
const example=()=>({profile:{name:'Prueba',level:1},heroes:[{heroId:1,character:{portraitUrl:'/game-assets/0.62/characters/Ironbands/IRN036/portrait.webp'},rank:1,level:1,awakeLevel:0,power:5,locked:true,stats:{health:100},relicIdBySlot:{Weapon:2},accessoryIdBySlot:{}}],titans:[],accessories:[],relics:[{id:2,slot:'Weapon',rank:1,rarity:'Rare',set:'Health',level:0,equippedHeroId:1,main:{stat:'health',mode:'flat',value:20},subs:[]}]})
describe('caja compartida oficial',()=>{
 it('acepta solo enlaces oficiales de caja sin credenciales ni destinos alternativos',()=>{
  expect(sharedBoxUrl('https://www.invokers.com/lamb/?b=demo-token').hostname).toBe('invokers.com')
  for(const value of ['https://evil.test/lamb/?b=demo','https://invokers.com@evil.test/lamb/?b=demo','http://invokers.com/lamb/?b=demo','https://invokers.com/lamb/?b=demo&b=other','https://invokers.com/lamb/?b=../demo'])expect(()=>sharedBoxUrl(value)).toThrow()
 })
 it('usa el código publicado del retrato sin redondear IDs grandes del JSON',()=>{
  const c=decodeOfficialBox(example());expect(c.invokers[0].catalogCode).toBe('IRN036');expect(c.invokers[0].relicIds[1]).toBe(2);expect(c.relics[0].equippedHeroId).toBe(1);expect(c.invokers[0].reportedStats?.health).toBe(100)
 })
 it('rechaza referencias rotas y valores desconocidos',()=>{
  const bad=example();bad.relics[0].equippedHeroId=99;expect(()=>decodeOfficialBox(bad)).toThrow()
  const broken=example();broken.relics[0].main.stat='inventada';expect(()=>decodeOfficialBox(broken)).toThrow()
  const duplicate=example();duplicate.heroes.push(duplicate.heroes[0]);expect(()=>decodeOfficialBox(duplicate)).toThrow()
 })
})
