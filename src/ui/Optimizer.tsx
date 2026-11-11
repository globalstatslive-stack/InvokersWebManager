import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Coins, Crosshair, HeartPulse, Info, ListChecks, ListPlus, Plus, Shield, SlidersHorizontal, Swords, Upload, X } from 'lucide-react'
import { useAccount } from './account'
import { Chips, Empty, GearCard, NeedsAccount, PageHead, Select } from './common'
import { EmptySlot, GameImg, GearIcon, Portrait, SetIcon, StatIcon, Stars } from './Art'
import { entryFrom, portalUrl, reservedBy, usePlan, type PlanEntry } from './plan'
import { ACCESSORY_SLOTS, CORE_STATS, fmtInt, fmtStat, RELIC_SLOTS, SET_LABEL, SLOT_LABEL, STAT_LABEL, STAT_SHORT, t, TOLERANCES } from '../box/i18n'
import { optimize, PRESETS, presetFor, type Pool } from '../box/optimizer'
import { activeSetBonuses, rating, type Stats } from '../box/stats'
import { ASSUMPTIONS, DEFAULT_SIM, EFFECT_LABEL, indexOf, loadKits, profileOf, simulate, skillLevels, type Kit, type Mix, type SimResult } from '../box/combat'
import { teamHeroIds } from '../box/advisor'
import type { Box, Gear, Hero } from '../box/model'

const PROPOSAL_STATS = ['attack', 'criticalRate', 'criticalDamage', 'accuracy', 'comboSpeed', 'skillSpeed', 'health']

