import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import sharp from 'sharp'

const TESSIE_TOKEN = process.env.TESSIE_TOKEN

if (!TESSIE_TOKEN) {
  console.error('Missing TESSIE_TOKEN in .env')
  process.exit(1)
}

function tessieUrl(path: string): string {
  return `https://api.tessie.com${path}?access_token=${TESSIE_TOKEN}`
}

let vin: string | null = null

async function discoverVin(): Promise<string> {
  const res = await fetch(tessieUrl('/vehicles'))
  if (!res.ok) throw new Error(`Failed to list vehicles: ${res.status}`)
  const data = await res.json() as { results: Array<{ vin: string }> }
  const first = data.results?.[0]
  if (!first) throw new Error('No vehicles found on this Tessie account')
  return first.vin
}

// --- OSM tile math ---

const TILE_SIZE = 256
const MAP_ZOOM = 15
const MAP_WIDTH = 280
const MAP_HEIGHT = 216

function latLngToTileXY(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const x = ((lng + 180) / 360) * n
  const y = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  return { x, y }
}

function tileUrl(tx: number, ty: number, zoom: number): string {
  return `https://basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`
}

async function fetchTile(tx: number, ty: number, zoom: number): Promise<Buffer> {
  const res = await fetch(tileUrl(tx, ty, zoom), {
    headers: { 'User-Agent': 'tesla-even-g2/1.0' },
  })
  if (!res.ok) throw new Error(`Tile fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function makeMarkerSvg(): Buffer {
  const svg = `<svg width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" fill="none" stroke="white" stroke-width="2"/>
    <circle cx="7" cy="7" r="2" fill="white"/>
  </svg>`
  return Buffer.from(svg)
}

async function renderMap(lat: number, lng: number): Promise<Buffer> {
  const { x: fx, y: fy } = latLngToTileXY(lat, lng, MAP_ZOOM)
  const centerTileX = Math.floor(fx)
  const centerTileY = Math.floor(fy)

  // Fetch 3x3 grid of tiles around center
  const tiles: Array<{ buf: Buffer; tx: number; ty: number }> = []
  const fetches: Array<Promise<void>> = []

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

  // Build 3x3 grid: stitch 3 tiles per row, then stack 3 rows
  const rows: Buffer[] = []
  for (let dy = -1; dy <= 1; dy++) {
    const rowTiles = [-1, 0, 1].map((dx) => {
      const t = tiles.find((t) => t.tx === centerTileX + dx && t.ty === centerTileY + dy)
      return t!.buf
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

  const gridWidth = TILE_SIZE * 3
  const grid = await sharp(rows[0])
    .extend({ bottom: TILE_SIZE * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([
      { input: rows[1], left: 0, top: TILE_SIZE },
      { input: rows[2], left: 0, top: TILE_SIZE * 2 },
    ])
    .toBuffer()

  // Car's pixel position within the 3x3 grid
  const carPixelX = (fx - (centerTileX - 1)) * TILE_SIZE
  const carPixelY = (fy - (centerTileY - 1)) * TILE_SIZE

  // Crop region centered on car
  const gridSize = TILE_SIZE * 3
  const cropLeft = Math.max(0, Math.min(gridSize - MAP_WIDTH, Math.round(carPixelX - MAP_WIDTH / 2)))
  const cropTop = Math.max(0, Math.min(gridSize - MAP_HEIGHT, Math.round(carPixelY - MAP_HEIGHT / 2)))

  const cropped = await sharp(grid)
    .extract({ left: cropLeft, top: cropTop, width: MAP_WIDTH, height: MAP_HEIGHT })
    .toBuffer()

  // Overlay marker dot centered on car
  const markerX = Math.max(0, Math.min(MAP_WIDTH - 14, Math.round(carPixelX - cropLeft - 7)))
  const markerY = Math.max(0, Math.min(MAP_HEIGHT - 14, Math.round(carPixelY - cropTop - 7)))

  return sharp(cropped)
    .composite([{ input: makeMarkerSvg(), left: markerX, top: markerY }])
    .png()
    .toBuffer()
}

// --- Hono app ---

const app = new Hono()

app.use('/*', cors({ origin: '*' }))

app.get('/api/state', async (c) => {
  if (!vin) return c.json({ error: 'VIN not discovered yet' }, 503)
  const res = await fetch(tessieUrl(`/${vin}/state`))
  const data = await res.json()
  return c.json(data, res.status as 200)
})

app.post('/api/command/:cmd', async (c) => {
  if (!vin) return c.json({ error: 'VIN not discovered yet' }, 503)
  const cmd = c.req.param('cmd')
  const res = await fetch(tessieUrl(`/${vin}/command/${cmd}`), { method: 'POST' })
  const data = await res.json()
  return c.json(data, res.status as 200)
})

app.get('/api/map', async (c) => {
  if (!vin) return c.json({ error: 'VIN not discovered yet' }, 503)

  const stateRes = await fetch(tessieUrl(`/${vin}/state`))
  if (!stateRes.ok) return c.json({ error: 'Failed to get vehicle state' }, 502)
  const state = await stateRes.json() as { drive_state?: { latitude?: number; longitude?: number } }

  const lat = state.drive_state?.latitude
  const lng = state.drive_state?.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return c.json({ error: 'No location data available' }, 404)
  }

  try {
    const png = await renderMap(lat, lng)
    return c.body(png, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'max-age=60',
    })
  } catch (err) {
    console.error('[map] render failed', err)
    return c.json({ error: 'Map render failed' }, 502)
  }
})

const port = 3001

async function start() {
  vin = await discoverVin()
  console.log(`Discovered VIN: ${vin}`)
  console.log(`Tesla proxy listening on http://localhost:${port}`)
  serve({ fetch: app.fetch, port })
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})
