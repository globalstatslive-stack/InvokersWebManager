import { useMemo, useState } from 'react'
import { Check, Clock, ExternalLink, Info, ListChecks, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { useAccount } from './account'
import { Empty, NeedsAccount } from './common'
import { GameImg } from './Art'
import { fmtInt, fmtStat, SLOT_LABEL, STAT_SHORT, t } from '../box/i18n'
import { portalUrl, progressOf, TRACKED_STATS, usePlan, type PlanEntry } from './plan'

const date = (s: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))

/** Plan: cambios elegidos, su envío al portal y la comprobación de lo aplicado al reimportar la caja. */
export function PlanPage() {
  const { account, go, records } = useAccount()
  const box = account?.box
  const { plan, remove, clear } = usePlan(box)
  const [name, setName] = useState(() => `Nexo ${new Date().toLocaleDateString('es-ES')}`)
  const rows = useMemo(() => plan.map(e => ({ e, p: progressOf(e, account?.index.heroes.get(e.heroId)) })), [plan, account])
  if (!account) return <NeedsAccount />
  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.nexoExtension
  const gold = plan.reduce((s, e) => s + e.gold, 0), changes = plan.reduce((s, e) => s + e.changes, 0)
  const done = rows.filter(r => r.p.done).length
  const importedAt = account.record.importedAt
  return <div className="plan-page">
    <header className="goal-head"><ListChecks size={20} aria-hidden /><div><h1>Plan</h1><p>{plan.length ? `${plan.length} Invokers · ${changes} cambios · ~${fmtInt(gold)} de oro de desequipar · ${done} completados` : 'Aún no has añadido cambios.'}</p></div></header>
    {!plan.length ? <Empty title="Tu plan está vacío" action={<button className="btn primary" onClick={() => go('/objetivo')}>Elegir un objetivo</button>}>Elige un objetivo o usa el optimizador y pulsa «Añadir al plan». Las piezas que reserves no se asignarán a otro Invoker.</Empty> : <>
      <section className="panel">
        <div className="panel-title"><h2>Comprobación</h2><small>Caja importada el {date(importedAt)}</small></div>
        <p className="fine"><Info size={13} /> Haz los cambios en el juego, actualiza tu enlace en invokers.com («Refresh link») e impórtalo de nuevo: aquí verás qué cambios se aplicaron y las estadísticas observadas frente a las estimadas.</p>
        <button className="btn" onClick={() => go('/importar')}><RefreshCw size={15} /> Reimportar mi caja</button>
        {records.length < 2 && <p className="fine">Solo hay una importación: la comprobación tendrá sentido después de reimportar.</p>}
      </section>
      <ul className="plan-rows">{rows.map(({ e, p }) => <PlanRow key={e.heroId} e={e} p={p} remove={() => remove(e.heroId)} open={() => go(`/optimizador/${e.heroId}`)} />)}</ul>
      <section className="panel">
        <div className="panel-title"><h2>Aplicarlo en el juego</h2></div>
        <p className="fine">Nexo no cambia nada en tu cuenta. Puedes hacer los cambios a mano o guardar el plan como preset del optimizador oficial y aplicarlo allí con su botón «Apply», que muestra el oro antes de confirmar.</p>
        <div className="link-row">
          <input value={name} onChange={e => setName(e.target.value)} aria-label="Nombre del preset" maxLength={60} />
          <a className="btn primary" href={portalUrl(plan, name)} target="_blank" rel="noopener" referrerPolicy="strict-origin"><Upload size={16} /> Enviar a invokers.com</a>
        </div>
        <p className="fine">{hasExtension ? 'Extensión de Nexo detectada: el preset se guardará solo y se abrirá Presets.' : <>Guardar el preset requiere la <a href="./nexo-extension.zip" download>extensión de Nexo</a> o el marcador (Importar → otras formas), porque solo una página de invokers.com puede escribir en tu cuenta. Es opcional: también puedes hacerlo a mano.</>} <a href="https://invokers.com/guides/my-box-and-gear-optimizer/" target="_blank" rel="noreferrer">Guía oficial <ExternalLink size={11} /></a></p>
        <button className="btn danger" onClick={() => { if (confirm('¿Vaciar el plan?')) clear() }}><Trash2 size={15} /> Vaciar plan</button>
      </section>
    </>}
  </div>
}

function PlanRow({ e, p, remove, open }: { e: PlanEntry; p: ReturnType<typeof progressOf>; remove: () => void; open: () => void }) {
  const status = p.done ? 'Aplicado' : p.applied.length ? `${p.applied.length}/${p.applied.length + p.pending.length} aplicados` : 'Pendiente'
  return <li className={`plan-row ${p.done ? 'done' : ''}`}>
    <header>
      <GameImg path={e.portrait} alt="" className="plan-portrait" />
      <span className="row-main"><b>{e.name}</b><small>{e.goal ? `${e.goal} · ` : ''}{e.changes} cambios · {fmtInt(e.gold)} oro · añadido el {date(e.at)}</small></span>
      <span className={`state ${p.done ? 'geared' : 'bare'}`}>{p.done ? <Check size={12} /> : <Clock size={12} />} {status}</span>
      <button className="icon-btn" aria-label={`Quitar ${e.name} del plan`} onClick={remove}><X size={16} /></button>
    </header>
    <div className="slot-chips">{[...p.applied.map(s => [s, true] as const), ...p.pending.map(s => [s, false] as const)].map(([s, ok]) => <span key={s} className={ok ? 'ok' : 'pending'}>{ok ? '✓' : '○'} {t(SLOT_LABEL, s)}</span>)}</div>
    {e.estimated && <table className="stat-table compact"><thead><tr><th></th><th>Antes</th><th>Estimado</th><th>{p.observed ? 'Observado' : 'Observado (al completarse)'}</th></tr></thead>
      <tbody>{TRACKED_STATS.filter(k => Math.abs((e.estimated![k] ?? 0) - (e.before?.[k] ?? 0)) > (k.startsWith('critical') ? 0.0005 : 0.5)).map(k => <tr key={k}>
        <td>{STAT_SHORT[k] ?? k}</td><td className="muted">{fmtStat(k, e.before?.[k] ?? 0)}</td><td>{fmtStat(k, e.estimated![k])}</td>
        <td>{p.observed ? <b className={Math.abs(p.observed[k] - e.estimated![k]) <= (k.startsWith('critical') ? 0.002 : 1.5) ? 'up' : 'down'}>{fmtStat(k, p.observed[k])}</b> : '—'}</td>
      </tr>)}</tbody></table>}
    <button className="link" onClick={open}>Revisar en el optimizador</button>
  </li>
}
