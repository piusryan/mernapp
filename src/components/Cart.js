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
  const [locationAllowed, setLocationAllowed] = useState(false)
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
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load cart')
        return r.json()
      })
      .then(setCart)
      .catch((err) => setError(err.message))
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

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (!data || cancelled) return
        const hasLocation = data.location && (data.location.lat != null || data.location.lon != null)
        setLocationAllowed(Boolean(hasLocation))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  const total = (cart.items || []).reduce((sum, i) => sum + i.price * i.quantity, 0)
  const itemsCount = (cart.items || []).length
  const canCheckout = itemsCount > 0 && locationAllowed

  // checkout function removed in favor of Stripe payment flow

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
        <div className="aj-hero-bg-orb aj-hero-orb-1" />
        <div className="aj-hero-bg-orb aj-hero-orb-2" />
        
        <div className="aj-items-header-row" style={{ position: 'relative', zIndex: 2 }}>
          <div>
            <div className="aj-items-title">Your Cart</div>
            <div className="aj-items-sub">
              Review your cuts and generate a bill when you are ready.
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#ff3d7f', position: 'relative', zIndex: 2 }}>{error}</p>}
        {(cart.items || []).length === 0 && !bill && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', position: 'relative', zIndex: 2 }}>
            <h3>Your cart is empty</h3>
            <button className="aj-cta" style={{ marginTop: 20 }} onClick={() => navigate('/items')}>Start Ordering</button>
          </div>
        )}

        {((cart.items && cart.items.length > 0) || bill || latest) && (
          <div className="aj-cart-layout" style={{ position: 'relative', zIndex: 2 }}>
            
            {/* Left Column: Items */}
            <div>
              {cart.items && cart.items.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {cart.items.map((i) => (
                    <div key={String(i.itemId)} className="aj-cart-item-row">
                      <div className="aj-cart-item-info">
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                          🍖
                        </div>
                        <div>
                          <div className="aj-cart-item-name">{i.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>Quantity: {i.quantity}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="aj-cart-item-price">₹{i.price * i.quantity}</div>
                        <button className="aj-remove-btn" onClick={() => removeItem(i.itemId)} title="Remove">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {bill && (
                <div className="aj-receipt-wrapper">
                  <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '1px dashed #ccc', paddingBottom: 16 }}>
                    <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 2 }}>Receipt</h3>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Order #{bill.orderId.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{new Date(bill.createdAt).toLocaleString()}</div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {bill.items.map((i, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                        <span>{i.name} <span style={{ color: '#999' }}>x{i.quantity}</span></span>
                        <span>₹{i.price * i.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ borderTop: '1px dashed #ccc', marginTop: 16, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>TOTAL PAID</span>
                    <span>₹{bill.totalAmount}</span>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#888' }}>
                    Thank you for shopping with AJ Meat Store!
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Summary */}
            <div>
              {!bill && cart.items && cart.items.length > 0 && (
                <div className="aj-summary-card">
                  <div className="aj-summary-title">Order Summary</div>
                  <div className="aj-summary-row">
                    <span>Subtotal</span>
                    <span>₹{total}</span>
                  </div>
                  <div className="aj-summary-row">
                    <span>Taxes & Fees</span>
                    <span>₹0</span>
                  </div>
                  <div className="aj-summary-row">
                    <span>Delivery</span>
                    <span style={{ color: '#0a7' }}>Free</span>
                  </div>
                  <div className="aj-summary-total">
                    <span>Total</span>
                    <span>₹{total}</span>
                  </div>
                  <button 
                    className="aj-checkout-btn" 
                    onClick={() => navigate('/payment')}
                    disabled={!canCheckout}
                  >
                    Checkout Now
                  </button>
                  <button 
                    className="aj-checkout-btn" 
                    style={{ marginLeft: 8, background: '#5b2', borderColor: '#5b2' }}
                    onClick={() => navigate('/phonepe')}
                    disabled={!canCheckout}
                  >
                    Pay with PhonePe
                  </button>
                  {!locationAllowed && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#b00020' }}>
                      To continue, please allow location access when prompted so we can deliver to you.
                    </div>
                  )}
                </div>
              )}

              {latest && (
                <div className="aj-summary-card" style={{ marginTop: 20, animationDelay: '-2s' }}>
                  <div className="aj-summary-title" style={{ fontSize: '1.1rem' }}>Latest Order</div>
                  <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>
                    <strong>ID:</strong> {latest._id.slice(-8)}...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Status:</span>
                    <span className="status-badge" style={{ background: latest.status === 'delivered' ? '#d4edda' : '#fff3cd', color: latest.status === 'delivered' ? '#155724' : '#856404' }}>
                      {latest.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        <div className="cart-promo-video" style={{ marginTop: '32px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxWidth: '300px', margin: '32px auto 0' }}>
          <video autoPlay loop muted playsInline style={{ width: '100%', display: 'block', objectFit: 'cover' }}>
            <source src="/videos/iftarspecial.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  )
}
