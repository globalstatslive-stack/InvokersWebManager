import { useState } from 'react'
import type { Equipment } from './memorypack'
import { assetUrl, characterByCode, equipmentImage, setImage } from './catalog'
import { groupLabel, slotLabel } from './labels'

export function GameImage({ path, alt, className = '' }: { path?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | undefined>()
  if (!path || failed === path) return <span className={`missing-game-image ${className}`} role="img" aria-label={`${alt}: imagen no disponible`}>?</span>
  return <img className={className} src={assetUrl(path)} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(path)}/>
}
export function PortraitArt({ code = 'IRN036' }: { code?: string }) {
  const character = characterByCode(code)
  return <GameImage path={character?.portrait} alt={character?.name ?? 'Personaje sin identificar'} className="game-portrait"/>
}
export function EquipmentArt({ item }: { item: Equipment }) {
  const set = setImage(item)
  return <span className={`equipment-art ${item.kind}`}><GameImage path={equipmentImage(item)} alt={slotLabel(item)}/>{set && <GameImage className="set-emblem" path={set} alt={`Conjunto ${groupLabel(item)}`}/>}</span>
}
