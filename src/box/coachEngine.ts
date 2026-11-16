/** Motor del Coach personalizado: decide el siguiente paso más conveniente para la cuenta y lo justifica con datos.
 *
 * Para cada objetivo (la cuenta en general o una fase de tus récords: superar un jefe, farmear más rápido, arena,
 * agujas) se eligen los Invokers en los que centrarse y se generan acciones concretas. Cada acción dice qué cambiar,
 * a quién afecta, cuánto mejora (cuando se puede calcular), qué necesita, con qué confianza y si está disponible ya.
 *
 * Cálculos y fuentes:
 * · Piezas: fórmula de estadísticas verificada con la caja (total = base + equipo + basisFlat + sala) → exacto.
 * · Habilidades: simulador con las fórmulas oficiales de cada nivel y supuestos de animación y maná → aproximado.
 * · Vínculo de Titán: valores de la caja (global, especializado en su modo o fuera de él); el % se aplica sobre la
 *   base, como el resto de % del juego (supuesto: la guía no lo detalla).
 * · Tolerancias de habilidad: +10 % por nivel (fichas oficiales) frente al objetivo de la guía del jefe.
 * · Sala de trofeos: valor por nivel observado en tu caja.
 * · Ascensión y despertar: sin cifra calculable (la base no crece de forma lineal y los nodos no se publican);
 *   se ordenan por su propio criterio y se dice.
 * Valor de un Invoker: el mismo perfil del optimizador (daño por golpe para atacantes, pesos de clase para el resto)
 * y, contra un jefe o un piso, × (0,05 + probabilidad oficial de que entren sus perjuicios) elevado a su peso de
 * control (el mismo índice que usa el simulador) si sus habilidades necesitan PREC.
 * Nexo no estima probabilidades de victoria ni resultados de combate. */
import { canBind, type Box, type Gear, type Hero, type Titan } from './model'
import { BoxIndex, projectStats, type Stats } from './stats'
import { valueOf } from './usefulness'
import { PRESETS, presetFor, STAT_SCALE } from './optimizer'
import { indexOf, landChance, profileOf, simulate, skillLevels, SKILL_KINDS, type Kit, type Profile } from './combat'
import { changeSummary, levelChanges, type SkillChange, type SkillLevelText } from './skillDiff'
import { bossSlugOf, toleranceKey } from './goal'
import { heroWeight, type HallOption, type HallCosts, type Wallet } from './trophyHall'
import type { UsedHero } from './equipBatch'
import { ACCESSORY_SLOTS, ELEMENT_LABEL, fmtInt, PERCENT_OF_BASE, RELIC_SLOTS, SET_LABEL, SKILL_LABEL, SLOT_LABEL, STAT_LABEL, t } from './i18n'

// ───────────────────────── Objetivos ─────────────────────────
export type ObjectiveChoice = { kind: 'general' } | { kind: 'record'; mode: string; key: string; difficulty?: string; level: number; intent: 'beat' | 'faster' }
export type ObjectiveGroup = 'Cuenta' | 'Superar' | 'Farmear' | 'Arena' | 'Agujas'
export type ObjectiveOption = { id: string; choice: ObjectiveChoice; label: string; detail: string; group: ObjectiveGroup }
/** Datos de la fase: del catálogo de jefes (guías oficiales) o de las agujas (fichas oficiales). */
export type StageInfo = { res: number; accGoal: number | null; resGoal: number | null; tolGoal: number | null; corruptions: string[]; element: string | null; source: string }
export type CatalogBoss = { slug: string; name: string; corruptions: { key: string }[]; stages: { res: number; accGoal: number; resGoal: number; tolGoal: number; element: string }[]; guide: string }
export type CatalogSpire = { slug: string; name: string; floors: { floor: number; res: number; element: string | null }[]; official: string }
export type Catalogs = { bosses?: CatalogBoss[]; spires?: CatalogSpire[] }

export type Objective = {
  id: string; label: string; choice: ObjectiveChoice
  /** Modo del récord (dungeon, clanBoss, tower, arena); null en general. */
  mode: string | null
  /** Invokers en los que se centra y su peso (suma 1). */
  team: Hero[]; weights: Map<number, number>
  /** Titán vinculado ahora a cada Invoker del equipo (del récord). */
  titans: Map<number, number | null>
  stage: StageInfo | null
  /** Récord en esa fase (o en la última superada si es «superar»). */
  record: { level: number; victories: number; defeats: number; bestTime: number; highest: number } | null
  /** De dónde sale el equipo. */
  teamSource: string
}

const fmtTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '—'
const spireFor = (key: string, label: string, spires: CatalogSpire[] = []) => spires.find(s => s.slug === key || s.name.toLowerCase() === label.toLowerCase())

/** Objetivos posibles, sacados de tus récords (sin pedirte nada). */
export function objectiveOptions(box: Box, cat: Catalogs = {}): ObjectiveOption[] {
  const out: ObjectiveOption[] = [{ id: 'general', choice: { kind: 'general' }, label: 'Toda la cuenta', detail: 'Los Invokers que usas, por cuánto los usas', group: 'Cuenta' }]
  for (const tm of box.teams) {
    const levels = tm.levels.filter(l => l.slots.length)
    if (!levels.length) continue
    const boss = cat.bosses?.find(b => b.slug === bossSlugOf(tm))
    const variant = tm.mode === 'clanBoss' && tm.detail ? ` ${tm.detail}` : tm.mode === 'dungeon' && /omnissi/.test(tm.key) && tm.detail ? ` ${tm.detail}` : ''
    const name = `${boss && !variant ? boss.name : tm.label}${variant}`
    const diff = tm.difficulty || undefined
    const hard = diff && diff !== 'Normal' ? ` (${diff === 'Hard' ? 'difícil' : diff})` : ''
    const base = `${tm.mode}:${tm.key}:${diff ?? ''}`
    if (tm.mode === 'dungeon' || tm.mode === 'clanBoss') {
      const max = boss?.stages.length ?? Infinity
      if (tm.highestLevel < max) out.push({ id: `beat:${base}:${tm.highestLevel + 1}`, choice: { kind: 'record', mode: tm.mode, key: tm.key, difficulty: diff, level: tm.highestLevel + 1, intent: 'beat' },
        label: `Superar ${name} ${tm.highestLevel + 1}`, detail: `Récord: fase ${tm.highestLevel}`, group: 'Superar' })
      // Fase que más farmeas: la de más victorias.
      const farm = [...levels].sort((a, b) => b.victories - a.victories || b.level - a.level)[0]
      if (farm && farm.victories >= 5) out.push({ id: `faster:${base}:${farm.level}`, choice: { kind: 'record', mode: tm.mode, key: tm.key, difficulty: diff, level: farm.level, intent: 'faster' },
        label: `Farmear ${name} ${farm.level} más rápido`, detail: `${fmtInt(farm.victories)} victorias · mejor tiempo ${fmtTime(farm.bestTime)}`, group: 'Farmear' })
    } else if (tm.mode === 'tower') {
      out.push({ id: `beat:${base}:${tm.highestLevel + 1}`, choice: { kind: 'record', mode: 'tower', key: tm.key, difficulty: diff, level: tm.highestLevel + 1, intent: 'beat' },
        label: `${tm.label}${hard}: piso ${tm.highestLevel + 1}`, detail: `Récord: piso ${tm.highestLevel}`, group: 'Agujas' })
    } else if (tm.mode === 'arena' && /attack|offen/i.test(`${tm.key} ${tm.detail ?? ''}`)) {
      const l = levels[0]
      out.push({ id: `beat:${base}:${l.level}`, choice: { kind: 'record', mode: 'arena', key: tm.key, difficulty: diff, level: l.level, intent: 'beat' },
        label: 'Arena (ataque)', detail: `${fmtInt(l.victories)} victorias · ${fmtInt(l.defeats)} derrotas`, group: 'Arena' })
    }
  }
  // Una opción por récord (las claves repetidas, como Sedula por elemento, ya llevan su variante).
  return [...new Map(out.map(o => [o.id, o])).values()]
}

