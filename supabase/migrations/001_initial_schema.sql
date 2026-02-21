-- ============================================================================
-- Migration 001: Initial Schema
-- Degen Dudes Ryder Cup Scoring App
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- Settings (key-value store for app config)
-- ============================================================================
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- ============================================================================
-- Players
-- ============================================================================
create table players (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  handicap_index decimal(4,1) not null,
  team text check (team in ('USA', 'Europe')) default null,
  display_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================================
-- Courses (one per day)
-- ============================================================================
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  day_number int not null check (day_number in (1, 2, 3)),
  par_total int not null default 72,
  created_at timestamptz default now(),
  unique(day_number)
);

-- ============================================================================
-- Tee sets (multiple per course)
-- ============================================================================
create table tees (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  rating decimal(4,1) not null,
  slope int not null,
  created_at timestamptz default now(),
  unique(course_id, name)
);

-- ============================================================================
-- Holes (18 per course)
-- ============================================================================
create table holes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par in (3, 4, 5)),
  handicap_rank int not null check (handicap_rank between 1 and 18),
  created_at timestamptz default now(),
  unique(course_id, hole_number)
);

-- ============================================================================
-- Yardages per hole per tee
-- ============================================================================
create table hole_yardages (
  id uuid primary key default uuid_generate_v4(),
  hole_id uuid not null references holes(id) on delete cascade,
  tee_id uuid not null references tees(id) on delete cascade,
  yardage int,
  unique(hole_id, tee_id)
);

-- ============================================================================
-- Player tee assignments per course (with pre-computed course handicap)
-- ============================================================================
create table player_tee_assignments (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references players(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  tee_id uuid not null references tees(id) on delete cascade,
  course_handicap int not null,
  unique(player_id, course_id)
);

-- ============================================================================
-- Groups (per day, 3 groups of 3-4 players)
-- ============================================================================
create table groups (
  id uuid primary key default uuid_generate_v4(),
  day_number int not null check (day_number in (1, 2, 3)),
  group_number int not null check (group_number in (1, 2, 3)),
  format text not null check (format in (
    'best_ball_validation',
    'best_ball',
    'low_total',
    'singles_match',
    'singles_stroke'
  )),
  created_at timestamptz default now(),
  unique(day_number, group_number)
);

-- ============================================================================
-- Players in each group (with pre-computed playing handicap)
-- ============================================================================
create table group_players (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  playing_handicap int not null default 0,
  unique(group_id, player_id)
);

-- ============================================================================
-- Matches within groups
-- ============================================================================
create table matches (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  match_number int not null,
  format text not null check (format in (
    'best_ball_validation',
    'best_ball',
    'low_total',
    'singles_match',
    'singles_stroke'
  )),
  team_a_label text,
  team_b_label text,
  team_a_points decimal(4,1) default 0,
  team_b_points decimal(4,1) default 0,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete')),
  created_at timestamptz default now(),
  unique(group_id, match_number)
);

-- ============================================================================
-- Players on each side of a match
-- ============================================================================
create table match_players (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  unique(match_id, player_id)
);

-- ============================================================================
-- Scores (one row per player per hole per day)
-- ============================================================================
create table scores (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references players(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  gross_score int not null check (gross_score > 0),
  net_score int,          -- CH-based net (for individual leaderboard)
  ph_score int,           -- PH-based net (for match play)
  ch_strokes int not null default 0,  -- strokes from course handicap
  ph_strokes int not null default 0,  -- strokes from playing handicap
  entered_by text,        -- player name who entered this score
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(player_id, course_id, hole_number)
);

-- ============================================================================
-- Score history (audit trail for undo)
-- ============================================================================
create table score_history (
  id uuid primary key default uuid_generate_v4(),
  score_id uuid not null references scores(id) on delete cascade,
  previous_gross int not null,
  new_gross int not null,
  changed_by text,
  changed_at timestamptz default now()
);

-- ============================================================================
-- Indexes for common queries
-- ============================================================================
create index idx_scores_player_course on scores(player_id, course_id);
create index idx_scores_course_hole on scores(course_id, hole_number);
create index idx_group_players_group on group_players(group_id);
create index idx_match_players_match on match_players(match_id);
create index idx_holes_course on holes(course_id);
create index idx_hole_yardages_hole on hole_yardages(hole_id);

-- ============================================================================
-- Updated_at trigger for scores
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger scores_updated_at
  before update on scores
  for each row execute function update_updated_at();
