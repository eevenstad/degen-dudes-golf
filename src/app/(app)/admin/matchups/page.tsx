import { getPlayers, getSettings, getTeeAssignments } from '@/app/actions/data'
import { getIslandAssignments } from '@/app/actions/island'
import { getDay3Status } from '@/app/actions/matchups'
import MatchupBuilderClient from './MatchupBuilderClient'

export default async function Day3MatchupsPage() {
  const [players, settings, teeAssignments, islandAssignments, day3Status] = await Promise.all([
    getPlayers(),
    getSettings(),
    getTeeAssignments(),
    getIslandAssignments(),
    getDay3Status(),
  ])

  return (
    <MatchupBuilderClient
      players={players}
      settings={settings}
      teeAssignments={teeAssignments}
      islandAssignments={islandAssignments}
      day3Status={day3Status}
    />
  )
}
