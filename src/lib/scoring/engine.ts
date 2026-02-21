import { calcNetScore, calcStrokesOnHole } from './handicap'

export type GroupFormat =
  | 'best_ball_validation'
  | 'best_ball'
  | 'low_total'
  | 'singles_match'
  | 'singles_stroke'

export interface HoleScore {
  holeNumber: number
  par: number
  handicapRank: number
  gross: number
}

export interface PlayerMatchData {
  playerId: string
  name: string
  playingHandicap: number
  scores: HoleScore[]  // must be 18 holes, sorted by hole_number
}

export interface HoleResult {
  holeNumber: number
  par: number
  teamANet: number[]   // net scores for each player on team A
  teamBNet: number[]   // net scores for each player on team B
  teamAPoints: number  // points won by team A on this hole
  teamBPoints: number  // points won by team B on this hole
  detail: string       // human-readable explanation
}

export interface MatchResult {
  format: GroupFormat
  teamALabel: string
  teamBLabel: string
  teamAPlayers: string[]
  teamBPlayers: string[]
  holeResults: HoleResult[]
  teamATotalPoints: number
  teamBTotalPoints: number
  teamAMatchPoints: number  // 1, 0.5, or 0
  teamBMatchPoints: number  // 1, 0.5, or 0
  winner: 'A' | 'B' | 'tie'
}

/**
 * Calculate hole-by-hole results for a pairs match (best_ball_validation or best_ball).
 */
function calcBestBallHole(
  holeNumber: number,
  par: number,
  teamAScores: [number, number],
  teamBScores: [number, number],
  useValidation: boolean
): { teamAPoints: number; teamBPoints: number; detail: string } {
  const bestA = Math.min(...teamAScores)
  const bestB = Math.min(...teamBScores)

  if (bestA < bestB) {
    return { teamAPoints: 1, teamBPoints: 0, detail: `Best ball: ${bestA} vs ${bestB} → Team A wins` }
  }
  if (bestB < bestA) {
    return { teamAPoints: 0, teamBPoints: 1, detail: `Best ball: ${bestA} vs ${bestB} → Team B wins` }
  }

  // Tied best balls
  if (!useValidation) {
    return { teamAPoints: 0, teamBPoints: 0, detail: `Best ball: ${bestA} vs ${bestB} → Tie, no points` }
  }

  // Validation: compare the worse scores
  const worstA = Math.max(...teamAScores)
  const worstB = Math.max(...teamBScores)

  if (worstA < worstB) {
    return { teamAPoints: 1, teamBPoints: 0, detail: `Best ball tied ${bestA}-${bestB} → Validation: ${worstA} vs ${worstB} → Team A wins` }
  }
  if (worstB < worstA) {
    return { teamAPoints: 0, teamBPoints: 1, detail: `Best ball tied ${bestA}-${bestB} → Validation: ${worstA} vs ${worstB} → Team B wins` }
  }

  return { teamAPoints: 0, teamBPoints: 0, detail: `Best ball tied ${bestA}-${bestB} → Validation tied ${worstA}-${worstB} → No points` }
}

/**
 * Calculate hole-by-hole results for Low Ball + Total format.
 * 2 points available per hole: 1 for low ball, 1 for total.
 */
function calcLowTotalHole(
  teamAScores: [number, number],
  teamBScores: [number, number]
): { teamAPoints: number; teamBPoints: number; detail: string } {
  const lowA = Math.min(...teamAScores)
  const lowB = Math.min(...teamBScores)
  const totalA = teamAScores[0] + teamAScores[1]
  const totalB = teamBScores[0] + teamBScores[1]

  let teamAPoints = 0
  let teamBPoints = 0
  const parts: string[] = []

  // Low ball point
  if (lowA < lowB) { teamAPoints += 1; parts.push(`Low: ${lowA} vs ${lowB} → A`) }
  else if (lowB < lowA) { teamBPoints += 1; parts.push(`Low: ${lowA} vs ${lowB} → B`) }
  else { parts.push(`Low: ${lowA} vs ${lowB} → Tie`) }

  // Total point
  if (totalA < totalB) { teamAPoints += 1; parts.push(`Total: ${totalA} vs ${totalB} → A`) }
  else if (totalB < totalA) { teamBPoints += 1; parts.push(`Total: ${totalA} vs ${totalB} → B`) }
  else { parts.push(`Total: ${totalA} vs ${totalB} → Tie`) }

  return { teamAPoints, teamBPoints, detail: parts.join(' | ') }
}

/**
 * Calculate hole-by-hole results for singles match play.
 */
function calcSinglesMatchHole(
  netA: number,
  netB: number
): { teamAPoints: number; teamBPoints: number; detail: string } {
  if (netA < netB) return { teamAPoints: 1, teamBPoints: 0, detail: `${netA} vs ${netB} → A wins` }
  if (netB < netA) return { teamAPoints: 0, teamBPoints: 1, detail: `${netA} vs ${netB} → B wins` }
  return { teamAPoints: 0.5, teamBPoints: 0.5, detail: `${netA} vs ${netB} → Tie` }
}

