import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import '../home.css'
import { API_BASE } from '../api'

export default function Navbar() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminForm, setAdminForm] = useState({ name: '', description: '', price: '', category: 'raw', imagePath: '', grams: '', pieces: '', serves: '' })
  const token = localStorage.getItem('token')
  let isAdmin = false
  let username = ''
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isAdmin = payload && payload.role === 'admin' && payload.username === 'AJadmin'
      username = payload.username || ''
    } catch {}
  }
  function submitSearch(e) {
    e.preventDefault()
    const q = term.trim()
    navigate(q ? `/items?q=${encodeURIComponent(q)}` : '/items')
  }
  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const t = localStorage.getItem('token')
      if (!t) return navigate('/login')
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
        body: formData
      })
      if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAdminForm(p => ({ ...p, imagePath: data.path }))
      alert('Image uploaded!')
    } catch (e) {
      alert(e.message)
    }
  }

  async function createItem() {
    try {
      const t = localStorage.getItem('token')
      if (!t) return navigate('/login')
      const res = await fetch(`${API_BASE}/api/admin/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(adminForm),
      })
      if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
      const data = await res.json()
      if (!res.ok) return alert(data.error || 'Create failed')
      alert('Item added')
      setShowAdmin(false)
      if (window.location.pathname === '/items') {
        window.location.reload()
      } else {
        navigate('/items')
      }
    } catch (e) {
      alert(e.message)
    }
  }
  async function importImages() {
    const ok = window.confirm('Import items from server images? This can reset items/carts/orders.')
    if (!ok) return
    const wipeUsers = false
    try {
      const t = localStorage.getItem('token')
      if (!t) return navigate('/login')
      const res = await fetch(`${API_BASE}/api/admin/reset-and-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ wipeUsers }),
      })
      if (res.status === 401) { localStorage.removeItem('token'); return navigate('/login') }
      const data = await res.json()
      if (!res.ok) return alert(data.error || 'Import failed')
      alert('Imported from images')
      setShowAdmin(false)
      if (window.location.pathname === '/items') {
        window.location.reload()
      } else {
        navigate('/items')
      }
    } catch (e) {
      alert(e.message)
    }
  }
  return (
    <>
      <nav className="top-nav">
        <div className="nav-container">
          <div className="brand">
            <img src={`${API_BASE}/site-assets/pk1.jpeg`} alt="brand" className="brand-logo" />
            <span>AJ meat store</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Home</NavLink>
            <NavLink to="/items" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Items</NavLink>
            <NavLink to="/cart" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Cart</NavLink>
            {token && <NavLink to="/wishlist" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Wishlist</NavLink>}
            {isAdmin && <NavLink to="/track" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Track</NavLink>}
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Admin</NavLink>}
          </div>
          <form className="nav-search" onSubmit={submitSearch}>
            <input
              className="search-input"
              placeholder="Search..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className="search-btn" type="submit">🔍</button>
          </form>
          <div className="nav-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {!token && <a href="/login" className="nav-link">Login</a>}
            {token && (
              <NavLink to="/profile" className="profile-circle" title="Profile">
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </NavLink>
            )}
            {isAdmin && (
              <button className="fab-add" title="Add" onClick={()=>setShowAdmin(true)}>+</button>
            )}
          </div>
        </div>
      </nav>
      {showAdmin && (
        <>
          <div className="admin-drawer-backdrop" onClick={()=>setShowAdmin(false)} />
          <div className="admin-drawer" role="dialog" aria-label="Admin Add Item" onClick={(e)=>e.stopPropagation()}>
            <div className="drawer-header">Add New Item</div>
            <div className="drawer-body">
              <label className="drawer-label">Category</label>
              <select className="auth-input" value={adminForm.category} onChange={(e)=>setAdminForm((p)=>({ ...p, category: e.target.value }))}>
                <option value="raw">raw</option>
                <option value="processed">processed</option>
              </select>
              <label className="drawer-label">Name</label>
              <input className="auth-input" value={adminForm.name} onChange={(e)=>setAdminForm((p)=>({ ...p, name: e.target.value }))} />
              <div className="spec-grid">
                <div className="spec-field">
                  <label className="spec-label">Grams</label>
                  <input className="auth-input" type="number" min={0} value={adminForm.grams} onChange={(e)=>setAdminForm((p)=>({ ...p, grams: e.target.value }))} />
                </div>
                <div className="spec-field">
                  <label className="spec-label">Pieces</label>
                  <input className="auth-input" type="number" min={0} value={adminForm.pieces} onChange={(e)=>setAdminForm((p)=>({ ...p, pieces: e.target.value }))} />
                </div>
                <div className="spec-field">
                  <label className="spec-label">Serves</label>
                  <input className="auth-input" type="number" min={0} value={adminForm.serves} onChange={(e)=>setAdminForm((p)=>({ ...p, serves: e.target.value }))} />
                </div>
              </div>
              <label className="drawer-label">Description</label>
              <textarea className="auth-input" rows={3} value={adminForm.description} onChange={(e)=>setAdminForm((p)=>({ ...p, description: e.target.value }))} />
              <label className="drawer-label">Price</label>
              <input className="auth-input" value={adminForm.price} onChange={(e)=>setAdminForm((p)=>({ ...p, price: e.target.value }))} />
              <label className="drawer-label">Image URL (optional)</label>
              <input className="auth-input" value={adminForm.imagePath} onChange={(e)=>setAdminForm((p)=>({ ...p, imagePath: e.target.value }))} />
              <label className="drawer-label" style={{marginTop:8}}>Or Upload File</label>
              <input type="file" className="auth-input" onChange={handleFileUpload} accept="image/*" />
            </div>
            <div className="drawer-actions">
              <button className="auth-btn" onClick={createItem}>Create</button>
              <button className="auth-btn" onClick={importImages}>Import From Images</button>
              <button className="btn-modern" onClick={()=>setShowAdmin(false)}>Close</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
