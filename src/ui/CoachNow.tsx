import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, ArrowUpCircle, FlaskConical, Gem, GraduationCap, LayoutGrid, Lightbulb, ListChecks, Loader2, PackageCheck, Recycle, Repeat, ShieldCheck, Star, Swords, Users, Wand2 } from 'lucide-react'
import { ACCESSORY_SLOTS, fmtBonus, fmtInt, MODE_LABEL, RELIC_SLOTS, SLOT_LABEL, t } from '../box/i18n'
import { gainText, type GearAdvice } from '../box/gearCoach'
import { ASCENSION } from '../box/ascension'
import { loadBosses, type BossCatalog } from '../box/goal'
import { useAccount } from './account'
import { useActiveTeams, teamKey } from './activeTeams'
import { progressOf, usePlan } from './plan'
import { useGearCoach } from './coach'
import { useAscend } from './AscendCoach'

/** Un paso del coach: qué hacer (título), por qué en una frase, y una mini-lección opcional para quien empieza. */
export type CoachAction = { id: string; icon: typeof ListChecks; title: string; why: ReactNode; learn?: ReactNode; items?: ReactNode[]; cta?: { label: string; to: string; before?: () => void }; extra?: ReactNode; urgent?: boolean }
const slotName = (s: string) => t(SLOT_LABEL, s).toLowerCase()
const pieceLine = (a: GearAdvice, text: string) => <><b>{a.owner?.name ?? a.best?.hero.name ?? a.gear.slot}</b> · {slotName(a.gear.slot)} {a.gear.rank}★ +{a.gear.level}: {text}</>
const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`

type NextBoss = { slug: string; name: string; record: number; stages: number }
function useNextBosses(): NextBoss[] {
  const { account } = useAccount()
  const active = useActiveTeams(account?.box)
  const [bosses, setBosses] = useState<BossCatalog | null>(null)
  useEffect(() => { void loadBosses().then(setBosses).catch(() => undefined) }, [])
  return useMemo(() => {
    if (!account || !bosses) return []
    return account.box.teams.filter(tm => tm.mode === 'dungeon').map(tm => ({ tm, boss: bosses.bosses.find(b => b.slug === tm.key) })).filter(x => x.boss && x.tm.highestLevel < x.boss.stages.length)
      .sort((a, b) => Number(active.isActive(b.tm)) - Number(active.isActive(a.tm)) || b.tm.highestLevel - a.tm.highestLevel)
      .map(x => ({ slug: x.boss!.slug, name: x.boss!.name, record: x.tm.highestLevel, stages: x.boss!.stages.length }))
  }, [account, bosses, active])
}
const openBoss = (b: NextBoss) => () => { try { localStorage.setItem('nexo.teamfinder', JSON.stringify({ boss: b.slug, stage: b.record + 1 })) } catch { /* sin almacenamiento */ } }

/** Pasos de la cuenta ordenados por lo que más rinde ahora, cada uno con su porqué. */
export function useCoachActions(): { actions: CoachAction[]; ready: boolean } {
  const { account } = useAccount()
  const coach = useGearCoach()
  const ascend = useAscend()
  const { plan } = usePlan(account?.box)
  const active = useActiveTeams(account?.box)
  const nextBosses = useNextBosses()
  const actions = useMemo(() => {
    if (!account) return []
    const { box, index } = account
    const out: CoachAction[] = []
    // Enlace a punto de caducar: sin caja nueva, todo lo demás se queda viejo.
    const days = box.expiresAt ? Math.ceil((Date.parse(box.expiresAt) - Date.now()) / 86400000) : null
    if (days !== null && days <= 2) out.push({ id: 'link', icon: AlertTriangle, urgent: true, title: days > 0 ? `Renueva tu enlace: caduca en ${days} día${days > 1 ? 's' : ''}` : 'Tu enlace ha caducado',
      why: 'Sin una caja reciente, el coach te aconseja con datos viejos.',
      learn: 'El enlace compartido es una foto de tu cuenta. Pulsa «Refresh link» en invokers.com para actualizarla y renovarla una semana, y vuelve a importarla aquí.', cta: { label: 'Importar de nuevo', to: '/importar' } })
    // Sin equipos activos, el coach no sabe en quién centrarse.
    if (!active.teams.length && box.teams.length) out.push({ id: 'active', icon: ShieldCheck, title: 'Dile al coach a quién juegas',
      why: 'Marca los equipos que sigues usando: el coach centrará en ellos las subidas y protegerá sus piezas.',
      learn: 'Los equipos que guarda el juego son récords antiguos y puede que ya no los uses. Mientras no marques ninguno, el coach se guía por tus 10 Invokers más fuertes.',
      extra: <details className="protect"><summary>Elegir equipos ({box.teams.length})</summary><ul className="protect-list">{box.teams.map(tm => <li key={teamKey(tm)}><label className="check"><input type="checkbox" checked={active.isActive(tm)} onChange={() => active.toggle(tm)} /> {t(MODE_LABEL, tm.mode)} · {tm.label}{tm.detail ? ` (${tm.detail})` : ''}{tm.difficulty ? ` · ${tm.difficulty}` : ''}</label></li>)}</ul></details> })
    // Plan sin aplicar.
    const pending = plan.map(e => ({ e, p: progressOf(e, index.heroes.get(e.heroId)) })).filter(x => !x.p.done)
    if (pending.length) out.push({ id: 'plan', icon: ListChecks, title: `Aplica tu plan: ${plural(pending.reduce((s, x) => s + x.p.pending.length, 0), 'cambio pendiente', 'cambios pendientes')}`,
      why: `Ya decidiste estos cambios para ${pending.map(x => x.e.name).join(', ')}: solo falta hacerlos en el juego.`,
      learn: 'Desde Plan los envías a invokers.com, los cargas con tu marcador y confirmas en el portal. Al reimportar tu caja, Nexo comprueba qué se aplicó.', cta: { label: 'Ir al plan', to: '/plan' } })
    // Ranuras vacías en los Invokers en los que te centras.
    const focus = coach?.ctx.focus ?? []
    const empty = focus.map(h => ({ h, relics: RELIC_SLOTS.filter(s => !h.relics[s]), acc: ACCESSORY_SLOTS.filter(s => h.awakeLevel >= (box.accessorySlotAwake[s] ?? 99) && !h.accessories[s]) })).filter(x => x.relics.length + x.acc.length > 0)
    const nEmpty = empty.reduce((s, x) => s + x.relics.length + x.acc.length, 0)
    if (empty.length) out.push({ id: 'empty', icon: LayoutGrid, title: nEmpty === 1 ? 'Rellena 1 ranura vacía' : `Rellena ${nEmpty} ranuras vacías`,
      why: 'Una ranura vacía no da nada: cualquier pieza decente suma.',
      learn: 'Cada Invoker lleva 8 reliquias y hasta 5 accesorios (las ranuras de accesorio se abren con el despertar). El optimizador elige la mejor pieza libre para cada hueco.',
      items: empty.slice(0, 4).map(x => <><b>{x.h.name}</b>: {[...x.relics.map(s => t(SLOT_LABEL, s)), ...x.acc.map(s => `${t(SLOT_LABEL, s)} (accesorio)`)].join(', ')}</>), cta: { label: `Optimizar a ${empty[0].h.name}`, to: `/optimizador/${empty[0].h.id}` } })
    const byV = (v: GearAdvice['verdict'], f: (a: GearAdvice) => boolean = () => true) => coach ? coach.advice.filter(a => a.verdict === v && f(a)) : []
    if (coach) {
      const imp = (a: GearAdvice) => a.important || (!!a.best && coach.ctx.important.has(a.best.hero.id))
      const equip = byV('equip'), equipImp = equip.filter(imp)
      if (equip.length) out.push({ id: 'equip', icon: PackageCheck, title: `Equipa ${plural((equipImp.length ? equipImp : equip).length, 'pieza libre que ya mejora', 'piezas libres que ya mejoran')} a ${equipImp.length ? 'tus equipos' : 'tus Invokers'}`,
        why: 'Es la mejora más barata: las tienes en el inventario y ponerlas no gasta recursos de subida.',
        learn: 'Equipar una pieza libre en un hueco es gratis. Lo que cuesta oro es desequipar una pieza que ya lleva alguien, así que conviene ponerlas solo en los Invokers que usas. Desde la lista puedes preparar un lote con todas y añadirlo al Plan.',
        items: (equipImp.length ? equipImp : equip).slice(0, 3).map(a => pieceLine(a, gainText(a.best!))), cta: { label: 'Equipar todo de una vez', to: '/asesor/piezas/equip' } })
    }
    // Subir de estrellas al Invoker que más rinde.
    const top6 = ascend?.six[0], top5 = ascend?.five[0]
    const canSix = ascend ? Math.floor(ascend.craft5.units / ASCENSION.cost(5)) : 0, canFive = ascend ? Math.floor(ascend.craft4.units / ASCENSION.cost(4)) : 0
    const pick = top6 && (canSix > 0 || !top5) ? top6 : top5 ?? top6
    if (ascend && pick) {
      const can = pick.to === 6 ? canSix : canFive
      out.push({ id: 'ascend', icon: Star, title: `Sube a ${pick.hero.name} a ${pick.to}★`,
        why: pick.teams.length ? `Es de los que más usas (${plural(pick.teams.length, 'equipo')}${pick.tier ? ` y ${pick.tier.tier} en la tier list oficial` : ''}): es a quien más se le nota.` : `Es tu mejor candidato por la tier list oficial${pick.tier ? ` (${pick.tier.tier})` : ''}.`,
        learn: <>Las estrellas fijan el tope de nivel: {pick.from}★ llega al {ASCENSION.cap(pick.from)} y {pick.to}★ al {ASCENSION.cap(pick.to)}. Para subir hay que entregarle {pick.cost} Invokers o Ecos de {pick.from}★, que se pierden. {can > 0 ? `Con los Invokers que no usas te da para ${plural(can, 'ascensión', 'ascensiones')} así.` : 'Con los Invokers que no usas aún no reúnes ese material: toca fabricarlo fusionando los que te sobran.'}</>,
        items: (pick.to === 6 ? ascend.six : ascend.five).slice(0, 3).map((c, i) => <><b>{i + 1}. {c.hero.name}</b> · {c.score}/100 · {c.teams.length ? `${plural(c.teams.length, 'equipo')}` : 'sin equipos'}{c.tier ? ` · tier ${c.tier.tier}` : ''}</>),
        cta: { label: 'Ver el ranking', to: `/asesor/invokers/${pick.to}` } })
    }
    if (coach) {
      const up = byV('upgrade'), upImp = up.filter(a => a.important)
      if (up.length) out.push({ id: 'upgrade', icon: ArrowUpCircle, title: `Sube ${plural((upImp.length ? upImp : up).length, 'pieza')} que ya ${(upImp.length ? upImp : up).length === 1 ? 'lleva' : 'llevan'} ${upImp.length ? 'tus equipos' : 'tus Invokers'}`,
        why: 'Están en uso y sin terminar: cada nivel se nota en el siguiente combate.',
        learn: 'Cada nivel sube la estadística principal. En +5, +10, +15 y +20 aparece una subestadística nueva o mejora una al azar. El tope es +20.',
        items: (upImp.length ? upImp : up).slice(0, 3).map(a => pieceLine(a, a.gear.mainAtMax ? `principal ${fmtBonus(a.gear.main.stat, a.gear.main.mode, a.gear.main.value)} → ${fmtBonus(a.gear.mainAtMax.stat, a.gear.mainAtMax.mode, a.gear.mainAtMax.value)} al +20` : 'sube su principal')), cta: { label: 'Ver cuáles', to: '/asesor/piezas/upgrade' } })
      const rep = byV('replace', a => a.important)
      if (rep.length) out.push({ id: 'replace', icon: Repeat, title: `No gastes en ${plural(rep.length, 'pieza')} de pocas estrellas`,
        why: 'Tienes piezas libres de más rango para esas ranuras: cada nivel rinde más en ellas.',
        learn: 'Las estrellas de una pieza (su rango) no se pueden subir y deciden cuánto vale cada tirada. Subir una 3★ es tirar recursos si tienes una 4★ o 5★ esperando.',
        items: rep.slice(0, 3).map(a => pieceLine(a, 'cámbiala por una de más rango')), cta: { label: 'Ver cuáles', to: '/asesor/piezas/replace' } })
      const test = byV('test')
      if (test.length) out.push({ id: 'test', icon: FlaskConical, title: `Prueba ${plural(test.length, 'pieza')} con futuro`,
        why: 'Subidas del todo mejorarían a tus equipos, pero depende de cómo salgan sus mejoras.',
        learn: 'Subir una pieza es una lotería: súbela solo hasta el siguiente hito (+5, +10…), mira qué mejora ha salido y decide. Si sale mal, la vendes y no has gastado de más.',
        items: test.slice(0, 3).map(a => <><b>{a.title}</b> · {slotName(a.gear.slot)} {a.gear.rank}★: {a.why}</>), cta: { label: 'Ver cuáles', to: '/asesor/piezas/test' } })
      const sell = byV('sell')
      if (sell.length) out.push({ id: 'sell', icon: Recycle, title: `Vende o tritura ${plural(sell.length, 'pieza')} sin futuro`,
        why: 'No mejoran a tus Invokers ni subidas a +20, y con lo que dan pagas las subidas de las buenas.',
        learn: 'Vender da oro y triturar da Memorium: las dos cosas que cuesta subir piezas. En el juego se hace por lotes desde la sala de equipo («Sell / Crush»).', cta: { label: 'Revisarlas', to: '/asesor/piezas/sell' } })
    }
    // Siguiente fase de los jefes en los que tienes récord.
    const first = nextBosses[0]
    if (first) out.push({ id: 'boss', icon: Swords, title: `Ve a por ${first.name}, fase ${first.record + 1}`,
      why: `Tu récord es la fase ${first.record}: mira qué equipo encaja y qué le falta para la siguiente.`,
      learn: 'Cada jefe tiene su propia tier list oficial, un elemento y unas corrupciones. Nexo cruza todo eso con tus Invokers y te dice a quién llevar y qué estadísticas subir.',
      items: nextBosses.slice(0, 3).map(x => <><b>{x.name}</b>: récord fase {x.record} de {x.stages}</>),
      cta: { label: 'Ver equipo recomendado', to: '/asesor/equipo', before: openBoss(first) } })
    return out
  }, [account, coach, ascend, plan, active, nextBosses])
  return { actions, ready: !!coach && !!ascend }
}

function ActionItem({ a, n }: { a: CoachAction; n: number }) {
  const { go } = useAccount()
  return <li className={`action ${a.urgent ? 'urgent' : ''}`}>
    <span className="action-n">{n}</span>
    <div className="action-body">
      <h3><a.icon size={17} aria-hidden /> {a.title}</h3>
      <p>{a.why}</p>
      {a.items && <ul className="action-items">{a.items.map((it, j) => <li key={j}>{it}</li>)}</ul>}
      {a.extra}
      {a.learn && <details className="learn"><summary><GraduationCap size={14} /> Aprende por qué</summary><p>{a.learn}</p></details>}
      {a.cta && <button className="btn small" onClick={() => { a.cta!.before?.(); go(a.cta!.to) }}>{a.cta.label} <ArrowRight size={14} /></button>}
    </div>
  </li>
}

/** Los tres frentes de la cuenta, con datos de la caja: personajes, piezas y jefes. */
function Fronts() {
  const { account, go } = useAccount()
  const coach = useGearCoach()
  const ascend = useAscend()
  const bosses = useNextBosses()
  if (!account) return null
  const top = ascend?.six[0] ?? ascend?.five[0]
  const boss = bosses[0]
  return <div className="fronts">
    <button className="front" onClick={() => go('/asesor/invokers')}>
      <span className="front-kicker"><Users size={15} /> Personajes</span>
      <b>{!ascend ? '…' : top ? `Sube a ${top.hero.name} a ${top.to}★` : 'Sin candidatos a subir'}</b>
      <small>{ascend ? `${plural(ascend.six.length, 'candidato')} a 6★ · ${ascend.five.length} a 5★` : 'Cargando tier lists oficiales'}</small>
      <span className="front-go">A quién subir <ArrowRight size={14} /></span>
    </button>
    <button className="front" onClick={() => go('/asesor/piezas')}>
      <span className="front-kicker"><Gem size={15} /> Piezas</span>
      <b>{coach ? `${fmtInt(coach.counts.upgrade)} por subir · ${fmtInt(coach.counts.sell)} para vender` : '…'}</b>
      <small>{coach ? `${fmtInt(coach.counts.equip)} por equipar · ${fmtInt(coach.counts.test)} por probar` : 'Analizando tus piezas'}</small>
      <span className="front-go">Subir o vender <ArrowRight size={14} /></span>
    </button>
    <button className="front" onClick={() => { if (boss) openBoss(boss)(); go('/asesor/equipo') }}>
      <span className="front-kicker"><Swords size={15} /> Jefes</span>
      <b>{boss ? `${boss.name}, fase ${boss.record + 1}` : 'Elige un jefe'}</b>
      <small>{boss ? `Tu récord: fase ${boss.record} de ${boss.stages}` : 'Qué equipo llevar y qué le falta'}</small>
      <span className="front-go">Qué equipo llevar <ArrowRight size={14} /></span>
    </button>
  </div>
}

/** Coach › Hoy: los tres frentes y los pasos, de tres en tres. */
export function CoachNow({ limit }: { limit?: number }) {
  const { account, go } = useAccount()
  const { actions, ready } = useCoachActions()
  if (!account) return null
  const first = actions.slice(0, limit ?? 3), rest = limit ? [] : actions.slice(3)
  return <section className="coach-now">
    {!limit && <>
      <p className="lead">Tu cuenta mejora por tres caminos: a quién subes, qué piezas llevan y a qué jefes te enfrentas. Aquí tienes cómo va cada uno y por dónde empezar. Nada se ejecuta en el juego.</p>
      <Fronts />
      <h2 className="coach-h">Empieza por aquí</h2>
    </>}
    <ol className="action-list">{first.map((a, i) => <ActionItem key={a.id} a={a} n={i + 1} />)}</ol>
    {rest.length > 0 && <details className="more-steps"><summary>Después, {plural(rest.length, 'paso')} más</summary>
      <ol className="action-list" start={4}>{rest.map((a, i) => <ActionItem key={a.id} a={a} n={i + 4} />)}</ol>
    </details>}
    {!ready && <p className="muted"><Loader2 size={14} className="spin" /> Analizando tu cuenta…</p>}
    {ready && !actions.length && <p className="muted">Nada urgente: tu cuenta está al día. Elige un jefe para el siguiente reto.</p>}
    {limit && actions.length > limit && <button className="link" onClick={() => go('/asesor')}>Ver los {actions.length} pasos <ArrowRight size={14} /></button>}
  </section>
}

/** Portada del coach en Inicio. */
export function CoachCard() {
  const { go } = useAccount()
  return <section className="panel coach-card">
    <div className="panel-title"><h2>Tu coach: empieza por aquí</h2><button className="link" onClick={() => go('/asesor')}>Abrir el coach <ArrowRight size={15} /></button></div>
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
