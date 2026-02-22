# Island Player System — Design Document

**Status:** DRAFT — awaiting Eric's approval before implementation
**Created:** 2026-02-22
**Feature:** 2a (design doc), 2c (creation), 2d (scoring), 2e (visibility), 2f (enforcement)

---

## Overview

The island player is a player from the 5-person team who goes 2-on-1 against two opponents from the 6-person team. They play two separate match results at standard point values. Ben's rules are authoritative (see SPEC-phase2.md).

---

## 1. Supabase Schema Changes

### 1a. Add `point_value` column to `matches` table

Currently `team_a_points` / `team_b_points` store the final match result (0, 0.5, 1). With Feature 2b, these now store 0, 0.5×pv, or pv (where pv = point value). We need to store `point_value` explicitly on each match so the UI can display "this match is worth 2 points" without re-inferring it.

```sql
ALTER TABLE matches ADD COLUMN point_value INTEGER NOT NULL DEFAULT 1;
```

**Populate existing matches:**
```sql
-- Pairs formats = 2 pts
UPDATE matches SET point_value = 2
WHERE format IN ('best_ball_validation', 'best_ball', 'low_total');

-- Singles D3 = 2 pts (join to get day_number via groups → courses)
UPDATE matches SET point_value = 2
WHERE format IN ('singles_match', 'singles_stroke')
  AND id IN (
    SELECT m.id FROM matches m
    JOIN groups g ON g.id = m.group_id
    JOIN courses c ON c.day_number = g.day_number
    WHERE c.day_number = 3
  );
```

### 1b. Add `island_player_assignments` table

Tracks which player serves as island player per day, and which two opponents they face. This enforces the no-repeat rules.

```sql
CREATE TABLE island_player_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL CHECK (day_number IN (1, 2, 3)),
  island_player_id UUID NOT NULL REFERENCES players(id),
  opponent_a_id UUID NOT NULL REFERENCES players(id),
  opponent_b_id UUID NOT NULL REFERENCES players(id),
  match_a_id UUID REFERENCES matches(id),  -- island vs opponent A
  match_b_id UUID REFERENCES matches(id),  -- island vs opponent B
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_number),                      -- one island assignment per day
  UNIQUE (island_player_id, day_number),    -- can't island twice (enforced via UNIQUE)
  CHECK (island_player_id != opponent_a_id),
  CHECK (island_player_id != opponent_b_id),
  CHECK (opponent_a_id != opponent_b_id)
);
```

**No-repeat enforcement via DB constraints:**
- `UNIQUE (island_player_id, day_number)` + only 1 row per day means a player can't be island player twice
- For opponents: we check via query (no DB constraint needed — validate before insert)

### 1c. No schema changes to `matches` or `groups`

