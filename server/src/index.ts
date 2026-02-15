import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'

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
