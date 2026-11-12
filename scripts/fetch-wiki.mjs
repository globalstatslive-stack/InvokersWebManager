/** Genera la enciclopedia de Nexo (src/catalog/wiki/) solo con datos oficiales publicados en invokers.com.
 *
 *   · Fichas de Invokers y Titanes: /api/explore/<tipo> y /api/explore/<tipo>/<slug> (estadísticas, tolerancias,
 *     habilidades por nivel, efectos). Los textos de habilidades son los del juego (en inglés); se limpian a un
 *     marcado mínimo (<n> número, <u> mejora, <d> perjuicio, <y> resaltado, <b>, <i>, <br>) sin estilos ni HTML ajeno.
 *   · Tier lists oficiales de Invokers y de Titanes (/tier-list/ y /tier-list/titans/).
 *   · Agujas (/hub/spires/<elemento>-spire/): pisos, enemigos, nivel, PREC, RES y recompensas.
 *   · Calendario de eventos de caza (/events/).
 *   · Tablas de las calculadoras oficiales (/hub/tools/), generadas por el portal a partir de las reglas del juego.
 *   · Equipamiento: tablas de las guías oficiales de reliquias y accesorios.
 *   · Retratos nuevos: se descargan a public/game/characters/ y se añaden al manifiesto con su huella.
 *
 * No copia la prosa de las guías: Nexo enlaza a ellas. Falla (sin escribir nada) si una fuente cambia de forma.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/fetch-wiki.mjs   (en GitHub Actions basta con node) */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const BASE = 'https://invokers.com'
const ROOT = new URL('../', import.meta.url)
const OUT = new URL('src/catalog/wiki/', ROOT)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fail = msg => { throw Error(msg) }

async function get(path, kind = 'text') {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { accept: kind === 'json' ? 'application/json' : 'text/html', 'user-agent': 'Nexo fan site data refresh' } })
      if (!res.ok) throw Error(`${path}: HTTP ${res.status}`)
      return kind === 'json' ? await res.json() : kind === 'bytes' ? Buffer.from(await res.arrayBuffer()) : await res.text()
    } catch (e) {
      if (attempt >= 4) throw e
      await sleep(1000 * 2 ** attempt)
    }
  }
}
const decodeEntities = s => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '‹').replace(/&gt;/g, '›').replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&rarr;/g, '→').replace(/&times;/g, '×').replace(/&amp;/g, '&')
const text = s => decodeEntities(s.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const abs = u => !u ? null : u.startsWith('http') ? u : BASE + u
const codeOf = url => /\/([A-Z0-9]+)\/portrait\.webp/.exec(url ?? '')?.[1] ?? null

/** Props serializadas de las islas de Astro. */
function islands(html) {
  const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const decode = v => Array.isArray(v) && v.length === 2 && (v[0] === 0 || v[0] === 1) ? (v[0] === 1 ? v[1].map(decode) : decode(v[1]))
    : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)])) : v
  const out = {}
  for (const m of html.matchAll(/<astro-island[^>]*component-url="([^"]*)"[^>]*props="([^"]*)"/g)) {
    const name = /\/([A-Za-z]+)\.[a-f0-9]+\.js$/.exec(m[1])?.[1] ?? m[1]
    out[name] = decode(JSON.parse(unescape(m[2])))
  }
  return out
}

/** Descripción de habilidad: marcado mínimo y seguro. */
const COLOR = { '5EEF2C': 'n', '2EB4FF': 'u', 'FF3232': 'd', 'FFE606': 'y' }
function cleanSkill(html) {
  if (!html) return ''
  let s = html.replace(/<strong>\s*<span style="color:#([0-9A-Fa-f]{6});?">([\s\S]*?)<\/span>\s*<\/strong>/g, (_, c, t) => { const k = COLOR[c.toUpperCase()] ?? 'b'; return `<${k}>${t.replace(/<[^>]+>/g, '')}</${k}>` })
  s = s.replace(/<span style="color:#([0-9A-Fa-f]{6});?">([\s\S]*?)<\/span>/g, (_, c, t) => { const k = COLOR[c.toUpperCase()] ?? 'b'; return `<${k}>${t.replace(/<[^>]+>/g, '')}</${k}>` })
  s = s.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>').replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>').replace(/<br\s*\/?>/g, '<br>')
  s = s.replace(/<(?!\/?(?:n|u|d|y|b|i)>|br>)[^>]*>/g, '')
  return decodeEntities(s).trim()
}

