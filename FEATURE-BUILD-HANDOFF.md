# Degen Dudes — Feature Build Handoff
## Date: 2026-02-21, 8:15 PM MST
## Purpose: Build 3 new features before comprehensive scoring test suite

---

## CONTEXT

This is a mobile web app for a Ryder Cup-style golf trip (11 players, 3 days, 3 courses, Feb 26-Mar 2). Live at https://degen-dudes-golf.vercel.app. The app tracks scores, calculates net scores using USGA handicap formulas, and determines match results.

The app is fully functional. These 3 features are being added before a comprehensive automated testing session.

**Tech stack:** Next.js 15 App Router, TypeScript, Supabase (PostgreSQL + Realtime), Tailwind CSS, Vercel.
**Repo:** `~/code/degen-dudes/`
**App PIN:** 2626 (simple cookie auth, not Supabase Auth)
**Supabase project:** lnnlabbdffowjpaxvnsp

---

## THE 3 FEATURES TO BUILD

### Feature 1: Admin Page Lock (Eric + Ben only)

**What:** The `/admin` page should only be accessible to Eric and Ben. Other players can see and use all other pages, but admin (team assignment, group creation, match creation, settings) is restricted.

**Current state:** Admin page is accessible to anyone who's authenticated (PIN 2626). There's no per-user permission system.

**How to implement:**

The app already stores the player's name in `localStorage` as `degen_player_name` (set during onboarding). Use this to gate admin access.

