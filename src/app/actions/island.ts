'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface IslandAssignment {
  id: string
  day_number: number
  island_player_id: string
  opponent_a_id: string
  opponent_b_id: string
  match_a_id: string | null
  match_b_id: string | null
  created_at: string
  island_player?: { name: string; team: string }
  opponent_a?: { name: string; team: string }
  opponent_b?: { name: string; team: string }
}

export interface EligiblePlayer {
  id: string
  name: string
  team: string
}

// Get all island assignments with player names
export async function getIslandAssignments(): Promise<IslandAssignment[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('island_player_assignments')
    .select('*')
    .order('day_number')

  if (!data || data.length === 0) return []

  // Fetch player names for all referenced player IDs
  const playerIds = new Set<string>()
  data.forEach(a => {
    playerIds.add(a.island_player_id)
    playerIds.add(a.opponent_a_id)
    playerIds.add(a.opponent_b_id)
  })

  const { data: players } = await supabase
    .from('players')
    .select('id, name, team')
    .in('id', Array.from(playerIds))

  const playerMap = new Map(players?.map(p => [p.id, p]) || [])

  return data.map(a => ({
    ...a,
    island_player: playerMap.get(a.island_player_id) as { name: string; team: string } | undefined,
    opponent_a: playerMap.get(a.opponent_a_id) as { name: string; team: string } | undefined,
    opponent_b: playerMap.get(a.opponent_b_id) as { name: string; team: string } | undefined,
  }))
}

// Get eligible island players (5-team members not yet assigned as island player)
export async function getEligibleIslandPlayers(fivePlayerTeam: string): Promise<EligiblePlayer[]> {
  const supabase = createAdminClient()

  // Get all players on the 5-player team
  const { data: teamPlayers } = await supabase
    .from('players')
    .select('id, name, team')
    .eq('team', fivePlayerTeam)
    .order('display_order')

  if (!teamPlayers) return []

  // Get players already assigned as island player
  const { data: existing } = await supabase
    .from('island_player_assignments')
    .select('island_player_id')

  const usedIds = new Set(existing?.map(e => e.island_player_id) || [])

  return teamPlayers.filter(p => !usedIds.has(p.id)) as EligiblePlayer[]
}

// Get eligible island opponents (6-team members not yet used as island opponents)
export async function getEligibleIslandOpponents(sixPlayerTeam: string): Promise<EligiblePlayer[]> {
  const supabase = createAdminClient()

  // Get all players on the 6-player team
  const { data: teamPlayers } = await supabase
    .from('players')
    .select('id, name, team')
    .eq('team', sixPlayerTeam)
    .order('display_order')

  if (!teamPlayers) return []

  // Get players already used as opponents
  const { data: existing } = await supabase
    .from('island_player_assignments')
    .select('opponent_a_id, opponent_b_id')

  const usedIds = new Set<string>()
  existing?.forEach(e => {
    usedIds.add(e.opponent_a_id)
    usedIds.add(e.opponent_b_id)
  })

  return teamPlayers.filter(p => !usedIds.has(p.id)) as EligiblePlayer[]
}

// Get island match IDs for a given day (for ISLAND badge display)
export async function getIslandMatchIds(dayNumber: number): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('island_player_assignments')
    .select('match_a_id, match_b_id')
    .eq('day_number', dayNumber)
    .single()

  if (!data) return []
  const ids: string[] = []
  if (data.match_a_id) ids.push(data.match_a_id)
  if (data.match_b_id) ids.push(data.match_b_id)
  return ids
}

