import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy } from 'lucide-react'

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
    <details><summary>Instalarlo en el móvil (Chrome para Android)</summary><ol>
      <li>Pulsa «Copiar código».</li>
      <li>En Chrome, guarda cualquier página como marcador (⋮ → ☆) y edítalo: nombre <b>nexo</b>; en la dirección, borra lo que haya y pega el código (empieza por <code>javascript:</code>).</li>
      <li>Abre invokers.com <b>en Chrome</b> con tu sesión iniciada, escribe <b>nexo</b> en la barra de direcciones y toca el marcador en las sugerencias (desde la lista de marcadores Chrome no lo ejecuta). Nexo se abre en esa misma pestaña con tu caja.</li>
    </ol>
      <p className="fine">Si «Enviar a invokers.com» se abre dentro de la app de Nexo, sin barra de direcciones, toca ⋮ → «Abrir en Chrome» y usa allí el marcador. ¿Lo instalaste antes de la versión 0.23.1? Copia el código otra vez y sustitúyelo: el anterior abría una ventana nueva, que Chrome para Android bloquea.</p>
    </details>
  </div>
}
