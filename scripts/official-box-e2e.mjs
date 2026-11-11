import assert from 'node:assert/strict'
import { chromium } from 'playwright'
if (!process.env.NEXO_BOX_JSON) throw Error('Define NEXO_BOX_JSON con la ruta privada del JSON oficial de prueba.')
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
const page=await browser.newPage({viewport:{width:390,height:844}})
try {
 await page.goto(process.env.INVOKERS_TEST_URL || 'http://127.0.0.1:4174/')
 await page.locator('input[aria-label="Seleccionar archivos .dat"]').setInputFiles(process.env.NEXO_BOX_JSON)
 await page.getByRole('dialog',{name:'Revisar archivos'}).waitFor()
 assert.ok((await page.getByRole('dialog').innerText()).includes('Colección interpretada'))
 await page.getByRole('button',{name:'Guardar archivos locales'}).click()
 await page.locator('.character-card').first().waitFor()
 await page.locator('.character-card').first().click()
 await page.getByRole('dialog').waitFor()
 assert.ok(await page.locator('.reported-stats strong').count()>0)
 await page.getByRole('button',{name:'Cerrar ficha'}).click()
 await page.reload()
 await page.locator('.character-card').first().waitFor()
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 console.log('Caja oficial real: importación, ficha, estadísticas publicadas, persistencia y móvil correctos.')
} finally { await browser.close() }
