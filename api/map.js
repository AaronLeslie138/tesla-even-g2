const sharp = require('sharp')
const { tessieUrl, getVin, getToken } = require('./_lib')

const TILE_SIZE = 256
const MAP_ZOOM = 15
const MAP_WIDTH = 200
const MAP_HEIGHT = 100

function latLngToTileXY(lat, lng, zoom) {
  const n = 2 ** zoom
  const x = ((lng + 180) / 360) * n
  const y = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  return { x, y }
}

function tileUrl(tx, ty, zoom) {
  return `https://basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`
}

async function fetchTile(tx, ty, zoom) {
  const res = await fetch(tileUrl(tx, ty, zoom), {
    headers: { 'User-Agent': 'tesla-even-g2/1.0' },
  })
  if (!res.ok) throw new Error(`Tile fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function makeMarkerSvg() {
  const svg = `<svg width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" fill="none" stroke="white" stroke-width="2"/>
    <circle cx="7" cy="7" r="2" fill="white"/>
  </svg>`
  return Buffer.from(svg)
}

async function renderMap(lat, lng) {
  const { x: fx, y: fy } = latLngToTileXY(lat, lng, MAP_ZOOM)
  const centerTileX = Math.floor(fx)
  const centerTileY = Math.floor(fy)

  const tiles = []
  const fetches = []

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = centerTileX + dx
      const ty = centerTileY + dy
      fetches.push(
        fetchTile(tx, ty, MAP_ZOOM).then((buf) => {
          tiles.push({ buf, tx, ty })
        })
      )
    }
  }

  await Promise.all(fetches)

  const rows = []
  for (let dy = -1; dy <= 1; dy++) {
    const rowTiles = [-1, 0, 1].map((dx) => {
      const t = tiles.find((t) => t.tx === centerTileX + dx && t.ty === centerTileY + dy)
      return t.buf
    })
    const resized = await Promise.all(
      rowTiles.map((buf) => sharp(buf).resize(TILE_SIZE, TILE_SIZE).toBuffer())
    )
    rows.push(
      await sharp(resized[0])
        .extend({ right: TILE_SIZE * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .composite([
          { input: resized[1], left: TILE_SIZE, top: 0 },
          { input: resized[2], left: TILE_SIZE * 2, top: 0 },
        ])
        .toBuffer()
    )
  }

  const grid = await sharp(rows[0])
    .extend({ bottom: TILE_SIZE * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([
      { input: rows[1], left: 0, top: TILE_SIZE },
      { input: rows[2], left: 0, top: TILE_SIZE * 2 },
    ])
    .toBuffer()

  const carPixelX = (fx - (centerTileX - 1)) * TILE_SIZE
  const carPixelY = (fy - (centerTileY - 1)) * TILE_SIZE
  const gridSize = TILE_SIZE * 3
  const cropLeft = Math.max(0, Math.min(gridSize - MAP_WIDTH, Math.round(carPixelX - MAP_WIDTH / 2)))
  const cropTop = Math.max(0, Math.min(gridSize - MAP_HEIGHT, Math.round(carPixelY - MAP_HEIGHT / 2)))

  const cropped = await sharp(grid)
    .extract({ left: cropLeft, top: cropTop, width: MAP_WIDTH, height: MAP_HEIGHT })
    .toBuffer()

  const markerX = Math.max(0, Math.min(MAP_WIDTH - 14, Math.round(carPixelX - cropLeft - 7)))
  const markerY = Math.max(0, Math.min(MAP_HEIGHT - 14, Math.round(carPixelY - cropTop - 7)))

  return sharp(cropped)
    .composite([{ input: makeMarkerSvg(), left: markerX, top: markerY }])
    .png()
    .toBuffer()
}

module.exports = async function handler(req, res) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No Tessie token provided' })

  try {
    const vin = await getVin(token)
    const stateRes = await fetch(tessieUrl(`/${vin}/state`, token))
    if (!stateRes.ok) return res.status(502).json({ error: 'Failed to get vehicle state' })
    const state = await stateRes.json()

    const lat = state.drive_state?.latitude
    const lng = state.drive_state?.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(404).json({ error: 'No location data available' })
    }

    const png = await renderMap(lat, lng)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'max-age=60')
    res.status(200).send(png)
  } catch (err) {
    console.error('[map] render failed', err)
    res.status(502).json({ error: 'Map render failed' })
  }
}