/**
 * Calculate a full match result.
 *
 * For pairs formats: teamA = [player0, player1], teamB = [player2, player3]
 * For singles formats: teamA = [player0], teamB = [player1]
 */
export function calcMatchResult(
  format: GroupFormat,
  teamAPlayers: PlayerMatchData[],
  teamBPlayers: PlayerMatchData[],
  teamALabel: string,
  teamBLabel: string,
  holes: Array<{ hole_number: number; par: number; handicap_rank: number }>,
  netMaxOverPar: number
): MatchResult {
  const holeResults: HoleResult[] = []

  for (const hole of holes.sort((a, b) => a.hole_number - b.hole_number)) {
    // Calculate PH net scores for each player on this hole
    const getNet = (player: PlayerMatchData): number => {
      const score = player.scores.find(s => s.holeNumber === hole.hole_number)
      if (!score) throw new Error(`Missing score for player ${player.name} hole ${hole.hole_number}`)
      const strokes = calcStrokesOnHole(player.playingHandicap, hole.handicap_rank)
      return calcNetScore(score.gross, strokes, hole.par, netMaxOverPar)
    }

    const teamANets = teamAPlayers.map(getNet)
    const teamBNets = teamBPlayers.map(getNet)

    let points: { teamAPoints: number; teamBPoints: number; detail: string }

    if (format === 'best_ball_validation') {
      points = calcBestBallHole(
        hole.hole_number, hole.par,
        [teamANets[0], teamANets[1]],
        [teamBNets[0], teamBNets[1]],
        true
      )
    } else if (format === 'best_ball') {
      points = calcBestBallHole(
        hole.hole_number, hole.par,
        [teamANets[0], teamANets[1]],
        [teamBNets[0], teamBNets[1]],
        false
      )
    } else if (format === 'low_total') {
      points = calcLowTotalHole(
        [teamANets[0], teamANets[1]],
        [teamBNets[0], teamBNets[1]]
      )
    } else if (format === 'singles_match') {
      points = calcSinglesMatchHole(teamANets[0], teamBNets[0])
    } else {
      // singles_stroke — accumulate, determine winner at end
      points = { teamAPoints: 0, teamBPoints: 0, detail: `Stroke: ${teamANets[0]} vs ${teamBNets[0]}` }
    }

    holeResults.push({
      holeNumber: hole.hole_number,
      par: hole.par,
      teamANet: teamANets,
      teamBNet: teamBNets,
      teamAPoints: points.teamAPoints,
      teamBPoints: points.teamBPoints,
      detail: points.detail
    })
  }

  // For singles_stroke: winner is whoever has lower total net
  if (format === 'singles_stroke') {
    const totalA = holeResults.reduce((sum, h) => sum + h.teamANet[0], 0)
    const totalB = holeResults.reduce((sum, h) => sum + h.teamBNet[0], 0)
    holeResults.forEach(h => { h.detail = `Stroke play: running totals` })
    const lastHole = holeResults[holeResults.length - 1]
    if (totalA < totalB) {
      lastHole.teamAPoints = 1; lastHole.teamBPoints = 0
      lastHole.detail = `Stroke play total: ${totalA} vs ${totalB} → A wins`
    } else if (totalB < totalA) {
      lastHole.teamAPoints = 0; lastHole.teamBPoints = 1
      lastHole.detail = `Stroke play total: ${totalA} vs ${totalB} → B wins`
    } else {
      lastHole.teamAPoints = 0.5; lastHole.teamBPoints = 0.5
      lastHole.detail = `Stroke play total: ${totalA} vs ${totalB} → Tie`
    }
  }

  const teamATotalPoints = holeResults.reduce((sum, h) => sum + h.teamAPoints, 0)
  const teamBTotalPoints = holeResults.reduce((sum, h) => sum + h.teamBPoints, 0)

  let teamAMatchPoints: number, teamBMatchPoints: number, winner: 'A' | 'B' | 'tie'
  if (teamATotalPoints > teamBTotalPoints) {
    teamAMatchPoints = 1; teamBMatchPoints = 0; winner = 'A'
  } else if (teamBTotalPoints > teamATotalPoints) {
    teamAMatchPoints = 0; teamBMatchPoints = 1; winner = 'B'
  } else {
    teamAMatchPoints = 0.5; teamBMatchPoints = 0.5; winner = 'tie'
  }

  return {
    format,
    teamALabel,
    teamBLabel,
    teamAPlayers: teamAPlayers.map(p => p.name),
    teamBPlayers: teamBPlayers.map(p => p.name),
    holeResults,
    teamATotalPoints,
    teamBTotalPoints,
    teamAMatchPoints,
    teamBMatchPoints,
    winner
  }
}

/**
 * Calculate individual leaderboard entry for one player across all rounds.
 */
export interface LeaderboardEntry {
  playerId: string
  name: string
  team: string | null
  totalGross: number
  totalNet: number    // CH-based net
  rounds: Array<{
    dayNumber: number
    gross: number
    net: number
    thru: number   // holes completed
  }>
}
