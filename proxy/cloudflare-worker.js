/**
 * Proxy opcional para importar con un clic desde Nexo.
 * El portal oficial no permite leer /api/lamb/<código> desde otras webs (CORS); este Worker
 * reenvía SOLO esa ruta pública y añade la cabecera CORS para tu dominio de Nexo.
 * No guarda nada y no acepta otras URL.
 *
 * Despliegue (gratuito): Cloudflare → Workers → Create → pega este archivo → Deploy.
 * Después, en Nexo → Importar → Avanzado, guarda la URL del Worker.
 */
const ALLOWED_ORIGINS = ['https://globalstatslive-stack.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? ''
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], 'Access-Control-Allow-Methods': 'GET', 'Vary': 'Origin' }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: cors })
    const slug = new URL(request.url).searchParams.get('b') ?? ''
    if (!/^[A-Za-z0-9_-]{3,200}$/.test(slug)) return new Response('Código de caja no válido', { status: 400, headers: cors })
    const upstream = await fetch(`https://invokers.com/api/lamb/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } })
    return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
  },
}
