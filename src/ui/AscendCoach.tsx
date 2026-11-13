import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, ExternalLink, Info, Layers, Loader2, Star, Trophy } from 'lucide-react'
import type { Hero } from '../box/model'
import { ASCENSION, ASCEND_WEIGHTS, ascendMaterial, ascendRanking, craftUnits, rangeXp, type AscendCandidate, type Crafted, type Material, type OfficialTiers } from '../box/ascension'
import { loadBosses } from '../box/goal'
import { fmtInt, RARITY_LABEL, t } from '../box/i18n'
import { loadDetail, loadIndex, loadTiers, useLoad } from '../wiki/data'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { usePlan } from './plan'
import { Chips } from './common'
import { GameCard, Stars } from './Art'

export type AscendData = { six: AscendCandidate[]; five: AscendCandidate[]; material: Material; craft5: Crafted; craft4: Crafted }
/** Ranking de ascensión y material de la cuenta abierta (null mientras cargan las tier lists oficiales). */
export function useAscend(): AscendData | null {
  const { account } = useAccount()
  const bosses = useLoad(loadBosses), tiers = useLoad(loadTiers)
  const active = useActiveTeams(account?.box)
  const { plan } = usePlan(account?.box)
  return useMemo(() => {
    if (!account || !bosses.data || !tiers.data) return null
    const general = new Map<string, { tier: string; score: number }>()
    for (const r of tiers.data.invokers.rows) for (const e of r.entries) if (e.code && e.score != null) general.set(e.code, { tier: r.label, score: e.score })
    const official: OfficialTiers = { general, bosses: bosses.data.bosses }
    const opts = { activeKeys: new Set(active.keys), planned: new Set(plan.map(e => e.heroId)) }
    const six = ascendRanking(account.box, 5, official, opts), five = ascendRanking(account.box, 4, official, opts)
    // Los candidatos con uso real nunca cuentan como material.
    const keep = new Set([...six, ...five].filter(c => c.teams.length || c.battles > 0).map(c => c.hero.id))
    const material = ascendMaterial(account.box, official, keep)
    return { six, five, material, craft5: craftUnits(material, 5), craft4: craftUnits(material, 4) }
  }, [account, bosses.data, tiers.data, active.keys, plan])
}

const PART_LABEL = { use: 'Lo usas', value: 'Tier oficial', invest: 'Ya invertido', ready: 'Listo' } as const
function ScoreBar({ c }: { c: AscendCandidate }) {
  const parts = (['use', 'value', 'invest', 'ready'] as const).map(k => ({ k, v: ASCEND_WEIGHTS[k] * c.parts[k] }))
  return <div className="asc-score" title="Puntuación de Nexo (0–100)">
    <div className="asc-bar" role="img" aria-label={`Puntuación ${c.score} de 100`}>{parts.map(p => <i key={p.k} className={`p-${p.k}`} style={{ width: `${100 * p.v}%` }} />)}</div>
    <ul className="asc-legend">{parts.map(p => <li key={p.k}><i className={`p-${p.k}`} />{PART_LABEL[p.k]} <b>{Math.round(100 * c.parts[p.k])}</b></li>)}</ul>
  </div>
}

const num = (s: string) => Number(s.replace(/[^\d.]/g, ''))
/** Techo oficial: estadísticas máximas de la ficha (6★, nivel 60, despertar completo) frente a la base actual. */
function Ceiling({ hero }: { hero: Hero }) {
  const [rows, setRows] = useState<{ label: string; now: number; max: number }[] | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      const index = await loadIndex()
      const slug = index.invokers.find(s => s.code === hero.code)?.slug
      const d = slug ? await loadDetail('invokers', slug) : null
      if (!live || !d || !hero.basis) return
      const of = (key: string) => num(d.maxStats.find(s => s.key === key)?.value ?? '0')
      setRows([['VIDA', 'health'], ['ATQ', 'attack'], ['DEF', 'defense']].map(([label, k]) => ({ label, now: Math.round(hero.basis![k] ?? 0), max: of(k) })).filter(r => r.max > 0 && r.now > 0))
    })().catch(() => undefined)
    return () => { live = false }
  }, [hero])
  if (!rows?.length) return null
  return <div className="asc-ceiling">
    <h5>Hasta dónde puede llegar (dato oficial)</h5>
    <ul>{rows.map(r => <li key={r.label}><span>{r.label} base</span><b>{fmtInt(r.now)}</b><ArrowRight size={13} aria-hidden /><b className="up">{fmtInt(r.max)}</b><small>+{Math.round(100 * (r.max / r.now - 1))} %</small></li>)}</ul>
    <p className="fine">A la izquierda, su base de hoy sin piezas. A la derecha, el máximo de su ficha oficial: 6★, nivel 60 y despertar completo. Subir a 6★ es el paso que abre los niveles 51–60; el resto del margen viene del despertar.</p>
  </div>
}

