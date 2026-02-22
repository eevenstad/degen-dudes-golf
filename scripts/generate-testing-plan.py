#!/usr/bin/env python3
"""
Generate comprehensive TESTING-PLAN.md with all pre-calculated expected values.
Uses verified Supabase CH values and actual hole data.
"""

import math
from datetime import datetime

# ============================================================
# RAW DATA (from Supabase — verified correct)
# ============================================================

PLAYERS = [
    ("Ryan", 8.9), ("Kiki", 9.3), ("Mack", 10.0), ("Bruce", 10.6),
    ("Matthew", 11.0), ("C-Pat", 11.5), ("Eric", 13.5), ("Ben", 19.0),
    ("Gary", 22.1), ("Chris", 30.0), ("Jauch", 36.0),
]

PLAYER_IDS = {
    "Ryan": "06559478-aa82-4a0d-aa26-d239ae8414f4",
    "Kiki": "2377121e-5093-4250-9459-9cec514d9ff4",
    "Mack": "c407edd3-591f-4faf-afed-c6e156698b33",
    "Bruce": "8ba6e2af-35d9-42bb-9750-f35fcbb9746c",
    "Matthew": "57a4fdd1-6cac-4264-ad8d-809aef763ee1",
    "C-Pat": "5ac3e47e-68d3-4a66-a6ae-47376bdd9faf",
    "Eric": "989f9143-2f6b-4060-8875-20feb87ead55",
    "Ben": "e2fc862d-3f4b-49f7-ac6f-97abecaad00e",
    "Gary": "e0928ef5-83fe-440c-8a1c-76704f4886af",
    "Chris": "6e49119a-2050-4e50-be46-42c2e89451b8",
    "Jauch": "2dcc566e-b465-431b-90a1-0f9791de614e",
}

COURSES = {
    1: {"name": "Terra Lago North", "id": "9333b881-441e-43f0-9aa8-efe8f9dcd203", "par": 72},
    2: {"name": "PGA West Mountain", "id": "fb74b2c0-b9df-4926-8867-13d83a2cdf7f", "par": 72},
    3: {"name": "Eagle Falls", "id": "6a96b6d2-9271-4191-ba6c-da0232a9ca46", "par": 72},
}

# Hole data: {day: [(hole_num, par, hdcp_rank), ...]}
HOLES = {
    1: [  # Terra Lago North
        (1, 4, 9), (2, 4, 15), (3, 3, 17), (4, 5, 7), (5, 4, 1), (6, 4, 11),
        (7, 3, 13), (8, 5, 5), (9, 4, 3), (10, 4, 10), (11, 4, 16), (12, 3, 18),
        (13, 5, 8), (14, 4, 2), (15, 4, 12), (16, 3, 14), (17, 5, 6), (18, 4, 4),
    ],
    2: [  # PGA West Mountain
        (1, 4, 9), (2, 5, 5), (3, 4, 13), (4, 3, 17), (5, 4, 3), (6, 4, 11),
        (7, 5, 1), (8, 3, 15), (9, 4, 7), (10, 4, 10), (11, 4, 14), (12, 3, 18),
        (13, 5, 6), (14, 4, 2), (15, 4, 12), (16, 3, 16), (17, 5, 4), (18, 4, 8),
    ],
    3: [  # Eagle Falls
        (1, 4, 7), (2, 5, 3), (3, 3, 15), (4, 4, 11), (5, 4, 1), (6, 3, 17),
        (7, 5, 5), (8, 4, 9), (9, 4, 13), (10, 4, 8), (11, 4, 4), (12, 3, 18),
        (13, 5, 2), (14, 4, 10), (15, 4, 6), (16, 3, 16), (17, 5, 12), (18, 4, 14),
    ],
}

# Course handicaps (from Supabase — verified correct)
CH = {
    "Ryan":    {1: 14, 2: 11, 3: 8},
    "Kiki":    {1: 11, 2: 6,  3: 8},
    "Mack":    {1: 12, 2: 11, 3: 9},
    "Bruce":   {1: 16, 2: 12, 3: 10},
    "Matthew": {1: 16, 2: 14, 3: 10},
    "C-Pat":   {1: 17, 2: 9,  3: 11},
    "Eric":    {1: 16, 2: 14, 3: 13},
    "Ben":     {1: 22, 2: 20, 3: 19},
    "Gary":    {1: 26, 2: 20, 3: 23},
    "Chris":   {1: 35, 2: 33, 3: 32},
    "Jauch":   {1: 42, 2: 35, 3: 38},
}

