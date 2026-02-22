# Island Player Implementation Brief

**Task:** Implement SPEC-phase2.md items 2c, 2d, 2e, 2f for the Degen Dudes golf app.
**Deadline:** Before Feb 26 golf trip.

## What to Build

### Step 1: SQL Migrations (run via Supabase MCP or document for manual execution)

**1a. Add `point_value` column to `matches` table:**
```sql
ALTER TABLE matches ADD COLUMN point_value INTEGER NOT NULL DEFAULT 1;
```

**Populate existing matches with correct point_value:**
```sql
-- Pairs formats = 2 pts
UPDATE matches SET point_value = 2
WHERE format IN ('best_ball_validation', 'best_ball', 'low_total');

-- Singles D3 = 2 pts
UPDATE matches SET point_value = 2
WHERE format IN ('singles_match', 'singles_stroke')
  AND id IN (
    SELECT m.id FROM matches m
    JOIN groups g ON g.id = m.group_id
    WHERE g.day_number = 3
  );
```

**1b. Create `island_player_assignments` table:**
```sql
CREATE TABLE island_player_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL CHECK (day_number IN (1, 2, 3)),
  island_player_id UUID NOT NULL REFERENCES players(id),
  opponent_a_id UUID NOT NULL REFERENCES players(id),
  opponent_b_id UUID NOT NULL REFERENCES players(id),
  match_a_id UUID REFERENCES matches(id),
  match_b_id UUID REFERENCES matches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_number),
  UNIQUE (island_player_id, day_number),
  CHECK (island_player_id != opponent_a_id),
  CHECK (island_player_id != opponent_b_id),
  CHECK (opponent_a_id != opponent_b_id)
);
```

**IMPORTANT: You cannot run SQL directly against Supabase. Write these migrations to a file `supabase/migrations/001_island_player.sql` so Eric can run them manually in the Supabase SQL Editor.**

### Step 2: Add `five_player_team` Setting

Insert into settings table (also add to migration SQL file):
```sql
INSERT INTO settings (key, value) VALUES ('five_player_team', 'USA')
ON CONFLICT (key) DO NOTHING;
```

### Step 3: Server Actions — `src/app/actions/island.ts`

Create a new server actions file with these functions:

**`getIslandAssignments()`** — Returns all island assignments with player names
**`getEligibleIslandPlayers(dayNumber, fivePlayerTeam)`** — Returns eligible island players (5-team members not yet assigned as island player)
**`getEligibleIslandOpponents(dayNumber, sixPlayerTeam)`** — Returns eligible opponents (6-team members not yet used as island opponents)
**`createIslandAssignment(dayNumber, islandPlayerId, opponentAId, opponentBId)`** — Validates no-repeat constraints, creates the assignment, creates 2 singles_match rows in the matches table linked to Group 3 for that day, updates the assignment with match_a_id and match_b_id. Point value: 1 for D1/D2, 2 for D3. Team labels: island player's team for side A, opponent's team for side B.
**`deleteIslandAssignment(assignmentId)`** — Deletes the assignment and its 2 associated matches (for admin corrections).

Pattern to follow: Look at existing server actions in `src/app/actions/data.ts` and `src/app/actions/scores.ts`. Use `createAdminClient()` from `@/lib/supabase/admin`.

**Key logic for createIslandAssignment:**
1. Validate island player hasn't been island player before: `SELECT COUNT(*) FROM island_player_assignments WHERE island_player_id = $id` must be 0
2. Validate opponents haven't been island opponents before: Check all existing assignments' opponent_a_id and opponent_b_id
3. Validate all 3 players are on correct teams (island player on 5-team, opponents on 6-team)
4. Find Group 3 for this day: `SELECT id FROM groups WHERE day_number = $day AND group_number = 3`
5. Determine point_value: day 3 = 2, else 1
6. Create 2 matches in the matches table (format: 'singles_match', each with the island player on side A and one opponent on side B)
7. For each match, create match_players entries
8. Insert the island_player_assignments row with match_a_id and match_b_id
9. Set team labels based on teams: island player's team label for team_a_label, opponents' team for team_b_label

