'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { verifyPin } from '@/app/actions/auth'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
        <div className="text-green-400 animate-pulse text-lg">Loading...</div>
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
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-900 to-green-950">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-white">🏌️ Degen Dudes</h1>
          <p className="text-green-300 mt-2 text-lg">Enter PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-yellow-400 border-yellow-400 scale-110'
                  : 'border-green-400'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-red-400 text-sm font-medium animate-pulse">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={loading}
              className="h-16 w-full rounded-xl bg-green-800/60 text-white text-2xl font-bold
                         hover:bg-green-700/80 active:bg-green-600 active:scale-95
                         transition-all duration-100 border border-green-600/30
                         disabled:opacity-50"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="h-16 w-full rounded-xl bg-green-800/40 text-green-300 text-lg font-medium
                       hover:bg-green-700/60 active:bg-green-600 active:scale-95
                       transition-all duration-100 border border-green-600/20
                       disabled:opacity-50"
          >
            ⌫
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="h-16 w-full rounded-xl bg-green-800/60 text-white text-2xl font-bold
                       hover:bg-green-700/80 active:bg-green-600 active:scale-95
                       transition-all duration-100 border border-green-600/30
                       disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="h-16 w-full rounded-xl bg-yellow-500 text-green-900 text-lg font-bold
                       hover:bg-yellow-400 active:bg-yellow-300 active:scale-95
                       transition-all duration-100
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'GO'}
          </button>
        </div>
      </div>
    </main>
  )
}