1. In `~/code/degen-dudes/middleware.ts`, add a check: if the path starts with `/admin`, allow it through (the client-side component will handle the restriction — middleware can't read localStorage).

2. In `~/code/degen-dudes/src/app/(app)/admin/AdminClient.tsx`, add a check at the top of the component:
   ```tsx
   // At the top of AdminClient component:
   const [isAdmin, setIsAdmin] = useState(false)
   
   useEffect(() => {
     const name = localStorage.getItem('degen_player_name')
     const admins = ['Eric', 'Ben']
     setIsAdmin(admins.includes(name || ''))
   }, [])
   
   if (!isAdmin) {
     return (
       <div className="p-8 text-center">
         <h1 className="text-xl font-bold text-white mb-2">Admin Access Required</h1>
         <p style={{ color: '#9A9A50' }}>Only Eric and Ben can access admin settings.</p>
         <Link href="/" className="mt-4 inline-block" style={{ color: '#D4A947' }}>← Back to Dashboard</Link>
       </div>
     )
   }
   ```

3. Also hide the Admin link in the navigation for non-admin users. Check `~/code/degen-dudes/src/app/(app)/layout.tsx` for the nav — wrap the Admin link in a client component that checks localStorage.

**Important:** This is client-side only (localStorage). It's not real security — anyone could set localStorage manually. That's fine for this use case; it just prevents casual players from accidentally messing with settings.

**Color palette reference:**
- Background: `#1A1A0A`
- Gold: `#D4A947`
- Olive: `#9A9A50`
- Dark olive: `#5C5C2E`
- Dark teal: `#1A3A2A`
- Cream: `#F5E6C3`

---

### Feature 2: Stroke Indicator on Score Entry

**What:** When looking at a hole during score entry, each player's card should show how many strokes they receive on that hole. This already partially exists! Look at the score entry UI in `ScoreEntryClient.tsx` — it already shows small gold dots for CH strokes:

```tsx
{/* Stroke dots */}
{chStrokes > 0 && (
  <div className="flex gap-0.5 mr-2">
    {Array.from({ length: chStrokes }).map((_, i) => (
      <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: '#D4A947' }} />
    ))}
  </div>
)}
```

**What's needed beyond current:** Eric wants to be able to check ANY hole for ANY player's strokes before teeing off — not just during active scoring. The current score entry UI only shows strokes when you're on a specific hole in your group.

**Build a new component/page: Stroke Chart**

Create a new page at `/strokes` that shows a grid:
- Rows: all 11 players (or filtered by group)
- Columns: holes 1-18
- Cells: number of strokes that player gets on that hole (0, 1, 2, or 3)
- Color code: 0 strokes = empty/dim, 1 stroke = one gold dot, 2 strokes = two gold dots, 3 strokes = three gold dots

**Data sources:**
- Player tee assignments with course handicap: `player_tee_assignments` table (has `course_handicap` per player per course)
- Hole handicap ranks: `holes` table (has `handicap_rank` per hole per course)
- Stroke calculation: `calcStrokesOnHole(courseHandicap, holeHandicapRank)` from `~/code/degen-dudes/src/lib/scoring/handicap.ts`

**Page structure:**
1. Day selector (Day 1 / Day 2 / Day 3 tabs)
2. Optional group filter (show all players or filter by group)
3. Grid showing strokes per hole per player
4. Show player name + CH in the row header
5. Totals column: total strokes each player gets across 18 holes

**Navigation:** Add "Strokes" to the bottom nav bar. Icon suggestion: a small dot pattern or use 🎯.

**Layout file:** `~/code/degen-dudes/src/app/(app)/layout.tsx` has the bottom nav.

**Scoring formula reference (from handicap.ts):**
```
if CH >= 36: strokes = (CH-36 >= hole_rank) ? 3 : 2
elif CH >= 18: strokes = (CH-18 >= hole_rank) ? 2 : 1
else: strokes = (CH >= hole_rank) ? 1 : 0
```

**Key players with high CH values (get 2-3 strokes per hole):**
- Jauch: Day1 CH=42 (gets 3 strokes on ranks 1-6, 2 on 7-18)
- Chris: Day1 CH=35 (gets 2 strokes on ranks 1-17, 1 on rank 18)
- Gary: Day1 CH=26 (gets 2 strokes on ranks 1-8, 1 on 9-18)
- Ben: Day1 CH=22 (gets 2 strokes on ranks 1-4, 1 on 5-18)

---

### Feature 3: Live Scorecard Page (All Players, Hole-by-Hole)

**What:** A page where anyone can see every player's hole-by-hole scores, updated in real-time. Works mid-round (shows scores as they come in) and after the round (shows complete scorecards).

**Visual design (from Eric's screenshot reference):**
- Professional scorecard look
- Score indicators per hole based on gross score vs par:
  - **Eagle or better (≤ -2):** Gold circle around the score (double circle for eagle, like the screenshot)
  - **Birdie (-1):** Red/crimson circle around the score
  - **Par (0):** Plain score, no decoration
  - **Bogey (+1):** Purple/violet square around the score
  - **Double bogey+ (+2 or worse):** Orange/amber square around the score (double border like in screenshot)
- Small black dots in top-right corner of each cell showing strokes received on that hole (like the screenshot)
- Show BOTH gross score AND net (adjusted) score

**Existing page to reference/extend:** There's already a player scorecard at `/player/[name]/page.tsx` that shows individual hole-by-hole data. But it only shows ONE player at a time and uses color-coded text (not shapes around scores).

**Build approach — create a new page: `/scorecards`**

This should be a new page, not a modification of the existing player page. The existing player page is fine for drilling into one player; this new page shows ALL players at a glance.

**Page structure:**
1. **Day selector** — tabs for Day 1 / Day 2 / Day 3
2. **Group filter** — show all players or filter by group (optional, default all)
3. **For each player, show a compact scorecard row:**
   - Player name + team indicator (USA olive / Europe orange)
   - CH for that day
   - Holes 1-9 scores in a row (Front 9)
   - Front 9 total
   - Holes 10-18 scores in a row (Back 9) 
   - Back 9 total
   - 18-hole total (gross + net)
4. **Score cell design:**
   - Main number: gross score
   - Small subscript or second line: net score (if different from gross)
   - Shape indicator: circle for under par, square for over par (see above)
   - Stroke dots: small dots in corner showing strokes given
5. **Real-time updates:** Subscribe to Supabase `scores` table changes (like LeaderboardClient does)
6. **Scrollable:** The grid will be wide. Use horizontal scroll with sticky player name column.

**Color palette for score indicators:**
- Eagle circle: `#D4A947` (gold) — double border
- Birdie circle: `#DC2626` (red) — single border
- Par: no border, cream text `#F5E6C3`
- Bogey square: `#7C3AED` (purple) — single border (match screenshot)
- Double bogey+ square: `#E09030` (burnt orange) — double border (match screenshot)
- Stroke dots: black `#000` or very dark (match screenshot)

**Data needed (all available via existing server actions):**
- `getLeaderboardData()` — returns players, courses, holes, scores, settings
- From this data: calculate `calcStrokesOnHole(CH, handicap_rank)` for stroke dots
- Net score is already stored in the `scores` table as `net_score`

**Navigation:** Add "Scorecards" to the bottom nav. Icon suggestion: 📋 or a grid icon.

**Mobile considerations:**
- This is the widest page in the app (18 columns of scores + player name + totals)
- Make score cells compact (24-28px wide)
- Player name column should be sticky (position: sticky, left: 0)
- Use horizontal scroll for the rest
- Consider showing Front 9 and Back 9 as separate rows to reduce width

---

## CRITICAL FILES TO READ/MODIFY

| File | What | Modify? |
|------|------|---------|
| `~/code/degen-dudes/src/app/(app)/layout.tsx` | Bottom nav bar | YES — add Strokes + Scorecards links, conditionally show Admin |
| `~/code/degen-dudes/src/app/(app)/admin/AdminClient.tsx` | Admin UI | YES — add admin check |
| `~/code/degen-dudes/src/app/(app)/scores/ScoreEntryClient.tsx` | Score entry (reference for stroke dots) | READ ONLY |
| `~/code/degen-dudes/src/app/(app)/player/[name]/page.tsx` | Individual scorecard (reference) | READ ONLY |
| `~/code/degen-dudes/src/app/(app)/leaderboard/LeaderboardClient.tsx` | Realtime subscription pattern (reference) | READ ONLY |
| `~/code/degen-dudes/src/lib/scoring/handicap.ts` | calcStrokesOnHole, calcNetScore, calcCourseHandicap | READ ONLY |
| `~/code/degen-dudes/src/app/actions/data.ts` | All data fetching server actions | MAY NEED — if new queries needed |
| `~/code/degen-dudes/middleware.ts` | Auth middleware | MAYBE — if admin route needs special handling |

**New files to create:**
- `~/code/degen-dudes/src/app/(app)/strokes/page.tsx` — Stroke chart page
- `~/code/degen-dudes/src/app/(app)/strokes/StrokesClient.tsx` — Client component for stroke chart
- `~/code/degen-dudes/src/app/(app)/scorecards/page.tsx` — Live scorecards page  
- `~/code/degen-dudes/src/app/(app)/scorecards/ScorecardsClient.tsx` — Client component with realtime

---

## SUPABASE DATA REFERENCE

### Course IDs
| Course | Day | ID |
|--------|-----|----|
| Terra Lago North | 1 | `9333b881-441e-43f0-9aa8-efe8f9dcd203` |
| PGA West Mountain | 2 | `fb74b2c0-b9df-4926-8867-13d83a2cdf7f` |
| Eagle Falls | 3 | `6a96b6d2-9271-4191-ba6c-da0232a9ca46` |

### Player IDs
| Name | ID | HI |
|------|----|----|
| Ryan | `06559478-aa82-4a0d-aa26-d239ae8414f4` | 8.9 |
| Kiki | `2377121e-5093-4250-9459-9cec514d9ff4` | 9.3 |
| Mack | `c407edd3-591f-4faf-afed-c6e156698b33` | 10.0 |
| Bruce | `8ba6e2af-35d9-42bb-9750-f35fcbb9746c` | 10.6 |
| Matthew | `57a4fdd1-6cac-4264-ad8d-809aef763ee1` | 11.0 |
| C-Pat | `5ac3e47e-68d3-4a66-a6ae-47376bdd9faf` | 11.5 |
| Eric | `989f9143-2f6b-4060-8875-20feb87ead55` | 13.5 |
| Ben | `e2fc862d-3f4b-49f7-ac6f-97abecaad00e` | 19.0 |
| Gary | `e0928ef5-83fe-440c-8a1c-76704f4886af` | 22.1 |
| Chris | `6e49119a-2050-4e50-be46-42c2e89451b8` | 30.0 |
| Jauch | `2dcc566e-b465-431b-90a1-0f9791de614e` | 36.0 |

### Course Handicaps (from Supabase — verified correct)

**Day 1: Terra Lago North (Par 72)**
| Player | Tee | Rating/Slope | CH |
|--------|-----|-------------|-----|
| Ryan | Black | 74.7/139 | 14 |
| Kiki | Yellow | 71.9/132 | 11 |
| Mack | Yellow | 71.9/132 | 12 |
| Bruce | Black | 74.7/139 | 16 |
| Matthew | Black | 74.7/139 | 16 |
| C-Pat | Black | 74.7/139 | 17 |
| Eric | Yellow | 71.9/132 | 16 |
| Ben | Yellow | 71.9/132 | 22 |
| Gary | Yellow | 71.9/132 | 26 |
| Chris | Yellow | 71.9/132 | 35 |
| Jauch | Yellow | 71.9/132 | 42 |

**Day 2: PGA West Mountain (Par 72)**
| Player | Tee | Rating/Slope | CH |
|--------|-----|-------------|-----|
| Ryan | Black | 72.8/135 | 11 |
| Kiki | Silver | 68.3/122 | 6 |
| Mack | Black/White | 71.8/132 | 11 |
| Bruce | Black/White | 71.8/132 | 12 |
| Matthew | Black | 72.8/135 | 14 |
| C-Pat | Silver | 68.3/122 | 9 |
| Eric | White | 70.8/129 | 14 |
| Ben | White | 70.8/129 | 20 |
| Gary | Silver | 68.3/122 | 20 |
| Chris | White | 70.8/129 | 33 |
| Jauch | Silver | 68.3/122 | 35 |

**Day 3: Eagle Falls (Par 72) — All Hawk tee (70.0/127)**
| Player | CH |
|--------|----|
| Ryan | 8 |
| Kiki | 8 |
| Mack | 9 |
| Bruce | 10 |
| Matthew | 10 |
| C-Pat | 11 |
| Eric | 13 |
| Ben | 19 |
| Gary | 23 |
| Chris | 32 |
| Jauch | 38 |

### Hole Data (from Supabase)

**Day 1: Terra Lago North** (course `9333b881`)
| Hole | Par | HDCP Rank |
|------|-----|-----------|
| 1 | 4 | 9 |
| 2 | 4 | 15 |
| 3 | 3 | 17 |
| 4 | 5 | 7 |
| 5 | 4 | 1 |
| 6 | 4 | 11 |
| 7 | 3 | 13 |
| 8 | 5 | 5 |
| 9 | 4 | 3 |
| 10 | 4 | 10 |
| 11 | 4 | 16 |
| 12 | 3 | 18 |
| 13 | 5 | 8 |
| 14 | 4 | 2 |
| 15 | 4 | 12 |
| 16 | 3 | 14 |
| 17 | 5 | 6 |
| 18 | 4 | 4 |

**Day 2: PGA West Mountain** (course `fb74b2c0`)
| Hole | Par | HDCP Rank |
|------|-----|-----------|
| 1 | 4 | 9 |
| 2 | 5 | 5 |
| 3 | 4 | 13 |
| 4 | 3 | 17 |
| 5 | 4 | 3 |
| 6 | 4 | 11 |
| 7 | 5 | 1 |
| 8 | 3 | 15 |
| 9 | 4 | 7 |
| 10 | 4 | 10 |
| 11 | 4 | 14 |
| 12 | 3 | 18 |
| 13 | 5 | 6 |
| 14 | 4 | 2 |
| 15 | 4 | 12 |
| 16 | 3 | 16 |
| 17 | 5 | 4 |
| 18 | 4 | 8 |

**Day 3: Eagle Falls** (course `6a96b6d2`)
| Hole | Par | HDCP Rank |
|------|-----|-----------|
| 1 | 4 | 7 |
| 2 | 5 | 3 |
| 3 | 3 | 15 |
| 4 | 4 | 11 |
| 5 | 4 | 1 |
| 6 | 3 | 17 |
| 7 | 5 | 5 |
| 8 | 4 | 9 |
| 9 | 4 | 13 |
| 10 | 4 | 8 |
| 11 | 4 | 4 |
| 12 | 3 | 18 |
| 13 | 5 | 2 |
| 14 | 4 | 10 |
| 15 | 4 | 6 |
| 16 | 3 | 16 |
| 17 | 5 | 12 |
| 18 | 4 | 14 |

---

## DESIGN SYSTEM REFERENCE

### Colors (from existing app)
```
Background:     #1A1A0A
Dark Teal:      #1A3A2A
Border:         #2D4A1E
Olive (USA):    #5C5C2E / #7A7A3D / #9A9A50
Burnt Orange:   #C17A2A / #E09030 / #8B5A1A
Gold:           #D4A947
Cream:          #F5E6C3
Red:            #DC2626 (birdie)
Deep Red:       #8B1A1A
```

### Score Color Logic (from existing player page)
```tsx
const scoreColor = (gross: number, par: number) => {
  const diff = gross - par
  if (diff <= -2) return '#D4A947'  // eagle = gold
  if (diff === -1) return '#DC2626' // birdie = red
  if (diff === 0) return '#F5E6C3'  // par = cream
  if (diff === 1) return '#9A9A50'  // bogey = olive
  return '#5C5C2E'                  // double+ = dark olive
}
```

### New Score Shape Indicators (for Feature 3 scorecard)
These are IN ADDITION to color — circles and squares around the score number:
- Eagle: gold double circle border
- Birdie: red single circle border  
- Par: no border
- Bogey: purple single square border (`#7C3AED`)
- Double bogey+: orange double square border (`#E09030`)

### Navigation Pattern
Bottom nav uses fixed tabs. Current items: Dashboard, Scores, Leaderboard, Matches, Admin.
Adding: Strokes, Scorecards.

With 7 items, the nav might get crowded on small phones. Consider either:
- A "More" overflow menu for less-used items
- Making Scorecards a sub-section of Leaderboard (tab within the page)
- Keeping Strokes within the score entry flow rather than as its own nav item

**Recommendation:** Add Scorecards as a top-level nav item (it'll be used constantly). Make Strokes accessible from within the score entry page (a "View Strokes" button at the top) AND as a standalone page. Keep nav to 6 items max: Dashboard, Scores, Scorecards, Leaderboard, Matches, Admin.

---

## BUILD ORDER

1. **Feature 1 (Admin lock)** — smallest, ~15 min
2. **Feature 2 (Stroke chart)** — medium, ~30 min  
3. **Feature 3 (Live scorecards)** — largest, ~45-60 min

Each feature should be committed separately. Push to main after each — Vercel auto-deploys.

---

## TESTING AFTER BUILD

After building, do a quick manual check:
1. Open https://degen-dudes-golf.vercel.app in a browser
2. Set localStorage `degen_player_name` to "Gary" — verify admin page shows access denied
3. Set it to "Eric" — verify admin works
4. Check /strokes — verify stroke dots match expected CH values (Jauch Day1: 3 dots on first 6 hardest holes, 2 on rest)
5. Check /scorecards — verify it loads (no scores in DB right now, so it should show dashes)

**Do NOT enter test scores.** The comprehensive test suite (being built separately) will handle that.

---

## GIT WORKFLOW

```bash
cd ~/code/degen-dudes
git checkout main
git pull
# ... make changes ...
git add -A
git commit -m "feat: admin page lock for Eric and Ben"
git push
# Wait ~60s for Vercel deploy, verify at https://degen-dudes-golf.vercel.app
```

---

## HANDOFF PROMPT

Paste this into a new session:

```
Read this file first: ~/code/degen-dudes/FEATURE-BUILD-HANDOFF.md

This is the Degen Dudes golf app — a mobile web app for Eric's golf trip. The handoff file contains EVERYTHING you need: full specs for 3 features to build, all data references, color palette, file locations, and build order.

Quick summary of the 3 features:
1. Admin page lock (Eric + Ben only) — client-side localStorage check
2. Stroke chart page — shows how many strokes each player gets on each hole
3. Live scorecard page — all players hole-by-hole with birdie circles, bogey squares, real-time updates

Build them in order. Commit and push each one separately. Do NOT enter any test scores into the database.

Use Sonnet 4.6. Thinking off.
```
