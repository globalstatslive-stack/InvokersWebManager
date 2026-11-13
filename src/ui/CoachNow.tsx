import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, ArrowUpCircle, Lightbulb, Wand2, FlaskConical, LayoutGrid, ListChecks, Loader2, PackageCheck, Recycle, Repeat, ShieldCheck, Swords } from 'lucide-react'
import { ACCESSORY_SLOTS, fmtBonus, fmtInt, MODE_LABEL, RELIC_SLOTS, SLOT_LABEL, t } from '../box/i18n'
import { gainText, type GearAdvice } from '../box/gearCoach'
import { loadBosses, type BossCatalog } from '../box/goal'
import { useAccount } from './account'
import { useActiveTeams, teamKey } from './activeTeams'
import { progressOf, usePlan } from './plan'
import { useGearCoach } from './coach'

export type CoachAction = { id: string; icon: typeof ListChecks; title: string; why: ReactNode; items?: ReactNode[]; cta?: { label: string; to: string; before?: () => void }; extra?: ReactNode; urgent?: boolean }
const slotName = (s: string) => t(SLOT_LABEL, s).toLowerCase()
const pieceLine = (a: GearAdvice, text: string) => <><b>{a.owner?.name ?? a.best?.hero.name ?? a.gear.slot}</b> · {slotName(a.gear.slot)} {a.gear.rank}★ +{a.gear.level}: {text}</>

