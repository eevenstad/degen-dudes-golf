'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { getDayData, getMatchesForDay } from '@/app/actions/data'
import { saveScore, undoLastScore } from '@/app/actions/scores'
import { calcStrokesOnHole, calcNetScore } from '@/lib/scoring'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { createClient } from '@/lib/supabase/client'

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

interface Notification {
  id: string
  message: string
}

interface Props {
  courses: Course[]
  settings: Record<string, string>
}

// Format a match ticker string for a given match
function formatMatchTicker(match: Match): string {
  const aPoints = match.team_a_points
  const bPoints = match.team_b_points
  const totalHoles = aPoints + bPoints

  if (match.format === 'singles_match') {
    // Singles: show player names
    const sideA = match.match_players.filter(mp => mp.side === 'a')
    const sideB = match.match_players.filter(mp => mp.side === 'b')
    const nameA = sideA.map(mp => mp.players?.name || '?').join('/')
    const nameB = sideB.map(mp => mp.players?.name || '?').join('/')
    if (totalHoles === 0) return `${nameA} vs ${nameB} — no holes yet`
    return `${nameA} ${aPoints} – ${nameB} ${bPoints} thru ${totalHoles}`
  }

  // Pairs / best_ball / low_total: show team labels
  const labelA = match.team_a_label || 'USA'
  const labelB = match.team_b_label || 'Europe'
  if (totalHoles === 0) return `${labelA} vs ${labelB} — no holes yet`
  return `${labelA} ${aPoints} – ${labelB} ${bPoints} thru ${totalHoles}`
}

// Find group number for a match
function getGroupNumberForMatch(match: Match): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = match.groups as any
  if (!groups) return null
  if (Array.isArray(groups)) return groups[0]?.group_number ?? null
  return groups.group_number ?? null
}

