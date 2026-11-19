// Bắt đầu tải nhạc từ link (chỉ bản local)
export default defineEventHandler(async (event) => {
  const body = await readBody<{ links?: string }>(event)
  const links = cleanLinks(body?.links || '')
  if (!links.length) throw createError({ statusCode: 400, statusMessage: 'Không có link hợp lệ' })
  if (links.length > 20) throw createError({ statusCode: 400, statusMessage: 'Tối đa 20 link mỗi lần' })
  return startJob(links)
})
