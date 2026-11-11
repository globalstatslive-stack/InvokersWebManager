import { useMemo, useState } from 'react'
import { ArrowLeft, Lock, Swords, Wand2 } from 'lucide-react'
import { useAccount } from './account'
import { Empty, fmtPower, GearCard, NeedsAccount, StalePowerNote } from './common'
import { ClassIcon, ElementIcon, EmptySlot, FactionIcon, GameImg, GearIcon, Portrait, SetIcon, StatIcon, Stars } from './Art'
import { ACCESSORY_SLOTS, bonusName, CLASS_LABEL, CORE_STATS, ELEMENT_LABEL, fmtBonus, fmtInt, fmtStat, MODE_LABEL, RARITY_LABEL, RELIC_SLOTS, SET_LABEL, SKILL_LABEL, SLOT_LABEL, STAT_LABEL, t, TOLERANCES } from '../box/i18n'
import { rating, TIERS } from '../box/stats'
import { diagnose } from '../box/advisor'
import type { Gear } from '../box/model'

export function HeroDetail({ id }: { id: number }) {
  const { account, go } = useAccount()
  const [open, setOpen] = useState<Gear | null>(null)
  const hero = account?.index.heroes.get(id)
  const teams = useMemo(() => account?.box.teams.filter(tm => tm.levels.some(l => l.slots.some(s => s.heroId === id))) ?? [], [account, id])
  if (!account) return <NeedsAccount />
  if (!hero) return <Empty title="Invoker no encontrado" action={<button className="btn" onClick={() => go('/invokers')}>Volver</button>} />
  const { box, index } = account
  const issues = diagnose(box, index, hero)
  const relic = (s: string) => hero.relics[s] !== undefined ? index.relic(hero.relics[s]) : undefined
  const acc = (s: string) => hero.accessories[s] !== undefined ? index.accessory(hero.accessories[s]) : undefined
  const tolerances = TOLERANCES.filter(k => (hero.stats[k] ?? 0) > 0)
  return <div className="hero-detail">
    <button className="back" onClick={() => history.back()}><ArrowLeft size={17} /> Volver</button>
    <section className={`hero-banner r-${hero.rarity.toLowerCase()}`}>
      <GameImg path={hero.portrait} alt="" className="banner-bg" />
      <Portrait c={hero} size="lg" />
      <div className="hero-banner-copy">
        <span className="kicker">{t(RARITY_LABEL, hero.rarity)} · {hero.faction}</span>
        <h1>{hero.fullName} {hero.locked && <Lock size={18} />}</h1>
        <div className="tags">
          <span><ElementIcon element={hero.element} /> {t(ELEMENT_LABEL, hero.element)}</span>
          <span><ClassIcon cls={hero.cls} /> {t(CLASS_LABEL, hero.cls)}</span>
          <span><FactionIcon faction={hero.faction} /> {hero.faction}</span>
          {hero.soulSign && <span><GameImg path={hero.soulSignIcon} alt="" className="mini-icon" /> {hero.soulSign}</span>}
        </div>
        <div className="hero-numbers">
          <div><small>Poder</small><b>{fmtPower(hero)}</b></div>
          <div><small>Nivel</small><b>{hero.level}<em>/{hero.maxLevel}</em></b></div>
          <div><small>Rango</small><b><Stars n={hero.rank} /></b></div>
          <div><small>Despertar</small><b>{hero.awakeLevel}</b></div>
          <div><small>Combates</small><b>{fmtInt(hero.battles)}</b></div>
        </div>
        <div className="row-actions">
          <button className="btn primary" onClick={() => go(`/optimizador/${hero.id}`)}><Wand2 size={17} /> Optimizar equipo</button>
        </div>
      </div>
    </section>

    <section className="grid-2">
      <div className="panel">
        <div className="panel-title"><h2>Equipo</h2><small>Toca una pieza para ver sus estadísticas</small></div>
        <div className="paperdoll">
          <div className="slots relics">{RELIC_SLOTS.map(s => { const g = relic(s); return <div key={s} className="slot"><span>{SLOT_LABEL[s]}</span>{g ? <GearIcon g={g} onClick={() => setOpen(open?.id === g.id && open.kind === g.kind ? null : g)} selected={open === g} /> : <EmptySlot slot={s} />}</div> })}</div>
          <div className="slots accessories">{ACCESSORY_SLOTS.map(s => { const g = acc(s), locked = hero.awakeLevel < (box.accessorySlotAwake[s] ?? 0); return <div key={s} className={`slot ${locked ? 'locked' : ''}`}><span>{SLOT_LABEL[s]}</span>{g ? <GearIcon g={g} onClick={() => setOpen(open === g ? null : g)} selected={open === g} /> : <EmptySlot slot={s} />}{locked && <small>Despertar {box.accessorySlotAwake[s]}</small>}</div> })}</div>
        </div>
        {open && <GearCard g={open} />}
        {hero.activeSets.length > 0 && <div className="sets-active">{hero.activeSets.map(s => { const rule = index.rules.get(s.set); return <div key={s.set} className="set-row">
          <SetIcon set={s.set} /><span><b>{t(SET_LABEL, s.set)}</b> <small>{s.pieces} piezas</small></span>
          <span className="set-bonus">{rule && TIERS.filter(([n]) => s.tiers.includes(n)).flatMap(([n, k]) => rule[k].map((b, i) => <em key={`${n}${i}`}>{n}: {bonusName(b.stat, b.mode)} {fmtBonus(b.stat, b.mode, b.value)}</em>))}</span>
        </div> })}</div>}
        {issues.length > 0 && <ul className="issues">{issues.map((i, n) => <li key={n} className={`sev-${i.severity}`}>{i.text}</li>)}</ul>}
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Estadísticas</h2><small>Base · equipo · total</small></div>
        <table className="stat-table"><tbody>{CORE_STATS.filter(s => hero.stats[s] !== undefined).map(s => {
          const total = hero.stats[s] ?? 0, gear = hero.gearBonus?.[s] ?? 0, r = rating(box, s, total)
          return <tr key={s}><td><StatIcon stat={s} /> {STAT_LABEL[s]}</td><td className="muted">{hero.gearBonus ? fmtStat(s, total - gear) : ''}</td><td className="plus">{gear ? fmtStat(s, gear, true) : ''}</td><td><b>{fmtStat(s, total)}</b>{r !== null && <small className="rating-pct"> {r} %</small>}</td></tr>
        })}</tbody></table>
        {tolerances.length > 0 && <><h3 className="sub">Tolerancias</h3><div className="tol-list">{tolerances.map(k => <span key={k}>{STAT_LABEL[k]} <b>{fmtStat(k, hero.stats[k])}</b></span>)}</div></>}
        {hero.skills.length > 0 && <><h3 className="sub">Habilidades</h3><div className="skills">{hero.skills.map(s => <span key={s.kind}><small>{t(SKILL_LABEL, s.kind)}</small><b>{s.level}</b></span>)}</div></>}
      </div>
    </section>
    {hero.powerStale && <StalePowerNote />}
    {teams.length > 0 && <section className="panel">
      <div className="panel-title"><h2><Swords size={18} /> Aparece en {teams.length} registros de combate</h2></div>
      <div className="chips-wrap">{teams.map((tm, i) => <button key={`${tm.mode}${tm.key}${i}`} className="tag-btn" onClick={() => go(`/equipos/${tm.mode}`)}>{t(MODE_LABEL, tm.mode)} · {tm.label}{tm.detail ? ` (${tm.detail})` : ''}</button>)}</div>
    </section>}
  </div>
}
