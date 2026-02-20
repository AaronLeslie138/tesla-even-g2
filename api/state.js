const { tessieUrl, getVin, getToken } = require('./_lib')

module.exports = async function handler(req, res) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No Tessie token provided' })

  try {
    const vin = await getVin(token)
    const upstream = await fetch(tessieUrl(`/${vin}/state`, token))
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
