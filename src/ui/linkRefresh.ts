/** Actualizar desde el enlace casi sin tocar nada (pensado para Android, sin instalar nada):
 * Nexo abre tu caja en invokers.com, tú pulsas «Refresh link» y vuelves; al volver, Nexo lee el enlace guardado y lo
 * importa solo si la instantánea es más nueva que la última importada (no duplica importaciones iguales).
 *
 * Oficial: el enlace compartido es una instantánea que solo cambia al pulsar «Refresh link» en el portal (que además
 * renueva su plazo de una semana). Nexo no puede pulsarlo por ti: hace falta tu sesión en invokers.com. */
export const PORTAL_BOX = 'https://invokers.com/hub/box/invokers/'
const PENDING_KEY = 'nexo.linkRefresh', SNAPSHOT_KEY = 'nexo.linkSnapshot'
/** Tiempo durante el que, al volver a Nexo, se comprueba el enlace. */
export const REFRESH_WINDOW = 20 * 60 * 1000

export type Pending = { startedAt: number }
const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null } catch { return null } }
const write = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

/** Instantánea de una caja del enlace (texto JSON): `sharing.snapshotAt` o, si no está, `computedAt`. */
export function snapshotOf(json: string): string | null {
  try {
    const r = JSON.parse(json) as { sharing?: { snapshotAt?: unknown }; computedAt?: unknown }
    const s = r?.sharing?.snapshotAt ?? r?.computedAt
    return typeof s === 'string' && Number.isFinite(Date.parse(s)) ? s : null
  } catch { return null }
}
/** ¿`next` es una instantánea posterior a `prev`? Sin anterior conocida, sí. */
export function isNewer(next: string | null, prev: string | null): boolean {
  if (!prev) return true
  if (!next) return false
  return Date.parse(next) > Date.parse(prev)
}

/** Última instantánea del enlace importada en este navegador. */
export const lastLinkSnapshot = () => read<string>(SNAPSHOT_KEY)
export const rememberLinkSnapshot = (s: string | null) => { if (s) write(SNAPSHOT_KEY, s) }

/** Empieza el flujo: lo anota y abre tu caja del portal (debe llamarse desde un toque, o el navegador lo bloquea). */
export function startLinkRefresh(open: (url: string) => void = url => { window.open(url, '_blank') }): void {
  write(PENDING_KEY, { startedAt: Date.now() } satisfies Pending)
  open(PORTAL_BOX)
}
export function pendingRefresh(now = Date.now()): Pending | null {
  const p = read<Pending>(PENDING_KEY)
  if (!p || typeof p.startedAt !== 'number') return null
  if (now - p.startedAt > REFRESH_WINDOW) { write(PENDING_KEY, null); return null }
  return p
}
export const clearRefresh = () => write(PENDING_KEY, null)

/** Hora legible de una instantánea. */
export const snapshotLabel = (s: string | null) => s ? new Date(s).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'desconocida'
