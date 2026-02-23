# Degen Dudes Golf App — Phase 2 Features Specification

**Created:** 2026-02-22 by Opus 4.6
**Status:** ACTIVE
**Owner:** Eric (only Eric can modify deliverables or acceptance criteria)
**Deadline:** Features 1-2 before Feb 26 (trip departure). Features 3-6 before/during trip.
**Prior work:** Scoring test suite SPEC.md (COMPLETE, 194/194 tests, separate file)

## Goal

Add offline resilience, island player competition rules, live score notifications, match ticker in score entry, end-of-day summary cards, and haptic feedback — making the app reliable without cell service and more engaging on the course during the Feb 26 - Mar 2 golf trip.

## Current State (what exists today)

- All matches currently award **1 / 0.5 / 0 match points** regardless of format — hardcoded in `engine.ts` `calcMatchResult`. Feature 2 changes this to variable point values.
- No island player concept exists in the DB schema or UI.
- The service worker (`public/sw.js`) only caches `/`, `/manifest.json`, and `/assets/logo.jpg`. The `/scores` page and its JS bundles are **not** cached — opening `/scores` offline shows a blank shell. There is no `next-pwa` integration; the SW is manual.
- Score entry uses `saveScore` server action (Next.js RSC) which calls Supabase directly. There is no offline queue.

## Context for New Sessions

- **App:** https://www.thedegendudes.com | Repo: `~/code/degen-dudes/`
- **Stack:** Next.js 15, Supabase, Tailwind, Vercel
- **PIN:** 2626 | **Supabase project:** lnnlabbdffowjpaxvnsp
- **Service role key:** `~/.config/supabase/degen-dudes-service-role` (NEVER display)
- **11 players, 3 days, 3 courses.** Team sizes (USA vs Europe, 6v5 or 5v6) are determined by Thursday night draft — the system must handle either team being the 5-player or 6-player team.
- **Scoring engine is fully tested** — 194 Playwright tests verify all math. Modifying `handicap.ts` or `engine.ts` REQUIRES re-running the full test suite afterward.
- **Vercel SSR caching gotcha:** Pages return cached data on first load. Real-time updates come via Supabase subscriptions client-side.
- **Prior handoffs:** `~/clawd/memory/handoffs/2026-02-21-1700-degen-dudes-phase3-complete.md` (full project context)
- **BUGS.md:** `~/code/degen-dudes/BUGS.md` — cross-reference before implementing. POLISH-2 (group duplicate prevention) relates to 2c. POLISH-3 (toast brevity) relates to Feature 6.

## Island Player Rules (from Ben, Feb 22 2026)

Eric asked Ben: "Remind me.... how are we handling the singles match-ups on Sunday with an odd amount of players? do we pick someone on the team with 5 people who will have their score go up against two people on the other team? If so, who decides who that person is?"

Ben's response (verbatim):
> "Yeah and that will happen every day too. Friday and Saturday the matches are for a point each when the pairs games are worth 2. Sunday every match is worth 2. So 6 total points for Friday 6 for Saturday and 12 for Sunday. Right now how I'm thinking about it is the team with 5 will choose their island player. No repeats for both teams for the island matches. Island matches will draw last so the other team doesn't know who you're throwing out there. I was thinking about having that person selected from the home team but they have double point responsibilities and are going 2 on 1 with no team support in their cart to pick them up if they go down. Feels fair in my mind that they can own that decision. With no repeats a team can't just send their best golfer out there every day Everyone on the team of 6 will play there once and 3 of the 5 will do it."

**Key rules extracted:**

1. **The 5-player team chooses their "island player" each day** — this is the person who plays alone against two opponents (2-on-1). The 5-player team owns the decision of who they send out.

