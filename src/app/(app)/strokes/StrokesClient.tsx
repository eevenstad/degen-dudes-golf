'use client'

import { useState } from 'react'
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
  players: Player[]
  courses: Course[]
  holes: Hole[]
  teeAssignments: TeeAssignment[]
}

function StrokeDots({ count }: { count: number }) {
  if (count === 0) return <span style={{ color: '#2D4A1E' }} className="text-xs">-</span>

  return (
    <div className="flex flex-col items-center gap-0.5">
      {count >= 2 && (
        <div className="flex gap-0.5">
          {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: count === 1 ? 8 : 6,
                height: count === 1 ? 8 : 6,
                background: '#D4A947',
              }}
            />
          ))}
        </div>
      )}
      {count === 1 && (
        <div
          className="rounded-full"
          style={{ width: 8, height: 8, background: '#D4A947' }}
        />
      )}
      {count >= 2 && (
        <span className="text-[9px] font-bold leading-none" style={{ color: '#D4A947' }}>
          ×{count}
        </span>
      )}
    </div>
  )
}

export default function StrokesClient({ players, courses, holes, teeAssignments }: Props) {
  const [selectedDay, setSelectedDay] = useState(1)

  const course = courses.find(c => c.day_number === selectedDay)
  const courseHoles = course
    ? holes.filter(h => h.course_id === course.id).sort((a, b) => a.hole_number - b.hole_number)
    : []

  // Build player rows: player + CH for this day
  const playerRows = players
    .map(player => {
      const ta = teeAssignments.find(
        t => t.player_id === player.id && t.courses?.day_number === selectedDay
      )
      const ch = ta?.course_handicap ?? 0
      const strokes = courseHoles.map(hole => calcStrokesOnHole(ch, hole.handicap_rank))
      const totalStrokes = strokes.reduce((sum, s) => sum + s, 0)
      return { player, ch, strokes, totalStrokes, tee: ta?.tees?.name ?? '' }
    })
    .filter(row => row.ch >= 0) // only players with tee assignments

  const front9 = courseHoles.slice(0, 9)
  const back9 = courseHoles.slice(9, 18)

  return (
    <div className="pb-4" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold" style={{ color: '#D4A947' }}>Stroke Chart</h1>
        <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
          How many strokes each player gets per hole
        </p>
      </div>

      {/* Day Tabs */}
      <div className="px-4 mb-4">
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
          <p className="text-xs text-center mt-1.5" style={{ color: '#5C5C2E' }}>
            {course.name} · Par {course.par_total}
          </p>
        )}
      </div>

      {/* Grid — scrollable horizontally */}
      <div className="overflow-x-auto px-2">
        <table className="text-center text-xs border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Player name + CH column */}
              <th
                className="sticky left-0 z-10 text-left pl-2 pr-3 py-2 text-xs font-semibold whitespace-nowrap"
                style={{ background: '#1A1A0A', color: '#9A9A50', minWidth: 100 }}
              >
                Player / CH
              </th>

              {/* Front 9 holes */}
              {front9.map(hole => (
                <th
                  key={hole.id}
                  className="py-2 px-1 font-semibold"
                  style={{ color: '#9A9A50', minWidth: 30 }}
                >
                  {hole.hole_number}
                </th>
              ))}

              {/* Front 9 total */}
              <th className="py-2 px-1 font-bold" style={{ color: '#D4A947', minWidth: 32 }}>
                F9
              </th>

              {/* Back 9 holes */}
              {back9.map(hole => (
                <th
                  key={hole.id}
                  className="py-2 px-1 font-semibold"
                  style={{ color: '#9A9A50', minWidth: 30 }}
                >
                  {hole.hole_number}
                </th>
              ))}

              {/* Back 9 total */}
              <th className="py-2 px-1 font-bold" style={{ color: '#D4A947', minWidth: 32 }}>
                B9
              </th>

              {/* Total */}
              <th className="py-2 px-1 font-bold" style={{ color: '#D4A947', minWidth: 38 }}>
                TOT
              </th>
            </tr>

            {/* Handicap rank row */}
            <tr>
              <th
                className="sticky left-0 z-10 text-left pl-2 pr-3 py-1 text-[9px]"
                style={{ background: '#1A1A0A', color: '#5C5C2E' }}
              >
                HDCP Rank
              </th>
              {front9.map(hole => (
                <td key={hole.id} className="py-1 text-[9px]" style={{ color: '#5C5C2E' }}>
                  {hole.handicap_rank}
                </td>
              ))}
              <td />
              {back9.map(hole => (
                <td key={hole.id} className="py-1 text-[9px]" style={{ color: '#5C5C2E' }}>
                  {hole.handicap_rank}
                </td>
              ))}
              <td /><td />
            </tr>
          </thead>

          <tbody>
            {playerRows.map(({ player, ch, strokes, totalStrokes, tee }) => {
              const front9Strokes = strokes.slice(0, 9).reduce((s, v) => s + v, 0)
              const back9Strokes = strokes.slice(9, 18).reduce((s, v) => s + v, 0)
              const teamColor = player.team === 'USA' ? '#9A9A50' : '#C17A2A'

              return (
                <tr key={player.id} className="border-t" style={{ borderColor: '#1A3A2A' }}>
                  {/* Player name + CH */}
                  <td
                    className="sticky left-0 z-10 text-left pl-2 pr-3 py-2 whitespace-nowrap"
                    style={{ background: '#1A1A0A' }}
                  >
                    <div className="font-semibold text-xs" style={{ color: teamColor }}>
                      {player.name}
                    </div>
                    <div className="text-[9px]" style={{ color: '#5C5C2E' }}>
                      CH {ch}{tee ? ` · ${tee}` : ''}
                    </div>
                  </td>

                  {/* Front 9 stroke cells */}
                  {strokes.slice(0, 9).map((s, i) => (
                    <td key={i} className="py-2 px-0.5">
                      <div className="flex items-center justify-center" style={{ minWidth: 28, minHeight: 28 }}>
                        <StrokeDots count={s} />
                      </div>
                    </td>
                  ))}

                  {/* Front 9 total */}
                  <td className="py-2 px-1 font-bold" style={{ color: '#D4A947' }}>
                    {front9Strokes}
                  </td>

                  {/* Back 9 stroke cells */}
                  {strokes.slice(9, 18).map((s, i) => (
                    <td key={i + 9} className="py-2 px-0.5">
                      <div className="flex items-center justify-center" style={{ minWidth: 28, minHeight: 28 }}>
                        <StrokeDots count={s} />
                      </div>
                    </td>
                  ))}

                  {/* Back 9 total */}
                  <td className="py-2 px-1 font-bold" style={{ color: '#D4A947' }}>
                    {back9Strokes}
                  </td>

                  {/* Total */}
                  <td className="py-2 px-1 font-bold text-sm" style={{ color: '#F5E6C3' }}>
                    {totalStrokes}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#D4A947' }} />
          <span className="text-xs" style={{ color: '#9A9A50' }}>1 stroke</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A947' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A947' }} />
          </div>
          <span className="text-xs" style={{ color: '#9A9A50' }}>2 strokes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A947' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A947' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4A947' }} />
          </div>
          <span className="text-xs" style={{ color: '#9A9A50' }}>3 strokes</span>
        </div>
      </div>
    </div>
  )
}
