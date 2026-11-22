import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { PORTAL_BOX } from './linkRefresh'

/** Nombre del archivo de Account Stats que acompaña a la caja enviada por el marcador. */
export const STATS_FILE = 'nexo-account-stats.json'

/** Marcador «Nexo»: solo actúa cuando el jugador lo pulsa en una página de invokers.com, con su sesión.
 * - Con `#nexo-plan=` en la dirección (enlace «Enviar a invokers.com» del Plan): valida el plan, pide confirmación,
 *   lo guarda como preset (POST /api/box/presets), abre la pestaña Presets del optimizador oficial y pulsa «Load».
 *   No equipa nada: equipar se confirma en el portal («Equip all» o «Apply»), que muestra el oro antes.
 * - En cualquier otra página de invokers.com: envía la caja (en vivo o del enlace compartido) a Nexo, que se abre en la
 *   misma pestaña (formulario al receptor `share` del service worker; funciona igual en Chrome para Android). Con la
 *   caja en vivo (tu sesión) envía también tus Account Stats (`/api/profile/account-stats`, lo que muestra la página oficial).
 * Código en una sola línea con `;` para que sobreviva al pegarlo como dirección de un marcador. */
export function bookmarklet(app: string): string {
  const code = [
    `(async()=>{const A=${JSON.stringify(app)};`,
    `if(!/^https:\\/\\/(www\\.)?invokers\\.com$/.test(location.origin)){alert('Nexo: usa este marcador en una página de invokers.com.');return}`,
    `const T=e=>(e.textContent||'').trim(),W=(f,ms)=>new Promise(r=>{const t0=Date.now(),i=setInterval(()=>{const v=f();if(v||Date.now()-t0>ms){clearInterval(i);r(v||null)}},250)});`,
    `const toast=s=>{const d=document.createElement('div');d.textContent=s;d.setAttribute('role','status');d.style.cssText='position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);max-width:90vw;padding:12px 18px;border-radius:12px;font:600 14px system-ui,sans-serif;color:#1b1406;background:#f0cf83;box-shadow:0 10px 30px #0008';document.body.appendChild(d);setTimeout(()=>d.remove(),9000)};`,
    `const m=/[#&]nexo-plan=([A-Za-z0-9_-]+)/.exec(location.hash);`,
    `if(m){let p;try{const s=m[1].replace(/-/g,'+').replace(/_/g,'/');p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0))))}catch(e){alert('Nexo: el plan no es válido.');return}`,
    `const R=['Weapon','Shield','Helmet','Pauldrons','Gauntlets','Chestplate','Belt','Boots'],C=['Amulet','Earrings','Banner','Talisman','Flasks'],ok=(o,k)=>o&&typeof o==='object'&&Object.entries(o).every(([s,v])=>k.includes(s)&&(v===null||Number.isSafeInteger(v)&&v>=0));`,
    `if(!p||typeof p.name!=='string'||!Array.isArray(p.loadouts)||!p.loadouts.length||p.loadouts.length>50||!p.loadouts.every(l=>Number.isSafeInteger(l.heroId)&&ok(l.relics,R)&&ok(l.accessories,C))){alert('Nexo: el plan no es válido.');return}`,
    `const N=p.name.slice(0,60),n=p.loadouts.reduce((s,l)=>s+Object.keys(l.relics).length+Object.keys(l.accessories).length,0);`,
    `if(!confirm('Nexo: ¿guardar «'+N+'» como preset y cargarlo en el optimizador? '+p.loadouts.length+' Invokers · '+n+' cambios. No se equipa nada hasta que lo confirmes en el portal.'))return;`,
    `const r=await fetch('/api/box/presets',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:N,category:'Nexo',loadouts:p.loadouts.map(l=>({heroId:l.heroId,relics:l.relics,accessories:l.accessories}))})});`,
    `history.replaceState(null,'',location.pathname+location.search);`,
    `if(r.status===401){alert('Nexo: inicia sesión en invokers.com y vuelve a pulsar «Enviar a invokers.com» en Nexo.');return}`,
    `if(!r.ok){const t=await r.json().catch(()=>null);alert('Nexo: el portal no aceptó el preset ('+r.status+'). '+(t&&t.message||''));return}`,
    // La lista de presets del portal se guarda en caché un minuto: se pide de nuevo antes de abrirla.
    `try{const el=document.querySelector('[role=tablist]'),k=el&&Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let f=k&&el[k];while(f){const c=f.memoizedProps&&f.memoizedProps.client;if(c&&typeof c.invalidateQueries==='function'){await c.invalidateQueries({queryKey:['box-presets']});break}f=f.return}}catch(e){}`,
    `const tab=await W(()=>[...document.querySelectorAll('[role=tab]')].find(e=>/^presets\\b/i.test(T(e))),5000);`,
    `if(tab){tab.click();const li=await W(()=>[...document.querySelectorAll('.opt-preset')].find(e=>{const h=e.querySelector('h4');return h&&T(h)===N}),8000),b=li&&[...li.querySelectorAll('button')].find(b=>/^load$/i.test(T(b)));`,
    `if(b){b.click();toast('Nexo: «'+N+'» guardado y cargado. Revisa las builds y pulsa «Equip all»: el portal te muestra el oro antes de confirmar.');return}}`,
    `alert('Nexo: «'+N+'» está guardado en tus presets. La página se recargará: abre la pestaña Presets y pulsa «Load».');location.reload();return}`,
    `const b=new URLSearchParams(location.search).get('b');toast('Nexo: leyendo tu caja…');`,
    `try{const r=await fetch(b?'/api/lamb/'+encodeURIComponent(b):'/api/box',{credentials:'same-origin'});`,
    `if(r.status===401){alert('Nexo: inicia sesión en invokers.com para enviar tu caja en vivo.');return}if(!r.ok)throw Error('HTTP '+r.status);const d=await r.text();`,
    // Account Stats solo con tu sesión y tu caja en vivo (un enlace compartido puede ser de otra cuenta).
    `let st=null;if(!b){try{const q=await fetch('/api/profile/account-stats',{credentials:'same-origin'});if(q.ok)st=await q.text()}catch(e){}}`,
    // Nexo se abre en esta misma pestaña con la caja como archivo: un formulario al receptor de Nexo (`share`, lo
    // atiende su service worker, como «Compartir»). Sin ventanas emergentes ni mensajes entre pestañas, que Chrome
    // para Android bloquea o congela. Nada pasa por ningún servidor: el service worker lo guarda en el navegador.
    `const fs=[new File([d],'caja-invokers.json',{type:'application/json'})];if(st)fs.push(new File([st],${JSON.stringify(STATS_FILE)},{type:'application/json'}));`,
    `let dt=null;try{dt=new DataTransfer();fs.forEach(f=>dt.items.add(f))}catch(e){dt=null}`,
    `if(!dt){const a=document.createElement('a');a.href=URL.createObjectURL(fs[0]);a.download='caja-invokers.json';a.click();alert('Nexo: se ha descargado caja-invokers.json. Impórtalo en Nexo.');return}`,
    `const f=document.createElement('form'),i=document.createElement('input');f.method='post';f.enctype='multipart/form-data';f.action=new URL('share',A).href;f.style.display='none';`,
    `i.type='file';i.name='snapshots';i.multiple=true;i.files=dt.files;f.appendChild(i);document.body.appendChild(f);toast('Nexo: abriendo Nexo con tu caja…');f.submit()`,
    `}catch(e){alert('Nexo: no se pudo leer la caja. '+e.message)}})()`,
  ].join('')
  return `javascript:${encodeURIComponent(code)}`
}

