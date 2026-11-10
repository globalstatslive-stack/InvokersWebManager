import { useMemo, useState } from 'react'
import { Search, ShieldCheck, Sparkles, Swords, Gem, LockKeyhole } from 'lucide-react'
import { EquipmentArt, PortraitArt } from './CollectionArt'
import type { Collection, Equipment } from './memorypack'
import { bonusLabel, groupLabel, RARITIES, rankLabel, slotLabel } from './labels'

type Tab = 'invokers' | 'titans' | 'gear'
export function CollectionView({ collection, onOptimize }: { collection: Collection; onOptimize: () => void }) {
  const [tab, setTab] = useState<Tab>('invokers')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [gearKind, setGearKind] = useState('all')
  const [rarity, setRarity] = useState(0)
  const [onlyFree, setOnlyFree] = useState(false)
  const equipment = useMemo(() => [...collection.relics, ...collection.accessories], [collection])
  const normalized = query.trim().toLowerCase()
  const heroes = collection.invokers.filter(x => `${x.inventoryId} ${x.configId} ${x.level}`.includes(normalized)).sort((a, b) => b.level - a.level || b.rank - a.rank)
  const titans = collection.titans.filter(x => `${x.inventoryId} ${x.configId} ${x.level}`.includes(normalized)).sort((a, b) => b.level - a.level || b.rank - a.rank)
  const gear = equipment.filter(x => (gearKind === 'all' || x.kind === gearKind) && (!rarity || x.rarity === rarity) && (!onlyFree || x.ownerType === 0) && `${x.inventoryId} ${slotLabel(x)} ${groupLabel(x)} ${RARITIES[x.rarity]} ${x.equippedHeroId ?? ''}`.toLowerCase().includes(normalized))
  const limit = showAll ? Infinity : 80
  const free = equipment.filter(x => x.ownerType === 0).length
  return <section className="collection-page">
    <div className="collection-cover"><div><span className="eyebrow">EL ARCHIVO DEL INVOCADOR</span><h1>Tu colección</h1><p>Explora tus fuerzas. Encuentra la pieza que falta.</p><span className="cover-status"><ShieldCheck size={14}/> Inventario local · {collection.invokers.length + collection.titans.length} unidades</span></div><div className="cover-art" aria-hidden="true"><PortraitArt titan/></div></div><p className="art-caption">Ilustraciones originales de categoría. Los retratos oficiales y nombres de cada personaje están pendientes de vincular a sus identificadores.</p>
    {collection.warnings.map(warning => <div className="alert warning-alert" key={warning}>{warning}</div>)}
    <div className="collection-metrics"><div><Sparkles size={20}/><strong>{collection.invokers.length}</strong><span>Invokers</span></div><div><Swords size={20}/><strong>{collection.titans.length}</strong><span>Titanes</span></div><div><Gem size={20}/><strong>{collection.relics.length + collection.accessories.length}</strong><span>Piezas</span></div><div><ShieldCheck size={20}/><strong>{free}</strong><span>Libres</span></div></div>
    <div className="collection-toolbar"><div className="collection-tabs" role="tablist" aria-label="Tipo de colección"><button role="tab" aria-selected={tab === 'invokers'} className={tab === 'invokers' ? 'active' : ''} onClick={() => { setTab('invokers'); setShowAll(false) }}>Invokers</button><button role="tab" aria-selected={tab === 'titans'} className={tab === 'titans' ? 'active' : ''} onClick={() => { setTab('titans'); setShowAll(false) }}>Titanes</button><button role="tab" aria-selected={tab === 'gear'} className={tab === 'gear' ? 'active' : ''} onClick={() => { setTab('gear'); setShowAll(false) }}>Equipo</button></div><button className="outline-button" onClick={onOptimize}>Abrir simulador</button></div>
    <div className="toolbar"><div className="search"><Search size={18}/><input aria-label="Buscar en la colección" value={query} onChange={e => { setQuery(e.target.value); setShowAll(false) }} placeholder="ID, ranura, conjunto o propietario" /></div>{tab === 'gear' && <label className="check-line"><input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)}/> Solo piezas libres</label>}</div>
    {tab === 'gear' && <div className="visual-filters"><label>Tipo<select aria-label="Tipo de equipo" value={gearKind} onChange={e => { setGearKind(e.target.value); setShowAll(false) }}><option value="all">Todo el equipo</option><option value="relic">Reliquias</option><option value="accessory">Accesorios</option></select></label><label>Rareza<select aria-label="Rareza" value={rarity} onChange={e => { setRarity(Number(e.target.value)); setShowAll(false) }}><option value="0">Todas las rarezas</option>{Object.entries(RARITIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><span>{gear.length} piezas</span></div>}
    <div className={`collection-list visual-grid ${tab === 'gear' ? 'equipment-grid' : 'portrait-grid'}`}>
      {tab === 'invokers' && heroes.slice(0, limit).map(hero => <article className="unit-card" key={hero.inventoryId}><div className="portrait-frame"><PortraitArt/><span className="unit-level">NV. {hero.level}</span>{hero.locked && <span className="unit-lock" title="Bloqueado"><LockKeyhole size={15}/></span>}<span className="unit-stars">{rankLabel(hero.rank)}</span></div><div className="unit-body"><small>INVOKER</small><strong>Invoker #{hero.inventoryId}</strong><div className="unit-facts"><span>{Object.keys(hero.relicIds).length}/8 reliquias</span><span>{Object.keys(hero.accessoryIds).length}/5 accesorios</span></div><details><summary>Ver detalles</summary><p>Modelo {hero.configId}</p><p>Despertar {hero.awakeLevel}{hero.inStorage ? ' · Almacén' : ''}{hero.locked ? ' · Bloqueado' : ''}</p><p>Reliquias: {Object.entries(hero.relicIds).map(([slot, id]) => `${slot}: #${id}`).join(' · ') || 'Sin equipo'}</p></details></div></article>)}
      {tab === 'titans' && titans.slice(0, limit).map(titan => <article className="unit-card titan-card" key={titan.inventoryId}><div className="portrait-frame"><PortraitArt titan/><span className="unit-level">NV. {titan.level}</span>{titan.locked && <span className="unit-lock" title="Bloqueado"><LockKeyhole size={15}/></span>}<span className="unit-stars">{rankLabel(titan.rank)}</span></div><div className="unit-body"><small>TITÁN</small><strong>Titán #{titan.inventoryId}</strong><div className="unit-facts"><span>Refuerzo {titan.empowermentLevel}</span></div><details><summary>Ver detalles</summary><p>Modelo {titan.configId}</p><p>{titan.locked ? 'Bloqueado' : 'Sin bloqueo'}</p></details></div></article>)}
      {tab === 'gear' && gear.slice(0, limit).map(item => <GearCard key={`${item.kind}-${item.inventoryId}`} item={item}/>)}
      {((tab === 'invokers' && !heroes.length) || (tab === 'titans' && !titans.length) || (tab === 'gear' && !gear.length)) && <p className="muted-copy">No hay resultados para este filtro.</p>}
    </div>
    {((tab === 'invokers' ? heroes.length : tab === 'titans' ? titans.length : gear.length) > limit) && <button className="outline-button more-button" onClick={() => setShowAll(true)}>Mostrar todos los resultados</button>}
  </section>
}

export function GearCard({ item }: { item: Equipment }) {
  return <article className={`gear-tile rarity-${item.rarity}`}><div className="gear-illustration"><EquipmentArt item={item}/><span className="gear-upgrade">+{item.level}</span><span className="gear-stars">{rankLabel(item.rank)}</span></div><div className="gear-body"><span className="rarity-label">{RARITIES[item.rarity] ?? `Rareza ${item.rarity}`}</span><strong>{slotLabel(item)}</strong><span className="gear-set">{groupLabel(item)}</span><small>{item.kind === 'relic' ? 'Reliquia' : 'Accesorio'} #{item.inventoryId}</small><span className={`owner-pill ${item.ownerType === 0 ? 'free' : ''}`}>{item.ownerType === 1 ? `Invoker #${item.equippedHeroId}` : item.ownerType === 0 ? 'Disponible' : 'Estado sin verificar'}</span><details><summary>Bonificaciones · {item.bonuses.length}</summary><div className="gear-bonuses">{item.bonuses.map(bonus => <span key={bonus.id}>{bonusLabel(bonus)}</span>)}</div></details></div></article>
}
