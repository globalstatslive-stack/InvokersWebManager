/** Simulación de combate por campeón a partir de las fichas oficiales de habilidades.
 *
 * Datos oficiales (invokers.com): fórmulas de cada golpe por nivel (% de ATQ / DEF / VIDA),
 * enfriamientos, coste y generación de maná, y qué habilidades necesitan Precisión.
 * Reglas oficiales (guía «Stats»):
 *   · daño = multiplicador × estadística; un crítico suma el Daño crítico
 *   · enfriamiento efectivo = base / (1 + Recuperación %)
 *   · el maná ganado se multiplica por (1 + Gen. maná %)
 *   · Vel. combo y Vel. habilidad acortan las animaciones
 *   · resistir un perjuicio: tabla oficial de la calculadora (RES − PREC → probabilidad de resistir)
 * Supuestos propios (no publicados), calibrados para un combate largo contra un jefe:
 *   duración de un golpe de combo, de una habilidad y de la definitiva, y la parte del maná
 *   del combo que da cada golpe. Están en ASSUMPTIONS y la interfaz los declara. */
import type { Box, Hero } from './model'
import { rating, type Stats } from './stats'
import toolTables from '../catalog/wiki/tools.json'

export type Term = [number, 'A' | 'D' | 'M']
export type Formula = ['D' | 'T' | 'H' | 'S', Term[]]
export type SkillDef = { n: string; a: 0 | 1; e: string[]; acc: 0 | 1; m: [number, number]; l: [number, number, Formula[]][] }
export type Kit = (SkillDef | null)[]
export const SKILL_KINDS = ['Combo', 'ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Ultimate'] as const

export const ASSUMPTIONS = {
  /** Segundos de un golpe de combo sin Vel. combo. */
  hit: 1.15,
  /** Segundos de animación de una habilidad activa y de la definitiva sin Vel. habilidad. */
  skill: 1.6, ultimate: 2.4,
  /** Fracción del maná del combo que da cada golpe. */
  comboManaShare: 0.5,
}

let cache: Promise<Record<string, Kit>> | undefined
/** Fichas de habilidades (se cargan aparte: ~100 KB comprimidas). */
export const loadKits = () => cache ??= import('../catalog/skills.json').then(m => m.default as unknown as Record<string, Kit>)

/** Probabilidad de que un perjuicio entre, según la guía oficial de Precisión contra Resistencia. */
/** Probabilidad de que entre un perjuicio (0–1) según la tabla oficial de la calculadora de invokers.com
 * (probabilidad de resistir en función de RES − PREC), sin modificadores de elemento ni mejoras. */
export function landChance(accuracy: number, resistance: number): number {
  const { min, max, values } = toolTables.resistChanceByDiff
  const resist = values[Math.min(Math.max(Math.round(resistance - accuracy), min), max) - min]
  return 1 - Math.min(Math.max(resist, 0), 100) / 100
}

export type SimSettings = { duration: number; targetRes: number }
export const DEFAULT_SIM: SimSettings = { duration: 180, targetRes: 475 }
export type SkillResult = { name: string; kind: string; casts: number; damage: number; heal: number; shield: number; cooldown: number; needsAccuracy: boolean }
export type SimResult = {
  damage: number; dps: number; heal: number; shield: number; land: number
  skills: SkillResult[]; critMultiplier: number
  rates: { combo: number; skill: number; recovery: number; mana: number }
  hits: number; ultimates: number
}
const FALLBACK: Record<string, number> = { comboSpeed: 0.185, skillSpeed: 0.185, skillRecovery: 0.25, manaGeneration: 0.5 }
const pct = (box: Box, stat: string, value: number) => (rating(box, stat, value) ?? Math.max(0, value) * FALLBACK[stat]) / 100
/** Curvas continuas: interpola entre puntos enteros para que el optimizador vea cada punto de estadística. */
function smooth(box: Box, stat: string, value: number) {
  const lo = Math.floor(value), f = value - lo
  return pct(box, stat, lo) * (1 - f) + pct(box, stat, lo + 1) * f
}
export function skillLevels(hero: Hero): number[] {
  return SKILL_KINDS.map(k => Math.max(1, Math.min(11, hero.skills.find(s => s.kind === k)?.level || 1)))
}

