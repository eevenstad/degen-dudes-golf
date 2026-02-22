# Degen Dudes Phase 2 — Decisions Log

| # | Decision | Rationale | Date | Status |
|---|----------|-----------|------|--------|
| 1 | Cut draft night UI feature | One-time 10-min event, works fine analog. Not worth the build time. | 2026-02-22 | FINAL |
| 2 | Cut side bet tracker | Better for next year's trip. Keep scope tight for Feb 26 deadline. | 2026-02-22 | FINAL |
| 3 | Offline uses localStorage queue, not IndexedDB | Simple, sufficient for ~200 scores max. No need for IndexedDB complexity. | 2026-02-22 | FINAL |
| 4 | Conflict resolution: last-write-wins by timestamp | Simple and predictable. Unlikely to have true conflicts with 11 players. | 2026-02-22 | FINAL |
| 5 | Island player design doc required before implementation | Complex new competition logic. Must be designed and approved by Eric before code. | 2026-02-22 | FINAL |
| 6 | Feature 7 (Day 3 matchups) pick order unknown until Saturday | Can't determine who picks first until after Saturday's round. Build the UI but don't hardcode order. | 2026-02-22 | FINAL |
| 7 | Ben's island player rules are authoritative | Ben designed the competition structure. His rules (verbatim in SPEC.md) are the source of truth. | 2026-02-22 | FINAL |
| 8 | Point values: pairs=2, singles D1-D2=1, all D3=2 | From Ben's message. Changes existing 1-point-per-match logic. | 2026-02-22 | FINAL |
| 9 | Island player "double point responsibility" = 2 separate matches at standard point values, NOT doubled points per match | Math proof: D1/D2 = 2 pairs × 2pts + 2 island results × 1pt = 6pts ✓. D3 = 6 singles × 2pts = 12pts ✓. Total = 24pts ✓. Interpretation (b) "2× point value" would give D1/D2 = 4 + 2×2 = 8pts ≠ 6. Only interpretation (a) makes the daily totals work. | 2026-02-22 | FINAL |
| 10 | Island matches modeled as 2 separate singles matches in DB (preferred) | Reuses existing `calcMatchResult` engine logic. No new match type needed. Design doc (2a) confirms. Alternative (1 special "island" match type with 3 players) would require new engine logic with no benefit. | 2026-02-22 | FINAL |
| 11 | Team sizes (6v5) are draft-dependent, not hardcoded | Thursday night draft determines teams. System must handle either USA or Europe being the 5-player or 6-player team. Island player logic references "5-team" and "6-team" generically. | 2026-02-22 | FINAL |
