import { useMemo } from 'react'
import { ArrowRight, Clock3, Gem, Shield, Sparkles, Swords, Trophy, Wand2 } from 'lucide-react'
import { useAccount } from './account'
import { Meter } from './common'
import { ImportPage } from './ImportPage'
import { ElementIcon, FactionIcon, GameImg, Portrait, Stars } from './Art'
import { CLASS_LABEL, ELEMENT_LABEL, fmtInt, RARITIES, RARITY_LABEL, t } from '../box/i18n'
import { diagnose, sellCandidates, teamHeroIds, upgradeQueue } from '../box/advisor'

const date = (s: string | null) => s ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) : '—'
export function Dashboard() {
  const { account, go } = useAccount()
  const data = useMemo(() => {
    if (!account) return null
    const { box, index } = account
    const heroes = [...box.heroes].sort((a, b) => b.power - a.power)
    const rarity = RARITIES.map(r => ({ r, n: box.heroes.filter(h => h.rarity === r).length })).filter(x => x.n)
    const factions = [...new Set(box.heroes.map(h => h.faction))].map(f => ({ f, n: box.heroes.filter(h => h.faction === f).length, power: box.heroes.filter(h => h.faction === f).reduce((s, h) => s + h.power, 0) })).sort((a, b) => b.power - a.power)
    const team = teamHeroIds(box)
    const issues = heroes.filter(h => team.has(h.id)).map(h => ({ h, issues: diagnose(box, index, h).filter(i => i.severity >= 2) })).filter(x => x.issues.length)
    const free = [...box.relics, ...box.accessories].filter(g => g.equippedHeroId === null).length
    return { heroes, rarity, factions, issues, free, sell: sellCandidates(box).length, upgrades: upgradeQueue(box, index).length, geared: box.heroes.filter(h => Object.keys(h.relics).length).length }
  }, [account])
  if (!account || !data) return <ImportPage />
  const { box } = account
  const top = data.heroes.slice(0, 8)
  const expires = box.expiresAt ? Math.ceil((Date.parse(box.expiresAt) - Date.now()) / 86400000) : null
  return <div className="dash">
    <section className="profile-hero">
      <div className="profile-art">{top.slice(0, 3).map((h, i) => <GameImg key={h.id} path={h.portrait} alt="" className={`bg-portrait p${i}`} />)}</div>
      <div className="profile-copy">
        <span className="kicker">Tu cuenta</span>
        <h1>{box.profile.name}{box.profile.clan && <small> [{box.profile.clan}]</small>}</h1>
        <p>Nivel {box.profile.level} · Instantánea del {date(box.snapshotAt ?? account.record.importedAt)}{expires !== null && <> · el enlace caduca {expires > 0 ? `en ${expires} días` : 'hoy'}</>}</p>
        <div className="power"><Trophy size={22} /><b>{fmtInt(box.profile.totalPower || box.heroes.reduce((s, h) => s + h.power, 0))}</b><span>poder total</span></div>
      </div>
    </section>
    <section className="kpis">
      <Kpi icon={<Sparkles />} label="Invokers" value={box.heroes.length} sub={`${data.geared} equipados`} onClick={() => go('/invokers')} />
      <Kpi icon={<Shield />} label="Titanes" value={box.titans.length} sub={`${box.titans.filter(x => x.rank >= 5).length} de rango 5`} onClick={() => go('/titanes')} />
      <Kpi icon={<Gem />} label="Piezas" value={box.relics.length + box.accessories.length} sub={`${data.free} libres`} onClick={() => go('/equipo')} />
      <Kpi icon={<Swords />} label="Equipos" value={box.teams.length} sub="registros de combate" onClick={() => go('/equipos')} />
    </section>
    <section className="grid-2">
      <div className="panel">
        <div className="panel-title"><h2>Tus más fuertes</h2><button className="link" onClick={() => go('/invokers')}>Ver todos <ArrowRight size={15} /></button></div>
        <div className="top-list">{top.map((h, i) => <button key={h.id} className="top-row" onClick={() => go(`/invoker/${h.id}`)}>
          <span className="rank-n">{i + 1}</span><Portrait c={h} size="sm" />
          <span className="top-name"><b>{h.name}</b><small><ElementIcon element={h.element} /> {t(ELEMENT_LABEL, h.element)} · {t(CLASS_LABEL, h.cls)}</small></span>
          <span className="top-power"><Stars n={h.rank} /><b>{fmtInt(h.power)}</b></span>
        </button>)}</div>
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Qué hacer ahora</h2></div>
        <div className="todo">
          <Todo icon={<Wand2 />} title="Optimizar a tu mejor Invoker" text={`Calcula la mejor build exacta para ${data.heroes[0]?.name ?? 'un Invoker'} con tu inventario.`} onClick={() => go(`/optimizador/${data.heroes[0]?.id ?? ''}`)} />
          <Todo icon={<Clock3 />} title={`${data.upgrades} piezas equipadas sin subir`} text="Ordenadas por el poder del Invoker que las lleva." onClick={() => go('/asesor/mejoras')} />
          <Todo icon={<Gem />} title={`${data.sell} candidatas a venta`} text="Piezas libres de bajo valor con el motivo de cada recomendación." onClick={() => go('/asesor/venta')} />
          <Todo icon={<Shield />} title={`${data.issues.length} Invokers de tus equipos con carencias`} text={data.issues.slice(0, 3).map(x => x.h.name).join(', ') || 'Todo en orden'} onClick={() => go('/asesor/revision')} />
        </div>
      </div>
    </section>
    <section className="grid-2">
      <div className="panel">
        <div className="panel-title"><h2>Rareza</h2></div>
        {data.rarity.map(x => <div className="bar-row" key={x.r}><span className={`dot r-${x.r.toLowerCase()}`} />{t(RARITY_LABEL, x.r)}<Meter value={x.n} max={box.heroes.length} tone={`r-${x.r.toLowerCase()}`} /><b>{x.n}</b></div>)}
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Facciones por poder</h2></div>
        {data.factions.map(x => <div className="bar-row" key={x.f}><FactionIcon faction={x.f} />{x.f}<Meter value={x.power} max={data.factions[0].power} /><b>{fmtInt(x.power)}</b></div>)}
      </div>
    </section>
  </div>
}
function Kpi({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: number; sub: string; onClick: () => void }) {
  return <button className="kpi" onClick={onClick}><span className="kpi-icon">{icon}</span><span className="kpi-label">{label}</span><b>{fmtInt(value)}</b><small>{sub}</small></button>
}
function Todo({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return <button className="todo-row" onClick={onClick}><span className="todo-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><ArrowRight size={17} /></button>
}
