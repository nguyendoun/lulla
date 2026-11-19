// Tiến độ một lần tải nhạc
export default defineEventHandler((event) => {
  const job = getJob(getRouterParam(event, 'id')!)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Không thấy lần tải này' })
  return job
})
