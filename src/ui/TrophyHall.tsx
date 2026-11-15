import { useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Camera, Check, ExternalLink, FolderOpen, HelpCircle, Info, Lightbulb, Loader2, Pencil, Sparkles, TriangleAlert, X } from 'lucide-react'
import { convertedPay, HALL, HALL_STATS, hallLevels, hallRanking, spendPlan, TIER_LEVELS, type HallOption, type SpendLane, type Trophy, type Wallet } from '../box/trophyHall'
import { usedHeroes, type UsedHero } from '../box/equipBatch'
import { ELEMENT_LABEL, fmtInt, PERCENT_OF_BASE, STAT_LABEL, t } from '../box/i18n'
import type { Box } from '../box/model'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { usePlan } from './plan'
import { ElementIcon, Portrait, StatIcon } from './Art'
import { fileTime, TROPHY_ES, TROPHY_PL, useHallCosts, useTrophyWallet, type WalletData } from './trophyWallet'
import type { Scan } from './trophyScan'

const TIERS: Trophy[] = ['bronze', 'silver', 'gold']
/** Orden de compra que aconseja el coach: la plata primero (solo vale para sus niveles), luego bronce y oro. */
const BUY_ORDER: Trophy[] = ['silver', 'bronze', 'gold']
const GROUP_ES = { attack: 'Ataque', defense: 'Defensa', utility: 'Función' } as const
const hallName = (stat: string, mode: string) => `${STAT_LABEL[stat] ?? stat}${mode === 'percent' && PERCENT_OF_BASE.has(stat) ? ' %' : ''}`
const stepText = (o: Pick<HallOption, 'step' | 'mode'>) => o.step === null ? '?' : o.mode === 'percent' ? `+${(100 * o.step).toFixed(0)} %` : `+${fmtInt(o.step)}`
const tierOfLevel = (lv: number): Trophy | null => lv <= 0 ? null : HALL.tierOf(lv)
const optKey = (o: { element: string; stat: string }) => `${o.element}:${o.stat}`
const dateText = (iso: string | null) => {
  if (!iso) return 'sin fecha'
  const d = new Date(iso), mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (!Number.isFinite(mins)) return 'sin fecha'
  if (mins < 2) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  if (mins < 24 * 60) return `hace ${Math.round(mins / 60)} h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + (mins < 7 * 24 * 60 ? ` (hace ${Math.round(mins / 1440)} d)` : '')
}
const SOURCE_ES = { carpeta: 'tu carpeta del juego', captura: 'tu captura', manual: 'lo que escribiste' } as const

/** Copa dibujada por Nexo (no es arte del juego), con el color de cada tipo de trofeo. */
export function Cup({ tier, size = 30 }: { tier: Trophy; size?: number }) {
  const id = `cup-${tier}`
  const [a, b] = tier === 'bronze' ? ['#f0b58a', '#9a5a32'] : tier === 'silver' ? ['#f4f7fb', '#8b97a8'] : ['#ffe7a0', '#c48a1c']
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="cup">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <path fill={`url(#${id})`} d="M9 3h14v3h4.2c.5 0 .8.4.8.8 0 4.4-2.7 7.6-6.6 8.2a7.2 7.2 0 0 1-4 3.6V22h3.6v3H11v-3h3.6v-3.4a7.2 7.2 0 0 1-4-3.6C6.7 14.4 4 11.2 4 6.8c0-.4.3-.8.8-.8H9zM6.4 8.4c.5 2.3 1.9 3.9 3.6 4.5-.5-1.4-.8-2.9-.9-4.5zm19.2 0h-2.7c-.1 1.6-.4 3.1-.9 4.5 1.7-.6 3.1-2.2 3.6-4.5z" />
    <rect x="8" y="26" width="16" height="3.2" rx="1.2" fill={`url(#${id})`} />
    <path d="M13 6.5l3 2 3-2" stroke="#ffffff88" strokeWidth="1.1" fill="none" />
  </svg>
}
function Coin({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="cup">
    <defs><radialGradient id="coin-g" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#eef4ff" /><stop offset="1" stopColor="#6a7a99" /></radialGradient></defs>
    <circle cx="16" cy="16" r="13" fill="url(#coin-g)" stroke="#2c3550" strokeWidth="1.2" />
    <circle cx="16" cy="16" r="9.5" fill="none" stroke="#2c355088" strokeWidth="1.2" />
    <path d="M11 13.5c0-3 2.2-5 5-5s5 2 5 5v3.5l-2 2h-6l-2-2z" fill="#2c3550aa" />
  </svg>
}

/** Barra de trofeos como la del juego, con el origen del dato. */
function Hud({ wallet, onScan, onEdit, busy }: { wallet: WalletData | null; onScan: () => void; onEdit: () => void; busy: boolean }) {
  const cell = (key: string, icon: ReactNode, label: string, value: string) => <div key={key} className={`hud-cell ${key}`}>{icon}<span className="hud-num"><b>{value}</b><small>{label}</small></span></div>
  return <section className="hall-hud">
    <div className="hud-counters">
      {cell('coins', <Coin />, 'monedas', wallet?.coins != null ? `${wallet.coinsApprox ? '≈' : ''}${fmtInt(wallet.coins)}` : '—')}
      {TIERS.map(tr => cell(`t-${tr}`, <Cup tier={tr} />, TROPHY_PL[tr], wallet ? fmtInt(wallet[tr]) : '—'))}
    </div>
    <div className="hud-meta">
      {wallet
        ? <span className={`hud-src src-${wallet.source}`}>{wallet.source === 'carpeta' ? <FolderOpen size={13} /> : wallet.source === 'captura' ? <Camera size={13} /> : <Pencil size={13} />} Según {SOURCE_ES[wallet.source]} · {dateText(wallet.at)}</span>
        : <span className="hud-src none"><Info size={13} /> La caja compartida no publica tus trofeos: léelos de una captura o escríbelos.</span>}
      <span className="hud-actions">
        <button className="btn primary small" onClick={onScan} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Camera size={15} />} Leer captura</button>
        <button className="btn small" onClick={onEdit}><Pencil size={14} /> {wallet ? 'Corregir' : 'Escribir'}</button>
      </span>
    </div>
  </section>
}

type Draft = { coins: string; bronze: string; silver: string; gold: string; approx?: boolean }
const draftOf = (w: WalletData | null): Draft => ({ coins: w?.coins != null ? String(w.coins) : '', bronze: w ? String(w.bronze) : '', silver: w ? String(w.silver) : '', gold: w ? String(w.gold) : '', approx: w?.coinsApprox })

/** Confirmar lo leído de la captura o escribir los trofeos a mano. */
function WalletEditor({ draft, setDraft, strip, onSave, onCancel, fromScan }: { draft: Draft; setDraft: (d: Draft) => void; strip?: string; onSave: () => void; onCancel: () => void; fromScan: boolean }) {
  const field = (k: 'coins' | Trophy, label: string, icon: ReactNode) => <label key={k} className="wallet-field">
    {icon}<span>{label}</span>
    <input inputMode="numeric" value={draft[k]} placeholder="0" aria-label={label} onChange={e => setDraft({ ...draft, [k]: e.target.value.replace(/\D/g, '').slice(0, 7), ...(k === 'coins' ? { approx: false } : {}) })} />
  </label>
  return <section className="panel wallet-editor">
    <div className="panel-title"><h2>{fromScan ? <><Check size={18} /> ¿Coincide con tu captura?</> : <><Pencil size={18} /> Tus trofeos</>}</h2>
      <button className="icon-btn" aria-label="Cerrar" onClick={onCancel}><X size={16} /></button></div>
    {strip && <figure className="scan-strip"><img src={strip} alt="Barra de trofeos de tu captura" /><figcaption>Tu captura (no sale de este navegador)</figcaption></figure>}
    <div className="wallet-fields">
      {field('coins', draft.approx ? 'monedas (≈: el juego redondea)' : 'monedas', <Coin size={22} />)}
      {TIERS.map(tr => field(tr, TROPHY_PL[tr], <Cup tier={tr} size={22} />))}
    </div>
    <div className="row-actions"><button className="btn primary" onClick={onSave}><Check size={16} /> {fromScan ? 'Sí, guardar' : 'Guardar'}</button><button className="btn" onClick={onCancel}>Cancelar</button></div>
    <p className="fine">Se guarda solo en este navegador. Si luego importas la carpeta del juego, Nexo usa el dato más reciente.</p>
  </section>
}

/** Una mejora de la sala, como en el juego: anillo con el nivel (de 15) y relleno del color de su tramo. */
function Cell({ element, stat, mode, level, order, selected, onClick }: { element: string; stat: string; mode: string; level: number; order: number | null; selected: boolean; onClick: () => void }) {
  const tier = tierOfLevel(level)
  return <button className={`hc ${tier ? `t-${tier}` : 'off'} ${order ? 'pick' : ''} ${selected ? 'sel' : ''}`} style={{ ['--p' as string]: level / HALL.maxLevel }}
    onClick={onClick} aria-pressed={selected} title={`${hallName(stat, mode)} · nivel ${level}`}
    aria-label={`${t(ELEMENT_LABEL, element)} · ${hallName(stat, mode)}: nivel ${level}${order ? `, compra número ${order}` : ''}`}>
    <StatIcon stat={stat} className="hc-icon" />
    {level > 0 && <span className="hc-lv">{level}</span>}
    {order && <span className="hc-order">{order}</span>}
  </button>
}

/** Detalle de una mejora: qué da, a quién y en qué lugar de la compra va. */
function Focus({ k, o, level, order, costs }: { k: string; o: HallOption | null; level: number; order: number | null; costs: Record<number, number> }) {
  const [element, stat] = k.split(':')
  const mode = HALL_STATS.find(s => s.stat === stat)?.mode ?? 'flat'
  if (!o) return <div className="hb-focus"><div className="hb-focus-head">
    <span className="hb-focus-icons"><ElementIcon element={element} className="hall-el" /><StatIcon stat={stat} className="hall-stat" /></span>
    <span className="row-main"><b>{t(ELEMENT_LABEL, element)} · {hallName(stat, mode)}</b>
      <small>{level >= HALL.maxLevel ? 'Al máximo (nivel 15).' : `Nivel ${level}. Nexo aún no sabe cuánto da un nivel de esta mejora: súbela una vez en algún elemento y reimporta tu caja.`}</small></span>
  </div></div>
  const who = o.beneficiaries.filter(b => b.points > 0)
  const cost = costs[o.next]
  return <div className="hb-focus">
    <div className="hb-focus-head">
      <span className="hb-focus-icons"><ElementIcon element={o.element} className="hall-el" /><StatIcon stat={o.stat} className="hall-stat" /></span>
      <span className="row-main"><b>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)}</b>
        <small>Nivel {o.level} → {o.next} · {stepText(o)} por nivel · se paga con {TROPHY_ES[o.trophy]}{cost ? ` (${fmtInt(cost)})` : ''}</small></span>
      {order ? <span className="hb-badge">Compra nº {order}</span> : who.length ? null : <span className="hb-badge dim">No la notan</span>}
    </div>
    {o.beneficiaries.length ? <ul className="hall-heroes">{o.beneficiaries.map(b => <li key={b.hero.id} className={b.points > 0 ? '' : 'none'}>
      <Portrait c={b.hero} size="sm" />
      <span className="row-main"><b>{b.hero.name}</b><small>{b.hero.cls === 'Tank' ? 'tanque' : b.hero.cls === 'Support' ? 'apoyo' : 'daño'}{b.weight >= 3 ? ' · equipo activo o plan' : ''}</small></span>
      <span className="hall-delta">{b.points > 0 ? <>+{fmtInt(Math.round(b.delta))} {STAT_LABEL[o.stat] ?? o.stat}</> : 'no lo aprovecha'}</span>
    </li>)}</ul> : <p className="fine">No usas ningún Invoker de {t(ELEMENT_LABEL, o.element)}: esta mejora no se notaría en tus equipos.</p>}
  </div>
}