function PlanPanel({ plan, remove, clear, go }: { plan: PlanEntry[]; remove: (id: number) => void; clear: () => void; go: (p: string) => void }) {
  const [name, setName] = useState(() => `Nexo ${new Date().toLocaleDateString('es-ES')}`)
  const gold = plan.reduce((s, e) => s + e.gold, 0), changes = plan.reduce((s, e) => s + e.changes, 0)
  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.nexoExtension
  return <section className="panel plan">
    <div className="panel-title"><h2><ListChecks size={18} /> Tu plan</h2><small>{plan.length} Invokers · {changes} cambios · ~{fmtInt(gold)} oro</small></div>
    <ul className="plan-list">{plan.map(e => <li key={e.heroId}>
      <button className="link" onClick={() => go(`/optimizador/${e.heroId}`)}><GameImg path={e.portrait} alt="" className="plan-portrait" />{e.name}</button>
      <small>{e.changes} cambios · {fmtInt(e.gold)} oro{e.damageGain ? ` · daño ${e.damageGain >= 0 ? '+' : ''}${(100 * e.damageGain).toFixed(1)} %` : ''}</small>
      <button className="icon-btn" aria-label={`Quitar ${e.name} del plan`} onClick={() => remove(e.heroId)}><X size={15} /></button>
    </li>)}</ul>
    <div className="link-row">
      <input value={name} onChange={e => setName(e.target.value)} aria-label="Nombre del preset" maxLength={60} />
      <a className="btn primary" href={portalUrl(plan, name)} target="_blank" rel="noopener" referrerPolicy="strict-origin"><Upload size={16} /> Enviar a invokers.com</a>
      <button className="btn" onClick={() => { if (confirm('¿Vaciar el plan?')) clear() }}>Vaciar</button>
    </div>
    {hasExtension ? <p className="fine ok-text">✓ Extensión de Nexo instalada: al enviar, el plan se guarda solo y se abre en <b>Presets</b> del optimizador oficial. Solo tienes que pulsar <b>Apply</b>.</p> : <>
      <ol className="steps-mini">
        <li>Pulsa <b>Enviar a invokers.com</b>: se abre el optimizador oficial con tus Invokers (inicia sesión si te lo pide).</li>
        <li>Toca el <b>marcador de Nexo</b> y confirma: el plan queda guardado en <b>Presets</b>.</li>
        <li>En <b>Presets</b>, pulsa <b>Apply</b> para revisar el oro y equipar.</li>
      </ol>
      <p className="fine">¿Sin marcador? Instala la <a href="./nexo-extension.zip" download>extensión de Nexo para Chrome/Edge</a> y el plan aparecerá directamente en Presets (descomprime el archivo, abre <code>chrome://extensions</code>, activa «Modo de desarrollador» y pulsa «Cargar descomprimida»).</p>
    </>}
  </section>
}

export function Optimizer({ heroId }: { heroId?: number }) {
  const { account, go } = useAccount()
  const heroes = useMemo(() => [...(account?.box.heroes ?? [])].filter(h => h.basis && h.gearBonus).sort((a, b) => b.power - a.power), [account])
  if (!account) return <NeedsAccount />
  if (!heroes.length && account.box.merge) return <><PageHead kicker="Herramientas" title="Optimizador" /><Empty title="No se pudo combinar la carpeta con tu enlace">Ningún Invoker de la carpeta del juego coincide con la caja del enlace{account.box.merge.officialSnapshot ? ` del ${new Date(account.box.merge.officialSnapshot).toLocaleDateString('es-ES')}` : ''} ({account.box.merge.changedHeroes} han cambiado de nivel, rango o despertar). Pulsa «Refresh link» en invokers.com e importa el enlace de nuevo.</Empty></>
  if (!heroes.length) return <><PageHead kicker="Herramientas" title="Optimizador" /><Empty title="Importa tu enlace una vez" action={<button className="btn primary" onClick={() => go('/importar')}>Importar enlace</button>}>El optimizador exacto usa las estadísticas base que publica el portal oficial. Importa el enlace de tu caja al menos una vez; después puedes seguir actualizando desde la carpeta del juego.</Empty></>
  const asked = heroId !== undefined ? account.index.heroes.get(heroId) : undefined
  const hero = asked && asked.basis && asked.gearBonus ? asked : heroes[0]
  const merge = account.box.merge
  return <>
    {asked && hero !== asked && <div className="note warn">{asked.name} ha cambiado de nivel, rango o despertar desde tu última importación por enlace, así que su base no es exacta. Pulsa «Refresh link» en invokers.com e importa el enlace para optimizarlo.</div>}
    {merge && merge.changedHeroes > 0 && <div className="note">Combinando tu carpeta del juego con la caja del enlace{merge.officialSnapshot ? ` del ${new Date(merge.officialSnapshot).toLocaleDateString('es-ES')}` : ''}: {merge.exactHeroes} Invokers exactos, {merge.changedHeroes} han cambiado desde entonces (actualiza el enlace para incluirlos).</div>}
    <OptimizerFor key={hero.id} hero={hero} heroes={heroes} onHero={id => go(`/optimizador/${id}`)} />
  </>
}

type Objective = 'sim' | 'damage' | 'weights'
const MIX_KEYS: { key: keyof Mix; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: 'damage', label: 'Daño', icon: <Swords size={15} />, hint: 'Daño total del combate simulado' },
  { key: 'control', label: 'Control', icon: <Crosshair size={15} />, hint: 'Probabilidad de aplicar sus perjuicios al jefe' },
  { key: 'sustain', label: 'Sustento', icon: <HeartPulse size={15} />, hint: 'Curación y escudos que genera' },
  { key: 'tough', label: 'Aguante', icon: <Shield size={15} />, hint: 'Vida y defensa' },
]
const SKILL_TAG: Record<string, string> = { Combo: 'Combo', ActiveSkill1: 'Activa 1', ActiveSkill2: 'Activa 2', ActiveSkill3: 'Activa 3', Ultimate: 'Definitiva' }
const BUMPS: { label: string; apply: (s: Stats, h: Hero) => Stats }[] = [
  { label: '+5 % ATQ', apply: (s, h) => ({ ...s, attack: (s.attack ?? 0) + 0.05 * (h.basis?.attack ?? 0) }) },
  { label: '+5 % DEF', apply: (s, h) => ({ ...s, defense: (s.defense ?? 0) + 0.05 * (h.basis?.defense ?? 0) }) },
  { label: '+5 % VIDA', apply: (s, h) => ({ ...s, health: (s.health ?? 0) + 0.05 * (h.basis?.health ?? 0) }) },
  { label: '+5 pts de prob. crítico', apply: s => ({ ...s, criticalRate: (s.criticalRate ?? 0) + 0.05 }) },
  { label: '+10 pts de daño crítico', apply: s => ({ ...s, criticalDamage: (s.criticalDamage ?? 0) + 0.1 }) },
  { label: '+20 de precisión', apply: s => ({ ...s, accuracy: (s.accuracy ?? 0) + 20 }) },
  { label: '+20 de recuperación', apply: s => ({ ...s, skillRecovery: (s.skillRecovery ?? 0) + 20 }) },
  { label: '+20 de vel. combo', apply: s => ({ ...s, comboSpeed: (s.comboSpeed ?? 0) + 20 }) },
  { label: '+20 de vel. habilidad', apply: s => ({ ...s, skillSpeed: (s.skillSpeed ?? 0) + 20 }) },
  { label: '+20 de gen. maná', apply: s => ({ ...s, manaGeneration: (s.manaGeneration ?? 0) + 20 }) },
]

