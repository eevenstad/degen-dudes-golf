/**
 * Handicap calculations per USGA rules.
 * These match the formulas in Ben's Excel spreadsheet exactly.
 */

/**
 * Calculate Course Handicap (CH) from handicap index.
 * Full USGA formula: ROUND(index × (slope / 113) + (rating - par))
 * NOTE: The (rating - par) term is critical — do NOT use the simplified version.
 */
export function calcCourseHandicap(
  handicapIndex: number,
  slope: number,
  rating: number,
  par: number
): number {
  return Math.round(handicapIndex * (slope / 113) + (rating - par))
}

/**
 * Calculate Playing Handicap (PH) for match play.
 * PH = player's CH minus the lowest CH in the group.
 * The lowest handicap player gets PH = 0.
 */
export function calcPlayingHandicap(
  playerCH: number,
  minGroupCH: number
): number {
  return playerCH - minGroupCH
}

/**
 * Calculate how many strokes a player gets on a specific hole.
 * Based on their handicap (CH or PH) and the hole's difficulty rank (1-18).
 *
 * Stroke allocation logic:
 * - If handicap >= 36: gets 2 strokes on every hole, plus 1 extra on holes ranked ≤ (handicap - 36)
 * - If handicap >= 18: gets 1 stroke on every hole, plus 1 extra on holes ranked ≤ (handicap - 18)
 * - If handicap >= 1:  gets 1 stroke on holes ranked ≤ handicap, 0 on others
 * - If handicap = 0:   gets 0 strokes on all holes
 */
export function calcStrokesOnHole(
  handicap: number,
  holeHandicapRank: number
): number {
  if (handicap >= 36) {
    return holeHandicapRank <= (handicap - 36) ? 3 : 2
  } else if (handicap >= 18) {
    return holeHandicapRank <= (handicap - 18) ? 2 : 1
  } else {
    return holeHandicapRank <= handicap ? 1 : 0
  }
}

/**
 * Calculate net score for a hole (applies to both CH net and PH net).
 * net = gross - strokes, capped at par + strokes + netMaxOverPar
 */
export function calcNetScore(
  gross: number,
  strokes: number,
  par: number,
  netMaxOverPar: number
): number {
  const raw = gross - strokes
  const cap = par + strokes + netMaxOverPar
  return Math.min(raw, cap)
}

/**
 * Calculate all stroke counts for a player across 18 holes.
 * Returns array of 18 values (index 0 = hole 1).
 */
export function calcAllStrokes(
  handicap: number,
  holes: Array<{ hole_number: number; handicap_rank: number }>
): number[] {
  return holes
    .sort((a, b) => a.hole_number - b.hole_number)
    .map(hole => calcStrokesOnHole(handicap, hole.handicap_rank))
}
