export type ReadDirectory = FileSystemDirectoryHandle & {queryPermission:(o:{mode:'read'})=>Promise<PermissionState>;requestPermission:(o:{mode:'read'})=>Promise<PermissionState>;values:()=>AsyncIterableIterator<FileSystemHandle>}
export type FolderPreference = {handle:ReadDirectory; auto:boolean}
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('nexo-folder-permission',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function folderPreference(value?:FolderPreference|null):Promise<FolderPreference|undefined>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),store=tx.objectStore('settings');const r=value===undefined?store.get('folder'):value===null?store.delete('folder'):store.put(value,'folder');let result:FolderPreference|undefined;r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(value===undefined?result:value??undefined);tx.onerror=()=>reject(tx.error)})}finally{db.close()}}

/** Archivo encontrado con la carpeta que lo contiene (para preferir `aggregate_snapshots`). */
export type FoundFile = { file: File; dir: string }
const SNAPSHOT = /^Player\w*Model\.dat$/i
/** Elige los snapshots del juego entre los archivos de la carpeta seleccionada.
 * Prefiere los de `aggregate_snapshots`, se queda con los `Player…Model.dat` y descarta duplicados. */
export function selectSnapshots(found: FoundFile[]): File[] {
  const dat = found.filter(f => f.file.name.toLowerCase().endsWith('.dat'))
  const inSnapshots = dat.filter(f => f.dir.toLowerCase() === 'aggregate_snapshots')
  const pool = (inSnapshots.length ? inSnapshots : dat)
  const models = pool.filter(f => SNAPSHOT.test(f.file.name))
  const chosen = models.length ? models : pool
  const seen = new Set<string>(), out: File[] = []
  for (const { file } of chosen) { const k = file.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(file) } }
  if (!out.length) throw Error('No se encontraron los archivos de tu caja en esa carpeta. Abre tu caja en el juego, espera unos segundos y elige la carpeta Invokers.')
  return out
}
/** Archivos de un selector `webkitdirectory` (con ruta relativa). */
export function fromInput(files: File[]): FoundFile[] {
  return files.map(file => { const parts = (file.webkitRelativePath || file.name).split('/'); return { file, dir: parts.length > 1 ? parts[parts.length - 2] : '' } })
}
export async function folderFiles(handle:ReadDirectory):Promise<File[]>{
  const found:FoundFile[]=[];let seen=0
  async function visit(dir:ReadDirectory,depth:number){for await(const entry of dir.values()){if(++seen>5000)throw Error('La carpeta tiene demasiados archivos. Elige la carpeta Invokers del juego.');if(entry.kind==='file'&&entry.name.toLowerCase().endsWith('.dat'))found.push({file:await(entry as FileSystemFileHandle).getFile(),dir:dir.name});else if(entry.kind==='directory'&&depth<4)await visit(entry as ReadDirectory,depth+1)}}
  await visit(handle,0)
  return selectSnapshots(found)
}
/** Lee una carpeta arrastrada (API de entradas del navegador). */
export async function droppedFiles(items: DataTransferItemList): Promise<{ files: File[]; handle?: ReadDirectory }> {
  const list = Array.from(items).filter(i => i.kind === 'file')
  const withHandle = list[0] as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }
  if (list.length === 1 && withHandle.getAsFileSystemHandle) {
    const handle = await withHandle.getAsFileSystemHandle()
    if (handle?.kind === 'directory') return { files: await folderFiles(handle as ReadDirectory), handle: handle as ReadDirectory }
  }
  const found: FoundFile[] = []
  const walk = async (entry: FileSystemEntry, depth: number, dir: string): Promise<void> => {
    if (entry.isFile) { const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)); found.push({ file, dir }); return }
    if (!entry.isDirectory || depth > 4) return
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
      if (!batch.length) break
      for (const child of batch) await walk(child, depth + 1, entry.name)
    }
  }
  for (const item of list) { const entry = item.webkitGetAsEntry(); if (entry) await walk(entry, 0, '') }
  return { files: selectSnapshots(found) }
}
export async function readFolder(pref:FolderPreference,request:boolean){let permission=await pref.handle.queryPermission({mode:'read'});if(permission!=='granted'&&request)permission=await pref.handle.requestPermission({mode:'read'});if(permission!=='granted')throw Error('Autoriza de nuevo la lectura de la carpeta para actualizar.');return folderFiles(pref.handle)}
