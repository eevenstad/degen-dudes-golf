'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

const PLAYERS = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch']
const STORAGE_KEY = 'degen_player_name'

// Pages where onboarding modal should NOT appear
const EXCLUDED_PATHS = ['/admin']

export default function OnboardingModal() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Don't show on excluded pages (admin)
    if (EXCLUDED_PATHS.some(p => pathname?.startsWith(p))) {
      return
    }
    // Check if already completed onboarding
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        setShow(true)
      }
    } catch {
      // localStorage not available (SSR guard)
    }
  }, [pathname])

  const complete = (name: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, name)
    } catch {
      // ignore
    }
    setShow(false)
  }

  const handleSkip = () => {
    complete('guest')
  }

  const handleStartPlaying = () => {
    complete(selectedPlayer ?? 'guest')
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#1A3A2A', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Skip button — always visible in top right */}
        <div className="flex justify-end px-5 pt-4">
          <button
            onClick={handleSkip}
            className="text-xs px-3 py-1 rounded-full"
            style={{ color: '#9A9A50', background: 'rgba(26,26,10,0.5)' }}
          >
            Skip
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-8">
          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              <Image
                src="/assets/logo.png"
                alt="The Desert Duel"
                width={100}
                height={100}
                className="rounded-2xl shadow-lg shadow-black/50"
              />
              <div>
                <h1 className="text-2xl font-black" style={{ color: '#D4A947' }}>
                  Welcome to The Desert Duel
                </h1>
                <p className="text-base font-bold mt-1" style={{ color: '#9A9A50' }}>
                  Palm Springs 2026
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#F5E6C3' }}>
                Your mobile scorecard for 3 days, 3 courses, and 11 dudes who take golf way too seriously.
              </p>
              <button
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl font-bold text-lg mt-4 active:scale-[0.98] transition-all"
                style={{ background: '#D4A947', color: '#1A1A0A' }}
              >
                Let&apos;s Go →
              </button>
            </div>
          )}

          {/* STEP 2: Who Are You? */}
          {step === 2 && (
            <div className="space-y-4 pt-2">
              <div className="text-center">
                <h2 className="text-2xl font-black" style={{ color: '#D4A947' }}>
                  Who are you?
                </h2>
                <p className="text-sm mt-1" style={{ color: '#9A9A50' }}>
                  We&apos;ll remember your name so you don&apos;t have to find your group every time.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {PLAYERS.map(name => {
                  const isSelected = selectedPlayer === name
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedPlayer(isSelected ? null : name)}
                      className="py-3 px-2 rounded-xl font-bold text-sm active:scale-95 transition-all border"
                      style={isSelected
                        ? { background: '#D4A947', color: '#1A1A0A', borderColor: '#D4A947' }
                        : { background: 'rgba(26,26,10,0.6)', color: '#F5E6C3', borderColor: '#2D4A1E' }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setStep(3)}
                disabled={!selectedPlayer}
                className="w-full py-4 rounded-2xl font-bold text-lg mt-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#D4A947', color: '#1A1A0A' }}
              >
                Continue →
              </button>

              <div className="text-center">
                <button
                  onClick={handleSkip}
                  className="text-sm"
                  style={{ color: '#5C5C2E' }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Quick Tour */}
          {step === 3 && (
            <div className="space-y-5 pt-2">
              <div className="text-center">
                <h2 className="text-2xl font-black" style={{ color: '#D4A947' }}>
                  Here&apos;s how it works
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'rgba(26,26,10,0.5)', borderColor: '#2D4A1E' }}>
                  <span className="text-2xl flex-shrink-0">📝</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#F5E6C3' }}>Scores</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      Enter your group&apos;s gross scores hole by hole. Net scores calculate automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'rgba(26,26,10,0.5)', borderColor: '#2D4A1E' }}>
                  <span className="text-2xl flex-shrink-0">🏆</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#F5E6C3' }}>Leaderboard</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      Individual standings and USA vs Europe team score, updated live.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'rgba(26,26,10,0.5)', borderColor: '#2D4A1E' }}>
                  <span className="text-2xl flex-shrink-0">⚔️</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#F5E6C3' }}>Matches</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      See hole-by-hole match results for each group by day.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'rgba(26,26,10,0.5)', borderColor: '#2D4A1E' }}>
                  <span className="text-2xl flex-shrink-0">⚙️</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#F5E6C3' }}>Admin</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9A9A50' }}>
                      Set up groups, assign players, manage settings (admin use).
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartPlaying}
                className="w-full py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition-all"
                style={{ background: '#D4A947', color: '#1A1A0A' }}
              >
                Start Playing
              </button>
            </div>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-2 mt-5">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: s === step ? '#D4A947' : '#2D4A1E' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
