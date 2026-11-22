/** Receptor Web Share Target de la PWA. Requiere `npm run build && npm run preview` (INVOKERS_TEST_URL, por defecto :4173). */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { sampleBox } from './sample-box.mjs'
const root = process.env.INVOKERS_TEST_URL || 'http://127.0.0.1:4173/'
const executablePath = [process.env.CHROMIUM_PATH ?? '', '/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(p => p && existsSync(p))
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
try {
  await page.goto(root)
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })) })
  const url = await page.evaluate(async json => {
    const body = new FormData()
    body.append('snapshots', new File([json], 'caja-invokers.json', { type: 'application/json' }))
    return (await fetch('./share', { method: 'POST', body })).url
  }, JSON.stringify(sampleBox()))
  assert(url.includes('shared=1'), `El receptor no redirigió correctamente: ${url}`)
  await page.goto(root + '?shared=1')
  await page.locator('.account-strip').waitFor()
  await page.reload()
  await page.locator('.account-strip').waitFor()
  // Un enlace de caja compartido desde otra app (Compartir → Nexo): se guarda y se importa por el proxy (simulado).
  const shared = { ...sampleBox(), sharing: { snapshotAt: '2026-11-20T10:00:00Z', expiresAt: '2026-11-27T10:00:00Z' } }
  await page.context().route('https://nexo-proxy.globalstatslive.workers.dev/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(shared) }))
  const linkUrl = await page.evaluate(async () => {
    const body = new FormData()
    body.append('title', 'Mi caja'); body.append('text', 'Mira mi caja: https://invokers.com/lamb/?b=prueba-abc')
    return (await fetch('./share', { method: 'POST', body })).url
  })
  assert(linkUrl.includes('shared=1'), `El receptor no aceptó el enlace: ${linkUrl}`)
  await page.goto(root + '?shared=1')
  await page.waitForFunction(() => localStorage.getItem('nexo.link') === 'https://invokers.com/lamb/?b=prueba-abc', null, { timeout: 20000 })
  await page.locator('.account-strip', { hasText: '20 nov' }).waitFor({ timeout: 20000 })
  const bad = await page.evaluate(async () => (await fetch('./share', { method: 'POST', body: (() => { const f = new FormData(); f.append('text', 'sin enlace'); return f })() })).url)
  assert(bad.includes('share_error=1'), 'un texto sin enlace de caja no debe aceptarse')
  console.log('PWA share target: la caja compartida (archivo o enlace) se importa automáticamente y persiste tras recargar.')
} finally { await browser.close() }
