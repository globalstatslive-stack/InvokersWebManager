import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Check, ChevronDown, Clock, Crosshair, FlaskConical, Gem, History, Info, Loader2, Plus, Shield, Sparkles, Star, Swords, Target, TriangleAlert, Trophy, Users, Zap } from 'lucide-react'
import { CONFIDENCE_WEIGHT, AVAILABILITY_WEIGHT, GOLD_SCALE, GOAL_BONUS, UNQUANTIFIED_CAP, type ActionKind, type Availability, type CoachAction, type CoachPlan, type Objective } from '../box/coachEngine'
import { progressBetween } from '../box/progress'
import { accountStatsDelta } from '../box/accountStats'
import { fmtInt, STAT_LABEL } from '../box/i18n'
import { useAccount } from './account'
import { usePlan } from './plan'
import { Portrait } from './Art'
import { entryFromAction, useCoachPlan } from './useCoachPlan'
import { accountStatsOf, forget, useReview } from './coachMemory'
import { CoachNow, Fronts, UrgentNotices } from './CoachNow'
import { ProspectCard } from './ProspectCard'

const KIND: Record<ActionKind, { icon: typeof Gem; label: string }> = {
  gear: { icon: Gem, label: 'Piezas' }, trapped: { icon: Gem, label: 'Piezas desaprovechadas' }, upgrade: { icon: Gem, label: 'Subir pieza' },
  skill: { icon: Zap, label: 'Habilidad' }, tolerance: { icon: Shield, label: 'Tolerancia' }, titan: { icon: Sparkles, label: 'Titán' },
  slot: { icon: Star, label: 'Despertar' }, awaken: { icon: Star, label: 'Despertar' }, ascend: { icon: Star, label: 'Ascensión' }, hall: { icon: Trophy, label: 'Sala de trofeos' },
}
const AVAIL: Record<Availability, string> = { now: 'Ya disponible', resources: 'Requiere recursos', info: 'Falta información' }
const CONF_ES = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' } as const
const impactText = (a: CoachAction) => a.impact === null ? 'sin cifra' : `${a.impact >= 0.05 ? '+' : ''}${a.impact < 0.1 ? a.impact.toFixed(2) : a.impact.toFixed(1)} pts`.replace('.', ',')
const fmtTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '—'

function Chips({ a }: { a: CoachAction }) {
  return <span className="ch-chips">
    {a.significant && (a.kind === 'skill' || a.kind === 'tolerance' || a.kind === 'trapped') && <span className="ch-chip big">{a.kind === 'trapped' ? 'Pieza desaprovechada' : 'Cambio importante'}</span>}
    <span className={`ch-chip av-${a.availability}`}>{AVAIL[a.availability]}</span>
    <span className={`ch-chip conf-${a.confidence}`} title={a.confidenceWhy}>{CONF_ES[a.confidence]}</span>
    <span className="ch-chip cost">{a.cost.text}</span>
  </span>
}

/** Botón «Añadir al plan» para los cambios de piezas. */
function AddToPlan({ a, objective }: { a: CoachAction; objective: Objective }) {
  const { account, go } = useAccount()
  const { plan, upsert } = usePlan(account?.box)
  const [msg, setMsg] = useState<string | null>(null)
  if (!account || !a.plan?.length || !a.hero) return null
  const inPlan = a.plan.every(c => { const e = plan.find(x => x.heroId === c.heroId); return (c.kind === 'relic' ? e?.relics : e?.accessories)?.[c.slot] === c.gearId })
  if (inPlan) return <><button className="btn small" onClick={() => go('/plan')}><Check size={15} /> En tu plan · abrir</button>{msg && <small className="ch-msg" role="status">{msg}</small>}</>
  const add = () => {
    const e = entryFromAction(account.index, a.hero!, a, plan.find(x => x.heroId === a.hero!.id), objective.label)
    if (!e) return
    const conflicts = upsert(e)
    setMsg(conflicts.length ? `No se ha añadido: ${conflicts.join('; ')}` : 'Añadido al plan. Envíalo al optimizador oficial desde Plan.')
  }
  return <><button className="btn primary small" onClick={add}><Plus size={15} /> Añadir al plan</button>{msg && <small className="ch-msg" role="status">{msg}</small>}</>
}

