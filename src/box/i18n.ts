/** Textos en español para claves del juego. Una clave sin traducción se muestra tal cual. */
export const STAT_LABEL: Record<string, string> = {
  health: 'Vida', attack: 'Ataque', defense: 'Defensa', runSpeed: 'Vel. movimiento',
  criticalRate: 'Prob. crítico', criticalDamage: 'Daño crítico', ignoreDefense: 'Ignorar defensa',
  accuracy: 'Precisión', resistance: 'Resistencia', instinct: 'Instinto', comboSpeed: 'Vel. combo',
  skillSpeed: 'Vel. habilidad', skillRecovery: 'Recuperación', manaGeneration: 'Gen. maná',
  increaseHealingDone: 'Curación', increaseShieldsDone: 'Escudos', decreaseDamageTaken: 'Daño recibido',
  buffReductionDoneWithCombo3And5: 'Reducción de mejoras', lifeStealByOtherSkills: 'Robo de vida (hab.)',
  lifeStealByCombos: 'Robo de vida (combo)', runSpeedBonusOutOfCombat: 'Vel. aliados', dodgeChance: 'Evasión',
  crushTolerance: 'Aplastamiento', manaShockTolerance: 'Choque de maná', frostTolerance: 'Escarcha',
  dazeTolerance: 'Aturdimiento', paralysisTolerance: 'Parálisis', nightmareTolerance: 'Pesadilla',
  mindFogTolerance: 'Niebla mental', fatigueTolerance: 'Fatiga', blightTolerance: 'Plaga',
  manaBurnTolerance: 'Quemadura de maná', atrophyTolerance: 'Atrofia', bloodRotTolerance: 'Putrefacción',
}
export const STAT_SHORT: Record<string, string> = {
  health: 'VIDA', attack: 'ATQ', defense: 'DEF', runSpeed: 'MOV', criticalRate: 'CRÍT', criticalDamage: 'D.CRÍT',
  accuracy: 'PREC', resistance: 'RES', instinct: 'INST', comboSpeed: 'COMBO', skillSpeed: 'V.HAB',
  skillRecovery: 'RECUP', manaGeneration: 'MANÁ', ignoreDefense: 'IGN.DEF',
}
/** Estadísticas principales que se muestran y optimizan. */
export const CORE_STATS = ['health', 'attack', 'defense', 'criticalRate', 'criticalDamage', 'accuracy', 'resistance', 'instinct', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration', 'runSpeed'] as const
export const TOLERANCES = ['crushTolerance', 'manaShockTolerance', 'frostTolerance', 'dazeTolerance', 'paralysisTolerance', 'nightmareTolerance', 'mindFogTolerance', 'fatigueTolerance', 'blightTolerance', 'manaBurnTolerance', 'atrophyTolerance', 'bloodRotTolerance']
/** Valores fraccionarios que se muestran como porcentaje. */
export const RATIO_STATS = new Set(['criticalRate', 'criticalDamage', 'ignoreDefense', 'increaseHealingDone', 'increaseShieldsDone', 'decreaseDamageTaken', 'dodgeChance', 'lifeStealByOtherSkills', 'lifeStealByCombos', ...TOLERANCES])
export const PERCENT_OF_BASE = new Set(['health', 'attack', 'defense'])

export const SLOT_LABEL: Record<string, string> = {
  Weapon: 'Arma', Shield: 'Escudo', Helmet: 'Casco', Pauldrons: 'Hombreras', Gauntlets: 'Guantes',
  Chestplate: 'Peto', Belt: 'Cinturón', Boots: 'Botas', Amulet: 'Amuleto', Earrings: 'Pendientes',
  Banner: 'Estandarte', Talisman: 'Talismán', Flasks: 'Frascos',
}
export const RELIC_SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
export const ACCESSORY_SLOTS = ['Amulet', 'Earrings', 'Banner', 'Talisman', 'Flasks']

export const SET_LABEL: Record<string, string> = {
  CrushTolerance: 'Tol. aplastamiento', ManaShockTolerance: 'Tol. choque de maná', FrostTolerance: 'Tol. escarcha',
  DazeTolerance: 'Tol. aturdimiento', ParalysisTolerance: 'Tol. parálisis', NightmareTolerance: 'Tol. pesadilla',
  MindFogTolerance: 'Tol. niebla mental', FatigueTolerance: 'Tol. fatiga', BlightTolerance: 'Tol. plaga',
  ManaBurnTolerance: 'Tol. quemadura de maná', AtrophyTolerance: 'Tol. atrofia', BloodRotTolerance: 'Tol. putrefacción',
  Attack: 'Ataque', Defense: 'Defensa', Health: 'Vida', CriticalRate: 'Prob. crítico', CriticalDamage: 'Daño crítico',
  Accuracy: 'Precisión', Resistance: 'Resistencia', Instinct: 'Instinto', ManaGeneration: 'Maná',
  ReduceBuffDuration: 'Vudú', SkillSpeed: 'Chispa', SkillRecovery: 'Furia', LifeSteal: 'Vampiro',
  IgnoreDefense: 'Depredador', Support: 'Paradigma', EventSet1: 'Baluarte', EventSet2: 'Celeridad',
  ClanBossSet1: 'Guardián', ClanBossSet2: 'Muro de hechizos',
}
export const RARITY_LABEL: Record<string, string> = { Common: 'Común', Uncommon: 'Poco común', Rare: 'Raro', Epic: 'Épico', Legendary: 'Legendario', Mythic: 'Mítico' }
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
export const ELEMENT_LABEL: Record<string, string> = { Fire: 'Fuego', Water: 'Agua', Earth: 'Tierra', Wind: 'Aire', Light: 'Luz', Dark: 'Oscuridad' }
export const CLASS_LABEL: Record<string, string> = { MeleeAttacker: 'Cuerpo a cuerpo', RangedAttacker: 'A distancia', Support: 'Apoyo', Tank: 'Tanque', Damage: 'Daño' }
export const FACTION_LABEL: Record<string, string> = {
  Eldrin: 'Eldrin', Magi: 'Magi', Stonehearts: 'Stonehearts', Freeborn: 'Freeborn', Beastbloods: 'Beastbloods',
  Nocturna: 'Nocturna', Ironbands: 'Ironbands', Cambion: 'Cambion', Lightseekers: 'Lightseekers', Dragons: 'Dragones',
}
export const SKILL_LABEL: Record<string, string> = {
  ActiveSkill1: 'Habilidad 1', ActiveSkill2: 'Habilidad 2', ActiveSkill3: 'Habilidad 3', Ultimate: 'Definitiva',
  Combo: 'Combo', Tolerance1: 'Tolerancia 1', Tolerance2: 'Tolerancia 2', AnimaIn: 'Entrada del Titán',
}
export const MODE_LABEL: Record<string, string> = { arena: 'Arena', clanBoss: 'Jefe de clan', dungeon: 'Jefes', tower: 'Agujas' }

export const t = (table: Record<string, string>, key: string | null | undefined) => key ? table[key] ?? key : '—'

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
export const fmtInt = (n: number) => nf0.format(n)
/** Formatea un valor de estadística: proporciones como %, el resto como entero. */
export function fmtStat(stat: string, value: number, signed = false): string {
  const sign = signed && value > 0 ? '+' : ''
  if (RATIO_STATS.has(stat)) return `${sign}${nf1.format(value * 100)} %`
  return `${sign}${nf0.format(value)}`
}
/** Formatea una bonificación de pieza (flat o % de la base). */
export function fmtBonus(_stat: string, mode: string, value: number): string {
  if (mode === 'percent') return `+${nf1.format(value * 100)} %`
  return `+${nf0.format(value)}`
}
export const bonusName = (stat: string, mode: string) => `${STAT_LABEL[stat] ?? stat}${mode === 'percent' && PERCENT_OF_BASE.has(stat) ? ' %' : ''}`