const APP = () => `${location.origin}${location.pathname}`

// ───────── Asistente para Android ─────────
const MARKLET_KEY = 'nexo.marklet'
/** Última caja recibida del marcador: `form` (versión 0.23.1 o posterior, misma pestaña) o `popup` (versión anterior). */
export type MarkletStatus = { at: string; how: 'form' | 'popup' }
export function markletSeen(how: MarkletStatus['how']) { try { localStorage.setItem(MARKLET_KEY, JSON.stringify({ at: new Date().toISOString(), how })) } catch { /* sin almacenamiento */ } }
export function markletStatus(): MarkletStatus | null { try { const v = localStorage.getItem(MARKLET_KEY); return v ? JSON.parse(v) as MarkletStatus : null } catch { return null } }
const isAndroid = () => /Android/i.test(navigator.userAgent)
const inApp = () => typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches

/** Instalador paso a paso del marcador en Chrome para Android, que comprueba que funciona: cuando llega una caja del
 * marcador, el paso 3 queda marcado. Los navegadores no dejan que una web cree marcadores, así que los pasos 1 y 2 los
 * hace el jugador; el asistente los reduce a copiar, pegar y probar. */
function MarkletWizard({ code }: { code: string }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const status = markletStatus(), ok = status?.how === 'form', old = status?.how === 'popup'
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true) } catch { setCopied(false) } }
  const when = status ? new Date(status.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  return <details className="mk-wizard" open={isAndroid() && !ok}>
    <summary>Instalarlo en el móvil (Chrome para Android): asistente en 3 pasos{ok ? ' · funciona' : ''}</summary>
    {ok && <p className="note ok"><Check size={14} /> Tu marcador funciona: última caja recibida el {when}.</p>}
    {old && <p className="note warn">Tu marcador es de antes de la versión 0.23.1: abre una ventana nueva, que Chrome para Android bloquea. Repite los pasos 1 y 2 para sustituir su código.</p>}
    <ol className="mk-steps">
      <li className={copied ? 'done' : ''}><b>Copia el código.</b>{' '}
        <button className="btn small" onClick={copy}>{copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar código</>}</button>
        {copied === false && <span className="fine"> No se pudo copiar: usa el botón «Copiar código» de arriba.</span>}</li>
      <li><b>Crea el marcador en Chrome.</b><ol type="a">
        <li>Toca ⋮ (arriba a la derecha) y la estrella ☆: aparece un aviso de marcador guardado.</li>
        <li>Toca «Editar» en ese aviso. Si ya se fue: ⋮ → ★ (estrella rellena) → editar.</li>
        <li>Nombre: <b>nexo</b>. En la URL, borra lo que haya, mantén pulsado y elige «Pegar»: debe empezar por <code>javascript:</code>.</li>
        <li>Vuelve atrás (←): queda guardado.</li>
      </ol></li>
      <li className={ok ? 'done' : ''}><b>Pruébalo.</b>{' '}
        <button className="btn small primary" onClick={() => window.open(PORTAL_BOX, '_blank')}><ExternalLink size={14} /> Abrir mi caja en invokers.com</button>{' '}
        Allí toca la barra de direcciones, escribe <b>nexo</b> y toca la sugerencia con la estrella ★ (no la búsqueda de Google). Nexo se abre en esa pestaña con tu caja y este paso queda marcado.</li>
    </ol>
    {inApp() && <p className="fine">Estás en la app instalada: invokers.com se abrirá dentro de la app, sin barra de direcciones. Toca ⋮ → «Abrir en Chrome» y usa allí el marcador.</p>}
    <details className="mk-help"><summary>Si algo falla</summary><ul>
      <li><b>No aparece la sugerencia:</b> el nombre debe ser exactamente «nexo»; escribe despacio, Chrome tarda unos segundos en ofrecer un marcador nuevo.</li>
      <li><b>Se abre una búsqueda:</b> tocaste la búsqueda; toca la fila con la estrella ★.</li>
      <li><b>No pasa nada:</b> abre el marcador y mira su URL. Si no empieza por <code>javascript:</code>, Chrome no guardó el código: repite el paso 2.</li>
      <li><b>«Usa este marcador en una página de invokers.com»:</b> estabas en otra web.</li>
      <li><b>Pide iniciar sesión:</b> entra en invokers.com y vuelve a tocarlo.</li>
    </ul></details>
    <p className="fine"><b>Atajo sin los pasos 1 y 2:</b> si usas Chrome en un ordenador con la misma cuenta de Google y la sincronización activada, arrastra allí el botón ⚡ Nexo a la barra de marcadores: aparecerá solo en el móvil.</p>
    <p className="fine"><b>¿Prefieres no instalar nada?</b> Con tu enlace guardado, «Actualizar desde invokers.com» (en Inicio) abre tu caja del portal; pulsa «Refresh link» y vuelve a Nexo: la importa sola. Es la instantánea del enlace, sin Account Stats.</p>
  </details>
}

