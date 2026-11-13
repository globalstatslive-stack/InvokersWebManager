import { useMemo } from 'react'
import { ArrowLeft, Info, Wand2 } from 'lucide-react'
import { useAccount } from './account'
import { Empty, GearCard, NeedsAccount } from './common'
import { GearIcon, Portrait } from './Art'
import { SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { whoBenefits } from '../box/usefulness'
import { gainText } from '../box/gearCoach'
import { GearCoachPanel } from './GearCoach'
import { teamsByHero } from '../box/ascension'
import { usePlan, reservedBy } from './plan'
import { useActiveTeams } from './activeTeams'

/** Ficha de una pieza: estadísticas y «¿a quién le sirve?» con la mejora concreta para cada candidato. */
export function GearDetail({ id }: { id: string }) {
  const { account, go } = useAccount()
  const box = account?.box
  const { plan } = usePlan(box)
  const active = useActiveTeams(box)
  const [kind, num] = id.split('-')
  const g = account ? (kind === 'accessory' ? account.index.accessory(Number(num)) : account.index.relic(Number(num))) : undefined
  const candidates = useMemo(() => {
    if (!account) return []
    const top = [...account.box.heroes].filter(h => h.basis).sort((a, b) => b.power - a.power).slice(0, 25)
    const extra = account.box.heroes.filter(h => active.heroes.has(h.id) || plan.some(e => e.heroId === h.id))
    return [...new Map([...extra, ...top].map(h => [h.id, h])).values()]
  }, [account, active.heroes, plan])
  const uses = useMemo(() => g && account ? whoBenefits(account.index, g, candidates).slice(0, 8) : [], [g, account, candidates])
  const inTeams = useMemo(() => account ? teamsByHero(account.box) : new Map(), [account])
  if (!account) return <NeedsAccount />
  if (!g) return <Empty title="Pieza no encontrada" action={<button className="btn" onClick={() => go('/coleccion/piezas')}>Volver</button>} />
  const owner = g.equippedHeroId !== null ? account.index.heroes.get(g.equippedHeroId) : undefined
  const planned = plan.find(e => Object.values(e.target?.relics ?? e.relics).includes(g.id) && g.kind === 'relic' || Object.values(e.target?.accessories ?? e.accessories).includes(g.id) && g.kind === 'accessory')
  const reserved = reservedBy(plan, -1).has(`${g.kind}${g.id}`)
  return <div className="gear-detail">
    <button className="back" onClick={() => history.back()}><ArrowLeft size={17} /> Volver</button>
    <GearCard g={g} owner={owner?.name ?? null} />
    <GearCoachPanel g={g} />
    <p className="fine">{owner ? <>La lleva <button className="link" onClick={() => go(`/invoker/${owner.id}`)}>{owner.name}</button>. Moverla cuesta {g.unequipGold ? `${g.unequipGold.toLocaleString('es-ES')} de oro de desequipar` : 'el oro de desequipar (no publicado para esta pieza)'}; no es su precio de venta.</> : 'Pieza libre: equiparla no cuesta oro de desequipar.'}{reserved && planned ? ` Reservada en tu plan para ${planned.name}.` : ''}</p>
    <section className="panel">
      <div className="panel-title"><h2>¿A quién le sirve?</h2><small>{candidates.length} candidatos: tus equipos activos, tu plan y los 25 más fuertes</small></div>
      {uses.length === 0 ? <p className="muted">Ninguno de estos Invokers mejora al sustituir su {t(SLOT_LABEL, g.slot).toLowerCase()} por esta pieza.</p> :
        <ul className="use-list">{uses.map(u => <li key={u.hero.id}>
          <Portrait c={u.hero} size="sm" />
          <span className="row-main"><b>{u.hero.name}{active.heroes.has(u.hero.id) ? <small className="tag good">equipo activo</small> : !inTeams.has(u.hero.id) ? <small className="tag">sin equipos</small> : null}</b>
            <small>Sustituye {u.replaces ? <><GearIcon g={u.replaces} size="sm" /> {u.replaces.set ? t(SET_LABEL, u.replaces.set) : u.replaces.faction}</> : 'una ranura vacía'}{u.ownerLoses && owner ? ` · ${owner.name} la perdería` : ''}</small></span>
          <b className="up row-value">{gainText(u)}</b>
          <button className="icon-btn" aria-label={`Optimizar a ${u.hero.name}`} onClick={() => go(`/optimizador/${u.hero.id}`)}><Wand2 size={16} /></button>
        </li>)}</ul>}
      <p className="fine"><Info size={13} /> Cambio de una sola pieza con la fórmula de estadísticas verificada, incluidos los conjuntos que se activan o se pierden. Atacantes: daño medio por golpe; tanques y apoyos: puntos de su perfil de clase. No es la build óptima completa: para eso, usa el optimizador.</p>
    </section>
  </div>
}
