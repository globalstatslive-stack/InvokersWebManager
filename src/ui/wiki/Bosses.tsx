import { useState } from 'react'
import { ArrowLeft, ExternalLink, Target, Users } from 'lucide-react'
import { useAccount } from '../account'
import { PageHead } from '../common'
import { ElementIcon } from '../Art'
import { ELEMENT_LABEL, fmtInt, t } from '../../box/i18n'
import { loadBosses, type Boss } from '../../box/goal'
import { loadIndex, useLoad, type Summary } from '../../wiki/data'
import { BOSS_CATEGORY, BOSS_CATEGORY_HELP, TOL_LABEL } from '../../wiki/labels'
import { Failed, Loading, NotFound, OfficialImg, Source, Thumb } from './kit'

const CATS = ['Relic Boss', 'Crest Boss', 'Essence Boss', 'Clan Boss', 'Titan Boss']
const TIERS = ['S+', 'S', 'A+', 'A', 'B', 'C', 'D', 'E']
const official = (u: string) => u.startsWith('http') ? u : `https://invokers.com${u}`
const tolEs = (k: string) => TOL_LABEL[k] ?? TOL_LABEL[k.replace(/\s/g, '')] ?? k

export function BossList() {
  const { go } = useAccount()
  const b = useLoad(loadBosses)
  if (b.error) return <Failed error={b.error} />
  if (!b.data) return <Loading what="los jefes" />
  return <>
    <PageHead kicker="Enciclopedia" title="Jefes">{b.data.bosses.length} jefes con todas sus fases: vida, ataque, defensa, PREC, RES, tolerancia y los objetivos de estadística de la guía oficial.</PageHead>
    <Source href={b.data.source} date={b.data.fetchedAt} />
    {CATS.map(cat => { const list = b.data!.bosses.filter(x => x.category === cat); return list.length > 0 && <section key={cat} className="panel">
      <h2>{BOSS_CATEGORY[cat] ?? cat}</h2><p className="muted">{BOSS_CATEGORY_HELP[cat]}</p>
      <div className="boss-grid">{list.map(x => <button key={x.slug} className="wboss-card" onClick={() => go(`/wiki/jefes/${x.slug}`)}>
        <OfficialImg src={official(x.portrait)} alt="" className="boss-img" />
        <span><b>{x.name}</b><small>{x.epithet}</small><small className="muted">{x.stages.length} fases · {x.corruptions.map(c => tolEs(c.key)).join(', ') || 'sin corrupción'}</small></span>
      </button>)}</div>
    </section> })}
  </>
}

