import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'
import OnboardingModal from '@/components/OnboardingModal'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: '#1A1A0A' }}>
      <Header />
      <main className="flex-1 pb-20">
        {children}
      </main>
      <MobileNav />
      <OnboardingModal />
    </div>
  )
}
