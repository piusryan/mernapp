import React, { useEffect, useState, useRef } from 'react'
import '../home.css'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usersCount: 0, ordersCount: 0, revenueTotal: 0, bestSelling: [], timeseries: [], category: { raw:0, processed:0 } })
  const [error, setError] = useState('')
  const [locations, setLocations] = useState([])
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const markersRef = useRef({}) // Store markers by ID
  const highlightRef = useRef(null)
  const [activeCarts, setActiveCarts] = useState([])
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
    async function loadCarts() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/carts`, { headers: { Authorization: `Bearer ${t}` } })
        const data = await res.json()
        if (res.ok) setActiveCarts(data)
      } catch {}
    }
    load()
    loadLocs()
    loadCarts()
    const timer = setInterval(() => {
      loadLocs()
      loadCarts()
    }, 3000)
    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    function initMap() {
      if (!mapRef.current || mapObjRef.current) return
      
      const m = new maplibregl.Map({
        container: mapRef.current,
        style: mapStyle,
        center: [72.8777, 19.0760], // Mumbai
        zoom: 11
      })

      m.addControl(new maplibregl.NavigationControl(), 'top-right')
      
      // Layer Switcher Logic (Simple button for now)
      class LayerControl {
        onAdd(map) {
          this._map = map;
          this._container = document.createElement('div');
          this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
          this._btn = document.createElement('button');
          this._btn.textContent = '🛰️';
          this._btn.title = 'Toggle Satellite';
          this._btn.style.fontSize = '18px';
          this._btn.onclick = () => {
            const vis = map.getLayoutProperty('satellite-layer', 'visibility');
            if (vis === 'visible') {
              map.setLayoutProperty('satellite-layer', 'visibility', 'none');
              this._btn.textContent = '🛰️';
            } else {
              map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
              this._btn.textContent = '🗺️';
            }
          };
          this._container.appendChild(this._btn);
          return this._container;
        }
        onRemove() {
          this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }
      m.addControl(new LayerControl(), 'top-right');

      mapObjRef.current = m
    }

    function updateMarkers() {
      if (!mapObjRef.current) return
      const m = mapObjRef.current
      const pts = locations.filter(u => u.lat != null && u.lon != null)
      const now = Date.now()
      const recentMs = 15 * 60 * 1000
      
      // Track existing markers to remove stale ones
      const currentIds = new Set()

      for (const u of pts) {
        currentIds.add(u._id)
        const updatedAt = u.updatedAt ? new Date(u.updatedAt).getTime() : 0
        const isRecent = updatedAt && (now - updatedAt) <= recentMs
        const hasCart = u.cartCount > 0
        
        let color = '#888'
        if (hasCart) color = '#f04'
        else if (isRecent) color = '#0a7'

        const last = u.updatedAt ? new Date(u.updatedAt).toLocaleString() : ''
        const acc = u.acc != null ? `±${Math.round(u.acc)}m` : ''
        const src = u.src ? `[${u.src}] ` : ''
        const prefer = u.address || u.landmark
        
        let cartHtml = ''
        if (hasCart) {
          cartHtml = `<div style="margin-top:4px; font-weight:bold; color:#f04">🛒 ${u.cartCount} items (₹${u.cartTotal})</div>`
        }

        const txt = `<strong>${u.username}</strong>
          ${prefer ? `<div style="color:#555">${prefer}</div>` : ''}
          ${cartHtml}
          ${acc ? `<div style="color:#777; font-size:11px">${src}Accuracy: ${acc}</div>` : ''}
          ${last ? `<div style="color:#777; font-size:11px">Last seen: ${last}</div>` : ''}`

        // Check if marker exists
        if (markersRef.current[u._id]) {
          // Update existing marker
          const marker = markersRef.current[u._id]
          marker.setLngLat([u.lon, u.lat])
          
          // Update popup content
          const popup = marker.getPopup()
          if (popup) popup.setHTML(txt)
          
          // Update color (re-create element if needed, but simple CSS change is faster)
          const el = marker.getElement()
          const circle = el.querySelector('div')
          if (circle) {
             circle.style.backgroundColor = color
             circle.style.width = hasCart ? '20px' : '16px'
             circle.style.height = hasCart ? '20px' : '16px'
          }
        } else {
          // Create new marker
          const el = document.createElement('div')
          el.className = 'map-marker'
          const circle = document.createElement('div')
          circle.style.width = hasCart ? '20px' : '16px'
          circle.style.height = hasCart ? '20px' : '16px'
          circle.style.backgroundColor = color
          circle.style.borderRadius = '50%'
          circle.style.border = '2px solid white'
          circle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'
          el.appendChild(circle)

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([u.lon, u.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(txt))
            .addTo(m)
          
          markersRef.current[u._id] = marker
        }
      }

      // Remove old markers
      Object.keys(markersRef.current).forEach(id => {
        if (!currentIds.has(id)) {
          markersRef.current[id].remove()
          delete markersRef.current[id]
        }
      })
    }
    
    initMap()
    updateMarkers()

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
              if (loc && loc.lat != null && loc.lon != null && mapObjRef.current) {
                if (highlightRef.current) { try { highlightRef.current.remove() } catch {} highlightRef.current = null }
                
                // Create highlight marker
                const el = document.createElement('div')
                el.className = 'highlight-marker'
                el.style.width = '20px'
                el.style.height = '20px'
                el.style.backgroundColor = '#f04'
                el.style.borderRadius = '50%'
                el.style.border = '3px solid white'
                el.style.boxShadow = '0 0 10px #f04'
                
                const mk = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.lon, loc.lat])
                
                const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                const addr = await reverseGeocode(loc.lat, loc.lon)
                
                mk.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
                  `<strong>${data.username}</strong>
                   ${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}
                   ${acc ? `<div style='color:#777'>${acc}</div>` : ''}`
                ))
                
                mk.addTo(mapObjRef.current)
                highlightRef.current = mk
                
                try { 
                  mapObjRef.current.flyTo({
                    center: [loc.lon, loc.lat],
                    zoom: 16,
                    essential: true
                  })
                } catch {}
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
      {/* Live Cart Spy Section - Re-verified */}
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
          <span className="status-badge" style={{ background:'#ffe0e0', color:'#f04' }}>🛒 Active Cart</span>
          <span className="status-badge" style={{ background:'#cfeee0', color:'#0a7' }}>Online</span>
          <span className="status-badge" style={{ background:'#eee', color:'#555' }}>Offline</span>
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
              if (loc && loc.lat != null && loc.lon != null && mapObjRef.current) {
                if (highlightRef.current) { try { highlightRef.current.remove() } catch {} highlightRef.current = null }
                
                // Create highlight marker
                const el = document.createElement('div')
                el.className = 'highlight-marker'
                el.style.width = '20px'
                el.style.height = '20px'
                el.style.backgroundColor = '#f04'
                el.style.borderRadius = '50%'
                el.style.border = '3px solid white'
                el.style.boxShadow = '0 0 10px #f04'

                const mk = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.lon, loc.lat])

                const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                const addr = svAddr || (await reverseGeocode(loc.lat, loc.lon))
                
                mk.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
                  `<strong>${data.username}</strong>
                   ${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}
                   ${acc ? `<div style='color:#777'>${acc}</div>` : ''}`
                ))

                mk.addTo(mapObjRef.current)
                highlightRef.current = mk
                
                try { 
                  mapObjRef.current.flyTo({
                    center: [loc.lon, loc.lat],
                    zoom: 16,
                    essential: true
                  })
                } catch {}
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
