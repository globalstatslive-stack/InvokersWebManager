import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, ClipboardPaste, Copy, Download, FolderOpen, Loader2, Monitor, RefreshCw, Server, ShieldCheck, Smartphone, Upload } from 'lucide-react'
import { useAccount } from './account'
import { GameImg } from './Art'
import { CHARACTERS } from '../catalog'

const HERO_ART = ['IRN036', 'LTS038', 'CAM004', 'FRB003']
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
const APP = () => `${location.origin}${location.pathname}`

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

export function bookmarklet(app: string): string {
  const origin = new URL(app).origin
  const code = `(async()=>{const A=${JSON.stringify(app)},O=${JSON.stringify(origin)};if(!/^https:\\/\\/(www\\.)?invokers\\.com$/.test(location.origin)){alert('Nexo: usa este marcador en una página de invokers.com.');return}const m=/[#&]nexo-plan=([A-Za-z0-9_-]+)/.exec(location.hash);if(m){let p;try{const s=m[1].replace(/-/g,'+').replace(/_/g,'/');p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0))))}catch(e){alert('Nexo: el plan no es válido.');return}const R=['Weapon','Shield','Helmet','Pauldrons','Gauntlets','Chestplate','Belt','Boots'],C=['Amulet','Earrings','Banner','Talisman','Flasks'],ok=(o,k)=>o&&typeof o==='object'&&Object.entries(o).every(([s,v])=>k.includes(s)&&(v===null||Number.isSafeInteger(v)&&v>=0));if(!p||typeof p.name!=='string'||!Array.isArray(p.loadouts)||!p.loadouts.length||p.loadouts.length>50||!p.loadouts.every(l=>Number.isSafeInteger(l.heroId)&&ok(l.relics,R)&&ok(l.accessories,C))){alert('Nexo: el plan no es válido.');return}const n=p.loadouts.reduce((s,l)=>s+Object.keys(l.relics).length+Object.keys(l.accessories).length,0);if(!confirm('Nexo: ¿guardar «'+p.name+'» como preset? '+p.loadouts.length+' Invokers · '+n+' cambios. No se equipa nada hasta que pulses Apply en Presets.'))return;const r=await fetch('/api/box/presets',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:p.name.slice(0,60),category:'Nexo',loadouts:p.loadouts.map(l=>({heroId:l.heroId,relics:l.relics,accessories:l.accessories}))})});history.replaceState(null,'',location.pathname+location.search);if(r.status===401){alert('Nexo: inicia sesión en invokers.com y vuelve a abrir el enlace del plan.');return}if(!r.ok){const t=await r.json().catch(()=>null);alert('Nexo: el portal no aceptó el preset ('+r.status+'). '+(t&&t.message||''));return}location.reload();return}const b=new URLSearchParams(location.search).get('b');if(!b){alert('Nexo: abre tu caja compartida (invokers.com/lamb/?b=…) o un plan de Nexo y vuelve a usar este marcador.');return}const w=window.open(A+'#/recibir','nexo');try{const r=await fetch('/api/lamb/'+encodeURIComponent(b));if(!r.ok)throw Error('HTTP '+r.status);const d=await r.text();if(!w){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d],{type:'application/json'}));a.download='caja-invokers.json';a.click();alert('Nexo: se ha descargado caja-invokers.json. Impórtalo en Nexo.');return}let k=0;const t=setInterval(()=>{if(++k>80)clearInterval(t);w.postMessage({type:'nexo-box',json:d},O)},400);addEventListener('message',e=>{if(e.origin===O&&e.data==='nexo-ack')clearInterval(t)})}catch(e){alert('Nexo: no se pudo leer la caja. '+e.message)}})()`
  return `javascript:${encodeURIComponent(code)}`
}

type Os = 'windows' | 'mac'
const PATHS: Record<Os, string> = {
  windows: '%USERPROFILE%\\AppData\\LocalLow\\Hit_Zone\\Invokers',
  mac: '~/Library/Application Support/Hit_Zone/Invokers',
}
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && innerWidth < 900)
const pickerApi = () => (window as unknown as { showDirectoryPicker?: (o: { mode: 'read'; id?: string; startIn?: string }) => Promise<ReadDirectory> }).showDirectoryPicker

