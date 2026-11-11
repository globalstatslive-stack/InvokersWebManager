import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useAccount } from './account'
import { Chips, Meter, PageHead, SearchBox, Select } from './common'
import { ClassIcon, ElementIcon, FactionIcon, Portrait } from './Art'
import { CHARACTERS } from '../catalog'
import { CLASS_LABEL, ELEMENT_LABEL, RARITIES, RARITY_LABEL, t } from '../box/i18n'
import type { Character2 } from '../box/model'

/** Catálogo completo del juego con lo que tienes y lo que te falta. */
export function Codex() {
  const { account, go } = useAccount()
  const [kind, setKind] = useState<'invokers' | 'titans'>('invokers')
  const [own, setOwn] = useState<'all' | 'owned' | 'missing'>('all')
  const [q, setQ] = useState(''), [faction, setFaction] = useState('all'), [rarity, setRarity] = useState('all')
  const owned = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of account?.box.heroes ?? []) m.set(h.code, (m.get(h.code) ?? 0) + 1)
    for (const h of account?.box.titans ?? []) m.set(h.code, (m.get(h.code) ?? 0) + 1)
    return m
  }, [account])
  const all = CHARACTERS.filter(c => c.kind === kind)
  const list = all.filter(c => (faction === 'all' || c.faction === faction) && (rarity === 'all' || c.rarity === rarity) && (own === 'all' || (own === 'owned') === owned.has(c.code)) && (!q || c.fullName.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name))
  const factions = [...new Set(all.map(c => c.faction))].sort()
  const have = all.filter(c => owned.has(c.code)).length
  const firstOf = (code: string) => account?.box.heroes.find(h => h.code === code)
  return <>
    <PageHead kicker="Base de datos" title="Códice">{all.length} {kind === 'invokers' ? 'Invokers' : 'Titanes'} en el catálogo{account ? ` · tienes ${have} (${Math.round(100 * have / all.length)} %)` : ''}</PageHead>
    {account && <div className="panel completion">{factions.map(f => { const n = all.filter(c => c.faction === f), h = n.filter(c => owned.has(c.code)).length; return <div key={f} className="bar-row"><FactionIcon faction={f} />{f}<Meter value={h} max={n.length} /><b>{h}/{n.length}</b></div> })}</div>}
    <div className="filters">
      <Chips label="Tipo" value={kind} onChange={v => { setKind(v); setFaction('all') }} options={[{ id: 'invokers', label: 'Invokers' }, { id: 'titans', label: 'Titanes' }]} />
      {account && <Chips label="Posesión" value={own} onChange={setOwn} options={[{ id: 'all', label: 'Todos' }, { id: 'owned', label: 'Los tengo' }, { id: 'missing', label: 'Me faltan' }]} />}
      <SearchBox value={q} onChange={setQ} placeholder="Buscar en el catálogo" />
      <Select label="Facción" value={faction} onChange={setFaction} options={[{ id: 'all', label: 'Todas' }, ...factions.map(f => ({ id: f, label: f }))]} />
      <Select label="Rareza" value={rarity} onChange={setRarity} options={[{ id: 'all', label: 'Todas' }, ...RARITIES.filter(r => all.some(c => c.rarity === r)).map(r => ({ id: r, label: t(RARITY_LABEL, r) }))]} />
    </div>
    <div className="hero-grid">{list.map(c => {
      const ch: Character2 = { code: c.code, name: c.name, fullName: c.fullName, portrait: c.portrait, rarity: c.rarity, element: c.kind === 'invokers' ? c.element : null, cls: c.kind === 'invokers' ? c.role : null, role: c.kind === 'titans' ? c.role : null, faction: c.faction, soulSign: null, soulSignIcon: null, boundIcon: null }
      const n = owned.get(c.code) ?? 0, mine = kind === 'invokers' ? firstOf(c.code) : undefined
      return <div key={c.code} className={`hero-card codex ${account && !n ? 'missing' : ''}`}>
        <button className="codex-btn" onClick={() => mine && go(`/invoker/${mine.id}`)} disabled={!mine}>
          <Portrait c={ch} badge={n > 1 ? `×${n}` : undefined}><span className="portrait-icons"><ElementIcon element={ch.element} /><ClassIcon cls={ch.cls} /></span></Portrait>
          <span className="hero-card-name">{c.name}</span>
          <span className="hero-card-meta">{t(RARITY_LABEL, c.rarity)} · {c.kind === 'invokers' ? t(ELEMENT_LABEL, c.element) : t(CLASS_LABEL, c.role)}</span>
        </button>
        <a className="ext" href={c.source} target="_blank" rel="noreferrer" aria-label={`Ficha oficial de ${c.name}`}><ExternalLink size={13} /></a>
      </div>
    })}</div>
  </>
}
