import { useMemo, useState } from 'react'
import { ChevronDown, LayoutGrid, List, Lock, SlidersHorizontal, X } from 'lucide-react'
import { useAccount } from './account'
import { fmtPower, NeedsAccount, SearchBox } from './common'
import { FactionIcon, GameCard, GearIcon, Portrait, Stars } from './Art'
import { ACCESSORY_SLOTS, bonusName, CLASS_LABEL, CORE_STATS, ELEMENT_LABEL, fmtBonus, fmtStat, RARITIES, RARITY_LABEL, RELIC_SLOTS, SET_LABEL, SLOT_LABEL, STAT_LABEL, STAT_SHORT, t } from '../box/i18n'
import { gearRating } from '../box/advisor'
import { usePlan, reservedBy } from './plan'
import type { Gear, Hero } from '../box/model'

/** Preferencias de la vista (por pestaña), recordadas en esta sesión. */
function useSession<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, set] = useState<T>(() => { try { const s = sessionStorage.getItem(key); return s ? JSON.parse(s) as T : fallback } catch { return fallback } })
  return [v, (x: T) => { set(x); try { sessionStorage.setItem(key, JSON.stringify(x)) } catch { /* sin almacenamiento */ } }]
}
type Filter = { id: string; label: string; options: { id: string; label: string }[] }
function FilterSheet({ open, onToggle, filters, values, setValue, active, clear, sort, sorts, setSort }: { open: boolean; onToggle: () => void; filters: Filter[]; values: Record<string, string>; setValue: (k: string, v: string) => void; active: number; clear: () => void; sort: string; sorts: { id: string; label: string }[]; setSort: (v: string) => void }) {
  return <>
    <button className={`btn small filter-btn ${active ? 'has' : ''}`} aria-expanded={open} aria-controls="filter-sheet" onClick={onToggle}><SlidersHorizontal size={15} /> Filtros{active ? <span className="count" aria-label={`${active} activos`}>{active}</span> : null}<ChevronDown size={14} className={open ? 'rot' : ''} /></button>
    {open && <div id="filter-sheet" className="filter-sheet" role="region" aria-label="Filtros">
      <label className="select"><span>Ordenar</span><select value={sort} onChange={e => setSort(e.target.value)}>{sorts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      {filters.map(f => <label key={f.id} className="select"><span>{f.label}</span><select value={values[f.id] ?? 'all'} onChange={e => setValue(f.id, e.target.value)}>{f.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}
      {active > 0 && <button className="link clear" onClick={clear}><X size={14} /> Quitar {active} filtro{active > 1 ? 's' : ''}</button>}
    </div>}
  </>
}

const HERO_SORTS = [{ id: 'power', label: 'Poder' }, { id: 'level', label: 'Nivel' }, { id: 'rank', label: 'Rango' }, { id: 'rarity', label: 'Rareza' }, { id: 'name', label: 'Nombre' }, ...CORE_STATS.map(s => ({ id: `stat:${s}`, label: STAT_LABEL[s] }))]
const gearCount = (h: Hero) => Object.keys(h.relics).length + Object.keys(h.accessories).length

function InvokersTab() {
  const { account, go } = useAccount()
  const heroes = account!.box.heroes
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useSession('col.sort', 'power')
  const [values, setValues] = useSession<Record<string, string>>('col.filters', {})
  const [mode, setMode] = useSession<'characters' | 'copies'>('col.mode', 'characters')
  const [view, setView] = useSession<'cards' | 'compact'>('col.view', 'cards')
  const [limit, setLimit] = useState(60)
  const copies = useMemo(() => { const m = new Map<string, Hero[]>(); for (const h of heroes) m.set(h.code, [...(m.get(h.code) ?? []), h]); for (const l of m.values()) l.sort((a, b) => b.power - a.power); return m }, [heroes])
  const filters: Filter[] = [
    { id: 'faction', label: 'Facción', options: [{ id: 'all', label: 'Todas' }, ...[...new Set(heroes.map(h => h.faction))].sort().map(f => ({ id: f, label: f }))] },
    { id: 'element', label: 'Elemento', options: [{ id: 'all', label: 'Todos' }, ...['Fire', 'Water', 'Earth', 'Wind', 'Light', 'Dark'].map(e => ({ id: e, label: ELEMENT_LABEL[e] }))] },
    { id: 'cls', label: 'Clase', options: [{ id: 'all', label: 'Todas' }, ...['MeleeAttacker', 'RangedAttacker', 'Support', 'Tank'].map(c => ({ id: c, label: CLASS_LABEL[c] }))] },
    { id: 'rarity', label: 'Rareza', options: [{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => heroes.some(h => h.rarity === r)).map(r => ({ id: r, label: t(RARITY_LABEL, r) }))] },
    { id: 'state', label: 'Estado', options: [{ id: 'all', label: 'Todos' }, { id: 'geared', label: 'Con equipo' }, { id: 'bare', label: 'Sin equipo' }, { id: 'locked', label: 'Bloqueados' }] },
  ]
  const active = Object.values(values).filter(v => v && v !== 'all').length
  const list = useMemo(() => {
    const ok = (h: Hero) => (!values.faction || values.faction === 'all' || h.faction === values.faction) && (!values.element || values.element === 'all' || h.element === values.element)
      && (!values.cls || values.cls === 'all' || h.cls === values.cls) && (!values.rarity || values.rarity === 'all' || h.rarity === values.rarity)
      && (!values.state || values.state === 'all' || (values.state === 'geared' ? gearCount(h) > 0 : values.state === 'bare' ? gearCount(h) === 0 : h.locked))
      && (!q || `${h.name} ${h.fullName}`.toLowerCase().includes(q.toLowerCase()))
    let out = heroes.filter(ok)
    if (mode === 'characters') { const seen = new Set<string>(); out = out.filter(h => { if (seen.has(h.code)) return false; seen.add(h.code); return true }).map(h => copies.get(h.code)!.find(ok) ?? h) }
    const v = (h: Hero) => sort === 'power' ? h.power : sort === 'level' ? h.level * 10 + h.rank : sort === 'rank' ? h.rank * 100 + h.level : sort === 'rarity' ? RARITIES.indexOf(h.rarity) * 1e6 + h.power : sort.startsWith('stat:') ? h.stats[sort.slice(5)] ?? 0 : 0
    return sort === 'name' ? out.sort((a, b) => a.name.localeCompare(b.name)) : out.sort((a, b) => v(b) - v(a))
  }, [heroes, values, q, mode, sort, copies])
  const statCol = sort.startsWith('stat:') ? sort.slice(5) : null
  return <>
    <div className="toolbar sticky">
      <SearchBox value={q} onChange={setQ} placeholder="Buscar Invoker" />
      <div className="toolbar-row">
        <FilterSheet open={open} onToggle={() => setOpen(!open)} filters={filters} values={values} setValue={(k, v) => setValues({ ...values, [k]: v })} active={active} clear={() => setValues({})} sort={sort} sorts={HERO_SORTS} setSort={setSort} />
        <div className="seg" role="group" aria-label="Agrupar">
          <button aria-pressed={mode === 'characters'} className={mode === 'characters' ? 'on' : ''} onClick={() => setMode('characters')}>Personajes</button>
          <button aria-pressed={mode === 'copies'} className={mode === 'copies' ? 'on' : ''} onClick={() => setMode('copies')}>Ejemplares</button>
        </div>
        <div className="seg" role="group" aria-label="Vista">
          <button aria-pressed={view === 'cards'} aria-label="Tarjetas" className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}><LayoutGrid size={15} /></button>
          <button aria-pressed={view === 'compact'} aria-label="Lista compacta" className={view === 'compact' ? 'on' : ''} onClick={() => setView('compact')}><List size={15} /></button>
        </div>
      </div>
      <p className="toolbar-count">{list.length} {mode === 'characters' ? `personajes de ${copies.size}` : `ejemplares de ${heroes.length}`}</p>
    </div>
    {list.length === 0 ? <div className="empty small"><h3>Nada coincide</h3><p>Ningún Invoker cumple estos filtros.</p>{active > 0 && <button className="btn" onClick={() => setValues({})}>Quitar filtros</button>}</div> :
    view === 'cards' ? <div className="gcard-grid">{list.slice(0, limit).map(h => {
      const n = copies.get(h.code)!.length, idx = copies.get(h.code)!.indexOf(h) + 1, gc = gearCount(h)
      return <GameCard key={h.id} c={h} level={h.level} rank={h.rank} label={`${h.fullName}, ${h.rank} estrellas, nivel ${h.level}`} onClick={() => go(`/invoker/${h.id}`)}
        power={statCol ? `${STAT_SHORT[statCol] ?? statCol} ${fmtStat(statCol, h.stats[statCol] ?? 0)}` : fmtPower(h)}
        badge={mode === 'characters' && n > 1 ? `×${n}` : mode === 'copies' && n > 1 ? `${idx}/${n}` : undefined}
        corner={h.locked ? <Lock size={12} aria-label="Bloqueado" /> : undefined}>
        <span className={`gcard-state ${gc ? 'geared' : 'bare'}`}>{gc ? `Equipo ${gc}/13` : 'Sin equipo'}</span>
      </GameCard>
    })}</div> :
      <ul className="row-list">{list.slice(0, limit).map(h => { const n = copies.get(h.code)!.length, gc = gearCount(h)
        return <li key={h.id}><button onClick={() => go(`/invoker/${h.id}`)}>
          <Portrait c={h} size="sm" />
          <span className="row-main"><b>{h.name}{mode === 'characters' && n > 1 ? <small> ×{n}</small> : null}</b><small><FactionIcon faction={h.faction} /> <Stars n={h.rank} /> · Nv. {h.level}{h.locked ? ' · bloqueado' : ''} · {gc ? `${gc} piezas` : 'sin equipo'}</small></span>
          <b className="row-value">{statCol ? fmtStat(statCol, h.stats[statCol] ?? 0) : fmtPower(h)}</b>
        </button></li> })}</ul>}
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 120)}>Mostrar más ({list.length - limit})</button></div>}
  </>
}

