import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
try {
  await page.goto('http://127.0.0.1:5173/')
  await page.getByRole('heading', { name: 'Tu colección, bajo control.' }).waitFor()
  const names = ['PlayerHeroesModel.dat', 'PlayerAnimasModel.dat', 'PlayerRelicsModel.dat', 'PlayerAccessoriesModel.dat']
  const pick = async (revision) => {
    await page.locator('input[aria-label="Seleccionar archivos .dat"]').setInputFiles(names.map((name, i) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from([i, revision]) })))
    await page.getByRole('dialog', { name: 'Revisar archivos' }).waitFor()
    await page.getByRole('button', { name: 'Guardar archivos locales' }).click()
    await page.getByText('4 archivos guardados', { exact: false }).first().waitFor()
  }
  await pick(1)
  assert.equal(await page.getByText('PlayerHeroesModel.dat', { exact: true }).count(), 1)
  await page.reload()
  await page.getByText('4 archivos guardados', { exact: false }).first().waitFor()
  await pick(2)
  await page.locator('.mobile-nav').getByRole('button', { name: 'Historial' }).click()
  await page.getByText('cambiado').first().waitFor()
  await page.getByRole('button', { name: 'Datos' }).last().click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Borrar todos los datos guardados' }).click()
  await page.getByText('Sin archivos', { exact: true }).waitFor()
  console.log('E2E Chromium móvil: importación, persistencia, comparación y borrado OK')
} finally { await browser.close() }
