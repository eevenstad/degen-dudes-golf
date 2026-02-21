'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function verifyPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'app_pin')
      .single()

    if (error || !data) {
      return { success: false, error: 'Could not verify PIN' }
    }

    if (data.value !== pin) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Set auth cookie
    const cookieStore = await cookies()
    cookieStore.set('degen-auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return { success: true }
  } catch {
    return { success: false, error: 'An error occurred' }
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('degen-auth')
}
