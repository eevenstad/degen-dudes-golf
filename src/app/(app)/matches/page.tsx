import { getCourses } from '@/app/actions/data'
import MatchesClient from './MatchesClient'

export default async function MatchesPage() {
  const courses = await getCourses()
  return <MatchesClient courses={courses} />
}
