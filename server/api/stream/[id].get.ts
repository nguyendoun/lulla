import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const track = await findTrack(id)
  if (!track) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy bài hát' })

  const full = path.join(musicRoot(), track.file)
  const { size } = await fs.stat(full)
  const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream'

  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Content-Type', type)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')

  // Hỗ trợ Range → tua nhạc tức thì, không phải tải lại từ đầu
  const range = getHeader(event, 'range')
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    let start = m?.[1] ? parseInt(m[1], 10) : 0
    let end = m?.[2] ? parseInt(m[2], 10) : size - 1
    if (!m?.[1] && m?.[2]) {
      // bytes=-500 → 500 byte cuối
      start = Math.max(0, size - parseInt(m[2], 10))
      end = size - 1
    }
    if (start >= size || end >= size || start > end) {
      setResponseStatus(event, 416)
      setHeader(event, 'Content-Range', `bytes */${size}`)
      return ''
    }
    setResponseStatus(event, 206)
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
    setHeader(event, 'Content-Length', end - start + 1)
    return sendStream(event, createReadStream(full, { start, end }))
  }

  setHeader(event, 'Content-Length', size)
  return sendStream(event, createReadStream(full))
})
