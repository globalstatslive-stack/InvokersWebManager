import { useMemo, useState } from 'react'
import { BookOpen, Calculator, CalendarDays, ExternalLink, Gem, Layers, ListOrdered, Mountain, Shield, Skull, Sparkles, Users } from 'lucide-react'
import { useAccount } from '../account'
import { Chips, PageHead, Select } from '../common'
import { SetIcon } from '../Art'
import { ELEMENT_LABEL, t } from '../../box/i18n'
import { loadBosses } from '../../box/goal'
import { cooldown, landChance, loadGear, loadGuides, loadIndex, loadTiers, loadTools, ticks, useLoad, type Kind } from '../../wiki/data'
import { EFFECT_GROUP, EFFECT_LABEL, GEAR_SLOT, GEAR_STAT, GUIDE_GROUPS, SET_KEY, SET_NAME, TOL_LABEL } from '../../wiki/labels'
import { Failed, Loading, OfficialImg, Source, Thumb } from './kit'

export function Encyclopedia() {
  const { go } = useAccount()
  const idx = useLoad(loadIndex)
  const items = [
    { to: '/wiki/invokers', icon: Users, title: 'Invokers', text: `${idx.data?.invokers.length ?? '…'} fichas: estadísticas, habilidades por nivel, tolerancias y nota por jefe.` },
    { to: '/wiki/titanes', icon: Shield, title: 'Titanes', text: `${idx.data?.titans.length ?? '…'} Titanes: bonificaciones al Invoker vinculado y habilidades.` },
    { to: '/wiki/jefes', icon: Skull, title: 'Jefes', text: 'Todas las fases con estadísticas, corrupciones, objetivos de la guía y tier list.' },
    { to: '/wiki/agujas', icon: Mountain, title: 'Agujas', text: 'Los 120 pisos de cada aguja: elemento, enemigos, PREC, RES y recompensas.' },
    { to: '/wiki/eventos', icon: CalendarDays, title: 'Eventos', text: 'Cazas en curso y pasadas, coronas y calendario de torneos.' },
    { to: '/wiki/tier-list', icon: ListOrdered, title: 'Tier lists', text: 'Clasificación oficial de Invokers y Titanes, con los que tienes resaltados.' },
    { to: '/wiki/equipamiento', icon: Gem, title: 'Equipamiento', text: 'Principales y secundarias por ranura, notas de tirada y todos los conjuntos.' },
    { to: '/wiki/efectos', icon: Sparkles, title: 'Efectos', text: `${idx.data?.effects.length ?? '…'} mejoras, perjuicios y efectos instantáneos, y quién los aplica.` },
    { to: '/wiki/herramientas', icon: Calculator, title: 'Calculadoras', text: 'Precisión contra resistencia, recuperación de habilidad y ticks, con las tablas oficiales.' },
    { to: '/wiki/guias', icon: BookOpen, title: 'Guías oficiales', text: 'Índice en español de las guías de invokers.com.' },
  ]
  return <>
    <PageHead kicker="Nexo" title="Enciclopedia">Todo el contenido del juego con datos oficiales de invokers.com y, si has importado tu caja, lo que tienes tú.</PageHead>
    <div className="wiki-hub">{items.map(i => <button key={i.to} className="next-card" onClick={() => go(i.to)}><i.icon size={20} aria-hidden /><span><b>{i.title}</b><small>{i.text}</small></span></button>)}</div>
    <section className="panel">
      <h2>De dónde salen los datos</h2>
      <p>Nexo descarga cada semana las fichas, tier lists, guías de jefes, agujas, eventos y tablas de las calculadoras que publica invokers.com, comprueba que tienen el formato esperado y vuelve a publicar la web. Cuando salen Invokers, Titanes, jefes o eventos nuevos aparecen aquí sin cambiar el código. Si una fuente cambia de formato, la actualización se detiene y se conservan los datos anteriores.</p>
      <p className="muted">Los textos de habilidades y efectos son los oficiales del juego, en inglés. Las guías completas se leen en invokers.com: Nexo enlaza a ellas en lugar de copiarlas.</p>
      {idx.data && <Source href={idx.data.source} version={idx.data.version} date={idx.data.fetchedAt} />}
    </section>
  </>
}

