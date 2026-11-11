import { createContext, useContext } from 'react'
import type { ImportRecord } from '../data'
import { boxFromCollection, parseOfficialBox, type Box } from '../box/model'
import { mergeWithOfficial } from '../box/merge'
import { BoxIndex } from '../box/stats'

export type Account = { record: ImportRecord; box: Box; index: BoxIndex }
/** Construye la cuenta de un lote guardado: JSON oficial completo o colección de `.dat`. */
const boxOf = async (record: ImportRecord): Promise<Box | undefined> => {
  if (record.source === 'official-link' && record.files[0]) return parseOfficialBox(JSON.parse(await record.files[0].blob.text()))
  return record.collection ? boxFromCollection(record.collection) : undefined
}
/** Construye la cuenta de un lote guardado. Una importación de la carpeta del juego se combina con
 * la caja oficial más reciente anterior a ella para recuperar estadísticas base, reglas y notas. */
export async function accountFrom(record: ImportRecord | undefined, all: ImportRecord[] = []): Promise<Account | undefined> {
  if (!record) return undefined
  let box = await boxOf(record)
  if (!box) return undefined
  if (record.source !== 'official-link') {
    const official = all.filter(r => r.source === 'official-link' && r.importedAt <= record.importedAt).sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0]
    const officialBox = official ? await boxOf(official).catch(() => undefined) : undefined
    if (officialBox) box = mergeWithOfficial(box, officialBox)
  }
  return { record, box, index: new BoxIndex(box) }
}

export type Ctx = {
  account?: Account
  previous?: Account
  records: ImportRecord[]
  go: (path: string) => void
  /** Interpreta, guarda y abre un lote (JSON de la caja o snapshots `.dat`). */
  importFiles: (files: File[]) => Promise<void>
  reload: () => Promise<void>
}
export const AccountContext = createContext<Ctx>(null as unknown as Ctx)
export const useAccount = () => useContext(AccountContext)
