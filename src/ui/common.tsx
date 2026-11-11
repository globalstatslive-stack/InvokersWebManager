import type { ReactNode } from 'react'
import { Download, Search } from 'lucide-react'
import type { Bonus, Gear } from '../box/model'
import { bonusName, fmtBonus, RARITY_LABEL, SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { gradeScore } from '../box/stats'
import { gearRating } from '../box/advisor'
import { GearIcon } from './Art'
import { useAccount } from './account'

export function PageHead({ kicker, title, children, actions }: { kicker: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <header className="page-head">
    <div><span className="kicker">{kicker}</span><h1>{title}</h1>{children && <p>{children}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
}
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="search"><Search size={17} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
}
export function Chips<T extends string>({ options, value, onChange, label }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div className="chips" role="group" aria-label={label}>{options.map(o => <button key={o.id} className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
}
export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string }) {
  return <label className="select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>
}
export function NeedsAccount() {
  const { go } = useAccount()
  return <Empty title="Aún no hay cuenta importada" action={<button className="btn primary" onClick={() => go('/importar')}><Download size={17} /> Importar mi caja</button>}>
    Importa tu caja compartida de invokers.com para ver aquí tus Invokers, Titanes y equipo con sus imágenes reales.
  </Empty>
}
export function GradePill({ grade }: { grade: string | null }) {
  return grade ? <span className={`grade g-${grade}`}>{grade}</span> : null
}
export function BonusLine({ b, main }: { b: Bonus; main?: boolean }) {
  return <li className={main ? 'is-main' : ''}><span>{bonusName(b.stat, b.mode)}</span><b>{fmtBonus(b.stat, b.mode, b.value)}</b>{!main && b.rolls > 0 && <small className="rolls">{'▲'.repeat(Math.min(b.rolls, 5))}</small>}<GradePill grade={b.grade} /></li>
}
export function GearCard({ g, owner, extra, onClick, selected }: { g: Gear; owner?: string | null; extra?: ReactNode; onClick?: () => void; selected?: boolean }) {
  const grade = gradeScore(g)
  return <article className={`gear-card ${selected ? 'selected' : ''}`} onClick={onClick}>
    <div className="gear-card-head">
      <GearIcon g={g} />
      <div>
        <strong>{t(SLOT_LABEL, g.slot)}</strong>
        <small>{g.set ? t(SET_LABEL, g.set) : g.faction} · {t(RARITY_LABEL, g.rarity)}</small>
        <span className="gear-meta"><span className="rating" title="Valoración 0–100">{gearRating(g)}</span>{grade !== null && <span className="muted">nota {grade.toFixed(1)}</span>}{owner !== undefined && <span className={owner ? 'owner' : 'free'}>{owner ?? 'Libre'}</span>}</span>
      </div>
    </div>
    <ul className="bonuses"><BonusLine b={g.main} main />{g.subs.map((b, i) => <BonusLine key={i} b={b} />)}</ul>
    {extra}
  </article>
}
export const pct = (n: number) => `${Math.round(n * 100)} %`
export function Meter({ value, max, tone = 'gold' }: { value: number; max: number; tone?: string }) {
  return <span className={`meter ${tone}`}><i style={{ width: `${Math.max(2, Math.min(100, max ? 100 * value / max : 0))}%` }} /></span>
}