/** Resuelve un objetivo: equipo, pesos, fase y récord. Sin récord utilizable, vuelve a «toda la cuenta». */
export function resolveObjective(box: Box, choice: ObjectiveChoice, used: UsedHero[], cat: Catalogs = {}): Objective {
  const heroes = new Map(box.heroes.map(h => [h.id, h]))
  const general = (): Objective => {
    const pool = used.filter(u => u.hero.basis && u.hero.gearBonus).slice(0, 15)
    const total = pool.reduce((s, u) => s + heroWeight(u), 0) || 1
    return { id: 'general', label: 'Toda la cuenta', choice: { kind: 'general' }, mode: null, team: pool.map(u => u.hero),
      weights: new Map(pool.map(u => [u.hero.id, heroWeight(u) / total])), titans: new Map(), stage: null, record: null,
      teamSource: 'Los Invokers que usas (equipos activos y plan o, si no hay, tus equipos registrados de nivel 30 o más)' }
  }
  if (choice.kind === 'general') return general()
  const tm = box.teams.find(x => x.mode === choice.mode && x.key === choice.key && (!choice.difficulty || x.difficulty === choice.difficulty))
  if (!tm) return general()
  // Equipo: el del récord en esa fase o, para superar una nueva, el de tu última fase superada.
  const at = tm.levels.find(l => l.level === choice.level && l.slots.length) ?? [...tm.levels].filter(l => l.slots.length && l.level <= choice.level).sort((a, b) => b.level - a.level)[0]
  if (!at) return general()
  const team = at.slots.map(s => heroes.get(s.heroId)).filter((h): h is Hero => !!h)
  const boss = cat.bosses?.find(b => b.slug === bossSlugOf(tm))
  let stage: StageInfo | null = null
  if (boss && (tm.mode === 'dungeon' || tm.mode === 'clanBoss')) {
    const st = boss.stages[choice.level - 1]
    if (st) stage = { res: st.res, accGoal: st.accGoal, resGoal: st.resGoal, tolGoal: st.tolGoal, corruptions: boss.corruptions.map(c => c.key), element: st.element, source: `guía oficial de ${boss.name}` }
  } else if (tm.mode === 'tower') {
    const sp = spireFor(tm.key, tm.label, cat.spires), fl = sp?.floors.find(f => f.floor === choice.level)
    if (fl) stage = { res: fl.res, accGoal: null, resGoal: null, tolGoal: null, corruptions: [], element: fl.element, source: `ficha oficial de ${sp!.name}` }
  }
  const variant = (tm.mode === 'clanBoss' || /omnissi/.test(tm.key)) && tm.detail ? ` ${tm.detail}` : ''
  const name = `${boss && !variant ? boss.name : tm.label}${variant}`
  const hard = tm.difficulty && tm.difficulty !== 'Normal' ? ` (${tm.difficulty === 'Hard' ? 'difícil' : tm.difficulty})` : ''
  const label = choice.intent === 'faster' ? `Farmear ${name} ${choice.level} más rápido` : tm.mode === 'arena' ? 'Arena (ataque)' : tm.mode === 'tower' ? `${tm.label}${hard}: piso ${choice.level}` : `Superar ${name} ${choice.level}`
  const usable = team.filter(h => h.basis && h.gearBonus)
  return {
    id: `${choice.intent}:${tm.mode}:${tm.key}:${tm.difficulty || ''}:${choice.level}`, label, choice, mode: tm.mode,
    team: usable, weights: new Map(usable.map(h => [h.id, 1 / (usable.length || 1)])),
    titans: new Map(at.slots.map(s => [s.heroId, s.titanId])), stage,
    record: { level: at.level, victories: at.victories, defeats: at.defeats, bestTime: at.bestTime, highest: tm.highestLevel },
    teamSource: at.level === choice.level ? `Tu equipo del mejor tiempo en la fase ${at.level} (récord de la caja)` : `Tu equipo del mejor tiempo en la fase ${at.level}, la última que has superado (récord de la caja)`,
  }
}

// ───────────────────────── Valoración ─────────────────────────
/** Valor de un Invoker para el objetivo (ver cabecera). */
export function heroValue(hero: Hero, stats: Stats, obj: Pick<Objective, 'stage'>, profile?: Profile | null): number {
  let v = valueOf(hero, stats).value
  if (obj.stage && profile?.needsAccuracy) v *= Math.pow(0.05 + landChance(stats.accuracy ?? 0, obj.stage.res), profile.mix.control)
  return v
}
const rel = (after: number, before: number) => before > 0 ? after / before - 1 : 0
/** Desglose legible de un cambio: daño (o valor de su perfil) y, contra un jefe o piso, probabilidad de que entren
 * sus perjuicios (tabla oficial PREC − RES). Así se ve si gana daño o lo cambia por precisión. */
export function breakdown(hero: Hero, before: Stats, after: Stats, obj: Pick<Objective, 'stage'>, profile?: Profile | null): string {
  const v0 = valueOf(hero, before), v1 = valueOf(hero, after)
  const parts = [`${v0.unit === 'damage' ? 'daño' : 'valor de su perfil'} ${pctText(rel(v1.value, v0.value))}`]
  if (obj.stage && profile?.needsAccuracy) {
    const l0 = landChance(before.accuracy ?? 0, obj.stage.res), l1 = landChance(after.accuracy ?? 0, obj.stage.res)
    if (Math.abs(l1 - l0) >= 0.01) parts.push(`sus perjuicios entran ${Math.round(100 * l0)} % → ${Math.round(100 * l1)} % de las veces contra RES ${obj.stage.res}`)
  }
  return parts.join(' · ')
}

// ───────────────────────── Acciones ─────────────────────────
export type ActionKind = 'gear' | 'trapped' | 'upgrade' | 'skill' | 'tolerance' | 'titan' | 'slot' | 'awaken' | 'ascend' | 'hall'
export type Availability = 'now' | 'resources' | 'info'
export type Confidence = 'alta' | 'media' | 'baja'
export type CostKind = 'free' | 'gold' | 'trophies' | 'resources' | 'copies'
export type CheckSpec =
  | { kind: 'gear'; heroId: number; slot: string; gearKind: 'relic' | 'accessory'; gearId: number }
  /** `level`: nivel de ficha (1–11) que debe alcanzar. */
  | { kind: 'skill'; heroId: number; skill: string; level: number }
  | { kind: 'tolerance'; heroId: number; stat: string; value: number }
  | { kind: 'titan'; heroId: number; titanId: number; mode: string; key: string }
  | { kind: 'gearset'; heroId: number; items: { slot: string; gearKind: 'relic' | 'accessory'; gearId: number }[] }
  | { kind: 'rank'; heroId: number; rank: number }
  | { kind: 'awake'; heroId: number; awake: number }
  | { kind: 'hall'; element: string; stat: string; level: number }
