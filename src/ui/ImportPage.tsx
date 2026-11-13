import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, ClipboardPaste, Copy, Download, FolderOpen, Loader2, Monitor, RefreshCw, Server, ShieldCheck, Smartphone, Upload } from 'lucide-react'
import { useAccount } from './account'
import { MarkletInstall } from './Marklet'

import { sharedBoxUrl } from '../officialImport'
import { droppedFiles, folderPreference, fromInput, readFolder, selectSnapshots, type FolderPreference, type ReadDirectory } from '../folderSync'

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } },
}
export const LINK_KEY = 'nexo.link', PROXY_KEY = 'nexo.proxy'
/** Proxy de Nexo (proxy/cloudflare-worker.js en Cloudflare Workers): con él, el enlace se importa con un toque. */
export const DEFAULT_PROXY = 'https://nexo-proxy.globalstatslive.workers.dev'
export const proxyUrl = () => store.get(PROXY_KEY).trim() || DEFAULT_PROXY
export const slugOf = (link: string) => sharedBoxUrl(link).searchParams.get('b')!
export const apiUrl = (slug: string) => `https://invokers.com/api/lamb/${encodeURIComponent(slug)}`

/** Descarga la caja mediante el proxy configurado o, si el portal lo permite, directamente. */
export async function fetchBox(link: string): Promise<File> {
  const slug = slugOf(link), proxy = proxyUrl()
  const url = proxy ? (proxy.includes('{slug}') ? proxy.replace('{slug}', encodeURIComponent(slug)) : `${proxy.replace(/\/$/, '')}/?b=${encodeURIComponent(slug)}`) : apiUrl(slug)
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw Error(res.status === 404 ? 'El enlace no existe o ha caducado. Pulsa «Refresh link» en el portal.' : `El servidor respondió ${res.status}.`)
  const text = await res.text()
  if (text.length > 20 * 1024 * 1024) throw Error('La caja supera 20 MiB.')
  return new File([text], `caja-${slug}.json`, { type: 'application/json' })
}

export { bookmarklet } from './Marklet'

type Os = 'windows' | 'mac'
const PATHS: Record<Os, string> = {
  windows: '%USERPROFILE%\\AppData\\LocalLow\\Hit_Zone\\Invokers',
  mac: '~/Library/Application Support/Hit_Zone/Invokers',
}
const pickerApi = () => (window as unknown as { showDirectoryPicker?: (o: { mode: 'read'; id?: string; startIn?: string }) => Promise<ReadDirectory> }).showDirectoryPicker