function CombatPanel({ box, hero, kit, levels, stats, mix, settings, before, sim }: { box: Box; hero: Hero; kit: Kit; levels: number[]; stats: Stats; mix: Mix; settings: { duration: number; targetRes: number }; before: SimResult; sim: SimResult }) {
  const top = Math.max(1, ...sim.skills.map(s => s.damage))
  const gains = useMemo(() => {
    const base = { sim, stats }
    return BUMPS.map(b => { const st = b.apply(stats, hero); return { label: b.label, gain: indexOf(mix, { sim: simulate(box, kit, levels, st, settings), stats: st }, base) - 100 } })
      .filter(g => g.gain > 0.05).sort((a, b) => b.gain - a.gain).slice(0, 6)
  }, [box, hero, kit, levels, stats, mix, settings, sim])
  const delta = before.damage ? 100 * (sim.damage / before.damage - 1) : 0
  return <section className="panel combat">
    <div className="panel-title"><h2><Swords size={18} /> Combate simulado</h2><small>{Math.round(settings.duration / 60)} min contra un jefe de RES {settings.targetRes}</small></div>
    <div className="combat-top">
      <div className="combat-total"><small>Daño total</small><b>{fmtInt(sim.damage)}</b><em className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} %</em><span>{fmtInt(sim.dps)} por segundo</span></div>
      <div className="combat-rates">
        <span>Críticos <b>×{sim.critMultiplier.toFixed(2)}</b></span>
        <span>Recuperación <b>+{(100 * sim.rates.recovery).toFixed(1)} %</b></span>
        <span>Vel. combo <b>+{(100 * sim.rates.combo).toFixed(1)} %</b></span>
        <span>Vel. habilidad <b>+{(100 * sim.rates.skill).toFixed(1)} %</b></span>
        <span>Gen. maná <b>+{(100 * sim.rates.mana).toFixed(1)} %</b></span>
        <span className={sim.land >= 0.8 ? 'up' : sim.land > 0 ? '' : 'down'}>Perjuicios <b>{Math.round(100 * sim.land)} %</b> entran</span>
      </div>
    </div>
    <div className="grid-2 inner">
      <div>
        <h3 className="sub">Daño por habilidad</h3>
        <ul className="skill-bars">{sim.skills.map(s => <li key={s.kind}>
          <span className="skill-tag">{SKILL_TAG[s.kind]}</span>
          <span className="skill-name">{s.name} <small>×{s.casts >= 20 ? Math.round(s.casts) : s.casts.toFixed(1)}{s.cooldown ? ` · cada ${s.cooldown.toFixed(1)} s` : ''}{s.needsAccuracy ? ' · necesita PREC' : ''}</small></span>
          <b>{fmtInt(s.damage)}</b>
          <span className="bar"><i style={{ width: `${Math.max(1, 100 * s.damage / top)}%` }} /></span>
        </li>)}</ul>
        {(sim.heal > 0 || sim.shield > 0) && <p className="fine">Curación {fmtInt(sim.heal)} · Escudos {fmtInt(sim.shield)} en el combate.</p>}
      </div>
      <div>
        <h3 className="sub">Qué estadística rinde más ahora</h3>
        {gains.length ? <ul className="gain-bars">{gains.map(g => <li key={g.label}><span>{g.label}</span><b className="up">+{g.gain.toFixed(1)} %</b><span className="bar"><i style={{ width: `${Math.min(100, 100 * g.gain / gains[0].gain)}%` }} /></span></li>)}</ul> : <p className="muted">Ninguna mejora apreciable.</p>}
        <p className="fine">Ganancia en el índice de este campeón al añadir esa cantidad a la build propuesta.</p>
      </div>
    </div>
    <details className="assumptions"><summary>Cómo se calcula</summary>
      <p>Fórmulas, enfriamientos y maná de cada habilidad a su nivel actual, tomados de la ficha oficial de invokers.com. Reglas oficiales: crítico = daño × (1 + daño crítico), enfriamiento efectivo = base ÷ (1 + recuperación), maná × gen. maná, y la tabla de precisión contra resistencia.</p>
      <p>Supuestos de Nexo (el juego no los publica): un golpe de combo dura {ASSUMPTIONS.hit} s, una habilidad {ASSUMPTIONS.skill} s y la definitiva {ASSUMPTIONS.ultimate} s antes de aplicar velocidades, y cada golpe de combo da el {Math.round(100 * ASSUMPTIONS.comboManaShare)} % del maná indicado para el combo. No incluye la defensa del jefe, mejoras de aliados ni efectos condicionales de las habilidades, así que sirve para comparar builds del mismo campeón.</p>
    </details>
  </section>
}

