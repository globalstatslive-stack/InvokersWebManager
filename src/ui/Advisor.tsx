import { useMemo, useState } from 'react'
import { Coins } from 'lucide-react'
import { useAccount } from './account'
import { Chips, NeedsAccount, PageHead } from './common'
import { Portrait, SetIcon, Stars } from './Art'
import { fmtInt, fmtStat, SET_LABEL, STAT_LABEL, t, TOLERANCES } from '../box/i18n'
import { diagnose, teamHeroIds } from '../box/advisor'
import type { Verdict } from '../box/gearCoach'
import { CoachNow } from './CoachNow'
import { PiecesCoach } from './GearCoach'
import { TeamFinder } from './TeamFinder'

type Tab = 'ahora' | 'equipo' | 'piezas' | 'revision' | 'tolerancias'
const VERDICTS: Verdict[] = ['upgrade', 'replace', 'test', 'equip', 'keep', 'sell', 'done']
/** Coach: qué hacer ahora, equipo para un jefe, coach de piezas, revisión de builds y tolerancias. */
export function Advisor({ tab, arg }: { tab?: string; arg?: string }) {
  const { account, go } = useAccount()
  // Rutas antiguas: «Qué vender» y «Qué subir» pasan a Piezas.
  const legacy = tab === 'venta' ? 'sell' : tab === 'mejoras' ? 'upgrade' : undefined
  const current: Tab = legacy ? 'piezas' : (['ahora', 'equipo', 'piezas', 'revision', 'tolerancias'] as Tab[]).includes(tab as Tab) ? tab as Tab : 'ahora'
  const verdict = (legacy ?? (VERDICTS.includes(arg as Verdict) ? arg : undefined)) as Verdict | undefined
  if (!account) return <NeedsAccount />
  return <>
    <PageHead kicker="Tu entrenador" title="Coach">Qué hacer ahora y por qué, calculado con tu caja, las reglas oficiales del juego y tus equipos. Nada se ejecuta en el juego.</PageHead>
    <Chips label="Sección" value={current} onChange={v => go(`/asesor/${v}`)} options={[{ id: 'ahora', label: 'Qué hacer ahora' }, { id: 'equipo', label: 'Equipo para un jefe' }, { id: 'piezas', label: 'Piezas: subir o vender' }, { id: 'revision', label: 'Revisión de builds' }, { id: 'tolerancias', label: 'Tolerancias' }]} />
    {current === 'ahora' && <CoachNow />}
    {current === 'equipo' && <TeamFinder />}
    {current === 'piezas' && <PiecesCoach key={verdict ?? 'upgrade'} initial={verdict} />}
    {current === 'revision' && <Review />}
    {current === 'tolerancias' && <Tolerances />}
  </>
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
