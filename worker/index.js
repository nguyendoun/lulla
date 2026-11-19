// Phục vụ file tĩnh; riêng /media/* hỗ trợ HTTP Range để tua nhạc
export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const range = req.headers.get('range')
    if (!url.pathname.startsWith('/media/') || !range) return env.ASSETS.fetch(req)

    const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }))
    if (res.status !== 200) return res
    const buf = await res.arrayBuffer()
    const size = buf.byteLength
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    let start = m?.[1] ? parseInt(m[1], 10) : 0
    let end = m?.[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1
    if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1 }
    const headers = new Headers(res.headers)
    headers.set('Accept-Ranges', 'bytes')
    if (!m || start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    headers.set('Content-Length', String(end - start + 1))
    return new Response(req.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers })
  },
}