export type CoachAction = {
  id: string; kind: ActionKind
  title: string
  /** Invoker principal y todos los afectados. */
  hero: Hero | null; heroes: Hero[]
  gear?: Gear; titan?: Titan
  /** Mejora ponderada por el objetivo, en % (null: no se puede calcular con datos oficiales). */
  impact: number | null
  /** Mejora relativa por Invoker (0,05 = +5 %). */
  perHero: { hero: Hero; gain: number }[]
  effect: string
  why: string[]
  needs: string
  cost: { kind: CostKind; gold?: number; text: string }
  availability: Availability
  confidence: Confidence; confidenceWhy: string
  significant: boolean
  score: number
  how: string[]
  details: { label: string; value: string; good?: boolean }[]
  /** Cambio de pieza listo para añadir al Plan. */
  plan?: { heroId: number; kind: 'relic' | 'accessory'; slot: string; gearId: number }[]
  check: CheckSpec
}

/** Ponderación (criterio de Nexo, a la vista en «Cómo decide»): impacto × confianza × disponibilidad × coste. */
export const CONFIDENCE_WEIGHT: Record<Confidence, number> = { alta: 1, media: 0.75, baja: 0.5 }
export const AVAILABILITY_WEIGHT: Record<Availability, number> = { now: 1, resources: 0.7, info: 0.45 }
export const COST_WEIGHT: Record<CostKind, number> = { free: 1, gold: 0.92, trophies: 0.9, resources: 0.8, copies: 0.75 }
/** Lo que no tiene cifra se ordena por su propio criterio (0–1) como si valiera, como mucho, esto (en %). */
export const UNQUANTIFIED_CAP = 0.6
/** Cumplir un objetivo publicado de la guía (tolerancia) vale como este impacto (en %), repartido por el peso. */
export const GOAL_BONUS = 5
/** Ganancia mínima para proponer un cambio de pieza o de vínculo (1 %). */
export const MIN_GAIN = 0.01

/** El oro de desequipar resta según la cantidad: la puntuación se divide entre (1 + oro / 100.000). */
export const GOLD_SCALE = 100_000
export function scoreOf(a: Pick<CoachAction, 'impact' | 'confidence' | 'availability' | 'cost'>, fallback = 0): number {
  const impact = a.impact ?? Math.min(UNQUANTIFIED_CAP, fallback * UNQUANTIFIED_CAP)
  const gold = a.cost.kind === 'gold' ? 1 / (1 + (a.cost.gold ?? 0) / GOLD_SCALE) : COST_WEIGHT[a.cost.kind]
  return impact * CONFIDENCE_WEIGHT[a.confidence] * AVAILABILITY_WEIGHT[a.availability] * gold
}

