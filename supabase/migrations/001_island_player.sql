-- Island Player System Migrations
-- Run these in Supabase SQL Editor in order

-- 1a. Add point_value column to matches table
ALTER TABLE matches ADD COLUMN point_value INTEGER NOT NULL DEFAULT 1;

-- Populate existing matches with correct point_value
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

-- 1b. Create island_player_assignments table
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

-- 1c. Add five_player_team setting
INSERT INTO settings (key, value) VALUES ('five_player_team', 'USA')
ON CONFLICT (key) DO NOTHING;
