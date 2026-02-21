import { getCourses, getSettings } from '@/app/actions/data'
import ScoreEntryClient from './ScoreEntryClient'

export default async function ScoresPage() {
  const [courses, settings] = await Promise.all([
    getCourses(),
    getSettings(),
  ])

  return <ScoreEntryClient courses={courses} settings={settings} />
}
