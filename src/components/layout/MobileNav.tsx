'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const baseNavItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/scores', label: 'Scores', icon: '📝' },
  { href: '/scorecards', label: 'Cards', icon: '📋' },
  { href: '/leaderboard', label: 'Board', icon: '🏆' },
  { href: '/matches', label: 'Matches', icon: '⚔️' },
]

const adminNavItem = { href: '/admin', label: 'Admin', icon: '⚙️' }

export default function MobileNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const name = localStorage.getItem('degen_player_name')
    const admins = ['Eric', 'Ben']
    setIsAdmin(admins.includes(name || ''))
  }, [])

  const navItems = isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t pb-safe"
      style={{ background: '#1A1A0A', borderColor: '#2D4A1E' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center w-full h-full rounded-lg transition-colors"
              style={{ color: isActive ? '#D4A947' : '#9A9A50' }}
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
