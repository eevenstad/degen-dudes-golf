import { getCourses } from '@/app/actions/data'
import MatchesClient from './MatchesClient'
import HelpButton from '@/components/HelpButton'

const matchesHelpSections = [
  {
    title: 'Match Results',
    content: 'Shows hole-by-hole results for each group\'s match. Select a day to see that day\'s matches. Each match card shows the format, players, and running score. Tap a match to see the full hole-by-hole breakdown.',
  },
  {
    title: 'How the Formats Work',
    content: (
      <div className="space-y-4 text-sm" style={{ color: '#F5E6C3' }}>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>Best Ball + Validation</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Low net score in the group wins a point for their team. If two players tie for low score, the tiebreaker is the lower score between the other two players. If that&apos;s also tied, no point is awarded.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>Best Ball</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Low net score wins the hole for their team. Ties = no point.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>Low Ball + Total</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Two points per hole. One for the low ball (lowest net score). One for the low total (lowest combined net score per team). Teams can split points.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>Singles Match Play</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Head-to-head. Lower net score wins the hole. Most holes won after 18 wins the match.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>Singles Stroke Play</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Head-to-head. Lower total net score across all 18 holes wins the match.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1" style={{ color: '#D4A947' }}>About Net Scores</p>
          <p className="leading-relaxed" style={{ color: '#9A9A50' }}>
            Your net score = gross score minus your handicap strokes on that hole. The app handles all calculations automatically.
          </p>
        </div>
      </div>
    ),
  },
]

export default async function MatchesPage() {
  const courses = await getCourses()
  return (
    <>
      <MatchesClient courses={courses} />
      <HelpButton title="Match Results" sections={matchesHelpSections} />
    </>
  )
}
