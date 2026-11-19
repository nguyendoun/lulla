import path from 'node:path'
import { parseFile } from 'music-metadata'

// Cache ảnh bìa trong RAM (giới hạn số lượng cho nhẹ)
const covers = new Map<string, { data: Uint8Array; format: string }>()
const MAX = 300

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  let cover = covers.get(id)
  if (!cover) {
    const track = await findTrack(id)
    if (!track?.hasCover) throw createError({ statusCode: 404 })
    const meta = await parseFile(path.join(musicRoot(), track.file), { skipPostHeaders: true })
    const pic = meta.common.picture?.[0]
    if (!pic) throw createError({ statusCode: 404 })
    cover = { data: pic.data, format: pic.format || 'image/jpeg' }
    if (covers.size >= MAX) covers.delete(covers.keys().next().value!)
    covers.set(id, cover)
  }
  setHeader(event, 'Content-Type', cover.format)
  setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
  return Buffer.from(cover.data)
})
