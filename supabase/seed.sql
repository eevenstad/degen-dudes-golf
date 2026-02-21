-- ============================================================================
-- Seed Data: Degen Dudes Ryder Cup 2026
-- ============================================================================
-- This file populates all reference data for the tournament.
-- Run AFTER migrations. Uses CTEs for foreign key resolution.
-- ============================================================================

-- ============================================================================
-- 1. Settings
-- ============================================================================
insert into settings (key, value) values
  ('net_max_over_par', '3'),
  ('draft_complete', 'false'),
  ('app_pin', '2626'),
  ('event_name', 'Degen Dudes Ryder Cup 2026'),
  ('event_year', '2026');

-- ============================================================================
-- 2. Players (11 total)
-- ============================================================================
insert into players (name, handicap_index, display_order) values
  ('Ryan', 8.9, 1),
  ('Kiki', 9.3, 2),
  ('Mack', 10.0, 3),
  ('Bruce', 10.6, 4),
  ('Matthew', 11.0, 5),
  ('C-Pat', 11.5, 6),
  ('Eric', 13.5, 7),
  ('Ben', 19.0, 8),
  ('Gary', 22.1, 9),
  ('Chris', 30.0, 10),
  ('Jauch', 36.0, 11);

-- ============================================================================
-- 3. Courses (3 — one per day)
-- ============================================================================
insert into courses (name, day_number, par_total) values
  ('Terra Lago North', 1, 72),
  ('PGA West Mountain', 2, 72),
  ('Eagle Falls', 3, 72);

-- ============================================================================
-- 4. Tees
-- ============================================================================

-- Terra Lago North tees (Day 1)
insert into tees (course_id, name, rating, slope)
select c.id, t.name, t.rating, t.slope
from courses c
cross join (values
  ('Black',        74.7, 139),
  ('Yellow',       71.9, 132),
  ('Yellow/White', 70.6, 129),
  ('White',        69.1, 125)
) as t(name, rating, slope)
where c.day_number = 1;

-- PGA West Mountain tees (Day 2)
insert into tees (course_id, name, rating, slope)
select c.id, t.name, t.rating, t.slope
from courses c
cross join (values
  ('Black',        72.8, 135),
  ('Black/White',  71.8, 132),
  ('White',        70.8, 129),
  ('White/Silver', 70.0, 126),
  ('Silver',       68.3, 122)
) as t(name, rating, slope)
where c.day_number = 2;

-- Eagle Falls tees (Day 3)
insert into tees (course_id, name, rating, slope)
select c.id, t.name, t.rating, t.slope
from courses c
cross join (values
  ('Eagle',  72.8, 133),
  ('Hawk',   70.0, 127),
  ('Falcon', 68.1, 120)
) as t(name, rating, slope)
where c.day_number = 3;

-- ============================================================================
-- 5. Holes (54 total — 18 per course)
-- ============================================================================

-- Terra Lago North holes (Day 1)
insert into holes (course_id, hole_number, par, handicap_rank)
select c.id, h.hole_number, h.par, h.handicap_rank
from courses c
cross join (values
  ( 1, 4,  9), ( 2, 4, 15), ( 3, 3, 17), ( 4, 5,  7), ( 5, 4,  1), ( 6, 4, 11),
  ( 7, 3, 13), ( 8, 5,  5), ( 9, 4,  3), (10, 4, 10), (11, 4, 16), (12, 3, 18),
  (13, 5,  8), (14, 4,  2), (15, 4, 12), (16, 3, 14), (17, 5,  6), (18, 4,  4)
) as h(hole_number, par, handicap_rank)
where c.day_number = 1;