### Step 4: Admin UI — Island Player Section in AdminClient.tsx

Add a new tab or section in the Admin page. Could be:
- A new tab "Island" in the tab bar, OR
- A section within the existing "matches" tab

**Recommended: Add "island" as a new tab** between "matches" and "tees".

The UI should show for each day (1, 2, 3):
- Current assignment (if exists) with player names
- If no assignment: dropdowns to select island player + 2 opponents
- Island player dropdown: shows only eligible 5-team players
- Opponent A/B dropdowns: shows only eligible 6-team players  
- "Assign Island Player" button
- Delete button on existing assignments (with confirmation)
- Show which team is the 5-player team (from settings)

**Color palette (match existing app):**
- Background: `#1A1A0A`
- Dark Teal: `#1A3A2A`  
- Border: `#2D4A1E`
- Olive: `#9A9A50`
- Burnt Orange: `#C17A2A` / `#E09030`
- Gold: `#D4A947`
- Cream: `#F5E6C3`

### Step 5: ISLAND Badge on Matches Page — MatchesClient.tsx

Modify the match cards to show an "ISLAND" badge for island matches.

To identify island matches: query `island_player_assignments` for match_a_id and match_b_id, then compare against match IDs on the current day.

**Implementation approach:**
1. Add a new server action `getIslandMatchIds(dayNumber)` that returns the set of match IDs that are island matches for that day
2. In MatchesClient, fetch island match IDs alongside regular match data
3. For any match whose ID is in the island set, show an amber "ISLAND ⚡" pill badge in the match header

**Badge style:** Amber pill similar to existing format badge:
```tsx
<span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#C17A2A', color: '#F5E6C3' }}>
  ISLAND ⚡
</span>
```

### Step 6: Update `getMatchesForDay` query

The existing query in data.ts doesn't include `point_value`. Add it to the select:
```typescript
.select(`
  id, group_id, match_number, format, team_a_label, team_b_label,
  team_a_points, team_b_points, status, point_value,
  match_players(player_id, side, players(name, team)),
  groups!inner(day_number, group_number)
`)
```

And add `point_value` to the Match interface in MatchesClient.tsx.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/001_island_player.sql` | CREATE — all SQL migrations |
| `src/app/actions/island.ts` | CREATE — island server actions |
| `src/app/(app)/admin/AdminClient.tsx` | MODIFY — add island tab |
| `src/app/(app)/matches/MatchesClient.tsx` | MODIFY — add ISLAND badge |
| `src/app/actions/data.ts` | MODIFY — add point_value to getMatchesForDay, add getIslandMatchIds |

## DO NOT Modify

- `src/lib/scoring/handicap.ts` — no changes needed
- `src/lib/scoring/engine.ts` — already has pointValue param from 2b
- `public/sw.js` — no changes needed

## Important Notes

- The `createMatch` function in `data.ts` already handles creating matches with match_players. You can either reuse it or create island matches directly in `island.ts`. Direct creation in island.ts is preferred since you need to set point_value and link match IDs back to the assignment.
- Group 3 must exist before creating island assignments. The admin creates groups first (existing flow), then assigns island player last.
- Playing handicap for island matches: calculated 1-on-1 per opponent separately. The group_players table already has playing_handicap per player. Island matches reuse existing singles_match scoring.
- The island player appears in Group 3's group_players already (via normal group creation). The island matches just add 2 more singles_match rows to that group.
- After creating island matches, `updateMatchPoints` in scores.ts will automatically handle scoring them correctly since they're standard singles_match format.

## Verification After Building

1. `cd ~/code/degen-dudes && npm run build` — must pass with no errors
2. Verify TypeScript types are correct
3. Do NOT run the test suite (tests are for scoring engine, not UI features)
