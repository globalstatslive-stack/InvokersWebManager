import { useMemo, useState } from 'react'
import { ShieldCheck, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useAccount } from './account'
import { Empty, PageHead } from './common'
import { Portrait } from './Art'
import { fmtInt } from '../box/i18n'
import { clearImports } from '../data'
import { folderPreference } from '../folderSync'

const date = (s: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))
export function DataPage() {
  const { account, previous, records, reload, go } = useAccount()
  const [busy, setBusy] = useState(false)
  const diff = useMemo(() => {
    if (!account || !previous) return null
    const before = new Map(previous.box.heroes.map(h => [h.id, h]))
    const changes = account.box.heroes.map(h => ({ h, old: before.get(h.id) })).filter(x => !x.old || x.old.power !== x.h.power || x.old.level !== x.h.level || x.old.rank !== x.h.rank)
      .sort((a, b) => (b.h.power - (b.old?.power ?? 0)) - (a.h.power - (a.old?.power ?? 0)))
    const gearBefore = new Set([...previous.box.relics, ...previous.box.accessories].map(g => `${g.kind}${g.id}`))
    const gearNow = new Set([...account.box.relics, ...account.box.accessories].map(g => `${g.kind}${g.id}`))
    const power = (a: typeof account) => a.box.heroes.reduce((s, h) => s + h.power, 0)
    return { changes, newGear: [...gearNow].filter(k => !gearBefore.has(k)).length, goneGear: [...gearBefore].filter(k => !gearNow.has(k)).length, gone: previous.box.heroes.filter(h => !account.index.heroes.has(h.id)).length, power: power(account) - power(previous) }
  }, [account, previous])
  async function erase() {
    if (!confirm('¿Borrar todas las cuentas importadas en este navegador? No afecta al juego.')) return
    setBusy(true)
    try { await clearImports(); await folderPreference(null); await reload(); go('/') } finally { setBusy(false) }
  }
  return <>
    <PageHead kicker="Tus datos" title="Historial y privacidad">Se guardan hasta cinco importaciones en este navegador para ver tu progreso. Nada se envía a ningún servidor de Nexo.</PageHead>
    {!records.length ? <Empty title="Sin importaciones" /> : <>
      {diff ? <section className="panel">
        <div className="panel-title"><h2>Desde la importación anterior</h2><small>{date(previous!.record.importedAt)} → {date(account!.record.importedAt)}</small></div>
        <div className="kpis small">
          <div className="kpi static"><span className="kpi-label">Poder</span><b className={diff.power >= 0 ? 'up' : 'down'}>{diff.power >= 0 ? '+' : ''}{fmtInt(diff.power)}</b></div>
          <div className="kpi static"><span className="kpi-label">Invokers cambiados</span><b>{diff.changes.length}</b></div>
          <div className="kpi static"><span className="kpi-label">Piezas nuevas</span><b>{diff.newGear}</b></div>
          <div className="kpi static"><span className="kpi-label">Piezas fuera</span><b>{diff.goneGear}</b></div>
        </div>
        <div className="top-list">{diff.changes.slice(0, 40).map(({ h, old }) => <button key={h.id} className="top-row" onClick={() => go(`/invoker/${h.id}`)}>
          <Portrait c={h} size="sm" /><span className="top-name"><b>{h.name}</b><small>{old ? `Nv. ${old.level}→${h.level} · ${old.rank}★→${h.rank}★` : 'Nuevo'}</small></span>
          <span className="top-power">{old && h.power !== old.power ? <b className={h.power > old.power ? 'up' : 'down'}>{h.power > old.power ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {h.power > old.power ? '+' : ''}{fmtInt(h.power - old.power)}</b> : <b>{fmtInt(h.power)}</b>}</span>
        </button>)}</div>
      </section> : <section className="panel"><p className="muted">Importa de nuevo más adelante (pulsa «Refresh link» en el portal) para ver aquí tu progreso.</p></section>}
      <section className="panel">
        <div className="panel-title"><h2>Importaciones guardadas</h2></div>
        <ul className="records">{records.map((r, i) => <li key={r.id}><b>{date(r.importedAt)}</b>{i === 0 && <span className="badge">actual</span>}<small>{r.source === 'official-link' ? `Caja oficial${r.summary ? ` · ${r.summary.name} · ${r.summary.heroes} Invokers · ${r.summary.gear} piezas` : ''}` : `${r.files.length} snapshots .dat${r.collection ? ` · ${r.collection.invokers.length} Invokers` : ''}`}</small></li>)}</ul>
      </section>
    </>}
    <section className="panel privacy">
      <ShieldCheck size={22} />
      <div><h3>Privacidad</h3><p>Tu caja se descarga desde invokers.com y se guarda solo en este navegador (IndexedDB). El marcador mágico no envía datos a terceros: abre esta web y le pasa la caja directamente. Puedes borrarlo todo cuando quieras.</p>
        <button className="btn danger" disabled={busy || !records.length} onClick={erase}><Trash2 size={16} /> Borrar todos los datos</button></div>
    </section>
  </>
}
