'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStrokesOnHole } from '@/lib/scoring/handicap'

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

interface TeeAssignment {
  id: string
  player_id: string
  course_id: string
  course_handicap: number
  players?: { name: string }
  tees?: { name: string; rating: number; slope: number }
  courses?: { name: string; day_number: number }
}

interface Props {
  initialData: {
    players: Player[]
    courses: Course[]
    holes: Hole[]
    scores: Score[]
  }
  teeAssignments: TeeAssignment[]
}

// Score cell with shape indicators
function ScoreCell({
  gross,
  net,
  par,
  strokes,
}: {
  gross: number | null
  net: number | null
  par: number
  strokes: number
}) {
  if (gross === null) {
    return (
      <div
        className="flex items-center justify-center relative"
        style={{ width: 30, height: 38, minWidth: 30 }}
      >
        <span style={{ color: '#2D4A1E', fontSize: 12 }}>-</span>
        {strokes > 0 && (
          <div className="absolute top-0.5 right-0.5 flex gap-px">
            {Array.from({ length: strokes }).map((_, i) => (
              <div key={i} className="rounded-full" style={{ width: 4, height: 4, background: '#000' }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const diff = gross - par

  // Shape + color logic
  let borderStyle: React.CSSProperties = {}
  let textColor = '#F5E6C3' // par default

  if (diff <= -2) {
    // Eagle: gold double circle (use box-shadow for outer ring)
    textColor = '#D4A947'
    borderStyle = {
      borderRadius: '50%',
      border: '2px solid #D4A947',
      boxShadow: '0 0 0 3px #D4A947',
    }
  } else if (diff === -1) {
    // Birdie: red single circle
    textColor = '#DC2626'
    borderStyle = {
      borderRadius: '50%',
      border: '2px solid #DC2626',
    }
  } else if (diff === 0) {
    // Par: no decoration
    textColor = '#F5E6C3'
  } else if (diff === 1) {
    // Bogey: purple single square
    textColor = '#A78BFA'
    borderStyle = {
      borderRadius: 2,
      border: '2px solid #7C3AED',
    }
  } else {
    // Double bogey+: orange double square (use box-shadow for outer ring)
    textColor = '#E09030'
    borderStyle = {
      borderRadius: 2,
      border: '2px solid #E09030',
      boxShadow: '0 0 0 3px #E09030',
    }
  }

  // Net display: only show if different from gross
  const showNet = net !== null && net !== gross

  return (
    <div
      className="flex flex-col items-center justify-center relative"
      style={{ width: 30, height: 38, minWidth: 30 }}
    >
      {/* Stroke dots in top-right corner */}
      {strokes > 0 && (
        <div className="absolute top-0 right-0 flex gap-px">
          {Array.from({ length: strokes }).map((_, i) => (
            <div key={i} className="rounded-full" style={{ width: 4, height: 4, background: '#000' }} />
          ))}
        </div>
      )}

      {/* Gross score with shape */}
      <div
        className="flex items-center justify-center font-bold"
        style={{
          width: 22,
          height: 22,
          fontSize: 11,
          color: textColor,
          ...borderStyle,
        }}
      >
        {gross}
      </div>

      {/* Net score subscript */}
      {showNet && (
        <div style={{ fontSize: 9, color: '#9A9A50', lineHeight: 1, marginTop: 1 }}>
          {net}
        </div>
      )}
    </div>
  )
}

export default function ScorecardsClient({ initialData, teeAssignments }: Props) {
  const [scores, setScores] = useState<Score[]>(initialData.scores)
  const [selectedDay, setSelectedDay] = useState(1)

  const { players, courses, holes } = initialData

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('scorecards-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setScores(prev => [...prev, payload.new as Score])
          } else if (payload.eventType === 'UPDATE') {
            setScores(prev =>
              prev.map(s => s.id === (payload.new as Score).id ? payload.new as Score : s)
            )
          } else if (payload.eventType === 'DELETE') {
            setScores(prev => prev.filter(s => s.id !== (payload.old as Score).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const course = courses.find(c => c.day_number === selectedDay)
  const courseHoles = course
    ? holes.filter(h => h.course_id === course.id).sort((a, b) => a.hole_number - b.hole_number)
    : []

  const front9 = courseHoles.slice(0, 9)
  const back9 = courseHoles.slice(9, 18)

  // Build player rows
  const playerRows = players.map(player => {
    const ta = teeAssignments.find(
      t => t.player_id === player.id && t.courses?.day_number === selectedDay
    )
    const ch = ta?.course_handicap ?? 0
    const playerScores = scores.filter(
      s => s.player_id === player.id && s.course_id === course?.id
    )

    const getScore = (holeNumber: number) => {
      return playerScores.find(s => s.hole_number === holeNumber) ?? null
    }

    const getStrokes = (holeHandicapRank: number) => {
      return calcStrokesOnHole(ch, holeHandicapRank)
    }

    const completedScores = playerScores.filter(s => s.gross_score > 0)
    const thru = completedScores.length

    const frontGross = front9.reduce((sum, h) => {
      const s = getScore(h.hole_number)
      return sum + (s?.gross_score ?? 0)
    }, 0)
    const backGross = back9.reduce((sum, h) => {
      const s = getScore(h.hole_number)
      return sum + (s?.gross_score ?? 0)
    }, 0)
    const totalGross = frontGross + backGross

    const frontNet = front9.reduce((sum, h) => {
      const s = getScore(h.hole_number)
      return sum + (s?.net_score ?? s?.gross_score ?? 0)
    }, 0)
    const backNet = back9.reduce((sum, h) => {
      const s = getScore(h.hole_number)
      return sum + (s?.net_score ?? s?.gross_score ?? 0)
    }, 0)
    const totalNet = frontNet + backNet

    return { player, ch, getScore, getStrokes, thru, frontGross, backGross, totalGross, frontNet, backNet, totalNet }
  })

  const teamColor = (team: 'USA' | 'Europe' | null) =>
    team === 'USA' ? '#9A9A50' : team === 'Europe' ? '#C17A2A' : '#5C5C2E'

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#D4A947' }}>Live Scorecards</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
              All players · hole-by-hole · real-time
            </p>
          </div>
          {/* Live dot */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
            <span className="text-xs" style={{ color: '#9A9A50' }}>Live</span>
          </div>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="px-4 mb-3">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: '#1A3A2A' }}>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedDay(c.day_number)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: selectedDay === c.day_number ? '#D4A947' : 'transparent',
                color: selectedDay === c.day_number ? '#1A1A0A' : '#9A9A50',
              }}
            >
              Day {c.day_number}
            </button>
          ))}
        </div>
        {course && (
          <p className="text-xs text-center mt-1" style={{ color: '#5C5C2E' }}>
            {course.name} · Par {course.par_total}
          </p>
        )}
      </div>

      {/* Scorecard table — two halves stacked per player */}
      <div className="space-y-3 px-2 pb-4">
        {playerRows.map(({ player, ch, getScore, getStrokes, thru, frontGross, backGross, totalGross, frontNet, backNet, totalNet }) => (
          <div
            key={player.id}
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: '#2D4A1E', background: '#1A1A0A' }}
          >
            {/* Player header */}
            <div
              className="px-3 py-1.5 flex items-center justify-between"
              style={{ background: '#1A3A2A' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: teamColor(player.team) }}>
                  {player.name}
                </span>
                <span className="text-xs" style={{ color: '#5C5C2E' }}>CH {ch}</span>
                {player.team && (
                  <span className="text-xs" style={{ color: teamColor(player.team) }}>
                    {player.team === 'USA' ? '🫡' : '🌍'} {player.team}
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: '#5C5C2E' }}>
                {thru > 0 ? `Thru ${thru}` : 'Not started'}
              </div>
            </div>

            {/* Front 9 */}
            <div className="overflow-x-auto">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th
                      className="text-left pl-2 pr-1 py-1 text-[10px] font-medium whitespace-nowrap sticky left-0"
                      style={{ background: '#1A1A0A', color: '#5C5C2E', minWidth: 36 }}
                    >
                      Front
                    </th>
                    {front9.map(h => (
                      <th
                        key={h.id}
                        className="text-center py-1 text-[10px]"
                        style={{ color: '#5C5C2E', width: 30, minWidth: 30 }}
                      >
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="text-center py-1 text-[10px] font-bold px-1" style={{ color: '#D4A947', minWidth: 28 }}>
                      OUT
                    </th>
                  </tr>
                  <tr>
                    <td
                      className="pl-2 pr-1 py-0.5 text-[9px] sticky left-0"
                      style={{ background: '#1A1A0A', color: '#5C5C2E' }}
                    >
                      Par
                    </td>
                    {front9.map(h => (
                      <td key={h.id} className="text-center text-[9px]" style={{ color: '#5C5C2E' }}>
                        {h.par}
                      </td>
                    ))}
                    <td className="text-center text-[9px] font-medium px-1" style={{ color: '#5C5C2E' }}>
                      {front9.reduce((s, h) => s + h.par, 0)}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      className="pl-2 pr-1 py-0.5 text-[10px] sticky left-0"
                      style={{ background: '#1A1A0A', color: '#9A9A50' }}
                    >
                      Score
                    </td>
                    {front9.map(h => {
                      const s = getScore(h.hole_number)
                      const strokes = getStrokes(h.handicap_rank)
                      return (
                        <td key={h.id} className="py-0.5">
                          <div className="flex justify-center">
                            <ScoreCell
                              gross={s?.gross_score ?? null}
                              net={s?.net_score ?? null}
                              par={h.par}
                              strokes={strokes}
                            />
                          </div>
                        </td>
                      )
                    })}
                    <td className="text-center py-0.5 px-1">
                      <div className="text-xs font-bold" style={{ color: frontGross > 0 ? '#F5E6C3' : '#2D4A1E' }}>
                        {frontGross > 0 ? frontGross : '-'}
                      </div>
                      {frontNet > 0 && frontNet !== frontGross && (
                        <div style={{ fontSize: 9, color: '#D4A947' }}>{frontNet}</div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Back 9 */}
            <div className="overflow-x-auto border-t" style={{ borderColor: '#1A3A2A' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th
                      className="text-left pl-2 pr-1 py-1 text-[10px] font-medium whitespace-nowrap sticky left-0"
                      style={{ background: '#1A1A0A', color: '#5C5C2E', minWidth: 36 }}
                    >
                      Back
                    </th>
                    {back9.map(h => (
                      <th
                        key={h.id}
                        className="text-center py-1 text-[10px]"
                        style={{ color: '#5C5C2E', width: 30, minWidth: 30 }}
                      >
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="text-center py-1 text-[10px] font-bold px-1" style={{ color: '#D4A947', minWidth: 28 }}>
                      IN
                    </th>
                  </tr>
                  <tr>
                    <td
                      className="pl-2 pr-1 py-0.5 text-[9px] sticky left-0"
                      style={{ background: '#1A1A0A', color: '#5C5C2E' }}
                    >
                      Par
                    </td>
                    {back9.map(h => (
                      <td key={h.id} className="text-center text-[9px]" style={{ color: '#5C5C2E' }}>
                        {h.par}
                      </td>
                    ))}
                    <td className="text-center text-[9px] font-medium px-1" style={{ color: '#5C5C2E' }}>
                      {back9.reduce((s, h) => s + h.par, 0)}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      className="pl-2 pr-1 py-0.5 text-[10px] sticky left-0"
                      style={{ background: '#1A1A0A', color: '#9A9A50' }}
                    >
                      Score
                    </td>
                    {back9.map(h => {
                      const s = getScore(h.hole_number)
                      const strokes = getStrokes(h.handicap_rank)
                      return (
                        <td key={h.id} className="py-0.5">
                          <div className="flex justify-center">
                            <ScoreCell
                              gross={s?.gross_score ?? null}
                              net={s?.net_score ?? null}
                              par={h.par}
                              strokes={strokes}
                            />
                          </div>
                        </td>
                      )
                    })}
                    <td className="text-center py-0.5 px-1">
                      <div className="text-xs font-bold" style={{ color: backGross > 0 ? '#F5E6C3' : '#2D4A1E' }}>
                        {backGross > 0 ? backGross : '-'}
                      </div>
                      {backNet > 0 && backNet !== backGross && (
                        <div style={{ fontSize: 9, color: '#D4A947' }}>{backNet}</div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            {totalGross > 0 && (
              <div
                className="px-3 py-1.5 flex justify-between text-xs border-t"
                style={{ borderColor: '#1A3A2A', background: 'rgba(26,58,42,0.4)' }}
              >
                <span style={{ color: '#9A9A50' }}>
                  Gross: <span className="font-bold text-white">{totalGross}</span>
                </span>
                <span style={{ color: '#9A9A50' }}>
                  Net: <span className="font-bold" style={{ color: '#D4A947' }}>{totalNet}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Score legend */}
      <div className="px-4 pb-6">
        <div className="rounded-xl border p-3" style={{ borderColor: '#2D4A1E', background: '#1A1A0A' }}>
          <div className="text-[10px] font-semibold mb-2" style={{ color: '#5C5C2E' }}>SCORE GUIDE</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[
              { label: 'Eagle or better', shape: 'circle-double', color: '#D4A947' },
              { label: 'Birdie', shape: 'circle', color: '#DC2626' },
              { label: 'Par', shape: 'none', color: '#F5E6C3' },
              { label: 'Bogey', shape: 'square', color: '#7C3AED' },
              { label: 'Double bogey+', shape: 'square-double', color: '#E09030' },
            ].map(({ label, shape, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center text-[10px] font-bold"
                  style={{
                    width: 18,
                    height: 18,
                    color,
                    borderRadius: shape.includes('circle') ? '50%' : shape === 'none' ? 0 : 2,
                    border: shape !== 'none' ? `2px solid ${color}` : 'none',
                    boxShadow: shape.includes('double') ? `0 0 0 3px ${color}` : 'none',
                  }}
                >
                  4
                </div>
                <span className="text-[10px]" style={{ color: '#9A9A50' }}>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 col-span-2">
              <div className="flex gap-px">
                <div className="rounded-full" style={{ width: 4, height: 4, background: '#000', border: '1px solid #555' }} />
              </div>
              <span className="text-[10px]" style={{ color: '#9A9A50' }}>Black dot = stroke received on hole</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
