/**
 * 34-match-formats.spec.ts
 * Phase 9: Match Format Verification
 *
 * Tests all 5 match formats using the scoring engine directly (no browser needed).
 * Uses controlled scores from TESTING-PLAN.md Section 4.
 *
 * Formats tested:
 *   9a: best_ball_validation — Section 4a (A:1 B:2, match points: A=0 B=1)
 *   9b: best_ball — Section 4b (A:1 B:2, match points: A=0 B=1)
 *   9c: low_total — Section 4c (A:2 B:4, match points: A=0 B=1)
 *   9d: singles_match (Eric vs Ben) — Section 4d (A:14.5 B:3.5, match points: A=1 B=0)
 *   9e: singles_match high HC (Chris vs Jauch) — Section 4e (A:5.5 B:12.5, match points: A=0 B=1)
 *   9f: singles_stroke (Eric vs Ben) — Section 4f (lower total PH-net wins)
 *
 * Playing Handicaps:
 *   4a/4b/4c: Ryan PH=3, Mack PH=1, Kiki PH=0, Bruce PH=5
 *   4d: Eric PH=0, Ben PH=6 (Eric CH=16 is min in group)
 *   4e: Chris PH=0, Jauch PH=7 (Chris CH=35 is min, Jauch CH=42, PH=42-35=7)
 *   4f: Same as 4d
 *
 * Note: PH-based net scores are used for match play.
 * calcNetScore(gross, PH_strokes_on_hole, par, netMaxOverPar)
 */

import { test, expect } from '@playwright/test'
import { calcMatchResult, type PlayerMatchData, type GroupFormat } from '@/lib/scoring/engine'
import { calcStrokesOnHole, calcNetScore } from '@/lib/scoring/handicap'

// ─── Terra Lago North — Day 1 hole data ───────────────────────────────────────
// Par/rank from TESTING-PLAN.md Section 2 header row
// H1:P4/R9, H2:P4/R15, H3:P3/R17, H4:P5/R7, H5:P4/R1, H6:P4/R11, H7:P3/R13, H8:P5/R5,
// H9:P4/R3, H10:P4/R10, H11:P4/R16, H12:P3/R18, H13:P5/R8, H14:P4/R2, H15:P4/R12,
// H16:P3/R14, H17:P5/R6, H18:P4/R4

const TERRA_LAGO_HOLES = [
  { hole_number:  1, par: 4, handicap_rank:  9 },
  { hole_number:  2, par: 4, handicap_rank: 15 },
  { hole_number:  3, par: 3, handicap_rank: 17 },
  { hole_number:  4, par: 5, handicap_rank:  7 },
  { hole_number:  5, par: 4, handicap_rank:  1 },
  { hole_number:  6, par: 4, handicap_rank: 11 },
  { hole_number:  7, par: 3, handicap_rank: 13 },
  { hole_number:  8, par: 5, handicap_rank:  5 },
  { hole_number:  9, par: 4, handicap_rank:  3 },
  { hole_number: 10, par: 4, handicap_rank: 10 },
  { hole_number: 11, par: 4, handicap_rank: 16 },
  { hole_number: 12, par: 3, handicap_rank: 18 },
  { hole_number: 13, par: 5, handicap_rank:  8 },
  { hole_number: 14, par: 4, handicap_rank:  2 },
  { hole_number: 15, par: 4, handicap_rank: 12 },
  { hole_number: 16, par: 3, handicap_rank: 14 },
  { hole_number: 17, par: 5, handicap_rank:  6 },
  { hole_number: 18, par: 4, handicap_rank:  4 },
]

// ─── Gross scores from TESTING-PLAN.md Section 4 ──────────────────────────────

