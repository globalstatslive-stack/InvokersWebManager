import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Clock, Gem, LayoutGrid, Lightbulb, ListChecks, Target, Trophy, Wand2 } from 'lucide-react'
import { useAccount } from './account'
import { fmtPower, StalePowerNote } from './common'
import { ElementIcon, Portrait, Stars } from './Art'
import { CLASS_LABEL, ELEMENT_LABEL, fmtInt, t } from '../box/i18n'
import { sellCandidates, upgradeQueue } from '../box/advisor'
import { ImportPage } from './ImportPage'
import { progressOf, usePlan } from './plan'
import { useActiveTeams } from './activeTeams'

const date = (s: string | null) => s ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) : '—'
export function Dashboard() {
  const { account, go } = useAccount()
  const { plan } = usePlan(account?.box)
  const active = useActiveTeams(account?.box)
  const data = useMemo(() => {
    if (!account) return null
    const { box, index } = account
    const heroes = [...box.heroes].sort((a, b) => b.power - a.power)
    const free = [...box.relics, ...box.accessories].filter(g => g.equippedHeroId === null).length
    return { heroes, free, sell: sellCandidates(box).length, upgrades: upgradeQueue(box, index).length }
  }, [account])
  if (!account || !data) return <ImportPage />
  const { box } = account
  const goal = (() => { try { return JSON.parse(localStorage.getItem(`nexo.goal.${box.profile.name}`) ?? 'null') as { boss?: string; stage?: number; team?: number[] } | null } catch { return null } })()
  const done = plan.filter(e => progressOf(e, account.index.heroes.get(e.heroId)).done).length
  const days = box.expiresAt ? Math.ceil((Date.parse(box.expiresAt) - Date.now()) / 86400000) : null
  const official = account.record.source === 'official-link'
  return <div className="dash v2">
    <section className="account-strip">
      <div>
        <h1>{box.profile.name}{box.profile.clan && <small> [{box.profile.clan}]</small>}</h1>
        <p><Trophy size={14} aria-hidden /> <b>{fmtInt(box.profile.totalPower || box.heroes.reduce((s, h) => s + h.power, 0))}</b> de poder · nivel {box.profile.level}</p>
        <p className="muted"><Clock size={13} aria-hidden /> {official ? `Instantánea del ${date(box.snapshotAt ?? account.record.importedAt)}` : `Carpeta del juego leída el ${date(account.record.importedAt)}`}</p>
      </div>
      {days !== null && <span className={`expiry ${days <= 2 ? 'warn' : ''}`}>{days > 0 ? `El enlace caduca en ${days} día${days > 1 ? 's' : ''}` : 'El enlace ha caducado'}</span>}
    </section>
    {days !== null && days <= 2 && <p className="note warn"><AlertTriangle size={15} /> Pulsa «Refresh link» en invokers.com para renovar el enlace otra semana y vuelve a importarlo.</p>}

    <section className="next-grid">
      <button className="next-card primary" onClick={() => go('/objetivo')}>
        <Target size={20} aria-hidden /><span><b>{goal?.boss ? 'Tu objetivo' : 'Elige un objetivo'}</b><small>{goal?.boss ? `${goal.boss.replace(/-/g, ' ')}${goal.stage ? ` · fase ${goal.stage}` : ''} · ${goal.team?.length || 'equipo del récord'}` : 'Qué jefe y fase quieres superar: diagnóstico, planes y coste.'}</small></span><ArrowRight size={17} aria-hidden />
      </button>
      <button className="next-card" onClick={() => go('/plan')}>
        <ListChecks size={20} aria-hidden /><span><b>Tu plan</b><small>{plan.length ? `${plan.length} Invokers · ${done} aplicados en el juego` : 'Vacío: añade cambios desde el objetivo o el optimizador.'}</small></span><ArrowRight size={17} aria-hidden />
      </button>
      <button className="next-card" onClick={() => go('/objetivo')}>
        <LayoutGrid size={20} aria-hidden /><span><b>Equipos activos</b><small>{active.teams.length ? `${active.teams.length} protegidos: sus piezas no se tocan` : 'Ninguno marcado: elige cuáles sigues usando.'}</small></span><ArrowRight size={17} aria-hidden />
      </button>
    </section>

    <section className="quick">
      <button onClick={() => go('/coleccion')}><LayoutGrid size={18} /><b>{box.heroes.length}</b><small>Invokers</small></button>
      <button onClick={() => go('/coleccion/piezas')}><Gem size={18} /><b>{data.free}</b><small>piezas libres</small></button>
      <button onClick={() => go('/asesor/mejoras')}><Wand2 size={18} /><b>{data.upgrades}</b><small>sin subir</small></button>
      <button onClick={() => go('/asesor/venta')}><Lightbulb size={18} /><b>{data.sell}</b><small>para revisar</small></button>
    </section>

    <section className="panel">
      <div className="panel-title"><h2>Tus más fuertes</h2><button className="link" onClick={() => go('/coleccion')}>Ver todos <ArrowRight size={15} /></button></div>
      <div className="top-list">{data.heroes.slice(0, 6).map((h, i) => <button key={h.id} className="top-row" onClick={() => go(`/invoker/${h.id}`)}>
        <span className="rank-n">{i + 1}</span><Portrait c={h} size="sm" />
        <span className="top-name"><b>{h.name}</b><small><ElementIcon element={h.element} /> {t(ELEMENT_LABEL, h.element)} · {t(CLASS_LABEL, h.cls)}</small></span>
        <span className="top-power"><Stars n={h.rank} /><b>{fmtPower(h)}</b></span>
      </button>)}</div>
      <StalePowerNote />
    </section>
  </div>
}
