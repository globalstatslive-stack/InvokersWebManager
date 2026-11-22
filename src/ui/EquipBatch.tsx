import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Coins, Info, ListPlus, Loader2, PackageCheck, X } from 'lucide-react'
import type { Gear } from '../box/model'
import { assembleBatch, fillOptions, MIN_BATCH_GAIN, REVIEW_EFFORT, reviewBatch, reviewOptions, usedHeroes, USED_MIN_LEVEL, type BatchHero, type ReviewEffort, type SwapOption } from '../box/equipBatch'
import { fmtBonus, bonusName, fmtInt, SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { RARITY_F } from '../box/gearCoach'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { entryFrom, PORTAL_TEAM, reservedBy, usePlan } from './plan'
import { useGearCoach } from './coach'
import { useFillOptimizer } from './useOptimizer'
import { useProspects } from './prospects'
import { GearIcon, Portrait } from './Art'

const pct = (x: number) => `+${(100 * x).toFixed(1).replace('.', ',')} %`
const pieceText = (g: Gear) => `${g.set ? t(SET_LABEL, g.set) : g.faction ?? ''} · ${RARITY_F[g.rarity] ?? g.rarity} ${g.rank}★ +${g.level} · ${bonusName(g.main.stat, g.main.mode)} ${fmtBonus(g.main.stat, g.main.mode, g.main.value)}`

function BatchRow({ b, on, toggle }: { b: BatchHero; on: boolean; toggle: () => void }) {
  const [open, setOpen] = useState(false)
  return <li className={`batch-row ${on ? '' : 'off'}`}>
    <div className="batch-head">
      <label className="check" aria-label={`Incluir a ${b.hero.name}`}><input type="checkbox" checked={on} onChange={toggle} /></label>
      <Portrait c={b.hero} size="sm" />
      <span className="row-main">
        <b>{b.hero.name}</b>
        <small>{b.why === 'active' ? 'Equipo activo o plan' : `En ${b.teams} de tus equipos`} · {b.fills.length ? `${b.fills.length} hueco${b.fills.length > 1 ? 's' : ''}` : ''}{b.fills.length && b.swaps.length ? ' · ' : ''}{b.swaps.length ? `${b.swaps.length} sustituci${b.swaps.length > 1 ? 'ones' : 'ón'}` : ''}</small>
      </span>
      <span className="batch-gain"><b className="up">{pct(b.gain)}</b><small>{b.hero.cls === 'Tank' || b.hero.cls === 'Support' ? 'en su perfil' : 'de daño por golpe'}</small></span>
      <span className={`batch-gold ${b.gold ? '' : 'free'}`}><Coins size={13} /> {b.gold ? fmtInt(b.gold) : '0'}</span>
      <button className="icon-btn" aria-expanded={open} aria-label={`Ver las piezas de ${b.hero.name}`} onClick={() => setOpen(!open)}><ChevronDown size={16} className={open ? 'flip' : ''} /></button>
    </div>
    {open && <ul className="batch-pieces">
      {b.fills.map(c => <li key={`f${c.slot}`}><GearIcon g={c.to!} size="sm" /><span><b>{t(SLOT_LABEL, c.slot)}</b> <small className="tag good">hueco vacío</small><small>{pieceText(c.to!)}</small></span></li>)}
      {b.swaps.map(c => <li key={`s${c.slot}`}><GearIcon g={c.to!} size="sm" /><span><b>{t(SLOT_LABEL, c.slot)}</b> <small className="tag">sustituye · {c.gain >= 0.005 ? `sola ${pct(c.gain)}` : 'vale por el conjunto'} · {fmtInt(c.from?.unequipGold ?? 0)} de oro</small>{c.takenFrom && <small className="tag">de {c.takenFrom.name} (no lo usas) · {fmtInt(c.to!.unequipGold)} de oro</small>}<small>{pieceText(c.to!)}{c.from ? ` · sale ${c.from.rank}★ +${c.from.level}` : ''}</small></span></li>)}
    </ul>}
  </li>
}

/** Coach › Piezas › Equipar: prepara un lote con las piezas libres para los Invokers que usas y lo añade al Plan. */
export function EquipBatch() {
  const { account, go } = useAccount()
  const coach = useGearCoach()
  const active = useActiveTeams(account?.box)
  const { plan, upsertMany } = usePlan(account?.box)
  const { state, run, cancel } = useFillOptimizer(account!.box)
  const [withSwaps, setWithSwaps] = useState(false)
  // Revisión completa (por defecto): el optimizador exacto puede cambiar piezas puestas si compensa, con conjuntos.
  const [mode, setMode] = useState<'review' | 'fill'>('review')
  const [effort, setEffort] = useState<ReviewEffort>('min')
  const [count, setCount] = useState<number>(20)
  const [ranMode, setRanMode] = useState<'review' | 'fill' | null>(null)
  const [off, setOff] = useState<Set<number>>(new Set())
  const [added, setAdded] = useState<{ n: number; blocked: string[]; pieces: number; gold: number } | null>(null)
  const { box, index } = account!
  const inPlan = useMemo(() => new Set(plan.map(e => e.heroId)), [plan])
  const important = useMemo(() => new Set([...active.heroes, ...inPlan]), [active.heroes, inPlan])
  const { used, skipped } = useMemo(() => usedHeroes(box, important), [box, important])
  // Promesas (tier alto que aún no usas, como un legendario nuevo): no ceden piezas.
  const prospects = useProspects().ids
  const pending = useMemo(() => used.filter(u => !inPlan.has(u.hero.id)), [used, inPlan])
  const members = useMemo(() => mode === 'review' ? pending.slice(0, count) : pending, [pending, mode, count])
  // Nunca se tocan las piezas reservadas en el plan ni las que el coach aconseja guardar.
  const reserved = useMemo(() => {
    const r = reservedBy(plan, -1)
    for (const a of coach?.advice ?? []) if (a.verdict === 'keep') r.add(`${a.gear.kind}${a.gear.id}`)
    return r
  }, [plan, coach])
  const swapOptions = useMemo((): SwapOption[] => (coach?.advice ?? []).filter(a => a.verdict === 'equip' && a.best?.replaces).map(a => ({ heroId: a.best!.hero.id, slot: a.gear.slot, kind: a.gear.kind, pieceId: a.gear.id })), [coach])
  const batch = useMemo(() => state.status !== 'done' || ranMode !== mode ? null
    : mode === 'review' ? reviewBatch(index, members, state.result, skipped) : assembleBatch(index, members, state.result, swapOptions, withSwaps, skipped), [state, index, members, swapOptions, withSwaps, skipped, mode, ranMode])
  const chosen = batch?.heroes.filter(b => !off.has(b.hero.id)) ?? []
  const prepare = () => {
    setAdded(null); setOff(new Set()); setRanMode(mode)
    // Revisión: nunca toca a los Invokers que usas, equipos activos ni plan; sí usa piezas libres (también las que el
    // coach aconseja guardar: equiparlas no las gasta) y las de Invokers que no usas.
    const protect = new Set([...used.map(u => u.hero.id), ...important, ...prospects])
    const planReserved = reservedBy(plan, -1)
    run(members.map(u => ({ heroId: u.hero.id, options: mode === 'review' ? reviewOptions(u.hero, planReserved, protect, effort) : fillOptions(u.hero, reserved) })))
  }
  const addAll = () => {
    const r = upsertMany(chosen.map(b => entryFrom(b.hero, b.build, mode === 'review' ? 'Revisión de equipo' : 'Equipar piezas libres')))
    setAdded({ n: r.added, blocked: r.blocked.map(e => e.name), pieces: chosen.filter(b => !r.blocked.some(e => e.heroId === b.hero.id)).reduce((s, b) => s + b.fills.length + b.swaps.length, 0), gold: chosen.filter(b => !r.blocked.some(e => e.heroId === b.hero.id)).reduce((s, b) => s + b.gold, 0) })
  }
  if (added) return <section className="panel batch done">
    <div className="panel-title"><h2><Check size={18} /> Lote añadido a tu plan</h2></div>
    <p className="lead" role="status">{added.n} Invoker{added.n === 1 ? '' : 's'} añadido{added.n === 1 ? '' : 's'} · {added.pieces} piezas · {fmtInt(added.gold)} de oro.{added.blocked.length ? ` No entraron ${added.blocked.join(', ')}: alguna pieza ya estaba reservada para otro Invoker del plan.` : ''}</p>
    <ol className="game-steps compact">
      <li><span className="step-n">1</span><div><b>Ve a Plan y envía {Math.ceil(added.n / PORTAL_TEAM) > 1 ? `la primera de sus ${Math.ceil(added.n / PORTAL_TEAM)} tandas de ${PORTAL_TEAM}` : 'el plan'} a invokers.com</b>{Math.ceil(added.n / PORTAL_TEAM) > 1 ? ': el optimizador oficial trabaja con 5 Invokers a la vez y ninguna pieza se repite entre tandas.' : ''}</div></li>
      <li><span className="step-n">2</span><div><b>Pulsa tu marcador «Nexo»</b>: lo guarda como preset y lo carga en el optimizador oficial.</div></li>
      <li><span className="step-n">3</span><div><b>Revisa y pulsa «Equip all»</b>: el portal te enseña el oro antes de confirmar.</div></li>
    </ol>
    <div className="row-actions"><button className="btn primary" onClick={() => go('/plan')}>Ir al plan <ArrowRight size={14} /></button><button className="btn" onClick={() => { setAdded(null); setOff(new Set()) }}>Preparar otro lote</button></div>
  </section>
  const usedLabel = members[0]?.why === 'active' || active.heroes.size ? 'tus equipos activos y tu plan' : `tus equipos registrados (nivel ${USED_MIN_LEVEL} o más)`
  return <section className="panel batch">
    <div className="panel-title"><h2><PackageCheck size={18} /> {mode === 'review' ? 'Revisar el equipo de tus Invokers más usados' : 'Equipar todo de una vez'}</h2><small>Se añade al Plan; nada se equipa sin tu confirmación en el portal</small></div>
    <div className="chips-row batch-mode" role="group" aria-label="Qué revisar">
      <button className={`chip ${mode === 'review' ? 'on' : ''}`} aria-pressed={mode === 'review'} onClick={() => setMode('review')}>Revisión completa</button>
      <button className={`chip ${mode === 'fill' ? 'on' : ''}`} aria-pressed={mode === 'fill'} onClick={() => setMode('fill')}>Solo huecos vacíos (sin oro)</button>
    </div>
    {mode === 'review' ? <>
      <p className="lead">El <b>optimizador completo</b> revisa uno a uno a tus Invokers más usados con todas tus piezas libres (también las que acabas de subir) y las de Invokers que no usas: puede cambiar varias a la vez para activar un conjunto mejor, algo que comparando pieza a pieza no se ve. Cada cambio tiene que compensar su coste, así que no rehace todo.</p>
      <div className="batch-opts">
        <label>Invokers <select value={count} onChange={e => setCount(Number(e.target.value))}>{[10, 20, 40].map(n => <option key={n} value={n}>Los {n} más usados</option>)}</select></label>
        <div className="chips-row" role="group" aria-label="Cuántos cambios">
          <button className={`chip ${effort === 'min' ? 'on' : ''}`} aria-pressed={effort === 'min'} onClick={() => setEffort('min')}>Solo los cambios que más aportan</button>
          <button className={`chip ${effort === 'balanced' ? 'on' : ''}`} aria-pressed={effort === 'balanced'} onClick={() => setEffort('balanced')}>Más cambios (equilibrio)</button>
        </div>
      </div>
    </> : <p className="lead">Nexo rellena los <b>huecos vacíos</b> de los Invokers que usas con las piezas libres que mejor les encajan, conjuntos incluidos. Rellenar un hueco no cuesta oro. Después lo llevas al juego desde Plan: «Enviar a invokers.com», tu marcador y «Equip all».</p>}
    <ul className="batch-facts">
      <li className="ok"><Check size={14} /><span>Para <b>{members.length}</b> Invoker{members.length === 1 ? '' : 's'} que usas: {usedLabel}.{inPlan.size ? ` Los ${inPlan.size} que ya están en tu plan se respetan.` : ''}</span></li>
      {skipped.length > 0 && <li className="no"><X size={14} /><span>Se quedan fuera {skipped.length} con huecos que no usas ({skipped.slice(0, 4).map(h => h.name).join(', ')}{skipped.length > 4 ? '…' : ''}): una pieza puesta cuesta oro de desequipar si luego la mueves.</span></li>}
      {mode === 'review'
        ? <li className="ok"><Check size={14} /><span>Nunca quita piezas a los Invokers que usas, a tus equipos activos ni a tu plan, ni usa las reservadas en el plan. Cada cambio debe aportar al menos lo que cuesta ({REVIEW_EFFORT[effort]} puntos del optimizador) y cada Invoker entra solo si gana al menos un {Math.round(100 * MIN_BATCH_GAIN)} %.</span></li>
        : <li className="ok"><Check size={14} /><span>Solo piezas libres, sin las reservadas en tu plan ni las de tolerancia que conviene guardar. Cada Invoker solo entra si gana al menos un {Math.round(100 * MIN_BATCH_GAIN)} %.</span></li>}
    </ul>
    {!active.heroes.size && <p className="note"><Info size={15} /> ¿No juegas con todos ellos? Marca tus equipos activos en Coach › Hoy y el lote se centrará solo en esos.</p>}
    {mode === 'fill' && <label className="check"><input type="checkbox" checked={withSwaps} onChange={e => setWithSwaps(e.target.checked)} /> Incluir también sustituciones: cambiar una pieza puesta por una libre que le dé un {Math.round(100 * MIN_BATCH_GAIN)} % o más (cuesta el oro de desequipar de la que sale)</label>}
    <div className="row-actions">
      {state.status === 'running' ? <>
        <span className="muted"><Loader2 size={15} className="spin" /> {state.progress ? `Calculando a ${state.progress.label} (${state.progress.done + 1} de ${state.progress.total})…` : 'Calculando…'}</span>
        <button className="btn small" onClick={cancel}>Cancelar</button>
      </> : <button className="btn primary" disabled={!members.length || !coach} onClick={prepare}><PackageCheck size={16} /> {batch ? 'Volver a calcular' : 'Preparar el lote'}</button>}
      {state.status === 'error' && <span className="down">No se pudo calcular: {state.message}</span>}
    </div>
    {batch && <>
      {batch.heroes.length === 0 ? <p className="muted">{mode === 'review' ? 'Con tus piezas actuales no hay cambios que compensen en estos Invokers.' : <>No hay huecos que rellenar con piezas que merezcan la pena{withSwaps ? ' ni sustituciones de un 1 % o más' : ''}.</>}</p> : <>
        <div className="batch-sum">
          <span><b>{chosen.length}</b> Invokers</span>
          <span><b>{chosen.reduce((s, b) => s + b.fills.length + b.swaps.length, 0)}</b> piezas</span>
          <span className={chosen.reduce((s, b) => s + b.gold, 0) ? '' : 'free'}><Coins size={14} /> <b>{fmtInt(chosen.reduce((s, b) => s + b.gold, 0))}</b> de oro</span>
        </div>
        <ul className="batch-list">{batch.heroes.map(b => <BatchRow key={b.hero.id} b={b} on={!off.has(b.hero.id)} toggle={() => setOff(s => { const n = new Set(s); if (n.has(b.hero.id)) n.delete(b.hero.id); else n.add(b.hero.id); return n })} />)}</ul>
        <div className="row-actions">
          <button className="btn primary" disabled={!chosen.length} onClick={addAll}><ListPlus size={16} /> Añadir al plan ({chosen.length})</button>
        </div>
      </>}
      {batch.left.length > 0 && <details className="batch-left"><summary>{batch.left.length} Invoker{batch.left.length > 1 ? 's' : ''} {mode === 'review' ? 'sin cambios que compensen' : 'con huecos que se quedan como están'}</summary>
        <ul className="dashes">{batch.left.map(l => <li key={l.hero.id}><b>{l.hero.name}</b>: {l.reason}</li>)}</ul>
      </details>}
      <p className="fine"><Info size={13} /> La ganancia es daño medio por golpe en atacantes y valor de su perfil de clase en tanques y apoyos, con la fórmula de estadísticas verificada, y cuenta todos los cambios juntos (conjuntos incluidos): por eso una pieza puede valer «por el conjunto» aunque sola aporte poco. {mode === 'review' ? 'Los Invokers se revisan en orden de uso y una pieza va al primero que la aprovecha.' : 'Para rehacer la build entera de un Invoker (con su oro), usa el optimizador o la revisión completa.'}</p>
    </>}
  </section>
}