export function ImportPage({ receiving }: { receiving?: boolean }) {
  const { importFiles, account } = useAccount()
  const [method, setMethod] = useState<'file' | 'link'>(() => isMobile() ? 'link' : 'file')
  const [os, setOs] = useState<Os>(() => /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows')
  const [link, setLink] = useState(() => store.get(LINK_KEY))
  const [proxy, setProxy] = useState(() => store.get(PROXY_KEY))
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [needsHelp, setNeedsHelp] = useState(false)
  const [copied, setCopied] = useState(false), [dragging, setDragging] = useState(false)
  const [pref, setPref] = useState<FolderPreference>()
  const folderInput = useRef<HTMLInputElement>(null), jsonInput = useRef<HTMLInputElement>(null)
  const marklet = useMemo(() => bookmarklet(APP()), [])
  const markletRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => { markletRef.current?.setAttribute('href', marklet) }, [marklet, method, needsHelp])
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
  const banner = account ? [...account.box.heroes].sort((a, b) => b.power - a.power).slice(0, 4) : HERO_ART.map(code => CHARACTERS.find(c => c.code === code)).filter((c): c is NonNullable<typeof c> => !!c).map((c, i) => ({ id: i, portrait: c.portrait }))

  return <div className="import">
    <section className="import-hero">
      <div className="import-hero-art">{banner.map((h, i) => <GameImg key={h.id} path={h.portrait} alt="" className={`ih ih${i}`} />)}</div>
      <span className="kicker">Sincronizar</span>
      <h1>{receiving ? 'Recibiendo tu caja…' : 'Importar tu caja'}</h1>
      <p>{receiving ? 'Esta pestaña espera los datos del marcador de invokers.com.' : 'En ordenador, importa la carpeta del juego: un clic y se recuerda. En móvil y tableta, pega el enlace de tu caja compartida.'}</p>
    </section>
    {receiving && <div className="note"><Loader2 className="spin" size={16} /> Esperando datos de invokers.com…</div>}
    {error && <div className="note warn" role="alert">{error}</div>}
    {status && <div className="note ok" role="status">{status}</div>}

    <div className="method-tabs" role="tablist" aria-label="Forma de importar">
      <button role="tab" aria-selected={method === 'file'} className={method === 'file' ? 'on' : ''} onClick={() => setMethod('file')}>
        <Monitor size={22} /><span><b>Desde el juego</b><small>PC y Mac · carpeta del juego</small></span>{!isMobile() && <em className="badge">Recomendado</em>}
      </button>
      <button role="tab" aria-selected={method === 'link'} className={method === 'link' ? 'on' : ''} onClick={() => setMethod('link')}>
        <Smartphone size={22} /><span><b>Con tu enlace</b><small>Móvil y tableta · caja compartida</small></span>{isMobile() && <em className="badge">Recomendado</em>}
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
      <p className="fine wide">La carpeta del juego da tus Invokers, Titanes y piezas. Para el <b>optimizador exacto</b> y los registros de combate, importa también tu enlace: aporta las estadísticas base que publica el portal.</p>
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
        {account?.box.expiresAt && <small className="muted">Tu enlace actual caduca el {new Date(account.box.expiresAt).toLocaleDateString('es-ES')}.</small>}
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
          <p>Se configura una vez. Después, en tu enlace de invokers.com, abre el marcador y la caja llega aquí sola.</p>
          <div className="row-actions">
            <a ref={markletRef} className="btn bookmarklet" onClick={e => { e.preventDefault(); setStatus('En ordenador, arrastra este botón a la barra de marcadores. En móvil, usa «Copiar código».') }}>⚡ Nexo · Importar</a>
            <button className="btn" onClick={() => copy(marklet, () => setStatus('Código del marcador copiado.'))}><Copy size={16} /> Copiar código</button>
          </div>
          <details><summary>Configurarlo en el móvil</summary><ol>
            <li>Pulsa «Copiar código».</li><li>En Chrome, guarda cualquier página como marcador, edítalo, llámalo <b>nexo</b> y pega el código como URL.</li>
            <li>Abre tu enlace de invokers.com, escribe <b>nexo</b> en la barra de direcciones y toca el marcador.</li>
          </ol></details>
        </section>
      </div>
      </details>
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
      <div className="panel"><h3 className="sub"><ShieldCheck size={15} /> Lo que hace Nexo</h3><ul className="ticks">
        <li>Lee la caja que guarda el juego o la que publica tu enlace, en tu navegador.</li>
        <li>Guarda tus importaciones solo en este dispositivo para ver tu progreso.</li>
        <li>Actualiza con un clic desde la carpeta recordada o el enlace guardado.</li>
      </ul></div>
      <div className="panel"><h3 className="sub">Lo que no hace</h3><ul className="dashes">
        <li>No envía tus datos a ningún servidor de Nexo.</li>
        <li>No encuentra la carpeta por sí solo: tú la eliges una vez (por eso te damos la ruta).</li>
        <li>No escribe nada en el juego ni en su carpeta.</li>
      </ul></div>
    </section>
    <input ref={folderInput} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={e => { onFolderInput(e.target.files); e.target.value = '' }} />
    <input ref={jsonInput} type="file" hidden accept=".json,application/json" onChange={e => { const f = e.target.files; if (f?.length) { const files = Array.from(f); void run(() => importFiles(files)) } e.target.value = '' }} />
  </div>
}
