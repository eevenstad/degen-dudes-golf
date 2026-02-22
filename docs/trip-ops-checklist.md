# Desert Duel 2026 — Trip Operations Checklist

**Purpose:** Step-by-step guide for setting up the app each day so scoring works correctly. Check this before each round.

**App:** https://www.thedegendudes.com | **PIN:** 2626  
**Admin access:** Tap "2026" in "Palm Springs 2026" on the home screen (secret link, no PIN)

---

## Thursday Night — Draft Night

After teams are drafted and you know who's on each team:

- [ ] **Set the 5-player team** in Admin settings — go to Admin → Settings, set "5-Player Team" to USA or Europe (whichever ends up with 5 players after the draft)
- [ ] **Verify all 11 players are in the app** — Admin → Players. Everyone should already be there from setup.
- [ ] **Confirm team assignments** — Admin → Teams. Make sure each player is correctly on USA or Europe.

> **Island player rule reminder:** The 5-player team will designate their island player each day. No player can be island player twice. The 6-player team's opponents also can't repeat — each of their 6 players goes once.

---

## Day 1 — Friday (Before the Round)

**Format:** 2 pairs matches (Groups 1-2) + singles with island player (Group 3)

- [ ] **Create groups in Admin:**
  - Group 1 — Format: Best Ball Validation (2 pts)
  - Group 2 — Format: Best Ball Validation or Low Total (2 pts)
  - Group 3 — Format: Singles Match (1 pt each)
- [ ] **Assign players to groups** — Admin → Groups → Add Players
- [ ] **Set playing handicaps** — Admin → Groups → Set PH for each player in each group
- [ ] **Create matches for Group 1 and Group 2** first (pairs matches)
- [ ] **Create regular singles matches for Group 3** (non-island singles, if any)
- [ ] **Last — Assign island player:** Admin → Island Player → Day 1
  - 5-team captain picks their island player (they "own" this decision)
  - Select the 2 opponents from the 6-player team
  - System auto-creates 2 singles matches for the island player
  - This is the "draw" — do this last so the opposing team doesn't know who's coming until you hit Assign

**Point values this day:** Pairs = 2 pts each | Singles = 1 pt each | **Total available: 6 pts**

---

## Day 1 — During the Round

- [ ] **Score entry:** /scores → Select Day 1 → Select your group → Enter scores hole by hole
- [ ] **Offline?** If you lose cell service, keep entering scores — they'll queue locally and sync automatically when you reconnect. Red dot in the header means offline. Amber/green means syncing/connected.
- [ ] **Other groups' updates** will show as notifications when they save scores (Feature 3 — coming soon)

---

## Day 1 — After the Round

- [ ] **Verify all 18 holes are entered** for all groups — /scorecards
- [ ] **Check leaderboard** — /leaderboard — team scores should reflect Day 1 matches
- [ ] **Check match results** — /matches — confirm all 3 groups show correct win/loss/tie

---

## Day 2 — Saturday (Before the Round)

**Format:** Same as Day 1 (2 pairs + singles with island player)

- [ ] **Create groups** for Day 2 (same process as Day 1)
- [ ] **Island player — no-repeat check:** The app will only show eligible players in the dropdown. Confirm the 5-team captain is choosing someone who hasn't been island player yet.
- [ ] **Island opponents — no-repeat check:** Both opponents must be from the 6-team and haven't been island opponents yet. App enforces this automatically.
- [ ] **Assign island player LAST** (same as Day 1)

**Point values this day:** Pairs = 2 pts each | Singles = 1 pt each | **Total available: 6 pts**

---

## Saturday Evening — Day 3 Matchup Draft

**After Day 2's round is complete:**

- [ ] **Determine pick order** — whoever wins Day 2 (or some other agreed rule) picks first. Set this manually in Admin → Day 3 Settings → Pick Order.
- [ ] **Run the matchup draft** — Admin → Day 3 Matchups:
  - Captains alternate picking opponent pairings (Feature 7 — coming soon)
  - All Day 3 matches are singles
  - Island player for Day 3 is designated during this draft
- [ ] **Confirm all 6 matchups are set** before going to sleep

**Note:** Day 3 matchup builder (Feature 7) will be available before/during the trip. If it's not ready yet, set matchups manually in Admin → Matches.

---

## Day 3 — Sunday (Before the Round)

**Format:** All singles (6 matches including 2 island results)

- [ ] **Verify all Day 3 matchups are created** — Admin → Matches → Day 3
- [ ] **Confirm island player for Day 3** is set (should already be done Saturday night)
- [ ] **All point values for Day 3 = 2 pts** — the app handles this automatically

**Point values this day:** All singles = 2 pts each | **Total available: 12 pts**

---

## Day 3 — After the Round (Trophy Ceremony 🏆)

- [ ] **Final leaderboard** — /leaderboard — shows overall team winner and individual leaders
- [ ] **End-of-day summary card** — accessible from dashboard (Feature 5 — coming soon)
- [ ] **Screenshot the leaderboard** for the group chat
- [ ] **Celebrate** 🍺

---

## Full Trip Point Summary

| Day | Format | Points Available |
|-----|--------|-----------------|
| Friday | 2 pairs (2 pts) + 2 island singles (1 pt each) | 6 |
| Saturday | 2 pairs (2 pts) + 2 island singles (1 pt each) | 6 |
| Sunday | 6 singles (2 pts each) | 12 |
| **Total** | | **24** |

---

## Troubleshooting

**Scores not showing on leaderboard?**
- Make sure matches are created for that group — scores only count when a match exists
- Check /matches — if status is "not_started," no scores have been saved yet

**Wrong point values showing?**
- Pairs matches should show 2 pts, singles D1-D2 should show 1 pt, D3 should show 2 pts
- If wrong, check Admin → Matches and verify the format is set correctly for each match

**Island player dropdown empty?**
- All eligible players may have already served — check previous day assignments
- Or the 5-player team setting may not be set in Admin → Settings

**App not loading offline?**
- Make sure you've opened the app at least once on WiFi to cache it
- The PWA must be installed (Add to Home Screen) for full offline support
- If scores won't sync after reconnecting, use the "Refresh to sync" prompt in score entry

---

*Last updated: 2026-02-22 | Contact Ben or Eric if rules questions arise*
