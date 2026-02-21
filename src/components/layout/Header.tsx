'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()
  
  const getTitle = () => {
    if (pathname === '/') return '🏌️ Degen Dudes'
    if (pathname === '/scores') return '📝 Score Entry'
    if (pathname === '/leaderboard') return '🏆 Leaderboard'
    if (pathname === '/matches') return '⚔️ Matches'
    if (pathname === '/admin') return '⚙️ Admin'
    if (pathname.startsWith('/player/')) return '📊 Player Card'
    return '🏌️ Degen Dudes'
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-green-900 text-white">
      <div className="flex h-14 items-center px-4">
        {pathname !== '/' && (
          <Link href="/" className="mr-3 text-green-300 hover:text-white">
            ←
          </Link>
        )}
        <h1 className="text-lg font-bold">{getTitle()}</h1>
      </div>
    </header>
  )
}