export const gearName = (g: Gear) => `${SLOT_LABEL[g.slot] ?? g.slot} ${g.rank}★ ${g.set ? t(SET_LABEL, g.set) : g.faction ?? ''} +${g.level}`.replace(/\s+/g, ' ').trim()
const pctText = (x: number, digits = 1) => `${x >= 0 ? '+' : '−'}${(100 * Math.abs(x)).toFixed(digits).replace('.', ',')} %`
const KEY_STATS = ['attack', 'health', 'defense', 'criticalRate', 'criticalDamage', 'accuracy', 'resistance', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration', 'instinct']
const RATIO = new Set(['criticalRate', 'criticalDamage'])
/** Cambios de estadísticas más importantes para su perfil (pesos del optimizador; los atacantes, daño primero). */
function statDelta(before: Stats, after: Stats, n = 3, hero?: Hero): string {
  const w = hero ? PRESETS.find(p => p.id === presetFor(hero))!.weights : {}
  const dmg = (w.damage ?? 0) > 0 ? new Set(['attack', 'criticalRate', 'criticalDamage']) : new Set<string>()
  const weight = (k: string) => (dmg.has(k) ? 10 : 0) + (w[k] ?? 0.2)
  const d = KEY_STATS.map(k => ({ k, v: (after[k] ?? 0) - (before[k] ?? 0) })).filter(x => Math.abs(x.v) >= (RATIO.has(x.k) ? 0.005 : 0.5))
  const scale = (k: string) => (PERCENT_OF_BASE.has(k) ? (before[k] || 1) / 10 : 1) * (STAT_SCALE[k] ?? 10)
  d.sort((a, b) => weight(b.k) * Math.abs(b.v) / scale(b.k) - weight(a.k) * Math.abs(a.v) / scale(a.k))
  return d.slice(0, n).map(x => `${x.v > 0 ? '+' : '−'}${RATIO.has(x.k) ? `${(100 * Math.abs(x.v)).toFixed(1).replace('.', ',')} %` : fmtInt(Math.round(Math.abs(x.v)))} ${STAT_LABEL[x.k] ?? x.k}`).join(', ')
}

export type EngineInput = {
  index: BoxIndex
  objective: Objective
  /** Invokers que usas (para no quitarles piezas). */
  used: Set<number>
  /** Invokers protegidos: equipos activos, plan y equipo del objetivo. */
  protect: Set<number>
  /** Piezas reservadas en el Plan (`relic12`). */
  reserved: Set<string>
  kits?: Record<string, Kit> | null
  /** Fichas oficiales (texto de cada nivel de habilidad y tolerancias) por código de personaje. */
  skillText?: Map<string, { skills: { type: string; levels: SkillLevelText[] }[]; tolerances: { key: string; levels: string[] }[] }>
  hall?: { options: HallOption[]; wallet: Wallet | null; costs: HallCosts } | null
  ascend?: { hero: Hero; to: number; score: number; units: number; have: boolean; why: string }[] | null
}

const SKILL_TYPE: Record<string, string> = { Combo: 'Combo', ActiveSkill1: 'Active Skill1', ActiveSkill2: 'Active Skill2', ActiveSkill3: 'Active Skill3', Ultimate: 'Ultimate' }
const profiles = new WeakMap<Hero, Profile | null>()
function profileFor(h: Hero, kits?: Record<string, Kit> | null): Profile | null {
  if (!kits) return null
  if (!profiles.has(h)) profiles.set(h, kits[h.code] ? profileOf(h, kits[h.code], skillLevels(h)) : null)
  return profiles.get(h) ?? null
}

/** Mejor pieza para cada ranura de los Invokers del objetivo: libres o puestas en Invokers que no usas. */
function gearActions(inp: EngineInput): CoachAction[] {
  const { index, objective: obj } = inp, box = index.box
  type Move = { h: Hero; slot: string; kind: 'relic' | 'accessory'; piece: Gear; replaces: Gear | null; gain: number; before: Stats; after: Stats; owner: Hero | null; w: number; alt: { piece: Gear; gain: number }[] }
  const moves: Move[] = []
  const focus = obj.team.filter(h => h.basis && h.gearBonus).slice(0, 12)
  const owners = new Map(box.heroes.map(h => [h.id, h]))
  for (const h of focus) {
    const w = obj.weights.get(h.id) ?? 0
    if (w <= 0) continue
    const profile = profileFor(h, inp.kits)
    const current = index.equipped(h)
    const before = projectStats(h, current, index.rules), v0 = heroValue(h, before, obj, profile)
    const slots: [string, 'relic' | 'accessory'][] = [...RELIC_SLOTS.map(s => [s, 'relic'] as [string, 'relic']), ...ACCESSORY_SLOTS.filter(s => h.awakeLevel >= (box.accessorySlotAwake[s] ?? 99)).map(s => [s, 'accessory'] as [string, 'accessory'])]
    for (const [slot, kind] of slots) {
      const replaces = current.find(g => g.kind === kind && g.slot === slot) ?? null
      const pool = (kind === 'relic' ? box.relics : box.accessories).filter(g => g.slot === slot && g.equippedHeroId !== h.id && !inp.reserved.has(`${kind}${g.id}`)
        && (kind === 'relic' || g.faction === h.faction)
        && (g.equippedHeroId === null || (!inp.used.has(g.equippedHeroId) && !inp.protect.has(g.equippedHeroId))))
      const scored: { piece: Gear; gain: number; after: Stats }[] = []
      for (const g of pool) {
        const after = projectStats(h, [...current.filter(x => x !== replaces), g], index.rules)
        const gain = rel(heroValue(h, after, obj, profile), v0)
        if (gain >= MIN_GAIN) scored.push({ piece: g, gain, after })
      }
      if (!scored.length) continue
      scored.sort((a, b) => b.gain - a.gain)
      const best = scored[0]
      moves.push({ h, slot, kind, piece: best.piece, replaces, gain: best.gain, before, after: best.after, owner: best.piece.equippedHeroId ? owners.get(best.piece.equippedHeroId) ?? null : null, w,
        alt: scored.slice(1, 4).map(x => ({ piece: x.piece, gain: x.gain })) })
    }
  }
  // Cada pieza a un solo Invoker y cada ranura una vez, por lo que aporta al objetivo.
  moves.sort((a, b) => b.w * b.gain - a.w * a.gain)
  const taken = new Set<string>(), slotDone = new Set<string>(), chosen: Move[] = []
  for (const m of moves) {
    const pk = `${m.kind}${m.piece.id}`, sk = `${m.h.id}:${m.kind}:${m.slot}`
    if (taken.has(pk) || slotDone.has(sk)) continue
    taken.add(pk); slotDone.add(sk); chosen.push(m)
  }
  // Una acción por Invoker: todos sus cambios juntos (los conjuntos se calculan con todas las piezas a la vez).
  const byHero = new Map<number, Move[]>()
  for (const m of chosen) byHero.set(m.h.id, [...(byHero.get(m.h.id) ?? []), m])
  const out: CoachAction[] = []
  for (const ms of byHero.values()) {
    const h = ms[0].h, w = ms[0].w, before = ms[0].before
    const current = index.equipped(h)
    const removed = new Set(ms.map(m => m.replaces).filter((g): g is Gear => !!g))
    const after = projectStats(h, [...current.filter(g => !removed.has(g)), ...ms.map(m => m.piece)], index.rules)
    const p = profileFor(h, inp.kits)
    const gain = ms.length === 1 ? ms[0].gain : rel(heroValue(h, after, obj, p), heroValue(h, before, obj, p))
    if (gain < MIN_GAIN) continue
    const gold = ms.reduce((t, m) => t + (m.owner ? m.piece.unequipGold : 0) + (m.replaces?.unequipGold ?? 0), 0)
    const trapped = ms.filter(m => m.owner)
    const empty = ms.filter(m => !m.replaces).length
    const one = ms.length === 1 ? ms[0] : null
    const sets = one && one.piece.set && one.piece.set !== one.replaces?.set ? ` Cambia de conjunto: ${one.replaces?.set ? t(SET_LABEL, one.replaces.set) : 'ninguno'} → ${t(SET_LABEL, one.piece.set)} (el cálculo ya incluye conjuntos que se activan o se pierden).` : ''
    out.push({
      id: `${trapped.length ? 'trapped' : 'gear'}:${h.id}:${ms.map(m => `${m.kind}${m.piece.id}`).sort().join(',')}`, kind: trapped.length ? 'trapped' : 'gear',
      title: one ? (one.owner ? `Pasa a ${h.name} la pieza ${gearName(one.piece)} que lleva ${one.owner.name}` : `Equipa a ${h.name}: ${gearName(one.piece)}`)
        : `${empty === ms.length ? 'Completa' : 'Mejora'} el equipo de ${h.name}: ${ms.length} piezas`,
      hero: h, heroes: [h], gear: one?.piece,
      impact: 100 * w * gain, perHero: [{ hero: h, gain }],
      effect: `${pctText(gain)} para ${h.name}: ${breakdown(h, before, after, obj, p)} (${statDelta(before, after, 3, h)})`,
      why: [
        one ? (one.owner ? `Está puesta en ${one.owner.name}, que no está en tus equipos: en ${h.name} rinde más.` : 'Es una pieza libre: no la lleva nadie.')
          : `${empty ? `${empty} ${empty === 1 ? 'ranura vacía' : 'ranuras vacías'}` : ''}${empty && ms.length > empty ? ' y ' : ''}${ms.length > empty ? `${ms.length - empty} ${ms.length - empty === 1 ? 'pieza que mejora' : 'piezas que mejoran'}` : ''}, con piezas ${trapped.length ? `libres o de Invokers que no usas (${[...new Set(trapped.map(m => m.owner!.name))].join(', ')})` : 'libres'}.`,
        one ? `${one.replaces ? `Sustituye a ${gearName(one.replaces)}.` : 'Ocupa una ranura vacía.'}${sets}` : 'La ganancia se calcula con todas las piezas a la vez, conjuntos incluidos.',
        'Cálculo exacto con la fórmula de estadísticas verificada en tu caja.',
      ],
      needs: gold ? `${fmtInt(gold)} de oro de desequipar (dato de la caja)` : 'Nada: piezas libres',
      cost: gold ? { kind: 'gold', gold, text: `${fmtInt(gold)} oro` } : { kind: 'free', text: 'Gratis' },
      availability: 'now', confidence: 'alta', confidenceWhy: 'Estadísticas exactas; el valor usa el perfil del optimizador.',
      significant: gain >= 0.03, score: 0,
      how: ['Pulsa «Añadir al plan» y envíalo al optimizador oficial desde Plan (tandas de 5).', 'O en el juego: Invoker → equipo → ranura → elige la pieza.'],
      details: [
        ...ms.map(m => ({ label: SLOT_LABEL[m.slot] ?? m.slot, value: `${gearName(m.piece)}${m.owner ? ` (de ${m.owner.name})` : ''}: ${pctText(m.gain)} sola${m.replaces ? `, sustituye a ${gearName(m.replaces)}` : ''}`, good: true })),
        ...(one ? one.alt.map(a => ({ label: 'Otra opción', value: `${gearName(a.piece)}: ${pctText(a.gain)}` })) : []),
      ],
      plan: ms.map(m => ({ heroId: h.id, kind: m.kind, slot: m.slot, gearId: m.piece.id })),
      check: one ? { kind: 'gear', heroId: h.id, slot: one.slot, gearKind: one.kind, gearId: one.piece.id } : { kind: 'gearset', heroId: h.id, items: ms.map(m => ({ slot: m.slot, gearKind: m.kind, gearId: m.piece.id })) },
    })
  }
  return out
}

/** Siguiente nivel de cada habilidad de los Invokers del objetivo, con la simulación y el texto oficial. */
function skillActions(inp: EngineInput): CoachAction[] {
  const { index, objective: obj, kits } = inp, box = index.box
  if (!kits) return []
  const out: CoachAction[] = []
  for (const h of obj.team) {
    const kit = kits[h.code], w = obj.weights.get(h.id) ?? 0
    if (!kit || w <= 0) continue
    const levels = skillLevels(h), profile = profileFor(h, kits)!
    const settings = { duration: 180, targetRes: obj.stage?.res ?? 475 }
    const stats = h.stats
    const base = simulate(box, kit, levels, stats, settings)
    const text = inp.skillText?.get(h.code)
    for (let i = 0; i < SKILL_KINDS.length; i++) {
      const kind = SKILL_KINDS[i]
      if (!kit[i] || levels[i] >= 11) continue
      const next = [...levels]; next[i] += 1
      const max = [...levels]; max[i] = 11
      const gain = indexOf(profile.mix, { sim: simulate(box, kit, next, stats, settings), stats }, { sim: base, stats }) / 100 - 1
      const gainMax = indexOf(profile.mix, { sim: simulate(box, kit, max, stats, settings), stats }, { sim: base, stats }) / 100 - 1
      const lv = text?.skills.find(s => s.type === SKILL_TYPE[kind])?.levels
      const changes: SkillChange[] = lv && lv[levels[i] - 1] && lv[levels[i]] ? levelChanges(lv[levels[i] - 1], lv[levels[i]]) : []
      const qualitative = changes.some(c => c.what === 'Efecto nuevo') || changes.some(c => c.what === 'Enfriamiento' && c.better)
      if (gain < 0.004 && !qualitative) continue
      const name = kit[i]!.n || t(SKILL_LABEL, kind)
      out.push({
        id: `skill:${h.id}:${kind}:${levels[i] + 1}`, kind: 'skill',
        title: `Sube «${name}» de ${h.name} al nivel ${levels[i] + 1}`, hero: h, heroes: [h],
        impact: 100 * w * Math.max(0, gain), perHero: [{ hero: h, gain }],
        effect: `${pctText(gain)} en la simulación de ${h.name}${levels[i] + 1 < 11 ? `; hasta el nivel 11, ${pctText(gainMax)}` : ''}`,
        why: [
          changes.length ? `Ficha oficial, nivel ${levels[i]} → ${levels[i] + 1}: ${changeSummary(changes)}.` : `Ficha oficial: sube sus multiplicadores (nivel ${levels[i]} → ${levels[i] + 1}).`,
          `Simulación de 180 s contra RES ${settings.targetRes}${obj.stage ? ` (${obj.stage.source})` : ' (referencia)'} con sus estadísticas actuales: daño, control, curación y aguante según su papel.`,
          ...(levels[i] === 1 ? ['Está sin mejorar: los primeros niveles son los que más se notan en proporción.'] : []),
        ],
        needs: 'Códices (Raros, Épicos o Legendarios); el juego no publica cuántos pide cada nivel',
        cost: { kind: 'resources', text: 'Códices' },
        availability: 'resources', confidence: 'media', confidenceWhy: 'Fórmulas oficiales por nivel; animaciones y maná por golpe son supuestos de Nexo.',
        significant: gain >= 0.02 || qualitative, score: 0,
        how: [`En el juego: ${h.name} → Habilidades → «${name}» → Mejorar.`],
        details: changes.map(c => ({ label: c.what, value: `${c.from} → ${c.to}`, good: c.better })),
        check: { kind: 'skill', heroId: h.id, skill: kind, level: levels[i] + 1 },
      })
    }
  }
  return out
}

/** Tolerancias por debajo del objetivo de la guía: la habilidad de tolerancia sube un 10 % por nivel. */
function toleranceActions(inp: EngineInput): CoachAction[] {
  const { objective: obj } = inp
  if (!obj.stage?.tolGoal || !obj.stage.corruptions.length) return []
  const goal = obj.stage.tolGoal / 100
  const out: CoachAction[] = []
  for (const h of obj.team) {
    const w = obj.weights.get(h.id) ?? 0, tols = inp.skillText?.get(h.code)?.tolerances ?? []
    for (const c of obj.stage.corruptions) {
      const stat = toleranceKey(c), now = h.stats[stat] ?? 0
      if (now >= goal - 1e-6) continue
      const own = tols.find(x => x.key.toLowerCase() === c.toLowerCase())
      if (!own) continue
      const values = own.levels.map(v => Number(v.replace('%', '')) / 100)
      // Nivel actual: el de la ficha que coincide con su tolerancia innata (basisFlat), no la posición de la habilidad.
      const innate = h.basisFlat?.[stat] ?? null
      const cur = innate === null ? -1 : values.findIndex(v => Math.abs(v - innate) < 0.005)
      if (cur < 0 || cur >= values.length - 1) continue
      const steps = values.slice(cur + 1).findIndex(v => now - innate! + v >= goal - 1e-6) + 1
      const reach = steps > 0
      const gap = goal - now
      out.push({
        id: `tolerance:${h.id}:${c}:${cur + 1}`, kind: 'tolerance',
        title: `Sube la tolerancia a ${c} de ${h.name}`, hero: h, heroes: [h],
        impact: GOAL_BONUS * w * Math.min(1, 0.1 / gap), perHero: [{ hero: h, gain: 0 }],
        effect: `${Math.round(100 * now)} % → ${Math.round(100 * (now + values[cur + 1] - values[cur]))} % (objetivo de la guía: ${obj.stage.tolGoal} %)`,
        why: [
          `${obj.label}: el jefe aplica ${c}; la guía pide ${obj.stage.tolGoal} % de tolerancia y ${h.name} tiene ${Math.round(100 * now)} %.`,
          reach ? `Con ${steps} ${steps === 1 ? 'nivel' : 'niveles'} de su habilidad de tolerancia lo cumple.` : 'Ni con la habilidad al máximo llega: completa con piezas o conjuntos de tolerancia (Objetivo).',
        ],
        needs: 'Códices; el juego no publica cuántos pide cada nivel',
        cost: { kind: 'resources', text: 'Códices' }, availability: 'resources',
        confidence: 'alta', confidenceWhy: 'Valores de la ficha oficial y objetivo publicado en la guía.',
        significant: true, score: 0,
        how: [`En el juego: ${h.name} → Habilidades → tolerancia a ${c} → Mejorar.`],
        details: [{ label: 'Por nivel', value: '+10 % (ficha oficial)' }],
        check: { kind: 'tolerance', heroId: h.id, stat, value: now + values[cur + 1] - values[cur] - 1e-6 },
      })
    }
  }
  return out
}

/** Valor del vínculo de un Titán en un modo: global, especializado o fuera de su especialidad (datos de la caja). */
export function boundValue(titan: Titan, mode: string | null): { value: number; label: string; sure: boolean } | null {
  const b = titan.bound
  if (!b) return null
  if (b.specialization === 'General') return { value: b.general, label: 'global', sure: true }
  const match = mode && b.specialization.toLowerCase() === mode.toLowerCase()
  if (match) return { value: b.specialized, label: `especializado en ${b.specialization === 'Dungeon' ? 'Jefes' : b.specialization}`, sure: true }
  return { value: b.miss ?? b.general, label: `fuera de su especialidad (${b.specialization === 'Dungeon' ? 'Jefes' : b.specialization})`, sure: mode === 'dungeon' || mode === 'arena' || mode === 'tower' }
}
export function boundBonus(hero: Hero, titan: Titan | null | undefined, mode: string | null): Stats {
  const v = titan ? boundValue(titan, mode) : null
  if (!titan?.bound || !v) return {}
  const s = titan.bound.stat
  return { [s]: titan.bound.mode === 'percent' && PERCENT_OF_BASE.has(s) ? v.value * (hero.basis?.[s] ?? 0) : v.value }
}
const addStats = (a: Stats, b: Stats) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v; return o }

