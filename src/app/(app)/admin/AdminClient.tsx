'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlayerTeam, updateSetting, updateGroupFormat } from '@/app/actions/data'
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

type Tab = 'players' | 'groups' | 'tees' | 'settings'

const FORMATS = [
  'best_ball_validation',
  'best_ball',
  'low_total',
  'singles_match',
  'singles_stroke',
]

export default function AdminClient({ players, courses, settings, teeAssignments }: Props) {
  const [tab, setTab] = useState<Tab>('players')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [groupsData, setGroupsData] = useState<Record<number, GroupData[]>>({})
  const [loadingGroups, setLoadingGroups] = useState<number | null>(null)
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
    setGroupsData(prev => ({ ...prev, [day]: data as unknown as GroupData[] }))
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

  return (
    <div className="p-4 space-y-4">
      {/* Status message */}
      {message && (
        <div className={`text-center text-sm py-2 rounded-lg ${
          message.startsWith('Error') ? 'bg-red-900/50 text-red-400' : 'bg-green-800 text-green-300'
        }`}>
          {message}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-green-900 rounded-xl p-1">
        {(['players', 'groups', 'tees', 'settings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-yellow-500 text-green-900' : 'text-green-300 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {tab === 'players' && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-green-300">Team Assignments</h3>
          {players.map(player => (
            <div key={player.id} className="rounded-xl bg-green-800/50 border border-green-700/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{player.name}</div>
                  <div className="text-xs text-green-400">HI: {player.handicap_index}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleTeamChange(player.id, player.team === 'USA' ? null : 'USA')}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      player.team === 'USA'
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-700 text-green-400 hover:bg-blue-500/20'
                    }`}
                  >
                    🇺🇸 USA
                  </button>
                  <button
                    onClick={() => handleTeamChange(player.id, player.team === 'Europe' ? null : 'Europe')}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      player.team === 'Europe'
                        ? 'bg-red-500 text-white'
                        : 'bg-green-700 text-green-400 hover:bg-red-500/20'
                    }`}
                  >
                    🇪🇺 EUR
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
          {courses.map(course => (
            <div key={course.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-green-300">
                  Day {course.day_number}: {course.name}
                </h3>
                <button
                  onClick={() => loadGroups(course.day_number)}
                  className="text-xs text-yellow-400 hover:text-yellow-300"
                >
                  {loadingGroups === course.day_number ? 'Loading...' : 'Load Groups'}
                </button>
              </div>
              {groupsData[course.day_number]?.map(group => (
                <div key={group.id} className="rounded-xl bg-green-800/50 border border-green-700/50 p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">Group {group.group_number}</span>
                    <select
                      value={group.format}
                      onChange={(e) => handleFormatChange(group.id, e.target.value, course.day_number)}
                      disabled={saving}
                      className="bg-green-700 text-green-200 text-xs rounded px-2 py-1 border border-green-600"
                    >
                      {FORMATS.map(f => (
                        <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.group_players?.map(gp => (
                      <span key={gp.id} className="text-xs px-2 py-0.5 rounded bg-green-700/50 text-green-200">
                        {gp.players?.name} (PH: {gp.playing_handicap})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!groupsData[course.day_number] && (
                <div className="text-sm text-green-600 py-2">Click &quot;Load Groups&quot; to view</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tees tab */}
      {tab === 'tees' && (
        <div className="space-y-4">
          {courses.map(course => {
            const courseTAs = teeAssignments.filter(ta => ta.courses?.day_number === course.day_number)
            return (
              <div key={course.id}>
                <h3 className="text-lg font-bold text-green-300 mb-2">
                  Day {course.day_number}: {course.name}
                </h3>
                <div className="rounded-xl border border-green-800 overflow-hidden">
                  <div className="bg-green-900 grid grid-cols-[1fr_5rem_3rem] gap-2 px-3 py-2 text-xs font-medium text-green-400">
                    <span>Player</span>
                    <span>Tee</span>
                    <span className="text-right">CH</span>
                  </div>
                  <div className="divide-y divide-green-800/50">
                    {courseTAs.map(ta => (
                      <div key={ta.id} className="grid grid-cols-[1fr_5rem_3rem] gap-2 px-3 py-2 text-sm">
                        <span className="text-white">{ta.players?.name}</span>
                        <span className="text-green-300">{ta.tees?.name}</span>
                        <span className="text-right text-yellow-400 font-medium">{ta.course_handicap}</span>
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
          <h3 className="text-lg font-bold text-green-300">App Settings</h3>
          
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-green-800/50 border border-green-700/50 p-3">
              <label className="block text-xs text-green-400 mb-1">{key}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={value}
                  onBlur={(e) => {
                    if (e.target.value !== value) {
                      handleSettingChange(key, e.target.value)
                    }
                  }}
                  className="flex-1 bg-green-700 text-white rounded-lg px-3 py-2 text-sm border border-green-600
                             focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-green-800">
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-bold
                         hover:bg-red-500/30 transition-all border border-red-500/30"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
