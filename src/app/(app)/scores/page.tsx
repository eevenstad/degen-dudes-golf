import { getCourses, getSettings } from '@/app/actions/data'
import ScoreEntryClient from './ScoreEntryClient'
import HelpButton from '@/components/HelpButton'

const scoresHelpSections = [
  {
    title: 'Entering Scores',
    content: 'Select your day and group, then enter each player\'s gross score hole by hole. Net scores calculate automatically based on each player\'s handicap. Tap Save after each hole. Use the Undo button if you make a mistake. Your group is saved so you don\'t have to reselect it each time.',
  },
]

export default async function ScoresPage() {
  const [courses, settings] = await Promise.all([
    getCourses(),
    getSettings(),
  ])

  return (
    <>
      <ScoreEntryClient courses={courses} settings={settings} />
      <HelpButton title="Entering Scores" sections={scoresHelpSections} />
    </>
  )
}
