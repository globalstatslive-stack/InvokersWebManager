/** Prueba funcional en Chrome móvil. Requiere `npm run dev` (o INVOKERS_TEST_URL).
 * Opcional: NEXO_BOX_JSON=/ruta/privada/caja.json para repetirla con una caja real. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { sampleBox } from './sample-box.mjs'

const root = process.env.INVOKERS_TEST_URL || 'http://127.0.0.1:5173/'
const json = process.env.NEXO_BOX_JSON ? readFileSync(process.env.NEXO_BOX_JSON, 'utf8') : JSON.stringify(sampleBox())
const executablePath = [process.env.CHROMIUM_PATH ?? '', '/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(p => p && existsSync(p))
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const errors = []
try {
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(`${root}#/importar`)
  await page.getByRole('heading', { name: 'Importar tu caja' }).waitFor()
  // La pestaña de ordenador muestra la ruta del juego para copiar.
  await page.getByRole('tab', { name: /Desde el juego/ }).click()
  assert.ok((await page.locator('.path-row code').innerText()).includes('Hit_Zone'))
  await page.getByRole('tab', { name: /Con tu enlace/ }).click()
  await page.evaluate(() => document.querySelector('details.other-ways')?.setAttribute('open', ''))
  // 1) Pegar el JSON de la caja.
  await page.getByLabel('Datos de la caja').fill(json)
  await page.getByRole('button', { name: 'Importar texto' }).click()
  await page.locator('.profile-hero').waitFor()
  const name = JSON.parse(json).profile.name
  assert.ok((await page.locator('.profile-copy h1').innerText()).includes(name))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'desbordamiento horizontal en el inicio')
  // 2) Navegación por las secciones principales.
  for (const [hash, selector] of [['#/invokers', '.hero-card'], ['#/titanes', '.titan-card'], ['#/equipo', '.gear-card'], ['#/equipos', '.team-card'], ['#/codice', '.hero-card'], ['#/asesor/revision', '.review-row']]) {
    await page.evaluate(h => { location.hash = h }, hash)
    await page.locator(selector).first().waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `desbordamiento horizontal en ${hash}`)
  }
  // 3) Ficha y optimizador.
  await page.evaluate(() => { location.hash = '#/invokers' })
  await page.locator('.hero-card').first().click()
  await page.getByRole('button', { name: 'Optimizar equipo' }).click()
  await page.locator('.dmg-strip').waitFor()
  await page.locator('.stat-table.compare tr').first().waitFor()
  // 4) Persistencia tras recargar.
  await page.reload()
  await page.locator('.dmg-strip').waitFor()
  // 5) Marcador mágico: una página simulada de invokers.com envía la caja a la web.
  await context.route('https://invokers.com/**', r => new URL(r.request().url()).pathname.startsWith('/api/lamb/')
    ? r.fulfill({ contentType: 'application/json', body: json }) : r.fulfill({ contentType: 'text/html', body: '<p>caja</p>' }))
  await page.evaluate(() => { location.hash = '#/importar' })
  await page.getByRole('tab', { name: /Con tu enlace/ }).click()
  await page.evaluate(() => document.querySelector('details.other-ways')?.setAttribute('open', ''))
  await page.waitForSelector('a.bookmarklet[href^="javascript:"]', { state: 'attached' })
  const code = decodeURIComponent((await page.locator('a.bookmarklet').getAttribute('href')).replace(/^javascript:/, ''))
  const portal = await context.newPage()
  await portal.goto('https://invokers.com/lamb/?b=prueba-abc')
  const popup = context.waitForEvent('page')
  await portal.evaluate(code)
  const received = await popup
  await received.locator('.profile-hero').waitFor({ timeout: 20000 })
  await received.evaluate(() => { location.hash = '#/datos' })
  assert.ok(await received.locator('.records li').count() >= 2, 'el marcador no guardó una segunda importación')
  // 6) Borrado.
  received.once('dialog', d => d.accept())
  await received.getByRole('button', { name: 'Borrar todos los datos' }).click()
  await received.getByRole('heading', { name: 'Importar tu caja' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('E2E móvil: pegar caja, secciones, ficha, optimizador, recarga, marcador mágico y borrado correctos.')
} finally { await browser.close() }
