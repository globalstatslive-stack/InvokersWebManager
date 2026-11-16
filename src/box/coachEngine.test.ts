import { describe, expect, it } from 'vitest'
import { canBind, parseOfficialBox } from './model'
import { BoxIndex } from './stats'
import { usedHeroes } from './equipBatch'
import { fichaLevel, skillLevels, type Kit } from './combat'
import { bossSlugOf } from './goal'
import { boundValue, isApplied, objectiveOptions, planFor, resolveObjective, scoreOf, UNQUANTIFIED_CAP, type CatalogBoss, type EngineInput } from './coachEngine'

const F = 2 ** 32
const stats = { attack: 1000, health: 6000, defense: 500, criticalRate: 0.2, criticalDamage: 0.5, accuracy: 100, resistance: 50, comboSpeed: 10, skillSpeed: 10, skillRecovery: 10, manaGeneration: 10 }
const basis = Object.fromEntries(Object.entries({ attack: 800, health: 5000, defense: 400, criticalRate: 0.05, criticalDamage: 0.5, accuracy: 0, resistance: 10 }).map(([k, v]) => [k, v * F]))
const hero = (id: number, name: string, cls: string, extra: Record<string, unknown> = {}) => ({
  heroId: id, configId: id * 10, character: { portraitUrl: `/game-assets/1/characters/X/${name}/portrait.webp`, shortName: name, element: 'Fire', class: cls, rarity: 'Epic', faction: 'Magi' },
  rank: 5, level: 50, maxLevel: 50, awakeLevel: 2, awakeNodesUnlocked: 14, power: 1000, battles: 10, relicIdBySlot: {}, accessoryIdBySlot: {}, gearBonus: {},
  skillLevels: [{ kind: 'Combo', level: 0 }, { kind: 'ActiveSkill1', level: 4 }, { kind: 'Ultimate', level: 10 }],
  stats, basis, basisFlat: { accuracy: 20 * F, crushTolerance: 1.1 * F }, ...extra,
})
const relic = (id: number, slot: string, owner: number | null, main: [string, string, number], extra: Record<string, unknown> = {}) => ({
  id, kind: 'relic', slot, rank: 5, rarity: 'Epic', set: 'Attack', level: 20, equippedHeroId: owner, unequipGold: 1000,
  main: { stat: main[0], mode: main[1], value: main[2], rolls: 0, grade: null }, subs: [], mainAtMax: null, ...extra,
})
const titan = (id: number, name: string, stat: string, mode: string, spec: string, general: number, specialized: number, miss: number, faction = 'Magi') => ({
  titanId: id, character: { shortName: name, portraitUrl: `/game-assets/1/characters/T/${name}/portrait.webp`, rarity: 'Epic', faction, role: 'Damage' },
  rank: 5, level: 50, maxLevel: 50, locked: false, power: 1, battles: 1, empowerment: 0, skillLevels: [{ kind: 'Combo', level: 0 }],
  boundEffect: { stat, mode, specialization: spec, general, specialized, specializationMiss: miss }, stats: { boundBonuses: [], flatBonuses: [] },
})
const level = (lv: number, ids: [number, number | null][], v = 1, d = 0, t = 100) => ({ level: lv, bestTimeSeconds: t, victories: v, defeats: d, bestTimeTeam: { formation: 'Five9', leadPosition: 'Front1', slots: ids.map(([heroId, titanId], i) => ({ position: `P${i}`, line: 'front', heroId, titanId, titanPriority: i })) } })
function fixture() {
  return {
    profile: { name: 'P' }, rules: { relicSets: [{ set: 'Attack', name: 'Attack', three: [], five: [], eight: [], flags: [] }], accessorySlotAwakeLevel: { Amulet: 0, Earrings: 2, Banner: 4, Talisman: 5, Flasks: 6 } },
    heroes: [hero(1, 'ATACANTE', 'RangedAttacker', { relicIdBySlot: { Weapon: 10 } }), hero(2, 'TANQUE', 'Tank'), hero(3, 'BANQUILLO', 'RangedAttacker', { level: 20, relicIdBySlot: { Pauldrons: 12 } }), hero(4, 'OTRO', 'Support', { level: 40, relicIdBySlot: { Chestplate: 14 } })],
    relics: [
      relic(10, 'Weapon', 1, ['attack', 'flat', 100]),
      relic(11, 'Weapon', null, ['attack', 'flat', 400]),            // libre y mejor que la de ATACANTE
      relic(12, 'Pauldrons', 3, ['attack', 'percent', 0.3]),         // en BANQUILLO, que no se usa
      relic(13, 'Gauntlets', null, ['criticalRate', 'percent', 0.2]), // libre
      relic(14, 'Chestplate', 4, ['attack', 'percent', 0.3]),        // en OTRO, que sí se usa
    ],
    accessories: [], titans: [titan(7, 'GENERAL', 'attack', 'percent', 'General', 0.2, 0.2, 0.2), titan(8, 'JEFES', 'attack', 'percent', 'Dungeon', 0.2, 0.3, 0.1),
      // Mejor vínculo, pero de otra facción: no se puede vincular a Invokers Magi.
      titan(9, 'AJENO', 'attack', 'percent', 'General', 0.6, 0.6, 0.6, 'Ironbands')],
    teams: [
      { mode: 'dungeon', key: 'fire-omnissi', label: 'Omnissi', detail: 'Fire', element: 'Fire', difficultyLabel: 'Normal', highestLevel: 3, clearTimed: true, levels: [level(3, [[1, 7], [2, null]], 2, 1, 200), level(2, [[1, 7], [2, null]], 40, 0, 90)] },
      { mode: 'tower', key: 'fire-spire', label: 'Fire Spire', detail: null, element: 'Fire', difficultyLabel: 'Hard', highestLevel: 2, levels: [level(2, [[1, null], [4, null]])] },
      { mode: 'dungeon', key: 'ulgorim', label: 'Ulgorim', detail: null, element: null, difficultyLabel: 'Normal', highestLevel: 1, levels: [level(1, [[4, null], [2, null]], 1)] },
    ],
  }
}
const bosses: CatalogBoss[] = [{ slug: 'omnissi-fire', name: 'Fire Garuda', guide: '', corruptions: [{ key: 'Crush' }], stages: [1, 2, 3, 4].map(i => ({ res: 100 * i, accGoal: 100 * i, resGoal: 50, tolGoal: 120, element: 'Fire' })) }]
// Ficha sintética: combo y una habilidad que escalan con ATQ y mejoran por nivel.
const lv = (cd: number, p: number): [number, number, ['D', [number, 'A'][]][]] => [cd, 0, [['D', [[p, 'A']]]]]
const kit: Kit = [
  { n: 'Golpe', a: 0, e: [], acc: 0, m: [10, 10], l: Array.from({ length: 11 }, (_, i) => lv(0, 50 + 5 * i)) },
  { n: 'Rayo', a: 1, e: ['DebuffDefense'], acc: 1, m: [20, 20], l: Array.from({ length: 11 }, (_, i) => lv(20 - i, 200 + 20 * i)) },
  null, null, null,
]