// 4a/4b/4c: Ryan, Mack, Kiki, Bruce all shoot par+2 except:
// H5: Mack shoots par-1 (birdie) = 3, Ryan/Kiki/Bruce shoot par+1 = 5 (wait - re-read section)
// Actually from Section 4a: H5 Ryan G=5, Mack G=3, Kiki G=3, Bruce G=5
// Reading carefully: H8: Ryan G=6, Mack G=6, Kiki G=6, Bruce G=6 (Kiki gets 1s, Bruce gets 1s)
// and H18: Ryan G=5, Mack G=5, Kiki G=5, Bruce G=5

// From the tables in Section 4a: "G/PH-Net" format. Let me extract gross from each entry.
// Ryan PH=3: strokes where handicap_rank ≤ 3 = H9(R3), H14(R2), H5(R1) → 3 strokes total
// Mack PH=1: strokes where handicap_rank ≤ 1 = H5(R1) → 1 stroke total
// Kiki PH=0: 0 strokes
// Bruce PH=5: strokes where handicap_rank ≤ 5 = H5(R1),H14(R2),H9(R3),H8(R5) → wait that's 4, need ≤5
//   Actually H5(R1),H14(R2),H9(R3),H17? no... Ranks ≤ 5: R1=H5, R2=H14, R3=H9, R4=H18, R5=H8 → 5 strokes

// From Section 4a table rows (G/PH-Net format where Xs means x strokes from PH):
// H5: Ryan 5/4(1s), Mack 3/2(1s), Kiki 3/3(0s), Bruce 5/4(1s) → Ryan gross=5, Mack gross=3, etc.
// H8: Ryan 6/6(0s), Mack 6/6(0s), Kiki 6/6(0s), Bruce 6/5(1s)
// H18: Ryan 5/5(0s), Mack 5/5(0s), Kiki 5/5(0s), Bruce 5/4(1s)

// For simplicity, all players shoot par+2 except:
// H5: Ryan=5(par+1), Mack=3(par-1/birdie), Kiki=3(par-1), Bruce=5(par+1)
// Wait... par on H5 is 4. So Mack=3 is birdie, Kiki=3 is birdie.
// But from 4a: Result "A (2 vs 3)" — Team A best = 2 (Mack PH-net), Team B best = 3 (Kiki PH-net)
// Mack gross=3, PH=1, H5 rank=1 ≤ 1 → 1 stroke, net = 3-1 = 2 ✓
// Kiki gross=3, PH=0, 0 strokes, net = 3 ✓

// Most holes everyone shoots par+2 except the specific holes noted.
// Let's build the gross scores from the table data.

function buildGross4abc(): {
  ryan: number[], mack: number[], kiki: number[], bruce: number[]
} {
  // Default: everyone shoots par+2 on all holes
  const ryan = TERRA_LAGO_HOLES.map(h => h.par + 2)
  const mack = TERRA_LAGO_HOLES.map(h => h.par + 2)
  const kiki = TERRA_LAGO_HOLES.map(h => h.par + 2)
  const bruce = TERRA_LAGO_HOLES.map(h => h.par + 2)

  // H5 (index 4): Mack = 3 (birdie), Kiki = 3 (birdie), Ryan = 5 (bogey), Bruce = 5 (bogey)
  // par=4, so: birdie=3, bogey=5. Default already has par+2=6, need to override.
  ryan[4]  = 5  // par+1 (bogey)
  mack[4]  = 3  // par-1 (birdie)
  kiki[4]  = 3  // par-1 (birdie)
  bruce[4] = 5  // par+1 (bogey)

  // H2 (index 1): From table: Ryan 5/5(0s), Mack 4/4(0s), Kiki 4/4(0s), Bruce 5/5(0s)
  // par=4, so Ryan=5(bogey), Mack=4(par), Kiki=4(par), Bruce=5(bogey)
  ryan[1]  = 5
  mack[1]  = 4
  kiki[1]  = 4
  bruce[1] = 5

  // H13 (index 12): Ryan 4/4(0s), Mack 6/6(0s), Kiki 6/6(0s), Bruce 4/4(0s)
  // par=5, so Ryan=4(eagle), Mack=6(bogey default), Kiki=6(bogey default), Bruce=4(eagle)
  ryan[12]  = 4
  mack[12]  = 6  // same as par+2 default for par=5 (wait: par=5+2=7, not 6) 
  // Actually: par+2 for par 5 = 7, but H13 shows Mack 6/6 which is par+1
  // Let me re-read: H13: Ryan 4/4(0s), Mack 6/6(0s) — Mack shoots 6 on par 5 (bogey)
  // So: ryan=4(eagle), mack=6(bogey), kiki=6(bogey), bruce=4(eagle)
  mack[12]  = 6
  kiki[12]  = 6
  bruce[12] = 4

  return { ryan, mack, kiki, bruce }
}

