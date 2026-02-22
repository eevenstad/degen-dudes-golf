# Degen Dudes Golf App — Phase 2 Features Specification

**Created:** 2026-02-22 by Opus 4.6
**Status:** DRAFT — pending review fixes before activation
**Owner:** Eric (only Eric can modify deliverables or acceptance criteria)
**Deadline:** Features 1-2 before Feb 26 (trip departure). Features 3-6 before/during trip.
**Prior work:** Scoring test suite SPEC.md (COMPLETE, 194/194 tests, separate file)

**⚠️ THIS SPEC HAS KNOWN ISSUES.** A sub-agent review identified 7 must-fix, 3 should-fix, 5 ambiguities, and 7 suggestions. See `~/clawd/tmp/degen-dudes-phase2-review.md` for the full review. The next session MUST apply ALL findings (not just must-fixes) before activating this spec. Eric's preference: do it right, not easy.

## Goal

Add offline resilience, island player competition rules, live score notifications, match ticker in score entry, end-of-day summary cards, and haptic feedback — making the app reliable without cell service and more engaging on the course during the Feb 26 - Mar 2 golf trip.

## Context for New Sessions

- **App:** https://www.thedegendudes.com | Repo: `~/code/degen-dudes/`
- **Stack:** Next.js 15, Supabase, Tailwind, Vercel
- **PIN:** 2626 | **Supabase project:** lnnlabbdffowjpaxvnsp
- **Service role key:** `~/.config/supabase/degen-dudes-service-role` (NEVER display)
- **11 players, 3 days, 3 courses.** USA (6) vs Europe (5).
- **Scoring engine is fully tested** — 194 Playwright tests verify all math. Do NOT modify `src/lib/scoring/handicap.ts` or `engine.ts` without re-running the full suite.
- **Vercel SSR caching gotcha:** Pages return cached data on first load. Real-time updates come via Supabase subscriptions client-side.
- **Prior handoffs:** `~/clawd/memory/handoffs/2026-02-21-1700-degen-dudes-phase3-complete.md` (full project context)

## Island Player Rules (from Ben, Feb 22 2026)

Eric asked Ben: "Remind me.... how are we handling the singles match-ups on Sunday with an odd amount of players? do we pick someone on the team with 5 people who will have their score go up against two people on the other team? If so, who decides who that person is?"

Ben's response (verbatim):
> "Yeah and that will happen every day too. Friday and Saturday the matches are for a point each when the pairs games are worth 2. Sunday every match is worth 2. So 6 total points for Friday 6 for Saturday and 12 for Sunday. Right now how I'm thinking about it is the team with 5 will choose their island player. No repeats for both teams for the island matches. Island matches will draw last so the other team doesn't know who you're throwing out there. I was thinking about having that person selected from the home team but they have double point responsibilities and are going 2 on 1 with no team support in their cart to pick them up if they go down. Feels fair in my mind that they can own that decision. With no repeats a team can't just send their best golfer out there every day Everyone on the team of 6 will play there once and 3 of the 5 will do it."

**Key rules extracted:**
1. The team with 5 players designates their "island player" each day
2. The island player plays against TWO opponents from the 6-player team simultaneously (2-on-1)
3. No repeats — each player on the 6-player team does island duty exactly once across 3 days; 3 of 5 on the smaller team do it
4. Island matches are drawn/revealed LAST (opponent secrecy)
5. Island matches carry double point responsibility
6. Points per day: Friday 6, Saturday 6, Sunday 12 (Sunday all matches worth 2 each)
7. Pairs matches (Days 1-2) worth 2 points each; singles (Group 3 Days 1-2) worth 1 point each

**⚠️ REVIEW FLAG:** The review identified ambiguity in rule #3 (conflates island player vs island opponents) and rule #5 ("double point responsibility" interpretation). See review file for details. Must be clarified before implementation.

## Deliverables

### Feature 1: Offline Score Entry (Priority 1 — pre-trip)
**Why:** Desert golf courses may have spotty cell service. Scores must not be lost.

**Acceptance criteria:**
- [ ] **1a: Offline detection hook** — `useOfflineSync` hook that tracks `navigator.onLine` state and listens for `online`/`offline` events
- [ ] **1b: localStorage score queue** — when offline, `saveScore` writes to a `degen-offline-queue` key in localStorage instead of hitting Supabase. Each entry includes: player_id, course_id, hole_number, gross_score, timestamp
- [ ] **1c: Auto-sync on reconnect** — when `online` event fires, flush the queue to Supabase via existing `saveScore` server action. Process in order. Remove from queue only after successful save.
- [ ] **1d: Connection status indicator** — visible dot/icon in score entry header: green = connected, amber = syncing (N queued), red = offline (N queued)
- [ ] **1e: Service worker app shell caching** — verify next-pwa caches enough that score entry page loads fully offline (not just a blank shell). Test by going to airplane mode and navigating to /scores.
- [ ] **1f: Conflict handling** — if the same player/course/hole exists in both queue and DB, last-write-wins by timestamp. Log conflicts to console for debugging.
- [ ] **1g: Manual test** — enter 3 scores offline, reconnect, verify all 3 appear in Supabase with correct values

### Feature 2: Island Player System (Priority 1 — pre-trip)
**Why:** Core competition rules. Without this, Day 1 scoring structure is wrong.

