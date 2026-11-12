import { useState } from 'react'
import { ArrowLeft, Crown, ExternalLink } from 'lucide-react'
import { useAccount } from '../account'
import { Chips, PageHead } from '../common'
import { ElementIcon } from '../Art'
import { ELEMENT_LABEL, t } from '../../box/i18n'
import { loadEvents, loadIndex, loadSpires, useLoad, type Chase, type Floor } from '../../wiki/data'
import { matchupEs, REWARD, SPIRE_ELEMENT, SPIRE_ES } from '../../wiki/labels'
import { esNum, Failed, fmtDate, fmtDateTime, Loading, NotFound, OfficialImg, Source, Thumb } from './kit'

const spireFacts = (intro: string) => ({
  keys: /(\d+) [A-Za-z]+ Spire Keys a day/.exec(intro)?.[1] ?? null,
  floors: /(\d+) Floors/.exec(intro)?.[1] ?? null,
  monthly: /resets at the start of each month/.test(intro),
})

export function SpireList() {
  const { go } = useAccount()
  const sp = useLoad(loadSpires)
  if (sp.error) return <Failed error={sp.error} />
  if (!sp.data) return <Loading what="las agujas" />
  const first = sp.data.spires[0]
  const facts = spireFacts(first.intro)
  return <>
    <PageHead kicker="Enciclopedia" title="Agujas">Seis agujas, una por elemento: solo entran Invokers de ese elemento. {facts.keys ? `${facts.keys} llaves al día por aguja, ` : ''}{facts.floors ?? first.floors.length} pisos{facts.monthly ? ' y se reinician al empezar cada mes' : ''}. Los pisos son iguales en todas; cambia qué elemento tienes a favor o en contra.</PageHead>
    <Source href={sp.data.source} date={sp.data.fetchedAt} />
    <div className="boss-grid">{sp.data.spires.map(s => {
      const adv = s.floors.filter(f => f.matchup.startsWith('Advantage')).length, dis = s.floors.filter(f => f.matchup.startsWith('Disadvantage')).length
      return <button key={s.slug} className="wboss-card" onClick={() => go(`/wiki/agujas/${s.slug}`)}>
        <ElementIcon element={SPIRE_ELEMENT[s.slug]} className="spire-icon" />
        <span><b>{SPIRE_ES[s.slug] ?? s.name}</b><small>{s.floors.length} pisos · {s.floors.filter(f => f.boss).length} con jefe</small><small className="muted">{adv} a favor · {dis} en contra</small></span>
      </button>
    })}</div>
  </>
}

