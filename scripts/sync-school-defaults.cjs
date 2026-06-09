const fs = require('fs')
const path = require('path')

function parseArg(name) {
  const prefix = `--${name}=`
  const match = process.argv.find(arg => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ''
}

async function main() {
  const schoolId = parseArg('school-id')
  const term = parseArg('term') || '2568_1'

  if (!schoolId) {
    console.error('Missing required argument: --school-id=<school-id>')
    console.error('Example: npm run sync-school-defaults -- --school-id=demo-school --term=2568_1')
    process.exit(1)
  }

  const defaultsPath = path.resolve(__dirname, 'school-defaults.json')
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'))
  const { getSupabaseAdmin, upsertCompatDoc } = await import('./supabase-admin.js')

  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const basePath = `schools/${schoolId}/terms/${term}`

  const attendanceStatuses = Array.isArray(defaults.attendance_statuses) ? defaults.attendance_statuses : []
  for (const status of attendanceStatuses) {
    if (!status?.status_code) continue
    await upsertCompatDoc(
      supabase,
      `${basePath}/attendance_status_settings/${status.status_code}`,
      {
        ...status,
        updated_at: now,
      }
    )
  }

  const behaviorSettings = Array.isArray(defaults.behavior_settings) ? defaults.behavior_settings : []
  for (const setting of behaviorSettings) {
    if (!setting?.setting_id) continue
    await upsertCompatDoc(
      supabase,
      `${basePath}/behavior_settings/${setting.setting_id}`,
      {
        ...setting,
        updated_at: now,
      }
    )
  }

  console.log(`Synced ${attendanceStatuses.length} attendance statuses for ${schoolId}/${term}`)
  console.log(`Synced ${behaviorSettings.length} behavior settings for ${schoolId}/${term}`)
}

main().catch((error) => {
  console.error('Failed to sync school defaults:', error.message)
  process.exit(1)
})
