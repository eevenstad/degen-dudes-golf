/**
 * reset-test-data.ts
 *
 * Wipes all test scores/groups/matches and seeds the test configuration
 * defined in TESTING-PLAN.md Section 7.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/reset-test-data.ts
 *
 * Or via npm script (if added to package.json):
 *   npm run reset-test-data
 *
 * Uses the Supabase service role key (admin access) to bypass RLS.
 * Key location: ~/.config/supabase/degen-dudes-service-role
 *
 * NEVER run this against production data without understanding the consequences.
 * This script deletes ALL scores, groups, matches, and clears team assignments.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const ANON_KEY = 'sb_publishable_h-llAuZxPV-W4qnH82BKSA_VuqnwNer'

// Service role key — read from file, never hardcode
function getServiceKey(): string {
  const keyPath = path.join(os.homedir(), '.config', 'supabase', 'degen-dudes-service-role')
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service role key not found at ${keyPath}`)
  }
  return fs.readFileSync(keyPath, 'utf8').trim()
}

// ---------------------------------------------------------------------------
// Player IDs (from TESTING-PLAN.md Section 9)
// ---------------------------------------------------------------------------

const PLAYERS = {
  Ryan:    '06559478-aa82-4a0d-aa26-d239ae8414f4',
  Kiki:    '2377121e-5093-4250-9459-9cec514d9ff4',
  Mack:    'c407edd3-591f-4faf-afed-c6e156698b33',
  Bruce:   '8ba6e2af-35d9-42bb-9750-f35fcbb9746c',
  Matthew: '57a4fdd1-6cac-4264-ad8d-809aef763ee1',
  CPat:    '5ac3e47e-68d3-4a66-a6ae-47376bdd9faf',
  Eric:    '989f9143-2f6b-4060-8875-20feb87ead55',
  Ben:     'e2fc862d-3f4b-49f7-ac6f-97abecaad00e',
  Gary:    'e0928ef5-83fe-440c-8a1c-76704f4886af',
  Chris:   '6e49119a-2050-4e50-be46-42c2e89451b8',
  Jauch:   '2dcc566e-b465-431b-90a1-0f9791de614e',
}

// Course IDs (from TESTING-PLAN.md Section 9)
const COURSES = {
  TerraLago: '9333b881-441e-43f0-9aa8-efe8f9dcd203',
  PGAWest:   'fb74b2c0-b9df-4926-8867-13d83a2cdf7f',
  EagleFalls: '6a96b6d2-9271-4191-ba6c-da0232a9ca46',
}

// Team assignments (from TESTING-PLAN.md Section 7)
const TEAM_USA     = [PLAYERS.Ryan, PLAYERS.Mack, PLAYERS.Matthew, PLAYERS.Eric, PLAYERS.Gary, PLAYERS.Jauch]
const TEAM_EUROPE  = [PLAYERS.Kiki, PLAYERS.Bruce, PLAYERS.CPat, PLAYERS.Ben, PLAYERS.Chris]

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function supabaseRequest(
  serviceKey: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extraHeaders,
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data: unknown
  const text = await response.text()
  try { data = JSON.parse(text) } catch { data = text }

  return { status: response.status, data }
}

// Convenience wrappers
const db = {
  delete: (key: string, table: string, filter?: string) =>
    supabaseRequest(key, 'DELETE', filter ? `${table}?${filter}` : `${table}?id=neq.00000000-0000-0000-0000-000000000000`),

  insert: (key: string, table: string, rows: unknown[]) =>
    supabaseRequest(key, 'POST', table, rows),

  patch: (key: string, table: string, filter: string, updates: unknown) =>
    supabaseRequest(key, 'PATCH', `${table}?${filter}`, updates),

  get: (key: string, table: string, query: string) =>
    supabaseRequest(key, 'GET', `${table}?${query}`, undefined),
}

// ---------------------------------------------------------------------------
// Reset functions
// ---------------------------------------------------------------------------

async function resetAllData(key: string): Promise<void> {
  console.log('\n🗑️  Resetting all test data...')

  // Delete in dependency order (children before parents)
  const steps = [
    { label: 'score_history', filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
    { label: 'scores',        filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
    { label: 'match_players', filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
    { label: 'matches',       filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
    { label: 'group_players', filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
    { label: 'groups',        filter: 'id=neq.00000000-0000-0000-0000-000000000000' },
  ]

  for (const { label, filter } of steps) {
    const { status } = await supabaseRequest(key, 'DELETE', `${label}?${filter}`)
    if (status >= 200 && status < 300) {
      console.log(`  ✓ Cleared ${label}`)
    } else {
      throw new Error(`Failed to clear ${label}: HTTP ${status}`)
    }
  }

  // Clear team assignments
  const { status } = await db.patch(
    key, 'players',
    'id=neq.00000000-0000-0000-0000-000000000000',
    { team: null }
  )
  if (status >= 200 && status < 300) {
    console.log('  ✓ Cleared team assignments')
  } else {
    throw new Error(`Failed to clear teams: HTTP ${status}`)
  }
}

async function setTeamAssignments(key: string): Promise<void> {
  console.log('\n🏆 Setting team assignments...')

  for (const id of TEAM_USA) {
    const { status } = await db.patch(key, 'players', `id=eq.${id}`, { team: 'USA' })
    if (status < 200 || status >= 300) throw new Error(`Failed to set USA team for ${id}: HTTP ${status}`)
  }
  console.log(`  ✓ USA (${TEAM_USA.length} players)`)

  for (const id of TEAM_EUROPE) {
    const { status } = await db.patch(key, 'players', `id=eq.${id}`, { team: 'Europe' })
    if (status < 200 || status >= 300) throw new Error(`Failed to set Europe team for ${id}: HTTP ${status}`)
  }
  console.log(`  ✓ Europe (${TEAM_EUROPE.length} players)`)
}

// ---------------------------------------------------------------------------
// Group + match creation
// Groups need Playing Handicap calculated at creation time.
// PH = player CH - min(group CH)
//
// Day 1 CH values (from TESTING-PLAN.md Section 1):
//   Group 1: Ryan=14, Kiki=11, Mack=12, Bruce=16  → min=11
//   Group 2: Matthew=16, C-Pat=17, Eric=16, Ben=22 → min=16
//   Group 3: Gary=26, Chris=35, Jauch=42           → min=26
// ---------------------------------------------------------------------------

const DAY1_GROUPS = [
  {
    day_number: 1,
    group_number: 1,
    format: 'best_ball_validation',
    playerIds: [PLAYERS.Ryan, PLAYERS.Kiki, PLAYERS.Mack, PLAYERS.Bruce],
  },
  {
    day_number: 1,
    group_number: 2,
    format: 'best_ball_validation',
    playerIds: [PLAYERS.Matthew, PLAYERS.CPat, PLAYERS.Eric, PLAYERS.Ben],
  },
  {
    day_number: 1,
    group_number: 3,
    format: 'singles_match',
    playerIds: [PLAYERS.Gary, PLAYERS.Chris, PLAYERS.Jauch],
  },
]

// Lookup player name from ID for logging
function playerName(id: string): string {
  const entry = Object.entries(PLAYERS).find(([, v]) => v === id)
  return entry ? entry[0] : id.slice(0, 8)
}

async function createGroups(key: string): Promise<string[]> {
  console.log('\n👥 Creating Day 1 groups...')
  const groupIds: string[] = []

  // Fetch course handicaps for Day 1 from player_tee_assignments
  const { data: taData } = await supabaseRequest(
    key, 'GET',
    `player_tee_assignments?course_id=eq.${COURSES.TerraLago}&select=player_id,course_handicap`
  )
  const teeAssignments = taData as Array<{ player_id: string; course_handicap: number }>
  const chMap = new Map(teeAssignments.map(ta => [ta.player_id, ta.course_handicap]))

  for (const group of DAY1_GROUPS) {
    // Insert the group (no course_id column — course inferred from day_number)
    const { status: gs, data: gd } = await db.insert(key, 'groups', [{
      day_number: group.day_number,
      group_number: group.group_number,
      format: group.format,
    }])

    if (gs < 200 || gs >= 300) {
      throw new Error(`Failed to create group ${group.group_number}: HTTP ${gs} — ${JSON.stringify(gd)}`)
    }

    const created = gd as Array<{ id: string }>
    const groupId = created[0].id
    groupIds.push(groupId)

    // Calculate PH from live Supabase CH values
    const chs = group.playerIds.map(pid => chMap.get(pid) ?? 0)
    const minCH = Math.min(...chs)

    // Insert group_players with playing_handicap
    const groupPlayerRows = group.playerIds.map((pid, i) => ({
      group_id: groupId,
      player_id: pid,
      playing_handicap: chs[i] - minCH,
    }))

    const { status: ps } = await db.insert(key, 'group_players', groupPlayerRows)
    if (ps < 200 || ps >= 300) {
      throw new Error(`Failed to create group_players for group ${group.group_number}: HTTP ${ps}`)
    }

    const phList = group.playerIds.map((pid, i) => `${playerName(pid)}:PH${chs[i] - minCH}(CH${chs[i]})`).join(', ')
    console.log(`  ✓ Group ${group.group_number} (${group.format}) — ${phList}`)
  }

  return groupIds
}

async function createMatchesForGroups(key: string, groupIds: string[]): Promise<void> {
  console.log('\n⚔️  Creating matches...')

  // Group 1: Ryan+Mack (USA) vs Kiki+Bruce (Europe) — best_ball_validation
  // Group 2: Matthew+Eric (USA) vs C-Pat+Ben (mixed) — best_ball_validation
  // Group 3: Gary vs Chris (singles), Gary vs Jauch (singles)
  // NOTE: Match player order must correspond to group_players order.
  // We look up group_players to get the correct group_player IDs.

  const matchDefs = [
    {
      groupIdx: 0,
      label: 'Group 1: Ryan+Mack vs Kiki+Bruce',
      format: 'best_ball_validation' as const,
      teamA: [PLAYERS.Ryan, PLAYERS.Mack],
      teamALabel: 'USA',
      teamB: [PLAYERS.Kiki, PLAYERS.Bruce],
      teamBLabel: 'Europe',
    },
    {
      groupIdx: 1,
      label: 'Group 2: Matthew+Eric vs C-Pat+Ben',
      format: 'best_ball_validation' as const,
      teamA: [PLAYERS.Matthew, PLAYERS.Eric],
      teamALabel: 'USA',
      teamB: [PLAYERS.CPat, PLAYERS.Ben],
      teamBLabel: 'Mixed',
    },
    {
      groupIdx: 2,
      label: 'Group 3: Gary vs Chris',
      format: 'singles_match' as const,
      teamA: [PLAYERS.Gary],
      teamALabel: 'Gary',
      teamB: [PLAYERS.Chris],
      teamBLabel: 'Chris',
    },
    {
      groupIdx: 2,
      label: 'Group 3: Gary vs Jauch',
      format: 'singles_match' as const,
      teamA: [PLAYERS.Gary],
      teamALabel: 'Gary',
      teamB: [PLAYERS.Jauch],
      teamBLabel: 'Jauch',
    },
  ]

  for (const def of matchDefs) {
    const groupId = groupIds[def.groupIdx]

    // Insert match (match_number is 1-based index within the group)
    const matchNumber = matchDefs.filter((d, i) => i <= matchDefs.indexOf(def) && d.groupIdx === def.groupIdx).length
    const { status: ms, data: md } = await db.insert(key, 'matches', [{
      group_id: groupId,
      match_number: matchNumber,
      format: def.format,
      team_a_label: def.teamALabel,
      team_b_label: def.teamBLabel,
      team_a_points: 0,
      team_b_points: 0,
      status: 'not_started',
    }])

    if (ms < 200 || ms >= 300) {
      throw new Error(`Failed to create match ${def.label}: HTTP ${ms} — ${JSON.stringify(md)}`)
    }

    const matchId = (md as Array<{ id: string }>)[0].id

    // Insert match_players (side 'a' / 'b', player_id directly)
    const matchPlayerRows = [
      ...def.teamA.map(pid => ({
        match_id: matchId,
        player_id: pid,
        side: 'a',
      })),
      ...def.teamB.map(pid => ({
        match_id: matchId,
        player_id: pid,
        side: 'b',
      })),
    ]

    const { status: mps } = await db.insert(key, 'match_players', matchPlayerRows)
    if (mps < 200 || mps >= 300) {
      throw new Error(`Failed to create match_players for ${def.label}: HTTP ${mps}`)
    }

    console.log(`  ✓ ${def.label}`)
  }
}

// ---------------------------------------------------------------------------
// Verification: fetch and print summary of what was created
// ---------------------------------------------------------------------------

async function verifySeed(key: string): Promise<void> {
  console.log('\n🔍 Verifying seed...')

  const { data: groups } = await supabaseRequest(
    key, 'GET',
    'groups?day_number=eq.1&select=id,group_number,format'
  )
  const { data: gps } = await supabaseRequest(
    key, 'GET',
    'group_players?select=id,group_id,player_id,playing_handicap'
  )
  const { data: matches } = await supabaseRequest(
    key, 'GET',
    'matches?select=id,format,team_a_label,team_b_label'
  )
  const { data: players } = await supabaseRequest(
    key, 'GET',
    'players?select=name,team&order=display_order'
  )

  const gs = groups as Array<{ group_number: number; format: string }>
  const gpsArr = gps as Array<{ group_id: string; playing_handicap: number }>
  const ms = matches as Array<{ format: string; team_a_label: string; team_b_label: string }>
  const ps = players as Array<{ name: string; team: string | null }>

  console.log(`  Groups: ${gs.length} (expected 3)`)
  console.log(`  Group players: ${gpsArr.length} (expected 11)`)
  console.log(`  Matches: ${ms.length} (expected 4)`)

  const usaCount = ps.filter(p => p.team === 'USA').length
  const europeCount = ps.filter(p => p.team === 'Europe').length
  console.log(`  Teams: ${usaCount} USA, ${europeCount} Europe (expected 6 USA, 5 Europe)`)

  const ok = gs.length === 3 && gpsArr.length === 11 && ms.length === 4 && usaCount === 6 && europeCount === 5
  if (ok) {
    console.log('\n✅ Seed verified successfully.')
  } else {
    console.error('\n❌ Seed verification FAILED — counts do not match expected values.')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🏌️  Degen Dudes — Test Data Reset')
  console.log('=' .repeat(40))

  const serviceKey = getServiceKey()

  await resetAllData(serviceKey)
  await setTeamAssignments(serviceKey)
  const groupIds = await createGroups(serviceKey)
  await createMatchesForGroups(serviceKey, groupIds)
  await verifySeed(serviceKey)

  console.log('\nReady for test score entry.')
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
