'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { calcStrokesOnHole, calcNetScore } from '@/lib/scoring'

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
      team_a_points, team_b_points, status, point_value,
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

/**
 * Get running hole-by-hole match scores for all matches on a given day.
 * Returns the internal tally (not scaled match-level points) + holes completed.
 * Used by the match ticker (Feature 4) and notifications (Feature 3).
 */
export interface RunningMatchScore {
  matchId: string
  groupNumber: number
  format: string
  teamALabel: string
  teamBLabel: string
  teamAPlayers: string[]
  teamBPlayers: string[]
  teamARunning: number   // internal hole-by-hole points won by A
  teamBRunning: number   // internal hole-by-hole points won by B
  holesCompleted: number  // how many holes ALL players in the match have scored
}

export async function getRunningMatchScores(dayNumber: number): Promise<RunningMatchScore[]> {
  const supabase = createAdminClient()

  // Get course for this day
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('day_number', dayNumber)
    .single()
  if (!course) return []

  // Get holes for the course
  const { data: holes } = await supabase
    .from('holes')
    .select('hole_number, par, handicap_rank')
    .eq('course_id', course.id)
    .order('hole_number')
  if (!holes) return []

  // Get all matches for this day with players
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, group_id, format, team_a_label, team_b_label,
      match_players(player_id, side, players(name)),
      groups!inner(day_number, group_number)
    `)
    .eq('groups.day_number', dayNumber)

  if (!matches) return []

  // Get all scores for this course
  const { data: allScores } = await supabase
    .from('scores')
    .select('player_id, hole_number, gross_score')
    .eq('course_id', course.id)
  if (!allScores) return []

  // Get playing handicaps for all groups on this day
  const { data: allGroupPlayers } = await supabase
    .from('group_players')
    .select('player_id, playing_handicap, group_id, groups!inner(day_number)')
    .eq('groups.day_number', dayNumber)

  // Get net_max_over_par setting
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'net_max_over_par')
    .single()
  const netMaxOverPar = setting ? parseInt(setting.value) : 3

  // Build score lookup: playerId -> holeNumber -> grossScore
  const scoreMap = new Map<string, Map<number, number>>()
  for (const s of allScores) {
    if (!scoreMap.has(s.player_id)) scoreMap.set(s.player_id, new Map())
    scoreMap.get(s.player_id)!.set(s.hole_number, s.gross_score)
  }

  // Build PH lookup: playerId -> playing_handicap
  const phMap = new Map<string, number>()
  allGroupPlayers?.forEach(gp => { phMap.set(gp.player_id, gp.playing_handicap) })

  const results: RunningMatchScore[] = []

  for (const match of matches) {
    const matchPlayers = match.match_players || []
    const sideA = matchPlayers.filter((mp: { side: string }) => mp.side === 'a')
    const sideB = matchPlayers.filter((mp: { side: string }) => mp.side === 'b')
    if (sideA.length === 0 || sideB.length === 0) continue

    const allPlayerIds = matchPlayers.map((mp: { player_id: string }) => mp.player_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = match.groups as any
    const groupNumber = Array.isArray(groups) ? groups[0]?.group_number : groups?.group_number

    let teamARunning = 0
    let teamBRunning = 0
    let holesCompleted = 0

    for (const hole of holes) {
      // All players must have scores for this hole
      const allHaveScores = allPlayerIds.every((pid: string) =>
        scoreMap.get(pid)?.has(hole.hole_number)
      )
      if (!allHaveScores) continue
      holesCompleted++

      const getPhNet = (playerId: string): number => {
        const ph = phMap.get(playerId) ?? 0
        const gross = scoreMap.get(playerId)?.get(hole.hole_number)
        if (gross === undefined) return 99
        const strokes = calcStrokesOnHole(ph, hole.handicap_rank)
        return calcNetScore(gross, strokes, hole.par, netMaxOverPar)
      }

      if (match.format === 'best_ball_validation' || match.format === 'best_ball') {
        const useValidation = match.format === 'best_ball_validation'
        const aNets = sideA.map((p: { player_id: string }) => getPhNet(p.player_id))
        const bNets = sideB.map((p: { player_id: string }) => getPhNet(p.player_id))
        const bestA = Math.min(...aNets)
        const bestB = Math.min(...bNets)
        if (bestA < bestB) teamARunning += 1
        else if (bestB < bestA) teamBRunning += 1
        else if (useValidation) {
          const worstA = Math.max(...aNets)
          const worstB = Math.max(...bNets)
          if (worstA < worstB) teamARunning += 1
          else if (worstB < worstA) teamBRunning += 1
        }
      } else if (match.format === 'low_total') {
        const aNets = sideA.map((p: { player_id: string }) => getPhNet(p.player_id))
        const bNets = sideB.map((p: { player_id: string }) => getPhNet(p.player_id))
        const lowA = Math.min(...aNets)
        const lowB = Math.min(...bNets)
        const totalA = aNets.reduce((s: number, v: number) => s + v, 0)
        const totalB = bNets.reduce((s: number, v: number) => s + v, 0)
        if (lowA < lowB) teamARunning += 1
        else if (lowB < lowA) teamBRunning += 1
        if (totalA < totalB) teamARunning += 1
        else if (totalB < totalA) teamBRunning += 1
      } else if (match.format === 'singles_match') {
        const netA = getPhNet(sideA[0].player_id)
        const netB = getPhNet(sideB[0].player_id)
        if (netA < netB) teamARunning += 1
        else if (netB < netA) teamBRunning += 1
        else { teamARunning += 0.5; teamBRunning += 0.5 }
      }
      // singles_stroke: no hole-by-hole tally (determined at end)
    }

    // For singles_stroke with 18 holes complete: compute winner
    if (match.format === 'singles_stroke' && holesCompleted === 18) {
      let totalA = 0, totalB = 0
      for (const hole of holes) {
        const phA = phMap.get(sideA[0].player_id) ?? 0
        const phB = phMap.get(sideB[0].player_id) ?? 0
        const grossA = scoreMap.get(sideA[0].player_id)?.get(hole.hole_number)
        const grossB = scoreMap.get(sideB[0].player_id)?.get(hole.hole_number)
        if (grossA !== undefined) {
          totalA += calcNetScore(grossA, calcStrokesOnHole(phA, hole.handicap_rank), hole.par, netMaxOverPar)
        }
        if (grossB !== undefined) {
          totalB += calcNetScore(grossB, calcStrokesOnHole(phB, hole.handicap_rank), hole.par, netMaxOverPar)
        }
      }
      teamARunning = totalA
      teamBRunning = totalB
    }

    results.push({
      matchId: match.id,
      groupNumber: groupNumber ?? 0,
      format: match.format,
      teamALabel: match.team_a_label || 'USA',
      teamBLabel: match.team_b_label || 'Europe',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamAPlayers: sideA.map((p: any) => p.players?.name || '?'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamBPlayers: sideB.map((p: any) => p.players?.name || '?'),
      teamARunning,
      teamBRunning,
      holesCompleted,
    })
  }

  return results
}

// ─────────────────────────────────────────────────────────────
// Feature 5: End-of-Day Summary Card
// ─────────────────────────────────────────────────────────────

export interface DaySummary {
  dayNumber: number
  courseName: string
  hasData: boolean
  // Team match points for this day
  dayTeamAPoints: number
  dayTeamBPoints: number
  teamALabel: string
  teamBLabel: string
  // Cumulative across ALL completed days
  cumulativeTeamAPoints: number
  cumulativeTeamBPoints: number
  // Matches for this day
  matches: {
    id: string
    format: string
    teamAPlayers: string[]
    teamBPlayers: string[]
    teamAPoints: number
    teamBPoints: number
    pointValue: number
    isIsland: boolean
  }[]
  // Top 3 individual players (by total net relative to par, all completed days)
  top3: {
    rank: number
    name: string
    team: string | null
    totalNet: number
    totalPar: number
    relative: number
    holesPlayed: number
  }[]
  // Best individual round of the day
  bestRound: {
    name: string
    team: string | null
    totalNet: number
    totalPar: number
    relative: number
    holesPlayed: number
  } | null
  // Biggest mover of the day
  biggestMover: {
    name: string
    team: string | null
    dayNet: number
    dayPar: number
    dayRelative: number
    improvement: number   // how much better vs their overall average per hole
  } | null
}

export async function getSummaryData(dayNumber: number): Promise<DaySummary | null> {
  const supabase = createAdminClient()

  // Get all courses
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('day_number')
  if (!courses) return null

  const targetCourse = courses.find(c => c.day_number === dayNumber)
  if (!targetCourse) return null

  // Get all players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('display_order')
  if (!players) return null

  // Get settings
  const { data: settingsRows } = await supabase.from('settings').select('*')
  const settings: Record<string, string> = {}
  settingsRows?.forEach(s => { settings[s.key] = s.value })
  const teamALabel = settings['team_a_label'] || 'USA'
  const teamBLabel = settings['team_b_label'] || 'Europe'

  // Get all holes for ALL courses
  const { data: allHoles } = await supabase
    .from('holes')
    .select('*')
    .order('hole_number')

  // Get ALL scores across all courses
  const { data: allScores } = await supabase
    .from('scores')
    .select('player_id, hole_number, net_score, gross_score, course_id')
  if (!allScores) return null

  // Check if target day has any scores
  const dayScores = allScores.filter(s => s.course_id === targetCourse.id)
  const hasData = dayScores.length > 0

  // Get matches for this day
  const { data: dayMatches } = await supabase
    .from('matches')
    .select(`
      id, match_number, format, team_a_label, team_b_label,
      team_a_points, team_b_points, status, point_value,
      match_players(player_id, side, players(name, team)),
      groups!inner(day_number, group_number)
    `)
    .eq('groups.day_number', dayNumber)
    .order('match_number')

  // Get island match IDs for this day
  const { data: islandAssignments } = await supabase
    .from('island_player_assignments')
    .select('match_a_id, match_b_id')
    .eq('day_number', dayNumber)
  const islandMatchIds = new Set<string>()
  islandAssignments?.forEach(a => {
    if (a.match_a_id) islandMatchIds.add(a.match_a_id)
    if (a.match_b_id) islandMatchIds.add(a.match_b_id)
  })

  // Get ALL matches for cumulative totals
  const { data: allMatches } = await supabase
    .from('matches')
    .select('team_a_points, team_b_points, groups!inner(day_number)')
  const cumulativeTeamAPoints = allMatches?.reduce((sum, m) => sum + (m.team_a_points || 0), 0) ?? 0
  const cumulativeTeamBPoints = allMatches?.reduce((sum, m) => sum + (m.team_b_points || 0), 0) ?? 0

  // Build formatted matches list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedMatches = (dayMatches || []).map((m: any) => {
    const sideA = (m.match_players || []).filter((p: { side: string }) => p.side === 'a')
    const sideB = (m.match_players || []).filter((p: { side: string }) => p.side === 'b')
    return {
      id: m.id,
      format: m.format,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamAPlayers: sideA.map((p: any) => p.players?.name || '?'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamBPlayers: sideB.map((p: any) => p.players?.name || '?'),
      teamAPoints: m.team_a_points || 0,
      teamBPoints: m.team_b_points || 0,
      pointValue: m.point_value || 1,
      isIsland: islandMatchIds.has(m.id),
    }
  })

  // Day points from matches
  const dayTeamAPoints = formattedMatches.reduce((s, m) => s + m.teamAPoints, 0)
  const dayTeamBPoints = formattedMatches.reduce((s, m) => s + m.teamBPoints, 0)

  // ── Individual stats ──────────────────────────────────────────
  // Build per-player per-day net totals
  interface PlayerDayStats {
    net: number
    par: number
    holes: number
  }
  const playerDayStats = new Map<string, Map<number, PlayerDayStats>>()

  for (const player of players) {
    const byDay = new Map<number, PlayerDayStats>()
    for (const course of courses) {
      const courseHoles = allHoles?.filter(h => h.course_id === course.id) || []
      const pScores = allScores.filter(s => s.player_id === player.id && s.course_id === course.id)
      if (pScores.length === 0) continue
      const totalNet = pScores.reduce((s, sc) => s + (sc.net_score ?? sc.gross_score), 0)
      const totalPar = courseHoles
        .filter(h => pScores.some(s => s.hole_number === h.hole_number))
        .reduce((s, h) => s + h.par, 0)
      byDay.set(course.day_number, { net: totalNet, par: totalPar, holes: pScores.length })
    }
    playerDayStats.set(player.id, byDay)
  }

  // Top 3: ranked by total net relative to par across ALL days
  const allDayRankings = players.map(player => {
    const byDay = playerDayStats.get(player.id) || new Map()
    let totalNet = 0, totalPar = 0, totalHoles = 0
    byDay.forEach(stats => {
      totalNet += stats.net
      totalPar += stats.par
      totalHoles += stats.holes
    })
    return { player, totalNet, totalPar, totalHoles, relative: totalNet - totalPar }
  }).filter(e => e.totalHoles > 0).sort((a, b) => a.relative - b.relative)

  const top3 = allDayRankings.slice(0, 3).map((e, i) => ({
    rank: i + 1,
    name: e.player.name,
    team: e.player.team,
    totalNet: e.totalNet,
    totalPar: e.totalPar,
    relative: e.relative,
    holesPlayed: e.totalHoles,
  }))

  // Best individual round of the day: lowest net relative to par for target day only
  const dayRankings = players.map(player => {
    const stats = playerDayStats.get(player.id)?.get(dayNumber)
    if (!stats || stats.holes === 0) return null
    return {
      name: player.name,
      team: player.team,
      totalNet: stats.net,
      totalPar: stats.par,
      relative: stats.net - stats.par,
      holesPlayed: stats.holes,
    }
  }).filter(Boolean) as { name: string; team: string | null; totalNet: number; totalPar: number; relative: number; holesPlayed: number }[]

  dayRankings.sort((a, b) => a.relative - b.relative)
  const bestRound = dayRankings.length > 0 ? dayRankings[0] : null

  // Biggest mover of the day:
  // Compare player's average net-per-hole today vs their average net-per-hole across ALL other days.
  // Most improved = biggest negative delta (today was better than usual).
  let biggestMover: DaySummary['biggestMover'] = null
  const numDaysWithData = new Set(
    allScores.map(s => courses.find(c => c.id === s.course_id)?.day_number).filter(Boolean)
  ).size

  if (numDaysWithData <= 1) {
    // Only one day of data: biggest mover = best round player
    if (bestRound) {
      biggestMover = {
        name: bestRound.name,
        team: bestRound.team,
        dayNet: bestRound.totalNet,
        dayPar: bestRound.totalPar,
        dayRelative: bestRound.relative,
        improvement: 0,
      }
    }
  } else {
    let bestImprovement = Infinity
    for (const player of players) {
      const byDay = playerDayStats.get(player.id) || new Map()
      const todayStats = byDay.get(dayNumber)
      if (!todayStats || todayStats.holes === 0) continue

      // Average net-per-hole across all OTHER days
      let otherNet = 0, otherHoles = 0
      byDay.forEach((stats, d) => {
        if (d !== dayNumber) {
          otherNet += stats.net
          otherHoles += stats.holes
        }
      })
      if (otherHoles === 0) continue

      const todayAvgNetPerHole = (todayStats.net - todayStats.par) / todayStats.holes
      const otherAvgNetPerHole = (otherNet - (
        // compute other par total
        (() => {
          let p = 0
          byDay.forEach((stats, d) => { if (d !== dayNumber) p += stats.par })
          return p
        })()
      )) / otherHoles
      const improvement = todayAvgNetPerHole - otherAvgNetPerHole // negative = improved

      if (improvement < bestImprovement) {
        bestImprovement = improvement
        biggestMover = {
          name: player.name,
          team: player.team,
          dayNet: todayStats.net,
          dayPar: todayStats.par,
          dayRelative: todayStats.net - todayStats.par,
          improvement: bestImprovement,
        }
      }
    }
  }

  return {
    dayNumber,
    courseName: targetCourse.name,
    hasData,
    dayTeamAPoints,
    dayTeamBPoints,
    teamALabel,
    teamBLabel,
    cumulativeTeamAPoints,
    cumulativeTeamBPoints,
    matches: formattedMatches,
    top3,
    bestRound,
    biggestMover,
  }
}

// Returns which days have any score data
export async function getDaysWithData(): Promise<number[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('scores')
    .select('course_id, courses(day_number)')
  const days = new Set<number>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?.forEach((s: any) => {
    if (s.courses?.day_number) days.add(s.courses.day_number)
  })
  return Array.from(days).sort()
}

