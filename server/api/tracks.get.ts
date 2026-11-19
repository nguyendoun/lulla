export default defineEventHandler(async (event) => {
  const { refresh } = getQuery(event)
  const lib = await getLibrary(refresh === '1')
  // Không lộ đường dẫn file ra client
  return lib.map(({ file, ...t }) => t)
})