const STAT_KEY = { Health: 'health', Attack: 'attack', Defense: 'defense', 'Critical rate': 'criticalRate', 'Critical damage': 'criticalDamage', Accuracy: 'accuracy', Resistance: 'resistance', 'Combo speed': 'comboSpeed', 'Skill speed': 'skillSpeed', 'Skill recovery': 'skillRecovery', 'Mana generation': 'manaGeneration', Instinct: 'instinct', 'Run speed': 'runSpeed', 'Movement speed': 'runSpeed' }
const stats = list => (list ?? []).map(s => ({ key: STAT_KEY[s.label] ?? null, label: s.label, value: s.value, detail: s.detail ?? null }))
const chip = (chips, group) => chips?.find(c => c.group === group)
const effect = e => ({ key: e.key, label: e.label, group: e.group, icon: abs(e.iconUrl), description: e.description ?? null })

function summary(kind, it) {
  const c = it.chips ?? it.heroChips ?? []
  return {
    slug: it.slug, code: codeOf(it.portraitUrl) ?? fail(`${it.slug}: sin código`), name: it.name, short: it.shortName ?? it.name,
    rarity: chip(c, 'Rarity')?.key ?? fail(`${it.slug}: sin rareza`), faction: chip(c, 'Faction')?.key ?? null,
    element: kind === 'invokers' ? chip(c, 'Element')?.key ?? null : null,
    cls: kind === 'invokers' ? chip(c, 'Class')?.key ?? null : null, role: kind === 'titans' ? chip(c, 'Role')?.key ?? null : null,
    soulSign: chip(c, 'Soul Sign') ? { name: chip(c, 'Soul Sign').label, icon: abs(chip(c, 'Soul Sign').iconUrl) } : null,
    tolerances: (it.tolerances ?? []).map(t => t.key),
    fullArt: abs(it.fullArtUrl), portraitUrl: abs(it.portraitUrl),
  }
}
function detail(kind, it, listed) {
  const base = { ...summary(kind, it), short: listed?.shortName ?? it.shortName ?? it.name }
  const skills = (it.skills ?? []).map(sk => {
    // Texto por nivel; el de estadísticas máximas solo en el último nivel (es lo que muestra el portal con «Show Max Stats»).
    const levels = (sk.levels ?? []).map((l, i, all) => ({ level: l.level, crown: !!l.isCrown, cd: l.cooldown ?? null, cost: l.cost ?? null, d: cleanSkill(l.descriptionHtml), ...(i === all.length - 1 ? { dm: cleanSkill(l.descriptionHtmlMax) } : {}) }))
    return {
      name: sk.name, type: sk.type, aoe: !!sk.isAoe, icon: abs(sk.iconUrl), cd: sk.cooldown, cost: sk.cost,
      mana: { ult: sk.manaGenUlt ?? null, titan: sk.manaGenAnima ?? null, ultMax: sk.manaGenUltMax ?? null, titanMax: sk.manaGenAnimaMax ?? null },
      effects: (sk.effects ?? []).map(e => e.key),
      levels: levels.length ? levels : [{ level: 1, crown: false, cd: sk.cooldown, cost: sk.cost, d: cleanSkill(sk.descriptionHtml), dm: cleanSkill(sk.descriptionHtmlMax) }],
    }
  })
  if (!skills.length) fail(`${it.slug}: sin habilidades`)
  return {
    ...base, bio: it.bio ?? null, subtitle: it.subtitle ?? null, fields: (it.sections ?? []).flatMap(s => s.fields.map(f => ({ section: s.title, label: f.label, value: f.value }))),
    stats: stats(it.stats), maxStats: stats(it.maxStats),
    ceilings: Object.fromEntries((it.statCeilings ?? []).map(s => [STAT_KEY[s.label] ?? s.label, s.value])),
    baseCeilings: Object.fromEntries((it.baseStatCeilings ?? []).map(s => [STAT_KEY[s.label] ?? s.label, s.value])),
    tolerances: (it.tolerances ?? []).map(t => ({ key: t.key, label: t.label, icon: abs(t.iconUrl), value: t.value, levels: (t.levels ?? []).map(l => l.value) })),
    corruptions: (it.corruptions ?? []).map(t => ({ key: t.key, label: t.label, icon: abs(t.iconUrl), value: t.value })),
    skills, effects: [...new Map((it.skills ?? []).flatMap(s => s.effects ?? []).map(e => [e.key, effect(e)])).values()],
    official: `${BASE}/${kind}/${(base.faction ?? '').toLowerCase()}/${it.slug}/`,
    comingSoon: it.comingSoonDate ?? null,
  }
}