function Why({ a }: { a: CoachAction }) {
  return <ul className="ch-why">{a.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
}
function Details({ a, max = 12 }: { a: CoachAction; max?: number }) {
  const [all, setAll] = useState(false)
  if (!a.details.length) return null
  const list = all ? a.details : a.details.slice(0, max)
  return <><dl className="ch-details">{list.map((d, i) => <div key={i} className={d.good === false ? 'worse' : ''}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}</dl>
    {a.details.length > list.length && <button className="link" onClick={() => setAll(true)}>Ver {a.details.length - list.length} más</button>}</>
}

/** El siguiente paso: qué mejorar, por qué es lo más importante y qué necesitas. */
function NextStep({ plan }: { plan: CoachPlan }) {
  const a = plan.actions[0]
  const [open, setOpen] = useState<'how' | 'alt' | null>(null)
  if (!a) return <section className="panel step-card empty"><h2>No hay nada que mejorar con lo que tienes para este objetivo</h2><p className="fine">Prueba otro objetivo o importa una caja más reciente.</p></section>
  const Icon = KIND[a.kind].icon
  const second = plan.actions[1]
  const seen = new Set(plan.alternatives.map(x => x.id))
  const others = (Object.values(plan.byKind) as CoachAction[]).filter(x => x && x !== a && !seen.has(x.id) && x.kind !== a.kind && !(a.kind === 'trapped' && x.kind === 'gear') && !(a.kind === 'gear' && x.kind === 'trapped')).slice(0, 4)
  return <section className="panel step-card">
    <div className="nc-kicker"><Target size={15} /> Tu siguiente paso · {plan.objective.label}</div>
    <div className="nc-head">
      {a.hero ? <Portrait c={a.hero} size="md" /> : <span className="nc-icon"><Icon size={26} /></span>}
      <h2>{a.title}</h2>
    </div>
    <div className="nc-q"><h3><Crosshair size={16} /> ¿Qué mejoro?</h3><p className="nc-effect">{a.effect}</p><Details a={a} max={4} /></div>
    <div className="nc-q"><h3><Info size={16} /> ¿Por qué es lo más importante?</h3><Why a={a} />
      <p className="fine">{second ? <>Es la acción con más puntuación para «{plan.objective.label}» ({a.score.toFixed(2).replace('.', ',')}); la siguiente, «{second.title}», tiene {second.score.toFixed(2).replace('.', ',')}.</> : 'Es la única mejora encontrada para este objetivo.'} <span className="nc-conf">{a.confidenceWhy}</span></p></div>
    <div className="nc-q"><h3><Clock size={16} /> ¿Qué necesito?</h3><p>{a.needs}</p><Chips a={a} /></div>
    <div className="nc-actions">
      <AddToPlan a={a} objective={plan.objective} />
      <button className="btn small" aria-expanded={open === 'how'} onClick={() => setOpen(open === 'how' ? null : 'how')}><BookOpen size={15} /> Cómo hacerlo</button>
      {(plan.alternatives.length > 0 || others.length > 0) && <button className="btn small" aria-expanded={open === 'alt'} onClick={() => setOpen(open === 'alt' ? null : 'alt')}><Users size={15} /> Alternativas comparadas</button>}
    </div>
    {open === 'how' && <ol className="nc-how">{a.how.map((h, i) => <li key={i}>{h}</li>)}</ol>}
    {open === 'alt' && <div className="nc-alt">
      {plan.alternatives.length > 0 && <><h4>Otras opciones para {a.hero?.name}</h4><AltList list={plan.alternatives} /></>}
      {others.length > 0 && <><h4>Otras inversiones de la cuenta</h4><AltList list={others} /></>}
      <p className="fine">Se comparan con la misma puntuación: impacto en el objetivo × confianza × disponibilidad × coste.</p>
    </div>}
  </section>
}
function AltList({ list }: { list: CoachAction[] }) {
  return <ul className="alt-list">{list.map(x => { const I = KIND[x.kind].icon; return <li key={x.id}><I size={15} /><span className="row-main"><b>{x.title}</b><small>{x.effect}</small></span><span className="alt-score">{impactText(x)}<small>{AVAIL[x.availability]}</small></span></li> })}</ul>
}

/** Resto de prioridades con filtro por disponibilidad. */
function Priorities({ plan }: { plan: CoachPlan }) {
  const [f, setF] = useState<'all' | Availability>('all')
  const [open, setOpen] = useState<string | null>(null)
  const rest = plan.actions.slice(1)
  const count = (k: Availability) => rest.filter(a => a.availability === k).length
  const list = rest.filter(a => f === 'all' || a.availability === f).slice(0, 12)
  if (!rest.length) return null
  return <section className="panel priorities">
    <div className="panel-title"><h2>Después, por prioridad</h2><small>{rest.length} acciones para «{plan.objective.label}»</small></div>
    <div className="chips-row" role="group" aria-label="Filtrar por disponibilidad">
      {(['all', 'now', 'resources', 'info'] as const).map(k => <button key={k} className={`chip ${f === k ? 'on' : ''}`} aria-pressed={f === k} onClick={() => setF(k)}>{k === 'all' ? `Todas · ${rest.length}` : `${AVAIL[k]} · ${count(k)}`}</button>)}
    </div>
    <ol className="prio-list">{list.map(a => {
      const I = KIND[a.kind].icon, isOpen = open === a.id
      return <li key={a.id} className={`prio av-${a.availability}`}>
        <button className="prio-main" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.id)}>
          <span className="prio-n">{plan.actions.indexOf(a) + 1}</span>
          <span className="prio-ic"><I size={17} /></span>
          <span className="row-main"><b>{a.title}</b><small>{a.effect}</small></span>
          <ChevronDown size={16} className={isOpen ? 'flip' : ''} />
        </button>
        {isOpen && <div className="prio-body"><Why a={a} /><Details a={a} /><p><b>Necesitas:</b> {a.needs}</p><Chips a={a} />
          <ul className="ch-how">{a.how.map((h, i) => <li key={i}>{h}</li>)}</ul>
          <div className="row-actions"><AddToPlan a={a} objective={plan.objective} /></div></div>}
      </li>
    })}</ol>
  </section>
}

