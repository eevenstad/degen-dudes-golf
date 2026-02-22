# Degen Dudes — Full Scoring Test Plan
## Created: 2026-02-21 (Session 7)
## Purpose: Ground truth for automated scoring verification

---

## Overview

This document provides:
1. Pre-calculated expected course handicaps for all 11 players on all 3 courses
2. Controlled test scores (simple inputs designed for easy math verification)
3. Expected net scores, match points, and leaderboard standings
4. Multi-user simulation plan for Playwright

The next session should use this as ground truth to build a Playwright test suite that:
- Wipes test data from Supabase (scores, groups, matches — NOT players/tees)
- Creates fresh groups and matches
- Enters controlled scores
- Scrapes what the app displays
- Compares against expected values in this file
- Flags any discrepancy as a bug

---

## USGA Scoring Formulas (From Ben's Spreadsheet)

### Course Handicap
```
CH = ROUND(Handicap_Index × (Slope / 113) + (Course_Rating - Par))
```

### Strokes Given per Hole
```
if CH >= 36: strokes = (CH - 36 >= hole_stroke_index) ? 3 : 2
elif CH >= 18: strokes = (CH - 18 >= hole_stroke_index) ? 2 : 1
else: strokes = (CH >= hole_stroke_index) ? 1 : 0
```

### Playing Handicap (match play)
```
PH = Player_CH - MIN(all CH values in the group)
```

### Net Score per Hole
```
net = gross - strokes_given_on_hole
```

### Net Score Cap
```
net_capped = MIN(net, par + strokes_given_on_hole + NET_MAX_OVER_PAR)
```
NET_MAX_OVER_PAR = 3 (configurable, Ben may change to 2)

---

## Pre-Calculated Course Handicaps

### Day 1: Terra Lago North (Par 72)

| Player | HI | Tee | Rating | Slope | CH Calculation | CH |
|--------|-----|-----|--------|-------|----------------|-----|
| Ryan | 8.9 | Black | 74.7 | 139 | ROUND(8.9×139/113 + (74.7-72)) | ROUND(10.95) = **11** |
| Kiki | 9.3 | Yellow | 71.9 | 132 | ROUND(9.3×132/113 + (71.9-72)) | ROUND(10.76) = **11** |
| Mack | 10.0 | Yellow | 71.9 | 132 | ROUND(10.0×132/113 + (71.9-72)) | ROUND(11.58) = **12** |
| Bruce | 10.6 | Black | 74.7 | 139 | ROUND(10.6×139/113 + (74.7-72)) | ROUND(13.04) = **13** |
| Matthew | 11.0 | Black | 74.7 | 139 | ROUND(11.0×139/113 + (74.7-72)) | ROUND(13.52) = **14** |
| C-Pat | 11.5 | Black | 74.7 | 139 | ROUND(11.5×139/113 + (74.7-72)) | ROUND(14.14) = **14** |
| Eric | 13.5 | Yellow | 71.9 | 132 | ROUND(13.5×132/113 + (71.9-72)) | ROUND(15.67) = **16** |
| Ben | 19.0 | Yellow | 71.9 | 132 | ROUND(19.0×132/113 + (71.9-72)) | ROUND(22.10) = **22** |
| Gary | 22.1 | Yellow | 71.9 | 132 | ROUND(22.1×132/113 + (71.9-72)) | ROUND(25.82) = **26** |
| Chris | 30.0 | Yellow | 71.9 | 132 | ROUND(30.0×132/113 + (71.9-72)) | ROUND(35.02) = **35** |
| Jauch | 36.0 | Yellow | 71.9 | 132 | ROUND(36.0×132/113 + (71.9-72)) | ROUND(42.02) = **42** |

### Day 2: PGA West Mountain (Par 72)

