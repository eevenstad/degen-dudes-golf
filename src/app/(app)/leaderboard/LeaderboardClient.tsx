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
      const thru = courseScores.length
      const gross = courseScores.reduce((sum, s) => sum + s.gross_score, 0)
      const net = courseScores.reduce((sum, s) => sum + (s.net_score ?? s.gross_score), 0)
      const completedPar = courseHoles
        .filter(h => courseScores.some(s => s.hole_number === h.hole_number))
        .reduce((sum, h) => sum + h.par, 0)
      return {
        dayNumber: course.day_number,
        courseName: course.name,
        gross,
        net,
        par: completedPar,
        thru,
      }
    })

    return {
      player,
      totalGross: rounds.reduce((s, r) => s + r.gross, 0),
      totalNet: rounds.reduce((s, r) => s + r.net, 0),
      totalPar: rounds.reduce((s, r) => s + r.par, 0),
      rounds,
      thruTotal: rounds.reduce((s, r) => s + r.thru, 0),
    }
  })

  const ranked = entries
    .filter(e => e.thruTotal > 0)
    .sort((a, b) => {
      const aRelative = a.totalNet - a.totalPar
      const bRelative = b.totalNet - b.totalPar
      return aRelative - bRelative
    })
  const unranked = entries.filter(e => e.thruTotal === 0)

  const hasTeams = data.players.some(p => p.team !== null)
  const usaNet = ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + (e.totalNet - e.totalPar), 0)
  const europeNet = ranked.filter(e => e.player.team === 'Europe').reduce((s, e) => s + (e.totalNet - e.totalPar), 0)

  const formatRelative = (net: number, par: number) => {
    if (par === 0) return 'E'
    const diff = net - par
    if (diff === 0) return 'E'
    return diff > 0 ? `+${diff}` : `${diff}`
  }

  const relColor = (net: number, par: number) => {
    if (par === 0) return '#F5E6C3'
    const diff = net - par
    if (diff < 0) return '#DC2626'
    if (diff === 0) return '#F5E6C3'
    return '#9A9A50'
  }

  const rankColor = (idx: number) =>
    idx === 0 ? '#D4A947' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#C17A2A' : '#9A9A50'

  return (
    <div className="p-4 space-y-4">
      {/* Team toggle */}
      {hasTeams && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowTeams(false)}
            className="flex-1 py-2 rounded-lg font-bold text-sm transition-all"
            style={!showTeams
              ? { background: '#D4A947', color: '#1A1A0A' }
              : { background: '#1A3A2A', color: '#9A9A50' }}
          >
            Individual
          </button>
          <button
            onClick={() => setShowTeams(true)}
            className="flex-1 py-2 rounded-lg font-bold text-sm transition-all"
            style={showTeams
              ? { background: '#D4A947', color: '#1A1A0A' }
              : { background: '#1A3A2A', color: '#9A9A50' }}
          >
            Teams
          </button>
        </div>
      )}

      {/* Team standings */}
      {showTeams && hasTeams && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#2D4A1E' }}>
            <div
              className="p-4 text-center"
              style={{ background: usaNet <= europeNet ? 'rgba(92,92,46,0.4)' : 'rgba(92,92,46,0.15)' }}
            >
              <div className="font-bold text-lg" style={{ color: '#9A9A50' }}>🫡 USA</div>
              <div className="text-3xl font-bold text-white mt-1">
                {formatRelative(
                  ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + e.totalNet, 0),
                  ranked.filter(e => e.player.team === 'USA').reduce((s, e) => s + e.totalPar, 0)
                )}
              </div>
            </div>
            <div
              className="p-4 text-center"
              style={{ background: europeNet <= usaNet ? 'rgba(193,122,42,0.4)' : 'rgba(193,122,42,0.15)' }}
            >
              <div className="font-bold text-lg" style={{ color: '#E09030' }}>🌍 Europe</div>
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
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
        <div className="px-3 py-2" style={{ background: '#1A3A2A' }}>
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 text-xs font-medium" style={{ color: '#9A9A50' }}>
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Today</span>
            <span className="text-right">Total</span>
            <span className="text-right">Thru</span>
          </div>
        </div>

        <div>
          {ranked.map((entry, idx) => {
            const todayRound = entry.rounds.find(r => r.thru > 0 && r.dayNumber === Math.max(
              ...entry.rounds.filter(r2 => r2.thru > 0).map(r2 => r2.dayNumber)
            ))
            const todayRelative = todayRound ? formatRelative(todayRound.net, todayRound.par) : '—'
            const totalRelative = formatRelative(entry.totalNet, entry.totalPar)
            const teamBorderColor = entry.player.team === 'USA' ? '#9A9A50'
              : entry.player.team === 'Europe' ? '#C17A2A' : 'transparent'

            return (
              <Link
                key={entry.player.id}
                href={`/player/${encodeURIComponent(entry.player.name)}`}
                className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 px-3 py-3 items-center transition-colors"
                style={{
                  borderBottom: '1px solid rgba(45,74,30,0.4)',
                  borderLeft: `3px solid ${teamBorderColor}`,
                }}
              >
                <span className="text-sm font-bold" style={{ color: rankColor(idx) }}>
                  {idx + 1}
                </span>
                <span className="font-medium text-white truncate text-sm">
                  {entry.player.name}
                </span>
                <span className="text-right text-sm font-medium" style={{
                  color: todayRound ? relColor(todayRound.net, todayRound.par) : '#9A9A50'
                }}>
                  {todayRelative}
                </span>
                <span className="text-right text-sm font-bold" style={{
                  color: relColor(entry.totalNet, entry.totalPar)
                }}>
                  {totalRelative}
                </span>
                <span className="text-right text-xs" style={{ color: '#5C5C2E' }}>
                  {todayRound?.thru || 0}
                </span>
              </Link>
            )
          })}

          {unranked.map(entry => (
            <div
              key={entry.player.id}
              className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_2.5rem] gap-1 px-3 py-3 items-center opacity-40"
              style={{ borderBottom: '1px solid rgba(45,74,30,0.3)' }}
            >
              <span className="text-sm" style={{ color: '#2D4A1E' }}>—</span>
              <span className="text-sm" style={{ color: '#9A9A50' }}>{entry.player.name}</span>
              <span className="text-right text-xs" style={{ color: '#2D4A1E' }}>—</span>
              <span className="text-right text-xs" style={{ color: '#2D4A1E' }}>—</span>
              <span className="text-right text-xs" style={{ color: '#2D4A1E' }}>0</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round-by-round breakdown */}
      {ranked.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
          <div className="px-3 py-2 font-bold text-sm" style={{ background: '#1A3A2A', color: '#9A9A50' }}>
            Round Breakdown
          </div>
          <div>
            {ranked.map(entry => (
              <div key={entry.player.id} className="px-3 py-2" style={{ borderBottom: '1px solid rgba(45,74,30,0.3)' }}>
                <div className="font-medium text-white text-sm mb-1">{entry.player.name}</div>
                <div className="flex gap-3 text-xs">
                  {entry.rounds.map(r => (
                    <div key={r.dayNumber} style={{ color: r.thru === 0 ? '#2D4A1E' : '#9A9A50' }}>
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
