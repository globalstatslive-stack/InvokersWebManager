import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ExternalLink, Info, ListPlus, Loader2, Plus, ShieldCheck, Target, X } from 'lucide-react'
import { useAccount } from './account'
import { NeedsAccount } from './common'
import { GearIcon, Portrait, Stars } from './Art'
import { ELEMENT_LABEL, fmtInt, MODE_LABEL, SLOT_LABEL, STAT_SHORT, t } from '../box/i18n'
import { diagnoseMember, loadBosses, toleranceKey, type Boss, type BossCatalog, type BossStage, type MemberDiagnosis, type TeamMember } from '../box/goal'
import { loadKits, profileOf, skillLevels, type Kit } from '../box/combat'
import { PRESETS, presetFor, type BuildResult, type Pool } from '../box/optimizer'
import { projectStats } from '../box/stats'
import type { Hero } from '../box/model'
import { useActiveTeams, teamKey } from './activeTeams'
import { entryFrom, reservedBy, usePlan } from './plan'
import { useTeamOptimizer } from './useOptimizer'
import type { TeamResult, TeamVariant } from '../box/optimize.worker'

type GoalState = { boss: string; stage: number; team: number[]; requireAcc: boolean; requireTol: boolean; pool: Pool; budget: string }
const VARIANTS: TeamVariant[] = [
  { id: 'min', label: 'Mínimo coste', changeCost: 12, joint: false },
  { id: 'balanced', label: 'Equilibrio', changeCost: 3, joint: true },
  { id: 'max', label: 'Máximo beneficio', changeCost: 0, joint: true },
]
const storeKey = (name: string) => `nexo.goal.${name}`
const loadGoal = (name: string): Partial<GoalState> => { try { return JSON.parse(localStorage.getItem(storeKey(name)) ?? '{}') } catch { return {} } }