export function BossPage({ slug }: { slug: string }) {
  const { account, go } = useAccount()
  const b = useLoad(loadBosses), idx = useLoad(loadIndex)
  const [stage, setStage] = useState<number | null>(null)
  const back = <button className="link" onClick={() => go('/wiki/jefes')}><ArrowLeft size={15} /> Todos los jefes</button>
  if (b.error) return <Failed error={b.error} />
  if (!b.data) return <Loading what="el jefe" />
  const boss: Boss | undefined = b.data.bosses.find(x => x.slug === slug)
  if (!boss) return <NotFound what={`el jefe «${slug}»`} back={back} />
  const byCode = new Map<string, Summary>([...(idx.data?.invokers ?? []), ...(idx.data?.titans ?? [])].map(s => [s.code, s]))
  const owned = new Set(account?.box.heroes.map(h => h.code) ?? [])
  const s = boss.stages.find(x => x.stage === stage) ?? boss.stages[boss.stages.length - 1]
  const prepare = () => {
    if (!account) return go('/importar')
    const key = `nexo.goal.${account.box.profile.name}`
    let prev = {}; try { prev = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* nada */ }
    try { localStorage.setItem(key, JSON.stringify({ ...prev, boss: boss.slug, stage: s.stage, team: [] })) } catch { /* sin almacenamiento */ }
    go('/objetivo')
  }
  const tiered = TIERS.map(tier => ({ tier, list: Object.entries(boss.tier).filter(([, v]) => v.tier === tier).map(([code, v]) => ({ code, score: v.score, s: byCode.get(code) })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) })).filter(x => x.list.length)
  const mineTop = tiered.flatMap(x => x.list.filter(e => owned.has(e.code)).map(e => ({ ...e, tier: x.tier }))).slice(0, 10)
  return <article className="wiki-page">
    {back}
    <header className="wiki-hero boss">
      <OfficialImg src={official(boss.portrait)} alt="" className="boss-hero-img" />
      <div className="wiki-hero-text">
        <span className="kicker">{BOSS_CATEGORY[boss.category] ?? boss.category}</span>
        <h1>{boss.name}</h1><p className="muted">{boss.epithet}</p>
        <p className="chip-row">{boss.corruptions.length ? boss.corruptions.map(c => <span key={c.key} className="chip">Corrupción: {tolEs(c.key)}</span>) : <span className="chip">Sin corrupción</span>}</p>
        <p className="chip-row"><button className="btn small primary" onClick={prepare}><Target size={14} /> Preparar este objetivo</button>{account && <button className="btn small" onClick={() => { try { localStorage.setItem('nexo.teamfinder', JSON.stringify({ boss: boss.slug, stage: s.stage })) } catch { /* sin almacenamiento */ } go('/asesor/equipo') }}><Users size={14} /> Mi mejor equipo</button>}<a className="btn small" href={boss.guide} target="_blank" rel="noreferrer">Guía oficial (inglés) <ExternalLink size={13} /></a></p>
      </div>
    </header>

    <section className="panel">
      <div className="panel-title"><h2>Fases</h2>
        <label className="lv-pick">Fase <select value={s.stage} onChange={e => setStage(Number(e.target.value))}>{boss.stages.map(x => <option key={x.stage} value={x.stage}>{x.stage}</option>)}</select></label></div>
      <dl className="stat-strip">
        <div><dt>Elemento</dt><dd><ElementIcon element={s.element} /> {t(ELEMENT_LABEL, s.element)}</dd></div>
        <div><dt>Vida</dt><dd>{fmtInt(s.hp)}</dd></div><div><dt>Ataque</dt><dd>{fmtInt(s.atk)}</dd></div><div><dt>Defensa</dt><dd>{fmtInt(s.def)}</dd></div>
        <div><dt>PREC</dt><dd>{s.acc}</dd></div><div><dt>RES</dt><dd>{s.res}</dd></div><div><dt>Tolerancia</dt><dd>{s.tolerance > 0 ? '+' : ''}{s.tolerance} %</dd></div>
      </dl>
      <p className="goal-line">Objetivos de la guía en la fase {s.stage}: <b>PREC {s.accGoal}</b> para que entren tus perjuicios · <b>RES {s.resGoal}</b> para resistir los suyos{boss.corruptions.length ? <> · <b>tolerancia {s.tolGoal} %</b> a {boss.corruptions.map(c => tolEs(c.key)).join(' y ')}</> : null}.</p>
      <details><summary>Todas las fases ({boss.stages.length})</summary>
        <div className="table-wrap"><table className="data compact"><thead><tr><th>Fase</th><th>Elem.</th><th>Vida</th><th>ATQ</th><th>DEF</th><th>PREC</th><th>RES</th><th>Tol.</th><th>Obj. PREC</th><th>Obj. RES</th><th>Obj. tol.</th></tr></thead>
          <tbody>{boss.stages.map(x => <tr key={x.stage} className={x.stage === s.stage ? 'on' : ''} onClick={() => setStage(x.stage)}><td>{x.stage}</td><td><ElementIcon element={x.element} /></td><td>{fmtInt(x.hp)}</td><td>{fmtInt(x.atk)}</td><td>{fmtInt(x.def)}</td><td>{x.acc}</td><td>{x.res}</td><td>{x.tolerance} %</td><td>{x.accGoal}</td><td>{x.resGoal}</td><td>{x.tolGoal} %</td></tr>)}</tbody></table></div>
      </details>
    </section>

    {account && mineTop.length > 0 && <section className="panel">
      <h2>Tus Invokers mejor valorados aquí</h2>
      <div className="mini-roster">{mineTop.map(e => e.s && <button key={e.code} className="mini-card" onClick={() => go(`/wiki/${e.s!.cls ? 'invokers' : 'titanes'}/${e.s!.slug}`)}><Thumb s={e.s} size="sm" /><span className={`tier-tag t-${e.tier.replace('+', 'p')}`}>{e.tier}</span><small>{e.s.short}</small></button>)}</div>
    </section>}

    <section className="panel">
      <h2>Tier list oficial de {boss.name}</h2>
      {tiered.length === 0 ? <p className="muted">La guía no publica tier list para este jefe.</p> : tiered.map(x => <div key={x.tier} className="tier-row">
        <span className={`tier-tag big t-${x.tier.replace('+', 'p')}`}>{x.tier}</span>
        <div className="mini-roster">{x.list.map(e => e.s ? <button key={e.code} className={`mini-card ${account && !owned.has(e.code) ? 'missing' : ''}`} onClick={() => go(`/wiki/${e.s!.cls ? 'invokers' : 'titanes'}/${e.s!.slug}`)} title={e.score !== null ? `Nota ${e.score.toFixed(2)}` : undefined}><Thumb s={e.s} size="sm" /><small>{e.s.short}</small></button> : null)}</div>
      </div>)}
      {boss.tierListUrl && <p className="muted"><a href={boss.tierListUrl} target="_blank" rel="noreferrer">Ver en invokers.com <ExternalLink size={11} /></a></p>}
    </section>
    <Source href={boss.guide} date={b.data.fetchedAt} />
  </article>
}