export function TierListPage({ kind }: { kind: Kind }) {
  const { account, go } = useAccount()
  const tl = useLoad(loadTiers), idx = useLoad(loadIndex)
  const [mine, setMine] = useState<'all' | 'mine'>('all'), [el, setEl] = useState('all')
  if (tl.error) return <Failed error={tl.error} />
  if (!tl.data || !idx.data) return <Loading what="la tier list" />
  const list = tl.data[kind]
  const by = new Map(idx.data[kind].map(s => [s.code, s]))
  const owned = new Set([...(account?.box.heroes ?? []), ...(account?.box.titans ?? [])].map(h => h.code))
  return <>
    <PageHead kicker="Enciclopedia" title={`Tier list oficial de ${kind === 'invokers' ? 'Invokers' : 'Titanes'}`}>Clasificación de S+ a E elaborada por los desarrolladores a partir de millones de combates{list.scope ? `, en ${list.scope.replace('boss fights', 'combates de jefe')}` : ''}. Cada jefe tiene la suya en su ficha.</PageHead>
    <Source href={tl.data.sources[kind]} date={list.updated} />
    <div className="toolbar">
      <Chips label="Tipo" value={kind} onChange={v => go(v === 'invokers' ? '/wiki/tier-list' : '/wiki/tier-list/titanes')} options={[{ id: 'invokers', label: 'Invokers' }, { id: 'titans', label: 'Titanes' }]} />
      {account && <Chips label="Mostrar" value={mine} onChange={setMine} options={[{ id: 'all', label: 'Todos' }, { id: 'mine', label: 'Solo los míos' }]} />}
      {kind === 'invokers' && <Select label="Elemento" value={el} onChange={setEl} options={[{ id: 'all', label: 'Todos' }, ...['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark'].map(e => ({ id: e, label: t(ELEMENT_LABEL, e) }))]} />}
    </div>
    {list.rows.map(r => {
      const entries = r.entries.map(e => ({ e, s: e.code ? by.get(e.code) : undefined })).filter(x => x.s && (mine === 'all' || owned.has(x.e.code!)) && (el === 'all' || x.s.element === el))
      return entries.length > 0 && <div key={r.key} className="tier-row">
        <span className={`tier-tag big t-${r.label.replace('+', 'p')}`}>{r.label}<small>{entries.length}</small></span>
        <div className="mini-roster">{entries.map(({ e, s }) => <button key={e.slug} className={`mini-card ${account && !owned.has(e.code!) ? 'missing' : ''}`} onClick={() => go(`/wiki/${kind === 'invokers' ? 'invokers' : 'titanes'}/${s!.slug}`)} title={e.score !== null ? `Nota ${e.score.toFixed(2)}` : undefined}>
          <Thumb s={s!} size="sm" /><small>{s!.short}</small>{e.score !== null && <small className="muted">{e.score.toFixed(2)}</small>}</button>)}</div>
      </div>
    })}
    {account && <p className="muted">Atenuados: los que no tienes en tu última importación.</p>}
  </>
}

