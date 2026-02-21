import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-green-950 text-white">
      <Header />
      <main className="flex-1 pb-20">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
