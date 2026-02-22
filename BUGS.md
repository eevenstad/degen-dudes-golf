# Degen Dudes — Bug & Polish Tracker

Last updated: 2026-02-21

This file is the running list of known issues, polish items, and future improvements.
Check this at the start of any new session working on the app.

---

## 🔴 Critical (Must Fix Before Trip — Feb 26)

All critical bugs have been addressed in Session 7. See below for status.

---

## 🟡 Should Fix (High Value, Low Risk)

### BUG-S1: Score entry locked to player's own group
- **What:** When `localStorage.degen_player_name` is set, Day 1 selection skips the group picker and jumps directly to that player's group. No way to enter scores for other groups.
- **Fix:** Add a "Change Group" or "All Groups" button on the score entry group screen so any user can override auto-selection.
- **Status:** Fixed in Session 7 (pending verification)

### BUG-S2: Match creation requires groups pre-loaded in same session
- **What:** The matches tab only shows groups in the "New Match" form if the user already clicked "Load Groups" in the groups tab during the same browser session. Fresh load = empty group dropdown.
- **Fix:** Auto-load all groups when the matches tab is opened (or when the New Match form is opened).
- **Status:** Fixed in Session 7 (pending verification)

---

## 🟢 Polish / Nice to Have (Post-Trip or If Time Permits)

### POLISH-1: Help button missing on /history page
- Every other page has a `?` help button (bottom right). History page is missing one.
- Low priority — nobody will need help on history during the trip.

### POLISH-2: Group duplicate prevention
- Creating a group that already exists (same day + group number) silently creates a duplicate.
- Should show a warning or use upsert logic.
- Low priority — admin knows what they're doing.

### POLISH-3: Score entry confirmation is brief
- The "Saved!" toast disappears quickly. Consider making it persist 2-3 seconds more visibly.
- Low priority — works fine, just cosmetic.

### POLISH-4: Playwright test suite needs CSS fixes
- Several test assertions use hex color strings (`#5C5C2E`) but browsers store `rgb(92, 92, 46)`.
- Test bug only — app behavior is correct.
- Fix tests to use `rgb()` format assertions.

### POLISH-5: Dashboard "Scores" locator ambiguity
- Dashboard has two elements with text "Scores" (nav item + card link).
- Playwright strict mode fails on this. Test needs `.first()` or more specific selector.
- Test bug only — app is fine.

---

## ✅ Fixed (Session 7 — Feb 21, 2026)

| Bug | Fix | Commit |
|-----|-----|--------|
| Team assignment UI not re-rendering after save | Added `localPlayers` state, optimistic update | `000201e` |
| Onboarding modal appearing on /admin and blocking clicks | Added `usePathname()` check, exclude `/admin` | `44abc1f` |
| Match creation requires manual group pre-load | Auto-load groups when matches tab opens | TBD |
| Score entry locked to player's own group | Added "Change Group" override button | TBD |

---

## How to Use This File

- **Start of session:** Read this file to understand current state
- **When a bug is fixed:** Move it to the ✅ Fixed section with commit hash
- **When a new bug is found:** Add it with severity, description, and proposed fix
- **Full Playwright suite:** `cd ~/code/degen-dudes && npx playwright test --reporter=list`
- **Test results:** `~/clawd/tmp/playwright-results.txt` and `~/clawd/tmp/playwright-summary.md`
