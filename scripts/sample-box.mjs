/** Caja sintética con la forma de /api/lamb/<código> para pruebas (sin datos de jugadores reales). */
const F = 2 ** 32
const SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
const MAIN = { Weapon: ['attack', 'flat', 300], Shield: ['defense', 'flat', 200], Helmet: ['health', 'flat', 1500], Pauldrons: ['attack', 'percent', 0.3], Gauntlets: ['criticalRate', 'percent', 0.2], Chestplate: ['attack', 'percent', 0.3], Belt: ['attack', 'percent', 0.3], Boots: ['comboSpeed', 'flat', 30] }
const bonus = ([stat, mode, value], grade = null) => ({ stat, mode, value, raw: Math.round(value * F), rolls: grade ? 1 : 20, grade })
const portrait = (path) => `/game-assets/0.62.1655/characters/${path}/portrait.webp`
export function sampleBox() {
  let id = 1
  const relic = (slot, set, owner, rank = 5) => ({ id: id++, kind: 'relic', slot, rank, rarity: rank >= 5 ? 'Epic' : 'Uncommon', set, setName: set, faction: null, level: rank >= 5 ? 20 : 0, equippedHeroId: owner,
    main: bonus(MAIN[slot]), subs: [bonus(['criticalDamage', 'percent', 0.04], 'B'), bonus(['accuracy', 'flat', 12], rank >= 5 ? 'A' : 'D')], unequipGold: 2000, iconUrl: `/game-assets/0.62.1655/shop/relics/${set}/${slot}.webp`, mainAtMax: null })
  const relics = [...SLOTS.map(s => relic(s, 'Health', 1, 3)), ...SLOTS.map(s => relic(s, 'Attack', null)), ...SLOTS.map(s => relic(s, 'CriticalRate', null)), ...SLOTS.slice(0, 3).map(s => relic(s, 'Defense', null, 2))]
  const heroes = [
    { heroId: 1, character: { name: 'Ozmol the Vulcanist', shortName: 'Ozmol', portraitUrl: portrait('Ironbands/IRN036'), rarity: 'Legendary', element: 'Fire', class: 'RangedAttacker', faction: 'Ironbands' }, rank: 5, level: 50, maxLevel: 50, awakeLevel: 5, locked: true, power: 8000, battles: 100,
      skillLevels: [{ kind: 'Ultimate', level: 5 }], relicIdBySlot: Object.fromEntries(SLOTS.map((s, i) => [s, i + 1])), accessoryIdBySlot: {},
      stats: { health: 5000 + 8 * 0 + 1500, attack: 1000 + 300, defense: 500 + 200, criticalRate: 0.05 + 0.2, criticalDamage: 0.5 + 0.32, accuracy: 20 + 96, comboSpeed: 10 + 30, runSpeed: 100 },
      gearBonus: { health: 1500, attack: 300 + 900, defense: 200, criticalRate: 0.2, criticalDamage: 0.32, accuracy: 96, comboSpeed: 30 },
      basis: { health: 5000 * F, attack: 1000 * F, defense: 500 * F, criticalRate: 0.05 * F, criticalDamage: 0.5 * F, accuracy: 20 * F, comboSpeed: 10 * F, runSpeed: 100 * F }, activeSets: [{ set: 'Health', pieces: 8, activeTiers: [3, 5] }] },
    { heroId: 2, character: { name: 'Alasinthe', shortName: 'Alasinthe', portraitUrl: portrait('Magi/MAG017'), rarity: 'Epic', element: 'Fire', class: 'RangedAttacker', faction: 'Magi' }, rank: 4, level: 40, maxLevel: 50, awakeLevel: 0, locked: false, power: 3000, battles: 5,
      skillLevels: [], relicIdBySlot: {}, accessoryIdBySlot: {}, stats: { health: 3000, attack: 600 }, gearBonus: {}, basis: { health: 3000 * F, attack: 600 * F }, activeSets: [] },
  ]
  // Ajusta el aporte publicado del héroe 1 a la fórmula: 3 piezas de % de ataque × 1000 de base.
  heroes[0].stats.attack = 1000 + 300 + 900
  const set = (name, three, five) => ({ set: name, name, threeDescription: '', fiveDescription: '', three, five, eight: [], flags: [] })
  return {
    owner: false, profile: { name: 'Jugador de prueba', level: 30, avatarUrl: portrait('Ironbands/IRN036'), clanAbbreviation: 'TST', totalPower: 11000 },
    heroes, titans: [{ titanId: 1, character: { name: 'Reltalis', shortName: 'Reltalis', portraitUrl: portrait('Lightseekers/ANIMLTS004'), rarity: 'Legendary', faction: 'Lightseekers', role: 'Damage' }, rank: 5, level: 50, locked: true, power: 15000, battles: 10, empowerment: 0,
      boundEffect: { stat: 'attack', mode: 'percent', specialization: 'General', general: 0.2, specialized: 0.28 }, stats: { boundBonuses: [], flatBonuses: [] } }],
    relics, accessories: [],
    teams: [{ mode: 'arena', modeLabel: 'Arena', key: 'arena-attack', label: 'Arena', detail: 'Offense', iconUrl: null, element: null, difficultyLabel: '', highestLevel: 0,
      levels: [{ level: 0, bestTimeSeconds: 61, victories: 3, defeats: 1, bestTimeTeam: { formation: 'Four7', slots: [{ position: 'Front1', line: 'front', heroId: 1, titanId: 1 }] } }] }],
    rules: { relicSets: [set('Health', [{ stat: 'health', mode: 'percent', value: 0.1 }], [{ stat: 'health', mode: 'percent', value: 0.2 }]), set('Attack', [{ stat: 'attack', mode: 'percent', value: 0.1 }], [{ stat: 'attack', mode: 'percent', value: 0.2 }]),
      set('CriticalRate', [{ stat: 'criticalRate', mode: 'percent', value: 0.1 }], [{ stat: 'criticalRate', mode: 'percent', value: 0.2 }]), set('Defense', [{ stat: 'defense', mode: 'percent', value: 0.1 }], [])],
      accessorySlotAwakeLevel: { Amulet: 0, Earrings: 2, Banner: 4, Talisman: 5, Flasks: 6 }, maxGearLevel: 20, relicMainStatsBySlot: {}, accessoryMainStatsBySlot: {} },
    arenaHallBonuses: [], sharing: { snapshotAt: '2026-11-11T09:00:00Z', expiresAt: '2026-11-18T09:00:00Z', sharePath: '/lamb/?b=prueba-abc' }, ratingCurves: null,
  }
}
