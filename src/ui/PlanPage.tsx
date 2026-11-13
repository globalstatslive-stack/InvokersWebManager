import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock, ExternalLink, Info, ListChecks, MousePointerClick, RefreshCw, Send, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { useAccount } from './account'
import { Empty, NeedsAccount } from './common'
import { GameImg } from './Art'
import { fmtInt, fmtStat, SLOT_LABEL, STAT_SHORT, t } from '../box/i18n'
import { checkEntry, portalUrl, PORTAL_TEAM, progressOf, sharedPieces, tandasOf, TRACKED_STATS, usePlan, useSentTandas, type PlanEntry } from './plan'
import { MarkletInstall } from './Marklet'

const date = (s: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))

/** Plan: cambios elegidos, su envío al portal y la comprobación de lo aplicado al reimportar la caja. */
export function PlanPage() {
  const { account, go, records } = useAccount()
  const box = account?.box
  const { plan, remove, clear } = usePlan(box)
  // Nombre único por defecto: el marcador busca el preset por su nombre para cargarlo.
  const [name, setName] = useState(() => `Nexo ${new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date())}`)
  const rows = useMemo(() => plan.map(e => ({ e, p: progressOf(e, account?.index.heroes.get(e.heroId)) })), [plan, account])
  const { mark, isSent } = useSentTandas(box)
  // Solo se envía lo pendiente, en tandas de 5 (el optimizador oficial trabaja con 5 Invokers a la vez).
  const pending = useMemo(() => rows.filter(r => !r.p.done).map(r => r.e), [rows])
  const tandas = useMemo(() => tandasOf(pending), [pending])
  const shared = useMemo(() => sharedPieces(plan), [plan])
  const issues = useMemo(() => { const planned = new Set(plan.map(e => e.heroId)); return new Map(pending.map(e => [e.heroId, account ? checkEntry(e, account.index, planned) : []])) }, [pending, plan, account])
  if (!account) return <NeedsAccount />
  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.nexoExtension
  const gold = plan.reduce((s, e) => s + e.gold, 0), changes = plan.reduce((s, e) => s + e.changes, 0)
  const done = rows.filter(r => r.p.done).length
  const importedAt = account.record.importedAt
  return <div className="plan-page">
    <header className="goal-head"><ListChecks size={20} aria-hidden /><div><h1>Plan</h1><p>{plan.length ? `${plan.length} Invoker${plan.length === 1 ? '' : 's'} · ${changes} cambio${changes === 1 ? '' : 's'} · ~${fmtInt(gold)} de oro de desequipar · ${done} completado${done === 1 ? '' : 's'}` : 'Aún no has añadido cambios.'}</p></div></header>
    {!plan.length ? <Empty title="Tu plan está vacío" action={<button className="btn primary" onClick={() => go('/objetivo')}>Elegir un objetivo</button>}>Elige un objetivo o usa el optimizador y pulsa «Añadir al plan». Las piezas que reserves no se asignarán a otro Invoker.</Empty> : <>
      <ul className="plan-rows">{rows.map(({ e, p }) => <PlanRow key={e.heroId} e={e} p={p} remove={() => remove(e.heroId)} open={() => go(`/optimizador/${e.heroId}`)} />)}</ul>
      <section className="panel to-game">
        <div className="panel-title"><h2>Llevarlo al juego</h2><small>3 pasos · Nexo no equipa nada</small></div>
        <ol className="game-steps">
          <li><span className="step-n">1</span><div>
            {!pending.length ? <><b>Todo aplicado</b><p className="fine">Tu caja ya tiene todos los cambios del plan. Puedes vaciarlo o añadir más.</p></> : tandas.length === 1 ? <>
              <b>Envíalo a invokers.com</b>
              <p className="fine">Se abre el optimizador oficial con tus Invokers cargados y el plan dentro del enlace.</p>
              {(issues.get(pending[0].heroId) ?? []).length + pending.slice(1).reduce((s, e) => s + (issues.get(e.heroId)?.length ?? 0), 0) > 0 && <TandaIssues entries={pending} issues={issues} />}
              <div className="link-row">
                <input value={name} onChange={e => setName(e.target.value)} aria-label="Nombre del preset" maxLength={52} />
                <a className="btn primary" href={portalUrl(pending, name)} target="_blank" rel="noopener" referrerPolicy="strict-origin" onClick={() => mark(pending.map(e => e.heroId))}><Upload size={16} /> Enviar a invokers.com</a>
              </div>
            </> : <>
              <b>Envíalo en {tandas.length} tandas de {PORTAL_TEAM}</b>
              <p className="fine">El optimizador oficial trabaja con {PORTAL_TEAM} Invokers a la vez, así que Nexo divide tu plan en tandas, por orden de prioridad. Ninguna pieza está en dos tandas: el resultado es el mismo las hagas en el orden que las hagas. Termina cada tanda (marcador y «Equip all») antes de enviar la siguiente.</p>
              <label className="select tanda-name"><span>Nombre de los presets</span><input value={name} onChange={e => setName(e.target.value)} aria-label="Nombre de los presets" maxLength={52} /></label>
              <ol className="tandas">{tandas.map((tanda, i) => {
                const sent = tanda.every(isSent), errors = tanda.some(e => (issues.get(e.heroId) ?? []).some(x => x.severity === 'error'))
                const first = tandas.findIndex(x => !x.every(isSent)) === i
                return <li key={tanda.map(e => e.heroId).join('-')} className={`tanda ${sent ? 'sent' : ''} ${first ? 'next' : ''}`}>
                  <div className="tanda-head">
                    <b>Tanda {i + 1} de {tandas.length}</b>
                    <span className={`state ${sent ? 'geared' : 'bare'}`}>{sent ? <><Send size={12} /> Enviada</> : <><Clock size={12} /> Pendiente</>}</span>
                    <small>{tanda.reduce((s, e) => s + e.changes, 0)} cambios · {fmtInt(tanda.reduce((s, e) => s + e.gold, 0))} de oro</small>
                  </div>
                  <ul className="tanda-heroes">{tanda.map(e => <li key={e.heroId}><GameImg path={e.portrait} alt="" className="plan-portrait" /><span>{e.name}</span></li>)}</ul>
                  <TandaIssues entries={tanda} issues={issues} />
                  <a className={`btn ${first && !errors ? 'primary' : ''} ${errors ? 'disabled' : ''}`} aria-disabled={errors} href={errors ? undefined : portalUrl(tanda, `${name} · ${i + 1}/${tandas.length}`)} target="_blank" rel="noopener" referrerPolicy="strict-origin" onClick={() => !errors && mark(tanda.map(e => e.heroId))}><Upload size={15} /> {sent ? 'Volver a enviar' : 'Enviar'} tanda {i + 1}</a>
                </li>
              })}</ol>
              <p className="fine"><Info size={13} /> Cada tanda se guarda como un preset en tu cuenta («{name} · 1/{tandas.length}», …). El portal admite {50} presets: bórralos en la pestaña Presets cuando termines. Al reimportar tu caja, las tandas aplicadas desaparecen de aquí.</p>
            </>}
            {shared.length > 0 && <p className="note warn"><AlertTriangle size={15} /> Estas piezas están en dos Invokers del plan: {shared.join('; ')}. Quita a uno de ellos y vuelve a calcularlo antes de enviar.</p>}
          </div></li>
          <li><span className="step-n">2</span><div>
            <b>{hasExtension ? 'La extensión lo guarda y lo carga' : 'Pulsa tu marcador «Nexo» en esa pestaña'}</b>
            {hasExtension ? <p className="fine">Extensión de Nexo detectada: guarda el plan como preset y lo carga en el optimizador sin que hagas nada.</p> : <>
              <p className="fine">Lo guarda como preset de tu cuenta (categoría «Nexo»), abre la pestaña Presets y pulsa «Load» por ti. Te pide confirmación antes.</p>
              <details className="marklet-help"><summary><MousePointerClick size={14} /> ¿Aún no tienes el marcador? Instálalo una vez</summary>
                <p className="fine">En el ordenador, arrastra el botón a la barra de marcadores. Es el mismo que sirve para importar tu caja en vivo.</p>
                <MarkletInstall />
              </details>
              <p className="fine"><Info size={13} /> ¿Por qué hace falta pulsarlo? Por seguridad, ninguna web puede ejecutar nada dentro de invokers.com ni usar tu sesión: el marcador solo actúa cuando lo pulsas tú, en su página. La <a href="./nexo-extension.zip" download>extensión de Nexo</a> lo hace automático.</p>
            </>}
          </div></li>
          <li><span className="step-n">3</span><div>
            <b>Revisa y pulsa «Equip all» en el portal</b>
            <p className="fine"><ShieldCheck size={13} /> El portal muestra el oro de desequipar antes de confirmar. Si prefieres, haz los cambios a mano en el juego. <a href="https://invokers.com/guides/my-box-and-gear-optimizer/" target="_blank" rel="noreferrer">Guía oficial <ExternalLink size={11} /></a></p>
          </div></li>
        </ol>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>4 · Comprobar lo aplicado</h2><small>Caja importada el {date(importedAt)}</small></div>
        <p className="fine"><Info size={13} /> Haz los cambios en el juego, actualiza tu enlace en invokers.com («Refresh link») e impórtalo de nuevo: aquí verás qué cambios se aplicaron y las estadísticas observadas frente a las estimadas.</p>
        <button className="btn" onClick={() => go('/importar')}><RefreshCw size={15} /> Reimportar mi caja</button>
        {records.length < 2 && <p className="fine">Solo hay una importación: la comprobación tendrá sentido después de reimportar.</p>}
      </section>
      <div className="center"><button className="btn danger" onClick={() => { if (confirm('¿Vaciar el plan?')) clear() }}><Trash2 size={15} /> Vaciar plan</button></div>
    </>}
  </div>
}

