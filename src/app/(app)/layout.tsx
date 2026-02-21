export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Protected layout wrapper — auth check coming in Phase 2 */}
      {children}
    </div>
  )
}