describe('Coach: objetivos sacados de tus récords', () => {
  const box = parseOfficialBox(fixture())
  it('traduce las claves de la caja a los jefes del catálogo', () => {
    expect(bossSlugOf({ mode: 'dungeon', key: 'fire-omnissi', label: 'Omnissi' })).toBe('omnissi-fire')
    expect(bossSlugOf({ mode: 'clanBoss', key: 'clanBoss-301', label: 'Sorgott' })).toBe('sorgott')
    expect(bossSlugOf({ mode: 'dungeon', key: 'ulgorim', label: 'Ulgorim' })).toBe('ulgorim')
  })
  it('propone superar la siguiente fase, farmear la más jugada y la aguja con su dificultad', () => {
    const opts = objectiveOptions(box, { bosses })
    const labels = opts.map(o => o.label)
    expect(labels[0]).toBe('Toda la cuenta')
    expect(labels).toContain('Superar Omnissi Fire 4')
    expect(labels).toContain('Farmear Omnissi Fire 2 más rápido')
    expect(labels).toContain('Fire Spire (difícil): piso 3')
    expect(new Set(opts.map(o => o.id)).size).toBe(opts.length)
  })
  it('para superar una fase usa el equipo de la última superada y los datos de la guía', () => {
    const { used } = usedHeroes(box, new Set())
    const o = objectiveOptions(box, { bosses }).find(x => x.label === 'Superar Omnissi Fire 4')!
    const obj = resolveObjective(box, o.choice, used, { bosses })
    expect(obj.team.map(h => h.name)).toEqual(['ATACANTE', 'TANQUE'])
    expect(obj.stage).toMatchObject({ res: 400, tolGoal: 120, corruptions: ['Crush'] })
    expect(obj.record).toMatchObject({ level: 3, victories: 2, defeats: 1 })
    expect(obj.titans.get(1)).toBe(7)
    expect([...obj.weights.values()].reduce((s, x) => s + x, 0)).toBeCloseTo(1)
    // Un récord que ya no existe vuelve a «toda la cuenta».
    expect(resolveObjective(box, { kind: 'record', mode: 'dungeon', key: 'nada', level: 1, intent: 'beat' }, used).id).toBe('general')
  })
})

