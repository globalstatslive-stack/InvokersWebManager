import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Calculator, CalendarDays, ChevronDown, Database, Download, Gem, Home, Lightbulb, LayoutGrid, ListChecks, ListOrdered, Menu, Mountain, RefreshCw, Skull, Target, Users, Wand2, X, Zap } from 'lucide-react'
import { clearSharedFiles, listImports, prepareFiles, readSharedFiles, saveImport, type ImportRecord } from './data'
import { AccountContext, accountFrom, type Account } from './ui/account'
import { GameImg } from './ui/Art'
import { Dashboard } from './ui/Dashboard'
import { Collection } from './ui/Collection'
import { Goal } from './ui/Goal'
import { PlanPage } from './ui/PlanPage'
import { GearDetail } from './ui/GearDetail'
import { HeroDetail } from './ui/HeroDetail'
import { Titans } from './ui/Titans'
import { Optimizer } from './ui/Optimizer'
import { Advisor } from './ui/Advisor'
import { Teams } from './ui/Teams'
// La enciclopedia se carga bajo demanda: no pesa en la primera visita a la cuenta.
const CharacterList = lazy(() => import('./ui/wiki/Characters').then(m => ({ default: m.CharacterList })))
const CharacterPage = lazy(() => import('./ui/wiki/Characters').then(m => ({ default: m.CharacterPage })))
const BossList = lazy(() => import('./ui/wiki/Bosses').then(m => ({ default: m.BossList })))
const BossPage = lazy(() => import('./ui/wiki/Bosses').then(m => ({ default: m.BossPage })))
const SpireList = lazy(() => import('./ui/wiki/Activities').then(m => ({ default: m.SpireList })))
const SpirePage = lazy(() => import('./ui/wiki/Activities').then(m => ({ default: m.SpirePage })))
const EventsPage = lazy(() => import('./ui/wiki/Activities').then(m => ({ default: m.EventsPage })))
const Encyclopedia = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.Encyclopedia })))
const TierListPage = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.TierListPage })))
const GearPage = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.GearPage })))
const EffectsPage = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.EffectsPage })))
const ToolsPage = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.ToolsPage })))
const GuidesPage = lazy(() => import('./ui/wiki/Reference').then(m => ({ default: m.GuidesPage })))
import { fetchBox, ImportPage, LINK_KEY, proxyUrl } from './ui/ImportPage'
import { folderPreference, readFolder } from './folderSync'
import { DataPage } from './ui/DataPage'
import { fmtInt } from './box/i18n'

/** Lateral reducido a lo que se usa a diario. Titanes y récords viven como pestañas de Colección;
 * la enciclopedia es un grupo plegable; importar e historial, accesos discretos al pie. */
