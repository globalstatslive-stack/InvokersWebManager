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
const context = await browser.newContext({ viewport: { width: Number(process.env.NEXO_WIDTH || 390), height: 844 } })
const errors = []
try {
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(`${root}#/importar`)
  await page.getByRole('heading', { name: 'Importar tu caja' }).waitFor()
  // La pestaña de ordenador muestra la ruta del juego para copiar.
  await page.getByRole('tab', { name: /Carpeta del juego/ }).click()
  assert.ok((await page.locator('.path-row code').innerText()).includes('Hit_Zone'))
  await page.getByRole('tab', { name: /Con tu enlace/ }).click()
  await page.evaluate(() => document.querySelector('details.other-ways')?.setAttribute('open', ''))
  // 1) Pegar el JSON de la caja.
  await page.getByLabel('Datos de la caja').fill(json)
  await page.getByRole('button', { name: 'Importar texto' }).click()
  await page.locator('.account-strip').waitFor()
  const name = JSON.parse(json).profile.name
  assert.ok((await page.locator('.account-strip h1').innerText()).includes(name))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'desbordamiento horizontal en el inicio')
  // 2) Navegación por las secciones principales, sin desbordamiento horizontal.
  for (const [hash, selector] of [['#/coleccion', '.gcard'], ['#/coleccion/piezas', '.gear-list li'], ['#/titanes', '.titan-card'], ['#/equipos', '.team-card'], ['#/codice', '.gcard'], ['#/asesor/revision', '.review-row'], ['#/asesor', '.coach-now .action'], ['#/asesor', '.fronts .front'], ['#/asesor/invokers', '.asc-material'], ['#/asesor/mas/tolerancias', '.tol-picker'], ['#/asesor/piezas/sell', '.verdict-card'], ['#/objetivo', '.boss-card']]) {
    await page.evaluate(h => { location.hash = h }, hash)
    await page.locator(selector).first().waitFor({ timeout: 20000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `desbordamiento horizontal en ${hash}`)
  }
  // Coach de piezas: la primera pieza de la categoría con más piezas se explica (pieza, a favor/en contra, camino de hitos).
  await page.evaluate(() => { location.hash = '#/asesor/piezas' })
  const cards = page.locator('.verdict-card')
  await cards.first().waitFor()
  const counts = await cards.locator('.vc-top b').allInnerTexts()
  await cards.nth(counts.map(c => Number(c.replace(/\D/g, ''))).reduce((bi, c, i, a) => c > a[bi] ? i : bi, 0)).click()
  await page.locator('.coach-row').first().getByRole('button', { name: /Explícamelo/ }).click()
  await page.locator('.lesson .anatomy').waitFor()
  await page.locator('.lesson .upath .node').nth(4).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'desbordamiento horizontal en la explicación de una pieza')
  // Colección: filtros plegables con contador de filtros activos.
  await page.evaluate(() => { location.hash = '#/coleccion' })
  await page.getByRole('button', { name: /Filtros/ }).click()
  await page.getByLabel('Clase').selectOption('RangedAttacker')
  await page.locator('.filter-btn .count').getByText('1').waitFor()
  await page.getByRole('button', { name: /Quitar 1 filtro/ }).click()
  // Pieza libre: «¿a quién le sirve?».
  const freeId = JSON.parse(json).relics.find(r => r.equippedHeroId === null).id
  await page.evaluate(id => { location.hash = `#/pieza/relic-${id}` }, freeId)
  await page.getByRole('heading', { name: '¿A quién le sirve?' }).waitFor()
  // 3) Ficha y optimizador (cálculo en Web Worker).
  await page.evaluate(() => { location.hash = '#/coleccion' })
  await page.locator('.gcard').first().click()
  await page.getByRole('button', { name: 'Optimizar equipo' }).click()
  await page.locator('.combat').waitFor({ timeout: 30000 })
  await page.locator('.stat-table.compare tr').first().waitFor()
  await page.getByRole('button', { name: /Añadir al plan/ }).click()
  await page.getByRole('status').getByText(/Añadido a tu plan|No se añadió/).waitFor()
  // Enciclopedia: datos oficiales, búsqueda, ficha con habilidades por nivel, jefe → objetivo y calculadora.
  for (const hash of ['#/wiki', '#/wiki/titanes', '#/wiki/jefes', '#/wiki/agujas/fire-spire', '#/wiki/eventos', '#/wiki/tier-list', '#/wiki/equipamiento', '#/wiki/efectos', '#/wiki/guias']) {
    await page.evaluate(h => { location.hash = h }, hash)
    await page.locator('h1').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('.loading, .state-card[role=status]'), null, { timeout: 20000 })
    assert.equal(await page.locator('.state-card.bad').count(), 0, `error de datos en ${hash}`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `desbordamiento horizontal en ${hash}`)
  }
  await page.evaluate(() => { location.hash = '#/wiki/invokers' })
  await page.getByLabel('Buscar Invoker').fill('Aethis')
  await page.locator('.gcard').filter({ hasText: 'Aethis' }).first().click()
  await page.getByRole('heading', { name: 'Aethis the Sorrow' }).waitFor()
  const skill = page.locator('.skill-card').nth(1).locator('p').first()
  const atMax = await skill.innerText()
  await page.getByLabel('Nivel').selectOption('1')
  assert.notEqual(await skill.innerText(), atMax, 'el texto de la habilidad no cambia con el nivel')
  await page.evaluate(() => { location.hash = '#/wiki/jefes/ulgorim' })
  await page.getByRole('button', { name: 'Preparar este objetivo' }).click()
  await page.locator('.boss-card').waitFor()
  assert.equal(await page.locator('label.select').filter({ has: page.locator('span', { hasText: /^Jefe$/ }) }).locator('select').inputValue(), 'ulgorim')
  await page.evaluate(() => { location.hash = '#/wiki/herramientas' })
  await page.getByLabel('Tu PREC').fill('400')
  await page.getByLabel('RES del objetivo').fill('450')
  await page.locator('.tool-result b').first().getByText('50 %', { exact: true }).waitFor()
  // Objetivo: jefe y fase oficiales → equipo → diagnóstico → planes → plan.
  await page.evaluate(() => { location.hash = '#/objetivo' })
  await page.locator('.boss-card').waitFor()
  const add = page.getByLabel('Añadir Invoker')
  // Con una caja real el equipo puede venir completo (5) desde el récord de mazmorra.
  for (let i = 0; i < 2 && await add.count(); i++) { const v = await add.locator('option').nth(1).getAttribute('value'); await add.selectOption(v) }
  await page.locator('.diag').nth(1).waitFor()
  await page.getByRole('button', { name: 'Calcular planes del equipo' }).click()
  await page.locator('.plan-option').nth(2).waitFor({ timeout: 180000 })
  assert.equal(await page.locator('.plan-option').count(), 3)
  await page.getByRole('button', { name: /Añadir «Equilibrio» al plan/ }).click()
  await page.getByRole('status').getByText(/Añadido|avisos/).waitFor()
  // Plan: comprobación al reimportar y envío al portal.
  await page.evaluate(() => { location.hash = '#/plan' })
  await page.locator('.plan-row').first().waitFor()
  const planHref = await page.getByRole('link', { name: /Enviar a invokers.com/ }).getAttribute('href')
  assert.ok(planHref.startsWith('https://invokers.com/hub/optimizer/?heroes=') && planHref.includes('&from=Nexo#nexo-plan='), planHref)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'desbordamiento horizontal en el plan')
  // 4) Persistencia tras recargar (el plan también se conserva).
  await page.reload()
  await page.locator('.plan-row').first().waitFor()
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
  await received.locator('.account-strip').waitFor({ timeout: 20000 })
  // 5b) El marcador guarda el plan como preset en el portal (API y optimizador simulados), tras confirmar,
  // abre la pestaña Presets y pulsa «Load» en ese preset, sin recargar.
  let presetBody
  await context.route('https://invokers.com/api/box/presets', r => {
    if (r.request().method() === 'POST') { presetBody = JSON.parse(r.request().postData()); return r.fulfill({ status: 201, contentType: 'application/json', body: '{"id":"p1"}' }) }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ limit: 50, presets: presetBody ? [{ id: 'p0', name: 'Otro', category: 'Nexo' }, { id: 'p1', name: presetBody.name, category: 'Nexo' }] : [] }) })
  })
  await context.route('https://invokers.com/hub/optimizer/**', r => r.fulfill({ contentType: 'text/html', body: `<div role="tablist"><button role="tab">Invokers</button><button role="tab" id="pt">Presets</button></div><ul id="list"></ul>
    <script>document.getElementById('pt').onclick = async () => { const d = await (await fetch('/api/box/presets')).json(); document.getElementById('list').innerHTML = d.presets.map(p => '<li class="opt-preset"><h4>' + p.name + '</h4><button>Load</button><button>Apply</button></li>').join(''); document.querySelectorAll('.opt-preset').forEach(li => li.querySelector('button').onclick = () => { window.loaded = li.querySelector('h4').textContent }) }</script>` }))
  const planPage = await context.newPage()
  const dialogs = []
  planPage.on('dialog', d => { dialogs.push(d.type()); d.accept() })
  await planPage.goto(planHref)
  await planPage.evaluate(code)
  await planPage.waitForFunction(() => window.loaded, null, { timeout: 15000 })
  assert.ok(presetBody, 'el marcador no envió el preset')
  assert.equal(presetBody.category, 'Nexo')
  assert.ok(presetBody.loadouts.length >= 1 && presetBody.loadouts.every(l => Number.isInteger(l.heroId)))
  assert.ok(presetBody.loadouts.some(l => Object.keys(l.relics).length > 0))
  assert.equal(await planPage.evaluate(() => window.loaded), presetBody.name, 'el marcador no cargó el preset guardado')
  assert.deepEqual(dialogs, ['confirm'])
  assert.ok(!(await planPage.evaluate(() => location.hash)).includes('nexo-plan'))
  await planPage.getByRole('status').getByText(/guardado y cargado/).waitFor()
  await received.evaluate(() => { location.hash = '#/datos' })
  assert.ok(await received.locator('.records li').count() >= 2, 'el marcador no guardó una segunda importación')
  // 6) Borrado.
  received.once('dialog', d => d.accept())
  await received.getByRole('button', { name: 'Borrar todos los datos' }).click()
  await received.getByRole('heading', { name: 'Importar tu caja' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('E2E móvil: importar, secciones sin desbordamiento, filtros, pieza, optimizador en worker, enciclopedia (ficha, jefe → objetivo, calculadora), objetivo → planes → plan, recarga, coach (hoy, personajes, piezas explicadas), marcador (caja, preset guardado y cargado) y borrado correctos.')
} finally { await browser.close() }
