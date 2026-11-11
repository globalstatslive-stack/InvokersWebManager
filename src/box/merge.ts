/** Combina una importación de la carpeta del juego (`.dat`: equipo actual, sin estadísticas base)
 * con la última caja oficial del enlace (estadísticas base, reglas, notas, equipos de combate).
 *
 * Para cada Invoker cuyo nivel, rango y despertar no han cambiado desde la caja oficial, la base es la
 * misma; el total se recalcula con la fórmula verificada a partir del equipo actual de los `.dat`:
 *   total = total oficial − aporte oficial + aporte del equipo actual
 * Los Invokers que han cambiado conservan sus datos del `.dat` sin base (el optimizador lo indica). */
import type { Box, Gear, Hero } from './model'
import { activeSetBonuses, gearContribution } from './stats'

export function mergeWithOfficial(files: Box, official: Box): Box {
  const officialGear = new Map([...official.relics, ...official.accessories].map(g => [`${g.kind}${g.id}`, g]))
  const enrichGear = (g: Gear): Gear => {
    const o = officialGear.get(`${g.kind}${g.id}`)
    if (!o || o.slot !== g.slot || o.main.stat !== g.main.stat || o.main.mode !== g.main.mode) return g
    // Mismas subestadísticas en el mismo orden: se conservan las notas A–D del portal.
    const subs = g.subs.map((s, i) => o.subs[i] && o.subs[i].stat === s.stat && o.subs[i].mode === s.mode ? { ...s, grade: o.subs[i].grade } : s)
    return { ...g, subs, unequipGold: o.unequipGold, icon: o.icon, mainAtMax: o.level === g.level ? o.mainAtMax : null }
  }
  const relics = files.relics.map(enrichGear), accessories = files.accessories.map(enrichGear)
  const byKey = new Map([...relics, ...accessories].map(g => [`${g.kind}${g.id}`, g]))
  const rules = new Map(official.setRules.map(r => [r.set, r]))
  const officialHeroes = new Map(official.heroes.map(h => [h.id, h]))
  let exactHeroes = 0, changedHeroes = 0
  const heroes: Hero[] = files.heroes.map(h => {
    const o = officialHeroes.get(h.id)
    if (!o || (h.code && o.code && h.code !== o.code)) return h
    const character = { code: o.code, name: o.name, fullName: o.fullName, portrait: o.portrait, rarity: o.rarity, element: o.element, cls: o.cls, role: o.role, faction: o.faction, soulSign: o.soulSign, soulSignIcon: o.soulSignIcon, boundIcon: o.boundIcon }
    const base = { ...h, ...character, battles: o.battles, skills: o.skills, maxLevel: o.maxLevel }
    const same = h.level === o.level && h.rank === o.rank && h.awakeLevel === o.awakeLevel
    const sameGear = (a: Record<string, number>, b: Record<string, number>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v)
    // Los .dat no traen el poder: se conserva el del enlace y se marca si ya no corresponde al equipo actual.
    const powerStale = !h.power && (!same || !sameGear(h.relics, o.relics) || !sameGear(h.accessories, o.accessories))
    if (!same || !o.basis || !o.gearBonus) { changedHeroes++; return { ...base, power: h.power || o.power, powerStale } }
    const pieces = [...Object.values(h.relics).map(id => byKey.get(`relic${id}`)), ...Object.values(h.accessories).map(id => byKey.get(`accessory${id}`))].filter((x): x is Gear => !!x)
    const contribution = gearContribution(o, pieces, rules)
    const stats: Record<string, number> = { ...o.stats }
    for (const [k, v] of Object.entries(o.gearBonus)) stats[k] = (stats[k] ?? 0) - v
    for (const [k, v] of Object.entries(contribution)) stats[k] = (stats[k] ?? 0) + v
    exactHeroes++
    return {
      ...base, power: h.power || o.power, powerStale, basis: o.basis, gearBonus: contribution, stats,
      activeSets: activeSetBonuses(pieces, rules).map(s => ({ set: s.set, pieces: s.pieces, tiers: s.tiers })),
    }
  })
  const officialTitans = new Map(official.titans.map(t => [t.id, t]))
  const titans = files.titans.map(t => {
    const o = officialTitans.get(t.id)
    return o && (!t.code || t.code === o.code) ? { ...o, rank: t.rank, level: t.level, locked: t.locked, empowerment: t.empowerment } : t
  })
  return {
    ...official,
    source: 'files',
    profile: { ...official.profile, name: files.profile.name !== 'Jugador' ? files.profile.name : official.profile.name, level: files.profile.level || official.profile.level, totalPower: heroes.reduce((s, h) => s + h.power, 0) || official.profile.totalPower },
    heroes, titans, relics, accessories,
    snapshotAt: null, expiresAt: official.expiresAt, sharePath: official.sharePath,
    exact: exactHeroes > 0,
    merge: { officialSnapshot: official.snapshotAt, exactHeroes, changedHeroes },
  }
}