const ACC_UNLOCK: Record<string, string> = { Amulet: 'desde el inicio', Earrings: 'despertar ★2', Banner: 'despertar ★4', Talisman: 'despertar ★5', Flask: 'despertar ★6' }
const statEs = (s: string) => s.replace(/HP/g, 'VIDA').replace(/ATK/g, 'ATQ').replace(/DEF/g, 'DEF').replace(/Crit Rate/g, 'Prob. crítico').replace(/Crit DMG|Crit Damage/g, 'Daño crítico').replace(/\bACC\b/g, 'PREC').replace(/Mana Gen/g, 'Gen. maná').replace(/Skill SPD/g, 'Vel. habilidad').replace(/Skill RECOV/g, 'Recuperación').replace(/Combo SPD/g, 'Vel. combo')
export function GearPage() {
  const g = useLoad(loadGear)
  const [tab, setTab] = useState<'relics' | 'sets' | 'accessories'>('relics')
  if (g.error) return <Failed error={g.error} />
  if (!g.data) return <Loading what="el equipamiento" />
  const d = g.data
  const statsOf = (m: { stats: string[] }[]) => [...new Set(m.flatMap(x => x.stats))]
  const Matrix = ({ m, title }: { m: { slot: string; stats: string[] }[]; title: string }) => {
    const cols = statsOf(m)
    return <><h3>{title}</h3><div className="table-wrap"><table className="data compact matrix"><thead><tr><th>Ranura</th>{cols.map(c => <th key={c}><span>{GEAR_STAT[c] ?? c}</span></th>)}</tr></thead>
      <tbody>{m.map(r => <tr key={r.slot}><td>{GEAR_SLOT[r.slot] ?? r.slot}</td>{cols.map(c => <td key={c} className="center">{r.stats.includes(c) ? <span aria-label="sí">●</span> : <span className="muted" aria-label="no">·</span>}</td>)}</tr>)}</tbody></table></div></>
  }
  return <>
    <PageHead kicker="Enciclopedia" title="Equipamiento">8 reliquias por Invoker, con conjuntos de 3 y 5 piezas, y hasta 5 accesorios de su facción. Tablas de las guías oficiales.</PageHead>
    <Chips label="Sección" value={tab} onChange={setTab} options={[{ id: 'relics', label: 'Reliquias' }, { id: 'sets', label: `Conjuntos (${d.sets.length})` }, { id: 'accessories', label: 'Accesorios' }]} />
    {tab === 'relics' && <section className="panel">
      <Matrix m={d.relicMain} title="Estadística principal posible" />
      <Matrix m={d.relicSub} title="Subestadísticas posibles" />
      <h3>Notas de las subestadísticas</h3>
      <p className="muted">La nota depende del valor total tirado frente al máximo posible en ese número de mejoras.</p>
      <div className="table-wrap"><table className="data compact"><thead><tr><th>Mejoras</th><th>Valor total</th><th>Nota</th></tr></thead><tbody>{d.grades.map((r, i) => <tr key={i}><td>{r.roll.replace('Initial Roll', 'tirada inicial').replace('Level', 'nivel')}</td><td>{r.total}</td><td><b className={`grade g-${r.grade}`}>{r.grade}</b></td></tr>)}</tbody></table></div>
      <Source href={d.sources.relics} />
    </section>}
    {tab === 'sets' && <section className="panel">
      <p className="muted">Los bonos de 3 y 5 piezas de un mismo conjunto se suman. Puedes combinar un 3 de un conjunto con un 5 de otro, pero no dos 3 del mismo. Textos de bonificación avanzados en inglés, como en la guía.</p>
      <div className="set-list">{d.sets.map(s => <div key={s.name} className="set-item">
        <div className="set-head">{SET_KEY[s.name] && <SetIcon set={SET_KEY[s.name]} />}<b>{SET_NAME[s.name] ?? s.name}</b><span className="tag">{s.kind === 'standard' ? 'Estándar' : 'Avanzado'}</span></div>
        <ul className="kv"><li><span>3 piezas</span><b>{statEs(s.three)}</b></li><li><span>5 piezas</span><b>{statEs(s.five)}{s.fiveTotal ? ` (total ${statEs(s.fiveTotal)})` : ''}</b></li><li><span>Dónde</span><b>{s.where.replace(/Campaign: Chapter/g, 'Campaña: capítulo').replace(/Boss:/g, 'Jefe:')}</b></li></ul>
      </div>)}</div>
      <Source href={d.sources.relics} />
    </section>}
    {tab === 'accessories' && <section className="panel">
      <p>Solo los equipan Invokers de la facción del accesorio. No hay conjuntos de accesorios. Se consiguen derrotando a Sorgott.</p>
      <ul className="kv">{d.accessoryMain.map(r => <li key={r.slot}><span>{GEAR_SLOT[r.slot] ?? r.slot}</span><b>{ACC_UNLOCK[r.slot] ?? ''}</b></li>)}</ul>
      <Matrix m={d.accessoryMain} title="Estadística principal posible" />
      <Matrix m={d.accessorySub} title="Subestadísticas posibles" />
      <Source href={d.sources.accessories} />
    </section>}
  </>
}

export function EffectsPage() {
  const idx = useLoad(loadIndex)
  const [group, setGroup] = useState('Buffs')
  if (idx.error) return <Failed error={idx.error} />
  if (!idx.data) return <Loading what="los efectos" />
  const groups = [...new Set(idx.data.effects.map(e => e.group))]
  return <>
    <PageHead kicker="Enciclopedia" title="Efectos">Glosario de efectos de habilidad. Descripción oficial del juego (en inglés) y cuántos Invokers lo aplican.</PageHead>
    <Source href={`${idx.data.source}/guides/buffs-debuffs-and-instant-effects/`} version={idx.data.version} date={idx.data.fetchedAt} />
    <Chips label="Tipo" value={group} onChange={setGroup} options={[...groups.map(g => ({ id: g, label: EFFECT_GROUP[g] ?? g })), { id: 'tol', label: 'Tolerancias' }]} />
    <div className="effect-list">{(group === 'tol' ? idx.data.tolerances : idx.data.effects.filter(e => e.group === group)).map(e => <div key={e.key} className="effect-item">
      <div className="set-head">{e.icon && <OfficialImg src={e.icon} alt="" className="mini-icon" />}<b>{group === 'tol' ? TOL_LABEL[e.key] ?? e.label : EFFECT_LABEL[e.label] ?? e.label}</b><small className="muted">{e.label} · {e.count} Invokers</small></div>
      {e.description && <p lang="en">{e.description}</p>}
    </div>)}</div>
  </>
}

