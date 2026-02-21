'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getCourses() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('courses')
    .select('*')
    .order('day_number')
  return data || []
}

export async function getPlayers() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('players')
    .select('*')
    .order('display_order')
  return data || []
}

export async function getSettings() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('settings')
    .select('*')
  const map: Record<string, string> = {}
  data?.forEach(s => { map[s.key] = s.value })
  return map
}

export async function getGroupsForDay(dayNumber: number) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('groups')
    .select(`
      id, day_number, group_number, format,
      group_players(
        id, player_id, playing_handicap,
        players(id, name, handicap_index, team)
      )
    `)
    .eq('day_number', dayNumber)
    .order('group_number')
  return data || []
}

export async function getHolesForCourse(courseId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('holes')
    .select('*')
    .eq('course_id', courseId)
    .order('hole_number')
  return data || []
}

export async function getScoresForCourse(courseId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('scores')
    .select('*')
    .eq('course_id', courseId)
  return data || []
}

export async function getScoresForPlayer(playerId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('scores')
    .select('*, courses(day_number, name)')
    .eq('player_id', playerId)
    .order('hole_number')
  return data || []
}

export async function getTeeAssignments(courseId?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('player_tee_assignments')
    .select('*, players(name), tees(name, rating, slope), courses(name, day_number)')
  if (courseId) {
    query = query.eq('course_id', courseId)
  }
  const { data } = await query
  return data || []
}

export async function getMatchesForDay(dayNumber: number) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('matches')
    .select(`
      id, group_id, match_number, format, team_a_label, team_b_label,
      team_a_points, team_b_points, status,
      match_players(player_id, side, players(name, team)),
      groups!inner(day_number, group_number)
    `)
    .eq('groups.day_number', dayNumber)
    .order('match_number')
  return data || []
}

export async function getAllScores() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('scores')
    .select('*, players(name, team), courses(day_number, name, par_total)')
  return data || []
}

export async function getLeaderboardData() {
  const supabase = createAdminClient()

  // Get all players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('display_order')

  // Get all courses
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('day_number')

  // Get all holes
  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .order('hole_number')

  // Get all scores
  const { data: scores } = await supabase
    .from('scores')
    .select('*')

  // Get settings
  const { data: settingsRows } = await supabase
    .from('settings')
    .select('*')
  const settings: Record<string, string> = {}
  settingsRows?.forEach(s => { settings[s.key] = s.value })

  return {
    players: players || [],
    courses: courses || [],
    holes: holes || [],
    scores: scores || [],
    settings,
  }
}

export async function getTeesForCourse(courseId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tees')
    .select('*')
    .eq('course_id', courseId)
    .order('name')
  return data || []
}

// Create a new group with players
export async function createGroup(input: {
  dayNumber: number
  groupNumber: number
  format: string
  playerIds: string[]
}) {
  const supabase = createAdminClient()

  // 1. Insert the group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      day_number: input.dayNumber,
      group_number: input.groupNumber,
      format: input.format,
    })
    .select('id')
    .single()

  if (groupError || !group) {
    return { success: false, error: groupError?.message || 'Failed to create group' }
  }

  // 2. Get course_handicaps for these players on this day
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('day_number', input.dayNumber)
    .single()

  let phMap = new Map<string, number>()
  if (course) {
    const { data: teeAssignments } = await supabase
      .from('player_tee_assignments')
      .select('player_id, course_handicap')
      .eq('course_id', course.id)
      .in('player_id', input.playerIds)

    if (teeAssignments && teeAssignments.length > 0) {
      const minCH = Math.min(...teeAssignments.map(ta => ta.course_handicap))
      teeAssignments.forEach(ta => {
        phMap.set(ta.player_id, ta.course_handicap - minCH)
      })
    }
  }

  // 3. Insert group_players
  const groupPlayers = input.playerIds.map(pid => ({
    group_id: group.id,
    player_id: pid,
    playing_handicap: phMap.get(pid) ?? 0,
  }))

  const { error: gpError } = await supabase
    .from('group_players')
    .insert(groupPlayers)

  if (gpError) {
    // Rollback the group
    await supabase.from('groups').delete().eq('id', group.id)
    return { success: false, error: gpError.message }
  }

  return { success: true, groupId: group.id }
}

// Create a new match
export async function createMatch(input: {
  groupId: string
  matchNumber: number
  format: string
  teamAPlayerIds: string[]
  teamBPlayerIds: string[]
  teamALabel?: string
  teamBLabel?: string
}) {
  const supabase = createAdminClient()

  // 1. Insert the match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      group_id: input.groupId,
      match_number: input.matchNumber,
      format: input.format,
      team_a_label: input.teamALabel || 'USA',
      team_b_label: input.teamBLabel || 'Europe',
      team_a_points: 0,
      team_b_points: 0,
      status: 'not_started',
    })
    .select('id')
    .single()

  if (matchError || !match) {
    return { success: false, error: matchError?.message || 'Failed to create match' }
  }

  // 2. Insert match_players for side A
  const sideAPlayers = input.teamAPlayerIds.map(pid => ({
    match_id: match.id,
    player_id: pid,
    side: 'a',
  }))

  // 3. Insert match_players for side B
  const sideBPlayers = input.teamBPlayerIds.map(pid => ({
    match_id: match.id,
    player_id: pid,
    side: 'b',
  }))

  const { error: mpError } = await supabase
    .from('match_players')
    .insert([...sideAPlayers, ...sideBPlayers])

  if (mpError) {
    await supabase.from('matches').delete().eq('id', match.id)
    return { success: false, error: mpError.message }
  }

  return { success: true, matchId: match.id }
}

// Admin mutations
export async function updatePlayerTeam(playerId: string, team: 'USA' | 'Europe' | null) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('players')
    .update({ team })
    .eq('id', playerId)
  return { success: !error, error: error?.message }
}

export async function updateSetting(key: string, value: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('settings')
    .update({ value })
    .eq('key', key)
  return { success: !error, error: error?.message }
}

export async function updateGroupFormat(groupId: string, format: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('groups')
    .update({ format })
    .eq('id', groupId)
  return { success: !error, error: error?.message }
}

export async function getDayData(dayNumber: number) {
  const supabase = createAdminClient()

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('day_number', dayNumber)
    .single()

  if (!course) return null

  const [
    { data: holes },
    { data: groups },
    { data: scores },
    { data: teeAssignments },
  ] = await Promise.all([
    supabase.from('holes').select('*').eq('course_id', course.id).order('hole_number'),
    supabase.from('groups').select(`
      id, day_number, group_number, format,
      group_players(
        id, player_id, playing_handicap,
        players(id, name, handicap_index, team)
      )
    `).eq('day_number', dayNumber).order('group_number'),
    supabase.from('scores').select('*').eq('course_id', course.id),
    supabase.from('player_tee_assignments').select('*, tees(name)').eq('course_id', course.id),
  ])

  return {
    course,
    holes: holes || [],
    groups: groups || [],
    scores: scores || [],
    teeAssignments: teeAssignments || [],
  }
}
