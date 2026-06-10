import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mkeryhnjiuwcynfzmive.supabase.co'
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXJ5aG5qaXV3Y3luZnptaXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDI2MzIsImV4cCI6MjA5NjIxODYzMn0.p1dp60wdapQ6Rj6X8ZU5UblWo4ji90J3A2DPhT2ORBs'

export const supabase = createClient(supabaseUrl, supabaseKey)

