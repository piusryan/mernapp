import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../home.css'
import { API_BASE } from '../api'

export default function Items() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [qty, setQty] = useState({})
  const [view, setView] = useState('all')
  const [popup, setPopup] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [reviews, setReviews] = useState({})
  const [reviewInputs, setReviewInputs] = useState({})
  const [editing, setEditing] = useState({})
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const query = params.get('q') || ''
  let isAdmin = false
  const tokenRaw = localStorage.getItem('token')
  if (tokenRaw) {
    try {
      const payload = JSON.parse(atob(tokenRaw.split('.')[1]))
      isAdmin = payload && payload.role === 'admin' && payload.username === 'AJadmin'
    } catch {}
  }
  function srcFor(it) {
    const p = it.imagePath || ''
    if (!p) return ''
    return p.startsWith('http') ? p : `${API_BASE}${p}`
  }

  useEffect(() => {
    const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
    fetch(url)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError('Failed to load items'))
  }, [query])

  async function addToCart(itemId) {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    try {
      const res = await fetch(`${API_BASE}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, quantity: Math.max(1, Number(qty[itemId] || 1)) }),
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        return navigate('/login')
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Add to cart failed')
      }
      const added = items.find((x) => x._id === itemId)
      setPopup({ name: added?.name || 'Item', qty: Math.max(1, Number(qty[itemId] || 1)) })
    } catch (e) {
      setError(e.message)
    }
  }
  async function updateStatus(itemId, status) {
    try {
      const token = localStorage.getItem('token')
      if (!token) return navigate('/login')
      const res = await fetch(`${API_BASE}/api/admin/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stockStatus: status }),
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        return navigate('/login')
      }
      const data = await res.json()
      if (!res.ok) return alert(data.error || 'Update failed')
      const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
      fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
    } catch (e) {
      setError(e.message)
    }
  }
  function statusColor(s) {
    if (s === 'available') return '#0a7'
    if (s === 'limited') return '#d9a300'
    if (s === 'outofstock') return '#d33'
    return '#555'
  }

  async function toggleReviews(item) {
    const now = !expanded[item._id]
    setExpanded((p) => ({ ...p, [item._id]: now }))
    if (now && !reviews[item._id]) {
      try {
        const res = await fetch(`${API_BASE}/api/items/${item._id}/reviews`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load reviews')
        setReviews((p)=>({ ...p, [item._id]: data }))
        setReviewInputs((p)=>({ ...p, [item._id]: { rating: 5, comment: '' } }))
      } catch (e) {
        setError(e.message)
      }
    }
  }

  async function submitReviewInline(itemId) {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    try {
      const input = reviewInputs[itemId] || { rating: 5, comment: '' }
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, rating: input.rating, comment: input.comment }),
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        return navigate('/login')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit review')
      alert(data.approved ? 'Review submitted!' : 'Submitted for moderation')
      const r2 = await fetch(`${API_BASE}/api/items/${itemId}/reviews`)
      const d2 = await r2.json()
      setReviews((p)=>({ ...p, [itemId]: d2 }))
      setReviewInputs((p)=>({ ...p, [itemId]: { rating: 5, comment: '' } }))
      const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
      fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container">
      <h2>Items {query ? `(search: ${query})` : ''}</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn-modern" onClick={() => setView('all')} disabled={view==='all'}>All</button>
        <button className="btn-modern" onClick={() => setView('raw')} disabled={view==='raw'}>Raw Meat</button>
        <button className="btn-modern" onClick={() => setView('processed')} disabled={view==='processed'}>Processed Meat</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {view === 'all' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h3>Raw Meat</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {items.filter((i) => i.category === 'raw').map((it) => (
                <div key={it._id} className="item-card" style={{ padding: 12 }}>
                  {srcFor(it) ? (
                    <img src={srcFor(it)} alt={it.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
                  ) : <div style={{ width:'100%', height:140, background:'#f5f5f5', borderRadius:6 }} />}
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{it.name}</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: statusColor(it.stockStatus || 'available'), fontWeight: 600 }}>
                      {(it.stockStatus || 'available') === 'available' ? 'available' : (it.stockStatus || 'available')}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>₹{it.price}</span>
                    <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                  </div>
                  <div className="item-desc">
                    {(it.grams||it.pieces||it.serves) ? (
                      <span>
                        {it.grams ? `${it.grams} g` : ''} {it.pieces ? `• ${it.pieces} pcs` : ''} {it.serves ? `• serves ${it.serves}` : ''}
                      </span>
                    ) : null}
                    {it.description ? <div className="item-desc-text">{it.description}</div> : null}
                  </div>
                  {isAdmin && !editing[it._id] && (
                    <div className="actions">
                      <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: { name: it.name, price: it.price, category: it.category, imagePath: it.imagePath || '', description: it.description || '', grams: it.grams || 0, pieces: it.pieces || 0, serves: it.serves || 0 } }))}>Edit</button>
                      <button className="btn-modern" onClick={async()=>{
                        const ok = window.confirm('Delete this item?')
                        if (!ok) return
                        const t = localStorage.getItem('token')
                        if (!t) return navigate('/login')
                        const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, { method:'DELETE', headers: { Authorization: `Bearer ${t}` } })
                        if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                        const data = await res.json()
                        if (!res.ok) return alert(data.error || 'Delete failed')
                        const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                        fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                      }}>Delete</button>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button className="btn-modern" style={{ color: '#0a7' }} onClick={()=>updateStatus(it._id, 'available')} disabled={(it.stockStatus||'available')==='available'}>available</button>
                        <button className="btn-modern" style={{ color: '#d9a300' }} onClick={()=>updateStatus(it._id, 'limited')} disabled={(it.stockStatus||'available')==='limited'}>limited</button>
                        <button className="btn-modern" style={{ color: '#d33' }} onClick={()=>updateStatus(it._id, 'outofstock')} disabled={(it.stockStatus||'available')==='outofstock'}>outofstock</button>
                      </div>
                    </div>
                  )}
                  {isAdmin && editing[it._id] && (
                    <div className="review-section">
                      <div className="review-form">
                        <select value={editing[it._id].category} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], category: e.target.value } }))}>
                          <option value="raw">raw</option>
                          <option value="processed">processed</option>
                        </select>
                        <input className="review-input" placeholder="Name" value={editing[it._id].name} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], name: e.target.value } }))} />
                        <input className="review-input" placeholder="Price" value={editing[it._id].price} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], price: e.target.value } }))} />
                      </div>
                      <div className="review-form">
                        <input className="review-input" placeholder="Image URL" value={editing[it._id].imagePath} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], imagePath: e.target.value } }))} />
                      </div>
                      <div className="review-form">
                        <input className="review-input" type="number" min={0} placeholder="grams" value={editing[it._id].grams} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], grams: Number(e.target.value) } }))} />
                        <input className="review-input" type="number" min={0} placeholder="pieces" value={editing[it._id].pieces} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], pieces: Number(e.target.value) } }))} />
                        <input className="review-input" type="number" min={0} placeholder="serves" value={editing[it._id].serves} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], serves: Number(e.target.value) } }))} />
                      </div>
                      <div className="review-form">
                        <textarea className="review-input" rows={3} placeholder="Description" value={editing[it._id].description} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], description: e.target.value } }))} />
                      </div>
                      <div className="actions">
                        <button className="auth-btn" onClick={async()=>{
                          const t = localStorage.getItem('token')
                          if (!t) return navigate('/login')
                          const body = editing[it._id]
                          const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, {
                            method:'PUT',
                            headers: { 'Content-Type':'application/json', Authorization: `Bearer ${t}` },
                            body: JSON.stringify(body)
                          })
                          if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                          const data = await res.json()
                          if (!res.ok) return alert(data.error || 'Update failed')
                          setEditing((p)=>({ ...p, [it._id]: null }))
                          const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                          fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                        }}>Save</button>
                        <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: null }))}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="actions">
                    <input
                      type="number"
                      min={1}
                      value={qty[it._id] ?? 1}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setQty((prev) => ({ ...prev, [it._id]: isNaN(v) ? 1 : Math.max(1, v) }))
                      }}
                      className="aj-qty"
                    />
                    {((it.stockStatus || 'available') !== 'outofstock') && (
                      <button className="aj-cta" onClick={() => addToCart(it._id)}>Add to cart</button>
                    )}
                  </div>
                  <div className="review-toggle" onClick={()=>toggleReviews(it)}>
                    <span>Reviews</span>
                    <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                    <span className="chev">{expanded[it._id] ? '▴' : '▾'}</span>
                  </div>
                  {expanded[it._id] && (
                    <div className="review-section">
                      {(!reviews[it._id] || reviews[it._id].reviews.length === 0) && <p>No reviews yet</p>}
                      {reviews[it._id] && reviews[it._id].reviews.map((r) => (
                      <div className="review-item">
                        <div className="review-head">⭐ {r.rating} — {r.username}</div>
                        {r.comment && <div className="review-text">{r.comment}</div>}
                        <div className="review-date">{new Date(r.createdAt).toLocaleString()}</div>
                        {isAdmin && (
                          <button
                            className="btn-modern"
                            onClick={async ()=>{
                              const t = localStorage.getItem('token')
                              if (!t) return navigate('/login')
                              const del = await fetch(`${API_BASE}/api/admin/reviews/${r._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
                              if (del.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                              if (!del.ok) { const dd = await del.json(); return alert(dd.error || 'Delete failed') }
                              const r2 = await fetch(`${API_BASE}/api/items/${it._id}/reviews`)
                              const d2 = await r2.json()
                              setReviews((p)=>({ ...p, [it._id]: d2 }))
                              const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                              fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                      <div className="review-form">
                        <select
                          value={(reviewInputs[it._id]?.rating) ?? 5}
                          onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), rating: Number(e.target.value) } }))}
                        >
                          {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                        </select>
                        <input
                          className="review-input"
                          placeholder="Share your experience"
                          value={(reviewInputs[it._id]?.comment) ?? ''}
                          onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), comment: e.target.value } }))}
                        />
                        <button className="btn-modern" onClick={()=>submitReviewInline(it._id)}>Submit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Processed Meat</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {items.filter((i) => i.category === 'processed').map((it) => (
                <div key={it._id} className="item-card" style={{ padding: 12 }}>
                  {srcFor(it) ? (
                    <img src={srcFor(it)} alt={it.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
                  ) : <div style={{ width:'100%', height:140, background:'#f5f5f5', borderRadius:6 }} />}
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{it.name}</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: statusColor(it.stockStatus || 'available'), fontWeight: 600 }}>
                      {(it.stockStatus || 'available') === 'available' ? 'available' : (it.stockStatus || 'available')}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>₹{it.price}</span>
                    <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                  </div>
                  <div className="item-desc">
                    {(it.grams||it.pieces||it.serves) ? (
                      <span>
                        {it.grams ? `${it.grams} g` : ''} {it.pieces ? `• ${it.pieces} pcs` : ''} {it.serves ? `• serves ${it.serves}` : ''}
                      </span>
                    ) : null}
                    {it.description ? <div className="item-desc-text">{it.description}</div> : null}
                  </div>
                  {isAdmin && !editing[it._id] && (
                    <div className="actions">
                      <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: { name: it.name, price: it.price, category: it.category, imagePath: it.imagePath || '', description: it.description || '', grams: it.grams || 0, pieces: it.pieces || 0, serves: it.serves || 0 } }))}>Edit</button>
                      <button className="btn-modern" onClick={async()=>{
                        const ok = window.confirm('Delete this item?')
                        if (!ok) return
                        const t = localStorage.getItem('token')
                        if (!t) return navigate('/login')
                        const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, { method:'DELETE', headers: { Authorization: `Bearer ${t}` } })
                        if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                        const data = await res.json()
                        if (!res.ok) return alert(data.error || 'Delete failed')
                        const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                        fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                      }}>Delete</button>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button className="btn-modern" style={{ color: '#0a7' }} onClick={()=>updateStatus(it._id, 'available')} disabled={(it.stockStatus||'available')==='available'}>available</button>
                        <button className="btn-modern" style={{ color: '#d9a300' }} onClick={()=>updateStatus(it._id, 'limited')} disabled={(it.stockStatus||'available')==='limited'}>limited</button>
                        <button className="btn-modern" style={{ color: '#d33' }} onClick={()=>updateStatus(it._id, 'outofstock')} disabled={(it.stockStatus||'available')==='outofstock'}>outofstock</button>
                      </div>
                    </div>
                  )}
                  {isAdmin && editing[it._id] && (
                    <div className="review-section">
                      <div className="review-form">
                        <select value={editing[it._id].category} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], category: e.target.value } }))}>
                          <option value="raw">raw</option>
                          <option value="processed">processed</option>
                        </select>
                        <input className="review-input" placeholder="Name" value={editing[it._id].name} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], name: e.target.value } }))} />
                        <input className="review-input" placeholder="Price" value={editing[it._id].price} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], price: e.target.value } }))} />
                      </div>
                      <div className="review-form">
                        <input className="review-input" placeholder="Image URL" value={editing[it._id].imagePath} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], imagePath: e.target.value } }))} />
                      </div>
                      <div className="review-form">
                        <input className="review-input" type="number" min={0} placeholder="grams" value={editing[it._id].grams} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], grams: Number(e.target.value) } }))} />
                        <input className="review-input" type="number" min={0} placeholder="pieces" value={editing[it._id].pieces} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], pieces: Number(e.target.value) } }))} />
                        <input className="review-input" type="number" min={0} placeholder="serves" value={editing[it._id].serves} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], serves: Number(e.target.value) } }))} />
                      </div>
                      <div className="review-form">
                        <textarea className="review-input" rows={3} placeholder="Description" value={editing[it._id].description} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], description: e.target.value } }))} />
                      </div>
                      <div className="actions">
                        <button className="auth-btn" onClick={async()=>{
                          const t = localStorage.getItem('token')
                          if (!t) return navigate('/login')
                          const body = editing[it._id]
                          const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, {
                            method:'PUT',
                            headers: { 'Content-Type':'application/json', Authorization: `Bearer ${t}` },
                            body: JSON.stringify(body)
                          })
                          if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                          const data = await res.json()
                          if (!res.ok) return alert(data.error || 'Update failed')
                          setEditing((p)=>({ ...p, [it._id]: null }))
                          const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                          fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                        }}>Save</button>
                        <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: null }))}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="actions">
                    <input
                      type="number"
                      min={1}
                      value={qty[it._id] ?? 1}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setQty((prev) => ({ ...prev, [it._id]: isNaN(v) ? 1 : Math.max(1, v) }))
                      }}
                      className="aj-qty"
                    />
                    {((it.stockStatus || 'available') !== 'outofstock') && (
                      <button className="aj-cta" onClick={() => addToCart(it._id)}>Add to cart</button>
                    )}
                  </div>
                  <div className="review-toggle" onClick={()=>toggleReviews(it)}>
                    <span>Reviews</span>
                    <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                    <span className="chev">{expanded[it._id] ? '▴' : '▾'}</span>
                  </div>
                  {expanded[it._id] && (
                    <div className="review-section">
                      {(!reviews[it._id] || reviews[it._id].reviews.length === 0) && <p>No reviews yet</p>}
                      {reviews[it._id] && reviews[it._id].reviews.map((r) => (
                      <div className="review-item">
                        <div className="review-head">⭐ {r.rating} — {r.username}</div>
                        {r.comment && <div className="review-text">{r.comment}</div>}
                        <div className="review-date">{new Date(r.createdAt).toLocaleString()}</div>
                        {isAdmin && (
                          <button
                            className="btn-modern"
                            onClick={async ()=>{
                              const t = localStorage.getItem('token')
                              if (!t) return navigate('/login')
                              const del = await fetch(`${API_BASE}/api/admin/reviews/${r._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
                              if (del.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                              if (!del.ok) { const dd = await del.json(); return alert(dd.error || 'Delete failed') }
                              const r2 = await fetch(`${API_BASE}/api/items/${it._id}/reviews`)
                              const d2 = await r2.json()
                              setReviews((p)=>({ ...p, [it._id]: d2 }))
                              const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                              fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                      <div className="review-form">
                        <select
                          value={(reviewInputs[it._id]?.rating) ?? 5}
                          onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), rating: Number(e.target.value) } }))}
                        >
                          {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                        </select>
                        <input
                          className="review-input"
                          placeholder="Share your experience"
                          value={(reviewInputs[it._id]?.comment) ?? ''}
                          onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), comment: e.target.value } }))}
                        />
                        <button className="btn-modern" onClick={()=>submitReviewInline(it._id)}>Submit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {items.filter((i) => (view === 'raw' ? i.category === 'raw' : i.category === 'processed')).map((it) => (
            <div key={it._id} className="item-card" style={{ padding: 12 }}>
              {srcFor(it) ? (
                <img src={srcFor(it)} alt={it.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
              ) : <div style={{ width:'100%', height:140, background:'#f5f5f5', borderRadius:6 }} />}
              <div style={{ fontWeight: 600, marginTop: 8 }}>{it.name}</div>
              <div style={{ marginTop: 4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>₹{it.price}</span>
                <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
              </div>
              <div className="item-desc">
                {(it.grams||it.pieces||it.serves) ? (
                  <span>
                    {it.grams ? `${it.grams} g` : ''} {it.pieces ? `• ${it.pieces} pcs` : ''} {it.serves ? `• serves ${it.serves}` : ''}
                  </span>
                ) : null}
                {it.description ? <div className="item-desc-text">{it.description}</div> : null}
              </div>
              {isAdmin && !editing[it._id] && (
                <div className="actions">
                  <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: { name: it.name, price: it.price, category: it.category, imagePath: it.imagePath || '', description: it.description || '', grams: it.grams || 0, pieces: it.pieces || 0, serves: it.serves || 0 } }))}>Edit</button>
                  <button className="btn-modern" onClick={async()=>{
                    const ok = window.confirm('Delete this item?')
                    if (!ok) return
                    const t = localStorage.getItem('token')
                    if (!t) return navigate('/login')
                    const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, { method:'DELETE', headers: { Authorization: `Bearer ${t}` } })
                    if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                    const data = await res.json()
                    if (!res.ok) return alert(data.error || 'Delete failed')
                    const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                    fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                  }}>Delete</button>
                </div>
              )}
              {isAdmin && editing[it._id] && (
                <div className="review-section">
                  <div className="review-form">
                    <select value={editing[it._id].category} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], category: e.target.value } }))}>
                      <option value="raw">raw</option>
                      <option value="processed">processed</option>
                    </select>
                    <input className="review-input" placeholder="Name" value={editing[it._id].name} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], name: e.target.value } }))} />
                    <input className="review-input" placeholder="Price" value={editing[it._id].price} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], price: e.target.value } }))} />
                  </div>
                  <div className="review-form">
                    <input className="review-input" placeholder="Image URL" value={editing[it._id].imagePath} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], imagePath: e.target.value } }))} />
                  </div>
                  <div className="review-form">
                    <input className="review-input" type="number" min={0} placeholder="grams" value={editing[it._id].grams} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], grams: Number(e.target.value) } }))} />
                    <input className="review-input" type="number" min={0} placeholder="pieces" value={editing[it._id].pieces} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], pieces: Number(e.target.value) } }))} />
                    <input className="review-input" type="number" min={0} placeholder="serves" value={editing[it._id].serves} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], serves: Number(e.target.value) } }))} />
                  </div>
                  <div className="review-form">
                    <textarea className="review-input" rows={3} placeholder="Description" value={editing[it._id].description} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], description: e.target.value } }))} />
                  </div>
                  <div className="actions">
                    <button className="auth-btn" onClick={async()=>{
                      const t = localStorage.getItem('token')
                      if (!t) return navigate('/login')
                      const body = editing[it._id]
                      const res = await fetch(`${API_BASE}/api/admin/items/${it._id}`, {
                        method:'PUT',
                        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${t}` },
                        body: JSON.stringify(body)
                      })
                      if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                      const data = await res.json()
                      if (!res.ok) return alert(data.error || 'Update failed')
                      setEditing((p)=>({ ...p, [it._id]: null }))
                      const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                      fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                    }}>Save</button>
                    <button className="btn-modern" onClick={()=>setEditing((p)=>({ ...p, [it._id]: null }))}>Cancel</button>
                  </div>
                </div>
              )}
              <div className="actions">
                <input
                  type="number"
                  min={1}
                  value={qty[it._id] ?? 1}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setQty((prev) => ({ ...prev, [it._id]: isNaN(v) ? 1 : Math.max(1, v) }))
                  }}
                  className="aj-qty"
                />
                <button className="aj-cta" onClick={() => addToCart(it._id)}>Add to cart</button>
              </div>
              <div className="review-toggle" onClick={()=>toggleReviews(it)}>
                <span>Reviews</span>
                <span className="rating-badge">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
                <span className="chev">{expanded[it._id] ? '▴' : '▾'}</span>
              </div>
              {expanded[it._id] && (
                <div className="review-section">
                  {(!reviews[it._id] || reviews[it._id].reviews.length === 0) && <p>No reviews yet</p>}
                  {reviews[it._id] && reviews[it._id].reviews.map((r) => (
                    <div className="review-item">
                      <div className="review-head">⭐ {r.rating} — {r.username}</div>
                      {r.comment && <div className="review-text">{r.comment}</div>}
                      <div className="review-date">{new Date(r.createdAt).toLocaleString()}</div>
                      {isAdmin && (
                        <button
                          className="btn-modern"
                          onClick={async ()=>{
                            const t = localStorage.getItem('token')
                            if (!t) return navigate('/login')
                            const del = await fetch(`${API_BASE}/api/admin/reviews/${r._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
                            if (del.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
                            if (!del.ok) { const dd = await del.json(); return alert(dd.error || 'Delete failed') }
                            const r2 = await fetch(`${API_BASE}/api/items/${it._id}/reviews`)
                            const d2 = await r2.json()
                            setReviews((p)=>({ ...p, [it._id]: d2 }))
                            const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
                            fetch(url).then((r)=>r.json()).then(setItems).catch(()=>{})
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="review-form">
                    <select
                      value={(reviewInputs[it._id]?.rating) ?? 5}
                      onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), rating: Number(e.target.value) } }))}
                    >
                      {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input
                      className="review-input"
                      placeholder="Share your experience"
                      value={(reviewInputs[it._id]?.comment) ?? ''}
                      onChange={(e)=>setReviewInputs((p)=>({ ...p, [it._id]: { ...(p[it._id]||{ rating:5, comment:'' }), comment: e.target.value } }))}
                    />
                    <button className="btn-modern" onClick={()=>submitReviewInline(it._id)}>Submit</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {popup && (
        <div className="overlay" onClick={() => setPopup(null)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h4>Added to cart</h4>
            <div>{popup.name} × {popup.qty}</div>
            <button className="primary-btn ok" onClick={() => setPopup(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}
