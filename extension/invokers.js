// Nexo para Invokers: guarda como preset el plan que Nexo envía en el enlace (#nexo-plan=…)
// usando la sesión del jugador en invokers.com, y abre la pestaña Presets del optimizador.
// No equipa nada: aplicar el preset se hace con el botón oficial «Apply».
;(() => {
  const NEXO_ORIGINS = ['https://globalstatslive-stack.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']
  const RELIC = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
  const ACC = ['Amulet', 'Earrings', 'Banner', 'Talisman', 'Flasks']
  const OPEN_FLAG = 'nexo-open-presets'
  const NEXO_APP = 'https://globalstatslive-stack.github.io/InvokersWebManager/'

  function toast(text, bad) {
    const el = document.createElement('div')
    el.textContent = text
    el.setAttribute('role', 'status')
    Object.assign(el.style, { position: 'fixed', zIndex: 2147483647, left: '50%', bottom: '28px', transform: 'translateX(-50%)', maxWidth: '90vw', padding: '12px 18px', borderRadius: '12px', font: '600 14px system-ui, sans-serif', color: bad ? '#ffd4d9' : '#1b1406', background: bad ? '#5a1f2a' : 'linear-gradient(135deg,#f5d895,#e2bd6b)', boxShadow: '0 10px 30px #0008' })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 6000)
  }
  function decode(s) {
    const b = s.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b + '==='.slice((b.length + 3) % 4)), c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  }
  const slotsOk = (o, keys) => o && typeof o === 'object' && Object.entries(o).every(([k, v]) => keys.includes(k) && (v === null || (Number.isSafeInteger(v) && v >= 0)))
  function valid(p) {
    return p && typeof p.name === 'string' && Array.isArray(p.loadouts) && p.loadouts.length > 0 && p.loadouts.length <= 50 &&
      p.loadouts.every(l => Number.isSafeInteger(l.heroId) && slotsOk(l.relics, RELIC) && slotsOk(l.accessories, ACC))
  }
  /** Tras recargar, abre la pestaña «Presets» del optimizador oficial. */
  function openPresets() {
    const started = Date.now()
    const timer = setInterval(() => {
      const tab = [...document.querySelectorAll('button, [role="tab"], a')].find(el => /^presets\b/i.test((el.textContent || '').trim()))
      if (tab) { clearInterval(timer); tab.click(); toast('Nexo: tu plan está en Presets. Pulsa Apply para revisarlo y equiparlo.') }
      else if (Date.now() - started > 15000) clearInterval(timer)
    }, 300)
  }

  /** Botón flotante: envía tu caja en vivo (la misma que muestra «My Box») a la web de Nexo. */
  function liveButton() {
    if (document.getElementById('nexo-live')) return
    const b = document.createElement('button')
    b.id = 'nexo-live'; b.type = 'button'; b.textContent = '⚡ Enviar caja a Nexo'
    Object.assign(b.style, { position: 'fixed', zIndex: 2147483646, right: '18px', bottom: '18px', padding: '10px 16px', borderRadius: '12px', border: '0', cursor: 'pointer', font: '700 14px system-ui, sans-serif', color: '#1b1406', background: 'linear-gradient(135deg,#f5d895,#e2bd6b)', boxShadow: '0 8px 24px #0009' })
    b.addEventListener('click', async () => {
      const app = NEXO_APP, origin = new URL(app).origin
      const w = window.open(app + '#/recibir', 'nexo')
      try {
        const res = await fetch('/api/box', { credentials: 'same-origin' })
        if (res.status === 401) { w && w.close(); toast('Nexo: inicia sesión en invokers.com para enviar tu caja.', true); return }
        if (!res.ok) throw Error('HTTP ' + res.status)
        const json = await res.text()
        if (!w) { toast('Nexo: permite las ventanas emergentes de invokers.com y vuelve a pulsar.', true); return }
        let n = 0
        const timer = setInterval(() => { if (++n > 80) clearInterval(timer); w.postMessage({ type: 'nexo-box', json }, origin) }, 400)
        addEventListener('message', e => { if (e.origin === origin && e.data === 'nexo-ack') clearInterval(timer) })
      } catch (e) { toast('Nexo: no se pudo leer tu caja. ' + (e && e.message ? e.message : ''), true) }
    })
    document.body.appendChild(b)
  }
  liveButton()

  if (sessionStorage.getItem(OPEN_FLAG)) { sessionStorage.removeItem(OPEN_FLAG); openPresets(); return }
  const m = /[#&]nexo-plan=([A-Za-z0-9_-]+)/.exec(location.hash)
  if (!m) return
  history.replaceState(null, '', location.pathname + location.search)
  let plan
  try { plan = decode(m[1]) } catch { toast('Nexo: el plan del enlace no es válido.', true); return }
  if (!valid(plan)) { toast('Nexo: el plan del enlace no es válido.', true); return }
  // Si el enlace no viene de Nexo, se pide confirmación antes de guardar nada.
  const fromNexo = NEXO_ORIGINS.some(o => document.referrer === o || document.referrer.startsWith(o + '/'))
  const changes = plan.loadouts.reduce((s, l) => s + Object.keys(l.relics).length + Object.keys(l.accessories).length, 0)
  if (!fromNexo && !confirm(`Nexo: ¿guardar «${plan.name}» como preset? ${plan.loadouts.length} Invokers · ${changes} cambios. No se equipa nada hasta que pulses Apply.`)) return
  ;(async () => {
    try {
      const res = await fetch('/api/box/presets', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: plan.name.slice(0, 60), category: 'Nexo', loadouts: plan.loadouts.map(l => ({ heroId: l.heroId, relics: l.relics, accessories: l.accessories })) }),
      })
      if (res.status === 401) { toast('Nexo: inicia sesión en invokers.com y vuelve a pulsar «Enviar a invokers.com» en Nexo.', true); return }
      if (!res.ok) { const t = await res.json().catch(() => null); toast(`Nexo: el portal no aceptó el preset (${res.status}). ${(t && t.message) || ''}`, true); return }
      sessionStorage.setItem(OPEN_FLAG, '1')
      location.reload()
    } catch (e) { toast('Nexo: no se pudo guardar el preset. ' + (e && e.message ? e.message : ''), true) }
  })()
})()