# Tee info for reference
TEES = {
    "Ryan":    {1: ("Black", 74.7, 139), 2: ("Black", 72.8, 135), 3: ("Hawk", 70.0, 127)},
    "Kiki":    {1: ("Yellow", 71.9, 132), 2: ("Silver", 68.3, 122), 3: ("Hawk", 70.0, 127)},
    "Mack":    {1: ("Yellow", 71.9, 132), 2: ("Black/White", 71.8, 132), 3: ("Hawk", 70.0, 127)},
    "Bruce":   {1: ("Black", 74.7, 139), 2: ("Black/White", 71.8, 132), 3: ("Hawk", 70.0, 127)},
    "Matthew": {1: ("Black", 74.7, 139), 2: ("Black", 72.8, 135), 3: ("Hawk", 70.0, 127)},
    "C-Pat":   {1: ("Black", 74.7, 139), 2: ("Silver", 68.3, 122), 3: ("Hawk", 70.0, 127)},
    "Eric":    {1: ("Yellow", 71.9, 132), 2: ("White", 70.8, 129), 3: ("Hawk", 70.0, 127)},
    "Ben":     {1: ("Yellow", 71.9, 132), 2: ("White", 70.8, 129), 3: ("Hawk", 70.0, 127)},
    "Gary":    {1: ("Yellow", 71.9, 132), 2: ("Silver", 68.3, 122), 3: ("Hawk", 70.0, 127)},
    "Chris":   {1: ("Yellow", 71.9, 132), 2: ("White", 70.8, 129), 3: ("Hawk", 70.0, 127)},
    "Jauch":   {1: ("Yellow", 71.9, 132), 2: ("Silver", 68.3, 122), 3: ("Hawk", 70.0, 127)},
}


# ============================================================
# SCORING FUNCTIONS (match handicap.ts exactly)
# ============================================================

def calc_strokes_on_hole(handicap, hole_handicap_rank):
    """Matches calcStrokesOnHole in handicap.ts"""
    if handicap >= 36:
        return 3 if hole_handicap_rank <= (handicap - 36) else 2
    elif handicap >= 18:
        return 2 if hole_handicap_rank <= (handicap - 18) else 1
    else:
        return 1 if hole_handicap_rank <= handicap else 0

def calc_net_score(gross, strokes, par, net_max_over_par):
    """Matches calcNetScore in handicap.ts"""
    raw = gross - strokes
    cap = par + strokes + net_max_over_par
    return min(raw, cap)

def calc_playing_handicap(player_ch, min_group_ch):
    return player_ch - min_group_ch


# ============================================================
# GENERATE FULL STROKE TABLES
# ============================================================

def generate_stroke_table(day):
    """Generate full stroke table for a day."""
    lines = []
    holes = HOLES[day]
    
    # Header
    header = f"| Player | CH |"
    for h_num, _, _ in holes:
        header += f" H{h_num} |"
    header += " Tot |"
    lines.append(header)
    
    sep = "|--------|-----|"
    for _ in holes:
        sep += "-----|"
    sep += "-----|"
    lines.append(sep)
    
    for name, _ in PLAYERS:
        ch = CH[name][day]
        row = f"| {name:7s} | {ch:3d} |"
        total = 0
        for _, par, hdcp_rank in holes:
            s = calc_strokes_on_hole(ch, hdcp_rank)
            total += s
            row += f"  {s}  |"
        row += f" {total:3d} |"
        lines.append(row)
    
    return "\n".join(lines)


