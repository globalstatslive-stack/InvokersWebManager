/** Qué cambia al subir una habilidad, leído del texto oficial de cada nivel (fichas de invokers.com).
 *
 * Cada nivel publica su enfriamiento, su coste de maná y un texto con los efectos entre corchetes ([20% ACC Down]),
 * sus duraciones («lasting 4s») y los multiplicadores de daño, curación o escudo («#1 Damage: 73% ATK + 73% DEF»).
 * Nexo compara dos niveles y enumera lo que cambia, sin interpretar más allá del texto. */
export type SkillLevelText = { level: number; crown: boolean; cd: string | null; cost: string | null; d: string }
export type SkillChange = { what: string; from: string; to: string; better: boolean }

const plain = (html: string) => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const num = (s: string | null | undefined) => { const m = /-?\d+(?:\.\d+)?/.exec(s ?? ''); return m ? Number(m[0]) : null }

/** Efectos con cifra entre corchetes: «[20% ACC Down]» → ACC Down: 20 %; «[140 HP Shield]» → HP Shield: 140. */
function effects(text: string): Map<string, { v: number; unit: string }> {
  const out = new Map<string, { v: number; unit: string }>()
  for (const m of text.matchAll(/\[(\d+(?:\.\d+)?)(%?)\s+([^\]]+)\]/g)) if (!out.has(m[3])) out.set(m[3], { v: Number(m[1]), unit: m[2] ? ' %' : '' })
  return out
}
/** Duración de cada efecto: «[Taunt] debuff …, lasting 4s». */
function durations(text: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of text.matchAll(/\[(?:\d+(?:\.\d+)?%?\s+)?([^\]]+)\][^[]*?lasting (\d+(?:\.\d+)?)s/g)) if (!out.has(m[1])) out.set(m[1], Number(m[2]))
  return out
}
/** Nombres de todos los efectos entre corchetes. */
const names = (text: string) => new Set([...text.matchAll(/\[(?:\d+(?:\.\d+)?%?\s+)?([^\]]+)\]/g)].map(m => m[1]))
/** Multiplicadores por línea («#1 Damage: 73% ATK + 73% DEF»): suma de porcentajes de cada línea, por tipo. */
function modifiers(text: string): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const m of text.matchAll(/\b(Damage|Heal|Healing|Shield)\b[^:.#]{0,24}:\s*([^#]+?)(?=#\d|$)/g)) {
    const kind = m[1].startsWith('Heal') ? 'Heal' : m[1]
    const total = [...m[2].matchAll(/(\d+(?:\.\d+)?)%/g)].reduce((s, x) => s + Number(x[1]), 0)
    out.set(kind, [...(out.get(kind) ?? []), total])
  }
  return out
}
const KIND_ES: Record<string, string> = { Damage: 'Daño', Heal: 'Curación', Shield: 'Escudo' }
const dec = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',')
const pct = (x: number) => `${x >= 0 ? '+' : ''}${dec(100 * x)} %`
const sec = (x: number) => `${dec(x)} s`

/** Cambios de un nivel a otro (normalmente el siguiente). */
export function levelChanges(a: SkillLevelText, b: SkillLevelText): SkillChange[] {
  const out: SkillChange[] = []
  const ta = plain(a.d), tb = plain(b.d)
  const cda = num(a.cd), cdb = num(b.cd)
  if (cda !== null && cdb !== null && cda !== cdb) out.push({ what: 'Enfriamiento', from: sec(cda), to: sec(cdb), better: cdb < cda })
  const ca = num(a.cost), cb = num(b.cost)
  if (ca !== null && cb !== null && ca !== cb && /mana/i.test(`${a.cost} ${b.cost}`)) out.push({ what: 'Maná de la definitiva', from: String(ca), to: String(cb), better: cb < ca })
  // Multiplicadores: media de lo que crece cada línea.
  const ma = modifiers(ta), mb = modifiers(tb)
  for (const [kind, xs] of mb) {
    const ys = ma.get(kind)
    if (!ys || ys.length !== xs.length) continue
    const ratios = xs.map((x, i) => ys[i] ? x / ys[i] - 1 : 0)
    const avg = ratios.reduce((s, x) => s + x, 0) / ratios.length
    if (Math.abs(avg) > 0.0005) out.push({ what: KIND_ES[kind], from: xs.length > 1 ? `${ys.length} golpes` : `${dec(ys[0])} %`, to: xs.length > 1 ? `${pct(avg)} por golpe` : `${dec(xs[0])} % (${pct(avg)})`, better: avg > 0 })
  }
  const ea = effects(ta), eb = effects(tb)
  for (const [k, v] of eb) { const old = ea.get(k); if (old !== undefined && old.v !== v.v) out.push({ what: `[${k}]`, from: `${dec(old.v)}${old.unit}`, to: `${dec(v.v)}${v.unit}`, better: v.v > old.v }) }
  const da = durations(ta), db = durations(tb)
  for (const [k, v] of db) { const old = da.get(k); if (old !== undefined && old !== v) out.push({ what: `Duración de [${k}]`, from: sec(old), to: sec(v), better: v > old }) }
  const na = names(ta)
  for (const k of names(tb)) if (!na.has(k)) out.push({ what: 'Efecto nuevo', from: '—', to: `[${k}]`, better: true })
  return out
}

/** Resumen corto para una tarjeta: los tres cambios más llamativos. */
export function changeSummary(changes: SkillChange[]): string {
  const order = (c: SkillChange) => c.what === 'Efecto nuevo' ? 0 : c.what === 'Enfriamiento' ? 1 : c.what.startsWith('[') ? 2 : c.what.startsWith('Duración') ? 3 : 4
  const lower = (w: string) => w.startsWith('[') ? w : w.charAt(0).toLowerCase() + w.slice(1)
  return [...changes].sort((a, b) => order(a) - order(b)).slice(0, 3).map(c => c.what === 'Efecto nuevo' ? `nuevo ${c.to}` : c.from.endsWith('golpes') ? `${lower(c.what)} ${c.to}` : `${lower(c.what)} ${c.from} → ${c.to}`).join(' · ')
}