/** Acciones de la cuenta ordenadas por lo que más rinde ahora, cada una con su porqué. */
export function useCoachActions(): { actions: CoachAction[]; ready: boolean } {
  const { account } = useAccount()
  const coach = useGearCoach()
  const { plan } = usePlan(account?.box)
  const active = useActiveTeams(account?.box)
  const [bosses, setBosses] = useState<BossCatalog | null>(null)
  useEffect(() => { void loadBosses().then(setBosses).catch(() => undefined) }, [])
  const actions = useMemo(() => {
    if (!account) return []
    const { box, index } = account
    const out: CoachAction[] = []
    // 1) Enlace a punto de caducar: sin caja nueva, todo lo demás se queda viejo.
    const days = box.expiresAt ? Math.ceil((Date.parse(box.expiresAt) - Date.now()) / 86400000) : null
    if (days !== null && days <= 2) out.push({ id: 'link', icon: AlertTriangle, urgent: true, title: days > 0 ? `Renueva tu enlace: caduca en ${days} día${days > 1 ? 's' : ''}` : 'Tu enlace ha caducado',
      why: 'El enlace compartido es una instantánea: pulsa «Refresh link» en invokers.com para renovarlo otra semana y vuelve a importarlo para que el coach vea tu caja actual.', cta: { label: 'Importar de nuevo', to: '/importar' } })
    // 2) Plan sin aplicar.
    const pending = plan.map(e => ({ e, p: progressOf(e, index.heroes.get(e.heroId)) })).filter(x => !x.p.done)
    if (pending.length) out.push({ id: 'plan', icon: ListChecks, title: `Aplica tu plan: ${pending.reduce((s, x) => s + x.p.pending.length, 0)} cambios pendientes`,
      why: `Ya decidiste estos cambios para ${pending.map(x => x.e.name).join(', ')}. Envíalos a invokers.com, cárgalos con el marcador y confirma en el portal; luego reimporta para comprobarlos.`, cta: { label: 'Ir al plan', to: '/plan' } })
    // 3) Sin equipos activos, el coach no sabe en quién centrarse.
    if (!active.teams.length && box.teams.length) out.push({ id: 'active', icon: ShieldCheck, title: 'Marca los equipos que sigues usando',
      why: `El coach prioriza a sus Invokers (subidas, piezas, protección). Sin ninguno marcado, se centra en tus 10 más fuertes, que quizá no son los que juegas.`,
      extra: <details className="protect"><summary>Elegir equipos ({box.teams.length})</summary><ul className="protect-list">{box.teams.map(tm => <li key={teamKey(tm)}><label className="check"><input type="checkbox" checked={active.isActive(tm)} onChange={() => active.toggle(tm)} /> {t(MODE_LABEL, tm.mode)} · {tm.label}{tm.detail ? ` (${tm.detail})` : ''}{tm.difficulty ? ` · ${tm.difficulty}` : ''}</label></li>)}</ul></details> })
    // 4) Ranuras vacías en los Invokers en los que te centras.
    const focus = coach?.ctx.focus ?? []
    const empty = focus.map(h => ({ h, relics: RELIC_SLOTS.filter(s => !h.relics[s]), acc: ACCESSORY_SLOTS.filter(s => h.awakeLevel >= (box.accessorySlotAwake[s] ?? 99) && !h.accessories[s]) })).filter(x => x.relics.length + x.acc.length > 0)
    const nEmpty = empty.reduce((s, x) => s + x.relics.length + x.acc.length, 0)
    if (empty.length) out.push({ id: 'empty', icon: LayoutGrid, title: nEmpty === 1 ? 'Rellena 1 ranura vacía' : `Rellena ${nEmpty} ranuras vacías`,
      why: 'Una ranura vacía no aporta nada: cualquier pieza decente suma, y el optimizador elige la mejor entre las libres.',
      items: empty.slice(0, 4).map(x => <><b>{x.h.name}</b>: {[...x.relics.map(s => t(SLOT_LABEL, s)), ...x.acc.map(s => `${t(SLOT_LABEL, s)} (accesorio)`)].join(', ')}</>), cta: { label: `Optimizar a ${empty[0].h.name}`, to: `/optimizador/${empty[0].h.id}` } })
    if (coach) {
      const byV = (v: GearAdvice['verdict'], f: (a: GearAdvice) => boolean = () => true) => coach.advice.filter(a => a.verdict === v && f(a))
      const imp = (a: GearAdvice) => a.important || (!!a.best && coach.ctx.important.has(a.best.hero.id))
      const equip = byV('equip'), equipImp = equip.filter(imp)
      if (equip.length) out.push({ id: 'equip', icon: PackageCheck, title: `Equipa ${equipImp.length ? `${equipImp.length} piezas libres que mejoran a tus equipos` : `${equip.length} piezas libres que ya mejoran a tus Invokers`}`,
        why: 'Ganancia inmediata sin gastar recursos de subida, solo el oro de desequipar si la pieza estaba puesta (aquí están libres). Una pieza por Invoker y ranura, la que más le da.',
        items: (equipImp.length ? equipImp : equip).slice(0, 3).map(a => pieceLine(a, gainText(a.best!))), cta: { label: 'Ver todas', to: '/asesor/piezas/equip' } })
      const up = byV('upgrade'), upImp = up.filter(a => a.important)
      if (up.length) out.push({ id: 'upgrade', icon: ArrowUpCircle, title: `Sube ${upImp.length ? `${upImp.length} piezas de tus equipos activos y tu plan` : `${up.length} piezas equipadas`}`,
        why: 'Ya las llevan Invokers que usas: cada nivel sube la principal y cada hito (+5, +10, +15, +20) desbloquea o mejora una subestadística.',
        items: (upImp.length ? upImp : up).slice(0, 3).map(a => pieceLine(a, a.gear.mainAtMax ? `principal ${fmtBonus(a.gear.main.stat, a.gear.main.mode, a.gear.main.value)} → ${fmtBonus(a.gear.mainAtMax.stat, a.gear.mainAtMax.mode, a.gear.mainAtMax.value)} al +20` : 'sube su principal')), cta: { label: 'Ver todas', to: '/asesor/piezas/upgrade' } })
      const rep = byV('replace', a => a.important)
      if (rep.length) out.push({ id: 'replace', icon: Repeat, title: `No inviertas en ${rep.length} piezas de 3★ o menos`,
        why: 'El rango no se puede subir y fija el valor de cada tirada: cada nivel rinde más en una pieza libre de más rango para esa ranura.', items: rep.slice(0, 3).map(a => pieceLine(a, 'cámbiala por una de más rango')), cta: { label: 'Ver todas', to: '/asesor/piezas/replace' } })
      const test = byV('test')
      if (test.length) out.push({ id: 'test', icon: FlaskConical, title: `Prueba ${test.length} piezas con futuro hasta su siguiente hito`,
        why: 'Subidas a +20 mejorarían a tus equipos (estimación con tiradas medias). Súbelas solo hasta el próximo hito, mira dónde cae la mejora y decide: así no gastas en piezas que no salen bien.',
        items: test.slice(0, 3).map(a => <><b>{a.title}</b> · {slotName(a.gear.slot)} {a.gear.rank}★: {a.why}</>), cta: { label: 'Ver todas', to: '/asesor/piezas/test' } })
      const sell = byV('sell')
      if (sell.length) out.push({ id: 'sell', icon: Recycle, title: `Haz limpieza: ${fmtInt(sell.length)} piezas sin futuro`,
        why: 'Vender da oro y triturar da Memorium, justo lo que cuestan las subidas de arriba. Ninguna de estas mejora a tus Invokers ni subida a +20.', cta: { label: 'Revisarlas', to: '/asesor/piezas/sell' } })
    }
    // 5) Siguiente fase de los jefes en los que tienes récord.
    if (bosses) {
      const records = box.teams.filter(tm => tm.mode === 'dungeon').map(tm => ({ tm, boss: bosses.bosses.find(b => b.slug === tm.key) })).filter(x => x.boss && x.tm.highestLevel < x.boss.stages.length)
        .sort((a, b) => Number(active.isActive(b.tm)) - Number(active.isActive(a.tm)) || b.tm.highestLevel - a.tm.highestLevel)
      const first = records[0]
      if (first) out.push({ id: 'boss', icon: Swords, title: `Siguiente reto: ${first.boss!.name}, fase ${first.tm.highestLevel + 1}`,
        why: 'Tu récord está en la fase anterior. El equipo para un jefe te dice quién encaja por la tier list oficial, sus habilidades y su elemento, y qué le falta.',
        items: records.slice(0, 3).map(x => <><b>{x.boss!.name}</b>: récord fase {x.tm.highestLevel} de {x.boss!.stages.length}</>),
        cta: { label: 'Ver equipo recomendado', to: '/asesor/equipo', before: () => { try { localStorage.setItem('nexo.teamfinder', JSON.stringify({ boss: first.boss!.slug, stage: first.tm.highestLevel + 1 })) } catch { /* sin almacenamiento */ } } } })
    }
    return out
  }, [account, coach, plan, active, bosses])
  return { actions, ready: !!coach }
}

