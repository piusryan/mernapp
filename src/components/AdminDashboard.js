import React, { useEffect, useState, useRef } from 'react'
import '../home.css'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
      maxzoom: 19
    },
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    },
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      layout: {
        visibility: 'none'
      }
    }
  ]
}

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

      m.on('load', () => {
        // Add GeoJSON source for heatmap
        m.addSource('user-locations', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        })

        // Add Heatmap Layer
        m.addLayer({
          id: 'user-heatmap',
          type: 'heatmap',
          source: 'user-locations',
          maxzoom: 15,
          paint: {
            // Increase the heatmap weight based on frequency and property magnitude
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'mag'],
              0, 0,
              6, 1
            ],
            // Increase the heatmap color weight weight by zoom level
            // heatmap-intensity is a multiplier on top of heatmap-weight
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              0, 1,
              15, 3
            ],
            // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
            // Begin color ramp at 0-stop with a 0-transparency color
            // to create a blur-like effect.
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ],
            // Adjust the heatmap radius by zoom level
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              0, 2,
              9, 20
            ],
            // Transition from heatmap to circle layer by zoom level
            'heatmap-opacity': [
              'interpolate', ['linear'], ['zoom'],
              14, 1,
              15, 0
            ]
          }
        })
      })

      mapObjRef.current = m
    }

    function updateMarkers() {
      if (!mapObjRef.current) return
      const m = mapObjRef.current
      const pts = locations.filter(u => u.lat != null && u.lon != null)
      
      // Update Heatmap Data
      if (m.getSource('user-locations')) {
        const geojson = {
          type: 'FeatureCollection',
          features: pts.map(u => ({
            type: 'Feature',
            properties: { mag: u.cartCount > 0 ? 1 : 0.5 }, // Weight: Active carts = 1, others = 0.5
            geometry: { type: 'Point', coordinates: [u.lon, u.lat] }
          }))
        }
        m.getSource('user-locations').setData(geojson)
      }

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
    <div className="container" style={{ paddingBottom: 60 }}>
      <h2>Admin Dashboard</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {/* 1. Top Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom: 24 }}>
        <div className="item-card" style={{ padding: 20, textAlign:'center' }}>
          <div style={{ fontSize: 14, color:'#555', textTransform:'uppercase', letterSpacing:1 }}>Total Users</div>
          <div style={{ fontSize: 32, fontWeight:700, color:'#333' }}>{stats.usersCount}</div>
        </div>
        <div className="item-card" style={{ padding: 20, textAlign:'center' }}>
          <div style={{ fontSize: 14, color:'#555', textTransform:'uppercase', letterSpacing:1 }}>Total Orders</div>
          <div style={{ fontSize: 32, fontWeight:700, color:'#333' }}>{stats.ordersCount}</div>
        </div>
        <div className="item-card" style={{ padding: 20, textAlign:'center' }}>
          <div style={{ fontSize: 14, color:'#555', textTransform:'uppercase', letterSpacing:1 }}>Revenue</div>
          <div style={{ fontSize: 32, fontWeight:700, color:'#0a7' }}>₹{Number(stats.revenueTotal||0).toFixed(0)}</div>
        </div>
      </div>

      {/* 2. Map Section (Prominent) */}
      <div className="item-card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden', height: 500, position:'relative' }}>
         <div ref={mapRef} className="admin-map" style={{ width:'100%', height:'100%' }} />
         <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(255,255,255,0.9)', padding:8, borderRadius:4, fontSize:12, pointerEvents:'none', zIndex: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:600 }}>Legend:</span>
              <span className="status-badge" style={{ background:'#ffe0e0', color:'#f04' }}>🛒 Active Cart</span>
              <span className="status-badge" style={{ background:'#cfeee0', color:'#0a7' }}>Online</span>
              <span className="status-badge" style={{ background:'#eee', color:'#555' }}>Offline</span>
            </div>
         </div>
      </div>

      {/* 3. Live Monitoring & Tracking Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24, marginBottom: 24 }}>
        
        {/* Live Shopping Monitor */}
        <div>
          <h3 style={{ marginBottom:12 }}>Live Shopping Monitor</h3>
          <div className="item-card" style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
            {activeCarts.length === 0 && <div style={{ color: '#555', padding:20, textAlign:'center' }}>No active shoppers right now.</div>}
            {activeCarts.map(c => (
              <div key={c._id} style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ fontWeight: 600, color: '#0a7' }}>
                    {c.userId?.username || 'Unknown User'}
                    <div style={{ fontSize: 11, color: '#888' }}>
                        Last update: {new Date(c.updatedAt).toLocaleTimeString()}
                    </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                            ₹{c.items.reduce((s, i) => s + (i.price * i.quantity), 0)}
                        </div>
                        {locations.find(l => l._id === c.userId?._id) && (
                            <button 
                            onClick={() => {
                                const loc = locations.find(l => l._id === c.userId?._id)
                                if (loc && loc.lat && loc.lon && mapObjRef.current) {
                                mapObjRef.current.flyTo({ center: [loc.lon, loc.lat], zoom: 16, essential: true })
                                }
                            }}
                            style={{ fontSize: 11, marginTop:4, padding: '4px 10px', cursor: 'pointer', background: '#0a7', color: 'white', border: 'none', borderRadius: 12 }}
                            >
                            📍 Locate
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ fontSize: 13, color: '#444', marginTop: 8, background:'#f9f9f9', padding:8, borderRadius:4 }}>
                  {c.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Lookup Tools */}
        <div>
          <h3 style={{ marginBottom:12 }}>Locate User / Order</h3>
          <div className="item-card" style={{ padding: 20 }}>
            {/* Email Lookup */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#555', marginBottom:4 }}>Locate by Email</label>
                <div style={{ display:'flex', gap:8 }}>
                    <input className="auth-input" placeholder="User email" value={emailQuery} onChange={(e)=>setEmailQuery(e.target.value)} style={{ flex:1 }} />
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
                            
                            const el = document.createElement('div')
                            el.className = 'highlight-marker'
                            el.style.width = '20px'
                            el.style.height = '20px'
                            el.style.backgroundColor = '#f04'
                            el.style.borderRadius = '50%'
                            el.style.border = '3px solid white'
                            el.style.boxShadow = '0 0 10px #f04'
                            
                            const mk = new maplibregl.Marker({ element: el }).setLngLat([loc.lon, loc.lat])
                            const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                            const addr = await reverseGeocode(loc.lat, loc.lon)
                            
                            mk.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
                            `<strong>${data.username}</strong>
                            ${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}
                            ${acc ? `<div style='color:#777'>${acc}</div>` : ''}`
                            ))
                            mk.addTo(mapObjRef.current)
                            highlightRef.current = mk
                            try { mapObjRef.current.flyTo({ center: [loc.lon, loc.lat], zoom: 16, essential: true }) } catch {}
                        } else { setEmailError('Location not available') }
                        } catch (e) { setEmailError('Lookup failed') }
                    }}>Find</button>
                </div>
                {emailError && <div style={{ color:'red', fontSize:12, marginTop:4 }}>{emailError}</div>}
            </div>

            {/* Order/Tracking Lookup */}
            <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#555', marginBottom:4 }}>Locate by Order ID / Tracking</label>
                <div style={{ display:'flex', gap:8 }}>
                    <input className="auth-input" placeholder="Order ID or Tracking" value={trackCode} onChange={(e)=>setTrackCode(e.target.value)} style={{ flex:1 }} />
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
                            const el = document.createElement('div')
                            el.className = 'highlight-marker'
                            el.style.width = '20px'
                            el.style.height = '20px'
                            el.style.backgroundColor = '#f04'
                            el.style.borderRadius = '50%'
                            el.style.border = '3px solid white'
                            el.style.boxShadow = '0 0 10px #f04'
                            const mk = new maplibregl.Marker({ element: el }).setLngLat([loc.lon, loc.lat])
                            const acc = loc.acc != null ? `±${Math.round(loc.acc)}m` : ''
                            const addr = svAddr || (await reverseGeocode(loc.lat, loc.lon))
                            mk.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
                            `<strong>${data.username}</strong>
                            ${addr ? `<div style='color:#555'>${addr}</div>` : (lm ? `<div style='color:#555'>${lm}</div>` : '')}
                            ${acc ? `<div style='color:#777'>${acc}</div>` : ''}`
                            ))
                            mk.addTo(mapObjRef.current)
                            highlightRef.current = mk
                            try { mapObjRef.current.flyTo({ center: [loc.lon, loc.lat], zoom: 16, essential: true }) } catch {}
                        } else { setTrackError('Location not available') }
                        } catch (e) { setTrackError('Track failed') }
                    }}>Find</button>
                </div>
                {trackError && <div style={{ color:'red', fontSize:12, marginTop:4 }}>{trackError}</div>}
            </div>
            
            <div style={{ marginTop: 24 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>All Users with Location</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {locations.length === 0 && <div style={{ color:'#555', fontSize:13 }}>No user locations yet</div>}
                    {locations.map((u, idx)=>(
                    <div key={idx} style={{ marginBottom: 8, fontSize:13, borderBottom:'1px solid #f5f5f5', paddingBottom:4 }}>
                        <strong>{u.username}</strong>
                        {(u.address || u.landmark) && <div style={{ color:'#555', fontSize:12 }}>{u.address || u.landmark}</div>}
                        {(u.lat != null && u.lon != null) && <div style={{ color:'#999', fontSize:11 }}>[{u.lat.toFixed(4)}, {u.lon.toFixed(4)}]</div>}
                    </div>
                    ))}
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* 4. Charts Section */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24, marginBottom: 24 }}>
        <div>
            <h3 style={{ marginBottom:12 }}>Orders Trend (14 days)</h3>
            <div className="chart" style={{ height: 200 }}>
                <div className="chart-bars">
                {(stats.timeseries||[]).map((d)=> {
                    const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.orders||0))
                    const h = Math.round((d.orders||0) / max * 150)
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
        </div>
        <div>
            <h3 style={{ marginBottom:12 }}>Revenue Trend (14 days)</h3>
            <div className="chart" style={{ height: 200 }}>
                <div className="chart-bars">
                {(stats.timeseries||[]).map((d)=> {
                    const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.revenue||0))
                    const h = Math.round((d.revenue||0) / max * 150)
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
        </div>
      </div>

      {/* 5. Best Selling Products */}
      <h3 style={{ marginTop: 32, marginBottom: 16 }}>Top Products (All Time)</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
        {(stats.bestSelling||[]).map((p)=>(
          <div className="item-card" key={p.name} style={{ padding: 16 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{p.name}</div>
            <div style={{ display:'flex', justifyContent:'space-between', color:'#555', fontSize:13 }}>
              <span>Qty: {p.qty}</span>
              <span style={{ fontWeight:600, color:'#333' }}>₹{Number(p.revenue||0).toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 6. NEW: Weekly Item Sales */}
      <h3 style={{ marginTop: 32, marginBottom: 16 }}>Weekly Item Demand (Last 14 Days)</h3>
      <div style={{ overflowX: 'auto', paddingBottom: 16, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', gap: 16 }}>
          {(stats.timeseries||[]).slice().reverse().map((day) => (
            <div key={day.day} className="item-card" style={{ minWidth: 220, maxWidth: 220, padding: 16, verticalAlign: 'top', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 12, borderBottom:'1px solid #eee', paddingBottom:8, color:'#333' }}>
                    {new Date(day.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ minHeight: 100 }}>
                    {day.items && day.items.length > 0 ? (
                        day.items.map((it, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, alignItems:'center' }}>
                                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }} title={it.name}>{it.name}</span>
                                <span style={{ fontWeight: 600, background:'#eee', padding:'2px 6px', borderRadius:10, fontSize:11 }}>{it.qty}</span>
                            </div>
                        ))
                    ) : <div style={{ color: '#aaa', fontSize: 13, textAlign:'center', marginTop:20 }}>No items sold</div>}
                </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  )
}
