/** Coach › Hoy (e Inicio): promesas, los Invokers de tier alto que aún no usas (p. ej., un legendario nuevo), con qué
 * hacer, en orden: subirlo de nivel, su equipo para cuando esté en el tope (optimizador con la base estimada),
 * qué habilidad subir primero y dónde encaja según las tier lists oficiales de tus jefes. */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ListPlus, Loader2, Sparkles, Wand2 } from 'lucide-react'
import type { Hero } from '../box/model'
import type { Prospect } from '../box/prospects'
import { withBasis } from '../box/prospects'
import { gearName } from '../box/coachEngine'
import { reviewOptions, usedHeroes } from '../box/equipBatch'
import { indexOf, loadKits, profileOf, simulate, skillLevels, SKILL_KINDS, type Kit } from '../box/combat'
import { fmtInt, SLOT_LABEL } from '../box/i18n'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { entryFrom, reservedBy, usePlan } from './plan'
import { Portrait } from './Art'
import { useCapProjection, useProspects } from './prospects'
import { useFillOptimizer } from './useOptimizer'

const RARITY_ES: Record<string, string> = { Legendary: 'legendario', Epic: 'épico' }
const SKILL_ES: Record<string, string> = { Combo: 'Combo', ActiveSkill1: 'Habilidad 1', ActiveSkill2: 'Habilidad 2', ActiveSkill3: 'Habilidad 3', Ultimate: 'Definitiva' }
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1).replace('.', ',')} %`

/** Qué habilidad subir primero: la que más mejora su combate simulado (con las estadísticas que tendrá en el tope). */
function useFirstSkill(hero: Hero, stats: Hero['stats']): { name: string; gain: number }[] | null | undefined {
  const { account } = useAccount()
  const [kit, setKit] = useState<Kit | null | undefined>(undefined)
  useEffect(() => { let on = true; void loadKits().then(k => { if (on) setKit(k[hero.code] ?? null) }).catch(() => on && setKit(null)); return () => { on = false } }, [hero.code])
  return useMemo(() => {
    if (kit === undefined) return undefined
    if (!kit || !account) return null
    const levels = skillLevels(hero), mix = profileOf(hero, kit, levels).mix
    const base = { sim: simulate(account.box, kit, levels, stats), stats }
    return SKILL_KINDS.map((k, i) => {
      if (!kit[i] || levels[i] >= (kit[i]!.l.length)) return null
      const next = levels.map((l, j) => j === i ? l + 1 : l)
      return { name: kit[i]!.n ? `${SKILL_ES[k]} («${kit[i]!.n}»)` : SKILL_ES[k], gain: indexOf(mix, { sim: simulate(account.box, kit, next, stats), stats }, base) / 100 - 1 }
    }).filter((x): x is { name: string; gain: number } => !!x && x.gain > 0.001).sort((a, b) => b.gain - a.gain).slice(0, 2)
  }, [kit, account, hero, stats])
}

function ProspectBody({ p, others }: { p: Prospect; others: Set<number> }) {
  const { account, go } = useAccount()
  const box = account!.box, index = account!.index
  const projection = useCapProjection(p.hero, box)
  const shown = useMemo(() => projection ? withBasis(p.hero, projection.basis, box, index.equipped(p.hero)) : p.hero, [projection, p.hero, box, index])
  const optBox = useMemo(() => shown === p.hero ? box : { ...box, heroes: box.heroes.map(h => h.id === p.hero.id ? shown : h) }, [shown, p.hero, box])
  const active = useActiveTeams(box)
  const { plan, upsert } = usePlan(box)
  const { state, run } = useFillOptimizer(optBox)
  const [msg, setMsg] = useState('')
  const ready = projection !== undefined
  const runKey = `${p.hero.id}|${projection ? Math.round(projection.basis.attack) : 'x'}|${plan.length}|${[...active.heroes].join(',')}`
  useEffect(() => {
    if (!ready) return
    // Nunca toca a los Invokers que usas, equipos activos, plan ni otras promesas; puede usar piezas libres y de los
    // que no usas, y cambiar las suyas.
    const protect = new Set([...usedHeroes(box, new Set()).used.map(u => u.hero.id), ...active.heroes, ...plan.map(e => e.heroId), ...others])
    run([{ heroId: p.hero.id, options: reviewOptions(shown, reservedBy(plan, p.hero.id), protect, 'balanced') }])
  }, [runKey, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const build = state.status === 'done' ? state.result.get(p.hero.id) ?? null : null
  const skills = useFirstSkill(p.hero, shown.stats)
  const gain = build ? (build.damageBefore > 0 ? build.damageAfter / build.damageBefore - 1 : build.scoreBefore > 0 ? build.score / build.scoreBefore - 1 : 0) : 0
  const atCap = p.hero.level >= p.cap
  const add = () => {
    if (!build) return
    const c = upsert(entryFrom(p.hero, build, `Promesa: ${p.hero.name}${projection ? ` a nivel ${p.cap} (base estimada)` : ''}`))
    setMsg(c.length ? `No se añadió: ${c.length} piezas ya están reservadas en tu plan para otro Invoker.` : 'Añadido a tu plan.')
  }
  return <>
    {p.bossFits.length > 0 && <div className="pr-fit">
      <h4>Dónde encaja (tier list oficial de cada jefe)</h4>
      <ul>{p.bossFits.map(b => <li key={b.slug}><b>{b.name}: {b.tier}</b> · tu récord, fase {b.record}{b.team.length > 0 && b.team[0].score < b.score ? <> · en ese equipo, la nota más baja es {b.team[0].name} ({b.team[0].tier})</> : null}</li>)}</ul>
    </div>}
    <ol className="pr-steps">
      <li><b>Súbelo de nivel{atCap ? '' : `: ${p.hero.level} → ${p.cap}`}.</b> {atCap ? 'Ya está en su tope.' : <>{p.xpToCap !== null ? `Le faltan ${fmtInt(p.xpToCap)} de XP (tabla oficial). ` : ''}
        {projection ? <>Base estimada en el nivel {p.cap}: ATQ {fmtInt(p.hero.basis?.attack ?? 0)} → ≈{fmtInt(projection.basis.attack)}, VIDA {fmtInt(p.hero.basis?.health ?? 0)} → ≈{fmtInt(projection.basis.health)}, DEF {fmtInt(p.hero.basis?.defense ?? 0)} → ≈{fmtInt(projection.basis.defense)} <span className="fine">(su máximo oficial por la proporción de tus Invokers de {p.hero.rank}★ que ya están en su tope: {projection.refs.slice(0, 3).join(', ')}).</span></> : projection === undefined ? <span className="fine"><Loader2 size={12} className="spin" /> Estimando su base en el tope…</span> : null}</>}</li>
      <li><b>Equípalo{projection ? ` para el nivel ${p.cap}` : ''}.</b>{' '}
        {!ready || state.status === 'running' || state.status === 'idle' ? <span className="fine"><Loader2 size={12} className="spin" /> Calculando su equipo con el optimizador (conjuntos incluidos)…</span>
          : !build || !build.changes.length ? <>Con tus piezas libres y las de Invokers que no usas no hay nada mejor que lo que ya lleva.</>
          : <>{build.changes.length} {build.changes.length === 1 ? 'cambio' : 'cambios'}, {pct(gain)} de {build.damageBefore > 0 ? 'daño' : 'valor de su perfil'}{projection ? ` a nivel ${p.cap}` : ''} frente a lo que lleva{build.goldCost > 0 ? ` · ${fmtInt(build.goldCost)} de oro de desequipar` : ' · sin oro'}.
            <ul className="pr-changes">{build.changes.slice(0, 6).map(c => <li key={c.slot}>{SLOT_LABEL[c.slot] ?? c.slot}: {c.to ? gearName(c.to) : 'vacío'}{c.takenFrom ? ` (de ${c.takenFrom.name})` : c.to?.equippedHeroId === null ? ' (libre)' : ''}</li>)}{build.changes.length > 6 && <li>y {build.changes.length - 6} más…</li>}</ul>
            <span className="row-actions">
              <button className="btn small primary" onClick={add}><ListPlus size={15} /> Añadir al plan</button>
              <button className="btn small" onClick={() => go(`/optimizador/${p.hero.id}${projection ? '?tope=1' : ''}`)}><Wand2 size={15} /> Ajustarlo en el optimizador</button>
            </span>
            {msg && <span className="fine" role="status"><Check size={13} /> {msg}</span>}</>}
      </li>
      <li><b>Habilidades.</b>{' '}{skills === undefined ? <span className="fine"><Loader2 size={12} className="spin" /> …</span> : !skills?.length ? 'Sin ficha de habilidades para simularlo.'
        : <>La que más aporta primero: {skills[0].name} ({pct(skills[0].gain)} en su combate simulado{projection ? ` a nivel ${p.cap}` : ''}){skills[1] ? `; después, ${skills[1].name} (${pct(skills[1].gain)})` : ''}.</>}</li>
      <li><b>Pruébalo en un equipo</b> donde encaje y vuelve a importar: desde entonces Nexo lo tratará como uno de tus Invokers (revisión de equipo, Coach…).</li>
    </ol>
  </>
}

function ProspectItem({ p, first, others }: { p: Prospect; first: boolean; others: Set<number> }) {
  const { go } = useAccount()
  const [open, setOpen] = useState(first)
  return <li className="pr-item">
    <div className="pr-head">
      <button className="pr-portrait" onClick={() => go(`/invoker/${p.hero.id}`)} aria-label={`Abrir la ficha de ${p.hero.fullName}`}><Portrait c={p.hero} size="sm" /></button>
      <div>
        <b>{p.hero.name}</b> <span className="fine">{RARITY_ES[p.hero.rarity] ?? p.hero.rarity} · {p.hero.rank}★ · nivel {p.hero.level}</span>
        <div className="pr-tags"><span className="tag-strong">Tier {p.tier.tier} oficial ({p.tier.score.toFixed(2).replace('.', ',')})</span>{p.isNew && <span className="tag-strong good">Nuevo desde tu última importación</span>}{p.invested.map(x => <span key={x}>{x}</span>)}</div>
      </div>
      <button className="btn small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Menos' : 'Qué hacer'}</button>
    </div>
    {open && <ProspectBody p={p} others={others} />}
  </li>
}

/** Promesas en el Coach. */
export function ProspectCard() {
  const { prospects, ids } = useProspects()
  if (!prospects.length) return null
  return <section className="panel prospects">
    <div className="panel-title"><h2><Sparkles size={18} /> {prospects.length === 1 ? 'Una promesa' : 'Promesas'}: {prospects.length === 1 ? 'merece que lo subas' : 'merecen que los subas'}</h2></div>
    <p className="fine">Épicos y legendarios en S+, S o A+ de la tier list oficial que todavía no están en tus equipos. Nexo no propone quitarles piezas en ningún optimizador.</p>
    <ul className="pr-list">{prospects.map((p, i) => <ProspectItem key={p.hero.id} p={p} first={i === 0} others={new Set([...ids].filter(id => id !== p.hero.id))} />)}</ul>
  </section>
}

/** Aviso corto en Inicio. */
export function ProspectNotice() {
  const { go } = useAccount()
  const { prospects } = useProspects()
  const p = prospects[0]
  if (!p) return null
  return <button className="next-card prospect-note" onClick={() => go('/asesor')}>
    <Sparkles size={20} /><span><b>{p.isNew ? 'Nuevo y' : 'Sin usar y'} de tier {p.tier.tier}: {p.hero.name}{prospects.length > 1 ? ` (y ${prospects.length - 1} más)` : ''}</b>
      <small>{p.hero.level < p.cap ? `Súbelo del nivel ${p.hero.level} al ${p.cap}; ` : ''}el Coach te dice su equipo, qué habilidad subir primero y dónde encaja.</small></span><ArrowRight size={16} />
  </button>
}
