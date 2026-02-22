'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()

  // No header on home page — the dashboard has its own branding
  if (pathname === '/') return null
  
  const getTitle = () => {
    if (pathname === '/scores') return '📝 Score Entry'
    if (pathname === '/leaderboard') return '🏆 Leaderboard'
    if (pathname === '/matches') return '⚔️ Matches'
    if (pathname === '/admin') return '⚙️ Admin'
    if (pathname === '/history') return '📋 Score History'
    if (pathname === '/scorecards') return '📋 Live Scorecards'
    if (pathname === '/strokes') return '🎯 Stroke Chart'
    if (pathname.startsWith('/player/')) return '📊 Player Card'
    return '🏜️ The Desert Duel'
  }

  return (
    <header
      className="sticky top-0 z-50 border-b text-white"
      style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
    >
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="mr-3 transition-colors" style={{ color: '#9A9A50' }}>
          ←
        </Link>
        <h1 className="text-lg font-bold" style={{ color: '#F5E6C3' }}>
          {getTitle()}
        </h1>
      </div>
    </header>
  )
}