function ObjectiveBar({ options, value, onChange, objective }: { options: ReturnType<typeof useCoachPlan>['options']; value: string; onChange: (id: string) => void; objective: Objective | null }) {
  const groups = [...new Set(options.map(o => o.group))]
  return <section className="panel obj-bar">
    <label className="obj-select"><span><Target size={15} /> Tu objetivo</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {groups.map(g => <optgroup key={g} label={g}>{options.filter(o => o.group === g).map(o => <option key={o.id} value={o.id}>{o.label} — {o.detail}</option>)}</optgroup>)}
      </select>
    </label>
    {objective && <div className="obj-meta">
      <div className="obj-team">{objective.team.slice(0, 6).map(h => <Portrait key={h.id} c={h} size="sm" />)}{objective.team.length > 6 && <span className="obj-more">+{objective.team.length - 6}</span>}</div>
      <small>{objective.teamSource}.{objective.record ? ` Récord en la fase ${objective.record.level}: ${fmtInt(objective.record.victories)} victorias, ${fmtInt(objective.record.defeats)} derrotas, mejor tiempo ${fmtTime(objective.record.bestTime)}.` : ''}{objective.stage ? ` Fase: RES ${objective.stage.res}${objective.stage.accGoal ? `, objetivo de PREC ${objective.stage.accGoal}` : ''}${objective.stage.tolGoal ? `, tolerancia ${objective.stage.tolGoal} %` : ''} (${objective.stage.source}).` : ''}</small>
    </div>}
  </section>
}

