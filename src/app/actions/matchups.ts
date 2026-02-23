'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createIslandAssignment } from './island'

export interface MatchupPair {
  // Player from 5-team
  fiveTeamPlayerId: string
  fiveTeamPlayerName: string
  // Player from 6-team
  sixTeamPlayerId: string
  sixTeamPlayerName: string
}

export interface Day3MatchupInput {
  // 4 regular pairings
  pairs: MatchupPair[]
  // Island player (last from 5-team)
  islandPlayerId: string
  islandPlayerName: string
  // Island opponents (last 2 from 6-team)
  islandOpponentAId: string
  islandOpponentAName: string
  islandOpponentBId: string
  islandOpponentBName: string
  // Team labels
  fivePlayerTeam: string
  sixPlayerTeam: string
}

export interface Day3MatchupResult {
  success: boolean
  error?: string
}

/**
 * Creates all Day 3 groups + matches in one shot:
 * - Creates Group 3 for Day 3 (singles_match format) if it doesn't exist
 * - Adds ALL 11 players to the group with correct playing handicaps
 * - Creates 4 regular singles matches (point_value=2)
 * - Calls createIslandAssignment for the island matchup (creates 2 more matches)
 * Total: 6 match results, 12 points
 */
export async function createDay3Matchups(input: Day3MatchupInput): Promise<Day3MatchupResult> {
  const supabase = createAdminClient()

  // 1. Check if Day 3 already has groups / matches
  const { data: existingGroups } = await supabase
    .from('groups')
    .select('id')
    .eq('day_number', 3)

  if (existingGroups && existingGroups.length > 0) {
    return { success: false, error: 'Day 3 groups already exist. Delete them first if you want to redo matchups.' }
  }

  // 2. Get the Day 3 course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('day_number', 3)
    .single()

  if (courseError || !course) {
    return { success: false, error: 'Day 3 course not found in database.' }
  }

  // 3. Gather all 11 player IDs
  const allPlayerIds = [
    ...input.pairs.map(p => p.fiveTeamPlayerId),
    ...input.pairs.map(p => p.sixTeamPlayerId),
    input.islandPlayerId,
    input.islandOpponentAId,
    input.islandOpponentBId,
  ]

  // 4. Get tee assignments for all players on Day 3 course
  const { data: teeAssignments } = await supabase
    .from('player_tee_assignments')
    .select('player_id, course_handicap')
    .eq('course_id', course.id)
    .in('player_id', allPlayerIds)

  // 5. Compute playing handicaps (PH = course_handicap - min_course_handicap)
  const phMap = new Map<string, number>()
  if (teeAssignments && teeAssignments.length > 0) {
    const minCH = Math.min(...teeAssignments.map(ta => ta.course_handicap))
    teeAssignments.forEach(ta => {
      phMap.set(ta.player_id, ta.course_handicap - minCH)
    })
  }

  // 6. Create Group 3 for Day 3
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      day_number: 3,
      group_number: 3,
      format: 'singles_match',
    })
    .select('id')
    .single()

  if (groupError || !group) {
    return { success: false, error: groupError?.message || 'Failed to create Day 3 group' }
  }

  // 7. Insert all 11 group_players
  const groupPlayers = allPlayerIds.map(pid => ({
    group_id: group.id,
    player_id: pid,
    playing_handicap: phMap.get(pid) ?? 0,
  }))

  const { error: gpError } = await supabase
    .from('group_players')
    .insert(groupPlayers)

  if (gpError) {
    // Rollback group
    await supabase.from('groups').delete().eq('id', group.id)
    return { success: false, error: gpError.message }
  }

  // 8. Create 4 regular singles matches (point_value=2)
  // For each pair: fiveTeam is 'a' side, sixTeam is 'b' side
  const fiveTeam = input.fivePlayerTeam
  const sixTeam = input.sixPlayerTeam

  for (let i = 0; i < input.pairs.length; i++) {
    const pair = input.pairs[i]
    const matchNumber = i + 1

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        group_id: group.id,
        match_number: matchNumber,
        format: 'singles_match',
        team_a_label: fiveTeam,
        team_b_label: sixTeam,
        team_a_points: 0,
        team_b_points: 0,
        status: 'not_started',
        point_value: 2,
      })
      .select('id')
      .single()

    if (matchError || !match) {
      // Rollback everything
      await supabase.from('group_players').delete().eq('group_id', group.id)
      await supabase.from('groups').delete().eq('id', group.id)
      return { success: false, error: matchError?.message || `Failed to create match ${matchNumber}` }
    }

    // Insert match_players
    const { error: mpError } = await supabase
      .from('match_players')
      .insert([
        { match_id: match.id, player_id: pair.fiveTeamPlayerId, side: 'a' },
        { match_id: match.id, player_id: pair.sixTeamPlayerId, side: 'b' },
      ])

    if (mpError) {
      // Rollback
      await supabase.from('match_players').delete().eq('match_id', match.id)
      await supabase.from('matches').delete().eq('id', match.id)
      await supabase.from('group_players').delete().eq('group_id', group.id)
      await supabase.from('groups').delete().eq('id', group.id)
      return { success: false, error: mpError.message }
    }
  }

  // 9. Create island assignment (which also creates 2 more singles matches)
  // createIslandAssignment looks up Group 3 for day_number=3 — which we just created
  const islandResult = await createIslandAssignment({
    dayNumber: 3,
    islandPlayerId: input.islandPlayerId,
    opponentAId: input.islandOpponentAId,
    opponentBId: input.islandOpponentBId,
  })

  if (!islandResult.success) {
    // Rollback regular matches + group
    // Note: we can't easily roll back match_players here without tracking IDs,
    // but deleting the group should cascade if FK constraints allow it.
    // We rely on Supabase cascade or manual cleanup.
    await supabase.from('group_players').delete().eq('group_id', group.id)
    // Get matches in this group to delete match_players
    const { data: matchesToDelete } = await supabase
      .from('matches')
      .select('id')
      .eq('group_id', group.id)
    if (matchesToDelete) {
      const ids = matchesToDelete.map(m => m.id)
      if (ids.length > 0) {
        await supabase.from('match_players').delete().in('match_id', ids)
        await supabase.from('matches').delete().in('id', ids)
      }
    }
    await supabase.from('groups').delete().eq('id', group.id)
    return { success: false, error: `Island assignment failed: ${islandResult.error}` }
  }

  return { success: true }
}

/**
 * Check if Day 3 matchups already exist
 */
export async function getDay3Status(): Promise<{
  hasGroups: boolean
  hasMatches: boolean
  groupId: string | null
  matchCount: number
}> {
  const supabase = createAdminClient()

  const { data: groups } = await supabase
    .from('groups')
    .select('id')
    .eq('day_number', 3)

  if (!groups || groups.length === 0) {
    return { hasGroups: false, hasMatches: false, groupId: null, matchCount: 0 }
  }

  const groupIds = groups.map(g => g.id)
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .in('group_id', groupIds)

  return {
    hasGroups: true,
    hasMatches: (matches?.length ?? 0) > 0,
    groupId: groups[0].id,
    matchCount: matches?.length ?? 0,
  }
}
