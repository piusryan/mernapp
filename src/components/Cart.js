import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../home.css'
import { API_BASE } from '../api'

export default function Cart() {
  const [cart, setCart] = useState({ items: [] })
  const [bill, setBill] = useState(null)
  const [error, setError] = useState('')
  const [latest, setLatest] = useState(null)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (location.state && location.state.bill) {
      setBill(location.state.bill)
      setCart({ items: [] }) // Ensure cart is cleared in UI
      // Clear state so refresh doesn't re-trigger (optional)
      window.history.replaceState({}, document.title)
    }
  }, [location])

  useEffect(() => {
    if (!token) return navigate('/login')
    fetch(`${API_BASE}/api/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setCart)
      .catch(() => setError('Failed to load cart'))
  }, [token, navigate])

  useEffect(() => {
    let timer = null
    async function loadLatest() {
      try {
        const res = await fetch(`${API_BASE}/api/orders/latest`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          if (!latest || latest._id !== data._id || latest.status !== data.status) {
            if (notifyEnabled && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(`Order ${data._id}`, { body: `Status: ${data.status}` })
            }
          }
          setLatest(data)
        }
      } catch {}
    }
    if (token) {
      loadLatest()
      timer = setInterval(loadLatest, 5000)
    }
    return () => { if (timer) clearInterval(timer) }
  }, [token, notifyEnabled, latest])

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  async function checkout() {
    try {
      const res = await fetch(`${API_BASE}/api/cart/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      setBill(data)
      setCart({ items: [] })
    } catch (e) {
      setError(e.message)
    }
  }
  // eslint-disable-next-line no-unused-vars
  async function enableNotify() {
    if (!('Notification' in window)) return alert('Notifications not supported in this browser')
    const perm = await Notification.requestPermission()
    setNotifyEnabled(perm === 'granted')
    if (perm !== 'granted') alert('Please allow notifications to receive order updates')
  }

  async function removeItem(itemId) {
    try {
      const res = await fetch(`${API_BASE}/api/cart/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        return navigate('/login')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remove failed')
      setCart(data)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="container aj-hero-container">
      <div className="aj-items-shell">
        <div className="aj-items-header-row">
          <div>
            <div className="aj-items-title">Cart</div>
            <div className="aj-items-sub">
              Review your cuts and generate a bill when you are ready.
            </div>
          </div>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {cart.items.length === 0 && <p style={{ marginTop: 8 }}>Your cart is empty</p>}

        <div className="two-col">
          <div>
            <h3>Items</h3>
            <ul>
              {cart.items.map((i) => (
                <li key={String(i.itemId)}>
                  {i.name} × {i.quantity}
                  <span className="price">₹{i.price * i.quantity}</span>
                  <button className="btn-modern" style={{ marginLeft: 8 }} onClick={() => removeItem(i.itemId)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Total: ₹{total}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-modern" style={{ background:'#0a7' }} onClick={() => navigate('/payment')} disabled={cart.items.length === 0}>
                Confirm & Pay
              </button>
            </div>
          </div>
          <div>
            {bill && (
              <div className="card">
                <div className="content">
                  <h3>Bill</h3>
                  <div>Order ID: {bill.orderId}</div>
                  <div>Ordered by: {bill.username}</div>
                  <div>Date: {new Date(bill.createdAt).toLocaleString()}</div>
                  <ul>
                    {bill.items.map((i, idx) => (
                      <li key={idx}>
                        {i.name} × {i.quantity}
                        <span className="price">₹{i.price * i.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontWeight: 700 }}>Total: ₹{bill.totalAmount}</div>
                  <p style={{ marginTop: 6, color:'#0a7' }}>A confirmation email has been sent.</p>
                </div>
              </div>
            )}
            {latest && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="content">
                  <h3>Latest Order Status</h3>
                  <div>Order ID: {latest._id}</div>
                  <div>Status: <span className="status-badge">{latest.status}</span></div>
                  <div>Date: {new Date(latest.createdAt).toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
