export const REQUIRED_NAMES = [
  'PlayerHeroesModel.dat',
  'PlayerAnimasModel.dat',
  'PlayerRelicsModel.dat',
  'PlayerAccessoriesModel.dat',
] as const

export type StoredFile = {
  name: string
  size: number
  digest: string
  sample: string
  formatHint: string
  blob: Blob
}
export type ImportRecord = {
  id: string
  importedAt: string
  files: StoredFile[]
  missing: string[]
}
export type FileChange = { name: string; kind: 'nuevo' | 'cambiado' | 'eliminado' | 'igual' }
const DB_NAME = 'invokers-web-manager'
const STORE = 'imports'
const INBOX = 'share-inbox'
const MAX_FILE = 100 * 1024 * 1024
const MAX_BATCH = 250 * 1024 * 1024

export function inspectHeader(bytes: Uint8Array): { sample: string; formatHint: string } {
  const head = bytes.slice(0, 24)
  const sample = Array.from(head, b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()
  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) return { sample, formatHint: 'Contenedor GZIP identificado; contenido sin interpretar' }
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return { sample, formatHint: 'Contenedor ZIP identificado; contenido sin interpretar' }
  if (head.length >= 16 && new TextDecoder().decode(head.slice(0, 16)) === 'SQLite format 3\0') return { sample, formatHint: 'SQLite identificado; esquema sin interpretar' }
  return { sample, formatHint: 'Formato sin identificar' }
}

export function missingNames(names: string[]): string[] {
  const set = new Set(names.map(name => name.toLowerCase()))
  return REQUIRED_NAMES.filter(name => !set.has(name.toLowerCase()))
}
export function diffFiles(current: ImportRecord, previous?: ImportRecord): FileChange[] {
  if (!previous) return current.files.map(file => ({ name: file.name, kind: 'nuevo' }))
  const before = new Map(previous.files.map(file => [file.name.toLowerCase(), file.digest]))
  const now = new Map(current.files.map(file => [file.name.toLowerCase(), file.digest]))
  return [
    ...current.files.map(file => ({ name: file.name, kind: !before.has(file.name.toLowerCase()) ? 'nuevo' : before.get(file.name.toLowerCase()) === file.digest ? 'igual' : 'cambiado' }) as FileChange),
    ...previous.files.filter(file => !now.has(file.name.toLowerCase())).map(file => ({ name: file.name, kind: 'eliminado' }) as FileChange),
  ]
}

export async function prepareFiles(files: File[]): Promise<ImportRecord> {
  if (!files.length) throw new Error('Selecciona al menos un archivo .dat.')
  const dat = files.filter(file => file.name.toLowerCase().endsWith('.dat'))
  if (dat.length !== files.length) throw new Error('La selección contiene archivos que no terminan en .dat. Selecciona solo los snapshots de Invokers.')
  if (new Set(dat.map(file => file.name.toLowerCase())).size !== dat.length) throw new Error('Hay nombres de archivo repetidos. Selecciona una sola carpeta de snapshots.')
  if (dat.some(file => file.size > MAX_FILE) || dat.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH) throw new Error('Los archivos superan el límite de lectura local (100 MiB por archivo, 250 MiB por lote).')
  const stored: StoredFile[] = []
  for (const file of dat.sort((a, b) => a.name.localeCompare(b.name))) {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const hash = await crypto.subtle.digest('SHA-256', buffer)
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
    stored.push({ name: file.name, size: file.size, digest, ...inspectHeader(bytes), blob: file })
  }
  return { id: crypto.randomUUID(), importedAt: new Date().toISOString(), files: stored, missing: missingNames(stored.map(file => file.name)) }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(INBOX)) database.createObjectStore(INBOX, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function listImports(): Promise<ImportRecord[]> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).getAll()
      request.onsuccess = () => resolve((request.result as ImportRecord[]).sort((a, b) => b.importedAt.localeCompare(a.importedAt)))
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export async function saveImport(record: ImportRecord): Promise<void> {
  const previous = await listImports()
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put(record)
      for (const old of previous.slice(4)) store.delete(old.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
export async function clearImports(): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

export type SharedBatch = { id: 'latest'; files: File[]; receivedAt: string }
export async function readSharedFiles(): Promise<SharedBatch | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(INBOX, 'readonly')
      const request = tx.objectStore(INBOX).get('latest')
      request.onsuccess = () => resolve(request.result as SharedBatch | undefined)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
export async function clearSharedFiles(receivedAt: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(INBOX, 'readwrite')
      const store = tx.objectStore(INBOX)
      const request = store.get('latest')
      request.onsuccess = () => {
        if ((request.result as SharedBatch | undefined)?.receivedAt === receivedAt) store.delete('latest')
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
