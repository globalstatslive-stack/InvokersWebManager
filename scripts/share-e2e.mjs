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
  console.log('PWA share target: la caja compartida se importa automáticamente y persiste tras recargar.')
} finally { await browser.close() }