/** Lo que ha cambiado desde la importación anterior: cuenta, combates y recomendaciones. */
function SinceLast() {
  const { account, previous } = useAccount()
  const [v, setV] = useState(0)
  const reviewed = useReview(account?.box.profile.name, account?.record.id, account?.box, v)
  const progress = useMemo(() => account && previous ? progressBetween(previous.box, account.box) : null, [account, previous])
  const stats = account ? accountStatsOf(account.box.profile.name) : []
  const sd = stats.length >= 2 ? accountStatsDelta(stats[stats.length - 2], stats[stats.length - 1]) : null
  if (!account) return null
  const applied = reviewed.filter(r => r.applied === true), pending = reviewed.filter(r => r.applied === false)
  if (!progress && !reviewed.length && !stats.length) return null
  // (Account Stats llega con el marcador sobre tu caja en vivo.)
  return <section className="panel since-last">
    <div className="panel-title"><h2><History size={18} /> Desde tu última importación</h2>{previous && <small>{new Date(previous.record.importedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} → {new Date(account.record.importedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small>}</div>
    {previous && previous.box.snapshotAt && previous.box.snapshotAt === account.box.snapshotAt && <p className="fine sl-same"><Info size={13} /> Es la misma instantánea que la importación anterior: pulsa «Refresh link» en invokers.com (o usa el marcador) y vuelve a importar para ver cambios.</p>}
    {progress && <div className="sl-grid">
      <div className="sl-block"><h3><Swords size={16} /> En combate (récords de la caja)</h3>
        {progress.battles === 0 && !progress.highest.length ? <p className="fine">Sin combates nuevos registrados desde entonces: todavía no hay forma de saber si los cambios rinden en combate.</p> : <ul className="sl-list">
          {progress.highest.map(h => <li key={`${h.mode}${h.key}`} className="good"><b>{h.label}</b>: nueva fase máxima {h.from} → {h.to}</li>)}
          {progress.records.slice(0, 6).map(r => <li key={`${r.mode}${r.key}${r.level}`}><b>{r.label} {r.level}</b>: {r.victories ? `+${fmtInt(r.victories)} ${r.victories === 1 ? 'victoria' : 'victorias'}` : ''}{r.victories && r.defeats ? ', ' : ''}{r.defeats ? `+${fmtInt(r.defeats)} ${r.defeats === 1 ? 'derrota' : 'derrotas'}` : ''}{r.bestTime ? `${r.victories || r.defeats ? ' · ' : ''}mejor tiempo ${fmtTime(r.bestTime.from)} → ${fmtTime(r.bestTime.to)}` : ''}</li>)}
        </ul>}
      </div>
      <div className="sl-block"><h3><Users size={16} /> En tu cuenta (estadísticas)</h3>
        {progress.heroes.length ? <ul className="sl-list">{progress.heroes.slice(0, 6).map(c => <li key={c.hero.id}><b>{c.hero.name}</b>: {[...c.items, ...c.stats.slice(0, 2).map(s => `${STAT_LABEL[s.stat] ?? s.stat} ${s.stat.startsWith('critical') ? `${Math.round(100 * s.from)} → ${Math.round(100 * s.to)} %` : `${fmtInt(Math.round(s.from))} → ${fmtInt(Math.round(s.to))}`}`)].join(' · ')}</li>)}</ul> : <p className="fine">Sin cambios en tus Invokers.</p>}
        {(progress.gear.moved + progress.gear.added + progress.gear.removed) > 0 && <p className="fine">Piezas: {progress.gear.added} nuevas, {progress.gear.removed} fuera, {progress.gear.moved} cambiadas de Invoker.</p>}
        <p className="fine">Mejorar estadísticas no demuestra rendir más en combate: eso lo dicen los récords de la izquierda.</p>
      </div>
    </div>}
    {!sd && stats.length > 0 && (() => { const s = stats[stats.length - 1]; return <p className="fine"><Info size={13} /> Account Stats ({new Date(s.fetchedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}): {[s.arena?.currentLeague ? `liga de arena ${s.arena.currentLeague}` : '', s.arena?.battlesWon != null ? `${fmtInt(s.arena.battlesWon)} victorias de arena` : '', s.totalBattles != null ? `${fmtInt(s.totalBattles)} combates en total` : ''].filter(Boolean).join(' · ') || 'recibido'}. Con la próxima lectura verás la diferencia.</p> })()}
    {sd && <p className="fine"><Info size={13} /> Account Stats: {[sd.totalBattles !== null ? `${fmtInt(sd.totalBattles)} combates nuevos` : '', sd.arenaWon !== null ? `${fmtInt(sd.arenaWon)} victorias de arena` : '', sd.league ? `liga ${sd.league.from ?? '—'} → ${sd.league.to ?? '—'}` : '', sd.defenseRate !== null ? `defensa ${sd.defenseRate >= 0 ? '+' : ''}${(100 * sd.defenseRate).toFixed(1)} pts` : ''].filter(Boolean).join(' · ') || 'sin cambios'}.</p>}
    {reviewed.length > 0 && <div className="sl-recs"><h3><Check size={16} /> Lo que te recomendé</h3>
      <ul className="sl-list">{reviewed.slice(0, 8).map(r => <li key={r.id} className={r.applied ? 'good' : r.applied === false ? 'pending' : ''}>
        <span className="sl-state">{r.applied ? 'Aplicada' : r.applied === false ? 'Pendiente' : 'Sin comprobar'}</span> <b>{r.title}</b>
        <small> · {r.objectiveLabel}{r.applied && r.outcome ? ` · desde entonces: ${r.outcome.highest ? `nueva fase máxima ${r.outcome.highest.from} → ${r.outcome.highest.to}; ` : ''}${r.outcome.victories || r.outcome.defeats ? `${r.outcome.victories} victorias y ${r.outcome.defeats} derrotas en la fase ${r.baseline?.level}` : 'sin combates nuevos en esa fase'}${r.outcome.bestTime ? `; mejor tiempo ${fmtTime(r.outcome.bestTime.from)} → ${fmtTime(r.outcome.bestTime.to)}` : ''}` : ''}</small>
        {r.applied === false && <button className="link" onClick={() => { forget(account.box.profile.name, r.id); setV(v + 1) }}>Descartar</button>}
      </li>)}</ul>
      <p className="fine">{applied.length} aplicadas y {pending.length} pendientes. Un resultado mejor después de aplicar una recomendación coincide en el tiempo con ella, pero no prueba que sea la causa.</p>
    </div>}
  </section>
}

function Synergy({ plan }: { plan: CoachPlan }) {
  if (!plan.synergy.notes.length) return null
  return <section className="panel synergy">
    <div className="panel-title"><h2><Users size={18} /> Tu equipo para «{plan.objective.label}»</h2><small>Sinergias según las fichas oficiales</small></div>
    <ul className="tips">{plan.synergy.notes.map((n, i) => <li key={i} className={`tip ${n.tone === 'ok' ? 'do' : n.tone === 'gap' ? 'warn' : 'info'}`}>{n.tone === 'ok' ? <Check size={15} /> : n.tone === 'gap' ? <TriangleAlert size={15} /> : <Info size={15} />}<span>{n.text}</span></li>)}</ul>
  </section>
}

function HowItDecides() {
  return <details className="panel howto ch-how-decides">
    <summary><BookOpen size={18} /> Cómo decide el Coach</summary>
    <ul className="dashes">
      <li><b>Objetivo</b>: la cuenta entera (los Invokers que usas, por cuánto los usas) o una fase de tus récords (equipo del mejor tiempo, RES y objetivos de la guía o de la aguja). Se sacan de tu caja: no hace falta escribir nada.</li>
      <li><b>Impacto</b>: lo que mejora cada Invoker según su perfil (daño por golpe en atacantes; pesos de su clase en el resto) y, contra un jefe o piso, la probabilidad oficial de que entren sus perjuicios, ponderado por su peso en el objetivo. Cumplir una tolerancia de la guía vale {GOAL_BONUS} puntos.</li>
      <li><b>Puntuación</b> = impacto × confianza (alta {CONFIDENCE_WEIGHT.alta}, media {CONFIDENCE_WEIGHT.media}, baja {CONFIDENCE_WEIGHT.baja}) × disponibilidad (ya {AVAILABILITY_WEIGHT.now}, recursos {AVAILABILITY_WEIGHT.resources}, falta información {AVAILABILITY_WEIGHT.info}) × coste (el oro divide entre 1 + oro/{fmtInt(GOLD_SCALE)}). Lo que no tiene cifra (ascender, despertar sin ranura) puntúa como mucho {UNQUANTIFIED_CAP}.</li>
      <li><b>Exacto</b>: estadísticas de piezas y conjuntos (fórmula verificada con tu caja). <b>Aproximado</b>: habilidades (simulador con las fórmulas oficiales y supuestos de animación y maná) y vínculos de Titán (el % sobre la base es un supuesto). <b>Sin cifra</b>: ascensión y nodos de despertar, que no se publican.</li>
      <li>Nunca propone quitar piezas a tus equipos activos, a tu plan ni al equipo del objetivo; solo usa piezas libres o de Invokers que no usas, y una pieza a un solo Invoker.</li>
      <li>Se recalcula solo cada vez que importas tu caja, cambias de objetivo, de plan o de trofeos. Nexo no estima probabilidades de victoria.</li>
    </ul>
  </details>
}

/** Tarjeta de Inicio: el siguiente paso del Coach en corto. */
export function CoachHomeCard() {
  const { go } = useAccount()
  const s = useCoachPlan()
  const a = s.plan?.actions[0]
  return <section className="panel coach-card mini-step">
    <div className="panel-title"><h2>Tu siguiente paso</h2><button className="link" onClick={() => go('/asesor')}>Abrir el coach <ArrowRight size={15} /></button></div>
    {!s.plan ? <p className="muted"><Loader2 size={14} className="spin" /> Analizando tu cuenta…</p> : !a ? <p className="muted">Nada que mejorar con lo que tienes para «{s.plan.objective.label}».</p> : <>
      <p className="ms-title"><b>{a.title}</b></p>
      <p className="ms-row"><Crosshair size={14} /> {a.effect}</p>
      <p className="ms-row"><Info size={14} /> {a.why[0]}</p>
      <p className="ms-row"><Clock size={14} /> {a.needs}</p>
      <Chips a={a} />
    </>}
  </section>
}

/** Coach › Hoy: el siguiente paso más conveniente, por qué y qué necesitas. */
export function CoachHome() {
  const { account } = useAccount()
  const s = useCoachPlan()
  if (!account) return null
  const objective = s.plan?.objective ?? null
  return <section className="coach-home">
    <UrgentNotices />
    <ObjectiveBar options={s.options} value={s.objectiveId} onChange={s.setObjective} objective={objective} />
    {s.plan ? <>
      {s.computing && !s.reviewing && <p className="fine ch-busy"><Loader2 size={14} className="spin" /> Recalculando…</p>}
      {s.reviewing && <p className="fine ch-busy" role="status"><Loader2 size={14} className="spin" /> Revisando el equipo completo con el optimizador (conjuntos incluidos){s.reviewing.label ? `: ${s.reviewing.label}, ${s.reviewing.done + 1} de ${s.reviewing.total}` : ''}…</p>}
      <NextStep plan={s.plan} />
      <ProspectCard />
      <Priorities plan={s.plan} />
      <Synergy plan={s.plan} />
    </> : <><section className="panel step-card loading"><Loader2 size={18} className="spin" /> Analizando tu cuenta: piezas, habilidades, Titanes, despertar y sala de trofeos…</section><ProspectCard /></>}
    <SinceLast />
    <HowItDecides />
    <h2 className="coach-h">Tu cuenta por frentes</h2>
    <Fronts />
    <details className="more-tasks"><summary><FlaskConical size={16} /> Otras tareas de la cuenta <ArrowRight size={14} /></summary><CoachNow bare /></details>
  </section>
}