def generate_net_score_table(day, scenario_name, gross_func, net_max=3):
    """Generate net score table for a test scenario."""
    lines = []
    holes = HOLES[day]
    
    header = f"| Player | CH |"
    for h_num, _, _ in holes:
        header += f" H{h_num} |"
    header += " Gross | Net |"
    lines.append(header)
    
    sep = "|--------|-----|"
    for _ in holes:
        sep += "------|"
    sep += "-------|------|"
    lines.append(sep)
    
    for name, _ in PLAYERS:
        ch = CH[name][day]
        row = f"| {name:7s} | {ch:3d} |"
        total_gross = 0
        total_net = 0
        for h_num, par, hdcp_rank in holes:
            gross = gross_func(name, h_num, par, hdcp_rank, ch)
            strokes = calc_strokes_on_hole(ch, hdcp_rank)
            net = calc_net_score(gross, strokes, par, net_max)
            total_gross += gross
            total_net += net
            row += f" {gross}/{net} |"
        row += f"  {total_gross:4d} | {total_net:4d} |"
        lines.append(row)
    
    return "\n".join(lines)


# ============================================================
# TEST SCENARIOS
# ============================================================

def scenario_par_plus_2(name, h_num, par, hdcp_rank, ch):
    """Everyone shoots par+2 on every hole."""
    return par + 2

def scenario_mixed_realistic(name, h_num, par, hdcp_rank, ch):
    """Mixed scores designed to test edge cases."""
    # Low handicappers: par to bogey
    # High handicappers: bogey to triple
    # Specific holes trigger net cap and tiebreaker scenarios
    if ch <= 12:  # Ryan, Kiki, Mack
        base = par + (1 if hdcp_rank <= 9 else 0)  # bogey on hard holes, par on easy
        if h_num == 5:  # birdie on hole 5 for all low HC
            return par - 1
        return base
    elif ch <= 17:  # Bruce, Matthew, C-Pat, Eric
        base = par + 1  # bogey everywhere
        if h_num == 13:  # birdie on hole 13
            return par - 1
        if h_num == 1:  # double on hole 1
            return par + 2
        return base
    elif ch <= 23:  # Ben, Gary
        return par + 2  # double bogey everywhere
    else:  # Chris, Jauch — very high HC
        if h_num == 3 or h_num == 12:  # par 3s: hit 10 (tests net cap)
            return 10
        return par + 3  # triple bogey

def scenario_net_cap_stress(name, h_num, par, hdcp_rank, ch):
    """Everyone shoots 15 on every hole — stresses the net cap."""
    return 15

def scenario_ace_and_eagle(name, h_num, par, hdcp_rank, ch):
    """Hole-in-one on par 3s, eagle on par 5s, par elsewhere."""
    if par == 3:
        return 1  # ace
    elif par == 5:
        return 3  # eagle
    else:
        return par  # par on 4s


# ============================================================
# MATCH FORMAT TEST SCENARIOS
# ============================================================

