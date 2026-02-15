# Tesla Even G2

Tesla vehicle status and controls for [Even Realities G2](https://www.evenrealities.com/) smart glasses.

View battery, range, climate, charging and sentry status at a glance. See your car's location on a live map. Lock/unlock, control climate, open trunk/frunk, flash lights and honk – all from your glasses.

## Architecture

```
[G2 glasses] <--BLE--> [Even app / simulator] <--HTTP--> [Proxy server] <--HTTPS--> [Tessie API]
                                                                    \--- [CartoDB tiles]
```

- **`server/`** – Node server that proxies [Tessie API](https://developer.tessie.com) calls (keeping the API token server-side) and renders a static map from CartoDB dark tiles via [sharp](https://sharp.pixelplumbing.com/)
- **`g2/`** – G2 frontend that renders on the glasses display and provides a settings panel in the browser

## Setup

### 1. Server

```bash
cd server
npm install
echo 'TESSIE_TOKEN=your_tessie_token' > .env
npm run dev
```

The server auto-discovers your VIN and listens on `http://localhost:3001`.

Get a Tessie token at [tessie.com](https://www.tessie.com/) under Settings.

### 2. G2 simulator

Requires [even-dev](https://github.com/nicobrinkkemper/even-dev) (Even Hub Painless Simulator).

```bash
# Symlink into even-dev (adjust paths to your local setup)
ln -s "$(pwd)/g2" /path/to/even-dev/apps/tesla

# Run
cd /path/to/even-dev
APP_NAME=tesla ./start-even.sh
```

Click **Connect** in the simulator to load the dashboard on the glasses display.

## Glasses UI

### Dashboard

```
┌────────────────────┬─────────────────┐
│ 78% ━━━━━━━━── 241km  🔒            │
├────────────────────┬─────────────────┤
│ Climate: OFF       │                 │
│ Cabin: 21°C        │    [MAP]        │
│ Charging: ...      │      ⊙          │
│ Sentry: ON         │                 │
├────────────────────┴─────────────────┤
│ > Unlock  Climate on  Refresh  More   │
└──────────────────────────────────────┘
```

The map shows the car's location on CartoDB dark tiles (bright roads on dark background), optimised for the G2's green micro-LED display.

### Quick actions

The footer bar has a cursor (`>`) that you scroll through with swipe up/down. Tap to execute the selected action. Actions adapt to current vehicle state – a locked car shows **Unlock**, an unlocked car shows **Lock**:

- **Lock** / **Unlock** – shown based on current lock state
- **Climate on** / **Climate off** – shown based on current climate state
- **Refresh** – refresh vehicle state
- **More** – open the full actions menu

### Full actions menu

Selecting **More** opens a scrollable list with all commands:

- Lock / Unlock
- Start / Stop climate
- Open frunk / trunk
- Flash lights / Honk

### Navigation

| Input | Dashboard | Actions | Confirmation |
|---|---|---|---|
| Swipe | Move footer cursor | – | – |
| Tap | Execute quick action | Execute command | Back to dashboard |
| Double tap | Refresh state | Back to dashboard | Back to dashboard |

## Tech stack

- **Server:** [Hono](https://hono.dev/) + Node + [sharp](https://sharp.pixelplumbing.com/)
- **Map tiles:** [CartoDB dark matter](https://github.com/CartoDB/basemap-styles) (free, no API key)
- **G2 frontend:** TypeScript + [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- **Settings UI:** React + [@jappyjan/even-realities-ui](https://www.npmjs.com/package/@jappyjan/even-realities-ui)
- **Vehicle API:** [Tessie](https://developer.tessie.com)