/** Botón para arrastrar a la barra de marcadores, copiar el código y pasos para Android. */
export function MarkletInstall({ label = '⚡ Nexo', onStatus }: { label?: string; onStatus?: (s: string) => void }) {
  const marklet = useMemo(() => bookmarklet(APP()), [])
  const ref = useRef<HTMLAnchorElement>(null)
  const [msg, setMsg] = useState('')
  const say = (s: string) => { setMsg(s); onStatus?.(s) }
  // React no admite `javascript:` en href: se asigna directamente.
  useEffect(() => { ref.current?.setAttribute('href', marklet) }, [marklet])
  const copy = async () => { try { await navigator.clipboard.writeText(marklet); say('Código del marcador copiado.') } catch { say('No se pudo copiar: mantén pulsado el botón y copia el enlace.') } }
  return <div className="marklet">
    <div className="row-actions">
      <a ref={ref} className="btn bookmarklet" onClick={e => { e.preventDefault(); say('En ordenador, arrastra este botón a la barra de marcadores. En el móvil, usa «Copiar código».') }}>{label}</a>
      <button className="btn" onClick={copy}><Copy size={16} /> Copiar código</button>
    </div>
    {msg && !onStatus && <p className="fine" role="status">{msg}</p>}
    <MarkletWizard code={marklet} />
  </div>
}
