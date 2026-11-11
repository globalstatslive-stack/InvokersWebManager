import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, ClipboardPaste, Copy, Download, FileJson, FolderOpen, Link2, Loader2, Server, Smartphone } from 'lucide-react'
import { useAccount } from './account'
import { PageHead } from './common'
import { sharedBoxUrl } from '../officialImport'
import { folderPreference, readFolder, type FolderPreference, type ReadDirectory } from '../folderSync'

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } },
}
export const LINK_KEY = 'nexo.link', PROXY_KEY = 'nexo.proxy'
export const slugOf = (link: string) => sharedBoxUrl(link).searchParams.get('b')!
export const apiUrl = (slug: string) => `https://invokers.com/api/lamb/${encodeURIComponent(slug)}`
const APP = () => `${location.origin}${location.pathname}`

/** Descarga la caja directamente (si el portal lo permite) o mediante el proxy configurado. */
export async function fetchBox(link: string): Promise<File> {
  const slug = slugOf(link), proxy = store.get(PROXY_KEY).trim()
  const url = proxy ? (proxy.includes('{slug}') ? proxy.replace('{slug}', encodeURIComponent(slug)) : `${proxy.replace(/\/$/, '')}/?b=${encodeURIComponent(slug)}`) : apiUrl(slug)
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw Error(res.status === 404 ? 'El enlace no existe o ha caducado. Pulsa «Refresh link» en el portal.' : `El servidor respondió ${res.status}.`)
  const text = await res.text()
  if (text.length > 20 * 1024 * 1024) throw Error('La caja supera 20 MiB.')
  return new File([text], `caja-${slug}.json`, { type: 'application/json' })
}

export function bookmarklet(app: string): string {
  const origin = new URL(app).origin
  const code = `(async()=>{const A=${JSON.stringify(app)},O=${JSON.stringify(origin)};const b=new URLSearchParams(location.search).get('b');if(!/^https:\\/\\/(www\\.)?invokers\\.com$/.test(location.origin)||!b){alert('Nexo: abre tu caja compartida (invokers.com/lamb/?b=…) y vuelve a usar este marcador.');return}const w=window.open(A+'#/recibir','nexo');try{const r=await fetch('/api/lamb/'+encodeURIComponent(b));if(!r.ok)throw Error('HTTP '+r.status);const d=await r.text();if(!w){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d],{type:'application/json'}));a.download='caja-invokers.json';a.click();alert('Nexo: se ha descargado caja-invokers.json. Impórtalo en Nexo.');return}let n=0;const t=setInterval(()=>{if(++n>80)clearInterval(t);w.postMessage({type:'nexo-box',json:d},O)},400);addEventListener('message',e=>{if(e.origin===O&&e.data==='nexo-ack')clearInterval(t)})}catch(e){alert('Nexo: no se pudo leer la caja. '+e.message)}})()`
  return `javascript:${encodeURIComponent(code)}`
}