export function SpirePage({ slug }: { slug: string }) {
  const { go } = useAccount()
  const sp = useLoad(loadSpires)
  const [range, setRange] = useState('1'), [only, setOnly] = useState<'all' | 'boss'>('all')
  const back = <button className="link" onClick={() => go('/wiki/agujas')}><ArrowLeft size={15} /> Todas las agujas</button>
  if (sp.error) return <Failed error={sp.error} />
  if (!sp.data) return <Loading what="la aguja" />
  const s = sp.data.spires.find(x => x.slug === slug)
  if (!s) return <NotFound what={`la aguja «${slug}»`} back={back} />
  const groups = Array.from({ length: Math.ceil(s.floors.length / 20) }, (_, i) => String(i + 1))
  const g = Number(range) - 1
  const floors = s.floors.filter(f => only === 'boss' ? f.boss : f.floor > g * 20 && f.floor <= (g + 1) * 20)
  const by = (p: string) => s.floors.filter(f => f.matchup.startsWith(p))
  const enemyEls = (fs: Floor[]) => [...new Set(fs.map(f => f.element).filter(Boolean))].map(e => t(ELEMENT_LABEL, e)).join(', ')
  return <article className="wiki-page">
    {back}
    <PageHead kicker="Agujas" title={SPIRE_ES[s.slug] ?? s.name}>Solo Invokers de {t(ELEMENT_LABEL, SPIRE_ELEMENT[s.slug])}.</PageHead>
    <div className="panel">
      <h2>Elementos</h2>
      <ul className="kv">
        <li><span>A favor (+30 % de daño)</span><b>{by('Advantage').length} pisos · {enemyEls(by('Advantage')) || '—'}</b></li>
        <li><span>Neutral</span><b>{by('Neutral').length} pisos · {enemyEls(by('Neutral')) || '—'}</b></li>
        <li><span>En contra (−15 % o −30 %)</span><b>{by('Disadvantage').length} pisos · {enemyEls(by('Disadvantage')) || '—'}</b></li>
      </ul>
    </div>
    <div className="toolbar sticky">
      <Chips label="Mostrar" value={only} onChange={setOnly} options={[{ id: 'all', label: 'Por pisos' }, { id: 'boss', label: 'Solo jefes' }]} />
      {only === 'all' && <Chips label="Pisos" value={range} onChange={setRange} options={groups.map(x => ({ id: x, label: `${(Number(x) - 1) * 20 + 1}–${Number(x) * 20}` }))} />}
    </div>
    <div className="floor-list">{floors.map(f => <div key={f.floor} className={`floor ${f.boss ? 'is-boss' : ''}`}>
      <div className="floor-head"><b>Piso {f.floor}</b>{f.boss && <span className="tag bad">Jefe</span>}<span><ElementIcon element={f.element} /> {t(ELEMENT_LABEL, f.element)}</span>
        <span className={`tag ${f.matchup.startsWith('Advantage') ? 'good' : f.matchup.startsWith('Disadvantage') ? 'bad' : ''}`}>{matchupEs(f.matchup)}</span></div>
      <p className="muted">Nv. {f.level} · PREC {f.acc} · RES {f.res}</p>
      <ul className="waves">{f.waves.map((w, i) => <li key={i}><span>{w.boss ? 'Jefe' : w.name.replace('Wave', 'Oleada').replace('On this floor', 'En el piso')}</span> {w.enemies.join(' · ')}</li>)}</ul>
      <p className="rewards">{f.rewards.map((r, i) => <span key={i}>{esNum(r.amount)} {REWARD[r.item] ?? r.item}</span>)}{f.firstClear && <span className="first">Primera vez: {f.firstClear.replace('Gems', 'gemas')}</span>}</p>
    </div>)}</div>
    <Source href={s.official} date={sp.data.fetchedAt} />
  </article>
}

export function EventsPage() {
  const { go } = useAccount()
  const ev = useLoad(loadEvents), idx = useLoad(loadIndex)
  if (ev.error) return <Failed error={ev.error} />
  if (!ev.data) return <Loading what="los eventos" />
  const now = Date.now()
  const status = (a: string, b: string) => Date.parse(b) < now ? 'done' : Date.parse(a) > now ? 'next' : 'live'
  const chases = [...ev.data.chases].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  const byCode = new Map((idx.data?.invokers ?? []).map(s => [s.code, s]))
  return <>
    <PageHead kicker="Enciclopedia" title="Eventos de caza">Cada caza dura unas tres semanas: ganas coronas en torneos y las canjeas por un Invoker legendario. Fechas en tu hora local.</PageHead>
    <Source href={ev.data.source} date={ev.data.builtAt} />
    {chases.map(c => {
      const st = status(c.start, c.end), hero = c.hero?.code ? byCode.get(c.hero.code) : undefined
      return <section key={c.key} className={`panel chase ${st}`}>
        <div className="chase-head">
          {hero ? <button className="link" onClick={() => go(`/wiki/invokers/${hero.slug}`)}><Thumb s={hero} /></button> : <OfficialImg src={c.icon} alt="" className="portrait md" />}
          <div><span className={`tag ${st === 'live' ? 'good' : ''}`}>{st === 'live' ? 'En curso' : st === 'next' ? 'Próximo' : 'Terminado'}</span>
            <h2>{c.name.replace('Chase', '· caza')}</h2>
            <p className="muted">{fmtDate(c.start)} – {fmtDate(c.end)}</p>
            <p><Crown size={14} aria-hidden /> {c.crownsNeeded} coronas para el Invoker · {c.crownsOnOffer} en juego en torneos · {c.leaderboardCrowns} en la clasificación</p></div>
        </div>
        {st !== 'done' && <ChaseTimeline c={c} />}
        <details><summary>Lista de torneos ({c.runs.length})</summary>
          <ul className="run-list">{c.runs.map((r, i) => { const rs = status(r.start, r.end); return <li key={i} className={rs}><OfficialImg src={r.icon} alt="" className="mini-icon" /><b>{r.name}</b><span className="muted">{fmtDateTime(r.start)} – {fmtDateTime(r.end)}</span><span>{r.crowns} coronas</span>{rs === 'live' && <span className="tag good">Ahora</span>}</li> })}</ul>
        </details>
        {c.official && <a className="link" href={c.official} target="_blank" rel="noreferrer">Planificador oficial <ExternalLink size={12} /></a>}
      </section>
    })}
    <p className="muted">Divisiones de los torneos: {ev.data.divisions.map(d => `${d.name.replace('Beginner', 'Principiante').replace('Intermediate', 'Intermedia').replace('Veteran', 'Veterana')} (${d.levels.replace('Lv', 'nv.')})`).join(' · ')}.</p>
  </>
}

