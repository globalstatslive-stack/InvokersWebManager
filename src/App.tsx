import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Database, Download, Gem, Home, Lightbulb, Menu, RefreshCw, Shield, Sparkles, Swords, Wand2, X } from 'lucide-react'
import { clearSharedFiles, listImports, prepareFiles, readSharedFiles, saveImport, type ImportRecord } from './data'
import { AccountContext, accountFrom, type Account } from './ui/account'
import { GameImg } from './ui/Art'
import { Dashboard } from './ui/Dashboard'
import { Invokers } from './ui/Invokers'
import { HeroDetail } from './ui/HeroDetail'
import { Titans } from './ui/Titans'
import { GearPage } from './ui/GearPage'
import { Optimizer } from './ui/Optimizer'
import { Advisor } from './ui/Advisor'
import { Teams } from './ui/Teams'
import { Codex } from './ui/Codex'
import { fetchBox, ImportPage, LINK_KEY, proxyUrl } from './ui/ImportPage'
import { folderPreference, readFolder } from './folderSync'
import { DataPage } from './ui/DataPage'
import { fmtInt } from './box/i18n'

const NAV = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/invokers', label: 'Invokers', icon: Sparkles },
  { path: '/titanes', label: 'Titanes', icon: Shield },
  { path: '/equipo', label: 'Equipo', icon: Gem },
  { path: '/optimizador', label: 'Optimizador', icon: Wand2 },
  { path: '/asesor', label: 'Asesor', icon: Lightbulb },
  { path: '/equipos', label: 'Equipos', icon: Swords },
  { path: '/codice', label: 'Códice', icon: BookOpen },
  { path: '/importar', label: 'Importar', icon: Download },
  { path: '/datos', label: 'Historial', icon: Database },
]
const MOBILE = ['/', '/invokers', '/optimizador', '/asesor']
const OFFICIAL_ORIGINS = ['https://invokers.com', 'https://www.invokers.com']
const readRoute = () => (location.hash.replace(/^#/, '') || '/').split('?')[0]
const stored = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [records, setRecords] = useState<ImportRecord[]>([])
  const [account, setAccount] = useState<Account>()
  const [previous, setPrevious] = useState<Account>()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ text: string; bad?: boolean }>()
  const [menu, setMenu] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const started = useRef(false)

  useEffect(() => { if (!toast || toast.bad) return; const id = setTimeout(() => setToast(undefined), 7000); return () => clearTimeout(id) }, [toast])
  useEffect(() => { const f = () => { setRoute(readRoute()); setMenu(false) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const go = useCallback((path: string) => { location.hash = path; scrollTo({ top: 0 }) }, [])
  const reload = useCallback(async () => {
    const list = await listImports()
    setRecords(list)
    const [a, b] = await Promise.all([accountFrom(list[0], list).catch(() => undefined), accountFrom(list[1], list).catch(() => undefined)])
    setAccount(a); setPrevious(b)
  }, [])
  const importFiles = useCallback(async (files: File[]) => {
    const record = await prepareFiles(files)
    if (record.source !== 'official-link' && !record.collection) throw Error(record.interpretationError ?? 'Los archivos no contienen una colección completa.')
    await saveImport(record)
    await reload()
    const s = record.summary
    setToast({ text: s ? `Cuenta de ${s.name} importada: ${s.heroes} Invokers, ${s.titans} Titanes y ${s.gear} piezas.` : `${record.collection?.invokers.length ?? 0} Invokers importados desde los snapshots.` })
    go('/')
  }, [go, reload])

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      await reload()
      if (new URLSearchParams(location.search).has('share_error')) setToast({ text: 'No se pudieron recibir los archivos compartidos.', bad: true })
      const shared = await readSharedFiles()
      if (shared?.files.length) { await importFiles(shared.files); await clearSharedFiles(shared.receivedAt) }
      if (location.search) history.replaceState(null, '', location.pathname + location.hash)
      // Carpeta recordada con «Actualizar al abrir Nexo»: solo si el navegador conserva el permiso.
      const pref = await folderPreference().catch(() => undefined)
      if (pref?.auto && !shared?.files.length) await readFolder(pref, false).then(files => importFiles(files)).catch(() => undefined)
    })().catch(e => setToast({ text: `Error al abrir los datos: ${e instanceof Error ? e.message : e}`, bad: true })).finally(() => setLoading(false))
  }, [reload, importFiles])

  // Recibe la caja enviada por el marcador desde invokers.com.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!OFFICIAL_ORIGINS.includes(e.origin) || typeof e.data !== 'object' || e.data?.type !== 'nexo-box' || typeof e.data.json !== 'string') return
      ;(e.source as Window | null)?.postMessage('nexo-ack', e.origin)
      if (e.data.json.length > 20 * 1024 * 1024) return
      importFiles([new File([e.data.json], 'caja-invokers.json', { type: 'application/json' })]).catch(err => setToast({ text: err instanceof Error ? err.message : String(err), bad: true }))
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [importFiles])

  /** Actualiza desde la última fuente disponible: carpeta recordada o enlace con proxy. */
  async function sync() {
    const link = stored(LINK_KEY), pref = await folderPreference().catch(() => undefined)
    const viaLink = !!link && !!proxyUrl()
    const preferFolder = pref && (account?.record.source !== 'official-link' || !viaLink)
    if (!preferFolder && !viaLink) { go('/importar'); return }
    setSyncing(true)
    try { await importFiles(preferFolder ? await readFolder(pref!, true) : [await fetchBox(link)]) }
    catch (e) { setToast({ text: e instanceof Error ? e.message : String(e), bad: true }); go('/importar') }
    finally { setSyncing(false) }
  }

  const ctx = useMemo(() => ({ account, previous, records, go, importFiles, reload }), [account, previous, records, go, importFiles, reload])
  const [, section, arg] = route.split('/')
  const page = (() => {
    switch (section) {
      case '': case undefined: return <Dashboard />
      case 'invokers': return <Invokers />
      case 'invoker': return <HeroDetail id={Number(arg)} />
      case 'titanes': return <Titans />
      case 'equipo': return <GearPage />
      case 'optimizador': return <Optimizer heroId={arg ? Number(arg) : undefined} />
      case 'asesor': return <Advisor tab={arg} />
      case 'equipos': return <Teams mode={arg} />
      case 'codice': return <Codex />
      case 'importar': return <ImportPage />
      case 'recibir': return <ImportPage receiving />
      case 'datos': return <DataPage />
      default: return <Dashboard />
    }
  })()
  const active = (path: string) => path === '/' ? route === '/' : route.startsWith(path) || (path === '/invokers' && route.startsWith('/invoker/'))
  const profile = account?.box.profile
  return <AccountContext.Provider value={ctx}>
    <div className="shell">
      <aside className={`side ${menu ? 'open' : ''}`}>
        <a className="brand" href="#/"><span className="brand-mark">N</span><span><b>NEXO</b><small>Invokers · Titan Legacy</small></span></a>
        <nav>{NAV.map(n => <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'on' : ''}><n.icon size={18} />{n.label}</a>)}</nav>
        <div className="side-foot">Proyecto de fans independiente. Ilustraciones © Hitzone, usadas conforme a su política de contenido de fans.</div>
      </aside>
      {menu && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="top">
          <button className="icon-btn only-mobile" aria-label="Menú" onClick={() => setMenu(true)}><Menu size={21} /></button>
          <a className="brand only-mobile" href="#/"><span className="brand-mark">N</span><b>NEXO</b></a>
          <div className="top-spacer" />
          {profile && <div className="account-chip">
            {profile.avatar && <GameImg path={profile.avatar} alt="" className="avatar" />}
            <span><b>{profile.name}</b><small>Nv. {profile.level} · {fmtInt(profile.totalPower || account!.box.heroes.reduce((s, h) => s + h.power, 0))}</small></span>
          </div>}
          {account ? <button className="btn small" onClick={sync} disabled={syncing} title="Actualizar la cuenta"><RefreshCw size={15} className={syncing ? 'spin' : ''} /><span className="hide-sm">Actualizar</span></button>
            : <a className="btn small primary" href="#/importar"><Download size={15} />Importar caja</a>}
        </header>
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status"><span>{toast.text}</span><button className="icon-btn" aria-label="Cerrar" onClick={() => setToast(undefined)}><X size={16} /></button></div>}
        <main className="content">{loading ? <div className="loading">Cargando tu cuenta…</div> : page}</main>
        <footer className="foot">Nexo · versión 0.6 · No afiliado a Hitzone. Los datos se quedan en tu navegador.</footer>
      </div>
      <nav className="bottom-nav">{NAV.filter(n => MOBILE.includes(n.path)).map(n => <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'on' : ''}><n.icon size={20} /><span>{n.label}</span></a>)}
        <button onClick={() => setMenu(true)}><Menu size={20} /><span>Más</span></button></nav>
    </div>
  </AccountContext.Provider>
}
