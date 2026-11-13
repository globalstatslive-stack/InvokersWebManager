/** Coach de piezas: por qué subir, probar, equipar, guardar o vender cada reliquia y accesorio.
 *
 * Cada razonamiento lleva su fuente:
 * - «oficial»: guías Relics y Accessories de invokers.com (rareza → subestadísticas iniciales, hitos +5/+10/+15/+20,
 *   tiradas del 70 al 100 % con el mismo peso, tabla de notas, el rango no se sube, vender da oro y triturar Memorium…).
 * - «tu caja»: lo que se observa en tu caja (valor de una tirada máxima por estadística y rango, bases de tus Invokers).
 * - «cálculo»: lo que Nexo deduce de lo anterior (probabilidades, ganancias con la fórmula de estadísticas verificada).
 * - «criterio»: umbrales de decisión de Nexo, que se pueden discutir. */
import type { Bonus, Box, Gear, Grade, Hero } from './model'
import type { BoxIndex } from './stats'
import { PRESETS, presetFor } from './optimizer'
import { whoBenefits, type BenefitCache, type Usefulness } from './usefulness'
import { bonusName, fmtBonus, fmtInt, PERCENT_OF_BASE, RARITY_LABEL, SET_LABEL, SLOT_LABEL, t } from './i18n'
import gearGuide from '../catalog/wiki/gear.json'

export const GEAR_RULES = {
  maxLevel: 20,
  /** Hitos en los que se desbloquea una subestadística (si tiene menos de 4) o se mejora una al azar. */
  thresholds: [5, 10, 15, 20],
  maxSubs: 4,
  initialSubs: { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 } as Record<string, number>,
  /** Cada tirada vale el 70, 80, 90 o 100 % del máximo de su rango, con el mismo peso. */
  rolls: [70, 80, 90, 100],
  /** Capacidad de la colección de accesorios. */
  accessoryStorage: 1000,
  guides: gearGuide.sources,
}
/** Nota de una subestadística según las mejoras recibidas (0 = tirada inicial) y su valor total acumulado (%). */
export const GRADE_TABLE: [number, Grade][][] = [
  [[70, 'D'], [90, 'C'], [100, 'B']],
  [[140, 'D'], [150, 'C'], [170, 'B'], [190, 'A']],
  [[210, 'C'], [240, 'B'], [260, 'A'], [300, 'S']],
  [[280, 'C'], [310, 'B'], [330, 'A'], [370, 'S']],
  [[350, 'B'], [380, 'A'], [430, 'S']],
]
/** Rango posible del valor total (% de tirada máxima) de una subestadística con esa nota y ese número de mejoras. */
export function rollBand(rolls: number, grade: Grade | null): [number, number] | null {
  const row = GRADE_TABLE[rolls]
  const i = row?.findIndex(([, g]) => g === grade) ?? -1
  if (!row || i < 0) return null
  return [row[i][0], i + 1 < row.length ? row[i + 1][0] - 10 : (rolls + 1) * 100]
}
export function gradeFor(rolls: number, total: number): Grade | null {
  const row = GRADE_TABLE[rolls]
  if (!row) return null
  let g: Grade | null = null
  for (const [min, grade] of row) if (total >= min) g = grade
  return g
}

/** Etiquetas de la tabla oficial → estadística y modo de la caja. */
const LABEL: Record<string, [string, 'flat' | 'percent']> = {
  'ATK+': ['attack', 'flat'], 'DEF+': ['defense', 'flat'], 'HP+': ['health', 'flat'], 'ATK%': ['attack', 'percent'], 'DEF%': ['defense', 'percent'], 'HP%': ['health', 'percent'],
  'Crit Rate': ['criticalRate', 'percent'], 'Crit DMG': ['criticalDamage', 'percent'], ACC: ['accuracy', 'flat'], RES: ['resistance', 'flat'], 'Combo SPD': ['comboSpeed', 'flat'],
  'Skill SPD': ['skillSpeed', 'flat'], 'Skill RECOV': ['skillRecovery', 'flat'], 'Mana Gen': ['manaGeneration', 'flat'], Instinct: ['instinct', 'flat'], 'Move SPD': ['runSpeed', 'flat'],
}
const slotKey = (s: string) => s === 'Flask' ? 'Flasks' : s
const table = (rows: { slot: string; stats: string[] }[]) => new Map(rows.map(r => [slotKey(r.slot), r.stats.map(l => LABEL[l]).filter(Boolean).map(([s, m]) => `${s}:${m}`)]))
/** Subestadísticas posibles por ranura (tabla oficial). */
export const SUB_POOL = new Map([...table(gearGuide.relicSub), ...table(gearGuide.accessorySub)])
/** Principales posibles por ranura (tabla oficial). */
export const MAIN_POOL = new Map([...table(gearGuide.relicMain), ...table(gearGuide.accessoryMain)])
const key = (b: Pick<Bonus, 'stat' | 'mode'>) => `${b.stat}:${b.mode}`
const nameOf = (k: string) => { const [s, m] = k.split(':'); return bonusName(s, m) }
/** Conjuntos que solo sueltan los jefes (la guía oficial no los sitúa en la campaña). */
const SET_KEY: Record<string, string> = { 'Crit Rate': 'CriticalRate', 'Crit Damage': 'CriticalDamage', Mana: 'ManaGeneration', Voodoo: 'ReduceBuffDuration', Vampire: 'LifeSteal', Spark: 'SkillSpeed', Fury: 'SkillRecovery', Predator: 'IgnoreDefense', Paragon: 'Support', Manashock: 'ManaShock', Mindfog: 'MindFog', Manaburn: 'ManaBurn', Bloodrot: 'BloodRot' }
export const BOSS_ONLY_SETS = new Set(gearGuide.sets.filter(s => !/Campaign/i.test(s.where)).map(s => { const [a, b] = s.name.split(' '); return b === 'Tolerance' ? `${SET_KEY[a] ?? a}Tolerance` : SET_KEY[s.name] ?? s.name }))

export type RoleId = 'dps' | 'tank' | 'support'
export const ROLE_LABEL: Record<RoleId, string> = { dps: 'daño', tank: 'tanque', support: 'apoyo' }
const DAMAGE = ['attack', 'criticalRate', 'criticalDamage']
/** Estadísticas que aprovecha cada perfil: pesos ≥ 2 de los perfiles del optimizador, más ataque y críticos si cuenta el daño. */
export function roleStats(role: RoleId): Set<string> {
  const w = PRESETS.find(p => p.id === role)!.weights
  return new Set([...Object.entries(w).filter(([k, v]) => k !== 'damage' && v >= 2).map(([k]) => k), ...(w.damage ? DAMAGE : [])])
}
const ROLE_STATS: Record<RoleId, Set<string>> = { dps: roleStats('dps'), tank: roleStats('tank'), support: roleStats('support') }
/** Ranuras con principal fija (o casi): la principal no distingue una pieza de otra. */
const FIXED_MAIN = new Set(['Weapon', 'Shield', 'Helmet', 'Amulet', 'Earrings'])

