'use client'

import { useEffect, useState } from 'react'
import { getMatchesForDay } from '@/app/actions/data'
import { getIslandMatchIds } from '@/app/actions/island'
import { createClient } from '@/lib/supabase/client'

interface Course {
  id: string
  name: string
  day_number: number
  par_total: number
}

interface MatchPlayer {
  player_id: string
  side: 'a' | 'b'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  players: any
}

interface Match {
  id: string
  group_id: string
  match_number: number
  format: string
  team_a_label: string | null
  team_b_label: string | null
  team_a_points: number
  team_b_points: number
  status: string
  point_value: number
  match_players: MatchPlayer[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groups: any
}

interface Props {
  courses: Course[]
}

export default function MatchesClient({ courses }: Props) {
  const [selectedDay, setSelectedDay] = useState(1)
  const [matches, setMatches] = useState<Match[]>([])
  const [islandMatchIds, setIslandMatchIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadMatches = async (day: number) => {
    setLoading(true)
    const [data, islandIds] = await Promise.all([
      getMatchesForDay(day),
      getIslandMatchIds(day),
    ])
    setMatches(data as unknown as Match[])
    setIslandMatchIds(new Set(islandIds))
    setLoading(false)
  }

  useEffect(() => {
    loadMatches(selectedDay)
  }, [selectedDay])

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('matches-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => loadMatches(selectedDay))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches(selectedDay))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedDay])

  const formatLabel = (format: string) =>
    format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="p-4 space-y-4">
      {/* Day tabs */}
      <div className="flex gap-2">
        {courses.map(c => (
          <button
            key={c.day_number}
            onClick={() => setSelectedDay(c.day_number)}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all border"
            style={selectedDay === c.day_number
              ? { background: '#D4A947', color: '#1A1A0A', borderColor: '#D4A947' }
              : { background: '#1A3A2A', color: '#9A9A50', borderColor: '#2D4A1E' }}
          >
            <div>Day {c.day_number}</div>
            <div className="text-xs font-normal mt-0.5 opacity-75">{c.name}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 animate-pulse" style={{ color: '#9A9A50' }}>Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-lg" style={{ color: '#5C5C2E' }}>No matches set up yet</div>
          <div className="text-sm mt-1" style={{ color: '#2D4A1E' }}>Set up groups and matches in Admin</div>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map(match => {
            const sideA = match.match_players?.filter(mp => mp.side === 'a') || []
            const sideB = match.match_players?.filter(mp => mp.side === 'b') || []
            const totalPts = match.team_a_points + match.team_b_points
            const aLeading = match.team_a_points > match.team_b_points
            const bLeading = match.team_b_points > match.team_a_points
            const tied = match.team_a_points === match.team_b_points
            const isIsland = islandMatchIds.has(match.id)

            return (
              <div key={match.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
                {/* Match header */}
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#1A3A2A' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#9A9A50' }}>
                      Group {match.groups?.group_number} • Match {match.match_number}
                    </span>
                    {isIsland && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#C17A2A', color: '#F5E6C3' }}>
                        ISLAND ⚡
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2D4A1E', color: '#9A9A50' }}>
                      {formatLabel(match.format)}
                    </span>
                    {match.point_value > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#D4A947', color: '#1A1A0A' }}>
                        {match.point_value}pt
                      </span>
                    )}
                  </div>
                </div>

                {/* Score display */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center p-4 gap-3" style={{ background: '#1A1A0A' }}>
                  {/* Side A */}
                  <div style={{ opacity: aLeading ? 1 : 0.7 }}>
                    <div className="space-y-1">
                      {sideA.map(mp => (
                        <div key={mp.player_id} className="font-medium text-white text-sm">
                          {mp.players?.name || '?'}
                        </div>
                      ))}
                    </div>
                    {match.team_a_label && (
                      <div className="text-xs mt-1" style={{ color: '#9A9A50' }}>{match.team_a_label}</div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-center">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: aLeading ? '#D4A947' : '#F5E6C3' }}>
                        {match.team_a_points}
                      </span>
                      <span style={{ color: '#2D4A1E' }}>-</span>
                      <span className="text-2xl font-bold" style={{ color: bLeading ? '#D4A947' : '#F5E6C3' }}>
                        {match.team_b_points}
                      </span>
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{
                        color: match.status === 'complete' ? '#D4A947'
                          : match.status === 'in_progress' ? '#9A9A50'
                          : '#2D4A1E',
                      }}
                    >
                      {match.status === 'complete' ? 'FINAL'
                        : match.status === 'in_progress' ? `${totalPts} pts`
                        : 'Not Started'}
                    </div>
                  </div>

                  {/* Side B */}
                  <div className="text-right" style={{ opacity: bLeading ? 1 : 0.7 }}>
                    <div className="space-y-1">
                      {sideB.map(mp => (
                        <div key={mp.player_id} className="font-medium text-white text-sm">
                          {mp.players?.name || '?'}
                        </div>
                      ))}
                    </div>
                    {match.team_b_label && (
                      <div className="text-xs mt-1" style={{ color: '#E09030' }}>{match.team_b_label}</div>
                    )}
                  </div>
                </div>

                {/* Match status bar */}
                {match.status === 'in_progress' && totalPts > 0 && (
                  <div className="px-4 pb-3" style={{ background: '#1A1A0A' }}>
                    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: '#1A3A2A' }}>
                      {match.team_a_points > 0 && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${(match.team_a_points / Math.max(totalPts, 1)) * 100}%`,
                            background: '#9A9A50',
                          }}
                        />
                      )}
                      {tied && totalPts > 0 && (
                        <div className="h-full flex-1" style={{ background: '#D4A947' }} />
                      )}
                      {match.team_b_points > 0 && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${(match.team_b_points / Math.max(totalPts, 1)) * 100}%`,
                            background: '#C17A2A',
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
