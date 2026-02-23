import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import HelpButton from '@/components/HelpButton'

const dashboardHelpSections = [
  {
    title: 'The Desert Duel — Home',
    content: 'This is your tournament hub. See the current USA vs Europe score, quick-jump to any page, and check which groups are active. Scores and standings update live as your group plays.',
  },
]

async function getDashboardData() {
  const supabase = createAdminClient()

  const [
    { data: settings },
    { data: courses },
    { data: players },
    { data: matches },
    { data: scores },
    { data: groups },
  ] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('courses').select('*').order('day_number'),
    supabase.from('players').select('*').order('display_order'),
    supabase.from('matches').select(`
      id, group_id, format, team_a_label, team_b_label,
      team_a_points, team_b_points, status,
      match_players(player_id, side, players(name, team)),
      groups!inner(day_number, group_number)
    `),
    supabase.from('scores').select('player_id, hole_number, net_score, gross_score, course_id, courses(day_number)'),
    supabase.from('groups').select(`
      id, day_number, group_number, format,
      group_players(id, player_id, playing_handicap, players(id, name, team))
    `).order('group_number'),
  ])

  const settingsMap: Record<string, string> = {}
  settings?.forEach(s => { settingsMap[s.key] = s.value })

  return { settingsMap, courses: courses || [], players: players || [], matches: matches || [], scores: scores || [], groups: groups || [] }
}

const COURSE_NAMES: Record<number, string> = {
  1: 'Terra Lago North',
  2: 'Terra Lago South',
  3: 'TBD',
}

