import { useMemo, useState } from 'react'
import { useAccount } from './account'
import { Chips, GearCard, NeedsAccount, PageHead, Select } from './common'
import { ACCESSORY_SLOTS, bonusName, RARITIES, RARITY_LABEL, RELIC_SLOTS, SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { gearRating } from '../box/advisor'
import { gradeScore } from '../box/stats'
import type { Gear } from '../box/model'

const statKey = (b: { stat: string; mode: string }) => `${b.stat}:${b.mode}`
export function GearPage() {
  const { account, go } = useAccount()
  const [kind, setKind] = useState<'relic' | 'accessory'>('relic')
  const [slot, setSlot] = useState('all'), [group, setGroup] = useState('all'), [rarity, setRarity] = useState('all')
  const [state, setState] = useState<'all' | 'free' | 'equipped'>('all'), [main, setMain] = useState('all'), [sub, setSub] = useState('all')
  const [minRank, setMinRank] = useState('0'), [sort, setSort] = useState('rating'), [limit, setLimit] = useState(60)
  const pieces = useMemo(() => account ? (kind === 'relic' ? account.box.relics : account.box.accessories) : [], [account, kind])
  const list = useMemo(() => {
    const subValue = (g: Gear) => g.subs.filter(b => statKey(b) === sub).reduce((s, b) => s + b.value, 0) + (statKey(g.main) === sub ? g.main.value : 0)
    const out = pieces.filter(g => (slot === 'all' || g.slot === slot) && (group === 'all' || (g.set ?? g.faction) === group) && (rarity === 'all' || g.rarity === rarity)
      && (state === 'all' || (state === 'free') === (g.equippedHeroId === null)) && (main === 'all' || statKey(g.main) === main)
      && (sub === 'all' || g.subs.some(b => statKey(b) === sub)) && g.rank >= Number(minRank))
    const key = (g: Gear) => sort === 'rating' ? gearRating(g) : sort === 'level' ? g.level : sort === 'rank' ? g.rank * 10 + RARITIES.indexOf(g.rarity) : sort === 'grade' ? gradeScore(g) ?? 0 : sort === 'sub' ? subValue(g) : 0
    return out.sort((a, b) => key(b) - key(a))
  }, [pieces, slot, group, rarity, state, main, sub, minRank, sort])
  if (!account) return <NeedsAccount />
  const groups = [...new Set(pieces.map(g => g.set ?? g.faction ?? ''))].filter(Boolean).sort()
  const mains = [...new Set(pieces.map(g => statKey(g.main)))].sort()
  const subs = [...new Set(pieces.flatMap(g => g.subs.map(statKey)))].sort()
  const label = (k: string) => { const [s, m] = k.split(':'); return bonusName(s, m) }
  const free = pieces.filter(g => g.equippedHeroId === null).length
  return <>
    <PageHead kicker="Inventario" title="Equipo">{pieces.length} {kind === 'relic' ? 'reliquias' : 'accesorios'} · {free} libres · mostrando {Math.min(limit, list.length)} de {list.length}</PageHead>
    <div className="filters">
      <Chips label="Tipo" value={kind} onChange={v => { setKind(v); setSlot('all'); setGroup('all'); setMain('all') }} options={[{ id: 'relic', label: 'Reliquias' }, { id: 'accessory', label: 'Accesorios' }]} />
      <Chips label="Estado" value={state} onChange={setState} options={[{ id: 'all', label: 'Todas' }, { id: 'free', label: 'Libres' }, { id: 'equipped', label: 'Equipadas' }]} />
      <Select label="Ranura" value={slot} onChange={setSlot} options={[{ id: 'all', label: 'Todas' }, ...(kind === 'relic' ? RELIC_SLOTS : ACCESSORY_SLOTS).map(s => ({ id: s, label: SLOT_LABEL[s] }))]} />
      <Select label={kind === 'relic' ? 'Conjunto' : 'Facción'} value={group} onChange={setGroup} options={[{ id: 'all', label: 'Todos' }, ...groups.map(g => ({ id: g, label: t(SET_LABEL, g) }))]} />
      <Select label="Rareza" value={rarity} onChange={setRarity} options={[{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => pieces.some(g => g.rarity === r)).map(r => ({ id: r, label: t(RARITY_LABEL, r) }))]} />
      <Select label="Rango mín." value={minRank} onChange={setMinRank} options={['0', '2', '3', '4', '5'].map(n => ({ id: n, label: n === '0' ? 'Cualquiera' : `${n}★+` }))} />
      <Select label="Principal" value={main} onChange={setMain} options={[{ id: 'all', label: 'Cualquiera' }, ...mains.map(m => ({ id: m, label: label(m) }))]} />
      <Select label="Con sub" value={sub} onChange={v => { setSub(v); if (v !== 'all') setSort('sub') }} options={[{ id: 'all', label: 'Cualquiera' }, ...subs.map(m => ({ id: m, label: label(m) }))]} />
      <Select label="Ordenar" value={sort} onChange={setSort} options={[{ id: 'rating', label: 'Valoración' }, { id: 'grade', label: 'Nota de subs' }, { id: 'rank', label: 'Rango y rareza' }, { id: 'level', label: 'Nivel' }, ...(sub !== 'all' ? [{ id: 'sub', label: `Valor de ${label(sub)}` }] : [])]} />
    </div>
    <div className="gear-grid">{list.slice(0, limit).map(g => {
      const owner = g.equippedHeroId !== null ? account.index.heroes.get(g.equippedHeroId) : undefined
      return <GearCard key={`${g.kind}${g.id}`} g={g} owner={owner?.name ?? null} onClick={owner ? () => go(`/invoker/${owner.id}`) : undefined} />
    })}</div>
    {list.length > limit && <div className="center"><button className="btn" onClick={() => setLimit(limit + 90)}>Mostrar más</button></div>}
  </>
}
