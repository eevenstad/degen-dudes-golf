'use client'

import { useEffect, useState } from 'react'
import { getMatchesForDay } from '@/app/actions/data'
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
  const [loading, setLoading] = useState(true)

  const loadMatches = async (day: number) => {
    setLoading(true)
    const data = await getMatchesForDay(day)
    setMatches(data as unknown as Match[])
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => { loadMatches(selectedDay) }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => { loadMatches(selectedDay) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedDay])

  const formatLabel = (format: string) =>
    format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const course = courses.find(c => c.day_number === selectedDay)

  return (
    <div className="p-4 space-y-4">
      {/* Day tabs */}
      <div className="flex gap-2">
        {courses.map(c => (
          <button
            key={c.day_number}
            onClick={() => setSelectedDay(c.day_number)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              selectedDay === c.day_number
                ? 'bg-yellow-500 text-green-900'
                : 'bg-green-800 text-green-300 border border-green-700'
            }`}
          >
            <div>Day {c.day_number}</div>
            <div className="text-xs font-normal mt-0.5 opacity-75">{c.name}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-green-400 py-8 animate-pulse">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-green-500 text-lg">No matches set up yet</div>
          <div className="text-green-600 text-sm mt-1">Set up groups and matches in Admin</div>
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

            return (
              <div key={match.id} className="rounded-xl border border-green-800 overflow-hidden">
                {/* Match header */}
                <div className="bg-green-900 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-green-400">
                    Group {match.groups?.group_number} • Match {match.match_number}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-700 text-green-300">
                    {formatLabel(match.format)}
                  </span>
                </div>

                {/* Score display */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center p-4 gap-3">
                  {/* Side A */}
                  <div className={`text-left ${aLeading ? 'opacity-100' : 'opacity-75'}`}>
                    <div className="space-y-1">
                      {sideA.map(mp => (
                        <div key={mp.player_id} className="font-medium text-white text-sm">
                          {mp.players?.name || '?'}
                        </div>
                      ))}
                    </div>
                    {match.team_a_label && (
                      <div className="text-xs text-green-500 mt-1">{match.team_a_label}</div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${aLeading ? 'text-yellow-400' : 'text-white'}`}>
                        {match.team_a_points}
                      </span>
                      <span className="text-green-600">-</span>
                      <span className={`text-2xl font-bold ${bLeading ? 'text-yellow-400' : 'text-white'}`}>
                        {match.team_b_points}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      match.status === 'complete' ? 'text-yellow-400' 
                        : match.status === 'in_progress' ? 'text-green-400'
                        : 'text-green-600'
                    }`}>
                      {match.status === 'complete' ? 'FINAL'
                        : match.status === 'in_progress' ? `${totalPts} holes`
                        : 'Not Started'}
                    </div>
                  </div>

                  {/* Side B */}
                  <div className={`text-right ${bLeading ? 'opacity-100' : 'opacity-75'}`}>
                    <div className="space-y-1">
                      {sideB.map(mp => (
                        <div key={mp.player_id} className="font-medium text-white text-sm">
                          {mp.players?.name || '?'}
                        </div>
                      ))}
                    </div>
                    {match.team_b_label && (
                      <div className="text-xs text-green-500 mt-1">{match.team_b_label}</div>
                    )}
                  </div>
                </div>

                {/* Match status bar */}
                {match.status === 'in_progress' && (
                  <div className="px-4 pb-3">
                    <div className="h-2 bg-green-800 rounded-full overflow-hidden flex">
                      {match.team_a_points > 0 && (
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(match.team_a_points / Math.max(totalPts, 1)) * 100}%` }}
                        />
                      )}
                      {tied && totalPts > 0 && (
                        <div className="h-full bg-green-500 flex-1" />
                      )}
                      {match.team_b_points > 0 && (
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${(match.team_b_points / Math.max(totalPts, 1)) * 100}%` }}
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
