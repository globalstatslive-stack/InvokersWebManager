import { useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, ExternalLink, HelpCircle, Info, Trophy as TrophyIcon } from 'lucide-react'
import { HALL, HALL_STATS, hallLevels, hallRanking, type HallOption, type Trophy } from '../box/trophyHall'
import { usedHeroes } from '../box/equipBatch'
import { ELEMENT_LABEL, fmtInt, PERCENT_OF_BASE, STAT_LABEL, t } from '../box/i18n'
import { useAccount } from './account'
import { useActiveTeams } from './activeTeams'
import { usePlan } from './plan'
import { ElementIcon, Portrait, StatIcon } from './Art'

const TROPHY_ES: Record<Trophy, string> = { bronze: 'bronce', silver: 'plata', gold: 'oro' }
const TROPHY_PL: Record<Trophy, string> = { bronze: 'bronces', silver: 'platas', gold: 'oros' }
const GROUP_ES = { attack: 'Ataque', defense: 'Defensa', utility: 'Función' } as const
const hallName = (stat: string, mode: string) => `${STAT_LABEL[stat] ?? stat}${mode === 'percent' && PERCENT_OF_BASE.has(stat) ? ' %' : ''}`
const stepText = (o: HallOption) => o.step === null ? '?' : o.mode === 'percent' ? `+${(100 * o.step).toFixed(0)} %` : `+${fmtInt(o.step)}`
const tierEnd = (level: number) => level <= 5 ? 5 : level <= 10 ? 10 : 15

/** Trofeos que tiene el jugador (la caja no los publica): se guardan en este navegador. */
function useTrophies(name: string) {
  const k = `nexo.trophies.${name}`
  const [v, setV] = useState<Record<Trophy, string>>(() => { try { return { bronze: '', silver: '', gold: '', ...JSON.parse(localStorage.getItem(k) ?? '{}') } } catch { return { bronze: '', silver: '', gold: '' } } })
  const set = (t: Trophy, x: string) => { const next = { ...v, [t]: x.replace(/\D/g, '').slice(0, 6) }; setV(next); try { localStorage.setItem(k, JSON.stringify(next)) } catch { /* sin almacenamiento */ } }
  return { v, set }
}

function OptionRow({ o, pos }: { o: HallOption; pos: number }) {
  const [open, setOpen] = useState(pos === 1)
  const who = o.beneficiaries.filter(b => b.points > 0)
  const total = o.beneficiaries.length
  return <li className={`hall-opt ${pos === 1 ? 'first' : ''}`}>
    <div className="hall-opt-main">
      <span className="hall-pos">{pos}</span>
      <span className="hall-what"><ElementIcon element={o.element} className="hall-el" /><StatIcon stat={o.stat} className="hall-stat" /></span>
      <span className="row-main">
        <b>{t(ELEMENT_LABEL, o.element)} · {hallName(o.stat, o.mode)}</b>
        <small>Nivel {o.level} → {o.next} ({stepText(o)} por nivel) · se paga con {TROPHY_ES[o.trophy]}{o.next < tierEnd(o.next) ? `; con ${TROPHY_ES[o.trophy]} llega hasta el ${tierEnd(o.next)}` : ''}</small>
      </span>
      <button className="icon-btn" aria-expanded={open} aria-label="Por qué" onClick={() => setOpen(!open)}><ChevronDown size={16} className={open ? 'flip' : ''} /></button>
    </div>
    <p className="hall-why">{who.length
      ? <>{total === 1 ? <>Lo nota <b>el único</b> Invoker de {t(ELEMENT_LABEL, o.element)} que usas</> : who.length === total ? <>Lo notan <b>los {total}</b> Invokers de {t(ELEMENT_LABEL, o.element)} que usas</> : <>Lo notan <b>{who.length} de los {total}</b> Invokers de {t(ELEMENT_LABEL, o.element)} que usas</>}: {who.slice(0, 4).map(b => b.hero.name).join(', ')}{who.length > 4 ? '…' : '.'}</>
      : <>Ninguno de tus Invokers de {t(ELEMENT_LABEL, o.element)} que usas lo aprovecha según su perfil.</>}</p>
    {open && <ul className="hall-heroes">{o.beneficiaries.map(b => <li key={b.hero.id} className={b.points > 0 ? '' : 'none'}>
      <Portrait c={b.hero} size="sm" />
      <span className="row-main"><b>{b.hero.name}</b><small>{b.hero.cls === 'Tank' ? 'tanque' : b.hero.cls === 'Support' ? 'apoyo' : 'daño'}{b.weight >= 3 ? ' · equipo activo o plan' : ''}</small></span>
      <span className="hall-delta">{b.points > 0 ? <>+{o.mode === 'percent' && PERCENT_OF_BASE.has(o.stat) ? fmtInt(Math.round(b.delta)) : fmtInt(b.delta)} {STAT_LABEL[o.stat] ?? o.stat}</> : 'no lo aprovecha'}</span>
    </li>)}</ul>}
  </li>
}