/** Valor de una tirada al 100 % por estadística y rango, observado en tu caja: subestadísticas sin mejoras con nota B
 * (100 %, exacto) o, si no hay, con nota C (90 %). Clave `estadística:modo:rango`. */
export type Units = Map<string, number>
export function rollUnits(box: Box): Units {
  const out = new Map<string, number>(), fromC = new Map<string, number>()
  for (const g of [...box.relics, ...box.accessories]) for (const s of g.subs) if (s.rolls === 0) {
    const k = `${key(s)}:${g.rank}`
    if (s.grade === 'B') out.set(k, Math.max(out.get(k) ?? 0, s.value))
    else if (s.grade === 'C') fromC.set(k, Math.max(fromC.get(k) ?? 0, s.value / 0.9))
  }
  for (const [k, v] of fromC) if (!out.has(k)) out.set(k, v)
  return out
}

export type Tag = 'oficial' | 'tu caja' | 'cálculo' | 'criterio'
export type Step = { tag: Tag; tone: 'good' | 'bad' | 'info'; text: string }
export type Verdict = 'upgrade' | 'replace' | 'test' | 'equip' | 'keep' | 'sell' | 'done'
export const VERDICT_LABEL: Record<Verdict, string> = { upgrade: 'Subir', replace: 'Sustituir', test: 'Probar', equip: 'Equipar', keep: 'Guardar', sell: 'Vender o triturar', done: 'Completa' }
export type SubView = { bonus: Bonus; fit: 'yes' | 'weak' | 'no'; band: [number, number] | null; note: string }
export type Outlook = {
  remaining: number[]; events: ('unlock' | 'upgrade')[]; unlocks: number; upgrades: number
  /** Probabilidad de que cada mejora futura caiga en una subestadística útil (null si no quedan mejoras). */
  pUseful: number | null
  /** Mejoras ya recibidas por subestadísticas útiles y por las que no sirven. */
  madeUseful: number; madeDead: number
  pool: { size: number; useful: string[] }
}
export type GearAdvice = {
  gear: Gear; verdict: Verdict; title: string; why: string; priority: number
  role: RoleId | null; subs: SubView[]; outlook: Outlook; mainFit: 'fixed' | 'yes' | 'no'
  owner: Hero | null; important: boolean
  best: Usefulness | null
  watch: string | null
  sections: { title: string; steps: Step[] }[]
  /** Para enseñar: a quién se refiere el análisis, lo bueno y lo malo en frases cortas, el camino de hitos y qué hacer en el próximo. */
  forWho: string
  pros: string[]; cons: string[]
  path: PathNode[]
  next: NextStep | null
  stopRule: string | null
}
export type PathNode = { level: number; kind: 'unlock' | 'upgrade'; state: 'done' | 'next' | 'future'; p: number | null }
export type NextStep = { level: number; kind: 'unlock' | 'upgrade'; p: number; good: string[]; bad: string[]; ifGood: string; ifBad: string }
/** Regla de parada de Nexo: deja de invertir cuando más de la mitad de las mejoras recibidas se han perdido o ya no
 * queda ninguna subestadística útil a la que pueda caer una mejora. */
export const STOP_RULE = 'Deja de subir una pieza cuando más de la mitad de sus mejoras hayan caído en subestadísticas que no sirven, o cuando ya no le quede ninguna útil a la que pueda caer una mejora.'