/** Coach › Qué hacer ahora. */
export function CoachNow({ limit }: { limit?: number }) {
  const { account, go } = useAccount()
  const { actions, ready } = useCoachActions()
  if (!account) return null
  const shown = limit ? actions.slice(0, limit) : actions
  return <section className="coach-now">
    {!limit && <p className="lead">Lo que más rinde ahora en tu cuenta, en orden. Cada paso dice por qué; ábrelo para ver el detalle. Nada se ejecuta en el juego.</p>}
    <ol className="action-list">{shown.map((a, i) => <li key={a.id} className={`action ${a.urgent ? 'urgent' : ''}`}>
      <span className="action-n">{i + 1}</span>
      <div className="action-body">
        <h3><a.icon size={17} aria-hidden /> {a.title}</h3>
        <p>{a.why}</p>
        {a.items && <ul className="action-items">{a.items.map((it, j) => <li key={j}>{it}</li>)}</ul>}
        {a.extra}
        {a.cta && <button className="btn small" onClick={() => { a.cta!.before?.(); go(a.cta!.to) }}>{a.cta.label} <ArrowRight size={14} /></button>}
      </div>
    </li>)}</ol>
    {!ready && <p className="muted"><Loader2 size={14} className="spin" /> Analizando tus piezas…</p>}
    {ready && !actions.length && <p className="muted">Nada urgente: tu cuenta está al día. Elige un jefe en «Equipo para un jefe» para el siguiente reto.</p>}
    {limit && actions.length > limit && <button className="link" onClick={() => go('/asesor')}>Ver los {actions.length} pasos <ArrowRight size={14} /></button>}
  </section>
}

/** Portada del coach en Inicio. */
export function CoachCard() {
  const { go } = useAccount()
  return <section className="panel coach-card">
    <div className="panel-title"><h2>Tu coach: qué hacer ahora</h2><button className="link" onClick={() => go('/asesor')}>Abrir el coach <ArrowRight size={15} /></button></div>
    <CoachNow limit={3} />
  </section>
}

/** Contadores del coach para los accesos rápidos de Inicio. */
export function CoachQuick() {
  const { go } = useAccount()
  const coach = useGearCoach()
  return <>
    <button onClick={() => go('/asesor/piezas/upgrade')}><Wand2 size={18} /><b>{coach ? fmtInt(coach.counts.upgrade) : '…'}</b><small>para subir</small></button>
    <button onClick={() => go('/asesor/piezas/sell')}><Lightbulb size={18} /><b>{coach ? fmtInt(coach.counts.sell) : '…'}</b><small>para vender</small></button>
  </>
}