export function ImportPage({ receiving }: { receiving?: boolean }) {
  const { importFiles, account } = useAccount()
  const [link, setLink] = useState(() => store.get(LINK_KEY))
  const [proxy, setProxy] = useState(() => store.get(PROXY_KEY))
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [fallback, setFallback] = useState(false)
  const [pref, setPref] = useState<FolderPreference>()
  const files = useRef<HTMLInputElement>(null), folder = useRef<HTMLInputElement>(null)
  const marklet = useMemo(() => bookmarklet(APP()), [])
  const linkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => { linkRef.current?.setAttribute('href', marklet) }, [marklet])
  useEffect(() => { void folderPreference().then(setPref).catch(() => undefined) }, [])
  const picker = (window as unknown as { showDirectoryPicker?: (o: { mode: 'read' }) => Promise<ReadDirectory> }).showDirectoryPicker
  let slug = ''
  try { slug = link.trim() ? slugOf(link) : '' } catch { slug = '' }

  async function run(task: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('')
    try { await task() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const fromLink = () => run(async () => {
    store.set(LINK_KEY, link.trim())
    try { await importFiles([await fetchBox(link)]) }
    catch (e) {
      if (e instanceof TypeError) { setFallback(true); throw Error(store.get(PROXY_KEY) ? 'No se pudo contactar con tu proxy. Revisa la dirección en «Avanzado».' : 'El portal oficial no permite la lectura directa desde otras webs. Usa el marcador mágico o copia y pega los datos (abajo). Solo hace falta configurarlo una vez.') }
      throw e
    }
  })
  const fromPaste = () => run(async () => {
    const text = paste.trim()
    if (!text.startsWith('{')) throw Error('Pega el contenido completo que empieza por «{».')
    await importFiles([new File([text], 'caja-pegada.json', { type: 'application/json' })]); setPaste('')
  })
  const fromFiles = (list: FileList | null) => { if (list?.length) { const chosen = Array.from(list); void run(() => importFiles(chosen)) } }
  const chooseFolder = () => run(async () => {
    if (!picker) { folder.current?.click(); return }
    const p = { handle: await picker({ mode: 'read' }), auto: false }
    await folderPreference(p); setPref(p)
    await importFiles(await readFolder(p, true))
  })
  const bridge = () => { try { const url = sharedBoxUrl(link); window.location.href = `intent://import?url=${encodeURIComponent(url.href)}#Intent;scheme=invokersbridge;package=es.invokers.bridge;end` } catch (e) { setError(String(e instanceof Error ? e.message : e)) } }
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setStatus(`${what} copiado.`) } catch { setError('No se pudo copiar. Mantén pulsado el texto para copiarlo.') } }

  return <div className="import">
    <PageHead kicker="Sincronizar" title={receiving ? 'Recibiendo tu caja…' : 'Importar tu cuenta'}>
      {receiving ? 'Esta pestaña espera los datos del marcador. Si no llegan en unos segundos, vuelve a la pestaña de invokers.com.' : 'Usa el enlace de tu caja compartida de invokers.com. Contiene Invokers, Titanes, todo el equipo, tus equipos de combate y las estadísticas exactas.'}
    </PageHead>
    {receiving && <div className="note"><Loader2 className="spin" size={16} /> Esperando datos de invokers.com…</div>}
    {error && <div className="note warn" role="alert">{error}</div>}
    {status && <div className="note ok" role="status">{status}</div>}

    <section className="panel import-main">
      <h2><Link2 size={19} /> Enlace de tu caja</h2>
      <div className="link-row">
        <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://invokers.com/lamb/?b=…" spellCheck={false} autoComplete="off" aria-label="Enlace de caja compartida" />
        <button className="btn primary" disabled={!slug || busy} onClick={fromLink}>{busy ? <Loader2 className="spin" size={17} /> : <Download size={17} />} Importar</button>
      </div>
      {link.trim() && !slug && <small className="warn-text">El enlace debe tener la forma https://invokers.com/lamb/?b=…</small>}
      <ol className="steps-mini">
        <li>En <a href="https://invokers.com/hub/box/invokers/" target="_blank" rel="noreferrer">tu caja del portal <ArrowUpRight size={12} /></a> activa «compartir» y pulsa «Refresh link» para una instantánea nueva.</li>
        <li>Copia el enlace y pégalo arriba. Lo recordamos para la próxima vez.</li>
      </ol>
      {account?.box.expiresAt && <small className="muted">El enlace actual caduca el {new Date(account.box.expiresAt).toLocaleDateString('es-ES')}.</small>}
    </section>

    <div className={`import-methods ${fallback ? 'highlight' : ''}`}>
      <section className="panel method">
        <h3><Bookmark size={18} /> Marcador mágico <span className="badge">recomendado</span></h3>
        <p>Un marcador que lee tu caja desde la propia página de invokers.com y la envía aquí. Se configura una vez y funciona con un toque.</p>
        <div className="row-actions">
          <a ref={linkRef} className="btn bookmarklet" onClick={e => { e.preventDefault(); setStatus('Arrastra este botón a tu barra de marcadores (ordenador) o copia el código (móvil).') }}>⚡ Nexo · Importar</a>
          <button className="btn" onClick={() => copy(marklet, 'Código del marcador')}><Copy size={16} /> Copiar código</button>
        </div>
        <details><summary>Cómo usarlo en Android</summary><ol>
          <li>Pulsa «Copiar código».</li><li>En Chrome guarda cualquier página como marcador, edítalo, llámalo <b>nexo</b> y pega el código en la URL.</li>
          <li>Abre tu enlace de caja de invokers.com, escribe <b>nexo</b> en la barra de direcciones y elige el marcador.</li><li>Se abrirá esta web con tu cuenta importada.</li>
        </ol></details>
      </section>
      <section className="panel method">
        <h3><ClipboardPaste size={18} /> Copiar y pegar</h3>
        <p>Abre los datos de tu caja, selecciónalo todo, cópialo y pégalo aquí.</p>
        <div className="row-actions"><a className={`btn ${slug ? '' : 'disabled'}`} href={slug ? apiUrl(slug) : undefined} target="_blank" rel="noreferrer"><ArrowUpRight size={16} /> Abrir datos de mi caja</a></div>
        <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder='{"owner":false,"profile":…}' rows={3} aria-label="Datos de la caja" />
        <button className="btn primary" disabled={!paste.trim() || busy} onClick={fromPaste}>Importar texto</button>
      </section>
      <section className="panel method">
        <h3><FileJson size={18} /> Desde archivos</h3>
        <p>El JSON de la caja (por ejemplo, descargado por el marcador) o los snapshots <code>.dat</code> del juego.</p>
        <div className="row-actions">
          <button className="btn" onClick={() => files.current?.click()}><FileJson size={16} /> Elegir JSON o .dat</button>
          <button className="btn" onClick={chooseFolder}><FolderOpen size={16} /> Carpeta de snapshots</button>
        </div>
        {pref && <small className="muted">Carpeta recordada: {pref.handle.name} · <button className="link" onClick={() => run(async () => importFiles(await readFolder(pref, true)))}>actualizar</button></small>}
      </section>
      <section className="panel method">
        <h3><Smartphone size={18} /> Invokers Bridge (Android)</h3>
        <p>App auxiliar que descarga el enlace y lo comparte con esta web instalada. También lee los snapshots con Shizuku.</p>
        <div className="row-actions">
          <button className="btn" disabled={!slug} onClick={bridge}>Abrir enlace con Bridge</button>
          <a className="btn" href="./bridge.apk" download="invokers-bridge-0.2.0-debug.apk"><Download size={16} /> APK 0.2</a>
        </div>
      </section>
    </div>
    <details className="panel advanced">
      <summary><Server size={16} /> Avanzado: importación con un clic mediante tu propio proxy</summary>
      <p>Si despliegas el proxy incluido en el repositorio (<code>proxy/cloudflare-worker.js</code>, gratuito en Cloudflare Workers), el botón «Importar» funciona directamente con el enlace. Solo reenvía cajas públicas de invokers.com y no guarda nada.</p>
      <div className="link-row">
        <input value={proxy} onChange={e => setProxy(e.target.value)} placeholder="https://nexo-proxy.tu-cuenta.workers.dev" spellCheck={false} aria-label="URL del proxy" />
        <button className="btn" onClick={() => { store.set(PROXY_KEY, proxy.trim()); setStatus(proxy.trim() ? 'Proxy guardado en este navegador.' : 'Proxy desactivado.') }}>Guardar</button>
      </div>
    </details>
    <input ref={files} type="file" hidden multiple accept=".dat,.json,application/json,application/octet-stream" onChange={e => { fromFiles(e.target.files); e.target.value = '' }} />
    <input ref={folder} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={e => { fromFiles(e.target.files); e.target.value = '' }} />
  </div>
}
