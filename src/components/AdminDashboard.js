import React, { useEffect, useState, useRef } from 'react'
import '../home.css'
import '../admin.css'
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
    <div className="container admin-dashboard-container">
      <div className="admin-header">
        <h2 className="admin-title">Admin Dashboard</h2>
      </div>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{stats.usersCount}</div>
          
          <div style={{ marginTop: 16 }}>
            <div className="search-bar-container">
              <input 
                className="modern-input" 
                placeholder="Locate user by email..." 
                value={emailQuery} 
                onChange={(e)=>setEmailQuery(e.target.value)} 
              />
              <button className="modern-btn" onClick={async ()=>{
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
                    setEmailError('Location not available')
                  }
                } catch (e) {
                  setEmailError('Lookup failed')
                }
              }}>Locate</button>
            </div>
            {emailError && <div style={{ color:'red', marginTop:4, fontSize:12 }}>{emailError}</div>}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{stats.ordersCount}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">₹{Number(stats.revenueTotal||0).toFixed(0)}</div>
        </div>
      </div>

      <div className="section-title">Live Shopping Monitor</div>
      <div className="live-monitor-card">
        {activeCarts.length === 0 && <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>No active shoppers right now.</div>}
        {activeCarts.map(c => (
          <div key={c._id} className="live-cart-item">
            <div className="live-user-info">
              <div className="live-username">{c.userId?.username || 'Unknown User'}</div>
              <div className="live-time">{new Date(c.updatedAt).toLocaleTimeString()}</div>
              <div className="live-items">
                {c.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
              </div>
            </div>
            <div className="live-actions">
              <div className="live-potential">
                ₹{c.items.reduce((s, i) => s + (i.price * i.quantity), 0)}
              </div>
              {locations.find(l => l._id === c.userId?._id) && (
                <button 
                  className="locate-btn"
                  onClick={() => {
                    const loc = locations.find(l => l._id === c.userId?._id)
                    if (loc && loc.lat && loc.lon && mapObjRef.current) {
                      mapObjRef.current.flyTo({ center: [loc.lon, loc.lat], zoom: 16, essential: true })
                    }
                  }}
                >
                  📍 Locate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Geographic Intelligence</div>
      <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee' }}>
          <div className="search-bar-container" style={{ boxShadow: 'none', background: '#f9f9f9' }}>
            <input 
              className="modern-input" 
              placeholder="Track Order ID..." 
              value={trackCode} 
              onChange={(e)=>setTrackCode(e.target.value)}
              style={{ background: 'transparent', minWidth: 200 }} 
            />
            <button className="modern-btn" style={{ padding: '8px 16px' }} onClick={async ()=>{
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
          }}>Find Order</button>
          </div>
          {trackError && <div style={{ color:'red', marginLeft: 16, fontSize:12 }}>{trackError}</div>}
          
          <div style={{ display:'flex', gap:8 }}>
            <span className="legend-badge active">🛒 Active Cart</span>
            <span className="legend-badge online">Online</span>
            <span className="legend-badge offline">Offline</span>
          </div>
        </div>
        
        <div ref={mapRef} className="admin-map" style={{ height: 400, borderRadius: 0 }} />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">Orders (Last 14 Days)</div>
          <div className="chart-bars">
            {(stats.timeseries||[]).map((d)=> {
              const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.orders||0))
              const h = Math.round((d.orders||0) / max * 120)
              return (
                <div key={d.day} className="chart-bar">
                  <div className="chart-bar-fill" style={{ height: h, background:'#3b82f6', borderRadius: '4px 4px 0 0' }} />
                  <div className="chart-bar-label">{d.day.slice(5)}</div>
                  <div className="chart-bar-value">{d.orders||0}</div>
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="chart-card">
          <div className="chart-header">Revenue (Last 14 Days)</div>
          <div className="chart-bars">
            {(stats.timeseries||[]).map((d)=> {
              const max = Math.max(1, ...(stats.timeseries||[]).map(x=>x.revenue||0))
              const h = Math.round((d.revenue||0) / max * 120)
              return (
                <div key={d.day} className="chart-bar">
                  <div className="chart-bar-fill" style={{ height: h, background:'#10b981', borderRadius: '4px 4px 0 0' }} />
                  <div className="chart-bar-label">{d.day.slice(5)}</div>
                  <div className="chart-bar-value">₹{d.revenue||0}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="section-title">Weekly Sales Performance</div>
      <div className="weekly-sales-scroll">
        {(stats.weeklySales || []).map((dayData, idx) => (
          <div key={idx} className="day-card">
            <div className="day-header">{dayData._id}</div>
            {dayData.items.map((item, i) => (
              <div key={i} className="day-item-row">
                <span className="day-item-name" title={item.name}>{item.name}</span>
                <span className="day-item-qty">{item.totalQty}</span>
              </div>
            ))}
            {dayData.count > 5 && <div style={{fontSize:11, color:'#888', marginTop:8}}>+ {dayData.count - 5} more...</div>}
          </div>
        ))}
        {(stats.weeklySales || []).length === 0 && <div style={{ color: '#888', padding: 16 }}>No sales data available for this week.</div>}
      </div>

      <div className="section-title">Best Selling Products</div>
      <div className="best-selling-grid">
        {(stats.bestSelling||[]).map(p => (
          <div key={p._id} className="product-stat-card">
            <div className="product-name">{p.name}</div>
            <div className="product-meta">
              <span>{p.totalSold} sold</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>₹{p.totalRevenue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
