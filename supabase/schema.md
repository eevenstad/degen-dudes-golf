# Degen Dudes Database Schema

## Overview

The database stores all data for the Degen Dudes Ryder Cup golf scoring app: players, courses, groups, matches, and hole-by-hole scores across a 3-day tournament.

---

## Tables

### `settings`
Key-value store for app configuration (PIN, event name, scoring rules).

### `players`
The 11 tournament participants. Each has a USGA handicap index and optional team assignment (USA/Europe, set during the draft).

### `courses`
One course per day (3 total). Each has a par total (default 72).

### `tees`
Multiple tee sets per course (e.g., Black, White, Yellow). Each has a USGA course rating and slope rating.

### `holes`
18 holes per course (54 total). Each hole has a par (3/4/5) and a handicap rank (1-18, where 1 = hardest).

### `hole_yardages`
Yardage for each hole from each tee set. Optional — populated if/when yardage data is available.

### `player_tee_assignments`
Which tee set each player plays from on each course, plus their pre-computed **course handicap** (CH).

**Course Handicap Formula:**
```
CH = ROUND(handicap_index × (slope / 113) + (rating - par))
```

### `groups`
3 groups per day (9 total across the tournament). Each group has a format (best_ball, singles_match, etc.).

### `group_players`
Players assigned to each group, with their **playing handicap** (PH) for that group's format. PH is derived from CH but adjusted based on the match format (e.g., relative to lowest CH in the group).

### `matches`
Individual matches within a group. A group may have 1 match (team format) or multiple (singles). Tracks points for each side and match status.

### `match_players`
Which players are on side "a" or side "b" of each match.

### `scores`
One row per player per hole per course. The core scoring table.

| Field | Purpose |
|-------|---------|
| `gross_score` | Actual strokes taken |
| `net_score` | Gross minus CH strokes (for individual leaderboard) |
| `ph_score` | Gross minus PH strokes (for match play) |
| `ch_strokes` | How many CH strokes apply on this hole (0 or 1, sometimes 2) |
| `ph_strokes` | How many PH strokes apply on this hole (0 or 1, sometimes 2) |
| `entered_by` | Player name who entered the score (for accountability) |

### `score_history`
Audit trail for score edits. Every time a score is updated, the old and new gross values are logged.

---

## Key Relationships

```
courses ──< tees
courses ──< holes
holes   ──< hole_yardages >── tees

players ──< player_tee_assignments >── courses, tees
players ──< group_players >── groups
players ──< match_players >── matches
players ──< scores >── courses

groups  ──< group_players
groups  ──< matches ──< match_players

scores  ──< score_history
```

---

## Scoring Data Flow

1. **Score Entry:** User enters a gross score for a player on a hole
2. **Stroke Calculation:** App looks up the player's CH and PH, computes how many strokes they get on that hole (based on handicap_rank)
3. **Net Scores:** `net_score = gross_score - ch_strokes` and `ph_score = gross_score - ph_strokes`
4. **Match Points:** App compares PH-adjusted scores between sides within each match to determine hole winners and match points
5. **Team Points:** Sum of all match points across the day feeds into the team scoreboard (USA vs Europe)

### Stroke Distribution
A player with CH = 16 gets 1 stroke on the 16 hardest holes (handicap_rank 1-16). A player with CH = 20 gets 1 stroke on all 18 holes plus an extra stroke on the 2 hardest (handicap_rank 1-2).

### Net Max Over Par
The `net_max_over_par` setting (default: 3) caps the worst net score at par + 3 for leaderboard purposes, preventing blowup holes from distorting totals.

---

## Row Level Security (RLS)

| Operation | Who | How |
|-----------|-----|-----|
| **Read all tables** | Any authenticated user | RLS policy: `auth.role() = 'authenticated'` |
| **Insert/update scores** | Any authenticated user | RLS policy on scores table |
| **Insert score_history** | Any authenticated user | RLS policy on score_history |
| **All other writes** | Admin only | Uses Supabase service role key (bypasses RLS) |

This keeps the app simple: all players can see everything and enter scores, but only admin operations (run via service role key) can modify players, groups, courses, etc.

---

## Running Migrations & Seed Data

### Prerequisites
```bash
# Install Supabase CLI (if not installed)
brew install supabase/tap/supabase

# Link to your project (run once)
supabase link --project-ref YOUR_PROJECT_REF
```

### Apply Migrations
```bash
# Push all migrations to your Supabase database
supabase db push
```

### Load Seed Data
```bash
# Option 1: Via Supabase CLI
supabase db reset --db-url postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres

# Option 2: Paste seed.sql directly in the Supabase SQL editor (easier for first time)
# Go to: https://supabase.com/dashboard → SQL Editor → paste contents of seed.sql → Run
```

### Verify
After seeding, check the data in Supabase Table Editor:
- 5 settings rows
- 11 players
- 3 courses
- 12 tee sets (4 + 5 + 3)
- 54 holes (18 × 3)
- 33 player_tee_assignments (11 × 3)

---

## File Structure
```
supabase/
  migrations/
    001_initial_schema.sql   ← All tables, indexes, triggers
    002_rls_policies.sql     ← Row Level Security policies
  seed.sql                   ← All reference data (settings, players, courses, holes, tee assignments)
  schema.md                  ← This file
```