/** Combate sostenido contra un objetivo: reparto del tiempo entre habilidades, definitiva y combos. */
export function simulate(box: Box, kit: Kit, levels: number[], stats: Stats, settings: SimSettings = DEFAULT_SIM): SimResult {
  const T = settings.duration
  const combo = smooth(box, 'comboSpeed', stats.comboSpeed ?? 0), speed = smooth(box, 'skillSpeed', stats.skillSpeed ?? 0)
  const recovery = smooth(box, 'skillRecovery', stats.skillRecovery ?? 0), mana = smooth(box, 'manaGeneration', stats.manaGeneration ?? 0)
  const cr = Math.min(1, Math.max(0, stats.criticalRate ?? 0)), crit = 1 + cr * (stats.criticalDamage ?? 0)
  const value = (terms: Term[]) => terms.reduce((s, [p, k]) => s + p / 100 * (k === 'A' ? stats.attack ?? 0 : k === 'D' ? stats.defense ?? 0 : stats.health ?? 0), 0)
  const level = (i: number) => kit[i]?.l[Math.min((kit[i]?.l.length ?? 1), levels[i] ?? 1) - 1]
  const manaOf = (i: number) => { const s = kit[i]; if (!s) return 0; const n = s.l.length; return s.m[0] + (s.m[1] - s.m[0]) * (n > 1 ? ((levels[i] ?? 1) - 1) / (n - 1) : 0) }
  const sum = (i: number, kinds: string) => (level(i)?.[2] ?? []).filter(f => kinds.includes(f[0])).reduce((s, f) => s + value(f[1]), 0)

  const hitTime = ASSUMPTIONS.hit / (1 + combo), skillTime = ASSUMPTIONS.skill / (1 + speed), ultTime = ASSUMPTIONS.ultimate / (1 + speed)
  // Habilidades activas: una al empezar y después cada (enfriamiento efectivo + animación).
  const casts = [0, 0, 0, 0, 0], cooldowns = [0, 0, 0, 0, 0]
  let busy = 0, manaFromSkills = 0
  for (const i of [1, 2, 3]) {
    const l = level(i)
    if (!l) continue
    cooldowns[i] = l[0] / (1 + recovery)
    casts[i] = l[0] > 0 ? 1 + Math.max(0, T - skillTime) / (cooldowns[i] + skillTime) : 0
    busy += casts[i] * skillTime
    manaFromSkills += casts[i] * manaOf(i)
  }
  // Definitiva: limitada por el maná (combos + habilidades) y por su enfriamiento.
  const ult = level(4), comboLevel = level(0)
  const hitsPerCombo = Math.max(1, comboLevel?.[2].filter(f => f[0] === 'D').length ?? 5)
  const manaPerHit = manaOf(0) * ASSUMPTIONS.comboManaShare
  let ultimates = 0
  if (ult && ult[1] > 0) {
    cooldowns[4] = ult[0] / (1 + recovery)
    const free = Math.max(0, T - busy)
    const byMana = (manaFromSkills + manaPerHit * free / hitTime) * (1 + mana) / (ult[1] + manaPerHit * ultTime * (1 + mana) / hitTime)
    ultimates = Math.max(0, Math.min(byMana, T / (cooldowns[4] + ultTime)))
  }
  casts[4] = ultimates
  const hits = Math.max(0, T - busy - ultimates * ultTime) / hitTime
  casts[0] = hits
  const comboAverage = sum(0, 'D') / hitsPerCombo

  const land = landChance(stats.accuracy ?? 0, settings.targetRes)
  const skills = kit.map((s, i): SkillResult | null => {
    if (!s) return null
    const perCast = i === 0 ? comboAverage : sum(i, 'DT')
    return {
      name: s.n, kind: SKILL_KINDS[i], casts: casts[i], cooldown: cooldowns[i], needsAccuracy: !!s.acc,
      damage: casts[i] * perCast * crit, heal: casts[i] * (i === 0 ? sum(0, 'H') / hitsPerCombo : sum(i, 'H')), shield: casts[i] * (i === 0 ? sum(0, 'S') / hitsPerCombo : sum(i, 'S')),
    }
  }).filter((x): x is SkillResult => !!x)
  const damage = skills.reduce((s, x) => s + x.damage, 0)
  return {
    damage, dps: damage / T, heal: skills.reduce((s, x) => s + x.heal, 0), shield: skills.reduce((s, x) => s + x.shield, 0), land,
    skills, critMultiplier: crit, rates: { combo, skill: speed, recovery, mana }, hits, ultimates,
  }
}

