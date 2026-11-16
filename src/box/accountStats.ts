/** Account Stats de invokers.com (`/hub/account-stats/`).
 *
 * La página oficial pide `/api/profile/account-stats` con la sesión del jugador (sin sesión responde 401). Nexo no
 * tiene acceso propio: solo lo recibe cuando el jugador pulsa su marcador (o el botón de la extensión) en
 * invokers.com con su sesión iniciada y su caja en vivo (nunca con un enlace compartido, que puede ser de otra
 * cuenta). La forma de los datos sale del código público de esa página; todo es opcional y se valida al leerlo. */
export type AccountStats = {
  fetchedAt: string
  profileName: string | null
  totalBattles: number | null
  /** Invokers más usados (por combates), con su `configId`. */
  mostUsed: { configId: number | null; name: string; battles: number }[]
  arena: { currentLeague: string | null; highestLeague: string | null; offenseBattles: number | null; defenseBattles: number | null; battlesWon: number | null; lifetimeDefenseWinRate: number | null; weeklyDefenseWinRate: number | null } | null
  bosses: { key: string; name: string; element: string | null; highestStage: number | null; fastestTimeSeconds: number | null; battles: number | null }[]
  spires: { key: string; element: string | null; highestFloor: number | null; floorsCleared: number | null; timesCleared: number | null }[]
  campaign: string | null
}

const obj = (x: unknown): Record<string, unknown> | null => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null
const arr = (x: unknown): unknown[] => Array.isArray(x) ? x.slice(0, 500) : []
const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : null
const s = (x: unknown) => typeof x === 'string' && x.length <= 200 ? x : null

/** Lee la respuesta. Null si no es de un jugador con sesión o no tiene la forma esperada. */
export function parseAccountStats(raw: unknown, fetchedAt = new Date().toISOString()): AccountStats | null {
  const r = obj(raw)
  if (!r || r.authenticated === false) return null
  const g = obj(r.general), b = obj(r.battles)
  if (!g && !b) return null
  const arena = obj(b?.arena)
  return {
    fetchedAt, profileName: s(g?.profileName), totalBattles: n(g?.totalBattles) ?? n(b?.totalBattles),
    mostUsed: arr(g?.mostUsedInvokers).map(obj).filter((x): x is Record<string, unknown> => !!x && !!s(x.name))
      .map(x => ({ configId: n(x.configId), name: s(x.name)!, battles: n(x.battles) ?? 0 })),
    arena: arena ? {
      currentLeague: s(arena.currentLeague), highestLeague: s(arena.highestLeague) ?? s(g?.highestArenaLeague),
      offenseBattles: n(arena.offenseBattles), defenseBattles: n(arena.defenseBattles), battlesWon: n(g?.arenaBattlesWon),
      lifetimeDefenseWinRate: n(arena.lifetimeDefenseWinRate), weeklyDefenseWinRate: n(arena.weeklyDefenseWinRate),
    } : null,
    bosses: arr(b?.bosses).map(obj).filter((x): x is Record<string, unknown> => !!x && !!s(x.key))
      .map(x => ({ key: s(x.key)!, name: s(x.name) ?? s(x.key)!, element: s(x.element), highestStage: n(x.highestStage), fastestTimeSeconds: n(x.fastestTimeSeconds), battles: n(x.battles) })),
    spires: arr(b?.spires).map(obj).filter((x): x is Record<string, unknown> => !!x && !!s(x.key))
      .map(x => ({ key: s(x.key)!, element: s(x.element), highestFloor: n(x.highestFloor), floorsCleared: n(x.floorsCleared), timesCleared: n(x.timesCleared) })),
    campaign: s(g?.campaignProgress),
  }
}

/** Diferencias de arena y combates entre dos lecturas de Account Stats. */
export function accountStatsDelta(a: AccountStats, b: AccountStats) {
  const d = (x: number | null | undefined, y: number | null | undefined) => x != null && y != null ? y - x : null
  return {
    totalBattles: d(a.totalBattles, b.totalBattles),
    arenaWon: d(a.arena?.battlesWon, b.arena?.battlesWon),
    offense: d(a.arena?.offenseBattles, b.arena?.offenseBattles),
    defense: d(a.arena?.defenseBattles, b.arena?.defenseBattles),
    league: a.arena?.currentLeague !== b.arena?.currentLeague ? { from: a.arena?.currentLeague ?? null, to: b.arena?.currentLeague ?? null } : null,
    defenseRate: d(a.arena?.lifetimeDefenseWinRate, b.arena?.lifetimeDefenseWinRate),
  }
}