/** Coach › Sala de trofeos: en qué gastar los trofeos de arena, por orden y por qué. */
export function TrophyHall() {
  const { account } = useAccount()
  const active = useActiveTeams(account?.box)
  const { plan } = usePlan(account?.box)
  const box = account!.box
  const important = useMemo(() => new Set([...active.heroes, ...plan.map(e => e.heroId)]), [active.heroes, plan])
  const used = useMemo(() => usedHeroes(box, important).used, [box, important])
  const { options, unknown, maxed } = useMemo(() => hallRanking(box, used), [box, used])
  const levels = useMemo(() => hallLevels(box), [box])
  const { v, set } = useTrophies(box.profile.name)
  const have = { bronze: Number(v.bronze) || 0, silver: Number(v.silver) || 0, gold: Number(v.gold) || 0 }
  const typed = v.bronze !== '' || v.silver !== '' || v.gold !== ''
  const byTier = (tr: Trophy) => options.filter(o => o.trophy === tr)
  const tiers: Trophy[] = ['bronze', 'silver', 'gold']
  const top = options.slice(0, 3).map(o => `${o.element}:${o.stat}`)
  const byElement = HALL.elements.map(el => ({ el, heroes: used.filter(u => u.hero.element === el) }))
  if (!box.arenaHall.length && !used.length) return <p className="muted">Esta caja no trae la Sala de trofeos.</p>
  return <section className="advisor hall">
    <p className="lead">Cada mejora de la Sala de trofeos sube una estadística a <b>todos</b> los Invokers (y Titanes) de un elemento, en todos los modos. Nexo ordena dónde gastar tus trofeos por lo que aporta a los Invokers que usas de cada elemento.</p>

    <section className="panel hall-wallet">
      <div className="panel-title"><h2><TrophyIcon size={18} /> Tus trofeos</h2><small>La caja no los publica: escríbelos si quieres (se guardan en este navegador)</small></div>
      <div className="hall-inputs">{tiers.map(tr => <label key={tr} className={`hall-input t-${tr}`}><span>{TROPHY_PL[tr]}</span><input inputMode="numeric" value={v[tr]} onChange={e => set(tr, e.target.value)} placeholder="0" aria-label={`Trofeos de ${TROPHY_ES[tr]}`} /></label>)}</div>
      <ul className="dashes">
        <li>Bronce paga los niveles 1–5, plata los 6–10 y oro los 11–15. El nivel 1 cuesta 20 bronces y cada nivel cuesta más que el anterior; el juego no publica el resto de costes, así que ve por orden hasta que no te alcance.</li>
        <li>Si te faltan trofeos de un tipo, el juego usa los de más valor: {HALL.convert}. Por eso conviene no gastar plata en niveles de bronce: en los niveles 6–10 solo vale plata.</li>
        <li>No fundas trofeos en monedas del Bazar (bronce {HALL.coins.bronze}, plata {HALL.coins.silver}, oro {HALL.coins.gold}) mientras te queden mejoras útiles.</li>
      </ul>
    </section>

    <h2 className="coach-h">Dónde gastar, por orden</h2>
    {tiers.map(tr => {
      const list = byTier(tr)
      if (!list.length) return null
      const none = typed && !have[tr] && !(tr === 'bronze' && (have.silver || have.gold)) && !(tr === 'silver' && have.gold)
      return <section key={tr} className={`panel hall-tier t-${tr} ${none ? 'muted-tier' : ''}`}>
        <div className="panel-title"><h3><span className={`trophy-dot t-${tr}`} /> Con {TROPHY_PL[tr]} <small>(niveles {tr === 'bronze' ? '1–5' : tr === 'silver' ? '6–10' : '11–15'})</small></h3><small>{typed ? (have[tr] ? `Tienes ${fmtInt(have[tr])}` : 'No tienes: esta parte tendrá que esperar') : ''}</small></div>
        <ol className="hall-list">{list.slice(0, tr === 'bronze' ? 6 : 4).map((o, i) => <OptionRow key={`${o.element}${o.stat}`} o={o} pos={i + 1} />)}</ol>
        {list.length > (tr === 'bronze' ? 6 : 4) && <p className="fine">{list.length - (tr === 'bronze' ? 6 : 4) === 1 ? 'Y 1 mejora más que aporta menos' : `Y ${list.length - (tr === 'bronze' ? 6 : 4)} mejoras más que aportan menos`} a los Invokers que usas.</p>}
      </section>
    })}

    <section className="panel hall-grid-panel">
      <div className="panel-title"><h2>Tu sala ahora</h2><small>Nivel de cada mejora (de 15) · en dorado, las 3 que Nexo subiría primero</small></div>
      <div className="hall-grid">{byElement.map(({ el, heroes }) => <div key={el} className="hall-el-card">
        <div className="hall-el-head"><ElementIcon element={el} className="hall-el" /><b>{t(ELEMENT_LABEL, el)}</b><small>{heroes.length} que usas</small></div>
        {(['attack', 'defense', 'utility'] as const).map(g => <div key={g} className="hall-group"><span className="hall-group-name">{GROUP_ES[g]}</span>
          <div className="hall-cells">{HALL_STATS.filter(s => s.group === g).map(s => {
            const lv = levels.get(`${el}:${s.stat}`)?.level ?? 0
            return <span key={s.stat} className={`hall-cell ${lv ? 'on' : ''} ${top.includes(`${el}:${s.stat}`) ? 'pick' : ''}`} title={`${hallName(s.stat, s.mode)}: nivel ${lv}`}><StatIcon stat={s.stat} className="hall-stat" /><b>{lv}</b></span>
          })}</div></div>)}
      </div>)}</div>
      {maxed > 0 && <p className="fine"><Check size={13} /> {maxed} mejoras ya al nivel 15.</p>}
    </section>

    {unknown.length > 0 && <details className="panel hall-unknown">
      <summary><HelpCircle size={16} /> Sin dato todavía: {[...new Set(unknown.map(o => o.stat))].map(s => hallName(s, HALL_STATS.find(x => x.stat === s)!.mode)).join(', ')}</summary>
      <p className="fine">Tu caja solo dice cuánto da cada nivel de las mejoras que ya has subido en algún elemento (y Nexo no inventa cifras). Estas aún no las has tocado, así que no entran en el orden. Para un atacante, Prob. crítico y Daño crítico pueden valer mucho: en el juego, toca la mejora y verás cuánto da el siguiente nivel. En cuanto subas una y reimportes tu caja, Nexo la tendrá en cuenta.</p>
    </details>}

    <details className="panel howto hall-how">
      <summary><BookOpen size={18} /> Cómo decide Nexo</summary>
      <ul className="dashes">
        <li><b>Quién cuenta</b>: los Invokers que usas, como en el resto del coach (tus equipos activos y tu plan o, si no hay, los de tus equipos registrados con nivel 30 o más). Cuantos más equipos, más peso; los de tus equipos activos y tu plan, el triple.</li>
        <li><b>Cuánto les da</b>: lo que sube un nivel (observado en tu caja: las de % dan +2 % de su VIDA, ATQ o DEF base; velocidades y maná, +4) valorado con los pesos de su perfil en el optimizador: daño para atacantes; VIDA, DEF y RES para tanques; velocidad de habilidad, recuperación y maná para apoyos.</li>
        <li><b>Orden</b>: de más a menos aporte; a igualdad, el nivel más bajo, que es más barato. Separado por tipo de trofeo, porque cada uno solo paga sus niveles.</li>
        <li>Es un criterio de Nexo; los Titanes también reciben estas mejoras, pero no se cuentan.</li>
      </ul>
      <p className="fine"><Info size={13} /> Fuente: <a href={HALL.guide} target="_blank" rel="noreferrer">guía oficial de la Arena <ExternalLink size={11} /></a> (Sala de trofeos) y tu caja.</p>
    </details>
  </section>
}

/** Primera recomendación por tipo de trofeo (para «Hoy»). */
export function hallTopPicks(box: Parameters<typeof hallRanking>[0], used: Parameters<typeof hallRanking>[1]) {
  const { options } = hallRanking(box, used)
  return { bronze: options.find(o => o.trophy === 'bronze') ?? null, silver: options.find(o => o.trophy === 'silver') ?? null, gold: options.find(o => o.trophy === 'gold') ?? null, label: (o: HallOption) => `${t(ELEMENT_LABEL, o.element)} · ${hallName(o.stat, o.mode)} (nivel ${o.next})` }
}