// Build a notification message comparing old vs new match states
function buildNotificationMessage(
  oldMatch: Match,
  newMatch: Match
): string | null {
  const groupNum = getGroupNumberForMatch(newMatch)
  const aNew = newMatch.team_a_points
  const bNew = newMatch.team_b_points
  const aOld = oldMatch.team_a_points
  const bOld = oldMatch.team_b_points

  if (aNew === aOld && bNew === bOld) return null

  const totalHoles = aNew + bNew
  const labelA = newMatch.team_a_label || 'USA'
  const labelB = newMatch.team_b_label || 'Europe'
  const groupLabel = groupNum !== null ? `Group ${groupNum}` : 'Another group'

  let leadStr: string
  if (aNew > bNew) leadStr = `${labelA} leads ${aNew}–${bNew}`
  else if (bNew > aNew) leadStr = `${labelB} leads ${bNew}–${aNew}`
  else leadStr = `Tied ${aNew}–${bNew}`

  return `${groupLabel} finished Hole ${totalHoles} — ${leadStr}`
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
  const [savedHoles, setSavedHoles] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [allowGroupOverride, setAllowGroupOverride] = useState(false)

  // Feature 4: Match ticker state
  const [groupMatches, setGroupMatches] = useState<Match[]>([])

  // Feature 3: Notification state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const prevMatchesRef = useRef<Map<string, Match>>(new Map())

  const { isOnline, queueLength, syncing, needsRefresh, enqueueScore } = useOfflineSync()

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
          const saved = new Set<string>()
          data.scores.forEach(s => {
            const key = `${s.player_id}-${s.hole_number}`
            map.set(key, s.gross_score)
            saved.add(key)
          })
          setLocalScores(map)
          setSavedHoles(saved)
        }
        // Auto-select group from onboarding name (if not already selected)
        if (selectedGroup === null && data?.groups) {
          try {
            const savedName = localStorage.getItem('degen_player_name')
            if (savedName && savedName !== 'guest') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const matchedGroup = (data.groups as any[]).find((g: any) =>
                g.group_players?.some((gp: any) =>
                  gp.players?.name?.toLowerCase() === savedName.toLowerCase()
                )
              )
              if (matchedGroup) {
                setSelectedGroup(matchedGroup.group_number)
              }
            }
          } catch {
            // localStorage not available
          }
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay])

  // Feature 4: Load match data for the current group
  const loadMatchData = useCallback(async () => {
    if (!selectedDay || selectedGroup === null) return
    try {
      const allMatches = await getMatchesForDay(selectedDay) as unknown as Match[]
      const myGroupMatches = allMatches.filter(m => getGroupNumberForMatch(m) === selectedGroup)
      setGroupMatches(myGroupMatches)
    } catch {
      // silently fail — non-critical
    }
  }, [selectedDay, selectedGroup])

  // Load match data when entering step 3
  useEffect(() => {
    if (selectedDay !== null && selectedGroup !== null && !allowGroupOverride) {
      loadMatchData()
    }
  }, [selectedDay, selectedGroup, allowGroupOverride, loadMatchData])

  // Feature 3: Dismiss a notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Feature 3: Realtime subscription for score changes
  useEffect(() => {
    // Only subscribe when in step 3 (day + group selected, no override)
    if (selectedDay === null || selectedGroup === null || allowGroupOverride) return

    const supabase = createClient()

    const handleScoreChange = async () => {
      if (!selectedDay) return
      try {
        const allMatches = await getMatchesForDay(selectedDay) as unknown as Match[]

        // Build map of current match states
        const newMap = new Map<string, Match>()
        allMatches.forEach(m => { newMap.set(m.id, m) })

        // Determine which group the current user belongs to (may differ from selectedGroup if "Change group" was used)
        let myGroupNum = selectedGroup
        try {
          const savedName = localStorage.getItem('degen_player_name')
          if (savedName && savedName !== 'guest') {
            const found = allMatches.find(m =>
              m.match_players?.some(mp => mp.players?.name?.toLowerCase() === savedName.toLowerCase())
            )
            if (found) {
              const gn = getGroupNumberForMatch(found)
              if (gn !== null) myGroupNum = gn
            }
          }
        } catch {
          // localStorage not available
        }

        // Check for changes in OTHER groups
        const prev = prevMatchesRef.current
        const newNotifications: Notification[] = []

        newMap.forEach((newMatch, id) => {
          const matchGroupNum = getGroupNumberForMatch(newMatch)
          if (matchGroupNum === myGroupNum) return // skip our group

          const oldMatch = prev.get(id)
          if (!oldMatch) return // first load, no comparison

          const msg = buildNotificationMessage(oldMatch, newMatch)
          if (msg) {
            newNotifications.push({ id: `${id}-${Date.now()}`, message: msg })
          }
        })

        prevMatchesRef.current = newMap

        if (newNotifications.length > 0) {
          setNotifications(prev => [...prev, ...newNotifications])
          // Auto-dismiss each notification after 6 seconds
          newNotifications.forEach(n => {
            setTimeout(() => {
              setNotifications(prev => prev.filter(x => x.id !== n.id))
            }, 6000)
          })
        }

        // Also update match ticker for our group
        const myGroupMatches = allMatches.filter(m => getGroupNumberForMatch(m) === selectedGroup)
        setGroupMatches(myGroupMatches)
      } catch {
        // silently fail
      }
    }

    // Initialize prevMatchesRef by loading current state
    getMatchesForDay(selectedDay).then(allMatches => {
      const map = new Map<string, Match>()
      ;(allMatches as unknown as Match[]).forEach(m => { map.set(m.id, m) })
      prevMatchesRef.current = map
    }).catch(() => {})

    const channel = supabase
      .channel('score-entry-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, handleScoreChange)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDay, selectedGroup, allowGroupOverride])

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

    // Offline path: queue scores in localStorage, optimistically mark as saved
    if (!isOnline) {
      const newSaved = new Set(savedHoles)
      groupPlayers.forEach(gp => {
        const gross = localScores.get(scoreKey(gp.player_id, selectedHole))
        if (gross === undefined) return
        enqueueScore({
          player_id: gp.player_id,
          course_id: dayData.course.id,
          hole_number: selectedHole,
          gross_score: gross,
          day_number: dayData.course.day_number,
          timestamp: Date.now(),
        })
        newSaved.add(scoreKey(gp.player_id, selectedHole))
      })
      setSavedHoles(newSaved)
      setSaveMessage('Saved offline — will sync when connected')
      if (selectedHole < 18) {
        setTimeout(() => {
          setSelectedHole(selectedHole + 1)
          setSaveMessage('')
        }, 500)
      }
      setSaving(false)
      return
    }

    // Online path: save via server action
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
      // Haptic feedback (Feature 6 — graceful fallback)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50)
      }
      // Mark these as saved
      const newSaved = new Set(savedHoles)
      groupPlayers.forEach(gp => {
        if (localScores.has(scoreKey(gp.player_id, selectedHole))) {
          newSaved.add(scoreKey(gp.player_id, selectedHole))
        }
      })
      setSavedHoles(newSaved)
      setSaveMessage('Saved!')

      // Feature 4: Refresh match data after save (match points updated server-side)
      loadMatchData()

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

  // Undo last score for a specific player on current hole
  const handleUndo = async (playerId: string) => {
    if (!dayData || !currentHole) return
    const playerName = groupPlayers.find(gp => gp.player_id === playerId)?.players?.name || 'player'
    const confirmed = window.confirm(`Undo last score entry for ${playerName} on Hole ${selectedHole}?`)
    if (!confirmed) return

    setUndoing(true)
    const result = await undoLastScore(playerId, dayData.course.id, selectedHole)
    if (result.success && result.restored !== undefined) {
      setLocalScores(prev => {
        const next = new Map(prev)
        next.set(scoreKey(playerId, selectedHole), result.restored!)
        return next
      })
      setSaveMessage(`Undone — restored to ${result.restored}`)
      setTimeout(() => setSaveMessage(''), 2000)
    } else {
      setSaveMessage(`Undo failed: ${result.error}`)
      setTimeout(() => setSaveMessage(''), 3000)
    }
    setUndoing(false)
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: '#D4A947' }}>Select Day</h2>
          <Link href="/history" className="text-xs transition-colors" style={{ color: '#9A9A50' }}>
            History →
          </Link>
        </div>
        <div className="space-y-3">
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => setSelectedDay(course.day_number)}
              className="w-full p-6 rounded-xl border text-left active:scale-[0.98] transition-all"
              style={{ background: 'rgba(26,58,42,0.6)', borderColor: '#2D4A1E' }}
            >
              <div className="text-2xl font-bold text-white">
                Day {course.day_number}
              </div>
              <div className="text-lg mt-1" style={{ color: '#9A9A50' }}>{course.name}</div>
              <div className="text-sm" style={{ color: '#5C5C2E' }}>Par {course.par_total}</div>
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
        <div className="text-lg animate-pulse" style={{ color: '#9A9A50' }}>Loading...</div>
      </div>
    )
  }

  // STEP 2: Select group
  if (selectedGroup === null || allowGroupOverride) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={() => {
            setSelectedDay(null)
            setAllowGroupOverride(false)
          }}
          className="text-sm font-medium"
          style={{ color: '#9A9A50' }}
        >
          ← Back to Days
        </button>
        <h2 className="text-xl font-bold text-center" style={{ color: '#D4A947' }}>
          Day {selectedDay}: {dayData.course.name}
        </h2>
        <p className="text-center text-sm" style={{ color: '#9A9A50' }}>Select Group</p>
        <div className="space-y-3">
          {dayData.groups.map(group => {
            const players = group.group_players
            const formatLabel = group.format.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            return (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroup(group.group_number)
                  setAllowGroupOverride(false)
                }}
                className="w-full p-5 rounded-xl border text-left active:scale-[0.98] transition-all"
                style={{ background: 'rgba(26,58,42,0.6)', borderColor: '#2D4A1E' }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-white">
                    Group {group.group_number}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#2D4A1E', color: '#9A9A50' }}>
                    {formatLabel}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {players.map(gp => (
                    <span
                      key={gp.id}
                      className="text-sm px-2 py-0.5 rounded"
                      style={{ background: 'rgba(26,58,42,0.8)', color: '#F5E6C3' }}
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
      <div className="border-b px-3 py-2 flex items-center justify-between" style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}>
        <button
          onClick={() => { setSelectedGroup(null); setAllowGroupOverride(false); setSelectedHole(1) }}
          className="text-sm"
          style={{ color: '#9A9A50' }}
        >
          ← Groups
        </button>
        <div className="text-center">
          <div className="text-xs" style={{ color: '#9A9A50' }}>Day {selectedDay} • Group {selectedGroup}</div>
          <div className="text-xs" style={{ color: '#5C5C2E' }}>{completedHoles()}/18 holes</div>
          <button
            onClick={() => setAllowGroupOverride(true)}
            className="text-xs mt-0.5"
            style={{ color: '#5C5C2E' }}
          >
            Change group
          </button>
        </div>
        {/* Connection status indicator */}
        <div className="flex flex-col items-end gap-0.5">
          {syncing ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#D4A947' }} />
              <span className="text-xs" style={{ color: '#D4A947' }}>Syncing {queueLength}</span>
            </div>
          ) : !isOnline ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#DC2626' }} />
              <span className="text-xs" style={{ color: '#DC2626' }}>
                {queueLength > 0 ? `${queueLength} queued` : 'Offline'}
              </span>
            </div>
          ) : queueLength > 0 ? (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#D4A947' }} />
              <span className="text-xs" style={{ color: '#D4A947' }}>{queueLength} syncing</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
              <span className="text-xs" style={{ color: '#9A9A50' }}>Online</span>
            </div>
          )}
          {!isOnline && queueLength > 0 && (
            <span className="text-xs" style={{ color: '#5C5C2E' }}>Day {selectedDay}</span>
          )}
        </div>
      </div>

      {/* Feature 3: Notification banner — slides in below top bar */}
      <div className="relative overflow-hidden" style={{ zIndex: 40 }}>
        {notifications.map(n => (
          <div
            key={n.id}
            onClick={() => dismissNotification(n.id)}
            className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none"
            style={{
              background: '#1A3A2A',
              borderBottom: '1px solid #2D4A1E',
              animation: 'slideInDown 0.3s ease-out',
            }}
          >
            <span className="text-sm font-medium" style={{ color: '#D4A947' }}>
              🏌️ {n.message}
            </span>
            <span className="text-xs ml-3 flex-shrink-0" style={{ color: '#9A9A50' }}>✕</span>
          </div>
        ))}
      </div>

      {/* Hole selector - scrollable */}
      <div className="border-b px-2 py-2" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {dayData.holes.map(hole => {
            const isActive = hole.hole_number === selectedHole
            const hasScore = holesWithScores.has(hole.hole_number)
            return (
              <button
                key={hole.hole_number}
                onClick={() => setSelectedHole(hole.hole_number)}
                className="flex-shrink-0 w-9 h-9 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: isActive ? '#D4A947' : hasScore ? '#2D4A1E' : 'rgba(26,58,42,0.4)',
                  color: isActive ? '#1A1A0A' : hasScore ? '#9A9A50' : '#5C5C2E',
                }}
              >
                {hole.hole_number}
              </button>
            )
          })}
        </div>
      </div>

      {/* Current hole info */}
      {currentHole && (
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ background: 'rgba(26,58,42,0.3)', borderColor: '#2D4A1E' }}>
          <div>
            <span className="text-2xl font-bold text-white">Hole {selectedHole}</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: '#D4A947' }}>Par {currentHole.par}</div>
            <div className="text-xs" style={{ color: '#5C5C2E' }}>HDCP {currentHole.handicap_rank}</div>
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
              className="rounded-xl border p-4"
              style={{ background: 'rgba(26,58,42,0.5)', borderColor: '#2D4A1E' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-white text-lg">{player.name}</span>
                  <div className="text-xs" style={{ color: '#9A9A50' }}>
                    CH: {ch} • PH: {ph} • {teeName}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Stroke dots */}
                  {chStrokes > 0 && (
                    <div className="flex gap-0.5 mr-2">
                      {Array.from({ length: chStrokes }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: '#D4A947' }} />
                      ))}
                    </div>
                  )}
                  {netScore !== null && (
                    <div
                      className="text-sm px-2 py-0.5 rounded font-medium"
                      style={{
                        background: netScore < (currentHole?.par ?? 4) ? 'rgba(220,38,38,0.2)'
                          : netScore === (currentHole?.par ?? 4) ? 'rgba(26,58,42,0.6)'
                          : 'rgba(26,26,10,0.6)',
                        color: netScore < (currentHole?.par ?? 4) ? '#DC2626'
                          : netScore === (currentHole?.par ?? 4) ? '#9A9A50'
                          : '#5C5C2E',
                      }}
                    >
                      Net {netScore}
                    </div>
                  )}
                </div>
              </div>

              {/* Undo button — only if this hole has a saved score */}
              {savedHoles.has(scoreKey(player.id, selectedHole)) && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => handleUndo(player.id)}
                    disabled={undoing}
                    className="text-xs px-2 py-1 rounded bg-orange-900/40 text-orange-400 border border-orange-800/50 hover:bg-orange-900/60 transition-all disabled:opacity-40"
                  >
                    ↩ Undo
                  </button>
                </div>
              )}

              {/* Score input */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => updateScore(player.id, (gross ?? currentHole?.par ?? 4) - 1)}
                  className="w-14 h-14 rounded-xl text-2xl font-bold active:scale-90 transition-all flex items-center justify-center"
                  style={{ background: '#1A3A2A', color: '#F5E6C3', border: '1px solid #2D4A1E' }}
                >
                  −
                </button>

                <div className="w-20 text-center">
                  <div className="text-4xl font-bold text-white">
                    {gross ?? '—'}
                  </div>
                  {gross !== undefined && currentHole && (() => {
                    const diff = gross - currentHole.par
                    const label = diff === 0 ? 'PAR'
                      : diff === -2 ? 'EAGLE'
                      : diff === -1 ? 'BIRDIE'
                      : diff === 1 ? 'BOGEY'
                      : diff === 2 ? 'DOUBLE'
                      : diff > 2 ? `+${diff}`
                      : `${diff}`
                    const color = diff <= -2 ? '#D4A947'    // eagle = gold
                      : diff === -1 ? '#DC2626'             // birdie = red
                      : diff === 0 ? '#F5E6C3'              // par = cream
                      : diff === 1 ? '#9A9A50'              // bogey = olive
                      : '#5C5C2E'                           // double+ = dark
                    return (
                      <div className="text-xs font-medium mt-0.5" style={{ color }}>
                        {label}
                      </div>
                    )
                  })()}
                </div>

                <button
                  onClick={() => updateScore(player.id, (gross ?? (currentHole?.par ?? 4) - 1) + 1)}
                  className="w-14 h-14 rounded-xl text-2xl font-bold active:scale-90 transition-all flex items-center justify-center"
                  style={{ background: '#1A3A2A', color: '#F5E6C3', border: '1px solid #2D4A1E' }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}

        {/* Feature 4: Match ticker — shown below player cards, above save button */}
        {groupMatches.length > 0 && (
          <div
            className="rounded-xl border px-4 py-3 space-y-1.5"
            style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9A9A50' }}>
              Your Match
            </div>
            {groupMatches.map(match => (
              <div key={match.id} className="text-sm font-medium" style={{ color: '#F5E6C3' }}>
                {formatMatchTicker(match)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save & Next button */}
      <div className="border-t px-4 py-3 safe-area-inset-bottom" style={{ borderColor: '#2D4A1E', background: '#1A1A0A' }}>
        {needsRefresh && (
          <div className="text-center text-sm mb-2 px-2 py-1 rounded" style={{ color: '#D4A947', background: 'rgba(212,169,71,0.1)', border: '1px solid rgba(212,169,71,0.3)' }}>
            Some scores failed to sync — refresh to retry
          </div>
        )}
        {saveMessage && (
          <div
            className="text-center text-sm mb-2"
            style={{ color: saveMessage.startsWith('Error') || saveMessage.startsWith('Undo failed') ? '#DC2626' : '#9A9A50' }}
          >
            {saveMessage}
          </div>
        )}
        <button
          onClick={saveCurrentHole}
          disabled={saving || !groupPlayers.some(gp =>
            localScores.has(scoreKey(gp.player_id, selectedHole))
          )}
          className="w-full py-4 rounded-xl font-bold text-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ background: '#D4A947', color: '#1A1A0A' }}
        >
          {saving ? 'Saving...' : selectedHole < 18 ? `Save & Next →` : 'Save Hole 18 ✓'}
        </button>
      </div>

      {/* CSS for slide-in animation */}
      <style jsx global>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
