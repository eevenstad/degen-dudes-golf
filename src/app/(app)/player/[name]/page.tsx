import { getLeaderboardData } from '@/app/actions/data'
import Link from 'next/link'
import HelpButton from '@/components/HelpButton'

const playerHelpSections = [
  {
    title: 'Player Scorecard',
    content: 'Full hole-by-hole scorecard for this player across all 3 days. Shows gross and net scores. Score colors: 🟡 Eagle, 🔴 Birdie, ⬜ Par, 🟢 Bogey, ⬛ Double+.',
  },
]

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  
  const data = await getLeaderboardData()
  const player = data.players.find(p => p.name === decodedName)

  if (!player) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl font-bold text-white">Player not found</h1>
        <Link href="/leaderboard" className="mt-2 block" style={{ color: '#D4A947' }}>← Back to Leaderboard</Link>
      </div>
    )
  }

  const playerScores = data.scores.filter(s => s.player_id === player.id)

  // ── Stats computation ──────────────────────────────────────────────────────

  // Score shape counts
  let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0
  let totalHolesPlayed = 0

  // Best/worst hole: map from hole_number → { sumDiff, count }
  const holeStats: Record<number, { sumDiff: number; count: number }> = {}

  for (const score of playerScores) {
    const hole = data.holes.find(
      h => h.course_id === score.course_id && h.hole_number === score.hole_number
    )
    if (!hole) continue

    const diff = score.gross_score - hole.par
    totalHolesPlayed++

    if (diff <= -2) eagles++
    else if (diff === -1) birdies++
    else if (diff === 0) pars++
    else if (diff === 1) bogeys++
    else doubles++

    if (!holeStats[score.hole_number]) {
      holeStats[score.hole_number] = { sumDiff: 0, count: 0 }
    }
    holeStats[score.hole_number].sumDiff += diff
    holeStats[score.hole_number].count++
  }

  // Scoring average — only completed rounds (18 holes on a course)
  const completedRoundTotals: number[] = []
  for (const course of data.courses) {
    const courseScores = playerScores.filter(s => s.course_id === course.id)
    if (courseScores.length === 18) {
      const gross = courseScores.reduce((sum, s) => sum + s.gross_score, 0)
      completedRoundTotals.push(gross)
    }
  }
  const scoringAvg =
    completedRoundTotals.length > 0
      ? completedRoundTotals.reduce((a, b) => a + b, 0) / completedRoundTotals.length
      : null

  // Best / worst hole
  let bestHoleNum: number | null = null
  let bestHoleAvg = Infinity
  let worstHoleNum: number | null = null
  let worstHoleAvg = -Infinity

  for (const [holeNumStr, stat] of Object.entries(holeStats)) {
    const holeNum = Number(holeNumStr)
    const avg = stat.sumDiff / stat.count
    if (avg < bestHoleAvg) {
      bestHoleAvg = avg
      bestHoleNum = holeNum
    }
    if (avg > worstHoleAvg) {
      worstHoleAvg = avg
      worstHoleNum = holeNum
    }
  }

  const hasStats = totalHolesPlayed > 0

  // ── Score color helper ─────────────────────────────────────────────────────

  const scoreColor = (gross: number, par: number) => {
    const diff = gross - par
    if (diff <= -2) return '#D4A947'  // eagle = gold
    if (diff === -1) return '#DC2626' // birdie = red
    if (diff === 0) return '#F5E6C3'  // par = cream
    if (diff === 1) return '#9A9A50'  // bogey = olive
    return '#5C5C2E'                  // double+ = dark olive
  }

  return (
    <div className="p-4 space-y-4">
      {/* Player header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">{player.name}</h1>
        <div className="flex items-center justify-center gap-3 mt-1 text-sm">
          <span style={{ color: '#9A9A50' }}>HI: {player.handicap_index}</span>
          {player.team && (
            <span style={{ color: player.team === 'USA' ? '#9A9A50' : '#E09030' }}>
              {player.team === 'USA' ? '🫡' : '🌍'} {player.team}
            </span>
          )}
        </div>
      </div>

      {/* ── Enhanced Stats Section ──────────────────────────────────────────── */}
      {hasStats && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
          {/* Header */}
          <div className="px-3 py-2" style={{ background: '#1A3A2A' }}>
            <span className="font-bold text-sm" style={{ color: '#D4A947' }}>📊 Stats</span>
          </div>

          <div className="p-3 space-y-3" style={{ background: '#1A1A0A' }}>
            {/* Score shape grid */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {/* Eagle */}
              <div className="rounded-lg py-2 px-1" style={{ background: 'rgba(212,169,71,0.08)' }}>
                <div className="text-lg font-bold" style={{ color: '#D4A947' }}>{eagles}</div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: '#D4A947' }}
                  />
                  <span style={{ color: '#9A9A50' }}>Eagle</span>
                </div>
              </div>
              {/* Birdie */}
              <div className="rounded-lg py-2 px-1" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <div className="text-lg font-bold" style={{ color: '#DC2626' }}>{birdies}</div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: '#DC2626' }}
                  />
                  <span style={{ color: '#9A9A50' }}>Birdie</span>
                </div>
              </div>
              {/* Par */}
              <div className="rounded-lg py-2 px-1" style={{ background: 'rgba(245,230,195,0.06)' }}>
                <div className="text-lg font-bold" style={{ color: '#F5E6C3' }}>{pars}</div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: '#F5E6C3' }}
                  />
                  <span style={{ color: '#9A9A50' }}>Par</span>
                </div>
              </div>
              {/* Bogey */}
              <div className="rounded-lg py-2 px-1" style={{ background: 'rgba(154,154,80,0.08)' }}>
                <div className="text-lg font-bold" style={{ color: '#9A9A50' }}>{bogeys}</div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: '#9A9A50' }}
                  />
                  <span style={{ color: '#9A9A50' }}>Bogey</span>
                </div>
              </div>
              {/* Double+ */}
              <div className="rounded-lg py-2 px-1" style={{ background: 'rgba(92,92,46,0.15)' }}>
                <div className="text-lg font-bold" style={{ color: '#5C5C2E' }}>{doubles}</div>
                <div className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: '#5C5C2E' }}
                  />
                  <span style={{ color: '#9A9A50' }}>Dbl+</span>
                </div>
              </div>
            </div>

            {/* Scoring average + holes played */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(26,58,42,0.5)' }}>
                <div className="text-base font-bold text-white">
                  {scoringAvg !== null ? scoringAvg.toFixed(1) : '—'}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#9A9A50' }}>
                  Scoring avg{completedRoundTotals.length > 0 ? ` (${completedRoundTotals.length} rnd${completedRoundTotals.length > 1 ? 's' : ''})` : ''}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(26,58,42,0.5)' }}>
                <div className="text-base font-bold text-white">{totalHolesPlayed}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#9A9A50' }}>Holes played</div>
              </div>
            </div>

            {/* Best / worst hole */}
            {(bestHoleNum !== null || worstHoleNum !== null) && (
              <div className="grid grid-cols-2 gap-2">
                {bestHoleNum !== null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)', borderLeft: '2px solid #DC2626' }}>
                    <div className="text-[10px] font-medium mb-1" style={{ color: '#DC2626' }}>🔥 Best Hole</div>
                    <div className="text-sm font-bold text-white">Hole {bestHoleNum}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      avg {bestHoleAvg >= 0 ? '+' : ''}{bestHoleAvg.toFixed(1)} vs par
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#5C5C2E' }}>
                      {holeStats[bestHoleNum].count}× played
                    </div>
                  </div>
                )}
                {worstHoleNum !== null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(193,122,42,0.08)', borderLeft: '2px solid #C17A2A' }}>
                    <div className="text-[10px] font-medium mb-1" style={{ color: '#C17A2A' }}>💀 Worst Hole</div>
                    <div className="text-sm font-bold text-white">Hole {worstHoleNum}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      avg {worstHoleAvg >= 0 ? '+' : ''}{worstHoleAvg.toFixed(1)} vs par
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#5C5C2E' }}>
                      {holeStats[worstHoleNum].count}× played
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scorecards by round */}
      {data.courses.map(course => {
        const courseHoles = data.holes
          .filter(h => h.course_id === course.id)
          .sort((a, b) => a.hole_number - b.hole_number)
        const courseScores = playerScores.filter(s => s.course_id === course.id)

        if (courseScores.length === 0) return null

        const totalGross = courseScores.reduce((s, sc) => s + sc.gross_score, 0)
        const totalNet = courseScores.reduce((s, sc) => s + (sc.net_score ?? sc.gross_score), 0)
        const totalPar = courseHoles
          .filter(h => courseScores.some(s => s.hole_number === h.hole_number))
          .reduce((s, h) => s + h.par, 0)

        const front9Holes = courseHoles.filter(h => h.hole_number <= 9)
        const back9Holes = courseHoles.filter(h => h.hole_number > 9)

        const renderNine = (holes: typeof courseHoles) => (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: '#9A9A50' }}>
                  <th className="px-1 py-1 text-left">Hole</th>
                  {holes.map(h => (
                    <th key={h.hole_number} className="px-1 py-1 w-7 text-center">{h.hole_number}</th>
                  ))}
                  <th className="px-1 py-1 text-center font-bold">Tot</th>
                </tr>
                <tr style={{ color: '#5C5C2E' }}>
                  <td className="px-1 py-0.5">Par</td>
                  {holes.map(h => (
                    <td key={h.hole_number} className="px-1 py-0.5 text-center">{h.par}</td>
                  ))}
                  <td className="px-1 py-0.5 text-center font-medium">
                    {holes.reduce((s, h) => s + h.par, 0)}
                  </td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-1" style={{ color: '#9A9A50' }}>Gross</td>
                  {holes.map(h => {
                    const score = courseScores.find(s => s.hole_number === h.hole_number)
                    return (
                      <td
                        key={h.hole_number}
                        className="px-1 py-1 text-center font-medium"
                        style={{ color: score ? scoreColor(score.gross_score, h.par) : '#2D4A1E' }}
                      >
                        {score?.gross_score ?? '—'}
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center font-bold text-white">
                    {holes.reduce((s, h) => {
                      const sc = courseScores.find(scr => scr.hole_number === h.hole_number)
                      return s + (sc?.gross_score ?? 0)
                    }, 0) || '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-1 py-1" style={{ color: '#9A9A50' }}>Net</td>
                  {holes.map(h => {
                    const score = courseScores.find(s => s.hole_number === h.hole_number)
                    return (
                      <td key={h.hole_number} className="px-1 py-1 text-center" style={{ color: '#F5E6C3' }}>
                        {score?.net_score ?? '—'}
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center font-bold" style={{ color: '#D4A947' }}>
                    {holes.reduce((s, h) => {
                      const sc = courseScores.find(scr => scr.hole_number === h.hole_number)
                      return s + (sc?.net_score ?? 0)
                    }, 0) || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )

        return (
          <div key={course.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#1A3A2A' }}>
              <span className="font-bold" style={{ color: '#9A9A50' }}>Day {course.day_number}: {course.name}</span>
              <div className="text-xs" style={{ color: '#5C5C2E' }}>
                {courseScores.length}/18 • Gross: {totalGross}
              </div>
            </div>
            <div className="p-2 space-y-1" style={{ background: '#1A1A0A' }}>
              <div className="text-[10px] px-1 font-medium" style={{ color: '#5C5C2E' }}>FRONT 9</div>
              {renderNine(front9Holes)}
              <div className="text-[10px] px-1 font-medium mt-2" style={{ color: '#5C5C2E' }}>BACK 9</div>
              {renderNine(back9Holes)}
            </div>
            <div className="px-3 py-2 flex justify-between text-sm" style={{ background: 'rgba(26,58,42,0.5)' }}>
              <span style={{ color: '#9A9A50' }}>
                Total: <span className="font-bold text-white">{totalGross}</span> gross
              </span>
              <span style={{ color: '#9A9A50' }}>
                Net: <span className="font-bold" style={{ color: '#D4A947' }}>{totalNet}</span>
                {' '}
                <span style={{ color: '#5C5C2E' }}>
                  ({totalNet - totalPar >= 0 ? '+' : ''}{totalNet - totalPar})
                </span>
              </span>
            </div>
          </div>
        )
      })}

      {playerScores.length === 0 && (
        <div className="text-center py-8" style={{ color: '#5C5C2E' }}>No scores recorded yet</div>
      )}
      <HelpButton title="Player Scorecard" sections={playerHelpSections} />
    </div>
  )
}
