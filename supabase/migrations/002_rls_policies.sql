-- ============================================================================
-- Migration 002: Row Level Security Policies
-- Degen Dudes Ryder Cup Scoring App
-- ============================================================================

-- Enable Row Level Security on all tables
alter table settings enable row level security;
alter table players enable row level security;
alter table courses enable row level security;
alter table tees enable row level security;
alter table holes enable row level security;
alter table hole_yardages enable row level security;
alter table player_tee_assignments enable row level security;
alter table groups enable row level security;
alter table group_players enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table scores enable row level security;
alter table score_history enable row level security;

-- ============================================================================
-- READ: anyone authenticated can read all data
-- ============================================================================
create policy "Allow authenticated read" on settings for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on players for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on courses for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on tees for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on holes for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on hole_yardages for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on player_tee_assignments for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on groups for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on group_players for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on matches for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on match_players for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on scores for select using (auth.role() = 'authenticated');
create policy "Allow authenticated read" on score_history for select using (auth.role() = 'authenticated');

-- ============================================================================
-- WRITE: anyone authenticated can insert/update scores
-- ============================================================================
create policy "Allow authenticated score insert" on scores for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated score update" on scores for update using (auth.role() = 'authenticated');
create policy "Allow authenticated history insert" on score_history for insert with check (auth.role() = 'authenticated');

-- NOTE: All other writes (players, groups, settings, etc.) go through the service role key
-- (used by admin pages and seed scripts). This is intentional.
