import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ArrowRightLeft, Check, ExternalLink, RotateCcw, Target, X } from 'lucide-react'
import { useAccount } from './account'
import { GameCard, GameImg } from './Art'
import { ELEMENT_LABEL, fmtInt, t } from '../box/i18n'
import { loadBosses } from '../box/goal'
import { loadKits, profileOf, skillLevels, type Profile } from '../box/combat'
import { DEFAULT_WEIGHTS, recommendTeam, roleLabel, type Candidate, type TeamPick } from '../box/recommend'
import { loadIndex, loadTiers, loadTools, useLoad } from '../wiki/data'
import { deriveNeeds, type HeroSkills } from '../box/bossNeeds'
import { BOSS_CATEGORY, TOL_LABEL } from '../wiki/labels'
import { fmtPower } from './common'

const STORE = 'nexo.teamfinder'
const read = (): { boss?: string; stage?: number } => { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') } catch { return {} } }
const LOW = new Set(['C', 'D', 'E'])
const tierClass = (tier: string) => `tier-tag t-${tier.replace('+', 'p')}`
const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(100 * x))} %`

/** Asesor · Equipo para un jefe: tus 5 mejores Invokers y Titanes para un jefe y fase, lo que le falta y cómo cubrirlo. */
export function TeamFinder() {
  const { account, go } = useAccount()
  const bosses = useLoad(loadBosses), kits = useLoad(loadKits), tiers = useLoad(loadTiers), tools = useLoad(loadTools), wiki = useLoad(loadIndex)
  const saved = read()
  const [bossSlug, setBossSlug] = useState(saved.boss ?? 'ulgorim')
  const [stageNum, setStageNum] = useState<number>(saved.stage ?? 0)
  const [needTank, setNeedTank] = useState(true), [needSustain, setNeedSustain] = useState(true)
  const [exclude, setExclude] = useState<Set<number>>(new Set())
  const [include, setInclude] = useState<number[]>([])
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
    return recommendTeam(box, boss, stage, profiles, { names: tools.data.elements, sign: tools.data.elementMatchupSign }, titanTier, { needTank, needSustain, exclude, include, skills: { needs, byCode } })
  }, [box, boss, stage, profiles, tools.data, kits.data, tiers.data, wiki.data, needs, byCode, needTank, needSustain, exclude, include])
  const save = (p: { boss?: string; stage?: number }) => { try { localStorage.setItem(STORE, JSON.stringify({ boss: bossSlug, stage: stage?.stage, ...p })) } catch { /* sin almacenamiento */ } }
  if (bosses.error || kits.error || tools.error || wiki.error) return <div className="state-card bad" role="alert"><AlertTriangle size={18} /> No se pudieron cargar los datos oficiales.</div>
  if (!boss || !stage || !result) return <div className="state-card" role="status">Cargando jefes, kits y tablas oficiales…</div>

  const reset = () => { setExclude(new Set()); setInclude([]) }
  const changed = exclude.size > 0 || include.length > 0
  const toGoal = () => {
    const key = `nexo.goal.${box.profile.name}`
    let prev = {}; try { prev = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* nada */ }
    try { localStorage.setItem(key, JSON.stringify({ ...prev, boss: boss.slug, stage: stage.stage, team: result.picks.map(p => p.hero.id) })) } catch { /* sin almacenamiento */ }
    go('/objetivo')
  }
  const discard = (p: TeamPick) => { setExclude(new Set([...exclude, p.hero.id])); setInclude(include.filter(id => id !== p.hero.id)) }
  const applySwap = (outId: number, inId: number) => { setExclude(new Set([...exclude, outId])); setInclude([...include.filter(id => id !== outId), inId]) }
  const activeNeeds = needs.filter(n => !n.avoid)
  const avoids = needs.filter(n => n.avoid)
  const uncovered = result.needs.filter(n => !n.coveredBy.length && n.need.id !== 'amplify')

  return <section className="advisor team-finder">
    <p className="lead">Elige un jefe y una fase: Nexo propone tus 5 mejores Invokers y te dice qué le falta al equipo y cómo cubrirlo. No estima probabilidades de victoria.</p>

    {/* 1 · Jefe y fase */}
    <div className="panel tf-controls">
      <div className="tf-pick">
        <label className="select"><span>Jefe</span><select value={boss.slug} onChange={e => { setBossSlug(e.target.value); setStageNum(0); reset(); save({ boss: e.target.value, stage: 0 }) }}>
          {[...new Set(bosses.data!.bosses.map(b => b.category))].map(cat => <optgroup key={cat} label={BOSS_CATEGORY[cat] ?? cat}>{bosses.data!.bosses.filter(b => b.category === cat).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}</optgroup>)}</select></label>
        <label className="select"><span>Fase</span><select value={stage.stage} onChange={e => { setStageNum(Number(e.target.value)); save({ stage: Number(e.target.value) }) }}>
          {boss.stages.map(s => <option key={s.stage} value={s.stage}>Fase {s.stage}{record && s.stage <= record.highestLevel ? ' · superada' : ''}</option>)}</select></label>
        <dl className="stat-strip">
          <div><dt>Elemento</dt><dd>{t(ELEMENT_LABEL, stage.element)}</dd></div>
          <div><dt>PREC objetivo</dt><dd>{stage.accGoal}</dd></div><div><dt>RES objetivo</dt><dd>{stage.resGoal}</dd></div>
          {boss.corruptions.length > 0 && <div><dt>Tolerancia</dt><dd>{stage.tolGoal} %</dd></div>}
        </dl>
      </div>
      <div className="chip-row">
        <label className="check"><input type="checkbox" checked={needTank} onChange={e => setNeedTank(e.target.checked)} /> Con tanque</label>
        <label className="check"><input type="checkbox" checked={needSustain} onChange={e => setNeedSustain(e.target.checked)} /> Con curación o escudos</label>
        {changed && <button className="btn small" onClick={reset}><RotateCcw size={14} /> Volver a la recomendación</button>}
      </div>
    </div>

    {/* 2 · Equipo */}
    <div className="panel">
      <div className="panel-title">
        <div><h2>Equipo recomendado</h2>
          <small className="muted">{boss.name} · fase {stage.stage}{result.record ? ` · ${result.overlap} de 5 coinciden con tu récord (fase ${result.record.highest})` : ''}{changed ? ' · con tus cambios' : ''}</small></div>
        <button className="btn small primary" onClick={toGoal}><Target size={14} /> Optimizar su equipamiento</button>
      </div>
      <div className="tf-team">{result.picks.map(p => <article key={p.hero.id} className={`tf-member ${include.includes(p.hero.id) ? 'swapped' : ''}`}>
        <GameCard c={p.hero} level={p.hero.level} rank={p.hero.rank} power={fmtPower(p.hero)} onClick={() => go(`/invoker/${p.hero.id}`)}
          corner={p.tier ? <span className={tierClass(p.tier.tier)}>{p.tier.tier}</span> : undefined} label={`${p.hero.name}, ${roleLabel(p.role)}`} />
        <span className="tf-role">{roleLabel(p.role)}{p.warnings.length > 0 && <span className="tf-warn" title={p.warnings.join(' · ')}><AlertTriangle size={12} aria-hidden /> {p.warnings.length}</span>}</span>
        {p.titan && <p className="tf-titan" title={p.titan.why}><GameImg path={p.titan.titan.portrait} alt="" className="mini-icon" /><b>{p.titan.titan.name}</b>{p.titan.tier && <span className={tierClass(p.titan.tier)}>{p.titan.tier}</span>}</p>}
        <details className="tf-detail"><summary>Por qué</summary>
          <ul className="tf-why">{p.reasons.map(r => <li key={r} className="ok"><Check size={13} aria-hidden /> {r}</li>)}{p.warnings.map(w => <li key={w} className="warn"><AlertTriangle size={13} aria-hidden /> {w}</li>)}</ul>
          {p.titan && <p className="muted tf-small">Titán: {p.titan.why}.</p>}
          {p.alternatives.length > 0 && <p className="muted tf-small">Alternativas del mismo rol: {p.alternatives.map(a => `${a.hero.name}${a.tier ? ` (${a.tier.tier})` : ''}`).join(', ')}.</p>}
          <button className="btn small" onClick={() => discard(p)}><X size={13} /> Descartar y buscar otro</button>
        </details>
      </article>)}</div>
    </div>

    {/* 3 · Qué le falta */}
    <div className="panel">
      <h2>Qué le falta</h2>
      <div className="tf-cols">
        <div>
          <h3>Estadísticas frente a la guía</h3>
          {result.gaps.length === 0 ? <p className="ok-line"><Check size={15} /> Cumple los objetivos publicados para esta fase.</p>
            : <ul className="tf-list">{result.gaps.map(g => <li key={g} className="warn"><AlertTriangle size={13} aria-hidden /> {g}</li>)}</ul>}
          {boss.corruptions.length > 0 && <p className="muted tf-small">Piezas libres: {boss.corruptions.map(c => { const set = c.key === 'Bloodrot' ? 'BloodRotTolerance' : c.key === 'Mindfog' ? 'MindFogTolerance' : c.key === 'Manaburn' ? 'ManaBurnTolerance' : `${c.key}Tolerance`; return `${box.relics.filter(g => g.set === set && g.equippedHeroId === null).length} de ${TOL_LABEL[c.key] ?? c.key}` }).join(' · ')}. Con 3 piezas del conjunto se activa su tolerancia; Objetivo puede exigirla en el plan.</p>}
        </div>
        <div>
          <h3>Habilidades que pide {boss.name}</h3>
          <ul className="tf-list">{result.needs.map(n => <li key={n.need.id} className={n.coveredBy.length ? 'ok' : 'warn'} title={n.need.why}>
            {n.coveredBy.length ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
            <span><b>{n.need.label}</b> <span className="muted">— {n.coveredBy.length ? n.coveredBy.map(h => h.name).join(', ') : 'nadie del equipo'}</span><small className="muted">{n.need.why}</small></span>
          </li>)}
          {avoids.map(n => { const who = result.picks.filter(p => p.fit.avoided.includes(n)).map(p => p.hero.name)
            return <li key={n.id} className={who.length ? 'bad' : 'ok'}>{who.length ? <AlertTriangle size={13} aria-hidden /> : <Check size={13} aria-hidden />}<span><b>{n.label}</b> <span className="muted">— {who.length ? who.join(', ') : 'nadie del equipo lo usa'}</span><small className="muted">{n.why}</small></span></li> })}</ul>
        </div>
      </div>
    </div>

    {/* 4 · Cambios que cubren lo que falta */}
    {uncovered.length > 0 && <div className="panel">
      <h2>Cambios que cubren lo que falta</h2>
      {result.swaps.length === 0 ? <p className="muted">Nadie de tu caja cubre {uncovered.map(n => n.need.label.toLowerCase()).join(' ni ')} sin dejar al equipo sin tanque, curación u otra habilidad que solo aporta quien saldría.</p> :
        <div className="tf-swaps">{result.swaps.map(s => <div key={`${s.out.hero.id}-${s.in.hero.id}`} className="tf-swap">
          <div className="tf-swap-who">
            <SwapHero c={s.out} />
            <ArrowRightLeft size={18} aria-hidden className="muted" />
            <SwapHero c={s.in} />
          </div>
          <ul className="tf-list">
            <li className="ok"><Check size={13} aria-hidden /><span>Ganas: {s.gains.map(n => n.label.toLowerCase()).join(', ')}</span></li>
            <li className={s.delta < 0 ? 'warn' : 'ok'}>{s.delta < 0 ? <AlertTriangle size={13} aria-hidden /> : <Check size={13} aria-hidden />}
              <span>Puntuación del equipo {pct(s.pct)}{s.delta < 0 ? `: ${s.in.hero.name} tiene ${s.in.tier ? `nota ${s.in.tier.tier}` : 'sin nota'} y ${fmtInt(s.in.hero.power)} de poder frente a ${s.out.tier ? `${s.out.tier.tier}` : 'sin nota'} y ${fmtInt(s.out.hero.power)}` : ''}</span></li>
          </ul>
          <button className="btn small" onClick={() => applySwap(s.out.hero.id, s.in.hero.id)}>Probar este cambio</button>
        </div>)}</div>}
      <p className="muted tf-small">Nexo no sabe si el cambio gana más combates: muestra qué cubre y qué cuesta según la nota oficial y tu inversión. Decides tú.</p>
    </div>}

    {/* 5 · Tus mejores por habilidades */}
    {result.bySkill.length > 0 && <div className="panel">
      <h2>Tus mejores por habilidades contra {boss.name}</h2>
      <p className="muted tf-small">Ordenados por la puntuación completa (nota oficial, inversión y habilidades). Atenuados: nota baja en {boss.name}, aunque sus habilidades encajen.</p>
      <div className="mini-roster">{result.bySkill.map(c => { const low = !c.tier || LOW.has(c.tier.tier)
        return <button key={c.hero.id} className={`mini-card ${low ? 'missing' : ''}`} onClick={() => go(`/invoker/${c.hero.id}`)} title={`${c.fit.matched.map(n => n.label).join(' · ')}${low ? ' · nota baja en este jefe' : ''}`}>
          <span className={`portrait sm r-${c.hero.rarity.toLowerCase()}`}><GameImg path={c.hero.portrait} alt={c.hero.name} className="portrait-img" /></span>
          {c.tier && <span className={tierClass(c.tier.tier)}>{c.tier.tier}</span>}
          <small>{c.hero.name}</small><small className="muted">{c.fit.matched.length} de {activeNeeds.length}</small>
        </button> })}</div>
    </div>}

    <details className="panel">
      <summary>Cómo elige Nexo</summary>
      <ul className="dashes">
        <li>Una copia por personaje (la de más poder), entre {result.pool} personajes de tu caja{exclude.size ? `, sin los ${exclude.size} descartados` : ''}.</li>
        <li>Puntuación = {Math.round(100 * DEFAULT_WEIGHTS.official)} % nota oficial en {boss.name} + {Math.round(100 * DEFAULT_WEIGHTS.power)} % poder relativo ({fmtInt(Math.max(...box.heroes.map(h => h.power)))} = 100 %); × {1 + DEFAULT_WEIGHTS.element} con ventaja de elemento o × {1 - DEFAULT_WEIGHTS.element} con desventaja; hasta −{Math.round(100 * DEFAULT_WEIGHTS.tolerance)} % sin la tolerancia de la guía; −{Math.round(100 * DEFAULT_WEIGHTS.accuracy)} % si sus perjuicios necesitan PREC y no la tiene; +{Math.round(100 * DEFAULT_WEIGHTS.skill)} % por cada habilidad que pide el jefe (hasta 3) y −{Math.round(100 * DEFAULT_WEIGHTS.avoid)} % si usa un efecto contraindicado. Pesos de Nexo, no oficiales.</li>
        <li>La tier list oficial de cada jefe sale de millones de combates y ya refleja cómo rinden las habilidades: por eso pesa más que el análisis de habilidades.</li>
        <li>Habilidades que pide el jefe: deducidas de sus habilidades en la guía oficial y cruzadas con los efectos de las fichas oficiales de tus Invokers.</li>
        <li>Titanes: los de mejor nota en la tier list oficial de Titanes, cada uno con el miembro que más aprovecha su bonificación vinculada.</li>
      </ul>
      <p><a href={boss.guide} target="_blank" rel="noreferrer">Guía oficial de {boss.name} <ExternalLink size={11} /></a> · <button className="link" onClick={() => go(`/wiki/jefes/${boss.slug}`)}>Tier list completa <ArrowRight size={14} /></button></p>
    </details>
  </section>
}

function SwapHero({ c }: { c: Candidate }) {
  return <span className="tf-swap-hero">
    <span className={`portrait sm r-${c.hero.rarity.toLowerCase()}`}><GameImg path={c.hero.portrait} alt="" className="portrait-img" /></span>
    <span><b>{c.hero.name}</b><small>{c.tier ? <span className={tierClass(c.tier.tier)}>{c.tier.tier}</span> : 'sin nota'} · {roleLabel(c.role)}</small></span>
  </span>
}