/** Reparto de Titanes del equipo del objetivo: el que más aporta a cada Invoker en ese modo. */
function titanActions(inp: EngineInput): CoachAction[] {
  const { index, objective: obj } = inp
  if (!obj.mode || !obj.team.length) return []
  const titans = index.box.titans.filter(x => x.bound)
  if (!titans.length) return []
  const byId = new Map(titans.map(x => [x.id, x]))
  const team = obj.team
  // Valor con cada Titán, relativo al vínculo actual.
  const gain = new Map<string, number>()
  for (const h of team) {
    const p = profileFor(h, inp.kits), cur = byId.get(obj.titans.get(h.id) ?? -1)
    const v0 = heroValue(h, addStats(h.stats, boundBonus(h, cur, obj.mode)), obj, p)
    for (const ti of titans) gain.set(`${h.id}:${ti.id}`, rel(heroValue(h, addStats(h.stats, boundBonus(h, ti, obj.mode)), obj, p), v0))
  }
  // Asignación voraz: el mayor aporte ponderado primero, un Titán por Invoker y solo los que se le pueden vincular
  // (su facción o Dragones). Entre copias iguales, la de más rango y nivel (sus estadísticas al invocarlo son mayores).
  const pairs = team.flatMap(h => titans.filter(ti => canBind(ti, h)).map(ti => ({ h, ti, g: gain.get(`${h.id}:${ti.id}`)!, w: obj.weights.get(h.id) ?? 0 })))
    .sort((a, b) => b.w * b.g - a.w * a.g || b.ti.rank - a.ti.rank || b.ti.level - a.ti.level || b.ti.power - a.ti.power)
  const usedT = new Set<number>(), done = new Set<number>(), assign = new Map<number, { ti: Titan; g: number }>()
  for (const p of pairs) { if (done.has(p.h.id) || usedT.has(p.ti.id)) continue; done.add(p.h.id); usedT.add(p.ti.id); assign.set(p.h.id, { ti: p.ti, g: p.g }) }
  // Titán con el que acaba cada Invoker: el asignado o, si no se le asigna ninguno, el suyo si nadie se lo lleva.
  const curOf = (h: Hero) => obj.titans.get(h.id) ?? null
  const taken = new Set([...assign.values()].map(a => a.ti.id))
  const finalOf = (h: Hero): Titan | null => assign.get(h.id)?.ti ?? (curOf(h) !== null && !taken.has(curOf(h)!) ? byId.get(curOf(h)!) ?? null : null)
  const holder = new Map(team.filter(h => curOf(h) !== null).map(h => [curOf(h)!, h]))
  const changed = team.filter(h => (finalOf(h)?.id ?? null) !== curOf(h))
  const gainOf = (h: Hero) => {
    const p = profileFor(h, inp.kits), cur = byId.get(curOf(h) ?? -1)
    return rel(heroValue(h, addStats(h.stats, boundBonus(h, finalOf(h), obj.mode)), obj, p), heroValue(h, addStats(h.stats, boundBonus(h, cur, obj.mode)), obj, p))
  }
  // Cambios en cadena (un Titán pasa de un Invoker del equipo a otro) se proponen juntos y se juzgan por el neto.
  const group = new Map<number, number>()
  const find = (x: number): number => { while (group.has(x) && group.get(x) !== x) x = group.get(x)!; return x }
  for (const h of changed) { group.set(h.id, find(h.id)); const t = finalOf(h), from = t ? holder.get(t.id) : undefined; if (from && from.id !== h.id) group.set(find(from.id), find(h.id)) }
  const comps = new Map<number, Hero[]>()
  for (const h of changed) comps.set(find(h.id), [...(comps.get(find(h.id)) ?? []), h])
  const out: CoachAction[] = []
  const nameOf = (t: Titan | null | undefined) => t ? t.name : 'sin Titán'
  for (const members of comps.values()) {
    const per = members.map(h => ({ hero: h, gain: gainOf(h), w: obj.weights.get(h.id) ?? 0 }))
    const total = per.reduce((t, x) => t + x.w * x.gain, 0)
    const best = [...per].sort((a, b) => b.w * b.gain - a.w * a.gain)[0]
    if (total <= 0 || best.gain < MIN_GAIN / 2) continue
    const h = best.hero, ti = finalOf(h)!, cur = byId.get(curOf(h) ?? -1)
    const nv = boundValue(ti, obj.mode)!, cv = cur ? boundValue(cur, obj.mode) : null
    const bonus = boundBonus(h, ti, obj.mode), stat = ti.bound!.stat
    const p = profileFor(h, inp.kits)
    const sBefore = addStats(h.stats, boundBonus(h, cur, obj.mode)), sAfter = addStats(h.stats, bonus)
    const chain = members.length > 1
    const others = per.filter(x => x.hero.id !== h.id)
    out.push({
      id: `titan:${members.map(m => `${m.id}-${finalOf(m)?.id ?? 0}`).sort().join(',')}:${obj.id}`, kind: 'titan',
      title: chain ? `Reorganiza los Titanes de ${members.map(m => m.name).join(' y ')} en «${obj.label}»` : `Vincula a ${ti.name} con ${h.name} en «${obj.label}»`,
      hero: h, heroes: members, titan: ti,
      impact: 100 * total, perHero: per.map(x => ({ hero: x.hero, gain: x.gain })),
      effect: `${pctText(best.gain)} para ${h.name}: ${breakdown(h, sBefore, sAfter, obj, p)} (${ti.bound!.mode === 'percent' ? `${Math.round(100 * nv.value)} % de ${STAT_LABEL[stat] ?? stat}, +${fmtInt(Math.round(bonus[stat] ?? 0))}` : `+${fmtInt(nv.value)} ${STAT_LABEL[stat] ?? stat}`} en combate)${others.length ? `; ${others.map(x => `${x.hero.name} ${pctText(x.gain)}`).join(', ')}` : ''}`,
      why: [
        `Vínculo de ${ti.name} (${ti.faction === 'Dragons' ? 'Dragón: se vincula a cualquier facción' : `${ti.faction}, como ${h.name}`}, ${ti.rank}★ nivel ${ti.level}): ${STAT_LABEL[stat] ?? stat} ${nv.label}.`,
        cur && cv ? `Ahora lleva a ${cur.name}: ${STAT_LABEL[cur.bound!.stat] ?? cur.bound!.stat} ${cv.label}, que le aporta menos.` : 'Ahora no tiene Titán vinculado en ese récord.',
        ...(chain ? [`${ti.name} lo lleva ahora ${holder.get(ti.id)?.name ?? 'otro Invoker'}: el cambio se propone junto y compensa en total (${pctText(total)} ponderado en el equipo).`] : []),
        'Solo se proponen Titanes de la facción del Invoker o Dragones (los únicos que el juego deja vincular).',
      ],
      needs: 'Nada: cambiar el vínculo en la formación es gratis',
      cost: { kind: 'free', text: 'Gratis' }, availability: 'now',
      confidence: nv.sure ? 'media' : 'baja', confidenceWhy: 'Valores del vínculo de la caja; que el % se aplique sobre la base es un supuesto (como el resto de % del juego).',
      significant: best.gain >= 0.03, score: 0,
      how: [`En el juego: prepara el equipo de ${obj.label}${members.map(m => ` → ${m.name}: ${nameOf(finalOf(m))}`).join(';')}.`],
      details: members.map(m => ({ label: m.name, value: `${nameOf(byId.get(curOf(m) ?? -1))} → ${nameOf(finalOf(m))} (${pctText(gainOf(m))})`, good: gainOf(m) >= 0 })),
      check: { kind: 'titan', heroId: h.id, titanId: ti.id, mode: obj.choice.kind === 'record' ? obj.choice.mode : '', key: obj.choice.kind === 'record' ? obj.choice.key : '' },
    })
  }
  return out
}