const statKey = (b: { stat: string; mode: string }) => `${b.stat}:${b.mode}`
function GearTab() {
  const { account, go } = useAccount()
  const { box, index } = account!
  const { plan } = usePlan(box)
  const reserved = useMemo(() => reservedBy(plan, -1), [plan])
  const [kind, setKind] = useSession<'relic' | 'accessory'>('gear.kind', 'relic')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useSession('gear.sort', 'rating')
  const [values, setValues] = useSession<Record<string, string>>('gear.filters', {})
  const [limit, setLimit] = useState(60)
  const pieces = kind === 'relic' ? box.relics : box.accessories
  const filters: Filter[] = [
    { id: 'state', label: 'Estado', options: [{ id: 'all', label: 'Todas' }, { id: 'free', label: 'Libres' }, { id: 'worn', label: 'Equipadas' }, { id: 'plan', label: 'Reservadas en el plan' }] },
    { id: 'slot', label: 'Ranura', options: [{ id: 'all', label: 'Todas' }, ...(kind === 'relic' ? RELIC_SLOTS : ACCESSORY_SLOTS).map(s => ({ id: s, label: SLOT_LABEL[s] }))] },
    { id: 'group', label: kind === 'relic' ? 'Conjunto' : 'Facción', options: [{ id: 'all', label: 'Todos' }, ...[...new Set(pieces.map(g => g.set ?? g.faction ?? ''))].filter(Boolean).sort().map(g => ({ id: g, label: t(SET_LABEL, g) }))] },
    { id: 'rarity', label: 'Rareza', options: [{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => pieces.some(g => g.rarity === r)).map(r => ({ id: r, label: t(RARITY_LABEL, r) }))] },
    { id: 'rank', label: 'Rango mínimo', options: ['all', '3', '4', '5'].map(n => ({ id: n, label: n === 'all' ? 'Cualquiera' : `${n}★+` })) },
    { id: 'main', label: 'Principal', options: [{ id: 'all', label: 'Cualquiera' }, ...[...new Set(pieces.map(g => statKey(g.main)))].sort().map(k => { const [a, b] = k.split(':'); return { id: k, label: bonusName(a, b) } })] },
  ]
  const active = Object.values(values).filter(v => v && v !== 'all').length
  const list = useMemo(() => {
    const owner = (g: Gear) => g.equippedHeroId !== null ? index.heroes.get(g.equippedHeroId)?.name ?? '' : ''
    const out = pieces.filter(g => (!values.state || values.state === 'all' || (values.state === 'free' ? g.equippedHeroId === null : values.state === 'worn' ? g.equippedHeroId !== null : reserved.has(`${g.kind}${g.id}`)))
      && (!values.slot || values.slot === 'all' || g.slot === values.slot) && (!values.group || values.group === 'all' || (g.set ?? g.faction) === values.group)
      && (!values.rarity || values.rarity === 'all' || g.rarity === values.rarity) && (!values.rank || values.rank === 'all' || g.rank >= Number(values.rank))
      && (!values.main || values.main === 'all' || statKey(g.main) === values.main)
      && (!q || `${t(SLOT_LABEL, g.slot)} ${t(SET_LABEL, g.set ?? g.faction ?? '')} ${owner(g)}`.toLowerCase().includes(q.toLowerCase())))
    const v = (g: Gear) => sort === 'rating' ? gearRating(g) : sort === 'level' ? g.level : g.rank * 10 + RARITIES.indexOf(g.rarity)
    return out.sort((a, b) => v(b) - v(a))
  }, [pieces, values, q, sort, reserved, index])
  return <>
    <div className="toolbar sticky">
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por ranura, conjunto o portador" />
      <div className="toolbar-row">
        <FilterSheet open={open} onToggle={() => setOpen(!open)} filters={filters} values={values} setValue={(k, v) => setValues({ ...values, [k]: v })} active={active} clear={() => setValues({})} sort={sort} sorts={[{ id: 'rating', label: 'Valoración' }, { id: 'rank', label: 'Rango y rareza' }, { id: 'level', label: 'Nivel' }]} setSort={setSort} />
        <div className="seg" role="group" aria-label="Tipo de pieza">
          <button aria-pressed={kind === 'relic'} className={kind === 'relic' ? 'on' : ''} onClick={() => { setKind('relic'); setValues({}) }}>Reliquias</button>
          <button aria-pressed={kind === 'accessory'} className={kind === 'accessory' ? 'on' : ''} onClick={() => { setKind('accessory'); setValues({}) }}>Accesorios</button>
        </div>
      </div>
      <p className="toolbar-count">{list.length} de {pieces.length} · {pieces.filter(g => g.equippedHeroId === null).length} libres</p>
    </div>
    {list.length === 0 ? <div className="empty small"><h3>Nada coincide</h3>{active > 0 && <button className="btn" onClick={() => setValues({})}>Quitar filtros</button>}</div> :
    <ul className="gear-list">{list.slice(0, limit).map(g => { const owner = g.equippedHeroId !== null ? index.heroes.get(g.equippedHeroId) : undefined, inPlan = reserved.has(`${g.kind}${g.id}`)
      return <li key={`${g.kind}${g.id}`}><button onClick={() => go(`/pieza/${g.kind}-${g.id}`)}>
        <GearIcon g={g} size="sm" />
        <span className="row-main"><b>{t(SLOT_LABEL, g.slot)} · {g.set ? t(SET_LABEL, g.set) : g.faction}</b><small>{bonusName(g.main.stat, g.main.mode)} {fmtBonus(g.main.stat, g.main.mode, g.main.value)} · {g.subs.length} subs</small></span>
        <span className="row-side"><span className="rating" title="Valoración 0–100">{gearRating(g)}</span><small className={owner ? 'owner' : 'free'}>{owner ? owner.name : 'Libre'}{inPlan ? ' · en plan' : ''}</small></span>
      </button></li> })}</ul>}
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 120)}>Mostrar más ({list.length - limit})</button></div>}
  </>
}

