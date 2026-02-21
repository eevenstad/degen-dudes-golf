import { getLeaderboardData } from '@/app/actions/data'
import Link from 'next/link'

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
    </div>
  )
}
