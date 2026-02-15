import React, { useState } from 'react'
import '../home.css'
import { API_BASE } from '../api'

export default function CookieConsent({ onClose, forceAccept = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        localStorage.setItem('cookiesAccepted', 'true')
        setBusy(false)
        return onClose && onClose()
      }
      async function reverse(lat, lon) {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
          if (!res.ok) return ''
          const d = await res.json()
          const nm = d && (d.display_name || (d.address && (d.address.road || d.address.neighbourhood || d.address.suburb || d.address.city || d.address.town)))
          return nm || ''
        } catch { return '' }
      }
      function getPosition() {
        return new Promise((resolve, reject) => {
          if (!('geolocation' in navigator)) return reject(new Error('no geo'))
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000 })
        })
      }
      let lat = null, lon = null
      try {
        const pos = await getPosition()
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch (e) {
        setBusy(false)
        setError('Location access is required. Please allow location in your browser and try again.')
        return
      }
      const landmark = (lat != null && lon != null) ? (await reverse(lat, lon)) : ''
      await fetch(`${API_BASE}/api/user/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lon, landmark, cookiesAccepted: true })
      })
      localStorage.setItem('cookiesAccepted', 'true')
      setBusy(false)
      onClose && onClose()
    } catch (e) {
      setBusy(false)
      setError('Failed to save preference')
    }
  }
  return (
    <div className="overlay" onClick={forceAccept ? undefined : onClose}>
      <div className="popup cookie-modal" onClick={(e) => e.stopPropagation()}>
        {!forceAccept && <button className="cookie-close" onClick={onClose}>×</button>}
        <div style={{ display:'grid', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="cookie-graphic">🍪</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Heya! This site uses cookies.</div>
          <p style={{ color:'#555' }}>
            We use cookies and location (GPS/IP) for order tracking and delivery. By accepting, your device may prompt for location permission. You can clear saved location in your account anytime.
          </p>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <div className="auth-actions" style={{ justifyContent:'center' }}>
            <button className="cookie-cta" onClick={accept} disabled={busy}>{busy ? 'Saving...' : 'Sweet... cookies!'}</button>
            {!forceAccept && <button className="cookie-secondary" onClick={onClose} disabled={busy}>No, thanks</button>}
          </div>
          {!forceAccept && <div className="cookie-caption">Sorry, I’m not a diet. No cookies for me.</div>}
        </div>
      </div>
    </div>
  )
}