export default async function DashboardPage() {
  const { settingsMap, courses, players, matches, scores, groups } = await getDashboardData()

  // Current day
  const currentDaySetting = settingsMap['current_day']
  const daysWithScores = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scores.map((s: any) => s.courses?.day_number).filter((d: unknown): d is number => typeof d === 'number')
  )
  const currentDay = currentDaySetting
    ? parseInt(currentDaySetting)
    : daysWithScores.size > 0
      ? Math.max(...Array.from(daysWithScores))
      : 1

  const currentCourse = courses.find(c => c.day_number === currentDay)
  const courseName = currentCourse?.name || COURSE_NAMES[currentDay] || `Day ${currentDay}`

  // Team totals from matches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamATotal = matches.reduce((sum: number, m: any) => sum + (m.team_a_points || 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamBTotal = matches.reduce((sum: number, m: any) => sum + (m.team_b_points || 0), 0)

  const teamALabel = settingsMap['team_a_label'] || 'USA'
  const teamBLabel = settingsMap['team_b_label'] || 'Europe'

  // Top 3 individual players by net score (lowest total net over played holes)
  const playerNetTotals = new Map<string, { net: number; holes: number; name: string; team: string | null }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores.forEach((s: any) => {
    if (s.net_score == null) return
    const existing = playerNetTotals.get(s.player_id)
    if (existing) {
      existing.net += s.net_score
      existing.holes += 1
    } else {
      const player = players.find(p => p.id === s.player_id)
      if (player) {
        playerNetTotals.set(s.player_id, { net: s.net_score, holes: 1, name: player.name, team: player.team })
      }
    }
  })

  const topPlayers = Array.from(playerNetTotals.values())
    .filter(p => p.holes > 0)
    .sort((a, b) => a.net - b.net)
    .slice(0, 3)

  // Groups for current day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentGroups = groups.filter((g: any) => g.day_number === currentDay)

  const formatLabel = (fmt: string) =>
    fmt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="p-4 space-y-5 pb-safe">
      {/* Header with logo */}
      <div className="text-center pt-2">
        <div className="flex justify-center mb-3">
          <Image
            src="/assets/logo.png"
            alt="The Desert Duel"
            width={120}
            height={120}
            className="rounded-2xl shadow-lg shadow-black/50"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#D4A947' }}>
          The Desert Duel
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#9A9A50' }}>
          Palm Springs{' '}
          <Link href="/admin" style={{ color: '#9A9A50', textDecoration: 'none' }}>2026</Link>
        </p>
        {currentCourse && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span style={{ color: '#9A9A50' }} className="text-sm">Day {currentDay}</span>
            <span style={{ color: '#2D4A1E' }}>•</span>
            <span className="text-white text-sm font-medium">{courseName}</span>
          </div>
        )}
      </div>

      {/* Team Score Card */}
      {matches.length > 0 && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#D4A947', borderWidth: 1 }}>
          <div className="text-center py-2 text-xs font-bold tracking-widest" style={{ background: '#8B1A1A', color: '#F5E6C3' }}>
            MATCH POINTS
          </div>
          <div className="grid grid-cols-3" style={{ background: '#1A1A0A' }}>
            <div className="p-5 text-center" style={{ background: 'rgba(92,92,46,0.3)' }}>
              <div className="text-xs font-bold mb-1" style={{ color: '#9A9A50' }}>{teamALabel}</div>
              <div className="text-5xl font-black" style={{ color: '#9A9A50' }}>
                {teamATotal % 1 === 0 ? teamATotal : teamATotal.toFixed(1)}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: '#D4A947' }}>vs</span>
            </div>
            <div className="p-5 text-center" style={{ background: 'rgba(193,122,42,0.3)' }}>
              <div className="text-xs font-bold mb-1" style={{ color: '#E09030' }}>{teamBLabel}</div>
              <div className="text-5xl font-black" style={{ color: '#E09030' }}>
                {teamBTotal % 1 === 0 ? teamBTotal : teamBTotal.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="text-center text-xs py-1.5" style={{ color: '#9A9A50', background: '#1A1A0A' }}>
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} · {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              matches.filter((m: any) => m.status === 'complete').length
            } complete
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/scores"
          className="flex flex-col items-center justify-center p-5 rounded-2xl font-bold text-lg
                     active:scale-95 transition-all"
          style={{ background: '#D4A947', color: '#1A1A0A' }}
        >
          <span className="text-3xl mb-1">📝</span>
          Enter Scores
        </Link>
        <Link
          href="/leaderboard"
          className="flex flex-col items-center justify-center p-5 rounded-2xl font-bold text-lg
                     active:scale-95 transition-all border"
          style={{ background: 'rgba(26,58,42,0.8)', borderColor: '#2D4A1E', color: '#F5E6C3' }}
        >
          <span className="text-3xl mb-1">🏆</span>
          Leaderboard
        </Link>
        <Link
          href="/matches"
          className="flex flex-col items-center justify-center p-5 rounded-2xl font-bold text-lg
                     active:scale-95 transition-all border"
          style={{ background: 'rgba(26,58,42,0.8)', borderColor: '#2D4A1E', color: '#F5E6C3' }}
        >
          <span className="text-3xl mb-1">⚔️</span>
          Matches
        </Link>
        <Link
          href="/scorecards"
          className="flex flex-col items-center justify-center p-5 rounded-2xl font-bold text-lg
                     active:scale-95 transition-all border"
          style={{ background: 'rgba(26,26,10,0.8)', borderColor: '#2D4A1E', color: '#9A9A50' }}
        >
          <span className="text-3xl mb-1">📋</span>
          Scorecards
        </Link>
        <Link
          href="/summary"
          className="col-span-2 flex flex-col items-center justify-center p-4 rounded-2xl font-bold text-lg
                     active:scale-95 transition-all border"
          style={{ background: 'rgba(26,58,42,0.6)', borderColor: '#D4A947', color: '#D4A947' }}
        >
          <span className="text-3xl mb-1">📊</span>
          Day Summary
        </Link>
      </div>

      {/* Groups Status */}
      {currentGroups.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: '#9A9A50' }}>
            Day {currentDay} Groups
          </h2>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {currentGroups.map((group: any) => {
            // Count holes completed for this group
            const playerIds = group.group_players?.map((gp: { player_id: string }) => gp.player_id) || []
            let completedHoles = 0
            for (let h = 1; h <= 18; h++) {
              const allHave = playerIds.every((pid: string) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scores.some((s: any) => s.player_id === pid && s.hole_number === h && s.courses?.day_number === currentDay)
              )
              if (allHave && playerIds.length > 0) completedHoles++
            }

            return (
              <div
                key={group.id}
                className="rounded-xl border p-3"
                style={{ borderColor: '#2D4A1E', background: 'rgba(26,58,42,0.4)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">Group {group.group_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2D4A1E', color: '#9A9A50' }}>
                      {formatLabel(group.format)}
                    </span>
                    {playerIds.length > 0 && (
                      <span className="text-xs" style={{ color: '#D4A947' }}>
                        {completedHoles}/18
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {group.group_players?.map((gp: any) => (
                    <span
                      key={gp.id}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: gp.players?.team === 'USA' ? 'rgba(92,92,46,0.4)' : 'rgba(193,122,42,0.3)',
                        color: gp.players?.team === 'USA' ? '#9A9A50' : '#E09030',
                      }}
                    >
                      {gp.players?.name}
                    </span>
                  ))}
                </div>
                {/* Progress bar */}
                {playerIds.length > 0 && (
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: '#2D4A1E' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(completedHoles / 18) * 100}%`, background: '#D4A947' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Top 3 Individual Leaders */}
      {topPlayers.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: '#9A9A50' }}>
            Individual Leaders
          </h2>
          {topPlayers.map((p, i) => (
            <Link
              key={p.name}
              href={`/player/${encodeURIComponent(p.name)}`}
              className="flex items-center justify-between rounded-xl p-3 border active:scale-[0.99] transition-all"
              style={{ borderColor: '#2D4A1E', background: 'rgba(26,58,42,0.4)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                  style={{
                    background: i === 0 ? '#D4A947' : i === 1 ? '#9A9A50' : '#8B5A1A',
                    color: '#1A1A0A',
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{p.name}</div>
                  <div className="text-xs" style={{ color: p.team === 'USA' ? '#9A9A50' : '#E09030' }}>
                    {p.team || 'No team'} · {p.holes} holes
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black" style={{ color: '#D4A947' }}>{p.net}</div>
                <div className="text-xs" style={{ color: '#9A9A50' }}>net</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <HelpButton title="The Desert Duel — Home" sections={dashboardHelpSections} />
    </div>
  )
}