function CandidateCard({ c, pos }: { c: AscendCandidate; pos: number }) {
  const { go } = useAccount()
  const [open, setOpen] = useState(pos === 1)
  const cap = ASCENSION.cap(c.from)
  return <li className={`asc-card ${pos === 1 ? 'first' : ''}`}>
    <div className="asc-main">
      <span className={`asc-pos ${pos <= 3 ? 'gold' : ''}`}>{pos}</span>
      <GameCard c={c.hero} level={c.hero.level} rank={c.hero.rank} onClick={() => go(`/invoker/${c.hero.id}`)} label={`Abrir ${c.hero.fullName}`} />
      <div className="asc-body">
        <div className="asc-title">
          <b>{c.hero.name}</b>
          <span className="asc-step"><Stars n={c.from} max={6} /> <ArrowRight size={13} aria-hidden /> <Stars n={c.to} max={6} /></span>
          {pos === 1 && <span className="tag good"><Trophy size={12} /> El siguiente</span>}
          <span className="asc-points">{c.score}<small>/100</small></span>
        </div>
        <ScoreBar c={c} />
        <ul className="asc-why">
          {c.reasons.slice(0, open ? 9 : 2).map(r => <li key={r} className="ok"><Check size={14} aria-hidden />{r}</li>)}
          {c.cautions.map(r => <li key={r} className="warn"><AlertTriangle size={14} aria-hidden />{r}</li>)}
        </ul>
        <div className="asc-need">
          <span className={c.atCap ? 'ok' : 'need'}>{c.atCap ? <Check size={13} /> : <Info size={13} />} Nivel {c.hero.level}/{cap}{!c.atCap && c.xpToCap !== null ? ` · faltan ${fmtInt(c.xpToCap)} XP` : ''}</span>
          <span className="need"><Layers size={13} /> {c.cost} Invokers o Ecos de {c.from}★</span>
          {c.spareCopies.length > 0 && <span className="ok"><Check size={13} /> Tienes {c.spareCopies.length} copia{c.spareCopies.length > 1 ? 's' : ''} suya{c.spareCopies.length > 1 ? 's' : ''} de {c.from}★</span>}
        </div>
        <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Menos' : 'Qué gana y qué cuesta'} <ChevronDown size={14} className={open ? 'flip' : ''} /></button>
      </div>
    </div>
    {open && <div className="asc-more">
      <div className="asc-gain">
        <h5>Qué gana</h5>
        <p>Su tope pasa de nivel {cap} a {cap + 10}. Subir esos 10 niveles aumenta su VIDA, ATQ y DEF base (las demás estadísticas no cambian con el nivel) y, con ellas, todo lo que tus piezas suman en %.</p>
        <h5>Qué cuesta</h5>
        <ol>
          {!c.atCap && <li>Llevarlo al nivel {cap}{c.xpToCap !== null ? `: ${fmtInt(c.xpToCap)} de XP` : ''}.</li>}
          <li>Entregar {c.cost} Invokers o Ecos de {c.from}★. Se pierden para siempre; sus piezas vuelven a tu inventario gratis.</li>
          <li>Después, {fmtInt(c.xpNewRange)} de XP para llevarlo del nivel {cap} al {cap + 10} y aprovechar la subida entera.</li>
        </ol>
        {c.bossTiers.length > 0 && <p className="fine">Tier list oficial en tus jefes: {c.bossTiers.map(b => `${b.name} ${b.tier} (tu récord: fase ${b.record})`).join(' · ')}.</p>}
      </div>
      <Ceiling hero={c.hero} />
    </div>}
  </li>
}