/** Tier list oficial renderizada en HTML: filas → retratos (código) con nota media. */
function tierList(html) {
  const updated = /<time datetime="([^"]+)"/.exec(html)?.[1] ?? null
  const scope = /<span>Across ([^<]+)<\/span>/.exec(html)?.[1] ?? null
  const rows = []
  for (const m of html.matchAll(/<section class="tl-row[^"]*"[^>]*data-tier-row="([^"]+)"[\s\S]*?<h2 class="tl-row-label"[^>]*>([^<]+)<[\s\S]*?(?=<section class="tl-row|<\/div><\/div><\/div><\/section>|$)/g)) {
    const entries = []
    for (const c of m[0].matchAll(/<a class="cc-card tl-card" href="([^"]+)"[\s\S]*?data-icon-src="([^"]+)"[\s\S]*?<span class="tl-card-rating">([^<]*)<\/span>/g))
      entries.push({ slug: c[1].split('/').filter(Boolean).pop(), code: codeOf(c[2]), score: Number(c[3]) || null })
    rows.push({ key: m[1], label: m[2].trim(), entries })
  }
  if (rows.length < 5 || rows.reduce((s, r) => s + r.entries.length, 0) < 20) fail('Tier list: formato no reconocido')
  return { updated, scope, rows }
}

function spire(html, slug) {
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? fail(`${slug}: sin contenido`)
  const name = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main)?.[1] ?? slug)
  const intro = text(/Can only be accessed by[\s\S]*?<\/p>/.exec(main)?.[0] ?? '')
  const floors = []
  for (const r of main.matchAll(/<tr><th scope="row">(\d+)([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g)) {
    const row = r[3]
    const stat = /Lv (\d+) · ACC (\d+) · RES (\d+)/.exec(text(row)) ?? fail(`${slug} piso ${r[1]}: sin estadísticas`)
    const waves = [...row.matchAll(/<span class="spire-wave( is-boss)?"><span class="spire-wave-name">([^<]*)<\/span>([\s\S]*?)<\/span><\/span>/g)]
      .map(w => ({ name: text(w[2]), boss: !!w[1], enemies: [...w[3].matchAll(/<span class="spire-wave-enemy">([^<]*)/g)].map(e => text(e[1])) }))
    const rewardCell = /<td class="spire-floor-reward">([\s\S]*?)<\/td>/.exec(row)?.[1] ?? ''
    const rewards = [...rewardCell.matchAll(/<span class="guide-drop">[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<\/svg>([^<]*)<\/span>/g)].map(x => ({ item: decodeEntities(x[1]), amount: x[2].trim() }))
    floors.push({
      floor: Number(r[1]), boss: /Boss/.test(r[2]), element: /alt="([^"]+)"/.exec(row)?.[1] ?? null,
      matchup: text(/<span class="spire-matchup[^"]*">([\s\S]*?)<\/span>/.exec(row)?.[1] ?? '') || 'Neutral',
      level: Number(stat[1]), acc: Number(stat[2]), res: Number(stat[3]), waves, rewards,
      firstClear: text(/<span class="spire-reward-first">First clear:([\s\S]*?)<\/span><\/span>/.exec(row)?.[1] ?? '') || null,
    })
  }
  if (floors.length < 100) fail(`${slug}: solo ${floors.length} pisos`)
  return { slug, name, intro, official: `${BASE}/hub/spires/${slug}/`, floors }
}

/** Convierte el literal de tablas del script de calculadoras (solo datos) a JSON sin ejecutarlo. */
function toolTables(js) {
  const start = js.indexOf('{schemaVersion:')
  if (start < 0) fail('Calculadoras: tablas no encontradas')
  let depth = 0, end = start
  for (let i = start; i < js.length; i++) { const ch = js[i]; if (ch === '`') { i = js.indexOf('`', i + 1); continue } if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { end = i + 1; break } }
  let lit = js.slice(start, end)
  lit = lit.replace(/JSON\.parse\(`([^`]*)`\)/g, '$1').replace(/`([^`]*)`/g, (_, s) => JSON.stringify(s))
  lit = lit.replace(/([{,])([A-Za-z_][A-Za-z0-9_]*):/g, '$1"$2":').replace(/([\[,:])\./g, '$10.').replace(/([\[,:])-\./g, '$1-0.').replace(/(\d)e(\d)/g, '$1e+$2')
  const t = JSON.parse(lit)
  for (const k of ['skillRecoveryPct', 'skillSpeedPct', 'resistChanceByDiff', 'elements', 'elementDebuffDelta', 'elementMatchupSign', 'ratingMax', 'arenaInitialCooldownFactor']) if (t[k] === undefined) fail(`Calculadoras: falta ${k}`)
  const tick = /var [A-Za-z]=([0-9.]+);function [A-Za-z]\(e\)\{return Math\.max\(0,1\+/.exec(js)
  return { ...t, tickSeconds: tick ? Number(tick[1]) : fail('Calculadoras: falta el tick') }
}

function tables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(t => [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1].replace(/<br\s*\/?>/g, ' · ').replace(/<\/(?:p|div|span)>(?=\s*<)/g, ' · ')).replace(/( · )+/g, ' · ').replace(/^ · | · $/g, ''))))
}
const matrix = rows => { const [head, ...body] = rows; const first = head.findIndex(h => h === 'ATK+'); return body.map(r => ({ slot: r[first - 1], stats: head.slice(first).filter((_, i) => r[first + i] === '✓') })) }

async function gear() {
  const relics = tables(await get('/guides/relics/')), acc = tables(await get('/guides/accessories/'))
  if (relics.length < 5 || acc.length < 2) fail('Equipamiento: tablas no reconocidas')
  const sets = (rows, kind) => rows.slice(1).map(r => ({ kind, name: r[0], three: r[1], five: r[2], fiveTotal: r[3] || null, where: r[4] }))
  return {
    relicMain: matrix(relics[0]), relicSub: matrix(relics[1]), grades: relics[2].slice(1).map(r => ({ roll: r[0], total: r[1], grade: r[2] })),
    sets: [...sets(relics[3], 'standard'), ...sets(relics[4], 'advanced')],
    accessoryMain: matrix(acc[0]), accessorySub: matrix(acc[1]),
    sources: { relics: `${BASE}/guides/relics/`, accessories: `${BASE}/guides/accessories/` },
  }
}

async function main() {
  const fetchedAt = new Date().toISOString().slice(0, 10)
  const tmp = new URL('src/catalog/wiki.tmp/', ROOT)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(new URL('invokers/', tmp), { recursive: true }); mkdirSync(new URL('titans/', tmp), { recursive: true })
  const index = { source: BASE, fetchedAt, version: null, invokers: [], titans: [], effects: [], tolerances: [] }
  const allDetails = []
  for (const kind of ['invokers', 'titans']) {
    const list = await get(`/api/explore/${kind}`, 'json')
    index.version ??= list.dataset?.key ?? null
    if (kind === 'invokers') {
      index.effects = (list.skillEffectOptions ?? []).map(e => ({ ...effect(e), count: e.count }))
      index.tolerances = (list.toleranceOptions ?? []).map(e => ({ ...effect(e), count: e.count }))
    }
    if ((list.items?.length ?? 0) < (kind === 'invokers' ? 200 : 30)) fail(`${kind}: solo ${list.items?.length} fichas`)
    for (const it of list.items) {
      const d = (await get(`/api/explore/${kind}/${encodeURIComponent(it.slug)}`, 'json')).item ?? fail(`${it.slug}: sin ficha`)
      const det = detail(kind, d, it)
      index[kind].push({ ...summary(kind, it), skills: det.skills.length, aoe: det.skills.some(s => s.aoe), effects: det.effects.map(e => e.key) })
      writeFileSync(new URL(`${kind}/${it.slug}.json`, tmp), JSON.stringify(det))
      allDetails.push({ kind, det })
      await sleep(80)
    }
    console.log(`${kind}: ${list.items.length} fichas`)
  }
  const tiers = { invokers: tierList(await get('/tier-list/')), titans: tierList(await get('/tier-list/titans/')), sources: { invokers: `${BASE}/tier-list/`, titans: `${BASE}/tier-list/titans/` } }
  const spires = []
  for (const el of ['water', 'fire', 'earth', 'wind', 'light', 'dark']) { spires.push(spire(await get(`/hub/spires/${el}-spire/`), `${el}-spire`)); await sleep(150) }
  const ev = islands(await get('/events/'))
  const cal = ev.LiveEventCalendar ?? fail('Eventos: sin calendario')
  const events = {
    source: `${BASE}/events/`, builtAt: cal.builtAt ?? null, divisions: cal.divisions,
    chases: cal.cycles.filter(c => c.chase).map(c => ({
      key: c.key, start: c.start, end: c.end, name: c.chase.name, official: abs(c.chase.href), icon: abs(c.chase.iconUrl),
      currency: c.chase.currency?.plural ?? null, crownsNeeded: c.chase.crownsNeeded, crownsOnOffer: c.chase.crownsOnOffer, leaderboardCrowns: c.chase.leaderboardCrowns,
      hero: c.chase.hero ? { name: c.chase.hero.name, code: codeOf(c.chase.hero.portraitUrl), slug: c.chase.hero.href?.split('/').filter(Boolean).pop() ?? null } : null,
      runs: (c.runs ?? []).map(r => ({ type: r.type, name: r.name, start: r.start, end: r.end, crowns: r.crowns, icon: abs(r.iconUrl) })),
    })),
  }
  const toolsHtml = await get('/hub/tools/')
  const toolsUrl = /component-url="(\/_astro\/ToolsPage\.[a-f0-9]+\.js)"/.exec(toolsHtml)?.[1] ?? fail('Calculadoras: sin script')
  const tools = { source: `${BASE}/hub/tools/`, ...toolTables(await get(toolsUrl)) }
  const gearData = await gear()
  const home = await get('/')
  const guides = [...new Set([...home.matchAll(/href="(\/guides\/[a-z0-9-]+\/)"/g)].map(m => m[1]))].map(p => ({ path: p, url: BASE + p }))

  writeFileSync(new URL('index.json', tmp), JSON.stringify(index))
  writeFileSync(new URL('tiers.json', tmp), JSON.stringify(tiers))
  writeFileSync(new URL('spires.json', tmp), JSON.stringify({ source: `${BASE}/hub/spires/`, fetchedAt, spires }))
  writeFileSync(new URL('events.json', tmp), JSON.stringify(events))
  writeFileSync(new URL('tools.json', tmp), JSON.stringify(tools))
  writeFileSync(new URL('gear.json', tmp), JSON.stringify(gearData))
  writeFileSync(new URL('guides.json', tmp), JSON.stringify({ fetchedAt, guides }))

  // Retratos nuevos: copia local verificada (mismo criterio que el resto de imágenes oficiales).
  const manifestUrl = new URL('docs/game-assets-manifest.json', ROOT)
  const manifest = JSON.parse(readFileSync(manifestUrl))
  const known = new Set(manifest.assets.map(a => a.path))
  let added = 0
  for (const { kind, det } of allDetails) {
    const m = /\/characters\/(.+?\/[A-Z0-9]+\/portrait\.webp)$/.exec(det.portraitUrl ?? '')
    if (!m) continue
    const path = `game/characters/${m[1]}`
    if (known.has(path)) continue
    const source = `https://www.invokers.com/portraits/characters/${m[1]}`
    const bytes = await get(`/portraits/characters/${m[1]}`, 'bytes')
    if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') fail(`${path}: no es WebP`)
    const file = new URL(`public/${path}`, ROOT)
    mkdirSync(dirname(file.pathname), { recursive: true })
    writeFileSync(file, bytes)
    manifest.assets.push({ path, source, sha256: createHash('sha256').update(bytes).digest('hex') })
    known.add(path); added++
    console.log(`retrato nuevo (${kind}): ${path}`)
  }
  if (added) writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n')

  // Catálogo base (characters.json) con lo publicado: nuevos Invokers y Titanes aparecen sin tocar código.
  const ROLE_ICON = { MeleeAttacker: 'melee_attacker', RangedAttacker: 'ranged_attacker', Support: 'support', Tank: 'tank' }
  const characters = allDetails.map(({ kind, det }) => {
    const portrait = `game/characters/${/\/characters\/(.+?\/[A-Z0-9]+\/portrait\.webp)$/.exec(det.portraitUrl ?? '')?.[1] ?? ''}`
    return kind === 'invokers'
      ? { code: det.code, kind, name: det.short, fullName: det.name, slug: det.slug, portrait, rarity: det.rarity, faction: det.faction, role: det.cls, element: det.element, source: det.official, elementIcon: `game/elements/${(det.element ?? '').toLowerCase()}.webp`, factionIcon: `game/factions/${factionCode(det.faction)}/small.webp`, roleIcon: `game/classes/${ROLE_ICON[det.cls] ?? 'support'}.webp` }
      : { code: det.code, kind, name: det.short, fullName: det.name, slug: det.slug, portrait, rarity: det.rarity, faction: det.faction, role: det.role, element: '', source: det.official, factionIcon: `game/factions/${factionCode(det.faction)}/small.webp`, roleIcon: `game/anima_roles/${(det.role ?? '').toLowerCase()}.webp` }
  })
  writeFileSync(new URL('src/catalog/characters.json', ROOT), JSON.stringify(characters, null, 2) + '\n')

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(dirname(OUT.pathname), { recursive: true })
  const { renameSync } = await import('node:fs')
  renameSync(tmp, OUT)
  console.log(`versión ${index.version} · ${index.invokers.length} Invokers · ${index.titans.length} Titanes · ${index.effects.length} efectos · ${spires.length} agujas · ${events.chases.length} cazas · ${added} retratos nuevos`)
}
const FACTION_CODE = { Eldrin: 'ELD', Magi: 'MAG', Stonehearts: 'STO', Freeborn: 'FRB', Beastbloods: 'BST', Nocturna: 'NOC', Ironbands: 'IRN', Cambion: 'CAM', Lightseekers: 'LTS', Dragons: 'DRAGON' }
function factionCode(f) { return FACTION_CODE[f] ?? f }
if (!existsSync(new URL('package.json', ROOT))) fail('Ejecuta desde el repositorio')
await main()
