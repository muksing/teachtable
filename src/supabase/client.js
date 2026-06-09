import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key'

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase URL or Key is missing. Check your .env file and restart the dev server.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