/** Qué pide el kit del campeón: de qué estadística escala y qué papel cumple. */
export type Profile = {
  scaling: { attack: number; defense: number; health: number }
  needsAccuracy: boolean; accuracySkills: string[]
  debuffs: string[]; buffs: string[]; control: string[]
  heals: boolean; shields: boolean
  /** Peso de cada componente del índice (suman 1). */
  mix: Mix
}
export type Mix = { damage: number; control: number; sustain: number; tough: number }
const CONTROL = ['Stun', 'Freeze', 'Root', 'Taunt', 'BlockActiveSkills', 'BlockUltimateSkill', 'Shock']
export function profileOf(hero: Hero, kit: Kit, levels: number[]): Profile {
  const scaling = { attack: 0, defense: 0, health: 0 }
  let heals = false, shields = false
  const effects = new Set<string>(), accuracySkills: string[] = []
  kit.forEach((s, i) => {
    if (!s) return
    for (const e of s.e) effects.add(e)
    if (s.acc) accuracySkills.push(s.n)
    for (const [kind, terms] of s.l[Math.min(s.l.length, levels[i] ?? 1) - 1][2]) {
      if (kind === 'H') heals = true
      if (kind === 'S') shields = true
      if (kind === 'D' || kind === 'T') for (const [p, k] of terms) scaling[k === 'A' ? 'attack' : k === 'D' ? 'defense' : 'health'] += p * (i === 0 ? 0.2 : 1)
    }
  })
  const total = scaling.attack + scaling.defense + scaling.health || 1
  const all = [...effects]
  const debuffs = all.filter(e => e.startsWith('Debuff') || ['Bleed', 'Burn', 'Curse', 'ReduceHealingReceived', 'BlockBuff'].includes(e))
  const control = all.filter(e => CONTROL.includes(e))
  const buffs = all.filter(e => e.startsWith('Buff') || ['Shield', 'ContinuousHealing', 'BlockDebuff', 'Protect', 'Unkillable', 'Invincibility'].includes(e))
  const needsAccuracy = accuracySkills.length > 0
  // Reparto del índice según el kit y la clase.
  const tank = hero.cls === 'Tank', support = hero.cls === 'Support'
  let mix: Mix = { damage: 1, control: 0, sustain: 0, tough: 0 }
  if (needsAccuracy) mix.control = Math.min(0.4, 0.14 * accuracySkills.length + (control.length ? 0.08 : 0))
  if (heals || shields) mix.sustain = support ? 0.4 : 0.2
  if (tank) mix.tough = 0.45; else if (support) mix.tough = 0.15
  if (support && !(heals || shields)) mix.control = Math.max(mix.control, needsAccuracy ? 0.35 : 0)
  mix.damage = Math.max(0.1, 1 - mix.control - mix.sustain - mix.tough)
  const sumMix = mix.damage + mix.control + mix.sustain + mix.tough
  mix = { damage: mix.damage / sumMix, control: mix.control / sumMix, sustain: mix.sustain / sumMix, tough: mix.tough / sumMix }
  return { scaling: { attack: scaling.attack / total, defense: scaling.defense / total, health: scaling.health / total }, needsAccuracy, accuracySkills, debuffs, buffs, control, heals, shields, mix }
}

/** Índice de un conjunto de estadísticas frente a las actuales: 100 = igual que ahora.
 * Media geométrica ponderada de daño, control (probabilidad de aplicar perjuicios),
 * sustento (curación y escudos) y aguante (vida y defensa). */
export function indexOf(mix: Mix, now: { sim: SimResult; stats: Stats }, base: { sim: SimResult; stats: Stats }): number {
  const ratio = (a: number, b: number) => Math.max(1e-6, a) / Math.max(1e-6, b)
  const tough = (s: Stats) => Math.sqrt(Math.max(1, s.health ?? 1) * Math.max(1, s.defense ?? 1))
  const log =
    mix.damage * Math.log(ratio(now.sim.damage, base.sim.damage)) +
    mix.control * Math.log(ratio(0.05 + now.sim.land, 0.05 + base.sim.land)) +
    mix.sustain * Math.log(ratio(now.sim.heal + now.sim.shield, base.sim.heal + base.sim.shield)) +
    mix.tough * Math.log(ratio(tough(now.stats), tough(base.stats)))
  return 100 * Math.exp(log)
}

export const EFFECT_LABEL: Record<string, string> = {
  DebuffDefense: 'Bajar DEF', DebuffAttack: 'Bajar ATQ', DebuffDamageTaken: 'Más daño recibido', DebuffResistance: 'Bajar RES', BuffAttack: 'Subir ATQ',
  Bleed: 'Sangrado', Stun: 'Aturdir', Burn: 'Quemadura', DebuffComboSpeed: 'Bajar vel. combo', ReduceHealingReceived: 'Menos curación', DebuffMoveSpeed: 'Ralentizar',
  Shock: 'Descarga', DebuffAccuracy: 'Bajar PREC', DebuffComboAccuracy: 'Ceguera', BuffCriticalDamage: 'Subir daño crít.', BuffDefense: 'Subir DEF', BuffCriticalRate: 'Subir crít.',
  Taunt: 'Provocar', Curse: 'Maldición', DebuffCriticalRate: 'Bajar crít.', BuffComboSpeed: 'Subir vel. combo', BlockDebuff: 'Inmunidad', BuffSkillRecoverySpeed: 'Subir recuperación',
  BuffMoveSpeed: 'Subir movimiento', BlockPassiveEffects: 'Bloquear pasivas', BlockBuff: 'Bloquear mejoras', ContinuousHealing: 'Regeneración', DebuffSkillRecoverySpeed: 'Bajar recuperación',
  Root: 'Enraizar', BuffDodgeChance: 'Evasión', BlockControlDebuff: 'Inmune a control', BuffSkillSpeed: 'Subir vel. hab.', Protect: 'Proteger', BlockActiveSkills: 'Silenciar',
  BuffDamageTaken: 'Menos daño recibido', ReflectDamage: 'Reflejar daño', BuffResistance: 'Subir RES', DebuffSkillSpeed: 'Bajar vel. hab.', Freeze: 'Congelar', Unkillable: 'Inmortal',
  Shield: 'Escudo', Invincibility: 'Invencible', BlockRevive: 'Bloquear revivir', BuffAccuracy: 'Subir PREC', BlockUltimateSkill: 'Bloquear definitiva', DebuffCriticalDamage: 'Bajar daño crít.',
}
