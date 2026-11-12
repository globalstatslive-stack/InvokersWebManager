import { useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, Sparkles, Wand2 } from 'lucide-react'
import { useAccount } from '../account'
import { Chips, PageHead, SearchBox, Select } from '../common'
import { ClassIcon, ElementIcon, FactionIcon, GameCard } from '../Art'
import { CLASS_LABEL, ELEMENT_LABEL, fmtInt, RARITIES, RARITY_LABEL, STAT_LABEL, t } from '../../box/i18n'
import { loadBosses } from '../../box/goal'
import { loadDetail, loadIndex, loadTiers, useLoad, type Detail, type Kind, type Skill, type Summary } from '../../wiki/data'
import { EFFECT_LABEL, SKILL_TYPE, TOL_LABEL } from '../../wiki/labels'
import { esNum, Failed, Loading, NotFound, OfficialImg, portraitPath, RichText, Source } from './kit'

const KIND_ES = { invokers: 'Invokers', titans: 'Titanes' } as const
const ROUTE = { invokers: 'invokers', titans: 'titanes' } as const
const ROLE_ES: Record<string, string> = { Damage: 'Daño', Support: 'Apoyo', Tank: 'Tanque', Control: 'Control', Healer: 'Sanador' }
const tierOrder = (label?: string) => ['S+', 'S', 'A+', 'A', 'B', 'C', 'D', 'E'].indexOf(label ?? '') >>> 0

function useOwned() {
  const { account } = useAccount()
  return useMemo(() => {
    const m = new Map<string, { n: number; best: { id: number; power: number } | null }>()
    for (const h of account?.box.heroes ?? []) { const x = m.get(h.code) ?? { n: 0, best: null }; x.n++; if (!x.best || h.power > x.best.power) x.best = { id: h.id, power: h.power }; m.set(h.code, x) }
    for (const h of account?.box.titans ?? []) { const x = m.get(h.code) ?? { n: 0, best: null }; x.n++; m.set(h.code, x) }
    return account ? m : null
  }, [account])
}

