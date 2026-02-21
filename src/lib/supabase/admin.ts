import { createClient } from '@supabase/supabase-js'

// Admin client uses service role key — bypasses RLS
// Only use in server actions / API routes, NEVER expose to client
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
