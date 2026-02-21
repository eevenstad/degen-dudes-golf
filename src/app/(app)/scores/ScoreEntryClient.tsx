'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDayData } from '@/app/actions/data'
import { saveScore } from '@/app/actions/scores'
import { calcStrokesOnHole, calcNetScore } from '@/lib/scoring'

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

interface GroupPlayer {
  id: string
  player_id: string
  playing_handicap: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  players: any
}

interface Group {
  id: string
  day_number: number
  group_number: number
  format: string
  group_players: GroupPlayer[]
}

interface Score {
  id: string
  player_id: string
  course_id: string
  hole_number: number
  gross_score: number
  net_score: number | null
  ch_strokes: number
  ph_strokes: number
}

interface TeeAssignment {
  player_id: string
  course_handicap: number
  tees?: { name: string }
}

interface Props {
  courses: Course[]
  settings: Record<string, string>
}

export default function ScoreEntryClient({ courses, settings }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [selectedHole, setSelectedHole] = useState(1)
  const [dayData, setDayData] = useState<{
    course: Course
    holes: Hole[]
    groups: Group[]
    scores: Score[]
    teeAssignments: TeeAssignment[]
  } | null>(null)
  const [localScores, setLocalScores] = useState<Map<string, number>>(new Map())
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const netMaxOverPar = parseInt(settings.net_max_over_par || '3')

  // Load day data when day is selected
  useEffect(() => {
    if (selectedDay) {
      getDayData(selectedDay).then(data => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDayData(data as any)
        // Initialize local scores from existing data
        if (data?.scores) {
          const map = new Map<string, number>()
          data.scores.forEach(s => {
            map.set(`${s.player_id}-${s.hole_number}`, s.gross_score)
          })
          setLocalScores(map)
        }
      })
    }
  }, [selectedDay])

  const currentHole = dayData?.holes.find(h => h.hole_number === selectedHole)
  const currentGroup = dayData?.groups.find(g => g.group_number === selectedGroup)
  const groupPlayers = currentGroup?.group_players || []

  // Get course handicap for a player
  const getCH = useCallback((playerId: string) => {
    const ta = dayData?.teeAssignments.find(t => t.player_id === playerId)
    return ta?.course_handicap ?? 0
  }, [dayData])

  // Get tee name for a player
  const getTeeName = useCallback((playerId: string) => {
    const ta = dayData?.teeAssignments.find(t => t.player_id === playerId)
    return ta?.tees?.name ?? '?'
  }, [dayData])

  // Score key
  const scoreKey = (playerId: string, holeNum: number) => `${playerId}-${holeNum}`

  // Update score locally
  const updateScore = (playerId: string, gross: number) => {
    if (gross < 1) gross = 1
    if (gross > 15) gross = 15
    setLocalScores(prev => {
      const next = new Map(prev)
      next.set(scoreKey(playerId, selectedHole), gross)
      return next
    })
  }

  // Save all scores for current hole
  const saveCurrentHole = async () => {
    if (!dayData || !currentHole) return
    setSaving(true)
    setSaveMessage('')

    let allSuccess = true
    for (const gp of groupPlayers) {
      const gross = localScores.get(scoreKey(gp.player_id, selectedHole))
      if (gross === undefined) continue

      const result = await saveScore({
        playerId: gp.player_id,
        courseId: dayData.course.id,
        holeNumber: selectedHole,
        grossScore: gross,
      })

      if (!result.success) {
        allSuccess = false
        setSaveMessage(`Error: ${result.error}`)
      }
    }

    if (allSuccess) {
      setSaveMessage('Saved!')
      // Advance to next hole
      if (selectedHole < 18) {
        setTimeout(() => {
          setSelectedHole(selectedHole + 1)
          setSaveMessage('')
        }, 500)
      }
    }
    setSaving(false)
  }

  // Count completed holes for the group
  const completedHoles = () => {
    if (!groupPlayers.length) return 0
    let count = 0
    for (let h = 1; h <= 18; h++) {
      const allHave = groupPlayers.every(gp =>
        localScores.has(scoreKey(gp.player_id, h))
      )
      if (allHave) count++
    }
    return count
  }

  // STEP 1: Select day
  if (!selectedDay) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold text-yellow-400 text-center">Select Day</h2>
        <div className="space-y-3">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedDay(course.day_number)}
              className="w-full p-6 rounded-xl bg-green-800 border border-green-700
                         text-left hover:bg-green-700 active:scale-[0.98] transition-all"
            >
              <div className="text-2xl font-bold text-white">
                Day {course.day_number}
              </div>
              <div className="text-green-300 text-lg mt-1">{course.name}</div>
              <div className="text-green-500 text-sm">Par {course.par_total}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Loading day data
  if (!dayData) {
    return (
      <div className="p-4 text-center">
        <div className="text-green-400 text-lg animate-pulse">Loading...</div>
      </div>
    )
  }

  // STEP 2: Select group
  if (selectedGroup === null) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={() => setSelectedDay(null)}
          className="text-green-400 text-sm font-medium"
        >
          ← Back to Days
        </button>
        <h2 className="text-xl font-bold text-yellow-400 text-center">
          Day {selectedDay}: {dayData.course.name}
        </h2>
        <p className="text-green-400 text-center text-sm">Select Group</p>
        <div className="space-y-3">
          {dayData.groups.map(group => {
            const players = group.group_players
            const formatLabel = group.format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group.group_number)}
                className="w-full p-5 rounded-xl bg-green-800 border border-green-700
                           text-left hover:bg-green-700 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-white">
                    Group {group.group_number}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-700 text-green-300">
                    {formatLabel}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {players.map(gp => (
                    <span
                      key={gp.id}
                      className="text-sm px-2 py-0.5 rounded bg-green-700/50 text-green-200"
                    >
                      {gp.players.name}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // STEP 3: Score entry for current hole
  const holesWithScores = new Set<number>()
  for (let h = 1; h <= 18; h++) {
    const allHave = groupPlayers.every(gp =>
      localScores.has(scoreKey(gp.player_id, h))
    )
    if (allHave) holesWithScores.add(h)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      {/* Top bar: Course + Group info */}
      <div className="bg-green-900 border-b border-green-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => { setSelectedGroup(null); setSelectedHole(1) }}
          className="text-green-400 text-sm"
        >
          ← Groups
        </button>
        <div className="text-center">
          <div className="text-xs text-green-400">Day {selectedDay} • Group {selectedGroup}</div>
          <div className="text-xs text-green-500">{completedHoles()}/18 holes</div>
        </div>
        <div className="text-xs text-green-500">
          {currentGroup?.format.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Hole selector - scrollable */}
      <div className="bg-green-900/50 border-b border-green-800 px-2 py-2">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {dayData.holes.map(hole => {
            const isActive = hole.hole_number === selectedHole
            const hasScore = holesWithScores.has(hole.hole_number)
            return (
              <button
                key={hole.hole_number}
                onClick={() => setSelectedHole(hole.hole_number)}
                className={`flex-shrink-0 w-9 h-9 rounded-lg text-sm font-bold transition-all
                  ${isActive
                    ? 'bg-yellow-500 text-green-900'
                    : hasScore
                      ? 'bg-green-700 text-green-200'
                      : 'bg-green-800/50 text-green-400'
                  }`}
              >
                {hole.hole_number}
              </button>
            )
          })}
        </div>
      </div>

      {/* Current hole info */}
      {currentHole && (
        <div className="bg-green-900/30 px-4 py-3 flex items-center justify-between border-b border-green-800/50">
          <div>
            <span className="text-2xl font-bold text-white">Hole {selectedHole}</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-yellow-400">Par {currentHole.par}</div>
            <div className="text-xs text-green-500">HDCP {currentHole.handicap_rank}</div>
          </div>
        </div>
      )}

      {/* Player score cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {groupPlayers.map(gp => {
          const player = gp.players
          const gross = localScores.get(scoreKey(player.id, selectedHole))
          const ch = getCH(player.id)
          const ph = gp.playing_handicap
          const chStrokes = currentHole ? calcStrokesOnHole(ch, currentHole.handicap_rank) : 0
          const phStrokes = currentHole ? calcStrokesOnHole(ph, currentHole.handicap_rank) : 0
          const netScore = gross !== undefined && currentHole
            ? calcNetScore(gross, chStrokes, currentHole.par, netMaxOverPar)
            : null
          const teeName = getTeeName(player.id)

          return (
            <div
              key={gp.id}
              className="rounded-xl bg-green-800/60 border border-green-700/50 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-white text-lg">{player.name}</span>
                  <div className="text-xs text-green-400">
                    CH: {ch} • PH: {ph} • {teeName}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Stroke dots */}
                  {chStrokes > 0 && (
                    <div className="flex gap-0.5 mr-2">
                      {Array.from({ length: chStrokes }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      ))}
                    </div>
                  )}
                  {netScore !== null && (
                    <div className={`text-sm px-2 py-0.5 rounded font-medium ${
                      netScore < (currentHole?.par ?? 4)
                        ? 'bg-red-500/20 text-red-400'
                        : netScore === (currentHole?.par ?? 4)
                          ? 'bg-green-600/20 text-green-300'
                          : 'bg-green-800/50 text-green-400'
                    }`}>
                      Net {netScore}
                    </div>
                  )}
                </div>
              </div>

              {/* Score input */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => updateScore(player.id, (gross ?? currentHole?.par ?? 4) - 1)}
                  className="w-14 h-14 rounded-xl bg-green-700 text-white text-2xl font-bold
                             hover:bg-green-600 active:bg-green-500 active:scale-90
                             transition-all flex items-center justify-center"
                >
                  −
                </button>

                <div className="w-20 text-center">
                  <div className="text-4xl font-bold text-white">
                    {gross ?? '—'}
                  </div>
                  {gross !== undefined && currentHole && (
                    <div className={`text-xs font-medium mt-0.5 ${
                      gross < currentHole.par ? 'text-red-400'
                        : gross === currentHole.par ? 'text-green-300'
                        : gross === currentHole.par + 1 ? 'text-yellow-400'
                        : 'text-orange-400'
                    }`}>
                      {gross - currentHole.par === 0 ? 'PAR'
                        : gross - currentHole.par === -1 ? 'BIRDIE'
                        : gross - currentHole.par === -2 ? 'EAGLE'
                        : gross - currentHole.par === 1 ? 'BOGEY'
                        : gross - currentHole.par === 2 ? 'DOUBLE'
                        : gross - currentHole.par > 2 ? `+${gross - currentHole.par}`
                        : `${gross - currentHole.par}`}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => updateScore(player.id, (gross ?? (currentHole?.par ?? 4) - 1) + 1)}
                  className="w-14 h-14 rounded-xl bg-green-700 text-white text-2xl font-bold
                             hover:bg-green-600 active:bg-green-500 active:scale-90
                             transition-all flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save & Next button */}
      <div className="border-t border-green-800 bg-green-950 px-4 py-3 safe-area-inset-bottom">
        {saveMessage && (
          <div className={`text-center text-sm mb-2 ${
            saveMessage.startsWith('Error') ? 'text-red-400' : 'text-green-400'
          }`}>
            {saveMessage}
          </div>
        )}
        <button
          onClick={saveCurrentHole}
          disabled={saving || !groupPlayers.some(gp =>
            localScores.has(scoreKey(gp.player_id, selectedHole))
          )}
          className="w-full py-4 rounded-xl bg-yellow-500 text-green-900 font-bold text-lg
                     hover:bg-yellow-400 active:bg-yellow-300 active:scale-[0.98]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all"
        >
          {saving ? 'Saving...' : selectedHole < 18 ? `Save & Next →` : 'Save Hole 18 ✓'}
        </button>
      </div>
    </div>
  )
}
