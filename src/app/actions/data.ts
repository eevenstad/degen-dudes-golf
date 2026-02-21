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
