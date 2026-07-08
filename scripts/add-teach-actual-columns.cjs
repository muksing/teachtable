// Run: node scripts/add-teach-actual-columns.cjs
const https = require('https')
const path  = require('path')
const fs    = require('fs')

// load .env manually
const envPath = path.join(__dirname, '..', '.env')
const env = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
})

const PROJECT_REF = 'mkeryhnjiuwcynfzmive'
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env'); process.exit(1) }

const SQL = `
ALTER TABLE teach_actuals
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_records JSONB DEFAULT '{}';
`

async function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`,
        'apikey':        token,
      }
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch { resolve({ status: res.statusCode, data: body }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`
  console.log('Attempting via exec_sql RPC...')
  const r1 = await post(url, { sql: SQL }, SERVICE_KEY)
  if (r1.status === 200) {
    console.log('✅ Columns added via exec_sql')
    return
  }
  console.log(`exec_sql failed (${r1.status}):`, JSON.stringify(r1.data))

  // Try pg_query
  const url2 = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/pg_query`
  const r2 = await post(url2, { query: SQL }, SERVICE_KEY)
  if (r2.status === 200) {
    console.log('✅ Columns added via pg_query')
    return
  }
  console.log(`pg_query failed (${r2.status}):`, JSON.stringify(r2.data))

  console.log('\n❌ Cannot add columns automatically.')
  console.log('Please run this SQL in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/mkeryhnjiuwcynfzmive/editor')
  console.log('\n' + SQL)
}

main().catch(console.error)
