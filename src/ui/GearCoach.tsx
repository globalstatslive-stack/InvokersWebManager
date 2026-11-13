import { useMemo, useState } from 'react'
import { ArrowUpCircle, BookOpen, Check, CheckCircle2, ChevronDown, Coins, ExternalLink, FlaskConical, GraduationCap, Hammer, Info, Loader2, OctagonX, PackageCheck, Recycle, Repeat, ShieldCheck, X, XCircle } from 'lucide-react'
import type { Gear } from '../box/model'
import { GEAR_RULES, GRADE_TABLE, RARITY_F, ROLE_LABEL, VERDICT_LABEL, VERDICT_ORDER, flatRatio, type GearAdvice, type Step, type Verdict } from '../box/gearCoach'
import { bonusName, fmtBonus, fmtInt, SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { useAccount } from './account'
import { Chips, GradePill } from './common'
import { GearIcon } from './Art'
import { useGearCoach, type GearCoach } from './coach'
import { EquipBatch } from './EquipBatch'

const ICON: Record<Verdict, typeof CheckCircle2> = { upgrade: ArrowUpCircle, replace: Repeat, test: FlaskConical, equip: PackageCheck, keep: ShieldCheck, sell: Recycle, done: CheckCircle2 }
const HELP: Record<Verdict, string> = {
  upgrade: 'Equipadas por debajo de +20: primero las de tus equipos activos y tu plan.',
  equip: 'Libres que ya mejoran a un Invoker que usas (una por ranura). Puedes equiparlas todas de una vez.',
  test: 'Libres con futuro para tus equipos: súbelas hasta el siguiente hito y revisa.',
  replace: 'Equipadas de poco rango con alternativas libres mejores: no inviertas en ellas.',
  keep: 'Reservadas en tu plan o escasas (tolerancias).',
  sell: 'Sin futuro para tu cuenta: oro o Memorium para subir las buenas.',
  done: 'Al +20 y en uso: nada que hacer.',
}
const TAG_LABEL: Record<Step['tag'], string> = { oficial: 'Oficial', 'tu caja': 'Tu caja', cálculo: 'Cálculo', criterio: 'Criterio de Nexo' }
const gearName = (g: Gear) => `${t(SLOT_LABEL, g.slot)} ${g.set ? t(SET_LABEL, g.set) : g.faction ?? ''}`.trim()

export function VerdictBadge({ v }: { v: Verdict }) {
  const I = ICON[v]
  return <span className={`verdict-badge v-${v}`}><I size={14} aria-hidden /> {VERDICT_LABEL[v]}</span>
}

/** Razonamiento completo, por bloques, con la fuente de cada paso. */
export function CoachReasoning({ a }: { a: GearAdvice }) {
  return <div className="coach-sections">{a.sections.map(s => <section key={s.title}>
    <h4>{s.title}</h4>
    <ul>{s.steps.map((st, i) => <li key={i} className={`coach-step ${st.tone}`}><span className={`src-tag src-${st.tag.replace(' ', '-').replace('á', 'a')}`}>{TAG_LABEL[st.tag]}</span><span>{st.text}</span></li>)}</ul>
  </section>)}</div>
}

const FIT_LABEL = { yes: 'Le sirve', weak: 'Le sirve a medias', no: 'No le sirve' } as const
const p100 = (x: number) => `${Math.round(100 * x)} %`

/** La pieza dibujada: principal y las 4 casillas de subestadística con su semáforo y las mejoras recibidas. */
function Anatomy({ a }: { a: GearAdvice }) {
  const g = a.gear
  const pending = a.path.filter(n => n.kind === 'unlock' && n.state !== 'done')
  return <section className="anatomy">
    <h4>La pieza, para {a.forWho}</h4>
    <div className={`anat-main fit-${a.mainFit === 'no' ? 'no' : a.mainFit === 'yes' ? 'yes' : 'fixed'}`}>
      <span className="anat-kicker">Principal · sube con cada nivel</span>
      <span className="anat-line"><b>{bonusName(g.main.stat, g.main.mode)} {fmtBonus(g.main.stat, g.main.mode, g.main.value)}</b>{g.mainAtMax && g.level < GEAR_RULES.maxLevel && <small>→ {fmtBonus(g.mainAtMax.stat, g.mainAtMax.mode, g.mainAtMax.value)} al +20</small>}</span>
      <span className="fit-label">{a.mainFit === 'fixed' ? 'Fija en esta ranura' : a.mainFit === 'yes' ? 'Le sirve' : 'No le sirve'}</span>
    </div>
    <span className="anat-kicker">Subestadísticas · cambian solo en +5, +10, +15 y +20</span>
    <ul className="anat-subs">
      {a.subs.map((x, i) => <li key={i} className={`fit-${x.fit}`}>
        <i className="dot" aria-hidden />
        <span className="anat-name">{bonusName(x.bonus.stat, x.bonus.mode)} <b>{fmtBonus(x.bonus.stat, x.bonus.mode, x.bonus.value)}</b></span>
        <span className="pips" title={`${x.bonus.rolls} mejoras recibidas`} aria-label={`${x.bonus.rolls} mejoras`}>{Array.from({ length: x.bonus.rolls }, (_, j) => <i key={j} />)}</span>
        <GradePill grade={x.bonus.grade} />
        <span className="fit-label">{FIT_LABEL[x.fit]}</span>
      </li>)}
      {pending.map(n => <li key={n.level} className="fit-empty"><i className="dot" aria-hidden /><span className="anat-name">Casilla vacía: aparece al +{n.level}</span><span className="fit-label">{p100(n.p ?? 0)} de que sirva</span></li>)}
    </ul>
    <p className="anat-legend"><span className="pips"><i /></span> mejora recibida · nota D→S: lo bien que salieron sus tiradas</p>
  </section>
}

function ProsCons({ a }: { a: GearAdvice }) {
  return <section className="proscons">
    <div className="pros"><h4><Check size={15} /> A favor</h4>{a.pros.length ? <ul>{a.pros.map(x => <li key={x}>{x}</li>)}</ul> : <p className="muted">Nada destacable.</p>}</div>
    <div className="cons"><h4><X size={15} /> En contra</h4>{a.cons.length ? <ul>{a.cons.map(x => <li key={x}>{x}</li>)}</ul> : <p className="muted">Nada destacable.</p>}</div>
  </section>
}

/** Camino de subida: +0 → +5 → +10 → +15 → +20, con lo que ya pasó, dónde estás y la probabilidad de cada hito. */
function UpgradePath({ a }: { a: GearAdvice }) {
  const lvl = a.gear.level
  return <section className="upath">
    <h4>Camino de subida</h4>
    <ol className="path-track">
      <li className="node done start"><span className="node-dot">+0</span><span className="node-kind">Sale así</span></li>
      {a.path.map(n => <li key={n.level} className={`node ${n.state} ${n.kind}`}>
        <span className="node-dot">{n.state === 'done' ? <Check size={14} /> : `+${n.level}`}</span>
        <span className="node-kind">{n.kind === 'unlock' ? 'Nueva subestadística' : 'Mejora una'}</span>
        {n.p !== null ? <span className={`node-p ${n.p >= 0.5 ? 'good' : 'bad'}`}>{p100(n.p)} útil</span> : <span className="node-p">hecho</span>}
      </li>)}
    </ol>
    <p className="path-here">Estás en <b>+{lvl}</b>{lvl >= GEAR_RULES.maxLevel ? ': al máximo.' : `. Entre hitos solo crece la principal; las sorpresas llegan en +${a.path.find(n => n.state === 'next')?.level ?? 20}.`}</p>
  </section>
}

/** Qué hacer en el próximo hito: si sale bien, sigue; si sale mal, para. */
function NextMilestone({ a }: { a: GearAdvice }) {
  const n = a.next!
  const list = (xs: string[]) => xs.length > 5 ? `${xs.slice(0, 5).join(', ')}…` : xs.join(', ')
  return <section className="next-step">
    <h4><Hammer size={15} /> Súbela hasta +{n.level} y mira qué sale</h4>
    <p>{n.kind === 'unlock' ? 'Aparecerá una subestadística nueva, al azar.' : 'Mejorará una de sus 4 subestadísticas, al azar.'} Probabilidad de que sea útil:</p>
    <div className="pbar" role="img" aria-label={`${p100(n.p)} de que sea útil`}><i style={{ width: `${Math.round(100 * n.p)}%` }} /><span>{p100(n.p)}</span></div>
    <div className="branches">
      <div className="branch good"><b><Check size={15} /> Si sale {list(n.good) || 'algo útil'}</b><p>{n.ifGood}</p></div>
      <div className="branch bad"><b><OctagonX size={15} /> Si sale {list(n.bad) || 'algo que no sirve'}</b><p>{n.ifBad}</p></div>
    </div>
    {a.stopRule && <p className="stop-rule"><b>Regla para parar:</b> {a.stopRule}</p>}
  </section>
}

function SellHow() {
  return <section className="sell-how">
    <h4>Venderla o triturarla</h4>
    <div className="sell-opts"><span><Coins size={16} /> <b>Vender</b> da oro</span><span><Recycle size={16} /> <b>Triturar</b> da Memorium</span></div>
    <p className="fine">Subir piezas cuesta las dos cosas. Tritura si te falta Memorium y vende si te falta oro. En el juego: sala de equipo → «Sell / Crush», o desde los resultados del combate.</p>
  </section>
}

/** Lección completa de una pieza: lo visual primero y el razonamiento con fuentes plegado. */
export function CoachLesson({ a }: { a: GearAdvice }) {
  return <div className="lesson">
    <div className="lesson-grid"><Anatomy a={a} /><ProsCons a={a} /></div>
    <UpgradePath a={a} />
    {a.next && <NextMilestone a={a} />}
    {a.verdict === 'sell' && <SellHow />}
    <details className="lesson-more"><summary>Razonamiento completo, paso a paso y con fuentes</summary>
      <CoachReasoning a={a} />
      <p className="fine">Fuentes: <span className="src-tag src-oficial">Oficial</span> guías de <a href={GEAR_RULES.guides.relics} target="_blank" rel="noreferrer">reliquias</a> y <a href={GEAR_RULES.guides.accessories} target="_blank" rel="noreferrer">accesorios</a> de invokers.com · <span className="src-tag src-tu-caja">Tu caja</span> valores de tu inventario · <span className="src-tag src-calculo">Cálculo</span> deducción de Nexo · <span className="src-tag src-criterio">Criterio de Nexo</span> umbrales discutibles.</p>
    </details>
  </div>
}

/** Mini camino para la lista: un punto por hito. */
function MiniPath({ a }: { a: GearAdvice }) {
  return <span className="mini-path" aria-label={`Nivel +${a.gear.level}`}>{a.path.map(n => <i key={n.level} className={`${n.state} ${n.p !== null && n.p < 0.5 ? 'risky' : ''}`} title={`+${n.level}: ${n.state === 'done' ? 'hecho' : n.kind === 'unlock' ? 'nueva subestadística' : 'mejora una'}`} />)}</span>
}

const HOWTO_KEY = 'nexo.coach.howto'
/** Cómo leer una pieza, en dos minutos. */
export function HowToRead() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(HOWTO_KEY) !== 'closed' } catch { return true } })
  return <details className="panel howto" open={open} onToggle={e => { const o = (e.target as HTMLDetailsElement).open; setOpen(o); try { localStorage.setItem(HOWTO_KEY, o ? 'open' : 'closed') } catch { /* sin almacenamiento */ } }}>
    <summary><GraduationCap size={18} /> Cómo leer una pieza (2 minutos)</summary>
    <div className="howto-grid">
      <div className="howto-demo" aria-hidden>
        <div className="anat-main fit-yes"><span className="anat-kicker">Principal</span><span className="anat-line"><b>La cifra grande</b></span><span className="fit-label">Sube con cada nivel</span></div>
        <ul className="anat-subs">
          <li className="fit-yes"><i className="dot" /><span className="anat-name">Subestadística útil</span><span className="pips"><i /><i /></span><span className="fit-label">Le sirve</span></li>
          <li className="fit-weak"><i className="dot" /><span className="anat-name">Útil a medias</span><span className="pips" /><span className="fit-label">A medias</span></li>
          <li className="fit-no"><i className="dot" /><span className="anat-name">No le sirve</span><span className="pips"><i /></span><span className="fit-label">Mejora perdida</span></li>
          <li className="fit-empty"><i className="dot" /><span className="anat-name">Casilla vacía</span><span className="pips" /><span className="fit-label">Sale al azar</span></li>
        </ul>
      </div>
      <ol className="howto-steps">
        <li><b>Principal.</b> La cifra grande. Sube con cada nivel, pase lo que pase. En armas, escudos y cascos siempre es la misma; en hombreras, guantes, peto, cinturón y botas varía y es lo que más importa.</li>
        <li><b>Subestadísticas.</b> Hasta 4 líneas pequeñas que solo cambian en los hitos +5, +10, +15 y +20: si hay una casilla vacía, aparece una nueva al azar; si están las 4, mejora una de ellas al azar.</li>
        <li><b>Por eso subir es una lotería.</b> Cuantas más subestadísticas le sirvan a tu Invoker, más fácil que cada mejora caiga bien: con 2 de 4 útiles, aciertas la mitad de las veces.</li>
        <li><b>Rango (★) y rareza no cambian nunca.</b> El rango decide cuánto vale cada tirada; la rareza, cuántas mejoras reales tendrá (legendaria 4, épica 3, rara 2, poco común 1, común 0).</li>
        <li><b>Nota (D, C, B, A, S).</b> Lo bien que salieron sus tiradas: cada una da entre el 70 y el 100 % del máximo.</li>
      </ol>
    </div>
    <p className="golden"><b>Regla de oro:</b> sube hito a hito y mira qué sale. Si la mejora cae en algo que a tu Invoker no le sirve, para y piensa: no sigas gastando oro y Memorium en esa pieza.</p>
  </details>
}