// 4d: Eric vs Ben (singles match play)
// Eric PH=0, Ben PH=6
// From TESTING-PLAN.md Section 4d — extract gross values from G/PH-Net format:
// Eric PH=0 → 0 strokes everywhere → gross = net always
// Ben PH=6 → strokes on holes with rank ≤ 6: H5(R1), H14(R2), H9(R3), H18(R4), H17(R6)
// Wait, R6=H17, not H18. Ranks ≤6: H5(1), H14(2), H9(3), H18(4), H8(5), H17(6) → 6 strokes

// From 4d table row by row:
// H1: Eric 6/6(0s), Ben 6/6(0s) → Eric gross=6, Ben gross=6
// H2: Eric 5/5(0s), Ben 6/6(0s) → Eric=5, Ben=6
// H3: Eric 4/4(0s), Ben 5/5(0s) → Eric=4, Ben=5
// H4: Eric 6/6(0s), Ben 7/7(0s) → Eric=6, Ben=7
// H5: Eric 5/5(0s), Ben 6/5(1s) → Eric=5, Ben=6
// H6: Eric 5/5(0s), Ben 6/6(0s) → Eric=5, Ben=6
// H7: Eric 4/4(0s), Ben 5/5(0s) → Eric=4, Ben=5
// H8: Eric 6/6(0s), Ben 7/6(1s) → Eric=6, Ben=7
// H9: Eric 5/5(0s), Ben 6/5(1s) → Eric=5, Ben=6
// H10: Eric 5/5(0s), Ben 6/6(0s) → Eric=5, Ben=6
// H11: Eric 5/5(0s), Ben 6/6(0s) → Eric=5, Ben=6
// H12: Eric 4/4(0s), Ben 5/5(0s) → Eric=4, Ben=5
// H13: Eric 4/4(0s), Ben 7/7(0s) → Eric=4, Ben=7
// H14: Eric 5/5(0s), Ben 6/5(1s) → Eric=5, Ben=6
// H15: Eric 5/5(0s), Ben 6/6(0s) → Eric=5, Ben=6
// H16: Eric 4/4(0s), Ben 5/5(0s) → Eric=4, Ben=5
// H17: Eric 6/6(0s), Ben 7/6(1s) → Eric=6, Ben=7
// H18: Eric 5/5(0s), Ben 6/5(1s) → Eric=5, Ben=6

const ERIC_GROSS_4D = [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5]
const BEN_GROSS_4D  = [6,6,5,7,6,6,5,7,6,6,6,5,7,6,6,5,7,6]

