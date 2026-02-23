import { getCourses, getDaysWithData, getSummaryData } from '@/app/actions/data'
import SummaryClient from './SummaryClient'

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const params = await searchParams
  const [courses, daysWithData] = await Promise.all([getCourses(), getDaysWithData()])

  // Determine which day to show
  const requestedDay = params.day ? parseInt(params.day) : null
  const defaultDay = daysWithData.length > 0 ? Math.max(...daysWithData) : 1
  const selectedDay = requestedDay ?? defaultDay

  // Load summary data for the selected day
  const summary = daysWithData.includes(selectedDay)
    ? await getSummaryData(selectedDay)
    : null

  return (
    <SummaryClient
      courses={courses}
      daysWithData={daysWithData}
      selectedDay={selectedDay}
      summary={summary}
    />
  )
}
