'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/scores', label: 'Scores', icon: '📝' },
  { href: '/leaderboard', label: 'Board', icon: '🏆' },
  { href: '/matches', label: 'Matches', icon: '⚔️' },
  { href: '/admin', label: 'Admin', icon: '⚙️' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-800 bg-green-950 pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full rounded-lg
                transition-colors ${
                isActive
                  ? 'text-yellow-400'
                  : 'text-green-400 hover:text-green-200'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
