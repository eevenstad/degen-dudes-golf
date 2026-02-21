import { getPlayers, getCourses, getSettings, getTeeAssignments } from '@/app/actions/data'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const [players, courses, settings, teeAssignments] = await Promise.all([
    getPlayers(),
    getCourses(),
    getSettings(),
    getTeeAssignments(),
  ])

  return (
    <AdminClient
      players={players}
      courses={courses}
      settings={settings}
      teeAssignments={teeAssignments}
    />
  )
}