/** Despertar que abre una ranura de accesorio con una pieza libre para ella; el resto del despertar, sin cifra. */
function awakenActions(inp: EngineInput): CoachAction[] {
  const { index, objective: obj } = inp, box = index.box
  const out: CoachAction[] = []
  for (const h of obj.team) {
    const w = obj.weights.get(h.id) ?? 0
    if (h.awakeLevel >= Math.min(h.rank, 6)) continue
    const next = h.awakeLevel + 1
    const opens = ACCESSORY_SLOTS.filter(s => (box.accessorySlotAwake[s] ?? 99) === next)
    const titanNode = next === 2 || next === 4 || next === 6
    let best: { slot: string; piece: Gear; gain: number; before: Stats; after: Stats } | null = null
    if (opens.length && h.basis && h.gearBonus) {
      const p = profileFor(h, inp.kits), current = index.equipped(h)
      const before = projectStats(h, current, index.rules), v0 = heroValue(h, before, obj, p)
      for (const slot of opens) for (const g of box.accessories) {
        if (g.slot !== slot || g.faction !== h.faction || g.equippedHeroId !== null || inp.reserved.has(`accessory${g.id}`)) continue
        const after = projectStats(h, [...current, g], index.rules), gain = rel(heroValue(h, after, obj, p), v0)
        if (!best || gain > best.gain) best = { slot, piece: g, gain, before, after }
      }
    }
    const base = [`${h.name} está en ${h.awakeLevel}★ de despertar y su ascensión (${h.rank}★) permite llegar a ${Math.min(h.rank, 6)}★.`,
      'Guía oficial: cada estrella de despertar da nodos de estadística según su Signo; el valor de cada nodo no se publica.',
      ...(titanNode ? [`A ${next}★ desbloquea un nodo de Invocación: +1 s de Titán invocado (guía oficial).`] : [])]
    const needs = 'Esencia astral y otra esencia, Chispa de Titán, Emblema de clase o Runa de facción (cantidades no publicadas)'
    if (best && best.gain >= MIN_GAIN) out.push({
      id: `slot:${h.id}:${next}`, kind: 'slot',
      title: `Despierta a ${h.name} a ${next}★: abre su ${SLOT_LABEL[best.slot] ?? best.slot}`, hero: h, heroes: [h], gear: best.piece,
      impact: 100 * w * best.gain, perHero: [{ hero: h, gain: best.gain }],
      effect: `Como mínimo ${pctText(best.gain)} con ${gearName(best.piece)}, que está libre (${statDelta(best.before, best.after, 3, h)}); más los nodos de ese despertar`,
      why: [`El ${SLOT_LABEL[best.slot] ?? best.slot} se abre con el despertar ${next}★ (regla de la caja).`, ...base],
      needs, cost: { kind: 'resources', text: 'Esencias y materiales de despertar' }, availability: 'resources',
      confidence: 'alta', confidenceWhy: 'La ganancia de la ranura es exacta; la de los nodos no se suma porque no se publica.',
      significant: true, score: 0, how: [`En el juego: ${h.name} → Despertar → desbloquea los nodos de la estrella ${next}.`], details: [],
      check: { kind: 'awake', heroId: h.id, awake: next },
    })
    else if (w > 0) out.push({
      id: `awaken:${h.id}:${next}`, kind: 'awaken',
      title: `Despierta a ${h.name} a ${next}★`, hero: h, heroes: [h], impact: null, perHero: [],
      effect: 'Sin cifra: los nodos de despertar no se publican uno a uno', why: base, needs,
      cost: { kind: 'resources', text: 'Esencias y materiales de despertar' }, availability: 'info',
      confidence: 'baja', confidenceWhy: 'Se sabe qué tipo de estadísticas da su Signo, no cuánto da cada nodo.',
      significant: titanNode, score: 0, how: [`En el juego: ${h.name} → Despertar.`], details: [],
      check: { kind: 'awake', heroId: h.id, awake: next },
    })
  }
  return out
}

