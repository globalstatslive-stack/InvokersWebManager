/** Trofeos que tiene el jugador y de dónde salen. La caja compartida no los publica; Nexo los toma de:
 * - la carpeta del juego (PlayerModel.dat, exacto a la hora en que el juego guardó la caja),
 * - una captura de la Sala de trofeos (leída en este navegador y confirmada por el jugador),
 * - o lo que escriba el jugador.
 * Se usa el dato más reciente. Lo leído o escrito se guarda en este navegador, por perfil. */
import { useMemo, useState } from 'react'
import type { ImportRecord } from '../data'
import { OFFICIAL_COSTS, type HallCosts, type Trophy, type Wallet } from '../box/trophyHall'

export type WalletSource = 'carpeta' | 'captura' | 'manual'
export type WalletData = Wallet & { coins: number | null; coinsApprox?: boolean; at: string | null; source: WalletSource }

const key = (name: string) => `nexo.trophies.${name}`
const COSTS_KEY = 'nexo.hall.costs'
const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null } catch { return null } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }
const n = (x: unknown) => { const v = typeof x === 'number' ? x : Number(String(x ?? '').replace(/\D/g, '')); return Number.isFinite(v) && v >= 0 ? Math.round(v) : 0 }

/** Lo guardado en este navegador (también el formato de la 0.20: tres textos sin fecha). */
export function savedWallet(name: string): WalletData | null {
  const v = read<Record<string, unknown>>(key(name))
  if (!v || (v.bronze === '' && v.silver === '' && v.gold === '')) return null
  return { bronze: n(v.bronze), silver: n(v.silver), gold: n(v.gold), coins: v.coins == null || v.coins === '' ? null : n(v.coins), coinsApprox: !!v.coinsApprox,
    at: typeof v.at === 'string' ? v.at : null, source: v.source === 'captura' ? 'captura' : 'manual' }
}

/** Hora en que el juego guardó un archivo de la importación (o la de la importación, si no se conoce). */
export function fileTime(r: ImportRecord, name: string): string {
  const f = r.files.find(x => x.name.toLowerCase() === name.toLowerCase())?.blob as (Blob & { lastModified?: number }) | undefined
  return f?.lastModified ? new Date(f.lastModified).toISOString() : r.importedAt
}

/** Trofeos de la importación de carpeta más reciente de este perfil, con la hora en que el juego guardó el archivo. */
export function folderWallet(records: ImportRecord[], name: string): WalletData | null {
  const withTrophies = records.filter(r => r.collection?.trophies && (r.collection.player?.name ?? r.summary?.name ?? name) === name)
  const at = (r: ImportRecord) => fileTime(r, 'PlayerModel.dat')
  const latest = withTrophies.map(r => ({ r, at: at(r) })).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (!latest) return null
  const t = latest.r.collection!.trophies!
  return { bronze: t.bronze, silver: t.silver, gold: t.gold, coins: t.arenaCoins, at: latest.at, source: 'carpeta' }
}

/** El dato más reciente entre carpeta y lo guardado (sin fecha cuenta como antiguo). */
export function pickWallet(folder: WalletData | null, saved: WalletData | null): WalletData | null {
  if (!folder) return saved
  if (!saved) return folder
  return (saved.at ?? '') >= (folder.at ?? '') ? saved : folder
}

export function useTrophyWallet(name: string, records: ImportRecord[]) {
  const [saved, setSaved] = useState(() => savedWallet(name))
  const folder = useMemo(() => folderWallet(records, name), [records, name])
  const wallet = pickWallet(folder, saved)
  const save = (w: Omit<WalletData, 'at'>) => {
    const next = { ...w, at: new Date().toISOString() }
    write(key(name), next); setSaved(next)
  }
  return { wallet, folder, saved, save }
}

/** Costes por nivel: el oficial (nivel 1) y los que apunta el jugador al verlos en el juego. */
export function useHallCosts() {
  const [mine, setMine] = useState<HallCosts>(() => read<HallCosts>(COSTS_KEY) ?? {})
  const costs: HallCosts = { ...mine, ...OFFICIAL_COSTS }
  const setCost = (level: number, value: number | null) => {
    const next = { ...mine }
    if (value && value > 0) next[level] = Math.min(99999, Math.round(value)); else delete next[level]
    write(COSTS_KEY, next); setMine(next)
  }
  return { costs, mine, setCost }
}

export const TROPHY_ES: Record<Trophy, string> = { bronze: 'bronce', silver: 'plata', gold: 'oro' }
export const TROPHY_PL: Record<Trophy, string> = { bronze: 'bronces', silver: 'platas', gold: 'oros' }
