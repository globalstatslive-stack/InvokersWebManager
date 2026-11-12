import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ExternalLink, RotateCcw, Target, X } from 'lucide-react'
import { useAccount } from './account'
import { GameCard, GameImg } from './Art'
import { ELEMENT_LABEL, fmtInt, t } from '../box/i18n'
import { loadBosses } from '../box/goal'
import { loadKits, profileOf, skillLevels, type Profile } from '../box/combat'
import { DEFAULT_WEIGHTS, recommendTeam, roleLabel, type TeamPick } from '../box/recommend'
import { loadIndex, loadTiers, loadTools, useLoad } from '../wiki/data'
import { deriveNeeds, type HeroSkills } from '../box/bossNeeds'
import { BOSS_CATEGORY, TOL_LABEL } from '../wiki/labels'
import { fmtPower } from './common'

const STORE = 'nexo.teamfinder'
const read = (): { boss?: string; stage?: number } => { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') } catch { return {} } }

/** Asesor · Equipo para un jefe: tus 5 mejores Invokers y Titanes para un jefe y fase, con el porqué y lo que falta. */
export function TeamFinder() {
  const { account, go } = useAccount()
  const bosses = useLoad(loadBosses), kits = useLoad(loadKits), tiers = useLoad(loadTiers), tools = useLoad(loadTools), wiki = useLoad(loadIndex)
  const saved = read()
  const [bossSlug, setBossSlug] = useState(saved.boss ?? 'ulgorim')
  const [stageNum, setStageNum] = useState<number>(saved.stage ?? 0)
  const [needTank, setNeedTank] = useState(true), [needSustain, setNeedSustain] = useState(true)
  const [exclude, setExclude] = useState<Set<number>>(new Set())
  const box = account!.box
  const boss = bosses.data?.bosses.find(b => b.slug === bossSlug) ?? bosses.data?.bosses[0]
  const record = boss ? box.teams.find(t => t.mode === 'dungeon' && t.key === boss.slug) : undefined
  const stage = boss ? (boss.stages.find(s => s.stage === stageNum) ?? boss.stages.find(s => s.stage === Math.min(boss.stages.length, (record?.highestLevel ?? 0) + 1)) ?? boss.stages[0]) : undefined
  const profiles = useMemo(() => {
    const m = new Map<number, Profile | null>()
    if (kits.data) for (const h of box.heroes) m.set(h.id, kits.data[h.code] ? profileOf(h, kits.data[h.code], skillLevels(h)) : null)
    return m
  }, [kits.data, box])
  const byCode = useMemo(() => new Map<string, HeroSkills>((wiki.data?.invokers ?? []).map(s => [s.code, { effects: s.effects, aoe: s.aoe }])), [wiki.data])
  const needs = useMemo(() => boss ? deriveNeeds(boss) : [], [boss])
  const result = useMemo(() => {
    if (!boss || !stage || !tools.data || !kits.data || !wiki.data) return null
    const titanTier = new Map<string, string>()
    for (const r of tiers.data?.titans.rows ?? []) for (const e of r.entries) if (e.code) titanTier.set(e.code, r.label)
    return recommendTeam(box, boss, stage, profiles, { names: tools.data.elements, sign: tools.data.elementMatchupSign }, titanTier, { needTank, needSustain, exclude, skills: { needs, byCode } })
  }, [box, boss, stage, profiles, tools.data, kits.data, tiers.data, wiki.data, needs, byCode, needTank, needSustain, exclude])
  const save = (p: { boss?: string; stage?: number }) => { try { localStorage.setItem(STORE, JSON.stringify({ boss: bossSlug, stage: stage?.stage, ...p })) } catch { /* sin almacenamiento */ } }
  if (bosses.error || kits.error || tools.error || wiki.error) return <div className="state-card bad" role="alert"><AlertTriangle size={18} /> No se pudieron cargar los datos oficiales.</div>
  if (!boss || !stage || !result) return <div className="state-card" role="status">Cargando jefes, kits y tablas oficiales…</div>

  const toGoal = () => {
    const key = `nexo.goal.${box.profile.name}`
    let prev = {}; try { prev = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* nada */ }
    try { localStorage.setItem(key, JSON.stringify({ ...prev, boss: boss.slug, stage: stage.stage, team: result.picks.map(p => p.hero.id) })) } catch { /* sin almacenamiento */ }
    go('/objetivo')
  }
  const swap = (p: TeamPick) => setExclude(new Set([...exclude, p.hero.id]))
  return <section className="advisor team-finder">
    <p className="lead">Tu mejor equipo de 5 para un jefe y fase, elegido entre tus Invokers con la tier list oficial de ese jefe, tu inversión en cada uno, la ventaja de elemento, las tolerancias a sus corrupciones y la precisión que pide la guía. Nexo no estima probabilidades de victoria: te dice qué equipo encaja mejor con los datos y qué le falta.</p>
    <div className="panel tf-controls">
      <div className="filter-grid">
        <label className="select"><span>Jefe</span><select value={boss.slug} onChange={e => { setBossSlug(e.target.value); setStageNum(0); setExclude(new Set()); save({ boss: e.target.value, stage: 0 }) }}>
          {[...new Set(bosses.data!.bosses.map(b => b.category))].map(cat => <optgroup key={cat} label={BOSS_CATEGORY[cat] ?? cat}>{bosses.data!.bosses.filter(b => b.category === cat).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}</optgroup>)}</select></label>
        <label className="select"><span>Fase</span><select value={stage.stage} onChange={e => { setStageNum(Number(e.target.value)); save({ stage: Number(e.target.value) }) }}>
          {boss.stages.map(s => <option key={s.stage} value={s.stage}>Fase {s.stage}{record && s.stage <= record.highestLevel ? ' · superada' : ''}</option>)}</select></label>
      </div>
      <dl className="stat-strip">
        <div><dt>Elemento</dt><dd>{t(ELEMENT_LABEL, stage.element)}</dd></div><div><dt>RES</dt><dd>{stage.res}</dd></div>
        <div><dt>Obj. PREC</dt><dd>{stage.accGoal}</dd></div><div><dt>Obj. RES</dt><dd>{stage.resGoal}</dd></div>
        <div><dt>Corrupciones</dt><dd>{boss.corruptions.map(c => TOL_LABEL[c.key] ?? c.key).join(', ') || '—'}</dd></div>
      </dl>
      <div className="chip-row">
        <label className="check"><input type="checkbox" checked={needTank} onChange={e => setNeedTank(e.target.checked)} /> Exigir un tanque</label>
        <label className="check"><input type="checkbox" checked={needSustain} onChange={e => setNeedSustain(e.target.checked)} /> Exigir curación o escudos</label>
        {exclude.size > 0 && <button className="btn small" onClick={() => setExclude(new Set())}><RotateCcw size={14} /> Recuperar {exclude.size} descartado{exclude.size > 1 ? 's' : ''}</button>}
      </div>
    </div>

    <div className="panel">
      <div className="panel-title"><h2>Equipo recomendado · {boss.name} fase {stage.stage}</h2>
        <button className="btn small primary" onClick={toGoal}><Target size={14} /> Optimizar su equipamiento en Objetivo</button></div>
      {result.record && <p className="muted">{result.overlap} de 5 coinciden con tu equipo del récord (fase {result.record.highest}).</p>}
      <div className="tf-team">{result.picks.map(p => <article key={p.hero.id} className="tf-member">
        <GameCard c={p.hero} level={p.hero.level} rank={p.hero.rank} power={fmtPower(p.hero)} onClick={() => go(`/invoker/${p.hero.id}`)}
          corner={p.tier ? <span className={`tier-tag t-${p.tier.tier.replace('+', 'p')}`}>{p.tier.tier}</span> : undefined} label={`${p.hero.name}, ${roleLabel(p.role)}`}>
          <span className="tag">{roleLabel(p.role)}</span>
        </GameCard>
        {p.titan && <p className="tf-titan"><GameImg path={p.titan.titan.portrait} alt="" className="mini-icon" /> <b>{p.titan.titan.name}</b>{p.titan.tier && <span className={`tier-tag t-${p.titan.tier.replace('+', 'p')}`}>{p.titan.tier}</span>}<small>{p.titan.why}</small></p>}
        <ul className="tf-why">{p.reasons.map(r => <li key={r} className="ok"><Check size={13} aria-hidden /> {r}</li>)}{p.warnings.map(w => <li key={w} className="warn"><AlertTriangle size={13} aria-hidden /> {w}</li>)}</ul>
        <div className="tf-alt">
          {p.alternatives.length > 0 && <small className="muted">Alternativas: {p.alternatives.map(a => `${a.hero.name}${a.tier ? ` (${a.tier.tier})` : ''}`).join(', ')}</small>}
          <button className="btn small" onClick={() => swap(p)} aria-label={`Descartar a ${p.hero.name} y buscar otro`}><X size={13} /> Descartar</button>
        </div>
      </article>)}</div>
    </div>

    <div className="panel">
      <h2>Qué pide {boss.name} a tus habilidades</h2>
      <p className="muted">Deducido de las habilidades publicadas en la guía oficial y cruzado con los efectos de las habilidades de tus Invokers.</p>
      <ul className="needs">{needs.map(n => { const c = result.needs.find(x => x.need.id === n.id)
        return <li key={n.id} className={n.avoid ? 'avoid' : c?.coveredBy.length ? 'ok' : 'miss'}>
          <b>{n.avoid ? <AlertTriangle size={14} aria-hidden /> : c?.coveredBy.length ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />} {n.label}</b>
          <span className="muted">{n.why}</span>
          {!n.avoid && <span>{c?.coveredBy.length ? <>En el equipo: {c.coveredBy.map(h => h.name).join(', ')}</> : c?.options.length ? <>Nadie del equipo. En tu caja: {c.options.map(h => h.name).join(', ')}</> : 'Nadie en tu caja lo aporta.'}</span>}
          {n.avoid && <span>{result.picks.filter(p => p.fit.avoided.includes(n)).map(p => p.hero.name).join(', ') || 'Nadie del equipo lo usa.'}</span>}
        </li> })}</ul>
      {result.bySkill.length > 0 && <>
        <h3>Tus mejores por habilidades contra {boss.name}</h3>
        <div className="mini-roster">{result.bySkill.map(c => <button key={c.hero.id} className="mini-card" onClick={() => go(`/invoker/${c.hero.id}`)} title={c.fit.matched.map(n => n.label).join(' · ')}>
          <span className={`portrait sm r-${c.hero.rarity.toLowerCase()}`}><GameImg path={c.hero.portrait} alt={c.hero.name} className="portrait-img" /></span>
          {c.tier && <span className={`tier-tag t-${c.tier.tier.replace('+', 'p')}`}>{c.tier.tier}</span>}
          <small>{c.hero.name}</small><small className="muted">{c.fit.matched.length} de {needs.filter(n => !n.avoid).length}</small>
        </button>)}</div>
      </>}
    </div>

    <div className="panel">
      <h2>Lo que le falta</h2>
      {result.gaps.length === 0 ? <p className="ok-line"><Check size={15} /> Cumple todos los objetivos publicados de la guía para esta fase.</p>
        : <ul className="dashes">{result.gaps.map(g => <li key={g}>{g}</li>)}</ul>}
      {boss.corruptions.length > 0 && <p className="muted">Piezas libres para tolerancia: {boss.corruptions.map(c => { const set = c.key === 'Bloodrot' ? 'BloodRotTolerance' : c.key === 'Mindfog' ? 'MindFogTolerance' : c.key === 'Manaburn' ? 'ManaBurnTolerance' : `${c.key}Tolerance`; const n = box.relics.filter(g => g.set === set && g.equippedHeroId === null).length; return `${n} del conjunto ${TOL_LABEL[c.key] ?? c.key}` }).join(' · ')} (con 3 piezas se activa la tolerancia del conjunto).</p>}
      <p className="muted">Arréglalo en Objetivo (exigir PREC o tolerancia en el plan) o en Asesor › Tolerancias. <a href={boss.guide} target="_blank" rel="noreferrer">Guía oficial de {boss.name} <ExternalLink size={11} /></a></p>
    </div>

    <details className="panel">
      <summary>Cómo elige Nexo</summary>
      <ul className="dashes">
        <li>Una copia por personaje (la de más poder), entre {result.pool} personajes de tu caja{exclude.size ? `, sin los ${exclude.size} descartados` : ''}.</li>
        <li>Puntuación = {Math.round(100 * DEFAULT_WEIGHTS.official)} % nota oficial en {boss.name} + {Math.round(100 * DEFAULT_WEIGHTS.power)} % poder relativo ({fmtInt(Math.max(...box.heroes.map(h => h.power)))} = 100 %), × {1 + DEFAULT_WEIGHTS.element} con ventaja de elemento o × {1 - DEFAULT_WEIGHTS.element} con desventaja, hasta −{Math.round(100 * DEFAULT_WEIGHTS.tolerance)} % sin la tolerancia de la guía y −{Math.round(100 * DEFAULT_WEIGHTS.accuracy)} % si sus perjuicios necesitan PREC y no la tiene. Por habilidades: +{Math.round(100 * DEFAULT_WEIGHTS.skill)} % por cada necesidad del jefe que cubre (hasta 3) y −{Math.round(100 * DEFAULT_WEIGHTS.avoid)} % si usa un efecto contraindicado. Estos pesos son de Nexo, no oficiales.</li>
        <li>Si lo marcas, primero entra el mejor tanque y el mejor con curación o escudos; después, los de mayor puntuación.</li>
        <li>Titanes: los de mejor nota en la tier list oficial de Titanes, cada uno con el miembro que más aprovecha su bonificación vinculada.</li>
        <li>Rol: clase oficial y kit de habilidades (curación y escudos salen de las fórmulas de sus habilidades). Sin kit conocido, solo la clase.</li>
      </ul>
      <button className="link" onClick={() => go(`/wiki/jefes/${boss.slug}`)}>Ver la tier list completa de {boss.name} <ArrowRight size={14} /></button>
    </details>
  </section>
}
