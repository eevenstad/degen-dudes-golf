import { getLeaderboardData } from '@/app/actions/data'
import LeaderboardClient from './LeaderboardClient'
import HelpButton from '@/components/HelpButton'

const leaderboardHelpSections = [
  {
    title: 'Leaderboard',
    content: 'Individual standings rank all 11 players by total net score across all 3 days. Team standings show USA vs Europe match points. Everything updates in real-time as scores are entered.',
  },
]

export default async function LeaderboardPage() {
  const data = await getLeaderboardData()
  return (
    <>
      <LeaderboardClient initialData={data} />
      <HelpButton title="Leaderboard" sections={leaderboardHelpSections} />
    </>
  )
}