const ELEMENT_COLORS: Record<string, [string, string]> = {
  Fire: ['#d8432f', '#6e1610'], Earth: ['#4f9e2f', '#1d4a12'], Water: ['#2f78c9', '#123566'],
  Wind: ['#2aa596', '#0f4d47'], Light: ['#d9a91e', '#6e520a'], Dark: ['#9a4fd6', '#40195f'],
}

/** La sala como en el juego: un estandarte por elemento y sus 12 mejoras. */
function Board({ box, used, ranking, orderOf, selected, setSelected, costs, levelsAt }: {
  box: Box; used: UsedHero[]; ranking: ReturnType<typeof hallRanking>; orderOf: Map<string, number>
  selected: string | null; setSelected: (k: string) => void; costs: Record<number, number>; levelsAt: string
}) {
  const levels = useMemo(() => hallLevels(box), [box])
  const byKey = useMemo(() => new Map([...ranking.options, ...ranking.unknown].map(o => [optKey(o), o])), [ranking])
  return <section className="panel hall-board">
    <div className="panel-title"><h2>Tu sala</h2><small>{levelsAt} · toca una mejora para ver a quién ayuda</small></div>
    <div className="hb-legend">
      <span><i className="hc-dot off" /> sin subir</span><span><i className="hc-dot t-bronze" /> 1–5 bronce</span><span><i className="hc-dot t-silver" /> 6–10 plata</span><span><i className="hc-dot t-gold" /> 11–15 oro</span><span><i className="hc-dot pick" /> lo que compraría Nexo, en orden</span>
    </div>
    <div className="hb-grid">{HALL.elements.map(el => {
      const heroes = used.filter(u => u.hero.element === el)
      const total = HALL_STATS.reduce((s, x) => s + (levels.get(`${el}:${x.stat}`)?.level ?? 0), 0)
      const [c1, c2] = ELEMENT_COLORS[el]
      return <div key={el} className="hb-el" style={{ ['--el1' as string]: c1, ['--el2' as string]: c2 }}>
        <div className="hb-banner">
          <ElementIcon element={el} className="hb-el-icon" />
          <b>{t(ELEMENT_LABEL, el)}</b>
          <span className="hb-progress" title={`${total} de ${HALL_STATS.length * HALL.maxLevel} niveles`}><i style={{ width: `${100 * total / (HALL_STATS.length * HALL.maxLevel)}%` }} /></span>
          <small>{heroes.length ? `${heroes.length} que usas` : 'no usas'}</small>
        </div>
        <div className="hb-groups">{(['attack', 'defense', 'utility'] as const).map(g => <div key={g} className="hb-group">
          <span className="hb-gname">{GROUP_ES[g]}</span>
          <div className="hb-cells">{HALL_STATS.filter(s => s.group === g).map(s => {
            const k = `${el}:${s.stat}`
            return <Cell key={s.stat} element={el} stat={s.stat} mode={s.mode} level={levels.get(k)?.level ?? 0} order={orderOf.get(k) ?? null} selected={selected === k} onClick={() => setSelected(k)} />
          })}</div>
        </div>)}</div>
      </div>
    })}</div>
    {selected && <Focus k={selected} o={byKey.get(selected) ?? null} level={levels.get(selected)?.level ?? 0} order={orderOf.get(selected) ?? null} costs={costs} />}
    {ranking.maxed > 0 && <p className="fine"><Check size={13} /> {ranking.maxed} mejoras ya al nivel 15.</p>}
  </section>
}

