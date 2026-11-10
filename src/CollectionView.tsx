import { useMemo, useState } from 'react'
import { Search, ShieldCheck, Sparkles, Swords, Gem, LockKeyhole } from 'lucide-react'
import type { Collection, Equipment } from './memorypack'
import { bonusLabel, groupLabel, RARITIES, rankLabel, slotLabel } from './labels'

type Tab = 'invokers' | 'titans' | 'gear'
export function CollectionView({ collection, onOptimize }: { collection: Collection; onOptimize: () => void }) {
  const [tab, setTab] = useState<Tab>('invokers')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  const equipment = useMemo(() => [...collection.relics, ...collection.accessories], [collection])
  const normalized = query.trim().toLowerCase()
  const heroes = collection.invokers.filter(x => `${x.inventoryId} ${x.configId} ${x.level}`.includes(normalized)).sort((a, b) => b.level - a.level || b.rank - a.rank)
  const titans = collection.titans.filter(x => `${x.inventoryId} ${x.configId} ${x.level}`.includes(normalized)).sort((a, b) => b.level - a.level || b.rank - a.rank)
  const gear = equipment.filter(x => (!onlyFree || x.ownerType === 0) && `${x.inventoryId} ${slotLabel(x)} ${groupLabel(x)} ${RARITIES[x.rarity]} ${x.equippedHeroId ?? ''}`.toLowerCase().includes(normalized))
  const limit = showAll ? Infinity : 80
  const free = equipment.filter(x => x.ownerType === 0).length
  return <section className="collection-page">
    <div className="page-heading"><span className="eyebrow muted">MEMORYPACK · DATOS VERIFICADOS</span><h1>Tu colección</h1><p>Inventario leído de los archivos locales. Los nombres de personajes no vienen en estos snapshots; se muestran sus identificadores reales y sus relaciones de equipo.</p></div>
    {collection.warnings.map(warning => <div className="alert warning-alert" key={warning}>{warning}</div>)}
    <div className="collection-metrics"><div><Sparkles size={20}/><strong>{collection.invokers.length}</strong><span>Invokers</span></div><div><Swords size={20}/><strong>{collection.titans.length}</strong><span>Titanes</span></div><div><Gem size={20}/><strong>{collection.relics.length + collection.accessories.length}</strong><span>Piezas</span></div><div><ShieldCheck size={20}/><strong>{free}</strong><span>Libres</span></div></div>
    <div className="collection-toolbar"><div className="collection-tabs" role="tablist" aria-label="Tipo de colección"><button role="tab" aria-selected={tab === 'invokers'} className={tab === 'invokers' ? 'active' : ''} onClick={() => { setTab('invokers'); setShowAll(false) }}>Invokers</button><button role="tab" aria-selected={tab === 'titans'} className={tab === 'titans' ? 'active' : ''} onClick={() => { setTab('titans'); setShowAll(false) }}>Titanes</button><button role="tab" aria-selected={tab === 'gear'} className={tab === 'gear' ? 'active' : ''} onClick={() => { setTab('gear'); setShowAll(false) }}>Equipo</button></div><button className="outline-button" onClick={onOptimize}>Abrir simulador</button></div>
    <div className="toolbar"><div className="search"><Search size={18}/><input aria-label="Buscar en la colección" value={query} onChange={e => { setQuery(e.target.value); setShowAll(false) }} placeholder="ID, ranura, conjunto o propietario" /></div>{tab === 'gear' && <label className="check-line"><input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)}/> Solo piezas libres</label>}</div>
    <div className="collection-list">
      {tab === 'invokers' && heroes.slice(0, limit).map(hero => <article className="collection-card" key={hero.inventoryId}><div><strong>Invoker #{hero.inventoryId}</strong><small>Modelo {hero.configId}</small></div><div className="collection-tags"><span>{rankLabel(hero.rank)}</span><span>Nivel {hero.level}</span><span>{Object.keys(hero.relicIds).length} reliquias · {Object.keys(hero.accessoryIds).length} accesorios</span>{hero.locked && <span><LockKeyhole size={13}/> Bloqueado</span>}{hero.inStorage && <span>Almacén</span>}</div></article>)}
      {tab === 'titans' && titans.slice(0, limit).map(titan => <article className="collection-card" key={titan.inventoryId}><div><strong>Titán #{titan.inventoryId}</strong><small>Modelo {titan.configId}</small></div><div className="collection-tags"><span>{rankLabel(titan.rank)}</span><span>Nivel {titan.level}</span><span>Refuerzo {titan.empowermentLevel}</span>{titan.locked && <span><LockKeyhole size={13}/> Bloqueado</span>}</div></article>)}
      {tab === 'gear' && gear.slice(0, limit).map(item => <GearCard key={`${item.kind}-${item.inventoryId}`} item={item}/>)}
      {((tab === 'invokers' && !heroes.length) || (tab === 'titans' && !titans.length) || (tab === 'gear' && !gear.length)) && <p className="muted-copy">No hay resultados para este filtro.</p>}
    </div>
    {((tab === 'invokers' ? heroes.length : tab === 'titans' ? titans.length : gear.length) > limit) && <button className="outline-button more-button" onClick={() => setShowAll(true)}>Mostrar todos los resultados</button>}
  </section>
}

export function GearCard({ item }: { item: Equipment }) {
  return <article className="collection-card gear-card"><div><strong>{item.kind === 'relic' ? 'Reliquia' : 'Accesorio'} #{item.inventoryId} · {slotLabel(item)}</strong><small>{groupLabel(item)} · {RARITIES[item.rarity] ?? `Rareza ${item.rarity}`} · {rankLabel(item.rank)} · nivel {item.level}</small></div><div className="collection-tags"><span className={item.ownerType === 1 ? 'tag-equipped' : item.ownerType === 0 ? 'tag-free' : ''}>{item.ownerType === 1 ? `Invoker #${item.equippedHeroId}` : item.ownerType === 0 ? 'Libre' : 'Estado sin verificar'}</span></div><div className="bonus-line">{item.bonuses.map(bonus => <span key={bonus.id}>{bonusLabel(bonus)}</span>)}</div></article>
}