export function ImportPage({ receiving }: { receiving?: boolean }) {
  const { importFiles, account } = useAccount()
  const [method, setMethod] = useState<'file' | 'link'>('link')
  const [os, setOs] = useState<Os>(() => /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows')
  const [link, setLink] = useState(() => store.get(LINK_KEY))
  const [proxy, setProxy] = useState(() => store.get(PROXY_KEY))
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [needsHelp, setNeedsHelp] = useState(false)
  const [copied, setCopied] = useState(false), [dragging, setDragging] = useState(false)
  const [pref, setPref] = useState<FolderPreference>()
  const folderInput = useRef<HTMLInputElement>(null), jsonInput = useRef<HTMLInputElement>(null)
  useEffect(() => { void folderPreference().then(setPref).catch(() => undefined) }, [])
  let slug = ''
  try { slug = link.trim() ? slugOf(link) : '' } catch { slug = '' }

  async function run(task: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('')
    try { await task() } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const remember = async (handle: ReadDirectory) => { const p = { handle, auto: pref?.auto ?? false }; await folderPreference(p).catch(() => undefined); setPref(p) }
  const chooseFolder = () => run(async () => {
    const picker = pickerApi()
    if (!picker) { folderInput.current?.click(); return }
    const handle = await picker({ mode: 'read', id: 'invokers' })
    await remember(handle)
    await importFiles(await readFolder({ handle, auto: false }, true))
  })
  const refreshFolder = () => pref && run(async () => importFiles(await readFolder(pref, true)))
  const onFolderInput = (list: FileList | null) => { if (list?.length) { const files = Array.from(list); void run(async () => importFiles(selectSnapshots(fromInput(files)))) } }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) { void run(() => importFiles(files)); return }
    const items = e.dataTransfer.items
    void run(async () => { const { files, handle } = await droppedFiles(items); if (handle) await remember(handle); await importFiles(files) })
  }
  const fromLink = () => run(async () => {
    store.set(LINK_KEY, link.trim())
    try { await importFiles([await fetchBox(link)]) }
    catch (e) {
      if (e instanceof TypeError) { setNeedsHelp(true); throw Error(proxyUrl() ? 'No se pudo contactar con el proxy. Revisa su dirección en «Avanzado».' : 'El portal oficial no deja leer la caja desde otras webs. Termina con una de las dos opciones de abajo: solo lleva unos segundos.') }
      throw e
    }
  })
  const fromPaste = () => run(async () => {
    const text = paste.trim()
    if (!text.startsWith('{')) throw Error('Pega el contenido completo que empieza por «{».')
    await importFiles([new File([text], 'caja-pegada.json', { type: 'application/json' })]); setPaste('')
  })
  const copy = async (text: string, done?: () => void) => { try { await navigator.clipboard.writeText(text); done?.() } catch { setError('No se pudo copiar. Selecciona el texto y cópialo a mano.') } }

  return <div className="import">
    <header className="goal-head import-head">
      <Download size={20} aria-hidden /><div><h1>{receiving ? 'Recibiendo tu caja…' : 'Importar tu caja'}</h1>
      <p>{receiving ? 'Esta pestaña espera los datos de invokers.com.' : 'Pega el enlace de tu caja compartida de invokers.com. En ordenador también puedes leer la carpeta del juego.'}</p></div>
    </header>
    {receiving && <div className="note"><Loader2 className="spin" size={16} /> Esperando datos de invokers.com…</div>}
    {error && <div className="note warn" role="alert">{error}</div>}
    {status && <div className="note ok" role="status">{status}</div>}

    <div className="method-tabs" role="tablist" aria-label="Forma de importar">
      <button role="tab" aria-selected={method === 'link'} className={method === 'link' ? 'on' : ''} onClick={() => setMethod('link')}>
        <Smartphone size={22} /><span><b>Con tu enlace</b><small>Móvil y ordenador · recomendado</small></span>
      </button>
      <button role="tab" aria-selected={method === 'file'} className={method === 'file' ? 'on' : ''} onClick={() => setMethod('file')}>
        <Monitor size={22} /><span><b>Carpeta del juego</b><small>PC y Mac · sin estadísticas base</small></span>
      </button>
    </div>

    {method === 'file' ? <div className="import-grid">
      <section className="panel steps">
        <h2>¿Cómo importar?</h2>
        <ol>
          <li>Abre tu caja en el juego y espera unos segundos: el juego guarda los archivos solo. Puedes dejarlo abierto.</li>
          <li>
            <span>Copia la ruta de la carpeta del juego:</span>
            <div className="os-switch" role="group" aria-label="Sistema"><button className={os === 'windows' ? 'on' : ''} onClick={() => setOs('windows')}>Windows</button><button className={os === 'mac' ? 'on' : ''} onClick={() => setOs('mac')}>Mac</button></div>
            <div className="path-row"><code>{PATHS[os]}</code><button className="btn small" onClick={() => copy(PATHS[os], () => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}>{copied ? <><Check size={15} /> ¡Copiada!</> : <><Copy size={15} /> Copiar</>}</button></div>
          </li>
          <li>{os === 'windows' ? <>Pulsa <b>Importar mi caja</b>, pega la ruta en la barra de direcciones del selector y pulsa <kbd>Intro</kbd>.</> : <>Pulsa <b>Importar mi caja</b>, pulsa <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd>, pega la ruta y pulsa <kbd>Intro</kbd>.</>}</li>
          <li>Selecciona la carpeta <b>Invokers</b> y confirma. ¡Listo! La próxima vez basta con <b>Actualizar</b>.</li>
        </ol>
      </section>
      <section className={`panel dropzone ${dragging ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <div className="drop-inner">
          <Upload size={30} />
          <button className="btn primary big" disabled={busy} onClick={chooseFolder}>{busy ? <Loader2 className="spin" size={18} /> : <FolderOpen size={18} />} Importar mi caja</button>
          <p>Sigue los pasos para elegir la carpeta correcta. También puedes <b>arrastrar aquí</b> la carpeta del juego o sus archivos.</p>
          {pref && <div className="remembered">
            <span><FolderOpen size={15} /> Carpeta recordada: <b>{pref.handle.name}</b></span>
            <button className="btn small" disabled={busy} onClick={refreshFolder}><RefreshCw size={15} /> Actualizar ahora</button>
            <label className="check"><input type="checkbox" checked={pref.auto} onChange={e => { const p = { ...pref, auto: e.target.checked }; setPref(p); void folderPreference(p) }} /> Actualizar al abrir Nexo</label>
          </div>}
        </div>
      </section>
      <p className="fine wide">La carpeta del juego da tus Invokers, Titanes y piezas. Para el <b>optimizador</b> (con estadísticas calculadas con la fórmula verificada) y los registros de combate, importa también tu enlace: aporta las estadísticas base que publica el portal.</p>
    </div> :

    <div className="import-grid single">
      <section className="panel steps">
        <h2>Pega el enlace de tu caja</h2>
        <div className="link-row">
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://invokers.com/lamb/?b=…" spellCheck={false} autoComplete="off" aria-label="Enlace de caja compartida" />
          <button className="btn primary" disabled={!slug || busy} onClick={fromLink}>{busy ? <Loader2 className="spin" size={17} /> : <Download size={17} />} Importar</button>
        </div>
        {link.trim() && !slug && <small className="warn-text">El enlace debe tener la forma https://invokers.com/lamb/?b=…</small>}
        <ol>
          <li>Abre <a href="https://invokers.com/hub/box/invokers/" target="_blank" rel="noreferrer">tu caja en invokers.com <ArrowUpRight size={12} /></a> e inicia sesión.</li>
          <li>Activa «compartir» y pulsa <b>Refresh link</b> para una instantánea nueva.</li>
          <li>Copia el enlace, pégalo arriba y pulsa <b>Importar</b>. Lo recordamos para la próxima vez.</li>
        </ol>
        <div className="snapshot-info">
          <b>El enlace es una instantánea, no una sincronización.</b>
          <p>Refleja tu caja tal como estaba cuando creaste el enlace o pulsaste «Refresh link». Lo que cambies después en el juego no aparece hasta que pulses «Refresh link» en invokers.com y vuelvas a importar. Cada enlace dura una semana; «Refresh» lo actualiza y lo renueva otra semana.</p>
          {account?.box.snapshotAt && <p>Tu caja actual es del <b>{new Date(account.box.snapshotAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</b>{account.box.expiresAt ? <> · el enlace caduca el <b>{new Date(account.box.expiresAt).toLocaleDateString('es-ES')}</b></> : null}.</p>}
        </div>
      </section>
      <details className="other-ways" open={needsHelp || !proxyUrl()}>
      <summary>¿No funciona el enlace? Otras formas de importar</summary>
      <div className={`import-methods ${needsHelp ? 'highlight' : ''}`}>
        <section className="panel method">
          <h3><ClipboardPaste size={18} /> Copiar y pegar</h3>
          <ol className="mini">
            <li><a className={`btn small ${slug ? '' : 'disabled'}`} href={slug ? apiUrl(slug) : undefined} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> Abrir datos de mi caja</a></li>
            <li>Mantén pulsado el texto → <b>Seleccionar todo</b> → <b>Copiar</b>.</li>
            <li>Vuelve aquí, pega y pulsa <b>Importar texto</b>.</li>
          </ol>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder='{"owner":false,"profile":…}' rows={3} aria-label="Datos de la caja" />
          <button className="btn primary" disabled={!paste.trim() || busy} onClick={fromPaste}>Importar texto</button>
        </section>
        <section className="panel method">
          <h3><Bookmark size={18} /> Marcador mágico</h3>
          <p>Se configura una vez. Úsalo en <b>tu caja de invokers.com</b> (con la sesión iniciada) para enviar tu caja <b>en vivo</b>, con el poder actual y sin pulsar «Refresh link». También funciona sobre un enlace compartido.</p>
          <MarkletInstall label="⚡ Nexo" onStatus={setStatus} />
          <p className="fine">El mismo marcador guarda en invokers.com el plan que envías desde <b>Plan</b>.</p>
        </section>
      </div>
      </details>
      <p className="fine wide"><b>El enlace compartido es una copia congelada</b>: solo cambia cuando pulsas «Refresh link» en el portal. Para tener siempre los datos actuales, usa la <a href="./nexo-extension.zip" download>extensión de Nexo</a> o el marcador sobre tu caja del portal.</p>
      <p className="fine wide">¿Tienes el JSON de la caja guardado? <button className="link" onClick={() => jsonInput.current?.click()}>Impórtalo desde un archivo</button>.</p>
      <details className="panel advanced">
        <summary><Server size={16} /> Avanzado: usar otro proxy</summary>
        <p>Nexo usa su propio proxy (<code>proxy/cloudflare-worker.js</code>), que solo reenvía cajas públicas de invokers.com y no guarda nada. Si despliegas el tuyo, guarda aquí su dirección; vacío usa el de Nexo.</p>
        <div className="link-row">
          <input value={proxy} onChange={e => setProxy(e.target.value)} placeholder="https://nexo-proxy.tu-cuenta.workers.dev" spellCheck={false} aria-label="URL del proxy" />
          <button className="btn" onClick={() => { store.set(PROXY_KEY, proxy.trim()); setStatus(proxy.trim() ? 'Proxy guardado en este navegador.' : 'Proxy desactivado.') }}>Guardar</button>
        </div>
      </details>
    </div>}

    <section className="grid-2 trust">
      <div className="panel"><h3 className="sub"><ShieldCheck size={15} /> Qué pasa con tus datos</h3><ul className="ticks">
        <li>Con el enlace, el proxy de Nexo (un Cloudflare Worker) descarga tu caja pública de invokers.com y te la entrega: <b>procesa la caja en tránsito</b>. Su código no la guarda, pero Cloudflare, como cualquier servicio web, puede registrar datos técnicos de la petición, como la dirección del enlace.</li>
        <li>Después, la caja se guarda <b>solo en este navegador</b> (hasta cinco importaciones). Puedes borrarla en Historial.</li>
        <li>La carpeta del juego se lee en tu navegador y no pasa por ningún servidor.</li>
      </ul></div>
      <div className="panel"><h3 className="sub">Lo que no hace</h3><ul className="dashes">
        <li>No pide tu contraseña ni tu sesión del juego.</li>
        <li>No escribe nada en el juego ni en su carpeta.</li>
        <li>Si una actualización falla, conserva tu última caja válida.</li>
      </ul></div>
    </section>
    <input ref={folderInput} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={e => { onFolderInput(e.target.files); e.target.value = '' }} />
    <input ref={jsonInput} type="file" hidden accept=".json,application/json" onChange={e => { const f = e.target.files; if (f?.length) { const files = Array.from(f); void run(() => importFiles(files)) } e.target.value = '' }} />
  </div>
}
