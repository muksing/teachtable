// Drop FK constraint on behavior_logs.recorded_by
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mkeryhnjiuwcynfzmive.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXJ5aG5qaXV3Y3luZnptaXZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY0MjYzMiwiZXhwIjoyMDk2MjE4NjMyfQ.nXFQ00ygCzE72izSfd9I1vUGcg65DPePXv3S-EecYEg'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const sql = `
ALTER TABLE behavior_logs
  DROP CONSTRAINT IF EXISTS behavior_logs_recorded_by_fkey;

ALTER TABLE behavior_logs
  ALTER COLUMN recorded_by DROP NOT NULL;
`

const res = await fetch(
  `https://api.supabase.com/v1/projects/mkeryhnjiuwcynfzmive/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)
const result = await res.json()
console.log('Result:', JSON.stringify(result, null, 2))
