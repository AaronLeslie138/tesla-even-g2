let vin = null

function tessieUrl(path, token) {
  return `https://api.tessie.com${path}?access_token=${token}`
}

async function discoverVin(token) {
  const res = await fetch(tessieUrl('/vehicles', token))
  if (!res.ok) throw new Error(`Failed to list vehicles: ${res.status}`)
  const data = await res.json()
  const first = data.results?.[0]
  if (!first) throw new Error('No vehicles found on this Tessie account')
  return first.vin
}

async function getVin(token) {
  if (!vin) vin = await discoverVin(token)
  return vin
}

function getToken(req) {
  return req.headers['x-tessie-token']
}

module.exports = { tessieUrl, getVin, getToken }