function MaterialPanel({ d, target }: { d: AscendData; target: 5 | 4 }) {
  const stars = [1, 2, 3, 4, 5].filter(s => d.material.byStars[s]?.length)
  const craft = target === 5 ? d.craft5 : d.craft4
  const per = ASCENSION.cost(target), can = Math.floor(craft.units / per)
  const max = Math.max(1, ...stars.map(s => d.material.byStars[s].length))
  return <section className="panel asc-material">
    <div className="panel-title"><h2>¿Tienes con qué?</h2><small>Invokers que no usas · sin contar Ecos</small></div>
    <p className="lead">Cada ascensión a {target + 1}★ pide <b>{per} Invokers o Ecos de {target}★</b>. Si no los tienes, se fabrican: un Invoker sube de estrellas entregando otros de sus mismas estrellas, así que el material sale de fusionar hacia arriba los que no usas.</p>
    {d.material.total === 0 ? <p className="muted">No hay Invokers libres que Nexo pueda contar como material.</p> : <>
      <ul className="asc-stock">{stars.map(s => <li key={s}><span className="asc-stock-star">{s}★</span><span className="meter"><i style={{ width: `${100 * d.material.byStars[s].length / max}%` }} /></span><b>{fmtInt(d.material.byStars[s].length)}</b></li>)}</ul>
      <div className={`asc-verdict ${can ? 'ok' : 'warn'}`}>
        <b>{can ? `Te da para ${can} ascensi${can === 1 ? 'ón' : 'ones'} a ${target + 1}★` : `Aún no te da para una ascensión a ${target + 1}★`}</b>
        <p>Fusionando todo hacia arriba reunirías <b>{craft.units}</b> unidad{craft.units === 1 ? '' : 'es'} de {target}★{craft.xp > 0 ? <> y tendrías que gastar unos <b>{fmtInt(craft.xp)}</b> de XP en subir las bases a su tope</> : null}.</p>
      </div>
      {craft.steps.length > 0 && <details className="asc-steps"><summary>Ver la cuenta paso a paso</summary>
        <ol>{craft.steps.map(st => <li key={st.stars}>{st.made} de {st.stars}★: cada uno pide una base de {st.stars - 1}★ al nivel {ASCENSION.cap(st.stars - 1)} y {st.stars - 1} más de {st.stars - 1}★{st.xp ? ` (${fmtInt(st.xp)} de XP en total)` : ''}.</li>)}</ol>
      </details>}
    </>}
    <p className="fine"><Info size={13} /> Nexo cuenta como material solo lo prudente: Invokers sin bloquear, fuera de tus equipos y de tu plan, sin piezas ni despertar, que sean copias repetidas o comunes, poco comunes y raros que no están en S+, S o A+ de la tier list oficial. La caja no publica tus Ecos ni tus pociones de XP: cada Eco de {target}★ que tengas ahorra un Invoker.</p>
  </section>
}

function HowItWorks() {
  const rows = [1, 2, 3, 4, 5, 6]
  return <details className="panel howto asc-how">
    <summary><BookOpen size={18} /> Cómo funciona subir de estrellas (1 minuto)</summary>
    <div className="howto-grid">
      <table className="data compact"><thead><tr><th>Estrellas</th><th>Tope de nivel</th><th>XP hasta el tope</th><th>Para subir</th></tr></thead>
        <tbody>{rows.map(s => <tr key={s}><td>{s}★</td><td>{ASCENSION.cap(s)}</td><td>{fmtInt(ASCENSION.totalXp[ASCENSION.cap(s)])}</td><td>{s < 6 ? `${s} de ${s}★` : 'máximo'}</td></tr>)}</tbody></table>
      <ol className="howto-steps">
        <li><b>Las estrellas fijan el tope de nivel.</b> Un 5★ no pasa del nivel 50; a 6★ llega al 60, el máximo del juego.</li>
        <li><b>Subir de nivel solo aumenta VIDA, ATQ y DEF.</b> Lo demás (críticos, precisión, velocidades) viene de piezas, despertar y habilidades.</li>
        <li><b>Para ascender</b> tiene que estar en su tope y hay que entregarle tantos Invokers o Ecos de sus mismas estrellas como estrellas tiene: de 5★ a 6★, cinco de 5★.</li>
        <li><b>Lo que entregas se pierde.</b> Por eso el material es lo caro: no subas a todos, concentra en los que juegas.</li>
        <li><b>Los últimos niveles son los caros:</b> del 51 al 60 hacen falta {fmtInt(rangeXp(60))} de XP, más que del 1 al 50 juntos ({fmtInt(ASCENSION.totalXp[50])}).</li>
      </ol>
    </div>
    <p className="golden"><b>Regla de oro:</b> sube primero a quien ya usas en más equipos y que además sea bueno en la tier list oficial. Un 6★ que juegas a diario vale más que tres que no salen del banquillo.</p>
    <p className="fine">Fuente: guías oficiales de <a href={ASCENSION.guides.ascension} target="_blank" rel="noreferrer">ascensión <ExternalLink size={11} /></a> y <a href={ASCENSION.guides.levelling} target="_blank" rel="noreferrer">subida de nivel <ExternalLink size={11} /></a>, y <a href={ASCENSION.guides.tierList} target="_blank" rel="noreferrer">tier list oficial <ExternalLink size={11} /></a>.</p>
  </details>
}

