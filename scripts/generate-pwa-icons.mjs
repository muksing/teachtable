// สร้าง PNG icons สำหรับ PWA โดยไม่ต้องใช้ external library
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = (c >>> 8) ^ crcTable[(c ^ b) & 0xff]
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const tb  = Buffer.from(type, 'ascii')
  const cv  = Buffer.alloc(4); cv.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([len, tb, data, cv])
}

function makePNG(size, drawFn) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  const scanBytes = 1 + size * 3
  const raw = Buffer.alloc(size * scanBytes, 0)
  for (let y = 0; y < size; y++) {
    raw[y * scanBytes] = 0 // filter None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size)
      raw[y * scanBytes + 1 + x * 3]     = r
      raw[y * scanBytes + 1 + x * 3 + 1] = g
      raw[y * scanBytes + 1 + x * 3 + 2] = b
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// วาด icon: พื้นหลังม่วง + ตัว T สีขาว
function drawIcon(x, y, size) {
  const s = size
  const pad = Math.round(s * 0.1)
  const r   = Math.round(s * 0.18) // corner radius

  // rounded-rect fill check
  function inRect(px, py) {
    const l = pad, t = pad, ri = s - pad, bo = s - pad
    if (px < l || px >= ri || py < t || py >= bo) return false
    // corners
    if (px < l + r && py < t + r) return Math.hypot(px - (l+r), py - (t+r)) < r
    if (px >= ri - r && py < t + r) return Math.hypot(px - (ri-r), py - (t+r)) < r
    if (px < l + r && py >= bo - r) return Math.hypot(px - (l+r), py - (bo-r)) < r
    if (px >= ri - r && py >= bo - r) return Math.hypot(px - (ri-r), py - (bo-r)) < r
    return true
  }

  if (!inRect(x, y)) return [255, 255, 255] // transparent (white bg)

  // draw letter T (white)
  const cx = Math.round(s / 2)
  const tw  = Math.round(s * 0.5)   // top bar width
  const th  = Math.round(s * 0.12)  // top bar height
  const sw2 = Math.round(s * 0.1)   // stem width
  const ty  = Math.round(s * 0.28)  // top of T
  const by  = Math.round(s * 0.72)  // bottom of T
  const lx  = cx - Math.round(tw / 2), rx = cx + Math.round(tw / 2)

  const inTopBar = x >= lx && x <= rx && y >= ty && y <= ty + th
  const inStem   = x >= cx - Math.round(sw2/2) && x <= cx + Math.round(sw2/2) && y >= ty && y <= by

  if (inTopBar || inStem) return [255, 255, 255]

  return [109, 40, 217]  // purple #6d28d9
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', makePNG(192, drawIcon))
writeFileSync('public/icons/icon-512.png', makePNG(512, drawIcon))
writeFileSync('public/icons/apple-touch-icon.png', makePNG(180, drawIcon))
console.log('✅ PWA icons generated: public/icons/')