-- PGA West Mountain holes (Day 2)
insert into holes (course_id, hole_number, par, handicap_rank)
select c.id, h.hole_number, h.par, h.handicap_rank
from courses c
cross join (values
  ( 1, 4,  9), ( 2, 5,  5), ( 3, 4, 13), ( 4, 3, 17), ( 5, 4,  3), ( 6, 4, 11),
  ( 7, 5,  1), ( 8, 3, 15), ( 9, 4,  7), (10, 4, 10), (11, 4, 14), (12, 3, 18),
  (13, 5,  6), (14, 4,  2), (15, 4, 12), (16, 3, 16), (17, 5,  4), (18, 4,  8)
) as h(hole_number, par, handicap_rank)
where c.day_number = 2;

-- Eagle Falls holes (Day 3)
insert into holes (course_id, hole_number, par, handicap_rank)
select c.id, h.hole_number, h.par, h.handicap_rank
from courses c
cross join (values
  ( 1, 4,  7), ( 2, 5,  3), ( 3, 3, 15), ( 4, 4, 11), ( 5, 4,  1), ( 6, 3, 17),
  ( 7, 5,  5), ( 8, 4,  9), ( 9, 4, 13), (10, 4,  8), (11, 4,  4), (12, 3, 18),
  (13, 5,  2), (14, 4, 10), (15, 4,  6), (16, 3, 16), (17, 5, 12), (18, 4, 14)
) as h(hole_number, par, handicap_rank)
where c.day_number = 3;

-- ============================================================================
-- 6. Player Tee Assignments with Pre-Computed Course Handicaps
-- ============================================================================
-- Formula: CH = ROUND(handicap_index * (slope / 113.0) + (rating - par))
-- par = 72 for all courses
--
-- Day 1 — Terra Lago North:
--   Ryan    (8.9)  → Black  (74.7/139): ROUND(8.9 * 1.23009 + 2.7) = 14
--   Kiki    (9.3)  → Yellow (71.9/132): ROUND(9.3 * 1.16814 - 0.1) = 11
--   Mack   (10.0)  → Yellow (71.9/132): ROUND(10.0 * 1.16814 - 0.1) = 12
--   Bruce  (10.6)  → Black  (74.7/139): ROUND(10.6 * 1.23009 + 2.7) = 16
--   Matthew(11.0)  → Black  (74.7/139): ROUND(11.0 * 1.23009 + 2.7) = 16
--   C-Pat  (11.5)  → Black  (74.7/139): ROUND(11.5 * 1.23009 + 2.7) = 17
--   Eric   (13.5)  → Yellow (71.9/132): ROUND(13.5 * 1.16814 - 0.1) = 16
--   Ben    (19.0)  → Yellow (71.9/132): ROUND(19.0 * 1.16814 - 0.1) = 22
--   Gary   (22.1)  → Yellow (71.9/132): ROUND(22.1 * 1.16814 - 0.1) = 26
--   Chris  (30.0)  → Yellow (71.9/132): ROUND(30.0 * 1.16814 - 0.1) = 35
--   Jauch  (36.0)  → Yellow (71.9/132): ROUND(36.0 * 1.16814 - 0.1) = 42
--
-- Day 2 — PGA West Mountain:
--   Ryan    (8.9)  → Black      (72.8/135): ROUND(8.9 * 1.19469 + 0.8) = 11
--   Kiki    (9.3)  → Silver     (68.3/122): ROUND(9.3 * 1.07965 - 3.7) = 6
--   Mack   (10.0)  → Black/White(71.8/132): ROUND(10.0 * 1.16814 - 0.2) = 11
--   Bruce  (10.6)  → Black/White(71.8/132): ROUND(10.6 * 1.16814 - 0.2) = 12
--   Matthew(11.0)  → Black      (72.8/135): ROUND(11.0 * 1.19469 + 0.8) = 14
--   C-Pat  (11.5)  → Silver     (68.3/122): ROUND(11.5 * 1.07965 - 3.7) = 9
--   Eric   (13.5)  → White      (70.8/129): ROUND(13.5 * 1.14159 - 1.2) = 14
--   Ben    (19.0)  → White      (70.8/129): ROUND(19.0 * 1.14159 - 1.2) = 20
--   Gary   (22.1)  → Silver     (68.3/122): ROUND(22.1 * 1.07965 - 3.7) = 20
--   Chris  (30.0)  → White      (70.8/129): ROUND(30.0 * 1.14159 - 1.2) = 33
--   Jauch  (36.0)  → Silver     (68.3/122): ROUND(36.0 * 1.07965 - 3.7) = 35
--
-- Day 3 — Eagle Falls (all Hawk 70.0/127):
--   Ryan    (8.9):  ROUND(8.9  * 1.12389 - 2.0) = 8
--   Kiki    (9.3):  ROUND(9.3  * 1.12389 - 2.0) = 8
--   Mack   (10.0):  ROUND(10.0 * 1.12389 - 2.0) = 9
--   Bruce  (10.6):  ROUND(10.6 * 1.12389 - 2.0) = 10
--   Matthew(11.0):  ROUND(11.0 * 1.12389 - 2.0) = 10
--   C-Pat  (11.5):  ROUND(11.5 * 1.12389 - 2.0) = 11
--   Eric   (13.5):  ROUND(13.5 * 1.12389 - 2.0) = 13
--   Ben    (19.0):  ROUND(19.0 * 1.12389 - 2.0) = 19
--   Gary   (22.1):  ROUND(22.1 * 1.12389 - 2.0) = 23
--   Chris  (30.0):  ROUND(30.0 * 1.12389 - 2.0) = 32
--   Jauch  (36.0):  ROUND(36.0 * 1.12389 - 2.0) = 38

