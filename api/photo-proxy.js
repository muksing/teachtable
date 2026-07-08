// Vercel serverless function — proxy Google Drive images with CORS headers
// Used by face-api.js to compare selfie vs profile photo cross-origin
export default async function handler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'no url' })

  const decoded = decodeURIComponent(url)
  // Safety check: only proxy Google Drive / GAS URLs
  if (!decoded.includes('drive.google.com') && !decoded.includes('script.google.com')) {
    return res.status(403).json({ error: 'forbidden source' })
  }

  try {
    const upstream = await fetch(decoded, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'upstream error' })

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const ct = upstream.headers.get('content-type') || 'image/jpeg'

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