def generate_match_scenario(format_name, format_code, team_a_players, team_b_players, day, gross_func, net_max=3):
    """Generate expected match results for a format."""
    lines = []
    holes = HOLES[day]
    
    # Calculate playing handicaps
    all_players = team_a_players + team_b_players
    chs = {p: CH[p][day] for p in all_players}
    min_ch = min(chs.values())
    phs = {p: chs[p] - min_ch for p in all_players}
    
    lines.append(f"**Format:** {format_name} (`{format_code}`)")
    lines.append(f"**Team A:** {', '.join(team_a_players)}")
    lines.append(f"**Team B:** {', '.join(team_b_players)}")
    lines.append(f"**Playing Handicaps:** " + ", ".join(f"{p}={phs[p]}" for p in all_players))
    lines.append("")
    
    header = "| Hole | Par |"
    for p in all_players:
        header += f" {p} G/PH-Net |"
    header += " Result |"
    lines.append(header)
    
    sep = "|------|-----|"
    for _ in all_players:
        sep += "------------|"
    sep += "--------|"
    lines.append(sep)
    
    team_a_total = 0
    team_b_total = 0
    
    for h_num, par, hdcp_rank in holes:
        row = f"| {h_num:4d} | {par:3d} |"
        
        a_nets = []
        b_nets = []
        
        for p in all_players:
            gross = gross_func(p, h_num, par, hdcp_rank, CH[p][day])
            ph_strokes = calc_strokes_on_hole(phs[p], hdcp_rank)
            ph_net = calc_net_score(gross, ph_strokes, par, net_max)
            row += f" {gross}/{ph_net}({ph_strokes}s) |"
            
            if p in team_a_players:
                a_nets.append(ph_net)
            else:
                b_nets.append(ph_net)
        
        # Calculate result based on format
        result = ""
        if format_code in ("best_ball_validation", "best_ball"):
            best_a = min(a_nets)
            best_b = min(b_nets)
            if best_a < best_b:
                team_a_total += 1
                result = f"A ({best_a} vs {best_b})"
            elif best_b < best_a:
                team_b_total += 1
                result = f"B ({best_a} vs {best_b})"
            else:
                if format_code == "best_ball_validation":
                    worst_a = max(a_nets)
                    worst_b = max(b_nets)
                    if worst_a < worst_b:
                        team_a_total += 1
                        result = f"A-val ({worst_a} vs {worst_b})"
                    elif worst_b < worst_a:
                        team_b_total += 1
                        result = f"B-val ({worst_a} vs {worst_b})"
                    else:
                        result = "Tie"
                else:
                    result = "Tie"
        elif format_code == "low_total":
            low_a = min(a_nets)
            low_b = min(b_nets)
            total_a = sum(a_nets)
            total_b = sum(b_nets)
            pts = []
            if low_a < low_b:
                team_a_total += 1; pts.append("Low→A")
            elif low_b < low_a:
                team_b_total += 1; pts.append("Low→B")
            else:
                pts.append("Low=Tie")
            if total_a < total_b:
                team_a_total += 1; pts.append("Tot→A")
            elif total_b < total_a:
                team_b_total += 1; pts.append("Tot→B")
            else:
                pts.append("Tot=Tie")
            result = " ".join(pts)
        elif format_code in ("singles_match", "singles_stroke"):
            net_a = a_nets[0]
            net_b = b_nets[0]
            if format_code == "singles_match":
                if net_a < net_b:
                    team_a_total += 1; result = f"A ({net_a} vs {net_b})"
                elif net_b < net_a:
                    team_b_total += 1; result = f"B ({net_a} vs {net_b})"
                else:
                    team_a_total += 0.5; team_b_total += 0.5; result = f"Tie ({net_a})"
        
        row += f" {result} |"
        lines.append(row)
    
    lines.append("")
    lines.append(f"**Final Score:** Team A: {team_a_total} — Team B: {team_b_total}")
    
    if team_a_total > team_b_total:
        lines.append(f"**Match Points:** A=1, B=0")
    elif team_b_total > team_a_total:
        lines.append(f"**Match Points:** A=0, B=1")
    else:
        lines.append(f"**Match Points:** A=0.5, B=0.5")
    
    return "\n".join(lines)


# ============================================================
# MAIN: Generate the full testing plan
# ============================================================

