import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ShieldCheck, SlidersHorizontal, LockKeyhole, X, ArrowUpRight, Layers3 } from 'lucide-react'
import { EquipmentArt, GameImage } from './CollectionArt'
import { CHARACTERS, characterFor, label, RARITY_ORDER, rarityNumber, unitName, type Character } from './catalog'
import type { Collection, Equipment, Invoker, Titan } from './memorypack'
import { STATS, bonusLabel, groupLabel, RARITIES, rankLabel, slotLabel } from './labels'

type Tab = 'invokers' | 'titans' | 'gear'
type Unit = Invoker | Titan
type Entry = { key: string; character?: Character; units: Unit[] }
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const bestFirst = (a: Unit, b: Unit) => b.level - a.level || b.rank - a.rank || a.inventoryId - b.inventoryId

export function CollectionView({ collection, onOptimize }: { collection: Collection; onOptimize: (heroId?: number) => void }) {
  const [tab, setTab] = useState<Tab>('invokers')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(60)
  const [rarity, setRarity] = useState('')
  const [faction, setFaction] = useState('')
  const [element, setElement] = useState('')
  const [role, setRole] = useState('')
  const [sort, setSort] = useState('rarity')
  const [grouped, setGrouped] = useState(true)
  const [showMissing, setShowMissing] = useState(false)
  const [gearKind, setGearKind] = useState('all')
  const [gearRarity, setGearRarity] = useState(0)
  const [onlyFree, setOnlyFree] = useState(false)
  const [selected, setSelected] = useState<Entry | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const equipment = useMemo(() => [...collection.relics, ...collection.accessories], [collection])
  const distinct = (units: Unit[]) => new Set(units.map(x => x.configId)).size
  const known = useMemo(() => new Set([...collection.invokers, ...collection.titans].map(x => characterFor(x)?.code).filter(Boolean)), [collection])
  const unresolved = [...collection.invokers, ...collection.titans].filter(x => !characterFor(x)).length
  const catalog = CHARACTERS.filter(x => x.kind === tab)
  const units = tab === 'titans' ? collection.titans : collection.invokers
  const entries = useMemo(() => {
    const groups = new Map<string, Entry>()
    for (const unit of [...units].sort(bestFirst)) {
      const character = characterFor(unit)
      const key = character?.code ?? unit.configId
      const entryKey = grouped ? key : `${key}-${unit.inventoryId}`
      const entry = groups.get(entryKey) ?? { key: entryKey, character, units: [] }
      entry.units.push(unit); groups.set(entryKey, entry)
    }
    if (showMissing) for (const character of catalog) if (!known.has(character.code)) groups.set(character.code, { key: character.code, character, units: [] })
    return [...groups.values()].filter(({ character: c, units: copies }) => {
      const search = norm(`${c?.name ?? ''} ${c?.fullName ?? ''} ${c?.code ?? ''} ${label(c?.faction ?? '')} ${copies.map(x => `${x.inventoryId} #${x.inventoryId} ${x.configId}`).join(' ')}`)
      return search.includes(norm(query.trim())) && (!rarity || c?.rarity === rarity) && (!faction || c?.faction === faction) && (!element || c?.element === element) && (!role || c?.role === role)
    }).sort((a, b) => {
      if (!a.units.length !== !b.units.length) return a.units.length ? -1 : 1
      if (sort === 'name') return (a.character?.name ?? a.key).localeCompare(b.character?.name ?? b.key, 'es')
      if (sort === 'level') return (b.units[0]?.level ?? 0) - (a.units[0]?.level ?? 0) || rarityNumber(b.character) - rarityNumber(a.character)
      if (sort === 'rank') return (b.units[0]?.rank ?? 0) - (a.units[0]?.rank ?? 0) || (b.units[0]?.level ?? 0) - (a.units[0]?.level ?? 0)
      return rarityNumber(b.character) - rarityNumber(a.character) || (b.units[0]?.level ?? 0) - (a.units[0]?.level ?? 0) || (a.character?.name ?? '').localeCompare(b.character?.name ?? '', 'es')
    })
  }, [units, grouped, showMissing, tab, known, query, rarity, faction, element, role, sort])
  const gear = equipment.filter(x => (gearKind === 'all' || x.kind === gearKind) && (!gearRarity || x.rarity === gearRarity) && (!onlyFree || x.ownerType === 0) && norm(`#${x.inventoryId} ${slotLabel(x)} ${groupLabel(x)} ${RARITIES[x.rarity]} ${ownerName(x, collection)}`).includes(norm(query.trim())))
  const switchTab = (value: Tab) => { setTab(value); setQuery(''); setRarity(''); setFaction(''); setElement(''); setRole(''); setLimit(60) }
  const reset = () => { setShowMissing(false); setQuery(''); setRarity(''); setFaction(''); setElement(''); setRole(''); setGearKind('all'); setGearRarity(0); setOnlyFree(false); setLimit(60) }
  const free = equipment.filter(x => x.ownerType === 0).length
  return <section className="collection-page account-collection">
    <header className="account-header"><div><span className="eyebrow">TU CUENTA · INVOKERS: TITAN LEGACY</span><h1>{collection.player?.name || 'Tu colección'}</h1><p>{collection.player && `Nivel ${collection.player.level} · `}Colección guardada en este dispositivo</p></div><button className="outline-button" onClick={() => onOptimize()}><SlidersHorizontal size={16}/> Abrir simulador</button></header>
    <h2 className="sr-only">Tu colección</h2>
    <div className="account-counts"><button onClick={() => switchTab('invokers')}><span>Invokers distintos</span><strong>{distinct(collection.invokers)} <small>/ {CHARACTERS.filter(x => x.kind === 'invokers').length}</small></strong><em>{collection.invokers.length} copias en tu cuenta</em></button><button onClick={() => switchTab('titans')}><span>Titanes distintos</span><strong>{distinct(collection.titans)} <small>/ {CHARACTERS.filter(x => x.kind === 'titans').length}</small></strong><em>{collection.titans.length} copias en tu cuenta</em></button><button onClick={() => { switchTab('gear'); setGearKind('relic'); setGearRarity(0); setOnlyFree(false) }}><span>Reliquias</span><strong>{collection.relics.length}</strong><em>{collection.relics.filter(x => x.ownerType === 0).length} sin equipar</em></button><button onClick={() => { switchTab('gear'); setGearKind('accessory'); setGearRarity(0); setOnlyFree(false) }}><span>Accesorios</span><strong>{collection.accessories.length}</strong><em>{collection.accessories.filter(x => x.ownerType === 0).length} sin equipar</em></button></div>
    {collection.warnings.map(w => <div className={w.startsWith('Instantánea compartida') ? 'collection-source-note' : 'alert warning-alert'} key={w}>{w}</div>)}
    {unresolved > 0 && <div className="alert warning-alert">{unresolved} copias tienen un identificador aún sin vincular. Se muestran por ID. Mientras haya identidades sin vincular, algunos personajes marcados como pendientes podrían estar entre esas copias.</div>}
    <div className="roster-tabs" role="tablist" aria-label="Tipo de colección">{([['invokers','Invokers'],['titans','Titanes'],['gear','Equipo']] as const).map(([id,text]) => <button role="tab" key={id} aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => switchTab(id)}>{text}<span>{id === 'gear' ? equipment.length : distinct(id === 'invokers' ? collection.invokers : collection.titans)}</span></button>)}</div>
    {tab !== 'gear' && <div className="rarity-progress">{RARITY_ORDER.filter(r => catalog.some(x => x.rarity === r)).map(r => { const total = catalog.filter(x => x.rarity === r).length, owned = catalog.filter(x => x.rarity === r && known.has(x.code)).length; return <button key={r} className={`rarity-${RARITY_ORDER.indexOf(r)+1} ${rarity === r ? 'chosen' : ''}`} onClick={() => { setRarity(rarity === r ? '' : r); setLimit(60) }} aria-pressed={rarity === r}><span>{label(r)}</span><progress aria-label={`${label(r)}: ${owned} de ${total}`} max={total} value={owned}/><small>{owned} / {total}<b>{Math.round(owned / total * 100)} %</b></small></button> })}</div>}
    <div className="roster-controls"><div className="roster-search"><Search size={17}/><input aria-label="Buscar en la colección" value={query} onChange={e => { setQuery(e.target.value); setLimit(60) }} placeholder={tab === 'gear' ? 'Nombre, conjunto, propietario o ID…' : 'Buscar por nombre o ID…'}/>{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15}/></button>}</div>
      {tab !== 'gear' ? <>
        <details className="roster-advanced" open={filtersOpen} onToggle={e => setFiltersOpen(e.currentTarget.open)}><summary><SlidersHorizontal size={15}/> Filtrar y ordenar{[rarity,faction,element,role].filter(Boolean).length > 0 && <span>{[rarity,faction,element,role].filter(Boolean).length} activos</span>}</summary><div className="roster-filter-row"><Filter title="Rareza" value={rarity} values={RARITY_ORDER.filter(r => catalog.some(x => x.rarity === r))} onChange={v => {setRarity(v);setLimit(60)}}/><Filter title="Facción" value={faction} values={[...new Set(catalog.map(x => x.faction))]} onChange={v => {setFaction(v);setLimit(60)}}/>{tab === 'invokers' && <Filter title="Elemento" value={element} values={[...new Set(catalog.map(x => x.element))]} onChange={v => {setElement(v);setLimit(60)}}/>}<Filter title="Rol" value={role} values={[...new Set(catalog.map(x => x.role))]} onChange={v => {setRole(v);setLimit(60)}}/><label>Ordenar<select aria-label="Ordenar" value={sort} onChange={e => setSort(e.target.value)}><option value="rarity">Rareza y nivel</option><option value="level">Nivel</option><option value="rank">Estrellas</option><option value="name">Nombre</option></select></label></div></details>
        {!filtersOpen && [rarity,faction,element,role].some(Boolean) && <div className="active-filter-chips">{[[rarity,setRarity],[faction,setFaction],[element,setElement],[role,setRole]].map(([value,setter],i) => typeof value === 'string' && value ? <button key={i} onClick={() => (setter as (value:string)=>void)('')} aria-label={`Quitar filtro ${label(value)}`}>{label(value)} <X size={12}/></button> : null)}</div>}
        <div className="roster-options"><label><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)}/> Agrupar duplicados</label><label><input type="checkbox" checked={showMissing} onChange={e => setShowMissing(e.target.checked)}/> Mostrar los que faltan</label><button onClick={reset}>Restablecer filtros</button></div>
      </> : <div className="roster-filter-row"><label>Tipo<select aria-label="Tipo de equipo" value={gearKind} onChange={e => {setGearKind(e.target.value);setLimit(60)}}><option value="all">Todo el equipo</option><option value="relic">Reliquias</option><option value="accessory">Accesorios</option></select></label><label>Rareza<select aria-label="Rareza" value={gearRarity} onChange={e => {setGearRarity(Number(e.target.value));setLimit(60)}}><option value="0">Todas</option>{Object.entries(RARITIES).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="free-toggle"><input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)}/> Solo piezas libres ({free})</label><button className="reset-filters" onClick={reset}>Restablecer filtros</button></div>}
    </div>
    <div className="results-caption"><span>{tab === 'gear' ? `${gear.length} piezas` : `${entries.length} ${grouped ? 'personajes' : 'copias y personajes pendientes'}`}</span><span>{tab === 'gear' ? 'Iconos oficiales de ranura, conjunto y facción' : 'Abre una tarjeta para consultar la ficha'}</span></div>
    {tab === 'gear' ? <div className="equipment-catalog">{gear.slice(0,limit).map(item => <GearCard key={`${item.kind}-${item.inventoryId}`} item={item} owner={ownerName(item,collection)}/>)}</div> : <div className="character-grid">{entries.slice(0,limit).map(entry => <CharacterCard key={entry.key} entry={entry} onClick={() => setSelected(entry)}/>)}</div>}
    {(tab === 'gear' ? gear.length : entries.length) === 0 && <div className="no-results"><Search/><h3>No hay resultados</h3><p>Prueba otro nombre o restablece los filtros.</p><button className="outline-button" onClick={reset}>Restablecer filtros</button></div>}
    {(tab === 'gear' ? gear.length : entries.length) > limit && <button className="outline-button more-button" onClick={() => setLimit(limit+60)}>Mostrar más resultados</button>}
    <p className="catalog-credit">Retratos e iconos del juego © HITZONE · <a href="https://www.invokers.com/en/terms/fan-content-policy/" target="_blank" rel="noreferrer">Contenido de fans</a>. Herramienta independiente. Catálogo público del 10/11/2026; no incluye poderes calculados ni estadísticas finales del personaje.</p>
    {selected && <CharacterDetail entry={selected} collection={collection} onClose={() => setSelected(null)} onOptimize={onOptimize}/>}
  </section>
}
function Filter({ title, value, values, onChange }: { title: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label>{title}<select aria-label={title} value={value} onChange={e => onChange(e.target.value)}><option value="">Todos</option>{values.filter(Boolean).map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
}
function CharacterCard({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const {character:c, units} = entry, unit = units[0]
  return <button className={`character-card rarity-${rarityNumber(c)} ${!unit ? 'not-owned' : ''}`} onClick={onClick} aria-label={`${c?.name ?? `Sin identificar #${unit?.inventoryId}`}${unit ? `, nivel ${unit.level}, ${units.length} ${units.length === 1 ? 'copia' : 'copias'}` : ', pendiente'}`}>
    <div className="character-image"><GameImage path={c?.portrait} alt={c?.name ?? 'Sin identificar'}/><span className="card-level">{unit ? `Nv. ${unit.level}` : 'Pendiente'}</span>{unit?.locked && <LockKeyhole className="card-lock" size={14} aria-label="Bloqueado en el juego"/>}<div className="character-badges">{c?.elementIcon && <GameImage path={c.elementIcon} alt={label(c.element)}/>}{c?.roleIcon && <GameImage path={c.roleIcon} alt={label(c.role)}/>}</div></div>
    <div className="character-caption"><span className="character-faction">{label(c?.faction ?? 'Identidad pendiente')}</span><strong>{c?.name ?? `#${unit?.inventoryId}`}</strong><div><span className="rank-stars">{unit ? '★'.repeat(Math.min(6,unit.rank)) : label(c?.rarity ?? '')}</span>{units.length > 1 && <span className="copy-count"><Layers3 size={11}/>{units.length}</span>}</div></div>
  </button>
}
function ownerName(item: Equipment, collection: Collection) {
  if(item.ownerType === 0) return 'Disponible'
  const owner = collection.invokers.find(x => x.inventoryId === item.equippedHeroId)
  return owner ? `${unitName(owner)} #${owner.inventoryId}` : item.ownerType === 1 ? `Invoker #${item.equippedHeroId}` : 'Estado sin verificar'
}
export function GearCard({ item, owner }: { item: Equipment; owner?: string }) {
  return <article className={`gear-tile rarity-${item.rarity}`}><div className="gear-illustration"><EquipmentArt item={item}/><span className="gear-upgrade">+{item.level}</span><span className="gear-stars">{rankLabel(item.rank)}</span></div><div className="gear-body"><span className="rarity-label">{RARITIES[item.rarity] ?? `Rareza ${item.rarity}`}</span><strong>{slotLabel(item)}</strong><span className="gear-set">{groupLabel(item)}</span><small>{item.kind === 'relic' ? 'Reliquia' : 'Accesorio'} #{item.inventoryId}</small><span className={`owner-pill ${item.ownerType === 0 ? 'free' : ''}`}>{owner ?? (item.ownerType === 0 ? 'Disponible' : `Invoker #${item.equippedHeroId ?? '?'}`)}</span>{item.bonuses[0] && <span className="main-bonus">{bonusLabel(item.bonuses[0])}</span>}<details><summary>Bonificaciones · {item.bonuses.length}</summary><div className="gear-bonuses">{item.bonuses.map(bonus => <span key={bonus.id}>{bonusLabel(bonus)}</span>)}</div></details></div></article>
}
function CharacterDetail({entry,collection,onClose,onOptimize}:{entry:Entry;collection:Collection;onClose:()=>void;onOptimize:(heroId?:number)=>void}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [instance, setInstance] = useState(entry.units[0]?.inventoryId)
  const unit = entry.units.find(x => x.inventoryId === instance)
  const c = entry.character
  const hero = unit && 'relicIds' in unit ? unit : undefined
  const gear = hero ? [...collection.relics,...collection.accessories].filter(x => x.ownerType === 1 && x.equippedHeroId === hero.inventoryId).sort((a,b)=>a.kind.localeCompare(b.kind)||a.slot-b.slot) : []
  useEffect(() => { const d=ref.current;d?.showModal();return()=>d?.close() },[])
  return (<dialog ref={ref} className="character-detail" onCancel={onClose} onClick={e => {if(e.target===ref.current)onClose()}} aria-labelledby="character-detail-title"><div className="detail-shell"><button className="detail-close" onClick={onClose} aria-label="Cerrar ficha"><X/></button><div className={`detail-identity rarity-${rarityNumber(c)}`}><GameImage path={c?.portrait} alt={c?.name ?? 'Sin identificar'}/><div><span className="eyebrow">{c?.kind==='titans'?'TITÁN':'INVOKER'} · {label(c?.rarity ?? '')}</span><h2 id="character-detail-title">{c?.name ?? `Identidad pendiente #${unit?.inventoryId}`}</h2><p>{label(c?.faction ?? '')} · {label(c?.role ?? '')}{c?.element && ` · ${label(c.element)}`}</p>{unit ? <p className="detail-level">Nivel {unit.level} · {rankLabel(unit.rank)}{unit.locked && ' · Bloqueado'}</p> : <p className="detail-level">No está en tu colección importada</p>}</div></div>
      {entry.units.length > 1 && <label className="instance-selector">Copia de tu cuenta<select aria-label="Copia de tu cuenta" value={instance} onChange={e=>setInstance(Number(e.target.value))}>{entry.units.map(x=><option key={x.inventoryId} value={x.inventoryId}>#{x.inventoryId} · nivel {x.level} · {rankLabel(x.rank)}{'inStorage'in x&&x.inStorage?' · Almacén':''}</option>)}</select></label>}
      {unit && <div className="detail-facts"><span>Instancia <b>#{unit.inventoryId}</b></span><span>{hero?'Despertar':'Refuerzo'} <b>{hero?hero.awakeLevel:(unit as Titan).empowermentLevel}</b></span>{hero && <span>Ubicación <b>{hero.configId.startsWith('official:')?'No publicada':hero.inStorage?'Almacén':'Colección'}</b></span>}</div>}
      {hero?.reportedStats && <section className="reported-stats"><h3>Estadísticas de la caja compartida</h3><p>Publicadas por el portal para esta instantánea; no se recalculan al simular cambios.</p><div>{Object.entries({health:3,attack:1,defense:2,criticalRate:7,criticalDamage:8,accuracy:9,resistance:10,comboSpeed:12,skillSpeed:13,skillRecovery:14,manaGeneration:15,instinct:16,runSpeed:11}).map(([key,id])=>hero.reportedStats?.[key]!==undefined&&<span key={key}><small>{STATS[id]}</small><strong>{new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(hero.reportedStats[key]*(id===7||id===8?100:1))}{id===7||id===8?' %':''}</strong></span>)}</div></section>}
      {hero && <><div className="detail-section-title"><h3>Equipo de esta copia <small>{gear.length}/13</small></h3><button className="outline-button" onClick={()=>{onClose();onOptimize(hero.inventoryId)}}>Comparar equipo <ArrowUpRight size={15}/></button></div>{gear.length ? <div className="detail-equipment">{gear.map(x=><GearCard key={`${x.kind}-${x.inventoryId}`} item={x} owner={c?.name}/>)}</div>:<p className="muted-copy">Esta copia no lleva piezas equipadas en la exportación.</p>}</>}
      {unit && <details className="identity-evidence"><summary>Identificadores</summary><p>Modelo de juego: {unit.configId}</p><p>Código de catálogo: {c?.code ?? 'Sin vincular'}</p></details>}
      {c && <a className="official-reference" href={c.source} target="_blank" rel="noreferrer">Consultar habilidades y ficha oficial (inglés) <ArrowUpRight size={14}/></a>}
      <p className="detail-note"><ShieldCheck size={14}/> Consulta local. No modifica el juego.</p>
    </div></dialog>
  )
}