export function CharacterList({ kind }: { kind: Kind }) {
  const { go } = useAccount()
  const idx = useLoad(loadIndex), tiers = useLoad(loadTiers)
  const owned = useOwned()
  const [q, setQ] = useState(''), [rarity, setRarity] = useState('all'), [element, setElement] = useState('all'), [cls, setCls] = useState('all'), [faction, setFaction] = useState('all')
  const [tol, setTol] = useState('all'), [eff, setEff] = useState('all'), [own, setOwn] = useState<'all' | 'owned' | 'missing'>('all'), [sort, setSort] = useState('tier')
  if (idx.error) return <Failed error={idx.error} />
  if (!idx.data) return <Loading what="el catálogo oficial" />
  const all = idx.data[kind]
  const tierOf = new Map<string, string>()
  for (const r of tiers.data?.[kind].rows ?? []) for (const e of r.entries) if (e.code) tierOf.set(e.code, r.label)
  const list = all.filter(c => (rarity === 'all' || c.rarity === rarity) && (element === 'all' || c.element === element) && (cls === 'all' || (kind === 'invokers' ? c.cls : c.role) === cls)
    && (faction === 'all' || c.faction === faction) && (tol === 'all' || c.tolerances.includes(tol)) && (eff === 'all' || c.effects.includes(eff))
    && (own === 'all' || !owned || (own === 'owned') === owned.has(c.code)) && (!q || `${c.name} ${c.short}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'rarity' ? RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name)
      : tierOrder(tierOf.get(a.code)) - tierOrder(tierOf.get(b.code)) || RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name))
  const uniq = (f: (c: Summary) => string | null) => [...new Set(all.map(f).filter(Boolean) as string[])].sort()
  const active = [rarity, element, cls, faction, tol, eff].filter(v => v !== 'all').length + (own !== 'all' ? 1 : 0)
  const have = owned ? all.filter(c => owned.has(c.code)).length : 0
  return <>
    <PageHead kicker="Enciclopedia" title={`Todos los ${KIND_ES[kind]}`}>{all.length} {KIND_ES[kind]} publicados{owned ? ` · tienes ${have} (${Math.round(100 * have / all.length)} %)` : ''}. Fichas con estadísticas, habilidades por nivel, tolerancias y nota oficial en cada jefe.</PageHead>
    <Source href={`${idx.data.source}/${kind}/`} version={idx.data.version} date={idx.data.fetchedAt} />
    <Chips label="Tipo" value={kind} onChange={v => go(`/wiki/${ROUTE[v]}`)} options={[{ id: 'invokers', label: `Invokers (${idx.data.invokers.length})` }, { id: 'titans', label: `Titanes (${idx.data.titans.length})` }]} />
    <div className="toolbar sticky">
      <SearchBox value={q} onChange={setQ} placeholder={`Buscar ${kind === 'invokers' ? 'Invoker' : 'Titán'}`} />
      {kind === 'invokers' && <Chips label="Elemento" value={element} onChange={setElement} options={[{ id: 'all', label: 'Todos' }, ...uniq(c => c.element).map(e => ({ id: e, label: <><ElementIcon element={e} /><span className="hide-sm">{t(ELEMENT_LABEL, e)}</span></> }))]} />}
      <details className="wiki-filters">
        <summary>Filtros{active > 0 && <span className="badge">{active}</span>}</summary>
        <div className="filter-grid">
          <Select label="Orden" value={sort} onChange={setSort} options={[{ id: 'tier', label: 'Tier list oficial' }, { id: 'rarity', label: 'Rareza' }, { id: 'name', label: 'Nombre' }]} />
          <Select label="Rareza" value={rarity} onChange={setRarity} options={[{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => all.some(c => c.rarity === r)).reverse().map(r => ({ id: r, label: t(RARITY_LABEL, r) }))]} />
          <Select label={kind === 'invokers' ? 'Clase' : 'Rol'} value={cls} onChange={setCls} options={[{ id: 'all', label: 'Todas' }, ...uniq(c => kind === 'invokers' ? c.cls : c.role).map(x => ({ id: x, label: CLASS_LABEL[x] ?? ROLE_ES[x] ?? x }))]} />
          <Select label="Facción" value={faction} onChange={setFaction} options={[{ id: 'all', label: 'Todas' }, ...uniq(c => c.faction).map(x => ({ id: x, label: x }))]} />
          {kind === 'invokers' && <Select label="Tolerancia" value={tol} onChange={setTol} options={[{ id: 'all', label: 'Cualquiera' }, ...idx.data.tolerances.map(x => ({ id: x.key, label: `${TOL_LABEL[x.key] ?? x.label} (${x.count})` }))]} />}
          {kind === 'invokers' && <Select label="Efecto de habilidad" value={eff} onChange={setEff} options={[{ id: 'all', label: 'Cualquiera' }, ...idx.data.effects.map(x => ({ id: x.key, label: `${EFFECT_LABEL[x.label] ?? x.label} (${x.count})` }))]} />}
          {owned && <Select label="En tu caja" value={own} onChange={v => setOwn(v as typeof own)} options={[{ id: 'all', label: 'Todos' }, { id: 'owned', label: 'Los tengo' }, { id: 'missing', label: 'Me faltan' }]} />}
          {active > 0 && <button className="btn small" onClick={() => { setRarity('all'); setElement('all'); setCls('all'); setFaction('all'); setTol('all'); setEff('all'); setOwn('all') }}>Quitar {active} filtro{active > 1 ? 's' : ''}</button>}
        </div>
      </details>
    </div>
    <p className="muted count-line" aria-live="polite">{list.length} de {all.length}</p>
    {list.length === 0 ? <div className="state-card">Ningún {kind === 'invokers' ? 'Invoker' : 'Titán'} cumple estos filtros.</div> :
      <div className="gcard-grid">{list.map(c => {
        const o = owned?.get(c.code), tier = tierOf.get(c.code)
        return <GameCard key={c.slug} c={{ name: c.short, portrait: portraitPath(c), rarity: c.rarity, element: c.element, cls: c.cls }} dim={!!owned && !o}
          corner={tier ? <span className={`tier-tag t-${tier.replace('+', 'p')}`} title="Tier list oficial (global)">{tier}</span> : undefined}
          badge={o ? (o.n > 1 ? `×${o.n}` : 'Tuyo') : undefined} onClick={() => go(`/wiki/${ROUTE[kind]}/${c.slug}`)} label={`${c.name}${tier ? `, ${tier} en la tier list` : ''}${o ? ', lo tienes' : ''}`}>
          <span className="gcard-sub">{kind === 'invokers' ? t(RARITY_LABEL, c.rarity) : <><FactionIcon faction={c.faction} /> {ROLE_ES[c.role ?? ''] ?? c.role}</>}</span>
        </GameCard>
      })}</div>}
  </>
}

const STAT_ORDER = ['health', 'attack', 'defense', 'criticalRate', 'criticalDamage', 'accuracy', 'resistance', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGeneration', 'instinct', 'runSpeed']
export function CharacterPage({ kind, slug }: { kind: Kind; slug: string }) {
  const { go } = useAccount()
  const d = useLoad(() => loadDetail(kind, slug), [kind, slug])
  const idx = useLoad(loadIndex), tiers = useLoad(loadTiers), bosses = useLoad(loadBosses)
  const owned = useOwned()
  const [level, setLevel] = useState<number | null>(null), [max, setMax] = useState(false)
  const back = <button className="link" onClick={() => go(`/wiki/${ROUTE[kind]}`)}><ArrowLeft size={15} /> Todos los {KIND_ES[kind]}</button>
  if (d.error) return <Failed error={d.error} />
  if (d.data === undefined) return <Loading what="la ficha oficial" />
  if (!d.data) return <NotFound what={`«${slug}»`} back={back} />
  const c: Detail = d.data
  const o = owned?.get(c.code)
  const overall = tiers.data?.[kind].rows.find(r => r.entries.some(e => e.code === c.code))
  const score = overall?.entries.find(e => e.code === c.code)?.score
  const perBoss = (bosses.data?.bosses ?? []).map(b => ({ b, tier: b.tier[c.code] })).filter(x => x.tier)
  const levels = c.skills[0]?.levels.length ?? 1
  const lv = Math.min(level ?? levels, levels)
  const effects = new Map(c.effects.map(e => [e.key, e]))
  const statRows = kind === 'invokers' ? STAT_ORDER.map(k => ({ k, a: c.stats.find(s => s.key === k), b: c.maxStats.find(s => s.key === k) })).filter(r => r.a || r.b) : []
  return <article className="wiki-page">
    {back}
    <header className="wiki-hero">
      {c.fullArt && <OfficialImg src={c.fullArt} alt="" className="wiki-art" eager />}
      <div className="wiki-hero-text">
        <span className="kicker">{kind === 'invokers' ? 'Invoker' : 'Titán'} · {t(RARITY_LABEL, c.rarity)}</span>
        <h1>{c.name}</h1>
        <p className="chip-row">
          {c.element && <span className="chip"><ElementIcon element={c.element} /> {t(ELEMENT_LABEL, c.element)}</span>}
          {c.cls && <span className="chip"><ClassIcon cls={c.cls} /> {t(CLASS_LABEL, c.cls)}</span>}
          {c.role && <span className="chip">{ROLE_ES[c.role] ?? c.role}</span>}
          {c.faction && <span className="chip"><FactionIcon faction={c.faction} /> {c.faction}</span>}
          {c.soulSign && <span className="chip"><OfficialImg src={c.soulSign.icon} alt="" className="mini-icon" /> {c.soulSign.name}</span>}
        </p>
        {overall && <p className="tier-line"><span className={`tier-tag big t-${overall.label.replace('+', 'p')}`}>{overall.label}</span> en la tier list oficial global{score ? ` · nota media ${score.toFixed(2)}` : ''}{tiers.data?.[kind].scope ? ` (${tiers.data[kind].scope.replace('boss fights', 'combates de jefe')})` : ''}</p>}
        {owned && <p className={`own-line ${o ? 'yes' : ''}`}>{o ? <>Tienes {o.n} {o.n > 1 ? 'copias' : 'copia'}{o.best ? ` · la mejor con ${fmtInt(o.best.power)} de poder` : ''}</> : 'No lo tienes en tu última importación.'}
          {o?.best && <> <button className="btn small" onClick={() => go(`/invoker/${o.best!.id}`)}>Mi ficha</button> <button className="btn small primary" onClick={() => go(`/optimizador/${o.best!.id}`)}><Wand2 size={14} /> Optimizar</button></>}</p>}
        <a className="btn small" href={c.official} target="_blank" rel="noreferrer">Guía oficial completa (inglés) <ExternalLink size={13} /></a>
      </div>
    </header>
    {c.comingSoon && <p className="note"><Sparkles size={15} /> Próximamente: {c.comingSoon}</p>}

    {kind === 'invokers' ? <section className="panel">
      <h2>Estadísticas</h2>
      <p className="muted">Nivel 1 y máximo publicados por el portal (sin equipo). Las de tu copia, con equipo, están en tu ficha.</p>
      <div className="table-wrap"><table className="data compact"><thead><tr><th>Estadística</th><th>Nv. 1</th><th>Máximo</th></tr></thead>
        <tbody>{statRows.map(r => <tr key={r.k}><td>{STAT_LABEL[r.k] ?? r.a?.label}</td><td>{esNum(r.a?.value) || '—'}{r.a?.detail && <small className="muted"> ({esNum(r.a.detail)})</small>}</td><td><b>{esNum(r.b?.value) || '—'}</b>{r.b?.detail && <small className="muted"> ({esNum(r.b.detail)})</small>}</td></tr>)}</tbody></table></div>
    </section> : <section className="panel">
      <h2>Bonificaciones</h2>
      <ul className="kv">{c.stats.map(s => <li key={s.label}><span>{s.label.replace("Bound Invoker's", 'Invoker vinculado:').replace('Bonus', 'Extra').replace('Movement speed', 'Vel. movimiento')}</span><b>{esNum(s.value)}{s.detail ? ` (${esNum(s.detail)})` : ''}</b></li>)}</ul>
      {c.maxStats.length > 0 && <><h3>Al máximo</h3><ul className="kv">{c.maxStats.map(s => <li key={s.label}><span>{s.label.replace("Bound Invoker's", 'Invoker vinculado:').replace('Bonus', 'Extra').replace('Movement speed', 'Vel. movimiento')}</span><b>{esNum(s.value)}</b></li>)}</ul></>}
      <ul className="kv">{c.fields.filter(f => f.section !== 'Identity').map(f => <li key={f.label}><span>{f.label.replace('Passive bonus', 'Bonificación pasiva').replace('Passive specialization', 'Especialización').replace('AOE skills', 'Habilidades de área').replace('Role', 'Rol').replace('Rarity', 'Rareza')}</span><b>{f.value}</b></li>)}</ul>
    </section>}

    {c.tolerances.length > 0 && <section className="panel">
      <h2>Tolerancias</h2>
      <div className="tol-list">{c.tolerances.map(x => <div key={x.key} className="tol-item"><OfficialImg src={x.icon} alt="" className="mini-icon" /><b>{TOL_LABEL[x.key] ?? x.label}</b><span>{x.levels.length ? `${x.levels[0]} → ${x.levels[x.levels.length - 1]}` : x.value}</span></div>)}</div>
      <p className="muted">De nivel 1 al máximo de la habilidad de tolerancia. Reducen la presión de esa corrupción en los jefes que la usan.</p>
    </section>}

    <section className="panel">
      <div className="panel-title"><h2>Habilidades</h2>
        <label className="lv-pick">Nivel <select value={lv} onChange={e => setLevel(Number(e.target.value))}>{Array.from({ length: levels }, (_, i) => <option key={i} value={i + 1}>{i + 1 === levels ? 'Máx.' : i + 1}</option>)}</select></label>
      </div>
      {lv === levels && <label className="check"><input type="checkbox" checked={max} onChange={e => setMax(e.target.checked)} /> Cifras con estadísticas máximas</label>}
      <p className="muted">Textos oficiales del juego (en inglés). <b className="rt-n">Verde</b>: valores; <b className="rt-u">azul</b>: mejoras; <b className="rt-d">rojo</b>: perjuicios.</p>
      <div className="skill-list">{c.skills.map((s, i) => <SkillCard key={i} s={s} lv={lv} max={max && lv === levels} effects={effects} />)}</div>
    </section>

    {perBoss.length > 0 && <section className="panel">
      <h2>Nota oficial por jefe</h2>
      <div className="boss-tiers">{perBoss.sort((a, b) => tierOrder(a.tier!.tier) - tierOrder(b.tier!.tier)).map(({ b, tier }) => <button key={b.slug} className="boss-tier" onClick={() => go(`/wiki/jefes/${b.slug}`)}>
        <span className={`tier-tag t-${tier!.tier.replace('+', 'p')}`}>{tier!.tier}</span><span>{b.name}</span>{tier!.score !== null && <small className="muted">{tier!.score.toFixed(2)}</small>}
      </button>)}</div>
      <p className="muted">Tier lists oficiales de cada guía de jefe: las elaboran los desarrolladores a partir de millones de combates.</p>
    </section>}
    {idx.data && <Source href={c.official} version={idx.data.version} date={idx.data.fetchedAt} />}
  </article>
}

function SkillCard({ s, lv, max, effects }: { s: Skill; lv: number; max: boolean; effects: Map<string, { label: string; description: string | null; icon: string | null; group: string }> }) {
  const l = s.levels[Math.min(lv, s.levels.length) - 1]
  const text = max && l.dm ? l.dm : l.d
  const cd = l.cd ?? s.cd
  return <div className="skill-card">
    <div className="skill-head"><OfficialImg src={s.icon} alt="" className="skill-icon" />
      <div><span className="kicker">{SKILL_TYPE[s.type] ?? s.type}{s.aoe ? ' · en área' : ''}</span><b>{s.name}</b>
        <small className="muted">{cd && cd !== '-' ? `Enfriamiento ${cd}` : ''}{l.cost && l.cost !== '-' && l.cost !== '0' ? ` · coste ${l.cost}` : ''}{s.mana.ult ? ` · maná ${s.mana.ult} definitiva · ${s.mana.titan} Titán` : ''}</small></div></div>
    <p><RichText src={esNum(text)} /></p>
    {s.effects.length > 0 && <p className="chip-row">{s.effects.map(k => { const e = effects.get(k); return e ? <span key={k} className={`chip eff ${e.group === 'Debuffs' ? 'bad' : e.group === 'Buffs' ? 'good' : ''}`} title={e.description ?? ''}><OfficialImg src={e.icon} alt="" className="mini-icon" />{EFFECT_LABEL[e.label] ?? e.label}</span> : null })}</p>}
  </div>
}