/** Apuntar el coste de un nivel al verlo en el juego. */
function CostInput({ level, trophy, onSet }: { level: number; trophy: Trophy; onSet: (v: number | null) => void }) {
  const [v, setV] = useState('')
  const commit = () => { const x = Number(v); if (x > 0) onSet(x) }
  return <span className="cost-in">
    <input inputMode="numeric" placeholder="?" value={v} aria-label={`Coste del nivel ${level} en ${TROPHY_PL[trophy]}`} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 5))} onKeyDown={e => { if (e.key === 'Enter') commit() }} />
    <button className="btn small" onClick={commit} disabled={!v}>Apuntar</button>
  </span>
}

/** Compra recomendada con un tipo de trofeo, paso a paso y con lo que te queda. */
function Lane({ lane, wallet, mine, setCost, onPick }: { lane: SpendLane; wallet: Wallet | null; mine: Record<number, number>; setCost: (l: number, v: number | null) => void; onPick: (k: string) => void }) {
  const tr = lane.trophy, [lo, hi] = TIER_LEVELS[tr]
  const short = lane.stop.kind === 'short' ? lane.stop : null
  const pay = short && wallet ? convertedPay(tr, short.missing, wallet) : null
  const noted = Object.entries(mine).filter(([l]) => Number(l) >= lo && Number(l) <= hi)
  return <section className={`panel lane t-${tr}`}>
    <div className="lane-head"><Cup tier={tr} size={34} /><span className="row-main"><b>Con {TROPHY_PL[tr]}</b><small>niveles {lo}–{hi}{wallet ? ` · tienes ${fmtInt(wallet[tr])}` : ''}</small></span>
      {wallet && lane.spent > 0 && <span className="lane-left">te quedan <b>{fmtInt(lane.have)}</b></span>}</div>
    {lane.steps.length === 0 && lane.stop.kind === 'done' && <p className="fine">No hay mejoras de este tramo que noten los Invokers que usas{tr === 'gold' ? ' (primero hay que llevar alguna al nivel 10)' : tr === 'silver' ? ' (primero hay que llevar alguna al nivel 5)' : ''}.</p>}
    <ol className="lane-steps">{lane.steps.map((s, i) => {
      const o = s.option
      return <li key={i} className={s.cost === null ? 'unknown' : ''}>
        <span className="lane-n">{i + 1}</span>
        <button className="lane-what" onClick={() => onPick(optKey(o))} title="Verla en la sala" aria-label={`Ver ${t(ELEMENT_LABEL, o.element)} · ${hallName(o.stat, o.mode)} en la sala`}><ElementIcon element={o.element} className="hall-el" /><StatIcon stat={o.stat} className="hall-stat" /></button>
        <span className="row-main"><b>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)}</b>
          <small>nivel {s.from} → {s.to} · {stepText(o)} · {o.beneficiaries.filter(b => b.points > 0).length} de tus Invokers lo notan</small></span>
        {s.cost !== null
          ? <span className="lane-cost"><b>−{fmtInt(s.cost)}</b>{wallet && s.left !== null && <small>quedan {fmtInt(s.left)}</small>}</span>
          : <span className="lane-cost ask"><small>¿Cuánto pide el juego por el nivel {s.to}?</small><CostInput key={s.to} level={s.to} trophy={tr} onSet={v => setCost(s.to, v)} /></span>}
      </li>
    })}</ol>
    {lane.stop.kind === 'unknown-cost' && <p className="fine lane-note"><Info size={13} /> El juego solo publica el coste del nivel 1 (20 bronces). En la sala, toca la mejora y verás lo que pide por el siguiente nivel: apúntalo y Nexo sigue planificando (lo recuerda para ese nivel en todas las mejoras).</p>}
    {lane.queue.length > 0 && <div className="lane-queue"><small>Después, por orden:</small>{lane.queue.map(o => <button key={optKey(o)} className="queue-chip" onClick={() => onPick(optKey(o))}>
      <ElementIcon element={o.element} className="hall-el" /><StatIcon stat={o.stat} className="hall-stat" /><span>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)} <small>nv {o.next}</small></span></button>)}</div>}
    {short && <p className="fine lane-note"><TriangleAlert size={13} /> Para el siguiente paso (nivel {short.level}, {fmtInt(short.cost)} {TROPHY_PL[tr]}) te faltan {fmtInt(short.missing)}. {tr !== 'gold' && pay && (pay.silver || pay.gold) ? <>El juego los completaría con {[pay.silver ? `${fmtInt(pay.silver)} ${pay.silver === 1 ? 'plata' : 'platas'}` : '', pay.gold ? `${fmtInt(pay.gold)} ${pay.gold === 1 ? 'oro' : 'oros'}` : ''].filter(Boolean).join(' y ')}; solo merece la pena si no te quedan compras con {tr === 'bronze' ? 'plata' : 'oro'}.</> : 'Ahorra para él: es la compra que más rinde.'}</p>}
    {lane.stop.kind === 'limit' && <p className="fine lane-note">Y sigue: Nexo muestra las 6 primeras compras.</p>}
    {noted.length > 0 && <p className="fine lane-note">Costes que apuntaste: {noted.map(([l, c]) => <span key={l} className="cost-chip">nivel {l}: {fmtInt(c)} <button aria-label={`Borrar el coste del nivel ${l}`} onClick={() => setCost(Number(l), null)}><X size={11} /></button></span>)}</p>}
  </section>
}