export type CoachInput = {
  /** Piezas reservadas en el plan (`relic12`) y para quién. */
  reserved?: Map<string, string>
  /** Invokers de equipos activos y del plan. */
  important?: Set<number>
  /** Candidatos para «¿a quién le sirve?». */
  candidates: Hero[]
}
export type CoachContext = CoachInput & {
  index: BoxIndex; units: Units
  reserved: Map<string, string>; important: Set<number>
  roleBase: Record<RoleId, Record<string, number>>
  setSlot: Map<string, number>
  /** Piezas libres de rango ≥ 4 por ranura (y facción en accesorios). */
  freeGood: Map<string, number>
  /** Perfiles de los Invokers que pueden llevar un accesorio: `facción:ranura`. */
  factionSlot: Map<string, Set<RoleId>>
  /** Número de Invokers de cada facción (aunque no tengan la ranura desbloqueada). */
  factionCount: Map<string, number>
  cache: BenefitCache
  /** Invokers para los que se proponen subidas: equipos activos y plan o, si no hay, los 10 más fuertes. */
  focus: Hero[]; focusLabel: string
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const pct = (x: number) => `${Math.round(100 * x)} %`
/** Rareza en femenino («pieza rara»). */
export const RARITY_F: Record<string, string> = { Common: 'común', Uncommon: 'poco común', Rare: 'rara', Epic: 'épica', Legendary: 'legendaria', Mythic: 'mítica' }
const rarityF = (r: string) => RARITY_F[r] ?? t(RARITY_LABEL, r).toLowerCase()
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const goodKey = (g: Pick<Gear, 'kind' | 'slot' | 'faction'>) => `${g.kind}:${g.slot}:${g.kind === 'accessory' ? g.faction : ''}`

export function coachContext(index: BoxIndex, input: CoachInput): CoachContext {
  const { box } = index
  const top = [...box.heroes].filter(h => h.basis).sort((a, b) => b.power - a.power).slice(0, 40)
  const roleBase = {} as Record<RoleId, Record<string, number>>
  for (const role of ['dps', 'tank', 'support'] as RoleId[]) {
    const hs = top.filter(h => presetFor(h) === role)
    roleBase[role] = Object.fromEntries(['attack', 'defense', 'health'].map(k => [k, median((hs.length ? hs : top).map(h => h.basis![k] ?? 0))]))
  }
  const setSlot = new Map<string, number>()
  for (const g of box.relics) if (g.set) setSlot.set(`${g.set}:${g.slot}`, (setSlot.get(`${g.set}:${g.slot}`) ?? 0) + 1)
  const freeGood = new Map<string, number>()
  for (const g of [...box.relics, ...box.accessories]) if (g.equippedHeroId === null && g.rank >= 4) freeGood.set(goodKey(g), (freeGood.get(goodKey(g)) ?? 0) + 1)
  const factionSlot = new Map<string, Set<RoleId>>(), factionCount = new Map<string, number>()
  for (const h of box.heroes) {
    factionCount.set(h.faction, (factionCount.get(h.faction) ?? 0) + 1)
    for (const [slot, awake] of Object.entries(box.accessorySlotAwake)) if (h.awakeLevel >= awake) {
      const k = `${h.faction}:${slot}`
      if (!factionSlot.has(k)) factionSlot.set(k, new Set())
      factionSlot.get(k)!.add(presetFor(h) as RoleId)
    }
  }
  const important = input.important ?? new Set<number>()
  const marked = input.candidates.filter(h => important.has(h.id))
  const focus = marked.length ? marked : [...input.candidates].sort((a, b) => b.power - a.power).slice(0, 10)
  const focusLabel = marked.length ? 'los Invokers de tus equipos activos y tu plan' : 'tus 10 Invokers más fuertes'
  return { ...input, index, units: rollUnits(box), reserved: input.reserved ?? new Map(), important, roleBase, setSlot, freeGood, factionSlot, factionCount, cache: new Map(), focus, focusLabel }
}

/** Cuánto rinde una subestadística plana de ATQ/DEF/VIDA frente a su versión en % del mismo rango, para una base dada. */
export function flatRatio(units: Units, stat: string, rank: number, base: number): number | null {
  const flat = units.get(`${stat}:flat:${rank}`), percent = units.get(`${stat}:percent:${rank}`)
  if (!flat || !percent || !base) return null
  return flat / base / percent
}

function subFit(ctx: CoachContext, g: Gear, b: Bonus, role: RoleId | null, base: Record<string, number>): { fit: SubView['fit']; note: string } {
  if (!role) return { fit: 'yes', note: '' }
  if (!ROLE_STATS[role].has(b.stat)) return { fit: 'no', note: `no la aprovecha un perfil de ${ROLE_LABEL[role]}` }
  if (b.mode === 'flat' && PERCENT_OF_BASE.has(b.stat)) {
    const r = flatRatio(ctx.units, b.stat, g.rank, base[b.stat])
    if (r !== null) {
      const flat = ctx.units.get(`${b.stat}:flat:${g.rank}`)!, per = ctx.units.get(`${b.stat}:percent:${g.rank}`)!
      const note = `+${fmtInt(flat)} por tirada = ${(100 * flat / base[b.stat]).toFixed(1).replace('.', ',')} % de una base de ${fmtInt(base[b.stat])}; ${bonusName(b.stat, 'percent')} da ${(100 * per).toFixed(1).replace('.', ',')} % (${pct(r)})`
      return r >= 0.75 ? { fit: 'yes', note } : { fit: 'weak', note: `rinde poco: ${note}` }
    }
  }
  return { fit: 'yes', note: `sirve para ${ROLE_LABEL[role]}` }
}

/** Perfil al que mejor encaja una pieza libre: la principal (si la ranura la admite variable) pesa el doble. */
function bestRole(g: Gear, roles: RoleId[]): RoleId | null {
  let best: RoleId | null = null, score = -1
  for (const r of roles) {
    const s = (FIXED_MAIN.has(g.slot) ? 0 : ROLE_STATS[r].has(g.main.stat) ? 2 : 0) + g.subs.filter(b => ROLE_STATS[r].has(b.stat)).length
    if (s > score) { best = r; score = s }
  }
  return best
}

export function outlookOf(g: Gear, useful: (b: Pick<Bonus, 'stat' | 'mode'>) => boolean, subs: SubView[]): Outlook {
  const remaining = GEAR_RULES.thresholds.filter(t => t > g.level)
  let n = g.subs.length
  const events = remaining.map(() => n < GEAR_RULES.maxSubs ? (n++, 'unlock' as const) : 'upgrade' as const)
  const unlocks = events.filter(e => e === 'unlock').length, upgrades = events.length - unlocks
  const have = new Set([key(g.main), ...g.subs.map(key)])
  const poolKeys = (SUB_POOL.get(g.slot) ?? []).filter(k => !have.has(k))
  const poolUseful = poolKeys.filter(k => { const [stat, mode] = k.split(':'); return useful({ stat, mode: mode as 'flat' | 'percent' }) })
  const usefulNow = subs.filter(s => s.fit !== 'no').length
  // Esperanza de subestadísticas útiles al terminar los desbloqueos (muestreo sin reemplazo del grupo restante).
  const expected = usefulNow + (poolKeys.length ? unlocks * poolUseful.length / poolKeys.length : 0)
  const madeUseful = subs.filter(s => s.fit !== 'no').reduce((a, s) => a + s.bonus.rolls, 0)
  const madeDead = subs.filter(s => s.fit === 'no').reduce((a, s) => a + s.bonus.rolls, 0)
  return { remaining, events, unlocks, upgrades, pUseful: upgrades ? Math.min(1, expected / GEAR_RULES.maxSubs) : null, madeUseful, madeDead, pool: { size: poolKeys.length, useful: poolUseful } }
}

/** Ganancia relativa en %: daño por golpe o valor del perfil de clase. */
const norm = (u: Usefulness) => u.unit === 'damage' ? 100 * u.gain : u.base > 0 ? 100 * u.gain / u.base : u.gain
/** Criterio: por debajo de +1 % no compensa el cambio. */
const MIN_GAIN_PCT = 1
/** Ganancia legible: daño por golpe en atacantes; en tanques y apoyos, % sobre el valor de su perfil de clase. */
export const gainText = (u: Usefulness) => u.unit === 'damage' ? `+${(100 * u.gain).toFixed(1).replace('.', ',')} % de daño por golpe`
  : `+${(u.base > 0 ? 100 * u.gain / u.base : u.gain).toFixed(1).replace('.', ',')}${u.base > 0 ? ' %' : ' puntos'} en su perfil de ${u.hero.cls === 'Tank' ? 'tanque' : 'apoyo'}`
/** Media de una tirada (70, 80, 90 o 100 %, con el mismo peso). */
export const MEAN_ROLL = GEAR_RULES.rolls.reduce((a, b) => a + b, 0) / GEAR_RULES.rolls.length / 100
/** Pieza al +20 esperada (valor medio): principal al máximo (dato del portal); cada desbloqueo, una subestadística al azar
 * entre las que admite la ranura y aún no tiene; cada mejora, una de las 4 al azar con la tirada media. Como el valor
 * esperado es lineal, se suman fracciones de cada subestadística posible. Valores de tirada: los observados en tu caja. */
export function projectedGear(g: Gear, units: Units): Gear {
  const o = outlookOf(g, () => true, [])
  const share = o.upgrades / GEAR_RULES.maxSubs
  const unit = (k: string) => units.get(`${k}:${g.rank}`)
  const subs: Bonus[] = g.subs.map(b => { const u = unit(key(b)); return u ? { ...b, value: b.value + share * MEAN_ROLL * u } : b })
  if (o.unlocks && o.pool.size) {
    const have = new Set([key(g.main), ...g.subs.map(key)])
    for (const k of (SUB_POOL.get(g.slot) ?? []).filter(k => !have.has(k))) {
      const u = unit(k)
      if (!u) continue
      const [stat, mode] = k.split(':')
      subs.push({ stat, mode: mode as Bonus['mode'], value: o.unlocks / o.pool.size * (1 + share) * MEAN_ROLL * u, rolls: 0, grade: null })
    }
  }
  return { ...g, level: GEAR_RULES.maxLevel, main: g.mainAtMax ?? g.main, subs }
}
export type PieceUse = { best: Usefulness | null; outranked: Usefulness | null; potential?: Usefulness | null; crowded?: Usefulness | null }
export function adviseGear(g: Gear, ctx: CoachContext, use: PieceUse = { best: null, outranked: null }): GearAdvice {
  const { best, outranked, potential = null, crowded = null } = use
  const { index } = ctx
  const owner = g.equippedHeroId !== null ? index.heroes.get(g.equippedHeroId) ?? null : null
  const important = !!owner && ctx.important.has(owner.id)
  const reservedFor = ctx.reserved.get(`${g.kind}${g.id}`)
  // Perfil de referencia: el de quien la lleva, el de quien más gana con ella o el que mejor encaja.
  const accessoryRoles = g.kind === 'accessory' ? [...(ctx.factionSlot.get(`${g.faction}:${g.slot}`) ?? [])] : null
  const ref = best ?? potential ?? crowded
  const role: RoleId | null = owner ? presetFor(owner) as RoleId : ref ? presetFor(ref.hero) as RoleId
    : bestRole(g, accessoryRoles ?? ['dps', 'tank', 'support'])
  const subject = owner ?? ref?.hero ?? null
  const base = subject?.basis ?? (role ? ctx.roleBase[role] : {})
  const subs: SubView[] = g.subs.map(b => ({ bonus: b, band: rollBand(b.rolls, b.grade), ...subFit(ctx, g, b, role, base) }))
  const useful = (b: Pick<Bonus, 'stat' | 'mode'>) => !role || ROLE_STATS[role].has(b.stat)
  const outlook = outlookOf(g, useful, subs)
  const mainFit: GearAdvice['mainFit'] = FIXED_MAIN.has(g.slot) ? 'fixed' : role && !ROLE_STATS[role].has(g.main.stat) ? 'no' : 'yes'
  const usefulSubs = subs.filter(s => s.fit === 'yes').length + 0.5 * subs.filter(s => s.fit === 'weak').length
  const who = subject ? subject.name : role ? `un perfil de ${ROLE_LABEL[role]}` : 'tus Invokers'

  // 1) Qué es: rareza, rango y nivel (reglas oficiales).
  const initial = GEAR_RULES.initialSubs[g.rarity] ?? Math.min(4, g.subs.length)
  const totalUnlocks = GEAR_RULES.maxSubs - initial, totalUps = GEAR_RULES.thresholds.length - totalUnlocks
  const identity: Step[] = [
    { tag: 'oficial', tone: totalUps >= 3 ? 'good' : totalUps <= 1 ? 'bad' : 'info', text: `Pieza ${rarityF(g.rarity)}: trae ${plural(initial, 'subestadística')} de serie. De sus 4 hitos (+5, +10, +15 y +20), ${totalUnlocks ? `${totalUnlocks === 1 ? '1 desbloquea una subestadística nueva' : `${totalUnlocks} desbloquean subestadísticas nuevas`} y ` : ''}${totalUps === 0 ? 'ninguno mejora una existente' : `${totalUps} ${totalUps === 1 ? 'mejora' : 'mejoran'} una existente`}. Más rareza, más mejoras reales.` },
    { tag: 'oficial', tone: g.rank >= 5 ? 'good' : g.rank <= 3 ? 'bad' : 'info', text: `Rango ${g.rank}★: fija el valor de la principal y de cada tirada. No se puede subir; solo el nivel.` },
  ]
  const refSub = subs.find(s => s.fit === 'yes') ?? subs[0]
  if (refSub) {
    const k = key(refSub.bonus), here = ctx.units.get(`${k}:${g.rank}`), up = [4, 5].filter(r => r > g.rank).map(r => [r, ctx.units.get(`${k}:${r}`)] as const).filter(([, v]) => v)
    if (here && up.length) identity.push({ tag: 'tu caja', tone: 'info', text: `En tu caja, una tirada máxima de ${nameOf(k)} vale ${fmtBonus(refSub.bonus.stat, refSub.bonus.mode, here)} al ${g.rank}★ y ${up.map(([r, v]) => `${fmtBonus(refSub.bonus.stat, refSub.bonus.mode, v!)} al ${r}★`).join(' y ')}.` })
  }
  identity.push({ tag: 'oficial', tone: 'info', text: g.level >= GEAR_RULES.maxLevel ? `Nivel +${g.level}: al máximo, ya no recibe más mejoras.` : `Nivel +${g.level} de ${GEAR_RULES.maxLevel}: le ${outlook.remaining.length === 1 ? 'queda 1 hito' : `quedan ${outlook.remaining.length} hitos`} (${outlook.remaining.map(x => `+${x}`).join(', ')}).` })

  // 2) Principal y subestadísticas frente al perfil de referencia.
  const statsSteps: Step[] = []
  statsSteps.push(mainFit === 'fixed' ? { tag: 'oficial', tone: 'info', text: `Principal ${bonusName(g.main.stat, g.main.mode)}: es la única que admite ${t(SLOT_LABEL, g.slot).toLowerCase()}, así que no distingue unas piezas de otras.` }
    : mainFit === 'yes' ? { tag: 'criterio', tone: 'good', text: `Principal ${bonusName(g.main.stat, g.main.mode)}: la aprovecha ${who}. En esta ranura es lo que más pesa.` }
    : { tag: 'criterio', tone: 'bad', text: `Principal ${bonusName(g.main.stat, g.main.mode)}: no la aprovecha ${who}. En esta ranura la principal es lo que más pesa y no cambia al subir.` })
  if (g.mainAtMax && g.level < GEAR_RULES.maxLevel) statsSteps.push({ tag: 'tu caja', tone: 'info', text: `La principal pasa de ${fmtBonus(g.main.stat, g.main.mode, g.main.value)} a ${fmtBonus(g.mainAtMax.stat, g.mainAtMax.mode, g.mainAtMax.value)} al +20 (dato del portal).` })
  for (const s of subs) {
    const b = s.bonus
    const band = s.band ? `${s.band[0] === s.band[1] ? s.band[0] : `${s.band[0]}–${s.band[1]}`} % de una tirada máxima` : 'nota sin publicar'
    statsSteps.push({ tag: s.fit === 'weak' ? 'cálculo' : 'criterio', tone: s.fit === 'yes' ? 'good' : s.fit === 'weak' ? 'info' : 'bad',
      text: `${bonusName(b.stat, b.mode)} ${fmtBonus(b.stat, b.mode, b.value)} · nota ${b.grade ?? '—'} con ${plural(b.rolls, 'mejora')} (${band}): ${s.note || 'sirve'}.` })
  }
  const made = outlook.madeUseful + outlook.madeDead
  if (made) statsSteps.push({ tag: 'cálculo', tone: outlook.madeDead > outlook.madeUseful ? 'bad' : 'good', text: made === 1 ? `Su única mejora hasta ahora cayó en una subestadística ${outlook.madeUseful ? 'útil' : 'que no sirve'}.` : `De sus ${made} mejoras ya recibidas, ${outlook.madeUseful} ${outlook.madeUseful === 1 ? 'cayó' : 'cayeron'} en subestadísticas útiles y ${outlook.madeDead} en las que no sirven.` })

  // 3) Lo que puede llegar a ser.
  const future: Step[] = []
  if (!outlook.remaining.length) future.push({ tag: 'oficial', tone: 'info', text: 'No le quedan hitos: lo que ves es lo que hay.' })
  else {
    if (outlook.unlocks) future.push({ tag: 'oficial', tone: 'info', text: `${outlook.unlocks === 1 ? `Al +${outlook.remaining[0]} desbloquea` : `En ${outlook.remaining.slice(0, outlook.unlocks).map(x => `+${x}`).join(', ')} desbloquea`} ${outlook.unlocks === 1 ? 'una subestadística nueva' : `${outlook.unlocks} subestadísticas nuevas`} al azar entre las ${outlook.pool.size} que admite la ranura y aún no tiene.` })
    if (outlook.unlocks && role) future.push({ tag: 'cálculo', tone: outlook.pool.useful.length / Math.max(1, outlook.pool.size) >= 0.5 ? 'good' : 'bad', text: `De esas ${outlook.pool.size}, ${outlook.pool.useful.length} sirven para ${ROLE_LABEL[role]} (${outlook.pool.useful.map(nameOf).join(', ') || 'ninguna'}): ${pct(outlook.pool.useful.length / Math.max(1, outlook.pool.size))} por desbloqueo, si todas tienen el mismo peso.` })
    if (outlook.upgrades) {
      const p = outlook.pUseful ?? 0, U = outlook.upgrades
      future.push({ tag: 'oficial', tone: 'info', text: `${U === 1 ? 'Después, 1 mejora cae' : `Después, ${U} mejoras caen`} al azar en una de sus 4 subestadísticas, y cada una suma entre el 70 y el 100 % de una tirada máxima, con el mismo peso.` })
      future.push({ tag: 'cálculo', tone: p >= 0.5 ? 'good' : 'bad', text: `Con ${usefulSubs % 1 ? usefulSubs.toString().replace('.', ',') : usefulSubs} de 4 útiles${outlook.unlocks ? ' (contando los desbloqueos esperados)' : ''}: ${pct(p)} de acierto por mejora y ${pct(1 - (1 - p) ** U)} de que al menos una caiga en algo útil.` })
      const top = subs.filter(s => s.fit === 'yes' && s.band).sort((a, b) => b.band![0] - a.band![0])[0]
      if (top && top.band) {
        const r = Math.min(4, top.bonus.rolls + U), lo = gradeFor(r, top.band[0] + 70 * U), hi = gradeFor(r, top.band[1] + 100 * U)
        if (lo && hi) future.push({ tag: 'cálculo', tone: 'info', text: `Si todas cayeran en ${bonusName(top.bonus.stat, top.bonus.mode)}, terminaría con nota entre ${lo} y ${hi}.` })
      }
    }
  }

  // 4) Para tu cuenta.
  const account: Step[] = []
  if (owner) account.push({ tag: 'tu caja', tone: important ? 'good' : 'info', text: `La lleva ${owner.name}${important ? ', de un equipo activo o de tu plan' : ''}.` })
  if (reservedFor) account.push({ tag: 'tu caja', tone: 'good', text: `Está reservada en tu plan para ${reservedFor}.` })
  if (best) account.push({ tag: 'cálculo', tone: 'good', text: `Mejoraría a ${best.hero.name}: ${gainText(best)} sustituyendo ${best.replaces ? `su ${t(SLOT_LABEL, g.slot).toLowerCase()} actual` : 'una ranura vacía'} (fórmula de estadísticas verificada, conjuntos incluidos).` })
  else if (potential) account.push({ tag: 'cálculo', tone: 'good', text: `Al +20 podría mejorar a ${potential.hero.name}: ${gainText(potential)} (valor medio esperado: principal al máximo según el portal y tiradas medias en las mejoras y desbloqueos que le quedan).` })
  else if (crowded) account.push({ tag: 'cálculo', tone: 'info', text: `Al +20 también mejoraría a ${crowded.hero.name}, pero ya tienes 2 piezas con más futuro para esa ranura.` })
  if (!best && outranked) account.push({ tag: 'cálculo', tone: 'info', text: `También mejoraría a ${outranked.hero.name} (${gainText(outranked)}), pero Nexo reserva esa ranura para otra pieza libre que le da más.` })
  if (!owner && !best && !outranked && !potential && !crowded) account.push({ tag: 'cálculo', tone: 'bad', text: `No mejora a ninguno de tus ${ctx.candidates.length} candidatos frente a lo que ya llevan, y subida a +20 tampoco mejoraría a ${ctx.focusLabel}.` })
  if (g.kind === 'relic' && g.set) {
    const n = ctx.setSlot.get(`${g.set}:${g.slot}`) ?? 0, bossOnly = BOSS_ONLY_SETS.has(g.set)
    account.push({ tag: bossOnly ? 'oficial' : 'tu caja', tone: bossOnly && n <= 2 ? 'good' : 'info', text: `Conjunto ${t(SET_LABEL, g.set)}: tienes ${plural(n, 'pieza')} de este conjunto para ${t(SLOT_LABEL, g.slot).toLowerCase()}.${bossOnly ? ' Solo lo sueltan los jefes de reliquias.' : ''}` })
  }
  const factionRoles = accessoryRoles
  if (g.kind === 'accessory') {
    const n = ctx.factionCount.get(g.faction ?? '') ?? 0, awake = ctx.index.box.accessorySlotAwake[g.slot] ?? 0
    account.push({ tag: 'oficial', tone: factionRoles?.length ? 'info' : 'bad', text: `Solo la pueden llevar Invokers de ${g.faction}${awake ? ` con ${awake}★ de despertar (ranura ${t(SLOT_LABEL, g.slot).toLowerCase()})` : ''}: ${factionRoles?.length ? 'tienes alguno que puede' : n ? `tienes ${n}, pero ninguno con la ranura desbloqueada` : 'no tienes ninguno'}.` })
  }

  // 5) Decisión (criterios de Nexo).
  let verdict: Verdict, title: string, why: string, priority: number, watch: string | null = null
  const rarityRank = Math.max(0, ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].indexOf(g.rarity))
  const next = outlook.remaining[0]
  if (owner) {
    const betterFree = ctx.freeGood.get(goodKey(g)) ?? 0
    if (g.level >= GEAR_RULES.maxLevel) { verdict = 'done'; title = 'Completa'; why = `Al +20 en ${owner.name}: ya no mejora más.`; priority = 0 }
    else if (g.rank <= 3 && betterFree > 0) {
      verdict = 'replace'; title = 'Sustitúyela antes de subirla'
      const alt = ctx.index.box[g.kind === 'relic' ? 'relics' : 'accessories'].filter(x => x.equippedHeroId === null && x.rank > g.rank && x.slot === g.slot && (g.kind === 'relic' || x.faction === g.faction) && key(x.main) === key(g.main) && x.mainAtMax).sort((a, b) => b.mainAtMax!.value - a.mainAtMax!.value)[0]
      why = `Es ${g.rank}★ y tienes ${plural(betterFree, 'pieza libre', 'piezas libres')} de más rango para esta ranura${alt && g.mainAtMax ? `: al +20 su principal llega a ${fmtBonus(g.main.stat, g.main.mode, g.mainAtMax.value)} y la de una ${alt.rank}★ libre, a ${fmtBonus(alt.main.stat, alt.main.mode, alt.mainAtMax!.value)}` : ''}. Cada nivel que le pongas rinde menos que en una de ellas.`
      priority = (important ? 100 : 0) + owner.power / 1e4
    } else {
      verdict = 'upgrade'; title = `Súbela a +${GEAR_RULES.maxLevel}`
      const mainGain = g.mainAtMax ? `principal ${fmtBonus(g.main.stat, g.main.mode, g.main.value)} → ${fmtBonus(g.mainAtMax.stat, g.mainAtMax.mode, g.mainAtMax.value)}` : 'su principal crece con cada nivel'
      why = `La lleva ${owner.name}${important ? ' (equipo activo o plan)' : ''}: ${mainGain} y ${plural(outlook.remaining.length, 'hito')} de subestadísticas por delante.`
      priority = (important ? 100 : 0) + owner.power / 1e4 + g.rank + (outlook.pUseful ?? 0.5)
    }
  } else if (reservedFor) { verdict = 'keep'; title = 'Guárdala'; why = `Reservada en tu plan para ${reservedFor}.`; priority = 50 }
  else if (best) {
    verdict = 'equip'; title = `Equípasela a ${best.hero.name}`
    why = `${gainText(best)}${best.replaces ? '' : ' (tiene la ranura vacía)'}${g.level < GEAR_RULES.maxLevel ? '; luego súbela' : ''}.`
    priority = (ctx.important.has(best.hero.id) ? 100 : 0) + Math.min(99, norm(best))
  } else if (g.kind === 'accessory' && !factionRoles?.length) {
    verdict = 'sell'; title = 'Véndela o tritúrala'; why = `Ningún Invoker tuyo de ${g.faction} puede llevarla ahora.`; priority = 5 - g.rank
    if (g.rank >= 5 || rarityRank >= 3) { verdict = 'keep'; title = 'Guárdala si vas a despertar'; why = `Es ${g.rank}★ y ${rarityF(g.rarity)}, pero ningún Invoker tuyo de ${g.faction} tiene la ranura desbloqueada.`; priority = 10 }
  } else if (g.level >= GEAR_RULES.maxLevel) { verdict = 'sell'; title = 'Véndela o tritúrala'; why = outranked ? `Está al +20 y no tiene hueco: ${outranked.hero.name} ganaría con ella, pero recibe otra pieza libre mejor para esa ranura.` : 'Está al +20 y no mejora a ninguno de tus Invokers.'; priority = 3 }
  else if (g.rank <= 3) { verdict = 'sell'; title = 'Véndela o tritúrala'; why = `Rango ${g.rank}★: sus tiradas valen menos que las de una 4★ y el rango no se puede subir.`; priority = 6 - g.rank }
  else if (g.kind === 'relic' && g.set && BOSS_ONLY_SETS.has(g.set) && g.set.endsWith('Tolerance') && (ctx.setSlot.get(`${g.set}:${g.slot}`) ?? 0) <= 2) {
    verdict = 'keep'; title = 'Guárdala'; why = `Una de tus ${ctx.setSlot.get(`${g.set}:${g.slot}`)} piezas de ${t(SET_LABEL, g.set)} para ${t(SLOT_LABEL, g.slot).toLowerCase()}: las tolerancias solo caen de jefes y hacen falta 3 piezas.`; priority = 20
  } else {
    if (potential) {
      verdict = 'test'; title = `Pruébala hasta +${next}`
      const p = outlook.events[0] === 'upgrade' ? subs.filter(s => s.fit !== 'no').length / 4 : outlook.pool.useful.length / Math.max(1, outlook.pool.size)
      why = `Al +20 podría dar ${gainText(potential)} a ${potential.hero.name}; ${pct(p)} de que el hito +${next} caiga en algo útil.`
      const deadNames = subs.filter(s => s.fit === 'no').map(s => bonusName(s.bonus.stat, s.bonus.mode))
      const goodNames = subs.filter(s => s.fit !== 'no').map(s => bonusName(s.bonus.stat, s.bonus.mode))
      watch = outlook.events[0] === 'unlock'
        ? `Al +${next} se desbloquea una subestadística: si es ${outlook.pool.useful.map(nameOf).join(', ') || 'útil'}, sigue; si no, véndela antes de gastar más.`
        : `Al +${next} mejora una al azar: si cae en ${goodNames.join(' o ') || 'una útil'}, sigue hasta el siguiente hito; ${deadNames.length ? `si cae en ${deadNames.join(' o ')}, para y véndela.` : 'todas le sirven.'}`
      priority = norm(potential) + 2 * rarityRank + g.rank + 5 * p
    } else {
      verdict = 'sell'; title = 'Véndela o tritúrala'
      why = crowded ? `Al +20 mejoraría a ${crowded.hero.name}, pero ya tienes piezas con más futuro para esa ranura.`
        : mainFit === 'no' ? `Su principal (${bonusName(g.main.stat, g.main.mode)}) no la aprovecha ${who}, y la principal no cambia.`
        : made && outlook.madeDead > outlook.madeUseful ? (made === 1 ? `Su única mejora cayó en una subestadística que no aprovecha ${who}, y ni subida a +20 mejoraría a ${ctx.focusLabel}.` : `${outlook.madeDead} de sus ${made} mejoras cayeron en subestadísticas que no aprovecha ${who}.`)
        : `Ni subida a +20 mejoraría a ${ctx.focusLabel}${usefulSubs < 2 ? `: solo ${String(usefulSubs).replace('.', ',')} de sus subestadísticas sirven para ${ROLE_LABEL[role ?? 'dps']}` : ''}.`
      priority = 5 - g.rank + (2 - usefulSubs) / 4
    }
  }
  const decision: Step[] = [{ tag: 'criterio', tone: verdict === 'sell' ? 'bad' : verdict === 'done' ? 'info' : 'good', text: `${title}: ${why}` }]
  if (watch) decision.push({ tag: 'criterio', tone: 'info', text: watch })
  if (verdict === 'done' && g.rank <= 3 && (ctx.freeGood.get(goodKey(g)) ?? 0) > 0) decision.push({ tag: 'criterio', tone: 'info', text: `Es ${g.rank}★: cuando subas una pieza libre de más rango para esta ranura, cámbiala por ella.` })
  if (verdict === 'upgrade' || verdict === 'test') decision.push({ tag: 'oficial', tone: 'info', text: 'Subir cuesta oro y Memorium por nivel (la caja no publica cuánto). Los hitos de subestadística están en +5, +10, +15 y +20: subir a medias entre hitos solo mejora la principal.' })
  if (verdict === 'sell') decision.push({ tag: 'oficial', tone: 'info', text: 'Vender (icono de monedas) da oro; triturar (escudo roto) la convierte en Memorium. Las dos cosas hacen falta para subir piezas: tritura si te falta Memorium y vende si te falta oro. Puedes hacerlo por lotes desde la sala de equipo («Sell / Crush»).' })
  // Para enseñar: lo bueno y lo malo, el camino de hitos y qué hacer en el siguiente.
  const forWho = subject ? `${subject.name}${role ? ` (${ROLE_LABEL[role]})` : ''}` : role ? `un perfil de ${ROLE_LABEL[role]}` : 'tus Invokers'
  const usefulNames = subs.filter(x => x.fit !== 'no').map(x => bonusName(x.bonus.stat, x.bonus.mode))
  const deadNames = subs.filter(x => x.fit === 'no').map(x => bonusName(x.bonus.stat, x.bonus.mode))
  const pros: string[] = [], cons: string[] = []
  if (g.rank >= 5) pros.push(`Rango ${g.rank}★: cada tirada vale lo máximo que verás en tu caja.`)
  else if (g.rank <= 3) cons.push(`Rango ${g.rank}★: tiradas pequeñas, y el rango no se puede subir.`)
  if (totalUps >= 3) pros.push(`Pieza ${rarityF(g.rarity)}: ${totalUps} de sus 4 hitos mejoran subestadísticas que ya tiene.`)
  else if (totalUps <= 1) cons.push(`Pieza ${rarityF(g.rarity)}: ${totalUps === 0 ? 'ningún hito mejora' : 'solo 1 hito mejora'} subestadísticas; el resto las saca al azar.`)
  if (mainFit === 'yes') pros.push(`Su principal, ${bonusName(g.main.stat, g.main.mode)}, es justo lo que necesita ${forWho}.`)
  else if (mainFit === 'no') cons.push(`Su principal, ${bonusName(g.main.stat, g.main.mode)}, no le sirve a ${forWho}, y la principal nunca cambia.`)
  if (subs.length && role) {
    if (usefulSubs >= 3) pros.push(`${usefulNames.length} de sus ${subs.length} subestadísticas le sirven (${usefulNames.join(', ')}).`)
    else if (usefulSubs >= 2) pros.push(`Le sirven ${usefulNames.join(' y ')}.`)
    if (deadNames.length >= 2 || (deadNames.length && usefulSubs < 2)) cons.push(`No le sirven ${deadNames.join(', ')}.`)
  }
  const wasted = subs.filter(x => x.fit === 'no' && x.bonus.rolls), landed = subs.filter(x => x.fit !== 'no' && x.bonus.rolls)
  if (landed.length) pros.push(`Mejoras que cayeron bien: ${landed.map(x => `${bonusName(x.bonus.stat, x.bonus.mode)} ×${x.bonus.rolls}`).join(', ')}.`)
  if (wasted.length) cons.push(`Mejoras perdidas: ${wasted.map(x => `${bonusName(x.bonus.stat, x.bonus.mode)} ×${x.bonus.rolls}`).join(', ')}.`)
  if (best) pros.push(`Ya mejora a ${best.hero.name}: ${gainText(best)}.`)
  else if (potential) pros.push(`Subida a +20 podría mejorar a ${potential.hero.name} (${gainText(potential)}).`)
  else if (reservedFor) pros.push(`Reservada en tu plan para ${reservedFor}.`)
  else if (important && owner) pros.push(`La lleva ${owner.name}, de tus equipos activos o tu plan.`)
  else if (!owner) cons.push(crowded ? `Para ${crowded.hero.name} tienes piezas con más futuro en esa ranura.` : 'No mejora a ninguno de tus Invokers, ni ahora ni subida a +20.')
  if (g.mainAtMax && g.level < GEAR_RULES.maxLevel && (owner || best || potential)) pros.push(`La principal crece con cada nivel: ${fmtBonus(g.main.stat, g.main.mode, g.main.value)} → ${fmtBonus(g.mainAtMax.stat, g.mainAtMax.mode, g.mainAtMax.value)} al +20.`)

  const poolP = outlook.pool.size ? outlook.pool.useful.length / outlook.pool.size : 0
  const upP = outlook.pUseful ?? (subs.length ? subs.filter(x => x.fit !== 'no').length / GEAR_RULES.maxSubs : 0)
  const path: PathNode[] = GEAR_RULES.thresholds.map((lv, i) => {
    const kind = i < totalUnlocks ? 'unlock' as const : 'upgrade' as const
    return { level: lv, kind, state: lv <= g.level ? 'done' as const : lv === next ? 'next' as const : 'future' as const, p: lv <= g.level ? null : kind === 'unlock' ? poolP : upP }
  })
  let nextStep: NextStep | null = null, stopRule: string | null = null
  const climbing = verdict === 'upgrade' || verdict === 'test' || verdict === 'equip'
  if (climbing && next) {
    const kind = path.find(n => n.level === next)!.kind
    const after = outlook.remaining[1]
    const good = kind === 'unlock' ? outlook.pool.useful.map(nameOf) : usefulNames
    const bad = kind === 'unlock' ? (SUB_POOL.get(g.slot) ?? []).filter(k => !outlook.pool.useful.includes(k) && k !== key(g.main) && !g.subs.some(x => key(x) === k)).map(nameOf) : deadNames
    const cont = after ? `Sigue hasta +${after} y vuelve a mirar.` : 'Perfecto: queda completa y bien aprovechada.'
    const deadAfter = outlook.madeDead + (kind === 'upgrade' ? 1 : 0), usefulMade = outlook.madeUseful
    const stopNow = verdict === 'test' || (kind === 'upgrade' && deadAfter > usefulMade) || (kind === 'unlock' && subs.filter(x => x.fit !== 'no').length < 2)
    nextStep = {
      level: next, kind, p: kind === 'unlock' ? poolP : upP, good, bad,
      ifGood: cont,
      ifBad: !after ? 'No es grave: la principal ya llegó a su máximo. Úsala mientras no tengas una mejor para esa ranura.'
        : stopNow ? (verdict === 'test' ? 'Para aquí y véndela: no gastes más oro ni Memorium en ella.' : `Para aquí: ${kind === 'upgrade' ? 'tendría más mejoras perdidas que útiles' : 'le quedarían pocas subestadísticas útiles'}. Búscale sustituta en el optimizador antes de invertir más.`)
        : 'Puedes seguir: la principal sube igual y aún tiene opciones, pero vigila el siguiente hito.',
    }
    stopRule = STOP_RULE
  }
  return {
    forWho, pros, cons, path, next: nextStep, stopRule,
    gear: g, verdict, title, why, priority, role, subs, outlook, mainFit, owner, important, best, watch,
    sections: [
      { title: 'Qué es', steps: identity },
      { title: role ? `Sus estadísticas para ${subject ? subject.name : `un perfil de ${ROLE_LABEL[role]}`}` : 'Sus estadísticas', steps: statsSteps },
      { title: 'Lo que puede llegar a ser', steps: future },
      { title: 'Para tu cuenta', steps: account },
      { title: 'Decisión', steps: decision },
    ],
  }
}