/** Coach › A quién subir: ranking de ascensión a 6★ y a 5★. */
export function AscendCoach({ initial }: { initial?: string }) {
  const { account } = useAccount()
  const d = useAscend()
  const [target, setTarget] = useState<'6' | '5'>(initial === '5' ? '5' : '6')
  const [limit, setLimit] = useState(8)
  if (!account) return null
  if (!d) return <p className="muted center"><Loader2 size={16} className="spin" /> Cargando las tier lists oficiales…</p>
  const list = target === '6' ? d.six : d.five
  const noXp = account.box.heroes.every(h => h.totalXp == null)
  return <section className="advisor asc-coach">
    <p className="lead">A quién subir de estrellas primero para que tu cuenta lo note más. Nexo ordena a tus Invokers por lo que los usas (tus equipos y combates), por su nota en las tier lists oficiales y por lo que ya has invertido en ellos.</p>
    <HowItWorks />
    <div className="toolbar-row asc-tabs">
      <Chips label="Objetivo" value={target} onChange={v => { setTarget(v); setLimit(8) }} options={[{ id: '6', label: <><Star size={13} /> A 6★ <small>({d.six.length})</small></> }, { id: '5', label: <><Star size={13} /> A 5★ <small>({d.five.length})</small></> }]} />
    </div>
    {list.length === 0 ? <div className="empty small"><h3>Ningún Invoker de {target === '6' ? 5 : 4}★</h3><p>{target === '6' ? 'Cuando tengas alguno en 5★ aparecerá aquí.' : 'Tus mejores copias ya están por encima de 4★ o aún no llegan.'}</p></div> : <>
      <ol className="asc-list">{list.slice(0, limit).map((c, i) => <CandidateCard key={c.hero.id} c={c} pos={i + 1} />)}</ol>
      {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 12)}>Mostrar más ({list.length - limit})</button></div>}
    </>}
    <MaterialPanel d={d} target={target === '6' ? 5 : 4} />
    <details className="panel asc-method">
      <summary><Info size={16} /> Cómo ordena Nexo</summary>
      <ul className="dashes">
        <li><b>Lo usas ({Math.round(100 * ASCEND_WEIGHTS.use)} %)</b>: en cuántos de tus equipos registrados está (jefes, agujas, arena, jefe de clan) y cuántos combates lleva. Los de tus equipos activos y tu plan suman un extra.</li>
        <li><b>Tier oficial ({Math.round(100 * ASCEND_WEIGHTS.value)} %)</b>: su nota en la tier list general de invokers.com y, de los jefes en los que tienes récord, sus tres mejores notas.</li>
        <li><b>Ya invertido ({Math.round(100 * ASCEND_WEIGHTS.invest)} %)</b>: despertar y piezas puestas. Lo que ya le has dado se aprovecha desde el primer combate.</li>
        <li><b>Listo ({Math.round(100 * ASCEND_WEIGHTS.ready)} %)</b>: si ya está en su tope de nivel.</li>
      </ul>
      <p className="fine">Solo aparece la mejor copia de cada personaje. Nexo no estima cuánto sube cada estadística de un nivel a otro, porque el juego no lo publica; enseña el máximo oficial de cada ficha.{noXp ? ' Esta caja viene de la carpeta del juego y no trae la XP de cada Invoker: importa tu enlace para ver la que falta.' : ''} Los pesos son un criterio de Nexo: úsalos como guía, no como verdad.</p>
    </details>
    <p className="fine">Los Invokers {t(RARITY_LABEL, 'Legendary').toLowerCase()}s empiezan en 5★, los épicos en 4★ y los raros en 3★: por eso en «A 5★» verás sobre todo épicos y raros.</p>
  </section>
}