// 4e: Chris vs Jauch (singles match, high HC)
// Chris PH=0, Jauch PH=7 (42-35=7)
// From Section 4e:
// H1: Chris 7/7(0s), Jauch 7/7(0s) → both 7
// H2: Chris 7/7(0s), Jauch 7/7(0s) → both 7
// H3: Chris 10/6(0s), Jauch 10/6(0s) → both 10 (net via CH strokes already in table, PH=0/7)
//   Wait: Chris PH=0, 0 PH-strokes → ph_net = gross. But table shows 10/6. Must be PH isn't 0.
//   Let me reconsider: the table shows G/PH-Net where PH-net = gross - PH_strokes_on_hole.
//   Chris PH=0 → 0 PH strokes everywhere → PH-net = gross. If 10/6, that means 4 strokes? PH=0 means 0...
//   Actually wait: "Playing Handicaps: Chris=0, Jauch=7" — CH-strokes-based PH-net might still cap.
//   H3: par=3, rank=17. Chris PH=0 → 0 strokes, PH-net = min(10-0, 3+0+3) = min(10,6) = 6 ← cap!
//   Jauch PH=7 → rank 17 ≤ 7? No → 0 strokes, PH-net = min(10, 6) = 6 ← also capped!
// So Chris and Jauch both score 10 on par 3s, both get capped at par+0+3=6.

// From 4e table:
// H1: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H2: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H3: Chris 10/6(0s), Jauch 10/6(0s) → Tie
// H4: Chris 8/8(0s), Jauch 8/7(1s) → B (8 vs 7)
// H5: Chris 7/7(0s), Jauch 7/6(1s) → B
// H6: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H7: Chris 6/6(0s), Jauch 6/6(0s) → Tie
// H8: Chris 8/8(0s), Jauch 8/7(1s) → B
// H9: Chris 7/7(0s), Jauch 7/6(1s) → B
// H10: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H11: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H12: Chris 10/6(0s), Jauch 10/6(0s) → Tie (both capped)
// H13: Chris 8/8(0s), Jauch 8/8(0s) → Tie (par 5, rank=8, Jauch PH=7, 8>7 → 0 strokes)
// H14: Chris 7/7(0s), Jauch 7/6(1s) → B
// H15: Chris 7/7(0s), Jauch 7/7(0s) → Tie
// H16: Chris 6/6(0s), Jauch 6/6(0s) → Tie
// H17: Chris 8/8(0s), Jauch 8/7(1s) → B
// H18: Chris 7/7(0s), Jauch 7/6(1s) → B

const CHRIS_GROSS_4E = [7,7,10,8,7,7,6,8,7,7,7,10,8,7,7,6,8,7]
const JAUCH_GROSS_4E = [7,7,10,8,7,7,6,8,7,7,7,10,8,7,7,6,8,7]

const NET_MAX_OVER_PAR = 3

// ─── Helper: build PlayerMatchData ────────────────────────────────────────────