def main():
    out = []
    
    out.append(f"# Degen Dudes — Comprehensive Scoring Test Plan")
    out.append(f"## Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} by Opus 4.6")
    out.append(f"## Purpose: Ground truth for ALL automated scoring verification")
    out.append("")
    out.append("**This file supersedes the previous TESTING-PLAN.md which had 9 incorrect CH values.**")
    out.append("All values below are verified against Supabase database and the USGA formula:")
    out.append("```")
    out.append("CH = ROUND(HI × (Slope / 113) + (Rating - Par))")
    out.append("```")
    out.append("")
    out.append("---")
    out.append("")
    
    # ========== SECTION 1: CH Verification ==========
    out.append("## Section 1: Course Handicap Verification")
    out.append("")
    out.append("These are the values stored in Supabase `player_tee_assignments.course_handicap`.")
    out.append("The test suite should verify the app calculates these correctly.")
    out.append("")
    
    for day in [1, 2, 3]:
        course = COURSES[day]
        out.append(f"### Day {day}: {course['name']} (Par {course['par']})")
        out.append("")
        out.append("| Player | HI | Tee | Rating | Slope | Calculation | Expected CH |")
        out.append("|--------|-----|-----|--------|-------|-------------|-------------|")
        
        for name, hi in PLAYERS:
            ch = CH[name][day]
            tee_name, rating, slope = TEES[name][day]
            raw = hi * (slope / 113) + (rating - 72)
            out.append(f"| {name} | {hi} | {tee_name} | {rating} | {slope} | ROUND({raw:.4f}) | **{ch}** |")
        out.append("")
    
    # ========== SECTION 2: Stroke Distribution Tables ==========
    out.append("---")
    out.append("")
    out.append("## Section 2: Stroke Distribution (CH Strokes per Hole)")
    out.append("")
    out.append("Shows how many strokes each player gets on each hole based on their Course Handicap.")
    out.append("Formula: CH≥36 → 3 strokes if rank≤(CH-36), else 2; CH≥18 → 2 if rank≤(CH-18), else 1; else 1 if rank≤CH, else 0")
    out.append("")
    
    for day in [1, 2, 3]:
        course = COURSES[day]
        out.append(f"### Day {day}: {course['name']}")
        out.append("")
        
        # Hole info sub-header
        holes = HOLES[day]
        hole_info = "| | |"
        for h_num, par, rank in holes:
            hole_info += f" P{par}/R{rank} |"
        hole_info += " |"
        out.append(hole_info)
        out.append("")
        
        out.append(generate_stroke_table(day))
        out.append("")
    
    # ========== SECTION 3: Test Scenarios ==========
    out.append("---")
    out.append("")
    out.append("## Section 3: Test Scenarios with Expected Net Scores")
    out.append("")
    out.append("Each cell shows `gross/net`. NET_MAX_OVER_PAR = 3 unless otherwise noted.")
    out.append("")
    
    # Scenario A: Par+2
    out.append("### Scenario A: Everyone Shoots Par+2 (Baseline)")
    out.append("")
    out.append("Simple, easy to verify. Every player scores par+2 on every hole.")
    out.append("Players with strokes: net = (par+2) - strokes. Players without: net = par+2.")
    out.append("")
    
    for day in [1, 2, 3]:
        course = COURSES[day]
        out.append(f"#### Day {day}: {course['name']}")
        out.append("")
        out.append(generate_net_score_table(day, "Par+2", scenario_par_plus_2))
        out.append("")
    
    # Scenario B: Mixed realistic
    out.append("### Scenario B: Mixed Realistic Scores")
    out.append("")
    out.append("Low HC (≤12): par on easy holes, bogey on hard, birdie on hole 5.")
    out.append("Mid HC (13-17): bogey everywhere, birdie on hole 13, double on hole 1.")
    out.append("High HC (18-23): double bogey everywhere.")
    out.append("Very high HC (24+): triple bogey, except par 3s score 10 (tests net cap).")
    out.append("")
    
    for day in [1, 2, 3]:
        course = COURSES[day]
        out.append(f"#### Day {day}: {course['name']}")
        out.append("")
        out.append(generate_net_score_table(day, "Mixed", scenario_mixed_realistic))
        out.append("")
    
    # Scenario C: Net cap stress test
    out.append("### Scenario C: Net Cap Stress Test (Gross=15 Everywhere)")
    out.append("")
    out.append("Every player shoots 15 on every hole. Tests that net_score = min(gross-strokes, par+strokes+NET_MAX_OVER_PAR).")
    out.append("With NET_MAX_OVER_PAR=3:")
    out.append("")
    
    # Just Day 1 for this — it's a stress test, one day is enough
    out.append(f"#### Day 1: {COURSES[1]['name']} (NET_MAX_OVER_PAR=3)")
    out.append("")
    out.append(generate_net_score_table(1, "Cap3", scenario_net_cap_stress, net_max=3))
    out.append("")
    
    out.append(f"#### Day 1: {COURSES[1]['name']} (NET_MAX_OVER_PAR=2)")
    out.append("")
    out.append(generate_net_score_table(1, "Cap2", scenario_net_cap_stress, net_max=2))
    out.append("")
    
    # Scenario D: Aces and eagles
    out.append("### Scenario D: Aces and Eagles")
    out.append("")
    out.append("Hole-in-one on par 3s (gross=1), eagle on par 5s (gross=3), par on par 4s.")
    out.append("Tests that very low scores are handled correctly (net can go very negative).")
    out.append("")
    out.append(f"#### Day 1: {COURSES[1]['name']}")
    out.append("")
    out.append(generate_net_score_table(1, "Aces", scenario_ace_and_eagle))
    out.append("")
    
    # ========== SECTION 4: Match Format Verification ==========
    out.append("---")
    out.append("")
    out.append("## Section 4: Match Format Verification")
    out.append("")
    out.append("Tests all 5 match formats with controlled scores. Uses Day 1 data.")
    out.append("Playing Handicap (PH) = player CH - min(group CH). Match points use PH-based net scores.")
    out.append("")
    
    # Test groups for format verification
    # Group 1: 4 players (pairs formats)
    g1 = {"a": ["Ryan", "Mack"], "b": ["Kiki", "Bruce"]}
    # Group 2: 2 players (singles)
    g2_singles = {"a": ["Eric"], "b": ["Ben"]}
    # Group 3: High HC singles
    g3_singles = {"a": ["Chris"], "b": ["Jauch"]}
    
    out.append("### 4a: Best Ball + Validation")
    out.append("")
    out.append(generate_match_scenario(
        "Best Ball + Validation", "best_ball_validation",
        g1["a"], g1["b"], 1, scenario_mixed_realistic
    ))
    out.append("")
    
    out.append("### 4b: Best Ball (No Validation)")
    out.append("")
    out.append(generate_match_scenario(
        "Best Ball", "best_ball",
        g1["a"], g1["b"], 1, scenario_mixed_realistic
    ))
    out.append("")
    
    out.append("### 4c: Low Ball + Total")
    out.append("")
    out.append(generate_match_scenario(
        "Low Ball + Total", "low_total",
        g1["a"], g1["b"], 1, scenario_mixed_realistic
    ))
    out.append("")
    
    out.append("### 4d: Singles Match Play")
    out.append("")
    out.append(generate_match_scenario(
        "Singles Match Play", "singles_match",
        g2_singles["a"], g2_singles["b"], 1, scenario_mixed_realistic
    ))
    out.append("")
    
    out.append("### 4e: Singles Match Play (High HC)")
    out.append("")
    out.append(generate_match_scenario(
        "Singles Match Play (High HC)", "singles_match",
        g3_singles["a"], g3_singles["b"], 1, scenario_mixed_realistic
    ))
    out.append("")
    
    out.append("### 4f: Singles Stroke Play")
    out.append("")
    out.append("Same as singles match play but winner determined by total PH-net across 18 holes, not hole-by-hole.")
    out.append("Use the same scores from 4d (Eric vs Ben). Sum the PH-net columns. Lower total wins the match point.")
    out.append("")
    
    # ========== SECTION 5: NET_MAX_OVER_PAR Comparison ==========
    out.append("---")
    out.append("")
    out.append("## Section 5: NET_MAX_OVER_PAR Comparison (2 vs 3)")
    out.append("")
    out.append("The app setting `net_max_over_par` is configurable (Admin → Settings). Ben may set it to 2 or 3.")
    out.append("This section shows how the same gross scores produce different nets under each value.")
    out.append("")
    out.append("Using Scenario B (mixed realistic), Day 1, comparing only players where it matters (high HC players):")
    out.append("")
    
    for net_max in [3, 2]:
        out.append(f"### NET_MAX_OVER_PAR = {net_max}")
        out.append("")
        lines_header = "| Player | CH | Hole | Par | Gross | Strokes | Raw Net | Cap | Final Net |"
        lines_sep = "|--------|-----|------|-----|-------|---------|---------|-----|-----------|"
        out.append(lines_header)
        out.append(lines_sep)
        
        for name in ["Chris", "Jauch"]:
            ch = CH[name][1]
            for h_num, par, hdcp_rank in HOLES[1][:6]:  # First 6 holes only
                gross = scenario_mixed_realistic(name, h_num, par, hdcp_rank, ch)
                strokes = calc_strokes_on_hole(ch, hdcp_rank)
                raw = gross - strokes
                cap = par + strokes + net_max
                final = min(raw, cap)
                capped = " ← CAPPED" if raw > cap else ""
                out.append(f"| {name} | {ch} | {h_num} | {par} | {gross} | {strokes} | {raw} | {cap} | **{final}**{capped} |")
        out.append("")
    
    # ========== SECTION 6: Leaderboard Verification ==========
    out.append("---")
    out.append("")
    out.append("## Section 6: Leaderboard Expected Values")
    out.append("")
    out.append("After entering Scenario A (par+2) scores for all 3 days, expected leaderboard standings:")
    out.append("")
    
    leaderboard = []
    for name, _ in PLAYERS:
        total_gross = 0
        total_net = 0
        total_par = 0
        for day in [1, 2, 3]:
            ch = CH[name][day]
            for h_num, par, hdcp_rank in HOLES[day]:
                gross = par + 2
                strokes = calc_strokes_on_hole(ch, hdcp_rank)
                net = calc_net_score(gross, strokes, par, 3)
                total_gross += gross
                total_net += net
                total_par += par
        leaderboard.append((name, total_gross, total_net, total_par, total_net - total_par))
    
    leaderboard.sort(key=lambda x: x[4])
    
    out.append("| Rank | Player | Total Gross | Total Net | vs Par |")
    out.append("|------|--------|-------------|-----------|--------|")
    for i, (name, tg, tn, tp, diff) in enumerate(leaderboard, 1):
        diff_str = f"+{diff}" if diff > 0 else str(diff)
        out.append(f"| {i} | {name} | {tg} | {tn} | {diff_str} |")
    out.append("")
    
    # ========== SECTION 7: Data Reset & Setup ==========
    out.append("---")
    out.append("")
    out.append("## Section 7: Test Data Management")
    out.append("")
    out.append("### Reset Script (run before each test)")
    out.append("```sql")
    out.append("DELETE FROM scores;")
    out.append("DELETE FROM match_players;")
    out.append("DELETE FROM matches;")
    out.append("DELETE FROM group_players;")
    out.append("DELETE FROM groups;")
    out.append("UPDATE players SET team = NULL;")
    out.append("```")
    out.append("")
    out.append("### Test Team Assignments")
    out.append("| Team USA | Team Europe |")
    out.append("|----------|-------------|")
    out.append("| Ryan | Kiki |")
    out.append("| Mack | Bruce |")
    out.append("| Matthew | C-Pat |")
    out.append("| Eric | Ben |")
    out.append("| Gary | Chris |")
    out.append("| Jauch | |")
    out.append("")
    out.append("### Test Group Configuration (Day 1)")
    out.append("| Group | Players | Default Format |")
    out.append("|-------|---------|----------------|")
    out.append("| 1 | Ryan, Kiki, Mack, Bruce | best_ball_validation |")
    out.append("| 2 | Matthew, C-Pat, Eric, Ben | best_ball_validation |")
    out.append("| 3 | Gary, Chris, Jauch | singles_match |")
    out.append("")
    out.append("### Service Role Key Location")
    out.append("`~/.config/supabase/degen-dudes-service-role` — NEVER display in logs or chat.")
    out.append("")
    out.append("### Supabase API Base")
    out.append("`https://lnnlabbdffowjpaxvnsp.supabase.co/rest/v1/`")
    out.append("")
    
    # ========== SECTION 8: Test Implementation Guide ==========
    out.append("---")
    out.append("")
    out.append("## Section 8: Test Implementation Guide")
    out.append("")
    out.append("### Method 1: Unit Tests (scoring engine)")
    out.append("")
    out.append("Import the scoring functions directly and verify against Section 2 & 3 expected values.")
    out.append("These run instantly, no browser needed.")
    out.append("")
    out.append("```typescript")
    out.append("import { calcStrokesOnHole, calcNetScore, calcCourseHandicap } from '@/lib/scoring'")
    out.append("")
    out.append("// Verify every CH value")
    out.append("test('Ryan Day 1 CH', () => {")
    out.append("  expect(calcCourseHandicap(8.9, 139, 74.7, 72)).toBe(14)")
    out.append("})")
    out.append("")
    out.append("// Verify strokes on every hole")
    out.append("test('Jauch Day 1 Hole 5 (rank 1, CH=42) gets 3 strokes', () => {")
    out.append("  expect(calcStrokesOnHole(42, 1)).toBe(3)")
    out.append("})")
    out.append("")
    out.append("// Verify net scores with cap")
    out.append("test('net score cap: gross=15, strokes=2, par=4, maxOver=3 → net=9 (capped)', () => {")
    out.append("  expect(calcNetScore(15, 2, 4, 3)).toBe(9) // cap = 4+2+3 = 9")
    out.append("})")
    out.append("```")
    out.append("")
    out.append("### Method 2: UI Integration Tests (Playwright)")
    out.append("")
    out.append("Enter scores through the real app UI and verify displayed values match expected.")
    out.append("")
    out.append("**Test flow:**")
    out.append("1. Reset test data (API call to Supabase)")
    out.append("2. Set team assignments (API call)")
    out.append("3. Create groups via Admin UI or API")
    out.append("4. Create matches via Admin UI or API")
    out.append("5. Enter gross scores via Score Entry UI (navigate to day → group → hole → +/- → save)")
    out.append("6. After each hole: verify net score displayed in score entry matches expected")
    out.append("7. After all 18 holes: navigate to /scorecards, verify all values")
    out.append("8. Navigate to /strokes, verify stroke dots match Section 2 tables")
    out.append("9. Navigate to /leaderboard, verify standings match Section 6")
    out.append("10. Navigate to /matches, verify match points match Section 4")
    out.append("")
    out.append("**Multi-user simulation:**")
    out.append("3 browser contexts entering scores simultaneously (one per group).")
    out.append("4th context on /leaderboard verifying real-time updates.")
    out.append("")
    out.append("**Undo test:**")
    out.append("1. Enter gross=6 for Eric on Hole 1 → verify net displayed")
    out.append("2. Click Undo → verify previous value restored")
    out.append("3. Enter gross=7 → verify new net displayed")
    out.append("4. Navigate to /history → verify all 3 entries visible")
    out.append("")
    out.append("### Playwright Config Notes")
    out.append("")
    out.append("- Existing config at `~/code/degen-dudes/playwright.config.ts`")
    out.append("- Tests run against live URL: `https://degen-dudes-golf.vercel.app`")
    out.append("- Auth handled by global-setup.ts (PIN 2626)")
    out.append("- Scoring tests should go in `tests/scoring/` directory")
    out.append("- Update `testMatch` in config if new naming convention needed")
    out.append("- Workers: 1 (sequential — setup must run before score tests)")
    out.append("")
    
    # ========== SECTION 9: Quick Reference ==========
    out.append("---")
    out.append("")
    out.append("## Section 9: Quick Reference")
    out.append("")
    out.append("### Player IDs")
    out.append("| Player | ID |")
    out.append("|--------|----|")
    for name, _ in PLAYERS:
        out.append(f"| {name} | `{PLAYER_IDS[name]}` |")
    out.append("")
    
    out.append("### Course IDs")
    out.append("| Day | Course | ID |")
    out.append("|-----|--------|----|")
    for day in [1, 2, 3]:
        c = COURSES[day]
        out.append(f"| {day} | {c['name']} | `{c['id']}` |")
    out.append("")
    
    out.append("### Scoring Formulas")
    out.append("```")
    out.append("CH = ROUND(HI × (Slope / 113) + (Rating - Par))")
    out.append("PH = CH - min(group CH)")
    out.append("Strokes: CH≥36 → rank≤(CH-36)?3:2; CH≥18 → rank≤(CH-18)?2:1; else rank≤CH?1:0")
    out.append("Net = min(gross - strokes, par + strokes + NET_MAX_OVER_PAR)")
    out.append("```")
    out.append("")
    
    # Write the file
    output = "\n".join(out)
    with open("/Users/ericevnestad/code/degen-dudes/TESTING-PLAN.md", "w") as f:
        f.write(output)
    
    print(f"Generated TESTING-PLAN.md: {len(output):,} bytes, {len(out)} lines")
    print(f"Covers: {len(PLAYERS)} players × 3 days × 18 holes = {len(PLAYERS)*3*18} stroke values")
    print(f"Scenarios: A (par+2), B (mixed), C (net cap), D (aces/eagles)")
    print(f"Formats: best_ball_validation, best_ball, low_total, singles_match, singles_stroke")
    print(f"NET_MAX_OVER_PAR: tested with both 2 and 3")


if __name__ == "__main__":
    main()
