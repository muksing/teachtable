// Run teach_actuals column type migration
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mkeryhnjiuwcynfzmive.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXJ5aG5qaXV3Y3luZnptaXZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY0MjYzMiwiZXhwIjoyMDk2MjE4NjMyfQ.nXFQ00ygCzE72izSfd9I1vUGcg65DPePXv3S-EecYEg'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const sql = `
ALTER TABLE teach_actuals
  DROP CONSTRAINT IF EXISTS teach_actuals_planned_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_actual_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_subject_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_term_id_fkey;

ALTER TABLE teach_actuals
  ALTER COLUMN planned_teacher_id TYPE TEXT USING planned_teacher_id::TEXT,
  ALTER COLUMN actual_teacher_id  TYPE TEXT USING actual_teacher_id::TEXT,
  ALTER COLUMN subject_id         TYPE TEXT USING subject_id::TEXT,
  ALTER COLUMN term_id            TYPE TEXT USING term_id::TEXT;
`

const { data, error } = await supabase.rpc('exec_sql', { sql })
if (error) {
  // exec_sql ไม่มี → ลอง REST endpoint แบบอื่น
  console.error('rpc failed:', error.message)
  console.log('Trying direct query via Management API...')

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
} else {
  console.log('Migration OK:', data)
}