type Tip = { tone: 'do' | 'warn' | 'info'; text: ReactNode }
/** Consejos del coach a partir de tus trofeos, tu sala y los Invokers que usas. */
function tipsFor(wallet: Wallet | null, lanes: Record<Trophy, SpendLane>, ranking: ReturnType<typeof hallRanking>, used: UsedHero[], levels: Map<string, { level: number }>, stale: string | null): Tip[] {
  const out: Tip[] = []
  if (stale) out.push({ tone: 'warn', text: <>Tus trofeos son más recientes que tu sala ({stale}). Si has subido mejoras desde entonces, actualiza tu caja: si no, Nexo puede proponerte un nivel que ya compraste.</> })
  const name = (o: HallOption) => <b>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)}</b>
  const first = (tr: Trophy) => lanes[tr].steps[0]?.option ?? ranking.options.find(o => o.trophy === tr && o.score > 0) ?? null
  if (wallet) {
    const s = first('silver'), b = first('bronze')
    if (wallet.silver > 0 && s) out.push({ tone: 'do', text: <>Empieza por la <b>plata</b>: solo paga los niveles 6–10 y tienes {fmtInt(wallet.silver)}. La que más rinde: {name(s)} (nivel {s.next}).</> })
    else if (wallet.silver > 0) out.push({ tone: 'info', text: <>Tienes {fmtInt(wallet.silver)} platas pero ninguna mejora útil en el nivel 5 todavía: lleva primero alguna al nivel 5 con bronces.</> })
    if (wallet.bronze > 0 && b) out.push({ tone: 'do', text: <>Con los <b>{fmtInt(wallet.bronze)} bronces</b>: {name(b)} (nivel {b.next}).</> })
    if (wallet.gold > 0 && !first('gold')) out.push({ tone: 'info', text: <>Tus {fmtInt(wallet.gold)} oros esperan a que alguna mejora útil llegue al nivel 10. No los gastes en niveles bajos: el juego los convertiría (1 oro = 4 bronces) y perderían su valor.</> })
    if (lanes.bronze.stop.kind === 'short' && wallet.silver > 0 && lanes.silver.steps.length) out.push({ tone: 'warn', text: <>Ojo: si subes un nivel de bronce sin bronces suficientes, el juego paga con plata (1 plata = 2 bronces). Tus platas rinden más en los niveles 6–10.</> })
  }
  const atFive = ranking.options.filter(o => o.level === 5 && o.score > 0).slice(0, 2)
  if (atFive.length) out.push({ tone: 'info', text: <>{atFive.map((o, i) => <span key={i}>{i ? ' y ' : ''}{name(o)}</span>)} {atFive.length === 1 ? 'está' : 'están'} en el nivel 5: lo siguiente ya se paga con <b>plata</b>.</> })
  const byEl = HALL.elements.map(el => ({ el, n: used.filter(u => u.hero.element === el).length })).sort((a, b) => b.n - a.n)
  if (byEl[0]?.n) {
    const lv = HALL_STATS.reduce((s, x) => s + (levels.get(`${byEl[0].el}:${x.stat}`)?.level ?? 0), 0)
    out.push({ tone: 'info', text: <>De los Invokers que usas, {byEl[0].n} son de <b>{t(ELEMENT_LABEL, byEl[0].el)}</b>{byEl[1]?.n ? ` (y ${byEl[1].n} de ${t(ELEMENT_LABEL, byEl[1].el)})` : ''}: cada nivel ahí lo nota más gente. Llevas {lv} {lv === 1 ? 'nivel' : 'niveles'} en ese elemento.</> })
  }
  const unknownStats = new Set(ranking.unknown.map(o => o.stat))
  if (unknownStats.has('criticalRate') || unknownStats.has('criticalDamage')) out.push({ tone: 'info', text: <>Aún no has subido <b>{unknownStats.has('criticalRate') ? 'Prob. crítico' : 'Daño crítico'}</b> en ningún elemento, así que Nexo no sabe cuánto da. Para tus atacantes puede valer mucho: sube un nivel en el elemento de tus atacantes y actualiza tu caja para que entre en el cálculo.</> })
  out.push({ tone: 'warn', text: <>No fundas trofeos en monedas del Bazar (bronce {HALL.coins.bronze}, plata {HALL.coins.silver}, oro {HALL.coins.gold}) mientras te queden mejoras que noten tus Invokers.</> })
  return out
}

