import React from 'react'
import { API_BASE } from '../api'

export default function ItemCard({ 
  it, 
  wishlistIds, 
  toggleWishlist, 
  addToCart, 
  qty, 
  setQty, 
  isAdmin, 
  editing, 
  setEditing, 
  updateStatus, 
  expanded, 
  toggleReviews, 
  reviews, 
  reviewInputs, 
  setReviewInputs, 
  submitReviewInline,
  deleteReview,
  navigate,
  query,
  setItems
}) {

  function srcFor(it) {
    const p = it.imagePath || ''
    if (!p) return ''
    return p.startsWith('http') ? p : `${API_BASE}${p}`
  }

  return (
    <div className="item-card modern-card">
      <div 
        onClick={() => toggleWishlist(it._id)}
        className="wishlist-btn"
        title={wishlistIds.has(it._id) ? "Remove from Wishlist" : "Add to Wishlist"}
      >
        {wishlistIds.has(it._id) ? '❤️' : '🤍'}
      </div>
      
      <div className="card-img-wrapper">
        {srcFor(it) ? (
          <img src={srcFor(it)} alt={it.name} />
        ) : <div className="placeholder-img" />}
      </div>

      <div className="card-content">
        <div className="card-header">
          <div className="item-name">{it.name}</div>
          <span className={`status-badge status-${it.stockStatus || 'available'}`}>
            {(it.stockStatus || 'available') === 'available' ? 'In Stock' : (it.stockStatus || 'available')}
          </span>
        </div>
        
        <div className="price-rating-row">
          <span className="price-tag">₹{it.price}</span>
          <span className="rating-pill">⭐ {Number(it.ratingAvg||0).toFixed(1)} ({it.ratingCount||0})</span>
        </div>

        <div className="item-desc">
          {(it.grams||it.pieces||it.serves) ? (
            <span className="item-specs">
              {it.grams ? `${it.grams} g` : ''} {it.pieces ? `• ${it.pieces} pcs` : ''} {it.serves ? `• serves ${it.serves}` : ''}
            </span>
          ) : null}
          {it.description ? <div className="item-desc-text">{it.description}</div> : null}
        </div>

        {/* Admin Actions */}
        {isAdmin && !editing[it._id] && (
          <div className="admin-actions">
            <button className="btn-sm btn-edit" onClick={()=>setEditing((p)=>({ ...p, [it._id]: { name: it.name, price: it.price, category: it.category, imagePath: it.imagePath || '', description: it.description || '', grams: it.grams || 0, pieces: it.pieces || 0, serves: it.serves || 0 } }))}>Edit</button>
            <button className="btn-sm btn-delete" onClick={async()=>{
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
            <div className="stock-controls">
              <button className={`btn-stock ${it.stockStatus === 'available' ? 'active' : ''}`} onClick={()=>updateStatus(it._id, 'available')}>In Stock</button>
              <button className={`btn-stock ${it.stockStatus === 'limited' ? 'active' : ''}`} onClick={()=>updateStatus(it._id, 'limited')}>Low</button>
              <button className={`btn-stock ${it.stockStatus === 'outofstock' ? 'active' : ''}`} onClick={()=>updateStatus(it._id, 'outofstock')}>Out</button>
            </div>
          </div>
        )}

        {/* Edit Mode */}
        {isAdmin && editing[it._id] && (
          <div className="edit-form">
            <div className="form-row">
              <select className="form-input" value={editing[it._id].category} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], category: e.target.value } }))}>
                <option value="raw">raw</option>
                <option value="processed">processed</option>
              </select>
              <input className="form-input" placeholder="Name" value={editing[it._id].name} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], name: e.target.value } }))} />
              <input className="form-input" placeholder="Price" value={editing[it._id].price} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], price: e.target.value } }))} />
            </div>
            <div className="form-row">
              <input className="form-input" placeholder="Image URL" value={editing[it._id].imagePath} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], imagePath: e.target.value } }))} />
            </div>
            <div className="form-row">
              <input className="form-input" type="number" min={0} placeholder="grams" value={editing[it._id].grams} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], grams: Number(e.target.value) } }))} />
              <input className="form-input" type="number" min={0} placeholder="pieces" value={editing[it._id].pieces} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], pieces: Number(e.target.value) } }))} />
              <input className="form-input" type="number" min={0} placeholder="serves" value={editing[it._id].serves} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], serves: Number(e.target.value) } }))} />
            </div>
            <div className="form-row">
               <textarea className="form-input" rows={3} placeholder="Description" value={editing[it._id].description} onChange={(e)=>setEditing((p)=>({ ...p, [it._id]: { ...p[it._id], description: e.target.value } }))} />
            </div>
            <div className="form-actions">
              <button className="btn-save" onClick={async()=>{
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
              <button className="btn-cancel" onClick={()=>setEditing((p)=>({ ...p, [it._id]: null }))}>Cancel</button>
            </div>
          </div>
        )}

        <div className="card-actions">
          <div className="qty-wrapper">
            <button className="qty-btn" onClick={() => setQty(prev => ({ ...prev, [it._id]: Math.max(1, (prev[it._id] || 1) - 1) }))}>-</button>
            <input
              type="number"
              value={qty[it._id] ?? 1}
              onChange={(e) => {
                const val = e.target.value
                const v = Number(val)
                setQty((prev) => ({ ...prev, [it._id]: isNaN(v) ? 1 : Math.max(0, v) }))
              }}
              className="qty-input"
            />
            <button className="qty-btn" onClick={() => setQty(prev => ({ ...prev, [it._id]: (prev[it._id] || 1) + 1 }))}>+</button>
          </div>
          {((it.stockStatus || 'available') !== 'outofstock') && (
            <button className="add-cart-btn" onClick={() => addToCart(it._id)}>
              Add to Cart
            </button>
          )}
        </div>

        <div className="review-toggle" onClick={()=>toggleReviews(it)}>
          <span>Reviews</span>
          <span className="chev">{expanded[it._id] ? '▴' : '▾'}</span>
        </div>

        {expanded[it._id] && (
          <div className="reviews-container">
            {(!reviews[it._id] || reviews[it._id].reviews.length === 0) && <p className="no-reviews">No reviews yet</p>}
            {reviews[it._id] && reviews[it._id].reviews.map((r) => (
              <div className="review-item" key={r._id}>
                  <div className="review-header">
                    <span className="review-stars">{'⭐'.repeat(r.rating)}</span>
                    <span className="review-user">{r.username}</span>
                  </div>
                  <p className="review-body">{r.comment}</p>
                  <span className="review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                  {isAdmin && (
                    <button
                      className="btn-sm btn-delete"
                      onClick={() => deleteReview(it._id, r._id)}
                    >
                      Delete
                    </button>
                  )}
              </div>
            ))}
              <div className="add-review-box">
                <input 
                  placeholder="Add a review..." 
                  className="review-input-text"
                  value={(reviewInputs[it._id] || {}).comment || ''}
                  onChange={e => setReviewInputs(p => ({...p, [it._id]: {...(p[it._id]||{}), comment: e.target.value}}))}
                />
                <div className="review-submit-row">
                    <select 
                      className="rating-select"
                      value={(reviewInputs[it._id] || {}).rating || 5}
                      onChange={e => setReviewInputs(p => ({...p, [it._id]: {...(p[it._id]||{}), rating: Number(e.target.value)}}))}
                    >
                      {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                    </select>
                    <button className="btn-submit-review" onClick={() => submitReviewInline(it._id)}>Post</button>
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  )
}
