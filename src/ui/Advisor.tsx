import { useMemo, useState } from 'react'
import { ArrowRight, Coins } from 'lucide-react'
import { useAccount } from './account'
import { Chips, GearCard, NeedsAccount, PageHead } from './common'
import { GearIcon, Portrait, SetIcon, Stars } from './Art'
import { fmtInt, fmtStat, SET_LABEL, SLOT_LABEL, STAT_LABEL, t, TOLERANCES, bonusName, fmtBonus } from '../box/i18n'
import { diagnose, sellCandidates, teamHeroIds, upgradeQueue } from '../box/advisor'

type Tab = 'venta' | 'mejoras' | 'revision' | 'tolerancias'
export function Advisor({ tab }: { tab?: string }) {
  const { account, go } = useAccount()
  const current: Tab = (['venta', 'mejoras', 'revision', 'tolerancias'] as Tab[]).includes(tab as Tab) ? tab as Tab : 'revision'
  if (!account) return <NeedsAccount />
  return <>
    <PageHead kicker="Herramientas" title="Asesor">Recomendaciones calculadas con tu inventario. Nada se ejecuta en el juego.</PageHead>
    <Chips label="Sección" value={current} onChange={v => go(`/asesor/${v}`)} options={[{ id: 'revision', label: 'Revisión de builds' }, { id: 'mejoras', label: 'Qué subir' }, { id: 'venta', label: 'Qué vender' }, { id: 'tolerancias', label: 'Tolerancias' }]} />
    {current === 'venta' && <Sell />}
    {current === 'mejoras' && <Upgrades />}
    {current === 'revision' && <Review />}
    {current === 'tolerancias' && <Tolerances />}
  </>
}

function Sell() {
  const { account } = useAccount()
  const [limit, setLimit] = useState(40)
  const list = useMemo(() => sellCandidates(account!.box), [account])
  const gold = list.reduce((s, x) => s + x.gear.unequipGold, 0)
  return <section className="advisor">
    <p className="lead">{list.length} piezas libres con poco valor. Revisa los motivos: las notas A–D del portal valoran cada subestadística. <span className="muted">Valor de referencia: {fmtInt(gold)} oro (precio de desequipar).</span></p>
    <div className="gear-grid">{list.slice(0, limit).map(v => <GearCard key={`${v.gear.kind}${v.gear.id}`} g={v.gear} extra={<div className="verdict">
      {v.reasons.map(r => <span key={r} className="tag bad">{r}</span>)}{v.keep.map(r => <span key={r} className="tag good">{r}</span>)}
    </div>} />)}</div>
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 60)}>Mostrar más</button></div>}
  </section>
}

function Upgrades() {
  const { account, go } = useAccount()
  const list = useMemo(() => upgradeQueue(account!.box, account!.index), [account])
  const [limit, setLimit] = useState(50)
  return <section className="advisor">
    <p className="lead">{list.length} piezas equipadas por debajo del nivel máximo, priorizadas por el poder del Invoker que las lleva. La ganancia de la principal la calcula el portal.</p>
    <div className="table-wrap"><table className="data">
      <thead><tr><th>Invoker</th><th>Pieza</th><th>Nivel</th><th>Principal al máximo</th></tr></thead>
      <tbody>{list.slice(0, limit).map(u => <tr key={`${u.gear.kind}${u.gear.id}`} onClick={() => go(`/invoker/${u.hero.id}`)}>
        <td className="name-cell"><Portrait c={u.hero} size="sm" /><span><b>{u.hero.name}</b><small>{fmtInt(u.hero.power)}</small></span></td>
        <td className="name-cell"><GearIcon g={u.gear} size="sm" /><span>{t(SLOT_LABEL, u.gear.slot)}<small>{u.gear.set ? t(SET_LABEL, u.gear.set) : u.gear.faction}</small></span></td>
        <td>+{u.gear.level} <ArrowRight size={13} /> +{u.gear.level + u.levels}</td>
        <td>{u.gear.mainAtMax ? <>{bonusName(u.gear.main.stat, u.gear.main.mode)} <b className="up">{fmtBonus(u.gear.main.stat, u.gear.main.mode, u.gear.main.value)} → {fmtBonus(u.gear.mainAtMax.stat, u.gear.mainAtMax.mode, u.gear.mainAtMax.value)}</b></> : <span className="muted">—</span>}</td>
      </tr>)}</tbody>
    </table></div>
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 100)}>Mostrar más</button></div>}
  </section>
}

