# Degen Dudes Golf App — Scoring Test Suite Specification

**Created:** 2026-02-22 by Opus 4.6
**Status:** COMPLETE ✅ — 194/194 tests passing, all 18 phases done (2026-02-22)
**Owner:** Eric (only Eric can modify deliverables or acceptance criteria)
**Deadline:** Feb 26, 2026 (golf trip departure)
**Original plan:** TESTING-PLAN.md (693 lines, created by Opus 4.6 in Session 9)

## Goal

Verify that every scoring calculation in the Degen Dudes Golf App is mathematically correct across all 3 days, all 4 test scenarios, and all 5 match formats, so Eric can trust the app on the course during the Feb 26 - Mar 2 golf trip.

## Ground Truth

All expected values are in `TESTING-PLAN.md`. That file has:
- Section 1: All 33 CH values (11 players × 3 days) with full USGA formula
- Section 2: All 594 stroke distribution values (11 players × 18 holes × 3 days)
- Section 3: Four test scenarios (A/B/C/D) with pre-calculated net scores for all 3 days
- Section 4: All 5 match formats verified hole-by-hole with expected results
- Section 5: NET_MAX_OVER_PAR comparison (2 vs 3)
- Section 6: Expected leaderboard after Scenario A (all 3 days)
- Section 7: Test data management (reset SQL, groups, team assignments)
- Section 8: Implementation guide
- Section 9: Quick reference (player IDs, course IDs, formulas)

## Technical Context

