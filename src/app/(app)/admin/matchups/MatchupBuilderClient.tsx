'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDay3Matchups, type MatchupPair } from '@/app/actions/matchups'
import type { IslandAssignment } from '@/app/actions/island'

interface Player {
  id: string
  name: string
  handicap_index: number
  team: 'USA' | 'Europe' | null
  display_order: number
}

interface TeeAssignment {
  id: string
  player_id: string
  course_id: string
  course_handicap: number
  courses?: { name: string; day_number: number }
}

interface Day3Status {
  hasGroups: boolean
  hasMatches: boolean
  groupId: string | null
  matchCount: number
}

interface Props {
  players: Player[]
  settings: Record<string, string>
  teeAssignments: TeeAssignment[]
  islandAssignments: IslandAssignment[]
  day3Status: Day3Status
}

// Pick step shape
interface CompletedPick {
  pickNumber: number
  pickerTeam: string   // which team made this pick
  fiveTeamPlayerId: string
  fiveTeamPlayerName: string
  sixTeamPlayerId: string
  sixTeamPlayerName: string
}

type Phase = 'setup' | 'picking' | 'confirm' | 'done'

export default function MatchupBuilderClient({
  players,
  settings,
  teeAssignments,
  islandAssignments,
  day3Status,
}: Props) {
  const router = useRouter()
  const fiveTeam = settings.five_player_team || 'USA'
  const sixTeam = fiveTeam === 'USA' ? 'Europe' : 'USA'

  // Split players by team
  const fivePlayers = players.filter(p => p.team === fiveTeam)
  const sixPlayers = players.filter(p => p.team === sixTeam)

  // Pick order state
  const [firstPicker, setFirstPicker] = useState<string>(fiveTeam)
  const [phase, setPhase] = useState<Phase>(day3Status.hasGroups ? 'done' : 'setup')

  // Picking state
  const [completedPicks, setCompletedPicks] = useState<CompletedPick[]>([])
  // Who has been matched so far
  const [matchedFiveIds, setMatchedFiveIds] = useState<Set<string>>(new Set())
  const [matchedSixIds, setMatchedSixIds] = useState<Set<string>>(new Set())

  // Current pick selection
  const [selectedFivePlayer, setSelectedFivePlayer] = useState<string>('')
  const [selectedSixPlayer, setSelectedSixPlayer] = useState<string>('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Total picks = 4 (alternating between teams)
  const totalPicks = 4
  const currentPickNumber = completedPicks.length + 1

  // Determine whose turn it is
  // Pick 1: firstPicker, Pick 2: other, Pick 3: firstPicker, Pick 4: other
  const getCurrentPicker = (): string => {
    const pickIndex = completedPicks.length // 0-indexed
    return pickIndex % 2 === 0 ? firstPicker : (firstPicker === fiveTeam ? sixTeam : fiveTeam)
  }

  const currentPicker = getCurrentPicker()

  // Available players for current pick
  const availableFive = fivePlayers.filter(p => !matchedFiveIds.has(p.id))
  const availableSix = sixPlayers.filter(p => !matchedSixIds.has(p.id))

  // Island players = whoever is left after 4 picks
  const islandPlayer = fivePlayers.find(p => !matchedFiveIds.has(p.id) && p.id !== selectedFivePlayer)
  const islandOpponents = sixPlayers.filter(p => !matchedSixIds.has(p.id) && p.id !== selectedSixPlayer)

  // Get course handicap for day 3
  const getDay3CH = (playerId: string): number | null => {
    const ta = teeAssignments.find(t => t.player_id === playerId && t.courses?.day_number === 3)
    return ta ? ta.course_handicap : null
  }

  // Check if existing Day 3 island assignment exists
  const existingDay3Island = islandAssignments.find(a => a.day_number === 3)

  const handleStartPicking = () => {
    if (fivePlayers.length === 0 || sixPlayers.length === 0) {
      setError(`Teams not set up yet. Make sure players are assigned to ${fiveTeam} (5-player) and ${sixTeam} (6-player) teams.`)
      return
    }
    if (fivePlayers.length !== 5 || sixPlayers.length !== 6) {
      setError(`Need exactly 5 on ${fiveTeam} (have ${fivePlayers.length}) and 6 on ${sixTeam} (have ${sixPlayers.length}).`)
      return
    }
    setError('')
    setPhase('picking')
    setCompletedPicks([])
    setMatchedFiveIds(new Set())
    setMatchedSixIds(new Set())
    setSelectedFivePlayer('')
    setSelectedSixPlayer('')
  }

  const handleAddPick = () => {
    if (!selectedFivePlayer || !selectedSixPlayer) {
      setError('Select one player from each team to make a pick.')
      return
    }
    const fiveP = fivePlayers.find(p => p.id === selectedFivePlayer)!
    const sixP = sixPlayers.find(p => p.id === selectedSixPlayer)!

    const newPick: CompletedPick = {
      pickNumber: currentPickNumber,
      pickerTeam: currentPicker,
      fiveTeamPlayerId: selectedFivePlayer,
      fiveTeamPlayerName: fiveP.name,
      sixTeamPlayerId: selectedSixPlayer,
      sixTeamPlayerName: sixP.name,
    }

    const newMatchedFive = new Set(matchedFiveIds)
    newMatchedFive.add(selectedFivePlayer)
    const newMatchedSix = new Set(matchedSixIds)
    newMatchedSix.add(selectedSixPlayer)

    setCompletedPicks(prev => [...prev, newPick])
    setMatchedFiveIds(newMatchedFive)
    setMatchedSixIds(newMatchedSix)
    setSelectedFivePlayer('')
    setSelectedSixPlayer('')
    setError('')

    // After 4 picks, go to confirm
    if (completedPicks.length + 1 >= totalPicks) {
      setPhase('confirm')
    }
  }

  const handleUndoPick = () => {
    if (completedPicks.length === 0) return
    const last = completedPicks[completedPicks.length - 1]
    const newMatchedFive = new Set(matchedFiveIds)
    newMatchedFive.delete(last.fiveTeamPlayerId)
    const newMatchedSix = new Set(matchedSixIds)
    newMatchedSix.delete(last.sixTeamPlayerId)

    setCompletedPicks(prev => prev.slice(0, -1))
    setMatchedFiveIds(newMatchedFive)
    setMatchedSixIds(newMatchedSix)
    setSelectedFivePlayer('')
    setSelectedSixPlayer('')
    setPhase('picking')
    setError('')
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError('')

    // The remaining unmatched players become island
    const remainingFive = fivePlayers.filter(p => !matchedFiveIds.has(p.id))
    const remainingSix = sixPlayers.filter(p => !matchedSixIds.has(p.id))

    if (remainingFive.length !== 1 || remainingSix.length !== 2) {
      setError(`Unexpected state: ${remainingFive.length} five-team players and ${remainingSix.length} six-team players remaining.`)
      setSaving(false)
      return
    }

    const pairs: MatchupPair[] = completedPicks.map(pick => ({
      fiveTeamPlayerId: pick.fiveTeamPlayerId,
      fiveTeamPlayerName: pick.fiveTeamPlayerName,
      sixTeamPlayerId: pick.sixTeamPlayerId,
      sixTeamPlayerName: pick.sixTeamPlayerName,
    }))

    const result = await createDay3Matchups({
      pairs,
      islandPlayerId: remainingFive[0].id,
      islandPlayerName: remainingFive[0].name,
      islandOpponentAId: remainingSix[0].id,
      islandOpponentAName: remainingSix[0].name,
      islandOpponentBId: remainingSix[1].id,
      islandOpponentBName: remainingSix[1].name,
      fivePlayerTeam: fiveTeam,
      sixPlayerTeam: sixTeam,
    })

    if (result.success) {
      setSuccessMsg('Day 3 matchups created! 6 matches, 12 points total.')
      setPhase('done')
      router.refresh()
    } else {
      setError(result.error || 'Failed to create matchups')
    }
    setSaving(false)
  }

  const teamColor = (team: string) => team === 'USA' ? '#9A9A50' : '#E09030'
  const teamBg = (team: string) => team === 'USA' ? 'rgba(92,92,46,0.4)' : 'rgba(193,122,42,0.3)'
  const teamBorder = (team: string) => team === 'USA' ? '#9A9A50' : '#C17A2A'

  // ─── DONE STATE ──────────────────────────────────────────────────────────────
  if (phase === 'done' || day3Status.hasGroups) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <a href="/admin" style={{ color: '#9A9A50', fontSize: 14 }}>← Admin</a>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#D4A947' }}>⛳ Day 3 Matchups</h1>

        {successMsg && (
          <div className="rounded-xl border p-3 text-sm font-medium"
            style={{ background: 'rgba(26,58,42,0.6)', borderColor: '#9A9A50', color: '#F5E6C3' }}>
            ✓ {successMsg}
          </div>
        )}

        <div className="rounded-xl border p-4 space-y-2"
          style={{ background: 'rgba(212,169,71,0.1)', borderColor: '#D4A947' }}>
          <div className="font-bold" style={{ color: '#D4A947' }}>Day 3 is set up!</div>
          <div className="text-sm" style={{ color: '#9A9A50' }}>
            {day3Status.matchCount} matches created · 12 points available
          </div>
          {existingDay3Island && (
            <div className="text-sm mt-2" style={{ color: '#E09030' }}>
              🏝️ Island: {existingDay3Island.island_player?.name} vs {existingDay3Island.opponent_a?.name} &amp; {existingDay3Island.opponent_b?.name}
            </div>
          )}
        </div>

        <p className="text-xs" style={{ color: '#9A9A50' }}>
          Day 3 groups and matches have already been created. View them in the Admin → Groups and Matches tabs.
        </p>
      </div>
    )
  }

  // ─── SETUP PHASE ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="p-4 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <a href="/admin" style={{ color: '#9A9A50', fontSize: 14 }}>← Admin</a>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#D4A947' }}>⛳ Day 3 Matchup Builder</h1>
        <p className="text-sm" style={{ color: '#9A9A50' }}>
          Captains alternate selecting opponent pairings for Day 3 (all singles, 2 pts each).
          The last unpaired player from the 5-player team becomes the island player.
        </p>

        {/* Team preview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3" style={{ background: teamBg(fiveTeam), borderColor: teamBorder(fiveTeam) }}>
            <div className="font-bold text-sm mb-2" style={{ color: teamColor(fiveTeam) }}>
              {fiveTeam} (5-player)
            </div>
            {fivePlayers.length === 0 ? (
              <p className="text-xs" style={{ color: '#9A9A50' }}>No players assigned</p>
            ) : (
              fivePlayers.map(p => (
                <div key={p.id} className="text-xs py-0.5" style={{ color: '#F5E6C3' }}>{p.name}</div>
              ))
            )}
            {fivePlayers.length !== 5 && (
              <div className="text-xs mt-1" style={{ color: '#DC2626' }}>⚠ Need 5 players</div>
            )}
          </div>
          <div className="rounded-xl border p-3" style={{ background: teamBg(sixTeam), borderColor: teamBorder(sixTeam) }}>
            <div className="font-bold text-sm mb-2" style={{ color: teamColor(sixTeam) }}>
              {sixTeam} (6-player)
            </div>
            {sixPlayers.length === 0 ? (
              <p className="text-xs" style={{ color: '#9A9A50' }}>No players assigned</p>
            ) : (
              sixPlayers.map(p => (
                <div key={p.id} className="text-xs py-0.5" style={{ color: '#F5E6C3' }}>{p.name}</div>
              ))
            )}
            {sixPlayers.length !== 6 && (
              <div className="text-xs mt-1" style={{ color: '#DC2626' }}>⚠ Need 6 players</div>
            )}
          </div>
        </div>

        {/* Pick order */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: '#2D4A1E', background: 'rgba(26,58,42,0.4)' }}>
          <h2 className="font-bold" style={{ color: '#F5E6C3' }}>7e: Who picks first?</h2>
          <p className="text-xs" style={{ color: '#9A9A50' }}>
            Set by the admin before the draft begins. Each team makes 2 alternating picks (4 picks total).
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFirstPicker(fiveTeam)}
              className="flex-1 py-3 rounded-xl font-bold text-sm border transition-all"
              style={{
                background: firstPicker === fiveTeam ? teamBg(fiveTeam) : 'transparent',
                borderColor: firstPicker === fiveTeam ? teamBorder(fiveTeam) : '#2D4A1E',
                color: firstPicker === fiveTeam ? teamColor(fiveTeam) : '#9A9A50',
              }}
            >
              {fiveTeam} picks first
            </button>
            <button
              onClick={() => setFirstPicker(sixTeam)}
              className="flex-1 py-3 rounded-xl font-bold text-sm border transition-all"
              style={{
                background: firstPicker === sixTeam ? teamBg(sixTeam) : 'transparent',
                borderColor: firstPicker === sixTeam ? teamBorder(sixTeam) : '#2D4A1E',
                color: firstPicker === sixTeam ? teamColor(sixTeam) : '#9A9A50',
              }}
            >
              {sixTeam} picks first
            </button>
          </div>
        </div>

        {/* Island assignment info */}
        {existingDay3Island ? (
          <div className="rounded-xl border p-3" style={{ background: 'rgba(193,122,42,0.15)', borderColor: '#C17A2A' }}>
            <div className="text-sm font-bold mb-1" style={{ color: '#E09030' }}>🏝️ Day 3 Island Already Assigned</div>
            <div className="text-xs" style={{ color: '#9A9A50' }}>
              Island player: {existingDay3Island.island_player?.name} · Opponents: {existingDay3Island.opponent_a?.name} &amp; {existingDay3Island.opponent_b?.name}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border p-3" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
            <div className="text-xs" style={{ color: '#9A9A50' }}>
              🏝️ Island player will be automatically determined from the pick process — the last unpaired player from {fiveTeam}.
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border p-3 text-sm" style={{ background: 'rgba(139,26,26,0.2)', borderColor: 'rgba(139,26,26,0.4)', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStartPicking}
          disabled={fivePlayers.length !== 5 || sixPlayers.length !== 6}
          className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
          style={{ background: '#D4A947', color: '#1A1A0A' }}
        >
          Start Matchup Draft →
        </button>
      </div>
    )
  }

  // ─── PICKING PHASE ───────────────────────────────────────────────────────────
  if (phase === 'picking') {
    const picksLeft = totalPicks - completedPicks.length
    const isCurrentPickerFive = currentPicker === fiveTeam
    // When it's fiveTeam's turn: they pick one of their players + assign an opponent
    // When it's sixTeam's turn: they pick one of their players + assign an opponent from fiveTeam
    const pickerAvailable = isCurrentPickerFive ? availableFive : availableSix
    const opponentAvailable = isCurrentPickerFive ? availableSix : availableFive

    // The current picker selects from their own team first, then assigns opponent
    const pickerSelectedId = isCurrentPickerFive ? selectedFivePlayer : selectedSixPlayer
    const opponentSelectedId = isCurrentPickerFive ? selectedSixPlayer : selectedFivePlayer

    const handlePickerSelect = (id: string) => {
      if (isCurrentPickerFive) {
        setSelectedFivePlayer(id === selectedFivePlayer ? '' : id)
      } else {
        setSelectedSixPlayer(id === selectedSixPlayer ? '' : id)
      }
    }

    const handleOpponentSelect = (id: string) => {
      if (isCurrentPickerFive) {
        setSelectedSixPlayer(id === selectedSixPlayer ? '' : id)
      } else {
        setSelectedFivePlayer(id === selectedFivePlayer ? '' : id)
      }
    }

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <a href="/admin" style={{ color: '#9A9A50', fontSize: 14 }}>← Admin</a>
        </div>
        <h1 className="text-xl font-bold" style={{ color: '#D4A947' }}>⛳ Day 3 Draft</h1>

        {/* Progress bar */}
        <div className="rounded-full overflow-hidden h-2" style={{ background: '#1A3A2A' }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${(completedPicks.length / totalPicks) * 100}%`,
              background: '#D4A947',
            }}
          />
        </div>
        <div className="text-xs text-center" style={{ color: '#9A9A50' }}>
          Pick {currentPickNumber} of {totalPicks} · {picksLeft} left
        </div>

        {/* Current turn banner */}
        <div
          className="rounded-xl border p-3 text-center"
          style={{
            background: teamBg(currentPicker),
            borderColor: teamBorder(currentPicker),
          }}
        >
          <div className="font-bold" style={{ color: teamColor(currentPicker) }}>
            {currentPicker}&apos;s Turn to Pick
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#F5E6C3' }}>
            Select one of your players, then choose their opponent
          </div>
        </div>

        {/* Pick selector */}
        <div className="space-y-3">
          {/* Picker's team */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: teamColor(currentPicker) }}>
              {currentPicker} — select your player:
            </div>
            <div className="space-y-1.5">
              {pickerAvailable.map(p => {
                const ch = getDay3CH(p.id)
                const isSelected = pickerSelectedId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePickerSelect(p.id)}
                    className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm border transition-all"
                    style={{
                      background: isSelected ? teamBg(currentPicker) : 'rgba(26,58,42,0.3)',
                      borderColor: isSelected ? teamBorder(currentPicker) : '#2D4A1E',
                      color: isSelected ? '#F5E6C3' : '#9A9A50',
                    }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      {ch !== null && (
                        <span className="text-xs" style={{ color: isSelected ? teamColor(currentPicker) : '#2D4A1E' }}>
                          CH: {ch}
                        </span>
                      )}
                      {isSelected && <span style={{ color: teamColor(currentPicker) }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* vs divider */}
          <div className="text-center text-xs font-bold" style={{ color: '#D4A947' }}>⚔ vs</div>

          {/* Opponent team */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: teamColor(currentPicker === fiveTeam ? sixTeam : fiveTeam) }}>
              {currentPicker === fiveTeam ? sixTeam : fiveTeam} — assign opponent:
            </div>
            <div className="space-y-1.5">
              {opponentAvailable.map(p => {
                const ch = getDay3CH(p.id)
                const oppTeam = currentPicker === fiveTeam ? sixTeam : fiveTeam
                const isSelected = opponentSelectedId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => handleOpponentSelect(p.id)}
                    className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm border transition-all"
                    style={{
                      background: isSelected ? teamBg(oppTeam) : 'rgba(26,58,42,0.3)',
                      borderColor: isSelected ? teamBorder(oppTeam) : '#2D4A1E',
                      color: isSelected ? '#F5E6C3' : '#9A9A50',
                    }}
                  >
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      {ch !== null && (
                        <span className="text-xs" style={{ color: isSelected ? teamColor(oppTeam) : '#2D4A1E' }}>
                          CH: {ch}
                        </span>
                      )}
                      {isSelected && <span style={{ color: teamColor(oppTeam) }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border p-3 text-sm" style={{ background: 'rgba(139,26,26,0.2)', borderColor: 'rgba(139,26,26,0.4)', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {completedPicks.length > 0 && (
            <button
              onClick={handleUndoPick}
              className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium border transition-all"
              style={{ borderColor: '#2D4A1E', color: '#9A9A50', background: 'transparent' }}
            >
              ← Undo
            </button>
          )}
          <button
            onClick={handleAddPick}
            disabled={!pickerSelectedId || !opponentSelectedId}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
            style={{ background: '#D4A947', color: '#1A1A0A' }}
          >
            {completedPicks.length + 1 === totalPicks ? 'Final Pick →' : `Confirm Pick ${currentPickNumber} →`}
          </button>
        </div>

        {/* Completed picks so far */}
        {completedPicks.length > 0 && (
          <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: '#2D4A1E', background: 'rgba(26,58,42,0.3)' }}>
            <div className="text-xs font-medium" style={{ color: '#9A9A50' }}>Completed picks:</div>
            {completedPicks.map(pick => (
              <div key={pick.pickNumber} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-bold rounded px-1.5 py-0.5" style={{ background: teamBg(pick.pickerTeam), color: teamColor(pick.pickerTeam) }}>
                  P{pick.pickNumber}
                </span>
                <span style={{ color: teamColor(fiveTeam) }}>{pick.fiveTeamPlayerName}</span>
                <span style={{ color: '#D4A947' }}>vs</span>
                <span style={{ color: teamColor(sixTeam) }}>{pick.sixTeamPlayerName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── CONFIRM PHASE ───────────────────────────────────────────────────────────
  if (phase === 'confirm') {
    const remainingFive = fivePlayers.filter(p => !matchedFiveIds.has(p.id))
    const remainingSix = sixPlayers.filter(p => !matchedSixIds.has(p.id))

    // Safety check
    if (remainingFive.length !== 1 || remainingSix.length !== 2) {
      return (
        <div className="p-4">
          <div className="text-red-400">Unexpected state. Please go back and restart.</div>
          <button onClick={() => { setPhase('setup'); setCompletedPicks([]); setMatchedFiveIds(new Set()); setMatchedSixIds(new Set()) }}
            className="mt-4 px-4 py-2 rounded-xl" style={{ background: '#C17A2A', color: '#1A1A0A' }}>
            Restart
          </button>
        </div>
      )
    }

    const islandP = remainingFive[0]
    const oppA = remainingSix[0]
    const oppB = remainingSix[1]

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <a href="/admin" style={{ color: '#9A9A50', fontSize: 14 }}>← Admin</a>
        </div>
        <h1 className="text-xl font-bold" style={{ color: '#D4A947' }}>⛳ Confirm Day 3 Matchups</h1>
        <p className="text-xs" style={{ color: '#9A9A50' }}>
          Review all matchups before creating. This cannot be undone without deleting the groups.
        </p>

        {/* Regular matches */}
        <div className="space-y-2">
          <div className="text-sm font-bold" style={{ color: '#F5E6C3' }}>Singles Matches (4 × 2 pts)</div>
          {completedPicks.map((pick, i) => (
            <div key={i} className="rounded-xl border p-3" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,169,71,0.2)', color: '#D4A947' }}>
                    M{i + 1}
                  </span>
                  <span style={{ color: teamColor(fiveTeam) }}>{pick.fiveTeamPlayerName}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: '#D4A947' }}>vs</span>
                <div className="flex items-center gap-1">
                  <span style={{ color: teamColor(sixTeam) }}>{pick.sixTeamPlayerName}</span>
                  <span className="text-xs" style={{ color: '#9A9A50' }}>
                    (P{pick.pickNumber} by {pick.pickerTeam})
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Island match */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'rgba(193,122,42,0.15)', borderColor: '#C17A2A' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏝️</span>
            <span className="font-bold" style={{ color: '#E09030' }}>Island Matchup (2 × 2 pts)</span>
          </div>
          <div className="text-sm space-y-1.5">
            <div>
              <span className="text-xs font-medium" style={{ color: '#9A9A50' }}>Island Player ({fiveTeam}): </span>
              <span className="font-bold" style={{ color: teamColor(fiveTeam) }}>{islandP.name}</span>
            </div>
            <div className="flex flex-col gap-1 pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#9A9A50' }}>vs</span>
                <span className="font-medium" style={{ color: teamColor(sixTeam) }}>{oppA.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#9A9A50' }}>vs</span>
                <span className="font-medium" style={{ color: teamColor(sixTeam) }}>{oppB.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Point summary */}
        <div className="rounded-xl border p-3" style={{ background: 'rgba(212,169,71,0.1)', borderColor: '#D4A947' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#9A9A50' }}>Regular matches: 4 × 2 pts</span>
            <span style={{ color: '#D4A947' }}>= 8 pts</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: '#9A9A50' }}>Island matches: 2 × 2 pts</span>
            <span style={{ color: '#D4A947' }}>= 4 pts</span>
          </div>
          <div className="flex justify-between text-sm font-bold mt-1 pt-1" style={{ borderTop: '1px solid #2D4A1E' }}>
            <span style={{ color: '#F5E6C3' }}>Total Day 3</span>
            <span style={{ color: '#D4A947' }}>12 pts</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border p-3 text-sm" style={{ background: 'rgba(139,26,26,0.2)', borderColor: 'rgba(139,26,26,0.4)', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleUndoPick}
            disabled={saving}
            className="px-5 py-3 rounded-xl text-sm font-medium border transition-all"
            style={{ borderColor: '#2D4A1E', color: '#9A9A50' }}
          >
            ← Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
            style={{ background: '#D4A947', color: '#1A1A0A' }}
          >
            {saving ? 'Creating...' : '✓ Create All Matchups'}
          </button>
        </div>
      </div>
    )
  }

  return null
}