/** Calendario de una caza: una fila por torneo, una barra por cada vez que se juega y la línea de hoy. */
function ChaseTimeline({ c }: { c: Chase }) {
  const start = Date.parse(c.start), end = Date.parse(c.end), span = end - start
  const day = 86400000
  const days = Array.from({ length: Math.ceil(span / day) }, (_, i) => new Date(start + i * day))
  const rows = [...new Map(c.runs.map(r => [r.name, { name: r.name, icon: r.icon, crowns: r.crowns, runs: c.runs.filter(x => x.name === r.name) }])).values()]
  const now = Date.now()
  const pos = (t: number) => `${Math.min(100, Math.max(0, 100 * (t - start) / span))}%`
  const total = c.runs.reduce((a, r) => a + r.crowns, 0)
  return <div className="timeline" role="group" aria-label={`Calendario de torneos de ${c.name}`}>
    <p className="muted">{c.runs.length} torneos · {total} coronas posibles · necesitas {c.crownsNeeded}: puedes saltarte {Math.max(0, total - c.crownsNeeded)} coronas.</p>
    <div className="timeline-scroll"><div className="timeline-grid" style={{ ['--days' as string]: days.length }}>
      <div className="tl-corner">Torneo</div>
      <div className="tl-days">{days.map(d => <span key={+d} className={d.toDateString() === new Date(now).toDateString() ? 'today' : ''}>{d.toLocaleDateString('es-ES', { weekday: 'short' })}<b>{d.getDate()}</b></span>)}</div>
      {rows.map(r => <div key={r.name} className="tl-row">
        <div className="tl-name"><OfficialImg src={r.icon} alt="" className="mini-icon" /><span><b>{r.name}</b><small>{r.crowns ? `${r.crowns} coronas` : 'sin coronas'}</small></span></div>
        <div className="tl-track">
          {r.runs.map((x, i) => { const a = Date.parse(x.start), b = Date.parse(x.end), st = b < now ? 'done' : a > now ? 'next' : 'live'
            return <span key={i} className={`tl-bar ${st}`} style={{ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` }} title={`${x.name}: ${fmtDateTime(x.start)} – ${fmtDateTime(x.end)}${x.crowns ? ` · ${x.crowns} coronas` : ''}`}>{x.crowns || ''}</span> })}
          {now > start && now < end && <i className="tl-now" style={{ left: pos(now) }} aria-hidden />}
        </div>
      </div>)}
    </div></div>
    <p className="tl-legend"><span className="tl-bar live" /> en curso <span className="tl-bar next" /> próximo <span className="tl-bar done" /> terminado <i className="tl-now-key" /> ahora</p>
  </div>
}