- **App:** https://www.thedegendudes.com (Vercel: https://degen-dudes-golf.vercel.app)
- **Repo:** ~/code/degen-dudes/ (https://github.com/eevenstad/degen-dudes-golf)
- **Scoring engine:** `src/lib/scoring/handicap.ts` + `src/lib/scoring/engine.ts`
- **Score saving:** `src/app/actions/scores.ts` → `saveScore()`
- **Playwright config:** `playwright.config.ts` — workers: 1, base URL: Vercel
- **PIN:** 2626 — global setup handles auth
- **Supabase project:** lnnlabbdffowjpaxvnsp
- **Service role key:** `~/.config/supabase/degen-dudes-service-role` (NEVER display)

## Critical Gotchas (every session must know)

1. **Vercel SSR caching:** Leaderboard, scorecards, strokes pages return CACHED EMPTY data on initial load. UI tests CANNOT check score values. Use direct Supabase API calls for all math verification. UI tests only verify: page loads, player names visible, nav present.

2. **Tests are stateful:** Tests 21-26 share DB state. Run reset script before running, then run in numeric order. Test 23 modifies Chris/Jauch scores. Test 26 modifies Ryan H1.

3. **USGA formula:** `CH = ROUND(HI × (Slope / 113) + (Rating - Par))`. NEVER use the simplified version that drops `(Rating - Par)`. This was the root cause of 9 wrong values in the original Sonnet plan.

4. **Run order:**
   ```
   npx ts-node --project tsconfig.json scripts/reset-test-data.ts
   npx playwright test tests/scoring/20-unit-scoring.spec.ts --reporter=list
   npx playwright test tests/scoring/21-scenario-a-seed.spec.ts --reporter=list
   ... (each file individually, in numeric order)
   ```

5. **PostgREST upsert for updates:** When updating existing scores, the upsert URL needs `?on_conflict=player_id,course_id,hole_number` to avoid 409 duplicate key errors.

6. **Scores table columns:** `player_id`, `course_id`, `hole_number`, `gross_score`, `net_score`, `ch_strokes`, `ph_score`. NO `day_number` column (comes from courses table join). NO `hole_id` column.

## Constraints & Rules

- Use Sonnet 4.6 for implementation. Opus only for debugging subtle math.
- Thinking: off (only Eric changes this)
- Do NOT enter scores manually — everything through Playwright or API scripts
- Check context at 50%, stop at 70%
- Reserve 30% context for /checkpoint at end of session

## Deliverables

### Phase 1: Unit Tests (scoring engine math)
Test file: `tests/scoring/20-unit-scoring.spec.ts`
- All 33 CH values (11 players × 3 days × 3 courses)
- Stroke allocation boundary conditions (CH=0, 1, 18, 19, 36, 37, 42)
- Net score calculation with both NET_MAX_OVER_PAR values (2 and 3)
- Playing handicap calculation
- Ace/eagle/extreme score handling

### Phase 2: Test Data Management
Script: `scripts/reset-test-data.ts`
- Wipe scores, groups, matches, match_players, group_players
- Set team assignments (USA/Europe)
- Create Day 1 groups (3 groups per Section 7)
- Create matches within each group
- Verify seed correctness

### Phase 3: Scenario A — Day 1 (Baseline Verification)
- Seed 198 Scenario A scores (par+2 every hole, Day 1) via API
- Verify gross totals = 108 for all 11 players
- Verify net totals match TESTING-PLAN.md Section 3 Day 1 values
- Verify per-hole net scores (spot check Ryan H1-H18)
- Verify ch_strokes totals = CH values per player
- Verify leaderboard page loads with all player names
- Verify scorecards page loads, shape indicator logic correct
- Verify strokes page loads, stroke distribution matches Section 2
- Verify undo/history functionality (update trail + restore)

### Phase 4: Scenario A — Day 2 (PGA West Mountain)
- Seed Scenario A scores for Day 2 via API
- Verify net totals match TESTING-PLAN.md Section 3 Day 2 values
- Verify stroke distribution matches Section 2 Day 2
- Verify CH values used match Section 1 Day 2

### Phase 5: Scenario A — Day 3 (Eagle Falls)
- Seed Scenario A scores for Day 3 via API
- Verify net totals match TESTING-PLAN.md Section 3 Day 3 values
- Verify stroke distribution matches Section 2 Day 3
- Verify CH values used match Section 1 Day 3

### Phase 6: Scenario B — Mixed Realistic Scores
- Seed Scenario B scores (mixed birdies, bogeys, triples) per TESTING-PLAN.md Section 3
- Verify net totals match expected values
- Tests different code paths than Scenario A (strokes matter more with varied scores)

### Phase 7: Scenario C — Net Cap Stress Test
- Seed gross=15 for all players on all holes
- Verify NET_MAX_OVER_PAR=3 capping behavior per Section 3/5
- Compare with NET_MAX_OVER_PAR=2 behavior per Section 5
- This is the scenario most likely to catch cap calculation bugs

### Phase 8: Scenario D — Aces and Eagles
- Seed aces on par 3s, eagles on par 5s per Section 3
- Verify very low/negative net scores handled correctly
- Tests edge cases in net score calculation

### Phase 9: Match Format Verification
Per TESTING-PLAN.md Section 4:
- 4a: Best Ball + Validation — verify hole-by-hole results, final score A:1 B:2
- 4b: Best Ball (no validation) — verify final score A:1 B:2
- 4c: Low Ball + Total — verify final score A:2 B:4
- 4d: Singles Match Play (Eric vs Ben) — verify final score A:14.5 B:3.5
- 4e: Singles Match Play High HC (Chris vs Jauch) — verify final score A:5.5 B:12.5
- 4f: Singles Stroke Play — verify no points until 18 holes complete, then correct winner

### Phase 10: Leaderboard Verification (All 3 Days)
Per TESTING-PLAN.md Section 6:
- After all 3 days of Scenario A, verify cumulative leaderboard ranking
- Verify total gross, total net, vs par for all 11 players

### Phase 11: Multi-User Concurrent Entry
- 3 players entering scores simultaneously via Promise.all()
- Verify no dropped or overwritten scores
- Verify concurrent updates (upserts) work without data loss
- Verify leaderboard page loads without crashing

### Phase 12: Visual Walkthrough
- Use managed browser (profile=openclaw) to screenshot each page
- Scorecards: shape indicators visible (birdie=red, bogey=purple, double=orange)
- Strokes: dots/dashes/×2/×3 rendering correctly
- Leaderboard: players in correct order with scores
- Home: groups, team scores visible
- Admin: accessible via secret "2026" link

---

## Completion Checklist

SCOPE: 18 total items

- [x] **Phase 1: Unit tests** — 83 tests in 20-unit-scoring.spec.ts
  - Evidence: 83 passing, commit c6a3e89
  - Session: 10 (2026-02-21)
- [x] **Phase 2: Reset script** — scripts/reset-test-data.ts
  - Evidence: Creates 3 groups, 4 matches, 11 players. Commit c6a3e89
  - Session: 10 (2026-02-21)
- [x] **Phase 3: Scenario A Day 1** — tests 21-26 (49 tests)
  - Evidence: 49 passing across 6 files, commit 434e393
  - Session: 11 (2026-02-21)
- [x] **Phase 4: Scenario A Day 2** — seed + verify PGA West Mountain
  - Evidence: 7 passing in 28-scenario-a-day2.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 5: Scenario A Day 3** — seed + verify Eagle Falls
  - Evidence: 7 passing in 29-scenario-a-day3.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 6: Scenario B** — mixed realistic scores
  - Evidence: 6 passing in 31-scenario-b.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 7: Scenario C** — net cap stress test (gross=15)
  - Evidence: 9 passing in 32-scenario-c.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 8: Scenario D** — aces and eagles
  - Evidence: 8 passing in 33-scenario-d.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9a: Match format — best_ball_validation** — Section 4a
  - Evidence: passing in 34-match-formats.spec.ts (tests 9a/9b/9c/9d/9e/9f), commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9b: Match format — best_ball** — Section 4b
  - Evidence: passing in 34-match-formats.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9c: Match format — low_total** — Section 4c
  - Evidence: passing in 34-match-formats.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9d: Match format — singles_match (Eric vs Ben)** — Section 4d
  - Evidence: passing in 34-match-formats.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9e: Match format — singles_match high HC** — Section 4e
  - Evidence: passing in 34-match-formats.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 9f: Match format — singles_stroke** — Section 4f
  - Evidence: passing in 34-match-formats.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 10: Leaderboard all 3 days** — Section 6
  - Evidence: 7 passing in 30-leaderboard-all-days.spec.ts, commit f8b7c81
  - Session: 13 (2026-02-22)
- [x] **Phase 11: Multi-user concurrent entry** — 7 tests in 27-multi-user.spec.ts
  - Evidence: 7 passing, commit 159b6fa
  - Session: 12 (2026-02-22)
- [x] **Phase 12: Visual walkthrough** — managed browser screenshots
  - Evidence: Screenshots taken of home, scorecards, strokes, leaderboard, admin. Session 12.
  - Session: 12 (2026-02-22)
- [x] **Full suite regression** — all tests pass when run in sequence after reset
  - Evidence: 194/194 passing, full reset → 20 through 34 run, commit f8b7c81
  - Session: 13 (2026-02-22)

## Scope Hash
18 items total. 18 complete (100%). 0 remaining.
