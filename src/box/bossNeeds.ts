/** Qué pide cada jefe a tus habilidades, deducido de las habilidades publicadas en su guía oficial.
 *
 * Datos oficiales: para cada habilidad del jefe, sus efectos (perjuicios que te aplica, mejoras que se da,
 * corrupciones) y su texto de juego. Nexo deduce necesidades con reglas acotadas y cita la habilidad que las
 * origina; cruza cada necesidad con los efectos de las habilidades de cada Invoker (fichas oficiales). */
import type { Boss } from './goal'

export type Need = {
  id: string
  /** Lo que sirve (en español). */
  label: string
  /** Por qué lo pide este jefe, con la habilidad que lo origina. */
  why: string
  /** Claves de efecto de las fichas oficiales que lo cubren (p. ej. `effect:ReduceHealingReceived`). */
  effects: string[]
  /** También lo cubren las habilidades de área. */
  aoe?: boolean
  /** Contraindicación: estos efectos perjudican contra este jefe. */
  avoid?: boolean
}
export type HeroSkills = { effects: string[]; aoe: boolean; /** Tolerancias innatas del kit (ficha oficial), no de piezas. */ tolerances?: string[] }
export type SkillFit = { matched: Need[]; avoided: Need[] }

const HEALS = ['block:HealWithFormula', 'effect:ContinuousHealing']
const SUSTAIN = [...HEALS, 'effect:Shield', 'effect:IncreaseMaxHealth', 'effect:Unkillable']
const CLEANSE = ['block:RemoveStatusEffect:PurgeDebuffs', 'effect:BlockDebuff', 'effect:BlockControlDebuff', 'block:DecreaseStatusEffectDuration:ShortenDebuff', 'block:TransferDebuff']
const STRIP = ['block:RemoveStatusEffect:PurgeBuffs', 'block:StealBuff', 'block:DecreaseStatusEffectDuration:ShortenBuff', 'effect:BlockBuff']
const DEBUFF_EFFECT: Record<string, string> = { Bleed: 'effect:Bleed', Burn: 'effect:Burn', Stun: 'effect:Stun', Freeze: 'effect:Freeze', Shock: 'effect:Shock', Weaken: 'effect:DebuffDamageTaken' }
const first = <T,>(xs: T[]) => xs[0]

export function deriveNeeds(boss: Boss): Need[] {
  const skills = boss.skills ?? []
  const needs: Need[] = []
  const add = (n: Need) => { if (!needs.some(x => x.id === n.id)) needs.push(n) }
  const name = boss.name.split(' ')[0]
  const find = (re: RegExp) => skills.find(s => re.test(s.text))

  const selfHeal = find(new RegExp(`heals? ${name}|${name} is healed|heal(?:s|ing)? by \\d|heals all (?:alive )?(?:minions|crypt rats)|heal totems`, 'i'))
  if (selfHeal) add({ id: 'heal-reduction', label: 'Reducción de curación', why: `${boss.name} o sus invocaciones se curan («${selfHeal.name}»).`, effects: ['effect:ReduceHealingReceived'] })
  const summon = find(/\b(summons?|spawns?)\b/i)
  if (summon) add({ id: 'aoe', label: 'Daño en área', why: `Invoca enemigos o tótems («${summon.name}»).`, effects: [], aoe: true })
  const buffs = skills.filter(s => s.effects.some(e => e.group === 'Buffs'))
  if (buffs.length) add({ id: 'strip', label: 'Quitar o robar mejoras', why: `Se da mejoras como ${[...new Set(buffs.flatMap(s => s.effects.filter(e => e.group === 'Buffs').map(e => e.label)))].slice(0, 3).join(', ')} («${first(buffs).name}»).`, effects: STRIP })
  const debuffs = skills.filter(s => s.effects.some(e => e.group === 'Debuffs'))
  if (debuffs.length) add({ id: 'cleanse', label: 'Limpiar o evitar perjuicios', why: `Te aplica ${[...new Set(debuffs.flatMap(s => s.effects.filter(e => e.group === 'Debuffs').map(e => e.label)))].slice(0, 4).join(', ')} («${first(debuffs).name}»).`, effects: CLEANSE })
  const dot = skills.find(s => s.effects.some(e => e.group === 'DoT Corruption'))
  if (dot) add({ id: 'sustain', label: 'Curación o escudos', why: `Su corrupción hace daño continuo («${dot.name}»).`, effects: SUSTAIN })
  const drain = find(/decreases? the target'?s? ultimate mana/i)
  if (drain) add({ id: 'mana', label: 'Ganar maná de definitiva', why: `Te quita maná de definitiva («${drain.name}»).`, effects: ['block:ManaGeneration:GainUltimateMana'] })
  // Contraindicaciones explícitas en el texto oficial.
  for (const s of skills) {
    const m = /buff on \w+[^.]*every time an? (\w+) debuff is cast/i.exec(s.text)
    if (m && DEBUFF_EFFECT[m[1]]) add({ id: `avoid-${m[1].toLowerCase()}`, label: `Evitar ${m[1] === 'Bleed' ? 'Sangrado' : m[1]}`, why: `Cada ${m[1]} le da una mejora («${s.name}»).`, effects: [DEBUFF_EFFECT[m[1]]], avoid: true })
    if (/whenever an enemy is healed, destroys their max hp/i.test(s.text)) add({ id: 'avoid-heal', label: 'Curar con cuidado', why: `Cada curación destruye vida máxima («${s.name}»).`, effects: HEALS, avoid: true })
    for (const im of s.text.matchAll(/(?<!not )immune to (\w+)/gi)) if (DEBUFF_EFFECT[im[1]]) add({ id: `avoid-${im[1].toLowerCase()}`, label: `${im[1]} no le afecta`, why: `Es inmune («${s.name}»).`, effects: [DEBUFF_EFFECT[im[1]]], avoid: true })
  }
  // Útil contra cualquier jefe salvo inmunidad publicada: aumentan el daño que recibe.
  add({ id: 'amplify', label: 'DEF − o Debilitar', why: 'Aumentan el daño que recibe el jefe.', effects: ['effect:DebuffDefense', 'effect:DebuffDamageTaken'] })
  return needs
}

export function skillFit(hero: HeroSkills | undefined, needs: Need[]): SkillFit {
  if (!hero) return { matched: [], avoided: [] }
  const has = (n: Need) => n.effects.some(e => hero.effects.includes(e)) || (!!n.aoe && hero.aoe)
  return { matched: needs.filter(n => !n.avoid && has(n)), avoided: needs.filter(n => n.avoid && has(n)) }
}
