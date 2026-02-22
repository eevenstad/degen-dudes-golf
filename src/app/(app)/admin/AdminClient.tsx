'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updatePlayerTeam, updateSetting, updateGroupFormat, createGroup, createMatch } from '@/app/actions/data'
import { logout } from '@/app/actions/auth'
import { getGroupsForDay } from '@/app/actions/data'

interface Player {
  id: string
  name: string
  handicap_index: number
  team: 'USA' | 'Europe' | null
  display_order: number
}

interface Course {
  id: string
  name: string
  day_number: number
  par_total: number
}

interface TeeAssignment {
  id: string
  player_id: string
  course_id: string
  tee_id: string
  course_handicap: number
  players?: { name: string }
  tees?: { name: string; rating: number; slope: number }
  courses?: { name: string; day_number: number }
}

interface GroupData {
  id: string
  group_number: number
  format: string
  day_number?: number
  group_players: {
    id: string
    player_id: string
    playing_handicap: number
    players: { id: string; name: string }
  }[]
}

interface Props {
  players: Player[]
  courses: Course[]
  settings: Record<string, string>
  teeAssignments: TeeAssignment[]
}

type Tab = 'players' | 'groups' | 'matches' | 'tees' | 'settings'

const FORMATS = [
  'best_ball_validation',
  'best_ball',
  'low_total',
  'singles_match',
  'singles_stroke',
]