/** Sala de trofeos: siguiente nivel de cada mejora que notan los Invokers del objetivo. */
function hallActions(inp: EngineInput): CoachAction[] {
  const { objective: obj, hall } = inp
  if (!hall) return []
  const out: CoachAction[] = []
  for (const o of hall.options.slice(0, 12)) {
    if (o.step === null) continue
    const per: { hero: Hero; gain: number }[] = []
    for (const b of o.beneficiaries) {
      const w = obj.weights.get(b.hero.id) ?? 0
      if (w <= 0 || !b.delta) continue
      const p = profileFor(b.hero, inp.kits)
      const g = rel(heroValue(b.hero, addStats(b.hero.stats, { [o.stat]: b.delta }), obj, p), heroValue(b.hero, b.hero.stats, obj, p))
      if (g > 0) per.push({ hero: b.hero, gain: g })
    }
    if (!per.length) continue
    const impact = per.reduce((s, x) => s + 100 * (obj.weights.get(x.hero.id) ?? 0) * x.gain, 0)
    const cost = hall.costs[o.next] ?? null, have = hall.wallet?.[o.trophy] ?? null
    const can = cost !== null && have !== null && have >= cost
    const tr = o.trophy === 'bronze' ? 'bronces' : o.trophy === 'silver' ? 'platas' : 'oros'
    out.push({
      id: `hall:${o.element}:${o.stat}:${o.next}`, kind: 'hall',
      title: `Sala de trofeos: ${t(ELEMENT_LABEL, o.element)} · ${STAT_LABEL[o.stat] ?? o.stat}${o.mode === 'percent' && PERCENT_OF_BASE.has(o.stat) ? ' %' : ''} al nivel ${o.next}`,
      hero: per[0].hero, heroes: per.map(x => x.hero), impact, perHero: per,
      effect: `${per.length === 1 ? `${pctText(per[0].gain)} para ${per[0].hero.name}` : `para ${per.length} Invokers del objetivo (${per.slice(0, 3).map(x => `${x.hero.name} ${pctText(x.gain)}`).join(', ')})`}`,
      why: [`Sube a todos los Invokers de ${t(ELEMENT_LABEL, o.element)} en todos los modos (guía oficial de la Arena).`, `Valor por nivel observado en tu caja.`],
      needs: cost !== null ? `${fmtInt(cost)} ${tr}${have !== null ? ` (tienes ${fmtInt(have)})` : ''}` : `${tr} (el coste de este nivel no está publicado; míralo en la sala y apúntalo en Nexo)`,
      cost: { kind: 'trophies', text: cost !== null ? `${fmtInt(cost)} ${tr}` : tr },
      availability: can ? 'now' : 'resources', confidence: 'alta', confidenceWhy: 'Valor por nivel observado en tu caja; reglas oficiales.',
      significant: impact >= 1, score: 0, how: ['En el juego: Arena → Sala de trofeos → toca la mejora → Mejorar.'], details: [],
      check: { kind: 'hall', element: o.element, stat: o.stat, level: o.next },
    })
  }
  return out
}

