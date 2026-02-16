import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type VehicleState = {
  batteryLevel: number
  range: number
  climateOn: boolean
  insideTemp: number
  outsideTemp: number
  locked: boolean
  chargingState: string
  sentryMode: boolean
  chargePortDoorOpen: boolean
  chargeLimitSoc: number
  chargeAmps: number
  driverTempSetting: number
  defrostMode: boolean
  seatHeaterLeft: number
  seatHeaterRight: number
  valetMode: boolean
  sunRoofPercentOpen: number
  homelinkNearby: boolean
}

export type ActionParams = Record<string, string | number | boolean>

export type Screen = 'dashboard' | 'menu' | 'loading' | 'confirmation'

export type State = {
  screen: Screen
  startupRendered: boolean
  vehicle: VehicleState | null
  confirmationMessage: string
}

export const state: State = {
  screen: 'dashboard',
  startupRendered: false,
  vehicle: null,
  confirmationMessage: '',
}

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