function Review() {
  const { account, go } = useAccount()
  const [scope, setScope] = useState<'teams' | 'top'>('teams')
  const rows = useMemo(() => {
    const { box, index } = account!
    const ids = teamHeroIds(box)
    const heroes = scope === 'teams' ? box.heroes.filter(h => ids.has(h.id)) : [...box.heroes].sort((a, b) => b.power - a.power).slice(0, 30)
    return heroes.map(h => ({ h, issues: diagnose(box, index, h) })).sort((a, b) => b.issues.reduce((s, i) => s + i.severity, 0) - a.issues.reduce((s, i) => s + i.severity, 0) || b.h.power - a.h.power)
  }, [account, scope])
  return <section className="advisor">
    <Chips label="Invokers" value={scope} onChange={setScope} options={[{ id: 'teams', label: 'De mis equipos' }, { id: 'top', label: 'Top 30 por poder' }]} />
    <div className="review-list">{rows.map(({ h, issues }) => <div key={h.id} className="review-row">
      <button className="review-hero" onClick={() => go(`/invoker/${h.id}`)}><Portrait c={h} size="sm" /><span><b>{h.name}</b><small><Stars n={h.rank} /> · {fmtInt(h.power)}</small></span></button>
      <div className="review-issues">{issues.length ? issues.map((i, n) => <span key={n} className={`tag sev-${i.severity}`}>{i.text}</span>) : <span className="tag good">Sin carencias detectadas</span>}</div>
      <button className="btn small" onClick={() => go(`/optimizador/${h.id}`)}>Optimizar</button>
    </div>)}</div>
  </section>
}

function Tolerances() {
  const { account, go } = useAccount()
  const { box } = account!
  const [tol, setTol] = useState(TOLERANCES[0])
  const set = tol.charAt(0).toUpperCase() + tol.slice(1)
  const rule = account!.index.rules.get(set)
  const bosses = rule?.threeDescription.split(':')[1]?.trim().replace(/\.$/, '')
  const heroes = box.heroes.filter(h => (h.stats[tol] ?? 0) > 0).sort((a, b) => (b.stats[tol] ?? 0) - (a.stats[tol] ?? 0) || b.power - a.power)
  const freePieces = box.relics.filter(g => g.set === set && g.equippedHeroId === null).length
  return <section className="advisor">
    <p className="lead">Los jefes con corrupción reducen la eficacia de tus Invokers salvo que tengan tolerancia. Elige una corrupción para ver quién está preparado.</p>
    <div className="tol-picker">{TOLERANCES.map(k => { const s = k.charAt(0).toUpperCase() + k.slice(1); return <button key={k} className={tol === k ? 'on' : ''} onClick={() => setTol(k)}><SetIcon set={s} />{STAT_LABEL[k]}</button> })}</div>
    <div className="panel">
      <div className="panel-title"><h2><SetIcon set={set} /> {t(SET_LABEL, set)}</h2><small>{freePieces} piezas libres de este conjunto</small></div>
      {bosses && <p>Jefes afectados: <b>{bosses}</b></p>}
      {heroes.length === 0 ? <p className="muted">Ningún Invoker tiene esta tolerancia. Equipa 3 piezas del conjunto {t(SET_LABEL, set)} para conseguirla.</p> :
        <div className="top-list">{heroes.slice(0, 30).map(h => <button key={h.id} className="top-row" onClick={() => go(`/invoker/${h.id}`)}>
          <Portrait c={h} size="sm" /><span className="top-name"><b>{h.name}</b><small>{fmtInt(h.power)} de poder</small></span><span className="top-power"><b>{fmtStat(tol, h.stats[tol])}</b></span>
        </button>)}</div>}
    </div>
    <p className="fine"><Coins size={13} /> Las tolerancias proceden de habilidades de tolerancia y de conjuntos de 3 piezas.</p>
  </section>
}