function CheckRow({ c }: { c: MemberDiagnosis['checks'][number] }) {
  const v = c.unit === 'pct' ? `${Math.round(c.value)} %` : fmtInt(c.value), target = c.unit === 'pct' ? `${c.target} %` : fmtInt(c.target)
  return <li className={c.applies === 'unknown' ? 'unknown' : c.ok ? 'ok' : 'bad'} title={c.why}>
    {c.applies === 'unknown' ? <Info size={14} aria-hidden /> : c.ok ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
    <span>{c.label}</span><b>{v}</b><small>/ {target}</small>
    <span className="sr">{c.applies === 'unknown' ? 'sin datos' : c.ok ? 'cumple' : 'no cumple'}</span>
  </li>
}

export function Goal() {
  const { account, go } = useAccount()
  const [catalog, setCatalog] = useState<BossCatalog | null>(null)
  const [kits, setKits] = useState<Record<string, Kit> | null>(null)
  useEffect(() => { void loadBosses().then(setCatalog); void loadKits().then(setKits) }, [])
  if (!account) return <NeedsAccount />
  if (!catalog || !kits) return <div className="loading"><Loader2 className="spin" size={18} /> Cargando las guías oficiales de jefes…</div>
  return <GoalFlow catalog={catalog} kits={kits} go={go} />
}

function GoalFlow({ catalog, kits, go }: { catalog: BossCatalog; kits: Record<string, Kit>; go: (p: string) => void }) {
  const { account } = useAccount()
  const { box, index } = account!
  const saved = useMemo(() => loadGoal(box.profile.name), [box.profile.name])
  const [g, setG] = useState<GoalState>(() => ({ boss: 'ulgorim', stage: 0, team: [], requireAcc: true, requireTol: false, pool: 'unlocked', budget: '', ...saved }))
  const update = (p: Partial<GoalState>) => { const next = { ...g, ...p }; setG(next); try { localStorage.setItem(storeKey(box.profile.name), JSON.stringify(next)) } catch { /* sin almacenamiento */ } }
  const boss = catalog.bosses.find(b => b.slug === g.boss) ?? catalog.bosses[0]
  const record = box.teams.find(t => t.mode === 'dungeon' && t.key === boss.slug)
  const stageNum = g.stage || Math.min(boss.stages.length, (record?.highestLevel ?? 0) + 1) || 1
  const stage = boss.stages.find(s => s.stage === stageNum) ?? boss.stages[0]
  // Equipo: el elegido o, si no hay, el del récord de mejor tiempo de ese jefe.
  const defaultTeam = record?.levels[0]?.slots.map(s => s.heroId).filter(id => index.heroes.has(id)) ?? []
  const team = (g.team.length ? g.team : defaultTeam).map(id => index.heroes.get(id)).filter((h): h is Hero => !!h).slice(0, 5)
  const profiles = useMemo(() => new Map(team.map(h => [h.id, kits[h.code] ? profileOf(h, kits[h.code], skillLevels(h)) : null])), [team, kits])
  const diag = team.map(h => diagnoseMember(box, index, h, profiles.get(h.id) ?? null, boss, stage))
  const active = useActiveTeams(box)
  const { plan, upsert } = usePlan(box)
  const { state, run, cancel } = useTeamOptimizer(box)
  const [picked, setPicked] = useState('balanced')
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState('')
  const goalLabel = `${boss.name} · ${stage.label.replace('Stage', 'fase')}`
  const members = (): TeamMember[] => team.map(h => {
    const profile = profiles.get(h.id) ?? null, kit = kits[h.code]
    const minimums: Record<string, number> = {}
    if (g.requireAcc && profile?.needsAccuracy) minimums.accuracy = stage.accGoal
    if (g.requireTol) for (const c of boss.corruptions) minimums[toleranceKey(c.key)] = stage.tolGoal / 100
    const protectedHeroes = new Set([...active.heroes].filter(id => !team.some(m => m.id === id)))
    const reserved = reservedBy(plan.filter(e => !team.some(m => m.id === e.heroId)), -1)
    return { heroId: h.id, options: profile && kit && h.basis
      ? { objective: 'sim' as const, weights: { damage: 10 }, sim: { kit, levels: skillLevels(h), settings: { duration: 180, targetRes: stage.res }, mix: profile.mix }, pool: g.pool, minimums, protectedHeroes, reserved, moveAversion: 0.35 }
      : { objective: presetFor(h) === 'dps' ? 'damage' as const : 'weights' as const, weights: PRESETS.find(p => p.id === presetFor(h))!.weights, pool: g.pool, minimums, protectedHeroes, reserved, moveAversion: 0.35 } }
  })
  const budget = g.budget.trim() ? Number(g.budget.replace(/\D/g, '')) : null
  const canOptimize = team.length > 0 && team.every(h => h.basis && h.gearBonus)
  const results = state.status === 'done' ? state.result : null
  const chosen = results?.find(r => r.variant.id === picked) ?? results?.[0]
  const addToPlan = (r: TeamResult) => {
    const bad: string[] = []
    for (const b of r.plan.builds) {
      const hero = index.heroes.get(b.heroId)!
      if (!b.result.changes.length) continue
      if (!b.result.feasible || !b.result.minimumsMet) { bad.push(`${hero.name}: no cumple las restricciones`); continue }
      const c = upsert(entryFrom(hero, b.result, goalLabel))
      if (c.length) bad.push(`${hero.name}: ${c.length} piezas ya están en tu plan para otro Invoker`)
    }
    setAdding(bad.length ? `Añadido con avisos: ${bad.join('; ')}.` : 'Añadido a tu plan.')
  }
  return <div className="goal">
    <header className="goal-head">
      <Target size={20} aria-hidden /><div><h1>Objetivo</h1><p>Elige qué quieres superar. Descubre qué cambiar, cuánto cuesta y cómo afecta a tus otros equipos.</p></div>
    </header>

    <section className="panel step">
      <h2><span className="num">1</span> Qué quieres superar</h2>
      <div className="row2">
        <label className="select"><span>Jefe</span><select value={boss.slug} onChange={e => update({ boss: e.target.value, stage: 0, team: [] })}>{catalog.bosses.map(b => <option key={b.slug} value={b.slug}>{b.name} · {b.category}</option>)}</select></label>
        <label className="select"><span>Fase</span><select value={stage.stage} onChange={e => update({ stage: Number(e.target.value) })}>{boss.stages.map(s => <option key={s.stage} value={s.stage}>{s.label.replace('Stage', 'Fase')}{record && s.stage <= record.highestLevel ? ' · superada' : ''}</option>)}</select></label>
      </div>
      <div className="boss-card">
        <img src={`https://invokers.com${boss.portrait}`} alt="" className="boss-icon" loading="lazy" />
        <dl className="boss-stats">
          <div><dt>Elemento</dt><dd>{t(ELEMENT_LABEL, stage.element)}</dd></div><div><dt>PREC</dt><dd>{stage.acc}</dd></div><div><dt>RES</dt><dd>{stage.res}</dd></div>
          <div><dt>Tolerancia</dt><dd>{stage.tolerance > 0 ? '+' : ''}{stage.tolerance} %</dd></div><div><dt>Corrupciones</dt><dd>{boss.corruptions.map(c => c.key).join(', ') || '—'}</dd></div>
        </dl>
      </div>
      <p className="fine">Objetivos de la guía: PREC {stage.accGoal} para que entren tus perjuicios · RES {stage.resGoal} para resistir los suyos · tolerancia {stage.tolGoal} %. Fuente: <a href={boss.guide} target="_blank" rel="noreferrer">guía oficial de {boss.name} <ExternalLink size={11} /></a>, datos del {catalog.fetchedAt}. {record ? `Tu récord: fase ${record.highestLevel}.` : 'No hay récord tuyo de este jefe en la caja.'}</p>
    </section>

    <section className="panel step">
      <h2><span className="num">2</span> Equipo <small>{team.length}/5</small></h2>
      {!g.team.length && defaultTeam.length > 0 && <p className="fine">Propuesto a partir de tu récord de mejor tiempo contra {boss.name} (fase {record!.levels[0].level}). Es un registro histórico: cámbialo si ya no usas ese equipo.</p>}
      <ul className="team-pick">{team.map(h => <li key={h.id}>
        <Portrait c={h} size="sm" /><span className="row-main"><b>{h.name}</b><small><Stars n={h.rank} /> · {fmtInt(h.power)}</small></span>
        <button className="icon-btn" aria-label={`Quitar a ${h.name}`} onClick={() => update({ team: team.filter(x => x.id !== h.id).map(x => x.id) })}><X size={16} /></button>
      </li>)}
        {team.length < 5 && <li className="add"><Plus size={16} aria-hidden /><select aria-label="Añadir Invoker" value="" onChange={e => e.target.value && update({ team: [...team.map(x => x.id), Number(e.target.value)] })}>
          <option value="">Añadir Invoker…</option>
          {[...box.heroes].filter(h => !team.some(m => m.id === h.id)).sort((a, b) => (boss.tier[b.code]?.score ?? 0) - (boss.tier[a.code]?.score ?? 0) || b.power - a.power).slice(0, 80).map(h => <option key={h.id} value={h.id}>{h.name} · {h.rank}★ · {fmtInt(h.power)}{boss.tier[h.code] ? ` · ${boss.tier[h.code].tier}` : ''}</option>)}
        </select></li>}
      </ul>
      <details className="protect">
        <summary><ShieldCheck size={15} /> Equipos que sigues usando: {active.teams.length ? `${active.teams.length} protegidos` : 'ninguno marcado'}</summary>
        <p className="fine">Las piezas de sus Invokers no se tocan. Los récords del juego son históricos: marca solo los equipos que sigues usando.</p>
        <ul className="protect-list">{box.teams.map(tm => <li key={teamKey(tm)}><label className="check"><input type="checkbox" checked={active.isActive(tm)} onChange={() => active.toggle(tm)} /> {t(MODE_LABEL, tm.mode)} · {tm.label}{tm.detail ? ` (${tm.detail})` : ''}{tm.difficulty ? ` · ${tm.difficulty}` : ''}</label></li>)}</ul>
      </details>
    </section>

    {team.length > 0 && <section className="panel step">
      <h2><span className="num">3</span> Diagnóstico</h2>
      <div className="diag-grid">{diag.map(d => <article key={d.hero.id} className="diag">
        <header><Portrait c={d.hero} size="sm" /><span><b>{d.hero.name}</b><small>{d.tier ? `Lista oficial: ${d.tier.tier}${d.tier.score !== null ? ` (${d.tier.score.toFixed(2)})` : ''}` : 'Sin nota oficial'}</small></span></header>
        <ul className="checks">{d.checks.map(c => <CheckRow key={c.key} c={c} />)}</ul>
        {d.gear.length > 0 && <p className="fine warn-text">{d.gear.join(' · ')}</p>}
        {d.missingKit && <p className="fine">Sin ficha de habilidades: no se sabe si necesita precisión.</p>}
      </article>)}</div>
      <p className="fine">Solo se comparan tus estadísticas con los objetivos publicados por la guía. Nexo no calcula probabilidades de victoria.</p>
    </section>}

    {team.length > 0 && <section className="panel step">
      <h2><span className="num">4</span> Planes</h2>
      <div className="row2">
        <label className="check"><input type="checkbox" checked={g.requireAcc} onChange={e => update({ requireAcc: e.target.checked })} /> Exigir PREC {stage.accGoal} a quien necesita precisión</label>
        <label className="check"><input type="checkbox" checked={g.requireTol} onChange={e => update({ requireTol: e.target.checked })} /> Exigir tolerancia {stage.tolGoal} %</label>
      </div>
      <div className="row2">
        <label className="select"><span>Piezas que puede usar</span><select value={g.pool} onChange={e => update({ pool: e.target.value as Pool })}><option value="free">Solo libres</option><option value="unlocked">Libres y de Invokers no bloqueados</option><option value="all">Todas</option></select></label>
        <label className="select"><span>Oro disponible (opcional)</span><input inputMode="numeric" value={g.budget} onChange={e => update({ budget: e.target.value })} placeholder="La caja no incluye tu saldo" /></label>
      </div>
      {!canOptimize ? <p className="note warn"><AlertTriangle size={16} /> Algún Invoker no tiene estadísticas base (importa tu enlace) y no se puede optimizar.</p> :
        <div className="row-actions">
          {state.status === 'running' ? <><button className="btn" onClick={cancel}><X size={16} /> Cancelar</button><span className="muted"><Loader2 className="spin" size={15} /> {state.progress ? `Calculando «${state.progress.label}» (${state.progress.done + 1}/${state.progress.total})…` : 'Calculando…'}</span></>
            : <button className="btn primary" onClick={() => { setMessage(''); setAdding(''); run(members(), VARIANTS) }}><Target size={16} /> Calcular planes del equipo</button>}
        </div>}
      {state.status === 'error' && <p className="note warn">{state.message}</p>}
      {state.status === 'cancelled' && <p className="muted">Cálculo cancelado.</p>}
      {message && <p className="note">{message}</p>}
      {results && <PlanOptions results={results} picked={chosen?.variant.id ?? 'balanced'} setPicked={setPicked} budget={budget} stage={stage} boss={boss} />}
      {chosen && <TeamBuild r={chosen} activeHeroes={active.heroes} go={go} />}
      {chosen && <div className="row-actions sticky-actions">
        <button className="btn primary" onClick={() => addToPlan(chosen)}><ListPlus size={16} /> Añadir «{chosen.variant.label}» al plan</button>
        <button className="btn" onClick={() => go('/plan')}>Ver plan <ArrowRight size={15} /></button>
      </div>}
      {adding && <p className="note" role="status">{adding}</p>}
    </section>}
  </div>
}

function meets(r: BuildResult, stage: BossStage, boss: Boss) {
  const s = r.after
  return { acc: (s.accuracy ?? 0) >= stage.accGoal, res: (s.resistance ?? 0) >= stage.resGoal, tol: boss.corruptions.every(c => 100 * (s[toleranceKey(c.key)] ?? 0) >= stage.tolGoal) }
}
function PlanOptions({ results, picked, setPicked, budget, stage, boss }: { results: TeamResult[]; picked: string; setPicked: (v: string) => void; budget: number | null; stage: BossStage; boss: Boss }) {
  return <div className="plan-options" role="radiogroup" aria-label="Planes">{results.map(r => {
    const builds = r.plan.builds, gold = builds.reduce((s, b) => s + b.result.goldCost, 0), changes = builds.reduce((s, b) => s + b.result.changes.length, 0)
    const invalid = builds.filter(b => !b.result.feasible || !b.result.minimumsMet).length
    const gain = builds.map(b => b.result.index !== undefined ? b.result.index - 100 : (b.result.damageBefore ? 100 * (b.result.damageAfter / b.result.damageBefore - 1) : 0))
    const avg = gain.reduce((s, x) => s + x, 0) / Math.max(1, gain.length)
    const accOk = builds.filter(b => meets(b.result, stage, boss).acc).length
    const seqGain = r.variant.joint ? r.plan.total - r.sequential.total : 0
    return <button key={r.variant.id} role="radio" aria-checked={picked === r.variant.id} className={`plan-option ${picked === r.variant.id ? 'on' : ''}`} onClick={() => setPicked(r.variant.id)}>
      <b>{r.variant.label}</b>
      <span className="big">{avg >= 0 ? '+' : ''}{avg.toFixed(1)} %</span><small>mejora media del índice de cada Invoker</small>
      <span>{changes} cambios · {fmtInt(gold)} oro de desequipar</span>
      {budget !== null && <span className={gold <= budget ? 'up' : 'down'}>{gold <= budget ? 'Dentro de tu presupuesto' : `Supera tu presupuesto en ${fmtInt(gold - budget)}`}</span>}
      <span>PREC ≥ {stage.accGoal}: {accOk}/{builds.length}{Object.keys(r.limits).length ? ` · ${Object.keys(r.limits).length} con mínimos inalcanzables` : ''}</span>
      {invalid > 0 && <span className="down"><AlertTriangle size={13} /> {invalid} no cumple{invalid > 1 ? 'n' : ''} las restricciones</span>}
      {r.conflicts.length > 0 && <span className="down">{r.conflicts.length} piezas repetidas (no válido)</span>}
      {r.variant.joint && <small>Conjunta: {seqGain > 1e-6 ? `mejora a la secuencial en ${(100 * seqGain).toFixed(1)} pts` : 'igual que la secuencial'} ({r.plan.rounds} {r.plan.rounds === 1 ? "ronda" : "rondas"}; sin garantía de óptimo global)</small>}
    </button>
  })}</div>
}

function TeamBuild({ r, activeHeroes, go }: { r: TeamResult; activeHeroes: Set<number>; go: (p: string) => void }) {
  const { account } = useAccount()
  const { index } = account!
  return <div className="team-builds">{r.plan.builds.map(b => {
    const hero = index.heroes.get(b.heroId)!, res = b.result
    return <article key={b.heroId} className={`team-build ${!res.feasible || !res.minimumsMet ? 'invalid' : ''}`}>
      <header><Portrait c={hero} size="sm" /><span className="row-main"><b>{hero.name}</b><small>{res.index !== undefined ? `Índice ${res.index.toFixed(1)}` : `Daño/golpe ${res.damageBefore ? `${(100 * (res.damageAfter / res.damageBefore - 1)).toFixed(1)} %` : '—'}`} · {res.changes.length} cambios · {fmtInt(res.goldCost)} oro</small></span>
        <button className="btn small" onClick={() => go(`/optimizador/${hero.id}`)}>Ajustar</button></header>
      {(r.limits[b.heroId] ?? []).map(l => <p key={l.stat} className="note warn"><AlertTriangle size={15} /> {STAT_SHORT[l.stat] ?? l.stat} {l.stat.endsWith('Tolerance') ? `${Math.round(100 * l.target)} %` : fmtInt(l.target)} inalcanzable con tus piezas: como máximo {l.stat.endsWith('Tolerance') ? `${Math.round(100 * l.max)} %` : fmtInt(l.max)}. Se optimiza sin ese mínimo.</p>)}
      {(!res.feasible || !res.minimumsMet) && <p className="note warn"><AlertTriangle size={15} /> Sin solución válida: {[...res.problems, ...res.unmet.map(k => `no alcanza ${STAT_SHORT[k] ?? k}`)].join('; ')}.{!(r.limits[b.heroId] ?? []).length && res.unmet.length > 0 && ' Con todas tus piezas sí se alcanza, pero las necesarias ya las usan miembros con más prioridad o equipos protegidos: cambia el orden o desprotege un equipo.'}</p>}
      {res.changes.length === 0 ? <p className="muted">Sin cambios: su equipo actual ya es el mejor con estas opciones.</p> :
        <ul className="change-rows">{res.changes.map(c => {
          const donor = c.takenFrom
          const loss = donor && c.to ? (() => { const before = donor.stats, after = projectStats(donor, index.equipped(donor).filter(x => !(x.kind === c.to!.kind && x.id === c.to!.id)), index.rules); return ['attack', 'health', 'accuracy'].map(k => [k, (after[k] ?? 0) - (before[k] ?? 0)] as const).filter(([, d]) => Math.abs(d) >= 1) })() : []
          return <li key={c.slot}>
            <span className="slot">{t(SLOT_LABEL, c.slot)}</span>
            {c.from ? <GearIcon g={c.from} size="sm" /> : <span className="muted">vacío</span>}<ArrowRight size={14} aria-hidden />{c.to ? <GearIcon g={c.to} size="sm" /> : <span className="muted">quitar</span>}
            <small>{donor ? <>quita a <b>{donor.name}</b>{activeHeroes.has(donor.id) ? ' (equipo activo)' : ''}{loss.length ? `: ${loss.map(([k, d]) => `${STAT_SHORT[k]} ${Math.round(d)}`).join(', ')}` : ''}</> : c.to ? 'pieza libre' : ''}</small>
          </li>
        })}</ul>}
    </article>
  })}</div>
}
