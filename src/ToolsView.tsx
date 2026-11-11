import { useMemo, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { EquipmentArt, GameImage } from './CollectionArt'
import { characterFor, compatibleWith, unitName } from './catalog'
import type { Collection, Equipment } from './memorypack'
import { ACCESSORY_SLOTS, bonusLabel, RELIC_SLOTS, RARITIES, STATS, groupLabel, slotLabel } from './labels'

type Mode = 'build' | 'sell'
const statValue = (gear: Equipment | undefined, stat: number) => gear?.bonuses.filter(x => x.stat === stat).reduce((sum, x) => sum + x.value, 0) ?? 0
const unit = (stat: number) => stat >= 4 && stat <= 8 ? '%' : ''
const shownValue = (value: number, stat: number) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value * (unit(stat) ? 100 : 1))}${unit(stat)}`

export function ToolsView({ collection, initialHeroId }: { collection: Collection; initialHeroId?: number }) {
  const [mode, setMode] = useState<Mode>('build')
  const [heroId, setHeroId] = useState(initialHeroId ?? collection.invokers.find(x => x.level >= 40)?.inventoryId ?? collection.invokers[0]?.inventoryId ?? 0)
  const [kind, setKind] = useState<'relic' | 'accessory'>('relic')
  const [slot, setSlot] = useState(1)
  const [stat, setStat] = useState(13)
  const [minimum, setMinimum] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [maxRank, setMaxRank] = useState(3)
  const [maxRarity, setMaxRarity] = useState(2)
  const [maxLevel, setMaxLevel] = useState(0)
  const hero = collection.invokers.find(x => x.inventoryId === heroId)
  const all = kind === 'relic' ? collection.relics : collection.accessories
  const currentId = kind === 'relic' ? hero?.relicIds[slot] : hero?.accessoryIds[slot]
  const current = all.find(x => x.inventoryId === currentId)
  const candidates = useMemo(() => all.filter(x => x.slot === slot && x.ownerType === 0 && compatibleWith(x, hero) && statValue(x, stat) * (unit(stat) ? 100 : 1) >= minimum)
    .sort((a, b) => statValue(b, stat) - statValue(a, stat) || b.rarity - a.rarity || b.level - a.level).slice(0, 40), [all, slot, stat, minimum, hero])
  const selected = candidates.find(x => x.inventoryId === selectedId)
  const saleCandidates = useMemo(() => [...collection.relics, ...collection.accessories].filter(x => x.ownerType === 0 && x.rank <= maxRank && x.rarity <= maxRarity && x.level <= maxLevel), [collection, maxRank, maxRarity, maxLevel])
  return <section className="tools-page">
    <div className="page-heading"><span className="eyebrow muted">HERRAMIENTAS LOCALES</span><h1>Planificar tu equipo</h1><p>Prueba combinaciones con tus piezas reales. Los resultados son propuestas; no modifican el juego ni calculan costes de equipar o vender.</p></div>
    <div className="selected-hero-strip">{hero && <><GameImage path={characterFor(hero)?.portrait} alt={unitName(hero)}/><div><strong>{unitName(hero)}</strong><span>Copia #{hero.inventoryId} · nivel {hero.level} · {hero.rank}★</span></div></>}</div>
    <div className="collection-tabs tool-tabs" role="tablist" aria-label="Herramienta"><button role="tab" aria-selected={mode === 'build'} className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}>Optimizar una ranura</button><button role="tab" aria-selected={mode === 'sell'} className={mode === 'sell' ? 'active' : ''} onClick={() => setMode('sell')}>Revisar candidatos a venta</button></div>
    {mode === 'build' ? <>
      <div className="panel tool-panel"><h2>Buscar una pieza libre</h2><p className="muted-copy">Selecciona un Invoker y una estadística. Solo se proponen piezas libres de la misma ranura; ninguna equipada en otro personaje entra en el resultado. Los accesorios deben pertenecer a la facción del personaje.</p><div className="tool-fields">
        <label>Invoker<select aria-label="Invoker" value={heroId} onChange={e => { setHeroId(Number(e.target.value)); setSelectedId(null) }}>{collection.invokers.map(x => <option key={x.inventoryId} value={x.inventoryId}>{unitName(x)} · #{x.inventoryId} · nivel {x.level} · {x.rank}★</option>)}</select></label>
        <label>Tipo<select aria-label="Tipo de pieza" value={kind} onChange={e => { setKind(e.target.value as 'relic' | 'accessory'); setSlot(1); setSelectedId(null) }}><option value="relic">Reliquia</option><option value="accessory">Accesorio</option></select></label>
        <label>Ranura<select aria-label="Ranura" value={slot} onChange={e => { setSlot(Number(e.target.value)); setSelectedId(null) }}>{Object.entries(kind === 'relic' ? RELIC_SLOTS : ACCESSORY_SLOTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Estadística<select aria-label="Estadística" value={stat} onChange={e => { setStat(Number(e.target.value)); setSelectedId(null) }}>{Object.entries(STATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Mínimo en la pieza<input type="number" min="0" step="0.1" value={minimum} onChange={e => setMinimum(Math.max(0, Number(e.target.value) || 0))}/><small>{unit(stat) ? 'Escribe el porcentaje: 5 equivale al 5 %.': 'Valor plano de la bonificación.'}</small></label>
      </div></div>
      {kind === 'accessory' && !characterFor(hero ?? { configId: '' }) && <p className="alert warning-alert">Falta identificar la facción de este personaje. No se proponen accesorios hasta verificarla.</p>}
      <div className="tool-columns"><div className="panel tool-panel"><h2>Pieza actual</h2>{current ? <Piece item={current} stat={stat}/> : <p className="muted-copy">Este Invoker no lleva pieza en {kind === 'relic' ? RELIC_SLOTS[slot] : ACCESSORY_SLOTS[slot]}.</p>}</div><div className="panel tool-panel"><h2>Alternativas libres · {candidates.length}</h2>{candidates.length ? <div className="candidate-list">{candidates.map(x => <button className={selectedId === x.inventoryId ? 'candidate active' : 'candidate'} key={x.inventoryId} onClick={() => setSelectedId(x.inventoryId)}><span className="candidate-art"><EquipmentArt item={x}/></span><span>#{x.inventoryId} · {groupLabel(x)} · {RARITIES[x.rarity]}</span><strong>{shownValue(statValue(x, stat), stat)} <ArrowRight size={15}/></strong></button>)}</div> : <p className="muted-copy">No hay piezas libres que cumplan el mínimo para esta ranura.</p>}</div></div>
      {selected && <div className="panel simulation"><ShieldCheck size={23}/><div><h2>Simulación sin cambios en el juego</h2><p>Retirar {current ? `la pieza #${current.inventoryId}` : 'ninguna pieza'} y equipar la pieza #{selected.inventoryId} a {hero ? unitName(hero) : "Invoker"} (#{heroId}). La estadística elegida pasaría de <strong>{shownValue(statValue(current, stat), stat)}</strong> a <strong>{shownValue(statValue(selected, stat), stat)}</strong> en esa ranura.</p><p>Comprueba también las demás bonificaciones y los conjuntos antes de decidir. No se ha calculado el total final del personaje.</p></div></div>}
    </> : <>
      <div className="panel tool-panel"><h2>Filtrar piezas sin propietario</h2><p className="muted-copy">Esta lista es solo una revisión. No se envía ninguna orden de venta. Las piezas equipadas y las de estado de propietario no verificado quedan excluidas.</p><div className="tool-fields"><label>Rango máximo<select value={maxRank} onChange={e => setMaxRank(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(x => <option key={x} value={x}>{x}★</option>)}</select></label><label>Rareza máxima<select value={maxRarity} onChange={e => setMaxRarity(Number(e.target.value))}>{Object.entries(RARITIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Nivel máximo<input type="number" min="0" max="100" value={maxLevel} onChange={e => setMaxLevel(Math.max(0, Number(e.target.value) || 0))}/></label></div></div>
      <div className="panel tool-panel"><h2>{saleCandidates.length} candidatos para revisar</h2><div className="candidate-list">{saleCandidates.slice(0, 100).map(x => <div className="candidate" key={`${x.kind}-${x.inventoryId}`}><span>{x.kind === 'relic' ? 'Reliquia' : 'Accesorio'} #{x.inventoryId} · {slotLabel(x)} · {RARITIES[x.rarity]} · {x.rank}★</span><small>{x.bonuses.map(bonusLabel).join(' · ')}</small></div>)}</div>{saleCandidates.length > 100 && <p className="muted-copy">Se muestran las primeras 100; ajusta los filtros para acotar la revisión.</p>}</div>
    </>}
  </section>
}
function Piece({ item, stat }: { item: Equipment; stat: number }) { return <div className="piece-summary"><div className="piece-art"><EquipmentArt item={item}/></div><strong>#{item.inventoryId} · {slotLabel(item)} · {groupLabel(item)}</strong><span>{RARITIES[item.rarity]} · {item.rank}★ · nivel {item.level}</span><span>{STATS[stat]}: {shownValue(statValue(item, stat), stat)}</span><div className="bonus-line">{item.bonuses.map(x => <span key={x.id}>{bonusLabel(x)}</span>)}</div></div> }