/** Reparto de piezas libres: cada Invoker candidato recibe, como mucho, una pieza por ranura (la que más le da ahora) y
 * cada pieza va a un solo Invoker. Después, para las que siguen libres, hasta 3 candidatas por ranura según lo que darían
 * subidas a +20 (estimación). Cambios de una sola pieza con la fórmula verificada; no es la build óptima completa. */
export type Uses = Map<string, PieceUse>
const TRIES_PER_SLOT = 2
export function assignUses(ctx: CoachContext): Uses {
  const { box } = ctx.index
  const free = [...box.relics, ...box.accessories].filter(g => g.equippedHeroId === null && !ctx.reserved.has(`${g.kind}${g.id}`))
  const greedy = (pieces: Gear[], gearOf: (g: Gear) => Gear, perSlot: number, heroes: Hero[], put: (g: Gear, u: Usefulness | null, lost: Usefulness | null) => void) => {
    const pairs: { g: Gear; u: Usefulness }[] = []
    for (const g of pieces) for (const u of whoBenefits(ctx.index, gearOf(g), heroes, ctx.cache)) if (norm(u) >= MIN_GAIN_PCT) pairs.push({ g, u })
    pairs.sort((a, b) => norm(b.u) - norm(a.u))
    const taken = new Map<string, number>(), done = new Map<Gear, { u: Usefulness | null; lost: Usefulness | null }>()
    for (const { g, u } of pairs) {
      const cur = done.get(g)
      if (cur?.u) continue
      const sk = `${u.hero.id}:${g.kind}:${g.slot}`
      if ((taken.get(sk) ?? 0) >= perSlot) { if (!cur) done.set(g, { u: null, lost: u }); continue }
      taken.set(sk, (taken.get(sk) ?? 0) + 1)
      done.set(g, { u, lost: cur?.lost ?? null })
    }
    for (const [g, { u, lost }] of done) put(g, u, lost)
  }
  const out: Uses = new Map()
  greedy(free, g => g, 1, ctx.candidates, (g, best, outranked) => out.set(`${g.kind}${g.id}`, { best, outranked }))
  const rest = free.filter(g => !out.get(`${g.kind}${g.id}`)?.best && g.level < GEAR_RULES.maxLevel && g.rank >= 4)
  // Subir piezas cuesta: solo se proponen para los Invokers en los que te centras (equipos activos y plan) o, si no
  // hay ninguno marcado, para los 10 más fuertes.
  greedy(rest, g => projectedGear(g, ctx.units), TRIES_PER_SLOT, ctx.focus, (g, potential, crowded) => {
    const k = `${g.kind}${g.id}`
    out.set(k, { best: null, outranked: out.get(k)?.outranked ?? null, potential, crowded })
  })
  return out
}

/** Diagnóstico de todas las piezas, ordenado por prioridad. */
export function adviseAll(ctx: CoachContext): GearAdvice[] {
  const { box } = ctx.index
  const uses = assignUses(ctx)
  return [...box.relics, ...box.accessories].map(g => adviseGear(g, ctx, uses.get(`${g.kind}${g.id}`))).sort((a, b) => b.priority - a.priority)
}
export const VERDICT_ORDER: Verdict[] = ['upgrade', 'equip', 'test', 'replace', 'keep', 'sell', 'done']
