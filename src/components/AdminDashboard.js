import React, { useEffect, useState, useRef } from 'react'
import '../home.css'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usersCount: 0, ordersCount: 0, revenueTotal: 0, bestSelling: [], timeseries: [], category: { raw:0, processed:0 } })
  const [error, setError] = useState('')
  const [locations, setLocations] = useState([])
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const markersRef = useRef(null)
  const highlightRef = useRef(null)
  const [trackCode, setTrackCode] = useState('')
  const [trackError, setTrackError] = useState('')
  const [emailQuery, setEmailQuery] = useState('')
  const [emailError, setEmailError] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) return navigate('/login')
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${t}` } })
        if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
        const data = await res.json()
        if (!res.ok) return setError(data.error || 'Failed to load stats')
        setStats(data)
      } catch (e) {
        setError(e.message)
      }
    }
    async function loadLocs() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/locations`, { headers: { Authorization: `Bearer ${t}` } })
        const data = await res.json()
        if (res.ok) setLocations(data)
      } catch {}
    }
    load()
    loadLocs()
    const timer = setInterval(loadLocs, 3000)
    return () => clearInterval(timer)
  }, [navigate])
  useEffect(() => {
    async function ensureLeaflet() {
      if (window.L) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      await new Promise((resolve) => {
        const s = document.createElement('script')
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        s.onload = resolve
        document.body.appendChild(s)
      })
    }
    async function initMap() {
      await ensureLeaflet()
      if (!mapRef.current || mapObjRef.current) return
      const center = [19.0760, 72.8777]
      const m = window.L.map(mapRef.current, { minZoom: 9 }).setView(center, 12)
      const bounds = window.L.latLngBounds([18.86, 72.65], [19.25, 73.10])
      m.setMaxBounds(bounds)
      const street = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' })
      const satellite = window.L.tileLayer(
        'https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&request=GetTile&version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
        { attribution: 'Imagery © Sentinel-2, EOX IT Services', maxZoom: 19 }
      )
      satellite.on('tileerror', () => { try { street.addTo(m) } catch {} })
      street.addTo(m)
      window.L.control.layers({ Street: street, Satellite: satellite }, {}).addTo(m)
      mapObjRef.current = m
      markersRef.current = window.L.layerGroup().addTo(m)
    }
    function updateMarkers() {
      if (!mapObjRef.current || !window.L) return
      markersRef.current.clearLayers()
      const pts = locations.filter(u => u.lat != null && u.lon != null)
      const now = Date.now()
      const recentMs = 15 * 60 * 1000
      for (const u of pts) {
        const updatedAt = u.updatedAt ? new Date(u.updatedAt).getTime() : 0
        const isRecent = updatedAt && (now - updatedAt) <= recentMs
        const mk = window.L.circleMarker([u.lat, u.lon], {
          radius: 8,
          color: isRecent ? '#0a7' : '#888',
          fillColor: isRecent ? '#0a7' : '#888',
          fillOpacity: 0.9,
          weight: 2
        })
        const last = u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''
        const acc = u.acc != null ? `±${Math.round(u.acc)}m` : ''
        const prefer = u.address || u.landmark
        const txt = `<strong>${u.username}</strong>${prefer ? `<div style="color:#555">${prefer}</div>` : ''}${acc ? `<div style="color:#777">${acc}</div>` : ''}${last ? `<div style="color:#777">${last}</div>` : ''}`
        mk.bindPopup(txt)
        markersRef.current.addLayer(mk)
      }
      if (pts.length) {
        const group = window.L.featureGroup(pts.map(u => window.L.marker([u.lat, u.lon])))
        try { mapObjRef.current.fitBounds(group.getBounds().pad(0.20)) } catch {}
      } else {
        try { mapObjRef.current.setView([19.0760, 72.8777], 12) } catch {}
      }
    }
    initMap().then(updateMarkers)
  }, [locations])
  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`)
      const j = await res.json()
      const addr = (j && (j.display_name || (j.address && Object.values(j.address).join(', ')))) || ''
      return addr
    } catch {
      return ''
    }
  }
  return (
    <div className="container">
      <h2>Admin Dashboard</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
        <div className="item-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color:'#555' }}>Total Users</div>
          <div style={{ fontSize: 28, fontWeight:700 }}>{stats.usersCount}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <input className="auth-input" placeholder="User email" value={emailQuery} onChange={(e)=>setEmailQuery(e.target.value)} style={{ maxWidth: 280 }} />
          <button className="auth-btn" onClick={async ()=>{
            setEmailError('')
            const t = localStorage.getItem('token')
            try {
              const res = await fetch(`${API_BASE}/api/admin/user/location?email=${encodeURIComponent(emailQuery.trim())}`, { headers: { Authorization: `Bearer ${t}` } })
              const data = await res.json()
              if (!res.ok) return setEmailError(data.error || 'Lookup failed')
              const loc = data.userLocation
              const lm = data.userLandmark
              if (loc && loc.lat != null && loc.lon != null && window.L && mapObjRef.current) {
                if (highlightRef.current) { try { highlightRef.current.remove() } catch {} highlightRef.current = null }
                const mk = window.L.circleMarker([loc.lat, loc.lon], { radius: 10, color:'#f04', fillColor:'#f36', fillOpacity:0.9, weight:3 })
                const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                const addr = await reverseGeocode(loc.lat, loc.lon)
                mk.bindPopup(`<strong>${data.username}</strong>${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}${acc ? `<div style='color:#777'>${acc}</div>` : ''}`)
                mk.addTo(mapObjRef.current)
                highlightRef.current = mk
                try { mapObjRef.current.setView([loc.lat, loc.lon], 16) } catch {}
              } else {
                setEmailError('Location not available for this user')
              }
            } catch (e) {
              setEmailError('Lookup failed')
            }
          }}>Locate by Email</button>
          {emailError && <span style={{ color:'red' }}>{emailError}</span>}
        </div>
        <div className="item-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color:'#555' }}>Total Orders</div>
          <div style={{ fontSize: 28, fontWeight:700 }}>{stats.ordersCount}</div>
        </div>
        <div className="item-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color:'#555' }}>Revenue</div>
          <div style={{ fontSize: 28, fontWeight:700 }}>₹{Number(stats.revenueTotal||0).toFixed(0)}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 16 }}>Live Shopping Monitor (Active Carts)</h3>
      <div className="item-card" style={{ padding: 16 }}>
        {activeCarts.length === 0 && <div style={{ color: '#555' }}>No active shoppers right now.</div>}
        {activeCarts.map(c => (
          <div key={c._id} style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: '#0a7' }}>
              {c.userId?.username || 'Unknown User'}
              <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
                ({new Date(c.updatedAt).toLocaleTimeString()})
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
              {c.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
              Potential: ₹{c.items.reduce((s, i) => s + (i.price * i.quantity), 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="item-card" style={{ padding: 12, marginTop: 8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontWeight:600 }}>Legend:</span>
          <span className="status-badge" style={{ background:'#cfeee0', color:'#0a7' }}>Recent (≤15 min)</span>
          <span className="status-badge" style={{ background:'#eee', color:'#555' }}>Older</span>
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>User Locations</h3>
      <div className="item-card" style={{ padding: 16 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <input className="auth-input" placeholder="Order ID or Tracking" value={trackCode} onChange={(e)=>setTrackCode(e.target.value)} style={{ maxWidth: 280 }} />
          <button className="auth-btn" onClick={async ()=>{
            setTrackError('')
            const t = localStorage.getItem('token')
            try {
              const res = await fetch(`${API_BASE}/api/orders/track/${encodeURIComponent(trackCode.trim())}`, { headers: { Authorization: `Bearer ${t}` } })
              const data = await res.json()
              if (!res.ok) return setTrackError(data.error || 'Track failed')
              const loc = data.userLocation
              const lm = data.userLandmark
              const svAddr = data.userAddress
              if (loc && loc.lat != null && loc.lon != null && window.L && mapObjRef.current) {
                if (highlightRef.current) { try { highlightRef.current.remove() } catch {} highlightRef.current = null }
                const mk = window.L.circleMarker([loc.lat, loc.lon], { radius: 10, color:'#f04', fillColor:'#f36', fillOpacity:0.9, weight:3 })
                const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                const addr = svAddr || (await reverseGeocode(loc.lat, loc.lon))
                mk.bindPopup(`<strong>${data.username}</strong>${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}${acc ? `<div style='color:#777'>${acc}</div>` : ''}`)
                mk.addTo(mapObjRef.current)
                highlightRef.current = mk
                try { mapObjRef.current.setView([loc.lat, loc.lon], 16) } catch {}
              } else {
                setTrackError('Location not available for this order')
              }
            } catch (e) {
              setTrackError('Track failed')
            }
          }}>Locate</button>
          {trackError && <span style={{ color:'red' }}>{trackError}</span>}
        </div>
        {locations.length === 0 && <div style={{ color:'#555' }}>No user locations yet</div>}
        {locations.length > 0 && (
          <ul>
            {locations.map((u, idx)=>(
              <li key={idx} style={{ marginBottom: 6 }}>
                <strong>{u.username}</strong>
                {(u.address || u.landmark) && <span style={{ marginLeft: 8, color:'#555' }}>({u.address || u.landmark})</span>}
                {(u.lat != null && u.lon != null) && <span style={{ marginLeft: 8, color:'#777' }}>[{u.lat.toFixed(4)}, {u.lon.toFixed(4)}]</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="item-card" style={{ padding: 0, marginTop: 12 }}>
        <div ref={mapRef} className="admin-map" />
      </div>
      <h3 style={{ marginTop: 16 }}>Orders (last 14 days)</h3>
      <div className="chart">
        <div className="chart-bars">
          {(stats.timeseries||[]).map((d)=> {
            const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.orders||0))
            const h = Math.round((d.orders||0) / max * 120)
            return (
              <div key={d.day} className="chart-bar">
                <div className="chart-bar-fill" style={{ height: h, background:'#3dd9ff' }} />
                <div className="chart-bar-label">{d.day.slice(5)}</div>
                <div className="chart-bar-value">{d.orders||0}</div>
              </div>
            )
          })}
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>Revenue (last 14 days)</h3>
      <div className="chart">
        <div className="chart-bars">
          {(stats.timeseries||[]).map((d)=> {
            const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.revenue||0))
            const h = Math.round((d.revenue||0) / max * 120)
            return (
              <div key={d.day+'rev'} className="chart-bar">
                <div className="chart-bar-fill" style={{ height: h, background:'#7f3dff' }} />
                <div className="chart-bar-label">{d.day.slice(5)}</div>
                <div className="chart-bar-value">₹{Number(d.revenue||0).toFixed(0)}</div>
              </div>
            )
          })}
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>Category Breakdown</h3>
      <div className="item-card" style={{ padding: 16 }}>
        <div className="hbar">
          <div className="hbar-label">Raw</div>
          <div className="hbar-track">
            {(() => {
              const tot = (stats.category?.raw||0) + (stats.category?.processed||0)
              const pct = tot ? Math.round((stats.category.raw||0) / tot * 100) : 0
              return <div className="hbar-fill" style={{ width: `${pct}%`, background:'#3dd9ff' }} />
            })()}
          </div>
          <div className="hbar-value">{stats.category?.raw||0}</div>
        </div>
        <div className="hbar">
          <div className="hbar-label">Processed</div>
          <div className="hbar-track">
            {(() => {
              const tot = (stats.category?.raw||0) + (stats.category?.processed||0)
              const pct = tot ? Math.round((stats.category.processed||0) / tot * 100) : 0
              return <div className="hbar-fill" style={{ width: `${pct}%`, background:'#ff9a3d' }} />
            })()}
          </div>
          <div className="hbar-value">{stats.category?.processed||0}</div>
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>Best-selling Products</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12 }}>
        {(stats.bestSelling||[]).map((p)=>(
          <div className="item-card" key={p.name} style={{ padding: 16 }}>
            <div style={{ fontWeight:700 }}>{p.name}</div>
            <div style={{ marginTop:6, display:'flex', justifyContent:'space-between' }}>
              <span>Qty: {p.qty}</span>
              <span>₹{Number(p.revenue||0).toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
