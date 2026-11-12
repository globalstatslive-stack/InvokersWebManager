import { Fragment, useState, type ReactNode } from 'react'
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { GameImg } from '../Art'
import type { Summary } from '../../wiki/data'

/** Texto de habilidad con el marcado mínimo del generador. Nunca inserta HTML: cada fragmento es texto de React. */
const TAG = /<(\/?)(n|u|d|y|b|i)>|<br>/g
export function RichText({ src }: { src: string }) {
  const out: ReactNode[] = []
  const stack: { tag: string; children: ReactNode[] }[] = [{ tag: 'root', children: out }]
  let last = 0, k = 0
  for (const m of src.matchAll(TAG)) {
    if (m.index! > last) stack[stack.length - 1].children.push(src.slice(last, m.index))
    last = m.index! + m[0].length
    if (m[0] === '<br>') { stack[stack.length - 1].children.push(<br key={k++} />); continue }
    if (!m[1]) { stack.push({ tag: m[2], children: [] }); continue }
    if (stack.length > 1 && stack[stack.length - 1].tag === m[2]) {
      const node = stack.pop()!
      const el = node.tag === 'i' ? <i key={k++} className="rt-formula">{node.children}</i> : node.tag === 'b' ? <b key={k++}>{node.children}</b> : <b key={k++} className={`rt-${node.tag}`}>{node.children}</b>
      stack[stack.length - 1].children.push(el)
    }
  }
  if (last < src.length) stack[stack.length - 1].children.push(src.slice(last))
  while (stack.length > 1) { const node = stack.pop()!; stack[stack.length - 1].children.push(<Fragment key={k++}>{node.children}</Fragment>) }
  return <span className="rich">{out}</span>
}

/** Imagen alojada en invokers.com (iconos de habilidad, ilustraciones). Si falla, no rompe la maqueta. */
export function OfficialImg({ src, alt, className = '', eager }: { src: string | null | undefined; alt: string; className?: string; eager?: boolean }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span className={`img-missing ${className}`} role="img" aria-label={alt}>{alt.slice(0, 1)}</span>
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

/** Ruta local del retrato (copia verificada), a partir de la URL oficial. */
export const portraitPath = (s: Pick<Summary, 'portraitUrl'>) => { const m = /\/characters\/(.+?\/[A-Z0-9]+\/portrait\.webp)$/.exec(s.portraitUrl ?? ''); return m ? `game/characters/${m[1]}` : null }
export function Thumb({ s, size = 'md' }: { s: Summary; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`portrait ${size} r-${s.rarity.toLowerCase()}`}><GameImg path={portraitPath(s)} alt={s.name} className="portrait-img" /></span>
}

export function Source({ href, version, date, children }: { href: string; version?: string | null; date?: string | null; children?: ReactNode }) {
  return <p className="wiki-source">Datos oficiales de <a href={href} target="_blank" rel="noreferrer">invokers.com <ExternalLink size={12} aria-hidden /></a>{version ? ` · versión del juego ${version}` : ''}{date ? ` · actualizado el ${new Date(date).toLocaleDateString('es-ES')}` : ''}{children}</p>
}
export function Loading({ what }: { what: string }) {
  return <div className="state-card" role="status"><Loader2 className="spin" size={20} aria-hidden /> Cargando {what}…</div>
}
export function Failed({ error }: { error: string }) {
  return <div className="state-card bad" role="alert"><AlertTriangle size={20} aria-hidden /> No se pudieron cargar los datos: {error}</div>
}
export function NotFound({ what, back }: { what: string; back: ReactNode }) {
  return <div className="state-card"><AlertTriangle size={20} aria-hidden /> No existe {what} en los datos oficiales actuales. {back}</div>
}
export const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (s: string) => new Date(s).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Cifras del portal («9,442», «1,136.5») en formato español. */
export function esNum(v: string | null | undefined): string {
  if (!v) return v ?? ''
  return v.replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+/g, m => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(m.replace(/,/g, ''))))
}
