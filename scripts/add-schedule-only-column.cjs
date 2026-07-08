const https = require('https')
const path  = require('path')
const fs    = require('fs')

const envPath = path.join(__dirname, '..', '.env')
const env = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
})

const PROJECT_REF = 'mkeryhnjiuwcynfzmive'
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const SQL = `ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_schedule_only BOOLEAN NOT NULL DEFAULT FALSE;`

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
  const r1 = await post(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`, { sql: SQL }, SERVICE_KEY)
  if (r1.status === 200) { console.log('✅ is_schedule_only column added to classes'); return }

  const r2 = await post(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/pg_query`, { query: SQL }, SERVICE_KEY)
  if (r2.status === 200) { console.log('✅ is_schedule_only column added to classes'); return }

  const r3 = await post(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    { query: SQL },
    SERVICE_KEY
  )
  if (r3.status === 200 || r3.status === 201) { console.log('✅ is_schedule_only column added via mgmt API'); return }

  console.log('❌ Auto migration failed. Run this SQL in Supabase SQL editor:')
  console.log('https://supabase.com/dashboard/project/' + PROJECT_REF + '/editor')
  console.log('\n' + SQL)
}

main().catch(console.error)