/** Pestañas de la colección: también las usan Titanes y Equipos. */
export function CollectionTabs({ current }: { current: 'invokers' | 'titanes' | 'piezas' | 'equipos' }) {
  const { account, go } = useAccount()
  if (!account) return null
  const tabs = [
    { id: 'invokers', label: 'Invokers', n: account.box.heroes.length, to: '/coleccion' },
    { id: 'titanes', label: 'Titanes', n: account.box.titans.length, to: '/titanes' },
    { id: 'piezas', label: 'Piezas', n: account.box.relics.length + account.box.accessories.length, to: '/coleccion/piezas' },
    { id: 'equipos', label: 'Equipos', n: account.box.teams.length, to: '/equipos' },
  ] as const
  return <div className="tabs" role="tablist" aria-label="Colección">{tabs.map(t => <button key={t.id} role="tab" aria-selected={current === t.id} className={current === t.id ? 'on' : ''} onClick={() => go(t.to)}>{t.label} <small>{t.n}</small></button>)}</div>
}

export function Collection({ tab }: { tab?: string }) {
  const { account } = useAccount()
  if (!account) return <NeedsAccount />
  const current = tab === 'piezas' ? 'piezas' : 'invokers'
  return <div className="collection">
    <CollectionTabs current={current} />
    {current === 'invokers' ? <InvokersTab /> : <GearTab />}
  </div>
}
