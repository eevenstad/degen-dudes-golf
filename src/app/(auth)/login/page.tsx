'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { verifyPin } from '@/app/actions/auth'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#1A1A0A' }}>
        <div className="animate-pulse text-lg" style={{ color: '#9A9A50' }}>Loading...</div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDigit = useCallback((digit: string) => {
    setError('')
    setPin(prev => {
      if (prev.length >= 6) return prev
      return prev + digit
    })
  }, [])

  const handleDelete = useCallback(() => {
    setError('')
    setPin(prev => prev.slice(0, -1))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setError('Enter at least 4 digits')
      return
    }
    setLoading(true)
    const result = await verifyPin(pin)
    if (result.success) {
      const redirect = searchParams.get('redirect') || '/'
      router.push(redirect)
      router.refresh()
    } else {
      setError(result.error || 'Invalid PIN')
      setPin('')
      setLoading(false)
    }
  }, [pin, router, searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, #1A3A2A, #1A1A0A)' }}>
      <div className="w-full max-w-sm space-y-7 text-center">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo.png"
              alt="The Desert Duel"
              width={140}
              height={140}
              className="rounded-2xl shadow-2xl"
            />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-wide" style={{ color: '#D4A947' }}>
              The Desert Duel
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: '#9A9A50' }}>
              Palm Springs 2026
            </p>
          </div>
        </div>

        <p className="text-sm" style={{ color: '#9A9A50' }}>Enter PIN to continue</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all"
              style={{
                background: i < pin.length ? '#D4A947' : 'transparent',
                borderColor: i < pin.length ? '#D4A947' : '#2D4A1E',
                transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm font-medium animate-pulse" style={{ color: '#DC2626' }}>{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={loading}
              className="h-16 w-full rounded-xl text-2xl font-bold transition-all duration-100 active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(26,58,42,0.8)', color: '#F5E6C3', border: '1px solid #2D4A1E' }}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="h-16 w-full rounded-xl text-lg font-medium transition-all duration-100 active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(26,58,42,0.5)', color: '#9A9A50', border: '1px solid #2D4A1E' }}
          >
            ⌫
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="h-16 w-full rounded-xl text-2xl font-bold transition-all duration-100 active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(26,58,42,0.8)', color: '#F5E6C3', border: '1px solid #2D4A1E' }}
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="h-16 w-full rounded-xl text-lg font-bold transition-all duration-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#D4A947', color: '#1A1A0A' }}
          >
            {loading ? '...' : 'GO'}
          </button>
        </div>
      </div>
    </main>
  )
}
