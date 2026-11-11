import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowRight, Coins, Info, Plus, Swords, X } from 'lucide-react'
import { useAccount } from './account'
import { Chips, Empty, GearCard, NeedsAccount, PageHead, Select } from './common'
import { EmptySlot, GearIcon, Portrait, SetIcon, StatIcon, Stars } from './Art'
import { ACCESSORY_SLOTS, CORE_STATS, fmtInt, fmtStat, RELIC_SLOTS, SET_LABEL, SLOT_LABEL, STAT_LABEL, t, TOLERANCES } from '../box/i18n'
import { optimize, PRESETS, presetFor, type Pool } from '../box/optimizer'
import { activeSetBonuses, rating } from '../box/stats'
import { teamHeroIds } from '../box/advisor'
import type { Gear, Hero } from '../box/model'

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

function OptimizerFor({ hero, heroes, onHero }: { hero: Hero; heroes: Hero[]; onHero: (id: number) => void }) {
  const { account, go } = useAccount()
  const { box, index } = account!
  const [preset, setPreset] = useState(presetFor(hero))
  const [objective, setObjective] = useState<'damage' | 'weights'>(presetFor(hero) === 'dps' ? 'damage' : 'weights')
  const [weights, setWeights] = useState<Record<string, number>>(() => ({ ...PRESETS.find(p => p.id === presetFor(hero))!.weights }))
  const [pool, setPool] = useState<Pool>('unlocked')
  const [protectTeams, setProtectTeams] = useState(true)
  const [avoidMoves, setAvoidMoves] = useState(true)
  const [reqSet, setReqSet] = useState('none'), [reqPieces, setReqPieces] = useState<'3' | '5' | '8'>('3')
  const [minimums, setMinimums] = useState<Record<string, number>>({})
  const [newMin, setNewMin] = useState('accuracy')
  const [openGear, setOpenGear] = useState<Gear | null>(null)
  const teamIds = useMemo(() => teamHeroIds(box), [box])
  const opts = useDeferredValue({ objective, weights, pool, protectTeams, avoidMoves, reqSet, reqPieces, minimums })
  const result = useMemo(() => {
    const protectedHeroes = new Set(opts.protectTeams ? [...teamIds].filter(id => id !== hero.id) : [])
    return optimize(index, hero, {
      objective: opts.objective, weights: opts.weights, pool: opts.pool, protectedHeroes, moveAversion: opts.avoidMoves ? 0.35 : 0,
      requiredSet: opts.reqSet === 'none' ? null : { set: opts.reqSet, pieces: Number(opts.reqPieces) as 3 | 5 | 8 }, minimums: opts.minimums,
    })
  }, [index, hero, opts, teamIds])
  const current = index.equipped(hero)
  const proposed = [...Object.values(result.relics), ...Object.values(result.accessories)].filter((x): x is Gear => !!x)
  const setsBefore = activeSetBonuses(current, index.rules), setsAfter = activeSetBonuses(proposed, index.rules)
  const changed = new Set(result.changes.map(c => c.slot))
  const improvement = result.score - result.scoreBefore
  const shownStats = [...CORE_STATS, ...TOLERANCES].filter(s => (result.before[s] ?? 0) !== 0 || (result.after[s] ?? 0) !== 0 || weights[s])
  const sets = box.setRules.map(r => r.set)
  return <>
    <PageHead kicker="Herramientas" title="Optimizador de equipo">Busca la mejor combinación exacta de reliquias, conjuntos y accesorios con tu inventario. Usa la misma fórmula que el juego, comprobada con tu caja.</PageHead>
    <div className="opt-layout">
      <aside className="panel opt-controls">
        <label className="field"><span>Invoker</span>
          <select value={hero.id} onChange={e => onHero(Number(e.target.value))}>{heroes.map(h => <option key={h.id} value={h.id}>{h.name} · {h.rank}★ Nv.{h.level} · {fmtInt(h.power)}</option>)}</select>
        </label>
        <div className="opt-hero"><Portrait c={hero} size="sm" /><span><b>{hero.fullName}</b><small><Stars n={hero.rank} /> · despertar {hero.awakeLevel}</small></span></div>
        <h3 className="sub">Prioridades</h3>
        <Chips label="Perfil" value={preset} onChange={p => { setPreset(p); const found = PRESETS.find(x => x.id === p); if (found) { setWeights({ ...found.weights }); setObjective(p === 'dps' ? 'damage' : 'weights') } }} options={[...PRESETS.map(p => ({ id: p.id, label: p.label })), { id: 'custom', label: 'Personal' }]} />
        <Chips label="Objetivo" value={objective} onChange={v => { setObjective(v); if (v === 'damage' && !weights.damage) setWeights({ ...weights, damage: 10 }) }} options={[{ id: 'damage', label: 'Daño efectivo' }, { id: 'weights', label: 'Solo pesos' }]} />
        {objective === 'damage' && <label className="weight damage"><span><Swords size={16} /> Daño efectivo</span><input type="range" min={0} max={10} value={weights.damage ?? 10} onChange={e => { setPreset('custom'); setWeights({ ...weights, damage: Number(e.target.value) }) }} /><b>{weights.damage ?? 10}</b></label>}
        {objective === 'damage' && <p className="hint">ATQ × (1 + prob. crítico × daño crítico), con el crítico limitado al 100 %. Equilibra ataque y crítico por ti.</p>}
        <div className="weights">{CORE_STATS.filter(s => objective !== 'damage' || !['attack', 'criticalRate', 'criticalDamage'].includes(s)).map(s => <label key={s} className="weight">
          <span><StatIcon stat={s} /> {STAT_LABEL[s]}</span>
          <input type="range" min={0} max={10} step={1} value={weights[s] ?? 0} onChange={e => { setPreset('custom'); setWeights({ ...weights, [s]: Number(e.target.value) }) }} />
          <b>{weights[s] ?? 0}</b>
        </label>)}</div>
        <h3 className="sub">Piezas disponibles</h3>
        <Chips label="Origen" value={pool} onChange={setPool} options={[{ id: 'free', label: 'Solo libres' }, { id: 'unlocked', label: '+ no bloqueados' }, { id: 'all', label: 'Todas' }]} />
        <label className="check"><input type="checkbox" checked={protectTeams} onChange={e => setProtectTeams(e.target.checked)} /> No tocar a Invokers de mis equipos ({teamIds.size})</label>
        <label className="check"><input type="checkbox" checked={avoidMoves} onChange={e => setAvoidMoves(e.target.checked)} /> Evitar mover piezas por mejoras mínimas</label>
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
        <section className="panel">
          <div className="panel-title"><h2>Resultado</h2>
            <span className={`score ${improvement > 0.01 ? 'up' : ''}`}>{improvement > 0.01 ? `+${improvement.toFixed(1)} puntos` : 'Ya es la mejor build con estas opciones'}</span>
          </div>
          <div className="dmg-strip">
            <span><small>Daño efectivo por golpe</small><b>{fmtInt(result.damageBefore)}</b><ArrowRight size={16} /><b className={result.damageAfter > result.damageBefore + 0.5 ? 'up' : result.damageAfter < result.damageBefore - 0.5 ? 'down' : ''}>{fmtInt(result.damageAfter)}</b>{result.damageBefore > 0 && <em className={result.damageAfter >= result.damageBefore ? 'up' : 'down'}>{result.damageAfter >= result.damageBefore ? '+' : ''}{(100 * (result.damageAfter / result.damageBefore - 1)).toFixed(1)} %</em>}</span>
          </div>
          {!result.minimumsMet && <div className="note warn"><Info size={16} /> No se alcanza el mínimo de {result.unmet.map(s => STAT_LABEL[s]).join(', ')} con estas piezas. Se muestra la build más cercana.</div>}
          <div className="compare-doll">
            {[...RELIC_SLOTS, ...ACCESSORY_SLOTS].map(s => {
              const isRelic = RELIC_SLOTS.includes(s)
              const g = (isRelic ? result.relics : result.accessories)[s]
              const change = result.changes.find(c => c.slot === s)
              return <div key={s} className={`cslot ${changed.has(s) ? 'changed' : ''}`}>
                <small>{SLOT_LABEL[s]}</small>
                {g ? <GearIcon g={g} onClick={() => setOpenGear(openGear === g ? null : g)} selected={openGear === g} /> : <EmptySlot slot={s} />}
                {change?.takenFrom && <em className="from">de {change.takenFrom.name}</em>}
              </div>
            })}
          </div>
          {openGear && <GearCard g={openGear} owner={openGear.equippedHeroId !== null ? index.heroes.get(openGear.equippedHeroId)?.name ?? null : null} />}
          <div className="set-compare">
            <div><small>Conjuntos actuales</small>{setsBefore.length ? setsBefore.map(s => <span key={s.set} className="set-chip"><SetIcon set={s.set} />{t(SET_LABEL, s.set)} ×{s.pieces}</span>) : <span className="muted">Ninguno</span>}</div>
            <ArrowRight size={18} />
            <div><small>Propuestos</small>{setsAfter.length ? setsAfter.map(s => <span key={s.set} className="set-chip on"><SetIcon set={s.set} />{t(SET_LABEL, s.set)} ×{s.pieces}</span>) : <span className="muted">Ninguno</span>}</div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Estadísticas</h2><small>actual → propuesta</small></div>
          <table className="stat-table compare"><tbody>{shownStats.map(s => {
            const a = result.before[s] ?? 0, b = result.after[s] ?? 0, d = b - a, r = rating(box, s, b)
            const tol = s.startsWith('critical') || s.endsWith('Tolerance') ? 0.0005 : 0.5
            return <tr key={s} className={weights[s] ? 'weighted' : ''}><td><StatIcon stat={s} /> {STAT_LABEL[s] ?? s}</td><td className="muted">{fmtStat(s, a)}</td><td><b>{fmtStat(s, b)}</b>{r !== null && <small className="rating-pct"> {r} %</small>}</td><td className={Math.abs(d) < tol ? 'muted' : d > 0 ? 'up' : 'down'}>{Math.abs(d) < tol ? '=' : fmtStat(s, d, true)}</td></tr>
          })}</tbody></table>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Cambios a hacer en el juego</h2><span className="gold"><Coins size={16} /> ~{fmtInt(result.goldCost)} oro</span></div>
          {result.changes.length === 0 ? <p className="muted">No hay cambios: tu equipo actual ya es el mejor con estas opciones.</p> :
            <ol className="changes">{result.changes.map(c => <li key={c.slot}>
              <b>{t(SLOT_LABEL, c.slot)}</b>
              <span className="change-pair">{c.from ? <GearIcon g={c.from} size="sm" /> : <span className="muted">vacío</span>}<ArrowRight size={15} />{c.to ? <GearIcon g={c.to} size="sm" /> : <span className="muted">quitar</span>}</span>
              <small>{c.to ? (c.takenFrom ? <>Quitar a <button className="link" onClick={() => go(`/invoker/${c.takenFrom!.id}`)}>{c.takenFrom.name}</button></> : 'Pieza libre') : ''}</small>
            </li>)}</ol>}
          <p className="fine">Nexo no modifica tu cuenta: haz los cambios en el juego y vuelve a actualizar el enlace. El coste de oro es una estimación con los precios de desequipar publicados.</p>
        </section>
      </div>
    </div>
  </>
}