// Create island assignment + 2 singles matches
export async function createIslandAssignment(input: {
  dayNumber: number
  islandPlayerId: string
  opponentAId: string
  opponentBId: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  // 1. Validate island player hasn't been island player before
  const { data: existingIsland } = await supabase
    .from('island_player_assignments')
    .select('id')
    .eq('island_player_id', input.islandPlayerId)

  if (existingIsland && existingIsland.length > 0) {
    return { success: false, error: 'This player has already been island player' }
  }

  // 2. Validate this day doesn't already have an island assignment
  const { data: existingDay } = await supabase
    .from('island_player_assignments')
    .select('id')
    .eq('day_number', input.dayNumber)

  if (existingDay && existingDay.length > 0) {
    return { success: false, error: `Day ${input.dayNumber} already has an island assignment` }
  }

  // 3. Validate opponents haven't been island opponents before
  const { data: existingOpponents } = await supabase
    .from('island_player_assignments')
    .select('opponent_a_id, opponent_b_id')

  const usedOpponentIds = new Set<string>()
  existingOpponents?.forEach(e => {
    usedOpponentIds.add(e.opponent_a_id)
    usedOpponentIds.add(e.opponent_b_id)
  })

  if (usedOpponentIds.has(input.opponentAId)) {
    return { success: false, error: 'Opponent A has already been an island opponent' }
  }
  if (usedOpponentIds.has(input.opponentBId)) {
    return { success: false, error: 'Opponent B has already been an island opponent' }
  }

  // 4. Validate all players are on correct teams
  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'five_player_team')
    .single()

  const fiveTeam = settingRow?.value || 'USA'
  const sixTeam = fiveTeam === 'USA' ? 'Europe' : 'USA'

  const { data: islandPlayer } = await supabase
    .from('players')
    .select('team')
    .eq('id', input.islandPlayerId)
    .single()

  const { data: oppA } = await supabase
    .from('players')
    .select('team')
    .eq('id', input.opponentAId)
    .single()

  const { data: oppB } = await supabase
    .from('players')
    .select('team')
    .eq('id', input.opponentBId)
    .single()

  if (islandPlayer?.team !== fiveTeam) {
    return { success: false, error: `Island player must be on ${fiveTeam} (5-player team)` }
  }
  if (oppA?.team !== sixTeam) {
    return { success: false, error: `Opponent A must be on ${sixTeam} (6-player team)` }
  }
  if (oppB?.team !== sixTeam) {
    return { success: false, error: `Opponent B must be on ${sixTeam} (6-player team)` }
  }

  // 5. Find Group 3 for this day
  const { data: group3 } = await supabase
    .from('groups')
    .select('id')
    .eq('day_number', input.dayNumber)
    .eq('group_number', 3)
    .single()

  if (!group3) {
    return { success: false, error: `Group 3 for Day ${input.dayNumber} doesn't exist yet. Create groups first.` }
  }

  // 6. Determine point value
  const pointValue = input.dayNumber === 3 ? 2 : 1

  // 7. Determine team labels
  const teamALabel = fiveTeam
  const teamBLabel = sixTeam

  // 8. Get next match number for this group
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('match_number')
    .eq('group_id', group3.id)
    .order('match_number', { ascending: false })
    .limit(1)

  const nextMatchNumber = (existingMatches?.[0]?.match_number ?? 0) + 1

  // 9. Create Match A: island player vs opponent A
  const { data: matchA, error: matchAError } = await supabase
    .from('matches')
    .insert({
      group_id: group3.id,
      match_number: nextMatchNumber,
      format: 'singles_match',
      team_a_label: teamALabel,
      team_b_label: teamBLabel,
      team_a_points: 0,
      team_b_points: 0,
      status: 'not_started',
      point_value: pointValue,
    })
    .select('id')
    .single()

  if (matchAError || !matchA) {
    return { success: false, error: matchAError?.message || 'Failed to create match A' }
  }

  // Create match_players for match A
  const { error: mpAError } = await supabase
    .from('match_players')
    .insert([
      { match_id: matchA.id, player_id: input.islandPlayerId, side: 'a' },
      { match_id: matchA.id, player_id: input.opponentAId, side: 'b' },
    ])

  if (mpAError) {
    await supabase.from('matches').delete().eq('id', matchA.id)
    return { success: false, error: mpAError.message }
  }

  // 10. Create Match B: island player vs opponent B
  const { data: matchB, error: matchBError } = await supabase
    .from('matches')
    .insert({
      group_id: group3.id,
      match_number: nextMatchNumber + 1,
      format: 'singles_match',
      team_a_label: teamALabel,
      team_b_label: teamBLabel,
      team_a_points: 0,
      team_b_points: 0,
      status: 'not_started',
      point_value: pointValue,
    })
    .select('id')
    .single()

  if (matchBError || !matchB) {
    // Rollback match A
    await supabase.from('match_players').delete().eq('match_id', matchA.id)
    await supabase.from('matches').delete().eq('id', matchA.id)
    return { success: false, error: matchBError?.message || 'Failed to create match B' }
  }

  // Create match_players for match B
  const { error: mpBError } = await supabase
    .from('match_players')
    .insert([
      { match_id: matchB.id, player_id: input.islandPlayerId, side: 'a' },
      { match_id: matchB.id, player_id: input.opponentBId, side: 'b' },
    ])

  if (mpBError) {
    await supabase.from('match_players').delete().eq('match_id', matchA.id)
    await supabase.from('matches').delete().eq('id', matchA.id)
    await supabase.from('matches').delete().eq('id', matchB.id)
    return { success: false, error: mpBError.message }
  }

  // 11. Create the island_player_assignments row
  const { error: assignError } = await supabase
    .from('island_player_assignments')
    .insert({
      day_number: input.dayNumber,
      island_player_id: input.islandPlayerId,
      opponent_a_id: input.opponentAId,
      opponent_b_id: input.opponentBId,
      match_a_id: matchA.id,
      match_b_id: matchB.id,
    })

  if (assignError) {
    // Rollback both matches
    await supabase.from('match_players').delete().eq('match_id', matchA.id)
    await supabase.from('match_players').delete().eq('match_id', matchB.id)
    await supabase.from('matches').delete().eq('id', matchA.id)
    await supabase.from('matches').delete().eq('id', matchB.id)
    return { success: false, error: assignError.message }
  }

  return { success: true }
}

// Delete an island assignment and its associated matches
export async function deleteIslandAssignment(assignmentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  // Get the assignment first to find match IDs
  const { data: assignment } = await supabase
    .from('island_player_assignments')
    .select('match_a_id, match_b_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) {
    return { success: false, error: 'Assignment not found' }
  }

  // Delete match_players and matches for both island matches
  const matchIds = [assignment.match_a_id, assignment.match_b_id].filter(Boolean) as string[]
  if (matchIds.length > 0) {
    await supabase.from('match_players').delete().in('match_id', matchIds)
    await supabase.from('matches').delete().in('id', matchIds)
  }

  // Delete the assignment
  const { error } = await supabase
    .from('island_player_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