/** Coach › Sala de trofeos: cuántos trofeos tienes, en qué gastarlos y por qué. */
export function TrophyHall() {
  const { account, records } = useAccount()
  const active = useActiveTeams(account?.box)
  const { plan } = usePlan(account?.box)
  const box = account!.box
  const important = useMemo(() => new Set([...active.heroes, ...plan.map(e => e.heroId)]), [active.heroes, plan])
  const used = useMemo(() => usedHeroes(box, important).used, [box, important])
  const ranking = useMemo(() => hallRanking(box, used), [box, used])
  const levels = useMemo(() => hallLevels(box), [box])
  const { wallet, save } = useTrophyWallet(box.profile.name, records)
  const { costs, mine, setCost } = useHallCosts()
  const have = useMemo<Wallet | null>(() => wallet ? { bronze: wallet.bronze, silver: wallet.silver, gold: wallet.gold } : null, [wallet?.bronze, wallet?.silver, wallet?.gold, !!wallet]) // eslint-disable-line react-hooks/exhaustive-deps
  const lanes = useMemo(() => spendPlan(ranking.options, have ?? { bronze: 0, silver: 0, gold: 0 }, costs), [ranking, have, costs])
  // Numeración de la sala: las primeras compras de cada tipo, en el orden del coach.
  const orderOf = useMemo(() => {
    const m = new Map<string, number>()
    let n = 0
    for (const tr of BUY_ORDER) {
      const steps = lanes[tr].steps.length ? lanes[tr].steps.map(s => s.option) : ranking.options.filter(o => o.trophy === tr && o.score > 0).slice(0, 2)
      for (const o of steps) { const k = optKey(o); if (!m.has(k) && n < 6) m.set(k, ++n) }
    }
    return m
  }, [lanes, ranking])
  const [selected, setSelected] = useState<string | null>(null)
  const sel = selected ?? [...orderOf.keys()][0] ?? null
  const boardRef = useRef<HTMLDivElement>(null)
  const pick = (k: string) => { setSelected(k); boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  // Captura y edición.
  const fileRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState<{ busy: string | null; error: string | null; strip?: string }>({ busy: null, error: null })
  const [editing, setEditing] = useState<{ draft: Draft; fromScan: boolean } | null>(null)
  const onFile = async (file: File | undefined) => {
    if (!file) return
    setScan({ busy: 'Abriendo la captura…', error: null }); setEditing(null)
    try {
      const { scanTrophies } = await import('./trophyScan')
      const r: Scan = await scanTrophies(file, step => setScan(s => ({ ...s, busy: step })))
      setScan({ busy: null, error: null, strip: r.strip })
      setEditing({ fromScan: true, draft: { coins: r.coins ? String(r.coins.value) : '', approx: r.coins?.approx, bronze: String(r.bronze.value), silver: String(r.silver.value), gold: String(r.gold.value) } })
    } catch (e) { setScan({ busy: null, error: e instanceof Error ? e.message : 'No se pudo leer la captura.' }) }
  }
  const saveDraft = () => {
    if (!editing) return
    const d = editing.draft, num = (x: string) => Number(x) || 0
    save({ bronze: num(d.bronze), silver: num(d.silver), gold: num(d.gold), coins: d.coins === '' ? null : num(d.coins), coinsApprox: !!d.approx, source: editing.fromScan ? 'captura' : 'manual' })
    setEditing(null); setScan({ busy: null, error: null })
  }

  const levelsIso = box.source === 'official-link' ? box.snapshotAt : fileTime(account!.record, 'PlayerArenaModel.dat')
  const levelsAt = `Niveles según ${box.source === 'official-link' ? 'tu enlace' : 'tu carpeta del juego'} (${dateText(levelsIso)})`
  // La sala va 12 h o más por detrás de los trofeos: puede que ya hayas comprado lo que se propone.
  const stale = wallet?.at && levelsIso && Date.parse(wallet.at) - Date.parse(levelsIso) > 12 * 3600e3 ? `${box.source === 'official-link' ? 'enlace' : 'carpeta'} de ${dateText(levelsIso)}` : null
  const tips = useMemo(() => tipsFor(have, lanes, ranking, used, levels, stale), [have, lanes, ranking, used, levels, stale])
  if (!box.arenaHall.length && !used.length) return <p className="muted">Esta caja no trae la Sala de trofeos.</p>
  const today = BUY_ORDER.map(tr => ({ tr, o: lanes[tr].steps[0]?.option ?? ranking.options.find(o => o.trophy === tr && o.score > 0) ?? null }))
    .filter((x): x is { tr: Trophy; o: HallOption } => !!x.o)
    // Con trofeos conocidos, primero lo que puedes pagar ya.
    .sort((a, b) => have ? Number(!have[a.tr]) - Number(!have[b.tr]) : 0)

  return <section className="advisor hall">
    <p className="lead">Cada mejora de la Sala de trofeos sube una estadística a <b>todos</b> los Invokers (y Titanes) de un elemento, en todos los modos. Nexo lee tus trofeos, mira tu sala y te dice qué comprar, en qué orden y por qué.</p>

    <Hud wallet={wallet} busy={!!scan.busy} onScan={() => fileRef.current?.click()} onEdit={() => setEditing({ fromScan: false, draft: draftOf(wallet) })} />
    <input ref={fileRef} type="file" accept="image/*" hidden data-testid="trophy-shot" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
    {scan.busy && <p className="scan-busy" role="status"><Loader2 size={15} className="spin" /> {scan.busy}</p>}
    {scan.error && <p className="scan-error" role="alert"><TriangleAlert size={15} /> {scan.error}</p>}
    {editing && <WalletEditor draft={editing.draft} setDraft={d => setEditing({ ...editing, draft: d })} strip={editing.fromScan ? scan.strip : undefined} fromScan={editing.fromScan} onSave={saveDraft} onCancel={() => setEditing(null)} />}
    {!wallet && !editing && <p className="fine hall-sources"><Camera size={13} /> <b>Móvil</b>: haz una captura de la Sala de trofeos y pulsa «Leer captura» (se lee en tu móvil, no se sube a ningún sitio). <FolderOpen size={13} /> <b>PC</b>: importa la carpeta del juego y Nexo toma tus trofeos exactos.</p>}

    <section className="panel hall-today">
      <div className="panel-title"><h2><Sparkles size={18} /> Lo que haría hoy</h2><small>{wallet ? `con tus trofeos (según ${SOURCE_ES[wallet.source]})` : 'dime tus trofeos para afinarlo'}</small></div>
      {today.length ? <ol className="today-list">{today.map(({ tr, o }) => {
        const n = o.beneficiaries.filter(b => b.points > 0)
        return <li key={tr} className={`t-${tr} ${have && !have[tr] ? 'later' : ''}`}>
          <Cup tier={tr} size={28} />
          <button className="lane-what" onClick={() => pick(optKey(o))} aria-label={`Ver ${t(ELEMENT_LABEL, o.element)} · ${hallName(o.stat, o.mode)} en la sala`}><ElementIcon element={o.element} className="hall-el" /><StatIcon stat={o.stat} className="hall-stat" /></button>
          <span className="row-main"><b>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)} al nivel {o.next}</b>
            <small>Con {TROPHY_PL[tr]} · {stepText(o)} para {n.length === 1 ? n[0].hero.name : `${n.length} de tus Invokers (${n.slice(0, 3).map(b => b.hero.name).join(', ')}${n.length > 3 ? '…' : ''})`}{have && !have[tr] ? ` · cuando tengas ${TROPHY_PL[tr]}` : ''}</small></span>
        </li>
      })}</ol> : <p className="fine">Ninguna mejora de la sala la notan los Invokers que usas.</p>}
    </section>

    <div ref={boardRef} className="hall-board-wrap"><Board box={box} used={used} ranking={ranking} orderOf={orderOf} selected={sel} setSelected={setSelected} costs={costs} levelsAt={levelsAt} /></div>

    <h2 className="coach-h">Tu compra, paso a paso</h2>
    <p className="fine">Cada tipo de trofeo paga sus niveles y Nexo no los mezcla: la plata y el oro valen más en sus propios niveles que convertidos.</p>
    <div className="lanes">{BUY_ORDER.filter(tr => lanes[tr].steps.length || tr !== 'gold' || (have?.gold ?? 0) > 0).map(tr => <Lane key={tr} lane={lanes[tr]} wallet={have} mine={mine} setCost={setCost} onPick={pick} />)}</div>

    <section className="panel hall-tips">
      <div className="panel-title"><h2><Lightbulb size={18} /> Consejos del coach</h2></div>
      <ul className="tips">{tips.map((x, i) => <li key={i} className={`tip ${x.tone}`}>{x.tone === 'do' ? <Check size={15} /> : x.tone === 'warn' ? <TriangleAlert size={15} /> : <Info size={15} />}<span>{x.text}</span></li>)}</ul>
    </section>

    {ranking.unknown.length > 0 && <details className="panel hall-unknown">
      <summary><HelpCircle size={16} /> Sin dato todavía: {[...new Set(ranking.unknown.map(o => o.stat))].map(s => hallName(s, HALL_STATS.find(x => x.stat === s)!.mode)).join(', ')}</summary>
      <p className="fine">Tu caja solo dice cuánto da cada nivel de las mejoras que ya has subido en algún elemento (y Nexo no inventa cifras). Estas aún no las has tocado, así que no entran en el orden. En cuanto subas una y actualices tu caja, Nexo la tendrá en cuenta.</p>
    </details>}

    <details className="panel howto hall-how">
      <summary><BookOpen size={18} /> Cómo funciona la sala y cómo decide Nexo</summary>
      <ul className="dashes">
        <li><b>La sala</b> (guía oficial): 12 mejoras por elemento, del nivel 1 al 15. Bronce paga los niveles 1–5, plata los 6–10 y oro los 11–15; cada nivel cuesta más que el anterior (el 1 de ATQ % cuesta 20 bronces). Si te faltan trofeos de un tipo, el juego usa los de más valor: {HALL.convert}.</li>
        <li><b>Tus trofeos</b>: la caja compartida no los publica. Nexo los toma de la carpeta del juego (exactos), de una captura de la sala (leída en tu navegador; tú confirmas) o de lo que escribas, y usa el dato más reciente.</li>
        <li><b>Quién cuenta</b>: los Invokers que usas, como en el resto del coach (equipos activos y plan o, si no hay, tus equipos registrados con nivel 30 o más). Más equipos, más peso; los de equipos activos y plan, el triple.</li>
        <li><b>Cuánto les da</b>: lo que sube un nivel (observado en tu caja: las de % dan +2 % de su VIDA, ATQ o DEF base; velocidades y maná, +4) valorado con los pesos de su perfil en el optimizador.</li>
        <li><b>Orden de compra</b>: con los costes conocidos, lo que más aporta por trofeo; si falta alguno, lo que más aporta y, a igualdad, el nivel más bajo. Nexo supone que un mismo nivel cuesta lo mismo en todas las mejoras; si el juego te pide otra cosa, corrige el coste.</li>
        <li>Es un criterio de Nexo; los Titanes también reciben estas mejoras, pero no se cuentan.</li>
      </ul>
      <p className="fine"><Info size={13} /> Fuente: <a href={HALL.guide} target="_blank" rel="noreferrer">guía oficial de la Arena <ExternalLink size={11} /></a> (Sala de trofeos), tu caja y tus trofeos.</p>
    </details>
  </section>
}

/** Primera recomendación por tipo de trofeo (para «Hoy»). */
export function hallTopPicks(box: Parameters<typeof hallRanking>[0], used: Parameters<typeof hallRanking>[1]) {
  const { options } = hallRanking(box, used)
  return { bronze: options.find(o => o.trophy === 'bronze') ?? null, silver: options.find(o => o.trophy === 'silver') ?? null, gold: options.find(o => o.trophy === 'gold') ?? null, label: (o: HallOption) => `${t(ELEMENT_LABEL, o.element)} · ${hallName(o.stat, o.mode)} (nivel ${o.next})` }
}