const NAV = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/coleccion', label: 'Colección', icon: LayoutGrid },
  { path: '/objetivo', label: 'Objetivo', icon: Target },
  { path: '/plan', label: 'Plan', icon: ListChecks },
  { path: '/optimizador', label: 'Optimizador', icon: Wand2 },
  { path: '/asesor', label: 'Asesor', icon: Lightbulb },
]
const WIKI_NAV = [
  { path: '/wiki/invokers', label: 'Invokers y Titanes', icon: Users },
  { path: '/wiki/jefes', label: 'Jefes', icon: Skull },
  { path: '/wiki/agujas', label: 'Agujas', icon: Mountain },
  { path: '/wiki/eventos', label: 'Eventos', icon: CalendarDays },
  { path: '/wiki/tier-list', label: 'Tier lists', icon: ListOrdered },
  { path: '/wiki/equipamiento', label: 'Equipamiento', icon: Gem },
  { path: '/wiki/herramientas', label: 'Calculadoras', icon: Calculator },
]
const WIKI_HOME = { path: '/wiki', label: 'Enciclopedia', icon: BookOpen }
const MOBILE = ['/', '/coleccion', '/objetivo', '/wiki']
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
  const [wikiPinned, setWikiPinned] = useState<boolean | null>(null)
  const started = useRef(false)

  useEffect(() => { if (!toast || toast.bad) return; const id = setTimeout(() => setToast(undefined), 7000); return () => clearTimeout(id) }, [toast])
  useEffect(() => { const f = () => { setRoute(readRoute()); setMenu(false) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const go = useCallback((path: string) => { location.hash = path; scrollTo({ top: 0 }) }, [])
  const reload = useCallback(async () => {
    const list = await listImports()
    setRecords(list)
    // La cuenta activa es la importación válida más reciente: un lote que ya no se puede leer no borra la anterior.
    const built: Account[] = []
    for (const r of list) {
      const a = await accountFrom(r, list).catch(() => undefined)
      if (a) built.push(a)
      if (built.length === 2) break
    }
    setAccount(built[0]); setPrevious(built[1])
  }, [])
  /** Valida antes de guardar: si la caja nueva no se puede leer, se descarta y se conserva la última válida. */
  const importFiles = useCallback(async (files: File[]) => {
    const record = await prepareFiles(files)
    if (record.source !== 'official-link' && !record.collection) throw Error(record.interpretationError ?? 'Los archivos no contienen una colección completa.')
    await accountFrom(record, [record, ...records]).then(a => { if (!a) throw Error('La caja no contiene datos utilizables.') })
    await saveImport(record)
    await reload()
    const s = record.summary
    setToast({ text: s ? `Cuenta de ${s.name} importada: ${s.heroes} Invokers, ${s.titans} Titanes y ${s.gear} piezas.` : `${record.collection?.invokers.length ?? 0} Invokers importados desde los snapshots.` })
    go('/')
  }, [go, reload, records])

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
  /** Actualiza desde todas las fuentes configuradas: primero el enlace (poder y estadísticas base) y después la carpeta del juego (equipo actual). */
  async function sync() {
    const link = stored(LINK_KEY), pref = await folderPreference().catch(() => undefined)
    const viaLink = !!link && !!proxyUrl()
    if (!pref && !viaLink) { go('/importar'); return }
    setSyncing(true)
    try {
      let failed: unknown
      if (viaLink) await fetchBox(link).then(f => importFiles([f])).catch(e => { failed = e })
      if (pref) await importFiles(await readFolder(pref, true))
      else if (failed) throw failed
    }
    catch (e) { setToast({ text: e instanceof Error ? e.message : String(e), bad: true }); go('/importar') }
    finally { setSyncing(false) }
  }

  const ctx = useMemo(() => ({ account, previous, records, go, importFiles, reload }), [account, previous, records, go, importFiles, reload])
  const [, section, arg, arg2] = route.split('/')
  const page = (() => {
    switch (section) {
      case '': case undefined: return <Dashboard />
      case 'invokers': case 'coleccion': return <Collection tab={arg} />
      case 'objetivo': return <Goal />
      case 'plan': return <PlanPage />
      case 'pieza': return <GearDetail id={arg ?? ''} />
      case 'invoker': return <HeroDetail id={Number(arg)} />
      case 'titanes': return <Titans />
      case 'equipo': return <Collection tab="piezas" />
      case 'optimizador': return <Optimizer heroId={arg ? Number(arg) : undefined} />
      case 'asesor': return <Advisor tab={arg} />
      case 'equipos': return <Teams mode={arg} />
      case 'codice': return <CharacterList kind="invokers" />
      case 'wiki': switch (arg) {
        case undefined: case '': return <Encyclopedia />
        case 'invokers': return arg2 ? <CharacterPage kind="invokers" slug={arg2} /> : <CharacterList kind="invokers" />
        case 'titanes': return arg2 ? <CharacterPage kind="titans" slug={arg2} /> : <CharacterList kind="titans" />
        case 'jefes': return arg2 ? <BossPage slug={arg2} /> : <BossList />
        case 'agujas': return arg2 ? <SpirePage slug={arg2} /> : <SpireList />
        case 'eventos': return <EventsPage />
        case 'tier-list': return <TierListPage kind={arg2 === 'titanes' ? 'titans' : 'invokers'} />
        case 'equipamiento': return <GearPage />
        case 'efectos': return <EffectsPage />
        case 'herramientas': return <ToolsPage />
        case 'guias': return <GuidesPage />
        default: return <Encyclopedia />
      }
      case 'importar': return <ImportPage />
      case 'recibir': return <ImportPage receiving />
      case 'datos': return <DataPage />
      default: return <Dashboard />
    }
  })()
  const active = (path: string) => path === '/' ? route === '/' : path === '/wiki' ? route.startsWith('/wiki') : route.startsWith(path) || (path === '/coleccion' && (route.startsWith('/invoker') || route.startsWith('/pieza') || route === '/equipo' || route.startsWith('/titanes') || route.startsWith('/equipos')))
  const activeWiki = (path: string) => path === '/wiki/invokers' ? route.startsWith('/wiki/invokers') || route.startsWith('/wiki/titanes') : route.startsWith(path)
  const inWiki = route.startsWith('/wiki') || route === '/codice'
  const wikiOpen = wikiPinned ?? inWiki
  const days = account?.box.expiresAt ? Math.ceil((Date.parse(account.box.expiresAt) - Date.now()) / 86400000) : null
  const profile = account?.box.profile
  return <AccountContext.Provider value={ctx}>
    <div className="shell">
      <aside className={`side ${menu ? 'open' : ''}`}>
        <a className="brand" href="#/"><span className="brand-mark">N</span><span><b>NEXO</b><small>Invokers · Titan Legacy</small></span></a>
        {profile ? <a className="side-profile" href="#/">
          <span className="avatar-ring">{profile.avatar ? <GameImg path={profile.avatar} alt="" className="avatar" /> : <span className="avatar" />}<span className="lv">{profile.level}</span></span>
          <span className="side-profile-text"><b>{profile.clan && <small>{profile.clan} </small>}{profile.name}</b><span className="side-power"><Zap size={12} aria-hidden />{fmtInt(profile.totalPower || account!.box.heroes.reduce((s, h) => s + h.power, 0))}</span>
            {days !== null && <span className={`live-pill ${days <= 2 ? 'warn' : ''}`}><i />{days > 0 ? `Enlace: ${days} d` : 'Enlace caducado'}</span>}</span>
        </a> : <a className="btn primary side-cta" href="#/importar"><Download size={16} /> Importar mi caja</a>}
        <nav aria-label="Principal">{NAV.map(n => <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'on' : ''}><n.icon size={18} />{n.label}</a>)}</nav>
        <nav aria-label="Enciclopedia" className={`side-group ${wikiOpen ? 'open' : ''}`}>
          <div className="side-group-head">
            <a href={`#${WIKI_HOME.path}`} className={route === '/wiki' ? 'on' : ''}><WIKI_HOME.icon size={18} />{WIKI_HOME.label}</a>
            <button className="icon-btn" aria-expanded={wikiOpen} aria-label={wikiOpen ? 'Plegar la enciclopedia' : 'Desplegar la enciclopedia'} onClick={() => setWikiPinned(!wikiOpen)}><ChevronDown size={16} className={wikiOpen ? 'rot' : ''} /></button>
          </div>
          {wikiOpen && <div className="side-sub">{WIKI_NAV.map(n => <a key={n.path} href={`#${n.path}`} className={activeWiki(n.path) ? 'on' : ''}><n.icon size={16} />{n.label}</a>)}</div>}
        </nav>
        <div className="side-utils">
          <a href="#/importar" className={route.startsWith('/importar') ? 'on' : ''}><Download size={15} /> Importar</a>
          <a href="#/datos" className={route.startsWith('/datos') ? 'on' : ''}><Database size={15} /> Historial</a>
        </div>
        <div className="side-foot">Proyecto de fans independiente, no afiliado a Hitzone. Ilustraciones © Hitzone, usadas conforme a su política de contenido de fans.</div>
      </aside>
      {menu && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="top">
          <button className="icon-btn only-mobile" aria-label="Menú" onClick={() => setMenu(true)}><Menu size={21} /></button>
          <a className="brand only-mobile" href="#/"><span className="brand-mark">N</span><b>NEXO</b></a>
          <div className="top-spacer" />
          {profile && <div className="account-chip only-mobile-chip">
            {profile.avatar && <GameImg path={profile.avatar} alt="" className="avatar" />}
            <span><b>{profile.name}</b><small>Nv. {profile.level} · {fmtInt(profile.totalPower || account!.box.heroes.reduce((s, h) => s + h.power, 0))}</small></span>
          </div>}
          {account ? <button className="btn small" onClick={sync} disabled={syncing} title="Actualizar la cuenta"><RefreshCw size={15} className={syncing ? 'spin' : ''} /><span className="hide-sm">Actualizar</span></button>
            : <a className="btn small primary" href="#/importar"><Download size={15} />Importar caja</a>}
        </header>
        {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status"><span>{toast.text}</span><button className="icon-btn" aria-label="Cerrar" onClick={() => setToast(undefined)}><X size={16} /></button></div>}
        <main className="content">{loading ? <div className="loading">Cargando tu cuenta…</div> : <Suspense fallback={<div className="loading" role="status">Cargando…</div>}>{page}</Suspense>}</main>
        <footer className="foot">Nexo · versión 0.12 · No afiliado a Hitzone. Tus importaciones se guardan solo en este navegador.</footer>
      </div>
      <nav className="bottom-nav">{[...NAV, WIKI_HOME].filter(n => MOBILE.includes(n.path)).map(n => <a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'on' : ''}><n.icon size={20} /><span>{n.label}</span></a>)}
        <button onClick={() => setMenu(true)}><Menu size={20} /><span>Más</span></button></nav>
    </div>
  </AccountContext.Provider>
}
