import { getLeaderboardData } from '@/app/actions/data'
import LeaderboardClient from './LeaderboardClient'

export default async function LeaderboardPage() {
  const data = await getLeaderboardData()
  return <LeaderboardClient initialData={data} />
}
