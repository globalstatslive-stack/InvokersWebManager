import { useState } from 'react'
import { useAccount } from './account'
import { Chips, Empty, NeedsAccount, PageHead } from './common'
import { ElementIcon, GameImg, Portrait } from './Art'
import { MODE_LABEL, t } from '../box/i18n'
import type { TeamRecord } from '../box/model'

const time = (s: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—'
export function Teams({ mode }: { mode?: string }) {
  const { account, go } = useAccount()
  if (!account) return <NeedsAccount />
  const teams = account.box.teams
  const modes = [...new Set(teams.map(x => x.mode))]
  const current = mode && modes.includes(mode) ? mode : modes[0]
  if (!teams.length) return <><PageHead kicker="Combate" title="Equipos" /><Empty title="Sin registros de combate">La caja importada no incluye equipos.</Empty></>
  const list = teams.filter(x => x.mode === current)
  const wins = list.reduce((s, x) => s + x.levels.reduce((a, l) => a + l.victories, 0), 0), losses = list.reduce((s, x) => s + x.levels.reduce((a, l) => a + l.defeats, 0), 0)
  return <>
    <PageHead kicker="Combate" title="Equipos y récords">Los equipos con los que lograste tu mejor tiempo en cada modo, tal y como los guarda el juego.</PageHead>
    <Chips label="Modo" value={current} onChange={m => go(`/equipos/${m}`)} options={modes.map(m => ({ id: m, label: t(MODE_LABEL, m) }))} />
    <p className="lead">{list.length} registros · {wins} victorias · {losses} derrotas{wins + losses ? ` · ${Math.round(100 * wins / (wins + losses))} % de éxito` : ''}</p>
    <div className="team-list">{list.map((rec, i) => <TeamCard key={`${rec.key}-${rec.difficulty}-${i}`} rec={rec} />)}</div>
  </>
}
function TeamCard({ rec }: { rec: TeamRecord }) {
  const { account, go } = useAccount()
  const [level, setLevel] = useState(0)
  const l = rec.levels[level]
  const idx = account!.index
  return <article className="panel team-card">
    <div className="team-head">
      {rec.icon ? <GameImg path={rec.icon} alt="" className="boss-icon" /> : rec.element ? <ElementIcon element={rec.element} className="boss-icon" /> : null}
      <div><b>{rec.label}{rec.detail ? ` · ${rec.detail}` : ''}</b><small>{rec.difficulty}{rec.highestLevel ? ` · máximo nivel ${rec.highestLevel}` : ''}</small></div>
    </div>
    {rec.levels.length > 1 && <div className="level-tabs">{rec.levels.slice(0, 12).map((x, i) => <button key={x.level} className={i === level ? 'on' : ''} onClick={() => setLevel(i)}>{x.level}</button>)}</div>}
    {l && <>
      <div className="team-stats"><span>Mejor tiempo <b>{time(l.bestTime)}</b></span><span>Victorias <b>{l.victories}</b></span><span>Derrotas <b>{l.defeats}</b></span>{l.formation && <span>Formación <b>{l.formation}</b></span>}</div>
      <div className="formation">{['front', 'mid', 'back'].map(line => <div key={line} className="line">
        {l.slots.filter(s => s.line === line).map(s => { const h = idx.heroes.get(s.heroId), ti = s.titanId !== null ? idx.titans.get(s.titanId) : undefined
          return <button key={s.position} className="team-slot" onClick={() => h && go(`/invoker/${h.id}`)} disabled={!h}>
            {h ? <Portrait c={h} size="sm" /> : <span className="img-missing portrait sm">?</span>}
            {ti && <span className="titan-mini"><Portrait c={ti} size="sm" /></span>}
            <small>{h?.name ?? 'Ya no está'}</small>
          </button> })}
      </div>)}</div>
    </>}
  </article>
}
