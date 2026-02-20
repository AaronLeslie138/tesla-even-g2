const { tessieUrl, getVin, getToken } = require('./_lib')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No Tessie token provided' })

  try {
    const vin = await getVin(token)
    const cmd = req.url.replace(/^\/api\/command\//, '').split('?')[0]
    const path = cmd === 'wake' ? `/${vin}/wake` : `/${vin}/command/${cmd}`
    let url = tessieUrl(path, token)

    // Forward client query params to Tessie
    const qsIndex = req.url.indexOf('?')
    if (qsIndex !== -1) {
      const params = new URLSearchParams(req.url.slice(qsIndex + 1))
      for (const [key, value] of params) {
        url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      }
    }

    const upstream = await fetch(url, { method: 'POST' })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
