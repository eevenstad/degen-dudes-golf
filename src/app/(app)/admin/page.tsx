import { getPlayers, getCourses, getSettings, getTeeAssignments } from '@/app/actions/data'
import AdminClient from './AdminClient'
import HelpButton from '@/components/HelpButton'

const adminHelpSections = [
  {
    title: 'Admin',
    content: 'Set up groups and matches before the round. Assign players to groups, set the format (Best Ball, Low + Total, etc.), and assign tees. After the draft on Thursday night, use this page to assign players to USA or Europe teams.',
  },
]

export default async function AdminPage() {
  const [players, courses, settings, teeAssignments] = await Promise.all([
    getPlayers(),
    getCourses(),
    getSettings(),
    getTeeAssignments(),
  ])

  return (
    <>
      <AdminClient
        players={players}
        courses={courses}
        settings={settings}
        teeAssignments={teeAssignments}
      />
      <HelpButton title="Admin" sections={adminHelpSections} />
    </>
  )
}
