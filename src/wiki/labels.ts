/** Textos en español propios de Nexo para las claves oficiales de la enciclopedia. Una clave sin traducción se muestra tal cual. */
export const TOL_LABEL: Record<string, string> = {
  Atrophy: 'Atrofia', Blight: 'Plaga', Bloodrot: 'Putrefacción', Crush: 'Aplastamiento', Daze: 'Aturdimiento', Fatigue: 'Fatiga',
  Frost: 'Escarcha', Manaburn: 'Quemadura de maná', ManaShock: 'Choque de maná', Mindfog: 'Niebla mental', Nightmare: 'Pesadilla', Paralysis: 'Parálisis',
}
export const EFFECT_GROUP: Record<string, string> = { Buffs: 'Mejoras', Debuffs: 'Perjuicios', 'Block Effects': 'Efectos instantáneos' }
export const EFFECT_LABEL: Record<string, string> = {
  Charge: 'Carga', 'Cooldown Increase': 'Aumento de enfriamiento', 'Cooldown Reduction': 'Reducción de enfriamiento', 'Decrease Ultimate Mana': 'Reducir maná de definitiva',
  'Destroy Max HP': 'Destruir vida máxima', 'Extend Buff Duration': 'Alargar mejoras', 'Extend Debuff Duration': 'Alargar perjuicios', 'Gain Titan Mana': 'Ganar maná de Titán',
  'Gain Ultimate Mana': 'Ganar maná de definitiva', Heal: 'Curación', 'Ignore DEF': 'Ignorar DEF', Launch: 'Lanzamiento', Pull: 'Atracción', 'Purge Buffs': 'Purgar mejoras',
  'Purge Debuffs': 'Purgar perjuicios', Push: 'Empuje', Revive: 'Revivir', 'Shorten Buff Duration': 'Acortar mejoras', 'Shorten Debuff Duration': 'Acortar perjuicios',
  'Steal Buffs': 'Robar mejoras', Teleport: 'Teletransporte', 'Transfer Debuffs': 'Transferir perjuicios', 'ACC Up': 'PREC +', 'ATK Up': 'ATQ +', 'Combo SPD Up': 'Vel. combo +',
  'Crit DMG Up': 'Daño crítico +', 'Crit Rate Up': 'Prob. crítico +', 'Damage Filter': 'Filtro de daño', 'DEF Up': 'DEF +', Deflection: 'Desvío', Evasion: 'Evasión', Harden: 'Endurecer',
  Immunity: 'Inmunidad', Invincibility: 'Invencibilidad', Lifeboost: 'Vitalidad', 'Move SPD Up': 'Vel. movimiento +', 'Reflect Damage': 'Reflejar daño', Regeneration: 'Regeneración',
  'RES Up': 'RES +', Shield: 'Escudo', 'Skill Recovery Up': 'Recuperación +', 'Skill SPD Up': 'Vel. habilidad +', Unkillable: 'Inmortal', Willpower: 'Voluntad',
  'ACC Down': 'PREC −', 'ATK Down': 'ATQ −', Bleed: 'Sangrado', Blind: 'Ceguera', 'Block Revive': 'Bloquear revivir', Burn: 'Quemadura', Chain: 'Cadena',
  'Combo SPD Down': 'Vel. combo −', 'Crit DMG Down': 'Daño crítico −', 'Crit Rate Down': 'Prob. crítico −', 'DEF Down': 'DEF −', Disable: 'Inutilizar', Freeze: 'Congelación',
  'Heal Reduction': 'Reducción de curación', Hex: 'Maleficio', Jinx: 'Gafe', Mindworm: 'Gusano mental', 'Move SPD Down': 'Vel. movimiento −', 'RES Down': 'RES −',
  Shock: 'Descarga', 'Skill Recovery Down': 'Recuperación −', 'Skill SPD Down': 'Vel. habilidad −', Stun: 'Aturdir', Suppression: 'Supresión', Taunt: 'Provocar',
  Titanblock: 'Bloqueo de Titán', Weaken: 'Debilitar',
}
export const SKILL_TYPE: Record<string, string> = { Combo: 'Combo', 'Active Skill1': 'Habilidad 1', 'Active Skill2': 'Habilidad 2', 'Active Skill3': 'Habilidad 3', Ultimate: 'Definitiva', 'Ultimate Skill': 'Definitiva', Passive: 'Pasiva', Tolerance: 'Tolerancia' }
export const GEAR_STAT: Record<string, string> = {
  'ATK+': 'ATQ fijo', 'DEF+': 'DEF fija', 'HP+': 'VIDA fija', 'ATK%': 'ATQ %', 'DEF%': 'DEF %', 'HP%': 'VIDA %', 'Crit Rate': 'Prob. crítico', 'Crit DMG': 'Daño crítico',
  ACC: 'Precisión', RES: 'Resistencia', 'Combo SPD': 'Vel. combo', 'Skill SPD': 'Vel. habilidad', 'Skill RECOV': 'Recuperación', 'Mana Gen': 'Gen. maná', Instinct: 'Instinto', 'Move SPD': 'Vel. movimiento',
}
export const GEAR_SLOT: Record<string, string> = { Weapon: 'Arma', Shield: 'Escudo', Helmet: 'Casco', Pauldrons: 'Hombreras', Gauntlets: 'Guantes', Chestplate: 'Peto', Belt: 'Cinturón', Boots: 'Botas', Amulet: 'Amuleto', Earrings: 'Pendientes', Banner: 'Estandarte', Talisman: 'Talismán', Flask: 'Frasco', Flasks: 'Frasco' }
export const SET_NAME: Record<string, string> = {
  Health: 'Vida', Attack: 'Ataque', Defense: 'Defensa', 'Crit Rate': 'Prob. crítico', 'Crit Damage': 'Daño crítico', Accuracy: 'Precisión', Resistance: 'Resistencia', Mana: 'Maná',
  Instinct: 'Instinto', Voodoo: 'Vudú', Vampire: 'Vampiro', Spark: 'Chispa', Fury: 'Furia', Predator: 'Depredador', Paragon: 'Paradigma', Bulwark: 'Baluarte', Celerity: 'Celeridad',
  Guardian: 'Guardián', Spellwall: 'Muro de hechizos', 'Crush Tolerance': 'Tol. aplastamiento', 'Manashock Tolerance': 'Tol. choque de maná', 'Frost Tolerance': 'Tol. escarcha',
  'Daze Tolerance': 'Tol. aturdimiento', 'Paralysis Tolerance': 'Tol. parálisis', 'Nightmare Tolerance': 'Tol. pesadilla', 'Mindfog Tolerance': 'Tol. niebla mental',
  'Fatigue Tolerance': 'Tol. fatiga', 'Blight Tolerance': 'Tol. plaga', 'Manaburn Tolerance': 'Tol. quemadura de maná', 'Atrophy Tolerance': 'Tol. atrofia', 'Bloodrot Tolerance': 'Tol. putrefacción',
}
/** Icono local del conjunto (public/game/assets/gear/sets/<clave>.webp). */
export const SET_KEY: Record<string, string> = {
  Health: 'Health', Attack: 'Attack', Defense: 'Defense', 'Crit Rate': 'CriticalRate', 'Crit Damage': 'CriticalDamage', Accuracy: 'Accuracy', Resistance: 'Resistance', Mana: 'ManaGeneration',
  Instinct: 'Instinct', Voodoo: 'ReduceBuffDuration', Vampire: 'LifeSteal', Spark: 'SkillSpeed', Fury: 'SkillRecovery', Predator: 'IgnoreDefense', Paragon: 'Support', Bulwark: 'EventSet1',
  Celerity: 'EventSet2', Guardian: 'ClanBossSet1', Spellwall: 'ClanBossSet2', 'Crush Tolerance': 'CrushTolerance', 'Manashock Tolerance': 'ManaShockTolerance', 'Frost Tolerance': 'FrostTolerance',
  'Daze Tolerance': 'DazeTolerance', 'Paralysis Tolerance': 'ParalysisTolerance', 'Nightmare Tolerance': 'NightmareTolerance', 'Mindfog Tolerance': 'MindFogTolerance', 'Fatigue Tolerance': 'FatigueTolerance',
  'Blight Tolerance': 'BlightTolerance', 'Manaburn Tolerance': 'ManaBurnTolerance', 'Atrophy Tolerance': 'AtrophyTolerance', 'Bloodrot Tolerance': 'BloodRotTolerance',
}
export const BOSS_CATEGORY: Record<string, string> = { 'Relic Boss': 'Jefes de reliquias', 'Crest Boss': 'Jefes de emblemas', 'Essence Boss': 'Jefes de esencia', 'Clan Boss': 'Jefes de clan', 'Titan Boss': 'Jefe de Titanes' }
export const BOSS_CATEGORY_HELP: Record<string, string> = {
  'Relic Boss': 'Sueltan reliquias de sus conjuntos.', 'Crest Boss': 'Sueltan emblemas para despertar Invokers.', 'Essence Boss': 'Las siete Garudas elementales: sueltan esencias.',
  'Clan Boss': 'Combates de clan; Sorgott suelta accesorios.', 'Titan Boss': 'Pentiax: progresión de Titanes.',
}
export const MATCHUP: Record<string, string> = { Neutral: 'Neutral', Advantage: 'Ventaja', Disadvantage: 'Desventaja' }
export const matchupEs = (s: string) => s.replace('Advantage', 'Ventaja').replace('Disadvantage', 'Desventaja').replace('damage', 'de daño')
export const REWARD: Record<string, string> = { Gold: 'Oro', Gems: 'Gemas', Energy: 'Energía', 'Medium XP Potion': 'Poción de XP mediana', 'Rare Codex': 'Códice raro', 'Epic Codex': 'Códice épico', 'Legendary Codex': 'Códice legendario', 'Rare Prism': 'Prisma raro', 'Epic Prism': 'Prisma épico', 'Legendary Prism': 'Prisma legendario' }
export const SPIRE_ES: Record<string, string> = { 'water-spire': 'Aguja de Agua', 'fire-spire': 'Aguja de Fuego', 'earth-spire': 'Aguja de Tierra', 'wind-spire': 'Aguja de Aire', 'light-spire': 'Aguja de Luz', 'dark-spire': 'Aguja de Oscuridad' }
export const SPIRE_ELEMENT: Record<string, string> = { 'water-spire': 'Water', 'fire-spire': 'Fire', 'earth-spire': 'Earth', 'wind-spire': 'Wind', 'light-spire': 'Light', 'dark-spire': 'Dark' }
export const RUN_ES: Record<string, string> = {}

