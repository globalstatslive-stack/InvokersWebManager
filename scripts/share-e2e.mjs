import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const root = process.env.INVOKERS_TEST_URL || 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
try {
  await page.goto(root)
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })) })
  const result = await page.evaluate(async () => {
    const body = new FormData()
    for (const [index, name] of ['PlayerHeroesModel.dat', 'PlayerAnimasModel.dat', 'PlayerRelicsModel.dat', 'PlayerAccessoriesModel.dat'].entries()) {
      body.append('snapshots', new File([new Uint8Array([index, 7])], name, { type: 'application/octet-stream' }))
    }
    const response = await fetch('./share', { method: 'POST', body })
    return response.url
  })
  assert(result.includes('shared=1'), `El receptor no redirigió correctamente: ${result}`)
  await page.goto(root + '?shared=1')
  await page.getByRole('dialog', { name: 'Revisar archivos' }).waitFor()
  await page.getByText('Se han leído 4 archivos .dat', { exact: false }).waitFor()
  console.log('PWA share target: cuatro archivos recibidos y vista previa abierta')
} finally { await browser.close() }