// Create Group Form Component
function CreateGroupForm({
  courses,
  players,
  onSuccess,
  onCancel,
}: {
  courses: Course[]
  players: Player[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [dayNumber, setDayNumber] = useState(1)
  const [groupNumber, setGroupNumber] = useState(1)
  const [format, setFormat] = useState('best_ball_validation')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const togglePlayer = (pid: string) => {
    setSelectedPlayers(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    )
  }

  const handleSubmit = async () => {
    if (selectedPlayers.length < 2) {
      setError('Select at least 2 players')
      return
    }
    setSaving(true)
    const result = await createGroup({ dayNumber, groupNumber, format, playerIds: selectedPlayers })
    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || 'Failed to create group')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: '#D4A947', background: 'rgba(26,26,10,0.9)' }}>
      <h3 className="font-bold text-lg" style={{ color: '#D4A947' }}>New Group</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Day</label>
          <select
            value={dayNumber}
            onChange={e => setDayNumber(parseInt(e.target.value))}
            className="w-full rounded-lg px-3 py-2 text-sm border text-white"
            style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
          >
            {courses.map(c => (
              <option key={c.id} value={c.day_number}>Day {c.day_number}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Group #</label>
          <select
            value={groupNumber}
            onChange={e => setGroupNumber(parseInt(e.target.value))}
            className="w-full rounded-lg px-3 py-2 text-sm border text-white"
            style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
          >
            {[1, 2, 3].map(n => (
              <option key={n} value={n}>Group {n}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Format</label>
        <select
          value={format}
          onChange={e => setFormat(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm border text-white"
          style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
        >
          {FORMATS.map(f => (
            <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs block mb-2" style={{ color: '#9A9A50' }}>
          Players ({selectedPlayers.length} selected)
        </label>
        <div className="space-y-1.5">
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => togglePlayer(p.id)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all"
              style={{
                background: selectedPlayers.includes(p.id) ? 'rgba(92,92,46,0.4)' : 'rgba(26,58,42,0.3)',
                borderColor: selectedPlayers.includes(p.id) ? '#9A9A50' : '#2D4A1E',
                color: selectedPlayers.includes(p.id) ? '#F5E6C3' : '#9A9A50',
              }}
            >
              <span>{p.name}</span>
              <span className="text-xs">{selectedPlayers.includes(p.id) ? '✓' : '+'}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
          style={{ borderColor: '#2D4A1E', color: '#9A9A50' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          style={{ background: '#D4A947', color: '#1A1A0A' }}
        >
          {saving ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  )
}

// Create Match Form Component
function CreateMatchForm({
  players,
  allGroups,
  onSuccess,
  onCancel,
}: {
  players: Player[]
  allGroups: GroupData[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [groupId, setGroupId] = useState(allGroups[0]?.id || '')
  const [matchNumber, setMatchNumber] = useState(1)
  const [format, setFormat] = useState(allGroups[0]?.format || 'best_ball_validation')
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedGroup = allGroups.find(g => g.id === groupId)
  const groupPlayerIds = selectedGroup?.group_players.map(gp => gp.player_id) || []
  const groupPlayers = players.filter(p => groupPlayerIds.includes(p.id))
  const availablePlayers = groupPlayers.length > 0 ? groupPlayers : players

  const toggleA = (pid: string) => {
    if (teamBPlayers.includes(pid)) return
    setTeamAPlayers(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
  }
  const toggleB = (pid: string) => {
    if (teamAPlayers.includes(pid)) return
    setTeamBPlayers(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
  }

  const handleSubmit = async () => {
    if (!groupId) { setError('Select a group'); return }
    if (teamAPlayers.length === 0 || teamBPlayers.length === 0) {
      setError('Each side needs at least 1 player'); return
    }
    setSaving(true)
    const result = await createMatch({
      groupId,
      matchNumber,
      format,
      teamAPlayerIds: teamAPlayers,
      teamBPlayerIds: teamBPlayers,
    })
    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || 'Failed to create match')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: '#C17A2A', background: 'rgba(26,26,10,0.9)' }}>
      <h3 className="font-bold text-lg" style={{ color: '#E09030' }}>New Match</h3>

      <div>
        <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Group</label>
        <select
          value={groupId}
          onChange={e => {
            setGroupId(e.target.value)
            const g = allGroups.find(g => g.id === e.target.value)
            if (g) setFormat(g.format)
            setTeamAPlayers([])
            setTeamBPlayers([])
          }}
          className="w-full rounded-lg px-3 py-2 text-sm border text-white"
          style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
        >
          {allGroups.map(g => (
            <option key={g.id} value={g.id}>
              Day {g.day_number} · Group {g.group_number} ({g.format.replace(/_/g, ' ')})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Match #</label>
          <select
            value={matchNumber}
            onChange={e => setMatchNumber(parseInt(e.target.value))}
            className="w-full rounded-lg px-3 py-2 text-sm border text-white"
            style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
          >
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>Match {n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: '#9A9A50' }}>Format</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border text-white"
            style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
          >
            {FORMATS.map(f => (
              <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Player assignment */}
      <div>
        <label className="text-xs block mb-2" style={{ color: '#9A9A50' }}>
          Assign players — tap once for Side A, twice for Side B, again to clear
        </label>
        <div className="space-y-1.5">
          {availablePlayers.map(p => {
            const inA = teamAPlayers.includes(p.id)
            const inB = teamBPlayers.includes(p.id)
            return (
              <div key={p.id} className="flex gap-2">
                <button
                  onClick={() => toggleA(p.id)}
                  className="flex-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all"
                  style={{
                    background: inA ? 'rgba(92,92,46,0.5)' : 'rgba(26,58,42,0.3)',
                    borderColor: inA ? '#9A9A50' : '#2D4A1E',
                    color: inA ? '#F5E6C3' : '#9A9A50',
                  }}
                >
                  <span>{p.name}</span>
                  <span className="text-xs">{inA ? '✓ A' : 'A'}</span>
                </button>
                <button
                  onClick={() => toggleB(p.id)}
                  className="flex-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm border transition-all"
                  style={{
                    background: inB ? 'rgba(193,122,42,0.4)' : 'rgba(26,58,42,0.3)',
                    borderColor: inB ? '#C17A2A' : '#2D4A1E',
                    color: inB ? '#F5E6C3' : '#9A9A50',
                  }}
                >
                  <span>{p.name}</span>
                  <span className="text-xs">{inB ? '✓ B' : 'B'}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
          style={{ borderColor: '#2D4A1E', color: '#9A9A50' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          style={{ background: '#C17A2A', color: '#1A1A0A' }}
        >
          {saving ? 'Creating...' : 'Create Match'}
        </button>
      </div>
    </div>
  )
}

export default function AdminClient({ players, courses, settings, teeAssignments }: Props) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('players')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const name = localStorage.getItem('degen_player_name')
    const admins = ['Eric', 'Ben']
    setIsAdmin(admins.includes(name || ''))
  }, [])

  if (isAdmin === null) {
    // Still loading — show nothing to avoid flash
    return null
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-2">Admin Access Required</h1>
        <p style={{ color: '#9A9A50' }}>Only Eric and Ben can access admin settings.</p>
        <Link href="/" className="mt-4 inline-block font-medium" style={{ color: '#D4A947' }}>← Back to Dashboard</Link>
      </div>
    )
  }
  const [message, setMessage] = useState('')
  const [localPlayers, setLocalPlayers] = useState(players)
  const [groupsData, setGroupsData] = useState<Record<number, GroupData[]>>({})
  const [loadingGroups, setLoadingGroups] = useState<number | null>(null)
  const [allGroupsFlat, setAllGroupsFlat] = useState<GroupData[]>([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateMatch, setShowCreateMatch] = useState(false)
  const router = useRouter()

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleTeamChange = async (playerId: string, team: 'USA' | 'Europe' | null) => {
    setSaving(true)
    const result = await updatePlayerTeam(playerId, team)
    if (result.success) {
      showMessage('Team updated')
      setLocalPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team } : p))
      router.refresh()
    } else {
      showMessage(`Error: ${result.error}`)
    }
    setSaving(false)
  }

  const handleSettingChange = async (key: string, value: string) => {
    setSaving(true)
    const result = await updateSetting(key, value)
    if (result.success) {
      showMessage('Setting updated')
      router.refresh()
    } else {
      showMessage(`Error: ${result.error}`)
    }
    setSaving(false)
  }

  const loadGroups = async (day: number) => {
    setLoadingGroups(day)
    const data = await getGroupsForDay(day)
    setGroupsData(prev => {
      const next = { ...prev, [day]: data as unknown as GroupData[] }
      // Rebuild flat list
      const flat: GroupData[] = []
      Object.values(next).forEach(dayGroups => flat.push(...dayGroups))
      setAllGroupsFlat(flat)
      return next
    })
    setLoadingGroups(null)
  }

  const handleFormatChange = async (groupId: string, format: string, day: number) => {
    setSaving(true)
    const result = await updateGroupFormat(groupId, format)
    if (result.success) {
      showMessage('Format updated')
      loadGroups(day)
    } else {
      showMessage(`Error: ${result.error}`)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
    router.refresh()
  }

  const handleGroupCreated = () => {
    setShowCreateGroup(false)
    showMessage('Group created!')
    // Reload groups for all days
    courses.forEach(c => loadGroups(c.day_number))
  }

  const handleMatchCreated = () => {
    setShowCreateMatch(false)
    showMessage('Match created!')
    router.refresh()
  }

  const tabStyle = (t: Tab) => ({
    background: tab === t ? '#D4A947' : 'transparent',
    color: tab === t ? '#1A1A0A' : '#9A9A50',
  })

  return (
    <div className="p-4 space-y-4">
      {/* Status message */}
      {message && (
        <div className={`text-center text-sm py-2 rounded-lg ${
          message.startsWith('Error') ? 'bg-red-900/50 text-red-400' : ''
        }`}
          style={message.startsWith('Error') ? {} : { background: 'rgba(26,58,42,0.8)', color: '#9A9A50' }}
        >
          {message}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: '#1A3A2A' }}>
        {(['players', 'groups', 'matches', 'tees', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              // Auto-load groups when switching to matches tab
              if (t === 'matches' && allGroupsFlat.length === 0) {
                courses.forEach(c => loadGroups(c.day_number))
              }
            }}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all capitalize"
            style={tabStyle(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {tab === 'players' && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold" style={{ color: '#9A9A50' }}>Team Assignments</h3>
          {localPlayers.map(player => (
            <div key={player.id} className="rounded-xl border p-3" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{player.name}</div>
                  <div className="text-xs" style={{ color: '#9A9A50' }}>HI: {player.handicap_index}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleTeamChange(player.id, player.team === 'USA' ? null : 'USA')}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={player.team === 'USA'
                      ? { background: '#5C5C2E', color: '#F5E6C3' }
                      : { background: 'rgba(26,58,42,0.6)', color: '#9A9A50' }
                    }
                  >
                    🫡 USA
                  </button>
                  <button
                    onClick={() => handleTeamChange(player.id, player.team === 'Europe' ? null : 'Europe')}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={player.team === 'Europe'
                      ? { background: '#C17A2A', color: '#F5E6C3' }
                      : { background: 'rgba(26,58,42,0.6)', color: '#9A9A50' }
                    }
                  >
                    🌍 EUR
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups tab */}
      {tab === 'groups' && (
        <div className="space-y-4">
          {/* New Group button */}
          {!showCreateGroup && (
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-full py-3 rounded-xl text-sm font-bold border border-dashed transition-all"
              style={{ borderColor: '#D4A947', color: '#D4A947', background: 'rgba(212,169,71,0.08)' }}
            >
              + New Group
            </button>
          )}
          {showCreateGroup && (
            <CreateGroupForm
              courses={courses}
              players={players}
              onSuccess={handleGroupCreated}
              onCancel={() => setShowCreateGroup(false)}
            />
          )}

          {courses.map(course => (
            <div key={course.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold" style={{ color: '#9A9A50' }}>
                  Day {course.day_number}: {course.name}
                </h3>
                <button
                  onClick={() => loadGroups(course.day_number)}
                  className="text-xs hover:text-yellow-300 transition-colors"
                  style={{ color: '#D4A947' }}
                >
                  {loadingGroups === course.day_number ? 'Loading...' : 'Load Groups'}
                </button>
              </div>
              {groupsData[course.day_number]?.map(group => (
                <div key={group.id} className="rounded-xl border p-3 mb-2" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">Group {group.group_number}</span>
                    <select
                      value={group.format}
                      onChange={(e) => handleFormatChange(group.id, e.target.value, course.day_number)}
                      disabled={saving}
                      className="text-xs rounded px-2 py-1 border"
                      style={{ background: '#1A3A2A', borderColor: '#2D4A1E', color: '#9A9A50' }}
                    >
                      {FORMATS.map(f => (
                        <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.group_players?.map(gp => (
                      <span key={gp.id} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(26,58,42,0.6)', color: '#9A9A50' }}>
                        {gp.players?.name} (PH: {gp.playing_handicap})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!groupsData[course.day_number] && (
                <div className="text-sm py-2" style={{ color: '#2D4A1E' }}>Click &quot;Load Groups&quot; to view</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Matches tab */}
      {tab === 'matches' && (
        <div className="space-y-4">
          {/* New Match button */}
          {!showCreateMatch && (
            <button
              onClick={() => {
                // Load all groups first if not loaded
                if (allGroupsFlat.length === 0) {
                  courses.forEach(c => loadGroups(c.day_number))
                }
                setShowCreateMatch(true)
              }}
              className="w-full py-3 rounded-xl text-sm font-bold border border-dashed transition-all"
              style={{ borderColor: '#C17A2A', color: '#C17A2A', background: 'rgba(193,122,42,0.08)' }}
            >
              + New Match
            </button>
          )}
          {showCreateMatch && (
            <CreateMatchForm
              players={players}
              allGroups={allGroupsFlat}
              onSuccess={handleMatchCreated}
              onCancel={() => setShowCreateMatch(false)}
            />
          )}
          {allGroupsFlat.length === 0 && (
            <p className="text-xs" style={{ color: '#9A9A50' }}>
              Loading groups…
            </p>
          )}
        </div>
      )}

      {/* Tees tab */}
      {tab === 'tees' && (
        <div className="space-y-4">
          {courses.map(course => {
            const courseTAs = teeAssignments.filter(ta => ta.courses?.day_number === course.day_number)
            return (
              <div key={course.id}>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#9A9A50' }}>
                  Day {course.day_number}: {course.name}
                </h3>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#2D4A1E' }}>
                  <div className="grid grid-cols-[1fr_5rem_3rem] gap-2 px-3 py-2 text-xs font-medium" style={{ background: '#1A3A2A', color: '#9A9A50' }}>
                    <span>Player</span>
                    <span>Tee</span>
                    <span className="text-right">CH</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#2D4A1E' }}>
                    {courseTAs.map(ta => (
                      <div key={ta.id} className="grid grid-cols-[1fr_5rem_3rem] gap-2 px-3 py-2 text-sm">
                        <span className="text-white">{ta.players?.name}</span>
                        <span style={{ color: '#9A9A50' }}>{ta.tees?.name}</span>
                        <span className="text-right font-medium" style={{ color: '#D4A947' }}>{ta.course_handicap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold" style={{ color: '#9A9A50' }}>App Settings</h3>
          
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="rounded-xl border p-3" style={{ background: 'rgba(26,58,42,0.4)', borderColor: '#2D4A1E' }}>
              <label className="block text-xs mb-1" style={{ color: '#9A9A50' }}>{key}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={value}
                  onBlur={(e) => {
                    if (e.target.value !== value) {
                      handleSettingChange(key, e.target.value)
                    }
                  }}
                  className="flex-1 rounded-lg px-3 py-2 text-sm border text-white focus:outline-none"
                  style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
                />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t" style={{ borderColor: '#2D4A1E' }}>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl font-bold border transition-all"
              style={{ background: 'rgba(139,26,26,0.2)', color: '#DC2626', borderColor: 'rgba(139,26,26,0.4)' }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
