import { getPlayers, getCourses, getLeaderboardData } from '@/app/actions/data'
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
        <Link href="/leaderboard" className="text-yellow-400 mt-2 block">← Back to Leaderboard</Link>
      </div>
    )
  }

  const playerScores = data.scores.filter(s => s.player_id === player.id)

  return (
    <div className="p-4 space-y-4">
      {/* Player header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">{player.name}</h1>
        <div className="flex items-center justify-center gap-3 mt-1 text-sm text-green-400">
          <span>HI: {player.handicap_index}</span>
          {player.team && (
            <span className={player.team === 'USA' ? 'text-blue-400' : 'text-red-400'}>
              {player.team === 'USA' ? '🇺🇸' : '🇪🇺'} {player.team}
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

        // Split into front 9 and back 9
        const front9Holes = courseHoles.filter(h => h.hole_number <= 9)
        const back9Holes = courseHoles.filter(h => h.hole_number > 9)

        const renderNine = (holes: typeof courseHoles) => (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-green-400">
                  <th className="px-1 py-1 text-left">Hole</th>
                  {holes.map(h => (
                    <th key={h.hole_number} className="px-1 py-1 w-7 text-center">{h.hole_number}</th>
                  ))}
                  <th className="px-1 py-1 text-center font-bold">Tot</th>
                </tr>
                <tr className="text-green-500">
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
                  <td className="px-1 py-1 text-green-400">Gross</td>
                  {holes.map(h => {
                    const score = courseScores.find(s => s.hole_number === h.hole_number)
                    const diff = score ? score.gross_score - h.par : 0
                    return (
                      <td key={h.hole_number} className={`px-1 py-1 text-center font-medium ${
                        !score ? 'text-green-600'
                          : diff < 0 ? 'text-red-400'
                          : diff === 0 ? 'text-green-300'
                          : diff === 1 ? 'text-yellow-400'
                          : 'text-orange-400'
                      }`}>
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
                  <td className="px-1 py-1 text-green-400">Net</td>
                  {holes.map(h => {
                    const score = courseScores.find(s => s.hole_number === h.hole_number)
                    return (
                      <td key={h.hole_number} className="px-1 py-1 text-center text-green-300">
                        {score?.net_score ?? '—'}
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center font-bold text-green-200">
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
          <div key={course.id} className="rounded-xl border border-green-800 overflow-hidden">
            <div className="bg-green-900 px-3 py-2 flex items-center justify-between">
              <span className="font-bold text-green-300">Day {course.day_number}: {course.name}</span>
              <div className="text-xs text-green-400">
                {courseScores.length}/18 • Gross: {totalGross} • Net: {totalNet}
              </div>
            </div>
            <div className="p-2 space-y-1">
              {/* Front 9 */}
              <div className="text-[10px] text-green-500 px-1 font-medium">FRONT 9</div>
              {renderNine(front9Holes)}
              {/* Back 9 */}
              <div className="text-[10px] text-green-500 px-1 font-medium mt-2">BACK 9</div>
              {renderNine(back9Holes)}
            </div>
            {/* Totals */}
            <div className="bg-green-900/50 px-3 py-2 flex justify-between text-sm">
              <span className="text-green-400">
                Total: <span className="text-white font-bold">{totalGross}</span> gross
              </span>
              <span className="text-green-400">
                Net: <span className="text-yellow-400 font-bold">{totalNet}</span>
                {' '}
                <span className="text-green-500">
                  ({totalNet - totalPar >= 0 ? '+' : ''}{totalNet - totalPar})
                </span>
              </span>
            </div>
          </div>
        )
      })}

      {playerScores.length === 0 && (
        <div className="text-center text-green-500 py-8">No scores recorded yet</div>
      )}
    </div>
  )
}
