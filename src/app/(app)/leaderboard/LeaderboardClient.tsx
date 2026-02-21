'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Player {
  id: string
  name: string
  handicap_index: number
  team: 'USA' | 'Europe' | null
  display_order: number
}

interface Course {
  id: string
  name: string
  day_number: number
  par_total: number
}

interface Hole {
  id: string
  course_id: string
  hole_number: number
  par: number
  handicap_rank: number
}

interface Score {
  id: string
  player_id: string
  course_id: string
  hole_number: number
  gross_score: number
  net_score: number | null
  ch_strokes: number
}

interface LeaderboardEntry {
  player: Player
  totalGross: number
  totalNet: number
  totalPar: number
  rounds: {
    dayNumber: number
    courseName: string
    gross: number
    net: number
    par: number
    thru: number
  }[]
  thruTotal: number
}

interface Props {
  initialData: {
    players: Player[]
    courses: Course[]
    holes: Hole[]
    scores: Score[]
    settings: Record<string, string>
  }
}

export default function LeaderboardClient({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [showTeams, setShowTeams] = useState(false)

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('leaderboard-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          // Refresh data when scores change
          window.location.reload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Calculate leaderboard entries
  const entries: LeaderboardEntry[] = data.players.map(player => {
    const playerScores = data.scores.filter(s => s.player_id === player.id)
    const rounds = data.courses.map(course => {
      const courseScores = playerScores.filter(s => s.course_id === course.id)
      const courseHoles = data.holes.filter(h => h.course_id === course.id)
      const coursePar = courseHoles.reduce((sum, h) => sum + h.par, 0)
      const thru = courseScores.length
      const gross = courseScores.reduce((sum, s) => sum + s.gross_score, 0)
      const net = courseScores.reduce((sum, s) => sum + (s.net_score ?? s.gross_score), 0)
      // Par for completed holes only
      const completedPar = courseHoles
        .filter(h => courseScores.some(s => s.hole_number === h.hole_number))
        .reduce((sum, h) => sum + h.par, 0)
      return {
        dayNumber: course.day_number,
        courseName: course.name,
        gross,
        net,
        par: completedPar,
        courseTotalPar: coursePar,
        thru,
      }
    })

    return {
      player,
      totalGross: rounds.reduce((s, r) => s + r.gross, 0),
      totalNet: rounds.reduce((s, r) => s + r.net, 0),
      totalPar: rounds.reduce((s, r) => s + r.par, 0),
      rounds: rounds.map(r => ({
        dayNumber: r.dayNumber,
        courseName: r.courseName,
        gross: r.gross,
        net: r.net,
        par: r.par,
        thru: r.thru,
      })),
      thruTotal: rounds.reduce((s, r) => s + r.thru, 0),
    }
  })

  // Sort by net score (lower is better), only rank players with scores
  const ranked = entries
    .filter(e => e.thruTotal > 0)
    .sort((a, b) => {
      const aRelative = a.totalNet - a.totalPar
      const bRelative = b.totalNet - b.totalPar
      return aRelative - bRelative
    })
  const unranked = entries.filter(e => e.thruTotal === 0)

  // Team scores
  const hasTeams = data.players.some(p => p.team !== null)
  const usaNet = ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + (e.totalNet - e.totalPar), 0)
  const europeNet = ranked.filter(e => e.player.team === 'Europe').reduce((s, e) => s + (e.totalNet - e.totalPar), 0)

  const formatRelative = (net: number, par: number) => {
    if (par === 0) return 'E'
    const diff = net - par
    if (diff === 0) return 'E'
    return diff > 0 ? `+${diff}` : `${diff}`
  }

  return (
    <div className="p-4 space-y-4">
      {/* Team toggle */}
      {hasTeams && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowTeams(false)}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
              !showTeams ? 'bg-yellow-500 text-green-900' : 'bg-green-800 text-green-300'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setShowTeams(true)}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
              showTeams ? 'bg-yellow-500 text-green-900' : 'bg-green-800 text-green-300'
            }`}
          >
            Teams
          </button>
        </div>
      )}

      {/* Team standings */}
      {showTeams && hasTeams && (
        <div className="rounded-xl border border-green-800 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-green-800">
            <div className={`p-4 text-center ${usaNet <= europeNet ? 'bg-blue-900/40' : 'bg-blue-900/20'}`}>
              <div className="text-blue-400 font-bold text-lg">🇺🇸 USA</div>
              <div className="text-3xl font-bold text-white mt-1">
                {formatRelative(
                  ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + e.totalNet, 0),
                  ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + e.totalPar, 0)
                )}
              </div>
            </div>
            <div className={`p-4 text-center ${europeNet <= usaNet ? 'bg-red-900/40' : 'bg-red-900/20'}`}>
              <div className="text-red-400 font-bold text-lg">🇪🇺 Europe</div>
              <div className="text-3xl font-bold text-white mt-1">
                {formatRelative(
                  ranked.filter(e => e.player.team === 'Europe').reduce((s, e) => s + e.totalNet, 0),
                  ranked.filter(e => e.player.team === 'Europe').reduce((s, e) => s + e.totalPar, 0)
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="rounded-xl border border-green-800 overflow-hidden">
        <div className="bg-green-900 px-3 py-2">
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 text-xs font-medium text-green-400">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Today</span>
            <span className="text-right">Total</span>
            <span className="text-right">Thru</span>
          </div>
        </div>

        <div className="divide-y divide-green-800/50">
          {ranked.map((entry, idx) => {
            const todayRound = entry.rounds.find(r => r.thru > 0 && r.dayNumber === Math.max(
              ...entry.rounds.filter(r2 => r2.thru > 0).map(r2 => r2.dayNumber)
            ))
            const todayRelative = todayRound ? formatRelative(todayRound.net, todayRound.par) : '—'
            const totalRelative = formatRelative(entry.totalNet, entry.totalPar)

            const teamColor = entry.player.team === 'USA' 
              ? 'border-l-4 border-l-blue-500' 
              : entry.player.team === 'Europe'
                ? 'border-l-4 border-l-red-500'
                : ''

            return (
              <Link
                key={entry.player.id}
                href={`/player/${encodeURIComponent(entry.player.name)}`}
                className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 px-3 py-3 items-center
                  hover:bg-green-800/30 transition-colors ${teamColor}`}
              >
                <span className={`text-sm font-bold ${
                  idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-green-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="font-medium text-white truncate text-sm">
                  {entry.player.name}
                </span>
                <span className={`text-right text-sm font-medium ${
                  todayRound && todayRound.net < todayRound.par ? 'text-red-400'
                    : todayRound && todayRound.net === todayRound.par ? 'text-green-300'
                    : 'text-white'
                }`}>
                  {todayRelative}
                </span>
                <span className={`text-right text-sm font-bold ${
                  entry.totalNet < entry.totalPar ? 'text-red-400'
                    : entry.totalNet === entry.totalPar ? 'text-green-300'
                    : 'text-white'
                }`}>
                  {totalRelative}
                </span>
                <span className="text-right text-xs text-green-500">
                  {todayRound?.thru || 0}
                </span>
              </Link>
            )
          })}

          {unranked.map(entry => (
            <div
              key={entry.player.id}
              className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 px-3 py-3 items-center opacity-50"
            >
              <span className="text-sm text-green-600">—</span>
              <span className="text-sm text-green-500">{entry.player.name}</span>
              <span className="text-right text-xs text-green-600">—</span>
              <span className="text-right text-xs text-green-600">—</span>
              <span className="text-right text-xs text-green-600">0</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round-by-round breakdown */}
      {ranked.length > 0 && (
        <div className="rounded-xl border border-green-800 overflow-hidden">
          <div className="bg-green-900 px-3 py-2 font-bold text-sm text-green-300">
            Round Breakdown
          </div>
          <div className="divide-y divide-green-800/50">
            {ranked.map(entry => (
              <div key={entry.player.id} className="px-3 py-2">
                <div className="font-medium text-white text-sm mb-1">{entry.player.name}</div>
                <div className="flex gap-3 text-xs">
                  {entry.rounds.map(r => (
                    <div key={r.dayNumber} className={`${r.thru === 0 ? 'text-green-600' : 'text-green-300'}`}>
                      D{r.dayNumber}: {r.thru > 0 ? `${formatRelative(r.net, r.par)} (${r.thru})` : '—'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