function TandaIssues({ entries, issues }: { entries: PlanEntry[]; issues: Map<number, { severity: 'error' | 'warn'; text: string }[]> }) {
  const list = entries.flatMap(e => (issues.get(e.heroId) ?? []).map(x => ({ ...x, who: e.name })))
  if (!list.length) return <p className="tanda-ok"><Check size={13} /> Piezas comprobadas con tu última caja: todas siguen donde se esperaba.</p>
  return <ul className="tanda-issues">{list.map((x, i) => <li key={i} className={x.severity}><AlertTriangle size={13} /> <b>{x.who}</b> · {x.text}</li>)}</ul>
}

function PlanRow({ e, p, remove, open }: { e: PlanEntry; p: ReturnType<typeof progressOf>; remove: () => void; open: () => void }) {
  const status = p.done ? 'Aplicado' : p.applied.length ? `${p.applied.length}/${p.applied.length + p.pending.length} aplicados` : 'Pendiente'
  return <li className={`plan-row ${p.done ? 'done' : ''}`}>
    <header>
      <GameImg path={e.portrait} alt="" className="plan-portrait" />
      <span className="row-main"><b>{e.name}</b><small>{e.goal ? `${e.goal} · ` : ''}{e.changes} cambio{e.changes === 1 ? '' : 's'} · {fmtInt(e.gold)} oro · añadido el {date(e.at)}</small></span>
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
