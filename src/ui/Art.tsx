import { useState } from 'react'
import type { Character2, Gear } from '../box/model'
import { SET_LABEL, SLOT_LABEL, t } from '../box/i18n'
import { useAccount } from './account'

const local = (path: string) => `${import.meta.env.BASE_URL}${path}`
/** Imagen del juego: primero la copia local verificada; si falta, el recurso del portal oficial. */
export function GameImg({ path, alt, className = '' }: { path?: string | null; alt: string; className?: string }) {
  const { account } = useAccount()
  const base = account?.box.assetBase
  const [stage, setStage] = useState<{ path?: string | null; n: number }>({ path, n: 0 })
  const n = stage.path === path ? stage.n : 0
  const remote = path?.startsWith('game/assets/') ? `https://www.invokers.com/${path.slice(5)}`
    : path?.startsWith('game/characters/') ? `https://www.invokers.com/portraits/${path.slice(5)}`
    : base && path ? `https://invokers.com${base}${path.replace(/^game\//, '')}` : null
  if (!path || n >= 2 || (n === 1 && !remote)) return <span className={`img-missing ${className}`} role="img" aria-label={alt}>{alt.slice(0, 1)}</span>
  const src = n === 0 ? local(path) : remote!
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setStage({ path, n: n + 1 })} />
}

const rarityClass = (r: string) => `r-${r.toLowerCase()}`
export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="stars" aria-label={`Rango ${n}`}>{Array.from({ length: Math.max(n, 0) }, (_, i) => <i key={i} className={i < max ? '' : 'over'}>★</i>)}</span>
}
export function Portrait({ c, size = 'md', badge, children }: { c: Character2; size?: 'sm' | 'md' | 'lg'; badge?: React.ReactNode; children?: React.ReactNode }) {
  return <span className={`portrait ${size} ${rarityClass(c.rarity)}`}>
    <GameImg path={c.portrait} alt={c.name} className="portrait-img" />
    {badge && <span className="portrait-badge">{badge}</span>}
    {children}
  </span>
}
export function ElementIcon({ element, className = 'mini-icon' }: { element: string | null; className?: string }) {
  return element ? <GameImg path={`game/elements/${element.toLowerCase()}.webp`} alt={element} className={className} /> : null
}
const FACTION_CODE: Record<string, string> = { Eldrin: 'ELD', Magi: 'MAG', Stonehearts: 'STO', Freeborn: 'FRB', Beastbloods: 'BST', Nocturna: 'NOC', Ironbands: 'IRN', Cambion: 'CAM', Lightseekers: 'LTS', Dragons: 'DRAGON' }
export function FactionIcon({ faction, className = 'mini-icon' }: { faction: string | null; className?: string }) {
  const code = faction ? FACTION_CODE[faction] : undefined
  return code ? <GameImg path={`game/factions/${code}/small.webp`} alt={faction!} className={className} /> : null
}
const CLASS_FILE: Record<string, string> = { MeleeAttacker: 'melee_attacker', RangedAttacker: 'ranged_attacker', Support: 'support', Tank: 'tank' }
export function ClassIcon({ cls, className = 'mini-icon' }: { cls: string | null; className?: string }) {
  return cls && CLASS_FILE[cls] ? <GameImg path={`game/classes/${CLASS_FILE[cls]}.webp`} alt={cls} className={className} /> : null
}

export function gearImage(g: Gear): string | null {
  if (g.icon) return g.icon
  if (g.kind === 'accessory' && g.faction) return `game/assets/gear/accessories/${FACTION_CODE[g.faction]}/${g.slot}.webp`
  if (g.set) return `game/shop/relics/${g.set}/${g.slot}.webp`
  return `game/assets/gear/slots/${g.slot}.webp`
}
export function GearIcon({ g, size = 'md', onClick, selected }: { g: Gear; size?: 'sm' | 'md' | 'lg'; onClick?: () => void; selected?: boolean }) {
  const Tag = onClick ? 'button' : 'span'
  return <Tag className={`gear-icon ${size} ${rarityClass(g.rarity)} ${selected ? 'selected' : ''}`} onClick={onClick} title={`${t(SLOT_LABEL, g.slot)} · ${g.set ? t(SET_LABEL, g.set) : g.faction ?? ''}`}>
    <GameImg path={gearImage(g)} alt={t(SLOT_LABEL, g.slot)} className="gear-img" />
    {g.kind === 'relic' && g.set && <GameImg path={`game/assets/gear/sets/${g.set}.webp`} alt={t(SET_LABEL, g.set)} className="set-badge" />}
    <span className="gear-level">+{g.level}</span>
    <span className="gear-rank">{g.rank}★</span>
  </Tag>
}
export function EmptySlot({ slot, size = 'md' }: { slot: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`gear-icon empty ${size}`} title={`${t(SLOT_LABEL, slot)} vacío`}>
    <GameImg path={`game/assets/gear/slots/${slot}.webp`} alt={t(SLOT_LABEL, slot)} className="gear-img" />
  </span>
}
export function SetIcon({ set, className = 'mini-icon' }: { set: string; className?: string }) {
  return <GameImg path={`game/assets/gear/sets/${set}.webp`} alt={t(SET_LABEL, set)} className={className} />
}
export function StatIcon({ stat, className = 'stat-icon' }: { stat: string; className?: string }) {
  const known = ['resistance', 'attack', 'manaGeneration', 'skillRecovery', 'comboSpeed', 'instinct', 'runSpeed', 'criticalRate', 'accuracy', 'skillSpeed', 'criticalDamage', 'defense', 'health']
  return known.includes(stat) ? <GameImg path={`game/assets/gear/stats/${stat}.webp`} alt="" className={className} /> : <span className={className} />
}
