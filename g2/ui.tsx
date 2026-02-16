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
    <div className="flex flex-col gap-4">
      <div>
        <Text as="label" variant="subtitle" className="block mb-1">
          Server URL
        </Text>
        <Input
          value={url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          placeholder="http://localhost:3001"
          className="w-full"
        />
      </div>
      <Button variant="primary" className="w-full" onClick={handleSave}>
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
    <div className="flex flex-col gap-4">
      <div>
        <Text as="label" variant="subtitle" className="block mb-1">
          API token
        </Text>
        <Input
          type="password"
          value={token}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenValue(e.target.value)}
          placeholder="Enter your Tessie token"
          className="w-full"
        />
      </div>
      <Button variant="primary" className="w-full" onClick={handleSave}>
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

  const color = status === 'connected' ? 'text-tc-green' : status === 'disconnected' ? 'text-tc-red' : 'text-tc-2'
  const label = status === 'checking' ? 'Checking...' : status === 'connected' ? 'Connected' : 'Disconnected'

  return (
    <div className="flex items-center justify-between">
      <Text variant="body-2" className={color}>{label}</Text>
      <Button variant="secondary" size="sm" onClick={check}>Recheck</Button>
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
    <div className="flex flex-col gap-2">
      <Card className="w-full">
        <CardHeader>
          <Text variant="title-1">Tessie token</Text>
          <Text variant="body-2" className="text-tc-2 mt-1 block">
            API token from tessie.com – stored in your browser only.
          </Text>
        </CardHeader>
        <CardContent>
          <TokenField />
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardHeader>
          <Text variant="title-1">Tesla server</Text>
          <Text variant="body-2" className="text-tc-2 mt-1 block">
            URL of the Tessie API proxy server.
          </Text>
        </CardHeader>
        <CardContent>
          <ServerField />
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardHeader>
          <Text variant="title-1">Connection</Text>
        </CardHeader>
        <CardContent>
          <ConnectionStatus />
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardContent>
          <Button variant="secondary" className="w-full" onClick={handleRefresh}>
            Refresh vehicle state
          </Button>
        </CardContent>
      </Card>
      <Card className="w-full">
        <CardContent>
          <Button variant="primary" className="w-full" onClick={handleConnect}>
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

  // Move simulator heading and status to bottom
  const heading = app.querySelector('h1')
  const status = document.getElementById('status')
  if (heading) app.appendChild(heading)
  if (status) app.appendChild(status)

  const container = document.createElement('div')
  container.className = 'my-12'
  app.insertBefore(container, heading)

  createRoot(container).render(
    <React.StrictMode>
      <SettingsPanel />
    </React.StrictMode>,
  )
}