/** Ficha de pieza: veredicto y lección. */
export function GearCoachPanel({ g }: { g: Gear }) {
  const coach = useGearCoach()
  const a = coach?.byKey.get(`${g.kind}${g.id}`)
  return <section className="panel coach-panel">
    <div className="panel-title"><h2>Coach</h2><small>Por qué subirla, guardarla o venderla</small></div>
    {!a ? <p className="muted"><Loader2 size={14} className="spin" /> Analizando tus piezas…</p> : <>
      <div className={`coach-head v-${a.verdict}`}><VerdictBadge v={a.verdict} /><div><b>{a.title}</b><p>{a.why}</p></div></div>
      <CoachLesson a={a} />
      <HowToRead />
    </>}
  </section>
}

/** Coach › Piezas: qué hacer con cada pieza de la caja. */
export function PiecesCoach({ initial }: { initial?: Verdict }) {
  const { account, go } = useAccount()
  const coach = useGearCoach()
  const [verdict, setVerdict] = useState<Verdict>(initial ?? 'upgrade')
  const [kind, setKind] = useState<'all' | 'relic' | 'accessory'>('all')
  const [limit, setLimit] = useState(30)
  const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(() => coach?.advice.filter(a => a.verdict === verdict && (kind === 'all' || a.gear.kind === kind)) ?? [], [coach, verdict, kind])
  if (!account) return null
  if (!coach) return <p className="muted center"><Loader2 size={16} className="spin" /> Analizando {fmtInt(account.box.relics.length + account.box.accessories.length)} piezas…</p>
  const { ctx } = coach
  return <section className="advisor pieces-coach">
    <p className="lead">Nexo revisa tus {fmtInt(coach.advice.length)} piezas y te dice qué hacer con cada una y por qué: reglas oficiales de las piezas, valores de tu caja y lo que darían a tus Invokers. Las subidas se proponen para {ctx.focusLabel}{ctx.focus.length <= 12 ? ` (${ctx.focus.map(h => h.name).join(', ')})` : ''}.</p>
    <HowToRead />
    <div className="verdict-grid" role="group" aria-label="Veredicto">{VERDICT_ORDER.map(v => { const I = ICON[v]; return <button key={v} className={`verdict-card v-${v} ${verdict === v ? 'on' : ''}`} aria-pressed={verdict === v} onClick={() => { setVerdict(v); setLimit(30); setOpen(null) }}>
      <span className="vc-top"><I size={17} aria-hidden /><b>{fmtInt(coach.counts[v])}</b></span><span className="vc-label">{VERDICT_LABEL[v]}</span><small>{HELP[v]}</small>
    </button> })}</div>
    <div className="toolbar-row"><Chips label="Tipo" value={kind} onChange={v => { setKind(v); setLimit(30) }} options={[{ id: 'all', label: 'Todas' }, { id: 'relic', label: 'Reliquias' }, { id: 'accessory', label: 'Accesorios' }]} /><span className="muted">{list.length} piezas</span></div>
    {verdict === 'equip' && <EquipBatch />}
    {verdict === 'sell' && <p className="note"><Recycle size={15} /> En el juego: sala de equipo → «Sell / Crush» → marca las piezas → «Sell» (oro) o «Crush» (Memorium). Puedes filtrar por rareza, rango y ranura para marcarlas por lotes. Nexo no vende nada: revisa antes las que no te convenzan.</p>}
    {verdict === 'test' && <p className="note"><FlaskConical size={15} /> Sube cada una solo hasta el hito indicado y mira dónde cae la mejora. Si cae en algo útil, sigue; si no, véndela: así no gastas oro ni Memorium en piezas que no van a servir.</p>}
    {list.length === 0 ? <div className="empty small"><h3>Nada en esta categoría</h3></div> :
      <ul className="coach-list">{list.slice(0, limit).map(a => { const k = `${a.gear.kind}${a.gear.id}`, isOpen = open === k
        return <li key={k} className={`coach-row v-${a.verdict}`}>
          <div className="coach-row-main">
            <button className="coach-gear" onClick={() => go(`/pieza/${a.gear.kind}-${a.gear.id}`)} aria-label={`Abrir ${gearName(a.gear)}`}><GearIcon g={a.gear} size="sm" /></button>
            <div className="coach-text">
              <b>{a.title} <MiniPath a={a} /></b>
              <small>{gearName(a.gear)} · {RARITY_F[a.gear.rarity] ?? a.gear.rarity} {a.gear.rank}★ +{a.gear.level} · {bonusName(a.gear.main.stat, a.gear.main.mode)} {fmtBonus(a.gear.main.stat, a.gear.main.mode, a.gear.main.value)}{a.owner ? ` · ${a.owner.name}` : ' · libre'}</small>
              <p>{a.why}</p>
            </div>
            <button className="btn small" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>{isOpen ? 'Cerrar' : 'Explícamelo'} <ChevronDown size={14} className={isOpen ? 'flip' : ''} /></button>
          </div>
          {isOpen && <CoachLesson a={a} />}
        </li> })}</ul>}
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 60)}>Mostrar más ({list.length - limit})</button></div>}
    <GearSchool coach={coach} />
  </section>
}

