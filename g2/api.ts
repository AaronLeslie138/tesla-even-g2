const SERVER_URL_KEY = 'tesla:server-url'
const DEFAULT_URL = 'http://localhost:3001'

function getBaseUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_URL
}

export function setBaseUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url)
}

export type VehicleState = {
  batteryLevel: number
  range: number
  climateOn: boolean
  insideTemp: number
  locked: boolean
  chargingState: string
  sentryMode: boolean
}

export async function getState(): Promise<VehicleState> {
  const res = await fetch(`${getBaseUrl()}/api/state`)
  if (!res.ok) throw new Error(`State fetch failed: ${res.status}`)
  const data = await res.json()

  const charge = data.charge_state ?? {}
  const climate = data.climate_state ?? {}
  const vehicle = data.vehicle_state ?? {}

  return {
    batteryLevel: charge.battery_level ?? 0,
    range: Math.round((charge.battery_range ?? 0) * 1.60934),
    climateOn: climate.is_climate_on ?? false,
    insideTemp: Math.round(climate.inside_temp ?? 0),
    locked: vehicle.locked ?? true,
    chargingState: charge.charging_state ?? 'Unknown',
    sentryMode: vehicle.sentry_mode ?? false,
  }
}

export async function sendCommand(cmd: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/command/${cmd}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/state`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
