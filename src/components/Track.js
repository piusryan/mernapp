import React, { useEffect, useState } from 'react'
import '../home.css'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function Track() {
  const [code, setCode] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])
  const [recentError, setRecentError] = useState('')
  const [recentLoading, setRecentLoading] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const isAdmin = payload && payload.role === 'admin'
      if (!isAdmin) return navigate('/')
    } catch {
      navigate('/')
    }
  }, [navigate])
  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = localStorage.getItem('token')
      if (!token) return
      setRecentLoading(true)
      setRecentError('')
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders/recent?limit=10`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await res.json()
        if (!res.ok) {
          if (!cancelled) {
            setRecent([])
            setRecentError(d.error || 'Failed to load recent orders')
          }
          return
        }
        if (!cancelled) {
          setRecent(Array.isArray(d) ? d : [])
        }
      } catch (e) {
        if (!cancelled) {
          setRecent([])
          setRecentError(e.message || 'Failed to load recent orders')
        }
      } finally {
        if (!cancelled) setRecentLoading(false)
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
  async function lookup(e) {
    e.preventDefault()
    setError('')
    setData(null)
    const t = code.trim()
    if (!t) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/orders/track/${encodeURIComponent(t)}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      if (!res.ok) return setError(d.error || 'Track failed')
      setData(d)
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <div className="container">
      <h2>Track Your Order</h2>
      <form className="nav-search" onSubmit={lookup} style={{ marginBottom: 12 }}>
        <input className="search-input" placeholder="Enter Tracking (ORD-2025-...) or Order ID" value={code} onChange={(e)=>setCode(e.target.value)} />
        <button className="search-btn" type="submit">Track</button>
      </form>
      {error && <p style={{ color:'red' }}>{error}</p>}
      {data && (
        <div className="item-card" style={{ padding: 16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700 }}>Tracking: {data.trackingNumber}</div>
              <div style={{ color:'#555' }}>Placed: {new Date(data.createdAt).toLocaleString()}</div>
              <div style={{ marginTop:4 }}>Status: <span className="status-badge">{data.status}</span></div>
            </div>
            <div style={{ fontWeight:700 }}>Total: ₹{Number(data.totalAmount||0).toFixed(0)}</div>
          </div>
          <h3 style={{ marginTop: 12 }}>Timeline</h3>
          <div>
            {(data.history||[]).map((h, idx)=>(
              <div key={idx} className="review-item" style={{ display:'grid', gridTemplateColumns:'180px 1fr 120px', gap:8 }}>
                <div>{new Date(h.createdAt).toLocaleString()}</div>
                <div><b>{h.status}</b>{h.message ? ` — ${h.message}` : ''}</div>
                <div style={{ textAlign:'right', color:'#666' }}>{h.updatedBy}</div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 12 }}>Items</h3>
          <ul>
            {(data.items||[]).map((i, idx)=>(
              <li key={idx}>{i.name} × {i.quantity} — ₹{i.price * i.quantity}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <h3>Order Inbox</h3>
        <div className="item-card" style={{ padding: 16, marginTop: 8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
            <div style={{ fontWeight:700 }}>Latest Transactions</div>
            <div style={{ fontSize: 12, color:'#666' }}>Auto-refreshed every 30 seconds</div>
          </div>
          {recentLoading && <p>Loading recent orders...</p>}
          {recentError && <p style={{ color:'red' }}>{recentError}</p>}
          {!recentLoading && !recentError && recent.length === 0 && (
            <p style={{ color:'#555' }}>No orders have been placed yet.</p>
          )}
          {!recentLoading && recent.length > 0 && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'170px 1fr 110px 120px 220px', fontSize:12, fontWeight:600, color:'#555', padding:'6px 0', borderBottom:'1px solid #eee' }}>
                <div>Order / Tracking</div>
                <div>Customer</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Latest Update</div>
              </div>
              {recent.map((o)=>(
                <div key={o.id} className="review-item" style={{ display:'grid', gridTemplateColumns:'170px 1fr 110px 120px 220px', gap:8, padding:'8px 0', borderBottom:'1px solid #f2f2f2' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{o.trackingNumber || 'No tracking'}</div>
                    <div style={{ fontSize:12, color:'#777' }}>{new Date(o.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight:500 }}>{o.username || 'Unknown'}</div>
                    <div style={{ fontSize:12, color:'#777' }}>Order ID: {o.id}</div>
                  </div>
                  <div style={{ fontWeight:600 }}>₹{Number(o.totalAmount||0).toFixed(0)}</div>
                  <div>
                    <span className="status-badge">{o.lastStatus || o.status}</span>
                  </div>
                  <div>
                    <div style={{ fontSize:12 }}>{o.lastMessage || 'No additional notes'}</div>
                    <div style={{ fontSize:11, color:'#777', marginTop:2 }}>Updated: {new Date(o.lastUpdatedAt || o.updatedAt || o.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