**Acceptance criteria:**
- [ ] **2a: Design doc** — write a design document covering: data model changes (if any), how island matches are created in admin, how 2-on-1 scoring works, how no-repeat is enforced, how points are calculated. Get Eric's approval before implementing.
- [ ] **2b: Point value system** — implement correct point values: pairs matches = 2 pts, singles = 1 pt (Days 1-2), all Day 3 matches = 2 pts each
- [ ] **2c: Island match creation** — admin can designate an island player for a day. System validates no-repeat rule (shows who's already been island player on prior days).
- [ ] **2d: 2-on-1 match scoring** — island player's net score is compared against BOTH opponents. Two separate match results, each worth points.
- [ ] **2e: Island player visibility** — dashboard/matches page shows island matches distinctly (different styling, "ISLAND" badge)
- [ ] **2f: No-repeat enforcement** — system prevents assigning the same player as island player twice. Shows remaining eligible players.
- [ ] **2g: Point totals updated** — leaderboard team scores reflect the correct point values (not the current 1-point-per-match)

### Feature 3: Live On-Course Notifications (Priority 2)
**Why:** Keeps competitive energy high between groups who can't see each other.

**Acceptance criteria:**
- [ ] **3a: Score update banner** — when another group saves scores, a brief notification appears on the dashboard: "Group 1 finished Hole 7 — USA leads 4-3"
- [ ] **3b: Supabase realtime trigger** — subscribe to score inserts/updates, filter to only show updates from OTHER groups (not your own)
- [ ] **3c: Auto-dismiss** — notifications auto-dismiss after 5-8 seconds, or tap to dismiss
- [ ] **3d: Non-intrusive** — notification does NOT block score entry or any interactive elements

### Feature 4: Match Ticker in Score Entry (Priority 2)
**Why:** Scorer shouldn't have to leave the score entry page to see how their match is going.

**Acceptance criteria:**
- [ ] **4a: Running match score** — after saving scores for a hole, show the current match result below the score inputs: "Your match: USA 3 - Europe 2 thru 5"
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

### Feature 8: Enhanced Player Stats (Priority 5 — anytime)
**Why:** Fun post-round analysis.

**Acceptance criteria:**
- [ ] **8a: Stats on player page** — birdies, pars, bogeys, doubles+, scoring average per round
- [ ] **8b: Computed from existing data** — no new tables, just queries against scores table
- [ ] **8c: Best/worst hole** — highlight the player's best and worst scoring holes

## Constraints & Rules

- Use Sonnet 4.6 for implementation. Opus for planning/design of complex features (island player).
- Thinking: off (only Eric changes this)
- Do NOT modify scoring engine files (`handicap.ts`, `engine.ts`) without running full test suite after
- Check context at 50%, stop at 70%
- Feature 2 (island player) requires a design doc approved by Eric before any code is written
- Service worker changes (Feature 1e) need careful testing — broken SW can cache stale app versions

## Key Files
| File | Purpose |
|------|---------|
| `src/app/(app)/scores/ScoreEntryClient.tsx` | Score entry UI (Features 1, 4, 6 touch this) |
| `src/app/actions/scores.ts` | Score save server action (Feature 1 wraps this) |
| `src/lib/scoring/handicap.ts` | Scoring engine — DO NOT MODIFY without re-testing |
| `src/lib/scoring/engine.ts` | Match scoring engine — DO NOT MODIFY without re-testing |
| `src/app/(app)/page.tsx` | Dashboard (Features 3, 5 touch this) |
| `src/app/(app)/matches/page.tsx` | Matches page (Feature 2e touches this) |
| `src/app/(app)/admin/AdminClient.tsx` | Admin UI (Features 2c, 7 touch this) |
| `public/sw.js` | Service worker (Feature 1e) |
| `next.config.ts` | PWA/SW config (Feature 1e) |
| `TESTING-PLAN.md` | 693 lines of expected scoring math — ground truth |
| `tests/scoring/` | 194 Playwright tests — run after any scoring changes |

## Completion Checklist

SCOPE: needs recount after review fixes (see review file)

- [ ] 1a: Offline detection hook
- [ ] 1b: localStorage score queue
- [ ] 1c: Auto-sync on reconnect
- [ ] 1d: Connection status indicator
- [ ] 1e: Service worker app shell caching
- [ ] 1f: Conflict handling
- [ ] 1g: Manual offline test
- [ ] 2a: Island player design doc (MUST be approved before 2b-2g)
- [ ] 2b: Point value system
- [ ] 2c: Island match creation
- [ ] 2d: 2-on-1 match scoring
- [ ] 2e: Island player visibility
- [ ] 2f: No-repeat enforcement
- [ ] 2g: Point totals updated
- [ ] 3a: Score update banner
- [ ] 3b: Supabase realtime trigger
- [ ] 3c: Auto-dismiss
- [ ] 3d: Non-intrusive
- [ ] 4a: Running match score
- [ ] 4b: Updates on save
- [ ] 4c: Format-aware
- [ ] 5a: Summary page/modal
- [ ] 5b: Screenshot-friendly layout
- [ ] 5c: Day selector
- [ ] 6a: Vibration on save
- [ ] 6b: Graceful fallback
- [ ] 7a: Matchup picker UI
- [ ] 7b: Alternating picks
- [ ] 7c: Auto-create matches
- [ ] 7d: Island player designation for Day 3
- [ ] 8a: Stats on player page
- [ ] 8b: Computed from existing data
- [ ] 8c: Best/worst hole

## Scope Hash
[PENDING — recount after review fixes are applied]