/** Guías oficiales agrupadas, con título en español escrito por Nexo; el contenido se lee en invokers.com. */
export const GUIDE_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'Primeros pasos', items: [['beginners', 'Guías para principiantes'], ['best-starter-invoker', 'Mejor Invoker inicial'], ['how-to-get-free-stars-and-orbs', 'Estrellas y orbes gratis'], ['how-to-progress-and-earn-free-rewards', 'Progresar y conseguir recompensas gratis'], ['my-box-and-gear-optimizer', 'Mi caja y optimizador del portal'], ['fusion', 'Fusión']] },
  { title: 'Combate', items: [['battle-and-combat', 'Batalla y combate'], ['stats', 'Estadísticas'], ['elements', 'Elementos'], ['buffs-debuffs-and-instant-effects', 'Mejoras, perjuicios y efectos instantáneos'], ['corruptions-and-tolerances', 'Corrupciones y tolerancias'], ['multi-battle', 'Multicombate']] },
  { title: 'Invokers', items: [['invokers-master-guide', 'Guía maestra de Invokers'], ['invokers', 'Todas las guías de Invokers'], ['how-invokers-work-in-battle', 'Cómo funcionan en combate'], ['levelling-up-invokers', 'Subir de nivel'], ['invoker-skills', 'Habilidades'], ['invoker-ascension', 'Ascensión'], ['invoker-awakening', 'Despertar'], ['relics', 'Reliquias'], ['accessories', 'Accesorios']] },
  { title: 'Titanes', items: [['titans-master-guide', 'Guía maestra de Titanes'], ['titans', 'Todas las guías de Titanes'], ['how-titans-work-in-battle', 'Cómo funcionan en combate'], ['titan-stats-parameters', 'Estadísticas y parámetros'], ['titan-skills', 'Habilidades de Titán'], ['upgrading-titans', 'Mejorar Titanes'], ['titan-ascension', 'Ascensión de Titanes'], ['titan-empowerment', 'Potenciación de Titanes']] },
  { title: 'Modos', items: [['bosses', 'Todas las guías de jefes'], ['arena', 'Arena'], ['arena-strategy', 'Estrategia de arena'], ['clans', 'Clanes']] },
  { title: 'Los mejores', items: [['top-invokers', 'Los mejores Invokers'], ['best-legendary-invokers', 'Mejores legendarios'], ['best-epic-invokers', 'Mejores épicos'], ['best-rare-invokers', 'Mejores raros'], ['best-damage-dealers', 'Mejores de daño'], ['best-supports', 'Mejores apoyos'], ['best-tanks', 'Mejores tanques'], ['best-debuffers', 'Mejores en perjuicios']] },
  { title: 'Cuenta y ayuda', items: [['faq', 'Preguntas frecuentes'], ['most-asked-discord-questions', 'Lo más preguntado en Discord'], ['play-on-multiple-devices', 'Jugar en varios dispositivos'], ['set-up-multiple-profiles', 'Varios perfiles'], ['find-session-report', 'Encontrar el informe de sesión'], ['google-account-login-help', 'Problemas con la cuenta de Google'], ['delete-invokers-account', 'Borrar la cuenta']] },
]
