// Nexo para Invokers: guarda como preset el plan que Nexo envía en el enlace (#nexo-plan=…)
// usando la sesión del jugador en invokers.com, y abre la pestaña Presets del optimizador.
// No equipa nada: aplicar el preset se hace con el botón oficial «Apply».
;(() => {
  const NEXO_ORIGINS = ['https://globalstatslive-stack.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']
  const RELIC = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots']
  const ACC = ['Amulet', 'Earrings', 'Banner', 'Talisman', 'Flasks']
  const OPEN_FLAG = 'nexo-open-presets'

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
