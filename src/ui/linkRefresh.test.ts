import { beforeEach, describe, expect, it } from 'vitest'
import { clearRefresh, isNewer, lastLinkSnapshot, pendingRefresh, PORTAL_BOX, REFRESH_WINDOW, rememberLinkSnapshot, snapshotOf, startLinkRefresh } from './linkRefresh'

// localStorage mínimo para el entorno de pruebas (node).
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
  getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, String(v)) }, removeItem: k => { mem.delete(k) },
}

describe('actualizar desde el enlace', () => {
  beforeEach(() => mem.clear())
  it('lee la instantánea de la caja (sharing.snapshotAt o computedAt)', () => {
    expect(snapshotOf(JSON.stringify({ sharing: { snapshotAt: '2026-11-20T10:00:00Z' }, computedAt: '2026-11-19T00:00:00Z' }))).toBe('2026-11-20T10:00:00Z')
    expect(snapshotOf(JSON.stringify({ computedAt: '2026-11-19T00:00:00Z' }))).toBe('2026-11-19T00:00:00Z')
    expect(snapshotOf('no es json')).toBeNull()
  })
  it('solo importa si la instantánea es más nueva que la última importada', () => {
    expect(isNewer('2026-11-20T10:00:00Z', '2026-11-19T10:00:00Z')).toBe(true)
    expect(isNewer('2026-11-19T10:00:00Z', '2026-11-19T10:00:00Z')).toBe(false)
    expect(isNewer(null, '2026-11-19T10:00:00Z')).toBe(false)
    expect(isNewer('2026-11-19T10:00:00Z', null)).toBe(true)
    rememberLinkSnapshot('2026-11-19T10:00:00Z')
    expect(lastLinkSnapshot()).toBe('2026-11-19T10:00:00Z')
  })
  it('abre tu caja del portal y queda pendiente hasta importar o caducar', () => {
    let opened = ''
    startLinkRefresh(url => { opened = url })
    expect(opened).toBe(PORTAL_BOX)
    const p = pendingRefresh()!
    expect(p).not.toBeNull()
    expect(pendingRefresh(p.startedAt + REFRESH_WINDOW + 1)).toBeNull()
    startLinkRefresh(() => undefined)
    clearRefresh()
    expect(pendingRefresh()).toBeNull()
  })
})
