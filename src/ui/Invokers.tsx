import { useMemo, useState } from 'react'
import { LayoutGrid, List, Lock } from 'lucide-react'
import { useAccount } from './account'
import { Chips, fmtPower, NeedsAccount, PageHead, SearchBox, Select } from './common'
import { ClassIcon, ElementIcon, FactionIcon, Portrait, Stars } from './Art'
import { CLASS_LABEL, CORE_STATS, ELEMENT_LABEL, fmtStat, RARITIES, RARITY_LABEL, STAT_LABEL, STAT_SHORT, t } from '../box/i18n'
import type { Hero } from '../box/model'

const SORTS = [{ id: 'power', label: 'Poder' }, { id: 'level', label: 'Nivel' }, { id: 'rank', label: 'Rango' }, { id: 'rarity', label: 'Rareza' }, { id: 'name', label: 'Nombre' }, { id: 'battles', label: 'Combates' }, ...CORE_STATS.map(s => ({ id: `stat:${s}`, label: STAT_LABEL[s] }))]
function remember<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, set] = useState<T>(() => { try { return (sessionStorage.getItem(key) as T) || fallback } catch { return fallback } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(key, x) } catch { /* sin almacenamiento */ } }]
}
export function Invokers() {
  const { account, go } = useAccount()
  const [q, setQ] = useState('')
  const [sort, setSort] = remember<string>('inv.sort', 'power')
  const [faction, setFaction] = remember<string>('inv.faction', 'all')
  const [element, setElement] = remember<string>('inv.element', 'all')
  const [cls, setCls] = remember<string>('inv.cls', 'all')
  const [rarity, setRarity] = remember<string>('inv.rarity', 'all')
  const [view, setView] = remember<'grid' | 'table'>('inv.view', 'grid')
  const [dedupe, setDedupe] = remember<'all' | 'best'>('inv.dedupe', 'all')
  const heroes = account?.box.heroes ?? []
  const list = useMemo(() => {
    const value = (h: Hero) => sort === 'power' ? h.power : sort === 'level' ? h.level : sort === 'rank' ? h.rank * 100 + h.level : sort === 'rarity' ? RARITIES.indexOf(h.rarity) * 1e6 + h.power : sort === 'battles' ? h.battles : sort.startsWith('stat:') ? h.stats[sort.slice(5)] ?? 0 : 0
    let out = heroes.filter(h => (faction === 'all' || h.faction === faction) && (element === 'all' || h.element === element) && (cls === 'all' || h.cls === cls) && (rarity === 'all' || h.rarity === rarity) && (!q || `${h.name} ${h.fullName}`.toLowerCase().includes(q.toLowerCase())))
    if (dedupe === 'best') { const best = new Map<string, Hero>(); for (const h of out) { const b = best.get(h.code); if (!b || h.power > b.power) best.set(h.code, h) } out = [...best.values()] }
    return sort === 'name' ? out.sort((a, b) => a.name.localeCompare(b.name)) : out.sort((a, b) => value(b) - value(a))
  }, [heroes, q, sort, faction, element, cls, rarity, dedupe])
  if (!account) return <NeedsAccount />
  const factions = [...new Set(heroes.map(h => h.faction))].sort()
  const copies = new Map<string, number>(); for (const h of heroes) copies.set(h.code, (copies.get(h.code) ?? 0) + 1)
  const statCol = sort.startsWith('stat:') ? sort.slice(5) : null
  return <>
    <PageHead kicker="Colección" title="Invokers" actions={<Chips label="Vista" value={view} onChange={setView} options={[{ id: 'grid', label: <LayoutGrid size={16} /> }, { id: 'table', label: <List size={16} /> }]} />}>
      {list.length} de {heroes.length} · {new Set(heroes.map(h => h.code)).size} personajes distintos
    </PageHead>
    <div className="filters">
      <SearchBox value={q} onChange={setQ} placeholder="Buscar Invoker" />
      <Select label="Ordenar" value={sort} onChange={setSort} options={SORTS} />
      <Select label="Facción" value={faction} onChange={setFaction} options={[{ id: 'all', label: 'Todas' }, ...factions.map(f => ({ id: f, label: f }))]} />
      <Select label="Rareza" value={rarity} onChange={setRarity} options={[{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => heroes.some(h => h.rarity === r)).map(r => ({ id: r, label: t(RARITY_LABEL, r) }))]} />
      <Chips label="Elemento" value={element} onChange={setElement} options={[{ id: 'all', label: 'Todos' }, ...['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark'].map(e => ({ id: e, label: <><ElementIcon element={e} /><span className="sr">{ELEMENT_LABEL[e]}</span></> }))]} />
      <Chips label="Clase" value={cls} onChange={setCls} options={[{ id: 'all', label: 'Todas' }, ...['MeleeAttacker', 'RangedAttacker', 'Support', 'Tank'].map(c => ({ id: c, label: <><ClassIcon cls={c} /><span className="sr">{CLASS_LABEL[c]}</span></> }))]} />
      <Chips label="Copias" value={dedupe} onChange={setDedupe} options={[{ id: 'all', label: 'Todas las copias' }, { id: 'best', label: 'Mejor copia' }]} />
    </div>
    {view === 'grid' ? <div className="hero-grid">{list.map(h => <button key={h.id} className="hero-card" onClick={() => go(`/invoker/${h.id}`)}>
      <Portrait c={h} badge={copies.get(h.code)! > 1 ? `×${copies.get(h.code)}` : undefined}>
        <span className="portrait-icons"><ElementIcon element={h.element} /><ClassIcon cls={h.cls} /></span>
        {h.locked && <Lock className="lock" size={13} />}
      </Portrait>
      <span className="hero-card-name">{h.name}</span>
      <Stars n={h.rank} />
      <span className="hero-card-meta">Nv. {h.level} · {statCol ? `${STAT_SHORT[statCol] ?? statCol} ${fmtStat(statCol, h.stats[statCol] ?? 0)}` : fmtPower(h)}</span>
    </button>)}</div> :
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Invoker</th><th>Rango</th><th>Nivel</th><th>Poder</th>{CORE_STATS.slice(0, 9).map(s => <th key={s} className={statCol === s ? 'sorted' : ''}>{STAT_SHORT[s]}</th>)}</tr></thead>
        <tbody>{list.map(h => <tr key={h.id} onClick={() => go(`/invoker/${h.id}`)}>
          <td className="name-cell"><Portrait c={h} size="sm" /><span><b>{h.name}</b><small><FactionIcon faction={h.faction} /> <ElementIcon element={h.element} /></small></span></td>
          <td><Stars n={h.rank} /></td><td>{h.level}</td><td><b>{fmtPower(h)}</b></td>
          {CORE_STATS.slice(0, 9).map(s => <td key={s} className={statCol === s ? 'sorted' : ''}>{h.stats[s] !== undefined ? fmtStat(s, h.stats[s]) : '—'}</td>)}
        </tr>)}</tbody>
      </table></div>}
  </>
}
