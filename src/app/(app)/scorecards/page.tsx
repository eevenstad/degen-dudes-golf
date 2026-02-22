import { getLeaderboardData, getTeeAssignments } from '@/app/actions/data'
import ScorecardsClient from './ScorecardsClient'

export default async function ScorecardsPage() {
  const [leaderboardData, teeAssignments] = await Promise.all([
    getLeaderboardData(),
    getTeeAssignments(),
  ])

  return (
    <ScorecardsClient
      initialData={{
        players: leaderboardData.players,
        courses: leaderboardData.courses,
        holes: leaderboardData.holes,
        scores: leaderboardData.scores,
      }}
      teeAssignments={teeAssignments}
    />
  )
}
