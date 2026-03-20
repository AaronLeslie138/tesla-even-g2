import React, { useState, useEffect } from 'react'
import teslaLogo from '../src/tesla.png'
import { createRoot } from 'react-dom/client'
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

  const dotColor = status === 'connected'
    ? 'var(--color-positive)'
    : status === 'disconnected'
      ? 'var(--color-negative)'
      : 'var(--color-text-muted)'

  const statusLabel = status === 'checking'
    ? 'Checking...'
    : status === 'connected'
      ? 'Token valid'
      : 'Token invalid'

  return (
    <>
      <input
        type="password"
        value={token}
        onChange={(e) => setTokenValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Enter your Tessie API token"
        style={{
          height: 36,
          width: '100%',
          background: 'var(--color-input-bg)',
          color: 'var(--color-text)',
          border: 'none',
          borderRadius: 'var(--radius-default)',
          padding: '0 16px',
          fontFamily: 'var(--font-body)',
          outline: 'none',
        }}
        className="text-medium-body"
      />
      {token && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--spacing-same)' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: dotColor, display: 'inline-block',
            ...(status === 'connected' ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}),
          }} />
          <span className="text-subtitle" style={{ color: dotColor }}>{statusLabel}</span>
        </div>
      )}
    </>
  )
}

function SettingsPanel() {
  const [tokenValid, setTokenValid] = useState(false)

  const handleConnect = () => {
    document.getElementById('connectBtn')?.click()
  }

  return (
    <>
      <h2 className="text-large-title" style={{ margin: `0 0 var(--spacing-cross)` }}>Access token</h2>

      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-default)',
        padding: 'var(--spacing-card-margin)',
      }}>
        <p className="text-normal-body" style={{ color: 'var(--color-text-dim)', margin: `0 0 var(--spacing-cross)` }}>
          Generate the token at <a target="_new" href="https://dash.tessie.com/settings/developer">tessie.com</a>. Stored locally.
        </p>
        <TokenAndStatus onStatusChange={setTokenValid} />
      </div>

      <button
        className="text-medium-title"
        disabled={!tokenValid}
        onClick={handleConnect}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: 48,
          border: 'none',
          borderRadius: 'var(--radius-default)',
          background: 'var(--color-accent)',
          color: 'var(--color-text-highlight)',
          cursor: 'pointer',
          marginTop: 'var(--spacing-cross)',
          opacity: tokenValid ? 1 : 0.4,
          pointerEvents: tokenValid ? 'auto' : 'none',
        }}
      >
        Connect Tesla
      </button>
    </>
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

  if (heading) heading.remove()
  if (logo) {
    ;(logo as HTMLImageElement).src = teslaLogo
    app.appendChild(logo)
  }
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
