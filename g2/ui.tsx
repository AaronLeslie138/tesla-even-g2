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
import { setBaseUrl, checkConnection, getToken, setToken } from './api'
import { refreshState } from './app'

const SERVER_URL_KEY = 'tesla:server-url'
const DEFAULT_URL = 'http://localhost:3001'

function ServerField() {
  const [url, setUrl] = useState(localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_URL)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setBaseUrl(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Text as="label" variant="subtitle" style={{ display: 'block', marginBottom: '4px' }}>
          Server URL
        </Text>
        <Input
          value={url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          placeholder="http://localhost:3001"
          style={{ width: '100%' }}
        />
      </div>
      <Button variant="primary" style={{ width: '100%' }} onClick={handleSave}>
        {saved ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}

function TokenField() {
  const [token, setTokenValue] = useState(getToken())
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setToken(token)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Text as="label" variant="subtitle" style={{ display: 'block', marginBottom: '4px' }}>
          API token
        </Text>
        <Input
          type="password"
          value={token}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenValue(e.target.value)}
          placeholder="Enter your Tessie token"
          style={{ width: '100%' }}
        />
      </div>
      <Button variant="primary" style={{ width: '100%' }} onClick={handleSave}>
        {saved ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}

function ConnectionStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  const check = () => {
    setStatus('checking')
    checkConnection().then((ok) => setStatus(ok ? 'connected' : 'disconnected'))
  }

  useEffect(() => { check() }, [])

  const color = status === 'connected'
    ? 'var(--color-tc-green, #4BB954)'
    : status === 'disconnected'
      ? 'var(--color-tc-red, #FF4535)'
      : 'var(--color-tc-2, #7b7b7b)'
  const label = status === 'checking' ? 'Checking...' : status === 'connected' ? 'Connected' : 'Disconnected'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="body-2" style={{ color }}>{label}</Text>
      <Button variant="default" onClick={check}>Recheck</Button>
    </div>
  )
}

function SettingsPanel() {
  const handleRefresh = () => {
    void refreshState()
  }

  const handleConnect = () => {
    document.getElementById('connectBtn')?.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Tessie token</Text>
          <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
            API token from tessie.com – stored in your browser only.
          </Text>
        </CardHeader>
        <CardContent>
          <TokenField />
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Tesla server</Text>
          <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
            URL of the Tessie API proxy server.
          </Text>
        </CardHeader>
        <CardContent>
          <ServerField />
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Connection</Text>
        </CardHeader>
        <CardContent>
          <ConnectionStatus />
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardContent>
          <Button variant="default" style={{ width: '100%' }} onClick={handleRefresh}>
            Refresh vehicle state
          </Button>
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardContent>
          <Button variant="primary" style={{ width: '100%' }} onClick={handleConnect}>
            Connect Tesla
          </Button>
        </CardContent>
      </Card>
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
  const status = document.getElementById('status')
  const eventLog = document.getElementById('event-log')

  const container = document.createElement('div')
  container.style.margin = '48px 0'

  // Reorder: heading, UI, status, log at bottom
  if (heading) app.appendChild(heading)
  app.appendChild(container)
  if (status) app.appendChild(status)
  if (eventLog) app.appendChild(eventLog)

  createRoot(container).render(
    <React.StrictMode>
      <SettingsPanel />
    </React.StrictMode>,
  )
}
