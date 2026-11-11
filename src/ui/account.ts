import { createContext, useContext } from 'react'
import type { ImportRecord } from '../data'
import { boxFromCollection, parseOfficialBox, type Box } from '../box/model'
import { BoxIndex } from '../box/stats'

export type Account = { record: ImportRecord; box: Box; index: BoxIndex }
/** Construye la cuenta de un lote guardado: JSON oficial completo o colección de `.dat`. */
export async function accountFrom(record: ImportRecord | undefined): Promise<Account | undefined> {
  if (!record) return undefined
  let box: Box | undefined
  if (record.source === 'official-link' && record.files[0]) box = parseOfficialBox(JSON.parse(await record.files[0].blob.text()))
  else if (record.collection) box = boxFromCollection(record.collection)
  return box ? { record, box, index: new BoxIndex(box) } : undefined
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