Island matches are created as 2 regular `singles_match` rows (Decision #10). They get a `group_id` pointing to Group 3's group. No new match type. The only way to identify them as "island" matches is via the `island_player_assignments` table linking `match_a_id` / `match_b_id`.

---

## 2. Admin UI Workflow (2c — "Drawn Last" Rule)

The admin creates matches in this order for each day:
1. Create Group 1 (pairs match)
2. Create Group 2 (pairs match)
3. Create Group 3 regular singles matches first (the non-island ones)
4. **Last:** Assign island player + designate island opponents → system auto-creates 2 singles matches in Group 3

This satisfies Ben's "island matches draw last" rule — the opposing team doesn't know who the island player is until the admin finalizes the island assignment. Once saved, the island matches become visible.

**Admin UI addition:** New "Island Player" section on the Admin page (below match creation), visible only when groups for that day have been created. Shows:

```
Day 1 — Island Player Assignment
5-team (TBD after draft): [Select island player ▼]   Eligible: [list]
6-team: Opponent A [Select ▼]  Opponent B [Select ▼]  Eligible: [list]
[Assign Island Player]
```

The dropdowns only show eligible players:
- Island player: members of the 5-player team who haven't been island player yet
- Opponents: members of the 6-player team who haven't been an island opponent yet

After the admin clicks "Assign Island Player":
1. Validate no-repeat constraints (see section 4)
2. Insert row into `island_player_assignments`
3. Create 2 `singles_match` rows in the DB (Group 3, with `point_value = 1` for D1-D2 or `2` for D3)
4. Link `match_a_id` / `match_b_id` in the assignment
5. Show confirmation, reveal the matches on the Matches page

---

## 3. 2-on-1 Scoring (2d)

**Implementation:** 2 separate `singles_match` rows in the DB.

- Match A: island player (side A) vs opponent A (side B)
- Match B: island player (side A) vs opponent B (side B)

Each match uses the existing `singles_match` scoring logic (`calcMatchResult`, `updateMatchPoints`). The island player's net score is compared against each opponent independently.

**Playing handicap (PH) for island matches:** Island matches are treated as standard singles matches. The island player's PH is calculated 1-on-1 against each opponent separately (same as any singles match). No special 3-player PH calculation needed.

**Point values:**
- D1-D2 island matches: `point_value = 1` each (same as all singles on D1-D2)
- D3 island matches: `point_value = 2` each (same as all D3 matches)

This is correct per Decision #9 math:
- D1: 2 pairs × 2pts + 2 island results × 1pt = 6 ✓
- D3: 6 singles × 2pts = 12 ✓ (includes 2 island results × 2pts)

**Score entry:** The island player appears in Group 3 just like any other player. Scores are entered once; both island matches use the same gross score (already in the DB) to calculate net for each opponent comparison.

---

## 4. No-Repeat Enforcement (2f)

**Constraint 1 — Island player (5-team):** 3 of 5 players serve as island player, one per day. No player can be island player twice.
- Check: `SELECT COUNT(*) FROM island_player_assignments WHERE island_player_id = $id` must be 0

**Constraint 2 — Island opponents (6-team):** Each of the 6 players serves as island opponent exactly once across 3 days (2 opponents × 3 days = 6 slots for 6 players).
- Check: `SELECT opponent_a_id, opponent_b_id FROM island_player_assignments` — new opponents must not appear in any previous row's `opponent_a_id` or `opponent_b_id`

**UI enforcement:** Eligible player dropdowns show only valid selections. "Assign" button is disabled if constraints would be violated. Error message if somehow invalid input gets through.

---

## 5. Island Player Visibility (2e)

**Matches page:** Island matches get a subtle "ISLAND" badge in the match card (amber pill, same style as format badge). The island player's name gets a ⚡ or "×2" indicator showing they're playing two matches.

**Dashboard:** No special display needed — the team score already reflects all match points.

**Example match card:**
```
Group 3 · Singles
ISLAND ⚡
Eric    vs    Ben        [1 pt]
Eric    vs    Ryan       [1 pt]
```

---

## 6. Which Team Is the 5-Team vs 6-Team?

Per Decision #11: team sizes are draft-dependent. The admin must specify which team (USA/Europe) is the 5-player team when setting up island assignments. We add a simple `settings` row:

```sql
INSERT INTO settings (key, value) VALUES ('five_player_team', 'USA');
-- or 'Europe' — set by admin after Thursday night draft
```

The island player dropdown filters by this setting. The opponent dropdowns filter to the other team.

---

## 7. API Endpoints Needed

| Action | Implementation |
|--------|----------------|
| Get island assignments | `GET /api/island` — returns all 3 days' assignments |
| Get eligible players | Inline in admin component (query-time) |
| Create island assignment | `POST /api/island` — validates, inserts, creates matches |

Alternatively, implement as Next.js server actions (consistent with existing pattern in `data.ts`).

**Recommendation:** Server actions (no new API routes needed, consistent with codebase).

---

## 8. Implementation Order (after Eric approves this doc)

1. **Migration:** Run SQL from sections 1a and 1b in Supabase console
2. **2b point_value column:** Update existing matches with correct values
3. **Server actions:** `createIslandAssignment`, `getIslandAssignments`, `getEligibleIslandPlayers`
4. **Admin UI:** Island player section (2c + 2f)
5. **Match scoring:** Verify island matches use same `updateMatchPoints` path (2d — should just work)
6. **Matches page:** Add ISLAND badge (2e)
7. **Test:** Manual walkthrough in admin, verify scores flow correctly

---

## 9. Open Questions for Eric

1. **5-team setting:** After Thursday draft, which team ends up with 5? (USA or Europe.) This needs to be set in admin before Day 1. → Add a "5-Player Team" dropdown in admin settings.

2. **Island match display timing:** Should the island player/opponent names be visible on the Matches page immediately after assignment, or only after the round starts? Ben said "island matches draw last so the other team doesn't know who you're throwing out there" — but this may only apply to the live draw moment, not the app display. **My recommendation:** Show immediately after admin assigns (the draw moment is when the admin clicks "Assign Island Player" in front of both teams). ✅ or ❌?

3. **Group 3 composition:** Does Group 3 always contain the island matches + regular singles? Or is it possible for Group 3 to be all-regular singles on some days? → Per Ben's rules, every day has an island player, so Group 3 always has the island player pair.

4. **Playing handicap calculation for island matches:** PH is calculated 1-on-1 between island player and each opponent separately. Confirm this is correct. ✅ or ❌?

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `matches` table | New `point_value` column |
| New `island_player_assignments` table | Tracks who played island + opponents per day |
| `src/app/actions/island.ts` (new) | Server actions for island logic |
| `src/app/(app)/admin/AdminClient.tsx` | Island Player section |
| `src/app/(app)/matches/MatchesClient.tsx` | ISLAND badge |
| `public/sw.js` | No change needed |
| `engine.ts` / `handicap.ts` | No change needed |

**No changes to the scoring engine are required.** Island matches reuse existing `singles_match` logic entirely.