-- Day 1 — Terra Lago North
insert into player_tee_assignments (player_id, course_id, tee_id, course_handicap)
select p.id, c.id, t.id, a.ch
from (values
  ('Ryan',    'Black',  14),
  ('Kiki',    'Yellow', 11),
  ('Mack',    'Yellow', 12),
  ('Bruce',   'Black',  16),
  ('Matthew', 'Black',  16),
  ('C-Pat',   'Black',  17),
  ('Eric',    'Yellow', 16),
  ('Ben',     'Yellow', 22),
  ('Gary',    'Yellow', 26),
  ('Chris',   'Yellow', 35),
  ('Jauch',   'Yellow', 42)
) as a(player_name, tee_name, ch)
join players p on p.name = a.player_name
join courses c on c.day_number = 1
join tees t on t.course_id = c.id and t.name = a.tee_name;

-- Day 2 — PGA West Mountain
insert into player_tee_assignments (player_id, course_id, tee_id, course_handicap)
select p.id, c.id, t.id, a.ch
from (values
  ('Ryan',    'Black',       11),
  ('Kiki',    'Silver',       6),
  ('Mack',    'Black/White', 11),
  ('Bruce',   'Black/White', 12),
  ('Matthew', 'Black',       14),
  ('C-Pat',   'Silver',       9),
  ('Eric',    'White',       14),
  ('Ben',     'White',       20),
  ('Gary',    'Silver',      20),
  ('Chris',   'White',       33),
  ('Jauch',   'Silver',      35)
) as a(player_name, tee_name, ch)
join players p on p.name = a.player_name
join courses c on c.day_number = 2
join tees t on t.course_id = c.id and t.name = a.tee_name;

-- Day 3 — Eagle Falls (all Hawk)
insert into player_tee_assignments (player_id, course_id, tee_id, course_handicap)
select p.id, c.id, t.id, a.ch
from (values
  ('Ryan',     8),
  ('Kiki',     8),
  ('Mack',     9),
  ('Bruce',   10),
  ('Matthew', 10),
  ('C-Pat',   11),
  ('Eric',    13),
  ('Ben',     19),
  ('Gary',    23),
  ('Chris',   32),
  ('Jauch',   38)
) as a(player_name, ch)
join players p on p.name = a.player_name
join courses c on c.day_number = 3
join tees t on t.course_id = c.id and t.name = 'Hawk';
