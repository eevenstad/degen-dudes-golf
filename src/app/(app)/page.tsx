import Link from 'next/link'
import { getCourses, getSettings, getPlayers, getAllScores } from '@/app/actions/data'

export default async function DashboardPage() {
  const [courses, settings, players, scores] = await Promise.all([
    getCourses(),
    getSettings(),
    getPlayers(),
    getAllScores(),
  ])

  // Determine current day based on which days have scores
  const daysWithScores = new Set(scores.map((s: { courses?: { day_number: number } }) => 
    s.courses?.day_number).filter((d): d is number => d !== undefined))
  const currentDay = daysWithScores.size === 0 ? 1 : Math.max(...Array.from(daysWithScores))
  const currentCourse = courses.find(c => c.day_number === currentDay)

  // Team scores
  const usaPlayers = players.filter(p => p.team === 'USA')
  const europePlayers = players.filter(p => p.team === 'Europe')
  const draftComplete = settings.draft_complete === 'true'

  // Count scores per player to show progress
  const scoresByPlayer = new Map<string, number>()
  scores.forEach((s: { player_id: string; courses?: { day_number: number } }) => {
    if (s.courses?.day_number === currentDay) {
      scoresByPlayer.set(s.player_id, (scoresByPlayer.get(s.player_id) || 0) + 1)
    }
  })

  return (
    <div className="p-4 space-y-6">
      {/* Event header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-yellow-400">
          {settings.event_name || 'Degen Dudes'}
        </h1>
        {currentCourse && (
          <div className="mt-2">
            <span className="text-green-300 text-lg">Day {currentDay}</span>
            <span className="text-green-500 mx-2">•</span>
            <span className="text-white text-lg font-medium">{currentCourse.name}</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/scores"
          className="flex flex-col items-center justify-center p-6 rounded-xl
                     bg-yellow-500 text-green-900 font-bold text-lg
                     hover:bg-yellow-400 active:scale-95 transition-all"
        >
          <span className="text-3xl mb-1">📝</span>
          Enter Scores
        </Link>
        <Link
          href="/leaderboard"
          className="flex flex-col items-center justify-center p-6 rounded-xl
                     bg-green-800 text-white font-bold text-lg border border-green-700
                     hover:bg-green-700 active:scale-95 transition-all"
        >
          <span className="text-3xl mb-1">🏆</span>
          Leaderboard
        </Link>
        <Link
          href="/matches"
          className="flex flex-col items-center justify-center p-6 rounded-xl
                     bg-green-800 text-white font-bold text-lg border border-green-700
                     hover:bg-green-700 active:scale-95 transition-all"
        >
          <span className="text-3xl mb-1">⚔️</span>
          Matches
        </Link>
        <Link
          href="/admin"
          className="flex flex-col items-center justify-center p-6 rounded-xl
                     bg-green-800/50 text-green-300 font-bold text-lg border border-green-800
                     hover:bg-green-700 active:scale-95 transition-all"
        >
          <span className="text-3xl mb-1">⚙️</span>
          Admin
        </Link>
      </div>

      {/* Team standings (if draft complete) */}
      {draftComplete && (
        <div className="rounded-xl border border-green-800 overflow-hidden">
          <div className="bg-green-900 px-4 py-3 text-center font-bold text-yellow-400">
            Team Standings
          </div>
          <div className="grid grid-cols-2 divide-x divide-green-800">
            <div className="p-4 text-center bg-blue-900/30">
              <div className="text-blue-400 font-bold text-xl">🇺🇸 USA</div>
              <div className="text-3xl font-bold text-white mt-1">
                {usaPlayers.length}
              </div>
              <div className="text-green-400 text-sm">players</div>
            </div>
            <div className="p-4 text-center bg-red-900/30">
              <div className="text-red-400 font-bold text-xl">🇪🇺 Europe</div>
              <div className="text-3xl font-bold text-white mt-1">
                {europePlayers.length}
              </div>
              <div className="text-green-400 text-sm">players</div>
            </div>
          </div>
        </div>
      )}

      {/* Day cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-green-300">Tournament Schedule</h2>
        {courses.map(course => {
          const dayScoreCount = scores.filter((s: { courses?: { day_number: number } }) => 
            s.courses?.day_number === course.day_number).length
          const totalPossible = players.length * 18
          const pct = totalPossible > 0 ? Math.round((dayScoreCount / totalPossible) * 100) : 0

          return (
            <div
              key={course.id}
              className={`rounded-xl border p-4 ${
                course.day_number === currentDay
                  ? 'border-yellow-500/50 bg-green-900/80'
                  : 'border-green-800 bg-green-900/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">
                    Day {course.day_number}: {course.name}
                  </div>
                  <div className="text-sm text-green-400">Par {course.par_total}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-green-300">{pct}% complete</div>
                  <div className="text-xs text-green-500">
                    {dayScoreCount}/{totalPossible} scores
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-green-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