2. **The island player faces TWO opponents from the 6-player team** — creating two separate match results (island player vs opponent A, island player vs opponent B). Each result is scored as a standard match worth standard points (see Decision #9).

3. **No-repeat rules apply to BOTH teams:**
   - **Island player (from 5-team):** 3 of the 5 players serve as island player across 3 days. No player can be island player twice.
   - **Island opponents (from 6-team):** Each of the 6 players serves as an island opponent exactly once across 3 days (2 opponents per day × 3 days = 6 slots for 6 players).

4. **Island matches are created/revealed LAST** — the opposing team doesn't know who they're facing until all other matches are set. The design doc (2a) must specify how "drawn last" translates to the admin UI (e.g., admin creates Groups 1-2 first, then creates the island match separately; or island match details are hidden from non-admin views until finalized).

5. **"Double point responsibility" means two separate matches, NOT doubled point values** — the island player plays two match results at standard point values. On Days 1-2, each island match result is worth 1 point (same as regular singles). On Day 3, each is worth 2 points. The "double" refers to the player bearing responsibility for two match outcomes, not a point multiplier. (See Decision #9 for math proof.)

6. **Points per day:** Friday 6, Saturday 6, Sunday 12. Total: 24 points across the trip.

7. **Point values by format:**
   - Pairs matches (Days 1-2, Groups 1 & 2): **2 points each** (win=2, tie=1 each)
   - Singles matches (Days 1-2, Group 3 including island): **1 point each** (win=1, tie=0.5 each)
   - All Day 3 matches (all singles including island): **2 points each** (win=2, tie=1 each)

8. **Daily point math verification:**
   - Day 1: 2 pairs × 2pts + 2 island results × 1pt = 6 ✓
   - Day 2: 2 pairs × 2pts + 2 island results × 1pt = 6 ✓
   - Day 3: 6 singles × 2pts = 12 ✓ (includes 2 island results × 2pts)
   - Total: 24 ✓

*Note: Ben mentioned "home team" selection but decided against it — the 5-player team chooses their own island player. This is the final rule.*

## Deliverables

### Feature 1: Offline Score Entry (Priority 1 — pre-trip)
**Why:** Desert golf courses may have spotty cell service. Scores must not be lost.

**Acceptance criteria:**
- [ ] **1a: Offline detection hook** — `useOfflineSync` hook that tracks `navigator.onLine` state and listens for `online`/`offline` events
- [ ] **1b: localStorage score queue** — when offline, `saveScore` writes to a `degen-offline-queue` key in localStorage instead of hitting Supabase. Each entry includes: player_id, course_id, hole_number, gross_score, day_number, timestamp
- [ ] **1c: Auto-sync on reconnect** — when `online` event fires, flush the queue to Supabase via existing `saveScore` server action. Process in order. Remove from queue only after successful save. If server action calls fail after reconnect (e.g., session/CSRF expired), show a "Refresh to sync" prompt. Consider direct Supabase client (`@supabase/supabase-js` with anon key) as fallback for queue flush.
- [ ] **1d: Connection status indicator** — visible dot/icon in score entry header: green = connected, amber = syncing (N queued), red = offline (N queued). Day number shown for context (e.g., "3 scores queued for Day 1").
- [ ] **1e: Service worker app shell caching** — current SW only caches root page and logo. Must expand caching strategy to include `/scores` route and its JS/CSS bundles so the score entry page loads fully offline. Evaluate whether to use `next-pwa` or expand the manual SW. Test on an actual phone with PWA installed (Chrome DevTools "Offline" mode is unreliable for SW testing). Also fix: current SW caches `/assets/logo.jpg` but the actual file may be `/assets/logo.png` — verify and correct.
- [ ] **1f: Conflict handling** — if the same player/course/hole exists in both queue and DB, last-write-wins by timestamp. Log conflicts to console for debugging.
- [ ] **1g: Manual test** — enter 3 scores offline, reconnect, verify all 3 appear in Supabase with correct values

### Feature 2: Island Player System (Priority 1 — pre-trip)
**Why:** Core competition rules. Without this, Day 1 scoring structure is wrong.

**Note:** Feature 2 can be split for incremental delivery:
- **2b + 2g (point values)** can ship independently before the island player UI is ready. This fixes the current "all matches = 1 point" behavior.
- **2a, 2c-2f (island player logic)** requires the design doc first.

**Feature 2 requires Supabase schema changes** (new columns or tables for island player tracking, point values on matches, etc.). The design doc (2a) must specify exact SQL migrations.

**Acceptance criteria:**
- [ ] **2a: Design doc** — write a design document covering: (1) exact Supabase schema changes (SQL migrations), (2) how island matches are created in admin (including "drawn last" workflow — see rule #4), (3) how 2-on-1 scoring works, (4) how both no-repeat constraints are enforced, (5) how points are calculated, (6) whether island matches are modeled as 2 separate singles matches in the DB (preferred — reuses existing engine) or a special match type, (7) how playing handicap (PH) is calculated for island matches — per-pair (2-player, like regular singles) or across all 3 participants. Get Eric's approval before implementing.
- [ ] **2b: Point value system** — implement correct point values: pairs matches = 2 pts, singles = 1 pt (Days 1-2), all Day 3 matches = 2 pts each. **Requires modifying `engine.ts` `calcMatchResult`** to accept a `pointValue` parameter (or multiplier) instead of hardcoded 1/0.5/0. This MUST be followed by running the full 194-test suite.
- [ ] **2c: Island match creation** — admin can designate an island player for a day. System validates BOTH no-repeat constraints: (1) island player from 5-team hasn't been island player before, (2) island opponents from 6-team haven't been island opponents before. Shows remaining eligible players for both roles.
- [ ] **2d: 2-on-1 match scoring** — island player's net score is compared against BOTH opponents in two separate match results, each worth standard points for that day/format. Preferred implementation: create 2 separate singles matches in the DB, reusing existing `calcMatchResult` logic.
- [ ] **2e: Island player visibility** — dashboard/matches page shows island matches distinctly (different styling, "ISLAND" badge)
- [ ] **2f: No-repeat enforcement** — system prevents assigning the same island player twice (5-team constraint) AND prevents assigning the same island opponents twice (6-team constraint). Shows remaining eligible players for both roles with clear labels.
- [ ] **2g: Point totals updated** — leaderboard team scores reflect the correct point values (pairs=2, singles=1 on D1-D2, all=2 on D3), not the current 1-point-per-match

### Feature 3: Live On-Course Notifications (Priority 2)
**Why:** Keeps competitive energy high between groups who can't see each other.

**Acceptance criteria:**
- [ ] **3a: Score update banner** — when another group saves scores, a brief notification appears showing the update. Example: "Group 1 finished Hole 7 — USA leads 4-3" (this is the running hole-by-hole points within that group's match, not overall team score).
- [ ] **3b: Supabase realtime trigger** — subscribe to score inserts/updates. Use localStorage `degen_player_name` to determine which group "you" are in, then filter to show only updates from OTHER groups. Notifications should appear on both the dashboard AND the score entry page.
- [ ] **3c: Auto-dismiss** — notifications auto-dismiss after 5-8 seconds, or tap to dismiss
- [ ] **3d: Non-intrusive** — notification does NOT block score entry or any interactive elements

### Feature 4: Match Ticker in Score Entry (Priority 2)
**Why:** Scorer shouldn't have to leave the score entry page to see how their match is going.

**Acceptance criteria:**
- [ ] **4a: Running match score** — after saving scores for a hole, show the current match result below the score inputs: "Your match: USA 3 - Europe 2 thru 5". "Your match" is determined by localStorage `degen_player_name` — shows all matches containing that player. If the scorer is entering for a group they're not in (via "Change group"), show that group's match result instead.
- [ ] **4b: Updates on save** — recalculates after each hole is saved, not just on page load
- [ ] **4c: Format-aware** — displays correctly for all match formats (best ball shows team score, singles shows head-to-head)

### Feature 5: End-of-Day Summary Card (Priority 3)
**Why:** Shareable recap for the group chat. Makes the day's results feel official.

**Acceptance criteria:**
- [ ] **5a: Summary page/modal** — accessible from dashboard after all groups finish a day. Shows: match results, team score, leaderboard top 3, biggest mover, best individual round.
- [ ] **5b: Screenshot-friendly layout** — designed as a single-screen card with the app branding, optimized for phone screenshots
- [ ] **5c: Day selector** — can view summary for any completed day

### Feature 6: Score Entry Haptic Feedback (Priority 3)
**Why:** Confirms the tap registered when you can't see the screen well in bright sun.

**Acceptance criteria:**
- [ ] **6a: Vibration on save** — call `navigator.vibrate(50)` (short pulse) when a score is successfully saved
- [ ] **6b: Graceful fallback** — no errors on devices that don't support vibration (check `navigator.vibrate` exists first)

### Feature 7: Day 3 Matchup Builder (Priority 4 — before Saturday evening)
**Why:** Day 3 is all singles. Captains alternate picks for opponent matchups. Pick order determined after Saturday's round.

**Acceptance criteria:**
- [ ] **7a: Matchup picker UI** — page or admin section where captains alternate selecting opponent pairings
- [ ] **7b: Alternating picks** — enforces turn order (captain A picks, then captain B, etc.)
- [ ] **7c: Auto-create matches** — when all matchups are set, creates the groups + matches in Supabase
- [ ] **7d: Island player designation** — includes island player selection for Day 3 (integrated with Feature 2)
- [ ] **7e: Pick order input** — admin manually sets which captain picks first. The app does not auto-determine pick order.

### Feature 8: Enhanced Player Stats (Priority 5 — anytime)
**Why:** Fun post-round analysis.

**Acceptance criteria:**
- [ ] **8a: Stats on player page** — birdies, pars, bogeys, doubles+, scoring average per round
- [ ] **8b: Computed from existing data** — no new tables, just queries against scores table
- [ ] **8c: Best/worst hole** — highlight the player's best and worst scoring holes

## Constraints & Rules

- Use Sonnet 4.6 for implementation. Opus for planning/design of complex features (island player).
- Thinking: off (only Eric changes this)
- Modifying scoring engine files (`handicap.ts`, `engine.ts`) REQUIRES running the full 194-test suite afterward. Feature 2b specifically requires engine changes.
- Feature 2 (island player) requires a design doc approved by Eric before any code is written
- Feature 2 likely requires Supabase schema changes (new columns/tables). Design doc (2a) must specify exact SQL migrations.
- Service worker changes (Feature 1e) need careful testing — broken SW can cache stale app versions
- Cross-reference `BUGS.md` before implementing — POLISH-2 (group duplicate prevention) affects 2c, POLISH-3 (toast brevity) affects Feature 6

### Context Window Management (CRITICAL)

**Compaction is a catastrophic event.** Eric considers mid-task compaction a session failure. Every session working on this spec MUST follow these rules:

1. **Check context usage at regular intervals** — after completing each acceptance criterion (or every 15-20 minutes of active work), run `session_status` or ask Eric to check `/status`. Do not wait until it feels full.
2. **Hard pause at 50%** — at 50% context usage, stop implementation work and assess: can the current feature/criterion be finished before 70%? If not, begin handoff prep immediately.
3. **Reserve the last 25-30% for close-out** — this buffer is for documenting what was done, updating the completion checklist, writing the handoff, and running `/checkpoint` or `/done`. Never consume this buffer with implementation work.
4. **Stop all implementation at 70%** — no exceptions. Begin handoff documentation. Write what was completed, what's in progress, what's next, and any gotchas discovered.
5. **Prefer smaller sessions over longer ones** — it's better to complete 2-3 acceptance criteria cleanly with a good handoff than to attempt 5 and hit compaction mid-task. Each session should target a natural stopping point (e.g., finish Feature 1a-1d, then hand off).
6. **Sub-agents inherit this rule** — any spawned sub-agent working on this spec must also check context and stop at 70%.

## Key Files
| File | Purpose |
|------|---------|
| `src/app/(app)/scores/ScoreEntryClient.tsx` | Score entry UI (Features 1, 4, 6 touch this) |
| `src/app/actions/scores.ts` | Score save server action (Feature 1 wraps this) |
| `src/lib/scoring/handicap.ts` | Scoring engine — re-test after ANY modification |
| `src/lib/scoring/engine.ts` | Match scoring engine — re-test after ANY modification. Feature 2b adds pointValue param. |
| `src/app/(app)/page.tsx` | Dashboard (Features 3, 5 touch this) |
| `src/app/(app)/matches/page.tsx` | Matches page (Feature 2e touches this) |
| `src/app/(app)/admin/AdminClient.tsx` | Admin UI (Features 2c, 7 touch this) |
| `public/sw.js` | Service worker (Feature 1e) — currently only caches root + logo |
| `next.config.ts` | PWA/SW config (Feature 1e) |
| `TESTING-PLAN.md` | 693 lines of expected scoring math — ground truth |
| `tests/scoring/` | 194 Playwright tests — run after any scoring changes |
| `BUGS.md` | Known bugs and polish items — cross-reference before implementing |

## Completion Checklist

**SCOPE: 34 items total**

- [x] 1a: Offline detection hook
- [x] 1b: localStorage score queue
- [x] 1c: Auto-sync on reconnect
- [x] 1d: Connection status indicator
- [x] 1e: Service worker app shell caching
- [x] 1f: Conflict handling
- [ ] 1g: Manual offline test (Eric verifies on phone)
- [x] 2a: Island player design doc (approved by Eric 2026-02-22)
- [x] 2b: Point value system
- [x] 2c: Island match creation
- [x] 2d: 2-on-1 match scoring
- [x] 2e: Island player visibility
- [x] 2f: No-repeat enforcement
- [x] 2g: Point totals updated
- [x] 3a: Score update banner
- [x] 3b: Supabase realtime trigger
- [x] 3c: Auto-dismiss
- [x] 3d: Non-intrusive
- [x] 4a: Running match score
- [x] 4b: Updates on save
- [x] 4c: Format-aware
- [ ] 5a: Summary page/modal
- [ ] 5b: Screenshot-friendly layout
- [ ] 5c: Day selector
- [x] 6a: Vibration on save
- [x] 6b: Graceful fallback
- [ ] 7a: Matchup picker UI
- [ ] 7b: Alternating picks
- [ ] 7c: Auto-create matches
- [ ] 7d: Island player designation for Day 3
- [ ] 7e: Pick order input
- [ ] 8a: Stats on player page
- [ ] 8b: Computed from existing data
- [ ] 8c: Best/worst hole

## Scope Hash
34 items | 8 features | SHA: 11bb647be44b