function OptimizerFor({ hero, heroes, onHero }: { hero: Hero; heroes: Hero[]; onHero: (id: number) => void }) {
  const { account, go } = useAccount()
  const { box, index } = account!
  const [kit, setKit] = useState<Kit | null | undefined>(undefined)
  useEffect(() => { let on = true; void loadKits().then(k => { if (on) setKit(k[hero.code] ?? null) }).catch(() => on && setKit(null)); return () => { on = false } }, [hero.code])
  const levels = useMemo(() => skillLevels(hero), [hero])
  const profile = useMemo(() => kit ? profileOf(hero, kit, levels) : null, [hero, kit, levels])
  const [objective, setObjective] = useState<Objective>('sim')
  const [mix, setMix] = useState<Mix | null>(null)
  useEffect(() => { setMix(profile?.mix ?? null) }, [profile])
  const [duration, setDuration] = useState(DEFAULT_SIM.duration), [targetRes, setTargetRes] = useState(DEFAULT_SIM.targetRes)
  const [preset, setPreset] = useState(presetFor(hero))
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [pool, setPool] = useState<Pool>('unlocked')
  const [protectTeams, setProtectTeams] = useState(true)
  const [avoidMoves, setAvoidMoves] = useState(true)
  const [reqSet, setReqSet] = useState('none'), [reqPieces, setReqPieces] = useState<'3' | '5' | '8'>('3')
  const [minimums, setMinimums] = useState<Record<string, number>>({})
  const [newMin, setNewMin] = useState('accuracy')
  const [maxLevel, setMaxLevel] = useState(false)
  const [sel, setSel] = useState(0)
  const { plan, upsert, remove, clear } = usePlan(box)
  const reserved = useMemo(() => reservedBy(plan, hero.id), [plan, hero.id])
  const teamIds = useMemo(() => teamHeroIds(box), [box])
  const mode: Objective = objective === 'sim' && !(kit && mix) ? 'damage' : objective
  const settings = useMemo(() => ({ duration, targetRes }), [duration, targetRes])
  const opts = useDeferredValue({ mode, mix, settings, weights, pool, protectTeams, avoidMoves, reqSet, reqPieces, minimums, maxLevel, reserved })
  const full = useMemo(() => {
    if (kit === undefined) return null
    const protectedHeroes = new Set(opts.protectTeams ? [...teamIds].filter(id => id !== hero.id) : [])
    const w = opts.mode === 'sim' ? { ...opts.weights, damage: 10 } : opts.mode === 'damage' ? { damage: 10, ...opts.weights } : opts.weights
    return optimize(index, hero, {
      objective: opts.mode, weights: w, pool: opts.pool, protectedHeroes, moveAversion: opts.avoidMoves ? 0.35 : 0,
      requiredSet: opts.reqSet === 'none' ? null : { set: opts.reqSet, pieces: Number(opts.reqPieces) as 3 | 5 | 8 }, minimums: opts.minimums,
      maxLevel: opts.maxLevel, reserved: opts.reserved, alternatives: 7,
      sim: opts.mode === 'sim' && kit && opts.mix ? { kit, levels, settings: opts.settings, mix: opts.mix } : undefined,
    })
  }, [index, hero, opts, teamIds, kit, levels])
  useEffect(() => setSel(0), [full])
  if (!full) return <div className="loading">Cargando las habilidades de {hero.name}…</div>
  const proposals = full.alternatives ?? [full]
  const result = proposals[Math.min(sel, proposals.length - 1)]
  const inPlan = plan.find(e => e.heroId === hero.id)
  const current = index.equipped(hero)
  const proposed = [...Object.values(result.relics), ...Object.values(result.accessories)].filter((x): x is Gear => !!x)
  const setsBefore = activeSetBonuses(current, index.rules), setsAfter = activeSetBonuses(proposed, index.rules)
  const improvement = result.score - result.scoreBefore
  const shownStats = [...CORE_STATS, ...TOLERANCES].filter(s => (result.before[s] ?? 0) !== 0 || (result.after[s] ?? 0) !== 0 || weights[s])
  const sets = box.setRules.map(r => r.set)
  const simMode = mode === 'sim' && !!result.sim
  const scaleLabel = profile ? (['attack', 'defense', 'health'] as const).filter(k => profile.scaling[k] > 0.05).map(k => `${STAT_SHORT[k]} ${Math.round(100 * profile.scaling[k])} %`).join(' · ') : ''
  const setMixKey = (k: keyof Mix, v: number) => { if (!mix) return; const next = { ...mix, [k]: v / 100 }; const sum = next.damage + next.control + next.sustain + next.tough || 1; setMix({ damage: next.damage / sum, control: next.control / sum, sustain: next.sustain / sum, tough: next.tough / sum }) }
  const kept = [...RELIC_SLOTS, ...ACCESSORY_SLOTS].map(s => (RELIC_SLOTS.includes(s) ? result.relics : result.accessories)[s]).filter((g): g is Gear => !!g && !result.changes.some(c => c.to === g))
  return <>
    <PageHead kicker="Herramientas" title="Optimizador de equipo">Optimiza cada campeón según lo que hace de verdad: sus habilidades, de qué escalan, sus enfriamientos y si necesita precisión contra el jefe.</PageHead>
    <section className={`panel champion r-${hero.rarity.toLowerCase()}`}>
      <Portrait c={hero} size="lg" />
      <div className="champion-main">
        <label className="field"><span>Campeón</span>
          <select value={hero.id} onChange={e => onHero(Number(e.target.value))}>{heroes.map(h => <option key={h.id} value={h.id}>{h.name} · {h.rank}★ Nv.{h.level} · {fmtInt(h.power)}</option>)}</select>
        </label>
        <h2>{hero.fullName}</h2>
        <small><Stars n={hero.rank} /> · nivel {hero.level} · despertar {hero.awakeLevel} · habilidades {levels.slice(1, 4).join('/')} · definitiva {levels[4]}</small>
        {profile ? <div className="tags">
          {scaleLabel && <span className="tag-strong">Su daño escala con {scaleLabel}</span>}
          {profile.needsAccuracy && <span className="tag-strong warn">Necesita precisión: {profile.accuracySkills.length} habilidades</span>}
          {profile.heals && <span>Cura</span>}{profile.shields && <span>Da escudos</span>}
          {[...profile.debuffs, ...profile.control, ...profile.buffs].slice(0, 8).map(e => <span key={e}>{EFFECT_LABEL[e] ?? e}</span>)}
        </div> : <p className="fine">No hay ficha de habilidades para este campeón; se usa el daño por golpe.</p>}
      </div>
      {mix && <div className="champion-mix">
        <h3 className="sub">Qué se optimiza</h3>
        {MIX_KEYS.map(m => <label key={m.key} className="weight" title={m.hint}>
          <span>{m.icon} {m.label}</span>
          <input type="range" min={0} max={100} step={5} value={Math.round(100 * mix[m.key])} disabled={mode !== 'sim'} onChange={e => setMixKey(m.key, Number(e.target.value))} />
          <b>{Math.round(100 * mix[m.key])}</b>
        </label>)}
        <button className="link" onClick={() => setMix(profile!.mix)}>Restablecer el reparto del campeón</button>
      </div>}
    </section>
    <div className="opt-layout">
      <aside className="panel opt-controls">
        <h3 className="sub first">Objetivo</h3>
        <Chips label="Objetivo" value={mode} onChange={v => { setObjective(v); if (v === 'weights') { const f = PRESETS.find(x => x.id === preset) ?? PRESETS[0]; setWeights({ ...f.weights, damage: 0 }) } else setWeights({}) }} options={[...(kit ? [{ id: 'sim' as Objective, label: 'Combate simulado' }] : []), { id: 'damage' as Objective, label: 'Daño por golpe' }, { id: 'weights' as Objective, label: 'Pesos' }]} />
        {mode === 'sim' && <>
          <h3 className="sub">Combate</h3>
          <Chips label="Duración" value={String(duration)} onChange={v => setDuration(Number(v))} options={[{ id: '60', label: '1 min' }, { id: '180', label: '3 min' }, { id: '300', label: '5 min' }]} />
          <label className="field res"><span>Resistencia del jefe</span><input type="number" min={0} max={2000} step={5} value={targetRes} onChange={e => setTargetRes(Number(e.target.value) || 0)} /></label>
          <div className="chips-wrap">{[300, 380, 475, 635].map(r => <button key={r} className={`tag-btn ${targetRes === r ? 'on' : ''}`} onClick={() => setTargetRes(r)}>RES {r}</button>)}</div>
          <p className="hint">La RES del jefe aparece en la pantalla previa al combate. Con {fmtInt(result.after.accuracy ?? 0)} de precisión entran el {Math.round(100 * (result.sim?.land ?? 0))} % de los perjuicios{profile?.needsAccuracy && (result.sim?.land ?? 0) < 1 ? `; para el 100 % hacen falta ${targetRes}` : ''}.</p>
        </>}
        {mode === 'weights' && <>
          <h3 className="sub">Perfil</h3>
          <Chips label="Perfil" value={preset} onChange={p => { setPreset(p); const found = PRESETS.find(x => x.id === p); if (found) setWeights({ ...found.weights, damage: 0 }) }} options={[...PRESETS.map(p => ({ id: p.id, label: p.label })), { id: 'custom', label: 'Personal' }]} />
        </>}
        <details className="extra-weights" open={mode === 'weights'}>
          <summary><SlidersHorizontal size={15} /> {mode === 'weights' ? 'Pesos por estadística' : 'Prioridades adicionales'}</summary>
          <div className="weights">{CORE_STATS.map(s => <label key={s} className="weight">
            <span><StatIcon stat={s} /> {STAT_LABEL[s]}</span>
            <input type="range" min={0} max={10} step={1} value={weights[s] ?? 0} onChange={e => { setPreset('custom'); setWeights({ ...weights, [s]: Number(e.target.value) }) }} />
            <b>{weights[s] ?? 0}</b>
          </label>)}</div>
        </details>
        <h3 className="sub">Piezas disponibles</h3>
        <Chips label="Origen" value={pool} onChange={setPool} options={[{ id: 'free', label: 'Solo libres' }, { id: 'unlocked', label: '+ no bloqueados' }, { id: 'all', label: 'Todas' }]} />
        <label className="check"><input type="checkbox" checked={protectTeams} onChange={e => setProtectTeams(e.target.checked)} /> No tocar a Invokers de mis equipos ({teamIds.size})</label>
        <label className="check"><input type="checkbox" checked={avoidMoves} onChange={e => setAvoidMoves(e.target.checked)} /> Evitar mover piezas por mejoras mínimas</label>
        <label className="check"><input type="checkbox" checked={maxLevel} onChange={e => setMaxLevel(e.target.checked)} /> Principales al nivel máximo (si subes las piezas)</label>
        {reserved.size > 0 && <p className="hint">{reserved.size} piezas reservadas por tu plan para otros Invokers.</p>}
        <h3 className="sub">Restricciones</h3>
        <div className="row2">
          <Select label="Conjunto obligatorio" value={reqSet} onChange={setReqSet} options={[{ id: 'none', label: 'Ninguno' }, ...sets.map(s => ({ id: s, label: t(SET_LABEL, s) }))]} />
          {reqSet !== 'none' && <Select label="Piezas" value={reqPieces} onChange={v => setReqPieces(v as '3' | '5' | '8')} options={[{ id: '3', label: '3+' }, { id: '5', label: '5+' }, { id: '8', label: '8' }]} />}
        </div>
        <div className="minimums">{Object.entries(minimums).map(([k, v]) => <div key={k} className="min-row">
          <span>{STAT_LABEL[k]} ≥</span>
          <input type="number" value={k === 'criticalRate' || k === 'criticalDamage' ? Math.round(v * 1000) / 10 : v} onChange={e => setMinimums({ ...minimums, [k]: (k === 'criticalRate' || k === 'criticalDamage') ? Number(e.target.value) / 100 : Number(e.target.value) })} />
          {(k === 'criticalRate' || k === 'criticalDamage') && <small>%</small>}
          <button className="icon-btn" aria-label="Quitar mínimo" onClick={() => { const m = { ...minimums }; delete m[k]; setMinimums(m) }}><X size={15} /></button>
        </div>)}
          <div className="min-row add">
            <select value={newMin} onChange={e => setNewMin(e.target.value)} aria-label="Estadística mínima">{CORE_STATS.filter(s => minimums[s] === undefined).map(s => <option key={s} value={s}>{STAT_LABEL[s]}</option>)}</select>
            <button className="btn small" onClick={() => setMinimums({ ...minimums, [newMin]: Math.round(hero.stats[newMin] ?? 0) })}><Plus size={15} /> Mínimo</button>
          </div>
        </div>
      </aside>
      <div className="opt-results">
        {plan.length > 0 && <PlanPanel plan={plan} remove={remove} clear={clear} go={go} />}
        <section className="panel">
          <div className="panel-title"><h2>Propuestas</h2><small>Toca una para verla{maxLevel ? ' · principales al nivel máximo' : ''}</small></div>
          <div className="table-wrap"><table className="data proposals">
            <thead><tr><th>#</th><th>Conjuntos</th>{simMode && <th>Índice</th>}<th>{simMode ? `Daño ${Math.round(duration / 60)} min` : 'Daño/golpe'}</th>{simMode && <th>Perjuicios</th>}{PROPOSAL_STATS.map(k => <th key={k}>{STAT_SHORT[k]}</th>)}<th>Cambios</th><th>Oro</th></tr></thead>
            <tbody>
              <tr className="current-row"><td>Actual</td><td>{setsBefore.map(x => <span key={x.set} className="set-chip"><SetIcon set={x.set} />×{x.pieces}</span>)}</td>{simMode && <td>100</td>}<td>{fmtInt(simMode ? full.simBefore!.damage : full.damageBefore)}</td>{simMode && <td>{Math.round(100 * full.simBefore!.land)} %</td>}{PROPOSAL_STATS.map(k => <td key={k}>{fmtStat(k, full.before[k] ?? 0)}</td>)}<td>—</td><td>—</td></tr>
              {proposals.map((p, i) => { const ps = [...Object.values(p.relics), ...Object.values(p.accessories)].filter((x): x is Gear => !!x)
                const dmg = simMode ? p.sim!.damage : p.damageAfter, dmg0 = simMode ? p.simBefore!.damage : p.damageBefore
                return <tr key={i} className={i === sel ? 'sel' : ''} onClick={() => setSel(i)}>
                  <td>{i + 1}</td>
                  <td>{activeSetBonuses(ps, index.rules).map(x => <span key={x.set} className="set-chip on"><SetIcon set={x.set} />×{x.pieces}</span>)}</td>
                  {simMode && <td><b className={(p.index ?? 100) > 100.05 ? 'up' : ''}>{(p.index ?? 100).toFixed(1)}</b></td>}
                  <td><b>{fmtInt(dmg)}</b> <small className={dmg >= dmg0 ? 'up' : 'down'}>{dmg0 ? `${dmg >= dmg0 ? '+' : ''}${(100 * (dmg / dmg0 - 1)).toFixed(1)} %` : ''}</small></td>
                  {simMode && <td className={p.sim!.land >= 0.8 ? 'up' : ''}>{Math.round(100 * p.sim!.land)} %</td>}
                  {PROPOSAL_STATS.map(k => { const d = (p.after[k] ?? 0) - (p.before[k] ?? 0); return <td key={k}>{fmtStat(k, p.after[k] ?? 0)}{Math.abs(d) > (k.startsWith('critical') ? 0.0005 : 0.5) && <small className={d > 0 ? 'up' : 'down'}> {fmtStat(k, d, true)}</small>}</td> })}
                  <td>{p.changes.length}</td><td>{fmtInt(p.goldCost)}</td>
                </tr> })}
            </tbody>
          </table></div>
          {simMode && <p className="fine">Índice: 100 es tu equipo actual. Combina daño, control, sustento y aguante con el reparto de este campeón.</p>}
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Propuesta {Math.min(sel, proposals.length - 1) + 1}</h2>
            <span className={`score ${improvement > 0.01 ? 'up' : ''}`}>{simMode ? `Índice ${(result.index ?? 100).toFixed(1)}` : improvement > 0.01 ? `+${improvement.toFixed(1)} puntos` : 'Ya es la mejor build con estas opciones'}</span>
          </div>
          {!result.minimumsMet && <div className="note warn"><Info size={16} /> No se alcanza el mínimo de {result.unmet.map(s => STAT_LABEL[s]).join(', ')} con estas piezas. Se muestra la build más cercana.</div>}
          {simMode && profile?.needsAccuracy && result.sim!.land === 0 && <div className="note warn"><Info size={16} /> Con tus piezas no se llega a la precisión mínima ({targetRes - 120}) para que sus perjuicios entren contra RES {targetRes}. La propuesta prioriza el daño; baja la RES del jefe si vas a usarlo en otro contenido.</div>}
          <div className="set-compare">
            <div><small>Conjuntos actuales</small>{setsBefore.length ? setsBefore.map(s => <span key={s.set} className="set-chip"><SetIcon set={s.set} />{t(SET_LABEL, s.set)} ×{s.pieces}</span>) : <span className="muted">Ninguno</span>}</div>
            <ArrowRight size={18} />
            <div><small>Propuestos</small>{setsAfter.length ? setsAfter.map(s => <span key={s.set} className="set-chip on"><SetIcon set={s.set} />{t(SET_LABEL, s.set)} ×{s.pieces}</span>) : <span className="muted">Ninguno</span>}</div>
          </div>
          <div className="row-actions">
            <button className="btn primary" disabled={!result.changes.length} onClick={() => upsert(entryFrom(hero, result))}><ListPlus size={16} /> {inPlan ? 'Actualizar en el plan' : 'Añadir al plan'}</button>
            {inPlan && <button className="btn" onClick={() => remove(hero.id)}>Quitar del plan</button>}
            <span className="gold"><Coins size={16} /> ~{fmtInt(result.goldCost)} oro · {result.changes.length} cambios</span>
          </div>
        </section>
        {simMode && kit && mix && <CombatPanel box={box} hero={hero} kit={kit} levels={levels} stats={result.after} mix={mix} settings={settings} before={result.simBefore!} sim={result.sim!} />}
        {!simMode && <section className="panel"><div className="dmg-strip">
          <span><small>Daño efectivo por golpe</small><b>{fmtInt(result.damageBefore)}</b><ArrowRight size={16} /><b className={result.damageAfter > result.damageBefore + 0.5 ? 'up' : result.damageAfter < result.damageBefore - 0.5 ? 'down' : ''}>{fmtInt(result.damageAfter)}</b></span>
        </div></section>}
        <section className="panel">
          <div className="panel-title"><h2>Estadísticas</h2><small>actual → propuesta</small></div>
          <table className="stat-table compare"><tbody>{shownStats.map(s => {
            const a = result.before[s] ?? 0, b = result.after[s] ?? 0, d = b - a, r = rating(box, s, b)
            const tol = s.startsWith('critical') || s.endsWith('Tolerance') ? 0.0005 : 0.5
            return <tr key={s} className={weights[s] ? 'weighted' : ''}><td><StatIcon stat={s} /> {STAT_LABEL[s] ?? s}</td><td className="muted">{fmtStat(s, a)}</td><td><b>{fmtStat(s, b)}</b>{r !== null && <small className="rating-pct"> {r} %</small>}</td><td className={Math.abs(d) < tol ? 'muted' : d > 0 ? 'up' : 'down'}>{Math.abs(d) < tol ? '=' : fmtStat(s, d, true)}</td></tr>
          })}</tbody></table>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Piezas de la build</h2><small>{result.changes.length ? `${result.changes.length} cambian · ${kept.length} se quedan` : 'Sin cambios'}</small></div>
          {result.changes.length === 0 && <p className="muted">Tu equipo actual ya es el mejor con estas opciones.</p>}
          {result.changes.map(c => <div key={c.slot} className="swap">
            <div className="swap-side">{c.from ? <GearCard g={c.from} /> : <div className="gear-card ghost">{t(SLOT_LABEL, c.slot)} vacío</div>}</div>
            <ArrowRight size={20} className="swap-arrow" />
            <div className="swap-side">{c.to ? <GearCard g={c.to} owner={c.takenFrom?.name ?? null} extra={<div className="verdict">{c.takenFrom ? <button className="tag sev-2" onClick={() => go(`/invoker/${c.takenFrom!.id}`)}>Quitar a {c.takenFrom.name}</button> : <span className="tag good">Pieza libre</span>}{maxLevel && c.to.mainAtMax && <span className="tag sev-2">Subir al máximo</span>}</div>} /> : <div className="gear-card ghost">Quitar pieza</div>}</div>
          </div>)}
          {kept.length > 0 && <details className="kept"><summary>{kept.length} piezas que se quedan</summary><div className="kept-list">{[...RELIC_SLOTS, ...ACCESSORY_SLOTS].map(s => { const g = (RELIC_SLOTS.includes(s) ? result.relics : result.accessories)[s]; return g && kept.includes(g) ? <GearIcon key={s} g={g} /> : null })}{[...RELIC_SLOTS, ...ACCESSORY_SLOTS].filter(s => !(RELIC_SLOTS.includes(s) ? result.relics : result.accessories)[s] && (RELIC_SLOTS.includes(s) || hero.awakeLevel >= (box.accessorySlotAwake[s] ?? 0))).map(s => <EmptySlot key={s} slot={s} />)}</div></details>}
          <p className="fine">Añade varios Invokers al plan y envíalo a invokers.com como preset para aplicarlo con el botón oficial. El oro es una estimación con los precios de desequipar publicados.</p>
        </section>
      </div>
    </div>
  </>
}