const f1 = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n)
const f2 = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)
const ELS = ['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark', 'Neutral']
export function ToolsPage() {
  const { account } = useAccount()
  const tl = useLoad(loadTools), b = useLoad(loadBosses)
  const [acc, setAcc] = useState(200), [res, setRes] = useState(250), [accUp, setAccUp] = useState(0), [accDown, setAccDown] = useState(0), [resUp, setResUp] = useState(0), [resDown, setResDown] = useState(0)
  const [caster, setCaster] = useState('Neutral'), [target, setTarget] = useState('Neutral'), [hero, setHero] = useState(''), [stage, setStage] = useState('')
  const [cd, setCd] = useState(20), [rec, setRec] = useState(100), [recUp, setRecUp] = useState(0), [recDown, setRecDown] = useState(0)
  const [dur, setDur] = useState(10), [interval, setInterval] = useState(1), [spd, setSpd] = useState(100)
  const heroes = useMemo(() => [...(account?.box.heroes ?? [])].sort((a, b) => b.power - a.power).slice(0, 60), [account])
  if (tl.error) return <Failed error={tl.error} />
  if (!tl.data) return <Loading what="las tablas oficiales" />
  const T = tl.data
  const land = landChance(T, { accuracy: acc, resistance: res, accUp, accDown, resUp, resDown, caster, target })
  const c = cooldown(T, { base: cd, rating: rec, up: recUp, down: recDown })
  const tk = ticks(T, { duration: dur, interval, rating: spd })
  const num = (v: number, set: (n: number) => void, label: string, min = 0, max = 2000, step = 1) => <label className="select"><span>{label}</span><input type="number" inputMode="decimal" value={v} min={min} max={max} step={step} onChange={e => set(Number(e.target.value) || 0)} /></label>
  const bossStages = (b.data?.bosses ?? []).flatMap(x => x.stages.map(s => ({ id: `${x.slug}:${s.stage}`, label: `${x.name} · fase ${s.stage}`, res: s.res, el: s.element })))
  return <>
    <PageHead kicker="Enciclopedia" title="Calculadoras">Con las tablas que publica invokers.com en sus calculadoras, generadas a partir de las reglas del juego.</PageHead>
    <Source href={T.source} />
    <section className="panel tool">
      <h2>Precisión contra resistencia</h2>
      <p className="muted">Probabilidad de que entre un perjuicio que necesita precisión.</p>
      <div className="tool-result"><b className={land.land >= 90 ? 'up' : land.land < 50 ? 'down' : ''}>{f1(land.land)} %</b><span>de que entre · {f1(land.resist)} % de resistirlo{land.delta ? ` · elemento ${land.delta > 0 ? '+' : ''}${land.delta} puntos` : ''} ({land.matchup === 'advantage' ? 'ventaja' : land.matchup === 'disadvantage' ? 'desventaja' : 'neutral'})</span></div>
      <div className="filter-grid">
        {account && <Select label="Tu Invoker" value={hero} onChange={v => { setHero(v); const h = heroes.find(x => String(x.id) === v); if (h) { setAcc(Math.round(h.stats.accuracy ?? 0)); setCaster(h.element ?? 'Neutral') } }} options={[{ id: '', label: '— escribir PREC —' }, ...heroes.map(h => ({ id: String(h.id), label: `${h.name} · PREC ${Math.round(h.stats.accuracy ?? 0)}` }))]} />}
        <Select label="Jefe y fase" value={stage} onChange={v => { setStage(v); const s = bossStages.find(x => x.id === v); if (s) { setRes(s.res); setTarget(s.el ?? 'Neutral') } }} options={[{ id: '', label: '— escribir RES —' }, ...bossStages.map(s => ({ id: s.id, label: `${s.label} · RES ${s.res}` }))]} />
        {num(acc, setAcc, 'Tu PREC')}{num(res, setRes, 'RES del objetivo')}
        {num(accUp, setAccUp, 'PREC + en ti (%)', 0, 100)}{num(accDown, setAccDown, 'PREC − en ti (%)', 0, 100)}{num(resUp, setResUp, 'RES + en el objetivo (%)', 0, 100)}{num(resDown, setResDown, 'RES − en el objetivo (%)', 0, 100)}
        <Select label="Tu elemento" value={caster} onChange={setCaster} options={ELS.map(e => ({ id: e, label: e === 'Neutral' ? 'Neutral' : t(ELEMENT_LABEL, e) }))} />
        <Select label="Elemento del objetivo" value={target} onChange={setTarget} options={ELS.map(e => ({ id: e, label: e === 'Neutral' ? 'Neutral' : t(ELEMENT_LABEL, e) }))} />
      </div>
      
    </section>
    <section className="panel tool">
      <h2>Recuperación de habilidad</h2>
      <div className="tool-result"><b>{Number.isFinite(c.real) ? `${f2(c.real)} s` : '∞'}</b><span>de enfriamiento real · recuperación +{f1(c.pct)} % · en arena la primera vez {Number.isFinite(c.arenaFirst) ? `${f2(c.arenaFirst)} s` : '∞'} (parte del {Math.round(T.arenaInitialCooldownFactor * 100)} %)</span></div>
      <div className="filter-grid">{num(cd, setCd, 'Enfriamiento base (s)', 0, 600, 0.5)}{num(rec, setRec, 'Recuperación (puntos)', 0, T.ratingMax)}{num(recUp, setRecUp, 'Recuperación + (%)', 0, 100)}{num(recDown, setRecDown, 'Recuperación − (%)', 0, 100)}</div>
      
    </section>
    <section className="panel tool">
      <h2>Ticks y velocidad de habilidad</h2>
      <p className="muted">Cuántas veces se aplica un efecto periódico (curación, sangrado…) durante su duración. El juego cuenta en pasos de {T.tickSeconds} s.</p>
      <div className="tool-result"><b>{tk.modified.length} ticks</b><span>con +{f1(tk.pct)} % de velocidad (cada {f2(tk.modifiedInterval)} s) · {tk.base.length} sin velocidad</span></div>
      <div className="filter-grid">{num(dur, setDur, 'Duración (s)', 0, 120, 0.5)}{num(interval, setInterval, 'Cada (s)', 0.1, 30, 0.1)}{num(spd, setSpd, 'Vel. habilidad (puntos)', 0, T.ratingMax)}</div>
      
    </section>
  </>
}

