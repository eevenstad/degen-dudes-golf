/**
 * Verification script: tests the scoring engine against last year's
 * real match data from Ben's spreadsheet.
 *
 * Run with: npx ts-node --project tsconfig.json scripts/verify-scoring.ts
 */

import { calcCourseHandicap, calcPlayingHandicap, calcStrokesOnHole, calcAllStrokes } from '../src/lib/scoring/handicap'
import { calcMatchResult, PlayerMatchData, HoleScore } from '../src/lib/scoring/engine'

// ── Test infrastructure ──────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✅ PASS: ${label}`)
  } else {
    failed++
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`)
  }
}

// ── Hole data: Terra Lago North ──────────────────────────────────────

const holes = [
  { hole_number: 1,  par: 4, handicap_rank: 9 },
  { hole_number: 2,  par: 4, handicap_rank: 15 },
  { hole_number: 3,  par: 3, handicap_rank: 17 },
  { hole_number: 4,  par: 5, handicap_rank: 7 },
  { hole_number: 5,  par: 4, handicap_rank: 1 },
  { hole_number: 6,  par: 4, handicap_rank: 11 },
  { hole_number: 7,  par: 3, handicap_rank: 13 },
  { hole_number: 8,  par: 5, handicap_rank: 5 },
  { hole_number: 9,  par: 4, handicap_rank: 3 },
  { hole_number: 10, par: 4, handicap_rank: 10 },
  { hole_number: 11, par: 4, handicap_rank: 16 },
  { hole_number: 12, par: 3, handicap_rank: 18 },
  { hole_number: 13, par: 5, handicap_rank: 8 },
  { hole_number: 14, par: 4, handicap_rank: 2 },
  { hole_number: 15, par: 4, handicap_rank: 12 },
  { hole_number: 16, par: 3, handicap_rank: 14 },
  { hole_number: 17, par: 5, handicap_rank: 6 },
  { hole_number: 18, par: 4, handicap_rank: 4 },
]

// ══════════════════════════════════════════════════════════════════════
// TEST 1: Course Handicap calculations
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 1: Course Handicap Calculations ═══')

// Mack on Terra Lago Yellow (71.9/132), HC index 10.0
assert(calcCourseHandicap(10.0, 132, 71.9, 72) === 12,
  'Mack CH = 12',
  `got ${calcCourseHandicap(10.0, 132, 71.9, 72)}`)

// Kiki on Terra Lago Yellow (71.9/132), HC index 9.3
assert(calcCourseHandicap(9.3, 132, 71.9, 72) === 11,
  'Kiki CH = 11',
  `got ${calcCourseHandicap(9.3, 132, 71.9, 72)}`)

// Bruce on Terra Lago Black (74.7/139), HC index 10.6
assert(calcCourseHandicap(10.6, 139, 74.7, 72) === 16,
  'Bruce CH = 16',
  `got ${calcCourseHandicap(10.6, 139, 74.7, 72)}`)

// Eric on Terra Lago Yellow (71.9/132), HC index 13.5
assert(calcCourseHandicap(13.5, 132, 71.9, 72) === 16,
  'Eric CH = 16',
  `got ${calcCourseHandicap(13.5, 132, 71.9, 72)}`)

// ══════════════════════════════════════════════════════════════════════
// TEST 2: Playing Handicap calculations
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 2: Playing Handicap Calculations ═══')

const minCH = 11 // Kiki has the lowest CH

assert(calcPlayingHandicap(12, minCH) === 1,  'Mack PH = 1',  `got ${calcPlayingHandicap(12, minCH)}`)
assert(calcPlayingHandicap(11, minCH) === 0,  'Kiki PH = 0',  `got ${calcPlayingHandicap(11, minCH)}`)
assert(calcPlayingHandicap(16, minCH) === 5,  'Bruce PH = 5', `got ${calcPlayingHandicap(16, minCH)}`)
assert(calcPlayingHandicap(16, minCH) === 5,  'Eric PH = 5',  `got ${calcPlayingHandicap(16, minCH)}`)

// ══════════════════════════════════════════════════════════════════════
// TEST 3: Stroke distribution
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 3: Stroke Distribution ═══')

// Mack PH=1: 1 stroke only on hole with hdcp_rank=1 → hole 5
const mackStrokes = calcAllStrokes(1, holes)
const mackExpected = [0,0,0,0,1,0,0,0,0, 0,0,0,0,0,0,0,0,0]
assert(JSON.stringify(mackStrokes) === JSON.stringify(mackExpected),
  'Mack (PH=1): 1 stroke on hole 5 only',
  `got [${mackStrokes}]`)

// Kiki PH=0: 0 strokes on all holes
const kikiStrokes = calcAllStrokes(0, holes)
const kikiExpected = [0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0]
assert(JSON.stringify(kikiStrokes) === JSON.stringify(kikiExpected),
  'Kiki (PH=0): 0 strokes on all holes',
  `got [${kikiStrokes}]`)

// Bruce PH=5: 1 stroke on holes with hdcp_rank 1-5
// Rank 1=H5, Rank 2=H14, Rank 3=H9, Rank 4=H18, Rank 5=H8
const bruceStrokes = calcAllStrokes(5, holes)
const bruceExpected = [0,0,0,0,1,0,0,1,1, 0,0,0,0,1,0,0,0,1]
assert(JSON.stringify(bruceStrokes) === JSON.stringify(bruceExpected),
  'Bruce (PH=5): strokes on holes 5,8,9,14,18',
  `got [${bruceStrokes}]`)

// Eric PH=5: same as Bruce
const ericStrokes = calcAllStrokes(5, holes)
assert(JSON.stringify(ericStrokes) === JSON.stringify(bruceExpected),
  'Eric (PH=5): same stroke pattern as Bruce',
  `got [${ericStrokes}]`)

// ══════════════════════════════════════════════════════════════════════
// TEST 4: Full match scoring — Match 1, Day 1 (Best Ball + Validation)
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 4: Match 1 — Best Ball + Validation ═══')

// PH net scores from spreadsheet (these are the NET scores used in match play)
// Note: Mack H7 corrected to net=5 based on spreadsheet "6gross-2strokes?" note.
// With PH=1 and rank 13 on H7, Mack gets 0 strokes, so gross=5 → net=5.
const mackPHNet  = [5,3,5,5,5,4,5,4,4, 4,4,5,5,4,4,4,4,4]
const kikiPHNet  = [4,4,4,4,4,4,4,5,5, 4,4,4,4,4,4,4,4,5]
const brucePHNet = [4,4,4,5,4,5,4,5,4, 4,5,4,4,4,5,4,5,4]
const ericPHNet  = [4,4,5,5,5,4,4,4,5, 4,4,5,5,5,5,5,4,4]

// Back-calculate gross scores from PH net + strokes
// gross = net + strokes (assuming no cap was hit; verified below)
function backCalcGross(phNets: number[], strokesArr: number[]): number[] {
  return phNets.map((net, i) => net + strokesArr[i])
}

const mackGross  = backCalcGross(mackPHNet, mackStrokes)
const kikiGross  = backCalcGross(kikiPHNet, kikiStrokes)
const bruceGross = backCalcGross(brucePHNet, bruceStrokes)
const ericGross  = backCalcGross(ericPHNet, ericStrokes)

// Verify no net cap was triggered (net should equal gross - strokes for all)
const netMaxOverPar = 3
let capTriggered = false
for (let i = 0; i < 18; i++) {
  const par = holes[i].par
  const rank = holes[i].handicap_rank
  for (const { name, gross, ph } of [
    { name: 'Mack', gross: mackGross, ph: 1 },
    { name: 'Kiki', gross: kikiGross, ph: 0 },
    { name: 'Bruce', gross: bruceGross, ph: 5 },
    { name: 'Eric', gross: ericGross, ph: 5 },
  ]) {
    const strokes = calcStrokesOnHole(ph, rank)
    const cap = par + strokes + netMaxOverPar
    if (gross[i] - strokes > cap) {
      console.log(`  ⚠️  Net cap triggered: ${name} hole ${i+1} gross=${gross[i]} strokes=${strokes} raw_net=${gross[i]-strokes} cap=${cap}`)
      capTriggered = true
    }
  }
}
if (!capTriggered) {
  console.log('  ℹ️  No net caps triggered in test data (all scores within par + strokes + 3)')
}

// Build PlayerMatchData
function makePlayer(
  name: string, ph: number, grossArr: number[]
): PlayerMatchData {
  return {
    playerId: name.toLowerCase(),
    name,
    playingHandicap: ph,
    scores: grossArr.map((g, i): HoleScore => ({
      holeNumber: holes[i].hole_number,
      par: holes[i].par,
      handicapRank: holes[i].handicap_rank,
      gross: g,
    })),
  }
}

const mack  = makePlayer('Mack', 1, mackGross)
const kiki  = makePlayer('Kiki', 0, kikiGross)
const bruce = makePlayer('Bruce', 5, bruceGross)
const eric  = makePlayer('Eric', 5, ericGross)

// Run the match
const result = calcMatchResult(
  'best_ball_validation',
  [mack, kiki],     // Team A
  [bruce, eric],    // Team B
  'Mack/Kiki',
  'Bruce/Eric',
  holes,
  netMaxOverPar
)

// Expected hole-by-hole points from spreadsheet
const expectedTeamA = [0,1,0,1,0,1,0,0,0, 0,1,0,0,1,1,1,1,0]
const expectedTeamB = [1,0,0,0,0,0,1,0,0, 0,0,0,0,0,0,0,0,1]

// Check each hole
let holePointsMatch = true
for (let i = 0; i < 18; i++) {
  const hr = result.holeResults[i]
  const aMatch = hr.teamAPoints === expectedTeamA[i]
  const bMatch = hr.teamBPoints === expectedTeamB[i]
  if (!aMatch || !bMatch) {
    holePointsMatch = false
    console.log(`  ❌ FAIL: Hole ${i+1} — got A=${hr.teamAPoints} B=${hr.teamBPoints}, expected A=${expectedTeamA[i]} B=${expectedTeamB[i]}`)
    console.log(`         Detail: ${hr.detail}`)
    console.log(`         Nets: A=[${hr.teamANet}] B=[${hr.teamBNet}]`)
  }
}
assert(holePointsMatch, 'All 18 hole-by-hole points match spreadsheet')

// Check totals
assert(result.teamATotalPoints === 8,
  'Team A total points = 8',
  `got ${result.teamATotalPoints}`)

assert(result.teamBTotalPoints === 3,
  'Team B total points = 3',
  `got ${result.teamBTotalPoints}`)

// Check match result
assert(result.teamAMatchPoints === 1,
  'Team A gets 1 match point (winner)',
  `got ${result.teamAMatchPoints}`)

assert(result.teamBMatchPoints === 0,
  'Team B gets 0 match points',
  `got ${result.teamBMatchPoints}`)

assert(result.winner === 'A',
  'Winner is Team A',
  `got ${result.winner}`)

// ══════════════════════════════════════════════════════════════════════
// TEST 5: Verify net scores passed through engine match expected PH nets
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 5: Engine Net Score Verification ═══')

let netsMatch = true
for (let i = 0; i < 18; i++) {
  const hr = result.holeResults[i]
  // teamANet = [Mack net, Kiki net], teamBNet = [Bruce net, Eric net]
  if (hr.teamANet[0] !== mackPHNet[i]) { netsMatch = false; console.log(`  ❌ Mack H${i+1}: engine=${hr.teamANet[0]} expected=${mackPHNet[i]}`) }
  if (hr.teamANet[1] !== kikiPHNet[i]) { netsMatch = false; console.log(`  ❌ Kiki H${i+1}: engine=${hr.teamANet[1]} expected=${kikiPHNet[i]}`) }
  if (hr.teamBNet[0] !== brucePHNet[i]) { netsMatch = false; console.log(`  ❌ Bruce H${i+1}: engine=${hr.teamBNet[0]} expected=${brucePHNet[i]}`) }
  if (hr.teamBNet[1] !== ericPHNet[i]) { netsMatch = false; console.log(`  ❌ Eric H${i+1}: engine=${hr.teamBNet[1]} expected=${ericPHNet[i]}`) }
}
assert(netsMatch, 'All 72 net scores (4 players × 18 holes) match spreadsheet')

// ══════════════════════════════════════════════════════════════════════
// TEST 6: Edge cases — net score cap
// ══════════════════════════════════════════════════════════════════════

console.log('\n═══ Test 6: Net Score Cap ═══')

// Scenario: par 4, 1 stroke, gross 10 → raw net = 9, cap = 4+1+3 = 8
import { calcNetScore } from '../src/lib/scoring/handicap'

assert(calcNetScore(10, 1, 4, 3) === 8,
  'Net score cap: gross=10 strokes=1 par=4 cap=8',
  `got ${calcNetScore(10, 1, 4, 3)}`)

// No cap needed: par 4, 0 strokes, gross 5 → raw net = 5, cap = 7
assert(calcNetScore(5, 0, 4, 3) === 5,
  'No cap needed: gross=5 strokes=0 par=4 → net=5',
  `got ${calcNetScore(5, 0, 4, 3)}`)

// Exactly at cap: par 3, 2 strokes, gross 10 → raw net = 8, cap = 3+2+3 = 8
assert(calcNetScore(10, 2, 3, 3) === 8,
  'At cap boundary: gross=10 strokes=2 par=3 → net=8',
  `got ${calcNetScore(10, 2, 3, 3)}`)

// Birdie: par 4, 1 stroke, gross 4 → raw net = 3, cap = 8
assert(calcNetScore(4, 1, 4, 3) === 3,
  'Birdie: gross=4 strokes=1 par=4 → net=3',
  `got ${calcNetScore(4, 1, 4, 3)}`)

// ══════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════')
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log('══════════════════════════════════════\n')

process.exit(failed > 0 ? 1 : 0)
