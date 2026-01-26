import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../home.css'
import { API_BASE } from '../api'
import ItemCard from './ItemCard'

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
  const [sortOption, setSortOption] = useState('default')
  const [maxPrice, setMaxPrice] = useState(5000)
  const [wishlistIds, setWishlistIds] = useState(new Set())
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

  useEffect(() => {
    const url = query ? `${API_BASE}/api/items?q=${encodeURIComponent(query)}` : `${API_BASE}/api/items`
    fetch(url)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError('Failed to load items'))
    
    // Fetch Wishlist
    const token = localStorage.getItem('token')
    if (token) {
      fetch(`${API_BASE}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.items) {
            setWishlistIds(new Set(d.items.map(i => i.itemId)))
          }
        })
        .catch(() => {})
    }
  }, [query])

  async function toggleWishlist(itemId) {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')

    const newSet = new Set(wishlistIds)
    if (newSet.has(itemId)) {
      newSet.delete(itemId)
    } else {
      newSet.add(itemId)
    }
    setWishlistIds(newSet)

    try {
      await fetch(`${API_BASE}/api/wishlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId })
      })
    } catch (e) {
      console.error(e)
    }
  }

  function getVisibleItems(category) {
    let res = items
    if (category) res = res.filter(i => i.category === category)
    
    // Filter by price
    res = res.filter(i => (i.price || 0) <= maxPrice)

    // Sort
    if (sortOption === 'priceAsc') res = [...res].sort((a, b) => (a.price||0) - (b.price||0))
    if (sortOption === 'priceDesc') res = [...res].sort((a, b) => (b.price||0) - (a.price||0))
    
    return res
  }

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

  async function deleteReview(itemId, reviewId) {
    const token = localStorage.getItem('token')
    if (!token) return navigate('/login')
    try {
      const res = await fetch(`${API_BASE}/api/admin/items/${itemId}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        return navigate('/login')
      }
      if (!res.ok) {
         const data = await res.json()
         throw new Error(data.error || 'Delete review failed')
      }
      // Refresh reviews
      const r2 = await fetch(`${API_BASE}/api/items/${itemId}/reviews`)
      const d2 = await r2.json()
      setReviews((p)=>({ ...p, [itemId]: d2 }))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container items-page">
      <div className="page-header">
        <h2 className="page-title">Items {query ? `(search: ${query})` : ''}</h2>
        <div className="category-tabs">
          <button className={`tab-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>All</button>
          <button className={`tab-btn ${view === 'raw' ? 'active' : ''}`} onClick={() => setView('raw')}>Raw Meat</button>
          <button className={`tab-btn ${view === 'processed' ? 'active' : ''}`} onClick={() => setView('processed')}>Processed Meat</button>
        </div>
      </div>
      
      {error && <p className="error-msg">{error}</p>}
      
      <div className="filters-toolbar">
          <div className="filter-group">
             <label>Sort By</label>
             <div className="select-wrapper">
               <select 
                 value={sortOption} 
                 onChange={e => setSortOption(e.target.value)} 
               >
                 <option value="default">Default</option>
                 <option value="priceAsc">Price: Low to High</option>
                 <option value="priceDesc">Price: High to Low</option>
               </select>
             </div>
          </div>
          <div className="filter-divider"></div>
          <div className="filter-group">
             <label>Max Price: ₹{maxPrice}</label>
             <input
               type="range"
               min="0"
               max="5000"
               step="50"
               value={maxPrice}
               onChange={e => setMaxPrice(Number(e.target.value))}
               className="price-slider"
             />
          </div>
      </div>

      {view === 'all' ? (
        <div className="category-split-layout">
          <div className="category-section">
            <h3 className="section-title">Raw Meat</h3>
            <div className="items-grid">
              {getVisibleItems('raw').map((it) => (
                <ItemCard 
                  key={it._id} 
                  it={it} 
                  wishlistIds={wishlistIds} 
                  toggleWishlist={toggleWishlist} 
                  addToCart={addToCart} 
                  qty={qty} 
                  setQty={setQty} 
                  isAdmin={isAdmin} 
                  editing={editing} 
                  setEditing={setEditing} 
                  updateStatus={updateStatus} 
                  expanded={expanded} 
                  toggleReviews={toggleReviews} 
                  reviews={reviews} 
                  reviewInputs={reviewInputs} 
                  setReviewInputs={setReviewInputs} 
                  submitReviewInline={submitReviewInline}
                  deleteReview={deleteReview}
                  navigate={navigate}
                  query={query}
                  setItems={setItems}
                />
              ))}
            </div>
          </div>
          <div className="category-section">
            <h3 className="section-title">Processed Meat</h3>
            <div className="items-grid">
              {getVisibleItems('processed').map((it) => (
                <ItemCard 
                  key={it._id} 
                  it={it} 
                  wishlistIds={wishlistIds} 
                  toggleWishlist={toggleWishlist} 
                  addToCart={addToCart} 
                  qty={qty} 
                  setQty={setQty} 
                  isAdmin={isAdmin} 
                  editing={editing} 
                  setEditing={setEditing} 
                  updateStatus={updateStatus} 
                  expanded={expanded} 
                  toggleReviews={toggleReviews} 
                  reviews={reviews} 
                  reviewInputs={reviewInputs} 
                  setReviewInputs={setReviewInputs} 
                  submitReviewInline={submitReviewInline}
                  deleteReview={deleteReview}
                  navigate={navigate}
                  query={query}
                  setItems={setItems}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="items-grid">
          {getVisibleItems(view === 'raw' ? 'raw' : 'processed').map((it) => (
            <ItemCard 
              key={it._id} 
              it={it} 
              wishlistIds={wishlistIds} 
              toggleWishlist={toggleWishlist} 
              addToCart={addToCart} 
              qty={qty} 
              setQty={setQty} 
              isAdmin={isAdmin} 
              editing={editing} 
              setEditing={setEditing} 
              updateStatus={updateStatus} 
              expanded={expanded} 
              toggleReviews={toggleReviews} 
              reviews={reviews} 
              reviewInputs={reviewInputs} 
              setReviewInputs={setReviewInputs} 
              submitReviewInline={submitReviewInline}
              deleteReview={deleteReview}
              navigate={navigate}
              query={query}
              setItems={setItems}
            />
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
