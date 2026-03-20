import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Card,
  CardHeader,
  CardContent,
  Text,
  Input,
  Button,
} from '@jappyjan/even-realities-ui'

import { checkConnection, getToken, setToken } from './api'

function TokenAndStatus({ onStatusChange }: { onStatusChange: (valid: boolean) => void }) {
  const [token, setTokenValue] = useState(getToken())
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  const check = () => {
    setStatus('checking')
    checkConnection().then((ok) => {
      setStatus(ok ? 'connected' : 'disconnected')
      onStatusChange(ok)
    })
  }

  useEffect(() => { check() }, [])

  const handleBlur = () => {
    setToken(token)
    check()
  }

  const statusColor = status === 'connected'
    ? '#4BB954'
    : status === 'disconnected'
      ? '#FF4535'
      : '#7b7b7b'
  const statusLabel = status === 'checking' ? 'Checking...' : status === 'connected' ? 'Token valid' : 'Token invalid'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Input
        type="password"
        value={token}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Enter your Tessie API token"
        style={{ width: '100%', fontSize: '1rem' }}
      />
      {token && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: statusColor, display: 'inline-block',
          }} />
          <Text variant="body-2" style={{ color: statusColor }}>{statusLabel}</Text>
        </div>
      )}
    </div>
  )
}

function SettingsPanel() {
  const [tokenValid, setTokenValid] = useState(false)

  const handleConnect = () => {
    document.getElementById('connectBtn')?.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Access token</Text>
          <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
            Generate the token at <a target="_new" href="https://dash.tessie.com/settings/developer">tessie.com</a>. Stored locally.
          </Text>
        </CardHeader>
        <CardContent>
          <TokenAndStatus onStatusChange={setTokenValid} />
        </CardContent>
      </Card>
<Button variant="primary" style={{ width: '100%', marginTop: '8px', fontSize: '1rem', padding: '12px', opacity: tokenValid ? 1 : 0.4, pointerEvents: tokenValid ? 'auto' : 'none' }} onClick={handleConnect}>
        Connect Tesla
      </Button>
    </div>
  )
}

export function initUI(): void {
  const app = document.getElementById('app')
  if (!app) return

  for (const id of ['actionBtn']) {
    const el = document.getElementById(id)
    if (el) el.remove()
  }

  const connectBtn = document.getElementById('connectBtn')
  if (connectBtn) connectBtn.style.display = 'none'

  const heading = app.querySelector('h1')
  const logo = document.getElementById('logo')
  const subtitle = document.getElementById('subtitle')
  const status = document.getElementById('status')
  const eventLog = document.getElementById('event-log')

  const container = document.createElement('div')
  container.style.margin = '16px 0'

  if (heading) heading.remove()
  if (logo) app.appendChild(logo)
  if (subtitle) app.appendChild(subtitle)
  app.appendChild(container)
  if (status) {
    status.style.display = 'none'
    app.appendChild(status)
  }
  if (eventLog) {
    eventLog.style.display = 'none'
    app.appendChild(eventLog)
  }

  createRoot(container).render(
    <React.StrictMode>
      <SettingsPanel />
    </React.StrictMode>,
  )
}
