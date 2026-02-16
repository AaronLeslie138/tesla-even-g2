import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { getState, getMap, sendCommand, type VehicleState } from './api'

const DISPLAY_WIDTH = 576
const DISPLAY_HEIGHT = 288
const SWIPE_COOLDOWN_MS = 150

const HEADER_HEIGHT = 30
const FOOTER_HEIGHT = 34
const BODY_TOP = HEADER_HEIGHT + 4
const BODY_HEIGHT = DISPLAY_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - 8

const MAP_WIDTH = 280
const MAP_HEIGHT = BODY_HEIGHT
const TEXT_WIDTH = DISPLAY_WIDTH - MAP_WIDTH - 8

type Screen = 'dashboard' | 'actions' | 'loading' | 'confirmation'

function quickActions(): Array<{ label: string; cmd: string | null }> {
  const v = state.vehicle
  return [
    v?.locked ? { label: 'Unlock', cmd: 'unlock' } : { label: 'Lock', cmd: 'lock' },
    v?.climateOn ? { label: 'Climate off', cmd: 'stop_climate' } : { label: 'Climate on', cmd: 'start_climate' },
    { label: 'Refresh', cmd: null },
    { label: 'More', cmd: null },
  ]
}

const COMMANDS = [
  { label: 'Unlock', cmd: 'unlock' },
  { label: 'Lock', cmd: 'lock' },
  { label: 'Start climate', cmd: 'start_climate' },
  { label: 'Stop climate', cmd: 'stop_climate' },
  { label: 'Open frunk', cmd: 'open_front_trunk' },
  { label: 'Open trunk', cmd: 'open_rear_trunk' },
  { label: 'Flash lights', cmd: 'flash_lights' },
  { label: 'Honk', cmd: 'honk' },
]

type State = {
  screen: Screen
  startupRendered: boolean
  lastSwipeTime: number
  vehicle: VehicleState | null
  confirmationMessage: string
  footerCursor: number
}

const state: State = {
  screen: 'dashboard',
  startupRendered: false,
  lastSwipeTime: 0,
  vehicle: null,
  confirmationMessage: '',
  footerCursor: 0,
}

let bridge: EvenAppBridge | null = null

// --- Event normalisation (from itsypad) ---

function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT
      default: return undefined
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase()
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT
    if (v.includes('SCROLL_TOP') || v.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  if (event.listEvent || event.textEvent || event.sysEvent) return OsEventTypeList.CLICK_EVENT

  return undefined
}

function swipeThrottleOk(): boolean {
  const now = Date.now()
  if (now - state.lastSwipeTime < SWIPE_COOLDOWN_MS) return false
  state.lastSwipeTime = now
  return true
}

// --- Rendering helpers ---

async function rebuildPage(config: {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
  imageObject?: ImageContainerProperty[]
}): Promise<void> {
  if (!bridge) return

  if (!state.startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    state.startupRendered = true
    return
  }

  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
}

function batteryBar(level: number): string {
  const filled = Math.round(level / 10)
  return '\u2501'.repeat(filled) + '\u2500'.repeat(10 - filled)
}

function footerText(): string {
  return quickActions()
    .map((a, i) => `${state.footerCursor === i ? '>' : ' '} ${a.label}`)
    .join('  ')
}

async function updateFooter(): Promise<void> {
  if (!bridge) return

  const content = footerText()
  const updated = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 3,
    containerName: 'footer',
    contentOffset: 0,
    contentLength: content.length,
    content,
  }))

  if (!updated) {
    await showDashboard()
  }
}

// --- Map loading ---

async function pushMapImage(): Promise<void> {
  if (!bridge) return

  const mapData = await getMap()
  if (!mapData) {
    appendEventLog('Map: no data')
    return
  }

  const pngBytes = Array.from(new Uint8Array(mapData))
  const result = await bridge.updateImageRawData(new ImageRawDataUpdate({
    containerID: 4,
    containerName: 'map',
    imageData: pngBytes,
  }))

  appendEventLog(`Map: ${String(result)}`)
}

// --- Dashboard screen (3 text + 1 image container) ---

async function showDashboard(): Promise<void> {
  state.screen = 'dashboard'

  if (!state.vehicle) {
    await rebuildPage({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'loading',
          content: 'Loading vehicle state...',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 4,
        }),
      ],
    })
    return
  }

  const v = state.vehicle
  const headerText = `${v.batteryLevel}% ${batteryBar(v.batteryLevel)} ${v.range}km`

  const bodyLines = [
    v.locked ? 'Locked' : '** UNLOCKED **',
    `Climate: ${v.climateOn ? 'ON' : 'OFF'}`,
    `Cabin: ${v.insideTemp}\u00B0C`,
    `Charging: ${v.chargingState}`,
    `Sentry: ${v.sentryMode ? 'ON' : 'OFF'}`,
  ]

  await rebuildPage({
    containerTotalNum: 4,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'header',
        content: headerText,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: HEADER_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: 'body',
        content: bodyLines.join('\n'),
        xPosition: 0,
        yPosition: BODY_TOP,
        width: TEXT_WIDTH,
        height: BODY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 4,
      }),
      new TextContainerProperty({
        containerID: 3,
        containerName: 'footer',
        content: footerText(),
        xPosition: 0,
        yPosition: HEADER_HEIGHT + BODY_HEIGHT + 8,
        width: DISPLAY_WIDTH,
        height: FOOTER_HEIGHT,
        isEventCapture: 1,
        paddingLength: 4,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 4,
        containerName: 'map',
        xPosition: TEXT_WIDTH + 8,
        yPosition: BODY_TOP,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
      }),
    ],
  })

  appendEventLog(`Dashboard: ${v.batteryLevel}% ${v.range}km`)

  // Push map image after page is rendered (image containers start empty)
  void pushMapImage()
}