| Player | HI | Tee | Rating | Slope | CH Calculation | CH |
|--------|-----|-----|--------|-------|----------------|-----|
| Ryan | 8.9 | Black | 72.8 | 135 | ROUND(8.9×135/113 + (72.8-72)) | ROUND(11.44) = **11** |
| Kiki | 9.3 | Silver | 68.3 | 122 | ROUND(9.3×122/113 + (68.3-72)) | ROUND(6.33) = **6** |
| Mack | 10.0 | Black-White | 71.8 | 132 | ROUND(10.0×132/113 + (71.8-72)) | ROUND(11.48) = **11** |
| Bruce | 10.6 | Black-White | 71.8 | 132 | ROUND(10.6×132/113 + (71.8-72)) | ROUND(12.17) = **12** |
| Matthew | 11.0 | Black | 72.8 | 135 | ROUND(11.0×135/113 + (72.8-72)) | ROUND(13.94) = **14** |
| C-Pat | 11.5 | Silver | 68.3 | 122 | ROUND(11.5×122/113 + (68.3-72)) | ROUND(8.11) = **8** |
| Eric | 13.5 | White | 70.8 | 129 | ROUND(13.5×129/113 + (70.8-72)) | ROUND(15.40) = **15** |
| Ben | 19.0 | White | 70.8 | 129 | ROUND(19.0×129/113 + (70.8-72)) | ROUND(21.48) = **21** |
| Gary | 22.1 | Silver | 68.3 | 122 | ROUND(22.1×122/113 + (68.3-72)) | ROUND(19.16) = **19** |
| Chris | 30.0 | White | 70.8 | 129 | ROUND(30.0×129/113 + (70.8-72)) | ROUND(33.07) = **33** |
| Jauch | 36.0 | Silver | 68.3 | 122 | ROUND(36.0×122/113 + (68.3-72)) | ROUND(31.58) = **32** |

### Day 3: Eagle Falls (Par 72) — All on Hawk tee (70.0/127)

| Player | HI | CH Calculation | CH |
|--------|-----|----------------|-----|
| Ryan | 8.9 | ROUND(8.9×127/113 + (70.0-72)) | ROUND(7.99) = **8** |
| Kiki | 9.3 | ROUND(9.3×127/113 + (70.0-72)) | ROUND(8.45) = **8** |
| Mack | 10.0 | ROUND(10.0×127/113 + (70.0-72)) | ROUND(9.23) = **9** |
| Bruce | 10.6 | ROUND(10.6×127/113 + (70.0-72)) | ROUND(9.92) = **10** |
| Matthew | 11.0 | ROUND(11.0×127/113 + (70.0-72)) | ROUND(10.36) = **10** |
| C-Pat | 11.5 | ROUND(11.5×127/113 + (70.0-72)) | ROUND(10.93) = **11** |
| Eric | 13.5 | ROUND(13.5×127/113 + (70.0-72)) | ROUND(13.18) = **13** |
| Ben | 19.0 | ROUND(19.0×127/113 + (70.0-72)) | ROUND(19.36) = **19** |
| Gary | 22.1 | ROUND(22.1×127/113 + (70.0-72)) | ROUND(22.85) = **23** |
| Chris | 30.0 | ROUND(30.0×127/113 + (70.0-72)) | ROUND(31.68) = **32** |
| Jauch | 36.0 | ROUND(36.0×127/113 + (70.0-72)) | ROUND(38.42) = **38** |

---

## Controlled Test Scores (Use These for Playwright)

### Strategy
Use "everyone shoots par on every hole" as the base case. This makes net score verification trivial:
- A player with CH=16 on a par-4 stroke-index-1 hole gets 1 stroke → net = 4-1 = 3 (birdie net)
- A player with CH=11 on that same hole gets 1 stroke → net = 4-1 = 3

To make the test meaningful, use gross = par + 2 (bogey) for all players on all holes. This means:
- Players with strokes on a hole: net = (par+2) - 1 = par+1 (bogey net)
- Players without strokes: net = par+2 (double bogey net)

This creates clear differentiation between high and low handicap players.

### Day 1 Test Scenario — Group 1 (Ryan CH=11, Kiki CH=11, Mack CH=12, Bruce CH=13)

Terra Lago North hole stroke index order (standard — verify against app):
Holes ranked 1-18 by difficulty. For verification purposes, test Hole 1 only first.

