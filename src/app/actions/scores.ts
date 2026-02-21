'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { calcStrokesOnHole, calcNetScore } from '@/lib/scoring'

export interface ScoreHistoryEntry {
  id: string
  score_id: string
  previous_gross: number
  new_gross: number
  changed_by: string | null
  changed_at: string
  scores?: {
    player_id: string
    hole_number: number
    course_id: string
    players?: { name: string }
    courses?: { name: string; day_number: number }
  }
}

export async function getScoreHistory(limit = 50): Promise<ScoreHistoryEntry[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('score_history')
    .select(`
      id, score_id, previous_gross, new_gross, changed_by, changed_at,
      scores(
        player_id, hole_number, course_id,
        players(name),
        courses(name, day_number)
      )
    `)
    .order('changed_at', { ascending: false })
    .limit(limit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as unknown) as ScoreHistoryEntry[]) || []
}

export async function undoLastScore(
  playerId: string,
  courseId: string,
  holeNumber: number
): Promise<{ success: boolean; error?: string; restored?: number }> {
  try {
    const supabase = createAdminClient()

    // 1. Find the current score
    const { data: currentScore } = await supabase
      .from('scores')
      .select('id, gross_score')
      .eq('player_id', playerId)
      .eq('course_id', courseId)
      .eq('hole_number', holeNumber)
      .single()

    if (!currentScore) {
      return { success: false, error: 'No score found to undo' }
    }

    // 2. Find the most recent history entry for this score
    const { data: history } = await supabase
      .from('score_history')
      .select('id, previous_gross, new_gross')
      .eq('score_id', currentScore.id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single()

    if (!history) {
      return { success: false, error: 'No history to undo' }
    }

    // 3. Get hole + handicap data to recalculate
    const { data: hole } = await supabase
      .from('holes')
      .select('par, handicap_rank')
      .eq('course_id', courseId)
      .eq('hole_number', holeNumber)
      .single()

    const { data: pta } = await supabase
      .from('player_tee_assignments')
      .select('course_handicap')
      .eq('player_id', playerId)
      .eq('course_id', courseId)
      .single()

    const { data: course } = await supabase
      .from('courses')
      .select('day_number')
      .eq('id', courseId)
      .single()

    const { data: groupPlayers } = await supabase
      .from('group_players')
      .select('playing_handicap, group_id, groups!inner(day_number)')
      .eq('player_id', playerId)
      .eq('groups.day_number', course?.day_number ?? 1)

    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'net_max_over_par')
      .single()
    const netMaxOverPar = setting ? parseInt(setting.value) : 3

    const restoredGross = history.previous_gross
    const ch = pta?.course_handicap ?? 0
    const ph = groupPlayers?.[0]?.playing_handicap ?? 0
    const chStrokes = hole ? calcStrokesOnHole(ch, hole.handicap_rank) : 0
    const phStrokes = hole ? calcStrokesOnHole(ph, hole.handicap_rank) : 0
    const netScore = hole ? calcNetScore(restoredGross, chStrokes, hole.par, netMaxOverPar) : restoredGross
    const phScore = hole ? calcNetScore(restoredGross, phStrokes, hole.par, netMaxOverPar) : restoredGross

    // 4. Log this undo in history
    await supabase.from('score_history').insert({
      score_id: currentScore.id,
      previous_gross: currentScore.gross_score,
      new_gross: restoredGross,
      changed_by: 'undo',
    })

    // 5. Restore the score
    const { error: updateError } = await supabase
      .from('scores')
      .update({
        gross_score: restoredGross,
        net_score: netScore,
        ph_score: phScore,
        ch_strokes: chStrokes,
        ph_strokes: phStrokes,
      })
      .eq('id', currentScore.id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 6. Recalculate match points if applicable
    const playerGroup = groupPlayers?.[0]
    if (playerGroup?.group_id) {
      await updateMatchPoints(supabase, playerGroup.group_id, courseId, netMaxOverPar)
    }

    return { success: true, restored: restoredGross }
  } catch (err) {
    console.error('undoLastScore error:', err)
    return { success: false, error: 'Failed to undo score' }
  }
}

interface SaveScoreInput {
  playerId: string
  courseId: string
  holeNumber: number
  grossScore: number
  enteredBy?: string
}

interface SaveScoreResult {
  success: boolean
  error?: string
  score?: {
    gross_score: number
    net_score: number
    ph_score: number
    ch_strokes: number
    ph_strokes: number
  }
}

export async function saveScore(input: SaveScoreInput): Promise<SaveScoreResult> {
  try {
    const supabase = createAdminClient()

    // 1. Get net_max_over_par setting
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'net_max_over_par')
      .single()
    const netMaxOverPar = setting ? parseInt(setting.value) : 3

    // 2. Get hole data (par, handicap_rank)
    const { data: hole, error: holeError } = await supabase
      .from('holes')
      .select('par, handicap_rank')
      .eq('course_id', input.courseId)
      .eq('hole_number', input.holeNumber)
      .single()

    if (holeError || !hole) {
      return { success: false, error: 'Hole not found' }
    }

    // 3. Get player's course handicap for this course
    const { data: pta, error: ptaError } = await supabase
      .from('player_tee_assignments')
      .select('course_handicap')
      .eq('player_id', input.playerId)
      .eq('course_id', input.courseId)
      .single()

    if (ptaError || !pta) {
      return { success: false, error: 'Player tee assignment not found' }
    }

    // 4. Get player's playing handicap for this course's group
    const { data: course } = await supabase
      .from('courses')
      .select('day_number')
      .eq('id', input.courseId)
      .single()

    if (!course) {
      return { success: false, error: 'Course not found' }
    }

    // Find the group this player is in for this day
    const { data: groupPlayers } = await supabase
      .from('group_players')
      .select('playing_handicap, group_id, groups!inner(day_number)')
      .eq('player_id', input.playerId)
      .eq('groups.day_number', course.day_number)

    const playerGroup = groupPlayers?.[0]
    const playingHandicap = playerGroup?.playing_handicap ?? 0

    // 5. Calculate strokes and net scores
    const chStrokes = calcStrokesOnHole(pta.course_handicap, hole.handicap_rank)
    const phStrokes = calcStrokesOnHole(playingHandicap, hole.handicap_rank)
    const netScore = calcNetScore(input.grossScore, chStrokes, hole.par, netMaxOverPar)
    const phScore = calcNetScore(input.grossScore, phStrokes, hole.par, netMaxOverPar)

    // 6. Check if score already exists (for audit trail)
    const { data: existing } = await supabase
      .from('scores')
      .select('id, gross_score')
      .eq('player_id', input.playerId)
      .eq('course_id', input.courseId)
      .eq('hole_number', input.holeNumber)
      .single()

    if (existing) {
      // Update existing score
      if (existing.gross_score !== input.grossScore) {
        // Log to score_history
        await supabase.from('score_history').insert({
          score_id: existing.id,
          previous_gross: existing.gross_score,
          new_gross: input.grossScore,
          changed_by: input.enteredBy || null,
        })
      }

      const { error: updateError } = await supabase
        .from('scores')
        .update({
          gross_score: input.grossScore,
          net_score: netScore,
          ph_score: phScore,
          ch_strokes: chStrokes,
          ph_strokes: phStrokes,
          entered_by: input.enteredBy || null,
        })
        .eq('id', existing.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    } else {
      // Insert new score
      const { error: insertError } = await supabase
        .from('scores')
        .insert({
          player_id: input.playerId,
          course_id: input.courseId,
          hole_number: input.holeNumber,
          gross_score: input.grossScore,
          net_score: netScore,
          ph_score: phScore,
          ch_strokes: chStrokes,
          ph_strokes: phStrokes,
          entered_by: input.enteredBy || null,
        })

      if (insertError) {
        return { success: false, error: insertError.message }
      }
    }

    // 7. Update match points if this player is in a match
    if (playerGroup?.group_id) {
      await updateMatchPoints(supabase, playerGroup.group_id, input.courseId, netMaxOverPar)
    }

    return {
      success: true,
      score: {
        gross_score: input.grossScore,
        net_score: netScore,
        ph_score: phScore,
        ch_strokes: chStrokes,
        ph_strokes: phStrokes,
      },
    }
  } catch (err) {
    console.error('saveScore error:', err)
    return { success: false, error: 'Failed to save score' }
  }
}

// Recalculate match points for a group after a score change
async function updateMatchPoints(
  supabase: ReturnType<typeof createAdminClient>,
  groupId: string,
  courseId: string,
  netMaxOverPar: number
) {
  try {
    // Get matches for this group
    const { data: matches } = await supabase
      .from('matches')
      .select(`
        id, format, match_number,
        match_players(player_id, side)
      `)
      .eq('group_id', groupId)

    if (!matches || matches.length === 0) return

    // Get all holes for the course
    const { data: holes } = await supabase
      .from('holes')
      .select('hole_number, par, handicap_rank')
      .eq('course_id', courseId)
      .order('hole_number')

    if (!holes) return

    for (const match of matches) {
      const matchPlayers = match.match_players || []
      const sideAPlayers = matchPlayers.filter((mp: { side: string }) => mp.side === 'a')
      const sideBPlayers = matchPlayers.filter((mp: { side: string }) => mp.side === 'b')

      if (sideAPlayers.length === 0 || sideBPlayers.length === 0) continue

      // Get scores for all players in this match
      const allPlayerIds = matchPlayers.map((mp: { player_id: string }) => mp.player_id)
      const { data: scores } = await supabase
        .from('scores')
        .select('player_id, hole_number, gross_score, ph_score')
        .eq('course_id', courseId)
        .in('player_id', allPlayerIds)

      if (!scores || scores.length === 0) continue

      // Get playing handicaps
      const { data: groupPlayerData } = await supabase
        .from('group_players')
        .select('player_id, playing_handicap')
        .eq('group_id', groupId)
        .in('player_id', allPlayerIds)

      if (!groupPlayerData) continue

      const phMap = new Map(groupPlayerData.map(gp => [gp.player_id, gp.playing_handicap]))
      const scoreMap = new Map<string, Map<number, number>>()

      for (const s of scores) {
        if (!scoreMap.has(s.player_id)) scoreMap.set(s.player_id, new Map())
        scoreMap.get(s.player_id)!.set(s.hole_number, s.ph_score ?? s.gross_score)
      }

      let teamAPoints = 0
      let teamBPoints = 0
      let holesCompleted = 0

      for (const hole of holes) {
        // Check if all players have scores for this hole
        const allHaveScores = allPlayerIds.every((pid: string) =>
          scoreMap.get(pid)?.has(hole.hole_number)
        )
        if (!allHaveScores) continue
        holesCompleted++

        const getPhNet = (playerId: string) => {
          const ph = phMap.get(playerId) ?? 0
          const gross = scores.find(
            s => s.player_id === playerId && s.hole_number === hole.hole_number
          )?.gross_score
          if (gross === undefined) return 99
          const strokes = calcStrokesOnHole(ph, hole.handicap_rank)
          return calcNetScore(gross, strokes, hole.par, netMaxOverPar)
        }

        if (match.format === 'best_ball_validation' || match.format === 'best_ball') {
          const useValidation = match.format === 'best_ball_validation'
          const aNets = sideAPlayers.map((p: { player_id: string }) => getPhNet(p.player_id))
          const bNets = sideBPlayers.map((p: { player_id: string }) => getPhNet(p.player_id))
          const bestA = Math.min(...aNets)
          const bestB = Math.min(...bNets)

          if (bestA < bestB) { teamAPoints += 1 }
          else if (bestB < bestA) { teamBPoints += 1 }
          else if (useValidation) {
            const worstA = Math.max(...aNets)
            const worstB = Math.max(...bNets)
            if (worstA < worstB) teamAPoints += 1
            else if (worstB < worstA) teamBPoints += 1
          }
        } else if (match.format === 'low_total') {
          const aNets = sideAPlayers.map((p: { player_id: string }) => getPhNet(p.player_id))
          const bNets = sideBPlayers.map((p: { player_id: string }) => getPhNet(p.player_id))
          const lowA = Math.min(...aNets)
          const lowB = Math.min(...bNets)
          const totalA = aNets.reduce((s: number, v: number) => s + v, 0)
          const totalB = bNets.reduce((s: number, v: number) => s + v, 0)
          if (lowA < lowB) teamAPoints += 1
          else if (lowB < lowA) teamBPoints += 1
          if (totalA < totalB) teamAPoints += 1
          else if (totalB < totalA) teamBPoints += 1
        } else if (match.format === 'singles_match') {
          const netA = getPhNet(sideAPlayers[0].player_id)
          const netB = getPhNet(sideBPlayers[0].player_id)
          if (netA < netB) teamAPoints += 1
          else if (netB < netA) teamBPoints += 1
          else { teamAPoints += 0.5; teamBPoints += 0.5 }
        }
        // singles_stroke is calculated at end (after all 18)
      }

      // For singles_stroke: only assign points after all 18 holes
      if (match.format === 'singles_stroke' && holesCompleted === 18) {
        let totalA = 0, totalB = 0
        for (const hole of holes) {
          totalA += scoreMap.get(sideAPlayers[0].player_id)?.get(hole.hole_number) ?? 0
          totalB += scoreMap.get(sideBPlayers[0].player_id)?.get(hole.hole_number) ?? 0
        }
        if (totalA < totalB) { teamAPoints = 1; teamBPoints = 0 }
        else if (totalB < totalA) { teamAPoints = 0; teamBPoints = 1 }
        else { teamAPoints = 0.5; teamBPoints = 0.5 }
      }

      // Update match status and points
      const status = holesCompleted === 0 ? 'not_started' : holesCompleted === 18 ? 'complete' : 'in_progress'
      await supabase
        .from('matches')
        .update({
          team_a_points: teamAPoints,
          team_b_points: teamBPoints,
          status,
        })
        .eq('id', match.id)
    }
  } catch (err) {
    console.error('updateMatchPoints error:', err)
  }
}