// --- Actions menu (full list) ---

async function showActions(): Promise<void> {
  state.screen = 'actions'

  const list = new ListContainerProperty({
    containerID: 10,
    containerName: 'actions-list',
    xPosition: 0,
    yPosition: 0,
    width: DISPLAY_WIDTH,
    height: DISPLAY_HEIGHT,
    borderWidth: 1,
    borderColor: 13,
    borderRdaius: 6,
    paddingLength: 5,
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: COMMANDS.length,
      itemWidth: 560,
      isItemSelectBorderEn: 1,
      itemName: COMMANDS.map((c) => c.label),
    }),
  })

  await rebuildPage({
    containerTotalNum: 1,
    listObject: [list],
  })

  appendEventLog('Actions: showing menu')
}

// --- Loading screen ---

async function showLoading(label: string): Promise<void> {
  state.screen = 'loading'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'loading',
        content: `Sending: ${label}...`,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })
}

// --- Confirmation screen ---

async function showConfirmation(message: string): Promise<void> {
  state.screen = 'confirmation'
  state.confirmationMessage = message

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'confirmation',
        content: message,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 4,
      }),
    ],
  })

  setTimeout(() => {
    if (state.screen === 'confirmation') {
      void refreshState()
    }
  }, 2000)
}

// --- Command execution ---

async function executeCommand(cmd: string, label: string): Promise<void> {
  await showLoading(label)

  const result = await sendCommand(cmd)
  if (result.ok) {
    appendEventLog(`Command: ${label} succeeded`)
    await showConfirmation(label + ' \u2013 OK')
  } else {
    appendEventLog(`Command: ${label} failed: ${result.error}`)
    await showConfirmation(`Failed: ${result.error}`)
  }
}

// --- Data refresh ---

export async function refreshState(): Promise<void> {
  try {
    state.vehicle = await getState()
    appendEventLog('State: refreshed')
  } catch (err) {
    console.error('[tesla] refreshState failed', err)
    appendEventLog(`State: refresh failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (bridge && (state.screen === 'dashboard' || state.screen === 'confirmation')) {
    await showDashboard()
  }
}

// --- Event dispatching ---

function onEvenHubEvent(event: EvenHubEvent): void {
  const eventType = resolveEventType(event)
  appendEventLog(`Event: type=${String(eventType)} screen=${state.screen}`)

  switch (state.screen) {
    case 'dashboard':
      void handleDashboardEvent(eventType)
      break
    case 'actions':
      void handleActionsEvent(event, eventType)
      break
    case 'confirmation':
      void handleConfirmationEvent()
      break
  }
}

// --- Screen event handlers ---

async function handleDashboardEvent(eventType: OsEventTypeList | undefined): Promise<void> {
  const maxCursor = quickActions().length - 1

  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    if (swipeThrottleOk() && state.footerCursor < maxCursor) {
      state.footerCursor++
      await updateFooter()
    }
    return
  }

  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (swipeThrottleOk() && state.footerCursor > 0) {
      state.footerCursor--
      await updateFooter()
    }
    return
  }

  if (eventType === OsEventTypeList.CLICK_EVENT) {
    const action = quickActions()[state.footerCursor]
    if (!action) return

    if (action.cmd) {
      await executeCommand(action.cmd, action.label)
    } else if (action.label === 'Refresh') {
      await refreshState()
    } else if (action.label === 'More') {
      await showActions()
    }
    return
  }

  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (!swipeThrottleOk()) return
    await refreshState()
    return
  }
}

async function handleActionsEvent(event: EvenHubEvent, eventType: OsEventTypeList | undefined): Promise<void> {
  if (eventType === OsEventTypeList.CLICK_EVENT) {
    const le = event.listEvent
    let idx = le?.currentSelectItemIndex
    if (typeof idx !== 'number' || idx < 0) idx = 0
    if (idx >= COMMANDS.length) return

    const command = COMMANDS[idx]
    await executeCommand(command.cmd, command.label)
    return
  }

  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    await showDashboard()
    return
  }
}

async function handleConfirmationEvent(): Promise<void> {
  await refreshState()
}

// --- Public API ---

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  bridge = appBridge

  bridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await refreshState()
  await showDashboard()

  setInterval(() => { void refreshState() }, 60_000)
}
