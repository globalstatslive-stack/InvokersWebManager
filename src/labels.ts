import type { Bonus, Equipment } from './memorypack'

export const RELIC_SLOTS: Record<number, string> = { 1: 'Arma', 2: 'Escudo', 3: 'Casco', 4: 'Hombreras', 5: 'Guantes', 6: 'Peto', 7: 'Cinturón', 8: 'Botas' }
export const ACCESSORY_SLOTS: Record<number, string> = { 1: 'Amuleto', 2: 'Pendientes', 3: 'Estandarte', 4: 'Talismán', 5: 'Frascos' }
export const RARITIES: Record<number, string> = { 1: 'Común', 2: 'Poco común', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' }
export const SETS: Record<number, string> = {
  1: 'Tolerancia a aplastamiento', 2: 'Tolerancia a choque de maná', 3: 'Tolerancia a escarcha',
  4: 'Tolerancia a aturdimiento', 5: 'Tolerancia a parálisis', 6: 'Tolerancia a pesadilla',
  7: 'Tolerancia a niebla mental', 8: 'Tolerancia a fatiga', 9: 'Tolerancia a plaga',
  10: 'Tolerancia a quemadura de maná', 11: 'Tolerancia a atrofia', 12: 'Tolerancia a putrefacción',
  101: 'Ataque', 102: 'Defensa', 103: 'Vida', 104: 'Prob. crítico', 105: 'Daño crítico',
  106: 'Precisión', 107: 'Resistencia', 108: 'Instinto', 109: 'Maná', 110: 'Vel. habilidad',
  111: 'Recuperación', 112: 'Robo de vida', 113: 'Ignorar defensa', 114: 'Apoyo',
  115: 'Reducir mejoras', 117: 'Evento 2', 118: 'Jefe de clan 1',
}
export const FACTIONS: Record<number, string> = { 1: 'Eldrinos', 2: 'Magos', 3: 'Petrocordis', 5: 'Libertarios', 6: 'Bestiales', 7: 'Nocturnos', 9: 'Férreos', 11: 'Cambiones', 12: 'Luminarios' }
export const STATS: Record<number, string> = {
  1: 'Ataque', 2: 'Defensa', 3: 'Vida', 4: 'Ataque %', 5: 'Defensa %', 6: 'Vida %',
  7: 'Prob. crítico', 8: 'Daño crítico', 9: 'Precisión', 10: 'Resistencia',
  11: 'Vel. movimiento', 12: 'Vel. combo', 13: 'Vel. habilidad',
  14: 'Recuperación', 15: 'Generación de maná', 16: 'Instinto',
}
export const rankLabel = (rank: number) => `${rank}★`
export const slotLabel = (gear: Equipment) => (gear.kind === 'relic' ? RELIC_SLOTS : ACCESSORY_SLOTS)[gear.slot] ?? `Ranura ${gear.slot}`
export const groupLabel = (gear: Equipment) => gear.kind === 'relic' ? SETS[gear.setOrFaction] ?? `Conjunto ${gear.setOrFaction}` : FACTIONS[gear.setOrFaction] ?? `Facción ${gear.setOrFaction}`
export function bonusLabel(bonus: Bonus): string {
  const percent = bonus.stat >= 4 && bonus.stat <= 8
  const value = percent ? bonus.value * 100 : bonus.value
  return `${STATS[bonus.stat] ?? `Estadística ${bonus.stat}`} +${new Intl.NumberFormat('es-ES', { maximumFractionDigits: percent ? 2 : 1 }).format(value)}${percent ? ' %' : ''}`
}