describe('Coach: acciones, prioridad y comprobación', () => {
  const box = parseOfficialBox(fixture()), index = new BoxIndex(box)
  const { used } = usedHeroes(box, new Set())
  const base = (obj: ReturnType<typeof resolveObjective>, extra: Partial<EngineInput> = {}): EngineInput => ({
    index, objective: obj, used: new Set(used.map(u => u.hero.id)), protect: new Set(obj.team.map(h => h.id)), reserved: new Set(), kits: { [box.heroes[0].code]: kit }, ...extra,
  })
  const farm = () => resolveObjective(box, objectiveOptions(box, { bosses }).find(x => x.label.startsWith('Farmear'))!.choice, used, { bosses })
  it('reúne en una acción las piezas que mejoran a un Invoker: libres y de Invokers que no usas, nunca de los que usas', () => {
    const plan = planFor(base(farm()))
    const g = plan.actions.find(a => (a.kind === 'gear' || a.kind === 'trapped') && a.hero?.name === 'ATACANTE')!
    expect(g).toBeTruthy()
    const ids = g.plan!.map(p => p.gearId).sort()
    expect(ids).toContain(11)     // libre
    expect(ids).toContain(12)     // en BANQUILLO (no se usa): pieza desaprovechada
    expect(ids).not.toContain(14) // en OTRO, que se usa: protegida
    expect(g.kind).toBe('trapped')
    expect(g.cost).toMatchObject({ kind: 'gold', gold: 2000 }) // desequipar la pieza de BANQUILLO y el arma actual
    expect(g.confidence).toBe('alta')
    expect(g.availability).toBe('now')
    // Una pieza reservada en el plan no se propone.
    expect(planFor(base(farm(), { reserved: new Set(['relic11']) })).actions.flatMap(a => a.plan ?? []).some(p => p.gearId === 11)).toBe(false)
  })
  it('habilidades: el siguiente nivel de la ficha, con simulación y coste en Códices sin cantidad', () => {
    const plan = planFor(base(farm()))
    const s = plan.actions.filter(a => a.kind === 'skill' && a.hero?.name === 'ATACANTE')
    expect(s.map(a => a.title)).toEqual(expect.arrayContaining(['Sube «Golpe» de ATACANTE al nivel 2', 'Sube «Rayo» de ATACANTE al nivel 6']))
    expect(s.every(a => a.confidence === 'media' && a.availability === 'resources' && /Códices/.test(a.needs))).toBe(true)
    expect(s.every(a => (a.perHero[0]?.gain ?? 0) > 0)).toBe(true)
  })
  it('vínculo de Titán: el especializado en Jefes rinde más en una fase de jefe', () => {
    const [general, jefes] = box.titans
    expect(boundValue(general, 'dungeon')).toMatchObject({ value: 0.2, label: 'global' })
    expect(boundValue(jefes, 'dungeon')!.value).toBeCloseTo(0.3)
    expect(boundValue(jefes, 'arena')!.value).toBeCloseTo(0.1)
    const t = planFor(base(farm())).actions.find(a => a.kind === 'titan' && a.hero?.name === 'ATACANTE')
    expect(t?.titan?.name).toBe('JEFES')
    expect(t?.cost.kind).toBe('free')
  })
  it('vínculo de Titán: solo de la facción del Invoker o un Dragón', () => {
    expect(canBind({ faction: 'Magi' }, { faction: 'Magi' })).toBe(true)
    expect(canBind({ faction: 'Ironbands' }, { faction: 'Magi' })).toBe(false)
    expect(canBind({ faction: 'Dragons' }, { faction: 'Magi' })).toBe(true)
    // AJENO (Ironbands) da más ATQ pero nunca se propone a Invokers Magi.
    expect(planFor(base(farm())).actions.some(a => a.kind === 'titan' && a.titan?.name === 'AJENO')).toBe(false)
    // Un Dragón con el mismo vínculo sí se puede proponer.
    const withDragon = parseOfficialBox({ ...fixture(), titans: [...fixture().titans, titan(10, 'DRAGON', 'attack', 'percent', 'General', 0.6, 0.6, 0.6, 'Dragons')] })
    const objD = resolveObjective(withDragon, objectiveOptions(withDragon, { bosses }).find(x => x.label.startsWith('Farmear'))!.choice, usedHeroes(withDragon, new Set()).used, { bosses })
    const dragon = planFor({ ...base(objD), index: new BoxIndex(withDragon) }).actions.find(a => a.kind === 'titan' && a.hero?.name === 'ATACANTE')
    expect(dragon?.titan?.name).toBe('DRAGON')
  })
  it('puntuación: el oro resta según la cantidad y lo que no tiene cifra tiene un tope', () => {
    const a = { impact: 10, confidence: 'alta' as const, availability: 'now' as const }
    expect(scoreOf({ ...a, cost: { kind: 'free', text: '' } })).toBe(10)
    expect(scoreOf({ ...a, cost: { kind: 'gold', gold: 100000, text: '' } })).toBeCloseTo(5)
    expect(scoreOf({ ...a, impact: null, cost: { kind: 'free', text: '' } }, 1)).toBeCloseTo(UNQUANTIFIED_CAP)
  })
  it('las prioridades salen ordenadas y con alternativas para el mismo Invoker', () => {
    const plan = planFor(base(farm()))
    for (let i = 1; i < plan.actions.length; i++) expect(plan.actions[i - 1].score).toBeGreaterThanOrEqual(plan.actions[i].score)
    expect(plan.alternatives.every(x => x.heroes.some(h => h.id === plan.actions[0].hero!.id))).toBe(true)
  })
  it('comprueba si una recomendación se ha aplicado', () => {
    const atk = box.heroes[0]
    expect(isApplied({ kind: 'gear', heroId: 1, slot: 'Weapon', gearKind: 'relic', gearId: 10 }, box)).toBe(true)
    expect(isApplied({ kind: 'gear', heroId: 1, slot: 'Weapon', gearKind: 'relic', gearId: 11 }, box)).toBe(false)
    expect(isApplied({ kind: 'skill', heroId: 1, skill: 'ActiveSkill1', level: 5 }, box)).toBe(true) // nivel 4 de My Box = 5 de la ficha
    expect(isApplied({ kind: 'skill', heroId: 1, skill: 'ActiveSkill1', level: 6 }, box)).toBe(false)
    expect(isApplied({ kind: 'rank', heroId: 1, rank: 6 }, box)).toBe(false)
    expect(isApplied({ kind: 'titan', heroId: 1, titanId: 7, mode: 'dungeon', key: 'fire-omnissi' }, box)).toBe(true)
    expect(atk.awakeNodes).toBe(14)
  })
})

describe('My Box: campos nuevos y nivel de habilidad', () => {
  const box = parseOfficialBox(fixture())
  it('el nivel 0 de My Box es el nivel 1 de la ficha (y el 10, el 11)', () => {
    expect([0, 1, 4, 10, 12].map(fichaLevel)).toEqual([1, 2, 5, 11, 11])
    expect(skillLevels(box.heroes[0])).toEqual([1, 5, 1, 1, 11])
  })
  it('lee nodos de despertar, bonos planos, habilidades de Titán y detalle de récords', () => {
    const h = box.heroes[0]
    expect(h.awakeNodes).toBe(14)
    expect(h.basisFlat).toMatchObject({ accuracy: 20, crushTolerance: 1.1 })
    expect(box.titans[1].bound).toMatchObject({ specialization: 'Dungeon', specialized: 0.3, miss: 0.1 })
    expect(box.titans[0].skills).toEqual([{ kind: 'Combo', level: 0 }])
    expect(box.teams[0]).toMatchObject({ clearTimed: true })
    expect(box.teams[0].levels[0]).toMatchObject({ lead: 'Front1' })
    expect(box.teams[0].levels[0].slots[1]).toMatchObject({ titanPriority: 1 })
  })
})
