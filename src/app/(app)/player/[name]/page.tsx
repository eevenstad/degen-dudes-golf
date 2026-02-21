export default async function PlayerPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold">Player: {decodeURIComponent(name)}</h1>
      <p className="text-muted-foreground">Scorecard coming soon...</p>
    </main>
  )
}