/** Cómo funcionan las piezas: reglas oficiales y valores de tu caja, para entender cada veredicto. */
export function GearSchool({ coach }: { coach: GearCoach }) {
  const { account } = useAccount()
  const { ctx } = coach
  const box = account!.box
  const statsShown = ['attack:percent', 'attack:flat', 'health:percent', 'health:flat', 'defense:percent', 'defense:flat', 'criticalRate:percent', 'criticalDamage:percent', 'accuracy:flat', 'resistance:flat', 'skillSpeed:flat', 'comboSpeed:flat', 'skillRecovery:flat', 'manaGeneration:flat', 'instinct:flat']
  const ranks = [3, 4, 5]
  const rows = statsShown.filter(k => ranks.some(r => ctx.units.has(`${k}:${r}`)))
  const rarities = Object.entries(GEAR_RULES.initialSubs)
  return <details className="panel gear-school">
    <summary><BookOpen size={17} /> Cómo funcionan las piezas (y cómo decide el coach)</summary>
    <div className="school-grid">
      <section>
        <h3>Rareza: cuántas mejoras reales recibe</h3>
        <p className="fine">Toda pieza tiene 4 hitos: +5, +10, +15 y +20. En cada uno, si tiene menos de 4 subestadísticas, desbloquea una nueva al azar; si ya tiene 4, mejora una de ellas al azar. La rareza decide con cuántas empieza.</p>
        <table className="data compact"><thead><tr><th>Rareza</th><th>De serie</th><th>Desbloqueos</th><th>Mejoras</th></tr></thead>
          <tbody>{rarities.map(([r, n]) => <tr key={r}><td>{RARITY_F[r].charAt(0).toUpperCase() + RARITY_F[r].slice(1)}</td><td>{n}</td><td>{4 - n}</td><td><b>{n}</b></td></tr>)}</tbody></table>
      </section>
      <section>
        <h3>Rango: cuánto vale cada tirada</h3>
        <p className="fine">El rango (★) fija el valor de la principal y de cada tirada, y no se puede subir. Cada tirada vale el 70, 80, 90 o 100 % del máximo de su rango, con el mismo peso. Valor de una tirada máxima en tu caja:</p>
        <table className="data compact"><thead><tr><th>Subestadística</th>{ranks.map(r => <th key={r}>{r}★</th>)}</tr></thead>
          <tbody>{rows.map(k => { const [s, m] = k.split(':'); return <tr key={k}><td>{bonusName(s, m)}{m === 'flat' && ['attack', 'health', 'defense'].includes(s) ? ' (plana)' : ''}</td>{ranks.map(r => { const v = ctx.units.get(`${k}:${r}`); return <td key={r}>{v ? fmtBonus(s, m, v) : '—'}</td> })}</tr> })}</tbody></table>
      </section>
      <section>
        <h3>Notas: suma de tiradas</h3>
        <p className="fine">La nota de una subestadística sale de la suma de sus tiradas (en % de una tirada máxima) según cuántas mejoras lleva. Por ejemplo, 280 % tras tres mejoras es una C.</p>
        <table className="data compact"><thead><tr><th>Mejoras</th><th>D</th><th>C</th><th>B</th><th>A</th><th>S</th></tr></thead>
          <tbody>{GRADE_TABLE.map((row, i) => <tr key={i}><td>{i === 0 ? 'Inicial' : `${i} (+${5 * i})`}</td>{(['D', 'C', 'B', 'A', 'S'] as const).map(g => { const c = row.find(([, x]) => x === g); return <td key={g}>{c ? `≥ ${c[0]} %` : '—'}</td> })}</tr>)}</tbody></table>
      </section>
      <section>
        <h3>¿Plana o en %?</h3>
        <p className="fine">ATQ, DEF y VIDA en % se calculan sobre la estadística base del Invoker. Una subestadística plana rinde más cuanto más baja es esa base. Con las bases medias de tus Invokers (4★):</p>
        <ul className="dashes">{(['dps', 'tank', 'support'] as const).flatMap(role => ['attack', 'defense', 'health'].map(stat => {
          const base = ctx.roleBase[role][stat], r = flatRatio(ctx.units, stat, 4, base)
          return r === null ? null : <li key={`${role}${stat}`}>{bonusName(stat, 'flat')} plana en {ROLE_LABEL[role]} (base media {fmtInt(base)}): rinde el <b className={r >= 1 ? 'up' : r < 0.75 ? 'down' : ''}>{Math.round(100 * r)} %</b> de {bonusName(stat, 'percent')}.</li>
        })).filter(Boolean).slice(0, 6)}</ul>
        <p className="fine">Por eso Nexo no penaliza las subestadísticas planas sin más: las compara con la base de quien las llevaría.</p>
      </section>
      <section>
        <h3>Vender o triturar</h3>
        <p className="fine">Vender da oro; triturar convierte la pieza en Memorium. Subir piezas cuesta las dos cosas, así que deshacerte de las que no tienen futuro es lo que paga las subidas de las buenas. Se puede hacer por lotes («Sell / Crush») o desde la pantalla de resultados del combate.</p>
        <h3>Accesorios</h3>
        <p className="fine">Solo los lleva un Invoker de la facción indicada y no forman conjuntos. Las ranuras se desbloquean con el despertar: {Object.entries(box.accessorySlotAwake).sort((a, b) => a[1] - b[1]).map(([s, n]) => `${t(SLOT_LABEL, s).toLowerCase()} ${n ? `con ${n}★` : 'desde el principio'}`).join(', ')}. Los suelta Sorgott (2 por victoria) y caben {fmtInt(GEAR_RULES.accessoryStorage)} en la colección.</p>
        <h3>Dónde conseguir mejores</h3>
        <p className="fine">La campaña solo da piezas comunes y poco comunes (hasta 5★ en Insane). Los jefes de reliquias dan 3★ o más, hasta legendarias, y los conjuntos avanzados, como los de tolerancia, que no salen en ningún otro sitio.</p>
      </section>
      <section className="school-wide">
        <h3>Cómo decide el coach</h3>
        <ol className="mini">
          <li><b>Equipada</b>: si está al +20, <i>completa</i>. Si es de 3★ o menos y tienes libres de más rango para esa ranura, <i>sustitúyela</i> antes de invertir. Si no, <i>súbela</i>, primero en tus equipos activos y tu plan.</li>
          <li><b>Libre y reservada</b> en tu plan: <i>guárdala</i>.</li>
          <li><b>Libre que ya mejora a alguien</b> un 1 % o más (daño por golpe o perfil de clase), con una pieza por Invoker y ranura: <i>equípala</i>.</li>
          <li><b>Libre de 3★ o menos</b>, o al +20 sin uso: <i>véndela o tritúrala</i>. Si es de un conjunto de tolerancia y tienes 2 o menos para su ranura: <i>guárdala</i>.</li>
          <li><b>Libre con futuro</b>: Nexo estima su valor medio al +20 (principal al máximo según el portal y tiradas medias en lo que le falta). Si así mejoraría un 1 % o más a {ctx.focusLabel}, <i>pruébala</i> hasta el siguiente hito, con un máximo de 2 por ranura. Si no, <i>véndela o tritúrala</i>.</li>
        </ol>
        <p className="fine"><Info size={13} /> «Al azar» es lo que dice la guía oficial; las probabilidades suponen que todas las opciones pesan igual. Las ganancias son cambios de una sola pieza con la fórmula de estadísticas verificada; para la build completa, usa el optimizador. <a href={GEAR_RULES.guides.relics} target="_blank" rel="noreferrer">Guía de reliquias <ExternalLink size={11} /></a> · <a href={GEAR_RULES.guides.accessories} target="_blank" rel="noreferrer">Guía de accesorios <ExternalLink size={11} /></a></p>
      </section>
    </div>
    <p className="fine"><XCircle size={13} /> Nexo no sabe cuánto oro y Memorium tienes ni cuánto cuesta cada nivel: la caja compartida no lo publica.</p>
  </details>
}