export function GuidesPage() {
  const g = useLoad(loadGuides)
  if (g.error) return <Failed error={g.error} />
  if (!g.data) return <Loading what="las guías" />
  const have = new Set(g.data.guides.map(x => x.path.split('/')[2]))
  const listed = new Set(GUIDE_GROUPS.flatMap(x => x.items.map(i => i[0])))
  const bossGuides = [...have].filter(s => s.endsWith('-boss-guide'))
  const others = [...have].filter(s => !listed.has(s) && !s.endsWith('-boss-guide'))
  const url = (s: string) => `https://invokers.com/guides/${s}/`
  return <>
    <PageHead kicker="Enciclopedia" title="Guías oficiales">Índice en español de las guías publicadas en invokers.com. Se abren en el portal oficial, en inglés.</PageHead>
    {GUIDE_GROUPS.map(gr => { const items = gr.items.filter(i => have.has(i[0])); return items.length > 0 && <section key={gr.title} className="panel"><h2>{gr.title}</h2>
      <ul className="link-list">{items.map(([s, title]) => <li key={s}><a href={url(s)} target="_blank" rel="noreferrer">{title} <ExternalLink size={12} aria-hidden /></a></li>)}</ul></section> })}
    <section className="panel"><h2><Layers size={16} aria-hidden /> Guías de jefes</h2><ul className="link-list">{bossGuides.map(s => <li key={s}><a href={url(s)} target="_blank" rel="noreferrer">{s.replace('-boss-guide', '').replace('omnissi-', 'Garuda ').replace(/^./, c => c.toUpperCase())} <ExternalLink size={12} aria-hidden /></a></li>)}</ul></section>
    {others.length > 0 && <section className="panel"><h2>Otras</h2><ul className="link-list">{others.map(s => <li key={s}><a href={url(s)} target="_blank" rel="noreferrer">{s.replace(/-/g, ' ')} <ExternalLink size={12} aria-hidden /></a></li>)}</ul></section>}
    <Source href="https://invokers.com/guides/" date={g.data.fetchedAt} />
  </>
}