function makePlayer(
  name: string,
  playingHandicap: number,
  grossScores: number[]
): PlayerMatchData {
  return {
    playerId: name.toLowerCase(),
    name,
    playingHandicap,
    scores: TERRA_LAGO_HOLES.map((h, i) => ({
      holeNumber: h.hole_number,
      par: h.par,
      handicapRank: h.handicap_rank,
      gross: grossScores[i],
    })),
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('34 · Match Format Verification (Section 4)', () => {

  // ── 9a: Best Ball + Validation ─────────────────────────────────────────────

  test('9a: best_ball_validation — Team A:1 Team B:2, match pts A=0 B=1', () => {
    const { ryan, mack, kiki, bruce } = buildGross4abc()

    const teamA = [makePlayer('Ryan', 3, ryan), makePlayer('Mack', 1, mack)]
    const teamB = [makePlayer('Kiki', 0, kiki), makePlayer('Bruce', 5, bruce)]

    const result = calcMatchResult(
      'best_ball_validation', teamA, teamB, 'Team A', 'Team B',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // Total hole points: A=1, B=2 (from Section 4a)
    expect(result.teamATotalPoints).toBe(1)
    expect(result.teamBTotalPoints).toBe(2)

    // Match points: B wins (2 > 1)
    expect(result.teamAMatchPoints).toBe(0)
    expect(result.teamBMatchPoints).toBe(1)
    expect(result.winner).toBe('B')
  })

  test('9a: best_ball_validation — correct hole-by-hole results', () => {
    const { ryan, mack, kiki, bruce } = buildGross4abc()
    const teamA = [makePlayer('Ryan', 3, ryan), makePlayer('Mack', 1, mack)]
    const teamB = [makePlayer('Kiki', 0, kiki), makePlayer('Bruce', 5, bruce)]

    const result = calcMatchResult(
      'best_ball_validation', teamA, teamB, 'Team A', 'Team B',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // H5: A wins (Mack PH-net=2 vs Kiki PH-net=3)
    const h5 = result.holeResults.find(h => h.holeNumber === 5)!
    expect(h5.teamAPoints).toBe(1)
    expect(h5.teamBPoints).toBe(0)

    // H8: B wins (Bruce PH-net=5 vs Ryan PH-net=6, Mack PH-net=6)
    const h8 = result.holeResults.find(h => h.holeNumber === 8)!
    expect(h8.teamAPoints).toBe(0)
    expect(h8.teamBPoints).toBe(1)

    // H18: B wins (Bruce PH-net=4 vs Ryan/Mack both 5)
    const h18 = result.holeResults.find(h => h.holeNumber === 18)!
    expect(h18.teamAPoints).toBe(0)
    expect(h18.teamBPoints).toBe(1)
  })

  // ── 9b: Best Ball (no validation) ─────────────────────────────────────────

  test('9b: best_ball — Team A:1 Team B:2, match pts A=0 B=1', () => {
    const { ryan, mack, kiki, bruce } = buildGross4abc()
    const teamA = [makePlayer('Ryan', 3, ryan), makePlayer('Mack', 1, mack)]
    const teamB = [makePlayer('Kiki', 0, kiki), makePlayer('Bruce', 5, bruce)]

    const result = calcMatchResult(
      'best_ball', teamA, teamB, 'Team A', 'Team B',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    expect(result.teamATotalPoints).toBe(1)
    expect(result.teamBTotalPoints).toBe(2)
    expect(result.teamAMatchPoints).toBe(0)
    expect(result.teamBMatchPoints).toBe(1)
    expect(result.winner).toBe('B')
  })

  // ── 9c: Low Ball + Total ───────────────────────────────────────────────────

  test('9c: low_total — Team A:2 Team B:4, match pts A=0 B=1', () => {
    const { ryan, mack, kiki, bruce } = buildGross4abc()
    const teamA = [makePlayer('Ryan', 3, ryan), makePlayer('Mack', 1, mack)]
    const teamB = [makePlayer('Kiki', 0, kiki), makePlayer('Bruce', 5, bruce)]

    const result = calcMatchResult(
      'low_total', teamA, teamB, 'Team A', 'Team B',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // Low ball + total = 2 points per hole. Total 36 points available.
    // From Section 4c: A=2, B=4 (out of 18 decided holes)
    expect(result.teamATotalPoints).toBe(2)
    expect(result.teamBTotalPoints).toBe(4)
    expect(result.teamAMatchPoints).toBe(0)
    expect(result.teamBMatchPoints).toBe(1)
    expect(result.winner).toBe('B')
  })

  test('9c: low_total — H5 gives both low and total to A', () => {
    const { ryan, mack, kiki, bruce } = buildGross4abc()
    const teamA = [makePlayer('Ryan', 3, ryan), makePlayer('Mack', 1, mack)]
    const teamB = [makePlayer('Kiki', 0, kiki), makePlayer('Bruce', 5, bruce)]

    const result = calcMatchResult(
      'low_total', teamA, teamB, 'Team A', 'Team B',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // H5: Ryan PH-net=4(1s), Mack PH-net=2(1s), Kiki PH-net=3(0s), Bruce PH-net=4(1s)
    // Low: A best=2 vs B best=3 → A wins low (1pt)
    // Total: A=2+4=6 vs B=3+4=7 → A wins total (1pt)
    const h5 = result.holeResults.find(h => h.holeNumber === 5)!
    expect(h5.teamAPoints).toBe(2)
    expect(h5.teamBPoints).toBe(0)
  })

  // ── 9d: Singles Match Play (Eric vs Ben) ──────────────────────────────────

  test('9d: singles_match Eric vs Ben — Team A:14.5 B:3.5, match pts A=1 B=0', () => {
    const teamA = [makePlayer('Eric', 0, ERIC_GROSS_4D)]
    const teamB = [makePlayer('Ben', 6, BEN_GROSS_4D)]

    const result = calcMatchResult(
      'singles_match', teamA, teamB, 'Team A (Eric)', 'Team B (Ben)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    expect(result.teamATotalPoints).toBe(14.5)
    expect(result.teamBTotalPoints).toBe(3.5)
    expect(result.teamAMatchPoints).toBe(1)
    expect(result.teamBMatchPoints).toBe(0)
    expect(result.winner).toBe('A')
  })

  test('9d: singles_match — verify hole-by-hole for Eric vs Ben', () => {
    const teamA = [makePlayer('Eric', 0, ERIC_GROSS_4D)]
    const teamB = [makePlayer('Ben', 6, BEN_GROSS_4D)]

    const result = calcMatchResult(
      'singles_match', teamA, teamB, 'Team A (Eric)', 'Team B (Ben)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // H1: Eric PH-net=6, Ben PH-net=6 (0 PH strokes for Ben since rank=9>6) → Tie (0.5 each)
    const h1 = result.holeResults.find(h => h.holeNumber === 1)!
    expect(h1.teamAPoints).toBe(0.5)
    expect(h1.teamBPoints).toBe(0.5)

    // H2: Eric PH-net=5, Ben PH-net=6 (rank=15>6 → 0 Ben strokes) → A wins
    const h2 = result.holeResults.find(h => h.holeNumber === 2)!
    expect(h2.teamAPoints).toBe(1)
    expect(h2.teamBPoints).toBe(0)

    // H5: Eric PH-net=5 (0 strokes), Ben PH-net=5 (rank=1≤6 → 1 stroke, 6-1=5) → Tie
    const h5 = result.holeResults.find(h => h.holeNumber === 5)!
    expect(h5.teamAPoints).toBe(0.5)
    expect(h5.teamBPoints).toBe(0.5)

    // H13: Eric PH-net=4 (0 strokes on par 5), Ben PH-net=7 (rank=8>6 → 0 strokes, 7-0=7) → A wins
    const h13 = result.holeResults.find(h => h.holeNumber === 13)!
    expect(h13.teamAPoints).toBe(1)
    expect(h13.teamBPoints).toBe(0)
  })

  // ── 9e: Singles Match Play — Chris vs Jauch (High HC) ────────────────────

  test('9e: singles_match Chris vs Jauch — Team A:5.5 B:12.5, match pts A=0 B=1', () => {
    const teamA = [makePlayer('Chris', 0, CHRIS_GROSS_4E)]
    const teamB = [makePlayer('Jauch', 7, JAUCH_GROSS_4E)]

    const result = calcMatchResult(
      'singles_match', teamA, teamB, 'Team A (Chris)', 'Team B (Jauch)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    expect(result.teamATotalPoints).toBe(5.5)
    expect(result.teamBTotalPoints).toBe(12.5)
    expect(result.teamAMatchPoints).toBe(0)
    expect(result.teamBMatchPoints).toBe(1)
    expect(result.winner).toBe('B')
  })

  test('9e: singles_match — Jauch gets strokes where rank ≤ 7', () => {
    const teamA = [makePlayer('Chris', 0, CHRIS_GROSS_4E)]
    const teamB = [makePlayer('Jauch', 7, JAUCH_GROSS_4E)]

    const result = calcMatchResult(
      'singles_match', teamA, teamB, 'Team A (Chris)', 'Team B (Jauch)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // Jauch PH=7 gets strokes on holes with rank ≤ 7: H5(R1), H14(R2), H9(R3), H18(R4), H8(R5), H17(R6), H4(R7)
    // H4 (par=5, rank=7): Chris gross=8, PH-net=8(0s). Jauch gross=8, PH-net=7(1s) → B wins
    const h4 = result.holeResults.find(h => h.holeNumber === 4)!
    expect(h4.teamBNet[0]).toBe(7) // Jauch PH-net on H4
    expect(h4.teamANet[0]).toBe(8) // Chris PH-net on H4
    expect(h4.teamBPoints).toBe(1)

    // H3 (par=3, rank=17): Both shoot 10. Chris PH-net=cap=min(10,3+0+3)=6. Jauch PH-net=min(10,3+0+3)=6 (rank=17>7)
    const h3 = result.holeResults.find(h => h.holeNumber === 3)!
    expect(h3.teamANet[0]).toBe(6) // capped
    expect(h3.teamBNet[0]).toBe(6) // capped (Jauch gets 0 strokes on rank 17, PH=7)
    expect(h3.teamAPoints).toBe(0.5)
    expect(h3.teamBPoints).toBe(0.5)
  })

  // ── 9f: Singles Stroke Play (Eric vs Ben) ────────────────────────────────

  test('9f: singles_stroke — lower total PH-net wins, only assigned on H18', () => {
    const teamA = [makePlayer('Eric', 0, ERIC_GROSS_4D)]
    const teamB = [makePlayer('Ben', 6, BEN_GROSS_4D)]

    const result = calcMatchResult(
      'singles_stroke', teamA, teamB, 'Team A (Eric)', 'Team B (Ben)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // In singles_stroke: no points awarded hole-by-hole (holes 1-17 have 0 each)
    // Points only appear on H18 after total comparison
    const h17 = result.holeResults.find(h => h.holeNumber === 17)!
    expect(h17.teamAPoints).toBe(0)
    expect(h17.teamBPoints).toBe(0)

    // H18 has the final determination
    const h18 = result.holeResults.find(h => h.holeNumber === 18)!
    // Eric total PH-net: Eric PH=0, so PH-net = gross on every hole.
    // From 4d table: Eric gross = [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5] = 89
    // Ben PH=6, strokes on rank≤6: H5(1), H14(2), H9(3), H18(4), H8(5), H17(6)
    // Ben gross = [6,6,5,7,6,6,5,7,6,6,6,5,7,6,6,5,7,6]
    // Ben PH-net by hole: 6,6,5,7,5,6,5,6,5,6,6,5,7,5,6,5,6,5
    // Ben total = sum above = 101... Eric total = 89. Eric wins.
    expect(h18.teamAPoints + h18.teamBPoints).toBeGreaterThan(0) // points assigned on H18
    expect(result.winner).toBe('A') // Eric lower total wins
    expect(result.teamAMatchPoints).toBe(1)
    expect(result.teamBMatchPoints).toBe(0)
  })

  test('9f: singles_stroke — no mid-round points on holes 1-17', () => {
    const teamA = [makePlayer('Eric', 0, ERIC_GROSS_4D)]
    const teamB = [makePlayer('Ben', 6, BEN_GROSS_4D)]

    const result = calcMatchResult(
      'singles_stroke', teamA, teamB, 'Team A (Eric)', 'Team B (Ben)',
      TERRA_LAGO_HOLES, NET_MAX_OVER_PAR
    )

    // All holes except H18 should have 0 points for both teams
    const holesBefore18 = result.holeResults.filter(h => h.holeNumber < 18)
    for (const hole of holesBefore18) {
      expect(hole.teamAPoints, `H${hole.holeNumber} should have 0 A points in stroke play`).toBe(0)
      expect(hole.teamBPoints, `H${hole.holeNumber} should have 0 B points in stroke play`).toBe(0)
    }
  })

})
