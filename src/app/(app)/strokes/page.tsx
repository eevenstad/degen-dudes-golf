import { getLeaderboardData, getTeeAssignments } from '@/app/actions/data'
import StrokesClient from './StrokesClient'

export default async function StrokesPage() {
  const [leaderboardData, teeAssignments] = await Promise.all([
    getLeaderboardData(),
    getTeeAssignments(),
  ])

  return (
    <StrokesClient
      players={leaderboardData.players}
      courses={leaderboardData.courses}
      holes={leaderboardData.holes}
      teeAssignments={teeAssignments}
    />
  )
}