/** Ascensiones del ranking de Personajes para los Invokers del objetivo (sin cifra calculable). */
function ascendActions(inp: EngineInput): CoachAction[] {
  const { objective: obj } = inp
  // Solo las dos mejores: sin cifra, el resto llenaría la lista sin aportar una decisión distinta.
  return (inp.ascend ?? []).filter(c => (obj.weights.get(c.hero.id) ?? 0) > 0).sort((x, y) => y.score - x.score).slice(0, 2).map(c => ({
    id: `ascend:${c.hero.id}:${c.to}`, kind: 'ascend' as const,
    title: `Asciende a ${c.hero.name} a ${c.to}★`, hero: c.hero, heroes: [c.hero], impact: null, perHero: [],
    effect: `Sube su tope de nivel en 10 (de ${c.hero.rank * 10} a ${c.to * 10}); la ganancia de estadísticas no se puede calcular con los datos publicados`,
    why: [c.why, `Ranking de Personajes: ${Math.round(c.score)}/100.`],
    needs: `${c.units} ${c.units === 1 ? 'Invoker' : 'Invokers'} de ${c.hero.rank}★ como material${c.have ? ' (los tienes)' : ' (aún no los tienes)'} y XP para el tramo nuevo`,
    cost: { kind: 'copies' as const, text: `${c.units} × ${c.hero.rank}★` }, availability: (c.have ? 'now' : 'resources') as Availability,
    confidence: 'media' as const, confidenceWhy: 'Criterio de Nexo (uso, tier oficial, inversión); la ganancia exacta no se publica.',
    significant: true, score: scoreOf({ impact: null, confidence: 'media', availability: c.have ? 'now' : 'resources', cost: { kind: 'copies', text: '' } }, c.score / 100),
    how: ['En el juego: Invokers → Ascender. Antes, sube su nivel al tope actual.'], details: [],
    check: { kind: 'rank' as const, heroId: c.hero.id, rank: c.to },
  }))
}

export type CoachPlan = {
  objective: Objective
  /** Todas las acciones ordenadas por puntuación. */
  actions: CoachAction[]
  /** Alternativas consideradas para el Invoker del siguiente paso (otras acciones sobre él). */
  alternatives: CoachAction[]
  /** La mejor acción de cada tipo, para comparar inversiones distintas. */
  byKind: Partial<Record<ActionKind, CoachAction>>
  synergy: Synergy
}

/** Todas las acciones del objetivo, puntuadas y ordenadas. */
export function planFor(inp: EngineInput): CoachPlan {
  const actions = [...gearActions(inp), ...skillActions(inp), ...toleranceActions(inp), ...titanActions(inp), ...awakenActions(inp), ...hallActions(inp), ...ascendActions(inp)]
  for (const a of actions) if (a.kind !== 'ascend') a.score = scoreOf(a)
  actions.sort((a, b) => b.score - a.score || (b.impact ?? 0) - (a.impact ?? 0))
  const top = actions[0]
  const alternatives = top?.hero ? actions.filter(a => a !== top && a.heroes.some(h => h.id === top.hero!.id)).slice(0, 5) : []
  const byKind: CoachPlan['byKind'] = {}
  for (const a of actions) byKind[a.kind] ??= a
  return { objective: inp.objective, actions, alternatives, byKind, synergy: synergyOf(inp) }
}

// ───────────────────────── Sinergias ─────────────────────────
export type Synergy = { notes: { tone: 'ok' | 'gap' | 'info'; text: string }[] }
const AMPLIFY = ['DebuffDefense', 'DebuffDamageTaken', 'BuffAttack', 'BuffCriticalRate', 'BuffCriticalDamage']
const SUSTAIN = ['ContinuousHealing', 'Shield', 'Protect']
/** Sinergias del equipo del objetivo según los efectos de las fichas oficiales y los vínculos de Titán. */
export function synergyOf(inp: EngineInput): Synergy {
  const { objective: obj, kits } = inp
  const notes: Synergy['notes'] = []
  if (!kits || obj.choice.kind !== 'record' || obj.team.length < 2) return { notes }
  const prof = obj.team.map(h => ({ h, p: profileFor(h, kits) })).filter((x): x is { h: Hero; p: Profile } => !!x.p)
  const attackers = obj.team.filter(h => h.cls === 'MeleeAttacker' || h.cls === 'RangedAttacker')
  const effects = (h: Hero) => new Set((kits[h.code] ?? []).flatMap(s => s?.e ?? []))
  const amp = prof.filter(x => [...effects(x.h)].some(e => AMPLIFY.includes(e)))
  if (attackers.length >= 2 && !amp.length) notes.push({ tone: 'gap', text: `Tienes ${attackers.length} atacantes y nadie en el equipo baja la DEF del enemigo ni sube ATQ o críticos: un Invoker con [DEF Down] o [ATK Up] multiplicaría el daño de todos.` })
  else if (amp.length) notes.push({ tone: 'ok', text: `${amp.map(x => x.h.name).join(', ')} ${amp.length === 1 ? 'amplifica' : 'amplifican'} el daño del equipo (bajar DEF, subir ATQ o críticos).` })
  const sustain = prof.filter(x => x.p.heals || x.p.shields || [...effects(x.h)].some(e => SUSTAIN.includes(e)))
  if (!sustain.length) notes.push({ tone: 'gap', text: 'Nadie del equipo cura ni pone escudos: si caen Invokers antes de terminar, falta sustento.' })
  const needAcc = prof.filter(x => x.p.needsAccuracy && obj.stage && landChance(x.h.stats.accuracy ?? 0, obj.stage.res) < 0.6)
  if (needAcc.length && obj.stage) notes.push({ tone: 'gap', text: `${needAcc.map(x => x.h.name).join(', ')}: sus perjuicios entran con menos del 60 % de probabilidad contra RES ${obj.stage.res} (tabla oficial).` })
  const noTitan = obj.team.filter(h => !obj.titans.get(h.id))
  if (noTitan.length) notes.push({ tone: 'gap', text: `${noTitan.map(h => h.name).join(', ')} ${noTitan.length === 1 ? 'no tiene' : 'no tienen'} Titán vinculado en ese récord (guía oficial: vincula uno a cada Invoker).` })
  if (obj.stage?.element) notes.push({ tone: 'info', text: `Elemento de la fase: ${t(ELEMENT_LABEL, obj.stage.element)} (${obj.stage.source}).` })
  return { notes }
}

/** ¿Se ha aplicado ya? Compara la acción con la caja actual. */
export function isApplied(spec: CheckSpec, box: Box): boolean | null {
  const h = 'heroId' in spec ? box.heroes.find(x => x.id === spec.heroId) : undefined
  switch (spec.kind) {
    case 'gear': return h ? (spec.gearKind === 'relic' ? h.relics : h.accessories)[spec.slot] === spec.gearId : null
    case 'gearset': return h ? spec.items.every(i => (i.gearKind === 'relic' ? h.relics : h.accessories)[i.slot] === i.gearId) : null
    case 'skill': return h ? (h.skills.find(s => s.kind === spec.skill)?.level ?? 0) + 1 >= spec.level : null
    case 'tolerance': return h ? (h.stats[spec.stat] ?? 0) >= spec.value : null
    case 'rank': return h ? h.rank >= spec.rank : null
    case 'awake': return h ? h.awakeLevel >= spec.awake : null
    case 'hall': return (box.arenaHall.find(a => a.element === spec.element && a.stat === spec.stat)?.level ?? 0) >= spec.level
    case 'titan': {
      const tm = box.teams.find(x => x.mode === spec.mode && x.key === spec.key)
      if (!tm) return null
      return tm.levels.some(l => l.slots.some(s => s.heroId === spec.heroId && s.titanId === spec.titanId))
    }
  }
}