**Gross scores for all 4 players on Hole 1 (par 4, stroke index 1):**
- Ryan: gross 6 (bogey+1), CH=11, stroke_index=1, 1<=11 → gets 1 stroke → net = 6-1 = **5**
- Kiki: gross 6, CH=11, gets 1 stroke → net = **5**
- Mack: gross 6, CH=12, gets 1 stroke → net = **5**
- Bruce: gross 6, CH=13, gets 1 stroke → net = **5**

Best Ball result: Tied at net 5 — no point awarded (per Best Ball + Validation rules)

**Gross scores for all 4 players on Hole 2 (par 4, stroke index varies):**
Use stroke index 9. CH=11 → 11>=9 → gets 1 stroke. CH=12 → 12>=9 → gets 1. CH=13 → 13>=9 → gets 1.
- Ryan: gross 5 → net 4
- Kiki: gross 6 → net 5
- Mack: gross 6 → net 5
- Bruce: gross 6 → net 5

---

## Supabase Data Reset Before Testing

The following tables should be cleared of TEST data before the next automated test run.
**DO NOT delete players or tees** — those are seeded reference data.

Tables to clear:
- `scores` — all rows
- `group_players` — all rows
- `groups` — all rows
- `match_players` — all rows
- `matches` — all rows

SQL to run via Supabase dashboard or API:
```sql
DELETE FROM scores;
DELETE FROM match_players;
DELETE FROM matches;
DELETE FROM group_players;
DELETE FROM groups;
-- Optionally reset team assignments:
UPDATE players SET team = NULL;
```

Service role key needed for API calls — at `~/.config/supabase/degen-dudes-service-role`.

---

## Multi-User Simulation Plan

### Goal
Simulate 3 scorekeepers entering scores simultaneously (one per group) to test realtime sync.

### Playwright Implementation
Open 3 browser contexts in parallel:
- Context 1: localStorage player = "Ryan" (Group 1 scorekeeper)
- Context 2: localStorage player = "Eric" (Group 2 scorekeeper)  
- Context 3: localStorage player = "Gary" (Group 3 scorekeeper)

Each context enters scores for their group simultaneously using `Promise.all()`.

After all scores entered, verify in a 4th context (leaderboard viewer) that:
- All players appear in the leaderboard
- Standings reflect the entered scores
- No scores are missing or doubled

### Realtime Sync Test
While Context 1 is entering hole-by-hole scores, have Context 4 (leaderboard) poll every 2 seconds and verify the leaderboard updates in real time (Supabase subscriptions).

---

## What the Next Session Should Build

### Phase 1: Data reset script
`~/code/degen-dudes/scripts/reset-test-data.js` — hits Supabase REST API to clear scores/groups/matches/match_players/group_players. Sets team assignments to test config (Ryan/Mack/Matthew/Eric/Gary/Jauch = USA; Kiki/Bruce/C-Pat/Ben/Chris = Europe).

### Phase 2: Full scoring Playwright suite
`~/code/degen-dudes/tests/scoring/` — new directory with:
- `setup.spec.ts` — reset data, create groups, create matches
- `day1-scores.spec.ts` — enter controlled scores for all 18 holes of Day 1
- `day2-scores.spec.ts` — Day 2 scores
- `day3-scores.spec.ts` — Day 3 scores (singles only)
- `verify-math.spec.ts` — scrape displayed net scores, compare to expected
- `verify-leaderboard.spec.ts` — verify leaderboard order and point totals
- `verify-realtime.spec.ts` — multi-context simultaneous entry + sync check

### Phase 3: Managed browser visual check
After Playwright confirms math is correct, use managed browser (profile=openclaw) to do a visual walkthrough of the full app and spot-check that the UI looks correct on a real browser.

---

## Known Hole Stroke Index Data

The app stores hole stroke index in the `holes` table in Supabase.
Before running math verification, the test suite should fetch the actual stroke indices:

```
GET https://lnnlabbdffowjpaxvnsp.supabase.co/rest/v1/holes?select=*&order=course_id,hole_number
```

This ensures tests use the actual seeded data, not assumed values.

---

## Files to Check at Start of Next Session
1. This file (`TESTING-PLAN.md`) — ground truth
2. `BUGS.md` — current bug status
3. `memory/handoffs/2026-02-21-session7-complete.md` — full session context
4. `tasks/degen-dudes/build-spec.md` — scoring rules source of truth
