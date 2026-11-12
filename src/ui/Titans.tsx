import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { useAccount } from './account'
import { CollectionTabs } from './Collection'
import { NeedsAccount, PageHead, SearchBox, Select } from './common'
import { FactionIcon, GameImg, Portrait, Stars } from './Art'
import { bonusName, CLASS_LABEL, fmtBonus, fmtInt, STAT_LABEL, t } from '../box/i18n'

export function Titans() {
  const { account } = useAccount()
  const [q, setQ] = useState(''), [sort, setSort] = useState('power'), [faction, setFaction] = useState('all')
  const titans = account?.box.titans ?? []
  const list = useMemo(() => titans
    .filter(x => (faction === 'all' || x.faction === faction) && (!q || x.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'battles' ? b.battles - a.battles : sort === 'rank' ? b.rank - a.rank || b.level - a.level : b.power - a.power), [titans, q, sort, faction])
  if (!account) return <NeedsAccount />
  const usage = new Map<number, number>()
  for (const tm of account.box.teams) for (const l of tm.levels) for (const s of l.slots) if (s.titanId !== null) usage.set(s.titanId, (usage.get(s.titanId) ?? 0) + 1)
  return <>
    <CollectionTabs current="titanes" />
    <PageHead kicker="Colección" title="Titanes">{titans.length} Titanes · su efecto vinculado potencia al Invoker que acompañan</PageHead>
    <div className="filters">
      <SearchBox value={q} onChange={setQ} placeholder="Buscar Titán" />
      <Select label="Ordenar" value={sort} onChange={setSort} options={[{ id: 'power', label: 'Poder' }, { id: 'rank', label: 'Rango' }, { id: 'battles', label: 'Combates' }, { id: 'name', label: 'Nombre' }]} />
      <Select label="Facción" value={faction} onChange={setFaction} options={[{ id: 'all', label: 'Todas' }, ...[...new Set(titans.map(x => x.faction))].sort().map(f => ({ id: f, label: f }))]} />
    </div>
    <div className="titan-grid">{list.map(x => <article key={x.id} className="titan-card">
      <div className="titan-top">
        <Portrait c={x}>{x.locked && <Lock className="lock" size={13} />}</Portrait>
        <div>
          <b>{x.name}</b>
          <small><FactionIcon faction={x.faction} /> {x.faction} · {t(CLASS_LABEL, x.role)}</small>
          <Stars n={x.rank} />
          <small>Nv. {x.level}{x.empowerment ? ` · potenciación ${x.empowerment}` : ''} · <b>{fmtInt(x.power)}</b></small>
        </div>
      </div>
      {x.bound && <div className="bound"><GameImg path={x.boundIcon} alt="" className="mini-icon" /> Vínculo: <b>{STAT_LABEL[x.bound.stat] ?? x.bound.stat} {fmtBonus(x.bound.stat, x.bound.mode, x.bound.general)}</b>{x.bound.specialization !== 'General' && <> · {x.bound.specialization} {fmtBonus(x.bound.stat, x.bound.mode, x.bound.specialized)}</>}</div>}
      {(x.boundBonuses.length > 0 || x.flatBonuses.length > 0) && <ul className="bonuses compact">{[...x.boundBonuses, ...x.flatBonuses].map((b, i) => <li key={i}><span>{bonusName(b.stat, b.mode)}</span><b>{fmtBonus(b.stat, b.mode, b.value)}</b></li>)}</ul>}
      <small className="muted">{fmtInt(x.battles)} combates{usage.get(x.id) ? ` · en ${usage.get(x.id)} equipos registrados` : ''}</small>
    </article>)}</div>
  </>
}
