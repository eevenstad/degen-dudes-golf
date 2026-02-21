'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()
  
  const getTitle = () => {
    if (pathname === '/') return '🏜️ The Desert Duel'
    if (pathname === '/scores') return '📝 Score Entry'
    if (pathname === '/leaderboard') return '🏆 Leaderboard'
    if (pathname === '/matches') return '⚔️ Matches'
    if (pathname === '/admin') return '⚙️ Admin'
    if (pathname === '/history') return '📋 Score History'
    if (pathname.startsWith('/player/')) return '📊 Player Card'
    return '🏜️ The Desert Duel'
  }

  return (
    <header
      className="sticky top-0 z-50 border-b text-white"
      style={{ background: '#1A3A2A', borderColor: '#2D4A1E' }}
    >
      <div className="flex h-14 items-center px-4">
        {pathname !== '/' && (
          <Link href="/" className="mr-3 transition-colors" style={{ color: '#9A9A50' }}>
            ←
          </Link>
        )}
        <h1 className="text-lg font-bold" style={{ color: pathname === '/' ? '#D4A947' : '#F5E6C3' }}>
          {getTitle()}
        </h1>
      </div>
    </header>
  )
}
